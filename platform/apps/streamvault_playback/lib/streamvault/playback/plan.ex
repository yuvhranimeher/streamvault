defmodule StreamVault.Playback.Plan do
  @moduledoc "A playback decision independent from the transport that executes it."

  @enforce_keys [:strategy, :reason, :source_url]
  defstruct [
    :strategy,
    :reason,
    :source_url,
    :manifest_url,
    :container,
    :video_codec,
    :audio_codec,
    :max_height,
    :session_id,
    :planner,
    warnings: [],
    ffmpeg_args: []
  ]

  @type strategy :: :direct | :remux | :transcode | :reject
end
