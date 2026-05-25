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
    st = foldl step (0, False, False, "", []) xs
    finish (_,_,_,cur,acc) =
      let c = trim (reverse cur)
      in if null c then acc else c:acc
    step (depth, instr, esc, cur, acc) c
      | esc = (depth, instr, False, c:cur, acc)
      | instr && c == '\\' = (depth, instr, True, c:cur, acc)
      | c == '"' = (depth, not instr, False, c:cur, acc)
      | instr = (depth, instr, False, c:cur, acc)
      | c == '{' = (depth + 1, instr, False, c:cur, acc)
      | c == '}' = (depth - 1, instr, False, c:cur, acc)
      | c == ',' && depth == 0 =
          let obj = trim (reverse cur)
          in (depth, instr, False, "", if null obj then acc else obj:acc)
      | otherwise = (depth, instr, False, c:cur, acc)

readArrayAfter :: String -> String -> Maybe String
readArrayAfter marker raw =
  case dropUntil marker raw of
    Nothing -> Nothing
    Just rest -> Just (takeArray 0 False False "" rest)
  where
    dropUntil m s
      | null s = Nothing
      | m `isPrefixOf` s = Just (drop (length m) s)
      | otherwise = dropUntil m (tail s)
    takeArray _ _ _ acc [] = reverse acc
    takeArray depth instr esc acc (c:cs)
      | esc = takeArray depth instr False (c:acc) cs
      | instr && c == '\\' = takeArray depth instr True (c:acc) cs
      | c == '"' = takeArray depth (not instr) False (c:acc) cs
      | instr = takeArray depth instr False (c:acc) cs
      | c == '[' = takeArray (depth + 1) instr False (c:acc) cs
      | c == ']' && depth == 0 = reverse acc
      | c == ']' = takeArray (depth - 1) instr False (c:acc) cs
      | otherwise = takeArray depth instr False (c:acc) cs

joinComma :: [String] -> String
joinComma [] = ""
joinComma [x] = x
joinComma (x:xs) = x ++ "," ++ joinComma xs

findSectionArray :: String -> String -> Maybe String
findSectionArray key raw =
  firstJust
    [ readArrayAfter ("\"" ++ key ++ "\":[") raw
    , readArrayAfter ("\"" ++ key ++ "\": [") raw
    ]
  where
    firstJust [] = Nothing
    firstJust (Just x:_) = Just x
    firstJust (Nothing:xs) = firstJust xs

makePage :: String -> Int -> Int -> [String] -> String
makePage key page limit items =
  let start = page * limit
      pageItems = take limit (drop start items)
      total = length items
      pages = if limit <= 0 then 0 else ceiling (fromIntegral total / fromIntegral limit :: Double)
  in "{"
     ++ "\"ok\":true,"
     ++ "\"sectionKey\":\"" ++ key ++ "\","
     ++ "\"page\":" ++ show page ++ ","
     ++ "\"limit\":" ++ show limit ++ ","
     ++ "\"total\":" ++ show total ++ ","
     ++ "\"pages\":" ++ show pages ++ ","
     ++ "\"items\":[" ++ joinComma pageItems ++ "]"
     ++ "}"

writeSection :: FilePath -> String -> Int -> Int -> String -> IO ()
writeSection outDir key page limit raw =
  case findSectionArray key raw of
    Nothing -> putStrLn ("MISS section: " ++ key)
    Just arr -> do
      let items = splitObjects arr
          out = outDir </> ("api-section-" ++ key ++ "-page-" ++ show page ++ "-limit-" ++ show limit ++ ".json")
          body = makePage key page limit items
      writeFile out body
      putStrLn ("WROTE: " ++ out)
      putStrLn ("  key: " ++ key)
      putStrLn ("  total: " ++ show (length items))
      putStrLn ("  page: " ++ show page)
      putStrLn ("  limit: " ++ show limit)
      putStrLn ""

main :: IO ()
main = do
  root <- getCurrentDirectory
  let input = root </> "section-catalog.json"
      outDir = root </> "tools" </> "haskell-section-pager" </> "out"
  createDirectoryIfMissing True outDir
  exists <- doesFileExist input
  if not exists
    then putStrLn ("MISS: " ++ input)
    else do
      raw <- readFile input
      putStrLn "StreamVault Haskell Section Pager"
      putStrLn ("Input: " ++ input)
      putStrLn ("sectionKey count hint: " ++ show (countSub "\"sectionKey\"" raw))
      putStrLn ("streamUrl count hint: " ++ show (countSub "\"streamUrl\"" raw))
      putStrLn ""
      let tests = [ "netflix", "marvel", "dc", "trending", "series", "allMovies", "recentlyAdded", "horrorNights", "cyberpunkScifi" ]
      mapM_ (\k -> writeSection outDir k 0 6 raw) tests
      putStrLn "OK: Haskell section pager test finished."