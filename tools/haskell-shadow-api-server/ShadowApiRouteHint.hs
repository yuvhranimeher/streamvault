module Main where

import System.Environment (getArgs)
import Data.Char (isAlphaNum, toLower)

safeChar :: Char -> Char
safeChar c
  | isAlphaNum c = toLower c
  | otherwise = '-'

clean :: String -> String
clean = dropWhile (== '-') . reverse . dropWhile (== '-') . reverse . collapse . map safeChar
  where
    collapse [] = []
    collapse [x] = [x]
    collapse (x:y:xs)
      | x == '-' && y == '-' = collapse (y:xs)
      | otherwise = x : collapse (y:xs)

routeHint :: String -> String -> String
routeHint path query
  | path == "/api/home-feed" = "api-home-feed"
  | path == "/api/movies" = "api-movies"
  | path == "/api/series" = "api-series"
  | path == "/api/downloads" = "api-downloads"
  | "/api/section/" `prefixOf` path = "api-section-" ++ clean (drop (length "/api/section/") path)
  | path == "/api/search" = "api-search-" ++ clean query
  | otherwise = "unknown"

prefixOf :: String -> String -> Bool
prefixOf [] _ = True
prefixOf _ [] = False
prefixOf (a:as) (b:bs) = a == b && prefixOf as bs

main :: IO ()
main = do
  args <- getArgs
  let path = if null args then "/" else head args
  let query = if length args < 2 then "" else args !! 1
  putStrLn (routeHint path query)
