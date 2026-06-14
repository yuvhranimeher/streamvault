-- INACTIVE SHADOW-ONLY ROUTE IMPLEMENTATION - NOT WIRED TO SERVER
-- This executable composes local adapter, response body, status/header, error
-- taxonomy, and final-readiness semantics over fixture data only. It does not
-- start a server, call the network, call FFmpeg, or register active HTTP routes.

module Main where

import Data.Char (isAlphaNum, isSpace)
import System.Environment (getArgs)
import System.Exit (die)

data Fixture = Fixture
  { fixtureId :: String
  , fixtureMethod :: String
  , fixtureRouteTarget :: String
  , fixturePlaybackId :: String
  , fixtureSourceType :: String
  , fixtureClientType :: String
  , fixturePlaybackMode :: String
  , fixtureStreamUrl :: String
  , fixtureBodyShape :: String
  , fixtureRange :: String
  , fixtureForceResponseBodyReject :: String
  , fixtureForceStatusHeaderReject :: String
  , fixtureForceInternalError :: String
  } deriving (Show)

main :: IO ()
main = do
  args <- getArgs
  path <- case args of
    [value] -> pure value
    _ -> die "Usage: InactivePlaybackRouteImplementationShadow <inactive-playback-route-implementation-shadow-fixtures.json>"
  raw <- readFile path
  fixtures <- case parseFixtures raw of
    Left err -> die err
    Right value -> pure value
  putStr (decisionsJson fixtures)

decisionsJson :: [Fixture] -> String
decisionsJson fixtures =
  "[\n" ++ joinWith ",\n" (map routeImplementationJson fixtures) ++ "\n]\n"

routeImplementationJson :: Fixture -> String
routeImplementationJson fixture =
  let adapterReason = adapterReasonCode fixture
      responseReason = responseReasonCode fixture adapterReason
      headerReason = statusHeaderReasonCode fixture responseReason
      finalReason = finalReasonCode fixture adapterReason responseReason headerReason
      accepted = finalReason == "OK" || finalReason == "PARTIAL_CONTENT"
      statusValue = if accepted then statusForSuccess fixture else taxonomyStatus finalReason
      finalBodyShape = if accepted then fixtureBodyShape fixture else "error-json"
      outputReason = if accepted then headerReason else finalReason
  in
    "  {\n"
      ++ field "fixtureId" (jsonString (fixtureId fixture)) True
      ++ field "routeDecision" (jsonString (if accepted then "accepted" else "rejected")) True
      ++ field "ok" (jsonBool accepted) True
      ++ field "status" (show statusValue) True
      ++ objectField "headers" (if accepted then headersJson (headersForShape fixture) else headersJson (errorHeaders finalReason)) True
      ++ objectField "body" (if accepted then responsePayloadJson fixture else errorBodyJson finalReason) True
      ++ field "bodyShape" (jsonString finalBodyShape) True
      ++ field "reasonCode" (jsonString outputReason) True
      ++ objectField "errorTaxonomy" (taxonomyJson finalReason) True
      ++ objectField "adapterDecision" (adapterDecisionJson fixture adapterReason) True
      ++ objectField "responseBodyDecision" (responseBodyDecisionJson fixture adapterReason responseReason) True
      ++ objectField "statusHeaderDecision" (statusHeaderDecisionJson fixture responseReason headerReason) True
      ++ objectField "safetyNotes" safetyNotesJson False
      ++ "  }"

adapterReasonCode :: Fixture -> String
adapterReasonCode fixture
  | not (fixtureRouteTarget fixture `elem` routeTargets) = "UNKNOWN_ROUTE"
  | not (fixtureMethod fixture `elem` methods) = "METHOD_NOT_ALLOWED"
  | null (fixturePlaybackId fixture) = "MISSING_ID"
  | not (validPlaybackId (fixturePlaybackId fixture)) = "MALFORMED_ID"
  | not (fixtureSourceType fixture `elem` sourceTypes) = "UNSUPPORTED_SOURCE_TYPE"
  | not (fixtureClientType fixture `elem` clientTypes) = "UNSUPPORTED_CLIENT_TYPE"
  | not (fixturePlaybackMode fixture `elem` playbackModes) = "UNSUPPORTED_PLAYBACK_MODE"
  | null (fixtureStreamUrl fixture) = "MISSING_SOURCE_URL"
  | not (safeStreamUrl (fixtureStreamUrl fixture)) = "UNSAFE_PLACEHOLDER_URL"
  | otherwise = "OK"

responseReasonCode :: Fixture -> String -> String
responseReasonCode fixture adapterReason
  | adapterReason /= "OK" = "ADAPTER_REJECTED"
  | fixtureForceResponseBodyReject fixture == "true" = "RESPONSE_BODY_REJECTED"
  | not (fixtureBodyShape fixture `elem` bodyShapes) = "UNSUPPORTED_BODY_SHAPE"
  | expectedBodyShape (fixtureRouteTarget fixture) /= fixtureBodyShape fixture = "UNSUPPORTED_BODY_SHAPE"
  | otherwise = "OK"

statusHeaderReasonCode :: Fixture -> String -> String
statusHeaderReasonCode fixture responseReason
  | responseReason /= "OK" = responseReason
  | fixtureForceStatusHeaderReject fixture == "true" = "STATUS_HEADER_REJECTED"
  | fixtureBodyShape fixture == "raw-bytes" && not (null (fixtureRange fixture)) = "PARTIAL_CONTENT"
  | otherwise = "OK"

finalReasonCode :: Fixture -> String -> String -> String -> String
finalReasonCode fixture adapterReason responseReason headerReason
  | fixtureForceInternalError fixture == "true" = "SHADOW_INTERNAL_SAFE_ERROR"
  | adapterReason /= "OK" = adapterReason
  | responseReason == "UNSUPPORTED_BODY_SHAPE" = "RESPONSE_BODY_REJECTED"
  | responseReason /= "OK" = responseReason
  | headerReason == "STATUS_HEADER_REJECTED" = "STATUS_HEADER_REJECTED"
  | otherwise = headerReason

adapterDecisionJson :: Fixture -> String -> String
adapterDecisionJson fixture reason =
  let accepted = reason == "OK"
  in
    "{\n"
      ++ nestedField "decision" (jsonString (if accepted then "accepted" else "rejected")) True
      ++ nestedField "ok" (jsonBool accepted) True
      ++ nestedField "routeTarget" (jsonString (fixtureRouteTarget fixture)) True
      ++ nestedField "playbackMode" (jsonString (if accepted then fixturePlaybackMode fixture else "invalid")) True
      ++ nestedField "requiresTranscode" (jsonBool (requiresTranscode fixture)) True
      ++ nestedField "shouldUseFfmpeg" (jsonBool (requiresTranscode fixture)) True
      ++ nestedField "reasonCode" (jsonString reason) True
      ++ nestedField "errorCode" (jsonString (if accepted then "" else taxonomyErrorCode reason)) False
      ++ "    }"

responseBodyDecisionJson :: Fixture -> String -> String -> String
responseBodyDecisionJson fixture adapterReason responseReason =
  let accepted = responseReason == "OK"
      skipped = adapterReason /= "OK"
      decisionValue = if accepted then "accepted" else if skipped then "skipped" else "rejected"
      statusValue = if accepted then statusForSuccess fixture else if skipped then 0 else taxonomyStatus responseReason
      errorCodeValue = if accepted then "" else if skipped then taxonomyErrorCode adapterReason else taxonomyErrorCode responseReason
  in
    "{\n"
      ++ nestedField "decision" (jsonString decisionValue) True
      ++ nestedField "ok" (jsonBool accepted) True
      ++ nestedField "responseShape" (jsonString (if accepted then fixtureBodyShape fixture else "error-json")) True
      ++ nestedField "statusCode" (show statusValue) True
      ++ nestedField "reasonCode" (jsonString responseReason) True
      ++ nestedField "errorCode" (jsonString errorCodeValue) True
      ++ objectNestedField "body" (if accepted then responsePayloadJson fixture else "{}") False
      ++ "    }"

statusHeaderDecisionJson :: Fixture -> String -> String -> String
statusHeaderDecisionJson fixture responseReason headerReason =
  let accepted = responseReason == "OK" && headerReason /= "STATUS_HEADER_REJECTED"
      skipped = responseReason /= "OK"
      decisionValue = if accepted then "accepted" else if skipped then "skipped" else "rejected"
      statusValue = if accepted then statusForSuccess fixture else if skipped then 0 else taxonomyStatus headerReason
      headerValue = if accepted then headersJson (headersForShape fixture) else if skipped then "{}" else headersJson (errorHeaders headerReason)
      bodyShapeValue = if accepted then fixtureBodyShape fixture else "error-json"
  in
    "{\n"
      ++ nestedField "decision" (jsonString decisionValue) True
      ++ nestedField "ok" (jsonBool accepted) True
      ++ nestedField "status" (show statusValue) True
      ++ objectNestedField "headers" headerValue True
      ++ nestedField "bodyShape" (jsonString bodyShapeValue) True
      ++ nestedField "reasonCode" (jsonString headerReason) False
      ++ "    }"

taxonomyJson :: String -> String
taxonomyJson reason =
  "{\n"
    ++ nestedField "ok" (jsonBool (taxonomyOk reason)) True
    ++ nestedField "status" (show (taxonomyStatus reason)) True
    ++ nestedField "errorCode" (jsonString (taxonomyErrorCode reason)) True
    ++ nestedField "errorCategory" (jsonString (taxonomyCategory reason)) True
    ++ nestedField "reasonCode" (jsonString reason) True
    ++ nestedField "userSafeMessage" (jsonString (taxonomyUserMessage reason)) True
    ++ nestedField "developerDetail" (jsonString (taxonomyDeveloperDetail reason)) True
    ++ nestedField "retryable" (jsonBool (taxonomyRetryable reason)) False
    ++ "    }"

responsePayloadJson :: Fixture -> String
responsePayloadJson fixture =
  case fixtureBodyShape fixture of
    "movie-json" ->
      "{\n"
        ++ bodyField "ok" "true" True
        ++ bodyField "streamUrl" (jsonString (fixtureStreamUrl fixture)) True
        ++ bodyField "sourceType" (jsonString (fixtureSourceType fixture)) True
        ++ bodyField "clientType" (jsonString (fixtureClientType fixture)) True
        ++ bodyField "playbackMode" (jsonString (fixturePlaybackMode fixture)) False
        ++ "    }"
    "ftp-json" ->
      "{\n"
        ++ bodyField "ok" "true" True
        ++ bodyField "src" (jsonString (fixtureStreamUrl fixture)) True
        ++ bodyField "mode" (jsonString (fixturePlaybackMode fixture)) True
        ++ bodyField "directPlayable" (jsonBool (fixturePlaybackMode fixture == "direct")) True
        ++ bodyField "decodedUrl" (jsonString (fixtureStreamUrl fixture)) False
        ++ "    }"
    "local-json" ->
      "{\n"
        ++ bodyField "ok" "true" True
        ++ bodyField "src" (jsonString (fixtureStreamUrl fixture)) True
        ++ bodyField "mode" (jsonString (fixturePlaybackMode fixture)) True
        ++ bodyField "directPlayable" "true" False
        ++ "    }"
    "raw-bytes" ->
      "{\n"
        ++ bodyField "status" (show (statusForSuccess fixture)) True
        ++ bodyField "contentType" (jsonString "video/mp4") True
        ++ bodyField "acceptRanges" (jsonString "bytes") True
        ++ bodyField "contentRange" (jsonString (contentRangeValue fixture)) True
        ++ bodyField "streamUrl" (jsonString (fixtureStreamUrl fixture)) False
        ++ "    }"
    "series-json" ->
      "{\n"
        ++ bodyField "ok" "true" True
        ++ bodyField "src" (jsonString (fixtureStreamUrl fixture)) True
        ++ bodyField "mode" (jsonString (fixturePlaybackMode fixture)) True
        ++ bodyField "sourceType" (jsonString "series") True
        ++ bodyField "streamUrl" (jsonString (fixtureStreamUrl fixture)) False
        ++ "    }"
    _ ->
      "{\n"
        ++ bodyField "ok" "true" True
        ++ bodyField "src" (jsonString (fixtureStreamUrl fixture)) True
        ++ bodyField "mode" (jsonString "live") True
        ++ bodyField "streamUrl" (jsonString (fixtureStreamUrl fixture)) True
        ++ bodyField "contentType" (jsonString "application/vnd.apple.mpegurl") False
        ++ "    }"

errorBodyJson :: String -> String
errorBodyJson reason =
  "{\n"
    ++ bodyField "ok" "false" True
    ++ bodyField "error" (jsonString (taxonomyErrorCode reason)) True
    ++ bodyField "reasonCode" (jsonString reason) True
    ++ bodyField "message" (jsonString (taxonomyUserMessage reason)) False
    ++ "    }"

headersForShape :: Fixture -> [(String, String)]
headersForShape fixture
  | fixtureBodyShape fixture == "raw-bytes" && not (null (fixtureRange fixture)) =
      [ ("accept-ranges", "bytes")
      , ("cache-control", "no-store")
      , ("content-range", contentRangeValue fixture)
      , ("content-type", "video/mp4")
      , ("x-streamvault-shadow", "inactive-route-implementation-shadow-v1")
      ]
  | fixtureBodyShape fixture == "raw-bytes" =
      [ ("accept-ranges", "bytes")
      , ("cache-control", "no-store")
      , ("content-type", "video/mp4")
      , ("x-streamvault-shadow", "inactive-route-implementation-shadow-v1")
      ]
  | fixtureBodyShape fixture == "live-hls" =
      implementationHeaders "application/vnd.apple.mpegurl"
  | otherwise =
      implementationHeaders "application/json; charset=utf-8"

errorHeaders :: String -> [(String, String)]
errorHeaders "METHOD_NOT_ALLOWED" =
  [ ("allow", "GET, POST")
  , ("cache-control", "no-store")
  , ("content-type", "application/json; charset=utf-8")
  , ("x-streamvault-shadow", "inactive-route-implementation-shadow-v1")
  ]
errorHeaders _ = implementationHeaders "application/json; charset=utf-8"

implementationHeaders :: String -> [(String, String)]
implementationHeaders contentType =
  [ ("cache-control", "no-store")
  , ("content-type", contentType)
  , ("x-streamvault-shadow", "inactive-route-implementation-shadow-v1")
  ]

headersJson :: [(String, String)] -> String
headersJson headersValue =
  "{\n"
    ++ joinWith ",\n" (map headerField headersValue)
    ++ "\n    }"

headerField :: (String, String) -> String
headerField (name, value) =
  "      " ++ jsonString name ++ ": " ++ jsonString value

safetyNotesJson :: String
safetyNotesJson =
  "[\n"
    ++ "    \"shadow-only\",\n"
    ++ "    \"fixture-only\",\n"
    ++ "    \"no-server\",\n"
    ++ "    \"no-network\",\n"
    ++ "    \"no-ffmpeg\",\n"
    ++ "    \"no-active-runtime-wiring\",\n"
    ++ "    \"no-live-url-activation\"\n"
    ++ "  ]"

taxonomyOk :: String -> Bool
taxonomyOk "OK" = True
taxonomyOk "PARTIAL_CONTENT" = True
taxonomyOk _ = False

taxonomyStatus :: String -> Int
taxonomyStatus "OK" = 200
taxonomyStatus "PARTIAL_CONTENT" = 206
taxonomyStatus "UNKNOWN_ROUTE" = 404
taxonomyStatus "METHOD_NOT_ALLOWED" = 405
taxonomyStatus "MISSING_ID" = 400
taxonomyStatus "MALFORMED_ID" = 400
taxonomyStatus "UNSUPPORTED_SOURCE_TYPE" = 422
taxonomyStatus "UNSUPPORTED_CLIENT_TYPE" = 422
taxonomyStatus "UNSUPPORTED_PLAYBACK_MODE" = 422
taxonomyStatus "UNSUPPORTED_BODY_SHAPE" = 422
taxonomyStatus "MISSING_SOURCE_URL" = 400
taxonomyStatus "UNSAFE_PLACEHOLDER_URL" = 400
taxonomyStatus "RESPONSE_BODY_REJECTED" = 502
taxonomyStatus "STATUS_HEADER_REJECTED" = 502
taxonomyStatus _ = 500

taxonomyErrorCode :: String -> String
taxonomyErrorCode "OK" = ""
taxonomyErrorCode "PARTIAL_CONTENT" = ""
taxonomyErrorCode "UNKNOWN_ROUTE" = "PLAYBACK_ROUTE_NOT_FOUND"
taxonomyErrorCode "METHOD_NOT_ALLOWED" = "PLAYBACK_ROUTE_METHOD_NOT_ALLOWED"
taxonomyErrorCode "UNSAFE_PLACEHOLDER_URL" = "PLAYBACK_ROUTE_UNSAFE_URL"
taxonomyErrorCode "RESPONSE_BODY_REJECTED" = "PLAYBACK_ROUTE_BODY_REJECTED"
taxonomyErrorCode "STATUS_HEADER_REJECTED" = "PLAYBACK_ROUTE_HEADER_REJECTED"
taxonomyErrorCode "SHADOW_INTERNAL_SAFE_ERROR" = "PLAYBACK_ROUTE_SHADOW_INTERNAL_ERROR"
taxonomyErrorCode _ = "PLAYBACK_ROUTE_VALIDATION_ERROR"

taxonomyCategory :: String -> String
taxonomyCategory "OK" = ""
taxonomyCategory "PARTIAL_CONTENT" = ""
taxonomyCategory "UNKNOWN_ROUTE" = "NOT_FOUND"
taxonomyCategory "METHOD_NOT_ALLOWED" = "METHOD_NOT_ALLOWED"
taxonomyCategory "UNSAFE_PLACEHOLDER_URL" = "UNSAFE_URL"
taxonomyCategory "RESPONSE_BODY_REJECTED" = "BODY_REJECTED"
taxonomyCategory "STATUS_HEADER_REJECTED" = "HEADER_REJECTED"
taxonomyCategory "SHADOW_INTERNAL_SAFE_ERROR" = "SHADOW_INTERNAL_ERROR"
taxonomyCategory _ = "VALIDATION_ERROR"

taxonomyUserMessage :: String -> String
taxonomyUserMessage "OK" = ""
taxonomyUserMessage "PARTIAL_CONTENT" = ""
taxonomyUserMessage "UNKNOWN_ROUTE" = "Playback route was not found."
taxonomyUserMessage "METHOD_NOT_ALLOWED" = "Playback request method is not allowed."
taxonomyUserMessage "RESPONSE_BODY_REJECTED" = "Playback response could not be prepared."
taxonomyUserMessage "STATUS_HEADER_REJECTED" = "Playback response could not be prepared."
taxonomyUserMessage "UNSAFE_PLACEHOLDER_URL" = "Playback source is not allowed."
taxonomyUserMessage "SHADOW_INTERNAL_SAFE_ERROR" = "Playback is temporarily unavailable."
taxonomyUserMessage "MISSING_SOURCE_URL" = "Playback request is missing required information."
taxonomyUserMessage "MISSING_ID" = "Playback request is missing required information."
taxonomyUserMessage "MALFORMED_ID" = "Playback request is missing required information."
taxonomyUserMessage _ = "Playback request is not supported."

taxonomyDeveloperDetail :: String -> String
taxonomyDeveloperDetail "OK" = ""
taxonomyDeveloperDetail "PARTIAL_CONTENT" = ""
taxonomyDeveloperDetail "UNKNOWN_ROUTE" = "Route target is not part of the inactive playback route implementation shadow."
taxonomyDeveloperDetail "METHOD_NOT_ALLOWED" = "Inactive route implementation shadow allows only GET and POST methods."
taxonomyDeveloperDetail "MISSING_ID" = "Missing playback id before inactive route composition."
taxonomyDeveloperDetail "MALFORMED_ID" = "Playback id contains unsupported characters."
taxonomyDeveloperDetail "UNSUPPORTED_SOURCE_TYPE" = "Source type is outside the inactive route implementation allowlist."
taxonomyDeveloperDetail "UNSUPPORTED_CLIENT_TYPE" = "Client type is outside the inactive route implementation allowlist."
taxonomyDeveloperDetail "UNSUPPORTED_PLAYBACK_MODE" = "Playback mode is outside the inactive route implementation allowlist."
taxonomyDeveloperDetail "UNSUPPORTED_BODY_SHAPE" = "Response body shape is outside the inactive implementation allowlist."
taxonomyDeveloperDetail "MISSING_SOURCE_URL" = "Missing source URL before inactive route composition."
taxonomyDeveloperDetail "UNSAFE_PLACEHOLDER_URL" = "Unsafe placeholder stream URL was rejected before any active playback."
taxonomyDeveloperDetail "RESPONSE_BODY_REJECTED" = "Response body shadow rejected the composed fixture envelope."
taxonomyDeveloperDetail "STATUS_HEADER_REJECTED" = "Status/header shadow rejected the composed fixture envelope."
taxonomyDeveloperDetail _ = "Shadow-only internal error fixture uses sanitized detail."

taxonomyRetryable :: String -> Bool
taxonomyRetryable "RESPONSE_BODY_REJECTED" = True
taxonomyRetryable "STATUS_HEADER_REJECTED" = True
taxonomyRetryable "SHADOW_INTERNAL_SAFE_ERROR" = True
taxonomyRetryable _ = False

statusForSuccess :: Fixture -> Int
statusForSuccess fixture =
  if fixtureBodyShape fixture == "raw-bytes" && not (null (fixtureRange fixture))
    then 206
    else 200

contentRangeValue :: Fixture -> String
contentRangeValue fixture =
  if null (fixtureRange fixture) then "" else fixtureRange fixture ++ "/*"

requiresTranscode :: Fixture -> Bool
requiresTranscode fixture =
  fixtureClientType fixture == "mobile" && fixturePlaybackMode fixture == "hls"

expectedBodyShape :: String -> String
expectedBodyShape "/api/playback/movie" = "movie-json"
expectedBodyShape "/api/playback/ftp" = "ftp-json"
expectedBodyShape "/api/playback/local" = "local-json"
expectedBodyShape "/api/ftp/raw" = "raw-bytes"
expectedBodyShape "series episode playback" = "series-json"
expectedBodyShape "live TV m3u8 playback" = "live-hls"
expectedBodyShape _ = ""

routeTargets :: [String]
routeTargets =
  [ "/api/playback/movie"
  , "/api/playback/ftp"
  , "/api/playback/local"
  , "/api/ftp/raw"
  , "series episode playback"
  , "live TV m3u8 playback"
  ]

methods :: [String]
methods = ["GET", "POST"]

sourceTypes :: [String]
sourceTypes = ["movie", "series", "live"]

clientTypes :: [String]
clientTypes = ["desktop", "mobile"]

playbackModes :: [String]
playbackModes = ["direct", "hls", "live"]

bodyShapes :: [String]
bodyShapes = ["movie-json", "ftp-json", "local-json", "raw-bytes", "series-json", "live-hls"]

validPlaybackId :: String -> Bool
validPlaybackId value =
  not (null value) && all validChar value
  where
    validChar c = isAlphaNum c || c `elem` (".-_" :: String)

safeStreamUrl :: String -> Bool
safeStreamUrl value
  | "local://" `prefixOf` value = True
  | "http://" `prefixOf` value = hostEndsWithExampleTest "http://" value
  | "https://" `prefixOf` value = hostEndsWithExampleTest "https://" value
  | "ftp://" `prefixOf` value = hostEndsWithExampleTest "ftp://" value
  | otherwise = False

hostEndsWithExampleTest :: String -> String -> Bool
hostEndsWithExampleTest scheme value =
  let host = takeWhile (/= '/') (drop (length scheme) value)
  in ".example.test" `suffixOf` host

field :: String -> String -> Bool -> String
field name value comma =
  "    " ++ jsonString name ++ ": " ++ value ++ if comma then ",\n" else "\n"

objectField :: String -> String -> Bool -> String
objectField name value comma =
  "    " ++ jsonString name ++ ": " ++ value ++ if comma then ",\n" else "\n"

nestedField :: String -> String -> Bool -> String
nestedField name value comma =
  "      " ++ jsonString name ++ ": " ++ value ++ if comma then ",\n" else "\n"

objectNestedField :: String -> String -> Bool -> String
objectNestedField name value comma =
  "      " ++ jsonString name ++ ": " ++ value ++ if comma then ",\n" else "\n"

bodyField :: String -> String -> Bool -> String
bodyField name value comma =
  "      " ++ jsonString name ++ ": " ++ value ++ if comma then ",\n" else "\n"

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
       then Left "No implementation shadow fixture objects found"
       else traverse parseFixture objects

parseFixture :: String -> Either String Fixture
parseFixture object = do
  parsedFixtureId <- requiredString "fixtureId" object
  method <- requiredString "method" object
  routeTarget <- requiredString "routeTarget" object
  playbackId <- requiredString "playbackId" object
  sourceType <- requiredString "sourceType" object
  clientType <- requiredString "clientType" object
  playbackMode <- requiredString "playbackMode" object
  streamUrl <- requiredString "streamUrl" object
  bodyShape <- requiredString "bodyShape" object
  rangeValue <- requiredString "range" object
  forceResponse <- requiredString "forceResponseBodyReject" object
  forceStatus <- requiredString "forceStatusHeaderReject" object
  forceInternal <- requiredString "forceInternalError" object
  pure Fixture
    { fixtureId = parsedFixtureId
    , fixtureMethod = method
    , fixtureRouteTarget = routeTarget
    , fixturePlaybackId = playbackId
    , fixtureSourceType = sourceType
    , fixtureClientType = clientType
    , fixturePlaybackMode = playbackMode
    , fixtureStreamUrl = streamUrl
    , fixtureBodyShape = bodyShape
    , fixtureRange = rangeValue
    , fixtureForceResponseBodyReject = forceResponse
    , fixtureForceStatusHeaderReject = forceStatus
    , fixtureForceInternalError = forceInternal
    }

requiredString :: String -> String -> Either String String
requiredString key object =
  case findStringField key object of
    Just value -> Right value
    Nothing -> Left ("Missing string field: " ++ key)

findStringField :: String -> String -> Maybe String
findStringField key object = do
  rest <- fieldRest key object
  value <- parseJsonString (dropWhile isSpace rest)
  Just value

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

suffixOf :: String -> String -> Bool
suffixOf suffix value = reverse suffix `prefixOf` reverse value

joinWith :: String -> [String] -> String
joinWith _ [] = ""
joinWith _ [x] = x
joinWith separator (x:xs) = x ++ separator ++ joinWith separator xs
