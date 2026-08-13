module StreamVault.Profile.Types where
import Data.Text (Text)
import StreamVault.Ids

data Maturity = Kids | Teen | Mature deriving (Eq,Ord,Show,Read)
data Profile = Profile
  { profileId :: ProfileId
  , profileName :: Text
  , maturity :: Maturity
  , audioLanguages :: [Text]
  , subtitleLanguages :: [Text]
  } deriving (Eq,Show)
