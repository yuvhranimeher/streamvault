module Main where

import Data.Char (isAlphaNum, isSpace)
import Data.List (isInfixOf)
import System.Environment (getArgs)
import System.Exit (die)

data Fixture = Fixture
  { fixtureName :: String
  , fixtureClientType :: String
  , fixtureStreamUrl :: String
  , fixturePlaybackMode :: String
  , fixtureRequiresTranscode :: Bool
  , fixtureShouldUseFfmpeg :: Bool
  , fixtureSourceType :: String
  , fixtureInputId :: String
  } deriving (Show)

data Plan = Plan
  { planInputId :: String
  , planFixtureName :: String
  , planSourceType :: String
  , planClientType :: String
  , planPlaybackMode :: String
  , planRequiresTranscode :: Bool
  , planShouldUseFfmpeg :: Bool
  , planStreamUrl :: String
  , planReason :: String
  , planOk :: Bool
  } deriving (Show)

main :: IO ()
main = do
  args <- getArgs
  path <- case args of
    [value] -> pure value
    _ -> die "Usage: PlaybackShadowPlanner <playback-planner-fixtures.json>"
  raw <- readFile path
  fixtures <- case parseFixtures raw of
    Left err -> die err
    Right value -> pure value
  putStrLn (plansJson (map planFixture fixtures))

planFixture :: Fixture -> Plan
planFixture fixture
  | null (fixtureStreamUrl fixture) =
      plan "invalid" False False False "Missing streamUrl; playback plan is invalid."
  | fixtureSourceType fixture == "live" && ".m3u8" `isInfixOf` fixtureStreamUrl fixture =
      plan "live" True False False "Live TV m3u8 source maps to live shadow playback."
  | fixtureClientType fixture == "mobile" && fixturePlaybackMode fixture == "hls" =
      plan "hls" True True True "Mobile compatibility fixture maps to HLS shadow playback."
  | fixtureSourceType fixture == "series" =
      plan "direct" True False False "Series episode streamUrl maps to direct shadow playback."
  | fixtureClientType fixture == "desktop" =
      plan "direct" True False False "Desktop streamUrl maps to direct shadow playback without FFmpeg."
  | otherwise =
      plan "direct" True (fixtureRequiresTranscode fixture) (fixtureShouldUseFfmpeg fixture) "Fallback shadow playback decision preserves fixture contract."
  where
    plan mode ok transcode ffmpeg reason =
      Plan
        { planInputId = fixtureInputId fixture
        , planFixtureName = fixtureName fixture
        , planSourceType = fixtureSourceType fixture
        , planClientType = fixtureClientType fixture
        , planPlaybackMode = mode
        , planRequiresTranscode = transcode
        , planShouldUseFfmpeg = ffmpeg
        , planStreamUrl = fixtureStreamUrl fixture
        , planReason = reason
        , planOk = ok
        }

plansJson :: [Plan] -> String
plansJson plans =
  "[\n" ++ joinWith ",\n" (map planJson plans) ++ "\n]\n"

planJson :: Plan -> String
planJson plan =
  "  {\n"
    ++ field "inputId" (jsonString (planInputId plan)) True
    ++ field "fixtureName" (jsonString (planFixtureName plan)) True
    ++ field "sourceType" (jsonString (planSourceType plan)) True
    ++ field "clientType" (jsonString (planClientType plan)) True
    ++ field "playbackMode" (jsonString (planPlaybackMode plan)) True
    ++ field "requiresTranscode" (jsonBool (planRequiresTranscode plan)) True
    ++ field "shouldUseFfmpeg" (jsonBool (planShouldUseFfmpeg plan)) True
    ++ field "streamUrl" (jsonString (planStreamUrl plan)) True
    ++ field "reason" (jsonString (planReason plan)) True
    ++ field "ok" (jsonBool (planOk plan)) False
    ++ "  }"

field :: String -> String -> Bool -> String
field name value comma =
  "    " ++ jsonString name ++ ": " ++ value ++ if comma then ",\n" else "\n"

jsonBool :: Bool -> String
jsonBool True = "true"
jsonBool False = "false"

jsonString :: String -> String
jsonString value = "\"" ++ concatMap escapeJson value ++ "\""

escapeJson :: Char -> String
escapeJson '"' = "\\\""
escapeJson '\\' = "\\\\"
escapeJson '\n' = "\\n"
escapeJson '\r' = "\\r"
escapeJson '\t' = "\\t"
escapeJson c = [c]

parseFixtures :: String -> Either String [Fixture]
parseFixtures raw =
  let objects = topLevelObjects raw
  in if null objects
       then Left "No fixture objects found"
       else traverse parseFixture objects

parseFixture :: String -> Either String Fixture
parseFixture object = do
  name <- requiredString "name" object
  clientType <- requiredString "clientType" object
  streamUrl <- requiredString "streamUrl" object
  playbackMode <- requiredString "playbackMode" object
  requiresTranscode <- requiredBool "requiresTranscode" object
  shouldUseFfmpeg <- requiredBool "shouldUseFfmpeg" object
  sourceType <- requiredString "sourceType" object
  inputObject <- requiredObject "input" object
  inputId <- requiredString "id" inputObject
  pure Fixture
    { fixtureName = name
    , fixtureClientType = clientType
    , fixtureStreamUrl = streamUrl
    , fixturePlaybackMode = playbackMode
    , fixtureRequiresTranscode = requiresTranscode
    , fixtureShouldUseFfmpeg = shouldUseFfmpeg
    , fixtureSourceType = sourceType
    , fixtureInputId = inputId
    }

requiredString :: String -> String -> Either String String
requiredString key object =
  case findStringField key object of
    Just value -> Right value
    Nothing -> Left ("Missing string field: " ++ key)

requiredBool :: String -> String -> Either String Bool
requiredBool key object =
  case findBoolField key object of
    Just value -> Right value
    Nothing -> Left ("Missing boolean field: " ++ key)

requiredObject :: String -> String -> Either String String
requiredObject key object =
  case findObjectField key object of
    Just value -> Right value
    Nothing -> Left ("Missing object field: " ++ key)

findStringField :: String -> String -> Maybe String
findStringField key object = do
  rest <- fieldRest key object
  parseJsonString (dropWhile isSpace rest)

findBoolField :: String -> String -> Maybe Bool
findBoolField key object = do
  rest <- fieldRest key object
  let trimmed = dropWhile isSpace rest
  if take 4 trimmed == "true"
    then Just True
    else if take 5 trimmed == "false"
      then Just False
      else Nothing

findObjectField :: String -> String -> Maybe String
findObjectField key object = do
  rest <- fieldRest key object
  takeBalancedObject (dropWhile isSpace rest)

fieldRest :: String -> String -> Maybe String
fieldRest key object =
  let needle = "\"" ++ key ++ "\""
  in case findSubstring needle object of
       Nothing -> Nothing
       Just index ->
         case dropWhile isSpace (drop (index + length needle) object) of
           ':' : rest -> Just rest
           _ -> Nothing

parseJsonString :: String -> Maybe String
parseJsonString ('"' : rest) = Just (go rest)
  where
    go [] = []
    go ('"' : _) = []
    go ('\\' : '"' : xs) = '"' : go xs
    go ('\\' : '\\' : xs) = '\\' : go xs
    go ('\\' : '/' : xs) = '/' : go xs
    go ('\\' : 'n' : xs) = '\n' : go xs
    go ('\\' : 'r' : xs) = '\r' : go xs
    go ('\\' : 't' : xs) = '\t' : go xs
    go (_ : xs@('u' : _)) = go xs
    go (x : xs) = x : go xs
parseJsonString _ = Nothing

topLevelObjects :: String -> [String]
topLevelObjects = go 0 False False [] []
  where
    go _ _ _ current acc [] =
      reverse (if null current then acc else reverse current : acc)
    go depth inString escaped current acc (x:xs)
      | inString =
          go depth (escaped || x /= '"') (x == '\\' && not escaped) (x:current) acc xs
      | x == '"' =
          go depth True False (if depth > 0 then x:current else current) acc xs
      | x == '{' && depth == 0 =
          go 1 False False [x] acc xs
      | x == '{' =
          go (depth + 1) False False (x:current) acc xs
      | x == '}' && depth == 1 =
          go 0 False False [] (reverse (x:current) : acc) xs
      | x == '}' && depth > 1 =
          go (depth - 1) False False (x:current) acc xs
      | depth > 0 =
          go depth False False (x:current) acc xs
      | otherwise =
          go depth False False current acc xs

takeBalancedObject :: String -> Maybe String
takeBalancedObject ('{' : rest) = Just ('{' : go 1 False False rest)
  where
    go _ _ _ [] = []
    go depth inString escaped (x:xs)
      | inString = x : go depth (escaped || x /= '"') (x == '\\' && not escaped) xs
      | x == '"' = x : go depth True False xs
      | x == '{' = x : go (depth + 1) False False xs
      | x == '}' && depth == 1 = "}"
      | x == '}' = x : go (depth - 1) False False xs
      | otherwise = x : go depth False False xs
takeBalancedObject _ = Nothing

findSubstring :: String -> String -> Maybe Int
findSubstring needle haystack = go 0 haystack
  where
    go _ [] = Nothing
    go index rest
      | needle `prefixOf` rest = Just index
      | otherwise = go (index + 1) (drop 1 rest)

prefixOf :: String -> String -> Bool
prefixOf [] _ = True
prefixOf _ [] = False
prefixOf (x:xs) (y:ys) = x == y && prefixOf xs ys

joinWith :: String -> [String] -> String
joinWith _ [] = ""
joinWith _ [x] = x
joinWith separator (x:xs) = x ++ separator ++ joinWith separator xs
