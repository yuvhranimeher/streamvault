{-# LANGUAGE RecordWildCards #-}

module Main where

import Control.Exception (try, SomeException)
import Control.Monad (forM)
import Data.Char (isAlphaNum, isDigit, isSpace, toLower)
import Data.List (intercalate, intersect, maximumBy, nub, sortOn)
import Data.Ord (comparing)
import System.Directory
import System.FilePath
import System.IO
import Text.Printf

data Metrics = Metrics
  { mPath       :: FilePath
  , mName       :: String
  , mBytes      :: Int
  , mTitles     :: Int
  , mNames      :: Int
  , mItems      :: Int
  , mStreamUrls :: Int
  , mPosters    :: Int
  , mErrors     :: Int
  } deriving (Show)

main :: IO ()
main = do
  cwd <- getCurrentDirectory
  let baseDir = cwd </> "tools" </> "haskell-shadow-api-comparator"
      nodeDir = baseDir </> "snapshots" </> "node"
      hsDir   = cwd </> "tools" </> "haskell-safe-suite" </> "out"
      outDir  = baseDir </> "out"
      report  = outDir </> "shadow-api-report.txt"
      tsv     = outDir </> "shadow-api-summary.tsv"

  createDirectoryIfMissing True outDir

  nodeExists <- doesDirectoryExist nodeDir
  hsExists <- doesDirectoryExist hsDir

  nodeFiles <- if nodeExists then jsonFiles nodeDir else pure []
  hsFiles <- if hsExists then jsonFiles hsDir else pure []

  nodeMetrics <- mapM readMetrics nodeFiles
  hsMetrics <- mapM readMetrics hsFiles

  let rows = map (compareOne hsMetrics) nodeMetrics
      reportLines =
        [ "StreamVault Haskell Shadow API Comparator"
        , replicate 72 '='
        , "Node snapshot dir:    " ++ nodeDir
        , "Haskell output dir:   " ++ hsDir
        , "Node JSON files:      " ++ show (length nodeMetrics)
        , "Haskell JSON files:   " ++ show (length hsMetrics)
        , ""
        , "This is a SHADOW comparison only. No Node/frontend/playback files are changed."
        , ""
        , replicate 72 '-'
        , "Per-endpoint approximate comparison"
        , replicate 72 '-'
        ]
        ++ concatMap renderRow rows
        ++ [ ""
           , replicate 72 '-'
           , "Node files without JSON snapshot may mean the Node server was offline or the endpoint returned 404."
           , "Use this report to decide which Haskell module must be adjusted before any real migration."
           ]

      tsvLines =
        [ intercalate "\t"
          [ "node_file", "haskell_match", "score"
          , "node_bytes", "haskell_bytes", "byte_delta"
          , "node_titles", "haskell_titles"
          , "node_names", "haskell_names"
          , "node_items", "haskell_items"
          , "node_streamUrls", "haskell_streamUrls"
          , "node_posters", "haskell_posters"
          , "node_errors", "haskell_errors"
          ]
        ]
        ++ map renderTsv rows

  writeUtf8 report (unlines reportLines)
  writeUtf8 tsv (unlines tsvLines)

  putStrLn ("WROTE: " ++ report)
  putStrLn ("WROTE: " ++ tsv)
  putStrLn "OK: shadow comparison complete."

jsonFiles :: FilePath -> IO [FilePath]
jsonFiles dir = do
  names <- listDirectory dir
  let files = [ dir </> n | n <- names, takeExtension n == ".json" ]
  pure (sortOn takeFileName files)

readUtf8 :: FilePath -> IO String
readUtf8 fp = withFile fp ReadMode $ \h -> do
  hSetEncoding h utf8
  s <- hGetContents h
  length s `seq` pure s

writeUtf8 :: FilePath -> String -> IO ()
writeUtf8 fp body = withFile fp WriteMode $ \h -> do
  hSetEncoding h utf8
  hPutStr h body

readMetrics :: FilePath -> IO Metrics
readMetrics fp = do
  e <- try (readUtf8 fp) :: IO (Either SomeException String)
  let s = either (const "") id e
  pure Metrics
    { mPath = fp
    , mName = takeFileName fp
    , mBytes = length s
    , mTitles = countOcc "\"title\"" s
    , mNames = countOcc "\"name\"" s
    , mItems = countOcc "\"items\"" s
    , mStreamUrls = countOcc "\"streamUrl\"" s
    , mPosters = countOcc "\"poster\"" s
    , mErrors = countOcc "\"error\"" s + countOcc "\"errors\"" s
    }

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

tokens :: String -> [String]
tokens =
  filter good
  . words
  . map clean
  . map toLower
  . dropExtension
  where
    clean c = if isAlphaNum c then c else ' '
    stop =
      [ "api", "page", "limit", "json", "summary", "copy"
      , "node", "haskell", "out", "snapshot", "snapshots"
      , "true", "false", "0", "1", "12", "24", "40", "60"
      ]
    good x = length x > 1 && x `notElem` stop && not (all isDigit x)

score :: String -> String -> Int
score a b =
  let ta = nub (tokens a)
      tb = nub (tokens b)
  in length (ta `intersect` tb)

bestMatch :: [Metrics] -> Metrics -> Maybe (Int, Metrics)
bestMatch [] _ = Nothing
bestMatch hs n =
  let scored = [ (score (mName n) (mName h), h) | h <- hs ]
      best = maximumBy (comparing fst) scored
  in if fst best <= 0 then Nothing else Just best

type Row = (Metrics, Maybe (Int, Metrics))

compareOne :: [Metrics] -> Metrics -> Row
compareOne hs n = (n, bestMatch hs n)

renderRow :: Row -> [String]
renderRow (n, Nothing) =
  [ "NODE: " ++ mName n
  , "  HASKELL: no likely match"
  , "  node bytes=" ++ show (mBytes n)
  , ""
  ]
renderRow (n, Just (s, h)) =
  [ "NODE:    " ++ mName n
  , "MATCH:   " ++ mName h ++ "   score=" ++ show s
  , printf "BYTES:   node=%d  haskell=%d  delta=%+d" (mBytes n) (mBytes h) (mBytes h - mBytes n)
  , printf "FIELDS:  title %d/%d | name %d/%d | items %d/%d | streamUrl %d/%d | poster %d/%d | errors %d/%d"
      (mTitles n) (mTitles h)
      (mNames n) (mNames h)
      (mItems n) (mItems h)
      (mStreamUrls n) (mStreamUrls h)
      (mPosters n) (mPosters h)
      (mErrors n) (mErrors h)
  , verdict n h
  , ""
  ]

verdict :: Metrics -> Metrics -> String
verdict n h
  | mBytes n == 0 = "VERDICT: node snapshot empty"
  | mBytes h == 0 = "VERDICT: haskell output empty"
  | abs (mBytes h - mBytes n) < 2000 = "VERDICT: close size match"
  | mStreamUrls n > 0 && mStreamUrls h == 0 = "VERDICT: check missing streamUrl in Haskell shadow output"
  | mPosters n > 0 && mPosters h == 0 = "VERDICT: check missing poster fields in Haskell shadow output"
  | otherwise = "VERDICT: inspect differences before migration"

renderTsv :: Row -> String
renderTsv (n, Nothing) =
  intercalate "\t"
    [ mName n, "", "0"
    , show (mBytes n), "0", show (0 - mBytes n)
    , show (mTitles n), "0"
    , show (mNames n), "0"
    , show (mItems n), "0"
    , show (mStreamUrls n), "0"
    , show (mPosters n), "0"
    , show (mErrors n), "0"
    ]
renderTsv (n, Just (s, h)) =
  intercalate "\t"
    [ mName n, mName h, show s
    , show (mBytes n), show (mBytes h), show (mBytes h - mBytes n)
    , show (mTitles n), show (mTitles h)
    , show (mNames n), show (mNames h)
    , show (mItems n), show (mItems h)
    , show (mStreamUrls n), show (mStreamUrls h)
    , show (mPosters n), show (mPosters h)
    , show (mErrors n), show (mErrors h)
    ]
