defmodule StreamVault.Core.Page do
  @moduledoc "Bounded, explicit pagination used by every catalog endpoint."

  @enforce_keys [:items, :total, :page, :pages, :limit]
  defstruct [:items, :total, :page, :pages, :limit]

  @spec from_list(list(), map() | keyword(), keyword()) :: %__MODULE__{}
  def from_list(items, params, options \\ []) do
    origin = Keyword.get(options, :origin, 1)
    default_limit = Keyword.get(options, :default_limit, 24)
    max_limit = Keyword.get(options, :max_limit, 120)
    limit = params |> get("limit", default_limit) |> positive(default_limit) |> min(max_limit)
    page = params |> get("page", origin) |> non_negative(origin) |> max(origin)
    total = length(items)
    offset = (page - origin) * limit

    %__MODULE__{
      items: Enum.slice(items, offset, limit),
      total: total,
      page: page,
      pages: if(total == 0, do: 0, else: ceil(total / limit)),
      limit: limit
    }
  end

  defp get(params, key, default) when is_map(params), do: Map.get(params, key, default)
  defp get(params, key, default) when is_list(params), do: Keyword.get(params, String.to_atom(key), default)

  defp positive(value, default) do
    case parse(value) do
      number when number > 0 -> number
      _ -> default
    end
  end

  defp non_negative(value, default) do
    case parse(value) do
      number when number >= 0 -> number
      _ -> default
    end
  end

  defp parse(value) when is_integer(value), do: value
  defp parse(value) when is_binary(value) do
    case Integer.parse(value) do
      {number, _} -> number
      :error -> -1
    end
  end
  defp parse(_), do: -1
end
