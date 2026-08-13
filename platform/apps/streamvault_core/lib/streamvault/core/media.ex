defmodule StreamVault.Core.Media do
  @moduledoc "Canonical media entity shared by catalog, discovery, and playback."

  @enforce_keys [:id, :title, :kind]
  defstruct [
    :id,
    :title,
    :kind,
    :filename,
    :year,
    :category,
    :genre,
    :language,
    :rating,
    :poster,
    :backdrop,
    :overview,
    :stream_url,
    :server,
    :tmdb_id,
    :seasons,
    :inserted_at,
    search_text: "",
    source: :remote,
    tags: []
  ]

  @type kind :: :movie | :series
  @type t :: %__MODULE__{
          id: String.t(),
          title: String.t(),
          kind: kind(),
          year: integer() | nil,
          rating: float() | nil,
          stream_url: String.t() | nil,
          search_text: String.t()
        }

  @doc "Returns the existing frontend-compatible JSON representation."
  @spec to_legacy_map(t()) :: map()
  def to_legacy_map(%__MODULE__{} = media) do
    base = %{
      "id" => media.id,
      "name" => media.title,
      "title" => media.title,
      "type" => Atom.to_string(media.kind),
      "filename" => media.filename,
      "file" => media.filename,
      "year" => media.year || "",
      "category" => media.category || "",
      "genre" => media.genre || "",
      "language" => media.language || "",
      "rating" => media.rating,
      "poster" => media.poster,
      "backdrop" => media.backdrop || media.poster,
      "overview" => media.overview || "",
      "streamUrl" => media.stream_url,
      "server" => media.server,
      "tmdbId" => media.tmdb_id,
      "isFtp" => media.source == :remote
    }

    if media.kind == :series, do: Map.put(base, "seasons", media.seasons || %{}), else: base
  end
end
