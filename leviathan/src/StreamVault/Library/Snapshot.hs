module StreamVault.Library.Snapshot where
import Data.Map.Strict (Map)
import StreamVault.Ids
import StreamVault.Media

data Snapshot = Snapshot
  { snapshotGeneration :: Generation
  , snapshotItems :: Map MediaId Media
  } deriving (Eq,Show)
