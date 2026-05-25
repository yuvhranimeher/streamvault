{-# LANGUAGE OverloadedStrings #-}

module Main where

import qualified Data.ByteString.Lazy as BL
import qualified Data.ByteString.Lazy.Char8 as C
import Control.Monad (forM_)
import System.Directory (doesFileExist, getCurrentDirectory)
import System.FilePath ((</>), takeFileName)

countSub :: C.ByteString -> C.ByteString -> Int
countSub needle haystack
  | C.null needle = 0
  | C.null haystack = 0
  | needle `C.isPrefixOf` haystack = 1 + countSub needle (C.drop (C.length needle) haystack)
  | otherwise = countSub needle (C.drop 1 haystack)

round2 :: Double -> Double
round2 x = fromIntegral (round (x * 100) :: Integer) / 100

analyze :: FilePath -> IO ()
analyze fp = do
  exists <- doesFileExist fp
  if not exists
    then pure ()
    else do
      bs <- BL.readFile fp
      let sizeMB = fromIntegral (BL.length bs) / (1024 * 1024) :: Double
          streams = countSub "\"streamUrl\"" bs
          posters = countSub "\"poster\"" bs
          moviesKey = countSub "\"movies\"" bs
          seriesKey = countSub "\"series\"" bs
      putStrLn ("FILE: " ++ takeFileName fp)
      putStrLn ("  sizeMB: " ++ show (round2 sizeMB))
      putStrLn ("  streamUrl entries: " ++ show streams)
      putStrLn ("  poster fields: " ++ show posters)
      putStrLn ("  movies keys: " ++ show moviesKey)
      putStrLn ("  series keys: " ++ show seriesKey)
      putStrLn ""

main :: IO ()
main = do
  root <- getCurrentDirectory
  putStrLn "StreamVault Haskell Catalog Reader"
  putStrLn ("Root: " ++ root)
  putStrLn ""
  let files =
        [ "catalog.json"
        , "approved-clean-catalog.json"
        , "bnet-media-catalog.json"
        , "software-catalog.json"
        , "home-feed.json"
        , "section-catalog.json"
        , "data/home-feed.json"
        , "data/cache/home-feed.json"
        , "data/cache/section-catalog.json"
        ]
  forM_ files (\f -> analyze (root </> f))
  putStrLn "OK: Haskell file-reading test finished."