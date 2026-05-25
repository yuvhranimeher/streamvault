-- StreamVault Details/TMDB Haskell Prototype
-- Safe scaffold only. This is NOT wired into production yet.
--
-- Future routes:
--   GET /api/details/:type/:id
--   GET /api/title-details?type=movie|series&title=...
--   GET /api/series/detail?name=...
--
-- Keep playback/direct stream/FFmpeg in Node until the final migration phase.

module Main where

import Data.Char (isAlphaNum, toLower)
import Data.List (intercalate, isInfixOf)
import System.Environment (getArgs)

data MediaType = Movie | Series | UnknownType
  deriving (Eq, Show)

data DetailsRoute
  = DetailsById MediaType String
  | TitleDetails MediaType String
  | SeriesDetail String
  | DetailsDebug
  | UnknownRoute String
  deriving (Eq, Show)

normalizeTitle :: String -> String
normalizeTitle =
  trimDash . map normalizeChar
  where
    normalizeChar c
      | isAlphaNum c = toLower c
      | otherwise    = '-'

trimDash :: String -> String
trimDash = reverse . dropWhile (== '-') . reverse . dropWhile (== '-')

mediaTypeFromText :: String -> MediaType
mediaTypeFromText s
  | map toLower s == "movie"  = Movie
  | map toLower s == "series" = Series
  | otherwise                 = UnknownType

-- Very small route detector for prototype/testing only.
-- Real server implementation will use proper routing and query parsing.
detectRoute :: String -> DetailsRoute
detectRoute raw
  | raw == "/api/details/debug" = DetailsDebug
  | "/api/details/movie/" `isInfixOf` raw =
      DetailsById Movie (dropPrefix "/api/details/movie/" raw)
  | "/api/details/series/" `isInfixOf` raw =
      DetailsById Series (dropPrefix "/api/details/series/" raw)
  | "/api/title-details" `isInfixOf` raw =
      TitleDetails UnknownType raw
  | "/api/series/detail" `isInfixOf` raw =
      SeriesDetail raw
  | otherwise =
      UnknownRoute raw

dropPrefix :: String -> String -> String
dropPrefix p s =
  case splitOnPrefix p s of
    Just rest -> rest
    Nothing   -> s

splitOnPrefix :: String -> String -> Maybe String
splitOnPrefix [] s = Just s
splitOnPrefix _ [] = Nothing
splitOnPrefix (p:ps) (s:ss)
  | p == s    = splitOnPrefix ps ss
  | otherwise = Nothing

requiredFields :: [String]
requiredFields =
  [ "id"
  , "type"
  , "title/name"
  , "overview"
  , "poster"
  , "backdrop"
  , "rating/voteAverage"
  , "year/releaseDate"
  , "genres"
  , "runtime"
  , "trailer/youtube"
  , "cast"
  , "crew"
  , "productionCompanies"
  , "similar"
  , "directorTitles"
  , "seasons"
  , "episodes"
  , "streamUrl/playback fields"
  ]

printPlan :: IO ()
printPlan = do
  putStrLn "StreamVault Details/TMDB Haskell Prototype"
  putStrLn "=========================================="
  putStrLn ""
  putStrLn "Status: scaffold only, not production."
  putStrLn ""
  putStrLn "Required response fields:"
  mapM_ (\x -> putStrLn ("- " ++ x)) requiredFields
  putStrLn ""
  putStrLn "Next implementation modules inside final all-in-one Server.hs:"
  putStrLn "- route parsing"
  putStrLn "- catalog lookup by id/title"
  putStrLn "- detail-cache.json compatibility"
  putStrLn "- episode-title-cache.json compatibility"
  putStrLn "- TMDB lookup/fallback"
  putStrLn "- YouTube trailer extraction"
  putStrLn "- cast/crew/production/similar/director titles"
  putStrLn "- exact Node field compatibility"
  putStrLn "- playback handoff fields preserved"
  putStrLn ""
  putStrLn "Do not migrate playback/FFmpeg in this phase."

main :: IO ()
main = do
  args <- getArgs
  case args of
    [] -> printPlan
    ["route", raw] -> print (detectRoute raw)
    ["slug", title] -> putStrLn (normalizeTitle title)
    _ -> do
      putStrLn "Usage:"
      putStrLn "  DetailsTmdbPrototype.exe"
      putStrLn "  DetailsTmdbPrototype.exe route /api/details/movie/ftp_0"
      putStrLn "  DetailsTmdbPrototype.exe slug \"The Hunt for Gollum (2009)\""
