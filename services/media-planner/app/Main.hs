module Main (main) where

import Data.Maybe (fromMaybe)
import System.Environment (lookupEnv)
import Text.Read (readMaybe)
import StreamVault.Planner.Server (runServer)

main :: IO ()
main = do
  port <- fromMaybe 4100 . (>>= readMaybe) <$> lookupEnv "PORT"
  host <- fromMaybe "0.0.0.0" <$> lookupEnv "HOST"
  runServer port host
