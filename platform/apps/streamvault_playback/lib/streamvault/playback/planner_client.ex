defmodule StreamVault.Playback.PlannerClient do
  @moduledoc "Calls the Haskell planner with circuit-breaking fallback semantics."

  require Logger

  alias StreamVault.Core.Media
  alias StreamVault.Playback.{Capability, LocalPlanner, Plan, Probe}

  @spec plan(Media.t(), Probe.t(), Capability.t()) :: Plan.t()
  def plan(media, probe, capability) do
    started = System.monotonic_time()

    url =
      Application.get_env(:streamvault_playback, :planner_url, "http://127.0.0.1:4100") <>
        "/v1/plan"

    timeout = Application.get_env(:streamvault_playback, :request_timeout_ms, 2_000)
    body = payload(media, probe, capability)

    result =
      case Req.post(url, json: body, receive_timeout: timeout, retry: false) do
        {:ok, %{status: 200, body: response}} when is_map(response) ->
          decode_plan(response, media.stream_url)

        {:ok, response} ->
          Logger.warning("planner returned status #{response.status}; using local policy")
          LocalPlanner.plan(media, probe, capability)

        {:error, reason} ->
          Logger.warning("planner unavailable: #{inspect(reason)}; using local policy")
          LocalPlanner.plan(media, probe, capability)
      end

    :telemetry.execute(
      [:streamvault, :playback, :plan],
      %{duration: System.monotonic_time() - started},
      %{strategy: result.strategy, planner: result.planner}
    )

    result
  end

  defp payload(media, probe, capability) do
    %{
      media: %{id: media.id, title: media.title, sourceUrl: media.stream_url},
      probe: Map.from_struct(probe),
      capability: Map.from_struct(capability)
    }
  end

  defp decode_plan(response, source_url) do
    %Plan{
      strategy: atom_strategy(response["strategy"]),
      reason: response["reason"] || "planner_policy",
      source_url: response["sourceUrl"] || source_url,
      manifest_url: response["manifestUrl"],
      container: response["container"],
      video_codec: response["videoCodec"],
      audio_codec: response["audioCodec"],
      max_height: response["maxHeight"],
      warnings: response["warnings"] || [],
      ffmpeg_args: response["ffmpegArgs"] || [],
      planner: :haskell
    }
  end

  defp atom_strategy(value) when value in ["direct", :direct], do: :direct
  defp atom_strategy(value) when value in ["remux", :remux], do: :remux
  defp atom_strategy(value) when value in ["transcode", :transcode], do: :transcode
  defp atom_strategy(_), do: :reject
end
