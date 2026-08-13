{-# LANGUAGE OverloadedStrings #-}

module StreamVault.Planner.Range
  ( ByteRange (..)
  , parseByteRange
  , rangeResponse
  ) where

import Data.Text (Text)
import qualified Data.Text as Text
import qualified Data.Text.Read as TextRead
import StreamVault.Planner.Types (RangeResponse (..))

data ByteRange = ByteRange
  { rangeStart :: Integer
  , rangeEnd :: Integer
  }
  deriving stock (Eq, Show)

parseByteRange :: Integer -> Text -> Either Text ByteRange
parseByteRange size header
  | size <= 0 = Left "resource size must be positive"
  | not ("bytes=" `Text.isPrefixOf` normalized) = Left "only byte ranges are supported"
  | Text.any (== ',') rangeValue = Left "multipart ranges are not supported"
  | Text.null rangeValue = Left "range is empty"
  | otherwise = parsePair size (Text.breakOn "-" rangeValue)
  where
    normalized = Text.toLower (Text.strip header)
    rangeValue = Text.drop 6 normalized

parsePair :: Integer -> (Text, Text) -> Either Text ByteRange
parsePair size (startText, endWithDash)
  | Text.null endWithDash = Left "range separator is missing"
  | Text.null startText = do
      suffix <- positiveInteger (Text.drop 1 endWithDash)
      let bounded = min suffix size
      pure (ByteRange (size - bounded) (size - 1))
  | otherwise = do
      start <- nonNegativeInteger startText
      if start >= size
        then Left "range starts beyond the resource"
        else do
          end <- if Text.null (Text.drop 1 endWithDash)
            then pure (size - 1)
            else nonNegativeInteger (Text.drop 1 endWithDash)
          if end < start
            then Left "range end precedes start"
            else pure (ByteRange start (min end (size - 1)))

rangeResponse :: Integer -> Text -> RangeResponse
rangeResponse size header = case parseByteRange size header of
  Left _ -> RangeResponse False Nothing Nothing Nothing Nothing
  Right (ByteRange start end) ->
    let byteLength = end - start + 1
        content = "bytes " <> showText start <> "-" <> showText end <> "/" <> showText size
     in RangeResponse True (Just start) (Just end) (Just byteLength) (Just content)

nonNegativeInteger :: Text -> Either Text Integer
nonNegativeInteger value = case TextRead.decimal value of
  Right (number, rest) | Text.null rest -> Right number
  _ -> Left "range contains a non-numeric offset"

positiveInteger :: Text -> Either Text Integer
positiveInteger value = do
  number <- nonNegativeInteger value
  if number > 0 then Right number else Left "suffix range must be positive"

showText :: Show value => value -> Text
showText = Text.pack . show
