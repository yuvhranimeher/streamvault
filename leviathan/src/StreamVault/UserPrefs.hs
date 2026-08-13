module StreamVault.UserPrefs where
import Data.Text (Text)
data UserPrefs = UserPrefs [Text] [Text] Bool Bool deriving (Eq,Show)
