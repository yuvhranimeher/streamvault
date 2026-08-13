{-# LANGUAGE DeriveGeneric #-}
{-# LANGUAGE DerivingStrategies #-}
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
  parseJSON = withObject "MediaInput" $ \value ->
    MediaInput
      <$> value .: "id"
      <*> value .:? "title" .!= ""
      <*> value .: "sourceUrl"

instance ToJSON MediaInput where
  toJSON MediaInput {mediaId = identifier, title = mediaTitle, sourceUrl = url} = object
    [ "id" .= identifier
    , "title" .= mediaTitle
    , "sourceUrl" .= url
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
  parseJSON = withObject "Probe" $ \value ->
    Probe
      <$> value .:? "container"
      <*> (value .:? "videoCodec" >>= fallback value "video_codec")
      <*> (value .:? "audioCodec" >>= fallback value "audio_codec")
      <*> value .:? "width"
      <*> value .:? "height"
      <*> value .:? "fps"
      <*> value .:? "bitrate"
      <*> value .:? "duration"
      <*> (value .:? "sizeBytes" >>= fallback value "size_bytes")
      <*> (value .:? "audioChannels" .!= 2)
      <*> (value .:? "subtitleCodecs" .!= [])
      <*> (value .:? "hasRange" .!= False)
      <*> (value .:? "isHls" .!= False)
    where
      fallback value key Nothing = value .:? key
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
  parseJSON = withObject "Capability" $ \value ->
    Capability
      <$> value .:? "device"
      <*> value .:? "userAgent"
      <*> (value .:? "containers" .!= ["mp4", "webm", "hls"])
      <*> (value .:? "videoCodecs" .!= ["h264", "vp9"])
      <*> (value .:? "audioCodecs" .!= ["aac", "mp3", "opus"])
      <*> (value .:? "maxHeight" .!= 1080)
      <*> (value .:? "maxBitrate" .!= 12000000)
      <*> (value .:? "supportsHls" .!= False)
      <*> (value .:? "supportsRange" .!= True)
      <*> (value .:? "prefersDirect" .!= True)

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
