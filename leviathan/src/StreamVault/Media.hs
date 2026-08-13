{-# LANGUAGE DeriveAnyClass #-}
{-# LANGUAGE DeriveGeneric #-}
module StreamVault.Media where
import Data.Aeson (FromJSON, ToJSON)
import Data.Text (Text)
import GHC.Generics (Generic)
import StreamVault.Ids (MediaId, SourceId)
data MediaKind = Movie | SeriesEpisode | LiveChannel | DownloadArtifact
  deriving (Eq, Ord, Show, Read, Generic, FromJSON, ToJSON)
data SourceProtocol = LocalFile | PlainHTTP | TLSHTTP | FTP | HLSUpstream
  deriving (Eq, Ord, Show, Read, Generic, FromJSON, ToJSON)
data Container = MP4 | MKV | MOV | WEBM | AVI | MPEGTS | M4V | UnknownContainer Text
  deriving (Eq, Ord, Show, Generic, FromJSON, ToJSON)
data VideoCodec = H264 | HEVC | VP9 | AV1 | MPEG2Video | VC1 | UnknownVideoCodec Text
  deriving (Eq, Ord, Show, Generic, FromJSON, ToJSON)
data AudioCodec = AAC | AC3 | EAC3 | OPUS | VORBIS | DTS | FLAC | MP3 | UnknownAudioCodec Text
  deriving (Eq, Ord, Show, Generic, FromJSON, ToJSON)
data Resolution = Resolution { width :: Int, height :: Int, fps :: Double }
  deriving (Eq, Ord, Show, Generic, FromJSON, ToJSON)
data MediaSource = MediaSource
  { sourceId :: SourceId, protocol :: SourceProtocol, uri :: Text
  , container :: Container, videoCodec :: VideoCodec, audioCodecs :: [AudioCodec]
  , resolution :: Maybe Resolution, byteLength :: Maybe Integer
  , rangeCapable :: Bool, tls :: Bool, verified :: Bool
  , latencyMs :: Maybe Int, priorityBias :: Int
  } deriving (Eq, Show, Generic, FromJSON, ToJSON)
data Media = Media
  { mediaId :: MediaId, kind :: MediaKind, title :: Text, year :: Maybe Int
  , overview :: Text, genres :: [Text], rating :: Maybe Double
  , runtimeSeconds :: Maybe Int, poster :: Maybe Text, backdrop :: Maybe Text
  , season :: Maybe Int, episode :: Maybe Int, sources :: [MediaSource]
  } deriving (Eq, Show, Generic, FromJSON, ToJSON)
