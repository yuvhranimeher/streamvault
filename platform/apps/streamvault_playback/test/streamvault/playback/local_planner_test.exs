defmodule StreamVault.Playback.LocalPlannerTest do
  use ExUnit.Case, async: true

  alias StreamVault.Core.Media
  alias StreamVault.Playback.{Capability, LocalPlanner, Probe}

  @media %Media{
    id: "movie",
    title: "Movie",
    kind: :movie,
    stream_url: "https://media.test/movie.mp4"
  }

  test "selects direct play for compatible ranged MP4" do
    probe = %Probe{
      container: "mp4",
      video_codec: "h264",
      audio_codec: "aac",
      height: 1080,
      has_range: true
    }

    assert %{strategy: :direct} = LocalPlanner.plan(@media, probe, %Capability{})
  end

  test "selects remux when only the container is incompatible" do
    probe = %Probe{
      container: "mkv",
      video_codec: "h264",
      audio_codec: "aac",
      height: 1080,
      has_range: true
    }

    assert %{strategy: :remux, ffmpeg_args: ["-c:v", "copy" | _]} =
             LocalPlanner.plan(@media, probe, %Capability{})
  end

  test "selects transcode for unsupported codecs" do
    probe = %Probe{
      container: "mkv",
      video_codec: "hevc",
      audio_codec: "ac3",
      height: 2160,
      has_range: true
    }

    assert %{strategy: :transcode, video_codec: "h264", audio_codec: "aac", max_height: 1080} =
             LocalPlanner.plan(@media, probe, %Capability{})
  end
end
