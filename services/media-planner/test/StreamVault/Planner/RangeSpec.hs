{-# LANGUAGE OverloadedStrings #-}

module StreamVault.Planner.RangeSpec (spec) where

import Test.Hspec
import Test.QuickCheck
import qualified Data.Text as Text
import StreamVault.Planner.Range

spec :: Spec
spec = describe "parseByteRange" $ do
  it "parses a bounded range" $
    parseByteRange 1000 "bytes=100-199" `shouldBe` Right (ByteRange 100 199)

  it "caps an oversized end" $
    parseByteRange 1000 "bytes=900-5000" `shouldBe` Right (ByteRange 900 999)

  it "parses suffix ranges" $
    parseByteRange 1000 "bytes=-100" `shouldBe` Right (ByteRange 900 999)

  it "rejects ranges beyond the resource" $
    parseByteRange 1000 "bytes=1000-" `shouldSatisfy` isLeft

  it "never returns offsets outside the resource" $
    property validRangeProperty

isLeft :: Either a b -> Bool
isLeft (Left _) = True
isLeft _ = False

showText :: Show value => value -> Text.Text
showText = Text.pack . show

validRangeProperty :: Positive Int -> NonNegative Int -> NonNegative Int -> Bool
validRangeProperty (Positive rawSize) (NonNegative rawStart) (NonNegative rawWidth) =
  let size = 1 + toInteger (rawSize `mod` 100000)
      start = toInteger rawStart `mod` size
      width = toInteger rawWidth `mod` size
      header = "bytes=" <> showText start <> "-" <> showText (start + width)
   in case parseByteRange size header of
        Left _ -> False
        Right range -> rangeStart range >= 0 && rangeEnd range < size && rangeEnd range >= rangeStart range
