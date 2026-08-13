defmodule StreamVault.Edge.MixProject do
  use Mix.Project

  def project do
    [
      app: :streamvault_edge,
      version: "2.0.0",
      build_path: "../../_build",
      config_path: "../../config/config.exs",
      deps_path: "../../deps",
      lockfile: "../../mix.lock",
      elixir: "~> 1.18",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [mod: {StreamVault.Edge.Application, []}, extra_applications: [:logger, :runtime_tools]]
  end

  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  defp deps do
    [
      {:streamvault_core, in_umbrella: true},
      {:streamvault_catalog, in_umbrella: true},
      {:streamvault_playback, in_umbrella: true},
      {:phoenix, "~> 1.8.11"},
      {:bandit, "~> 1.8"},
      {:jason, "~> 1.4"},
      {:req, "~> 0.5"},
      {:telemetry_metrics, "~> 1.1"},
      {:telemetry_poller, "~> 1.2"}
    ]
  end
end
