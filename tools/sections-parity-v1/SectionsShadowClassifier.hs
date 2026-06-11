{-# OPTIONS_GHC -Wall -Wno-unused-matches #-}
module Main where

import Data.List (intercalate)
import System.Environment (getArgs)

data Section = Section String String String String

main :: IO ()
main = getArgs >>= run

run :: [String] -> IO ()
run _ = putStrLn makeJson

dq :: String
dq = [toEnum 34]

sections :: [Section]
sections =
  [ Section "netflixRow" "netflixTrack" "netflix" "Netflix Originals"
  , Section "marvelRow" "marvelTrack" "marvel" "Marvel Studios"
  , Section "dcRow" "dcTrack" "dc" "DC"
  , Section "trendingRow" "trendingTrack" "trending" "\x1F525 Trending Now"
  , Section "seriesRow" "seriesTrack" "series" "Series"
  , Section "newRow" "newTrack" "new" "New to StreamVault"
  , Section "universalRow" "universalTrack" "universal" "Universal Pictures"
  , Section "disneyRow" "disneyTrack" "disney" "Disney"
  , Section "warnerRow" "warnerTrack" "warner" "Warner Bros"
  , Section "hboRow" "hboTrack" "hbo" "HBO"
  , Section "appleTvRow" "appleTvTrack" "apple" "Apple TV+"
  , Section "indianRow" "indianTrack" "indian" "Indian Movies & Drama"
  , Section "animeRow" "animeTrack" "anime" "Anime"
  , Section "koreanRow" "koreanTrack" "koreanDrama" "Korean Drama"
  , Section "horrorRow" "horrorTrack" "horrorNights" "Horror Nights"
  , Section "scifiRow" "scifiTrack" "cyberpunkScifi" "Cyberpunk & Sci-Fi"
  , Section "mindfuckRow" "mindfuckTrack" "mindfuck" "Mindfuck Movies"
  , Section "cultClassicsRow" "cultClassicsTrack" "cultClassics" "Cult Classics"
  , Section "a24Row" "a24Track" "a24" "A24 Collection"
  , Section "nostalgia90sRow" "nostalgia90sTrack" "nostalgia90s" "90s Nostalgia"
  , Section "midnightCinemaRow" "midnightCinemaTrack" "midnightCinema" "Midnight Cinema"
  , Section "trueCrimeRow" "trueCrimeTrack" "trueCrime" "True Crime"
  , Section "thrillerRow" "thrillerTrack" "psychThriller" "Psychological Thriller"
  , Section "adultAnimationRow" "adultAnimationTrack" "adultAnimation" "Adult Animation"
  , Section "postApocalypticRow" "postApocalypticTrack" "postApocalyptic" "Post-Apocalyptic"
  , Section "feelGoodRow" "feelGoodTrack" "feelGood" "Feel Good Movies"
  , Section "darkComedyRow" "darkComedyTrack" "darkComedy" "Dark Comedy"
  , Section "timeTravelRow" "timeTravelTrack" "timeTravel" "Time Travel"
  , Section "spaceAiRow" "spaceAiTrack" "spaceAi" "Space & AI"
  , Section "crimeRow" "crimeTrack" "crimeSyndicates" "Crime Syndicates"
  , Section "zombieRow" "zombieTrack" "zombie" "Zombie Universe"
  , Section "indieGemsRow" "indieGemsTrack" "indieGems" "Indie Gems"
  , Section "hiddenMasterpiecesRow" "hiddenMasterpiecesTrack" "hiddenMasterpieces" "Hidden Masterpieces"
  , Section "liveConcertsRow" "liveConcertsTrack" "liveConcerts" "Live Concerts"
  , Section "documentaryRow" "documentaryTrack" "documentaryVault" "Documentary Vault"
  , Section "ghibliRow" "ghibliTrack" "ghibli" "Studio Ghibli"
  , Section "romanticRow" "romanticTrack" "romanceMidnight" "Romance After Midnight"
  , Section "comingSoonRow" "comingSoonTrack" "comingSoon" "Coming Soon"
  , Section "dramaRow" "dramaTrack" "drama" "Drama & Emotion"
  , Section "spanishRow" "spanishTrack" "spanish" "Spanish & Latino"
  , Section "highRatedRow" "highRatedTrack" "topRated" "\x2B50 Top Rated (8+)"
  , Section "allRow" "allTrack" "allMovies" "All Movies"
  , Section "recentlyAddedRow" "recentlyAddedTrack" "recentlyAdded" "Recently Added"
  , Section "mostWatchedTodayRow" "mostWatchedTodayTrack" "mostWatchedToday" "Most Watched Today"
  ]

makeJson :: String
makeJson = renderJson (map renderSection sections)

renderJson :: [String] -> String
renderJson sectionRows = unlines [ "{", field "ok" "true", fieldText "source" "base-haskell-sections-shadow-classifier", field "sectionCount" (show (length sectionRows)), "  " ++ dq ++ "sections" ++ dq ++ ": [" ++ intercalate ", " sectionRows ++ "]", "}" ]

renderSection :: Section -> String
renderSection (Section rowId trackId sectionKey title) =
  "{" ++ intercalate ", "
    [ jsonPairText "rowId" rowId
    , jsonPairText "trackId" trackId
    , jsonPairText "sectionKey" sectionKey
    , jsonPairText "title" title
    ] ++ "}"

field :: String -> String -> String
field name value = "  " ++ dq ++ name ++ dq ++ ": " ++ value ++ ","

fieldText :: String -> String -> String
fieldText name value = field name (jsonString value)

jsonPairText :: String -> String -> String
jsonPairText name value = dq ++ name ++ dq ++ ": " ++ jsonString value

jsonString :: String -> String
jsonString value = dq ++ concatMap escapeJson value ++ dq

escapeJson :: Char -> String
escapeJson c = if c == toEnum 34 then [toEnum 92, toEnum 34] else if c == toEnum 92 then [toEnum 92, toEnum 92] else if c == toEnum 10 then [toEnum 92, toEnum 110] else if c == '\x1F525' then "\\ud83d\\udd25" else if c == '\x2B50' then "\\u2b50" else [c]
