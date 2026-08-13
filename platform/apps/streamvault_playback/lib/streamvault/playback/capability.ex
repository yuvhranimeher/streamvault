defmodule StreamVault.Playback.Capability do
  @moduledoc "Browser/device playback capabilities used by the planner."

  defstruct [
    :device,
    :user_agent,
    containers: ["mp4", "webm", "hls"],
    video_codecs: ["h264", "vp9"],
    audio_codecs: ["aac", "mp3", "opus"],
    max_height: 1080,
    max_bitrate: 12_000_000,
    supports_hls: false,
    supports_range: true,
    prefers_direct: true
  ]

  @spec from_map(map()) :: %__MODULE__{}
  def from_map(map) do
    user_agent = value(map, "userAgent") || value(map, "user_agent") || ""

    defaults = infer(user_agent)

    struct(defaults, %{
      device: value(map, "device") || defaults.device,
      user_agent: user_agent,
      containers: list(value(map, "containers"), defaults.containers),
      video_codecs:
        list(value(map, "videoCodecs") || value(map, "video_codecs"), defaults.video_codecs),
      audio_codecs:
        list(value(map, "audioCodecs") || value(map, "audio_codecs"), defaults.audio_codecs),
      max_height:
        integer(value(map, "maxHeight") || value(map, "max_height")) || defaults.max_height,
      max_bitrate:
        integer(value(map, "maxBitrate") || value(map, "max_bitrate")) || defaults.max_bitrate,
      supports_hls:
        boolean(value(map, "supportsHls") || value(map, "supports_hls"), defaults.supports_hls),
      supports_range:
        boolean(
          value(map, "supportsRange") || value(map, "supports_range"),
          defaults.supports_range
        ),
      prefers_direct: boolean(value(map, "prefersDirect") || value(map, "prefers_direct"), true)
    })
  end

  @spec infer(String.t()) :: %__MODULE__{}
  def infer(user_agent) do
    normalized = String.downcase(user_agent || "")

    cond do
      String.contains?(normalized, ["iphone", "ipad", "apple tv"]) ->
        %__MODULE__{
          device: "apple",
          user_agent: user_agent,
          containers: ["mp4", "hls"],
          video_codecs: ["h264", "hevc"],
          supports_hls: true
        }

      String.contains?(normalized, "android") ->
        %__MODULE__{
          device: "android",
          user_agent: user_agent,
          containers: ["mp4", "webm", "hls"],
          video_codecs: ["h264", "vp9", "av1"],
          supports_hls: true
        }

      true ->
        %__MODULE__{device: "desktop", user_agent: user_agent}
    end
  end

  defp value(map, key) when is_map(map),
    do: Map.get(map, key) || Map.get(map, String.to_atom(key))

  defp list(value, _default) when is_list(value),
    do: Enum.map(value, &String.downcase(to_string(&1)))

  defp list(_, default), do: default
  defp integer(value) when is_integer(value), do: value

  defp integer(value) when is_binary(value) do
    case Integer.parse(value) do
      {number, _} -> number
      _ -> nil
    end
  end

  defp integer(_), do: nil
  defp boolean(value, _default) when value in [true, "true", "1", 1], do: true
  defp boolean(value, _default) when value in [false, "false", "0", 0], do: false
  defp boolean(_, default), do: default
end
