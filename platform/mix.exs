defmodule StreamVault.Platform.MixProject do
  use Mix.Project

  def project do
    [
      apps_path: "apps",
      version: "2.0.0",
      start_permanent: Mix.env() == :prod,
      releases: [
        streamvault: [
          applications: [
            streamvault_core: :permanent,
            streamvault_catalog: :permanent,
            streamvault_playback: :permanent,
            streamvault_edge: :permanent
          ]
        ]
      ],
      deps: deps(),
      aliases: aliases(),
      preferred_cli_env: [quality: :test]
    ]
  end

  defp deps, do: []

  defp aliases do
    [
      setup: ["deps.get"],
      quality: ["format --check-formatted", "compile --warnings-as-errors", "test"]
    ]
  end
end
