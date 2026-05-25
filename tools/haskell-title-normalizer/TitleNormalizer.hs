module Main where

import Data.Char (isAlphaNum, isDigit, isSpace, toLower, toUpper)
import Data.List (intercalate, isPrefixOf)
import Data.Maybe (fromMaybe)
import System.Directory (createDirectoryIfMissing, doesFileExist, getCurrentDirectory)
import System.FilePath ((</>))

trim :: String -> String
trim = f . f
  where f = reverse . dropWhile isSpace

lower :: String -> String
lower = map toLower

countSub :: String -> String -> Int
countSub needle haystack
  | null needle = 0
  | null haystack = 0
  | needle `isPrefixOf` haystack = 1 + countSub needle (drop (length needle) haystack)
  | otherwise = countSub needle (tail haystack)

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

    firstJust [] = Nothing
    firstJust (Just x:_) = Just x
    firstJust (Nothing:xs) = firstJust xs

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

    firstJust [] = Nothing
    firstJust (Just x:_) = Just x
    firstJust (Nothing:xs) = firstJust xs

sourceFiles :: [FilePath]
sourceFiles =
  [ "approved-clean-catalog.json"
  , "catalog.json"
  , "data/catalogs/approved-clean-catalog.json"
  , "data/catalogs/catalog.json"
  ]

firstExisting :: FilePath -> [FilePath] -> IO (Maybe FilePath)
firstExisting _ [] = pure Nothing
firstExisting root (x:xs) = do
  let p = root </> x
  ok <- doesFileExist p
  if ok then pure (Just p) else firstExisting root xs

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
  ]

cleanSeparators :: String -> String
cleanSeparators = map repl
  where
    repl c
      | c `elem` ". _-[](){}+" = ' '
      | isAlphaNum c = c
      | otherwise = ' '

titleCaseWord :: String -> String
titleCaseWord [] = []
titleCaseWord (x:xs) = toUpper x : map toLower xs

normalizeTitle :: String -> String
normalizeTitle raw =
  let ws = words (cleanSeparators raw)
      filtered = filter keep ws
      keep w =
        let lw = lower w
        in not (lw `elem` junkTokens) &&
           not (isYear w) &&
           length lw > 1
  in intercalate " " (map titleCaseWord filtered)

pickRawTitle :: String -> String
pickRawTitle obj =
  fromMaybe "" $
    firstJust
      [ fieldValue "title" obj
      , fieldValue "name" obj
      , fieldValue "filename" obj
      , fieldValue "file" obj
      ]
  where
    firstJust [] = Nothing
    firstJust (Just x:_) = Just x
    firstJust (Nothing:xs) = firstJust xs

tsvEscape :: String -> String
tsvEscape = map repl
  where
    repl '\t' = ' '
    repl '\n' = ' '
    repl '\r' = ' '
    repl c = c

makeRows :: String -> [String] -> [String]
makeRows mediaType objs =
  map one (take 200 objs)
  where
    one obj =
      let rawTitle = pickRawTitle obj
          y1 = fromMaybe "" (fieldValue "year" obj)
          y2 = extractYear rawTitle
          year = if null y1 then y2 else y1
          norm = normalizeTitle rawTitle
      in intercalate "\t" (map tsvEscape [mediaType, rawTitle, norm, year])

main :: IO ()
main = do
  root <- getCurrentDirectory
  let outDir = root </> "tools" </> "haskell-title-normalizer" </> "out"
      output = outDir </> "normalized-title-sample.tsv"
  createDirectoryIfMissing True outDir

  found <- firstExisting root sourceFiles
  case found of
    Nothing -> putStrLn "MISS: no media catalog found"
    Just input -> do
      raw <- readFile input
      let movies = maybe [] splitObjects (findArray "movies" raw)
          series = maybe [] splitObjects (findArray "series" raw)
          rows = ["type\trawTitle\tnormalizedTitle\tyear"] ++ makeRows "movie" movies ++ makeRows "series" series

      writeFile output (unlines rows)

      putStrLn "StreamVault Haskell Title Normalizer"
      putStrLn "No server. No ports. File-output only."
      putStrLn ("Input: " ++ input)
      putStrLn ("movies parsed: " ++ show (length movies))
      putStrLn ("series parsed: " ++ show (length series))
      putStrLn ("Output: " ++ output)
      putStrLn "OK: Haskell title normalizer test finished."