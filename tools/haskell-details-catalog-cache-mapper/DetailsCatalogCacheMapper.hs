-- StreamVault Details Catalog-to-Cache Mapper V3
-- Read-only Haskell tool.
-- Improved mapper:
--   1) exact key using title year first,
--   2) exact key using API/catalog year,
--   3) fuzzy normalized title-only cache key match.
--
-- No production routes are changed.

module Main where

import System.Directory (doesFileExist, createDirectoryIfMissing)
import System.FilePath ((</>))
import Data.Char (isAlphaNum, isDigit, isSpace, toLower)
import Data.List (isInfixOf, stripPrefix, nub)

data Probe = Probe
  { pKind :: String
  , pId :: String
  , pTitle :: String
  , pYear :: String
  , pTitleYear :: String
  } deriving Show

data CacheKey = CacheKey
  { ckRaw :: String
  , ckKind :: String
  , ckTitle :: String
  , ckYear :: String
  , ckNormTitle :: String
  } deriving Show

splitTab :: String -> [String]
splitTab s = go s "" []
  where
    go [] cur acc = reverse (reverse cur : acc)
    go ('\t':xs) cur acc = go xs "" (reverse cur : acc)
    go (x:xs) cur acc = go xs (x:cur) acc

parseProbe :: String -> Maybe Probe
parseProbe line =
  case splitTab line of
    [k,i,t,y,ty] -> Just (Probe k i t y ty)
    _ -> Nothing

readProbes :: FilePath -> IO [Probe]
readProbes p = do
  ok <- doesFileExist p
  if not ok then pure [] else do
    ls <- lines <$> readFile p
    pure [x | Just x <- map parseProbe (drop 1 ls)]

scanTopKeys :: String -> [String]
scanTopKeys = reverse . keys . foldl step emptyState
  where
    step st c
      | inString st =
          if escapeNext st
            then st { currentString = currentString st ++ [c], escapeNext = False }
            else case c of
              '\\' -> st { escapeNext = True }
              '"'  -> st { inString = False, currentString = "", lastString = Just (currentString st) }
              _    -> st { currentString = currentString st ++ [c] }

      | c == '"' =
          st { inString = True, currentString = "", escapeNext = False }

      | c == '{' =
          st { depth = depth st + 1, expectTopKey = depth st == 0 }

      | c == '}' =
          st { depth = max 0 (depth st - 1), expectTopKey = False }

      | c == ':' && depth st == 1 =
          case lastString st of
            Just k | expectTopKey st ->
              st { keys = k : keys st, lastString = Nothing, expectTopKey = False }
            _ -> st

      | c == ',' && depth st == 1 =
          st { expectTopKey = True, lastString = Nothing }

      | otherwise =
          st

data ScanState = ScanState
  { depth :: Int
  , inString :: Bool
  , escapeNext :: Bool
  , currentString :: String
  , lastString :: Maybe String
  , expectTopKey :: Bool
  , keys :: [String]
  } deriving Show

emptyState :: ScanState
emptyState = ScanState 0 False False "" Nothing True []

parseCacheKey :: String -> Maybe CacheKey
parseCacheKey raw =
  case stripPrefix "movie:" raw of
    Just rest -> make "movie" raw rest
    Nothing ->
      case stripPrefix "tv:" raw of
        Just rest -> make "series" raw rest
        Nothing -> Nothing
  where
    make k r body =
      let (titlePart, yearPart) = splitLastColon body
      in Just (CacheKey r k titlePart yearPart (normalizeTitle titlePart))

splitLastColon :: String -> (String, String)
splitLastColon s =
  let rev = reverse s
      (yrRev, restRev) = break (== ':') rev
  in case restRev of
       [] -> (s, "")
       (_:titleRev) -> (reverse titleRev, reverse yrRev)

keyPrefix :: String -> String
keyPrefix "movie" = "movie:"
keyPrefix "series" = "tv:"
keyPrefix "tv" = "tv:"
keyPrefix _ = ""

candidateYears :: Probe -> [String]
candidateYears p = nub $ filter (not . null) [pTitleYear p, pYear p, extractYearFromTitle (pTitle p)]

candidateTitles :: Probe -> [String]
candidateTitles p = nub $ filter (not . null)
  [ cleanTitle (pTitle p)
  , trimYearParen (pTitle p)
  , pTitle p
  ]

candidateKeys :: Probe -> [String]
candidateKeys p =
  let pref = keyPrefix (pKind p)
      years = candidateYears p
      titles = candidateTitles p
      exacts = [pref ++ t ++ ":" ++ y | t <- titles, y <- years]
      loose  = [pref ++ t ++ ":" | t <- titles]
      ids    = [pref ++ pId p ++ ":" ++ y | y <- years]
  in nub (filter (\x -> length x > 8) (exacts ++ ids ++ loose))

findExact :: [String] -> [CacheKey] -> Maybe String
findExact candidates cks =
  case [ckRaw ck | ck <- cks, ckRaw ck `elem` candidates] of
    (x:_) -> Just x
    [] -> Nothing

findFuzzy :: Probe -> [CacheKey] -> Maybe String
findFuzzy p cks =
  let wantedKind = pKind p
      wantedNorms = nub $ filter (not . null) $ map normalizeTitle (candidateTitles p)
      sameKind ck = ckKind ck == wantedKind || (wantedKind == "tv" && ckKind ck == "series")
      hits = [ckRaw ck | ck <- cks, sameKind ck, ckNormTitle ck `elem` wantedNorms]
  in case hits of
       (x:_) -> Just x
       [] -> Nothing

statusFor :: [CacheKey] -> Probe -> [String]
statusFor cks p =
  let cands = candidateKeys p
      exact = findExact cands cks
      fuzzy = findFuzzy p cks
  in case exact of
       Just k ->
         [pKind p, pId p, pTitle p, pYear p, pTitleYear p, "HIT_EXACT", k, joinPipe cands]
       Nothing ->
         case fuzzy of
           Just k -> [pKind p, pId p, pTitle p, pYear p, pTitleYear p, "HIT_TITLE_FUZZY", k, joinPipe cands]
           Nothing -> [pKind p, pId p, pTitle p, pYear p, pTitleYear p, "MISS", "", joinPipe cands]

cleanTitle :: String -> String
cleanTitle = trimSpaces . removeBracketContent . trimYearParen . trimQualityNoise

trimQualityNoise :: String -> String
trimQualityNoise s =
  cutAtAny
    [ " 1080p", " 720p", " 2160p", " 480p", " 4K"
    , " BluRay", " WEBRip", " WEB-DL", " HDRip", " BRRip", " DVDRip"
    , " AMZN", " NF", " DSNP", " HMAX"
    , " Hindi", " English", " Dual Audio", " Multi Audio"
    , " x264", " x265", " HEVC", " AAC", " DTS", " ESub", " MSubs"
    , " TV Series", " TV Mini Series"
    ] s

cutAtAny :: [String] -> String -> String
cutAtAny [] s = s
cutAtAny (m:ms) s =
  case breakOn m s of
    Just before -> before
    Nothing -> cutAtAny ms s

breakOn :: String -> String -> Maybe String
breakOn needle haystack = go "" haystack
  where
    go _ [] = Nothing
    go acc rest
      | startsWith needle rest = Just (reverse acc)
      | otherwise = go (head rest : acc) (tail rest)

startsWith :: String -> String -> Bool
startsWith [] _ = True
startsWith _ [] = False
startsWith (a:as) (b:bs) = a == b && startsWith as bs

trimYearParen :: String -> String
trimYearParen s =
  trimSpaces (removeYearParens s)

removeYearParens :: String -> String
removeYearParens [] = []
removeYearParens ('(':a:b:c:d:')':xs)
  | all isDigit [a,b,c,d] = removeYearParens xs
removeYearParens (x:xs) = x : removeYearParens xs

extractYearFromTitle :: String -> String
extractYearFromTitle [] = ""
extractYearFromTitle ('(':a:b:c:d:')':_)
  | all isDigit [a,b,c,d] && (a == '1' || a == '2') = [a,b,c,d]
extractYearFromTitle (_:xs) = extractYearFromTitle xs

removeBracketContent :: String -> String
removeBracketContent [] = []
removeBracketContent ('(':xs) = removeBracketContent (dropUntil ')' xs)
removeBracketContent ('[':xs) = removeBracketContent (dropUntil ']' xs)
removeBracketContent (x:xs) = x : removeBracketContent xs

dropUntil :: Char -> String -> String
dropUntil _ [] = []
dropUntil c (x:xs)
  | c == x = xs
  | otherwise = dropUntil c xs

normalizeTitle :: String -> String
normalizeTitle = unwords . words . map norm . cleanTitle
  where
    norm c
      | isAlphaNum c = toLower c
      | otherwise = ' '

trimSpaces :: String -> String
trimSpaces = reverse . dropWhile isSpace . reverse . dropWhile isSpace

joinPipe :: [String] -> String
joinPipe [] = ""
joinPipe [x] = x
joinPipe (x:xs) = x ++ " | " ++ joinPipe xs

safe :: String -> String
safe = map (\c -> if c == '\t' || c == '\n' || c == '\r' then ' ' else c)

tsvLine :: [String] -> String
tsvLine [] = ""
tsvLine [x] = safe x
tsvLine (x:xs) = safe x ++ "\t" ++ tsvLine xs

countStatus :: String -> [[String]] -> Int
countStatus st rows = length [() | r <- rows, length r > 5, r !! 5 == st]

main :: IO ()
main = do
  createDirectoryIfMissing True ("tools" </> "haskell-details-catalog-cache-mapper" </> "out")
  cacheOk <- doesFileExist "detail-cache.json"
  probes <- readProbes ("tools" </> "haskell-details-catalog-cache-mapper" </> "out" </> "details-catalog-probes.tsv")

  if not cacheOk
    then putStrLn "detail-cache.json not found"
    else do
      cache <- readFile "detail-cache.json"
      let cacheKeys = [ck | Just ck <- map parseCacheKey (scanTopKeys cache)]
      let rows = map (statusFor cacheKeys) probes
      let total = length rows
      let exactHits = countStatus "HIT_EXACT" rows
      let fuzzyHits = countStatus "HIT_TITLE_FUZZY" rows
      let misses = countStatus "MISS" rows
      let header = ["kind","id","title","year","titleYear","status","matchedKey","candidateKeys"]
      writeFile ("tools" </> "haskell-details-catalog-cache-mapper" </> "out" </> "details-catalog-cache-map.tsv")
        (unlines (tsvLine header : map tsvLine rows))

      let report =
            [ "StreamVault Haskell Details Catalog-to-Cache Mapper V3 Report"
            , replicate 72 '='
            , ""
            , "Status: read-only improved mapping prototype."
            , "No frontend/server/playback/FFmpeg files were changed."
            , ""
            , "Probe count: " ++ show total
            , "Cache keys parsed: " ++ show (length cacheKeys)
            , "Exact key hits: " ++ show exactHits
            , "Fuzzy title hits: " ++ show fuzzyHits
            , "Total hits: " ++ show (exactHits + fuzzyHits)
            , "Cache key misses: " ++ show misses
            , ""
            , "Interpretation:"
            , "- HIT_EXACT = safe strongest candidate for Haskell detail-cache lookup."
            , "- HIT_TITLE_FUZZY = likely candidate, but must verify output parity before frontend shadow."
            , "- MISS = needs TMDB/catalog fallback or better title normalization."
            , ""
            , "Output:"
            , "- details-catalog-cache-map.tsv"
            , ""
            , "Next:"
            , "- Build Haskell /api/details fixtures for HIT_EXACT first."
            , "- Then compare Node vs Haskell details responses."
            , "- Keep details shadow disabled until parity is proven."
            , ""
            , "First 50 rows:"
            ] ++ map joinPipe (take 50 rows)

      writeFile ("tools" </> "haskell-details-catalog-cache-mapper" </> "out" </> "details-catalog-cache-mapper-report.txt")
        (unlines report)
      putStrLn (unlines report)
