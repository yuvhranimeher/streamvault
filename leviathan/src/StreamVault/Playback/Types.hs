{-# LANGUAGE DeriveAnyClass #-}
{-# LANGUAGE DeriveGeneric #-}
module StreamVault.Playback.Types where
import Data.Aeson (FromJSON,ToJSON)
import Data.Text (Text)
import GHC.Generics (Generic)
import StreamVault.Ids
import StreamVault.Media

data PlaybackMode = Direct | Remux | HLS | Transcode | Relay
  deriving (Eq,Ord,Show,Read,Generic,FromJSON,ToJSON)
data PlaybackReason = NativeCompatible | ContainerMismatch | VideoMismatch | AudioMismatch | NetworkConstrained | RangeUnavailable | LiveRelayRequired | PolicyOverride Text
  deriving (Eq,Show,Generic,FromJSON,ToJSON)
data TranscodeProfile = TranscodeProfile
  { profileName :: Text, profileContainer :: Container, profileVideo :: VideoCodec
  , profileAudio :: AudioCodec, profileWidth :: Int, profileHeight :: Int
  , profileVideoBitrate :: Int, profileAudioBitrate :: Int, profileSegmentSeconds :: Int
  } deriving (Eq,Show,Generic,FromJSON,ToJSON)
data PlaybackPlan = PlaybackPlan
  { planMedia :: MediaId, planSource :: SourceId, planMode :: PlaybackMode
  , planReasons :: [PlaybackReason], planScore :: Int
  , planProfile :: Maybe TranscodeProfile, planSeekable :: Bool
  , planResumeSeconds :: Maybe Double
  } deriving (Eq,Show,Generic,FromJSON,ToJSON)
