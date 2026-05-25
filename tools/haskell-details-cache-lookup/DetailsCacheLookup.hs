-- StreamVault Details Cache Lookup V2 Fast
-- Read-only Haskell lookup for detail-cache.json.
-- No production routes are changed.

module Main where

import System.Environment (getArgs)
import System.Directory (doesFileExist, createDirectoryIfMissing)
import System.FilePath ((</>))
import Data.Char (isSpace)

findAfter :: String -> String -> Maybe String
findAfter needle haystack = go haystack
  where
    go [] = Nothing
    go s@(_:xs)
      | startsWith needle s = Just (drop (length needle) s)
      | otherwise = go xs

startsWith :: String -> String -> Bool
startsWith [] _ = True
startsWith _ [] = False
startsWith (a:as) (b:bs) = a == b && startsWith as bs

skipWs :: String -> String
skipWs = dropWhile isSpace

dropUntilColon :: String -> Maybe String
dropUntilColon [] = Nothing
dropUntilColon (':':xs) = Just (skipWs xs)
dropUntilColon (_:xs) = dropUntilColon xs

extractValue :: String -> String
extractValue = go 0 0 False False []
  where
    go _ _ _ _ acc [] = reverse acc
    go obj arr inStr esc acc s@(c:cs)
      | inStr =
          if esc then go obj arr True False (c:acc) cs
          else case c of
            '\\' -> go obj arr True True (c:acc) cs
            '"'  -> go obj arr False False (c:acc) cs
            _    -> go obj arr True False (c:acc) cs
      | otherwise =
          case c of
            '"' -> go obj arr True False (c:acc) cs
            '{' -> go (obj+1) arr False False (c:acc) cs
            '}' ->
              if obj <= 1 && arr == 0
                then reverse (c:acc)
                else go (obj-1) arr False False (c:acc) cs
            '[' -> go obj (arr+1) False False (c:acc) cs
            ']' -> go obj (arr-1) False False (c:acc) cs
            ',' ->
              if obj == 0 && arr == 0
                then reverse acc
                else go obj arr False False (c:acc) cs
            _ -> go obj arr False False (c:acc) cs

lookupKey :: String -> String -> Maybe String
lookupKey key content = do
  afterKey <- findAfter ("\"" ++ key ++ "\"") content
  afterColon <- dropUntilColon afterKey
  pure (extractValue afterColon)

countSub :: String -> String -> Int
countSub needle haystack
  | null needle = 0
  | otherwise = go haystack
  where
    go [] = 0
    go s@(_:xs)
      | startsWith needle s = 1 + go (drop (length needle) s)
      | otherwise = go xs

markers :: [String]
markers =
  [ "\"name\""
  , "\"title\""
  , "\"poster\""
  , "\"backdrop\""
  , "\"overview\""
  , "\"rating\""
  , "\"streamUrl\""
  , "\"seasons\""
  , "\"cast\""
  , "\"crew\""
  , "\"similar\""
  ]

safeName :: String -> String
safeName = map f
  where
    f c
      | c `elem` (['a'..'z'] ++ ['A'..'Z'] ++ ['0'..'9']) = c
      | otherwise = '-'

summarize :: String -> String -> [String]
summarize key val =
  [ "Key: " ++ key
  , "Found: yes"
  , "Extracted chars: " ++ show (length val)
  , "Marker counts:"
  ] ++ map (\m -> "  " ++ m ++ ": " ++ show (countSub m val)) markers ++ [""]

writeLookup :: String -> String -> IO [String]
writeLookup content key =
  case lookupKey key content of
    Nothing -> pure [ "Key: " ++ key, "Found: no", "" ]
    Just val -> do
      createDirectoryIfMissing True ("tools" </> "haskell-details-cache-lookup" </> "out" </> "samples")
      writeFile ("tools" </> "haskell-details-cache-lookup" </> "out" </> "samples" </> safeName key ++ ".json") val
      pure (summarize key val)

defaultKeys :: [String]
defaultKeys =
  [ "movie:Man of Steel:2013"
  , "movie:The Dark Knight:2008"
  , "movie:Iron Man:2008"
  , "movie:Oppenheimer:2023"
  , "movie:Extraction:2020"
  , "movie:Go:2007"
  , "tv:His & Hers:2026"
  , "tv:Adolescence:2025"
  ]

main :: IO ()
main = do
  args <- getArgs
  ok <- doesFileExist "detail-cache.json"
  if not ok
    then putStrLn "detail-cache.json not found"
    else do
      content <- readFile "detail-cache.json"
      let keys = if null args then defaultKeys else args
      chunks <- mapM (writeLookup content) keys
      let report =
            [ "StreamVault Haskell Details Cache Lookup V2 Report"
            , replicate 72 '='
            , ""
            , "Status: read-only fast cache lookup prototype."
            , "No frontend/server/playback/FFmpeg files were changed."
            , ""
            ] ++ concat chunks ++
            [ "Next:"
            , "- Use this lookup in a Haskell /api/details response builder."
            , "- Preserve streamUrl/playback handoff fields."
            , "- Keep details shadow disabled until parity is proven."
            ]
      createDirectoryIfMissing True ("tools" </> "haskell-details-cache-lookup" </> "out")
      writeFile ("tools" </> "haskell-details-cache-lookup" </> "out" </> "details-cache-lookup-report.txt") (unlines report)
      putStrLn (unlines report)
