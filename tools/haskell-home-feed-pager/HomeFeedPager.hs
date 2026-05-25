module Main where

import Data.Char (isSpace)
import Data.List (isPrefixOf)
import System.Directory (createDirectoryIfMissing, doesFileExist, getCurrentDirectory)
import System.Environment (getArgs)
import System.FilePath ((</>))

data SplitState = SplitState
  { depthBrace :: Int
  , depthBracket :: Int
  , inString :: Bool
  , escaped :: Bool
  , current :: String
  , chunks :: [String]
  }

emptyState :: SplitState
emptyState = SplitState 0 0 False False "" []

splitTopLevelObjects :: String -> [String]
splitTopLevelObjects xs =
  let st = foldl step emptyState xs
      final = reverse (current st)
      allChunks = if null (trim final) then chunks st else final : chunks st
  in reverse (map trim allChunks)
  where
    step st c
      | escaped st = st { escaped = False, current = c : current st }
      | inString st && c == '\\' = st { escaped = True, current = c : current st }
      | c == '"' = st { inString = not (inString st), current = c : current st }
      | inString st = st { current = c : current st }
      | c == '{' = st { depthBrace = depthBrace st + 1, current = c : current st }
      | c == '}' = st { depthBrace = depthBrace st - 1, current = c : current st }
      | c == '[' = st { depthBracket = depthBracket st + 1, current = c : current st }
      | c == ']' = st { depthBracket = depthBracket st - 1, current = c : current st }
      | c == ',' && depthBrace st == 0 && depthBracket st == 0 =
          st { current = "", chunks = reverse (current st) : chunks st }
      | otherwise = st { current = c : current st }

trim :: String -> String
trim = f . f
  where f = reverse . dropWhile isSpace

takeItemsInArrays :: Int -> String -> String
takeItemsInArrays limit = go
  where
    marker = "\"items\":["
    go [] = []
    go s
      | marker `isPrefixOf` s = marker ++ limitedArray rest
      | otherwise = head s : go (tail s)
      where
        rest = drop (length marker) s

    limitedArray s =
      let (arrBody, after) = readArrayBody 0 False False "" s
          items = splitTopLevelObjects arrBody
          limited = take limit items
          newBody = joinComma limited
      in newBody ++ "]" ++ go after

readArrayBody :: Int -> Bool -> Bool -> String -> String -> (String, String)
readArrayBody _ _ _ acc [] = (reverse acc, [])
readArrayBody depth instr esc acc (c:cs)
  | esc = readArrayBody depth instr False (c:acc) cs
  | instr && c == '\\' = readArrayBody depth instr True (c:acc) cs
  | c == '"' = readArrayBody depth (not instr) False (c:acc) cs
  | instr = readArrayBody depth instr False (c:acc) cs
  | c == '[' = readArrayBody (depth + 1) instr False (c:acc) cs
  | c == ']' && depth == 0 = (reverse acc, cs)
  | c == ']' = readArrayBody (depth - 1) instr False (c:acc) cs
  | otherwise = readArrayBody depth instr False (c:acc) cs

joinComma :: [String] -> String
joinComma [] = ""
joinComma [x] = x
joinComma (x:xs) = x ++ "," ++ joinComma xs

countSub :: String -> String -> Int
countSub needle haystack
  | null needle = 0
  | null haystack = 0
  | needle `isPrefixOf` haystack = 1 + countSub needle (drop (length needle) haystack)
  | otherwise = countSub needle (tail haystack)

readLimit :: [String] -> Int
readLimit (x:_) = case reads x of
  [(n,"")] -> max 0 n
  _ -> 3
readLimit [] = 3

main :: IO ()
main = do
  args <- getArgs
  root <- getCurrentDirectory
  let limit = readLimit args
      input = root </> "home-feed.json"
      outDir = root </> "tools" </> "haskell-home-feed-pager" </> "out"
      output = outDir </> ("api-home-feed-limit-" ++ show limit ++ ".json")
  createDirectoryIfMissing True outDir
  exists <- doesFileExist input
  if not exists
    then putStrLn ("MISS: " ++ input)
    else do
      raw <- readFile input
      let paged = takeItemsInArrays limit raw
      writeFile output paged
      putStrLn "StreamVault Haskell Home Feed Pager"
      putStrLn ("Output: " ++ output)
      putStrLn ("Limit per row: " ++ show limit)
      putStrLn ("rowId count: " ++ show (countSub "\"rowId\"" paged))
      putStrLn ("sectionKey count: " ++ show (countSub "\"sectionKey\"" paged))
      putStrLn ("items key count: " ++ show (countSub "\"items\"" paged))
      putStrLn "OK: paginated home-feed JSON generated."