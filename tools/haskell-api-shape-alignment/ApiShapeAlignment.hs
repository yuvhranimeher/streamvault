{-# LANGUAGE RecordWildCards #-}

module Main where

import Control.Exception (try, SomeException)
import Data.Char (isAlphaNum, isDigit, isSpace, toLower)
import Data.List (intercalate, intersect, maximumBy, nub, sortOn)
import Data.Ord (comparing)
import System.Directory
import System.FilePath
import System.IO
import Text.Printf

data ApiFile = ApiFile
  { aPath       :: FilePath
  , aName       :: String
  , aBytes      :: Int
  , aRoot       :: String
  , aTitles     :: Int
  , aNames      :: Int
  , aItems      :: Int
  , aMovies     :: Int
  , aSeries     :: Int
  , aDownloads  :: Int
  , aStreamUrls :: Int
  , aPosters    :: Int
  , aTotal      :: Int
  , aPages      :: Int
  , aErrors     :: Int
  } deriving (Show)

data Row = Row ApiFile (Maybe (Int, ApiFile)) [String]

main :: IO ()
main = do
  cwd <- getCurrentDirectory
  let toolDir = cwd </> "tools" </> "haskell-api-shape-alignment"
      nodeDir = cwd </> "tools" </> "haskell-shadow-api-comparator" </> "snapshots" </> "node"
      hsDir   = cwd </> "tools" </> "haskell-safe-suite" </> "out"
      outDir  = toolDir </> "out"
      mdOut   = outDir </> "api-shape-contract.md"
      tsvOut  = outDir </> "api-shape-summary.tsv"
      planOut = outDir </> "haskell-adjustment-plan.txt"

  createDirectoryIfMissing True outDir

  nodeFiles <- listJsonSafe nodeDir
  hsFiles <- listJsonSafe hsDir
  ns <- mapM readApiFile nodeFiles
  hs <- mapM readApiFile hsFiles

  let rows = map (mkRow hs) ns
      blockers = concatMap rowIssues rows

  writeUtf8 mdOut (renderMarkdown nodeDir hsDir rows blockers)
  writeUtf8 tsvOut (renderTsv rows)
  writeUtf8 planOut (renderPlan blockers)

  putStrLn ("WROTE: " ++ mdOut)
  putStrLn ("WROTE: " ++ tsvOut)
  putStrLn ("WROTE: " ++ planOut)
  putStrLn "OK: API shape alignment audit complete."

listJsonSafe :: FilePath -> IO [FilePath]
listJsonSafe dir = do
  ok <- doesDirectoryExist dir
  if not ok then pure [] else do
    xs <- listDirectory dir
    pure (sortOn takeFileName [dir </> x | x <- xs, takeExtension x == ".json"])

readUtf8 :: FilePath -> IO String
readUtf8 fp = withFile fp ReadMode $ \h -> do
  hSetEncoding h utf8
  s <- hGetContents h
  length s `seq` pure s

writeUtf8 :: FilePath -> String -> IO ()
writeUtf8 fp body = withFile fp WriteMode $ \h -> do
  hSetEncoding h utf8
  hPutStr h body

readApiFile :: FilePath -> IO ApiFile
readApiFile fp = do
  e <- try (readUtf8 fp) :: IO (Either SomeException String)
  let s = either (const "") id e
  pure ApiFile
    { aPath = fp
    , aName = takeFileName fp
    , aBytes = length s
    , aRoot = rootKind s
    , aTitles = countOcc "\"title\"" s
    , aNames = countOcc "\"name\"" s
    , aItems = countOcc "\"items\"" s
    , aMovies = countOcc "\"movies\"" s
    , aSeries = countOcc "\"series\"" s
    , aDownloads = countOcc "\"downloads\"" s
    , aStreamUrls = countOcc "\"streamUrl\"" s
    , aPosters = countOcc "\"poster\"" s
    , aTotal = countOcc "\"total\"" s
    , aPages = countOcc "\"pages\"" s
    , aErrors = countOcc "\"error\"" s + countOcc "\"errors\"" s
    }

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

tokens :: String -> [String]
tokens = filter good . words . map clean . map toLower . dropExtension
  where
    clean c = if isAlphaNum c then c else ' '
    stop = ["api","page","limit","json","summary","copy","node","haskell","out","snapshot","snapshots","true","false","0","1","6","8","12","24","40","60"]
    good x = length x > 1 && x `notElem` stop && not (all isDigit x)

score :: String -> String -> Int
score a b = length (nub (tokens a) `intersect` nub (tokens b))

bestMatch :: [ApiFile] -> ApiFile -> Maybe (Int, ApiFile)
bestMatch [] _ = Nothing
bestMatch hs n =
  let scored = [(score (aName n) (aName h), h) | h <- hs]
      best = maximumBy (comparing fst) scored
  in if fst best <= 0 then Nothing else Just best

mkRow :: [ApiFile] -> ApiFile -> Row
mkRow hs n = Row n bm (issues n bm)
  where bm = bestMatch hs n

issues :: ApiFile -> Maybe (Int, ApiFile) -> [String]
issues n Nothing =
  ["No Haskell JSON output matched Node snapshot: " ++ aName n ++ ". Add matching generator/output file."]
issues n (Just (_, h)) = concat
  [ if aRoot n /= aRoot h then ["Root shape mismatch for " ++ aName n ++ ": Node=" ++ aRoot n ++ ", Haskell=" ++ aRoot h] else []
  , if endpointIsMovies (aName n) && aMovies n > 0 && aMovies h == 0 then ["/api/movies must output object with movies,total,page,pages, not items wrapper."] else []
  , if endpointIsSeries (aName n) && aRoot n == "array" && aRoot h /= "array" then ["/api/series must output the same root shape as Node. Current Node snapshot is array root."] else []
  , if endpointIsDownloads (aName n) && aDownloads n > 0 && aDownloads h == 0 then ["/api/downloads needs Haskell output with downloads/items shape matching Node."] else []
  , if aStreamUrls n > 0 && aStreamUrls h == 0 then ["Missing streamUrl fields in Haskell match for " ++ aName n] else []
  , if aPosters n > 0 && aPosters h == 0 then ["Missing poster fields in Haskell match for " ++ aName n] else []
  , if aErrors h > 0 then ["Haskell match contains error fields for " ++ aName h] else []
  , if abs (aTitles n - aTitles h) > max 4 (aTitles n `div` 2) then ["Likely limit/count mismatch for " ++ aName n ++ ": title count Node=" ++ show (aTitles n) ++ ", Haskell=" ++ show (aTitles h)] else []
  ]

endpointIsMovies, endpointIsSeries, endpointIsDownloads :: String -> Bool
endpointIsMovies s = "movies" `elem` tokens s && not ("all" `elem` tokens s)
endpointIsSeries s = "series" `elem` tokens s && not ("section" `elem` tokens s)
endpointIsDownloads s = "downloads" `elem` tokens s

rowIssues :: Row -> [String]
rowIssues (Row _ _ xs) = xs

renderMarkdown :: FilePath -> FilePath -> [Row] -> [String] -> String
renderMarkdown nodeDir hsDir rows blockers = unlines $
  [ "# StreamVault Haskell API Shape Contract"
  , ""
  , "This file is generated from the current Node API snapshots and Haskell safe-suite outputs."
  , ""
  , "- Node snapshots: `" ++ nodeDir ++ "`"
  , "- Haskell outputs: `" ++ hsDir ++ "`"
  , "- Safe mode: no server/frontend/playback files changed"
  , ""
  , "## Result"
  , ""
  , if null blockers then "No shape blockers detected." else "Shape blockers detected. Do not migrate yet."
  , ""
  , "## Blockers"
  , ""
  ] ++
  (if null blockers then ["- None"] else map ("- " ++) (nub blockers)) ++
  [ ""
  , "## Per endpoint"
  , ""
  , "| Node snapshot | Haskell match | Root | Key counts | Verdict |"
  , "|---|---|---|---|---|"
  ] ++ map renderMdRow rows ++
  [ ""
  , "## Required before Haskell shadow server"
  , ""
  , "1. Generate Haskell outputs using the same requested limits as Node snapshots."
  , "2. Match response wrappers exactly: `movies`, array series, `items`, `downloads`, `total`, `page`, `pages`."
  , "3. Add missing `/api/downloads` Haskell output."
  , "4. Re-run shadow comparator until major endpoints are close enough."
  ]

renderMdRow :: Row -> String
renderMdRow (Row n Nothing xs) =
  "| `" ++ aName n ++ "` | none | Node " ++ aRoot n ++ " | title=" ++ show (aTitles n) ++ ", name=" ++ show (aNames n) ++ ", streamUrl=" ++ show (aStreamUrls n) ++ " | " ++ verdictText xs ++ " |"
renderMdRow (Row n (Just (s,h)) xs) =
  "| `" ++ aName n ++ "` | `" ++ aName h ++ "` score=" ++ show s ++ " | Node " ++ aRoot n ++ " / Haskell " ++ aRoot h ++ " | title " ++ show (aTitles n) ++ "/" ++ show (aTitles h) ++ ", name " ++ show (aNames n) ++ "/" ++ show (aNames h) ++ ", streamUrl " ++ show (aStreamUrls n) ++ "/" ++ show (aStreamUrls h) ++ " | " ++ verdictText xs ++ " |"

verdictText :: [String] -> String
verdictText [] = "OK-ish"
verdictText xs = "Fix: " ++ show (length xs) ++ " issue(s)"

renderTsv :: [Row] -> String
renderTsv rows = unlines $
  [intercalate "\t" ["node","haskell","node_root","haskell_root","node_titles","haskell_titles","node_names","haskell_names","node_streamUrls","haskell_streamUrls","issues"]]
  ++ map one rows
  where
    one (Row n Nothing xs) = intercalate "\t" [aName n,"",aRoot n,"",show(aTitles n),"0",show(aNames n),"0",show(aStreamUrls n),"0",intercalate " | " xs]
    one (Row n (Just (_,h)) xs) = intercalate "\t" [aName n,aName h,aRoot n,aRoot h,show(aTitles n),show(aTitles h),show(aNames n),show(aNames h),show(aStreamUrls n),show(aStreamUrls h),intercalate " | " xs]

renderPlan :: [String] -> String
renderPlan blockers = unlines $
  [ "StreamVault Haskell API Shape Adjustment Plan"
  , replicate 64 '='
  , ""
  , "Status: " ++ if null blockers then "ready for shadow server prototype" else "not ready for shadow server yet"
  , ""
  , "Fix these before real migration:"
  , ""
  ] ++
  (if null blockers then ["- No blockers detected."] else map ("- " ++) (nub blockers)) ++
  [ ""
  , "Implementation target:"
  , "- Haskell /api/home-feed must match Node envelope and row/item fields."
  , "- Haskell /api/section/:key must respect page=0&limit=12&summary=1."
  , "- Haskell /api/movies must return { movies, total, page, pages }."
  , "- Haskell /api/series must return the exact Node root shape."
  , "- Haskell /api/search must preserve fields used by frontend cards."
  , "- Haskell /api/downloads must be added before comparing download hub."
  ]
