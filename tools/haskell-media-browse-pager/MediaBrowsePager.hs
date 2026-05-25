module Main where

import Data.Char (isSpace)
import Data.List (isPrefixOf)
import System.Directory (createDirectoryIfMissing, doesFileExist, getCurrentDirectory)
import System.FilePath ((</>))

trim :: String -> String
trim = f . f
  where f = reverse . dropWhile isSpace

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

writePage :: FilePath -> String -> Int -> Int -> [String] -> IO ()
writePage outDir mediaType page limit items = do
  let output = outDir </> ("api-" ++ mediaType ++ "-page-" ++ show page ++ "-limit-" ++ show limit ++ ".json")
      body = makePage mediaType page limit items
  writeFile output body
  putStrLn ("WROTE: " ++ output)
  putStrLn ("  type: " ++ mediaType)
  putStrLn ("  page: " ++ show page)
  putStrLn ("  limit: " ++ show limit)
  putStrLn ("  total: " ++ show (length items))
  putStrLn ("  output title hints: " ++ show (countSub "\"title\"" body + countSub "\"name\"" body))
  putStrLn ""

writeMedia :: FilePath -> String -> String -> IO ()
writeMedia outDir key raw =
  case findArray key raw of
    Nothing -> putStrLn ("MISS array: " ++ key)
    Just arr -> do
      let items = splitObjects arr
      writePage outDir key 0 24 items
      writePage outDir key 1 24 items
      writePage outDir key 0 72 items

main :: IO ()
main = do
  root <- getCurrentDirectory
  let outDir = root </> "tools" </> "haskell-media-browse-pager" </> "out"
  createDirectoryIfMissing True outDir

  found <- firstExisting root sourceFiles
  case found of
    Nothing -> putStrLn "MISS: no media catalog found"
    Just input -> do
      raw <- readFile input
      putStrLn "StreamVault Haskell Media Browse Pager"
      putStrLn "No server. No ports. File-output only."
      putStrLn ("Input: " ++ input)
      putStrLn ("movies key count: " ++ show (countSub "\"movies\"" raw))
      putStrLn ("series key count: " ++ show (countSub "\"series\"" raw))
      putStrLn ""

      writeMedia outDir "movies" raw
      writeMedia outDir "series" raw

      putStrLn "OK: Haskell media browse pager test finished."