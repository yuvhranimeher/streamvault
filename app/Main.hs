{-# LANGUAGE OverloadedStrings #-}

module Main where

import Control.Concurrent (forkFinally)
import Control.Exception (SomeException, displayException, try)
import Control.Monad (forever, void, when)
import Data.Aeson (Value(..), decode, encode, object, (.=))
import Data.Aeson.Key (fromText, toText)
import qualified Data.Aeson.KeyMap as KM
import qualified Data.ByteString as BS
import qualified Data.ByteString.Builder as BB
import qualified Data.ByteString.Char8 as B8
import qualified Data.ByteString.Lazy as BL
import qualified Data.ByteString.Lazy.Char8 as BLC
import qualified Data.CaseInsensitive as CI
import Data.Char (isSpace)
import Data.Int (Int64)
import Data.IORef (IORef, atomicModifyIORef', newIORef, readIORef)
import Data.Maybe (fromMaybe, listToMaybe)
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE
import qualified Data.Text.Encoding.Error as TEE
import qualified Data.Vector as V
import qualified Network.HTTP.Client as HC
import qualified Network.HTTP.Types as HT
import Network.HTTP.Types.URI (renderQuery, urlDecode, urlEncode)
import qualified Network.Socket as Socket
import Network.Socket (withSocketsDo)
import qualified Network.Socket.ByteString as SocketBS
import Network.Wai (defaultRequest)
import Network.Wai.Internal
  ( Request(..)
  , RequestBodyLength(..)
  , Response(..)
  , setRequestBodyChunks
  )
import System.Directory (doesFileExist, getCurrentDirectory)
import System.Environment (lookupEnv)
import System.FilePath ((</>))
import System.Info (compilerName, compilerVersion)
import System.IO (BufferMode(LineBuffering), hPutStrLn, hSetBuffering, stderr, stdout)
import System.Timeout (timeout)
import Data.Time.Clock (getCurrentTime)
import Data.Time.Clock.POSIX (POSIXTime, getPOSIXTime)
import Data.Time.Format (defaultTimeLocale, formatTime)
import Data.Version (showVersion)

import CatalogApi (CatalogCache, catalogResponseCached, newCatalogCache)

data RawRequest = RawRequest
  { rrMethod  :: BS.ByteString
  , rrPath    :: BS.ByteString
  , rrQuery   :: BS.ByteString
  , rrHeaders :: HT.RequestHeaders
  , rrBody    :: BL.ByteString
  , rrRemote  :: Socket.SockAddr
  }

main :: IO ()
main = withSocketsDo $ do
  hSetBuffering stdout LineBuffering
  hSetBuffering stderr LineBuffering
  result <- try runServer :: IO (Either SomeException ())
  case result of
    Right () -> pure ()
    Left e -> do
      hPutStrLn stderr ("StreamVault Haskell backend failed during initialization: " ++ displayException e)
      error (displayException e)

runServer :: IO ()
runServer = do
  startedAt <- getPOSIXTime
  portText <- lookupEnv "PORT"
  nodeBase <- lookupEnv "STREAMVAULT_NODE"
  root <- maybe getCurrentDirectory pure =<< lookupEnv "STREAMVAULT_ROOT"
  cwd <- getCurrentDirectory
  debugEnabled <- fmap (== Just "1") (lookupEnv "STREAMVAULT_HASKELL_DEBUG")
  searchNativeEnabled <- fmap (== Just "1") (lookupEnv "STREAMVAULT_HASKELL_SEARCH_NATIVE")
  detailsShadowCompareEnabled <- fmap (== Just "1") (lookupEnv "STREAMVAULT_HASKELL_DETAILS_SHADOW_COMPARE")
  detailsTimeoutMs <- maybe 17000 readInt <$> lookupEnv "STREAMVAULT_HASKELL_DETAILS_NODE_TIMEOUT_MS"
  catalogCache <- newCatalogCache
  detailsShadowComparisons <- newIORef []
  manager <- HC.newManager HC.defaultManagerSettings
  let port = maybe 3001 readInt portText
      upstream = stripTrailingSlash (fromMaybe "http://127.0.0.1:3000" nodeBase)
  startupLog port upstream root cwd debugEnabled searchNativeEnabled detailsShadowCompareEnabled detailsTimeoutMs
  runRawServer port (handleClient startedAt root searchNativeEnabled catalogCache manager upstream debugEnabled detailsShadowCompareEnabled detailsTimeoutMs detailsShadowComparisons)

startupLog :: Int -> String -> FilePath -> FilePath -> Bool -> Bool -> Bool -> Int -> IO ()
startupLog port upstream root cwd debugEnabled searchNativeEnabled detailsShadowCompareEnabled detailsTimeoutMs = do
  putStrLn "StreamVault Haskell backend starting"
  putStrLn ("PORT=" ++ show port)
  putStrLn ("STREAMVAULT_NODE=" ++ upstream)
  putStrLn ("STREAMVAULT_ROOT=" ++ root)
  putStrLn ("workingDirectory=" ++ cwd)
  putStrLn ("debugRequestLogging=" ++ if debugEnabled then "enabled" else "disabled")
  putStrLn ("nativeSearchFlag=" ++ if searchNativeEnabled then "enabled" else "disabled")
  putStrLn ("detailsShadowCompare=" ++ if detailsShadowCompareEnabled then "enabled" else "disabled")
  putStrLn ("detailsNodeTimeoutMs=" ++ show detailsTimeoutMs)
  putStrLn "serverMode=blocking-raw-socket"
  putStrLn "healthRoutes=/__haskell-health,/api/health"
  putStrLn "nativeRoutesEnabled=/api/dashboard/ping,/api/history(read-only),/api/version,/api/downloads,/download/:id(302-only),/api/movies,/api/series,/api/section/:key,/api/home-feed,/api/channels,/api/details/:type/:id(cache-hit then proxy-cache-miss),/__haskell-details-shadow-debug,/__haskell-search-debug,/__haskell-search-warmup"
  putStrLn "gatedNativeRoutes=/api/search behind STREAMVAULT_HASKELL_SEARCH_NATIVE=1 with 1500ms fallback to Node"
  putStrLn "proxiedRoutesEnabled=all unsupported/risky routes -> Node, including playback/live/HLS/FFmpeg/poster-cache/static/service-worker"
  putStrLn "warpDiagnostic=minimal Warp helper binds but does not dispatch requests on this Windows GHC runtime"
  putStrLn ("listening=http://127.0.0.1:" ++ show port)

runRawServer :: Int -> (Socket.Socket -> Socket.SockAddr -> IO ()) -> IO ()
runRawServer port handler = do
  addr:_ <- Socket.getAddrInfo
    (Just Socket.defaultHints { Socket.addrFlags = [Socket.AI_PASSIVE], Socket.addrSocketType = Socket.Stream })
    (Just "127.0.0.1")
    (Just (show port))
  sock <- Socket.socket (Socket.addrFamily addr) Socket.Stream Socket.defaultProtocol
  Socket.setSocketOption sock Socket.ReuseAddr 1
  Socket.bind sock (Socket.addrAddress addr)
  Socket.listen sock 128
  forever $ do
    (conn, remote) <- Socket.accept sock
    void $ forkFinally (handler conn remote) (\_ -> Socket.close conn)

handleClient :: POSIXTime -> FilePath -> Bool -> CatalogCache -> HC.Manager -> String -> Bool -> Bool -> Int -> IORef [Value] -> Socket.Socket -> Socket.SockAddr -> IO ()
handleClient startedAt root searchNativeEnabled catalogCache manager upstream debugEnabled detailsShadowCompareEnabled detailsTimeoutMs detailsShadowComparisons conn remote = do
  parsed <- timeout 10000000 (readRawRequest conn remote)
  case parsed of
    Nothing ->
      sendJson conn HT.status408 "{\"error\":\"REQUEST_TIMEOUT\",\"message\":\"Timed out reading request headers\"}"
    Just (Left msg) ->
      sendJson conn HT.status400 (jsonErrorStrict "BAD_REQUEST" msg)
    Just (Right rawReq) -> do
      when debugEnabled $
        putStrLn ("request " ++ B8.unpack (rrMethod rawReq) ++ " " ++ B8.unpack (rrPath rawReq <> rrQuery rawReq))
      handleRawRequest startedAt root searchNativeEnabled catalogCache manager upstream debugEnabled detailsShadowCompareEnabled detailsTimeoutMs detailsShadowComparisons conn rawReq

handleRawRequest :: POSIXTime -> FilePath -> Bool -> CatalogCache -> HC.Manager -> String -> Bool -> Bool -> Int -> IORef [Value] -> Socket.Socket -> RawRequest -> IO ()
handleRawRequest startedAt root searchNativeEnabled catalogCache manager upstream debugEnabled detailsShadowCompareEnabled detailsTimeoutMs detailsShadowComparisons conn rawReq
  | rrPath rawReq == "/__haskell-health" =
      sendJson conn HT.status200 "{\"ok\":true,\"runtime\":\"haskell-gateway\",\"server\":\"blocking-raw-socket\"}"
  | rrPath rawReq == "/api/health" =
      sendJson conn HT.status200 "{\"ok\":true,\"runtime\":\"haskell-gateway\",\"shadow\":true,\"server\":\"blocking-raw-socket\"}"
  | rrMethod rawReq == "GET" && rrPath rawReq == "/api/dashboard/ping" =
      sendDashboardPing conn startedAt
  | rrMethod rawReq == "GET" && rrPath rawReq == "/api/history" =
      sendHistory conn root
  | rrMethod rawReq == "GET" && rrPath rawReq == "/api/version" =
      sendVersion conn
  | rrMethod rawReq == "GET" && rrPath rawReq == "/__haskell-details-shadow-debug" =
      sendDetailsShadowDebug root searchNativeEnabled catalogCache manager upstream debugEnabled detailsShadowCompareEnabled detailsTimeoutMs detailsShadowComparisons conn rawReq
  | otherwise = do
      waiReq <- toWaiRequest rawReq
      let nativeAttempt = try (catalogResponseCached root searchNativeEnabled catalogCache waiReq) :: IO (Either SomeException (Maybe Response))
      nativeResult <- case nativeRouteTimeoutMicros rawReq of
        Nothing -> nativeAttempt
        Just micros -> do
          timed <- timeout micros nativeAttempt
          case timed of
            Just result -> pure result
            Nothing -> do
              hPutStrLn stderr ("native search route timed out after " ++ show (micros `div` 1000) ++ "ms, proxying to Node")
              pure (Right Nothing)
      case nativeResult of
        Right (Just native) ->
          case responseToSimple native of
            Just (status, headers, body) -> sendSimple conn status headers body
            Nothing -> proxyToNode manager upstream rawReq conn
        Right Nothing ->
          if detailsApiRoute rawReq
            then proxyDetailsCacheMiss manager upstream debugEnabled detailsShadowCompareEnabled detailsTimeoutMs detailsShadowComparisons rawReq conn
            else proxyToNode manager upstream rawReq conn
        Left e -> do
          hPutStrLn stderr ("native route failed, proxying to Node: " ++ displayException e)
          if detailsApiRoute rawReq
            then proxyDetailsCacheMiss manager upstream debugEnabled detailsShadowCompareEnabled detailsTimeoutMs detailsShadowComparisons rawReq conn
            else proxyToNode manager upstream rawReq conn

nativeRouteTimeoutMicros :: RawRequest -> Maybe Int
nativeRouteTimeoutMicros rawReq
  | rrPath rawReq == "/api/search" = Just 1500000
  | otherwise = Nothing

data BufferedNodeResponse = BufferedNodeResponse
  { bnrStatus  :: HT.Status
  , bnrHeaders :: HT.ResponseHeaders
  , bnrBody    :: BL.ByteString
  }

detailsApiRoute :: RawRequest -> Bool
detailsApiRoute rawReq =
  rrMethod rawReq == "GET"
    && case decodePathInfo (rrPath rawReq) of
         ("api":"details":rawType:_:_) -> T.toLower rawType `elem` ["movie", "tv", "series", "show"]
         _ -> False

detailsMediaTypeFromRaw :: RawRequest -> T.Text
detailsMediaTypeFromRaw rawReq =
  case decodePathInfo (rrPath rawReq) of
    ("api":"details":rawType:_) ->
      if T.toLower rawType `elem` ["tv", "series", "show"] then "tv" else "movie"
    _ -> "movie"

proxyDetailsCacheMiss :: HC.Manager -> String -> Bool -> Bool -> Int -> IORef [Value] -> RawRequest -> Socket.Socket -> IO ()
proxyDetailsCacheMiss manager upstream debugEnabled compareEnabled detailsTimeoutMs comparisons rawReq conn = do
  fetched <- fetchDetailsFromNode manager upstream detailsTimeoutMs rawReq
  case fetched of
    Left msg ->
      sendDetailsProxyError conn HT.status502 "UPSTREAM_NODE_UNAVAILABLE" msg
    Right nodeRes -> do
      let decoded = decode (bnrBody nodeRes) :: Maybe Value
          warnings = detailsValidationWarnings (detailsMediaTypeFromRaw rawReq) decoded
      when (debugEnabled && not (null warnings)) $
        hPutStrLn stderr ("details proxy shape warnings: " ++ show warnings)
      when compareEnabled $
        recordDetailsShadowComparison comparisons (detailsComparisonSummary rawReq nodeRes decoded warnings)
      sendSimple conn
        (bnrStatus nodeRes)
        (detailsProxyResponseHeaders (bnrHeaders nodeRes))
        (bnrBody nodeRes)

fetchDetailsFromNode :: HC.Manager -> String -> Int -> RawRequest -> IO (Either String BufferedNodeResponse)
fetchDetailsFromNode manager upstream detailsTimeoutMs rawReq = do
  let targetUrl = upstream ++ B8.unpack (rrPath rawReq <> rrQuery rawReq)
  parsed <- try (HC.parseRequest targetUrl) :: IO (Either SomeException HC.Request)
  case parsed of
    Left e ->
      pure . Left $ "bad upstream URL: " ++ displayException e
    Right baseReq -> do
      let timeoutMicros = max 1 detailsTimeoutMs * 1000
          outReq = baseReq
            { HC.method = rrMethod rawReq
            , HC.requestHeaders = addOrReplaceHeaders detailsProxyRequestHeaders (filterRequestHeaders (rrHeaders rawReq))
            , HC.requestBody = HC.RequestBodyLBS (rrBody rawReq)
            , HC.responseTimeout = HC.responseTimeoutMicro timeoutMicros
            }
      proxied <- try (HC.httpLbs outReq manager) :: IO (Either SomeException (HC.Response BL.ByteString))
      pure $ case proxied of
        Left e -> Left (displayException e)
        Right res -> Right BufferedNodeResponse
          { bnrStatus = HC.responseStatus res
          , bnrHeaders = HC.responseHeaders res
          , bnrBody = HC.responseBody res
          }

detailsProxyRequestHeaders :: HT.RequestHeaders
detailsProxyRequestHeaders =
  [ ("x-streamvault-shadow-bypass", "1")
  , ("x-streamvault-shadow-origin", "haskell-details-cache-miss")
  , ("x-streamvault-details-shadow", "1")
  ]

addOrReplaceHeaders :: HT.RequestHeaders -> HT.RequestHeaders -> HT.RequestHeaders
addOrReplaceHeaders extras headers =
  extras ++ filter (\(name, _) -> CI.foldedCase name `notElem` extraNames) headers
  where
    extraNames = map (CI.foldedCase . fst) extras

detailsProxyResponseHeaders :: HT.ResponseHeaders -> HT.ResponseHeaders
detailsProxyResponseHeaders headers =
  filtered ++
    [ ("X-StreamVault-Haskell", "proxy-cache-miss")
    , ("X-StreamVault-Haskell-Details", "proxy-cache-miss")
    ]
  where
    blocked =
      hopByHopHeaders ++
        [ "content-length"
        , "x-streamvault-haskell"
        , "x-streamvault-haskell-details"
        ]
    filtered = filter (\(name, _) -> CI.foldedCase name `notElem` blocked) headers

sendDetailsProxyError :: Socket.Socket -> HT.Status -> String -> String -> IO ()
sendDetailsProxyError conn status code msg =
  sendAesonJson conn status
    [ ("Cache-Control", "no-store")
    , ("X-StreamVault-Haskell", "proxy-cache-miss-error")
    , ("X-StreamVault-Haskell-Details", "proxy-cache-miss-error")
    ]
    (object
      [ "ok" .= False
      , "error" .= code
      , "message" .= msg
      ])

sendDetailsShadowDebug :: FilePath -> Bool -> CatalogCache -> HC.Manager -> String -> Bool -> Bool -> Int -> IORef [Value] -> Socket.Socket -> RawRequest -> IO ()
sendDetailsShadowDebug root searchNativeEnabled catalogCache manager upstream debugEnabled compareEnabled detailsTimeoutMs comparisons conn rawReq =
  case detailsDebugRawRequest rawReq of
    Left msg ->
      sendAesonJson conn HT.status400 detailsDebugHeaders
        (object
          [ "ok" .= False
          , "route" .= String "/__haskell-details-shadow-debug"
          , "error" .= String "BAD_DETAILS_DEBUG_REQUEST"
          , "message" .= msg
          ])
    Right detailsReq -> do
      waiReq <- toWaiRequest detailsReq
      native <- try (catalogResponseCached root searchNativeEnabled catalogCache waiReq) :: IO (Either SomeException (Maybe Response))
      case native of
        Right (Just res) ->
          case responseToSimple res of
            Just (status, headers, body) ->
              sendDetailsShadowDebugBody conn comparisons detailsReq "native-cache-hit" (headerText "x-streamvault-haskell" headers) status (decode body :: Maybe Value) []
            Nothing ->
              sendDetailsShadowDebugBody conn comparisons detailsReq "native-cache-hit" (Just "native-details-cache") HT.status500 Nothing ["native response was not a simple buffered response"]
        Right Nothing ->
          sendDetailsShadowDebugProxy conn manager upstream debugEnabled compareEnabled detailsTimeoutMs comparisons detailsReq
        Left e -> do
          hPutStrLn stderr ("details shadow debug native lookup failed: " ++ displayException e)
          sendDetailsShadowDebugProxy conn manager upstream debugEnabled compareEnabled detailsTimeoutMs comparisons detailsReq

sendDetailsShadowDebugProxy :: Socket.Socket -> HC.Manager -> String -> Bool -> Bool -> Int -> IORef [Value] -> RawRequest -> IO ()
sendDetailsShadowDebugProxy conn manager upstream debugEnabled compareEnabled detailsTimeoutMs comparisons detailsReq = do
  fetched <- fetchDetailsFromNode manager upstream detailsTimeoutMs detailsReq
  case fetched of
    Left msg ->
      sendAesonJson conn HT.status502 detailsDebugHeaders
        (object
          [ "ok" .= False
          , "route" .= String "/__haskell-details-shadow-debug"
          , "result" .= String "proxy-cache-miss-error"
          , "routeMarker" .= String "proxy-cache-miss-error"
          , "detailsRoute" .= rawTargetText detailsReq
          , "error" .= String "UPSTREAM_NODE_UNAVAILABLE"
          , "message" .= msg
          ])
    Right nodeRes -> do
      let decoded = decode (bnrBody nodeRes) :: Maybe Value
          warnings = detailsValidationWarnings (detailsMediaTypeFromRaw detailsReq) decoded
      when (debugEnabled && not (null warnings)) $
        hPutStrLn stderr ("details shadow debug shape warnings: " ++ show warnings)
      when compareEnabled $
        recordDetailsShadowComparison comparisons (detailsComparisonSummary detailsReq nodeRes decoded warnings)
      sendDetailsShadowDebugBody conn comparisons detailsReq "proxy-cache-miss" (Just "proxy-cache-miss") (bnrStatus nodeRes) decoded warnings

sendDetailsShadowDebugBody :: Socket.Socket -> IORef [Value] -> RawRequest -> T.Text -> Maybe T.Text -> HT.Status -> Maybe Value -> [String] -> IO ()
sendDetailsShadowDebugBody conn comparisons detailsReq result marker status decoded warnings = do
  recent <- readIORef comparisons
  sendAesonJson conn HT.status200 detailsDebugHeaders
    (object
      [ "ok" .= True
      , "route" .= String "/__haskell-details-shadow-debug"
      , "detailsRoute" .= rawTargetText detailsReq
      , "result" .= result
      , "routeMarker" .= fromMaybe "" marker
      , "status" .= HT.statusCode status
      , "shape" .= detailsShapeSummary decoded
      , "validationWarnings" .= warnings
      , "recentComparisonCount" .= length recent
      , "lastComparison" .= listToMaybe recent
      ])

detailsDebugHeaders :: HT.ResponseHeaders
detailsDebugHeaders =
  [ ("Cache-Control", "no-store")
  , ("X-StreamVault-Haskell", "details-shadow-debug")
  ]

detailsDebugRawRequest :: RawRequest -> Either String RawRequest
detailsDebugRawRequest rawReq =
  if BS.null ident
    then Left "Missing required id query parameter."
    else Right rawReq
      { rrMethod = "GET"
      , rrPath = "/api/details/" <> mediaPath <> "/" <> urlEncode False ident
      , rrQuery = renderQuery True forwardQuery
      , rrBody = BL.empty
      }
  where
    mediaRaw = fromMaybe "movie" (lookupQueryBytes "type" rawReq)
    mediaText = T.toLower (decodeQueryBytes mediaRaw)
    mediaPath = if mediaText `elem` ["tv", "series", "show"] then "tv" else "movie"
    ident = fromMaybe BS.empty $
      lookupQueryBytes "id" rawReq
        `orElse` lookupQueryBytes "tmdbId" rawReq
        `orElse` lookupQueryBytes "title" rawReq
        `orElse` lookupQueryBytes "name" rawReq
    forwardQuery =
      [ (key, Just value)
      | key <- ["title", "name", "year", "tmdbId", "type"]
      , Just value <- [lookupQueryBytes key rawReq]
      ]

orElse :: Maybe a -> Maybe a -> Maybe a
orElse (Just a) _ = Just a
orElse Nothing b = b

lookupQueryBytes :: BS.ByteString -> RawRequest -> Maybe BS.ByteString
lookupQueryBytes key rawReq =
  case lookup key (HT.parseQuery (dropQueryMark (rrQuery rawReq))) of
    Just (Just value) -> Just value
    _ -> Nothing

dropQueryMark :: BS.ByteString -> BS.ByteString
dropQueryMark raw =
  if "?" `BS.isPrefixOf` raw then BS.drop 1 raw else raw

decodeQueryBytes :: BS.ByteString -> T.Text
decodeQueryBytes =
  TE.decodeUtf8With TEE.lenientDecode

rawTargetText :: RawRequest -> T.Text
rawTargetText rawReq =
  decodeQueryBytes (rrPath rawReq <> rrQuery rawReq)

headerText :: BS.ByteString -> HT.ResponseHeaders -> Maybe T.Text
headerText name headers =
  decodeQueryBytes <$> lookup (CI.mk name) headers

recordDetailsShadowComparison :: IORef [Value] -> Value -> IO ()
recordDetailsShadowComparison ref summary = do
  atomicModifyIORef' ref $ \items ->
    let next = take 25 (summary : items)
    in (next, ())
  hPutStrLn stderr ("[Details shadow compare] " ++ BLC.unpack (encode summary))

detailsComparisonSummary :: RawRequest -> BufferedNodeResponse -> Maybe Value -> [String] -> Value
detailsComparisonSummary rawReq nodeRes decoded warnings =
  object
    [ "mode" .= String "proxy-cache-miss"
    , "detailsRoute" .= rawTargetText rawReq
    , "status" .= HT.statusCode (bnrStatus nodeRes)
    , "expected" .= object
        [ "type" .= detailsMediaTypeFromRaw rawReq
        , "title" .= maybe "" decodeQueryBytes (lookupQueryBytes "title" rawReq `orElse` lookupQueryBytes "name" rawReq)
        , "year" .= maybe "" decodeQueryBytes (lookupQueryBytes "year" rawReq)
        ]
    , "node" .= detailsShapeSummary decoded
    , "validationWarnings" .= warnings
    ]

detailsShapeSummary :: Maybe Value -> Value
detailsShapeSummary Nothing =
  object ["root" .= String "non-json"]
detailsShapeSummary (Just (Object o)) =
  object
    [ "root" .= String "object"
    , "keys" .= map toText (KM.keys o)
    , "ok" .= objectLookupValue "ok" (Object o)
    , "type" .= firstObjectText ["type"] (Object o)
    , "title" .= firstObjectText ["title", "name"] (Object o)
    , "year" .= firstObjectText ["year"] (Object o)
    , "posterPresent" .= objectFieldPresent "poster" (Object o)
    , "backdropPresent" .= objectFieldPresent "backdrop" (Object o)
    , "overviewPresent" .= objectFieldPresent "overview" (Object o)
    , "trailers" .= arrayCount "trailers" (Object o)
    , "cast" .= arrayCount "cast" (Object o)
    , "crew" .= arrayCount "crew" (Object o)
    , "productionCompanies" .= arrayCount "productionCompanies" (Object o)
    , "similar" .= arrayCount "similar" (Object o)
    , "moreByDirector" .= arrayCount "moreByDirector" (Object o)
    , "episodesKind" .= valueKind (objectLookupValue "episodes" (Object o))
    , "episodesPresent" .= objectFieldPresent "episodes" (Object o)
    ]
detailsShapeSummary (Just (Array xs)) =
  object ["root" .= String "array", "length" .= V.length xs]
detailsShapeSummary (Just value) =
  object ["root" .= valueKind value]

detailsValidationWarnings :: T.Text -> Maybe Value -> [String]
detailsValidationWarnings _ Nothing =
  ["response body is not valid JSON"]
detailsValidationWarnings expectedMedia (Just (Object o)) =
  concat
    [ if KM.member (fromText "ok") o then [] else ["missing ok field"]
    , if T.null titleText then ["missing title/name field"] else []
    , case objectLookupValue "type" rootValue of
        String t | not (T.null t) && t /= expectedMedia ->
          ["type " ++ T.unpack t ++ " does not match route type " ++ T.unpack expectedMedia]
        _ -> []
    , concatMap optionalArrayWarning ["trailers", "cast", "crew", "productionCompanies", "similar", "moreByDirector"]
    , case objectLookupValue "episodes" rootValue of
        Null -> []
        Array _ -> []
        Object _ -> []
        _ -> ["episodes is present but is not an array or object"]
    ]
  where
    rootValue = Object o
    titleText = firstObjectText ["title", "name"] rootValue
    optionalArrayWarning key =
      case objectLookupValue key rootValue of
        Null -> []
        Array _ -> []
        _ -> [T.unpack key ++ " is present but is not an array"]
detailsValidationWarnings _ (Just _) =
  ["response JSON root is not an object"]

objectLookupValue :: T.Text -> Value -> Value
objectLookupValue key (Object o) =
  fromMaybe Null (KM.lookup (fromText key) o)
objectLookupValue _ _ = Null

firstObjectText :: [T.Text] -> Value -> T.Text
firstObjectText keys value =
  fromMaybe "" . listToMaybe $
    [ text
    | key <- keys
    , let text = valueAsText (objectLookupValue key value)
    , not (T.null text)
    ]

valueAsText :: Value -> T.Text
valueAsText (String t) = t
valueAsText (Number n) = T.pack (show n)
valueAsText (Bool True) = "true"
valueAsText (Bool False) = "false"
valueAsText _ = ""

objectFieldPresent :: T.Text -> Value -> Bool
objectFieldPresent key value =
  case objectLookupValue key value of
    Null -> False
    String t -> not (T.null t)
    Array xs -> not (V.null xs)
    Object o -> not (KM.null o)
    Bool b -> b
    Number _ -> True

arrayCount :: T.Text -> Value -> Maybe Int
arrayCount key value =
  case objectLookupValue key value of
    Array xs -> Just (V.length xs)
    _ -> Nothing

valueKind :: Value -> T.Text
valueKind Null = "null"
valueKind (String _) = "string"
valueKind (Number _) = "number"
valueKind (Bool _) = "boolean"
valueKind (Array _) = "array"
valueKind (Object _) = "object"

sendDashboardPing :: Socket.Socket -> POSIXTime -> IO ()
sendDashboardPing conn startedAt = do
  now <- getPOSIXTime
  let tsMillis = floor (now * 1000) :: Integer
      uptimeSec = max 0 (floor (now - startedAt) :: Integer)
      runtimeVersion = compilerName ++ "-" ++ showVersion compilerVersion
      memoryShape = object
        [ "rss" .= (0 :: Integer)
        , "heapTotal" .= (0 :: Integer)
        , "heapUsed" .= (0 :: Integer)
        , "external" .= (0 :: Integer)
        , "arrayBuffers" .= (0 :: Integer)
        ]
  sendAesonJson conn HT.status200
    [ ("Cache-Control", "no-store")
    , ("X-StreamVault-Haskell", "native-dashboard-ping")
    ]
    (object
      [ "ok" .= True
      , "ts" .= tsMillis
      , "uptime" .= uptimeSec
      , "nodeVersion" .= runtimeVersion
      , "memory" .= memoryShape
      , "loadAvg" .= ([0, 0, 0] :: [Integer])
      , "freemem" .= (0 :: Integer)
      , "totalmem" .= (0 :: Integer)
      ])

sendHistory :: Socket.Socket -> FilePath -> IO ()
sendHistory conn root = do
  historyValue <- readJsonValueFile (root </> "watch-history.json") (Object KM.empty)
  sendAesonJson conn HT.status200
    [ ("Cache-Control", "no-store")
    , ("X-StreamVault-Haskell", "native-history")
    ]
    historyValue

sendVersion :: Socket.Socket -> IO ()
sendVersion conn = do
  now <- getCurrentTime
  let isoTime = formatTime defaultTimeLocale "%FT%T%QZ" now
  sendAesonJson conn HT.status200
    [ ("Cache-Control", "no-store")
    , ("X-StreamVault-Haskell", "native-version")
    ]
    (object
      [ "ok" .= True
      , "version" .= ("title-details-route-active" :: String)
      , "time" .= isoTime
      ])

readJsonValueFile :: FilePath -> Value -> IO Value
readJsonValueFile fp fallback = do
  exists <- doesFileExist fp
  if not exists
    then pure fallback
    else do
      raw <- try (BL.readFile fp) :: IO (Either SomeException BL.ByteString)
      case raw of
        Left _ -> pure fallback
        Right body -> pure (fromMaybe fallback (decode body))

readRawRequest :: Socket.Socket -> Socket.SockAddr -> IO (Either String RawRequest)
readRawRequest conn remote = do
  headerBytes <- recvUntilHeaders BS.empty
  case headerBytes of
    Nothing -> pure (Left "request headers exceeded 65536 bytes or connection closed")
    Just raw -> do
      let (headPart, bodyStart0) = splitHeaderBody raw
      case parseRequestHead headPart of
        Left e -> pure (Left e)
        Right (method, target, headers) -> do
          let contentLength = fromMaybe 0 (lookupHeaderInt "Content-Length" headers)
          if contentLength > 2 * 1024 * 1024
            then pure (Left "request body exceeds shadow gateway limit")
            else do
              body <- readRemainingBody conn contentLength bodyStart0
              let (rawPath, rawQuery) = splitTarget target
              pure $ Right RawRequest
                { rrMethod = method
                , rrPath = if BS.null rawPath then "/" else rawPath
                , rrQuery = rawQuery
                , rrHeaders = headers
                , rrBody = BL.fromStrict body
                , rrRemote = remote
                }
  where
    recvUntilHeaders acc
      | BS.length acc > 65536 = pure Nothing
      | "\r\n\r\n" `BS.isInfixOf` acc = pure (Just acc)
      | otherwise = do
          chunk <- SocketBS.recv conn 8192
          if BS.null chunk then pure Nothing else recvUntilHeaders (acc <> chunk)

splitHeaderBody :: BS.ByteString -> (BS.ByteString, BS.ByteString)
splitHeaderBody raw =
  let (headPart, rest) = B8.breakSubstring "\r\n\r\n" raw
  in (headPart, BS.drop 4 rest)

parseRequestHead :: BS.ByteString -> Either String (BS.ByteString, BS.ByteString, HT.RequestHeaders)
parseRequestHead bytes =
  case map stripCR (B8.lines bytes) of
    [] -> Left "empty request"
    requestLine:headerLines ->
      case B8.words requestLine of
        method:target:_ ->
          Right (method, target, mapMaybeHeader parseHeader headerLines)
        _ -> Left "invalid request line"

parseHeader :: BS.ByteString -> Maybe HT.Header
parseHeader line =
  let (name, value0) = B8.break (== ':') line
  in if BS.null name || BS.null value0
       then Nothing
       else Just (CI.mk name, B8.dropWhile isSpace (BS.drop 1 value0))

mapMaybeHeader :: (a -> Maybe b) -> [a] -> [b]
mapMaybeHeader f = foldr step []
  where
    step x acc = maybe acc (:acc) (f x)

stripCR :: BS.ByteString -> BS.ByteString
stripCR bs =
  if not (BS.null bs) && BS.last bs == 13 then BS.init bs else bs

readRemainingBody :: Socket.Socket -> Int -> BS.ByteString -> IO BS.ByteString
readRemainingBody conn contentLength initial =
  go initial
  where
    go acc
      | BS.length acc >= contentLength = pure (BS.take contentLength acc)
      | otherwise = do
          chunk <- SocketBS.recv conn (contentLength - BS.length acc)
          if BS.null chunk then pure acc else go (acc <> chunk)

splitTarget :: BS.ByteString -> (BS.ByteString, BS.ByteString)
splitTarget target =
  let (pathPart, queryPart) = B8.break (== '?') target
  in (pathPart, queryPart)

lookupHeader :: BS.ByteString -> HT.RequestHeaders -> Maybe BS.ByteString
lookupHeader name headers = lookup (CI.mk name) headers

lookupHeaderInt :: BS.ByteString -> HT.RequestHeaders -> Maybe Int
lookupHeaderInt name headers = do
  raw <- lookupHeader name headers
  case reads (B8.unpack raw) of
    [(n, "")] -> Just n
    _ -> Nothing

toWaiRequest :: RawRequest -> IO Request
toWaiRequest rawReq = do
  bodyRef <- newIORef (BL.toStrict (rrBody rawReq))
  let nextBodyChunk = atomicModifyIORef' bodyRef (\chunk -> (BS.empty, chunk))
      headers = rrHeaders rawReq
  pure $ setRequestBodyChunks nextBodyChunk defaultRequest
    { requestMethod = rrMethod rawReq
    , httpVersion = HT.http11
    , rawPathInfo = rrPath rawReq
    , rawQueryString = rrQuery rawReq
    , requestHeaders = headers
    , isSecure = False
    , remoteHost = rrRemote rawReq
    , pathInfo = decodePathInfo (rrPath rawReq)
    , queryString = HT.parseQuery (rrQuery rawReq)
    , requestBodyLength = KnownLength (fromIntegral (BL.length (rrBody rawReq)))
    , requestHeaderHost = lookupHeader "Host" headers
    , requestHeaderRange = lookupHeader "Range" headers
    , requestHeaderReferer = lookupHeader "Referer" headers
    , requestHeaderUserAgent = lookupHeader "User-Agent" headers
    }

decodePathInfo :: BS.ByteString -> [T.Text]
decodePathInfo rawPath =
  [ TE.decodeUtf8With TEE.lenientDecode (urlDecode False part)
  | part <- B8.split '/' rawPath
  , not (BS.null part)
  ]

responseToSimple :: Response -> Maybe (HT.Status, HT.ResponseHeaders, BL.ByteString)
responseToSimple (ResponseBuilder status headers builder) =
  Just (status, headers, BB.toLazyByteString builder)
responseToSimple (ResponseRaw _ fallback) =
  responseToSimple fallback
responseToSimple _ =
  Nothing

proxyToNode :: HC.Manager -> String -> RawRequest -> Socket.Socket -> IO ()
proxyToNode manager upstream rawReq conn = do
  let targetUrl = upstream ++ B8.unpack (rrPath rawReq <> rrQuery rawReq)
  parsed <- try (HC.parseRequest targetUrl) :: IO (Either SomeException HC.Request)
  case parsed of
    Left e ->
      sendJson conn HT.status500 (jsonErrorStrict "BAD_UPSTREAM_URL" (displayException e))
    Right baseReq -> do
      let outReq = baseReq
            { HC.method = rrMethod rawReq
            , HC.requestHeaders = filterRequestHeaders (rrHeaders rawReq)
            , HC.requestBody = HC.RequestBodyLBS (rrBody rawReq)
            , HC.responseTimeout = HC.responseTimeoutMicro 180000000
            }
      proxied <- try (HC.responseOpen outReq manager) :: IO (Either SomeException (HC.Response HC.BodyReader))
      case proxied of
        Left e ->
          sendJson conn HT.status502 (jsonErrorStrict "UPSTREAM_NODE_UNAVAILABLE" (displayException e))
        Right res -> do
          sendHead conn (HC.responseStatus res) (filterResponseHeaders (HC.responseHeaders res)) Nothing
          streamBody (HC.responseBody res)
          HC.responseClose res
  where
    streamBody reader = do
      chunk <- HC.brRead reader
      if BS.null chunk
        then pure ()
        else SocketBS.sendAll conn chunk >> streamBody reader

filterRequestHeaders :: HT.RequestHeaders -> HT.RequestHeaders
filterRequestHeaders =
  filter (\(name, _) -> CI.foldedCase name `notElem` ["host", "connection", "content-length"])

filterResponseHeaders :: HT.ResponseHeaders -> HT.ResponseHeaders
filterResponseHeaders =
  filter (\(name, _) -> CI.foldedCase name `notElem` hopByHopHeaders)

hopByHopHeaders :: [BS.ByteString]
hopByHopHeaders =
  [ "connection"
  , "keep-alive"
  , "proxy-authenticate"
  , "proxy-authorization"
  , "te"
  , "trailer"
  , "transfer-encoding"
  , "upgrade"
  ]

sendJson :: Socket.Socket -> HT.Status -> BS.ByteString -> IO ()
sendJson conn status body =
  sendSimple conn status [("Content-Type", "application/json")] (BL.fromStrict body)

sendAesonJson :: Socket.Socket -> HT.Status -> HT.ResponseHeaders -> Value -> IO ()
sendAesonJson conn status headers body =
  sendSimple conn status (("Content-Type", "application/json") : headers) (encode body)

sendSimple :: Socket.Socket -> HT.Status -> HT.ResponseHeaders -> BL.ByteString -> IO ()
sendSimple conn status headers body = do
  sendHead conn status (filterResponseHeaders headers) (Just (BL.length body))
  SocketBS.sendAll conn (BL.toStrict body)

sendHead :: Socket.Socket -> HT.Status -> HT.ResponseHeaders -> Maybe Int64 -> IO ()
sendHead conn status headers bodyLength = do
  let lengthHeader = maybe [] (\n -> [("Content-Length", B8.pack (show n))]) bodyLength
      finalHeaders = headers ++ lengthHeader ++ [("Connection", "close")]
      headBytes = B8.concat $
        [ "HTTP/1.1 "
        , B8.pack (show (HT.statusCode status))
        , " "
        , HT.statusMessage status
        , "\r\n"
        ]
        ++ concatMap renderHeader finalHeaders
        ++ ["\r\n"]
  SocketBS.sendAll conn headBytes

renderHeader :: HT.Header -> [BS.ByteString]
renderHeader (name, value) =
  [CI.original name, ": ", value, "\r\n"]

jsonErrorStrict :: String -> String -> BS.ByteString
jsonErrorStrict code msg =
  B8.pack ("{\"error\":\"" ++ esc code ++ "\",\"message\":\"" ++ esc msg ++ "\"}")

esc :: String -> String
esc = concatMap go
  where
    go '"' = "\\\""
    go '\\' = "\\\\"
    go '\n' = "\\n"
    go '\r' = "\\r"
    go '\t' = "\\t"
    go c = [c]

readInt :: String -> Int
readInt s =
  case reads s of
    [(n, "")] -> n
    _ -> 3001

stripTrailingSlash :: String -> String
stripTrailingSlash xs =
  case reverse xs of
    ('/':rest) -> reverse rest
    _ -> xs
