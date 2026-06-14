-- INACTIVE SHADOW-ONLY ROUTE FINAL READINESS - NOT WIRED TO SERVER
-- This executable reads the local final-readiness fixture manifest and prints
-- deterministic readiness metadata. It does not start a server, call the
-- network, call FFmpeg, or register active HTTP routes.

module Main where

import Data.Char (isSpace)
import System.Environment (getArgs)
import System.Exit (die)

data Fixture = Fixture
  { fixtureComponent :: String
  , fixtureDisplayName :: String
  , fixtureRequiredStatus :: String
  , fixtureParityGate :: String
  , fixtureEnvelopeGate :: String
  , fixtureFixtureGate :: String
  , fixtureSafetyGate :: String
  , fixtureFixtureFile :: String
  , fixtureContractFile :: String
  , fixtureFixtureSafety :: String
  } deriving (Show)

main :: IO ()
main = do
  args <- getArgs
  path <- case args of
    [value] -> pure value
    _ -> die "Usage: InactivePlaybackRouteFinalReadiness <inactive-playback-route-final-readiness-fixtures.json>"
  raw <- readFile path
  fixtures <- case parseFixtures raw of
    Left err -> die err
    Right value -> pure value
  putStr (summaryJson fixtures)

summaryJson :: [Fixture] -> String
summaryJson fixtures =
  "{\n"
    ++ field "contractId" (jsonString "inactive-playback-route-final-readiness-v1") True
    ++ field "mode" (jsonString "read-only shadow-only inactive playback route readiness") True
    ++ field "readinessDecision" (jsonString "ready-when-all-required-gates-pass") True
    ++ field "componentCount" (show (length fixtures)) True
    ++ objectField "requiredComponents" (componentsJson fixtures) True
    ++ objectField "requiredPassCriteria" (passCriteriaJson fixtures) True
    ++ objectField "safety" safetyJson False
    ++ "}\n"

componentsJson :: [Fixture] -> String
componentsJson fixtures =
  "[\n" ++ joinWith ",\n" (map componentJson fixtures) ++ "\n  ]"

componentJson :: Fixture -> String
componentJson fixture =
  "    {\n"
    ++ innerField "component" (jsonString (fixtureComponent fixture)) True
    ++ innerField "displayName" (jsonString (fixtureDisplayName fixture)) True
    ++ innerField "requiredStatus" (jsonString (fixtureRequiredStatus fixture)) True
    ++ innerField "parityGate" (jsonString (fixtureParityGate fixture)) True
    ++ innerField "envelopeGate" (jsonString (fixtureEnvelopeGate fixture)) True
    ++ innerField "fixtureGate" (jsonString (fixtureFixtureGate fixture)) True
    ++ innerField "safetyGate" (jsonString (fixtureSafetyGate fixture)) True
    ++ innerField "fixtureFile" (jsonString (fixtureFixtureFile fixture)) True
    ++ innerField "contractFile" (jsonString (fixtureContractFile fixture)) True
    ++ innerField "fixtureSafety" (jsonString (fixtureFixtureSafety fixture)) True
    ++ innerField "readinessContribution" (jsonString "required") False
    ++ "    }"

passCriteriaJson :: [Fixture] -> String
passCriteriaJson fixtures =
  "[\n"
    ++ joinWith ",\n" (map (\fixture -> "    " ++ jsonString (fixtureDisplayName fixture ++ " " ++ fixtureRequiredStatus fixture)) fixtures)
    ++ "\n  ]"

safetyJson :: String
safetyJson =
  "{\n"
    ++ safetyField "serverStarted" "false" True
    ++ safetyField "networkCalled" "false" True
    ++ safetyField "ffmpegStarted" "false" True
    ++ safetyField "runtimePlaybackChanged" "false" True
    ++ safetyField "activeRoutesAdded" "false" True
    ++ safetyField "inactiveRouteWired" "false" True
    ++ safetyField "frontendPlaybackChanged" "false" True
    ++ safetyField "liveUrlActivated" "false" True
    ++ safetyField "fixturesRequireExampleTestOrLocalOnly" "true" False
    ++ "  }"

field :: String -> String -> Bool -> String
field name value comma =
  "  " ++ jsonString name ++ ": " ++ value ++ if comma then ",\n" else "\n"

innerField :: String -> String -> Bool -> String
innerField name value comma =
  "      " ++ jsonString name ++ ": " ++ value ++ if comma then ",\n" else "\n"

objectField :: String -> String -> Bool -> String
objectField name value comma =
  "  " ++ jsonString name ++ ": " ++ value ++ if comma then ",\n" else "\n"

safetyField :: String -> String -> Bool -> String
safetyField name value comma =
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
       then Left "No final readiness fixture objects found"
       else traverse parseFixture objects

parseFixture :: String -> Either String Fixture
parseFixture object = do
  component <- requiredString "component" object
  displayName <- requiredString "displayName" object
  requiredStatus <- requiredString "requiredStatus" object
  parityGate <- requiredString "parityGate" object
  envelopeGate <- requiredString "envelopeGate" object
  fixtureGate <- requiredString "fixtureGate" object
  safetyGate <- requiredString "safetyGate" object
  fixtureFile <- requiredString "fixtureFile" object
  contractFile <- requiredString "contractFile" object
  fixtureSafety <- requiredString "fixtureSafety" object
  pure Fixture
    { fixtureComponent = component
    , fixtureDisplayName = displayName
    , fixtureRequiredStatus = requiredStatus
    , fixtureParityGate = parityGate
    , fixtureEnvelopeGate = envelopeGate
    , fixtureFixtureGate = fixtureGate
    , fixtureSafetyGate = safetyGate
    , fixtureFixtureFile = fixtureFile
    , fixtureContractFile = contractFile
    , fixtureFixtureSafety = fixtureSafety
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
