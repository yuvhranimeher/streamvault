-- StreamVault Details Cache Key Scanner
-- Read-only Haskell scanner for discovering top-level JSON object keys.
-- No production routes are changed.

module Main where

import System.Directory (doesFileExist, createDirectoryIfMissing)
import System.FilePath ((</>))
import Data.Char (isSpace)
import Data.List (isInfixOf)

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

scanTopKeys :: String -> [String]
scanTopKeys = reverse . keys . foldl step emptyState
  where
    step st c
      | inString st =
          if escapeNext st
            then st { currentString = currentString st ++ [c], escapeNext = False }
            else case c of
              '\\' -> st { escapeNext = True }
              '"'  ->
                let s = currentString st
                in st { inString = False, currentString = "", lastString = Just s }
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

      | isSpace c =
          st

      | otherwise =
          st

takeN :: Int -> [a] -> [a]
takeN _ [] = []
takeN n _ | n <= 0 = []
takeN n (x:xs) = x : takeN (n-1) xs

containsAny :: [String] -> String -> Bool
containsAny needles s = any (`isInfixOf` s) needles

summarizeFile :: FilePath -> String -> IO [String]
summarizeFile p label = do
  ok <- doesFileExist p
  if not ok
    then pure ["File: " ++ label, "Exists: no", ""]
    else do
      content <- readFile p
      let ks = scanTopKeys content
      let likely = filter (containsAny ["movie","series","ftp","title","details","tmdb"]) ks
      pure $
        [ "File: " ++ label
        , "Path: " ++ p
        , "Exists: yes"
        , "Top-level key count: " ++ show (length ks)
        , ""
        , "First 80 top-level keys:"
        ] ++ map ("  " ++) (takeN 80 ks) ++
        [ ""
        , "First 80 likely media/detail keys:"
        ] ++ map ("  " ++) (takeN 80 likely) ++
        [ "" ]

main :: IO ()
main = do
  createDirectoryIfMissing True ("tools" </> "haskell-details-cache-key-scanner" </> "out")

  a <- summarizeFile "detail-cache.json" "detail-cache.json"
  b <- summarizeFile "episode-title-cache.json" "episode-title-cache.json"

  let report =
        [ "StreamVault Haskell Details Cache Key Scanner Report"
        , replicate 72 '='
        , ""
        , "Status: read-only key format discovery."
        , "No frontend/server/playback/FFmpeg files were changed."
        , ""
        ] ++ a ++ b ++
        [ "Next:"
        , "- Use these key formats to implement Haskell cache lookup."
        , "- Keep /api/details and playback on Node until output parity is proven."
        ]

  writeFile ("tools" </> "haskell-details-cache-key-scanner" </> "out" </> "details-cache-key-scanner-report.txt") (unlines report)
  putStrLn (unlines report)
