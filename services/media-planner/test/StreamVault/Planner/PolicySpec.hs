{-# LANGUAGE DuplicateRecordFields #-}
{-# LANGUAGE OverloadedRecordDot #-}
{-# LANGUAGE OverloadedStrings #-}

module StreamVault.Planner.PolicySpec (spec) where

import Test.Hspec
import StreamVault.Planner.Policy (planPlayback)
import StreamVault.Planner.Types

spec :: Spec
spec = describe "planPlayback" $ do
  it "direct plays compatible ranged MP4" $ do
    (planPlayback (request compatibleProbe desktopCapability)).strategy `shouldBe` Direct

  it "remuxes compatible codecs in MKV" $ do
    let mkvProbe = Probe (Just "mkv") (Just "h264") (Just "aac") (Just 1920) (Just 1080) (Just 24) (Just 5000000) (Just 7200) (Just 1000000) 2 [] True False
        result = planPlayback (request mkvProbe desktopCapability)
    result.strategy `shouldBe` Remux
    result.videoCodec `shouldBe` Just "h264"

  it "transcodes HEVC and AC3 for a basic browser" $ do
    let incompatible = Probe (Just "mkv") (Just "hevc") (Just "ac3") (Just 3840) (Just 2160) (Just 24) (Just 25000000) (Just 7200) (Just 1000000) 6 [] True False
        result = planPlayback (request incompatible desktopCapability)
    result.strategy `shouldBe` Transcode
    result.maxHeight `shouldBe` Just 1080
    result.videoCodec `shouldBe` Just "h264"

  it "rejects an empty source URL" $ do
    let emptyMedia = MediaInput "movie" "Movie" ""
    (planPlayback (PlanRequest emptyMedia compatibleProbe desktopCapability)).strategy `shouldBe` Reject

request :: Probe -> Capability -> PlanRequest
request = PlanRequest defaultMedia

defaultMedia :: MediaInput
defaultMedia = MediaInput "movie" "Movie" "https://media.test/movie.mp4"

compatibleProbe :: Probe
compatibleProbe = Probe (Just "mp4") (Just "h264") (Just "aac") (Just 1920) (Just 1080) (Just 24) (Just 5000000) (Just 7200) (Just 1000000) 2 [] True False

desktopCapability :: Capability
desktopCapability = Capability (Just "desktop") Nothing ["mp4", "webm", "hls"] ["h264", "vp9"] ["aac", "opus"] 1080 12000000 False True True
