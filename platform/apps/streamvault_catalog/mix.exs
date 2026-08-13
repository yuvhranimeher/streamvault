defmodule StreamVault.Catalog.MixProject do
  use Mix.Project

  def project do
    [
      app: :streamvault_catalog,
      version: "2.0.0",
      build_path: "../../_build",
      config_path: "../../config/config.exs",
      deps_path: "../../deps",
      lockfile: "../../mix.lock",
      elixir: "~> 1.18",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [mod: {StreamVault.Catalog.Application, []}, extra_applications: [:logger]]
  end

  defp deps do
    [
      {:streamvault_core, in_umbrella: true},
      {:jason, "~> 1.4"},
      {:telemetry, "~> 1.3"}
    ]
  end
end
