-- INACTIVE SHADOW-ONLY ROUTE IMPLEMENTATION — NOT WIRED TO SERVER
-- This executable reads frozen route contract fixtures and prints normalized
-- JSON decisions. It does not start a server, call the network, call FFmpeg,
-- or register active HTTP routes.

module Main where

import Data.Char (isSpace)
import Data.List (isInfixOf)
import System.Environment (getArgs)
import System.Exit (die)

data Fixture = Fixture
  { fixtureName :: String
  , fixtureRouteTarget :: String
  , fixtureFutureHaskellMirrorName :: String
  , fixtureRiskLevel :: String
  , fixtureClientType :: String
  , fixtureSourceType :: String
  , fixtureStreamUrl :: String
  , fixturePlaybackMode :: String
  , fixtureRequiresTranscode :: Bool
  , fixtureShouldUseFfmpeg :: Bool
  , fixtureResponseKind :: String
  , fixtureExpectedInputFields :: [String]
  , fixtureExpectedOutputFields :: [String]
  } deriving (Show)

data Decision = Decision
  { decisionCaseName :: String
  , decisionRouteTarget :: String
  , decisionFutureHaskellMirrorName :: String
  , decisionRiskLevel :: String
  , decisionSourceType :: String
  , decisionClientType :: String
  , decisionResponseKind :: String
  , decisionRouteMayStreamBytes :: Bool
  , decisionRouteReturnsJson :: Bool
  , decisionPlaybackMode :: String
  , decisionRequiresTranscode :: Bool
  , decisionShouldUseFfmpeg :: Bool
  , decisionStreamUrl :: String
  , decisionExpectedInputFields :: [String]
  , decisionExpectedOutputFields :: [String]
  , decisionOk :: Bool
  , decisionReason :: String
  } deriving (Show)

main :: IO ()
main = do
  args <- getArgs
  path <- case args of
    [value] -> pure value
    _ -> die "Usage: PlaybackRouteContractShadow <playback-route-contract-fixtures.json>"
  raw <- readFile path
  fixtures <- case parseFixtures raw of
    Left err -> die err
    Right value -> pure value
  putStr (decisionsJson (map planRouteContract fixtures))

planRouteContract :: Fixture -> Decision
planRouteContract fixture
  | null (fixtureRouteTarget fixture) =
      decision "invalid" False False False "Missing routeTarget; route contract is invalid."
  | null (fixtureSourceType fixture) =
      decision "invalid" False False False "Missing sourceType; route contract is invalid."
  | null (fixtureClientType fixture) =
      decision "invalid" False False False "Missing clientType; route contract is invalid."
  | null (fixtureStreamUrl fixture) =
      decision "invalid" False False False "Missing streamUrl; route contract is invalid."
  | not (fixtureRouteTarget fixture `elem` routeTargets) =
      decision "invalid" False False False "Unknown routeTarget; route contract is invalid."
  | not (fixtureClientType fixture `elem` clientTypes) =
      decision "invalid" False False False "Unsupported clientType; route contract is invalid."
  | not (fixtureSourceType fixture `elem` sourceTypes) =
      decision "invalid" False False False "Unsupported sourceType; route contract is invalid."
  | not (safeStreamUrl (fixtureStreamUrl fixture)) =
      decision "invalid" False False False "Unsafe streamUrl; route contract is invalid."
  | fixtureSourceType fixture == "live" && ".m3u8" `isInfixOf` fixtureStreamUrl fixture =
      decision "live" True False False "Live m3u8 route contract preserves live playback."
  | fixtureClientType fixture == "mobile" && fixturePlaybackMode fixture == "hls" =
      decision "hls" True True True "Mobile route contract allows HLS only when required."
  | fixtureSourceType fixture == "series" =
      decision "direct" True False False "Series episode route contract preserves direct playback."
  | fixtureRouteTarget fixture == "/api/ftp/raw" =
      decision "direct" True False False "FTP raw route contract may stream bytes without transcoding."
  | fixtureClientType fixture == "desktop" =
      decision "direct" True False False "Desktop route contract preserves direct playback without FFmpeg."
  | otherwise =
      decision "direct" True (fixtureRequiresTranscode fixture) (fixtureShouldUseFfmpeg fixture) "Fallback route contract preserves fixture flags."
  where
    responseKind = fixtureResponseKind fixture
    decision mode ok transcode ffmpeg reason =
      Decision
        { decisionCaseName = fixtureName fixture
        , decisionRouteTarget = fixtureRouteTarget fixture
        , decisionFutureHaskellMirrorName = fixtureFutureHaskellMirrorName fixture
        , decisionRiskLevel = fixtureRiskLevel fixture
        , decisionSourceType = fixtureSourceType fixture
        , decisionClientType = fixtureClientType fixture
        , decisionResponseKind = responseKind
        , decisionRouteMayStreamBytes = responseKind == "may-stream-bytes"
        , decisionRouteReturnsJson = responseKind == "json-only"
        , decisionPlaybackMode = mode
        , decisionRequiresTranscode = transcode
        , decisionShouldUseFfmpeg = ffmpeg
        , decisionStreamUrl = fixtureStreamUrl fixture
        , decisionExpectedInputFields = fixtureExpectedInputFields fixture
        , decisionExpectedOutputFields = fixtureExpectedOutputFields fixture
        , decisionOk = ok
        , decisionReason = reason
        }

routeTargets :: [String]
routeTargets =
  [ "/api/playback/local"
  , "/api/playback/ftp"
  , "/api/playback/movie"
  , "/api/ftp/raw"
  , "live TV m3u8 playback"
  , "series episode playback"
  ]

clientTypes :: [String]
clientTypes = ["desktop", "mobile"]

sourceTypes :: [String]
sourceTypes = ["movie", "series", "live"]

safeStreamUrl :: String -> Bool
safeStreamUrl value =
  any (`prefixOf` value) ["http://", "https://", "ftp://", "local://"]

decisionsJson :: [Decision] -> String
decisionsJson decisions =
  "[\n" ++ joinWith ",\n" (map decisionJson decisions) ++ "\n]\n"

decisionJson :: Decision -> String
decisionJson decision =
  "  {\n"
    ++ field "caseName" (jsonString (decisionCaseName decision)) True
    ++ field "routeTarget" (jsonString (decisionRouteTarget decision)) True
    ++ field "futureHaskellMirrorName" (jsonString (decisionFutureHaskellMirrorName decision)) True
    ++ field "riskLevel" (jsonString (decisionRiskLevel decision)) True
    ++ field "sourceType" (jsonString (decisionSourceType decision)) True
    ++ field "clientType" (jsonString (decisionClientType decision)) True
    ++ field "responseKind" (jsonString (decisionResponseKind decision)) True
    ++ field "routeMayStreamBytes" (jsonBool (decisionRouteMayStreamBytes decision)) True
    ++ field "routeReturnsJson" (jsonBool (decisionRouteReturnsJson decision)) True
    ++ field "playbackMode" (jsonString (decisionPlaybackMode decision)) True
    ++ field "requiresTranscode" (jsonBool (decisionRequiresTranscode decision)) True
    ++ field "shouldUseFfmpeg" (jsonBool (decisionShouldUseFfmpeg decision)) True
    ++ field "streamUrl" (jsonString (decisionStreamUrl decision)) True
    ++ arrayField "expectedInputFields" (decisionExpectedInputFields decision) True
    ++ arrayField "expectedOutputFields" (decisionExpectedOutputFields decision) True
    ++ field "ok" (jsonBool (decisionOk decision)) True
    ++ field "reason" (jsonString (decisionReason decision)) False
    ++ "  }"

field :: String -> String -> Bool -> String
field name value comma =
  "    " ++ jsonString name ++ ": " ++ value ++ if comma then ",\n" else "\n"

arrayField :: String -> [String] -> Bool -> String
arrayField name values comma =
  "    " ++ jsonString name ++ ": " ++ jsonArray values ++ if comma then ",\n" else "\n"

jsonArray :: [String] -> String
jsonArray [] = "[]"
jsonArray values =
  "[\n" ++ joinWith ",\n" (map (\value -> "      " ++ jsonString value) values) ++ "\n    ]"

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
       then Left "No route contract fixture objects found"
       else traverse parseFixture objects

parseFixture :: String -> Either String Fixture
parseFixture object = do
  name <- requiredString "name" object
  routeTarget <- requiredString "routeTarget" object
  futureMirror <- requiredString "futureHaskellMirrorName" object
  riskLevel <- requiredString "riskLevel" object
  clientType <- requiredString "clientType" object
  sourceType <- requiredString "sourceType" object
  streamUrl <- requiredString "streamUrl" object
  playbackMode <- requiredString "playbackMode" object
  requiresTranscode <- requiredBool "requiresTranscode" object
  shouldUseFfmpeg <- requiredBool "shouldUseFfmpeg" object
  responseKind <- requiredString "responseKind" object
  inputFields <- requiredStringArray "expectedInputFields" object
  outputFields <- requiredStringArray "expectedOutputFields" object
  pure Fixture
    { fixtureName = name
    , fixtureRouteTarget = routeTarget
    , fixtureFutureHaskellMirrorName = futureMirror
    , fixtureRiskLevel = riskLevel
    , fixtureClientType = clientType
    , fixtureSourceType = sourceType
    , fixtureStreamUrl = streamUrl
    , fixturePlaybackMode = playbackMode
    , fixtureRequiresTranscode = requiresTranscode
    , fixtureShouldUseFfmpeg = shouldUseFfmpeg
    , fixtureResponseKind = responseKind
    , fixtureExpectedInputFields = inputFields
    , fixtureExpectedOutputFields = outputFields
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

requiredStringArray :: String -> String -> Either String [String]
requiredStringArray key object =
  case findStringArrayField key object of
    Just value -> Right value
    Nothing -> Left ("Missing string array field: " ++ key)

findStringField :: String -> String -> Maybe String
findStringField key object = do
  rest <- fieldRest key object
  value <- parseJsonString (dropWhile isSpace rest)
  Just value

findBoolField :: String -> String -> Maybe Bool
findBoolField key object = do
  rest <- fieldRest key object
  let trimmed = dropWhile isSpace rest
  if take 4 trimmed == "true"
    then Just True
    else if take 5 trimmed == "false"
      then Just False
      else Nothing

findStringArrayField :: String -> String -> Maybe [String]
findStringArrayField key object = do
  rest <- fieldRest key object
  arrayText <- takeStringArray (dropWhile isSpace rest)
  Just (stringLiterals arrayText)

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
parseJsonString input = fmap fst (parseJsonStringWithRest input)

parseJsonStringWithRest :: String -> Maybe (String, String)
parseJsonStringWithRest ('"' : rest) = Just (go [] rest)
  where
    go acc [] = (reverse acc, [])
    go acc ('"' : xs) = (reverse acc, xs)
    go acc ('\\' : '"' : xs) = go ('"' : acc) xs
    go acc ('\\' : '\\' : xs) = go ('\\' : acc) xs
    go acc ('\\' : '/' : xs) = go ('/' : acc) xs
    go acc ('\\' : 'n' : xs) = go ('\n' : acc) xs
    go acc ('\\' : 'r' : xs) = go ('\r' : acc) xs
    go acc ('\\' : 't' : xs) = go ('\t' : acc) xs
    go acc ('\\' : 'u' : _ : _ : _ : _ : xs) = go acc xs
    go acc (x : xs) = go (x : acc) xs
parseJsonStringWithRest _ = Nothing

stringLiterals :: String -> [String]
stringLiterals = go []
  where
    go acc [] = reverse acc
    go acc input@('"' : _) =
      case parseJsonStringWithRest input of
        Just (value, rest) -> go (value : acc) rest
        Nothing -> reverse acc
    go acc (_ : xs) = go acc xs

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

takeStringArray :: String -> Maybe String
takeStringArray ('[' : rest) = Just ('[' : go False False rest)
  where
    go _ _ [] = []
    go inString escaped (x:xs)
      | inString = x : go (escaped || x /= '"') (x == '\\' && not escaped) xs
      | x == '"' = x : go True False xs
      | x == ']' = "]"
      | otherwise = x : go False False xs
takeStringArray _ = Nothing

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
