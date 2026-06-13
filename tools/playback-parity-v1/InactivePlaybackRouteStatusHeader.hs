-- INACTIVE SHADOW-ONLY ROUTE STATUS HEADER - NOT WIRED TO SERVER
-- This executable reads local status/header fixtures and prints deterministic
-- response metadata envelopes. It does not start a server, call the network,
-- call FFmpeg, or register active HTTP routes.

module Main where

import Data.Char (isAlphaNum, isSpace, toUpper)
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
  , fixtureAdapterDecision :: String
  , fixtureResponseBodyDecision :: String
  , fixtureBodyShape :: String
  , fixtureRange :: String
  } deriving (Show)

data Source = Source
  { sourceFixtureId :: String
  , sourceMethod :: String
  , sourceRouteTarget :: String
  , sourcePlaybackId :: String
  , sourceSourceType :: String
  , sourceClientType :: String
  , sourcePlaybackMode :: String
  , sourceStreamUrl :: String
  , sourceAdapterDecision :: String
  , sourceResponseBodyDecision :: String
  , sourceBodyShape :: String
  , sourceRange :: String
  } deriving (Show)

data Decision = Decision
  { decisionFixtureId :: String
  , decisionDecision :: String
  , decisionStatus :: Int
  , decisionHeaders :: [(String, String)]
  , decisionBodyShape :: String
  , decisionReasonCode :: String
  } deriving (Show)

main :: IO ()
main = do
  args <- getArgs
  path <- case args of
    [value] -> pure value
    _ -> die "Usage: InactivePlaybackRouteStatusHeader <inactive-playback-route-status-header-fixtures.json>"
  raw <- readFile path
  fixtures <- case parseFixtures raw of
    Left err -> die err
    Right value -> pure value
  putStr (decisionsJson (map statusHeaderDecision fixtures))

statusHeaderDecision :: Fixture -> Decision
statusHeaderDecision fixture =
  let source = normalizeFixture fixture
  in case rejectionReason source of
       Just reason ->
         envelope source "rejected" (statusForReason reason) (errorHeaders reason) "error-json" reason
       Nothing ->
         let reason = if sourceBodyShape source == "raw-bytes" && not (null (sourceRange source))
                        then "PARTIAL_CONTENT"
                        else "OK"
         in envelope source "accepted" (statusForReason reason) (headersForShape (sourceBodyShape source) (sourceRange source)) (sourceBodyShape source) reason

normalizeFixture :: Fixture -> Source
normalizeFixture fixture =
  Source
    { sourceFixtureId = fixtureId fixture
    , sourceMethod = map toUpper (fixtureMethod fixture)
    , sourceRouteTarget = fixtureRouteTarget fixture
    , sourcePlaybackId = fixturePlaybackId fixture
    , sourceSourceType = fixtureSourceType fixture
    , sourceClientType = fixtureClientType fixture
    , sourcePlaybackMode = fixturePlaybackMode fixture
    , sourceStreamUrl = fixtureStreamUrl fixture
    , sourceAdapterDecision = if null (fixtureAdapterDecision fixture) then "accepted" else fixtureAdapterDecision fixture
    , sourceResponseBodyDecision = if null (fixtureResponseBodyDecision fixture) then "accepted" else fixtureResponseBodyDecision fixture
    , sourceBodyShape = fixtureBodyShape fixture
    , sourceRange = fixtureRange fixture
    }

rejectionReason :: Source -> Maybe String
rejectionReason source
  | null (sourceRouteTarget source) = Just "MISSING_ROUTE"
  | not (sourceRouteTarget source `elem` routeTargets) = Just "UNKNOWN_ROUTE"
  | not (sourceMethod source `elem` methods) = Just "UNSUPPORTED_METHOD"
  | null (sourcePlaybackId source) = Just "MISSING_ID"
  | not (validPlaybackId (sourcePlaybackId source)) = Just "MALFORMED_ID"
  | null (sourceSourceType source) || not (sourceSourceType source `elem` sourceTypes) = Just "UNSUPPORTED_SOURCE_TYPE"
  | null (sourceClientType source) || not (sourceClientType source `elem` clientTypes) = Just "UNSUPPORTED_CLIENT_TYPE"
  | null (sourcePlaybackMode source) || not (sourcePlaybackMode source `elem` playbackModes) = Just "UNSUPPORTED_PLAYBACK_MODE"
  | null (sourceStreamUrl source) = Just "MISSING_STREAM_URL"
  | not (safeStreamUrl (sourceStreamUrl source)) = Just "UNSAFE_STREAM_URL"
  | sourceAdapterDecision source /= "accepted" = Just "ADAPTER_DENIED"
  | sourceResponseBodyDecision source /= "accepted" = Just "RESPONSE_BODY_DENIED"
  | not (sourceBodyShape source `elem` bodyShapes) = Just "UNSUPPORTED_BODY_SHAPE"
  | otherwise = Nothing

envelope :: Source -> String -> Int -> [(String, String)] -> String -> String -> Decision
envelope source decisionValue statusValue headersValue bodyShapeValue reasonCodeValue =
  Decision
    { decisionFixtureId = sourceFixtureId source
    , decisionDecision = decisionValue
    , decisionStatus = statusValue
    , decisionHeaders = headersValue
    , decisionBodyShape = bodyShapeValue
    , decisionReasonCode = reasonCodeValue
    }

headersForShape :: String -> String -> [(String, String)]
headersForShape "raw-bytes" rangeValue =
  if null rangeValue
    then
      [ ("accept-ranges", "bytes")
      , ("cache-control", "no-store")
      , ("content-type", "video/mp4")
      , ("x-streamvault-shadow", "inactive-route-status-header-v1")
      ]
    else
      [ ("accept-ranges", "bytes")
      , ("cache-control", "no-store")
      , ("content-range", rangeValue ++ "/*")
      , ("content-type", "video/mp4")
      , ("x-streamvault-shadow", "inactive-route-status-header-v1")
      ]
headersForShape "live-hls" _ =
  [ ("cache-control", "no-store")
  , ("content-type", "application/vnd.apple.mpegurl")
  , ("x-streamvault-shadow", "inactive-route-status-header-v1")
  ]
headersForShape _ _ = jsonHeaders

errorHeaders :: String -> [(String, String)]
errorHeaders "UNSUPPORTED_METHOD" =
  [ ("allow", "GET, POST")
  , ("cache-control", "no-store")
  , ("content-type", "application/json; charset=utf-8")
  , ("x-streamvault-shadow", "inactive-route-status-header-v1")
  ]
errorHeaders _ = jsonHeaders

jsonHeaders :: [(String, String)]
jsonHeaders =
  [ ("cache-control", "no-store")
  , ("content-type", "application/json; charset=utf-8")
  , ("x-streamvault-shadow", "inactive-route-status-header-v1")
  ]

statusForReason :: String -> Int
statusForReason "OK" = 200
statusForReason "PARTIAL_CONTENT" = 206
statusForReason "MISSING_ROUTE" = 404
statusForReason "UNKNOWN_ROUTE" = 404
statusForReason "UNSUPPORTED_METHOD" = 405
statusForReason "ADAPTER_DENIED" = 403
statusForReason "RESPONSE_BODY_DENIED" = 502
statusForReason "UNSUPPORTED_SOURCE_TYPE" = 422
statusForReason "UNSUPPORTED_CLIENT_TYPE" = 422
statusForReason "UNSUPPORTED_PLAYBACK_MODE" = 422
statusForReason "UNSUPPORTED_BODY_SHAPE" = 422
statusForReason _ = 400

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

clientTypes :: [String]
clientTypes = ["desktop", "mobile"]

sourceTypes :: [String]
sourceTypes = ["movie", "series", "live"]

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

decisionsJson :: [Decision] -> String
decisionsJson decisions =
  "[\n" ++ joinWith ",\n" (map decisionJson decisions) ++ "\n]\n"

decisionJson :: Decision -> String
decisionJson value =
  "  {\n"
    ++ field "fixtureId" (jsonString (decisionFixtureId value)) True
    ++ field "decision" (jsonString (decisionDecision value)) True
    ++ field "status" (show (decisionStatus value)) True
    ++ objectField "headers" (headersJson (decisionHeaders value)) True
    ++ field "bodyShape" (jsonString (decisionBodyShape value)) True
    ++ field "reasonCode" (jsonString (decisionReasonCode value)) True
    ++ objectField "safetyNotes" safetyNotesJson False
    ++ "  }"

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
    ++ "      \"shadow-only\",\n"
    ++ "      \"no-server\",\n"
    ++ "      \"no-network\",\n"
    ++ "      \"no-ffmpeg\",\n"
    ++ "      \"no-active-runtime-wiring\"\n"
    ++ "    ]"

field :: String -> String -> Bool -> String
field name value comma =
  "    " ++ jsonString name ++ ": " ++ value ++ if comma then ",\n" else "\n"

objectField :: String -> String -> Bool -> String
objectField name value comma =
  "    " ++ jsonString name ++ ": " ++ value ++ if comma then ",\n" else "\n"

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
       then Left "No status/header fixture objects found"
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
  adapterDecision <- requiredString "adapterDecision" object
  responseBodyDecision <- requiredString "responseBodyDecision" object
  bodyShape <- requiredString "bodyShape" object
  rangeValue <- requiredString "range" object
  pure Fixture
    { fixtureId = parsedFixtureId
    , fixtureMethod = method
    , fixtureRouteTarget = routeTarget
    , fixturePlaybackId = playbackId
    , fixtureSourceType = sourceType
    , fixtureClientType = clientType
    , fixturePlaybackMode = playbackMode
    , fixtureStreamUrl = streamUrl
    , fixtureAdapterDecision = adapterDecision
    , fixtureResponseBodyDecision = responseBodyDecision
    , fixtureBodyShape = bodyShape
    , fixtureRange = rangeValue
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
