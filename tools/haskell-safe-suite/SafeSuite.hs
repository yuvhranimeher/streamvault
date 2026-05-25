module Main where

import Control.Monad (forM_, when)
import Data.Char (isAlphaNum, isDigit, isSpace, toLower, toUpper)
import Data.List (groupBy, intercalate, isInfixOf, isPrefixOf, sortOn)
import Data.Ord (Down(..))
import Data.Maybe (fromMaybe)
import System.Directory (createDirectoryIfMissing, doesFileExist, getCurrentDirectory)
import System.FilePath ((</>), takeDirectory)

trim :: String -> String
trim = f . f where f = reverse . dropWhile isSpace

lower :: String -> String
lower = map toLower

firstJust :: [Maybe a] -> Maybe a
firstJust [] = Nothing
firstJust (Just x:_) = Just x
firstJust (Nothing:xs) = firstJust xs

countSub :: String -> String -> Int
countSub needle haystack
  | null needle = 0
  | null haystack = 0
  | needle `isPrefixOf` haystack = 1 + countSub needle (drop (length needle) haystack)
  | otherwise = countSub needle (tail haystack)

writeOut :: FilePath -> String -> IO ()
writeOut fp body = do
  createDirectoryIfMissing True (takeDirectory fp)
  writeFile fp body
  putStrLn ("WROTE: " ++ fp)

sourceMediaFiles :: [FilePath]
sourceMediaFiles =
  [ "approved-clean-catalog.json"
  , "catalog.json"
  , "data/catalogs/approved-clean-catalog.json"
  , "data/catalogs/catalog.json"
  ]

sourceDownloadFiles :: [FilePath]
sourceDownloadFiles =
  [ "software-catalog.json"
  , "downloads-catalog.json"
  , "data/software-catalog.json"
  , "data/catalogs/software-catalog.json"
  , "catalog/software-catalog.json"
  ]

firstExisting :: FilePath -> [FilePath] -> IO (Maybe FilePath)
firstExisting _ [] = pure Nothing
firstExisting root (x:xs) = do
  let p = root </> x
  ok <- doesFileExist p
  if ok then pure (Just p) else firstExisting root xs

readMaybeFile :: FilePath -> IO String
readMaybeFile fp = do
  ok <- doesFileExist fp
  if ok then readFile fp else pure ""

splitObjects :: String -> [String]
splitObjects xs = reverse (finish st)
  where
    st = foldl step (0, 0, False, False, "", []) xs
    finish (_,_,_,_,cur,acc) =
      let c = trim (reverse cur)
      in if null c then acc else c:acc

    step (brace, bracket, instr, esc, cur, acc) c
      | esc = (brace, bracket, instr, False, c:cur, acc)
      | instr && c == '\\' = (brace, bracket, instr, True, c:cur, acc)
      | c == '"' = (brace, bracket, not instr, False, c:cur, acc)
      | instr = (brace, bracket, instr, False, c:cur, acc)
      | c == '{' = (brace + 1, bracket, instr, False, c:cur, acc)
      | c == '}' = (brace - 1, bracket, instr, False, c:cur, acc)
      | c == '[' = (brace, bracket + 1, instr, False, c:cur, acc)
      | c == ']' = (brace, bracket - 1, instr, False, c:cur, acc)
      | c == ',' && brace == 0 && bracket == 0 =
          let obj = trim (reverse cur)
          in (brace, bracket, instr, False, "", if null obj then acc else obj:acc)
      | otherwise = (brace, bracket, instr, False, c:cur, acc)

dropUntil :: String -> String -> Maybe String
dropUntil marker s
  | null s = Nothing
  | marker `isPrefixOf` s = Just (drop (length marker) s)
  | otherwise = dropUntil marker (tail s)

takeArray :: Int -> Bool -> Bool -> String -> String -> (String, String)
takeArray _ _ _ acc [] = (reverse acc, [])
takeArray depth instr esc acc (c:cs)
  | esc = takeArray depth instr False (c:acc) cs
  | instr && c == '\\' = takeArray depth instr True (c:acc) cs
  | c == '"' = takeArray depth (not instr) False (c:acc) cs
  | instr = takeArray depth instr False (c:acc) cs
  | c == '[' = takeArray (depth + 1) instr False (c:acc) cs
  | c == ']' && depth == 0 = (reverse acc, cs)
  | c == ']' = takeArray (depth - 1) instr False (c:acc) cs
  | otherwise = takeArray depth instr False (c:acc) cs

findArray :: String -> String -> Maybe String
findArray key raw =
  firstJust
    [ findAfter ("\"" ++ key ++ "\":[") raw
    , findAfter ("\"" ++ key ++ "\": [") raw
    ]
  where
    findAfter marker body =
      case dropUntil marker body of
        Nothing -> Nothing
        Just rest -> Just (fst (takeArray 0 False False "" rest))

readJsonString :: String -> String
readJsonString = go False ""
  where
    go _ acc [] = reverse acc
    go True acc (c:cs) = go False (unesc c : acc) cs
    go False acc ('\\':cs) = go True acc cs
    go False acc ('"':_) = reverse acc
    go False acc (c:cs) = go False (c:acc) cs
    unesc 'n' = '\n'
    unesc 'r' = '\r'
    unesc 't' = '\t'
    unesc c = c

fieldValue :: String -> String -> Maybe String
fieldValue field obj =
  firstJust
    [ valueAfter ("\"" ++ field ++ "\":\"") obj
    , valueAfter ("\"" ++ field ++ "\": \"") obj
    ]
  where
    valueAfter marker body =
      case dropUntil marker body of
        Nothing -> Nothing
        Just rest -> Just (readJsonString rest)

jsonString :: String -> String
jsonString s = "\"" ++ concatMap esc s ++ "\""
  where
    esc '"' = "\\\""
    esc '\\' = "\\\\"
    esc '\n' = "\\n"
    esc '\r' = "\\r"
    esc '\t' = "\\t"
    esc c = [c]

joinComma :: [String] -> String
joinComma [] = ""
joinComma [x] = x
joinComma (x:xs) = x ++ "," ++ joinComma xs

cleanSeparators :: String -> String
cleanSeparators = map repl
  where
    repl c
      | c `elem` ". _-[](){}+:" = ' '
      | isAlphaNum c = c
      | otherwise = ' '

titleCaseWord :: String -> String
titleCaseWord [] = []
titleCaseWord (x:xs) = toUpper x : map toLower xs

isYear :: String -> Bool
isYear [a,b,c,d] =
  all isDigit [a,b,c,d] &&
  let n = read [a,b,c,d] :: Int
  in n >= 1900 && n <= 2099
isYear _ = False

extractYear :: String -> String
extractYear raw =
  case filter isYear (words (cleanSeparators raw)) of
    (y:_) -> y
    [] -> ""

junkTokens :: [String]
junkTokens =
  [ "480p","576p","720p","1080p","2160p","4k","uhd","hdr","hdrip"
  , "bluray","brrip","webrip","webdl","web-dl","dvdrip","hdtc","hdcam"
  , "x264","x265","h264","h265","hevc","aac","ac3","ddp5","dd5","ddp","dts"
  , "rarbg","yts","yify","galaxyrg","mkvcage","msmod","hdhub","hdhub4u"
  , "nf","amzn","dsnp","zee5","web","rip","dual","audio","hindi","english"
  , "esub","msubs","multi","untouched","uncensored","proper","repack"
  , "sample","trailer","teaser","promo","cam","hdts"
  ]

normalizeTitle :: String -> String
normalizeTitle raw =
  let ws = words (cleanSeparators raw)
      keep w =
        let lw = lower w
        in not (lw `elem` junkTokens) &&
           not (isYear w) &&
           length lw > 1
  in intercalate " " (map titleCaseWord (filter keep ws))

pickRaw :: String -> String
pickRaw obj =
  fromMaybe "" $
    firstJust
      [ fieldValue "title" obj
      , fieldValue "name" obj
      , fieldValue "filename" obj
      , fieldValue "file" obj
      , fieldValue "streamUrl" obj
      ]

tsvEscape :: String -> String
tsvEscape = map repl
  where
    repl '\t' = ' '
    repl '\n' = ' '
    repl '\r' = ' '
    repl c = c

makePage :: String -> Int -> Int -> [String] -> String
makePage mediaType page limit items =
  let start = page * limit
      pageItems = take limit (drop start items)
      total = length items
      pages = if limit <= 0 then 0 else ceiling (fromIntegral total / fromIntegral limit :: Double)
  in "{"
     ++ "\"ok\":true,"
     ++ "\"type\":\"" ++ mediaType ++ "\","
     ++ "\"page\":" ++ show page ++ ","
     ++ "\"limit\":" ++ show limit ++ ","
     ++ "\"total\":" ++ show total ++ ","
     ++ "\"pages\":" ++ show pages ++ ","
     ++ "\"items\":[" ++ joinComma pageItems ++ "]"
     ++ "}"

takeItemsInArrays :: Int -> String -> String
takeItemsInArrays limit = go
  where
    marker = "\"items\":["
    go [] = []
    go s
      | marker `isPrefixOf` s = marker ++ limitedArray rest
      | otherwise = head s : go (tail s)
      where rest = drop (length marker) s

    limitedArray s =
      let (arrBody, after) = takeArray 0 False False "" s
          items = splitObjects arrBody
      in joinComma (take limit items) ++ "]" ++ go after

safeSlug :: String -> String
safeSlug = map repl . lower
  where
    repl c | isAlphaNum c = c
           | otherwise = '-'

searchItems :: String -> [String] -> [String]
searchItems q items =
  let ql = lower q
  in filter (\obj -> ql `isInfixOf` lower obj) items

validate :: String -> String
validate obj =
  let raw = pickRaw obj
      lraw = lower raw
      norm = normalizeTitle raw
      hasAny needles hay = any (`isInfixOf` lower hay) needles
      isBadExt = hasAny [".jpg",".jpeg",".png",".gif",".webp",".txt",".nfo",".srt",".ass",".sub"] lraw
      isVideoLike = hasAny [".mkv",".mp4",".avi",".mov",".m4v",".webm",".ts",".m3u8"] lraw
  in if null (trim raw) then "reject:missing-title"
     else if isBadExt then "reject:non-video-file"
     else if hasAny ["sample","trailer","teaser","promo"] lraw then "reject:sample-trailer-promo"
     else if null norm || length norm < 3 then "reject:weak-normalized-title"
     else if all isDigit (filter (/=' ') norm) then "reject:pure-number-title"
     else if isVideoLike || "streamUrl" `isInfixOf` obj then "accept"
     else "warn:unknown-media-shape"

data Entry = Entry { eKey :: String, eType :: String, eRaw :: String, eNorm :: String, eYear :: String }

makeEntry :: String -> String -> Entry
makeEntry mediaType obj =
  let raw = pickRaw obj
      norm = normalizeTitle raw
      y1 = fromMaybe "" (fieldValue "year" obj)
      y2 = extractYear raw
      year = if null y1 then y2 else y1
      key = lower mediaType ++ "|" ++ lower norm ++ "|" ++ year
  in Entry key mediaType raw norm year

groupDuplicates :: [Entry] -> [[Entry]]
groupDuplicates entries =
  let sorted = sortOn eKey (filter valid entries)
      grouped = groupBy (\a b -> eKey a == eKey b) sorted
  in filter (\g -> length g > 1) grouped
  where valid e = not (null (eNorm e)) && length (eNorm e) >= 3

rowForGroup :: [Entry] -> String
rowForGroup [] = ""
rowForGroup g@(x:_) =
  intercalate "\t" (map tsvEscape
    [ eKey x, show (length g), eType x, eNorm x, eYear x
    , intercalate " | " (take 5 (map eRaw g))
    ])

main :: IO ()
main = do
  root <- getCurrentDirectory
  let outDir = root </> "tools" </> "haskell-safe-suite" </> "out"
  createDirectoryIfMissing True outDir

  mediaFound <- firstExisting root sourceMediaFiles
  dlFound <- firstExisting root sourceDownloadFiles

  mediaRaw <- maybe (pure "") readFile mediaFound
  dlRaw <- maybe (pure "") readFile dlFound
  homeRaw <- readMaybeFile (root </> "home-feed.json")
  sectionRaw <- readMaybeFile (root </> "section-catalog.json")

  let movies = maybe [] splitObjects (findArray "movies" mediaRaw)
      series = maybe [] splitObjects (findArray "series" mediaRaw)
      allMedia = map (\o -> "{\"_type\":\"movie\"," ++ drop 1 o) movies
              ++ map (\o -> "{\"_type\":\"series\"," ++ drop 1 o) series

  putStrLn "StreamVault Haskell ALL-IN-ONE Safe Suite"
  putStrLn "No server. No ports. File-output only."
  putStrLn ("Media source: " ++ fromMaybe "MISS" mediaFound)
  putStrLn ("Download source: " ++ fromMaybe "MISS" dlFound)
  putStrLn ("Movies parsed: " ++ show (length movies))
  putStrLn ("Series parsed: " ++ show (length series))
  putStrLn ""

  -- 1 catalog reader/report
  writeOut (outDir </> "01-catalog-report.txt") $
    unlines
      [ "StreamVault Haskell Catalog Report"
      , "mediaSource=" ++ fromMaybe "MISS" mediaFound
      , "downloadSource=" ++ fromMaybe "MISS" dlFound
      , "movies=" ++ show (length movies)
      , "series=" ++ show (length series)
      , "streamUrlCount=" ++ show (countSub "\"streamUrl\"" mediaRaw)
      , "posterCount=" ++ show (countSub "\"poster\"" mediaRaw)
      ]

  -- 2 JSON API builder
  writeOut (outDir </> "02-api-health.json") "{\"ok\":true,\"runtime\":\"haskell\",\"suite\":\"safe-all-in-one\",\"server\":false}\n"
  when (not (null homeRaw)) (writeOut (outDir </> "02-api-home-feed-copy.json") homeRaw)
  when (not (null sectionRaw)) (writeOut (outDir </> "02-api-section-catalog-copy.json") sectionRaw)

  -- 3 home-feed pager
  when (not (null homeRaw)) $ do
    writeOut (outDir </> "03-api-home-feed-limit-3.json") (takeItemsInArrays 3 homeRaw)
    writeOut (outDir </> "03-api-home-feed-limit-6.json") (takeItemsInArrays 6 homeRaw)

  -- 4 section pager
  when (not (null sectionRaw)) $
    forM_ ["netflix","marvel","dc","trending","series","allMovies","recentlyAdded","horrorNights","cyberpunkScifi"] $ \key ->
      case findArray key sectionRaw of
        Nothing -> pure ()
        Just arr -> do
          let items = splitObjects arr
          writeOut (outDir </> ("04-api-section-" ++ key ++ "-page-0-limit-6.json")) (makePage key 0 6 items)

  -- 5 downloads pager
  when (not (null dlRaw)) $
    case firstJust [findArray "downloads" dlRaw, findArray "items" dlRaw] of
      Nothing -> pure ()
      Just arr -> do
        let items = splitObjects arr
        writeOut (outDir </> "05-api-downloads-page-0-limit-20.json") (makePage "downloads" 0 20 items)
        writeOut (outDir </> "05-api-downloads-page-1-limit-20.json") (makePage "downloads" 1 20 items)

  -- 6 media browse pager
  writeOut (outDir </> "06-api-movies-page-0-limit-24.json") (makePage "movies" 0 24 movies)
  writeOut (outDir </> "06-api-series-page-0-limit-24.json") (makePage "series" 0 24 series)

  -- 7 search index outputs
  forM_ ["spider","dark","avengers","korean","netflix","hindi"] $ \q -> do
    let results = searchItems q allMedia
        body = "{"
            ++ "\"ok\":true,"
            ++ "\"query\":" ++ jsonString q ++ ","
            ++ "\"totalMatches\":" ++ show (length results) ++ ","
            ++ "\"items\":[" ++ joinComma (take 20 results) ++ "]}"
    writeOut (outDir </> ("07-api-search-" ++ safeSlug q ++ ".json")) body

  -- 8 title normalizer
  let normRows =
        "type\trawTitle\tnormalizedTitle\tyear" :
        [ intercalate "\t" (map tsvEscape ["movie", pickRaw o, normalizeTitle (pickRaw o), extractYear (pickRaw o)])
        | o <- take 200 movies ] ++
        [ intercalate "\t" (map tsvEscape ["series", pickRaw o, normalizeTitle (pickRaw o), extractYear (pickRaw o)])
        | o <- take 200 series ]
  writeOut (outDir </> "08-normalized-title-sample.tsv") (unlines normRows)

  -- 9 media validator
  let valRows =
        "type\tresult\traw\tnormalized" :
        [ intercalate "\t" (map tsvEscape ["movie", validate o, pickRaw o, normalizeTitle (pickRaw o)])
        | o <- take 500 movies ] ++
        [ intercalate "\t" (map tsvEscape ["series", validate o, pickRaw o, normalizeTitle (pickRaw o)])
        | o <- take 500 series ]
  writeOut (outDir </> "09-media-validation-sample.tsv") (unlines valRows)

  -- 10 dedupe preview
  let entries = map (makeEntry "movie") movies ++ map (makeEntry "series") series
      dups = sortOn (Down . length) (groupDuplicates entries)
      dedupeRows = "key\tduplicateCount\ttype\tnormalizedTitle\tyear\texamples" : map rowForGroup (take 300 dups)
  writeOut (outDir </> "10-duplicate-preview.tsv") (unlines dedupeRows)

  putStrLn ""
  putStrLn "OK: all safe Haskell module outputs generated."