-- StreamVault Details Cache Reader
-- Safe read-only Haskell probe for Node cache files.
-- This is groundwork for migrating:
--   /api/details/:type/:id
--   /api/title-details
--   /api/series/detail
--
-- No production routes are changed by this tool.

module Main where

import System.Directory (doesFileExist, getFileSize, createDirectoryIfMissing)
import System.FilePath ((</>))
import Data.List (isPrefixOf)
import Data.Char (toLower)

data TargetFile = TargetFile
  { label :: String
  , path  :: FilePath
  }

targets :: [TargetFile]
targets =
  [ TargetFile "detail-cache.json" "detail-cache.json"
  , TargetFile "episode-title-cache.json" "episode-title-cache.json"
  ]

markers :: [String]
markers =
  [ "\"title\""
  , "\"name\""
  , "\"poster\""
  , "\"backdrop\""
  , "\"overview\""
  , "\"cast\""
  , "\"crew\""
  , "\"genres\""
  , "\"similar\""
  , "\"trailer\""
  , "\"episodes\""
  , "\"seasons\""
  , "\"streamUrl\""
  , "\"tmdb\""
  , "\"imdb\""
  , "\"rating\""
  ]

countSub :: String -> String -> Int
countSub needle haystack
  | null needle = 0
  | otherwise   = go haystack
  where
    go [] = 0
    go s@(_:xs)
      | needle `isPrefixOf` s = 1 + go (drop (length needle) s)
      | otherwise             = go xs

line :: String
line = replicate 72 '='

readSafe :: FilePath -> IO String
readSafe p = do
  ok <- doesFileExist p
  if ok then readFile p else pure ""

summarize :: TargetFile -> IO [String]
summarize t = do
  ok <- doesFileExist (path t)
  if not ok
    then pure
      [ "File: " ++ label t
      , "Path: " ++ path t
      , "Exists: no"
      , ""
      ]
    else do
      bytes <- getFileSize (path t)
      content <- readSafe (path t)
      let objectLike = countSub "{" content
      let arrayLike  = countSub "[" content
      let markerRows = map (\m -> "  " ++ m ++ ": " ++ show (countSub m content)) markers
      pure $
        [ "File: " ++ label t
        , "Path: " ++ path t
        , "Exists: yes"
        , "Bytes: " ++ show bytes
        , "Object markers '{': " ++ show objectLike
        , "Array markers '[': " ++ show arrayLike
        , "Important key marker counts:"
        ] ++ markerRows ++
        [ "" ]

main :: IO ()
main = do
  createDirectoryIfMissing True ("tools" </> "haskell-details-cache-reader" </> "out")

  chunks <- mapM summarize targets
  let report =
        [ "StreamVault Haskell Details Cache Reader Report"
        , line
        , ""
        , "Status: read-only cache inspection."
        , "No frontend/server/playback/FFmpeg files were changed."
        , ""
        ] ++ concat chunks ++
        [ "Next implementation target:"
        , "- Implement compatible cache lookup in Haskell."
        , "- Preserve Node response fields before enabling details shadow."
        , "- Keep playback/direct stream routes in Node."
        , ""
        , "This report is intentionally structural; it does not expose cache contents."
        ]

  writeFile ("tools" </> "haskell-details-cache-reader" </> "out" </> "details-cache-reader-report.txt") (unlines report)
  putStrLn (unlines report)
