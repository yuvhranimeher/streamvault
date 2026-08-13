defmodule StreamVault.Playback.LocalPlanner do
  @moduledoc "Safe deterministic fallback when the Haskell policy service is unavailable."

  alias StreamVault.Core.Media
  alias StreamVault.Playback.{Capability, Plan, Probe}

  @spec plan(Media.t(), Probe.t(), Capability.t()) :: Plan.t()
  def plan(%Media{} = media, %Probe{} = probe, %Capability{} = capability) do
    container = normalize_container(probe.container, media.stream_url)
    video = normalize_codec(probe.video_codec)
    audio = normalize_codec(probe.audio_codec)

    cond do
      is_nil(media.stream_url) ->
        %Plan{strategy: :reject, reason: "missing_source", source_url: "", planner: :elixir}

      probe.is_hls and capability.supports_hls ->
        direct(media, "native_hls", "hls", video, audio)

      direct_compatible?(container, video, audio, probe, capability) ->
        direct(media, "compatible_container_codecs", container, video, audio)

      codecs_compatible?(video, audio, capability) ->
        %Plan{
          strategy: :remux,
          reason: "container_incompatible",
          source_url: media.stream_url,
          container: "mp4",
          video_codec: video,
          audio_codec: audio,
          planner: :elixir,
          ffmpeg_args: ["-c:v", "copy", "-c:a", "copy", "-movflags", "+faststart"]
        }

      true ->
        height = min(probe.height || capability.max_height, capability.max_height)

        %Plan{
          strategy: :transcode,
          reason: transcode_reason(container, video, audio, probe, capability),
          source_url: media.stream_url,
          container: if(capability.supports_hls, do: "hls", else: "mp4"),
          video_codec: "h264",
          audio_codec: "aac",
          max_height: height,
          planner: :elixir,
          ffmpeg_args: transcode_args(height, capability.supports_hls)
        }
    end
  end

  defp direct(media, reason, container, video, audio) do
    %Plan{
      strategy: :direct,
      reason: reason,
      source_url: media.stream_url,
      container: container,
      video_codec: video,
      audio_codec: audio,
      planner: :elixir
    }
  end

  defp direct_compatible?(container, video, audio, probe, capability) do
    capability.prefers_direct and container in capability.containers and
      video in capability.video_codecs and audio in capability.audio_codecs and
      (is_nil(probe.height) or probe.height <= capability.max_height) and
      (is_nil(probe.bitrate) or probe.bitrate <= capability.max_bitrate) and
      (not capability.supports_range or probe.has_range or probe.is_hls)
  end

  defp codecs_compatible?(video, audio, capability),
    do: video in capability.video_codecs and audio in capability.audio_codecs

  defp transcode_reason(container, video, audio, probe, capability) do
    [
      if(container not in capability.containers, do: "container"),
      if(video not in capability.video_codecs, do: "video_codec"),
      if(audio not in capability.audio_codecs, do: "audio_codec"),
      if(probe.height && probe.height > capability.max_height, do: "resolution"),
      if(probe.bitrate && probe.bitrate > capability.max_bitrate, do: "bitrate")
    ]
    |> Enum.reject(&is_nil/1)
    |> Enum.join("+")
  end

  defp transcode_args(height, hls?) do
    base = [
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-vf",
      "scale=-2:min(ih\\,#{height})",
      "-c:a",
      "aac",
      "-b:a",
      "160k"
    ]

    if hls?,
      do: base ++ ["-f", "hls", "-hls_time", "4", "-hls_list_size", "8"],
      else: base ++ ["-movflags", "frag_keyframe+empty_moov"]
  end

  defp normalize_container(nil, url),
    do:
      url
      |> to_string()
      |> URI.parse()
      |> Map.get(:path)
      |> Path.extname()
      |> String.trim_leading(".")
      |> String.downcase()

  defp normalize_container(value, _),
    do: value |> to_string() |> String.downcase() |> String.trim_leading(".")

  defp normalize_codec(nil), do: "unknown"

  defp normalize_codec(value),
    do:
      value
      |> to_string()
      |> String.downcase()
      |> String.replace("avc1", "h264")
      |> String.replace("x264", "h264")
      |> String.replace("h265", "hevc")
end
