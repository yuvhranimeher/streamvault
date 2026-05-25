{-# LANGUAGE OverloadedStrings #-}

module Main where

import Control.Exception (SomeException, try)
import Data.Maybe (fromMaybe)
import qualified Data.ByteString.Char8 as B8
import qualified Data.ByteString.Lazy as BL
import qualified Network.HTTP.Client as HC
import qualified Network.HTTP.Types as HT
import Network.Wai
import Network.Wai.Handler.Warp (run)
import System.Environment (lookupEnv)

main :: IO ()
main = do
  portText <- lookupEnv "PORT"
  nodeBase <- lookupEnv "STREAMVAULT_NODE"
  let port = maybe 3001 readInt portText
      upstream = stripTrailingSlash (fromMaybe "http://127.0.0.1:3000" nodeBase)
  manager <- HC.newManager HC.defaultManagerSettings
  putStrLn ("StreamVault Haskell gateway running on http://127.0.0.1:" ++ show port)
  putStrLn ("Proxying every request to " ++ upstream)
  run port (app manager upstream)

app :: HC.Manager -> String -> Application
app manager upstream req respond
  | rawPathInfo req == "/__haskell-health" =
      respond $ responseLBS HT.status200 [("Content-Type", "application/json")] "{\"ok\":true,\"runtime\":\"haskell-gateway\"}"
  | otherwise = do
      body <- strictRequestBody req
      let targetUrl = upstream ++ B8.unpack (rawPathInfo req) ++ B8.unpack (rawQueryString req)
      parsed <- try (HC.parseRequest targetUrl) :: IO (Either SomeException HC.Request)
      case parsed of
        Left e ->
          respond $ responseLBS HT.status500 [("Content-Type", "application/json")]
            (jsonError "BAD_UPSTREAM_URL" (show e))
        Right baseReq -> do
          let outReq = baseReq
                { HC.method = requestMethod req
                , HC.requestHeaders = requestHeaders req
                , HC.requestBody = HC.RequestBodyLBS body
                }
          proxied <- try (HC.httpLbs outReq manager) :: IO (Either SomeException (HC.Response BL.ByteString))
          case proxied of
            Left e ->
              respond $ responseLBS HT.status502 [("Content-Type", "application/json")]
                (jsonError "UPSTREAM_NODE_UNAVAILABLE" (show e))
            Right res ->
              respond $ responseLBS
                (HC.responseStatus res)
                (HC.responseHeaders res)
                (HC.responseBody res)

jsonError :: String -> String -> BL.ByteString
jsonError code msg = BL.fromStrict $ B8.pack $ "{\"error\":\"" ++ esc code ++ "\",\"message\":\"" ++ esc msg ++ "\"}"

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
readInt s = case reads s of
  [(n, "")] -> n
  _ -> 3001

stripTrailingSlash :: String -> String
stripTrailingSlash xs = case reverse xs of
  ('/':rest) -> reverse rest
  _ -> xs
