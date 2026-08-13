module Main (main) where

import Test.Hspec (hspec)
import qualified StreamVault.Planner.PolicySpec
import qualified StreamVault.Planner.RangeSpec

main :: IO ()
main = hspec $ do
  StreamVault.Planner.PolicySpec.spec
  StreamVault.Planner.RangeSpec.spec
