{-# LANGUAGE DerivingStrategies #-}
{-# LANGUAGE GeneralizedNewtypeDeriving #-}
module StreamVault.Ids where
import Data.Aeson (FromJSON, ToJSON)
import Data.Hashable (Hashable)
import Data.Word (Word64)
newtype MediaId = MediaId { unMediaId :: Word64 }
  deriving stock (Eq, Ord, Show, Read)
  deriving newtype (Enum, FromJSON, Hashable, ToJSON)
newtype SourceId = SourceId { unSourceId :: Word64 }
  deriving stock (Eq, Ord, Show, Read)
  deriving newtype (Enum, FromJSON, Hashable, ToJSON)
newtype ProfileId = ProfileId { unProfileId :: Word64 }
  deriving stock (Eq, Ord, Show, Read)
  deriving newtype (Enum, FromJSON, Hashable, ToJSON)
newtype SessionId = SessionId { unSessionId :: Word64 }
  deriving stock (Eq, Ord, Show, Read)
  deriving newtype (Enum, FromJSON, Hashable, ToJSON)
newtype ChannelId = ChannelId { unChannelId :: Word64 }
  deriving stock (Eq, Ord, Show, Read)
  deriving newtype (Enum, FromJSON, Hashable, ToJSON)
newtype Generation = Generation { unGeneration :: Word64 }
  deriving stock (Eq, Ord, Show, Read)
  deriving newtype (Enum, FromJSON, Hashable, Num, ToJSON)
