{-# LANGUAGE OverloadedStrings #-}

module Main where

import qualified Data.ByteString.Lazy as BL
import qualified Data.ByteString.Lazy.Char8 as C
import Control.Monad (forM_)
import System.Directory (createDirectoryIfMissing, doesFileExist, getCurrentDirectory)
import System.FilePath ((</>), takeFileName)

countSub :: C.ByteString -> C.ByteString -> Int
countSub needle haystack
  | C.null needle = 0
  | C.null haystack = 0
  | needle `C.isPrefixOf` haystack = 1 + countSub needle (C.drop (C.length needle) haystack)
  | otherwise = countSub needle (C.drop 1 haystack)

copyJson :: FilePath -> FilePath -> IO ()
copyJson input output = do
  exists <- doesFileExist input
  if not exists
    then putStrLn ("MISS: " ++ input)
    else do
      bs <- BL.readFile input
      BL.writeFile output bs
      putStrLn ("WROTE: " ++ output)
      putStrLn ("  source: " ++ takeFileName input)
      putStrLn ("  bytes: " ++ show (BL.length bs))
      putStrLn ("  rowId count: " ++ show (countSub "\"rowId\"" bs))
      putStrLn ("  sectionKey count: " ++ show (countSub "\"sectionKey\"" bs))
      putStrLn ("  item arrays hint: " ++ show (countSub "\"items\"" bs))
      putStrLn ""

writeHealth :: FilePath -> IO ()
writeHealth output = do
  let body = "{\"ok\":true,\"runtime\":\"haskell\",\"module\":\"json-api-builder\",\"server\":false}\n"
  BL.writeFile output (C.pack body)
  putStrLn ("WROTE: " ++ output)

main :: IO ()
main = do
  root <- getCurrentDirectory
  let outDir = root </> "tools" </> "haskell-json-api-builder" </> "out"
  createDirectoryIfMissing True outDir

  putStrLn "StreamVault Haskell JSON API Builder"
  putStrLn "No server. No ports. File-output only."
  putStrLn ""

  writeHealth (outDir </> "api-health.json")

  copyJson (root </> "home-feed.json") (outDir </> "api-home-feed.json")
  copyJson (root </> "section-catalog.json") (outDir </> "api-section-catalog.json")
  copyJson (root </> "data" </> "home-feed.json") (outDir </> "api-home-feed-data.json")
  copyJson (root </> "data" </> "cache" </> "home-feed.json") (outDir </> "api-home-feed-cache.json")
  copyJson (root </> "data" </> "cache" </> "section-catalog.json") (outDir </> "api-section-catalog-cache.json")

  putStrLn "OK: Haskell generated API JSON output files."