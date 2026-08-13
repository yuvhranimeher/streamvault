defmodule StreamVault.Core.NormalizerTest do
  use ExUnit.Case, async: true

  alias StreamVault.Core.Normalizer

  test "normalizes crawler records without losing the playback URL" do
    media =
      Normalizer.media(
        %{
          "title" => "Arrival.2016.1080p",
          "year" => "2016",
          "rating" => "8.0",
          "streamUrl" => "https://media.test/arrival.mp4"
        },
        :movie,
        0
      )

    assert media.title == "Arrival 2016 1080p"
    assert media.year == 2016
    assert media.rating == 8.0
    assert media.stream_url == "https://media.test/arrival.mp4"
    assert String.starts_with?(media.id, "movie_")
  end

  test "converts list-shaped seasons to the legacy map shape" do
    media =
      Normalizer.media(
        %{
          "title" => "Show",
          "seasons" => [%{"season" => "Season 2", "episodes" => [%{"filename" => "S02E01.mkv"}]}]
        },
        :series,
        0
      )

    assert [%{"episode" => 1, "filename" => "S02E01.mkv"}] = media.seasons["2"]
  end
end
