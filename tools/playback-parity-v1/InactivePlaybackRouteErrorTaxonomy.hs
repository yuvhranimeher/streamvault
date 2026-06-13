-- INACTIVE SHADOW-ONLY ROUTE ERROR TAXONOMY - NOT WIRED TO SERVER
-- This executable reads local error taxonomy fixtures and prints deterministic
-- response error envelopes. It does not start a server, call the network,
-- call FFmpeg, or register active HTTP routes.

module Main where

import Data.Char (isAlphaNum, isSpace, toLower, toUpper)
import System.Environment (getArgs)
import System.Exit (die)

data Fixture = Fixture
  { fixtureId :: String
  , fixtureMethod :: String
  , fixtureRouteTarget :: String
  , fixturePlaybackId :: String
  , fixtureMediaType :: String
  , fixtureStreamUrl :: String
  , fixtureAdapterDecision :: String
  , fixtureResponseBodyDecision :: String
  , fixtureStatusHeaderDecision :: String
  , fixtureForceInternalError :: String
  } deriving (Show)

data Source = Source
  { sourceFixtureId :: String
  , sourceMethod :: String
  , sourceRouteTarget :: String
  , sourcePlaybackId :: String
  , sourceMediaType :: String
  , sourceStreamUrl :: String
  , sourceAdapterDecision :: String
  , sourceResponseBodyDecision :: String
  , sourceStatusHeaderDecision :: String
  , sourceForceInternalError :: String
  } deriving (Show)

data TaxonomyEntry = TaxonomyEntry
  { entryStatus :: Int
  , entryErrorCode :: String
  , entryErrorCategory :: String
  , entryUserSafeMessage :: String
  , entryDeveloperDetail :: String
  , entryRetryable :: Bool
  } deriving (Show)

data Decision = Decision
  { decisionFixtureId :: String
  , decisionDecision :: String
  , decisionOk :: Bool
  , decisionStatus :: Int
  , decisionErrorCode :: String
  , decisionErrorCategory :: String
  , decisionReasonCode :: String
  , decisionUserSafeMessage :: String
  , decisionDeveloperDetail :: String
  , decisionRetryable :: Bool
  , decisionHeaders :: [(String, String)]
  , decisionBodyShape :: String
  } deriving (Show)

main :: IO ()
main = do
  args <- getArgs
  path <- case args of
    [value] -> pure value
    _ -> die "Usage: InactivePlaybackRouteErrorTaxonomy <inactive-playback-route-error-taxonomy-fixtures.json>"
  raw <- readFile path
  fixtures <- case parseFixtures raw of
    Left err -> die err
    Right value -> pure value
  putStr (decisionsJson (map errorTaxonomyDecision fixtures))

errorTaxonomyDecision :: Fixture -> Decision
errorTaxonomyDecision fixture =
  let source = normalizeFixture fixture
      reason = rejectionReason source
      entry = taxonomyEntry reason
  in envelope source reason entry

normalizeFixture :: Fixture -> Source
normalizeFixture fixture =
  Source
    { sourceFixtureId = fixtureId fixture
    , sourceMethod = map toUpper (fixtureMethod fixture)
    , sourceRouteTarget = fixtureRouteTarget fixture
    , sourcePlaybackId = fixturePlaybackId fixture
    , sourceMediaType = fixtureMediaType fixture
    , sourceStreamUrl = fixtureStreamUrl fixture
    , sourceAdapterDecision = defaultAccepted (fixtureAdapterDecision fixture)
    , sourceResponseBodyDecision = defaultAccepted (fixtureResponseBodyDecision fixture)
    , sourceStatusHeaderDecision = defaultAccepted (fixtureStatusHeaderDecision fixture)
    , sourceForceInternalError = map toLower (fixtureForceInternalError fixture)
    }

defaultAccepted :: String -> String
defaultAccepted value = if null value then "accepted" else value

rejectionReason :: Source -> String
rejectionReason source
  | sourceForceInternalError source == "true" = "SHADOW_INTERNAL_SAFE_ERROR"
  | null (sourceRouteTarget source) || not (sourceRouteTarget source `elem` routeTargets) = "UNKNOWN_ROUTE"
  | not (sourceMethod source `elem` methods) = "METHOD_NOT_ALLOWED"
  | null (sourcePlaybackId source) = "MISSING_ID"
  | not (validPlaybackId (sourcePlaybackId source)) = "MALFORMED_ID"
  | null (sourceMediaType source) = "MISSING_MEDIA_TYPE"
  | not (sourceMediaType source `elem` mediaTypes) = "UNSUPPORTED_MEDIA_TYPE"
  | null (sourceStreamUrl source) = "MISSING_SOURCE_URL"
  | not (safeStreamUrl (sourceStreamUrl source)) = "UNSAFE_PLACEHOLDER_URL"
  | sourceAdapterDecision source /= "accepted" = "ADAPTER_DENIED"
  | sourceResponseBodyDecision source /= "accepted" = "RESPONSE_BODY_REJECTED"
  | sourceStatusHeaderDecision source /= "accepted" = "STATUS_HEADER_REJECTED"
  | otherwise = "SHADOW_INTERNAL_SAFE_ERROR"

envelope :: Source -> String -> TaxonomyEntry -> Decision
envelope source reason entry =
  Decision
    { decisionFixtureId = sourceFixtureId source
    , decisionDecision = "rejected"
    , decisionOk = False
    , decisionStatus = entryStatus entry
    , decisionErrorCode = entryErrorCode entry
    , decisionErrorCategory = entryErrorCategory entry
    , decisionReasonCode = reason
    , decisionUserSafeMessage = entryUserSafeMessage entry
    , decisionDeveloperDetail = entryDeveloperDetail entry
    , decisionRetryable = entryRetryable entry
    , decisionHeaders = headersForReason reason
    , decisionBodyShape = "error-json"
    }

taxonomyEntry :: String -> TaxonomyEntry
taxonomyEntry "MISSING_ID" =
  TaxonomyEntry 400 "PLAYBACK_ROUTE_VALIDATION_ERROR" "VALIDATION_ERROR"
    "Playback request is missing required information."
    "Missing playback id before inactive route selection."
    False
taxonomyEntry "MALFORMED_ID" =
  TaxonomyEntry 400 "PLAYBACK_ROUTE_VALIDATION_ERROR" "VALIDATION_ERROR"
    "Playback request is missing required information."
    "Playback id contains unsupported characters."
    False
taxonomyEntry "MISSING_MEDIA_TYPE" =
  TaxonomyEntry 400 "PLAYBACK_ROUTE_VALIDATION_ERROR" "VALIDATION_ERROR"
    "Playback request is missing required information."
    "Missing media type before inactive route selection."
    False
taxonomyEntry "UNSUPPORTED_MEDIA_TYPE" =
  TaxonomyEntry 422 "PLAYBACK_ROUTE_VALIDATION_ERROR" "VALIDATION_ERROR"
    "Playback request is not supported."
    "Media type is outside the inactive route taxonomy allowlist."
    False
taxonomyEntry "MISSING_SOURCE_URL" =
  TaxonomyEntry 400 "PLAYBACK_ROUTE_VALIDATION_ERROR" "VALIDATION_ERROR"
    "Playback request is missing required information."
    "Missing source URL before inactive adapter selection."
    False
taxonomyEntry "UNSAFE_PLACEHOLDER_URL" =
  TaxonomyEntry 400 "PLAYBACK_ROUTE_UNSAFE_URL" "UNSAFE_URL"
    "Playback source is not allowed."
    "Unsafe placeholder stream URL was rejected before adapter selection."
    False
taxonomyEntry "ADAPTER_DENIED" =
  TaxonomyEntry 403 "PLAYBACK_ROUTE_ADAPTER_DENIED" "ADAPTER_DENIED"
    "Playback source is not available."
    "Inactive adapter denied the source without exposing transport details."
    False
taxonomyEntry "RESPONSE_BODY_REJECTED" =
  TaxonomyEntry 502 "PLAYBACK_ROUTE_BODY_REJECTED" "BODY_REJECTED"
    "Playback response could not be prepared."
    "Response body validator rejected the fixture envelope."
    True
taxonomyEntry "STATUS_HEADER_REJECTED" =
  TaxonomyEntry 502 "PLAYBACK_ROUTE_HEADER_REJECTED" "HEADER_REJECTED"
    "Playback response could not be prepared."
    "Status/header validator rejected the fixture envelope."
    True
taxonomyEntry "UNKNOWN_ROUTE" =
  TaxonomyEntry 404 "PLAYBACK_ROUTE_NOT_FOUND" "NOT_FOUND"
    "Playback route was not found."
    "Route target is not part of the inactive playback route taxonomy."
    False
taxonomyEntry "METHOD_NOT_ALLOWED" =
  TaxonomyEntry 405 "PLAYBACK_ROUTE_METHOD_NOT_ALLOWED" "METHOD_NOT_ALLOWED"
    "Playback request method is not allowed."
    "Inactive route taxonomy allows only GET and POST methods."
    False
taxonomyEntry _ =
  TaxonomyEntry 500 "PLAYBACK_ROUTE_SHADOW_INTERNAL_ERROR" "SHADOW_INTERNAL_ERROR"
    "Playback is temporarily unavailable."
    "Shadow-only internal error fixture uses sanitized detail."
    True

headersForReason :: String -> [(String, String)]
headersForReason "METHOD_NOT_ALLOWED" =
  [ ("allow", "GET, POST")
  , ("cache-control", "no-store")
  , ("content-type", "application/json; charset=utf-8")
  , ("x-streamvault-shadow", "inactive-route-error-taxonomy-v1")
  ]
headersForReason _ =
  [ ("cache-control", "no-store")
  , ("content-type", "application/json; charset=utf-8")
  , ("x-streamvault-shadow", "inactive-route-error-taxonomy-v1")
  ]

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

mediaTypes :: [String]
mediaTypes = ["movie", "series", "live"]

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
    ++ field "ok" (boolJson (decisionOk value)) True
    ++ field "status" (show (decisionStatus value)) True
    ++ field "errorCode" (jsonString (decisionErrorCode value)) True
    ++ field "errorCategory" (jsonString (decisionErrorCategory value)) True
    ++ field "reasonCode" (jsonString (decisionReasonCode value)) True
    ++ field "userSafeMessage" (jsonString (decisionUserSafeMessage value)) True
    ++ field "developerDetail" (jsonString (decisionDeveloperDetail value)) True
    ++ field "retryable" (boolJson (decisionRetryable value)) True
    ++ objectField "headers" (headersJson (decisionHeaders value)) True
    ++ field "bodyShape" (jsonString (decisionBodyShape value)) True
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
    ++ "      \"fixture-only\",\n"
    ++ "      \"no-server\",\n"
    ++ "      \"no-network\",\n"
    ++ "      \"no-ffmpeg\",\n"
    ++ "      \"no-active-runtime-wiring\",\n"
    ++ "      \"no-live-urls\"\n"
    ++ "    ]"

field :: String -> String -> Bool -> String
field name value comma =
  "    " ++ jsonString name ++ ": " ++ value ++ if comma then ",\n" else "\n"

objectField :: String -> String -> Bool -> String
objectField name value comma =
  "    " ++ jsonString name ++ ": " ++ value ++ if comma then ",\n" else "\n"

boolJson :: Bool -> String
boolJson True = "true"
boolJson False = "false"

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
       then Left "No error taxonomy fixture objects found"
       else traverse parseFixture objects

parseFixture :: String -> Either String Fixture
parseFixture object = do
  parsedFixtureId <- requiredString "fixtureId" object
  method <- requiredString "method" object
  routeTarget <- requiredString "routeTarget" object
  playbackId <- requiredString "playbackId" object
  mediaType <- requiredString "mediaType" object
  streamUrl <- requiredString "streamUrl" object
  adapterDecision <- requiredString "adapterDecision" object
  responseBodyDecision <- requiredString "responseBodyDecision" object
  statusHeaderDecision <- requiredString "statusHeaderDecision" object
  forceInternalError <- requiredString "forceInternalError" object
  pure Fixture
    { fixtureId = parsedFixtureId
    , fixtureMethod = method
    , fixtureRouteTarget = routeTarget
    , fixturePlaybackId = playbackId
    , fixtureMediaType = mediaType
    , fixtureStreamUrl = streamUrl
    , fixtureAdapterDecision = adapterDecision
    , fixtureResponseBodyDecision = responseBodyDecision
    , fixtureStatusHeaderDecision = statusHeaderDecision
    , fixtureForceInternalError = forceInternalError
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
