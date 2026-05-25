-- StreamVault Details Catalog-to-Cache Mapper V2
-- Read-only Haskell tool.
-- Maps sampled frontend IDs/titles to detail-cache.json keys:
--   movie:<clean title>:<year>
--   tv:<clean title>:<year>
-- Also checks if raw title/year and id/year keys exist.

module Main where

import System.Directory (doesFileExist, createDirectoryIfMissing)
import System.FilePath ((</>))
import Data.Char (isDigit, isSpace)
import Data.List (isInfixOf)

data Probe = Probe
  { pKind :: String
  , pId :: String
  , pTitle :: String
  , pYear :: String
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
    [k,i,t,y] -> Just (Probe k i t y)
    _ -> Nothing

readProbes :: FilePath -> IO [Probe]
readProbes p = do
  ok <- doesFileExist p
  if not ok then pure [] else do
    ls <- lines <$> readFile p
    pure [x | Just x <- map parseProbe (drop 1 ls)]

containsKey :: String -> String -> Bool
containsKey needle haystack = ("\"" ++ needle ++ "\"") `isInfixOf` haystack

startsWith :: String -> String -> Bool
startsWith [] _ = True
startsWith _ [] = False
startsWith (a:as) (b:bs) = a == b && startsWith as bs

cleanTitle :: String -> String
cleanTitle s =
  trimSpaces $ trimYearParen $ trimQualityNoise s

trimSpaces :: String -> String
trimSpaces = reverse . dropWhile isSpace . reverse . dropWhile isSpace

trimYearParen :: String -> String
trimYearParen s =
  let t = trimSpaces s
  in case reverse t of
       (')':a:b:c:d:'(':rest)
         | all isDigit [a,b,c,d] -> trimSpaces (reverse rest)
       _ -> t

trimQualityNoise :: String -> String
trimQualityNoise s =
  let markers =
        [ " 1080p", " 720p", " 2160p", " 480p"
        , " BluRay", " WEBRip", " WEB-DL", " HDRip", " BRRip"
        , " AMZN", " NF", " DSNP", " HMAX"
        , " Hindi", " English", " Dual Audio", " Multi Audio"
        , " x264", " x265", " HEVC", " AAC", " DTS", " ESub", " MSubs"
        , " TV Series", " TV Mini Series"
        ]
  in cutAtAny markers s

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
      | needle `startsWith` rest = Just (reverse acc)
      | otherwise = go (head rest : acc) (tail rest)

keyPrefix :: String -> String
keyPrefix "movie" = "movie:"
keyPrefix "series" = "tv:"
keyPrefix "tv" = "tv:"
keyPrefix _ = ""

candidateKeys :: Probe -> [String]
candidateKeys p =
  let pref = keyPrefix (pKind p)
      title = cleanTitle (pTitle p)
      rawTitle = trimYearParen (pTitle p)
      yr = pYear p
  in filter validKey
      [ pref ++ title ++ ":" ++ yr
      , pref ++ rawTitle ++ ":" ++ yr
      , pref ++ pId p ++ ":" ++ yr
      , pref ++ title ++ ":"
      , pref ++ rawTitle ++ ":"
      ]
  where
    validKey x = length x > 8

statusFor :: String -> Probe -> [String]
statusFor cache p =
  let cands = candidateKeys p
      hits = filter (`containsKey` cache) cands
  in [ pKind p
     , pId p
     , pTitle p
     , pYear p
     , if null hits then "MISS" else "HIT"
     , if null hits then "" else head hits
     , joinPipe cands
     ]

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

countHits :: [[String]] -> Int
countHits rows = length [() | r <- rows, length r > 4, r !! 4 == "HIT"]

main :: IO ()
main = do
  createDirectoryIfMissing True ("tools" </> "haskell-details-catalog-cache-mapper" </> "out")
  cacheOk <- doesFileExist "detail-cache.json"
  probes <- readProbes ("tools" </> "haskell-details-catalog-cache-mapper" </> "out" </> "details-catalog-probes.tsv")

  if not cacheOk
    then putStrLn "detail-cache.json not found"
    else do
      cache <- readFile "detail-cache.json"
      let rows = map (statusFor cache) probes
      let total = length rows
      let hits = countHits rows
      let misses = total - hits
      let header = ["kind","id","title","year","status","matchedKey","candidateKeys"]
      writeFile ("tools" </> "haskell-details-catalog-cache-mapper" </> "out" </> "details-catalog-cache-map.tsv")
        (unlines (tsvLine header : map tsvLine rows))

      let report =
            [ "StreamVault Haskell Details Catalog-to-Cache Mapper V2 Report"
            , replicate 72 '='
            , ""
            , "Status: read-only mapping prototype."
            , "No frontend/server/playback/FFmpeg files were changed."
            , ""
            , "Probe count: " ++ show total
            , "Cache key hits: " ++ show hits
            , "Cache key misses: " ++ show misses
            , ""
            , "Interpretation:"
            , "- HIT means Haskell can likely serve details from detail-cache.json after ID/title mapping."
            , "- MISS means Haskell needs catalog normalization/TMDB fallback/Node-compatible lookup."
            , ""
            , "Output:"
            , "- details-catalog-cache-map.tsv"
            , ""
            , "Next:"
            , "- Use HIT rows to build first /api/details fixture parity."
            , "- Keep details shadow disabled until output parity is proven."
            , ""
            , "First 40 rows:"
            ] ++ map (joinPipe) (take 40 rows)

      writeFile ("tools" </> "haskell-details-catalog-cache-mapper" </> "out" </> "details-catalog-cache-mapper-report.txt")
        (unlines report)
      putStrLn (unlines report)
