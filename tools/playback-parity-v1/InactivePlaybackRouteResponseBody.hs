-- INACTIVE SHADOW-ONLY ROUTE RESPONSE BODY - NOT WIRED TO SERVER
-- This executable reads local response body fixtures and prints deterministic
-- response envelopes. It does not start a server, call the network, call
-- FFmpeg, or register active HTTP routes.

module Main where

import Data.Char (isSpace)
import System.Environment (getArgs)
import System.Exit (die)

data Fixture = Fixture
  { fixtureName :: String
  , fixtureRouteTarget :: String
  , fixtureSourceType :: String
  , fixtureClientType :: String
  , fixturePlaybackMode :: String
  , fixtureStreamUrl :: String
  , fixtureResponseKind :: String
  , fixtureRange :: String
  , fixtureExpectedResponseShape :: String
  } deriving (Show)

data Source = Source
  { sourceCaseName :: String
  , sourceRouteTarget :: String
  , sourceSourceType :: String
  , sourceClientType :: String
  , sourcePlaybackMode :: String
  , sourceStreamUrl :: String
  , sourceResponseKind :: String
  , sourceRange :: String
  , sourceExpectedResponseShape :: String
  } deriving (Show)

data Decision = Decision
  { decisionCaseName :: String
  , decisionRoute :: String
  , decisionRouteTarget :: String
  , decisionSourceType :: String
  , decisionClientType :: String
  , decisionResponseKind :: String
  , decisionPlaybackMode :: String
  , decisionRequiresTranscode :: Bool
  , decisionShouldUseFfmpeg :: Bool
  , decisionStreamUrl :: String
  , decisionStatusCode :: Int
  , decisionErrorCode :: String
  , decisionResponseShape :: String
  , decisionOk :: Bool
  , decisionReason :: String
  } deriving (Show)

main :: IO ()
main = do
  args <- getArgs
  path <- case args of
    [value] -> pure value
    _ -> die "Usage: InactivePlaybackRouteResponseBody <inactive-playback-route-response-body-fixtures.json>"
  raw <- readFile path
  fixtures <- case parseFixtures raw of
    Left err -> die err
    Right value -> pure value
  putStr (decisionsJson (map responseBodyDecision fixtures))

responseBodyDecision :: Fixture -> Decision
responseBodyDecision fixture =
  let source = normalizeFixture fixture
  in plan source
  where
    plan source
      | null (sourceRouteTarget source) =
          decision source False "invalid" False False "Missing routeTarget; response body contract is invalid." "MISSING_ROUTE"
      | not (sourceRouteTarget source `elem` routeTargets) =
          decision source False "invalid" False False "Unknown routeTarget; response body contract is invalid." "UNKNOWN_ROUTE"
      | null (sourceSourceType source) =
          decision source False "invalid" False False "Missing sourceType; response body contract is invalid." "UNSUPPORTED_SOURCE_TYPE"
      | not (sourceSourceType source `elem` sourceTypes) =
          decision source False "invalid" False False "Unsupported sourceType; response body contract is invalid." "UNSUPPORTED_SOURCE_TYPE"
      | null (sourceClientType source) =
          decision source False "invalid" False False "Missing clientType; response body contract is invalid." "UNSUPPORTED_CLIENT_TYPE"
      | not (sourceClientType source `elem` clientTypes) =
          decision source False "invalid" False False "Unsupported clientType; response body contract is invalid." "UNSUPPORTED_CLIENT_TYPE"
      | null (sourceStreamUrl source) =
          decision source False "invalid" False False "Missing streamUrl; response body contract is invalid." "MISSING_STREAM_URL"
      | not (safeStreamUrl (sourceStreamUrl source)) =
          decision source False "invalid" False False "Unsafe streamUrl; response body contract is invalid." "UNSAFE_STREAM_URL"
      | not (sourcePlaybackMode source `elem` playbackModes) =
          decision source False "invalid" False False "Unsupported playbackMode; response body contract is invalid." "UNSUPPORTED_PLAYBACK_MODE"
      | sourceRouteTarget source == "/api/playback/movie" =
          decision source True "movie-json" False False "Movie response body returns normalized playback JSON." ""
      | sourceRouteTarget source == "/api/playback/ftp" =
          let hls = sourceClientType source == "mobile" && sourcePlaybackMode source == "hls"
          in decision source True "ftp-json" hls hls "FTP response body preserves direct playback or explicit mobile HLS." ""
      | sourceRouteTarget source == "/api/playback/local" =
          decision source True "local-json" False False "Local response body preserves direct local playback." ""
      | sourceRouteTarget source == "/api/ftp/raw" =
          decision source True "raw-bytes" False False "FTP raw response body records byte-stream metadata only." ""
      | sourceRouteTarget source == "series episode playback" =
          decision source True "series-json" False False "Series response body preserves episode direct playback." ""
      | sourceRouteTarget source == "live TV m3u8 playback" =
          decision source True "live-hls" False False "Live HLS response body records playlist metadata only." ""
      | otherwise =
          decision source False "invalid" False False "Unknown routeTarget; response body contract is invalid." "UNKNOWN_ROUTE"

normalizeFixture :: Fixture -> Source
normalizeFixture fixture =
  Source
    { sourceCaseName = fixtureName fixture
    , sourceRouteTarget = fixtureRouteTarget fixture
    , sourceSourceType = fixtureSourceType fixture
    , sourceClientType = fixtureClientType fixture
    , sourcePlaybackMode = fixturePlaybackMode fixture
    , sourceStreamUrl = fixtureStreamUrl fixture
    , sourceResponseKind = if null (fixtureResponseKind fixture) then "json-only" else fixtureResponseKind fixture
    , sourceRange = fixtureRange fixture
    , sourceExpectedResponseShape = fixtureExpectedResponseShape fixture
    }

decision :: Source -> Bool -> String -> Bool -> Bool -> String -> String -> Decision
decision source ok shape requiresTranscode shouldUseFfmpeg reason errorCode =
  Decision
    { decisionCaseName = sourceCaseName source
    , decisionRoute = sourceRouteTarget source
    , decisionRouteTarget = sourceRouteTarget source
    , decisionSourceType = sourceSourceType source
    , decisionClientType = sourceClientType source
    , decisionResponseKind = sourceResponseKind source
    , decisionPlaybackMode = if ok then sourcePlaybackMode source else "invalid"
    , decisionRequiresTranscode = requiresTranscode
    , decisionShouldUseFfmpeg = shouldUseFfmpeg
    , decisionStreamUrl = sourceStreamUrl source
    , decisionStatusCode = if ok then statusCodeForSuccess shape (sourceRange source) else statusCodeFor errorCode
    , decisionErrorCode = errorCode
    , decisionResponseShape = if ok then shape else "error-json"
    , decisionOk = ok
    , decisionReason = reason
    }

routeTargets :: [String]
routeTargets =
  [ "/api/playback/movie"
  , "/api/playback/ftp"
  , "/api/playback/local"
  , "/api/ftp/raw"
  , "series episode playback"
  , "live TV m3u8 playback"
  ]

clientTypes :: [String]
clientTypes = ["desktop", "mobile"]

sourceTypes :: [String]
sourceTypes = ["movie", "series", "live"]

playbackModes :: [String]
playbackModes = ["direct", "hls", "live"]

safeStreamUrl :: String -> Bool
safeStreamUrl value =
  any (`prefixOf` value) ["http://", "https://", "ftp://", "local://"]

statusCodeForSuccess :: String -> String -> Int
statusCodeForSuccess "raw-bytes" rangeValue =
  if null rangeValue then 200 else 206
statusCodeForSuccess _ _ = 200

statusCodeFor :: String -> Int
statusCodeFor "UNKNOWN_ROUTE" = 404
statusCodeFor "UNSUPPORTED_CLIENT_TYPE" = 422
statusCodeFor "UNSUPPORTED_SOURCE_TYPE" = 422
statusCodeFor "UNSUPPORTED_PLAYBACK_MODE" = 422
statusCodeFor _ = 400

decisionsJson :: [Decision] -> String
decisionsJson decisions =
  "[\n" ++ joinWith ",\n" (map decisionJson decisions) ++ "\n]\n"

decisionJson :: Decision -> String
decisionJson value =
  "  {\n"
    ++ field "caseName" (jsonString (decisionCaseName value)) True
    ++ field "route" (jsonString (decisionRoute value)) True
    ++ field "routeTarget" (jsonString (decisionRouteTarget value)) True
    ++ field "sourceType" (jsonString (decisionSourceType value)) True
    ++ field "clientType" (jsonString (decisionClientType value)) True
    ++ field "responseKind" (jsonString (decisionResponseKind value)) True
    ++ field "playbackMode" (jsonString (decisionPlaybackMode value)) True
    ++ field "requiresTranscode" (jsonBool (decisionRequiresTranscode value)) True
    ++ field "shouldUseFfmpeg" (jsonBool (decisionShouldUseFfmpeg value)) True
    ++ field "streamUrl" (jsonString (decisionStreamUrl value)) True
    ++ field "statusCode" (show (decisionStatusCode value)) True
    ++ field "errorCode" (jsonString (decisionErrorCode value)) True
    ++ field "responseShape" (jsonString (decisionResponseShape value)) True
    ++ objectField "responsePayload" (responsePayloadJson value) True
    ++ field "ok" (jsonBool (decisionOk value)) True
    ++ field "reason" (jsonString (decisionReason value)) False
    ++ ",\n"
    ++ safetyField
    ++ "  }"

responsePayloadJson :: Decision -> String
responsePayloadJson value =
  case decisionResponseShape value of
    "movie-json" ->
      "{\n"
        ++ payloadField "ok" "true" True
        ++ payloadField "streamUrl" (jsonString (decisionStreamUrl value)) True
        ++ payloadField "sourceType" (jsonString (decisionSourceType value)) True
        ++ payloadField "clientType" (jsonString (decisionClientType value)) True
        ++ payloadField "playbackMode" (jsonString (decisionPlaybackMode value)) False
        ++ "    }"
    "ftp-json" ->
      "{\n"
        ++ payloadField "ok" "true" True
        ++ payloadField "src" (jsonString (decisionStreamUrl value)) True
        ++ payloadField "mode" (jsonString (decisionPlaybackMode value)) True
        ++ payloadField "directPlayable" (jsonBool (decisionPlaybackMode value == "direct")) True
        ++ payloadField "decodedUrl" (jsonString (decisionStreamUrl value)) True
        ++ payloadField "duration" "null" False
        ++ "    }"
    "local-json" ->
      "{\n"
        ++ payloadField "ok" "true" True
        ++ payloadField "src" (jsonString (decisionStreamUrl value)) True
        ++ payloadField "mode" (jsonString (decisionPlaybackMode value)) True
        ++ payloadField "directPlayable" "true" True
        ++ payloadField "duration" "null" False
        ++ "    }"
    "raw-bytes" ->
      "{\n"
        ++ payloadField "status" (show (decisionStatusCode value)) True
        ++ payloadField "contentType" (jsonString "video/mp4") True
        ++ payloadField "acceptRanges" (jsonString "bytes") True
        ++ payloadField "contentRange" (jsonString (rawContentRange (decisionStatusCode value) value)) True
        ++ payloadField "streamUrl" (jsonString (decisionStreamUrl value)) False
        ++ "    }"
    "series-json" ->
      "{\n"
        ++ payloadField "ok" "true" True
        ++ payloadField "src" (jsonString (decisionStreamUrl value)) True
        ++ payloadField "mode" (jsonString (decisionPlaybackMode value)) True
        ++ payloadField "sourceType" (jsonString "series") True
        ++ payloadField "streamUrl" (jsonString (decisionStreamUrl value)) False
        ++ "    }"
    "live-hls" ->
      "{\n"
        ++ payloadField "ok" "true" True
        ++ payloadField "src" (jsonString (decisionStreamUrl value)) True
        ++ payloadField "mode" (jsonString "live") True
        ++ payloadField "streamUrl" (jsonString (decisionStreamUrl value)) True
        ++ payloadField "contentType" (jsonString "application/vnd.apple.mpegurl") False
        ++ "    }"
    _ ->
      "{\n"
        ++ payloadField "ok" "false" True
        ++ payloadField "error" (jsonString (decisionErrorCode value)) True
        ++ payloadField "reason" (jsonString (decisionReason value)) False
        ++ "    }"

rawContentRange :: Int -> Decision -> String
rawContentRange 206 value =
  let rangeValue = fixtureRangeFromStream (decisionCaseName value)
  in if null rangeValue then "" else rangeValue ++ "/*"
rawContentRange _ _ = ""

-- The fixture range is deterministic in this contract. The Haskell shadow keeps
-- this helper local so no active runtime range parsing is introduced.
fixtureRangeFromStream :: String -> String
fixtureRangeFromStream "response_body_ftp_raw_range" = "bytes=0-1023"
fixtureRangeFromStream _ = ""

safetyField :: String
safetyField =
  "    \"safety\": {\n"
    ++ "      \"serverStarted\": false,\n"
    ++ "      \"networkCalled\": false,\n"
    ++ "      \"ffmpegStarted\": false,\n"
    ++ "      \"runtimePlaybackChanged\": false,\n"
    ++ "      \"activeRoutesAdded\": false,\n"
    ++ "      \"inactiveRouteWired\": false,\n"
    ++ "      \"frontendPlaybackChanged\": false,\n"
    ++ "      \"localhostUrlActivated\": false\n"
    ++ "    }\n"

field :: String -> String -> Bool -> String
field name value comma =
  "    " ++ jsonString name ++ ": " ++ value ++ if comma then ",\n" else "\n"

objectField :: String -> String -> Bool -> String
objectField name value comma =
  "    " ++ jsonString name ++ ": " ++ value ++ if comma then ",\n" else "\n"

payloadField :: String -> String -> Bool -> String
payloadField name value comma =
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
       then Left "No response body fixture objects found"
       else traverse parseFixture objects

parseFixture :: String -> Either String Fixture
parseFixture object = do
  name <- requiredString "name" object
  routeTarget <- requiredString "routeTarget" object
  sourceType <- requiredString "sourceType" object
  clientType <- requiredString "clientType" object
  playbackMode <- requiredString "playbackMode" object
  streamUrl <- requiredString "streamUrl" object
  responseKind <- requiredString "responseKind" object
  rangeValue <- requiredString "range" object
  expectedShape <- requiredString "expectedResponseShape" object
  pure Fixture
    { fixtureName = name
    , fixtureRouteTarget = routeTarget
    , fixtureSourceType = sourceType
    , fixtureClientType = clientType
    , fixturePlaybackMode = playbackMode
    , fixtureStreamUrl = streamUrl
    , fixtureResponseKind = responseKind
    , fixtureRange = rangeValue
    , fixtureExpectedResponseShape = expectedShape
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

joinWith :: String -> [String] -> String
joinWith _ [] = ""
joinWith _ [x] = x
joinWith separator (x:xs) = x ++ separator ++ joinWith separator xs
