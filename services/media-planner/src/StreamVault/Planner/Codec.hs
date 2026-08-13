{-# LANGUAGE OverloadedStrings #-}

module StreamVault.Planner.Codec
  ( inferContainer
  , normalizeCodec
  , normalizeContainer
  ) where

import Data.Char (toLower)
import Data.Text (Text)
import qualified Data.Text as Text

normalizeCodec :: Text -> Text
normalizeCodec value = case normalized of
  "avc" -> "h264"
  "avc1" -> "h264"
  "x264" -> "h264"
  "h.264" -> "h264"
  "h265" -> "hevc"
  "h.265" -> "hevc"
  "x265" -> "hevc"
  "e-ac-3" -> "eac3"
  "ec-3" -> "eac3"
  other -> other
  where
    normalized = Text.toLower (Text.strip value)

normalizeContainer :: Text -> Text
normalizeContainer value = case normalized of
  "matroska" -> "mkv"
  "mpegts" -> "hls"
  "m3u8" -> "hls"
  "mov,mp4,m4a,3gp,3g2,mj2" -> "mp4"
  other -> Text.dropWhile (== '.') other
  where
    normalized = Text.toLower (Text.strip value)

inferContainer :: Text -> Text
inferContainer url =
  let path = Text.takeWhile (/= '?') url
      extension = Text.takeWhileEnd (/= '.') path
      lowered = Text.map toLower extension
   in normalizeContainer lowered
