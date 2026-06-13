-- INACTIVE SHADOW-ONLY REQUEST/RESPONSE ADAPTER — NOT WIRED TO SERVER
-- This executable reads local adapter fixtures and prints normalized response
-- envelopes. It does not start a server, call the network, call FFmpeg, or
-- register active HTTP routes.

module Main where

import Data.Char (isSpace, toLower, toUpper)
import Data.List (isInfixOf)
import System.Environment (getArgs)
import System.Exit (die)

data Fixture = Fixture
  { fixtureName :: String
  , fixtureRequestMethod :: String
  , fixtureRequestPath :: String
  , fixtureQuery :: String
  , fixtureBody :: String
  } deriving (Show)

data RouteMetadata = RouteMetadata
  { metadataRouteTarget :: String
  , metadataFutureHaskellMirrorName :: String
  , metadataRiskLevel :: String
  , metadataResponseKind :: String
  , metadataExpectedInputFields :: [String]
  , metadataExpectedOutputFields :: [String]
  } deriving (Show)

data NormalizedRequest = NormalizedRequest
  { normalizedCaseName :: String
  , normalizedRequestMethod :: String
  , normalizedRequestPath :: String
  , normalizedRouteTarget :: String
  , normalizedFutureHaskellMirrorName :: String
  , normalizedRiskLevel :: String
  , normalizedSourceType :: String
  , normalizedClientType :: String
  , normalizedResponseKind :: String
  , normalizedPlaybackMode :: String
  , normalizedRequiresTranscode :: Bool
  , normalizedShouldUseFfmpeg :: Bool
  , normalizedStreamUrl :: String
  , normalizedExpectedInputFields :: [String]
  , normalizedExpectedOutputFields :: [String]
  } deriving (Show)

data Decision = Decision
  { decisionCaseName :: String
  , decisionRequestMethod :: String
  , decisionRequestPath :: String
  , decisionRoute :: String
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
  , decisionStatusCode :: Int
  , decisionErrorCode :: String
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
    _ -> die "Usage: InactivePlaybackRouteAdapter <inactive-playback-route-adapter-fixtures.json>"
  raw <- readFile path
  fixtures <- case parseFixtures raw of
    Left err -> die err
    Right value -> pure value
  putStr (decisionsJson (map adapterDecision fixtures))

adapterDecision :: Fixture -> Decision
adapterDecision fixture =
  let normalized = normalizeRequest fixture
  in plan normalized
  where
    plan normalized
      | not (normalizedRequestMethod normalized `elem` allowedMethods) =
          decision normalized "invalid" False False False "Unsupported request method; inactive adapter contract is invalid." "UNSUPPORTED_METHOD"
      | null (normalizedRequestPath normalized) =
          decision normalized "invalid" False False False "Missing route path; inactive adapter contract is invalid." "MISSING_ROUTE"
      | null (normalizedRouteTarget normalized) =
          decision normalized "invalid" False False False "Unknown route path; inactive adapter contract is invalid." "UNKNOWN_ROUTE"
      | null (normalizedSourceType normalized) =
          decision normalized "invalid" False False False "Missing sourceType; inactive adapter contract is invalid." "MISSING_SOURCE_TYPE"
      | not (normalizedSourceType normalized `elem` sourceTypes) =
          decision normalized "invalid" False False False "Unsupported sourceType; inactive adapter contract is invalid." "UNSUPPORTED_SOURCE_TYPE"
      | null (normalizedClientType normalized) =
          decision normalized "invalid" False False False "Missing clientType; inactive adapter contract is invalid." "MISSING_CLIENT_TYPE"
      | not (normalizedClientType normalized `elem` clientTypes) =
          decision normalized "invalid" False False False "Unsupported clientType; inactive adapter contract is invalid." "UNSUPPORTED_CLIENT_TYPE"
      | null (normalizedStreamUrl normalized) =
          decision normalized "invalid" False False False "Missing streamUrl; inactive adapter contract is invalid." "MISSING_STREAM_URL"
      | not (safeStreamUrl (normalizedStreamUrl normalized)) =
          decision normalized "invalid" False False False "Unsafe streamUrl; inactive adapter contract is invalid." "UNSAFE_STREAM_URL"
      | not (normalizedPlaybackMode normalized `elem` playbackModes) =
          decision normalized "invalid" False False False "Unsupported playbackMode; inactive adapter contract is invalid." "UNSUPPORTED_PLAYBACK_MODE"
      | normalizedSourceType normalized == "live" && ".m3u8" `isInfixOf` normalizedStreamUrl normalized =
          decision normalized "live" True False False "Live m3u8 adapter contract preserves live playback." ""
      | normalizedClientType normalized == "mobile" && normalizedPlaybackMode normalized == "hls" =
          decision normalized "hls" True True True "Mobile adapter contract allows HLS only when required." ""
      | normalizedSourceType normalized == "series" =
          decision normalized "direct" True False False "Series episode adapter contract preserves direct playback." ""
      | normalizedRouteTarget normalized == "/api/ftp/raw" =
          decision normalized "direct" True False False "FTP raw adapter contract may stream bytes without transcoding." ""
      | normalizedClientType normalized == "desktop" =
          decision normalized "direct" True False False "Desktop adapter contract preserves direct playback without FFmpeg." ""
      | otherwise =
          decision
            normalized
            "direct"
            True
            (normalizedRequiresTranscode normalized)
            (normalizedShouldUseFfmpeg normalized)
            "Fallback adapter contract preserves normalized fixture flags."
            ""

decision :: NormalizedRequest -> String -> Bool -> Bool -> Bool -> String -> String -> Decision
decision source playbackMode ok requiresTranscode shouldUseFfmpeg reason errorCode =
  Decision
    { decisionCaseName = normalizedCaseName source
    , decisionRequestMethod = normalizedRequestMethod source
    , decisionRequestPath = normalizedRequestPath source
    , decisionRoute = normalizedRouteTarget source
    , decisionRouteTarget = normalizedRouteTarget source
    , decisionFutureHaskellMirrorName = normalizedFutureHaskellMirrorName source
    , decisionRiskLevel = normalizedRiskLevel source
    , decisionSourceType = normalizedSourceType source
    , decisionClientType = normalizedClientType source
    , decisionResponseKind = normalizedResponseKind source
    , decisionRouteMayStreamBytes = normalizedResponseKind source == "may-stream-bytes"
    , decisionRouteReturnsJson = normalizedResponseKind source == "json-only"
    , decisionPlaybackMode = playbackMode
    , decisionRequiresTranscode = requiresTranscode
    , decisionShouldUseFfmpeg = shouldUseFfmpeg
    , decisionStreamUrl = normalizedStreamUrl source
    , decisionStatusCode = if ok then 200 else statusCodeFor errorCode
    , decisionErrorCode = errorCode
    , decisionExpectedInputFields = normalizedExpectedInputFields source
    , decisionExpectedOutputFields = normalizedExpectedOutputFields source
    , decisionOk = ok
    , decisionReason = reason
    }

normalizeRequest :: Fixture -> NormalizedRequest
normalizeRequest fixture =
  NormalizedRequest
    { normalizedCaseName = fixtureName fixture
    , normalizedRequestMethod = method
    , normalizedRequestPath = requestPath
    , normalizedRouteTarget = maybe "" metadataRouteTarget metadata
    , normalizedFutureHaskellMirrorName = maybe "" metadataFutureHaskellMirrorName metadata
    , normalizedRiskLevel = maybe "" metadataRiskLevel metadata
    , normalizedSourceType = sourceType
    , normalizedClientType = clientType
    , normalizedResponseKind = maybe "json-only" metadataResponseKind metadata
    , normalizedPlaybackMode = playbackMode
    , normalizedRequiresTranscode = requiresTranscode
    , normalizedShouldUseFfmpeg = shouldUseFfmpeg
    , normalizedStreamUrl = streamUrl
    , normalizedExpectedInputFields = maybe [] metadataExpectedInputFields metadata
    , normalizedExpectedOutputFields = maybe [] metadataExpectedOutputFields metadata
    }
  where
    method = map toUpper (fixtureRequestMethod fixture)
    requestPath = fixtureRequestPath fixture
    payloads = if method == "POST" then [fixtureBody fixture, fixtureQuery fixture] else [fixtureQuery fixture, fixtureBody fixture]
    metadata = routeMetadata requestPath
    streamUrl = firstString payloads ["streamUrl", "url", "src"]
    sourceType = firstString payloads ["sourceType"]
    clientType = normalizeClientType payloads
    playbackMode = normalizePlaybackMode payloads sourceType streamUrl
    requiresTranscode =
      case firstBool payloads ["requiresTranscode", "needsTranscode"] of
        Just value -> value
        Nothing -> clientType == "mobile" && playbackMode == "hls"
    shouldUseFfmpeg =
      case firstBool payloads ["shouldUseFfmpeg", "useFfmpeg"] of
        Just value -> value
        Nothing -> requiresTranscode

allowedMethods :: [String]
allowedMethods = ["GET", "POST"]

clientTypes :: [String]
clientTypes = ["desktop", "mobile"]

sourceTypes :: [String]
sourceTypes = ["movie", "series", "live"]

playbackModes :: [String]
playbackModes = ["direct", "hls", "live", "invalid"]

routeMetadata :: String -> Maybe RouteMetadata
routeMetadata "/api/playback/movie" =
  Just (RouteMetadata "/api/playback/movie" "PlaybackRouteMovieShadow" "medium" "json-only"
    ["id", "name", "url", "streamUrl", "mobile", "quality"]
    ["ok", "streamUrl", "sourceType", "clientType", "playbackMode", "error"])
routeMetadata "/api/playback/local" =
  Just (RouteMetadata "/api/playback/local" "PlaybackRouteLocalShadow" "high" "json-only"
    ["id", "streamUrl", "mobile", "quality", "audio", "start", "forceHls"]
    ["ok", "src", "mode", "directPlayable", "duration", "decodedUrl", "error"])
routeMetadata "/api/playback/ftp" =
  Just (RouteMetadata "/api/playback/ftp" "PlaybackRouteFtpShadow" "high" "json-only"
    ["url", "streamUrl", "mobile", "audio", "audioStream", "start", "forceHls", "mode"]
    ["ok", "src", "mode", "directPlayable", "decodedUrl", "duration", "error"])
routeMetadata "/api/ftp/raw" =
  Just (RouteMetadata "/api/ftp/raw" "PlaybackRouteFtpRawShadow" "high" "may-stream-bytes"
    ["url", "streamUrl", "range"]
    ["status", "contentType", "acceptRanges", "contentRange", "streamUrl", "error"])
routeMetadata "/api/playback/series/episode" =
  Just (RouteMetadata "series episode playback" "PlaybackRouteSeriesEpisodeShadow" "medium" "json-only"
    ["seriesId", "season", "episode", "streamUrl", "mobile"]
    ["ok", "src", "mode", "sourceType", "streamUrl", "error"])
routeMetadata "/api/playback/live/hls" =
  Just (RouteMetadata "live TV m3u8 playback" "PlaybackRouteLiveM3u8Shadow" "high" "may-stream-bytes"
    ["channelId", "src", "streamUrl"]
    ["ok", "src", "mode", "streamUrl", "contentType", "error"])
routeMetadata _ = Nothing

firstString :: [String] -> [String] -> String
firstString payloads keys =
  case [value | payload <- payloads, key <- keys, Just value <- [findStringField key payload]] of
    [] -> ""
    value : _ -> value

firstBool :: [String] -> [String] -> Maybe Bool
firstBool payloads keys =
  case [value | payload <- payloads, key <- keys, Just value <- [findBoolField key payload]] of
    [] -> Nothing
    value : _ -> Just value

normalizeClientType :: [String] -> String
normalizeClientType payloads =
  let direct = firstString payloads ["clientType"]
  in if not (null direct)
       then direct
       else case firstBool payloads ["mobile"] of
              Just True -> "mobile"
              Just False -> "desktop"
              Nothing -> ""

normalizePlaybackMode :: [String] -> String -> String -> String
normalizePlaybackMode payloads sourceType streamUrl =
  let direct = firstString payloads ["playbackMode", "mode"]
  in if not (null direct)
       then direct
       else case firstBool payloads ["forceHls"] of
              Just True -> "hls"
              _ -> if sourceType == "live" && ".m3u8" `isInfixOf` streamUrl then "live" else "direct"

safeStreamUrl :: String -> Bool
safeStreamUrl value =
  any (`prefixOf` value) ["http://", "https://", "ftp://", "local://"]

statusCodeFor :: String -> Int
statusCodeFor "UNKNOWN_ROUTE" = 404
statusCodeFor "UNSUPPORTED_METHOD" = 405
statusCodeFor "UNSUPPORTED_CLIENT_TYPE" = 422
statusCodeFor "UNSUPPORTED_SOURCE_TYPE" = 422
statusCodeFor "UNSUPPORTED_PLAYBACK_MODE" = 422
statusCodeFor _ = 400

decisionsJson :: [Decision] -> String
decisionsJson decisions =
  "[\n" ++ joinWith ",\n" (map decisionJson decisions) ++ "\n]\n"

decisionJson :: Decision -> String
decisionJson decisionValue =
  "  {\n"
    ++ field "caseName" (jsonString (decisionCaseName decisionValue)) True
    ++ field "requestMethod" (jsonString (decisionRequestMethod decisionValue)) True
    ++ field "requestPath" (jsonString (decisionRequestPath decisionValue)) True
    ++ field "route" (jsonString (decisionRoute decisionValue)) True
    ++ field "routeTarget" (jsonString (decisionRouteTarget decisionValue)) True
    ++ field "futureHaskellMirrorName" (jsonString (decisionFutureHaskellMirrorName decisionValue)) True
    ++ field "riskLevel" (jsonString (decisionRiskLevel decisionValue)) True
    ++ field "sourceType" (jsonString (decisionSourceType decisionValue)) True
    ++ field "clientType" (jsonString (decisionClientType decisionValue)) True
    ++ field "responseKind" (jsonString (decisionResponseKind decisionValue)) True
    ++ field "routeMayStreamBytes" (jsonBool (decisionRouteMayStreamBytes decisionValue)) True
    ++ field "routeReturnsJson" (jsonBool (decisionRouteReturnsJson decisionValue)) True
    ++ field "playbackMode" (jsonString (decisionPlaybackMode decisionValue)) True
    ++ field "requiresTranscode" (jsonBool (decisionRequiresTranscode decisionValue)) True
    ++ field "shouldUseFfmpeg" (jsonBool (decisionShouldUseFfmpeg decisionValue)) True
    ++ field "streamUrl" (jsonString (decisionStreamUrl decisionValue)) True
    ++ field "statusCode" (show (decisionStatusCode decisionValue)) True
    ++ field "errorCode" (jsonString (decisionErrorCode decisionValue)) True
    ++ arrayField "expectedInputFields" (decisionExpectedInputFields decisionValue) True
    ++ arrayField "expectedOutputFields" (decisionExpectedOutputFields decisionValue) True
    ++ field "ok" (jsonBool (decisionOk decisionValue)) True
    ++ field "reason" (jsonString (decisionReason decisionValue)) False
    ++ ",\n"
    ++ safetyField
    ++ "  }"

safetyField :: String
safetyField =
  "    \"safety\": {\n"
    ++ "      \"serverStarted\": false,\n"
    ++ "      \"networkCalled\": false,\n"
    ++ "      \"ffmpegStarted\": false,\n"
    ++ "      \"runtimePlaybackChanged\": false,\n"
    ++ "      \"activeRoutesAdded\": false,\n"
    ++ "      \"inactiveRouteWired\": false\n"
    ++ "    }\n"

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
       then Left "No inactive adapter fixture objects found"
       else traverse parseFixture objects

parseFixture :: String -> Either String Fixture
parseFixture object = do
  name <- requiredString "name" object
  request <- requiredObject "request" object
  method <- requiredString "method" request
  requestPath <- requiredString "path" request
  let query = maybe "{}" id (findObjectField "query" request)
  let body = maybe "{}" id (findObjectField "body" request)
  pure Fixture
    { fixtureName = name
    , fixtureRequestMethod = method
    , fixtureRequestPath = requestPath
    , fixtureQuery = query
    , fixtureBody = body
    }

requiredString :: String -> String -> Either String String
requiredString key object =
  case findStringField key object of
    Just value -> Right value
    Nothing -> Left ("Missing string field: " ++ key)

requiredObject :: String -> String -> Either String String
requiredObject key object =
  case findObjectField key object of
    Just value -> Right value
    Nothing -> Left ("Missing object field: " ++ key)

findStringField :: String -> String -> Maybe String
findStringField key object = do
  rest <- fieldRest key object
  value <- parseJsonString (dropWhile isSpace rest)
  Just value

findBoolField :: String -> String -> Maybe Bool
findBoolField key object = do
  rest <- fieldRest key object
  let trimmed = dropWhile isSpace rest
  if map toLower (take 4 trimmed) == "true"
    then Just True
    else if map toLower (take 5 trimmed) == "false"
      then Just False
      else Nothing

findObjectField :: String -> String -> Maybe String
findObjectField key object = do
  rest <- fieldRest key object
  takeJsonObject (dropWhile isSpace rest)

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

takeJsonObject :: String -> Maybe String
takeJsonObject ('{' : rest) = Just ('{' : go 1 False False rest)
  where
    go _ _ _ [] = []
    go depth inString escaped (x:xs)
      | inString = x : go depth (escaped || x /= '"') (x == '\\' && not escaped) xs
      | x == '"' = x : go depth True False xs
      | x == '{' = x : go (depth + 1) False False xs
      | x == '}' && depth == 1 = "}"
      | x == '}' = x : go (depth - 1) False False xs
      | otherwise = x : go depth False False xs
takeJsonObject _ = Nothing

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
