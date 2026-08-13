{-# LANGUAGE DuplicateRecordFields #-}
{-# LANGUAGE OverloadedRecordDot #-}
{-# LANGUAGE OverloadedStrings #-}

module StreamVault.Planner.Policy
  ( planPlayback
  ) where

import Data.Maybe (fromMaybe, isNothing)
import Data.Text (Text)
import qualified Data.Text as Text
import StreamVault.Planner.Codec (inferContainer, normalizeCodec, normalizeContainer)
import StreamVault.Planner.Types

planPlayback :: PlanRequest -> PlanResponse
planPlayback request
  | Text.null (Text.strip request.media.sourceUrl) = rejected "missing_source"
  | request.probe.isHls && request.capability.supportsHls = direct "native_hls" "hls"
  | directCompatible facts request.probe request.capability = direct "compatible_container_codecs" facts.container
  | codecsCompatible facts request.capability = remux source facts
  | otherwise = transcode source facts request.probe request.capability
  where
    facts = normalizedFacts request
    source = request.media.sourceUrl

    rejected why = PlanResponse Reject why source Nothing Nothing Nothing Nothing Nothing [] []

    direct why outputContainer =
      PlanResponse
        Direct
        why
        source
        Nothing
        (Just outputContainer)
        (Just facts.video)
        (Just facts.audio)
        request.probe.height
        (directWarnings request.probe request.capability)
        []

data Facts = Facts
  { container :: Text
  , video :: Text
  , audio :: Text
  }
  deriving stock (Eq, Show)

normalizedFacts :: PlanRequest -> Facts
normalizedFacts request = Facts
  { container = maybe (inferContainer request.media.sourceUrl) normalizeContainer request.probe.container
  , video = maybe "unknown" normalizeCodec request.probe.videoCodec
  , audio = maybe "unknown" normalizeCodec request.probe.audioCodec
  }

directCompatible :: Facts -> Probe -> Capability -> Bool
directCompatible facts probe capability =
  capability.prefersDirect
    && facts.container `memberNormalized` capability.containers
    && facts.video `memberCodec` capability.videoCodecs
    && facts.audio `memberCodec` capability.audioCodecs
    && maybe True (<= capability.maxHeight) probe.height
    && maybe True (<= capability.maxBitrate) probe.bitrate
    && (not capability.supportsRange || probe.hasRange || probe.isHls)

codecsCompatible :: Facts -> Capability -> Bool
codecsCompatible facts capability =
  facts.video `memberCodec` capability.videoCodecs
    && facts.audio `memberCodec` capability.audioCodecs

remux :: Text -> Facts -> PlanResponse
remux source facts = PlanResponse
  { strategy = Remux
  , reason = "container_incompatible"
  , sourceUrl = source
  , manifestUrl = Nothing
  , container = Just "mp4"
  , videoCodec = Just facts.video
  , audioCodec = Just facts.audio
  , maxHeight = Nothing
  , warnings = []
  , ffmpegArgs = ["-map", "0:v:0", "-map", "0:a:0?", "-c:v", "copy", "-c:a", "copy", "-movflags", "+faststart"]
  }

transcode :: Text -> Facts -> Probe -> Capability -> PlanResponse
transcode source facts probe capability = PlanResponse
  { strategy = Transcode
  , reason = Text.intercalate "+" (transcodeReasons facts probe capability)
  , sourceUrl = source
  , manifestUrl = Nothing
  , container = Just outputContainer
  , videoCodec = Just "h264"
  , audioCodec = Just "aac"
  , maxHeight = Just outputHeight
  , warnings = transcodeWarnings probe
  , ffmpegArgs = transcodeArguments outputHeight capability.supportsHls
  }
  where
    outputContainer = if capability.supportsHls then "hls" else "mp4"
    outputHeight = min capability.maxHeight (fromMaybe capability.maxHeight probe.height)

transcodeReasons :: Facts -> Probe -> Capability -> [Text]
transcodeReasons facts probe capability = concat
  [ ["container" | not (facts.container `memberNormalized` capability.containers)]
  , ["video_codec" | not (facts.video `memberCodec` capability.videoCodecs)]
  , ["audio_codec" | not (facts.audio `memberCodec` capability.audioCodecs)]
  , ["resolution" | maybe False (> capability.maxHeight) probe.height]
  , ["bitrate" | maybe False (> capability.maxBitrate) probe.bitrate]
  ]

directWarnings :: Probe -> Capability -> [Text]
directWarnings probe capability = concat
  [ ["source_does_not_advertise_byte_ranges" | capability.supportsRange && not probe.hasRange && not probe.isHls]
  , ["probe_height_unknown" | isNothing probe.height]
  ]

transcodeWarnings :: Probe -> [Text]
transcodeWarnings probe =
  ["multi_channel_audio_will_be_downmixed" | probe.audioChannels > 2]
    <> ["image_subtitles_require_burn_in" | any (`elem` ["hdmv_pgs_subtitle", "dvd_subtitle"]) probe.subtitleCodecs]

transcodeArguments :: Int -> Bool -> [Text]
transcodeArguments outputHeight hls =
  [ "-map", "0:v:0"
  , "-map", "0:a:0?"
  , "-c:v", "libx264"
  , "-preset", "veryfast"
  , "-crf", "23"
  , "-vf", "scale=-2:min(ih\\," <> showText outputHeight <> ")"
  , "-c:a", "aac"
  , "-ac", "2"
  , "-b:a", "160k"
  ] <> if hls
    then ["-f", "hls", "-hls_time", "4", "-hls_list_size", "8", "-hls_flags", "delete_segments+independent_segments"]
    else ["-movflags", "frag_keyframe+empty_moov"]

memberNormalized :: Text -> [Text] -> Bool
memberNormalized needle = any ((== normalizeContainer needle) . normalizeContainer)

memberCodec :: Text -> [Text] -> Bool
memberCodec needle = any ((== normalizeCodec needle) . normalizeCodec)

showText :: Show value => value -> Text
showText = Text.pack . show
