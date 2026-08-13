{-# LANGUAGE DuplicateRecordFields #-}
{-# LANGUAGE OverloadedRecordDot #-}
{-# LANGUAGE OverloadedStrings #-}

module StreamVault.Planner.Server
  ( application
  , runServer
  , server
  ) where

import Control.Monad.IO.Class (liftIO)
import Data.String (fromString)
import Data.Time (getCurrentTime)
import Network.Wai.Handler.Warp (defaultSettings, runSettings, setHost, setPort)
import Network.Wai.Middleware.RequestLogger (logStdoutDev)
import Servant
import StreamVault.Planner.API (API, apiProxy)
import StreamVault.Planner.Policy (planPlayback)
import StreamVault.Planner.Range (rangeResponse)
import StreamVault.Planner.Types

server :: Server API
server = healthHandler :<|> planHandler :<|> rangeHandler
  where
    healthHandler = do
      timestamp <- liftIO getCurrentTime
      pure (Health True "streamvault-media-planner" "2.0.0" timestamp)

    planHandler request = pure (planPlayback request)
    rangeHandler request = pure (rangeResponse request.resourceSize request.header)

application :: Application
application = logStdoutDev (serve apiProxy server)

runServer :: Int -> String -> IO ()
runServer port host = do
  let settings = setPort port (setHost (fromString host) defaultSettings)
  putStrLn ("streamvault-media-planner listening on " <> host <> ":" <> show port)
  runSettings settings application
