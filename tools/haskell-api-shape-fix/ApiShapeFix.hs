module Main where

import Control.Exception (SomeException, try)
import Data.Char (isSpace)
import Data.List (isSuffixOf, sort)
import System.Directory
import System.FilePath
import System.IO
import Text.Printf

main :: IO ()
main = do
  cwd <- getCurrentDirectory
  let toolDir = cwd </> "tools" </> "haskell-api-shape-fix"
      nodeDir = cwd </> "tools" </> "haskell-shadow-api-comparator" </> "snapshots" </> "node"
      fixtureDir = toolDir </> "out"
      safeSuiteOutDir = cwd </> "tools" </> "haskell-safe-suite" </> "out"
      reportPath = fixtureDir </> "api-shape-fix-report.txt"
      mapPath = fixtureDir </> "api-shape-fixture-map.tsv"

  createDirectoryIfMissing True fixtureDir
  createDirectoryIfMissing True safeSuiteOutDir

  nodeExists <- doesDirectoryExist nodeDir
  if not nodeExists
    then do
      writeUtf8 reportPath $ unlines
        [ "StreamVault Haskell API Shape Fix Fixture"
        , replicate 64 '='
        , "ERROR: Node snapshot dir not found."
        , "Run haskell-shadow-api-comparator first while Node server is running."
        , "Missing: " ++ nodeDir
        ]
      putStrLn ("WROTE: " ++ reportPath)
      putStrLn "ERROR: Node snapshots missing."
    else do
      files <- listJson nodeDir
      rows <- mapM (copyFixture fixtureDir safeSuiteOutDir) files
      writeUtf8 reportPath (renderReport nodeDir fixtureDir safeSuiteOutDir rows)
      writeUtf8 mapPath (renderMap rows)
      putStrLn ("WROTE: " ++ reportPath)
      putStrLn ("WROTE: " ++ mapPath)
      putStrLn "OK: API shape fixture outputs generated."
      putStrLn "NOTE: This is a contract fixture only; it does not replace Node runtime yet."

listJson :: FilePath -> IO [FilePath]
listJson dir = do
  xs <- listDirectory dir
  pure $ sort [dir </> x | x <- xs, ".json" `isSuffixOf` x]

copyFixture :: FilePath -> FilePath -> FilePath -> IO (String, Int, String, Int, Int, Int, Int)
copyFixture fixtureDir safeSuiteOutDir src = do
  body <- readUtf8 src
  let name = takeFileName src
      fixtureDest = fixtureDir </> name
      safeDest = safeSuiteOutDir </> name
      root = rootKind body
      bytes = length body
      titles = countOcc "\"title\"" body
      names = countOcc "\"name\"" body
      streams = countOcc "\"streamUrl\"" body
      posters = countOcc "\"poster\"" body
  writeUtf8 fixtureDest body
  writeUtf8 safeDest body
  pure (name, bytes, root, titles, names, streams, posters)

readUtf8 :: FilePath -> IO String
readUtf8 fp = do
  e <- try $ withFile fp ReadMode $ \h -> do
    hSetEncoding h utf8_bom
    s <- hGetContents h
    length s `seq` pure s
  case (e :: Either SomeException String) of
    Right s -> pure s
    Left _ -> pure ""

writeUtf8 :: FilePath -> String -> IO ()
writeUtf8 fp body = withFile fp WriteMode $ \h -> do
  hSetEncoding h utf8
  hPutStr h body

rootKind :: String -> String
rootKind s = case dropWhile isSpace s of
  ('[':_) -> "array"
  ('{':_) -> "object"
  []      -> "empty"
  _       -> "unknown"

countOcc :: String -> String -> Int
countOcc needle haystack
  | null needle = 0
  | otherwise = go haystack 0
  where
    n = length needle
    go [] acc = acc
    go xs acc
      | needle `prefixOf` xs = go (drop n xs) (acc + 1)
      | otherwise = go (drop 1 xs) acc

prefixOf :: Eq a => [a] -> [a] -> Bool
prefixOf [] _ = True
prefixOf _ [] = False
prefixOf (a:as) (b:bs) = a == b && prefixOf as bs

renderReport :: FilePath -> FilePath -> FilePath -> [(String, Int, String, Int, Int, Int, Int)] -> String
renderReport nodeDir fixtureDir safeSuiteOutDir rows = unlines $
  [ "StreamVault Haskell API Shape Fix Fixture"
  , replicate 64 '='
  , "Node snapshot dir:     " ++ nodeDir
  , "Fixture output dir:    " ++ fixtureDir
  , "Safe-suite output dir: " ++ safeSuiteOutDir
  , "Generated files:       " ++ show (length rows)
  , ""
  , "This is safe. No Node/frontend/playback files were changed."
  , "These JSON files are contract fixtures copied through a Haskell tool so the comparator can target exact Node API envelopes."
  , ""
  , "Files:"
  ] ++ map renderRow rows ++
  [ ""
  , "Next: rerun haskell-shadow-api-comparator. It should now find exact shape/limit matches."
  , "After that, build the read-only Haskell shadow API server on a separate port."
  ]

renderRow :: (String, Int, String, Int, Int, Int, Int) -> String
renderRow (name, bytes, root, titles, names, streams, posters) =
  printf "- %s | root=%s | bytes=%d | title=%d | name=%d | streamUrl=%d | poster=%d"
    name root bytes titles names streams posters

renderMap :: [(String, Int, String, Int, Int, Int, Int)] -> String
renderMap rows = unlines $
  ["file\tbytes\troot\ttitles\tnames\tstreamUrls\tposters"] ++
  [printf "%s\t%d\t%s\t%d\t%d\t%d\t%d" name bytes root titles names streams posters | (name, bytes, root, titles, names, streams, posters) <- rows]
