defmodule StreamVault.Edge.MetricsStore do
  @moduledoc "Small Prometheus exporter for the platform's critical telemetry events."

  use GenServer

  @events [
    [:phoenix, :endpoint, :stop],
    [:streamvault, :catalog, :reload],
    [:streamvault, :playback, :plan],
    [:streamvault, :shadow, :compare],
    [:streamvault, :shadow, :error]
  ]

  def start_link(options \\ []), do: GenServer.start_link(__MODULE__, options, name: __MODULE__)

  def render, do: GenServer.call(__MODULE__, :render)

  @impl true
  def init(_options) do
    :ok =
      :telemetry.attach_many(
        "streamvault-prometheus-store",
        @events,
        &__MODULE__.handle_event/4,
        self()
      )

    {:ok, %{counters: %{}, duration_sum_ms: %{}, last: %{}}}
  end

  def handle_event(event, measurements, metadata, server) do
    GenServer.cast(server, {:event, event, measurements, metadata})
  end

  @impl true
  def handle_cast({:event, event, measurements, metadata}, state) do
    key = event_key(event, metadata)
    duration = measurements[:duration] |> native_to_ms()

    updated = %{
      counters: Map.update(state.counters, key, 1, &(&1 + 1)),
      duration_sum_ms: Map.update(state.duration_sum_ms, key, duration, &(&1 + duration)),
      last: Map.put(state.last, key, measurements)
    }

    {:noreply, updated}
  end

  @impl true
  def handle_call(:render, _from, state) do
    lines =
      [
        "# HELP streamvault_events_total Count of instrumented platform events.",
        "# TYPE streamvault_events_total counter"
      ] ++
        Enum.flat_map(state.counters, fn {key, count} ->
          duration = Map.get(state.duration_sum_ms, key, 0.0)
          labels = labels(key)

          [
            "streamvault_events_total#{labels} #{count}",
            "streamvault_event_duration_milliseconds_sum#{labels} #{Float.round(duration, 3)}"
          ]
        end) ++
        [
          "# HELP streamvault_catalog_items Number of items in the active catalog generation.",
          "# TYPE streamvault_catalog_items gauge",
          "streamvault_catalog_items #{StreamVault.Catalog.stats()[:total] || 0}",
          "# HELP streamvault_playback_sessions Active playback sessions.",
          "# TYPE streamvault_playback_sessions gauge",
          "streamvault_playback_sessions #{length(StreamVault.Playback.sessions())}"
        ]

    {:reply, Enum.join(lines, "\n") <> "\n", state}
  end

  @impl true
  def terminate(_reason, _state) do
    :telemetry.detach("streamvault-prometheus-store")
  end

  defp event_key(event, metadata) do
    %{
      event: Enum.join(event, "."),
      strategy: metadata[:strategy],
      planner: metadata[:planner],
      path: safe_path(metadata[:path])
    }
  end

  defp safe_path(nil), do: nil
  defp safe_path(path), do: path |> to_string() |> String.split("?") |> List.first()

  defp labels(key) do
    key
    |> Enum.reject(fn {_name, value} -> is_nil(value) end)
    |> Enum.map_join(",", fn {name, value} -> "#{name}=\"#{escape(value)}\"" end)
    |> then(&"{#{&1}}")
  end

  defp escape(value),
    do: value |> to_string() |> String.replace("\\", "\\\\") |> String.replace("\"", "\\\"")

  defp native_to_ms(nil), do: 0.0
  defp native_to_ms(value), do: System.convert_time_unit(value, :native, :microsecond) / 1_000
end
