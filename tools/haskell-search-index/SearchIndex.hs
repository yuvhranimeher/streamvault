module Main where

import Data.Char (isAlphaNum, isSpace, toLower)
import Data.List (isInfixOf, isPrefixOf)
import System.Directory (createDirectoryIfMissing, doesFileExist, getCurrentDirectory)
import System.FilePath ((</>))

trim :: String -> String
trim = f . f
  where f = reverse . dropWhile isSpace

lower :: String -> String
lower = map toLower

safeSlug :: String -> String
safeSlug = map repl . lower
  where
    repl c
      | isAlphaNum c = c
      | otherwise = '-'

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

joinComma :: [String] -> String
joinComma [] = ""
joinComma [x] = x
joinComma (x:xs) = x ++ "," ++ joinComma xs

jsonString :: String -> String
jsonString s = "\"" ++ concatMap esc s ++ "\""
  where
    esc '"' = "\\\""
    esc '\\' = "\\\\"
    esc '\n' = "\\n"
    esc '\r' = "\\r"
    esc '\t' = "\\t"
    esc c = [c]

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

tagObjects :: String -> [String] -> [String]
tagObjects mediaType = map addType
  where
    addType obj =
      case obj of
        ('{':rest) -> "{\"_type\":\"" ++ mediaType ++ "\"," ++ rest
        _ -> obj

makeSearchJson :: String -> Int -> [String] -> String
makeSearchJson query limit results =
  "{"
  ++ "\"ok\":true,"
  ++ "\"query\":" ++ jsonString query ++ ","
  ++ "\"limit\":" ++ show limit ++ ","
  ++ "\"totalMatches\":" ++ show (length results) ++ ","
  ++ "\"items\":[" ++ joinComma (take limit results) ++ "]"
  ++ "}"

searchItems :: String -> [String] -> [String]
searchItems q items =
  let ql = lower q
  in filter (\obj -> ql `isInfixOf` lower obj) items

writeSearch :: FilePath -> String -> Int -> [String] -> IO ()
writeSearch outDir query limit allItems = do
  let matches = searchItems query allItems
      output = outDir </> ("api-search-" ++ safeSlug query ++ "-limit-" ++ show limit ++ ".json")
      body = makeSearchJson query limit matches
  writeFile output body
  putStrLn ("WROTE: " ++ output)
  putStrLn ("  query: " ++ query)
  putStrLn ("  matches: " ++ show (length matches))
  putStrLn ("  returned: " ++ show (min limit (length matches)))
  putStrLn ""

main :: IO ()
main = do
  root <- getCurrentDirectory
  let outDir = root </> "tools" </> "haskell-search-index" </> "out"
  createDirectoryIfMissing True outDir

  found <- firstExisting root sourceFiles
  case found of
    Nothing -> putStrLn "MISS: no media catalog found"
    Just input -> do
      raw <- readFile input
      putStrLn "StreamVault Haskell Search Index Builder"
      putStrLn "No server. No ports. File-output only."
      putStrLn ("Input: " ++ input)
      putStrLn ("movies key count: " ++ show (countSub "\"movies\"" raw))
      putStrLn ("series key count: " ++ show (countSub "\"series\"" raw))
      putStrLn ""

      let movies = maybe [] splitObjects (findArray "movies" raw)
          series = maybe [] splitObjects (findArray "series" raw)
          allItems = tagObjects "movie" movies ++ tagObjects "series" series

      putStrLn ("movies parsed: " ++ show (length movies))
      putStrLn ("series parsed: " ++ show (length series))
      putStrLn ("combined index: " ++ show (length allItems))
      putStrLn ""

      mapM_ (\q -> writeSearch outDir q 20 allItems)
        [ "spider", "dark", "avengers", "korean", "netflix", "breaking", "hindi" ]

      putStrLn "OK: Haskell search index test finished."