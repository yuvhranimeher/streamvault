{-# LANGUAGE DeriveGeneric #-}
{-# LANGUAGE DuplicateRecordFields #-}
{-# LANGUAGE OverloadedStrings #-}

module StreamVault.Planner.Types
  ( Capability (..)
  , Health (..)
  , MediaInput (..)
  , PlanRequest (..)
  , PlanResponse (..)
  , Probe (..)
  , RangeRequest (..)
  , RangeResponse (..)
  , Strategy (..)
  ) where

import Data.Aeson
import Data.Text (Text)
import Data.Time (UTCTime)
import GHC.Generics (Generic)

data MediaInput = MediaInput
  { mediaId :: Text
  , title :: Text
  , sourceUrl :: Text
  }
  deriving stock (Eq, Show, Generic)

instance FromJSON MediaInput where
  parseJSON = withObject "MediaInput" $ \object ->
    MediaInput
      <$> object .: "id"
      <*> object .:? "title" .!= ""
      <*> object .: "sourceUrl"

instance ToJSON MediaInput where
  toJSON mediaInput = object
    [ "id" .= mediaId mediaInput
    , "title" .= title mediaInput
    , "sourceUrl" .= sourceUrl mediaInput
    ]

data Probe = Probe
  { container :: Maybe Text
  , videoCodec :: Maybe Text
  , audioCodec :: Maybe Text
  , width :: Maybe Int
  , height :: Maybe Int
  , fps :: Maybe Double
  , bitrate :: Maybe Int
  , duration :: Maybe Double
  , sizeBytes :: Maybe Integer
  , audioChannels :: Int
  , subtitleCodecs :: [Text]
  , hasRange :: Bool
  , isHls :: Bool
  }
  deriving stock (Eq, Show, Generic)

instance FromJSON Probe where
  parseJSON = withObject "Probe" $ \object ->
    Probe
      <$> object .:? "container"
      <*> (object .:? "videoCodec" >>= fallback object "video_codec")
      <*> (object .:? "audioCodec" >>= fallback object "audio_codec")
      <*> object .:? "width"
      <*> object .:? "height"
      <*> object .:? "fps"
      <*> object .:? "bitrate"
      <*> object .:? "duration"
      <*> (object .:? "sizeBytes" >>= fallback object "size_bytes")
      <*> (object .:? "audioChannels" .!= 2)
      <*> (object .:? "subtitleCodecs" .!= [])
      <*> (object .:? "hasRange" .!= False)
      <*> (object .:? "isHls" .!= False)
    where
      fallback object key Nothing = object .:? key
      fallback _ _ value = pure value

instance ToJSON Probe where
  toJSON = genericToJSON defaultOptions

data Capability = Capability
  { device :: Maybe Text
  , userAgent :: Maybe Text
  , containers :: [Text]
  , videoCodecs :: [Text]
  , audioCodecs :: [Text]
  , maxHeight :: Int
  , maxBitrate :: Int
  , supportsHls :: Bool
  , supportsRange :: Bool
  , prefersDirect :: Bool
  }
  deriving stock (Eq, Show, Generic)

instance FromJSON Capability where
  parseJSON = withObject "Capability" $ \object ->
    Capability
      <$> object .:? "device"
      <*> object .:? "userAgent"
      <*> (object .:? "containers" .!= ["mp4", "webm", "hls"])
      <*> (object .:? "videoCodecs" .!= ["h264", "vp9"])
      <*> (object .:? "audioCodecs" .!= ["aac", "mp3", "opus"])
      <*> (object .:? "maxHeight" .!= 1080)
      <*> (object .:? "maxBitrate" .!= 12000000)
      <*> (object .:? "supportsHls" .!= False)
      <*> (object .:? "supportsRange" .!= True)
      <*> (object .:? "prefersDirect" .!= True)

instance ToJSON Capability where
  toJSON = genericToJSON defaultOptions

data PlanRequest = PlanRequest
  { media :: MediaInput
  , probe :: Probe
  , capability :: Capability
  }
  deriving stock (Eq, Show, Generic)

instance FromJSON PlanRequest where
  parseJSON = genericParseJSON defaultOptions

instance ToJSON PlanRequest where
  toJSON = genericToJSON defaultOptions

data Strategy = Direct | Remux | Transcode | Reject
  deriving stock (Eq, Ord, Show, Generic)

instance ToJSON Strategy where
  toJSON Direct = String "direct"
  toJSON Remux = String "remux"
  toJSON Transcode = String "transcode"
  toJSON Reject = String "reject"

instance FromJSON Strategy where
  parseJSON = withText "Strategy" $ \value -> case value of
    "direct" -> pure Direct
    "remux" -> pure Remux
    "transcode" -> pure Transcode
    "reject" -> pure Reject
    _ -> fail "unknown playback strategy"

data PlanResponse = PlanResponse
  { strategy :: Strategy
  , reason :: Text
  , sourceUrl :: Text
  , manifestUrl :: Maybe Text
  , container :: Maybe Text
  , videoCodec :: Maybe Text
  , audioCodec :: Maybe Text
  , maxHeight :: Maybe Int
  , warnings :: [Text]
  , ffmpegArgs :: [Text]
  }
  deriving stock (Eq, Show, Generic)

instance ToJSON PlanResponse where
  toJSON = genericToJSON defaultOptions

instance FromJSON PlanResponse where
  parseJSON = genericParseJSON defaultOptions

data Health = Health
  { ok :: Bool
  , service :: Text
  , version :: Text
  , now :: UTCTime
  }
  deriving stock (Eq, Show, Generic)

instance ToJSON Health where
  toJSON = genericToJSON defaultOptions

data RangeRequest = RangeRequest
  { header :: Text
  , resourceSize :: Integer
  }
  deriving stock (Eq, Show, Generic)

instance FromJSON RangeRequest where
  parseJSON = genericParseJSON defaultOptions

instance ToJSON RangeRequest where
  toJSON = genericToJSON defaultOptions

data RangeResponse = RangeResponse
  { satisfiable :: Bool
  , start :: Maybe Integer
  , end :: Maybe Integer
  , length :: Maybe Integer
  , contentRange :: Maybe Text
  }
  deriving stock (Eq, Show, Generic)

instance FromJSON RangeResponse where
  parseJSON = genericParseJSON defaultOptions

instance ToJSON RangeResponse where
  toJSON = genericToJSON defaultOptions
