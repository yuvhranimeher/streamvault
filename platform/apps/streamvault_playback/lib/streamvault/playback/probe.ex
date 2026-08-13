defmodule StreamVault.Playback.Probe do
  @moduledoc "Codec/container facts gathered by ffprobe or a crawler."

  defstruct [
    :container,
    :video_codec,
    :audio_codec,
    :width,
    :height,
    :fps,
    :bitrate,
    :duration,
    :size_bytes,
    audio_channels: 2,
    subtitle_codecs: [],
    has_range: false,
    is_hls: false
  ]

  @spec from_map(map()) :: %__MODULE__{}
  def from_map(map) do
    %__MODULE__{
      container: value(map, "container"),
      video_codec: value(map, "videoCodec") || value(map, "video_codec"),
      audio_codec: value(map, "audioCodec") || value(map, "audio_codec"),
      width: integer(value(map, "width")),
      height: integer(value(map, "height")),
      fps: number(value(map, "fps")),
      bitrate: integer(value(map, "bitrate")),
      duration: number(value(map, "duration")),
      size_bytes: integer(value(map, "sizeBytes") || value(map, "size_bytes")),
      audio_channels: integer(value(map, "audioChannels") || value(map, "audio_channels")) || 2,
      subtitle_codecs: value(map, "subtitleCodecs") || value(map, "subtitle_codecs") || [],
      has_range: truthy?(value(map, "hasRange") || value(map, "has_range")),
      is_hls: truthy?(value(map, "isHls") || value(map, "is_hls"))
    }
  end

  defp value(map, key) when is_map(map),
    do: Map.get(map, key) || Map.get(map, String.to_atom(key))

  defp integer(value) when is_integer(value), do: value
  defp integer(value) when is_float(value), do: trunc(value)
  defp integer(value) when is_binary(value), do: parse(value, &Integer.parse/1)
  defp integer(_), do: nil
  defp number(value) when is_number(value), do: value / 1
  defp number(value) when is_binary(value), do: parse(value, &Float.parse/1)
  defp number(_), do: nil

  defp parse(value, parser) do
    case parser.(value) do
      {number, _} -> number
      _ -> nil
    end
  end

  defp truthy?(value), do: value in [true, 1, "1", "true", "TRUE"]
end
