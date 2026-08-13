{-# LANGUAGE DeriveAnyClass #-}
{-# LANGUAGE DeriveGeneric #-}
module StreamVault.Capabilities where
import Data.Aeson (FromJSON, ToJSON)
import GHC.Generics (Generic)
import StreamVault.Media

data DeviceFamily = IOS | IPadOS | Android | Desktop | SmartTV | UnknownDevice
  deriving (Eq, Ord, Show, Read, Generic, FromJSON, ToJSON)
data BrowserEngine = WebKit | Chromium | Gecko | NativeEngine | UnknownEngine
  deriving (Eq, Ord, Show, Read, Generic, FromJSON, ToJSON)
data NetworkClass = Slow | Constrained | Normal | Fast | LocalLAN
  deriving (Eq, Ord, Show, Read, Generic, FromJSON, ToJSON)
data ClientCapabilities = ClientCapabilities
  { device :: DeviceFamily, engine :: BrowserEngine, network :: NetworkClass
  , containers :: [Container], videoCodecs :: [VideoCodec], audioCodecs :: [AudioCodec]
  , nativeHls :: Bool, mse :: Bool, rangeRequests :: Bool
  , maxWidth :: Maybe Int, maxHeight :: Maybe Int
  } deriving (Eq, Show, Generic, FromJSON, ToJSON)

conservativeCapabilities :: ClientCapabilities
conservativeCapabilities = ClientCapabilities
  UnknownDevice UnknownEngine Normal [MP4] [H264] [AAC,MP3] False False True (Just 1920) (Just 1080)

androidChrome :: ClientCapabilities
androidChrome = ClientCapabilities
  Android Chromium Normal [MP4,WEBM] [H264,VP9,AV1] [AAC,OPUS,MP3] False True True (Just 1920) (Just 1080)

iosSafari :: ClientCapabilities
iosSafari = ClientCapabilities
  IOS WebKit Normal [MP4,MOV] [H264,HEVC] [AAC,MP3,AC3] True False True (Just 1920) (Just 1080)
