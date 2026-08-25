Mix.install(
  [
    {:bandit, "~> 1.7"},
    {:plug, "~> 1.17"},
    {:websock_adapter, "~> 0.5"},
    {:websockex, "~> 0.4"},
    {:jason, "~> 1.4"},
    {:finch, "~> 0.20"}
  ],
  consolidate_protocols: false
)

defmodule StreamVault.Paths do
  @moduledoc false

  @root System.get_env("SV_ELIXIR_VALIDATION_ROOT") || Path.expand(__DIR__)
  @media_root "C:\\Users\\Mac Mini\\Desktop\\Website Host\\Streaming_Website\\streamvault"
  @movies_dir "C:\\Users\\Mac Mini\\Desktop\\Website Host\\Streaming_Website\\streamvault\\movies"
  @series_dir "C:\\Users\\Mac Mini\\Desktop\\Website Host\\Streaming_Website\\streamvault\\series"

  def root, do: @root
  def media_root, do: @media_root
  def movies_dir, do: @movies_dir
  def series_dir, do: @series_dir
  def poster_cache, do: Path.join(@root, "poster-cache.json")
  def history, do: Path.join(@root, "watch-history.json")
  def file_index, do: Path.join(@root, "file-index.json")
  def channels, do: Path.join(@root, "channels.json")
  def massive_catalog, do: Path.join([@root, "scan-output", "clean-catalog.json"])
  def catalog, do: Path.join(@root, "catalog.json")
  def home_feed, do: Path.join(@root, "home-feed.json")
  def episode_cache, do: Path.join(@root, "episode-title-cache.json")
  def detail_cache, do: Path.join(@root, "detail-cache.json")
  def public, do: Path.join(@root, "public")
  def cache, do: Path.join(@root, "cache")
  def boot_search, do: Path.join(cache(), "boot-search-index.json")
  def mobile_hls, do: Path.join(cache(), "mobile-hls")
  def isolated_hls, do: Path.join(cache(), "hls")
  def mobile_converted, do: Path.join(cache(), "mobile-converted")
  def heavy_hls, do: Path.join(cache(), "heavy-compat-hls")
  def live_relay, do: Path.join(cache(), "live-relay")
  def logs, do: Path.join(@root, "logs")

  def software_catalog_candidates do
    [
      Path.join(@root, "software-catalog.json"),
      Path.join([@root, "data", "catalogs", "software-catalog.json"]),
      Path.join([@root, "data", "software-catalog.json"]),
      Path.join(@root, "downloads-catalog.json"),
      Path.join(@root, "download-catalog.json")
    ]
  end
end

defmodule StreamVault.SourceInventory do
  @moduledoc false

  @environment_variables ~w(
    API_FOOTBALL_KEY COMPAT_STREAM_SEEK_PREROLL_SEC DEBUG_DETAIL_RESET FFMPEG_BIN FFMPEG_PATH
    FFPROBE_BIN FFPROBE_PATH FIFA_LIVE_CACHE_MS FIFA_LIVE_DETAIL_FAST_CACHE_MS
    FIFA_LIVE_DETAIL_SLOW_CACHE_MS FIFA_LIVE_NEWS_CACHE_MS FIFA_LIVE_SEASON
    FIFA_LIVE_SLOW_CACHE_MS FIFA_LIVE_TIMEOUT_MS FOOTBALL_API_KEY HEAVY_COMPAT_HLS_AUDIO_BITRATE
    HEAVY_COMPAT_HLS_IDLE_MS HEAVY_COMPAT_HLS_MAX_SESSIONS HEAVY_COMPAT_HLS_PROFILE
    HEAVY_COMPAT_HLS_STARTUP_MS HEAVY_COMPAT_HLS_VIDEO_BUFSIZE HEAVY_COMPAT_HLS_VIDEO_CRF
    HEAVY_COMPAT_HLS_VIDEO_MAXRATE MEDIA_AUDIO_OFFSET_THRESHOLD_SEC MEDIA_FFMPEG_STARTUP_MS
    MEDIA_FFMPEG_STREAM_MAX MEDIA_PACKET_PROBE_TIMEOUT_MS MEDIA_PACKET_PROBE_WINDOW_SEC
    MEDIA_PACKET_SYNC_BACKGROUND MOBILE_COMPAT_HLS_IDLE_MS MOBILE_COMPAT_HLS_MAX_SESSIONS
    MOBILE_COMPAT_HLS_READY_MS MOBILE_HLS_AUDIO_BITRATE MOBILE_HLS_FFMPEG_THREADS MOBILE_HLS_IDLE_MS
    MOBILE_HLS_MAX_FPS MOBILE_HLS_MAX_SESSIONS MOBILE_HLS_MAX_WIDTH MOBILE_HLS_PROFILE
    MOBILE_HLS_VIDEO_BUFSIZE MOBILE_HLS_VIDEO_MAXRATE OMDB_API_KEY OMDB_KEY RAPIDAPI_KEY
    SMOOTH_AUDIO_BITRATE SMOOTH_BUFFER_TRIGGER_COUNT SMOOTH_MAX_WIDTH SMOOTH_VIDEO_BITRATE
    SMOOTH_VIDEO_BUFSIZE SV_BOOT_SEARCH_MAX_ITEMS SV_DETAIL_VERBOSE SV_LIVE_DEBUG
    SV_LIVE_FAST_MEDIA_SEGMENT_WINDOW SV_LIVE_FAST_PLAYLIST_TIMEOUT_MS SV_LIVE_MEDIA_SEGMENT_WINDOW
    SV_LIVE_PLAYLIST_TIMEOUT_MS SV_LIVE_RELAY_IDLE_MS SV_LIVE_RELAY_SEGMENT_WAIT_MS
    SV_LIVE_RELAY_STALE_MS SV_LIVE_RELAY_STARTUP_MS SV_LIVE_SEGMENT_ADVANCE_RETRIES
    SV_LIVE_SEGMENT_CACHE_MAX_BYTES SV_LIVE_SEGMENT_CACHE_MAX_PER_CHANNEL
    SV_LIVE_SEGMENT_CACHE_MAX_SEGMENT_BYTES SV_LIVE_SEGMENT_CACHE_TTL_MS SV_PLAYBACK_VERBOSE
    SV_SEARCH_CACHE_LIMIT SV_SEARCH_CANDIDATE_LIMIT SV_SEARCH_NO_POSTER_CAP SV_SEARCH_RESULT_CAP
    SV_SEARCH_WARMUP SV_SEARCH_WARMUP_DELAY_MS YOUTUBE_API_KEY YT_API_KEY
  )

  @local_module_imports ["./middleware/tracker", "./routes/dashboard", "./infra-telemetry"]

  def environment_variables, do: @environment_variables
  def local_module_imports, do: @local_module_imports
end

defmodule StreamVault.JS do
  @moduledoc false

  def truthy?(nil), do: false
  def truthy?(false), do: false
  def truthy?(0), do: false
  def truthy?(n) when is_float(n) and n != n, do: false
  def truthy?(""), do: false
  def truthy?(_), do: true

  def js_or(left, right), do: if(truthy?(left), do: left, else: lazy_value(right))
  def nullish(left, right) when is_nil(left), do: lazy_value(right)
  def nullish(left, _right), do: left
  defp lazy_value(fun) when is_function(fun, 0), do: fun.()
  defp lazy_value(value), do: value

  def string(nil), do: "undefined"
  def string(true), do: "true"
  def string(false), do: "false"
  def string(value) when is_binary(value), do: value
  def string(value) when is_integer(value), do: Integer.to_string(value)

  def string(value) when is_float(value),
    do: :erlang.float_to_binary(value, [:compact, decimals: 15])

  def string(value), do: to_string(value)

  def trim(value), do: value |> string() |> String.trim()
  def lower(value), do: value |> string() |> String.downcase()

  def number(nil), do: 0
  def number(false), do: 0
  def number(true), do: 1
  def number(""), do: 0
  def number(value) when is_integer(value) or is_float(value), do: value

  def number(value) when is_binary(value) do
    value = String.trim(value)

    cond do
      value == "" ->
        0

      true ->
        case Float.parse(value) do
          {number, ""} -> normalize_number(number)
          _ -> :nan
        end
    end
  end

  def number(_), do: :nan

  def finite?(value) when is_integer(value), do: true

  def finite?(value) when is_float(value),
    do: value == value and value not in [:infinity, :neg_infinity]

  def finite?(_), do: false

  def parse_int(value, radix \\ 10) do
    value = value |> string() |> String.trim_leading()
    sign = if String.starts_with?(value, "-"), do: -1, else: 1
    unsigned = String.trim_leading(value, "+-")

    digits =
      unsigned
      |> String.graphemes()
      |> Enum.take_while(fn digit -> digit_value(digit) < radix end)
      |> Enum.join()

    case Integer.parse(digits, radix) do
      {integer, _} -> integer * sign
      :error -> :nan
    end
  end

  def parse_float(value) do
    value = value |> string() |> String.trim_leading()

    case Regex.run(~r/^[+-]?(?:(?:\d+\.?\d*)|(?:\.\d+))(?:[eE][+-]?\d+)?/, value) do
      [match] ->
        case Float.parse(match) do
          {number, _} -> normalize_number(number)
          :error -> :nan
        end

      _ ->
        :nan
    end
  end

  def clamp(value, low, high), do: max(low, min(high, value))
  def date_now, do: System.system_time(:millisecond)
  def monotonic_ms, do: System.monotonic_time(:millisecond)

  def safe_decode(value) do
    value = string(value)

    try do
      URI.decode(value)
    rescue
      _ -> value
    end
  end

  def encode_component(value), do: value |> string() |> URI.encode(&URI.char_unreserved?/1)

  def get(map, key, default \\ nil)

  def get(map, key, default) when is_map(map),
    do: Map.get(map, key, Map.get(map, to_string(key), default))

  def get(_map, _key, default), do: default

  def array(value) when is_list(value), do: value
  def array(_), do: []

  def json_clone(value) do
    value |> Jason.encode!() |> Jason.decode!()
  rescue
    _ -> value
  end

  def timeout(fun, milliseconds, fallback) when is_function(fun, 0) do
    task = Task.async(fun)

    case Task.yield(task, milliseconds) || Task.shutdown(task, :brutal_kill) do
      {:ok, result} -> result
      _ -> fallback
    end
  end

  defp normalize_number(number) when trunc(number) == number, do: trunc(number)
  defp normalize_number(number), do: number
  defp digit_value(<<digit>>) when digit in ?0..?9, do: digit - ?0
  defp digit_value(<<digit>>) when digit in ?a..?z, do: digit - ?a + 10
  defp digit_value(<<digit>>) when digit in ?A..?Z, do: digit - ?A + 10
  defp digit_value(_), do: 36
end

defmodule StreamVault.Env do
  @moduledoc false

  def string(name, default), do: System.get_env(name) || default

  def number(name, default) do
    case StreamVault.JS.number(System.get_env(name) || default) do
      :nan -> 0
      value -> value
    end
  end

  def flag(name), do: System.get_env(name) == "1"
  def enabled_unless_zero(name), do: System.get_env(name) != "0"
end

defmodule StreamVault.State do
  @moduledoc false
  use GenServer

  def start_link(initial \\ %{}), do: GenServer.start_link(__MODULE__, initial, name: __MODULE__)
  def get(key, default \\ nil), do: GenServer.call(__MODULE__, {:get, key, default}, :infinity)
  def put(key, value), do: GenServer.call(__MODULE__, {:put, key, value}, :infinity)
  def delete(key), do: GenServer.call(__MODULE__, {:delete, key}, :infinity)

  def update(key, default \\ nil, fun),
    do: GenServer.call(__MODULE__, {:update, key, default, fun}, :infinity)

  def get_and_update(key, default \\ nil, fun),
    do: GenServer.call(__MODULE__, {:get_and_update, key, default, fun}, :infinity)

  def transaction(fun), do: GenServer.call(__MODULE__, {:transaction, fun}, :infinity)
  def snapshot, do: GenServer.call(__MODULE__, :snapshot, :infinity)

  @impl true
  def init(initial), do: {:ok, initial}

  @impl true
  def handle_call({:get, key, default}, _from, state),
    do: {:reply, Map.get(state, key, default), state}

  def handle_call({:put, key, value}, _from, state),
    do: {:reply, value, Map.put(state, key, value)}

  def handle_call({:delete, key}, _from, state) do
    {value, state} = Map.pop(state, key)
    {:reply, value, state}
  end

  def handle_call({:update, key, default, fun}, _from, state) do
    value = fun.(Map.get(state, key, default))
    {:reply, value, Map.put(state, key, value)}
  end

  def handle_call({:get_and_update, key, default, fun}, _from, state) do
    {reply, value} = fun.(Map.get(state, key, default))
    {:reply, reply, Map.put(state, key, value)}
  end

  def handle_call({:transaction, fun}, _from, state) do
    {reply, next_state} = fun.(state)
    {:reply, reply, next_state}
  end

  def handle_call(:snapshot, _from, state), do: {:reply, state, state}
end

defmodule StreamVault.Files do
  @moduledoc false

  def read_json(file, fallback) do
    with {:ok, body} <- File.read(file),
         {:ok, value} <- Jason.decode(body) do
      value
    else
      _ -> fallback
    end
  end

  def write_json(file, value, pretty \\ true) do
    options = if pretty, do: [pretty: true], else: []

    with :ok <- File.mkdir_p(Path.dirname(file)),
         {:ok, encoded} <- Jason.encode(value, options),
         :ok <- File.write(file, encoded) do
      :ok
    end
  rescue
    _ -> :error
  end

  def atomic_write(file, body) do
    temporary = file <> ".tmp"

    with :ok <- File.mkdir_p(Path.dirname(file)),
         :ok <- File.write(temporary, body),
         :ok <- replace(temporary, file) do
      :ok
    end
  end

  defp replace(source, target) do
    _ = File.rm(target)
    File.rename(source, target)
  end

  def contained?(root, candidate) do
    root = Path.expand(root)
    candidate = Path.expand(candidate)

    {root, candidate} =
      if match?({:win32, _}, :os.type()) do
        {String.downcase(root), String.downcase(candidate)}
      else
        {root, candidate}
      end

    candidate == root or String.starts_with?(candidate, root <> "\\") or
      String.starts_with?(candidate, root <> "/")
  end

  def rm_rf_inside(root, candidate) do
    if contained?(root, candidate) and Path.expand(root) != Path.expand(candidate),
      do: File.rm_rf(candidate),
      else: {:error, :outside_root}
  end

  def stream_file(conn, file, offset, length, chunk_size \\ 64 * 1024) do
    case :file.open(String.to_charlist(file), [:read, :binary, :raw]) do
      {:ok, io} ->
        try do
          :ok = :file.position(io, offset) |> position_ok()
          stream_file_loop(conn, io, length, chunk_size)
        after
          :file.close(io)
        end

      {:error, _} ->
        Plug.Conn.send_resp(conn, 500, "")
    end
  end

  defp position_ok({:ok, _}), do: :ok
  defp position_ok(:ok), do: :ok

  defp stream_file_loop(conn, _io, remaining, _chunk_size) when remaining <= 0, do: conn

  defp stream_file_loop(conn, io, remaining, chunk_size) do
    count = min(remaining, chunk_size)

    case :file.read(io, count) do
      {:ok, data} ->
        case Plug.Conn.chunk(conn, data) do
          {:ok, next_conn} ->
            stream_file_loop(next_conn, io, remaining - byte_size(data), chunk_size)

          {:error, _} ->
            conn
        end

      :eof ->
        conn

      {:error, _} ->
        conn
    end
  end
end

defmodule StreamVault.Command do
  @moduledoc false

  def executable(kind) do
    configured =
      case kind do
        :ffmpeg -> System.get_env("FFMPEG_BIN") || System.get_env("FFMPEG_PATH") || "ffmpeg"
        :ffprobe -> System.get_env("FFPROBE_BIN") || System.get_env("FFPROBE_PATH") || "ffprobe"
      end

    System.find_executable(configured) || configured
  end

  def open(executable, arguments, options \\ []) do
    port_options = [
      :binary,
      :exit_status,
      :use_stdio,
      args: Enum.map(arguments, &to_charlist/1)
    ]

    Port.open({:spawn_executable, to_charlist(executable)}, port_options ++ options)
  end

  def collect(executable, arguments, timeout_ms, max_bytes \\ 16 * 1024 * 1024) do
    try do
      port = open(executable, arguments)
      timer = Process.send_after(self(), {:command_timeout, port}, timeout_ms)
      result = collect_loop(port, timer, [], 0, max_bytes, "")
      Process.cancel_timer(timer)
      result
    rescue
      error -> {:error, Exception.message(error)}
    end
  end

  defp collect_loop(port, timer, output, size, max_bytes, stderr) do
    receive do
      {^port, {:data, data}} when size + byte_size(data) <= max_bytes ->
        collect_loop(port, timer, [data | output], size + byte_size(data), max_bytes, stderr)

      {^port, {:data, _data}} ->
        terminate(port)
        {:error, :response_too_large}

      {^port, {:exit_status, status}} ->
        Process.cancel_timer(timer)
        body = output |> Enum.reverse() |> IO.iodata_to_binary()

        if status == 0,
          do: {:ok, body},
          else: {:error, %{status: status, output: body, stderr: stderr}}

      {:command_timeout, ^port} ->
        terminate(port)
        {:error, :timeout}
    end
  end

  def stream(conn, executable, arguments, startup_timeout, content_type \\ "video/mp4") do
    try do
      port = open(executable, arguments)
      monitor = Process.monitor(port)
      stream_port_wait(conn, port, monitor, startup_timeout, content_type)
    rescue
      _ -> Plug.Conn.send_resp(conn, 500, "FFmpeg error")
    end
  end

  defp stream_port_wait(conn, port, monitor, timeout, content_type) do
    receive do
      {^port, {:data, data}} ->
        conn =
          conn
          |> Plug.Conn.put_resp_content_type(content_type)
          |> Plug.Conn.send_chunked(200)

        stream_port_loop(conn, port, monitor, data)

      {^port, {:exit_status, _status}} ->
        Process.demonitor(monitor, [:flush])
        Plug.Conn.send_resp(conn, 502, "FFmpeg failed")

      {:DOWN, ^monitor, :port, ^port, _reason} ->
        Plug.Conn.send_resp(conn, 502, "FFmpeg failed")
    after
      timeout ->
        terminate(port)
        Plug.Conn.send_resp(conn, 504, "FFmpeg startup timeout")
    end
  end

  defp stream_port_loop(conn, port, monitor, initial) do
    case Plug.Conn.chunk(conn, initial) do
      {:ok, conn} ->
        stream_port_receive(conn, port, monitor)

      {:error, _} ->
        terminate(port)
        conn
    end
  end

  defp stream_port_receive(conn, port, monitor) do
    receive do
      {^port, {:data, data}} ->
        case Plug.Conn.chunk(conn, data) do
          {:ok, conn} ->
            stream_port_receive(conn, port, monitor)

          {:error, _} ->
            terminate(port)
            conn
        end

      {^port, {:exit_status, _status}} ->
        Process.demonitor(monitor, [:flush])
        conn

      {:DOWN, ^monitor, :port, ^port, _reason} ->
        conn
    end
  end

  def terminate(port) when is_port(port) do
    os_pid =
      case Port.info(port, :os_pid) do
        {:os_pid, pid} -> pid
        _ -> nil
      end

    try do
      Port.close(port)
    rescue
      _ -> :ok
    end

    if match?({:win32, _}, :os.type()) and os_pid do
      _ =
        System.cmd("taskkill", ["/PID", Integer.to_string(os_pid), "/T", "/F"],
          stderr_to_stdout: true
        )
    end

    :ok
  end
end

defmodule StreamVault.HTTP do
  @moduledoc false

  def request(method, url, headers \\ [], body \\ nil, options \\ []) do
    request = Finch.build(method, url, normalize_headers(headers), body)
    timeout = Keyword.get(options, :timeout, 15_000)
    receive_timeout = Keyword.get(options, :receive_timeout, timeout)

    Finch.request(request, StreamVault.Finch,
      pool_timeout: timeout,
      receive_timeout: receive_timeout
    )
  end

  def request_json(method, url, headers \\ [], body \\ nil, options \\ []) do
    with {:ok, response} <- request(method, url, headers, body, options),
         true <- response.status >= 200 and response.status < 300,
         {:ok, decoded} <- Jason.decode(response.body) do
      {:ok, decoded, response}
    else
      false -> {:error, :http_status}
      error -> error
    end
  end

  def stream(conn, method, url, headers \\ [], options \\ []) do
    request = Finch.build(method, url, normalize_headers(headers))
    timeout = Keyword.get(options, :timeout, 30_000)
    initial = %{conn: conn, status: 200, headers: [], started: false}

    case Finch.stream(request, StreamVault.Finch, initial, &stream_event/2,
           pool_timeout: timeout,
           receive_timeout: timeout
         ) do
      {:ok, %{conn: conn}} -> conn
      {:error, _reason, %{conn: %{state: :unset} = conn}} -> Plug.Conn.send_resp(conn, 502, "")
      {:error, _reason, %{conn: conn}} -> conn
    end
  end

  defp stream_event({:status, status}, state), do: %{state | status: status}
  defp stream_event({:headers, headers}, state), do: %{state | headers: headers}

  defp stream_event({:data, data}, %{started: false} = state) do
    conn =
      Enum.reduce(state.headers, state.conn, fn {name, value}, conn ->
        if hop_by_hop?(name),
          do: conn,
          else: Plug.Conn.put_resp_header(conn, String.downcase(name), value)
      end)
      |> Plug.Conn.send_chunked(state.status)

    case Plug.Conn.chunk(conn, data) do
      {:ok, conn} -> %{state | conn: conn, started: true}
      {:error, reason} -> raise "remote stream closed: #{inspect(reason)}"
    end
  end

  defp stream_event({:data, data}, state) do
    case Plug.Conn.chunk(state.conn, data) do
      {:ok, conn} -> %{state | conn: conn}
      {:error, reason} -> raise "remote stream closed: #{inspect(reason)}"
    end
  end

  defp normalize_headers(headers),
    do: Enum.map(headers, fn {key, value} -> {to_string(key), to_string(value)} end)

  defp hop_by_hop?(name),
    do:
      String.downcase(name) in [
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade"
      ]
end

defmodule StreamVault.Response do
  @moduledoc false

  def json(conn, value, status \\ 200) do
    body = Jason.encode!(value)

    conn
    |> Plug.Conn.put_resp_content_type("application/json")
    |> Plug.Conn.send_resp(status, body)
  end

  def text(conn, value, status \\ 200, content_type \\ "text/plain; charset=utf-8") do
    conn
    |> Plug.Conn.put_resp_content_type(content_type)
    |> Plug.Conn.send_resp(status, value)
  end

  def empty(conn, status), do: Plug.Conn.send_resp(conn, status, "")

  def redirect(conn, location, status \\ 302) do
    conn
    |> Plug.Conn.put_resp_header("location", location)
    |> Plug.Conn.send_resp(status, "Found. Redirecting to #{location}")
  end

  def json_error(conn, status, code, message, details \\ %{}) do
    json(
      conn,
      Map.merge(%{"ok" => false, "code" => code, "error" => message}, stringify_keys(details)),
      status
    )
  end

  def put_headers(conn, headers) do
    Enum.reduce(headers, conn, fn {name, value}, conn ->
      Plug.Conn.put_resp_header(conn, String.downcase(to_string(name)), to_string(value))
    end)
  end

  defp stringify_keys(map) when is_map(map),
    do: Map.new(map, fn {key, value} -> {to_string(key), value} end)

  defp stringify_keys(_), do: %{}
end

defmodule StreamVault.Range do
  @moduledoc false

  def parse_single(nil, _size), do: :none

  def parse_single(header, size) when is_binary(header) and is_integer(size) and size >= 0 do
    case Regex.run(~r/^bytes=(\d*)-(\d*)$/, String.trim(header)) do
      [_, "", ""] ->
        :invalid

      [_, "", suffix] ->
        with {count, ""} <- Integer.parse(suffix),
             true <- count > 0 do
          start = max(0, size - count)
          {:ok, start, max(0, size - 1), max(0, size - start)}
        else
          _ -> :invalid
        end

      [_, first, last] ->
        with {start, ""} <- Integer.parse(first),
             true <- start < size,
             {:ok, finish} <- parse_finish(last, size - 1),
             true <- finish >= start do
          {:ok, start, finish, finish - start + 1}
        else
          _ -> :invalid
        end

      _ ->
        :invalid
    end
  end

  def parse_single(_, _), do: :invalid
  defp parse_finish("", maximum), do: {:ok, maximum}

  defp parse_finish(value, maximum) do
    case Integer.parse(value) do
      {finish, ""} -> {:ok, min(finish, maximum)}
      _ -> :invalid
    end
  end
end

defmodule StreamVault.Core do
  @moduledoc false

  alias StreamVault.{Command, Files, HTTP, JS, Paths, Response, State}

  @tmdb_token "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzMzBlNWEzOTMzNzcxYjNkZjgxNTg5NzQ1N2E5MGFjOCIsIm5iZiI6MTc3NTk3MDAxNy40NTcsInN1YiI6IjY5ZGIyNmUxNGVjZGE5YWU1MzAyNzFjZSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.QiajIRSY3s_J4sRSbnT7Jl70XK3zpROtMn8Pumzyn_M"
  @tmdb_image "https://image.tmdb.org/t/p"
  @tmdb_genres %{
    28 => "Action",
    12 => "Adventure",
    16 => "Animation",
    35 => "Comedy",
    80 => "Crime",
    99 => "Documentary",
    18 => "Drama",
    10_751 => "Family",
    14 => "Fantasy",
    36 => "History",
    27 => "Horror",
    10_402 => "Music",
    9_648 => "Mystery",
    10_749 => "Romance",
    878 => "Sci-Fi",
    53 => "Thriller",
    10_752 => "War",
    37 => "Western",
    10_759 => "Action & Adventure",
    10_762 => "Kids",
    10_763 => "News",
    10_764 => "Reality",
    10_765 => "Sci-Fi & Fantasy",
    10_766 => "Soap",
    10_767 => "Talk",
    10_768 => "War & Politics"
  }
  @video_exts ~w(.mp4 .mkv .avi .mov .webm .flv .wmv .m4v .mpg .mpeg .3gp)
  @subtitle_exts ~w(.srt .vtt .ass .ssa)
  @mime %{
    ".mp4" => "video/mp4",
    ".m4v" => "video/mp4",
    ".mkv" => "video/x-matroska",
    ".avi" => "video/x-msvideo",
    ".mov" => "video/quicktime",
    ".webm" => "video/webm",
    ".ogv" => "video/ogg",
    ".ogg" => "video/ogg",
    ".flv" => "video/x-flv",
    ".wmv" => "video/x-ms-wmv",
    ".mpg" => "video/mpeg",
    ".mpeg" => "video/mpeg",
    ".3gp" => "video/3gpp"
  }
  @quality_tiers %{
    "auto" => nil,
    "1080p" => 5_000_000,
    "720p" => 2_500_000,
    "480p" => 1_000_000,
    "360p" => 500_000
  }
  @search_stopwords MapSet.new(~w(in on of to a an the and or for with by from))
  @boot_search_version "20260624-playable-only-search1"
  @boot_search_fields ~w(id title normalizedTitle year type poster route rating isFtp hasStream seasonCount episodeCount)

  defmodule RemoteURLError do
    defexception [
      :message,
      :status,
      :code,
      :requested_url,
      :decoded_url,
      :playback_type,
      :fallback_reason,
      :block_reason
    ]
  end

  def video_exts, do: @video_exts
  def subtitle_exts, do: @subtitle_exts
  def mime_types, do: @mime
  def quality_tiers, do: @quality_tiers
  def tmdb_token, do: @tmdb_token
  def tmdb_image, do: @tmdb_image

  def config(key) do
    case key do
      :mobile_hls_idle_ms ->
        env_number("MOBILE_HLS_IDLE_MS", 900_000)

      :mobile_hls_max_sessions ->
        env_number("MOBILE_HLS_MAX_SESSIONS", 6)

      :mobile_hls_ffmpeg_threads ->
        System.get_env("MOBILE_HLS_FFMPEG_THREADS") || "1"

      :mobile_hls_profile ->
        System.get_env("MOBILE_HLS_PROFILE") || "mobile-hls-v4-av-sync"

      :mobile_hls_max_width ->
        env_number("MOBILE_HLS_MAX_WIDTH", 854)

      :mobile_hls_max_fps ->
        env_number("MOBILE_HLS_MAX_FPS", 24)

      :mobile_hls_video_maxrate ->
        System.get_env("MOBILE_HLS_VIDEO_MAXRATE") || "1200k"

      :mobile_hls_video_bufsize ->
        System.get_env("MOBILE_HLS_VIDEO_BUFSIZE") || "2400k"

      :mobile_hls_audio_bitrate ->
        System.get_env("MOBILE_HLS_AUDIO_BITRATE") || "96k"

      :mobile_compat_hls_idle_ms ->
        env_number("MOBILE_COMPAT_HLS_IDLE_MS", 90_000)

      :mobile_compat_hls_max_sessions ->
        env_number("MOBILE_COMPAT_HLS_MAX_SESSIONS", 4)

      :mobile_compat_hls_ready_ms ->
        env_number("MOBILE_COMPAT_HLS_READY_MS", 20_000)

      :mobile_converted_min_bytes ->
        500 * 1024

      :heavy_compat_hls_profile ->
        System.get_env("HEAVY_COMPAT_HLS_PROFILE") || "heavy-compat-hls-v2-av-sync"

      :heavy_compat_hls_idle_ms ->
        env_number("HEAVY_COMPAT_HLS_IDLE_MS", 30 * 60 * 1000)

      :heavy_compat_hls_max_sessions ->
        env_number("HEAVY_COMPAT_HLS_MAX_SESSIONS", 4)

      :heavy_compat_hls_startup_segments ->
        1

      :heavy_compat_hls_startup_ms ->
        env_number("HEAVY_COMPAT_HLS_STARTUP_MS", 45_000)

      :heavy_compat_hls_segment_time ->
        2

      :heavy_compat_hls_video_crf ->
        System.get_env("HEAVY_COMPAT_HLS_VIDEO_CRF") || "23"

      :heavy_compat_hls_video_maxrate ->
        System.get_env("HEAVY_COMPAT_HLS_VIDEO_MAXRATE") || "2500k"

      :heavy_compat_hls_video_bufsize ->
        System.get_env("HEAVY_COMPAT_HLS_VIDEO_BUFSIZE") || "5000k"

      :heavy_compat_hls_audio_bitrate ->
        System.get_env("HEAVY_COMPAT_HLS_AUDIO_BITRATE") || "128k"

      :smooth_max_width ->
        clamp_number(env_number("SMOOTH_MAX_WIDTH", 1920), 480, 3840, 1920)

      :smooth_video_bitrate ->
        System.get_env("SMOOTH_VIDEO_BITRATE") || "5000k"

      :smooth_video_bufsize ->
        System.get_env("SMOOTH_VIDEO_BUFSIZE") || "10000k"

      :smooth_audio_bitrate ->
        System.get_env("SMOOTH_AUDIO_BITRATE") || "128k"

      :smooth_buffer_trigger_count ->
        max(1, nonzero_number(env_number("SMOOTH_BUFFER_TRIGGER_COUNT", 3), 3))

      :media_ffmpeg_stream_max ->
        env_number("MEDIA_FFMPEG_STREAM_MAX", 5)

      :media_ffmpeg_startup_ms ->
        env_number("MEDIA_FFMPEG_STARTUP_MS", 15_000)

      :media_audio_offset_threshold_sec ->
        env_number("MEDIA_AUDIO_OFFSET_THRESHOLD_SEC", 0.05)

      :media_packet_probe_window_sec ->
        env_number("MEDIA_PACKET_PROBE_WINDOW_SEC", 20)

      :media_packet_probe_timeout_ms ->
        env_number("MEDIA_PACKET_PROBE_TIMEOUT_MS", 12_000)

      :media_packet_sync_background ->
        System.get_env("MEDIA_PACKET_SYNC_BACKGROUND") != "0"

      :compat_stream_seek_preroll_sec ->
        clamp_number(nonzero_number(env_number("COMPAT_STREAM_SEEK_PREROLL_SEC", 4), 0), 0, 8, 0)

      :playback_verbose ->
        System.get_env("SV_PLAYBACK_VERBOSE") == "1"

      :detail_verbose ->
        System.get_env("SV_DETAIL_VERBOSE") == "1"

      :compat_video_pts_filter ->
        "setpts=PTS-STARTPTS"

      :compat_audio_pts_filter ->
        "asetpts=PTS-STARTPTS,aresample=async=1"

      :omdb_key ->
        System.get_env("OMDB_API_KEY") || System.get_env("OMDB_KEY") || ""

      :youtube_api_key ->
        System.get_env("YOUTUBE_API_KEY") || System.get_env("YT_API_KEY") || ""

      :search_cache_limit ->
        env_number("SV_SEARCH_CACHE_LIMIT", 160)

      :search_candidate_limit ->
        env_number("SV_SEARCH_CANDIDATE_LIMIT", 6000)

      :boot_search_max_items ->
        env_number("SV_BOOT_SEARCH_MAX_ITEMS", 50_000)

      _ ->
        nil
    end
  end

  def initialize_state do
    poster_cache = load_json(Paths.poster_cache(), %{})
    watch_history = load_json(Paths.history(), %{})
    channels = load_json(Paths.channels(), [])
    ftp_catalog = load_json(Paths.catalog(), %{"movies" => [], "series" => []})

    State.transaction(fn state ->
      initial = %{
        poster_cache: poster_cache,
        watch_history: watch_history,
        file_index: [],
        channels: channels,
        ftp_catalog: ftp_catalog,
        movie_list: nil,
        series_list: nil,
        enrich_busy: false,
        deduped_movies: nil,
        deduped_series: nil,
        massive_catalog_loaded: false,
        massive_movies: [],
        massive_series: [],
        poster_bridge: nil,
        fast_search_index: nil,
        fast_search_index_stamp: "",
        query_result_cache: ordered_cache(),
        boot_search_index: nil,
        boot_search_stamp: "",
        boot_search_all_items: nil,
        boot_search_file_payload: nil,
        boot_search_file_stamp: "",
        boot_search_file_json: "",
        boot_search_file_gzip: nil,
        media_info_cache: ordered_cache(),
        media_audio_info_cache: ordered_cache(),
        media_duration_info_cache: ordered_cache(),
        playback_audio_selection_cache: ordered_cache(),
        ftp_decoded_audio_validation_cache: ordered_cache(),
        tmdb_queue: [],
        tmdb_busy: false,
        active_media_ffmpeg_streams: 0
      }

      {:ok, Map.merge(initial, state)}
    end)
  end

  def poster_cache, do: State.get(:poster_cache, %{})
  def watch_history, do: State.get(:watch_history, %{})
  def file_index, do: State.get(:file_index, [])
  def channels, do: State.get(:channels, [])
  def ftp_catalog, do: State.get(:ftp_catalog, %{"movies" => [], "series" => []})
  def movie_list, do: State.get(:movie_list)
  def series_list, do: State.get(:series_list)
  def massive_movies, do: State.get(:massive_movies, [])
  def massive_series, do: State.get(:massive_series, [])

  # JavaScript source: streamStartSeconds(value)
  def stream_start_seconds(value) do
    case JS.number(value) do
      number when is_number(number) -> number
      _ -> 0
    end
  end

  # JavaScript source: roundedSeconds(value)
  def rounded_seconds(value) do
    case JS.number(value) do
      number when is_number(number) -> (number * 1.0) |> Float.round(6) |> normalize_whole()
      _ -> 0
    end
  end

  # JavaScript source: getMediaInfo(filePath)
  def get_media_info(file_path) do
    args = [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_streams",
      "-show_format",
      to_string(file_path)
    ]

    case Command.collect(Command.executable(:ffprobe), args, 20_000) do
      {:ok, stdout} ->
        info = Jason.decode!(stdout)
        streams = list(m(info, "streams", []))
        format = m(info, "format", %{})
        source_name = Path.basename(to_string(file_path || ""))

        audio_tracks =
          streams
          |> Enum.filter(&(m(&1, "codec_type") == "audio"))
          |> Enum.with_index()
          |> Enum.map(fn {stream, index} -> audio_track(stream, index, format, false) end)

        subtitle_tracks =
          streams
          |> Enum.filter(&(m(&1, "codec_type") == "subtitle"))
          |> Enum.with_index()
          |> Enum.map(fn {stream, index} ->
            %{
              "index" => m(stream, "index"),
              "streamIndex" => m(stream, "index"),
              "relativeIndex" => index,
              "codec" => m(stream, "codec_name"),
              "language" => nested(stream, ["tags", "language"], "und"),
              "title" =>
                nested(stream, ["tags", "title"], nil) ||
                  subtitle_label_from_name(source_name, "Subtitle #{index + 1}"),
              "default" => nested(stream, ["disposition", "default"], 0) == 1,
              "forced" => nested(stream, ["disposition", "forced"], 0) == 1
            }
          end)

        video = Enum.find(streams, &(m(&1, "codec_type") == "video")) || %{}

        %{
          "audioTracks" => audio_tracks,
          "subtitleTracks" => subtitle_tracks,
          "videoCodec" => m(video, "codec_name", "unknown") || "unknown",
          "videoIndex" => if(m(video, "index") == nil, do: 0, else: m(video, "index")),
          "videoStartTime" => stream_start_seconds(m(video, "start_time")),
          "duration" => parse_float_or_zero(m(format, "duration")),
          "container" => m(format, "format_name", "unknown") || "unknown"
        }

      {:error, :timeout} ->
        raise "ffprobe timed out"

      {:error, error} ->
        raise "ffprobe failed: #{command_error(error)}"
    end
  end

  # JavaScript source: getAudioOnlyMediaInfo(filePath)
  def get_audio_only_media_info(file_path) do
    entries =
      "stream=index,codec_type,codec_name,duration,start_time,bit_rate,channels,channel_layout,nb_frames:stream_tags=language,title:stream_disposition=default,forced:format=duration"

    args = [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_entries",
      entries,
      to_string(file_path)
    ]

    case Command.collect(Command.executable(:ffprobe), args, 45_000) do
      {:ok, stdout} ->
        info = Jason.decode!(stdout)
        streams = list(m(info, "streams", []))
        format = m(info, "format", %{})
        video = Enum.find(streams, &(m(&1, "codec_type") == "video")) || %{}

        tracks =
          streams
          |> Enum.filter(&(m(&1, "codec_type") == "audio"))
          |> Enum.with_index()
          |> Enum.map(fn {s, i} -> audio_track(s, i, format, true) end)

        %{
          "audioTracks" => tracks,
          "subtitleTracks" => [],
          "videoCodec" => m(video, "codec_name", "unknown") || "unknown",
          "videoIndex" => m(video, "index", 0) || 0,
          "videoStartTime" => stream_start_seconds(m(video, "start_time")),
          "duration" => 0,
          "container" => "unknown"
        }

      {:error, :timeout} ->
        raise "audio ffprobe timed out"

      {:error, error} ->
        raise "audio ffprobe failed: #{command_error(error)}"
    end
  end

  # JavaScript source: getDurationOnlyMediaInfo(filePath)
  def get_duration_only_media_info(file_path) do
    args = [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_entries",
      "format=duration",
      to_string(file_path)
    ]

    case Command.collect(Command.executable(:ffprobe), args, 15_000) do
      {:ok, stdout} ->
        %{
          "duration" =>
            stdout
            |> Jason.decode!()
            |> nested(["format", "duration"], nil)
            |> parse_float_or_zero()
        }

      {:error, :timeout} ->
        raise "duration ffprobe timed out"

      {:error, error} ->
        raise "duration ffprobe failed: #{command_error(error)}"
    end
  end

  # JavaScript source: getCachedMediaInfo(filePath)
  def get_cached_media_info(file_path) do
    {map_key, cache_key} = media_cache_identity(file_path, true)
    cache = State.get(:media_info_cache, ordered_cache())

    case ordered_cache_get(cache, map_key) do
      %{"cacheKey" => ^cache_key, "value" => value} ->
        value

      _ ->
        value = get_media_info(file_path)

        State.put(
          :media_info_cache,
          ordered_cache_put(cache, map_key, %{"cacheKey" => cache_key, "value" => value}, 200)
        )

        value
    end
  end

  # JavaScript source: getCachedAudioOnlyMediaInfo(filePath)
  def get_cached_audio_only_media_info(file_path) do
    {map_key, cache_key} = media_cache_identity(file_path, false)
    cache = State.get(:media_audio_info_cache, ordered_cache())

    case ordered_cache_get(cache, map_key) do
      %{"cacheKey" => ^cache_key, "value" => value} ->
        value

      _ ->
        full = ordered_cache_get(State.get(:media_info_cache, ordered_cache()), map_key)

        if is_map(full) and m(full, "cacheKey") == cache_key do
          State.put(:media_audio_info_cache, ordered_cache_put(cache, map_key, full, 200))
          m(full, "value")
        else
          value = get_audio_only_media_info(file_path)

          State.put(
            :media_audio_info_cache,
            ordered_cache_put(cache, map_key, %{"cacheKey" => cache_key, "value" => value}, 200)
          )

          value
        end
    end
  end

  # JavaScript source: mediaStableCacheKey(input)
  def media_stable_cache_key(input) do
    case File.stat(to_string(input)) do
      {:ok, stat} -> "local:#{input}:#{stat.size}:#{mtime_number(stat.mtime)}"
      _ -> "remote:#{input}"
    end
  end

  # JavaScript source: playbackAudioSelectionCacheKey(req, input)
  def playback_audio_selection_cache_key(req, input) do
    [
      media_stable_cache_key(input),
      "audio=#{query_value(req, "audio", "") || ""}",
      "audioStream=#{query_value(req, "audioStream", "") || ""}"
    ]
    |> Enum.join("|")
  end

  # JavaScript source: clonePlaybackAudioSelection(selection)
  def clone_playback_audio_selection(selection),
    do: if(is_map(selection), do: Map.new(selection), else: selection)

  # JavaScript source: rememberPlaybackAudioSelection(cacheKey, selection)
  def remember_playback_audio_selection(cache_key, selection) do
    if JS.truthy?(cache_key) and JS.truthy?(selection) do
      cache = State.get(:playback_audio_selection_cache, ordered_cache())

      State.put(
        :playback_audio_selection_cache,
        ordered_cache_put(cache, cache_key, clone_playback_audio_selection(selection), 240)
      )
    end

    selection
  end

  # JavaScript source: getCachedDurationOnlyMediaInfo(filePath)
  def get_cached_duration_only_media_info(file_path) do
    {map_key, cache_key} = media_cache_identity(file_path, false)
    cache = State.get(:media_duration_info_cache, ordered_cache())

    case ordered_cache_get(cache, map_key) do
      %{"cacheKey" => ^cache_key, "value" => value} ->
        value

      _ ->
        value = get_duration_only_media_info(file_path)

        State.put(
          :media_duration_info_cache,
          ordered_cache_put(cache, map_key, %{"cacheKey" => cache_key, "value" => value}, 200)
        )

        value
    end
  end

  # JavaScript source: isAppleDevice(userAgent)
  def is_apple_device(user_agent) do
    ua = user_agent || ""

    not Regex.match?(~r/Chrome|CriOS|FxiOS|Firefox|Edg\/|EdgA|OPR|OPiOS/i, ua) and
      Regex.match?(~r/iPhone|iPad|iPod|Safari/i, ua)
  end

  # JavaScript source: needsTranscode(mediaInfo, userAgent)
  def needs_transcode(media_info, user_agent) do
    video_codec = media_info |> m("videoCodec", "") |> lower()
    container = media_info |> m("container", "") |> lower()
    bad_codecs = ~w(hevc h265 vp9 vp8 av1 vc1)
    bad_containers = ~w(matroska webm avi flv mpegts)

    Enum.any?(bad_codecs, &String.contains?(video_codec, &1)) or
      Enum.any?(bad_containers, &String.contains?(container, &1)) or
      (is_apple_device(user_agent) and false)
  end

  # JavaScript source: isMobilePlaybackRequest(req)
  def is_mobile_playback_request(req),
    do:
      query_value(req, "mobile") == "1" or
        Regex.match?(~r/Android|iPhone|iPad|iPod|Mobile/i, request_header(req, "user-agent"))

  # JavaScript source: isMobile(req)
  def is_mobile(req),
    do: Regex.match?(~r/Mobi|Android|iPhone|iPad/i, request_header(req, "user-agent"))

  # JavaScript source: loadJSON(file, fallback)
  def load_json(file, fallback), do: Files.read_json(file, fallback)

  # JavaScript source: isCartoonOrAnime(item)
  def is_cartoon_or_anime(item) do
    if is_nil(item) do
      false
    else
      name = lower(m(item, "name") || m(item, "title") || "")
      genre = lower(m(item, "genre", ""))
      filename = lower(m(item, "file") || m(item, "filename") || "")

      keywords = [
        "cartoon",
        "anime",
        "animated",
        "tv cartoon",
        "cartoon series",
        "kids",
        "children",
        "pbs kids",
        "nickelodeon",
        "disney channel",
        "cartoon network",
        "boomerang",
        "adult swim",
        "family guy",
        "simpsons",
        "south park",
        "rick and morty",
        "sponge",
        "paw patrol",
        "peppa pig",
        "anime movie",
        "animated movie"
      ]

      String.contains?(genre, "animation") or String.contains?(genre, "anime") or
        Enum.any?(keywords, &(String.contains?(name, &1) or String.contains?(filename, &1))) or
        Enum.any?(
          [
            ~r/\btv cartoon\b/i,
            ~r/\bcartoon\b/i,
            ~r/\banimated series\b/i,
            ~r/\(\s*tv\s+cartoon\s*\)/i,
            ~r/\(\s*cartoon\s*\)/i
          ],
          &(Regex.match?(&1, filename) or Regex.match?(&1, name))
        )
    end
  end

  # JavaScript source: dedupMovies()
  def dedup_movies, do: dedup_by_title_year(list(m(ftp_catalog(), "movies", [])))

  # JavaScript source: dedupSeries()
  def dedup_series, do: dedup_by_title_year(list(m(ftp_catalog(), "series", [])))

  # JavaScript source: getCachedMovies()
  def get_cached_movies do
    case State.get(:deduped_movies) do
      nil ->
        value = dedup_movies()
        State.put(:deduped_movies, value)
        value

      value ->
        value
    end
  end

  # JavaScript source: getCachedSeries()
  def get_cached_series do
    case State.get(:deduped_series) do
      nil ->
        value = dedup_series()
        State.put(:deduped_series, value)
        value

      value ->
        value
    end
  end

  # JavaScript source: svSafeDecode(value)
  def sv_safe_decode(value) do
    value = if JS.truthy?(value), do: to_string(value), else: ""

    try do
      URI.decode(value)
    rescue
      _ -> value
    end
  end

  # JavaScript source: svCleanMediaTitle(value)
  def sv_clean_media_title(value) do
    raw =
      sv_safe_decode(value || "")
      |> String.split(~r/[?#]/, parts: 2)
      |> hd()
      |> String.replace("\\", "/")
      |> String.split("/")
      |> List.last()

    raw = raw || ""

    cleaned =
      raw
      |> String.replace(~r/\.(mp4|mkv|avi|mov|webm|m3u8|ts|flv|wmv|mpg|mpeg)$/i, "")
      |> String.replace(~r/^\s*\d{1,3}\s*[-â€“â€”.]\s*/u, " ")
      |> String.replace(
        ~r/\b(480p|576p|720p|1080p|1440p|2160p|4k|8k|uhd|hdr|hdr10|dv|dolby[ ._-]*vision|imax|web[- ]?dl|webrip|web|bluray|brrip|brip|dvdrip|hdrip|hdtv|hdcam|hdtc|camrip|amzn|nf|dsnp|zee5|hotstar|hulu|max|itunes|x264|x265|h264|h265|hevc|avc|aac|ac3|eac3|ddp?|ddp?5[ ._-]*1|dd5[ ._-]*1|dts|truehd|atmos|10bit|8bit|yts|rarbg|galaxyrg|mkvcage|mkvhub|hdhub4u|downloadhub|cinevood|msmod|psa|esub|msubs|subbed|dubbed|dual audio|multi audio|hindi|english|bengali|bangla|tamil|telugu|malayalam|korean|japanese|chinese|org|uncut|unrated|proper|repack|remux|reencoded|re encode|encoded|converted|sample|trailer|e[ ._-]*box|hsbs|half[ ._-]*sbs|3d|6ch|2ch|5[ ._-]*1ch|7[ ._-]*1)\b/iu,
        " "
      )
      |> String.replace(~r/\b\d+(?:\.\d+)?\s*(?:mb|gb)\b/iu, " ")
      |> String.replace(~r/[\[\](){}]/u, " ")
      |> String.replace(~r/[._-]+/u, " ")
      |> String.replace(~r/\s+/u, " ")
      |> String.trim()

    if cleaned == "", do: "Untitled", else: cleaned
  end

  # JavaScript source: svCanonicalTitleForSearch(value, year = '')
  def sv_canonical_title_for_search(value, year \\ "") do
    text = sv_clean_media_title(value || "")

    y =
      if(JS.truthy?(year), do: year, else: sv_extract_year(value || ""))
      |> to_string()
      |> String.replace(~r/[^0-9]/, "")

    text =
      if y != "",
        do: Regex.replace(Regex.compile!("\\b" <> Regex.escape(y) <> "\\b.*$", "i"), text, " "),
        else: text

    text =
      text
      |> String.replace(~r/^\s*\d{1,3}\s*[-â€“â€”.]\s*/u, " ")
      |> String.replace(
        ~r/\b(?:remastered|extended|unrated|directors?|director'?s?|cut|final|theatrical|imax|open[ ._-]*matte|proper|repack|rerip|remux|internal|limited|complete|collection|converted|reencoded|encoded|recoded|recode|free)\b/iu,
        " "
      )
      |> String.replace(
        ~r/\b(?:480p|576p|720p|1080p|1440p|2160p|4k|8k|uhd|hdr|hdr10|dv|web|webdl|web-dl|webrip|bluray|brrip|brip|dvdrip|hdrip|hdtv|hdcam|hdtc|camrip|scr|x264|x265|h264|h265|hevc|avc|xvid|divx|aac|ac3|eac3|ddp?|dts|truehd|atmos|10bit|8bit|60fps|30fps|23fps|3d|hsbs|sbs|half[ ._-]*sbs|6ch|2ch|5[ ._-]*1|7[ ._-]*1|dd5|ddp5|bd5|ddn|sdr|hd|us)\b/iu,
        " "
      )
      |> String.replace(
        ~r/\b(?:yts|yify|rarbg|galaxyrg|mkvcage|mkvhub|mkvc|mkv|hdhub4u|hdhub|downloadhub|cinevood|msmod|psa|tigole|ntg|evo|ctrlhd|shaanig|shaang|mx|ganool|pahe|rmteam|ettv|etrg|sparks|spray|sprite|hon3y|kmhd|torrenta2z)\b/iu,
        " "
      )
      |> String.replace(
        ~r/\b(?:amzn|nf|netflix|dsnp|disney|zee5|hotstar|hulu|max|itunes|jio|sony|aha|voot|web)\b/iu,
        " "
      )
      |> String.replace(
        ~r/\b(?:esub|msub|msubs|subs?|subbed|dubbed|dual|multi|audio|org|uncut|uncensored|hdr10plus)\b/iu,
        " "
      )
      |> String.replace(
        ~r/\b(?:hindi|english|bengali|bangla|tamil|telugu|malayalam|kannada|punjabi|korean|japanese|chinese|french|spanish|russian|turkish|arabic)\b/iu,
        " "
      )
      |> String.replace(~r/\b\d+(?:\.\d+)?\s*(?:mb|gb)\b/iu, " ")
      |> String.replace("ï¿½", " ")
      |> String.replace(~r/[^a-zA-Z0-9]+/u, " ")
      |> String.replace(~r/\s+/, " ")
      |> String.trim()

    text =
      if y != "",
        do:
          text
          |> String.replace(Regex.compile!("\\b" <> Regex.escape(y) <> "\\b"), " ")
          |> String.replace(~r/\s+/, " ")
          |> String.trim(),
        else: text

    if text == "", do: sv_clean_media_title(value || "Untitled"), else: text
  end

  # JavaScript source: svIsNoisyMassiveTitle(title, source='')
  def sv_is_noisy_massive_title(title, source \\ "") do
    text = to_string(title || "")
    raw = to_string(source || "")
    norm = sv_normalize_search_text(text)
    tokens = String.split(norm, " ", trim: true)

    norm == "" or String.length(norm) < 3 or String.contains?(text <> raw, "ï¿½") or
      Regex.match?(~r/\bidx\b|\bidx\s*m\b|ï¿½/i, text <> " " <> raw) or
      Regex.match?(~r/^[0-9\s]+$/, norm) or
      Regex.match?(~r/^[a-f0-9]{10,}/i, String.replace(norm, ~r/\s+/, "")) or
      (length(tokens) <= 1 and String.length(norm) < 5)
  end

  # JavaScript source: svExtractYear(value)
  def sv_extract_year(value) do
    case Regex.run(~r/(?:^|[^0-9])((?:19|20)\d{2})(?:[^0-9]|$)/, sv_safe_decode(value || "")) do
      [_, year] -> year
      _ -> ""
    end
  end

  # JavaScript source: svStableId(prefix, value)
  def sv_stable_id(prefix, value) do
    hash =
      :crypto.hash(:md5, to_string(value || ""))
      |> Base.encode16(case: :lower)
      |> binary_part(0, 12)

    "#{prefix}_#{hash}"
  end

  # JavaScript source: svLooksLikeSeries(value)
  def sv_looks_like_series(value),
    do:
      Regex.match?(
        ~r/\bs\d{1,2}e\d{1,3}\b|\bseason[ ._-]*\d{1,2}\b|\bepisode[ ._-]*\d{1,3}\b|tv[ ._-]*series|web[ ._-]*series|korean tv|anime & cartoon tv/i,
        sv_safe_decode(value || "")
      )

  # JavaScript source: svParseEpisode(value)
  def sv_parse_episode(value) do
    text = sv_safe_decode(value || "")

    case Regex.run(~r/S(\d{1,2})\s*E(\d{1,3})/i, text) do
      [_, season, episode] ->
        %{"season" => int_or(season, 1), "episode" => int_or(episode, 1)}

      _ ->
        season =
          case Regex.run(~r/Season[ ._-]*(\d{1,2})/i, text) do
            [_, n] -> int_or(n, 1)
            _ -> 1
          end

        episode =
          case Regex.run(~r/Episode[ ._-]*(\d{1,3})|\bEp[ ._-]*(\d{1,3})/i, text) do
            [_, a, b] -> int_or(if(a == "", do: b, else: a), 1)
            _ -> 1
          end

        %{"season" => season, "episode" => episode}
    end
  end

  # JavaScript source: svBaseShowTitle(value)
  def sv_base_show_title(value) do
    sv_clean_media_title(value)
    |> String.replace(~r/\bS\d{1,2}E\d{1,3}\b/i, " ")
    |> String.replace(~r/\bSeason\s*\d{1,2}\b/i, " ")
    |> String.replace(~r/\bEpisode\s*\d{1,3}\b/i, " ")
    |> String.replace(~r/\bEp\s*\d{1,3}\b/i, " ")
    |> String.replace(~r/\s+/, " ")
    |> String.trim()
  end

  # JavaScript source: loadMassiveCatalog()
  def load_massive_catalog do
    if State.get(:massive_catalog_loaded, false) do
      :ok
    else
      State.put(:massive_catalog_loaded, true)

      if File.exists?(Paths.massive_catalog()) do
        try do
          raw = Files.read_json(Paths.massive_catalog(), []) |> list()

          {movies, _seen, series} =
            Enum.reduce(raw, {[], MapSet.new(), %{}}, &reduce_massive_item/2)

          series_list =
            series
            |> Map.values()
            |> Enum.map(fn show ->
              seasons =
                m(show, "seasons", %{})
                |> Map.new(fn {season, episodes} ->
                  {season, Enum.sort_by(episodes, &num(m(&1, "episode", 0)))}
                end)

              Map.put(show, "seasons", seasons)
            end)

          State.put(:massive_movies, Enum.reverse(movies))
          State.put(:massive_series, series_list)

          IO.puts(
            "Massive clean catalog loaded: #{length(movies)} movies, #{length(series_list)} series"
          )
        rescue
          error ->
            IO.warn("Could not load massive clean catalog: #{Exception.message(error)}")
            State.put(:massive_movies, [])
            State.put(:massive_series, [])
        end
      else
        IO.warn("Massive catalog not found: #{Paths.massive_catalog()}")
      end
    end
  end

  # JavaScript source: svPosterBridgeKey(name, year='')
  def sv_poster_bridge_key(name, year \\ "") do
    clean = sv_normalize_search_text(sv_canonical_title_for_search(name || "", year))

    if clean == "",
      do: "",
      else: "#{clean}|#{to_string(year || "") |> String.replace(~r/[^0-9]/, "")}"
  end

  # JavaScript source: svBuildPosterBridge()
  def sv_build_poster_bridge do
    case State.get(:poster_bridge) do
      nil ->
        sources = [
          {movie_list() || build_movie_list_sync(), "movie"},
          {Enum.map(get_cached_movies(), &Map.put(&1, "name", m(&1, "title") || m(&1, "name"))),
           "movie"},
          {series_list() || build_series_list_sync(), "series"},
          {Enum.map(get_cached_series(), &Map.put(&1, "name", m(&1, "title") || m(&1, "name"))),
           "series"}
        ]

        bridge =
          Enum.reduce(sources, %{}, fn {items, kind}, map ->
            Enum.reduce(items, map, &poster_bridge_add(&1, &2, kind))
          end)

        State.put(:poster_bridge, bridge)
        IO.puts("Search poster bridge ready: #{map_size(bridge)} keys")
        bridge

      bridge ->
        bridge
    end
  end

  # JavaScript source: add(item, kind='movie')
  defp poster_bridge_add(item, map, kind \\ "movie") do
    poster = m(item, "poster") || m(item, "backdrop")

    if is_nil(item) or not JS.truthy?(poster) do
      map
    else
      name = m(item, "name") || m(item, "title") || m(item, "filename") || m(item, "file") || ""
      year = m(item, "year") || sv_extract_year(name)

      data = %{
        "name" => m(item, "name") || m(item, "title") || name,
        "poster" => m(item, "poster"),
        "backdrop" => m(item, "backdrop") || m(item, "poster"),
        "rating" => m(item, "rating"),
        "genre" => m(item, "genre", ""),
        "overview" => m(item, "overview", ""),
        "tmdbId" => m(item, "tmdbId"),
        "year" => year,
        "type" => kind
      }

      Enum.reduce([sv_poster_bridge_key(name, year), sv_poster_bridge_key(name, "")], map, fn key,
                                                                                              acc ->
        current = Map.get(acc, key)

        if key != "" and
             (is_nil(current) or (not JS.truthy?(m(current, "poster")) and JS.truthy?(poster))),
           do: Map.put(acc, key, data),
           else: acc
      end)
    end
  end

  # JavaScript source: svHydrateMassiveSearchItem(item, kind='movie')
  def sv_hydrate_massive_search_item(item, kind \\ "movie") do
    if is_nil(item) or JS.truthy?(m(item, "poster")) or JS.truthy?(m(item, "backdrop")) do
      item
    else
      name = m(item, "name") || m(item, "title") || ""
      bridge = sv_build_poster_bridge()

      hit =
        Map.get(bridge, sv_poster_bridge_key(name, m(item, "year"))) ||
          Map.get(bridge, sv_poster_bridge_key(name, ""))

      if is_nil(hit) do
        item
      else
        hydrated =
          item
          |> put_if_empty("poster", m(hit, "poster"))
          |> put_if_empty("backdrop", m(hit, "backdrop") || m(hit, "poster"))
          |> put_if_empty("rating", m(hit, "rating"))
          |> put_if_empty("genre", m(hit, "genre", ""))
          |> put_if_empty("overview", m(hit, "overview", ""))
          |> put_if_empty("tmdbId", m(hit, "tmdbId"))

        if JS.truthy?(m(hit, "name")) and
             sv_normalize_search_text(m(hit, "name")) == sv_normalize_search_text(name),
           do: hydrated |> Map.put("name", m(hit, "name")) |> Map.put("title", m(hit, "name")),
           else: hydrated
      end
    end
  end

  # JavaScript source: svSearchResultDedupeKey(entry)
  def sv_search_result_dedupe_key(entry) do
    item = m(entry, "item", %{})
    year = to_string(m(item, "year", "") || "") |> String.replace(~r/[^0-9]/, "")

    name =
      sv_normalize_search_text(
        sv_canonical_title_for_search(
          m(item, "name") || m(item, "title") || m(item, "file") || "",
          year
        )
      )

    "#{m(entry, "kind")}|#{name}|#{year}"
  end

  # JavaScript source: svSearchHasArt(item)
  def sv_search_has_art(item),
    do: not is_nil(item) and (JS.truthy?(m(item, "poster")) or JS.truthy?(m(item, "backdrop")))

  # JavaScript source: svShouldDropSearchResult(entry, score, terms, queryNorm)
  def sv_should_drop_search_result(entry, _score, terms, query_norm) do
    item = m(entry, "item", %{})

    cond do
      sv_is_noisy_massive_title(
        m(item, "name") || m(item, "title") || "",
        m(item, "file") || m(item, "streamUrl") || ""
      ) ->
        true

      not JS.truthy?(m(item, "isMassiveCatalog")) ->
        false

      true ->
        phrase = if JS.truthy?(query_norm), do: query_norm, else: Enum.join(terms, " ")
        name = m(entry, "name", "")
        name_tokens = list(m(entry, "nameTokens", []))
        exact_hits = Enum.count(terms, &(&1 in name_tokens))

        phrase_hit =
          phrase != "" and
            (name == phrase or String.starts_with?(name, phrase <> " ") or
               String.contains?(name, " " <> phrase <> " "))

        not sv_search_has_art(item) and not phrase_hit and exact_hits < length(terms)
    end
  end

  # JavaScript source: svNormalizeSearchText(value)
  def sv_normalize_search_text(value) do
    sv_safe_decode(value || "")
    |> String.downcase()
    |> String.replace("&", " and ")
    |> String.replace(~r/['â€™`]/u, "")
    |> String.replace(~r/[^a-z0-9]+/, " ")
    |> String.replace(~r/\s+/, " ")
    |> String.trim()
  end

  # JavaScript source: svSearchTokensFromText(value)
  def sv_search_tokens_from_text(value) do
    value
    |> sv_normalize_search_text()
    |> String.split(" ", trim: true)
    |> Enum.reduce({MapSet.new(), []}, fn token, {seen, out} ->
      if String.length(token) < 2 or MapSet.member?(@search_stopwords, token) or
           MapSet.member?(seen, token),
         do: {seen, out},
         else: {MapSet.put(seen, token), [token | out]}
    end)
    |> elem(1)
    |> Enum.reverse()
  end

  # JavaScript source: svPrepareSearchItem(item)
  def sv_prepare_search_item(item) do
    if is_nil(item) or JS.truthy?(m(item, "_svSearchPrepared")) do
      item
    else
      name = m(item, "name") || m(item, "title") || m(item, "file") || m(item, "filename") || ""
      file = m(item, "file") || m(item, "filename") || m(item, "streamUrl") || ""
      year = m(item, "year") || sv_extract_year(if(JS.truthy?(name), do: name, else: file))
      canonical = sv_canonical_title_for_search(name, year)

      fields =
        [
          canonical,
          name,
          m(item, "title"),
          file,
          m(item, "overview"),
          m(item, "genre"),
          m(item, "language"),
          year,
          m(item, "category"),
          m(item, "server")
        ]
        |> Enum.filter(&JS.truthy?/1)
        |> Enum.join(" ")

      item
      |> Map.put(
        "_svNameNorm",
        sv_normalize_search_text(if(JS.truthy?(canonical), do: canonical, else: name))
      )
      |> Map.put("_svDisplayNameNorm", sv_normalize_search_text(name))
      |> Map.put("_svFileNorm", sv_normalize_search_text(file))
      |> Map.put("_svSearchNorm", sv_normalize_search_text(fields))
      |> Map.put(
        "_svNameTokens",
        sv_search_tokens_from_text(if(JS.truthy?(canonical), do: canonical, else: name))
      )
      |> Map.put("_svSearchTokens", sv_search_tokens_from_text(fields))
      |> Map.put("_svSearchPrepared", true)
    end
  end

  # JavaScript source: svEditDistanceCapped(a, b, maxDistance)
  def sv_edit_distance_capped(a, b, max_distance) do
    a = to_string(a || "")
    b = to_string(b || "")

    cond do
      a == b -> 0
      a == "" or b == "" -> max_distance + 1
      abs(String.length(a) - String.length(b)) > max_distance -> max_distance + 1
      true -> edit_distance_rows(String.to_charlist(a), String.to_charlist(b), max_distance)
    end
  end

  # JavaScript source: svMaxFuzzyDistance(term)
  def sv_max_fuzzy_distance(term) do
    cond do
      String.length(term) >= 8 -> 2
      String.length(term) >= 5 -> 1
      true -> 0
    end
  end

  # JavaScript source: svTokenMatchScore(term, token)
  def sv_token_match_score(term, token) do
    cond do
      not JS.truthy?(term) or not JS.truthy?(token) ->
        0

      token == term ->
        220

      String.starts_with?(token, term) ->
        145

      String.length(term) >= 4 and String.contains?(token, term) ->
        90

      true ->
        maximum = sv_max_fuzzy_distance(term)

        if maximum > 0 and abs(String.length(token) - String.length(term)) <= maximum do
          case sv_edit_distance_capped(term, token, maximum) do
            1 -> 115
            d when d <= maximum -> 70
            _ -> 0
          end
        else
          0
        end
    end
  end

  # JavaScript source: svTermBestScore(term, tokens)
  def sv_term_best_score(term, tokens),
    do:
      Enum.reduce_while(list(tokens), 0, fn token, best ->
        next = max(best, sv_token_match_score(term, token))
        if next >= 220, do: {:halt, next}, else: {:cont, next}
      end)

  # JavaScript source: svSearchTerms(reqOrQuery)
  def sv_search_terms(req_or_query) do
    raw = if is_binary(req_or_query), do: req_or_query, else: query_value(req_or_query, "q", "")
    raw |> sv_search_tokens_from_text() |> Enum.take(8)
  end

  # JavaScript source: svPushIndex(map, token, idx)
  def sv_push_index(map, token, idx),
    do: if(JS.truthy?(token), do: Map.update(map, token, [idx], &(&1 ++ [idx])), else: map)

  # JavaScript source: svAddPrefix(prefixMap, token)
  def sv_add_prefix(prefix_map, token) do
    if JS.truthy?(token) and String.length(token) >= 2,
      do: Map.update(prefix_map, String.slice(token, 0, 2), [token], &(&1 ++ [token])),
      else: prefix_map
  end

  # JavaScript source: svMakeSearchEntry(item, kind)
  def sv_make_search_entry(item, kind) do
    prepared = sv_prepare_search_item(item)

    %{
      "item" => prepared,
      "kind" => kind,
      "name" => m(prepared, "_svNameNorm", ""),
      "file" => m(prepared, "_svFileNorm", ""),
      "search" => m(prepared, "_svSearchNorm", ""),
      "nameTokens" => list(m(prepared, "_svNameTokens", [])),
      "searchTokens" => list(m(prepared, "_svSearchTokens", []))
    }
  end

  # JavaScript source: svBuildFastSearchIndex()
  def sv_build_fast_search_index do
    load_massive_catalog()

    local_movies =
      (movie_list() || build_movie_list_sync()) |> Enum.reject(&is_cartoon_or_anime/1)

    ftp_movies =
      get_cached_movies()
      |> Enum.reject(&is_cartoon_or_anime/1)
      |> Enum.with_index()
      |> Enum.map(fn {item, index} -> ftp_search_movie(item, index) end)

    local_series =
      (series_list() || build_series_list_sync())
      |> Enum.reject(&is_cartoon_or_anime/1)
      |> Enum.map(&(&1 |> Map.put("_isSeries", true) |> Map.put_new("type", "series")))

    ftp_series =
      get_cached_series()
      |> Enum.reject(&is_cartoon_or_anime/1)
      |> Enum.with_index()
      |> Enum.map(fn {item, index} -> ftp_search_series(item, index) end)

    massive_series =
      Enum.map(massive_series(), &(&1 |> Map.put("_isSeries", true) |> Map.put("type", "series")))

    groups = [
      {local_movies, "movie"},
      {ftp_movies, "movie"},
      {Enum.map(massive_movies(), &sv_hydrate_massive_search_item(&1, "movie")), "movie"},
      {local_series, "series"},
      {ftp_series, "series"},
      {Enum.map(massive_series, &sv_hydrate_massive_search_item(&1, "series")), "series"}
    ]

    {entries, _seen} =
      Enum.reduce(groups, {[], MapSet.new()}, fn {items, kind}, acc ->
        Enum.reduce(items, acc, fn item, inner -> sv_fast_search_add(item, kind, inner) end)
      end)

    entries = Enum.reverse(entries)

    {token_map, name_token_map, prefix_map, token_seen} =
      entries
      |> Enum.with_index()
      |> Enum.reduce({%{}, %{}, %{}, MapSet.new()}, fn {entry, idx},
                                                       {tokens, names, prefixes, seen} ->
        {tokens, prefixes, seen} =
          Enum.reduce(
            MapSet.new(m(entry, "searchTokens", [])),
            {tokens, prefixes, seen},
            fn token, {tm, pm, ts} ->
              {sv_push_index(tm, token, idx),
               if(MapSet.member?(ts, token), do: pm, else: sv_add_prefix(pm, token)),
               MapSet.put(ts, token)}
            end
          )

        names =
          Enum.reduce(MapSet.new(m(entry, "nameTokens", [])), names, &sv_push_index(&2, &1, idx))

        {tokens, names, prefixes, seen}
      end)

    index = %{
      "entries" => entries,
      "tokenMap" => token_map,
      "nameTokenMap" => name_token_map,
      "prefixMap" => prefix_map,
      "tokens" => MapSet.to_list(token_seen),
      "createdAt" => JS.date_now()
    }

    State.put(:fast_search_index, index)

    State.put(
      :fast_search_index_stamp,
      "#{length(entries)}:#{length(massive_movies())}:#{length(massive_series())}"
    )

    IO.puts(
      "Fast search index ready: #{length(entries)} items, #{MapSet.size(token_seen)} tokens"
    )

    index
  end

  # JavaScript source: add(item, kind)
  defp sv_fast_search_add(item, kind, {entries, seen}) do
    key =
      "#{kind}|#{lower(m(item, "name") || m(item, "title") || "")}|#{m(item, "year", "") || ""}|#{m(item, "streamUrl") || m(item, "id") || ""}"

    if MapSet.member?(seen, key),
      do: {entries, seen},
      else: {[sv_make_search_entry(item, kind) | entries], MapSet.put(seen, key)}
  end

  # JavaScript source: svGetFastSearchIndex()
  def sv_get_fast_search_index do
    suffix = "#{length(massive_movies())}:#{length(massive_series())}"
    index = State.get(:fast_search_index)
    stamp = State.get(:fast_search_index_stamp, "")

    if is_nil(index) or not String.contains?(stamp, suffix),
      do: sv_build_fast_search_index(),
      else: index
  end

  # JavaScript source: svArrayUnionInto(set, arr, hardLimit)
  def sv_array_union_into(set, arr, hard_limit) do
    Enum.reduce_while(list(arr), set, fn value, acc ->
      next = MapSet.put(acc, value)
      if MapSet.size(next) >= hard_limit, do: {:halt, next}, else: {:cont, next}
    end)
  end

  # JavaScript source: svIntersectArrays(a, b, hardLimit)
  def sv_intersect_arrays(a, b, hard_limit) do
    if is_nil(a) or is_nil(b) do
      []
    else
      {small, big} = if length(a) <= length(b), do: {a, b}, else: {b, a}
      big = MapSet.new(big)

      Enum.reduce_while(small, [], fn value, out ->
        next = if MapSet.member?(big, value), do: [value | out], else: out
        if length(next) >= hard_limit, do: {:halt, Enum.reverse(next)}, else: {:cont, next}
      end)
      |> then(fn result -> if is_list(result), do: result, else: [] end)
    end
  end

  # JavaScript source: svMatchingTokens(index, term)
  def sv_matching_tokens(index, term) do
    token_map = m(index, "tokenMap", %{})

    if Map.has_key?(token_map, term) do
      [term]
    else
      bucket = Map.get(m(index, "prefixMap", %{}), String.slice(term, 0, 2), [])
      maximum = sv_max_fuzzy_distance(term)

      Enum.reduce_while(bucket, [], fn token, out ->
        match =
          token == term or String.starts_with?(token, term) or
            (String.length(term) >= 4 and String.contains?(token, term)) or
            (maximum > 0 and abs(String.length(token) - String.length(term)) <= maximum and
               sv_edit_distance_capped(term, token, maximum) <= maximum)

        next = if match, do: [token | out], else: out
        if length(next) >= 80, do: {:halt, Enum.reverse(next)}, else: {:cont, next}
      end)
      |> Enum.reverse()
    end
  end

  # JavaScript source: svCandidateIndexes(index, terms, kind)
  def sv_candidate_indexes(index, terms, kind) do
    hard_limit = trunc(config(:search_candidate_limit))
    token_map = m(index, "tokenMap", %{})
    name_map = m(index, "nameTokenMap", %{})

    lists =
      Enum.map(terms, fn term ->
        Enum.reduce_while(sv_matching_tokens(index, term), MapSet.new(), fn token, set ->
          next =
            set
            |> sv_array_union_into(Map.get(name_map, token), hard_limit)
            |> sv_array_union_into(Map.get(token_map, token), hard_limit)

          if MapSet.size(next) >= hard_limit, do: {:halt, next}, else: {:cont, next}
        end)
        |> MapSet.to_list()
      end)

    if Enum.any?(lists, &(&1 == [])) do
      []
    else
      candidates =
        lists
        |> Enum.sort_by(&length/1)
        |> Enum.reduce(nil, fn values, acc ->
          if is_nil(acc), do: values, else: sv_intersect_arrays(acc, values, hard_limit)
        end)

      entries = m(index, "entries", [])

      candidates =
        if kind in ["movie", "series"],
          do:
            Enum.filter(candidates, fn idx -> m(Enum.at(entries, idx) || %{}, "kind") == kind end),
          else: candidates

      Enum.take(candidates, hard_limit)
    end
  end

  # JavaScript source: svSearchScoreEntry(entry, terms, queryNorm)
  def sv_search_score_entry(entry, terms, query_norm) do
    item = m(entry, "item", %{})
    name = m(entry, "name", "")
    file = m(entry, "file", "")
    search = m(entry, "search", "")
    name_tokens = list(m(entry, "nameTokens", []))
    all_tokens = list(m(entry, "searchTokens", []))

    if terms == [] do
      1
    else
      phrase = if JS.truthy?(query_norm), do: query_norm, else: Enum.join(terms, " ")

      score =
        cond do
          phrase != "" and name == phrase -> 9000
          phrase != "" and String.starts_with?(name, phrase <> " ") -> 7600
          phrase != "" and String.contains?(name, " " <> phrase <> " ") -> 6500
          phrase != "" and String.contains?(name, phrase) -> 5400
          phrase != "" and String.contains?(file, phrase) -> 1300
          true -> 0
        end

      {score, matched, name_hits, exact_hits} =
        Enum.reduce_while(terms, {score, true, 0, 0}, fn term, {sum, _, nh, eh} ->
          name_score = sv_term_best_score(term, name_tokens)

          text_score =
            if name_score > 0, do: name_score, else: sv_term_best_score(term, all_tokens)

          cond do
            text_score > 0 ->
              {:cont,
               {sum + text_score, true, nh + if(name_score > 0, do: 1, else: 0),
                eh + if(term in name_tokens, do: 1, else: 0)}}

            String.contains?(search, term) ->
              {:cont, {sum + 30, true, nh, eh}}

            true ->
              {:halt, {sum, false, nh, eh}}
          end
        end)

      if not matched do
        -1
      else
        count = length(terms)

        score =
          score + if(name_hits == count, do: 2200, else: 0) +
            if(exact_hits == count, do: 2400, else: 0)

        score =
          score +
            if(
              count > 1 and phrase != "" and
                name |> String.split(" ") |> Enum.take(count) |> Enum.join(" ") == phrase,
              do: 1800,
              else: 0
            )

        score =
          score +
            if(
              count > 1 and length(name_tokens) >= count and
                name_tokens |> Enum.take(count) |> Enum.join(" ") == phrase, do: 2500, else: 0)

        score =
          score + if(not JS.truthy?(m(item, "isMassiveCatalog")), do: 260, else: 0) +
            if(JS.truthy?(m(item, "poster")), do: 420, else: 0) +
            if(JS.truthy?(m(item, "backdrop")), do: 90, else: 0)

        score =
          score -
            if(JS.truthy?(m(item, "isMassiveCatalog")) and not sv_search_has_art(item),
              do: 850,
              else: 0
            )

        rating = parse_float_or_zero(m(item, "rating", 0))
        score = score + if(rating > 0, do: min(75, rating * 7), else: 0)
        year = m(item, "year", "") |> to_string() |> String.replace(~r/[^0-9]/, "") |> int_or(0)
        score + if(year > 1900, do: min(25, max(0, year - 1980) / 2), else: 0)
      end
    end
  end

  # JavaScript source: svSearchCacheKey(req, kind, count)
  def sv_search_cache_key(req, kind, count) do
    [
      kind,
      sv_normalize_search_text(query_value(req, "q", "")),
      query_value(req, "genre", ""),
      query_value(req, "lang", ""),
      query_value(req, "yearRange", ""),
      query_value(req, "minRating", ""),
      query_value(req, "publisher", ""),
      query_value(req, "sort", ""),
      query_value(req, "page", ""),
      query_value(req, "limit", ""),
      count
    ]
    |> Enum.map(&to_string(&1 || ""))
    |> Enum.join("|")
  end

  # JavaScript source: svFastSearch(req, kind = 'mixed')
  def sv_fast_search(req, kind \\ "mixed") do
    terms = sv_search_terms(req)
    query_norm = sv_normalize_search_text(query_value(req, "q", ""))

    if terms == [] do
      nil
    else
      index = sv_get_fast_search_index()
      entries = m(index, "entries", [])
      cache_key = sv_search_cache_key(req, kind, length(entries))
      cache = State.get(:query_result_cache, ordered_cache())

      case ordered_cache_get(cache, cache_key) do
        nil ->
          scored =
            sv_candidate_indexes(index, terms, kind)
            |> Enum.reduce([], fn idx, out ->
              entry = Enum.at(entries, idx)
              score = if entry, do: sv_search_score_entry(entry, terms, query_norm), else: -1

              if entry and (kind == "mixed" or m(entry, "kind") == kind) and score > 0 and
                   not sv_should_drop_search_result(entry, score, terms, query_norm),
                 do: [%{"entry" => entry, "item" => m(entry, "item"), "score" => score} | out],
                 else: out
            end)
            |> Enum.sort_by(fn row ->
              {-num(m(row, "score")),
               lower(m(m(row, "item", %{}), "name") || m(m(row, "item", %{}), "title") || "")}
            end)

          has_art = Enum.any?(scored, &sv_search_has_art(m(&1, "item")))
          no_art_cap = if has_art, do: 0, else: trunc(env_number("SV_SEARCH_NO_POSTER_CAP", 18))
          result_cap = trunc(env_number("SV_SEARCH_RESULT_CAP", 120))

          {result, _, _} =
            Enum.reduce_while(scored, {[], MapSet.new(), 0}, fn row, {out, seen, no_art} ->
              entry = m(row, "entry")
              item = m(row, "item")
              key = sv_search_result_dedupe_key(entry)

              blank_massive =
                JS.truthy?(m(item, "isMassiveCatalog")) and not sv_search_has_art(item)

              cond do
                key != "" and MapSet.member?(seen, key) ->
                  {:cont, {out, seen, no_art}}

                blank_massive and no_art >= no_art_cap ->
                  {:cont, {out, if(key != "", do: MapSet.put(seen, key), else: seen), no_art}}

                true ->
                  next = out ++ [item]

                  state =
                    {next, if(key != "", do: MapSet.put(seen, key), else: seen),
                     no_art + if(blank_massive, do: 1, else: 0)}

                  if length(next) >= result_cap, do: {:halt, state}, else: {:cont, state}
              end
            end)

          State.put(
            :query_result_cache,
            ordered_cache_put(cache, cache_key, result, trunc(config(:search_cache_limit)))
          )

          result

        value ->
          value
      end
    end
  end

  # JavaScript source: svSearchScore(item, terms, queryNorm)
  def sv_search_score(item, terms, query_norm) do
    kind =
      if JS.truthy?(m(item, "_isSeries")) or m(item, "type") == "series" or
           JS.truthy?(m(item, "seasons")), do: "series", else: "movie"

    sv_search_score_entry(sv_make_search_entry(item, kind), terms, query_norm)
  end

  # JavaScript source: svApplySearch(items, req, kind = 'mixed')
  def sv_apply_search(items, req, kind \\ "mixed") do
    if sv_search_terms(req) == [], do: items, else: sv_fast_search(req, kind) || []
  end

  # JavaScript source: svFilterPaged(items, req, zeroBased = true, kind = 'mixed')
  def sv_filter_paged(items, req, zero_based \\ true, kind \\ "mixed") do
    filtered = sv_apply_search(items, req, kind)
    limit = min(120, max(1, int_or(query_value(req, "limit", "72"), 72)))
    default_page = if zero_based, do: "0", else: "1"
    raw_page = max(0, int_or(query_value(req, "page", default_page), 0))
    page = if zero_based, do: raw_page, else: max(1, raw_page)
    start = if(zero_based, do: page, else: page - 1) * limit

    %{
      "list" => filtered,
      "page" => page,
      "limit" => limit,
      "start" => start,
      "items" => Enum.slice(filtered, start, limit),
      "pages" => max(1, ceil_div(length(filtered), limit))
    }
  end

  # JavaScript source: svBootSearchStamp()
  def sv_boot_search_stamp do
    [
      length(movie_list() || []),
      length(series_list() || []),
      length(list(m(ftp_catalog(), "movies", []))),
      length(list(m(ftp_catalog(), "series", []))),
      config(:boot_search_max_items),
      @boot_search_version
    ]
    |> Enum.join(":")
  end

  # JavaScript source: svBootSearchSeasons(seasons = {})
  def sv_boot_search_seasons(seasons \\ %{}) do
    Map.new(if(is_map(seasons), do: seasons, else: %{}), fn {season, episodes} ->
      values =
        Enum.map(list(episodes), fn episode ->
          number = m(episode, "episode") || m(episode, "ep") || 1

          %{
            "streamId" => m(episode, "streamId"),
            "episode" => number,
            "epTitle" => m(episode, "epTitle") || m(episode, "title") || "Episode #{number}",
            "file" => m(episode, "file") || m(episode, "filename") || "",
            "streamUrl" => m(episode, "streamUrl", "") || "",
            "isFtp" => JS.truthy?(m(episode, "isFtp")) or JS.truthy?(m(episode, "streamUrl"))
          }
        end)

      {to_string(season), values}
    end)
  end

  # JavaScript source: svBootSearchItem(raw, kind = 'movie', source = 'local', sourceRank = 0, index = 0)
  def sv_boot_search_item(raw, kind \\ "movie", source \\ "local", source_rank \\ 0, index \\ 0) do
    if is_nil(raw) do
      nil
    else
      name =
        to_string(m(raw, "name") || m(raw, "title") || m(raw, "file") || m(raw, "filename") || "")
        |> String.trim()

      if name == "" do
        nil
      else
        year =
          to_string(
            m(raw, "year") ||
              sv_extract_year(
                name || m(raw, "file") || m(raw, "filename") || m(raw, "streamUrl") || ""
              ) || ""
          )

        series? = kind == "series"

        item = %{
          "id" => if(is_nil(m(raw, "id")), do: "#{source}_#{kind}_#{index}", else: m(raw, "id")),
          "name" => name,
          "title" => m(raw, "title") || name,
          "year" => year,
          "type" => if(series?, do: "series", else: "movie"),
          "poster" => m(raw, "poster"),
          "backdrop" => m(raw, "backdrop") || m(raw, "poster"),
          "rating" => m(raw, "rating"),
          "genre" => m(raw, "genre", "") || "",
          "file" => m(raw, "file") || m(raw, "filename") || "",
          "tmdbId" => m(raw, "tmdbId"),
          "isFtp" => JS.truthy?(m(raw, "isFtp")) or source == "ftp",
          "streamUrl" => m(raw, "streamUrl", "") || "",
          "category" => m(raw, "category", "") || "",
          "_svBootSourceRank" => source_rank
        }

        item =
          if series? do
            seasons = sv_boot_search_seasons(m(raw, "seasons", %{}))

            item
            |> Map.put("_isSeries", true)
            |> Map.put("seasons", seasons)
            |> Map.put("seasonCount", map_size(seasons))
            |> Map.put(
              "episodeCount",
              seasons |> Map.values() |> Enum.reduce(0, &(length(list(&1)) + &2))
            )
          else
            item
          end

        search_text =
          [
            sv_canonical_title_for_search(name, year),
            name,
            m(raw, "title"),
            m(raw, "file"),
            m(raw, "filename"),
            year,
            m(raw, "genre"),
            m(raw, "category")
          ]
          |> Enum.filter(&JS.truthy?/1)
          |> Enum.join(" ")

        item
        |> Map.put("searchText", sv_normalize_search_text(search_text))
        |> Map.put("searchTokens", sv_search_tokens_from_text(search_text))
      end
    end
  end

  # JavaScript source: svBootSearchRoute(item)
  def sv_boot_search_route(item) do
    id = m(item, "id") || m(item, "streamUrl") || m(item, "file") || m(item, "name") || ""
    prefix = if m(item, "type") == "series", do: "/details/series/", else: "/details/movie/"
    prefix <> JS.encode_component(if(JS.truthy?(id), do: id, else: m(item, "name", "")))
  end

  # JavaScript source: svCompactBootSearchItem(item)
  def sv_compact_boot_search_item(item) do
    name = m(item, "name") || m(item, "title") || ""
    type = if m(item, "type") == "series", do: "series", else: "movie"

    compact = %{
      "id" => m(item, "id"),
      "title" => m(item, "title") || name,
      "name" => name,
      "normalizedTitle" => sv_normalize_search_text(name),
      "year" => m(item, "year", "") || "",
      "type" => type,
      "poster" => m(item, "poster") || m(item, "backdrop"),
      "route" => sv_boot_search_route(item),
      "rating" => m(item, "rating"),
      "isFtp" => JS.truthy?(m(item, "isFtp"))
    }

    compact =
      if StreamVault.Live.sv_server_playable_item(item, type),
        do: Map.put(compact, "hasStream", true),
        else: compact

    if type == "series" do
      seasons = m(item, "seasons", %{})

      compact
      |> Map.put("_isSeries", true)
      |> Map.put("isSummary", true)
      |> Map.put("seasonCount", m(item, "seasonCount") || map_size(safe_map(seasons)))
      |> Map.put(
        "episodeCount",
        m(item, "episodeCount") ||
          safe_map(seasons) |> Map.values() |> Enum.reduce(0, &(length(list(&1)) + &2))
      )
    else
      compact
    end
  end

  # JavaScript source: svCompactBootSearchRow(item)
  def sv_compact_boot_search_row(item) do
    compact = sv_compact_boot_search_item(item)

    Enum.map(@boot_search_fields, fn field ->
      cond do
        field == "type" -> if(m(compact, field) == "series", do: "s", else: "m")
        field in ["isFtp", "hasStream"] -> if(JS.truthy?(m(compact, field)), do: 1, else: 0)
        is_nil(m(compact, field)) -> ""
        true -> m(compact, field)
      end
    end)
  end

  # JavaScript source: svCompactBootSearchIndex(index)
  def sv_compact_boot_search_index(index) do
    items = list(m(index, "items", []))

    %{
      "ok" => true,
      "version" => @boot_search_version,
      "format" => "sv-boot-search-v3",
      "fields" => @boot_search_fields,
      "generatedAt" => m(index, "generatedAt") || JS.date_now(),
      "totalAvailable" => m(index, "totalAvailable") || length(items),
      "total" => length(items),
      "items" => Enum.map(items, &sv_compact_boot_search_row/1)
    }
  end

  # JavaScript source: svWriteBootSearchIndexFile(index)
  def sv_write_boot_search_index_file(index) do
    stamp = State.get(:boot_search_stamp, "") |> empty_fallback(sv_boot_search_stamp())
    payload = sv_compact_boot_search_index(index)
    json = Jason.encode!(payload)
    State.put(:boot_search_file_payload, payload)
    State.put(:boot_search_file_stamp, stamp)
    State.put(:boot_search_file_json, json)

    gzip =
      try do
        :zlib.gzip(json)
      rescue
        _ -> nil
      end

    State.put(:boot_search_file_gzip, gzip)

    case Files.atomic_write(Paths.boot_search(), json) do
      :ok -> :ok
      _ -> IO.warn("[Search] boot index file write failed")
    end

    payload
  end

  # JavaScript source: svGetBootSearchFilePayload()
  def sv_get_boot_search_file_payload do
    index = sv_get_boot_search_index()
    stamp = State.get(:boot_search_stamp, "") |> empty_fallback(sv_boot_search_stamp())
    payload = State.get(:boot_search_file_payload)

    if payload and State.get(:boot_search_file_stamp) == stamp,
      do: payload,
      else: sv_write_boot_search_index_file(index)
  end

  # JavaScript source: svBuildBootSearchIndex()
  def sv_build_boot_search_index do
    groups = [
      {(movie_list() || build_movie_list_sync()) |> Enum.reject(&is_cartoon_or_anime/1), "movie",
       "local", 0},
      {(series_list() || build_series_list_sync()) |> Enum.reject(&is_cartoon_or_anime/1),
       "series", "local", 0},
      {get_cached_movies()
       |> Enum.reject(&is_cartoon_or_anime/1)
       |> Enum.with_index()
       |> Enum.map(fn {m, i} -> ftp_search_movie(m, i) end), "movie", "ftp", 1},
      {get_cached_series()
       |> Enum.reject(&is_cartoon_or_anime/1)
       |> Enum.with_index()
       |> Enum.map(fn {s, i} -> ftp_search_series(s, i) end), "series", "ftp", 1}
    ]

    {items, _seen} =
      Enum.reduce(groups, {[], MapSet.new()}, fn {values, kind, source, rank}, acc ->
        values
        |> Enum.with_index()
        |> Enum.reduce(acc, fn {raw, index}, inner ->
          boot_search_add(raw, kind, source, rank, index, inner)
        end)
      end)

    items =
      Enum.sort_by(items, fn item ->
        {num(m(item, "_svBootSourceRank", 0)), if(sv_search_has_art(item), do: 0, else: 1),
         lower(m(item, "name", ""))}
      end)

    cap = max(1000, trunc(config(:boot_search_max_items)))
    capped = Enum.take(items, cap)
    token_count = Enum.reduce(capped, 0, &(length(list(m(&1, "searchTokens", []))) + &2))

    index = %{
      "ok" => true,
      "version" => @boot_search_version,
      "generatedAt" => JS.date_now(),
      "totalAvailable" => length(items),
      "total" => length(capped),
      "tokenCount" => token_count,
      "items" => capped
    }

    State.put(:boot_search_all_items, items)
    State.put(:boot_search_index, index)
    State.put(:boot_search_stamp, sv_boot_search_stamp())
    sv_write_boot_search_index_file(index)
    IO.puts("Boot search index ready: #{length(capped)} of #{length(items)} titles")
    index
  end

  # JavaScript source: add(raw, kind, source, sourceRank, index)
  defp boot_search_add(raw, kind, source, source_rank, index, {items, seen}) do
    item = sv_boot_search_item(raw, kind, source, source_rank, index)

    if is_nil(item) or not StreamVault.Live.sv_server_playable_item(item, m(item || %{}, "type")) do
      {items, seen}
    else
      key =
        "#{m(item, "type")}|#{sv_normalize_search_text(m(item, "name"))}|#{m(item, "year")}|#{m(item, "streamUrl") || m(item, "id")}"

      if MapSet.member?(seen, key),
        do: {items, seen},
        else: {[item | items], MapSet.put(seen, key)}
    end
  end

  # JavaScript source: svGetBootSearchIndex()
  def sv_get_boot_search_index do
    stamp = sv_boot_search_stamp()
    index = State.get(:boot_search_index)

    if is_nil(index) or State.get(:boot_search_stamp) != stamp,
      do: sv_build_boot_search_index(),
      else: index
  end

  # JavaScript source: svBootSearchScore(item, terms, queryNorm, kind = 'mixed')
  def sv_boot_search_score(item, terms, query_norm, kind \\ "mixed") do
    cond do
      is_nil(item) or terms == [] ->
        -1

      kind == "movie" and m(item, "type") != "movie" ->
        -1

      kind == "series" and m(item, "type") != "series" ->
        -1

      true ->
        name = sv_normalize_search_text(m(item, "name") || m(item, "title") || "")
        text = m(item, "searchText") || name

        tokens =
          if is_list(m(item, "searchTokens")),
            do: m(item, "searchTokens"),
            else: sv_search_tokens_from_text(text)

        base =
          cond do
            name == query_norm -> 9000
            String.starts_with?(name, query_norm <> " ") -> 7200
            String.contains?(name, query_norm) -> 4800
            true -> 0
          end

        score =
          Enum.reduce_while(terms, base, fn term, sum ->
            best = sv_term_best_score(term, tokens)

            if best == 0 and not String.contains?(text, term),
              do: {:halt, -1},
              else: {:cont, sum + if(best > 0, do: best, else: 30)}
          end)

        if score < 0,
          do: -1,
          else:
            score + if(sv_search_has_art(item), do: 350, else: 0) +
              if(not JS.truthy?(m(item, "isFtp")), do: 220, else: 0) +
              if(m(item, "type") == "series", do: 60, else: 0)
    end
  end

  # JavaScript source: svBootSearchRows(q, kind = 'mixed')
  def sv_boot_search_rows(q, kind \\ "mixed") do
    index = sv_get_boot_search_index()
    source = State.get(:boot_search_all_items) || m(index, "items", [])
    terms = sv_search_tokens_from_text(q)
    normalized = sv_normalize_search_text(q)

    if terms == [] do
      []
    else
      source
      |> Enum.filter(&StreamVault.Live.sv_server_playable_item(&1, m(&1, "type")))
      |> Enum.map(&%{"item" => &1, "score" => sv_boot_search_score(&1, terms, normalized, kind)})
      |> Enum.filter(&(num(m(&1, "score")) > 0))
      |> Enum.sort_by(&{-num(m(&1, "score")), lower(m(m(&1, "item", %{}), "name", ""))})
    end
  end

  # JavaScript source: svQueryBootSearchPaged(q, kind = 'mixed', limit = 72, page = 1)
  def sv_query_boot_search_paged(q, kind \\ "mixed", limit \\ 72, page \\ 1) do
    rows = sv_boot_search_rows(q, kind)
    safe_limit = min(120, max(1, int_or(limit, 72)))
    safe_page = max(1, int_or(page, 1))
    start = (safe_page - 1) * safe_limit

    %{
      "items" => rows |> Enum.slice(start, safe_limit) |> Enum.map(&m(&1, "item")),
      "total" => length(rows),
      "page" => safe_page,
      "pages" => max(1, ceil_div(length(rows), safe_limit))
    }
  end

  # JavaScript source: svQueryBootSearch(q, kind = 'mixed', limit = 72)
  def sv_query_boot_search(q, kind \\ "mixed", limit \\ 72),
    do: m(sv_query_boot_search_paged(q, kind, limit, 1), "items", [])

  # JavaScript source: jsonError(res, status, code, message, details = {})
  def json_error(conn, status, code, message, details \\ %{}),
    do: Response.json_error(conn, status, code, message, details)

  # JavaScript source: safeDecodeURIComponent(value)
  def safe_decode_uri_component(value) do
    text = to_string(value || "")

    try do
      URI.decode(String.replace(text, "+", "%20"))
    rescue
      _ -> text
    end
  end

  # JavaScript source: rawQueryParam(req, name)
  def raw_query_param(req, name) do
    original = original_url(req)

    case String.split(original, "?", parts: 2) do
      [_] ->
        nil

      [_, query] ->
        Enum.find_value(String.split(query, "&"), fn part ->
          if part == "" do
            nil
          else
            case String.split(part, "=", parts: 2) do
              [key] ->
                if safe_decode_uri_component(key) == name, do: {:found, ""}, else: nil

              [key, value] ->
                if safe_decode_uri_component(key) == name, do: {:found, value}, else: nil
            end
          end
        end)
        |> case do
          {:found, value} -> value
          _ -> nil
        end
    end
  end

  # JavaScript source: svServerNormalizeUrlForGuard(value)
  def sv_server_normalize_url_for_guard(value) do
    decoded = safe_decode_uri_component(value)

    case URI.parse(decoded) do
      %URI{scheme: scheme, host: host} = uri
      when scheme in ["http", "https"] and is_binary(host) ->
        URI.to_string(uri)

      _ ->
        to_string(value || "") |> String.trim()
    end
  end

  # JavaScript source: svServerLiveSourceBlockReason(value)
  def sv_server_live_source_block_reason(value) do
    decoded = safe_decode_uri_component(value)
    lower_value = lower(decoded)
    uri = URI.parse(decoded)
    path = lower(uri.path || "")

    parts =
      path
      |> String.split("/", trim: true)
      |> Enum.map(&(safe_decode_uri_component(&1) |> lower()))

    cond do
      String.starts_with?(path, "/live/") ->
        "media URL points at /live"

      String.starts_with?(path, "/live-relay/") ->
        "media URL points at /live-relay"

      String.contains?(lower_value, "/live/") or String.contains?(lower_value, "/live-relay/") ->
        "media URL contains live route"

      String.contains?(lower_value, "playlist.m3u8") ->
        "media URL contains live playlist"

      Regex.match?(~r/\btsports(?:hd)?\b|t[ ._-]*sports/i, decoded) ->
        "media URL contains T Sports"

      true ->
        channel_block_reason(decoded, parts)
    end
  end

  # JavaScript source: svServerRejectLiveMediaSource(req, requestedUrl, decodedUrl)
  def sv_server_reject_live_media_source(req, requested_url, decoded_url) do
    reason = sv_server_live_source_block_reason(decoded_url)

    if reason == "" do
      nil
    else
      playback_type = to_string(query_value(req, "playbackType", "media"))
      fallback_reason = to_string(query_value(req, "fallbackReason", ""))

      IO.warn(
        "[Media Playback Guard] blocked live fallback attempt playbackType=#{playback_type} route=#{request_path(req)} selectedSourceURL=#{decoded_url} fallback reason=#{if(fallback_reason == "", do: "none", else: fallback_reason)} reason=#{reason}"
      )

      %RemoteURLError{
        message: "Live TV sources are blocked for media playback",
        status: 400,
        code: "LIVE_MEDIA_SOURCE_BLOCKED",
        requested_url: requested_url,
        decoded_url: decoded_url,
        playback_type: playback_type,
        fallback_reason: fallback_reason,
        block_reason: reason
      }
    end
  end

  # JavaScript source: readRemoteUrlParam(req, names = ['url'])
  def read_remote_url_param(req, names \\ ["url"]) do
    found =
      Enum.find_value(names, fn name ->
        raw = raw_query_param(req, name)
        value = if is_nil(raw), do: query_value(req, name), else: raw
        if is_nil(value) or value == "", do: nil, else: {name, to_string(value)}
      end)

    if is_nil(found) do
      raise RemoteURLError,
        message: "Missing #{Enum.join(names, " or ")} parameter",
        status: 400,
        code: "MISSING_URL"
    else
      {name, requested} = found
      decoded = requested |> safe_decode_uri_component() |> String.trim()
      uri = URI.parse(decoded)

      cond do
        decoded == "" or is_nil(uri.host) or is_nil(uri.scheme) ->
          raise RemoteURLError,
            message: "Invalid media URL",
            status: 400,
            code: "INVALID_URL",
            requested_url: requested,
            decoded_url: decoded

        uri.scheme not in ["http", "https"] ->
          raise RemoteURLError,
            message: "Only HTTP/HTTPS media URLs are supported",
            status: 400,
            code: "UNSUPPORTED_URL_PROTOCOL",
            requested_url: requested,
            decoded_url: decoded

        error = sv_server_reject_live_media_source(req, requested, URI.to_string(uri)) ->
          raise error

        true ->
          %{"param" => name, "requestedUrl" => requested, "decodedUrl" => URI.to_string(uri)}
      end
    end
  end

  # JavaScript source: normalizeUrlForCompare(value)
  def normalize_url_for_compare(value) do
    decoded = safe_decode_uri_component(value)

    case URI.parse(decoded) do
      %URI{scheme: scheme, host: host} = uri
      when scheme in ["http", "https"] and is_binary(host) ->
        URI.to_string(uri)

      _ ->
        to_string(value || "") |> String.trim()
    end
  end

  # JavaScript source: findCatalogItemByStreamUrl(streamUrl)
  def find_catalog_item_by_stream_url(stream_url) do
    target = normalize_url_for_compare(stream_url)

    if target == "" do
      nil
    else
      Enum.find_value(get_cached_movies(), fn movie ->
        if normalize_url_for_compare(m(movie, "streamUrl")) == target,
          do: %{
            "type" => "movie",
            "title" => m(movie, "title"),
            "filename" => m(movie, "filename"),
            "server" => m(movie, "server"),
            "streamUrl" => m(movie, "streamUrl")
          }
      end) ||
        Enum.find_value(get_cached_series(), fn show ->
          Enum.find_value(list(m(show, "seasons", [])), fn season ->
            Enum.find_value(list(m(season, "episodes", [])), fn episode ->
              if normalize_url_for_compare(m(episode, "streamUrl")) == target,
                do: %{
                  "type" => "episode",
                  "title" => m(show, "title"),
                  "season" => m(season, "season"),
                  "filename" => m(episode, "filename"),
                  "server" => m(show, "server"),
                  "streamUrl" => m(episode, "streamUrl")
                }
            end)
          end)
        end)
    end
  end

  # JavaScript source: catalogLogLabel(item)
  def catalog_log_label(item),
    do:
      if(is_nil(item),
        do: "none",
        else: "#{m(item, "type")}: #{m(item, "title") || m(item, "filename") || "unknown"}"
      )

  # JavaScript source: remoteFilename(srcUrl)
  def remote_filename(src_url) do
    uri = URI.parse(to_string(src_url || ""))

    if uri.path,
      do: uri.path |> String.split("/") |> List.last() |> safe_decode_uri_component(),
      else:
        to_string(src_url || "")
        |> String.split("/")
        |> List.last()
        |> empty_fallback("remote media")
  rescue
    _ ->
      to_string(src_url || "")
      |> String.split("/")
      |> List.last()
      |> empty_fallback("remote media")
  end

  # JavaScript source: decodedRemoteMediaLabel(srcUrl = '')
  def decoded_remote_media_label(src_url \\ ""),
    do: src_url |> safe_decode_uri_component() |> lower()

  # JavaScript source: remoteCompatibilityTraits(srcUrl = '')
  def remote_compatibility_traits(src_url \\ "") do
    label = decoded_remote_media_label(src_url)
    named_4k = Regex.match?(~r/(?:^|[^a-z0-9])(?:2160p|4k|uhd)(?:[^a-z0-9]|$)/i, label)
    hevc = Regex.match?(~r/(?:hevc|h[.\s-]?265|x265)/i, label)

    hdr =
      Regex.match?(
        ~r/(?:10[\s-]?bit|hdr10|hdr|dolby[\s._-]?vision|\bdv\b|main[\s._-]?10|p010)/i,
        label
      )

    %{
      "named4k" => named_4k,
      "isHevc" => hevc,
      "isTenBitHdr" => hdr,
      "heavy4kHevc" => named_4k and hevc,
      "heavy4kHevcHdr" => named_4k and hevc and hdr
    }
  end

  # JavaScript source: isRemoteDirectPlayable(srcUrl)
  def is_remote_direct_playable(src_url) do
    clean = src_url |> to_string() |> String.split("?", parts: 2) |> hd() |> lower()

    (String.ends_with?(clean, ".mp4") or String.ends_with?(clean, ".m4v")) and
      not Regex.match?(~r/(x265|h265|hevc|10bit|10-bit)/i, clean)
  end

  # JavaScript source: mimeForMediaPath(srcUrl, fallback = 'video/mp4')
  def mime_for_media_path(src_url, fallback \\ "video/mp4") do
    path =
      URI.parse(to_string(src_url || "")).path ||
        to_string(src_url || "") |> String.split("?", parts: 2) |> hd()

    Map.get(@mime, lower(Path.extname(path)), fallback)
  rescue
    _ -> fallback
  end

  # JavaScript source: remotePlayUrls(srcUrl)
  def remote_play_urls(src_url) do
    encoded = JS.encode_component(src_url)
    direct = is_remote_direct_playable(src_url)
    proxy = "/api/ftp/proxy?url=#{encoded}"
    transcode = "/api/ftp/stream?url=#{encoded}"

    %{
      "directPlayable" => direct,
      "proxyUrl" => proxy,
      "transcodeUrl" => transcode,
      "finalPlayUrl" => if(direct, do: proxy, else: transcode)
    }
  end

  # JavaScript source: remotePlaybackUrls(srcUrl)
  def remote_playback_urls(src_url) do
    encoded = JS.encode_component(src_url)
    redirect = "/api/playback/ftp?url=#{encoded}&mode=redirect"

    %{
      "directPlayable" => is_remote_direct_playable(src_url),
      "redirectUrl" => redirect,
      "proxyUrl" => "/api/playback/ftp?url=#{encoded}&mode=proxy",
      "legacyProxyUrl" => "/api/ftp/proxy?url=#{encoded}",
      "transcodeUrl" => "/api/ftp/stream?url=#{encoded}",
      "finalPlayUrl" => redirect
    }
  end

  # JavaScript source: isTrustedRemotePlaybackUrl(srcUrl, matched)
  def is_trusted_remote_playback_url(_src_url, matched) when not is_nil(matched), do: true

  def is_trusted_remote_playback_url(src_url, nil) do
    host = URI.parse(to_string(src_url)).host |> lower()

    Regex.match?(~r/^172\.16\.50\.\d{1,3}$/, host) or
      Regex.match?(~r/^172\.22\.\d{1,3}\.\d{1,3}$/, host) or
      Regex.match?(~r/^server[\w-]*\.ftpbd\.net$/i, host)
  rescue
    _ -> false
  end

  # JavaScript source: playbackAudioSelectionFromReq(req)
  def playback_audio_selection_from_req(req) do
    absolute = parse_int_nan(query_value(req, "audioStream", ""))
    relative = max(0, int_or(query_value(req, "audio", "0"), 0))
    has_absolute = is_integer(absolute) and absolute >= 0

    %{
      "audioIdx" => relative,
      "audioStreamIdx" => if(has_absolute, do: absolute, else: nil),
      "audioMap" => if(has_absolute, do: "0:#{absolute}", else: "0:a:#{relative}?"),
      "source" => if(has_absolute, do: "absolute-stream", else: "relative-audio")
    }
  end

  # JavaScript source: playbackAudioMapFromReq(req)
  def playback_audio_map_from_req(req), do: m(playback_audio_selection_from_req(req), "audioMap")

  # JavaScript source: serverAudioTrackText(track = {})
  def server_audio_track_text(track \\ %{}),
    do:
      [
        m(track, "language"),
        m(track, "lang"),
        m(track, "title"),
        m(track, "label"),
        m(track, "codec")
      ]
      |> Enum.filter(&JS.truthy?/1)
      |> Enum.join(" ")
      |> lower()

  # JavaScript source: serverAudioTrackIsAudible(track = {})
  def server_audio_track_is_audible(track \\ %{}) do
    channels = JS.number(m(track, "channels"))

    not (is_number(channels) and channels <= 0) and
      not Regex.match?(
        ~r/\b(silent|commentary only|no audio|mute|muted)\b/,
        server_audio_track_text(track)
      )
  end

  # JavaScript source: serverAudioCodecIsPlayable(track = {})
  def server_audio_codec_is_playable(track \\ %{}) do
    codec =
      (m(track, "codec") || m(track, "codecName") || m(track, "codec_name") || "")
      |> to_string()
      |> String.trim()
      |> lower()

    Regex.match?(~r/^(aac|mp3|mp4a|ac3|eac3|opus|vorbis|flac|dts)$/, codec) or
      String.contains?(codec, "aac") or String.contains?(codec, "mp4a")
  end

  # JavaScript source: serverAudioTrackHasDuration(track = {})
  def server_audio_track_has_duration(track \\ %{}), do: num(m(track, "duration")) > 0

  # JavaScript source: firstPlayableAudioStream(tracks = [])
  def first_playable_audio_stream(tracks \\ []),
    do:
      Enum.find(
        list(tracks),
        &(not is_nil(server_audio_track_absolute_index(&1)) and server_audio_codec_is_playable(&1) and
            server_audio_track_has_duration(&1) and server_audio_track_is_audible(&1))
      )

  # JavaScript source: isFtpPlaybackInput(input)
  def is_ftp_playback_input(input),
    do: Regex.match?(~r/^(?:https?|ftp):\/\//i, to_string(input || "") |> String.trim())

  # JavaScript source: decodeFtpAudioStream(input, track)
  def decode_ftp_audio_stream(input, track) do
    case server_audio_track_absolute_index(track) do
      nil ->
        %{
          "decodable" => false,
          "decodedBytes" => 0,
          "decodedFrames" => 0,
          "measuredBitrate" => 0,
          "reason" => "missing stream index"
        }

      stream_index ->
        args = [
          "-hide_banner",
          "-loglevel",
          "error",
          "-nostdin",
          "-analyzeduration",
          "10000000",
          "-probesize",
          "10000000",
          "-i",
          to_string(input),
          "-map",
          "0:#{stream_index}",
          "-vn",
          "-sn",
          "-dn",
          "-t",
          "12",
          "-ac",
          "1",
          "-ar",
          "8000",
          "-f",
          "s16le",
          "pipe:1"
        ]

        case Command.collect(Command.executable(:ffmpeg), args, 30_000, 32 * 1024 * 1024) do
          {:ok, pcm} -> decode_ftp_finish(pcm, "decoded PCM frames", true)
          {:error, :timeout} -> decode_ftp_finish(<<>>, "decode timeout", false)
          {:error, error} -> decode_ftp_finish(command_output(error), command_error(error), false)
        end
    end
  end

  # JavaScript source: finish(decodable, reason)
  defp decode_ftp_finish(pcm, reason, decodable) do
    bytes = byte_size(pcm)

    peak =
      for <<sample::little-signed-16 <- pcm>>, reduce: 0 do
        current -> max(current, abs(sample))
      end

    frames = div(bytes, 2)

    %{
      "decodable" => decodable and frames > 0 and peak > 8,
      "decodedBytes" => bytes,
      "decodedFrames" => frames,
      "peakSample" => peak,
      "measuredBitrate" => if(bytes > 0, do: 128_000, else: 0),
      "audioPacketsDetected" => bytes > 0,
      "reason" => reason
    }
  end

  # JavaScript source: firstValidDecodedAudioStream(input, tracks = [], title = 'FTP media')
  def first_valid_decoded_audio_stream(input, tracks \\ [], title \\ "FTP media") do
    cache_key = media_stable_cache_key(input)
    cache = State.get(:ftp_decoded_audio_validation_cache, ordered_cache())

    case ordered_cache_get(cache, cache_key) do
      nil ->
        result = ftp_validation_promise(input, list(tracks), title)

        State.put(
          :ftp_decoded_audio_validation_cache,
          ordered_cache_put(cache, cache_key, result, 120)
        )

        result

      result ->
        result
    end
  end

  # JavaScript source: validationPromise(async ()
  defp ftp_validation_promise(input, tracks, title) do
    {tested, valid, selected, selected_index, stop} =
      Enum.with_index(tracks)
      |> Enum.reduce_while({[], [], nil, nil, false}, fn {track, index},
                                                         {tested, valid, _, _, _} ->
        rejection =
          cond do
            is_nil(server_audio_track_absolute_index(track)) ->
              "missing stream index"

            not server_audio_codec_is_playable(track) ->
              "unsupported codec"

            not server_audio_track_has_duration(track) ->
              "zero duration"

            not server_audio_track_is_audible(track) ->
              "silent or invalid metadata"

            m(track, "bitrateReported") == true and num(m(track, "bitrate")) <= 0 ->
              "zero reported bitrate"

            true ->
              ""
          end

        decoded = if rejection == "", do: decode_ftp_audio_stream(input, track), else: nil

        rejection =
          if rejection == "" and
               (not JS.truthy?(m(decoded, "decodable")) or
                  not JS.truthy?(m(decoded, "audioPacketsDetected")) or
                  num(m(decoded, "decodedFrames")) <= 0),
             do: m(decoded, "reason") || "no decoded audio frames",
             else: rejection

        validated =
          track
          |> Map.put(
            "bitrate",
            if(num(m(track, "bitrate")) > 0,
              do: num(m(track, "bitrate")),
              else: num(m(decoded || %{}, "measuredBitrate"))
            )
          )
          |> Map.put(
            "audioPacketsDetected",
            JS.truthy?(m(decoded || %{}, "audioPacketsDetected"))
          )
          |> Map.put("decodedAudioFrames", num(m(decoded || %{}, "decodedFrames")))
          |> Map.put("decodedPeakSample", num(m(decoded || %{}, "peakSample")))
          |> Map.put("decodable", rejection == "")
          |> Map.put(
            "validationReason",
            if(rejection == "", do: "decoded-stream selection", else: rejection)
          )

        if rejection == "",
          do: {:halt, {tested ++ [validated], valid ++ [validated], validated, index, true}},
          else: {:cont, {tested ++ [validated], valid, nil, nil, false}}
      end)

    remaining =
      if stop,
        do:
          Enum.drop(tracks, length(tested))
          |> Enum.map(
            &(&1
              |> Map.put("decodable", nil)
              |> Map.put("validationReason", "not tested after first valid decoded stream"))
          ),
        else: []

    result = %{
      "ftpStreams" => tested ++ remaining,
      "validAudioStreams" => valid,
      "selectedTrack" => selected,
      "selectedIndex" => selected_index
    }

    IO.inspect(
      %{
        "title" => title,
        "ftpStreams" => m(result, "ftpStreams"),
        "validAudioStreams" => valid,
        "selectedIndex" => selected_index,
        "reason" => "decoded-stream selection"
      }, label: "[FTP AUDIO FIX]")

    result
  end

  # JavaScript source: logAudioSelectionFix(title, tracks, selectedTrack)
  def log_audio_selection_fix(title, tracks, selected_track) do
    values = list(tracks)

    IO.inspect(
      %{
        "title" => title,
        "detectedTracks" => values,
        "selectedIndex" =>
          if(selected_track, do: Enum.find_index(values, &(&1 == selected_track)), else: nil),
        "reason" => "first valid audio stream rule"
      }, label: "[AUDIO SELECTION FIX]")

    :ok
  end

  # JavaScript source: isKhoGayeHumKahanTitle(...values)
  def is_kho_gaye_hum_kahan_title(values) do
    values = if is_list(values), do: values, else: [values]

    Enum.any?(values, fn value ->
      value
      |> to_string_or_empty()
      |> String.split(~r/[?#]/, parts: 2)
      |> hd()
      |> String.replace(~r/\.[a-z0-9]{2,5}$/i, "")
      |> String.replace(~r/[._-]+/, " ")
      |> String.replace(~r/\s+/, " ")
      |> String.trim()
      |> then(&Regex.match?(~r/^kho gaye hum kahan(?:\s*[\[(]?2023[\])]?|\s|$)/i, &1))
    end)
  end

  # JavaScript source: kghkAudioCapableTrack(track = {})
  def kghk_audio_capable_track(track \\ %{}),
    do: not is_nil(track) and first_playable_audio_stream([track]) == track

  # JavaScript source: khoGayeHumKahanAudioDecision(tracks, label = 'media')
  def kho_gaye_hum_kahan_audio_decision(tracks, label \\ "media") do
    values = list(tracks)
    IO.inspect(values, label: "[KGHK AUDIO STREAMS]")
    valid = Enum.find(values, &kghk_audio_capable_track/1)
    index = if valid, do: Enum.find_index(values, &(&1 == valid)), else: -1
    default_index = if index >= 0, do: index, else: 0
    mapping = if index >= 0, do: "0:a:#{index}", else: "0:a:0?"
    if is_nil(valid), do: IO.warn("[KGHK AUDIO] No valid audio track found for #{label}")
    log_audio_selection_fix(label, values, valid)

    state = %{
      "audioStreamsDetected" => length(values),
      "selectedAudioIndex" => default_index,
      "ffmpegMapping" => mapping,
      "hlsAudioTracks" => nil
    }

    IO.inspect(state, label: "[KGHK FINAL AUDIO STATE]")

    Map.merge(
      %{"validTrack" => valid, "defaultAudioIndex" => default_index, "audioSafeMode" => true},
      state
    )
  end

  # JavaScript source: resolveKhoGayeHumKahanAudio(req, tracks, info = {}, label = 'media')
  def resolve_kho_gaye_hum_kahan_audio(req, tracks, info \\ %{}, label \\ "media") do
    decision = kho_gaye_hum_kahan_audio_decision(tracks, label)

    if is_nil(m(decision, "validTrack")) do
      playback_audio_selection_from_req(req)
      |> Map.merge(%{
        "defaultAudioIndex" => 0,
        "audioIndex" => 0,
        "audioSafeMode" => true,
        "audioStreamsDetected" => m(decision, "audioStreamsDetected"),
        "ffmpegMapping" => m(decision, "ffmpegMapping")
      })
    else
      resolved =
        selection_from_absolute_audio(
          req,
          m(decision, "validTrack"),
          "kghk-title-override",
          stream_start_seconds(m(info, "videoStartTime")),
          finite_number_or(m(info, "videoIndex"), 0),
          m(info, "videoCodec", "")
        )

      Map.merge(resolved, %{
        "defaultAudioIndex" => m(decision, "defaultAudioIndex"),
        "audioIndex" => m(decision, "defaultAudioIndex"),
        "audioSafeMode" => true,
        "audioStreamsDetected" => m(decision, "audioStreamsDetected"),
        "ffmpegMapping" => m(decision, "ffmpegMapping")
      })
    end
  end

  # JavaScript source: resolveKhoGayeHumKahanHlsAudio(input, label = 'media')
  def resolve_kho_gaye_hum_kahan_hls_audio(input, label \\ "media") do
    try do
      info = get_cached_audio_only_media_info(input)
      tracks = list(m(info, "audioTracks", []))
      decision = kho_gaye_hum_kahan_audio_decision(tracks, label)

      pending =
        playback_audio_selection_from_req(%{"query" => %{}})
        |> Map.merge(%{"audioMap" => "0:a:0?", "source" => "kghk-hls-audio-pending"})

      if is_nil(m(decision, "validTrack")) do
        pending
      else
        selection_from_absolute_audio(
          %{"query" => %{}},
          m(decision, "validTrack"),
          "kghk-hls-first-valid",
          m(info, "videoStartTime"),
          m(info, "videoIndex"),
          m(info, "videoCodec", "")
        )
        |> Map.merge(%{
          "audioIdx" => m(decision, "selectedAudioIndex"),
          "audioMap" => m(decision, "ffmpegMapping"),
          "defaultAudioIndex" => m(decision, "defaultAudioIndex"),
          "audioIndex" => m(decision, "defaultAudioIndex"),
          "audioSafeMode" => true,
          "audioStreamsDetected" => m(decision, "audioStreamsDetected"),
          "ffmpegMapping" => m(decision, "ffmpegMapping")
        })
      end
    rescue
      error ->
        IO.warn("[KGHK AUDIO STREAMS] [] #{Exception.message(error)}")
        log_audio_selection_fix(label, [], nil)

        pending =
          playback_audio_selection_from_req(%{"query" => %{}})
          |> Map.merge(%{"audioMap" => "0:a:0?", "source" => "kghk-hls-audio-pending"})

        IO.inspect(
          %{
            "audioStreamsDetected" => 0,
            "selectedAudioIndex" => 0,
            "ffmpegMapping" => m(pending, "audioMap"),
            "hlsAudioTracks" => nil
          }, label: "[KGHK FINAL AUDIO STATE]")

        pending
    end
  end

  # JavaScript source: serverAudioTrackAbsoluteIndex(track = {})
  def server_audio_track_absolute_index(track \\ %{}) do
    value = JS.number(m(track, "streamIndex") || m(track, "sourceIndex") || m(track, "index"))
    if is_number(value) and value >= 0, do: trunc(value), else: nil
  end

  # JavaScript source: selectionFromAbsoluteAudio(req, track, source = 'first-playable-audio', videoStartTime = 0, videoStreamIdx = 0, videoCodec = '')
  def selection_from_absolute_audio(
        req,
        track,
        source \\ "first-playable-audio",
        video_start_time \\ 0,
        video_stream_idx \\ 0,
        video_codec \\ ""
      ) do
    case server_audio_track_absolute_index(track) do
      nil ->
        playback_audio_selection_from_req(req)

      absolute ->
        relative = JS.number(m(track, "relativeIndex"))
        audio_start = stream_start_seconds(m(track, "startTime") || m(track, "start_time"))
        video_start = stream_start_seconds(video_start_time)

        %{
          "audioIdx" =>
            if(is_number(relative) and relative >= 0,
              do: trunc(relative),
              else: max(0, int_or(query_value(req, "audio", "0"), 0))
            ),
          "audioStreamIdx" => absolute,
          "audioMap" => "0:#{absolute}",
          "source" => source,
          "audioLanguage" => m(track, "language") || m(track, "lang") || "",
          "audioTitle" => m(track, "title") || m(track, "label") || "",
          "audioCodec" => m(track, "codec", "") || "",
          "videoCodec" => video_codec || "",
          "audioStartTime" => audio_start,
          "videoStartTime" => video_start,
          "audioVideoOffsetSec" => rounded_seconds(audio_start - video_start),
          "videoStreamIdx" => finite_number_or(video_stream_idx, 0)
        }
    end
  end

  # JavaScript source: resolvePlaybackAudioSelection(req, input, label = 'media')
  def resolve_playback_audio_selection(req, input, label \\ "media") do
    selection = playback_audio_selection_from_req(req)
    ftp? = is_ftp_playback_input(input)
    kghk? = is_kho_gaye_hum_kahan_title([label, input])
    cache_key = playback_audio_selection_cache_key(req, input)

    cached =
      if kghk? or ftp?,
        do: nil,
        else:
          ordered_cache_get(
            State.get(:playback_audio_selection_cache, ordered_cache()),
            cache_key
          )

    if cached do
      clone_playback_audio_selection(cached)
    else
      try do
        info = get_cached_audio_only_media_info(input)
        tracks = list(m(info, "audioTracks", []))
        video_start = stream_start_seconds(m(info, "videoStartTime"))
        video_index = finite_number_or(m(info, "videoIndex"), 0)

        cond do
          ftp? ->
            validated = first_valid_decoded_audio_stream(input, tracks, label)
            selected = m(validated, "selectedTrack")

            if selected,
              do:
                selection_from_absolute_audio(
                  req,
                  selected,
                  "ftp-decoded-stream",
                  video_start,
                  video_index,
                  m(info, "videoCodec", "")
                )
                |> Map.merge(%{
                  "defaultAudioIndex" => m(validated, "selectedIndex"),
                  "audioIndex" => m(validated, "selectedIndex"),
                  "ftpAudioValidated" => true
                }),
              else: selection

          kghk? ->
            resolve_kho_gaye_hum_kahan_audio(req, tracks, info, label)

          true ->
            requested = m(selection, "audioStreamIdx")

            selected =
              if not is_nil(requested),
                do:
                  Enum.find(
                    tracks,
                    &(server_audio_track_absolute_index(&1) == requested and
                        first_playable_audio_stream([&1]) != nil)
                  ),
                else: nil

            source = if selected, do: "absolute-stream", else: "first-playable-audio"
            selected = selected || first_playable_audio_stream(tracks)
            log_audio_selection_fix(label, tracks, selected)

            if selected do
              index = Enum.find_index(tracks, &(&1 == selected))

              result =
                selection_from_absolute_audio(
                  req,
                  selected,
                  source,
                  video_start,
                  video_index,
                  m(info, "videoCodec", "")
                )
                |> Map.merge(%{"defaultAudioIndex" => index, "audioIndex" => index})

              remember_playback_audio_selection(cache_key, result)
            else
              selection
            end
        end
      rescue
        _ ->
          log_audio_selection_fix(label, [], nil)
          selection
      end
    end
  end

  # JavaScript source: requireAbsolutePlaybackAudio(req, res, audioSelection, mode, label = 'media')
  def require_absolute_playback_audio(req, conn, audio_selection, mode, label \\ "media") do
    if not is_nil(m(audio_selection, "audioStreamIdx")),
      do: true,
      else:
        {:error,
         json_error(
           conn,
           400,
           "ABSOLUTE_AUDIO_STREAM_REQUIRED",
           "Mapped playback requires a ffprobe absolute audio stream index",
           %{
             "mode" => mode,
             "label" => label,
             "requestedAudio" => m(audio_selection, "audioIdx"),
             "source" => m(audio_selection, "source"),
             "requestPath" => request_path(req)
           }
         )}
  end

  # JavaScript source: resolvePlaybackAudioSelectionFromMediaInfo(req, mediaInfo = {}, label = 'media')
  def resolve_playback_audio_selection_from_media_info(req, media_info \\ %{}, label \\ "media") do
    tracks = list(m(media_info, "audioTracks", []))

    if is_kho_gaye_hum_kahan_title([label]) do
      resolve_kho_gaye_hum_kahan_audio(req, tracks, media_info, label)
    else
      selection = playback_audio_selection_from_req(req)
      requested = m(selection, "audioStreamIdx")

      selected =
        if not is_nil(requested),
          do:
            Enum.find(
              tracks,
              &(server_audio_track_absolute_index(&1) == requested and
                  first_playable_audio_stream([&1]) != nil)
            ),
          else: nil

      source = if selected, do: "absolute-stream", else: "first-playable-audio"
      selected = selected || first_playable_audio_stream(tracks)
      log_audio_selection_fix(label, tracks, selected)

      if selected do
        index = Enum.find_index(tracks, &(&1 == selected))

        selection_from_absolute_audio(
          req,
          selected,
          source,
          stream_start_seconds(m(media_info, "videoStartTime")),
          finite_number_or(m(media_info, "videoIndex"), 0),
          m(media_info, "videoCodec", "")
        )
        |> Map.merge(%{"defaultAudioIndex" => index, "audioIndex" => index})
      else
        selection
      end
    end
  end

  # JavaScript source: playbackStartFromReq(req)
  def playback_start_from_req(req), do: max(0, parse_float_or_zero(query_value(req, "start")))

  # JavaScript source: playbackDurationSeconds(input, label = 'media')
  def playback_duration_seconds(input, label \\ "media") do
    try do
      num(m(get_cached_duration_only_media_info(input), "duration"))
    rescue
      error ->
        IO.warn(
          "[Playback Duration] Could not read duration for #{label}: #{Exception.message(error)}"
        )

        0
    end
  end

  # JavaScript source: normalizePlaybackMode(value, fallback = 'direct')
  def normalize_playback_mode(value, fallback \\ "direct") do
    case lower(if(JS.truthy?(value), do: value, else: fallback)) do
      mode when mode in ["proxy", "stream"] -> "proxy"
      "remux" -> "remux"
      mode when mode in ["audio", "audio-transcode", "audio-copy"] -> "audio"
      mode when mode in ["hls", "transcode"] -> "hls"
      mode when mode in ["redirect", "direct"] -> "direct"
      _ -> fallback
    end
  end

  # JavaScript source: playbackQueryFromReq(req, extra = {})
  def playback_query_from_req(req, extra \\ %{}) do
    values =
      [
        {"playbackType", query_value(req, "playbackType")},
        {"fallbackReason", query_value(req, "fallbackReason")},
        {"start",
         if(JS.truthy?(query_value(req, "start")), do: floor(playback_start_from_req(req)))},
        {"audio", query_value(req, "audio")},
        {"audioStream", query_value(req, "audioStream")},
        {"quality", query_value(req, "quality")}
      ] ++ Enum.to_list(safe_map(extra))

    encoded = query_encode(values)
    if encoded == "", do: "", else: "?" <> encoded
  end

  # JavaScript source: remotePlaybackHlsUrl(srcUrl, req)
  def remote_playback_hls_url(src_url, req) do
    values = [
      {"url", src_url},
      {"playbackType", query_value(req, "playbackType")},
      {"fallbackReason", query_value(req, "fallbackReason")},
      {"start",
       if(JS.truthy?(query_value(req, "start")), do: floor(playback_start_from_req(req)))},
      {"audio", query_value(req, "audio")},
      {"audioStream", query_value(req, "audioStream")},
      {"quality", query_value(req, "quality")},
      {"client", query_value(req, "client")}
    ]

    "/api/mobile-hls/ftp/index.m3u8?" <> query_encode(values)
  end

  # JavaScript source: remotePlaybackModeUrl(srcUrl, req, mode)
  def remote_playback_mode_url(src_url, req, mode) do
    values = [
      {"url", src_url},
      {"mode", mode},
      {"playbackType", query_value(req, "playbackType")},
      {"fallbackReason", query_value(req, "fallbackReason")},
      {"start",
       if(JS.truthy?(query_value(req, "start")), do: floor(playback_start_from_req(req)))},
      {"audio", query_value(req, "audio")},
      {"audioStream", query_value(req, "audioStream")},
      {"quality", query_value(req, "quality")}
    ]

    "/api/playback/ftp?" <> query_encode(values)
  end

  # JavaScript source: localPlaybackHlsUrl(id, req)
  def local_playback_hls_url(id, req) do
    extra =
      if JS.truthy?(query_value(req, "client")),
        do: %{"client" => query_value(req, "client")},
        else: %{}

    "/api/mobile-hls/local/#{JS.encode_component(id)}/index.m3u8" <>
      playback_query_from_req(req, extra)
  end

  # JavaScript source: playbackUrlHasUnsupportedVideoHint(srcUrl)
  def playback_url_has_unsupported_video_hint(src_url),
    do: Regex.match?(~r/(x265|h265|hevc|10bit|10-bit|av1|vp9|vp8)/i, to_string(src_url || ""))

  # JavaScript source: preferredRemotePlaybackMode(srcUrl)
  def preferred_remote_playback_mode(src_url) do
    cond do
      playback_url_has_unsupported_video_hint(src_url) -> "hls"
      is_remote_direct_playable(src_url) -> "proxy"
      remote_video_can_copy(src_url) -> "remux"
      true -> "hls"
    end
  end

  # JavaScript source: playbackUrlHasHevcHint(srcUrl)
  def playback_url_has_hevc_hint(src_url),
    do: Regex.match?(~r/(x265|h265|hevc)/i, to_string(src_url || ""))

  # JavaScript source: readTrustedRemotePlaybackMedia(req, res, errorAsJson = true)
  def read_trusted_remote_playback_media(req, conn, error_as_json \\ true) do
    try do
      media = read_remote_url_param(req, ["url", "streamUrl", "movie", "movieUrl", "src"])
      src_url = m(media, "decodedUrl")
      matched = find_catalog_item_by_stream_url(src_url)

      if is_trusted_remote_playback_url(src_url, matched) do
        {:ok, %{"media" => media, "srcUrl" => src_url, "matched" => matched}}
      else
        response =
          if error_as_json,
            do:
              json_error(
                conn,
                403,
                "REMOTE_MEDIA_NOT_ALLOWED",
                "Remote media host is not allowed for browser playback",
                %{
                  "requestedUrl" => m(media, "requestedUrl"),
                  "decodedUrl" => src_url,
                  "matchedCatalogItem" => matched
                }
              ),
            else:
              Response.text(conn, "Remote media host is not allowed for browser playback", 403)

        {:error, response}
      end
    rescue
      error in RemoteURLError ->
        response =
          if error_as_json,
            do:
              json_error(conn, error.status || 400, error.code || "INVALID_URL", error.message, %{
                "requestedUrl" => error.requested_url,
                "decodedUrl" => error.decoded_url
              }),
            else: Response.text(conn, error.message, error.status || 400)

        {:error, response}
    end
  end

  # JavaScript source: remoteVideoCanCopy(srcUrl)
  def remote_video_can_copy(src_url) do
    clean = src_url |> to_string() |> String.split("?", parts: 2) |> hd() |> lower()
    ext = Path.extname(clean)

    ext in ~w(.mkv .mp4 .m4v .mov) and
      not Regex.match?(~r/(x265|h265|hevc|10bit|10-bit|vp9|vp8|av1|xvid|divx)/i, clean) and
      (Regex.match?(~r/(x264|h264|avc)/i, clean) or ext in ~w(.mp4 .m4v .mov))
  end

  # JavaScript source: ffmpegFilterEscape(value)
  def ffmpeg_filter_escape(value),
    do:
      to_string(value || "")
      |> String.replace("\\", "\\\\")
      |> String.replace(":", "\\:")
      |> String.replace("'", "\\'")
      |> String.replace(",", "\\,")
      |> String.replace("[", "\\[")
      |> String.replace("]", "\\]")

  # JavaScript source: remoteProbe(srcUrl, method, headers, timeoutMs = 8000)
  def remote_probe(src_url, method, headers, timeout_ms \\ 8000) do
    method =
      case method |> to_string() |> String.upcase() do
        "HEAD" -> :head
        "GET" -> :get
        other -> raise ArgumentError, "unsupported remote probe method #{other}"
      end

    case HTTP.request(method, src_url, Enum.to_list(headers), nil,
           timeout: timeout_ms,
           receive_timeout: timeout_ms
         ) do
      {:ok, response} ->
        %{
          "status" => response.status,
          "headers" => Map.new(response.headers),
          "ok" => (response.status >= 200 and response.status < 400) or response.status == 206
        }

      {:error, reason} ->
        raise "#{inspect(reason)}"
    end
  end

  # JavaScript source: checkRemoteAvailability(srcUrl, req)
  def check_remote_availability(src_url, req) do
    headers = %{
      "User-Agent" => empty_fallback(request_header(req, "user-agent"), "Mozilla/5.0"),
      "Accept" => "*/*"
    }

    head =
      try do
        remote_probe(src_url, "HEAD", headers)
      rescue
        error -> %{"status" => 0, "error" => Exception.message(error)}
      end

    if JS.truthy?(m(head, "ok")) do
      Map.merge(%{"ok" => true, "method" => "HEAD"}, head)
    else
      try do
        get = remote_probe(src_url, "GET", Map.put(headers, "Range", "bytes=0-0"))

        if JS.truthy?(m(get, "ok")),
          do: Map.merge(%{"ok" => true, "method" => "GET_RANGE"}, get),
          else: Map.merge(%{"ok" => false, "method" => "GET_RANGE", "head" => head}, get)
      rescue
        error ->
          %{
            "ok" => false,
            "method" => "GET_RANGE",
            "status" => m(head, "status", 0),
            "head" => head,
            "error" => Exception.message(error)
          }
      end
    end
  end

  # JavaScript source: remoteSubtitleCandidateUrls(srcUrl)
  def remote_subtitle_candidate_urls(src_url) do
    uri = URI.parse(to_string(src_url || ""))
    ext = Path.extname(uri.path || "")

    if uri.scheme not in ["http", "https"] or ext == "" do
      []
    else
      base = String.slice(uri.path, 0, byte_size(uri.path) - byte_size(ext))

      suffixes = [
        ".esub.vtt",
        ".e-sub.vtt",
        ".msubs.vtt",
        ".m-subs.vtt",
        ".multi.vtt",
        ".multi-subs.vtt",
        ".en.vtt",
        ".eng.vtt",
        ".english.vtt",
        ".vtt",
        ".esub.srt",
        ".e-sub.srt",
        ".msubs.srt",
        ".m-subs.srt",
        ".multi.srt",
        ".multi-subs.srt",
        ".en.srt",
        ".eng.srt",
        ".english.srt",
        ".srt",
        ".esub.ass",
        ".e-sub.ass",
        ".msubs.ass",
        ".m-subs.ass",
        ".multi.ass",
        ".multi-subs.ass",
        ".en.ass",
        ".eng.ass",
        ".english.ass",
        ".ass",
        ".esub.ssa",
        ".e-sub.ssa",
        ".msubs.ssa",
        ".m-subs.ssa",
        ".multi.ssa",
        ".multi-subs.ssa",
        ".en.ssa",
        ".eng.ssa",
        ".english.ssa",
        ".ssa"
      ]

      suffixes |> Enum.map(&URI.to_string(%{uri | path: base <> &1})) |> Enum.uniq()
    end
  rescue
    _ -> []
  end

  # JavaScript source: remoteSubtitleLabel(sidecarUrl, index)
  def remote_subtitle_label(sidecar_url, index) do
    file =
      try do
        URI.parse(sidecar_url).path |> Path.basename() |> URI.decode()
      rescue
        _ -> ""
      end

    lower_file = lower(file)

    cond do
      Regex.match?(~r/\b(m-?subs?|multi[ ._-]*subs?|multi[ ._-]*subtitles?)\b/i, lower_file) ->
        "Multi Subtitles"

      Regex.match?(~r/\b(e-?sub)\b/i, lower_file) ->
        "English"

      Regex.match?(~r/\b(eng|english|en)\b|\.(eng|english|en)\./i, file) ->
        "English"

      Regex.match?(~r/\b(hin|hindi|hi)\b|\.(hin|hindi|hi)\./i, file) ->
        "Hindi"

      Regex.match?(~r/\b(ben|bengali|bangla|bn)\b|\.(ben|bengali|bangla|bn)\./i, file) ->
        "Bengali"

      file != "" ->
        String.replace(file, ~r/\.(srt|vtt|ass|ssa)$/i, "")

      true ->
        "Subtitle #{index + 1}"
    end
  end

  # JavaScript source: remoteSubtitleExists(sidecarUrl, req)
  def remote_subtitle_exists(sidecar_url, req) do
    headers = %{
      "User-Agent" => empty_fallback(request_header(req, "user-agent"), "Mozilla/5.0"),
      "Accept" => "text/vtt,text/plain,*/*",
      "Accept-Encoding" => "identity"
    }

    head =
      try do
        remote_probe(sidecar_url, "HEAD", headers, 2500)
      rescue
        _ -> nil
      end

    cond do
      head && JS.truthy?(m(head, "ok")) ->
        true

      head && m(head, "status") not in [403, 405] ->
        false

      true ->
        try do
          JS.truthy?(
            m(
              remote_probe(sidecar_url, "GET", Map.put(headers, "Range", "bytes=0-511"), 2500),
              "ok"
            )
          )
        rescue
          _ -> false
        end
    end
  end

  # JavaScript source: discoverRemoteSubtitleTracks(srcUrl, req)
  def discover_remote_subtitle_tracks(src_url, req) do
    remote_subtitle_candidate_urls(src_url)
    |> Enum.take(16)
    |> Enum.with_index()
    |> Task.async_stream(
      fn {candidate, index} ->
        if remote_subtitle_exists(candidate, req) do
          ext = candidate |> URI.parse() |> Map.get(:path) |> Path.extname() |> lower()

          %{
            "index" => index,
            "label" => remote_subtitle_label(candidate, index),
            "lang" => if(Regex.match?(~r/\.en(?:g|glish)?\./i, candidate), do: "en", else: ""),
            "src" => candidate,
            "ext" => ext,
            "sidecar" => true
          }
        end
      end, ordered: true, timeout: 5000)
    |> Enum.flat_map(fn
      {:ok, nil} -> []
      {:ok, track} -> [track]
      _ -> []
    end)
    |> Enum.take(8)
  end

  # JavaScript source: isAllowedRemoteSubtitleSidecar(srcUrl, sidecarUrl)
  def is_allowed_remote_subtitle_sidecar(src_url, sidecar_url),
    do: sidecar_url in remote_subtitle_candidate_urls(src_url)

  # JavaScript source: fetchRemoteText(url, req, maxBytes = 5 * 1024 * 1024)
  def fetch_remote_text(url, req, max_bytes \\ 5 * 1024 * 1024) do
    headers = [
      {"User-Agent", empty_fallback(request_header(req, "user-agent"), "Mozilla/5.0")},
      {"Accept", "text/vtt,text/plain,*/*"},
      {"Accept-Encoding", "identity"}
    ]

    case HTTP.request(:get, url, headers, nil, timeout: 15_000, receive_timeout: 15_000) do
      {:ok, %{status: status, body: body}}
      when status >= 200 and status < 400 and byte_size(body) <= max_bytes ->
        body

      {:ok, %{status: status}} when status < 200 or status >= 400 ->
        raise "subtitle request failed #{status}"

      {:ok, _} ->
        raise "subtitle too large"

      {:error, :timeout} ->
        raise "subtitle request timed out"

      {:error, reason} ->
        raise inspect(reason)
    end
  end

  # JavaScript source: sendRemoteSidecarSubtitleAsVtt(req, res, srcUrl, sidecarUrl)
  def send_remote_sidecar_subtitle_as_vtt(req, conn, src_url, sidecar_url) do
    if not is_allowed_remote_subtitle_sidecar(src_url, sidecar_url) do
      json_error(conn, 403, "REMOTE_SUBTITLE_NOT_ALLOWED", "Remote subtitle path is not allowed")
    else
      try do
        raw = fetch_remote_text(sidecar_url, req)
        ext = sidecar_url |> URI.parse() |> Map.get(:path) |> Path.extname() |> lower()

        body =
          cond do
            ext == ".srt" -> StreamVault.Playback.srt_to_vtt(raw)
            ext in [".ass", ".ssa"] -> StreamVault.Playback.ass_to_vtt(raw)
            Regex.match?(~r/^WEBVTT\b/i, String.trim(raw)) -> raw
            true -> "WEBVTT\n\n#{raw}"
          end

        conn
        |> Plug.Conn.put_resp_header("access-control-allow-origin", "*")
        |> Plug.Conn.put_resp_header("cache-control", "public, max-age=3600")
        |> Response.text(body, 200, "text/vtt; charset=utf-8")
      rescue
        error ->
          IO.warn("[FTP Sidecar Subtitle] Error: #{Exception.message(error)}")
          if conn.state == :unset, do: Response.text(conn, "WEBVTT\n\n", 502), else: conn
      end
    end
  end

  # JavaScript source: saveCache()
  def save_cache, do: Files.write_json(Paths.poster_cache(), poster_cache(), true)

  # JavaScript source: saveHistory()
  def save_history, do: Files.write_json(Paths.history(), watch_history(), true)

  # JavaScript source: cleanTitle(filename)
  def clean_title(filename) do
    name =
      filename
      |> Path.basename(Path.extname(filename))
      |> String.replace(~r/[._]+/, " ")
      |> String.trim()

    name =
      name
      |> String.replace(
        ~r/\b(1080p|720p|480p|4k|2160p|uhd|bluray|blu[\s-]?ray|webrip|web[\s-]?dl|hdtv|x264|x265|hevc|aac|dts|extended|remastered|director.?s?.?cut|proper|repack|hdr|dolby|atmos)\b.*/i,
        ""
      )
      |> String.replace(~r/[\(\[\{][^\)\]\}]{0,50}[\)\]\}]?/, "")
      |> String.replace(~r/\s*-\s*/, " ")
      |> String.replace(~r/[,\.\-\(\[\{]+$/, "")
      |> String.trim()

    stripped = String.replace(name, ~r/\s+((?:19|20)\d{2})\s*$/, "") |> String.trim()
    if String.length(stripped) >= 2, do: stripped, else: name
  end

  # JavaScript source: parseSeriesFilename(filename)
  def parse_series_filename(filename) do
    parts = filename |> String.replace("\\", "/") |> String.split("/")
    base = Path.basename(filename, Path.extname(filename))
    parent = if length(parts) >= 2, do: Enum.at(parts, -2), else: ""

    clean =
      base
      |> String.replace(~r/[._]+/, " ")
      |> String.trim()
      |> String.replace(~r/[\[\(][^\]\)]*[\]\)]/, " ")
      |> String.replace(~r/\s+/, " ")
      |> String.trim()
      |> String.replace(
        ~r/\b(\d{3,4}p|BluRay|BRRip|WEBRip|WEB[\s-]?DL|HDTV|NF|AMZN|DSNP|HMAX|x264|x265|HEVC|AAC|DTS|AC3|MSubs|ESub|Dual|Hindi|English|Multi|Pahe|in|mkv|mp4)\b.*/i,
        ""
      )
      |> String.trim()

    case Regex.run(~r/^(.+?)\s+[Ss](\d{1,2})[Ee](\d{1,3})\b\s*(.*)/, clean) do
      [_, show, season, episode, tail] ->
        title =
          tail
          |> String.replace(~r/\b\d{3,4}p\b.*/i, "")
          |> String.replace(
            ~r/\b(BluRay|BRRip|WEBRip|WEB[\s-]?DL|HDTV|NF|AMZN|DSNP|HMAX|x264|x265|HEVC|AAC|DTS|AC3|MSubs|ESub|Dual|Hindi|English|Multi|Pahe)\b.*/i,
            ""
          )
          |> String.trim()

        title =
          if title == "" and parent != "" do
            folder =
              parent
              |> String.replace(~r/[._]+/, " ")
              |> String.replace(~r/[\[\(][^\]\)]*[\]\)]/, "")
              |> String.trim()

            case Regex.run(~r/[Ss]\d{1,2}[Ee]\d{1,3}\s*(.*)/, folder) do
              [_, value] -> String.replace(value, ~r/\b\d{3,4}p\b.*/i, "") |> String.trim()
              _ -> title
            end
          else
            title
          end

        %{
          "showName" => String.trim(show),
          "season" => int_or(season, 0),
          "episode" => int_or(episode, 0),
          "epTitle" => title
        }

      _ ->
        parse_series_filename_alternates(clean)
    end
  end

  # JavaScript source: omdbEnqueue(query, type)
  def omdb_enqueue(query, type) do
    :global.trans({__MODULE__, :tmdb_queue}, fn ->
      result = fetch_tmdb(query, type)
      Process.sleep(150)
      result
    end)
  end

  # JavaScript source: processTmdbQueue()
  def process_tmdb_queue do
    case State.get(:tmdb_queue, []) do
      [] ->
        State.put(:tmdb_busy, false)
        :ok

      [%{"query" => query, "type" => type, "replyTo" => pid, "ref" => ref} | rest] ->
        State.put(:tmdb_busy, true)
        State.put(:tmdb_queue, rest)
        send(pid, {ref, fetch_tmdb(query, type)})
        Process.send_after(self(), :process_tmdb_queue, 150)
        :ok
    end
  end

  # JavaScript source: httpsGetAuth(url)
  def https_get_auth(url) do
    case HTTP.request(
           :get,
           url,
           [{"Authorization", "Bearer #{@tmdb_token}"}, {"Accept", "application/json"}],
           nil, timeout: 8000, receive_timeout: 8000) do
      {:ok, response} -> response.body
      {:error, reason} -> raise inspect(reason)
    end
  end

  # JavaScript source: fetchTMDB(query, type = '')
  def fetch_tmdb(query, type \\ "") do
    try do
      series? = type == "series"
      endpoint = if series?, do: "search/tv", else: "search/movie"

      {clean, year} =
        case Regex.run(~r/\b((?:19|20)\d{2})\s*$/, query) do
          [match, year] ->
            {String.slice(query, 0, byte_size(query) - byte_size(match)) |> String.trim(),
             "&year=#{year}"}

          _ ->
            {query, ""}
        end

      search_url =
        "https://api.themoviedb.org/3/#{endpoint}?query=#{URI.encode_www_form(clean)}#{year}&include_adult=false"

      results = https_get_auth(search_url) |> Jason.decode!() |> m("results", []) |> list()
      result = Enum.find(results, &JS.truthy?(m(&1, "poster_path"))) || List.first(results)

      if is_nil(result) or not JS.truthy?(m(result, "poster_path")) do
        nil
      else
        poster = "#{@tmdb_image}/w500#{m(result, "poster_path")}"

        backdrop =
          if JS.truthy?(m(result, "backdrop_path")),
            do: "#{@tmdb_image}/w1280#{m(result, "backdrop_path")}",
            else: nil

        release = m(result, "release_date") || m(result, "first_air_date") || ""
        rating_number = num(m(result, "vote_average"))

        rating =
          if rating_number > 0,
            do: :erlang.float_to_binary(rating_number * 1.0, decimals: 1),
            else: nil

        genre =
          list(m(result, "genre_ids", []))
          |> Enum.take(3)
          |> Enum.map(&Map.get(@tmdb_genres, &1))
          |> Enum.filter(& &1)
          |> Enum.join(", ")

        detail_url =
          "https://api.themoviedb.org/3/#{if(series?, do: "tv", else: "movie")}/#{m(result, "id")}#{if(series?, do: "", else: "?append_to_response=credits")}"

        detail =
          try do
            https_get_auth(detail_url) |> Jason.decode!()
          rescue
            _ -> %{}
          end

        runtime =
          if not series? and num(m(detail, "runtime")) > 0,
            do: "#{trunc(num(m(detail, "runtime")))} min",
            else: ""

        director =
          if not series?,
            do:
              list(nested(detail, ["credits", "crew"], []))
              |> Enum.find(&(m(&1, "job") == "Director"))
              |> then(fn item -> if item, do: m(item, "name", ""), else: "" end),
            else: ""

        language =
          case list(m(detail, "spoken_languages", [])) do
            [] ->
              to_string(m(result, "original_language", "")) |> String.upcase()

            values ->
              values |> Enum.map(&m(&1, "english_name")) |> Enum.take(3) |> Enum.join(", ")
          end

        companies = list(m(detail, "production_companies", [])) |> Enum.map(&m(&1, "name"))

        %{
          "tmdbId" => m(result, "id"),
          "poster" => poster,
          "backdrop" => backdrop,
          "overview" => m(result, "overview", "") || "",
          "year" => String.slice(release, 0, 4),
          "rating" => rating,
          "type" => if(series?, do: "tv", else: "movie"),
          "genre" => genre,
          "runtime" => runtime,
          "director" => director,
          "language" => language,
          "productionCompanies" => companies
        }
      end
    rescue
      _ -> nil
    end
  end

  # JavaScript source: getPosterInfo(filename, type = '')
  def get_poster_info(filename, type \\ "") do
    key = Path.basename(filename, Path.extname(filename))

    case m(poster_cache(), key) do
      nil ->
        info = omdb_enqueue(clean_title(filename), type)

        if info do
          State.put(:poster_cache, Map.put(poster_cache(), key, info))
          save_cache()
        end

        info

      info ->
        info
    end
  end

  # JavaScript source: normalizeSubtitleMatchName(value)
  def normalize_subtitle_match_name(value) do
    to_string(value || "")
    |> String.replace(~r/\.[a-z0-9]{2,5}$/i, "")
    |> String.replace(~r/\[[^\]]*\]|\([^\)]*\)/, " ")
    |> String.replace(
      ~r/\b(2160p|1080p|720p|540p|480p|4k|uhd|hdr|webrip|web-rip|webdl|web-dl|bluray|brrip|hdrip|hdtv|dvdrip|x264|x265|h264|h265|hevc|aac|ac3|eac3|ddp?|dts|truehd|atmos|10bit|8bit|nf|amzn|hmax|dsnp|itunes|pahe|rarbg|yts|galaxyrg|esub|msubs?|multi[ ._-]*subs?|subs?|subtitles?|dual[ ._-]*audio|multi[ ._-]*audio|hindi|english|bengali|bangla|tamil|telugu|malayalam)\b/i,
      " "
    )
    |> String.replace(~r/[._-]+/, " ")
    |> String.replace(~r/\s+/, " ")
    |> String.trim()
    |> lower()
  end

  # JavaScript source: subtitleNameLooksRelated(videoBase, subtitleBase)
  def subtitle_name_looks_related(video_base, subtitle_base) do
    video = lower(video_base || "")
    subtitle = lower(subtitle_base || "")

    cond do
      video == "" or subtitle == "" ->
        false

      subtitle == video or
          Enum.any?([".", "-", "_", " "], &String.starts_with?(subtitle, video <> &1)) ->
        true

      true ->
        vc = normalize_subtitle_match_name(video_base)
        sc = normalize_subtitle_match_name(subtitle_base)

        cond do
          vc == "" or sc == "" ->
            false

          vc == sc or String.starts_with?(sc, vc) or String.starts_with?(vc, sc) ->
            true

          true ->
            vt = vc |> String.split() |> Enum.filter(&(String.length(&1) > 1)) |> MapSet.new()
            st = sc |> String.split() |> Enum.filter(&(String.length(&1) > 1))

            MapSet.size(vt) >= 2 and length(st) >= 2 and
              Enum.count(st, &MapSet.member?(vt, &1)) / max(MapSet.size(vt), length(st)) >= 0.72
        end
    end
  end

  # JavaScript source: subtitleLangFromName(value)
  def subtitle_lang_from_name(value) do
    lower_value = lower(value || "")

    cond do
      Regex.match?(~r/\b(e-?sub|eng|english|en)\b|[._\s-](eng|english|en)[._\s-]/i, lower_value) ->
        "en"

      Regex.match?(~r/\b(hin|hindi|hi)\b|[._\s-](hin|hindi|hi)[._\s-]/i, lower_value) ->
        "hi"

      Regex.match?(
        ~r/\b(ben|bengali|bangla|bn)\b|[._\s-](ben|bengali|bangla|bn)[._\s-]/i,
        lower_value
      ) ->
        "bn"

      Regex.match?(~r/\b(tam|tamil|ta)\b|[._\s-](tam|tamil|ta)[._\s-]/i, lower_value) ->
        "ta"

      Regex.match?(~r/\b(tel|telugu|te)\b|[._\s-](tel|telugu|te)[._\s-]/i, lower_value) ->
        "te"

      true ->
        ""
    end
  end

  # JavaScript source: subtitleLabelFromName(value, fallback = 'Subtitle')
  def subtitle_label_from_name(value, fallback \\ "Subtitle") do
    lower_value = lower(value || "")

    cond do
      Regex.match?(~r/\b(m-?subs?|multi[ ._-]*subs?|multi[ ._-]*subtitles?)\b/i, lower_value) ->
        "Multi Subtitles"

      Regex.match?(~r/\b(e-?sub|eng|english|en)\b|[._\s-](eng|english|en)[._\s-]/i, lower_value) ->
        "English"

      Regex.match?(~r/\b(hin|hindi|hi)\b|[._\s-](hin|hindi|hi)[._\s-]/i, lower_value) ->
        "Hindi"

      Regex.match?(
        ~r/\b(ben|bengali|bangla|bn)\b|[._\s-](ben|bengali|bangla|bn)[._\s-]/i,
        lower_value
      ) ->
        "Bengali"

      true ->
        value
        |> to_string_or_empty()
        |> String.replace(~r/\.(srt|vtt|ass|ssa)$/i, "")
        |> String.replace(~r/^[._\-\s]+|[._\-\s]+$/, "")
        |> String.replace(~r/[._-]+/, " ")
        |> String.replace(~r/\s+/, " ")
        |> String.trim()
        |> empty_fallback(fallback)
    end
  end

  # JavaScript source: findSubtitleTracks(dir, videoFile)
  def find_subtitle_tracks(dir, video_file) do
    raw = Path.basename(video_file, Path.extname(video_file))
    base = lower(raw)

    case File.ls(dir) do
      {:ok, entries} ->
        Enum.reduce(entries, [], fn file, tracks ->
          ext = file |> Path.extname() |> lower()
          file_raw = Path.basename(file, ext)
          file_base = lower(file_raw)

          if ext in @subtitle_exts and subtitle_name_looks_related(base, file_base) do
            suffix =
              if String.starts_with?(file_base, base),
                do:
                  String.slice(file_raw, String.length(raw)..-1//1)
                  |> String.replace(~r/^[\._\-\s]+/, ""),
                else: file_raw

            tracks ++
              [
                %{
                  "label" =>
                    subtitle_label_from_name(empty_fallback(suffix, file_raw), "Default"),
                  "lang" =>
                    empty_fallback(
                      subtitle_lang_from_name(empty_fallback(suffix, file_raw)),
                      "en"
                    ),
                  "ext" => ext,
                  "filePath" => Path.join(dir, file)
                }
              ]
          else
            tracks
          end
        end)

      _ ->
        []
    end
  end

  # JavaScript source: buildFileIndex()
  def build_file_index do
    movies = media_files(Paths.movies_dir())
    series = media_files(Paths.series_dir())

    index =
      Enum.map(movies, &%{"dir" => Paths.movies_dir(), "file" => &1, "type" => "movie"}) ++
        Enum.map(series, &%{"dir" => Paths.series_dir(), "file" => &1, "type" => "episode"})

    State.put(:file_index, index)
    IO.puts("Indexed #{length(movies)} movie files")
    IO.puts("Indexed #{length(series)} series episode files")
    IO.puts("Total stream IDs: #{length(index)}")
    index
  end

  # JavaScript source: entryPath(entry)
  def entry_path(entry), do: Path.join(m(entry, "dir"), m(entry, "file"))

  # JavaScript source: buildMovieListSync()
  def build_movie_list_sync do
    cache = poster_cache()

    file_index()
    |> Enum.with_index()
    |> Enum.reduce([], fn {entry, id}, out ->
      if m(entry, "type") == "movie" do
        name = clean_title(m(entry, "file"))

        if name == "",
          do: out,
          else:
            out ++
              [
                movie_list_item(
                  entry,
                  id,
                  name,
                  m(cache, Path.basename(m(entry, "file"), Path.extname(m(entry, "file"))))
                )
              ]
      else
        out
      end
    end)
  end

  # JavaScript source: buildSeriesListSync()
  def build_series_list_sync do
    shows =
      file_index()
      |> Enum.with_index()
      |> Enum.reduce(%{}, fn {entry, id}, map ->
        if m(entry, "type") == "episode" do
          case parse_series_filename(m(entry, "file")) do
            nil ->
              map

            parsed ->
              name = m(parsed, "showName")
              season = m(parsed, "season")
              episode = m(parsed, "episode")
              show = Map.get(map, name, %{"name" => name, "seasons" => %{}})

              seasons =
                Map.update(
                  m(show, "seasons", %{}),
                  to_string(season),
                  [
                    %{
                      "streamId" => id,
                      "episode" => episode,
                      "epTitle" => empty_fallback(m(parsed, "epTitle"), "Episode #{episode}"),
                      "file" => m(entry, "file")
                    }
                  ],
                  &(&1 ++
                      [
                        %{
                          "streamId" => id,
                          "episode" => episode,
                          "epTitle" => empty_fallback(m(parsed, "epTitle"), "Episode #{episode}"),
                          "file" => m(entry, "file")
                        }
                      ])
                )

              Map.put(map, name, Map.put(show, "seasons", seasons))
          end
        else
          map
        end
      end)

    shows
    |> Map.values()
    |> Enum.map(fn show ->
      seasons =
        m(show, "seasons", %{})
        |> Map.new(fn {season, eps} -> {season, Enum.sort_by(eps, &num(m(&1, "episode")))} end)

      show = Map.put(show, "seasons", seasons)

      case m(poster_cache(), "__series__" <> m(show, "name")) do
        nil ->
          show

        info ->
          show
          |> Map.put("poster", m(info, "poster"))
          |> Map.put("tmdbId", m(info, "tmdbId") || m(show, "tmdbId"))
          |> Map.put("overview", m(info, "overview"))
          |> Map.put("year", m(info, "year"))
          |> Map.put("rating", m(info, "rating"))
          |> Map.put("genre", m(info, "genre"))
          |> Map.put("language", m(info, "language"))
          |> Map.put("productionCompanies", m(info, "productionCompanies", []))
      end
    end)
    |> Enum.sort_by(&lower(m(&1, "name", "")))
  end

  # JavaScript source: buildInstantLists()
  def build_instant_lists do
    movies = build_movie_list_sync()
    series = build_series_list_sync()
    State.put(:movie_list, movies)
    State.put(:series_list, series)

    IO.puts(
      "Instant lists ready: #{length(movies)} movies, #{length(series)} series (#{Enum.count(movies, &JS.truthy?(m(&1, "poster")))} movies with posters, #{Enum.count(series, &JS.truthy?(m(&1, "poster")))} series with posters)"
    )

    {movies, series}
  end

  # JavaScript source: runBackgroundEnrichment()
  def run_background_enrichment do
    if State.get(:enrich_busy, false) do
      :ok
    else
      State.put(:enrich_busy, true)
      IO.puts("Background enrichment started...")

      movies =
        Enum.map(movie_list() || [], fn item ->
          if JS.truthy?(m(item, "poster")),
            do: item,
            else: merge_movie_info(item, get_poster_info(m(item, "file"), "movie"))
        end)

      State.put(:movie_list, movies)

      series =
        Enum.map(series_list() || [], fn show ->
          if JS.truthy?(m(show, "poster")) do
            show
          else
            key = "__series__" <> m(show, "name")
            info = m(poster_cache(), key) || omdb_enqueue(m(show, "name"), "series")

            if info and is_nil(m(poster_cache(), key)) do
              State.put(:poster_cache, Map.put(poster_cache(), key, info))
              save_cache()
            end

            merge_series_info(show, info)
          end
        end)

      State.put(:series_list, series)
      State.put(:enrich_busy, false)
      IO.puts("Background enrichment complete")
      :ok
    end
  end

  # JavaScript source: filterCartoonsAndAnime()
  def filter_cartoons_and_anime do
    movies = movie_list() || []
    series = series_list() || []
    filtered_movies = Enum.reject(movies, &is_cartoon_or_anime/1)
    filtered_series = Enum.reject(series, &is_cartoon_or_anime/1)
    State.put(:movie_list, filtered_movies)
    State.put(:series_list, filtered_series)
    State.put(:deduped_movies, nil)
    State.put(:deduped_series, nil)

    IO.puts(
      "Removed #{length(movies) - length(filtered_movies)} cartoon movies, #{length(series) - length(filtered_series)} cartoon series."
    )

    IO.puts(
      "After cartoon filter: #{length(filtered_movies)} movies, #{length(filtered_series)} series remain"
    )

    :ok
  end

  # JavaScript source: server.js lines 3083-3116, GET /poster-cache
  def route_poster_cache(conn) do
    conn = Plug.Conn.fetch_query_params(conn)
    target = query_value(conn, "url", "") |> to_string() |> String.trim()
    uri = URI.parse(target)

    cond do
      target == "" ->
        Response.text(conn, "Missing poster url", 400)

      is_nil(uri.host) or is_nil(uri.scheme) ->
        Response.text(conn, "Invalid poster url", 400)

      uri.scheme not in ["http", "https"] ->
        Response.text(conn, "Unsupported poster protocol", 400)

      true ->
        case HTTP.request(
               :get,
               URI.to_string(uri),
               [
                 {"User-Agent", "StreamVault/1.0"},
                 {"Accept", "image/avif,image/webp,image/*,*/*"}
               ],
               nil, timeout: 12_000, receive_timeout: 12_000) do
          {:ok, response} when response.status in [301, 302, 307, 308] ->
            location =
              response.headers
              |> Enum.find_value(fn {name, value} ->
                if String.downcase(name) == "location", do: value
              end)

            if location,
              do:
                conn
                |> Plug.Conn.put_resp_header("cache-control", "public, max-age=86400")
                |> Response.redirect(location),
              else: Response.empty(conn, response.status)

          {:ok, response} when response.status >= 200 and response.status < 300 ->
            type =
              response.headers
              |> Enum.find_value("image/jpeg", fn {name, value} ->
                if String.downcase(name) == "content-type", do: value
              end)

            conn
            |> Plug.Conn.put_resp_header("cache-control", "public, max-age=2592000, immutable")
            |> Response.text(response.body, 200, type)

          {:ok, response} ->
            Response.empty(conn, if(response.status == 0, do: 502, else: response.status))

          {:error, :timeout} ->
            Response.text(conn, "Poster proxy timeout", 504)

          {:error, error} ->
            IO.warn("[Poster cache] proxy failed: #{inspect(error)}")
            Response.text(conn, "Poster proxy failed", 502)
        end
    end
  end

  # JavaScript source: server.js lines 3122-3124, GET /api/channels
  def route_channels(conn), do: Response.json(conn, channels())

  # JavaScript source: server.js lines 3126-3130, POST /api/channels/reload
  def route_channels_reload(conn) do
    next = load_json(Paths.channels(), [])
    State.put(:channels, next)
    IO.puts("Reloaded #{length(next)} channels")
    Response.json(conn, %{"ok" => true, "count" => length(next)})
  end

  defp audio_track(stream, index, format, include_frames) do
    bitrate = num(m(stream, "bit_rate"))

    track = %{
      "index" => m(stream, "index"),
      "streamIndex" => m(stream, "index"),
      "relativeIndex" => index,
      "codec" => m(stream, "codec_name"),
      "bitrate" => if(bitrate > 0, do: bitrate, else: 0),
      "bitrateReported" => not is_nil(m(stream, "bit_rate")) and m(stream, "bit_rate") != "N/A",
      "duration" => first_positive_float([m(stream, "duration"), m(format, "duration")]),
      "startTime" => stream_start_seconds(m(stream, "start_time")),
      "language" => nested(stream, ["tags", "language"], "und") || "und",
      "title" => nested(stream, ["tags", "title"], nil) || "Audio #{index + 1}",
      "channels" => m(stream, "channels", 0) || 0,
      "channelLayout" => m(stream, "channel_layout", "") || "",
      "default" => nested(stream, ["disposition", "default"], 0) == 1,
      "forced" => nested(stream, ["disposition", "forced"], 0) == 1
    }

    if include_frames,
      do: Map.put(track, "frameCount", max(0, trunc(num(m(stream, "nb_frames"))))),
      else: track
  end

  defp media_cache_identity(file_path, remote_key_entry) do
    case File.stat(to_string(file_path)) do
      {:ok, stat} ->
        {to_string(file_path), "#{stat.size}:#{mtime_number(stat.mtime)}"}

      _ ->
        key = "remote:#{file_path}"
        if remote_key_entry, do: {key, key}, else: {key, key}
    end
  end

  defp reduce_massive_item(item, {movies, seen, series}) do
    url = to_string(m(item, "url") || m(item, "streamUrl") || "") |> String.trim()

    if not Regex.match?(~r/^https?:\/\//i, url) or
         not Regex.match?(~r/\.(mp4|mkv|avi|mov|webm|m3u8|ts|flv|wmv|mpg|mpeg)(?:$|[?#])/i, url) do
      {movies, seen, series}
    else
      source = m(item, "title") || url
      year = sv_extract_year(source)

      if sv_looks_like_series(source) do
        name = sv_canonical_title_for_search(sv_base_show_title(source), year)

        if sv_is_noisy_massive_title(name, source),
          do: {movies, seen, series},
          else: reduce_massive_series(url, name, year, source, {movies, seen, series})
      else
        name = sv_canonical_title_for_search(source, year)
        key = "#{lower(name)}|#{year}"

        if sv_is_noisy_massive_title(name, source) or MapSet.member?(seen, key) do
          {movies, seen, series}
        else
          movie = %{
            "id" => sv_stable_id("sv_clean", url),
            "name" => name,
            "title" => name,
            "file" =>
              url |> sv_safe_decode() |> String.split("/") |> List.last() |> empty_fallback(""),
            "poster" => nil,
            "backdrop" => nil,
            "tmdbId" => nil,
            "year" => year,
            "rating" => nil,
            "type" => "movie",
            "genre" => "",
            "category" => "Massive Catalog",
            "streamUrl" => url,
            "isFtp" => true,
            "isMassiveCatalog" => true
          }

          {[movie | movies], MapSet.put(seen, key), series}
        end
      end
    end
  end

  defp reduce_massive_series(url, name, year, source, {movies, seen, series}) do
    key = "#{lower(name)}|#{year}"
    parsed = sv_parse_episode(source)

    show =
      Map.get(series, key, %{
        "id" => sv_stable_id("sv_series", key),
        "name" => name,
        "title" => name,
        "year" => year,
        "poster" => nil,
        "backdrop" => nil,
        "rating" => nil,
        "genre" => "",
        "type" => "series",
        "isFtp" => true,
        "isMassiveCatalog" => true,
        "seasons" => %{}
      })

    season = to_string(m(parsed, "season"))
    episode = m(parsed, "episode")

    entry = %{
      "streamId" => nil,
      "episode" => episode,
      "epTitle" => "Episode #{episode}",
      "file" => url |> sv_safe_decode() |> String.split("/") |> List.last() |> empty_fallback(""),
      "streamUrl" => url,
      "isFtp" => true,
      "isMassiveCatalog" => true
    }

    seasons = Map.update(m(show, "seasons", %{}), season, [entry], &(&1 ++ [entry]))
    {movies, seen, Map.put(series, key, Map.put(show, "seasons", seasons))}
  end

  defp ftp_search_movie(item, index),
    do: %{
      "id" => "ftp_#{index}",
      "name" => m(item, "title"),
      "title" => m(item, "title"),
      "file" => m(item, "filename", ""),
      "poster" => m(item, "poster"),
      "backdrop" => m(item, "backdrop") || m(item, "poster"),
      "tmdbId" => m(item, "tmdbId"),
      "year" => m(item, "year", ""),
      "rating" => m(item, "rating"),
      "type" => "movie",
      "genre" => m(item, "genre", ""),
      "category" => m(item, "category", ""),
      "streamUrl" => m(item, "streamUrl"),
      "isFtp" => true
    }

  defp ftp_search_series(item, index),
    do: %{
      "id" => "ftp_series_#{index}",
      "name" => m(item, "title") || m(item, "name"),
      "title" => m(item, "title") || m(item, "name"),
      "file" => m(item, "title") || m(item, "name") || "",
      "poster" => m(item, "poster"),
      "backdrop" => m(item, "backdrop") || m(item, "poster"),
      "tmdbId" => m(item, "tmdbId"),
      "year" => m(item, "year", ""),
      "rating" => m(item, "rating"),
      "type" => "series",
      "genre" => m(item, "genre", ""),
      "category" => m(item, "category") || "Series",
      "seasons" => m(item, "seasons", %{}),
      "isFtp" => true,
      "_isSeries" => true
    }

  defp edit_distance_rows(a, b, maximum) do
    previous = Enum.to_list(0..length(b))

    result =
      Enum.with_index(a, 1)
      |> Enum.reduce_while(previous, fn {char, i}, prev ->
        {_left, row_rev, row_min} =
          Enum.with_index(b, 1)
          |> Enum.reduce({i, [i], i}, fn {other, j}, {left, row, minimum} ->
            above = Enum.at(prev, j)
            diagonal = Enum.at(prev, j - 1)
            value = min(above + 1, min(left + 1, diagonal + if(char == other, do: 0, else: 1)))
            {value, [value | row], min(minimum, value)}
          end)

        row = Enum.reverse(row_rev)
        if row_min > maximum, do: {:halt, :too_far}, else: {:cont, row}
      end)

    if result == :too_far, do: maximum + 1, else: List.last(result)
  end

  defp channel_block_reason(decoded, parts) do
    normalized = sv_server_normalize_url_for_guard(decoded) |> lower()

    Enum.find_value(channels(), "", fn channel ->
      id = m(channel, "id", "") |> to_string() |> String.trim() |> lower()
      name = m(channel, "name", "") |> to_string() |> String.trim() |> lower()

      cond do
        id != "" and id in parts ->
          "media URL contains live channel id #{id}"

        name == "t sports" and Regex.match?(~r/t[ ._-]*sports/i, decoded) ->
          "media URL contains T Sports"

        true ->
          urls =
            [m(channel, "url") | list(m(channel, "fallbackUrls", []))]
            |> Enum.map(&sv_server_normalize_url_for_guard/1)
            |> Enum.filter(&JS.truthy?/1)

          if Enum.any?(urls, fn url ->
               candidate = lower(url)

               candidate != "" and
                 (normalized == candidate or String.starts_with?(normalized, candidate <> "?"))
             end),
             do:
               "media URL matches live channel #{empty_fallback(id, empty_fallback(name, "source"))}",
             else: nil
      end
    end)
  end

  defp parse_series_filename_alternates(clean) do
    cond do
      match = Regex.run(~r/^(.+?)\s+(\d{1,2})x(\d{1,3})\b\s*(.*)/i, clean) ->
        [_, show, season, episode, title] = match

        %{
          "showName" => String.trim(show),
          "season" => int_or(season, 0),
          "episode" => int_or(episode, 0),
          "epTitle" => String.trim(title)
        }

      match = Regex.run(~r/^(.+?)\s+[Ss]eason\s*(\d+)\s+[Ee]pisode\s*(\d+)\s*(.*)/i, clean) ->
        [_, show, season, episode, title] = match

        %{
          "showName" => String.trim(show),
          "season" => int_or(season, 0),
          "episode" => int_or(episode, 0),
          "epTitle" => String.trim(title)
        }

      match = Regex.run(~r/^(.+?)\s+[Ee](\d{1,3})\b\s*(.*)/, clean) ->
        [_, show, episode, title] = match

        %{
          "showName" => String.trim(show),
          "season" => 1,
          "episode" => int_or(episode, 0),
          "epTitle" =>
            title
            |> String.replace(
              ~r/\b(720p|1080p|BluRay|WEBRip|x264|x265|HEVC|AAC|NF|AMZN|KOR|ENG|JPN)\b.*/i,
              ""
            )
            |> String.trim()
        }

      true ->
        nil
    end
  end

  defp movie_list_item(entry, id, name, info) do
    info = info || %{}

    %{
      "id" => id,
      "name" => name,
      "file" => m(entry, "file"),
      "poster" => m(info, "poster"),
      "tmdbId" => m(info, "tmdbId"),
      "overview" => m(info, "overview", "") || "",
      "year" => m(info, "year", "") || "",
      "rating" => m(info, "rating"),
      "type" => "movie",
      "genre" => m(info, "genre", "") || "",
      "runtime" => m(info, "runtime", "") || "",
      "director" => m(info, "director", "") || "",
      "language" => m(info, "language", "") || "",
      "productionCompanies" => m(info, "productionCompanies", []) || []
    }
  end

  defp merge_movie_info(item, nil), do: item

  defp merge_movie_info(item, info),
    do:
      item
      |> put_if_empty("poster", m(info, "poster"))
      |> put_if_empty("tmdbId", m(info, "tmdbId"))
      |> put_if_empty("overview", m(info, "overview"))
      |> put_if_empty("year", m(info, "year"))
      |> put_if_empty("rating", m(info, "rating"))
      |> put_if_empty("genre", m(info, "genre"))
      |> put_if_empty("runtime", m(info, "runtime"))
      |> put_if_empty("director", m(info, "director"))
      |> put_if_empty("language", m(info, "language"))
      |> Map.put("productionCompanies", m(info, "productionCompanies", []))

  defp merge_series_info(show, nil), do: show

  defp merge_series_info(show, info),
    do:
      show
      |> put_if_empty("poster", m(info, "poster"))
      |> put_if_empty("tmdbId", m(info, "tmdbId"))
      |> put_if_empty("overview", m(info, "overview"))
      |> put_if_empty("year", m(info, "year"))
      |> put_if_empty("rating", m(info, "rating"))
      |> put_if_empty("genre", m(info, "genre"))
      |> put_if_empty("language", m(info, "language"))
      |> Map.put("productionCompanies", m(info, "productionCompanies", []))

  defp media_files(directory) do
    case File.ls(directory) do
      {:ok, files} ->
        Enum.filter(files, &(lower(Path.extname(&1)) in @video_exts))

      {:error, error} ->
        IO.warn("Cannot read #{directory}: #{inspect(error)}")
        []
    end
  end

  defp dedup_by_title_year(items) do
    items
    |> Enum.reduce({MapSet.new(), []}, fn item, {seen, out} ->
      key = "#{m(item, "title")}|#{m(item, "year", "") || ""}"
      if MapSet.member?(seen, key), do: {seen, out}, else: {MapSet.put(seen, key), out ++ [item]}
    end)
    |> elem(1)
  end

  defp ordered_cache, do: %{values: %{}, order: []}
  defp ordered_cache_get(%{values: values}, key), do: Map.get(values, key)
  defp ordered_cache_get(_, _), do: nil

  defp ordered_cache_put(cache, key, value, limit) do
    values = Map.put(Map.get(cache, :values, %{}), key, value)
    order = Enum.reject(Map.get(cache, :order, []), &(&1 == key)) ++ [key]

    {values, order} =
      if length(order) > limit do
        [oldest | rest] = order
        {Map.delete(values, oldest), rest}
      else
        {values, order}
      end

    %{values: values, order: order}
  end

  defp query_value(request, key), do: query_value(request, key, nil)

  defp query_value(%Plug.Conn{} = conn, key, default) do
    conn = Plug.Conn.fetch_query_params(conn)
    Map.get(conn.query_params, key, default)
  end

  defp query_value(map, key, default) when is_map(map) do
    query = m(map, "query", m(map, "query_params", %{}))
    m(query, key, default)
  end

  defp query_value(_, _, default), do: default

  defp request_header(%Plug.Conn{} = conn, name),
    do:
      conn
      |> Plug.Conn.get_req_header(String.downcase(name))
      |> List.first()
      |> empty_fallback("")

  defp request_header(map, name) when is_map(map),
    do:
      m(m(map, "headers", %{}), String.downcase(name), m(m(map, "headers", %{}), name, "")) || ""

  defp request_header(_, _), do: ""
  defp request_path(%Plug.Conn{} = conn), do: conn.request_path
  defp request_path(map), do: m(map, "path", "")

  defp original_url(%Plug.Conn{} = conn),
    do: conn.request_path <> if(conn.query_string == "", do: "", else: "?" <> conn.query_string)

  defp original_url(map), do: m(map, "originalUrl", "")

  defp m(map, key), do: m(map, key, nil)

  defp m(map, key, default) when is_map(map) do
    atom = if is_binary(key), do: try_existing_atom(key), else: key
    Map.get(map, key, if(atom, do: Map.get(map, atom, default), else: default))
  end

  defp m(_, _, default), do: default
  defp nested(value, [], _default), do: value

  defp nested(map, [key | rest], default) do
    case m(map, key, :__missing__) do
      :__missing__ -> default
      value -> nested(value, rest, default)
    end
  end

  defp safe_map(map) when is_map(map), do: map
  defp safe_map(_), do: %{}
  defp list(value) when is_list(value), do: value
  defp list(_), do: []
  defp lower(value), do: value |> to_string_or_empty() |> String.downcase()
  defp to_string_or_empty(nil), do: ""
  defp to_string_or_empty(value), do: to_string(value)

  defp num(value) do
    case JS.number(value) do
      number when is_number(number) -> number
      _ -> 0
    end
  end

  defp parse_float_or_zero(value) do
    case JS.parse_float(value) do
      number when is_number(number) -> number
      _ -> 0
    end
  end

  defp parse_int_nan(value) do
    case JS.parse_int(value, 10) do
      number when is_integer(number) -> number
      _ -> :nan
    end
  end

  defp int_or(value, fallback) do
    case JS.parse_int(value, 10) do
      number when is_integer(number) -> number
      _ -> fallback
    end
  end

  defp finite_number_or(value, fallback) do
    case JS.number(value) do
      number when is_number(number) -> number
      _ -> fallback
    end
  end

  defp first_positive_float(values),
    do:
      Enum.find_value(values, 0, fn value ->
        number = parse_float_or_zero(value)
        if number > 0, do: number
      end)

  defp normalize_whole(value) when is_float(value),
    do: if(trunc(value) == value, do: trunc(value), else: value)

  defp normalize_whole(value), do: value
  defp empty_fallback(nil, fallback), do: fallback
  defp empty_fallback("", fallback), do: fallback
  defp empty_fallback(value, _), do: value

  defp put_if_empty(map, key, value),
    do: if(JS.truthy?(m(map, key)), do: map, else: Map.put(map, key, value))

  defp try_existing_atom(key) do
    try do
      String.to_existing_atom(key)
    rescue
      _ -> nil
    end
  end

  defp mtime_number({{year, month, day}, {hour, minute, second}}),
    do:
      :calendar.datetime_to_gregorian_seconds({{year, month, day}, {hour, minute, second}}) * 1000

  defp mtime_number(value) when is_integer(value), do: value
  defp mtime_number(_), do: 0
  defp command_error(%{output: output}), do: output
  defp command_error(error), do: inspect(error)
  defp command_output(%{output: output}) when is_binary(output), do: output
  defp command_output(_), do: <<>>

  defp env_number(name, fallback) do
    case JS.number(System.get_env(name) || fallback) do
      number when is_number(number) -> number
      _ -> 0
    end
  end

  defp nonzero_number(0, fallback), do: fallback
  defp nonzero_number(value, _), do: value

  defp clamp_number(value, low, high, fallback),
    do: max(low, min(high, if(is_number(value) and value != 0, do: value, else: fallback)))

  defp ceil_div(0, _), do: 1
  defp ceil_div(value, divisor), do: div(value + divisor - 1, divisor)

  defp query_encode(values),
    do:
      values
      |> Enum.reject(fn {_key, value} -> is_nil(value) or value == "" end)
      |> Enum.map(fn {key, value} ->
        URI.encode_www_form(to_string(key)) <> "=" <> URI.encode_www_form(to_string(value))
      end)
      |> Enum.join("&")
end

defmodule StreamVault.Fifa do
  @moduledoc false

  @competition "FIFA / Football Live"
  @real_unavailable "Real live football data is unavailable right now"
  @api_football_base "https://v3.football.api-sports.io"
  @espn_base "https://site.api.espn.com/apis/site/v2/sports/soccer"
  @news_max 8
  @detail_unavailable "Detailed match data is unavailable for this fixture right now."
  @detail_provider_limited "Full player lineups and formations require API_FOOTBALL_KEY. ESPN fallback did not provide them for this match."
  @fifa_live_fast_cache_ms (case StreamVault.JS.number(
                                   if(
                                     StreamVault.JS.truthy?(System.get_env("FIFA_LIVE_CACHE_MS")),
                                     do: System.get_env("FIFA_LIVE_CACHE_MS"),
                                     else: 10_000
                                   )
                                 ) do
                              value when is_number(value) -> min(15_000, max(5_000, value))
                              _ -> :nan
                            end)
  @fifa_live_slow_cache_ms (case StreamVault.JS.number(
                                   if(
                                     StreamVault.JS.truthy?(
                                       System.get_env("FIFA_LIVE_SLOW_CACHE_MS")
                                     ),
                                     do: System.get_env("FIFA_LIVE_SLOW_CACHE_MS"),
                                     else: 5 * 60 * 1000
                                   )
                                 ) do
                              value when is_number(value) ->
                                min(15 * 60 * 1000, max(5 * 60 * 1000, value))

                              _ ->
                                :nan
                            end)
  @fifa_live_upstream_timeout_ms (case StreamVault.JS.number(
                                         if(
                                           StreamVault.JS.truthy?(
                                             System.get_env("FIFA_LIVE_TIMEOUT_MS")
                                           ),
                                           do: System.get_env("FIFA_LIVE_TIMEOUT_MS"),
                                           else: 7_000
                                         )
                                       ) do
                                    value when is_number(value) -> min(12_000, max(4_000, value))
                                    _ -> :nan
                                  end)
  @fifa_live_news_cache_ms (case StreamVault.JS.number(
                                   if(
                                     StreamVault.JS.truthy?(
                                       System.get_env("FIFA_LIVE_NEWS_CACHE_MS")
                                     ),
                                     do: System.get_env("FIFA_LIVE_NEWS_CACHE_MS"),
                                     else: 5 * 60 * 1000
                                   )
                                 ) do
                              value when is_number(value) ->
                                min(15 * 60 * 1000, max(5 * 60 * 1000, value))

                              _ ->
                                :nan
                            end)
  @fifa_live_detail_fast_cache_ms (case StreamVault.JS.number(
                                          if(
                                            StreamVault.JS.truthy?(
                                              System.get_env("FIFA_LIVE_DETAIL_FAST_CACHE_MS")
                                            ),
                                            do: System.get_env("FIFA_LIVE_DETAIL_FAST_CACHE_MS"),
                                            else: 25_000
                                          )
                                        ) do
                                     value when is_number(value) ->
                                       min(30_000, max(20_000, value))

                                     _ ->
                                       :nan
                                   end)
  @fifa_live_detail_slow_cache_ms (case StreamVault.JS.number(
                                          if(
                                            StreamVault.JS.truthy?(
                                              System.get_env("FIFA_LIVE_DETAIL_SLOW_CACHE_MS")
                                            ),
                                            do: System.get_env("FIFA_LIVE_DETAIL_SLOW_CACHE_MS"),
                                            else: 10 * 60 * 1000
                                          )
                                        ) do
                                     value when is_number(value) ->
                                       min(15 * 60 * 1000, max(5 * 60 * 1000, value))

                                     _ ->
                                       :nan
                                   end)

  @team_country_codes %{
    "algeria" => "DZ",
    "argentina" => "AR",
    "australia" => "AU",
    "austria" => "AT",
    "belgium" => "BE",
    "bosnia herzegovina" => "BA",
    "bosnia-herzegovina" => "BA",
    "bosniaherzegovina" => "BA",
    "brazil" => "BR",
    "canada" => "CA",
    "colombia" => "CO",
    "congo dr" => "CD",
    "congodr" => "CD",
    "dr congo" => "CD",
    "drcongo" => "CD",
    "democratic republic of congo" => "CD",
    "croatia" => "HR",
    "curacao" => "CW",
    "czechia" => "CZ",
    "denmark" => "DK",
    "ecuador" => "EC",
    "egypt" => "EG",
    "england" => "GB-ENG",
    "france" => "FR",
    "germany" => "DE",
    "ghana" => "GH",
    "haiti" => "HT",
    "iraq" => "IQ",
    "iran" => "IR",
    "italy" => "IT",
    "ivory coast" => "CI",
    "cote d ivoire" => "CI",
    "japan" => "JP",
    "jordan" => "JO",
    "mexico" => "MX",
    "morocco" => "MA",
    "netherlands" => "NL",
    "new zealand" => "NZ",
    "norway" => "NO",
    "panama" => "PA",
    "paraguay" => "PY",
    "portugal" => "PT",
    "qatar" => "QA",
    "saudi arabia" => "SA",
    "scotland" => "GB-SCT",
    "senegal" => "SN",
    "south africa" => "ZA",
    "southafrica" => "ZA",
    "south korea" => "KR",
    "southkorea" => "KR",
    "spain" => "ES",
    "sweden" => "SE",
    "switzerland" => "CH",
    "tunisia" => "TN",
    "turkiye" => "TR",
    "turkey" => "TR",
    "tÃƒÆ’Ã‚Â¼rkiye" => "TR",
    "united states" => "US",
    "unitedstates" => "US",
    "usa" => "US",
    "uruguay" => "UY",
    "cape verde" => "CV",
    "wales" => "GB-WLS",
    "uzbekistan" => "UZ"
  }

  @subdivision_flags %{
    "GB-ENG" =>
      <<0x1F3F4::utf8, 0xE0067::utf8, 0xE0062::utf8, 0xE0065::utf8, 0xE006E::utf8, 0xE0067::utf8,
        0xE007F::utf8>>,
    "GB-SCT" =>
      <<0x1F3F4::utf8, 0xE0067::utf8, 0xE0062::utf8, 0xE0073::utf8, 0xE0063::utf8, 0xE0074::utf8,
        0xE007F::utf8>>,
    "GB-WLS" =>
      <<0x1F3F4::utf8, 0xE0067::utf8, 0xE0062::utf8, 0xE0077::utf8, 0xE006C::utf8, 0xE0073::utf8,
        0xE007F::utf8>>
  }

  # JavaScript source: svFifaFirst(...values)
  def sv_fifa_first(values) when is_list(values) do
    Enum.find_value(values, "", fn value ->
      if is_nil(value) do
        false
      else
        text = value |> to_js_string() |> String.trim()
        lower = String.downcase(text)
        if text == "" or lower in ["undefined", "null"], do: false, else: {:value, value}
      end
    end)
    |> case do
      {:value, value} -> value
      value -> value
    end
  end

  # JavaScript source: svFifaArray(value)
  def sv_fifa_array(value), do: if(is_list(value), do: value, else: [])

  # JavaScript source: svFifaNormalizeStatusName(value, elapsed = null)
  def sv_fifa_normalize_status_name(value, elapsed \\ nil) do
    raw =
      value
      |> js_or("")
      |> to_js_string()
      |> String.trim()
      |> String.upcase()
      |> String.replace(~r/[\s.-]+/u, "_")

    compact = String.replace(raw, "_", "")

    cond do
      raw == "" and StreamVault.JS.truthy?(elapsed) ->
        "LIVE"

      raw in [
        "HT",
        "BT",
        "HALFTIME",
        "HALFTIMEBREAK",
        "HALF_TIME",
        "HALF_TIME_BREAK",
        "BREAK_TIME"
      ] or compact == "HALFTIME" ->
        "HALFTIME"

      raw in ["1H", "FIRST_HALF", "FIRSTHALF", "STATUS_FIRST_HALF"] or compact == "FIRSTHALF" ->
        "FIRST_HALF"

      raw in ["2H", "SECOND_HALF", "SECONDHALF", "STATUS_SECOND_HALF"] or compact == "SECONDHALF" ->
        "SECOND_HALF"

      raw in ["ET", "EXTRA_TIME", "EXTRATIME", "P"] or compact == "EXTRATIME" ->
        "EXTRA_TIME"

      raw in [
        "LIVE",
        "IN",
        "IN_PROGRESS",
        "INPROGRESS",
        "STATUS_IN_PROGRESS",
        "ONGOING",
        "PLAYING",
        "INT"
      ] or compact == "INPROGRESS" ->
        "LIVE"

      raw in [
        "FT",
        "FINAL",
        "STATUS_FINAL",
        "FULL_TIME",
        "FULLTIME",
        "FINISHED",
        "COMPLETE",
        "COMPLETED",
        "AET",
        "PEN",
        "PENALTY_SHOOTOUT",
        "PENALTYSHOOTOUT"
      ] or compact == "FULLTIME" ->
        "FULL_TIME"

      raw in ["NS", "TBD", "UPCOMING", "SCHEDULED", "PRE", "PRE_GAME", "PREGAME", "NOT_STARTED"] or
          compact == "NOTSTARTED" ->
        "UPCOMING"

      raw in [
        "POSTPONED",
        "PPD",
        "PST",
        "CANCELED",
        "CANCELLED",
        "CANC",
        "SUSP",
        "SUSPENDED",
        "ABD",
        "ABANDONED"
      ] ->
        "POSTPONED"

      raw != "" ->
        raw

      true ->
        "UPCOMING"
    end
  end

  # JavaScript source: svFifaStatusIsRunning(status)
  def sv_fifa_status_is_running(status),
    do:
      sv_fifa_normalize_status_name(status) in ["LIVE", "FIRST_HALF", "SECOND_HALF", "EXTRA_TIME"]

  # JavaScript source: svFifaStatusIsActive(status)
  def sv_fifa_status_is_active(status) do
    code = sv_fifa_normalize_status_name(status)
    sv_fifa_status_is_running(code) or code == "HALFTIME"
  end

  # JavaScript source: svFifaStatusIsFinished(status)
  def sv_fifa_status_is_finished(status) do
    sv_fifa_normalize_status_name(status) in ["FULL_TIME", "FINISHED"]
  end

  # JavaScript source: svFifaPayloadHasActiveMatch(payload)
  def sv_fifa_payload_has_active_match(payload) do
    [g(payload, "liveMatches"), g(payload, "upcomingMatches"), g(payload, "recentResults")]
    |> Enum.any?(fn list ->
      Enum.any?(sv_fifa_array(list), &sv_fifa_status_is_active(g(&1, "status")))
    end)
  end

  # JavaScript source: svFifaNumber(value, fallback = null)
  def sv_fifa_number(value, fallback \\ nil)
  def sv_fifa_number(value, fallback) when value in [nil, ""], do: fallback

  def sv_fifa_number(value, fallback) do
    case StreamVault.JS.number(value) do
      :nan -> fallback
      n when is_number(n) -> n
      _ -> fallback
    end
  end

  # JavaScript source: svFifaIsoDate(date = new Date())
  def sv_fifa_iso_date(date \\ :now) do
    case to_datetime(date) do
      {:ok, datetime} -> datetime |> DateTime.truncate(:millisecond) |> DateTime.to_iso8601()
      :error -> ""
    end
  end

  # JavaScript source: svFifaApiDate(date = new Date())
  def sv_fifa_api_date(date \\ :now), do: date |> sv_fifa_iso_date() |> String.slice(0, 10)

  # JavaScript source: svFifaEspnDate(date = new Date())
  def sv_fifa_espn_date(date \\ :now), do: date |> sv_fifa_api_date() |> String.replace("-", "")

  # JavaScript source: svFifaTitleCase(value)
  def sv_fifa_title_case(value) do
    value
    |> js_or("")
    |> to_js_string()
    |> String.replace(~r/[-_]+/u, " ")
    |> String.replace(~r/\b\w/u, fn ch -> String.upcase(ch) end)
    |> String.trim()
  end

  # JavaScript source: svFifaWarn(message, err)
  def sv_fifa_warn(message, err) do
    now = now_ms()

    should_warn =
      StreamVault.State.transaction(fn state ->
        last = Map.get(state, :fifa_live_last_warn_at, 0)

        if now - last < 60_000,
          do: {false, state},
          else: {true, Map.put(state, :fifa_live_last_warn_at, now)}
      end)

    if should_warn do
      suffix =
        case error_message(err) do
          "" -> ""
          message -> ": " <> message
        end

      IO.puts(:stderr, "[FIFA Live] #{message}#{suffix}")
    end

    :ok
  end

  # JavaScript source: svFifaEmptyPayload(message = FIFA_LIVE_REAL_UNAVAILABLE, stale = false, source = 'none')
  def sv_fifa_empty_payload(message \\ @real_unavailable, stale \\ false, source \\ "none") do
    payload = %{
      "ok" => false,
      "generatedAt" => now_iso(),
      "source" => source,
      "stale" => !!stale,
      "competition" => @competition,
      "message" => message,
      "liveMatches" => [],
      "upcomingMatches" => [],
      "recentResults" => [],
      "standings" => [],
      "headlines" => [],
      "apiFootballConfigured" => sv_fifa_api_football_key() != "",
      "fakeDataUsed" => false,
      "dataIntegrity" => %{
        "fakeDataUsed" => false,
        "cardsAreProviderOnly" => true,
        "statsAreProviderOnly" => true
      },
      "providerLimitations" => []
    }

    payload
    |> Map.put("capabilities", sv_fifa_build_summary_capabilities(payload, source))
    |> Map.put("provider", sv_fifa_provider_meta(source))
  end

  # JavaScript source: svFifaHasRealData(payload)
  def sv_fifa_has_real_data(payload) do
    not is_nil(payload) and
      (Enum.any?(["liveMatches", "upcomingMatches", "recentResults", "headlines"], fn key ->
         list = g(payload, key)
         is_list(list) and list != []
       end) or sv_fifa_filter_standings(g(payload, "standings")) != [])
  end

  # JavaScript source: svFifaFinalizePayload(payload, source, message = '')
  def sv_fifa_finalize_payload(payload, source, message \\ "") do
    standings = sv_fifa_filter_standings(g(payload, "standings"))

    next = %{
      "ok" => sv_fifa_has_real_data(payload),
      "generatedAt" => now_iso(),
      "source" => source,
      "stale" => false,
      "competition" => @competition,
      "message" => message,
      "liveMatches" => Enum.take(sv_fifa_array(g(payload, "liveMatches")), 12),
      "upcomingMatches" => Enum.take(sv_fifa_array(g(payload, "upcomingMatches")), 14),
      "recentResults" => Enum.take(sv_fifa_array(g(payload, "recentResults")), 10),
      "standings" => Enum.take(standings, 32),
      "headlines" => Enum.take(sv_fifa_array(g(payload, "headlines")), 8),
      "apiFootballConfigured" => sv_fifa_api_football_key() != "",
      "fakeDataUsed" => false,
      "dataIntegrity" => %{
        "fakeDataUsed" => false,
        "cardsAreProviderOnly" => true,
        "statsAreProviderOnly" => true
      },
      "providerLimitations" => []
    }

    next =
      if not next["ok"] and next["message"] == "",
        do: Map.put(next, "message", @real_unavailable),
        else: next

    next
    |> Map.put("capabilities", sv_fifa_build_summary_capabilities(next, source))
    |> Map.put("provider", sv_fifa_provider_meta(source))
  end

  # JavaScript source: svFifaMarkStale(payload, source)
  def sv_fifa_mark_stale(payload, source) do
    payload
    |> map_or_empty()
    |> Map.merge(%{
      "ok" => true,
      "generatedAt" => now_iso(),
      "source" => js_or(source, "cache"),
      "stale" => true,
      "message" => "Showing last real football update while the live provider reconnects"
    })
  end

  # JavaScript source: svFifaCachePayload(payload)
  def sv_fifa_cache_payload(payload) do
    if is_nil(payload) or (not truthy(g(payload, "ok")) and g(payload, "source") == "none") do
      StreamVault.State.put(:fifa_live_cache, nil)
      payload
    else
      active = sv_fifa_payload_has_active_match(payload)

      ttl =
        if active do
          if truthy(g(payload, "stale")),
            do: js_min(5_000, fast_cache_ms()),
            else: fast_cache_ms()
        else
          slow_cache_ms()
        end

      StreamVault.State.put(:fifa_live_cache, %{
        "expiresAt" => add_ms(now_ms(), ttl),
        "payload" => payload
      })

      if truthy(g(payload, "ok")) and not truthy(g(payload, "stale")) and
           g(payload, "source") != "none" do
        StreamVault.State.put(:fifa_live_last_good, payload)
      end

      payload
    end
  end

  # JavaScript source: svFifaRefreshLiveCache()
  def sv_fifa_refresh_live_cache do
    before = StreamVault.State.get(:fifa_live_cache)

    :global.trans({__MODULE__, :live_refresh}, fn ->
      current = StreamVault.State.get(:fifa_live_cache)

      if current != before and not is_nil(current) do
        g(current, "payload")
      else
        try do
          sv_fifa_fetch_real_payload() |> sv_fifa_cache_payload()
        rescue
          error ->
            sv_fifa_warn("endpoint fallback", error)

            case StreamVault.State.get(:fifa_live_last_good) do
              nil ->
                sv_fifa_empty_payload(@real_unavailable, false, "none") |> sv_fifa_cache_payload()

              payload ->
                payload |> sv_fifa_mark_stale("cache") |> sv_fifa_cache_payload()
            end
        catch
          kind, reason ->
            sv_fifa_warn("endpoint fallback", {kind, reason})

            case StreamVault.State.get(:fifa_live_last_good) do
              nil ->
                sv_fifa_empty_payload(@real_unavailable, false, "none") |> sv_fifa_cache_payload()

              payload ->
                payload |> sv_fifa_mark_stale("cache") |> sv_fifa_cache_payload()
            end
        end
      end
    end)
  end

  # JavaScript source: svFifaFetchJson(rawUrl, options = {}, redirects = 0)
  def sv_fifa_fetch_json(raw_url, options \\ %{}, redirects \\ 0) do
    uri = URI.parse(to_js_string(raw_url))

    if uri.scheme not in ["http", "https"] or is_nil(uri.host),
      do: raise("Unsupported football provider URL")

    headers =
      [{"Accept", "application/json"}, {"User-Agent", "StreamVault-Football-Live/2.0"}] ++
        normalize_headers(g(options, "headers", g(options, :headers, [])))

    timeout =
      js_or(g(options, "timeout", g(options, :timeout)), upstream_timeout_ms())
      |> timeout_integer(upstream_timeout_ms())

    max_bytes =
      js_or(g(options, "maxBytes", g(options, :maxBytes)), 3 * 1024 * 1024)
      |> integer_or(3 * 1024 * 1024)

    case StreamVault.HTTP.request(:get, URI.to_string(uri), headers, nil,
           timeout: timeout,
           receive_timeout: timeout
         ) do
      {:ok, response} ->
        location = response_header(response.headers, "location")

        cond do
          response.status in [301, 302, 307, 308] and location != "" and redirects < 3 ->
            redirected = URI.merge(uri, location) |> URI.to_string()
            sv_fifa_fetch_json(redirected, options, redirects + 1)

          byte_size(response.body) > max_bytes ->
            raise "Football provider response too large"

          response.status < 200 or response.status >= 300 ->
            raise "Football provider returned #{response.status}"

          true ->
            case Jason.decode(response.body) do
              {:ok, decoded} -> decoded
              {:error, error} -> raise error
            end
        end

      {:error, %Mint.TransportError{reason: :timeout}} ->
        raise "Football provider timeout"

      {:error, reason} ->
        raise "#{inspect(reason)}"
    end
  end

  # JavaScript source: svFifaHttpUrl(value)
  def sv_fifa_http_url(value) do
    text = value |> js_or("") |> to_js_string() |> String.trim()
    if Regex.match?(~r/^https?:\/\//i, text), do: text, else: ""
  end

  # JavaScript source: svFifaNewsDate(value)
  def sv_fifa_news_date(value) do
    text = value |> js_or("") |> to_js_string() |> String.trim()

    if text == "" do
      ""
    else
      case to_datetime(text) do
        {:ok, datetime} -> sv_fifa_iso_date(datetime)
        :error -> text
      end
    end
  end

  # JavaScript source: svFifaNewsSourceLabel(source)
  def sv_fifa_news_source_label(source) do
    clean = source |> js_or("") |> to_js_string() |> String.trim() |> String.downcase()

    cond do
      clean == "fifa" -> "FIFA"
      clean == "fox" -> "FOX Sports"
      clean == "espn" -> "ESPN"
      truthy(source) -> to_js_string(source)
      true -> ""
    end
  end

  # JavaScript source: svFifaNormalizeNewsItems(items, fallbackSource = '')
  def sv_fifa_normalize_news_items(items, fallback_source \\ "") do
    {_seen, normalized} =
      sv_fifa_array(items)
      |> Enum.with_index()
      |> Enum.reduce({MapSet.new(), []}, fn {item, index}, {seen, acc} ->
        title =
          sv_fifa_first([
            g(item, "title"),
            g(item, "headline"),
            g(item, "shortLinkText"),
            g(item, "name"),
            ""
          ])
          |> to_js_string()
          |> String.trim()

        url =
          sv_fifa_http_url(
            sv_fifa_first([
              g(item, "url"),
              g(item, "link"),
              g(item, ["links", "web", "href"]),
              g(item, ["links", "api", "self", "href"]),
              ""
            ])
          )

        source = if is_binary(g(item, "source")), do: g(item, "source"), else: ""
        key = "#{String.downcase(title)}|#{url}"

        if title == "" or MapSet.member?(seen, key) do
          {seen, acc}
        else
          normalized_item = %{
            "title" => title,
            "url" => url,
            "publishedAt" =>
              sv_fifa_news_date(
                sv_fifa_first([
                  g(item, "publishedAt"),
                  g(item, "published"),
                  g(item, "lastModified"),
                  g(item, "time"),
                  g(item, "date"),
                  ""
                ])
              ),
            "source" =>
              sv_fifa_first([
                g(item, ["source", "name"]),
                g(item, ["source", "displayName"]),
                g(item, "sourceName"),
                source,
                sv_fifa_news_source_label(fallback_source),
                ""
              ])
              |> to_js_string(),
            "id" =>
              sv_fifa_first([g(item, "id"), g(item, "nowId"), url, "news-#{index}"])
              |> to_js_string()
          }

          {MapSet.put(seen, key), acc ++ [normalized_item]}
        end
      end)

    Enum.take(normalized, @news_max)
  end

  # JavaScript source: svFifaNewsPayload(headlines, source = 'none', stale = false, message = '')
  def sv_fifa_news_payload(headlines, source \\ "none", stale \\ false, message \\ "") do
    normalized = sv_fifa_normalize_news_items(headlines, source)

    %{
      "ok" => normalized != [],
      "generatedAt" => now_iso(),
      "source" => if(normalized == [], do: "none", else: source),
      "stale" => !!stale,
      "message" => js_or(message, ""),
      "headlines" => Enum.map(normalized, &Map.delete(&1, "id")),
      "apiFootballConfigured" => sv_fifa_api_football_key() != "",
      "fakeDataUsed" => false,
      "dataIntegrity" => %{
        "fakeDataUsed" => false,
        "cardsAreProviderOnly" => true,
        "statsAreProviderOnly" => true
      }
    }
  end

  # JavaScript source: svFifaMarkNewsStale(payload)
  def sv_fifa_mark_news_stale(payload) do
    payload
    |> map_or_empty()
    |> Map.merge(%{
      "ok" => true,
      "generatedAt" => now_iso(),
      "source" => "cache",
      "stale" => true,
      "message" => "Showing last real football news while the news source reconnects"
    })
  end

  # JavaScript source: svFifaCacheNewsPayload(payload)
  def sv_fifa_cache_news_payload(nil), do: nil

  def sv_fifa_cache_news_payload(payload) do
    StreamVault.State.put(:fifa_live_news_cache, %{
      "expiresAt" => add_ms(now_ms(), news_cache_ms()),
      "payload" => payload
    })

    if truthy(g(payload, "ok")) and not truthy(g(payload, "stale")) and
         g(payload, "source") != "none",
       do: StreamVault.State.put(:fifa_live_news_last_good, payload)

    payload
  end

  # JavaScript source: svFifaDedupeMatches(items)
  def sv_fifa_dedupe_matches(items) do
    {_seen, result} =
      Enum.reduce(sv_fifa_array(items), {MapSet.new(), []}, fn match, {seen, acc} ->
        fallback =
          "#{js_or(g(match, "homeTeam"), "")}|#{js_or(g(match, "awayTeam"), "")}|#{js_or(g(match, "startTime"), "")}|#{js_or(g(match, "status"), "")}"

        key = js_or(g(match, "id"), fallback) |> to_js_string()

        if String.trim(key) == "" or MapSet.member?(seen, key) do
          {seen, acc}
        else
          {MapSet.put(seen, key), acc ++ [match]}
        end
      end)

    result
  end

  # JavaScript source: svFifaApiFootballKey()
  def sv_fifa_api_football_key do
    [
      System.get_env("API_FOOTBALL_KEY"),
      System.get_env("FOOTBALL_API_KEY"),
      System.get_env("RAPIDAPI_KEY"),
      ""
    ]
    |> Enum.find("", &truthy/1)
    |> to_js_string()
    |> String.trim()
  end

  # JavaScript source: svFifaApiFootballHeaders(apiKey)
  def sv_fifa_api_football_headers(api_key) do
    [
      {"x-apisports-key", api_key},
      {"x-rapidapi-key", api_key},
      {"x-rapidapi-host", "v3.football.api-sports.io"}
    ]
  end

  # JavaScript source: svFifaTeamKey(value)
  def sv_fifa_team_key(value) do
    value
    |> js_or("")
    |> to_js_string()
    |> :unicode.characters_to_nfd_binary()
    |> String.replace(~r/[\x{0300}-\x{036f}]/u, "")
    |> String.downcase()
    |> String.replace("&", " and ")
    |> String.replace(~r/[^a-z0-9]+/u, " ")
    |> String.trim()
  end

  # JavaScript source: svFifaCountryCodeFromName(name)
  def sv_fifa_country_code_from_name(name) do
    key = sv_fifa_team_key(name)

    Map.get(@team_country_codes, key) ||
      Map.get(@team_country_codes, String.replace(key, ~r/\s+/u, "")) || ""
  end

  # JavaScript source: svFifaFlagEmojiFromCode(code)
  def sv_fifa_flag_emoji_from_code(code) do
    clean = code |> js_or("") |> to_js_string() |> String.trim() |> String.upcase()

    cond do
      clean == "" ->
        ""

      Map.has_key?(@subdivision_flags, clean) ->
        Map.fetch!(@subdivision_flags, clean)

      not Regex.match?(~r/^[A-Z]{2}$/, clean) ->
        ""

      true ->
        clean
        |> String.to_charlist()
        |> Enum.map_join(fn character -> <<0x1F1E6 + character - ?A::utf8>> end)
    end
  end

  # JavaScript source: svFifaProviderLogo(team)
  def sv_fifa_provider_logo(team) do
    logo =
      sv_fifa_first([
        g(team, "logo"),
        g(team, "flag"),
        g(team, "crest"),
        g(team, ["team", "logo"]),
        g(team, ["team", "flag"]),
        g(team, ["team", "logos", 0, "href"]),
        g(team, ["logos", 0, "href"]),
        g(team, ["logos", 0, "url"])
      ])

    text = logo |> js_or("") |> to_js_string()
    if Regex.match?(~r/^https?:\/\//i, text), do: text, else: ""
  end

  # JavaScript source: svFifaProviderCode(team)
  def sv_fifa_provider_code(team) do
    sv_fifa_first([
      g(team, "countryCode"),
      g(team, "code"),
      g(team, "abbreviation"),
      g(team, ["team", "countryCode"]),
      g(team, ["team", "abbreviation"])
    ])
    |> js_or("")
    |> to_js_string()
    |> String.trim()
  end

  # JavaScript source: svFifaTeamMeta(name, providerTeam = {})
  def sv_fifa_team_meta(name, provider_team \\ %{}) do
    code = sv_fifa_provider_code(provider_team)
    mapped_code = sv_fifa_country_code_from_name(name)

    country_code =
      if Regex.match?(~r/^[A-Z]{2}$/i, code), do: String.upcase(code), else: mapped_code

    %{
      "logo" => sv_fifa_provider_logo(provider_team),
      "flag" => sv_fifa_flag_emoji_from_code(country_code),
      "countryCode" => js_or(country_code, "")
    }
  end

  # JavaScript source: svFifaEnrichMatchTeams(match, homeProvider = {}, awayProvider = {})
  def sv_fifa_enrich_match_teams(match, home_provider \\ %{}, away_provider \\ %{}) do
    match = map_or_empty(match)
    home = sv_fifa_team_meta(g(match, "homeTeam"), home_provider)
    away = sv_fifa_team_meta(g(match, "awayTeam"), away_provider)

    Map.merge(match, %{
      "homeLogo" => js_or(g(match, "homeLogo"), home["logo"]),
      "homeFlag" => js_or(g(match, "homeFlag"), home["flag"]),
      "homeCountryCode" => js_or(g(match, "homeCountryCode"), home["countryCode"]),
      "awayLogo" => js_or(g(match, "awayLogo"), away["logo"]),
      "awayFlag" => js_or(g(match, "awayFlag"), away["flag"]),
      "awayCountryCode" => js_or(g(match, "awayCountryCode"), away["countryCode"])
    })
  end

  # JavaScript source: svFifaProviderMeta(source)
  def sv_fifa_provider_meta(source) do
    active = js_or(sv_fifa_clean_provider(source), js_or(source, "none") |> to_js_string())
    configured = sv_fifa_api_football_key() != ""

    %{
      "active" => active,
      "apiFootballConfigured" => configured,
      "limited" => active == "espn" and not configured,
      "fallback" => active == "espn" and not configured
    }
  end

  # JavaScript source: svFifaMatchHasRealScore(match)
  def sv_fifa_match_has_real_score(match) do
    if not truthy(g(match, "homeTeam")) or not truthy(g(match, "awayTeam")) do
      false
    else
      status = g(match, "status") |> js_or("") |> to_js_string() |> String.upcase()
      home = g(match, "homeScore")
      away = g(match, "awayScore")
      has_score = home == 0 or truthy(home) or away == 0 or truthy(away)
      has_score or status in ["UPCOMING", "POSTPONED"]
    end
  end

  # JavaScript source: svFifaValidStatRow(row)
  def sv_fifa_valid_stat_row(row),
    do:
      truthy(sv_fifa_clean_detail_value(g(row, "label"))) and
        (truthy(sv_fifa_clean_detail_value(g(row, "home"))) or
           truthy(sv_fifa_clean_detail_value(g(row, "away"))))

  # JavaScript source: svFifaFilterStats(rows)
  def sv_fifa_filter_stats(rows), do: Enum.filter(sv_fifa_array(rows), &sv_fifa_valid_stat_row/1)

  # JavaScript source: svFifaValidPlayer(player)
  def sv_fifa_valid_player(player), do: truthy(sv_fifa_clean_detail_value(g(player, "name")))

  # JavaScript source: svFifaCleanPlayers(players)
  def sv_fifa_clean_players(players),
    do: Enum.filter(sv_fifa_array(players), &sv_fifa_valid_player/1)

  # JavaScript source: svFifaLineupHasPlayers(lineup)
  def sv_fifa_lineup_has_players(lineup),
    do:
      sv_fifa_clean_players(g(lineup, "players")) != [] or
        sv_fifa_clean_players(g(lineup, "substitutes")) != []

  # JavaScript source: svFifaLineupsHavePlayers(lineups)
  def sv_fifa_lineups_have_players(lineups),
    do:
      sv_fifa_lineup_has_players(g(lineups, "home")) or
        sv_fifa_lineup_has_players(g(lineups, "away"))

  # JavaScript source: svFifaLineupsHaveFormations(lineups)
  def sv_fifa_lineups_have_formations(lineups),
    do:
      truthy(sv_fifa_clean_detail_value(g(lineups, ["home", "formation"]))) or
        truthy(sv_fifa_clean_detail_value(g(lineups, ["away", "formation"])))

  # JavaScript source: svFifaPayloadHasTeamFlags(payload)
  def sv_fifa_payload_has_team_flags(payload) do
    (sv_fifa_array(g(payload, "liveMatches")) ++
       sv_fifa_array(g(payload, "upcomingMatches")) ++ sv_fifa_array(g(payload, "recentResults")))
    |> Enum.any?(fn match ->
      Enum.any?(["homeFlag", "homeLogo", "awayFlag", "awayLogo"], &truthy(g(match, &1)))
    end)
  end

  # JavaScript source: svFifaValidEvent(event)
  def sv_fifa_valid_event(event),
    do:
      Enum.any?(
        ["type", "player", "team", "detail"],
        &truthy(sv_fifa_clean_detail_value(g(event, &1)))
      )

  # JavaScript source: svFifaFilterEvents(events)
  def sv_fifa_filter_events(events),
    do: Enum.filter(sv_fifa_array(events), &sv_fifa_valid_event/1)

  # JavaScript source: svFifaStandingHasTableData(row)
  def sv_fifa_standing_has_table_data(row),
    do:
      Enum.any?(
        ["played", "wins", "draws", "losses", "goalDifference", "points"],
        &(sv_fifa_clean_detail_value(g(row, &1)) != "")
      )

  # JavaScript source: svFifaFilterStandings(rows)
  def sv_fifa_filter_standings(rows),
    do:
      Enum.filter(
        sv_fifa_array(rows),
        &(truthy(sv_fifa_clean_detail_value(g(&1, "team"))) and
            sv_fifa_standing_has_table_data(&1))
      )

  # JavaScript source: svFifaBuildSummaryCapabilities(payload, source = '')
  def sv_fifa_build_summary_capabilities(payload, source \\ "") do
    matches =
      sv_fifa_array(g(payload, "liveMatches")) ++
        sv_fifa_array(g(payload, "upcomingMatches")) ++ sv_fifa_array(g(payload, "recentResults"))

    standings = sv_fifa_filter_standings(g(payload, "standings"))

    %{
      "provider" =>
        js_or(
          sv_fifa_clean_provider(source),
          js_or(source, js_or(g(payload, "source"), "none")) |> to_js_string()
        ),
      "apiFootballConfigured" => sv_fifa_api_football_key() != "",
      "liveScores" => Enum.any?(matches, &sv_fifa_match_has_real_score/1),
      "matchStats" => false,
      "lineups" => false,
      "formations" => false,
      "events" => false,
      "standings" => standings != [],
      "headlines" => sv_fifa_array(g(payload, "headlines")) != [],
      "teamFlags" => sv_fifa_payload_has_team_flags(payload)
    }
  end

  # JavaScript source: svFifaBuildDetailCapabilities(detail)
  def sv_fifa_build_detail_capabilities(detail) do
    lineups = map_or_empty(g(detail, "lineups"))

    %{
      "provider" =>
        js_or(
          sv_fifa_clean_provider(g(detail, "source")),
          js_or(g(detail, "source"), "none") |> to_js_string()
        ),
      "apiFootballConfigured" => sv_fifa_api_football_key() != "",
      "liveScores" => sv_fifa_match_has_real_score(g(detail, "match")),
      "matchStats" => sv_fifa_filter_stats(g(detail, "statistics")) != [],
      "lineups" => sv_fifa_lineups_have_players(lineups),
      "formations" => sv_fifa_lineups_have_formations(lineups),
      "events" => sv_fifa_filter_events(g(detail, "events")) != [],
      "standings" => sv_fifa_filter_standings(g(detail, "standings")) != [],
      "teamFlags" =>
        Enum.any?(
          ["homeFlag", "homeLogo", "awayFlag", "awayLogo"],
          &truthy(g(detail, ["match", &1]))
        )
    }
  end

  # JavaScript source: svFifaNormalizeApiFootballFixture(item)
  def sv_fifa_normalize_api_football_fixture(item) do
    fixture = map_or_empty(g(item, "fixture"))
    league = map_or_empty(g(item, "league"))
    teams = map_or_empty(g(item, "teams"))
    goals = map_or_empty(g(item, "goals"))
    status_info = map_or_empty(g(fixture, "status"))

    short =
      sv_fifa_first([g(status_info, "short"), g(status_info, "long"), ""])
      |> to_js_string()
      |> String.upcase()

    status = sv_fifa_normalize_status_name(short, g(status_info, "elapsed"))
    upcoming = status == "UPCOMING"
    running = sv_fifa_status_is_running(status)
    start_time = sv_fifa_iso_date(parse_date_or_now(g(fixture, "date")))
    home_name = js_or(g(teams, ["home", "name"]), "") |> to_js_string()
    away_name = js_or(g(teams, ["away", "name"]), "") |> to_js_string()
    id_fallback = "#{js_or(home_name, "home")}-#{js_or(away_name, "away")}-#{start_time}"

    match = %{
      "id" => sv_fifa_first([g(fixture, "id"), id_fallback]) |> to_js_string(),
      "status" => status,
      "minute" =>
        cond do
          running and truthy(g(status_info, "elapsed")) -> "#{g(status_info, "elapsed")}'"
          status == "HALFTIME" -> "HT"
          true -> nil
        end,
      "homeTeam" => home_name,
      "awayTeam" => away_name,
      "homeScore" => if(upcoming, do: nil, else: sv_fifa_number(g(goals, "home"))),
      "awayScore" => if(upcoming, do: nil, else: sv_fifa_number(g(goals, "away"))),
      "competition" => js_or(g(league, "name"), "") |> to_js_string(),
      "stage" => js_or(g(league, "round"), "") |> to_js_string(),
      "group" => "",
      "venue" => js_or(g(fixture, ["venue", "name"]), "") |> to_js_string(),
      "startTime" => start_time,
      "kickoff" => start_time,
      "provider" => "api-football",
      "leagueId" => sv_fifa_number(g(league, "id")),
      "season" => sv_fifa_number(g(league, "season")),
      "providerUrl" => ""
    }

    sv_fifa_enrich_match_teams(match, g(teams, "home", %{}), g(teams, "away", %{}))
  end

  # JavaScript source: svFifaNormalizeApiFootballStandings(raw)
  def sv_fifa_normalize_api_football_standings(raw) do
    sv_fifa_array(g(raw, "response"))
    |> Enum.flat_map(fn entry -> sv_fifa_array(g(entry, ["league", "standings"])) end)
    |> Enum.flat_map(&sv_fifa_array/1)
    |> Enum.map(fn row ->
      meta = sv_fifa_team_meta(g(row, ["team", "name"]), g(row, "team", %{}))

      %{
        "group" => js_or(g(row, "group"), "") |> to_js_string(),
        "rank" => sv_fifa_number(g(row, "rank")),
        "team" => js_or(g(row, ["team", "name"]), "") |> to_js_string(),
        "logo" => sv_fifa_provider_logo(g(row, "team")),
        "flag" => meta["flag"],
        "countryCode" => meta["countryCode"],
        "played" => sv_fifa_number(g(row, ["all", "played"]), 0),
        "wins" => sv_fifa_number(g(row, ["all", "win"]), 0),
        "draws" => sv_fifa_number(g(row, ["all", "draw"]), 0),
        "losses" => sv_fifa_number(g(row, ["all", "lose"]), 0),
        "goalDifference" => sv_fifa_number(g(row, "goalsDiff"), 0),
        "points" => sv_fifa_number(g(row, "points"), 0)
      }
    end)
    |> Enum.filter(&truthy(g(&1, "team")))
  end

  # JavaScript source: svFifaFetchApiFootball()
  def sv_fifa_fetch_api_football do
    api_key = sv_fifa_api_football_key()

    if api_key == "" do
      nil
    else
      season =
        js_or(System.get_env("FIFA_LIVE_SEASON"), Integer.to_string(Date.utc_today().year))
        |> to_js_string()

      headers = sv_fifa_api_football_headers(api_key)

      urls = [
        "#{@api_football_base}/fixtures?live=all",
        "#{@api_football_base}/fixtures?next=12",
        "#{@api_football_base}/fixtures?last=8",
        "#{@api_football_base}/standings?league=1&season=#{URI.encode_www_form(season)}"
      ]

      [live_res, upcoming_res, recent_res, standings_res] =
        all_settled(
          Enum.map(urls, fn url -> fn -> sv_fifa_fetch_json(url, %{"headers" => headers}) end end)
        )

      rejected = Enum.find([live_res, upcoming_res, recent_res], &match?({:rejected, _}, &1))
      if rejected, do: raise(elem(rejected, 1))
      {:fulfilled, live_raw} = live_res
      {:fulfilled, upcoming_raw} = upcoming_res
      {:fulfilled, recent_raw} = recent_res

      live_matches =
        normalize_fixture_list(live_raw, fn match ->
          truthy(g(match, "homeTeam")) and truthy(g(match, "awayTeam"))
        end)

      upcoming_matches =
        normalize_fixture_list(upcoming_raw, fn match ->
          truthy(g(match, "homeTeam")) and truthy(g(match, "awayTeam")) and
            g(match, "status") == "UPCOMING"
        end)

      recent_results =
        normalize_fixture_list(recent_raw, fn match ->
          truthy(g(match, "homeTeam")) and truthy(g(match, "awayTeam")) and
            sv_fifa_status_is_finished(g(match, "status"))
        end)

      standings =
        case standings_res do
          {:fulfilled, value} -> sv_fifa_normalize_api_football_standings(value)
          _ -> []
        end

      sv_fifa_finalize_payload(
        %{
          "liveMatches" => sv_fifa_dedupe_matches(live_matches),
          "upcomingMatches" => sv_fifa_dedupe_matches(upcoming_matches),
          "recentResults" => sv_fifa_dedupe_matches(recent_results),
          "standings" => standings,
          "headlines" => []
        },
        "api-football"
      )
    end
  end

  # JavaScript source: svFifaEspnEventStatus(event, competition)
  def sv_fifa_espn_event_status(event, competition) do
    type =
      map_or_empty(js_or(g(competition, ["status", "type"]), g(event, ["status", "type"], %{})))

    state = g(type, "state") |> js_or("") |> to_js_string() |> String.downcase()

    detail =
      sv_fifa_first([
        g(type, "shortDetail"),
        g(type, "detail"),
        g(type, "description"),
        g(type, "name")
      ])
      |> to_js_string()
      |> String.upcase()

    cond do
      state == "in" and Regex.match?(~r/\b(?:HT|HALF\s*TIME|HALFTIME)\b/, detail) -> "HALFTIME"
      state == "in" and Regex.match?(~r/1ST|FIRST/, detail) -> "FIRST_HALF"
      state == "in" and Regex.match?(~r/2ND|SECOND/, detail) -> "SECOND_HALF"
      state == "in" and Regex.match?(~r/EXTRA|ET\b/, detail) -> "EXTRA_TIME"
      state == "in" -> "LIVE"
      truthy(g(type, "completed")) or state == "post" -> "FULL_TIME"
      String.contains?(detail, "POSTPONED") or String.contains?(detail, "PPD") -> "POSTPONED"
      true -> "UPCOMING"
    end
  end

  # JavaScript source: svFifaNormalizeEspnEvent(event, leagueSlug = 'fifa.world')
  def sv_fifa_normalize_espn_event(event, league_slug \\ "fifa.world") do
    competition = g(event, ["competitions", 0], %{})
    competitors = sv_fifa_array(g(competition, "competitors"))

    home =
      Enum.find(competitors, &(g(&1, "homeAway") == "home")) || Enum.at(competitors, 0) || %{}

    away =
      Enum.find(competitors, &(g(&1, "homeAway") == "away")) || Enum.at(competitors, 1) || %{}

    status = sv_fifa_espn_event_status(event, competition)
    upcoming = status == "UPCOMING"

    status_type =
      map_or_empty(js_or(g(competition, ["status", "type"]), g(event, ["status", "type"], %{})))

    display_clock =
      js_or(g(competition, ["status", "displayClock"]), g(event, ["status", "displayClock"]))
      |> js_or("")
      |> to_js_string()

    start_time =
      sv_fifa_iso_date(
        parse_date_or_now(
          sv_fifa_first([g(competition, "startDate"), g(competition, "date"), g(event, "date")])
        )
      )

    league = map_or_empty(g(event, "league"))

    league_name =
      sv_fifa_first([g(league, "name"), g(event, ["season", "displayName"]), ""])
      |> to_js_string()

    note = js_or(g(competition, "altGameNote"), "") |> to_js_string()

    group =
      case Regex.run(~r/\bGroup\s+[A-Z0-9]+/i, note) do
        [match | _] -> match
        _ -> ""
      end

    link =
      sv_fifa_array(g(event, "links"))
      |> Enum.find(fn item -> "summary" in sv_fifa_array(g(item, "rel")) end)
      |> g("href", "")

    home_name =
      sv_fifa_first([g(home, ["team", "displayName"]), g(home, ["team", "shortDisplayName"]), ""])
      |> to_js_string()

    away_name =
      sv_fifa_first([g(away, ["team", "displayName"]), g(away, ["team", "shortDisplayName"]), ""])
      |> to_js_string()

    id_fallback = "#{js_or(home_name, "home")}-#{js_or(away_name, "away")}-#{start_time}"

    match = %{
      "id" => js_or(g(event, "id"), js_or(g(competition, "id"), id_fallback)) |> to_js_string(),
      "status" => status,
      "minute" =>
        cond do
          sv_fifa_status_is_running(status) and display_clock != "" -> display_clock
          status == "HALFTIME" -> "HT"
          true -> nil
        end,
      "homeTeam" => home_name,
      "awayTeam" => away_name,
      "homeScore" => if(upcoming, do: nil, else: sv_fifa_number(g(home, "score"))),
      "awayScore" => if(upcoming, do: nil, else: sv_fifa_number(g(away, "score"))),
      "competition" =>
        js_or(league_name, js_or(hd_or_empty(String.split(note, ",")), "Football")),
      "stage" =>
        sv_fifa_title_case(
          js_or(g(event, ["season", "slug"]), js_or(g(status_type, "description"), ""))
        ),
      "group" => group,
      "venue" =>
        js_or(g(competition, ["venue", "fullName"]), g(event, ["venue", "displayName"]))
        |> js_or("")
        |> to_js_string(),
      "startTime" => start_time,
      "kickoff" => start_time,
      "provider" => "espn",
      "leagueSlug" =>
        sv_fifa_first([g(event, ["league", "slug"]), league_slug, "fifa.world"]) |> to_js_string(),
      "providerUrl" => link
    }

    sv_fifa_enrich_match_teams(match, g(home, "team", home), g(away, "team", away))
  end

  # JavaScript source: svFifaNormalizeEspnHeadlines(...sources)
  def sv_fifa_normalize_espn_headlines(sources) when is_list(sources) do
    items =
      sources
      |> Enum.flat_map(&sv_fifa_array/1)
      |> Enum.with_index()
      |> Enum.reduce([], fn {item, index}, acc ->
        title = sv_fifa_first([g(item, "headline"), g(item, "shortLinkText"), g(item, "title")])

        if truthy(title) do
          acc ++
            [
              %{
                "id" =>
                  sv_fifa_first([
                    g(item, "id"),
                    g(item, "nowId"),
                    g(item, ["links", "web", "href"]),
                    "headline-#{index}"
                  ])
                  |> to_js_string(),
                "title" => to_js_string(title),
                "time" =>
                  sv_fifa_first([
                    g(item, "published"),
                    g(item, "lastModified"),
                    g(item, "time"),
                    ""
                  ])
                  |> to_js_string(),
                "url" =>
                  sv_fifa_first([g(item, ["links", "web", "href"]), g(item, "link"), ""])
                  |> to_js_string()
              }
            ]
        else
          acc
        end
      end)

    {_seen, result} =
      Enum.reduce(items, {MapSet.new(), []}, fn item, {seen, acc} ->
        key = String.downcase(item["title"])

        if MapSet.member?(seen, key),
          do: {seen, acc},
          else: {MapSet.put(seen, key), acc ++ [item]}
      end)

    Enum.take(result, 8)
  end

  # JavaScript source: svFifaFetchEspnNews()
  def sv_fifa_fetch_espn_news do
    news =
      sv_fifa_fetch_json("#{@espn_base}/fifa.world/news?limit=12", %{
        "timeout" => upstream_timeout_ms(),
        "maxBytes" => 1024 * 1024
      })

    sv_fifa_news_payload(g(news, "articles"), "espn")
  end

  # JavaScript source: svFifaFetchNewsFresh()
  def sv_fifa_fetch_news_fresh do
    providers = [{"espn", &sv_fifa_fetch_espn_news/0}]

    {payload, errors} =
      Enum.reduce_while(providers, {nil, []}, fn {name, fetcher}, {_payload, errors} ->
        try do
          value = fetcher.()

          if truthy(g(value, "ok")) and sv_fifa_array(g(value, "headlines")) != [],
            do: {:halt, {value, errors}},
            else:
              {:cont,
               {nil, errors ++ [RuntimeError.exception("#{name} returned no football headlines")]}}
        rescue
          error ->
            sv_fifa_warn("#{name} news provider failed", error)
            {:cont, {nil, errors ++ [error]}}
        end
      end)

    cond do
      not is_nil(payload) -> payload
      errors != [] -> raise hd(errors)
      true -> sv_fifa_news_payload([], "none")
    end
  end

  # JavaScript source: svGetFifaNewsPayload()
  def sv_get_fifa_news_payload do
    now = now_ms()
    cached = StreamVault.State.get(:fifa_live_news_cache)

    if cache_valid?(cached, now) do
      g(cached, "payload")
    else
      before = cached

      :global.trans({__MODULE__, :news_refresh}, fn ->
        current = StreamVault.State.get(:fifa_live_news_cache)

        if current != before and cache_valid?(current, now_ms()) do
          g(current, "payload")
        else
          try do
            sv_fifa_fetch_news_fresh() |> sv_fifa_cache_news_payload()
          rescue
            error ->
              sv_fifa_warn("news endpoint fallback", error)

              case StreamVault.State.get(:fifa_live_news_last_good) do
                nil -> sv_fifa_news_payload([], "none") |> sv_fifa_cache_news_payload()
                payload -> payload |> sv_fifa_mark_news_stale() |> sv_fifa_cache_news_payload()
              end
          end
        end
      end)
    end
  end

  # JavaScript source: svFifaFetchEspnScoreboards(league = 'fifa.world')
  def sv_fifa_fetch_espn_scoreboards(league \\ "fifa.world") do
    results =
      [-1, 0, 1, 2]
      |> Enum.map(fn offset ->
        date = DateTime.add(DateTime.utc_now(), offset * 24 * 60 * 60, :second)
        url = "#{@espn_base}/#{league}/scoreboard?limit=40&dates=#{sv_fifa_espn_date(date)}"
        fn -> sv_fifa_fetch_json(url, %{"timeout" => upstream_timeout_ms()}) end
      end)
      |> all_settled()

    fulfilled =
      Enum.flat_map(results, fn
        {:fulfilled, value} -> [value]
        _ -> []
      end)

    if fulfilled == [] do
      reason =
        case Enum.find(results, &match?({:rejected, _}, &1)) do
          {:rejected, error} -> error
          _ -> RuntimeError.exception("ESPN scoreboard unavailable")
        end

      raise reason
    end

    fulfilled
  end

  # JavaScript source: svFifaFetchEspn()
  def sv_fifa_fetch_espn do
    first = sv_fifa_fetch_espn_scoreboards("fifa.world")

    {scoreboards, detail_league} =
      if Enum.any?(first, &(sv_fifa_array(g(&1, "events")) != [])),
        do: {first, "fifa.world"},
        else: {sv_fifa_fetch_espn_scoreboards("all"), "all"}

    events =
      scoreboards
      |> Enum.flat_map(fn board ->
        Enum.map(
          sv_fifa_array(g(board, "events")),
          &sv_fifa_normalize_espn_event(&1, detail_league)
        )
      end)
      |> sv_fifa_dedupe_matches()
      |> Enum.filter(&(truthy(g(&1, "homeTeam")) and truthy(g(&1, "awayTeam"))))

    live_matches = Enum.filter(events, &sv_fifa_status_is_active(g(&1, "status")))

    upcoming_matches =
      events
      |> Enum.filter(&(g(&1, "status") == "UPCOMING"))
      |> Enum.sort_by(&date_sort_value(g(&1, "startTime")), :asc)

    recent_results =
      events
      |> Enum.filter(&sv_fifa_status_is_finished(g(&1, "status")))
      |> Enum.sort_by(&date_sort_value(g(&1, "startTime")), :desc)

    headlines_source =
      scoreboards
      |> Enum.flat_map(fn board -> sv_fifa_array(g(board, "events")) end)
      |> Enum.flat_map(fn event -> sv_fifa_array(g(event, ["competitions", 0, "headlines"])) end)

    sv_fifa_finalize_payload(
      %{
        "liveMatches" => live_matches,
        "upcomingMatches" => upcoming_matches,
        "recentResults" => recent_results,
        "standings" => [],
        "headlines" => sv_fifa_normalize_espn_headlines([headlines_source])
      },
      "espn"
    )
  end

  # JavaScript source: svFifaFetchRealPayload()
  def sv_fifa_fetch_real_payload do
    providers =
      if(sv_fifa_api_football_key() != "",
        do: [{"api-football", &sv_fifa_fetch_api_football/0}],
        else: []
      ) ++ [{"espn", &sv_fifa_fetch_espn/0}]

    {payload, errors} =
      Enum.reduce_while(providers, {nil, []}, fn {name, fetcher}, {_payload, errors} ->
        try do
          value = fetcher.()

          cond do
            truthy(g(value, "ok")) ->
              {:halt, {value, errors}}

            sv_fifa_has_real_data(value) ->
              {:halt, {Map.put(value, "ok", true), errors}}

            true ->
              {:cont,
               {nil, errors ++ [RuntimeError.exception("#{name} returned no live football data")]}}
          end
        rescue
          error ->
            sv_fifa_warn("#{name} provider failed", error)
            {:cont, {nil, errors ++ [error]}}
        end
      end)

    cond do
      not is_nil(payload) ->
        payload

      not is_nil(StreamVault.State.get(:fifa_live_last_good)) ->
        sv_fifa_mark_stale(StreamVault.State.get(:fifa_live_last_good), "cache")

      true ->
        sv_fifa_empty_payload(@real_unavailable, false, "none")
    end
  end

  # JavaScript source: svGetFifaLivePayload(options = {})
  def sv_get_fifa_live_payload(options \\ %{}) do
    now = now_ms()
    cache = StreamVault.State.get(:fifa_live_cache)
    last_good = StreamVault.State.get(:fifa_live_last_good)
    cached_active = sv_fifa_payload_has_active_match(g(cache, "payload"))
    force_fresh = truthy(g(options, "forceFresh", g(options, :forceFresh, false)))
    allow_stale = truthy(g(options, "allowStale", g(options, :allowStale, false)))

    cond do
      cache_valid?(cache, now) and not (force_fresh and cached_active) ->
        g(cache, "payload")

      allow_stale and not is_nil(last_good) and
          not (force_fresh and sv_fifa_payload_has_active_match(last_good)) ->
        Task.start(fn -> sv_fifa_refresh_live_cache() end)
        sv_fifa_mark_stale(last_good, "cache")

      true ->
        sv_fifa_refresh_live_cache()
    end
  end

  # JavaScript source: svWarmFifaLiveCache(reason = 'startup')
  def sv_warm_fifa_live_cache(reason \\ "startup") do
    Task.start(fn ->
      try do
        payload = sv_fifa_refresh_live_cache()

        total =
          length(sv_fifa_array(g(payload, "liveMatches"))) +
            length(sv_fifa_array(g(payload, "upcomingMatches"))) +
            length(sv_fifa_array(g(payload, "recentResults")))

        stale = if truthy(g(payload, "stale")), do: " (stale)", else: ""

        IO.puts(
          "[FIFA Live] #{reason} cache ready: #{total} matches from #{js_or(g(payload, "source"), "none")}#{stale}"
        )
      rescue
        error -> sv_fifa_warn("#{reason} cache warmup failed", error)
      end
    end)

    :ok
  end

  # JavaScript source: svFifaCleanProvider(value)
  def sv_fifa_clean_provider(value) do
    provider = value |> js_or("") |> to_js_string() |> String.trim() |> String.downcase()

    cond do
      provider in ["api-football", "apifootball", "api_sports"] -> "api-football"
      provider == "espn" -> "espn"
      provider == "cache" -> "cache"
      true -> ""
    end
  end

  # JavaScript source: svFifaCleanDetailValue(value)
  def sv_fifa_clean_detail_value(value) do
    if is_nil(value),
      do: "",
      else:
        value
        |> to_js_string()
        |> String.trim()
        |> then(fn text ->
          if text == "" or String.downcase(text) in ["null", "undefined"], do: "", else: text
        end)
  end

  # JavaScript source: svFifaEmptyLineup(team = '')
  def sv_fifa_empty_lineup(team \\ "") do
    %{
      "team" => js_or(team, "") |> to_js_string(),
      "formation" => "",
      "coach" => "",
      "players" => [],
      "substitutes" => []
    }
  end

  # JavaScript source: svFifaEmptyMatchDetail(matchId = '', message = FIFA_LIVE_DETAIL_UNAVAILABLE, source = 'none', stale = false)
  def sv_fifa_empty_match_detail(
        match_id \\ "",
        message \\ @detail_unavailable,
        source \\ "none",
        stale \\ false
      ) do
    detail = %{
      "ok" => false,
      "generatedAt" => now_iso(),
      "source" => source,
      "stale" => !!stale,
      "match" => %{
        "id" => js_or(match_id, "") |> to_js_string(),
        "status" => "",
        "minute" => "",
        "homeTeam" => "",
        "awayTeam" => "",
        "homeScore" => nil,
        "awayScore" => nil,
        "competition" => "",
        "stage" => "",
        "venue" => "",
        "startTime" => ""
      },
      "overview" => %{
        "referee" => "",
        "weather" => "",
        "attendance" => "",
        "round" => "",
        "leg" => ""
      },
      "statistics" => [],
      "lineups" => %{"home" => sv_fifa_empty_lineup(), "away" => sv_fifa_empty_lineup()},
      "events" => [],
      "standings" => [],
      "message" => message,
      "apiFootballConfigured" => sv_fifa_api_football_key() != "",
      "fakeDataUsed" => false,
      "dataIntegrity" => %{
        "fakeDataUsed" => false,
        "cardsAreProviderOnly" => true,
        "statsAreProviderOnly" => true
      },
      "providerLimitations" => []
    }

    detail
    |> Map.put("capabilities", sv_fifa_build_detail_capabilities(detail))
    |> Map.put("provider", sv_fifa_provider_meta(source))
  end

  # JavaScript source: svFifaMatchDetailHasData(detail)
  def sv_fifa_match_detail_has_data(detail) do
    lineups = map_or_empty(g(detail, "lineups"))

    Enum.any?(
      [
        g(detail, "statistics"),
        g(detail, "events"),
        g(detail, "standings"),
        g(lineups, ["home", "players"]),
        g(lineups, ["home", "substitutes"]),
        g(lineups, ["away", "players"]),
        g(lineups, ["away", "substitutes"])
      ],
      &(sv_fifa_array(&1) != [])
    ) or
      Enum.any?(
        [
          g(lineups, ["home", "formation"]),
          g(lineups, ["away", "formation"]),
          g(lineups, ["home", "coach"]),
          g(lineups, ["away", "coach"])
        ],
        &truthy/1
      )
  end

  # JavaScript source: svFifaFinalizeMatchDetail(payload, source, stale = false)
  def sv_fifa_finalize_match_detail(payload, source, stale \\ false) do
    match = sv_fifa_enrich_match_teams(g(payload, "match", %{}))
    overview = map_or_empty(g(payload, "overview"))
    lineups = map_or_empty(g(payload, "lineups"))
    value_source = if stale or source == "cache", do: "cache", else: "provider"
    home_players = Enum.take(sv_fifa_clean_players(g(lineups, ["home", "players"])), 40)
    home_subs = Enum.take(sv_fifa_clean_players(g(lineups, ["home", "substitutes"])), 40)
    away_players = Enum.take(sv_fifa_clean_players(g(lineups, ["away", "players"])), 40)
    away_subs = Enum.take(sv_fifa_clean_players(g(lineups, ["away", "substitutes"])), 40)
    home_lineup = map_or_empty(g(lineups, "home"))
    away_lineup = map_or_empty(g(lineups, "away"))

    home_meta =
      sv_fifa_team_meta(js_or(g(home_lineup, "team"), g(match, "homeTeam")), home_lineup)

    away_meta =
      sv_fifa_team_meta(js_or(g(away_lineup, "team"), g(match, "awayTeam")), away_lineup)

    enrich_event = fn event ->
      team_key = sv_fifa_team_key(g(event, "team"))
      home_key = sv_fifa_team_key(g(match, "homeTeam"))
      away_key = sv_fifa_team_key(g(match, "awayTeam"))

      side_meta =
        cond do
          team_key != "" and team_key == home_key ->
            %{
              "logo" => g(match, "homeLogo"),
              "flag" => g(match, "homeFlag"),
              "countryCode" => g(match, "homeCountryCode")
            }

          team_key != "" and team_key == away_key ->
            %{
              "logo" => g(match, "awayLogo"),
              "flag" => g(match, "awayFlag"),
              "countryCode" => g(match, "awayCountryCode")
            }

          true ->
            %{}
        end

      meta = sv_fifa_team_meta(g(event, "team"), event)

      map_or_empty(event)
      |> Map.merge(%{
        "source" => if(g(event, "source") == "cache", do: "cache", else: value_source),
        "teamLogo" => js_or(g(event, "teamLogo"), js_or(g(side_meta, "logo"), g(meta, "logo"))),
        "teamFlag" => js_or(g(event, "teamFlag"), js_or(g(side_meta, "flag"), g(meta, "flag"))),
        "teamCountryCode" =>
          js_or(
            g(event, "teamCountryCode"),
            js_or(g(side_meta, "countryCode"), g(meta, "countryCode"))
          )
      })
    end

    enrich_standing = fn row ->
      meta = sv_fifa_team_meta(g(row, "team"), row)

      map_or_empty(row)
      |> Map.merge(%{
        "source" => if(g(row, "source") == "cache", do: "cache", else: value_source),
        "logo" => js_or(g(row, "logo"), js_or(g(row, "teamLogo"), g(meta, "logo"))),
        "flag" => js_or(g(row, "flag"), js_or(g(row, "teamFlag"), g(meta, "flag"))),
        "countryCode" =>
          js_or(g(row, "countryCode"), js_or(g(row, "teamCountryCode"), g(meta, "countryCode")))
      })
    end

    match_out = %{
      "id" => js_or(g(match, "id"), js_or(g(payload, "matchId"), "")) |> to_js_string(),
      "status" => js_or(g(match, "status"), "") |> to_js_string(),
      "minute" => sv_fifa_clean_detail_value(g(match, "minute")),
      "homeTeam" => js_or(g(match, "homeTeam"), "") |> to_js_string(),
      "awayTeam" => js_or(g(match, "awayTeam"), "") |> to_js_string(),
      "homeScore" =>
        if(g(match, "homeScore") == 0 or truthy(g(match, "homeScore")),
          do: g(match, "homeScore"),
          else: nil
        ),
      "awayScore" =>
        if(g(match, "awayScore") == 0 or truthy(g(match, "awayScore")),
          do: g(match, "awayScore"),
          else: nil
        ),
      "competition" => js_or(g(match, "competition"), "") |> to_js_string(),
      "stage" => js_or(g(match, "stage"), js_or(g(match, "group"), "")) |> to_js_string(),
      "venue" => js_or(g(match, "venue"), "") |> to_js_string(),
      "startTime" =>
        js_or(g(match, "startTime"), js_or(g(match, "kickoff"), "")) |> to_js_string(),
      "homeFlag" => js_or(g(match, "homeFlag"), ""),
      "homeLogo" => js_or(g(match, "homeLogo"), ""),
      "homeCountryCode" => js_or(g(match, "homeCountryCode"), ""),
      "awayFlag" => js_or(g(match, "awayFlag"), ""),
      "awayLogo" => js_or(g(match, "awayLogo"), ""),
      "awayCountryCode" => js_or(g(match, "awayCountryCode"), "")
    }

    statistics =
      sv_fifa_filter_stats(g(payload, "statistics"))
      |> Enum.take(32)
      |> Enum.map(fn row ->
        map_or_empty(row)
        |> Map.merge(%{
          "source" => if(g(row, "source") == "cache", do: "cache", else: value_source),
          "homeFlag" => js_or(g(row, "homeFlag"), js_or(g(match, "homeFlag"), "")),
          "homeLogo" => js_or(g(row, "homeLogo"), js_or(g(match, "homeLogo"), "")),
          "awayFlag" => js_or(g(row, "awayFlag"), js_or(g(match, "awayFlag"), "")),
          "awayLogo" => js_or(g(row, "awayLogo"), js_or(g(match, "awayLogo"), ""))
        })
      end)

    home_out =
      sv_fifa_empty_lineup(g(match, "homeTeam"))
      |> Map.merge(home_lineup)
      |> Map.merge(%{
        "formation" => sv_fifa_clean_detail_value(g(home_lineup, "formation")),
        "coach" => sv_fifa_clean_detail_value(g(home_lineup, "coach")),
        "logo" =>
          js_or(g(home_lineup, "logo"), js_or(g(match, "homeLogo"), g(home_meta, "logo"))),
        "flag" =>
          js_or(g(home_lineup, "flag"), js_or(g(match, "homeFlag"), g(home_meta, "flag"))),
        "countryCode" =>
          js_or(
            g(home_lineup, "countryCode"),
            js_or(g(match, "homeCountryCode"), g(home_meta, "countryCode"))
          ),
        "players" => home_players,
        "substitutes" => home_subs
      })

    away_out =
      sv_fifa_empty_lineup(g(match, "awayTeam"))
      |> Map.merge(away_lineup)
      |> Map.merge(%{
        "formation" => sv_fifa_clean_detail_value(g(away_lineup, "formation")),
        "coach" => sv_fifa_clean_detail_value(g(away_lineup, "coach")),
        "logo" =>
          js_or(g(away_lineup, "logo"), js_or(g(match, "awayLogo"), g(away_meta, "logo"))),
        "flag" =>
          js_or(g(away_lineup, "flag"), js_or(g(match, "awayFlag"), g(away_meta, "flag"))),
        "countryCode" =>
          js_or(
            g(away_lineup, "countryCode"),
            js_or(g(match, "awayCountryCode"), g(away_meta, "countryCode"))
          ),
        "players" => away_players,
        "substitutes" => away_subs
      })

    detail = %{
      "ok" => truthy(g(payload, "ok")),
      "generatedAt" => now_iso(),
      "source" => source,
      "stale" => !!stale,
      "match" => match_out,
      "overview" => %{
        "referee" => sv_fifa_clean_detail_value(g(overview, "referee")),
        "weather" => sv_fifa_clean_detail_value(g(overview, "weather")),
        "attendance" => sv_fifa_clean_detail_value(g(overview, "attendance")),
        "round" => sv_fifa_clean_detail_value(g(overview, "round")),
        "leg" => sv_fifa_clean_detail_value(g(overview, "leg"))
      },
      "statistics" => statistics,
      "lineups" => %{"home" => home_out, "away" => away_out},
      "events" =>
        sv_fifa_filter_events(g(payload, "events")) |> Enum.take(80) |> Enum.map(enrich_event),
      "standings" =>
        sv_fifa_filter_standings(g(payload, "standings"))
        |> Enum.take(48)
        |> Enum.map(enrich_standing),
      "message" => js_or(g(payload, "message"), "") |> to_js_string(),
      "apiFootballConfigured" => sv_fifa_api_football_key() != "",
      "fakeDataUsed" => false,
      "dataIntegrity" => %{
        "fakeDataUsed" => false,
        "cardsAreProviderOnly" => true,
        "statsAreProviderOnly" => true
      },
      "providerLimitations" => []
    }

    detail =
      detail
      |> Map.put("capabilities", sv_fifa_build_detail_capabilities(detail))
      |> Map.put("provider", sv_fifa_provider_meta(source))

    limited =
      truthy(g(detail, "ok")) and truthy(g(detail, ["provider", "limited"])) and
        (not truthy(g(detail, ["capabilities", "lineups"])) or
           not truthy(g(detail, ["capabilities", "formations"])))

    detail =
      if limited,
        do: Map.update!(detail, "providerLimitations", &(&1 ++ [@detail_provider_limited])),
        else: detail

    detail =
      if limited and g(detail, "message") == "" and not sv_fifa_match_detail_has_data(detail),
        do: Map.put(detail, "message", @detail_provider_limited),
        else: detail

    detail =
      if truthy(g(detail, "ok")) and not sv_fifa_match_detail_has_data(detail) and
           g(detail, "message") == "",
         do: Map.put(detail, "message", @detail_unavailable),
         else: detail

    if not truthy(g(detail, "ok")) and g(detail, "message") == "",
      do: Map.put(detail, "message", @detail_unavailable),
      else: detail
  end

  # JavaScript source: svFifaDetailCacheKey(provider, matchId, league = '')
  def sv_fifa_detail_cache_key(provider, match_id, league \\ ""),
    do:
      "#{js_or(provider, "auto")}:#{match_id |> js_or("") |> to_js_string() |> String.trim()}:#{league |> js_or("") |> to_js_string() |> String.trim() |> String.downcase()}"

  # JavaScript source: svFifaDetailCacheTtl(payload)
  def sv_fifa_detail_cache_ttl(payload) do
    status = g(payload, ["match", "status"]) |> js_or("") |> to_js_string() |> String.upcase()
    if status in ["LIVE", "HT"], do: detail_fast_cache_ms(), else: detail_slow_cache_ms()
  end

  # JavaScript source: svFifaCacheMatchDetail(key, payload)
  def sv_fifa_cache_match_detail(key, payload) do
    if is_nil(payload) or not truthy(g(payload, "ok")) or g(payload, "source") == "none" do
      payload
    else
      StreamVault.State.update(:fifa_match_detail_cache, %{}, fn cache ->
        Map.put(cache, key, %{
          "expiresAt" => add_ms(now_ms(), sv_fifa_detail_cache_ttl(payload)),
          "payload" => payload
        })
      end)

      payload
    end
  end

  # JavaScript source: svFifaMarkDetailStale(payload)
  def sv_fifa_mark_detail_stale(payload) do
    map_or_empty(payload)
    |> Map.merge(%{
      "generatedAt" => now_iso(),
      "source" => "cache",
      "stale" => true,
      "message" =>
        js_or(
          g(payload, "message"),
          "Showing last real match details while the football provider reconnects."
        )
    })
  end

  # JavaScript source: svFifaMatchCollections(payload)
  def sv_fifa_match_collections(payload),
    do:
      sv_fifa_array(g(payload, "liveMatches")) ++
        sv_fifa_array(g(payload, "upcomingMatches")) ++ sv_fifa_array(g(payload, "recentResults"))

  # JavaScript source: svFifaFindSummaryMatch(matchId)
  def sv_fifa_find_summary_match(match_id) do
    id = match_id |> js_or("") |> to_js_string() |> String.trim()

    if id == "" do
      nil
    else
      [
        g(StreamVault.State.get(:fifa_live_cache), "payload"),
        StreamVault.State.get(:fifa_live_last_good)
      ]
      |> Enum.reject(&is_nil/1)
      |> Enum.find_value(fn payload ->
        Enum.find(
          sv_fifa_match_collections(payload),
          &(to_js_string(js_or(g(&1, "id"), "")) == id)
        )
      end)
    end
  end

  # JavaScript source: svFifaInferProvider(matchId)
  def sv_fifa_infer_provider(match_id) do
    cached = sv_fifa_find_summary_match(match_id)

    if truthy(g(cached, "provider")) do
      g(cached, "provider")
    else
      try do
        payload = sv_get_fifa_live_payload()

        found =
          Enum.find(
            sv_fifa_match_collections(payload),
            &(to_js_string(js_or(g(&1, "id"), "")) == to_js_string(js_or(match_id, "")))
          )

        if truthy(g(found, "provider")),
          do: g(found, "provider"),
          else: if(sv_fifa_api_football_key() != "", do: "api-football", else: "espn")
      rescue
        error ->
          sv_fifa_warn("match provider inference failed", error)
          if(sv_fifa_api_football_key() != "", do: "api-football", else: "espn")
      end
    end
  end

  # JavaScript source: svFifaStatKey(value)
  def sv_fifa_stat_key(value),
    do:
      value
      |> js_or("")
      |> to_js_string()
      |> String.downcase()
      |> String.replace(~r/[^a-z0-9]+/u, "")

  # JavaScript source: svFifaFriendlyStatLabel(label, name = '')
  def sv_fifa_friendly_stat_label(label, name \\ "") do
    key = sv_fifa_stat_key(js_or(name, label))

    labels = %{
      "ballpossession" => "Possession",
      "possessionpct" => "Possession",
      "totalshots" => "Shots",
      "shotsongoal" => "Shots on target",
      "shotsontarget" => "Shots on target",
      "cornerkicks" => "Corners",
      "woncorners" => "Corners",
      "foulscommitted" => "Fouls",
      "fouls" => "Fouls",
      "yellowcards" => "Yellow Cards",
      "redcards" => "Red Cards",
      "offsides" => "Offsides",
      "goalkeepersaves" => "Saves",
      "saves" => "Saves",
      "totalpasses" => "Passes",
      "accuratepasses" => "Pass Accuracy",
      "passaccuracy" => "Pass Accuracy",
      "passcompletion" => "Pass Accuracy",
      "expectedgoals" => "Expected Goals",
      "xg" => "Expected Goals"
    }

    Map.get(labels, key) || sv_fifa_title_case(js_or(label, name))
  end

  # JavaScript source: svFifaProviderStatLabel(label)
  def sv_fifa_provider_stat_label(label) do
    labels = %{
      "shots" => "Shots",
      "totalshots" => "Shots",
      "shotsongoal" => "Shots on target",
      "shotsontarget" => "Shots on target",
      "sog" => "Shots on target",
      "possession" => "Possession",
      "ballpossession" => "Possession",
      "possessionpct" => "Possession",
      "passes" => "Passes",
      "totalpasses" => "Passes",
      "passaccuracy" => "Pass Accuracy",
      "passcompletion" => "Pass Accuracy",
      "accuratepasses" => "Pass Accuracy",
      "fouls" => "Fouls",
      "foulscommitted" => "Fouls",
      "yellowcards" => "Yellow Cards",
      "redcards" => "Red Cards",
      "offsides" => "Offsides",
      "corners" => "Corners",
      "cornerkicks" => "Corners",
      "woncorners" => "Corners",
      "saves" => "Saves",
      "goalkeepersaves" => "Saves",
      "expectedgoals" => "Expected Goals",
      "xg" => "Expected Goals"
    }

    Map.get(labels, sv_fifa_stat_key(label), "")
  end

  # JavaScript source: svFifaNormalizeStatPairs(homeStats, awayStats)
  def sv_fifa_normalize_stat_pairs(home_stats, away_stats) do
    add = fn side, stats, {rows, keys} ->
      Enum.reduce(sv_fifa_array(stats), {rows, keys}, fn stat, {rows, keys} ->
        raw_label =
          sv_fifa_first([
            g(stat, "label"),
            g(stat, "type"),
            g(stat, "displayName"),
            g(stat, "name")
          ])

        raw_name = sv_fifa_first([g(stat, "name"), g(stat, "type"), raw_label])
        label = sv_fifa_provider_stat_label(sv_fifa_friendly_stat_label(raw_label, raw_name))
        key = sv_fifa_stat_key(label)

        value =
          sv_fifa_clean_detail_value(sv_fifa_first([g(stat, "displayValue"), g(stat, "value")]))

        if label == "" or value == "" do
          {rows, keys}
        else
          keys = if Map.has_key?(rows, key), do: keys, else: keys ++ [key]

          row =
            Map.get(rows, key, %{
              "label" => label,
              "home" => "",
              "away" => "",
              "source" => "provider"
            })
            |> Map.put(side, value)

          {Map.put(rows, key, row), keys}
        end
      end)
    end

    {rows, keys} = add.("away", away_stats, add.("home", home_stats, {%{}, []}))

    order = [
      "shots",
      "shotsontarget",
      "possession",
      "passes",
      "passaccuracy",
      "fouls",
      "yellowcards",
      "redcards",
      "offsides",
      "corners",
      "saves",
      "expectedgoals"
    ]

    ordered =
      Enum.flat_map(order, fn key ->
        case Map.fetch(rows, key) do
          {:ok, row} -> [row]
          :error -> []
        end
      end)

    extra = keys |> Enum.reject(&(&1 in order)) |> Enum.map(&Map.fetch!(rows, &1))
    Enum.filter(ordered ++ extra, &(truthy(g(&1, "home")) or truthy(g(&1, "away"))))
  end

  # JavaScript source: svFifaMatchMinute(elapsed, extra)
  def sv_fifa_match_minute(elapsed, extra) do
    base = sv_fifa_number(elapsed, nil)
    added = sv_fifa_number(extra, nil)

    if is_nil(base),
      do: "",
      else: "#{number_string(base)}#{if truthy(added), do: "+#{number_string(added)}", else: ""}'"
  end

  # JavaScript source: svFifaNormalizeApiFootballPlayer(entry, starter)
  def sv_fifa_normalize_api_football_player(entry, starter) do
    player = map_or_empty(js_or(g(entry, "player"), entry))

    name =
      sv_fifa_clean_detail_value(
        sv_fifa_first([g(player, "name"), g(player, "displayName"), g(player, "fullName")])
      )

    if name == "",
      do: nil,
      else: %{
        "number" => sv_fifa_number(sv_fifa_first([g(player, "number"), g(player, "jersey")]), ""),
        "name" => name,
        "position" =>
          sv_fifa_clean_detail_value(
            sv_fifa_first([g(player, "pos"), g(player, "position"), g(player, "grid")])
          ),
        "starter" => !!starter,
        "captain" => truthy(g(player, "captain"))
      }
  end

  # JavaScript source: svFifaNormalizeApiFootballLineups(raw, match)
  def sv_fifa_normalize_api_football_lineups(raw, match) do
    blocks = sv_fifa_array(g(raw, "response"))

    find_block = fn side, team_name ->
      Enum.find(blocks, fn block ->
        name = g(block, ["team", "name"]) |> js_or("") |> to_js_string() |> String.downcase()
        name != "" and name == team_name |> js_or("") |> to_js_string() |> String.downcase()
      end) || Enum.at(blocks, if(side == "home", do: 0, else: 1)) || %{}
    end

    to_lineup = fn block, fallback_team ->
      meta =
        sv_fifa_team_meta(js_or(g(block, ["team", "name"]), fallback_team), g(block, "team", %{}))

      %{
        "team" => js_or(g(block, ["team", "name"]), js_or(fallback_team, "")) |> to_js_string(),
        "logo" => sv_fifa_provider_logo(g(block, "team")),
        "flag" => meta["flag"],
        "countryCode" => meta["countryCode"],
        "formation" => sv_fifa_clean_detail_value(g(block, "formation")),
        "coach" => sv_fifa_clean_detail_value(g(block, ["coach", "name"])),
        "players" =>
          sv_fifa_array(g(block, "startXI"))
          |> Enum.map(&sv_fifa_normalize_api_football_player(&1, true))
          |> Enum.reject(&is_nil/1),
        "substitutes" =>
          sv_fifa_array(g(block, "substitutes"))
          |> Enum.map(&sv_fifa_normalize_api_football_player(&1, false))
          |> Enum.reject(&is_nil/1)
      }
    end

    %{
      "home" => to_lineup.(find_block.("home", g(match, "homeTeam")), g(match, "homeTeam")),
      "away" => to_lineup.(find_block.("away", g(match, "awayTeam")), g(match, "awayTeam"))
    }
  end

  # JavaScript source: svFifaNormalizeApiFootballStatistics(raw, match)
  def sv_fifa_normalize_api_football_statistics(raw, match) do
    blocks = sv_fifa_array(g(raw, "response"))

    home =
      Enum.find(
        blocks,
        &(String.downcase(to_js_string(js_or(g(&1, ["team", "name"]), ""))) ==
            String.downcase(to_js_string(js_or(g(match, "homeTeam"), ""))))
      ) || Enum.at(blocks, 0) || %{}

    away =
      Enum.find(
        blocks,
        &(String.downcase(to_js_string(js_or(g(&1, ["team", "name"]), ""))) ==
            String.downcase(to_js_string(js_or(g(match, "awayTeam"), ""))))
      ) || Enum.at(blocks, 1) || %{}

    sv_fifa_normalize_stat_pairs(g(home, "statistics"), g(away, "statistics"))
  end

  # JavaScript source: svFifaNormalizeApiFootballEvents(raw)
  def sv_fifa_normalize_api_football_events(raw) do
    sv_fifa_array(g(raw, "response"))
    |> Enum.map(fn event ->
      meta = sv_fifa_team_meta(g(event, ["team", "name"]), g(event, "team", %{}))

      %{
        "minute" =>
          sv_fifa_match_minute(g(event, ["time", "elapsed"]), g(event, ["time", "extra"])),
        "team" => js_or(g(event, ["team", "name"]), "") |> to_js_string(),
        "teamLogo" => sv_fifa_provider_logo(g(event, "team")),
        "teamFlag" => meta["flag"],
        "teamCountryCode" => meta["countryCode"],
        "player" => sv_fifa_clean_detail_value(g(event, ["player", "name"])),
        "type" =>
          sv_fifa_clean_detail_value(sv_fifa_first([g(event, "type"), g(event, "detail")])),
        "detail" =>
          sv_fifa_clean_detail_value(
            sv_fifa_first([
              g(event, "detail"),
              g(event, "comments"),
              g(event, ["assist", "name"])
            ])
          )
      }
    end)
    |> Enum.filter(&(truthy(g(&1, "type")) or truthy(g(&1, "player")) or truthy(g(&1, "team"))))
  end

  # JavaScript source: svFifaFetchApiFootballDetail(matchId)
  def sv_fifa_fetch_api_football_detail(match_id) do
    api_key = sv_fifa_api_football_key()

    if api_key == "" do
      sv_fifa_empty_match_detail(match_id, @detail_unavailable, "none")
    else
      headers = sv_fifa_api_football_headers(api_key)

      fixture =
        sv_fifa_fetch_json(
          "#{@api_football_base}/fixtures?id=#{URI.encode_www_form(to_js_string(match_id))}",
          %{"headers" => headers}
        )

      fixture_item = Enum.at(sv_fifa_array(g(fixture, "response")), 0)

      if is_nil(fixture_item) do
        sv_fifa_empty_match_detail(match_id, @detail_unavailable, "api-football")
      else
        match = sv_fifa_normalize_api_football_fixture(fixture_item)
        league = map_or_empty(g(fixture_item, "league"))

        fallback_year =
          case to_datetime(g(match, "startTime")) do
            {:ok, dt} -> dt.year
            :error -> Date.utc_today().year
          end

        season = sv_fifa_number(g(league, "season"), fallback_year)

        calls = [
          fn ->
            sv_fifa_fetch_json(
              "#{@api_football_base}/fixtures/statistics?fixture=#{URI.encode_www_form(to_js_string(g(match, "id")))}",
              %{"headers" => headers}
            )
          end,
          fn ->
            sv_fifa_fetch_json(
              "#{@api_football_base}/fixtures/lineups?fixture=#{URI.encode_www_form(to_js_string(g(match, "id")))}",
              %{"headers" => headers}
            )
          end,
          fn ->
            sv_fifa_fetch_json(
              "#{@api_football_base}/fixtures/events?fixture=#{URI.encode_www_form(to_js_string(g(match, "id")))}",
              %{"headers" => headers}
            )
          end
        ]

        calls =
          if truthy(g(league, "id")) and truthy(season),
            do:
              calls ++
                [
                  fn ->
                    sv_fifa_fetch_json(
                      "#{@api_football_base}/standings?league=#{URI.encode_www_form(to_js_string(g(league, "id")))}&season=#{URI.encode_www_form(to_js_string(season))}",
                      %{"headers" => headers}
                    )
                  end
                ],
            else: calls

        results = all_settled(calls)
        stats_res = Enum.at(results, 0)
        lineups_res = Enum.at(results, 1)
        events_res = Enum.at(results, 2)
        standings_res = Enum.at(results, 3)

        lineups =
          case lineups_res do
            {:fulfilled, value} ->
              sv_fifa_normalize_api_football_lineups(value, match)

            _ ->
              %{
                "home" => sv_fifa_empty_lineup(g(match, "homeTeam")),
                "away" => sv_fifa_empty_lineup(g(match, "awayTeam"))
              }
          end

        sv_fifa_finalize_match_detail(
          %{
            "ok" => true,
            "match" => match,
            "overview" => %{
              "referee" => js_or(g(fixture_item, ["fixture", "referee"]), ""),
              "weather" => "",
              "attendance" => "",
              "round" => js_or(g(league, "round"), ""),
              "leg" => ""
            },
            "statistics" =>
              case stats_res do
                {:fulfilled, value} -> sv_fifa_normalize_api_football_statistics(value, match)
                _ -> []
              end,
            "lineups" => lineups,
            "events" =>
              case events_res do
                {:fulfilled, value} -> sv_fifa_normalize_api_football_events(value)
                _ -> []
              end,
            "standings" =>
              case standings_res do
                {:fulfilled, value} -> sv_fifa_normalize_api_football_standings(value)
                _ -> []
              end
          },
          "api-football"
        )
      end
    end
  end

  # JavaScript source: svFifaNormalizeEspnPlayer(entry)
  def sv_fifa_normalize_espn_player(entry) do
    athlete = map_or_empty(g(entry, "athlete"))

    name =
      sv_fifa_clean_detail_value(
        sv_fifa_first([
          g(athlete, "displayName"),
          g(athlete, "fullName"),
          g(athlete, "shortName")
        ])
      )

    if name == "",
      do: nil,
      else: %{
        "number" => sv_fifa_number(sv_fifa_first([g(entry, "jersey"), g(athlete, "jersey")]), ""),
        "name" => name,
        "position" =>
          sv_fifa_clean_detail_value(
            sv_fifa_first([
              g(entry, ["position", "abbreviation"]),
              g(entry, ["position", "displayName"]),
              g(entry, ["position", "name"])
            ])
          ),
        "starter" => truthy(g(entry, "starter")),
        "captain" => truthy(g(entry, "captain"))
      }
  end

  # JavaScript source: svFifaNormalizeEspnLineups(raw, match)
  def sv_fifa_normalize_espn_lineups(raw, match) do
    rosters = sv_fifa_array(g(raw, "rosters"))

    find = fn side ->
      Enum.find(rosters, &(g(&1, "homeAway") == side)) ||
        Enum.at(rosters, if(side == "home", do: 0, else: 1)) || %{}
    end

    to_lineup = fn block, fallback_team ->
      roster =
        sv_fifa_array(g(block, "roster"))
        |> Enum.map(&sv_fifa_normalize_espn_player/1)
        |> Enum.reject(&is_nil/1)

      meta =
        sv_fifa_team_meta(
          js_or(g(block, ["team", "displayName"]), fallback_team),
          g(block, "team", %{})
        )

      %{
        "team" =>
          js_or(g(block, ["team", "displayName"]), js_or(fallback_team, "")) |> to_js_string(),
        "logo" => sv_fifa_provider_logo(g(block, "team")),
        "flag" => meta["flag"],
        "countryCode" => meta["countryCode"],
        "formation" => sv_fifa_clean_detail_value(g(block, "formation")),
        "coach" =>
          sv_fifa_clean_detail_value(
            sv_fifa_first([g(block, ["coach", "displayName"]), g(block, ["coach", "name"])])
          ),
        "players" => Enum.filter(roster, &truthy(g(&1, "starter"))),
        "substitutes" => Enum.reject(roster, &truthy(g(&1, "starter")))
      }
    end

    %{
      "home" => to_lineup.(find.("home"), g(match, "homeTeam")),
      "away" => to_lineup.(find.("away"), g(match, "awayTeam"))
    }
  end

  # JavaScript source: svFifaNormalizeEspnStatistics(raw)
  def sv_fifa_normalize_espn_statistics(raw) do
    teams = sv_fifa_array(g(raw, ["boxscore", "teams"]))
    home = Enum.find(teams, &(g(&1, "homeAway") == "home")) || Enum.at(teams, 0) || %{}
    away = Enum.find(teams, &(g(&1, "homeAway") == "away")) || Enum.at(teams, 1) || %{}
    sv_fifa_normalize_stat_pairs(g(home, "statistics"), g(away, "statistics"))
  end

  # JavaScript source: svFifaNormalizeEspnEvents(raw)
  def sv_fifa_normalize_espn_events(raw) do
    events =
      if sv_fifa_array(g(raw, "keyEvents")) != [],
        do: sv_fifa_array(g(raw, "keyEvents")),
        else: Enum.map(sv_fifa_array(g(raw, "commentary")), &js_or(g(&1, "play"), &1))

    important = ~r/goal|card|substitution|kickoff|half|regular time|penalty/i

    events
    |> Enum.map(fn event ->
      type =
        sv_fifa_clean_detail_value(
          sv_fifa_first([
            g(event, ["type", "text"]),
            g(event, ["type", "description"]),
            g(event, ["type", "type"])
          ])
        )

      if type == "" or not Regex.match?(important, type) do
        nil
      else
        participants = sv_fifa_array(g(event, "participants"))
        meta = sv_fifa_team_meta(g(event, ["team", "displayName"]), g(event, "team", %{}))

        %{
          "minute" =>
            sv_fifa_clean_detail_value(
              sv_fifa_first([
                g(event, ["clock", "displayValue"]),
                g(event, ["time", "displayValue"])
              ])
            ),
          "team" => js_or(g(event, ["team", "displayName"]), "") |> to_js_string(),
          "teamLogo" => sv_fifa_provider_logo(g(event, "team")),
          "teamFlag" => meta["flag"],
          "teamCountryCode" => meta["countryCode"],
          "player" => sv_fifa_clean_detail_value(g(participants, [0, "athlete", "displayName"])),
          "type" => type,
          "detail" =>
            sv_fifa_clean_detail_value(sv_fifa_first([g(event, "shortText"), g(event, "text")]))
        }
      end
    end)
    |> Enum.reject(&is_nil/1)
  end

  # JavaScript source: svFifaEspnStandingStat(entry, keys)
  def sv_fifa_espn_standing_stat(entry, keys) do
    wanted = keys |> Enum.map(&sv_fifa_stat_key/1) |> MapSet.new()

    found =
      Enum.find(sv_fifa_array(g(entry, "stats")), fn stat ->
        [
          g(stat, "name"),
          g(stat, "displayName"),
          g(stat, "shortDisplayName"),
          g(stat, "abbreviation"),
          g(stat, "type")
        ]
        |> Enum.map(&sv_fifa_stat_key/1)
        |> Enum.reject(&(&1 == ""))
        |> Enum.any?(&MapSet.member?(wanted, &1))
      end)

    sv_fifa_clean_detail_value(sv_fifa_first([g(found, "displayValue"), g(found, "value")]))
  end

  # JavaScript source: svFifaNormalizeEspnStandings(raw)
  def sv_fifa_normalize_espn_standings(raw) do
    standings = map_or_empty(g(raw, "standings"))

    rows =
      sv_fifa_array(g(standings, "groups"))
      |> Enum.flat_map(fn group ->
        group_name =
          js_or(g(group, "header"), js_or(g(standings, "header"), "")) |> to_js_string()

        sv_fifa_array(g(group, ["standings", "entries"]))
        |> Enum.with_index()
        |> Enum.map(fn {entry, index} ->
          meta =
            sv_fifa_team_meta(
              js_or(g(entry, ["team", "displayName"]), g(entry, "team")),
              g(entry, "team", %{})
            )

          %{
            "group" => group_name,
            "rank" =>
              sv_fifa_number(
                sv_fifa_espn_standing_stat(entry, ["rank", "rk", "position"]),
                index + 1
              ),
            "team" =>
              js_or(g(entry, ["team", "displayName"]), js_or(g(entry, "team"), ""))
              |> to_js_string(),
            "logo" => sv_fifa_provider_logo(g(entry, "team")),
            "flag" => meta["flag"],
            "countryCode" => meta["countryCode"],
            "played" =>
              sv_fifa_espn_standing_stat(entry, [
                "gamesplayed",
                "gamesPlayed",
                "played",
                "matchesplayed",
                "mp",
                "gp"
              ]),
            "wins" => sv_fifa_espn_standing_stat(entry, ["wins", "w"]),
            "draws" => sv_fifa_espn_standing_stat(entry, ["draws", "ties", "d", "t"]),
            "losses" => sv_fifa_espn_standing_stat(entry, ["losses", "l"]),
            "goalDifference" =>
              sv_fifa_espn_standing_stat(entry, [
                "goaldifference",
                "goalDifference",
                "goalsdiff",
                "gd",
                "pointdifferential",
                "pd"
              ]),
            "points" => sv_fifa_espn_standing_stat(entry, ["points", "pts"])
          }
        end)
      end)

    sv_fifa_filter_standings(rows)
  end

  # JavaScript source: svFifaFetchEspnDetail(matchId, league = '')
  def sv_fifa_fetch_espn_detail(match_id, league \\ "") do
    leagues =
      [league, "fifa.world", "all"]
      |> Enum.map(&(to_js_string(js_or(&1, "")) |> String.trim()))
      |> Enum.reject(&(&1 == ""))
      |> uniq_preserving()

    {raw, last_error, used_league} =
      Enum.reduce_while(leagues, {nil, nil, hd_or_empty(leagues)}, fn slug,
                                                                      {_raw, _error, _used} ->
        try do
          value =
            sv_fifa_fetch_json(
              "#{@espn_base}/#{URI.encode_www_form(slug)}/summary?event=#{URI.encode_www_form(to_js_string(match_id))}",
              %{"timeout" => upstream_timeout_ms(), "maxBytes" => 5 * 1024 * 1024}
            )

          {:halt, {value, nil, slug}}
        rescue
          error -> {:cont, {nil, error, slug}}
        end
      end)

    if is_nil(raw),
      do: raise(last_error || RuntimeError.exception("ESPN match detail unavailable"))

    header = map_or_empty(g(raw, "header"))

    if not truthy(g(header, "id")) and sv_fifa_array(g(header, "competitions")) == [] do
      sv_fifa_empty_match_detail(match_id, @detail_unavailable, "espn")
    else
      match = sv_fifa_normalize_espn_event(header, js_or(used_league, "fifa.world"))
      match = Map.put(match, "id", js_or(g(match, "id"), match_id) |> to_js_string())
      competition = g(header, ["competitions", 0], %{})

      referee =
        sv_fifa_array(g(competition, "officials"))
        |> Enum.find(fn item ->
          Regex.match?(
            ~r/referee/i,
            to_js_string(js_or(g(item, ["position", "name"]), js_or(g(item, "role"), "")))
          )
        end)
        |> g("displayName", "")

      sv_fifa_finalize_match_detail(
        %{
          "ok" => true,
          "match" => match,
          "overview" => %{
            "referee" => referee,
            "weather" =>
              sv_fifa_clean_detail_value(g(raw, ["gameInfo", "weather", "displayValue"])),
            "attendance" => sv_fifa_clean_detail_value(g(competition, "attendance")),
            "round" =>
              sv_fifa_clean_detail_value(
                sv_fifa_first([g(competition, "altGameNote"), g(header, ["season", "slug"])])
              ),
            "leg" => ""
          },
          "statistics" => sv_fifa_normalize_espn_statistics(raw),
          "lineups" => sv_fifa_normalize_espn_lineups(raw, match),
          "events" => sv_fifa_normalize_espn_events(raw),
          "standings" => sv_fifa_normalize_espn_standings(raw)
        },
        "espn"
      )
    end
  end

  # JavaScript source: svGetFifaMatchDetail(provider, matchId, options = {})
  def sv_get_fifa_match_detail(provider, match_id, options \\ %{}) do
    id = match_id |> js_or("") |> to_js_string() |> String.trim()

    if id == "" do
      sv_fifa_empty_match_detail("", @detail_unavailable, "none")
    else
      clean_provider = js_or(sv_fifa_clean_provider(provider), sv_fifa_infer_provider(id))
      summary = sv_fifa_find_summary_match(id)

      league =
        sv_fifa_clean_detail_value(
          js_or(g(options, "league", g(options, :league)), g(summary, "leagueSlug"))
        )

      key = sv_fifa_detail_cache_key(clean_provider, id, league)
      cache_map = StreamVault.State.get(:fifa_match_detail_cache, %{})
      cached = Map.get(cache_map, key)

      if cache_valid?(cached, now_ms()) do
        g(cached, "payload")
      else
        before = cached

        :global.trans({__MODULE__, {:detail, key}}, fn ->
          current = StreamVault.State.get(:fifa_match_detail_cache, %{}) |> Map.get(key)

          if current != before and cache_valid?(current, now_ms()) do
            g(current, "payload")
          else
            try do
              payload =
                if clean_provider == "api-football",
                  do: sv_fifa_fetch_api_football_detail(id),
                  else: sv_fifa_fetch_espn_detail(id, league)

              cond do
                truthy(g(payload, "ok")) ->
                  sv_fifa_cache_match_detail(key, payload)

                truthy(g(cached, ["payload", "ok"])) ->
                  sv_fifa_mark_detail_stale(g(cached, "payload"))

                is_nil(payload) ->
                  sv_fifa_empty_match_detail(id, @detail_unavailable, "none")

                true ->
                  payload
              end
            rescue
              error ->
                sv_fifa_warn("#{js_or(clean_provider, "football")} match detail failed", error)

                if truthy(g(cached, ["payload", "ok"])),
                  do: sv_fifa_mark_detail_stale(g(cached, "payload")),
                  else: sv_fifa_empty_match_detail(id, @detail_unavailable, "none")
            end
          end
        end)
      end
    end
  end

  # JavaScript source: svSendFifaMatchDetail(req, res, provider, matchId)
  def sv_send_fifa_match_detail(conn, provider, match_id) do
    conn = conn |> Plug.Conn.fetch_query_params() |> no_cache_headers()

    try do
      StreamVault.Response.json(
        conn,
        sv_get_fifa_match_detail(provider, match_id, %{"league" => g(conn.query_params, "league")})
      )
    rescue
      error ->
        sv_fifa_warn("match detail endpoint response failed", error)

        StreamVault.Response.json(
          conn,
          sv_fifa_empty_match_detail(match_id, @detail_unavailable, "none")
        )
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:4698 GET /api/fifa-live/match/:provider/:matchId
  def route_match_with_provider(conn) do
    sv_send_fifa_match_detail(
      conn,
      g(conn.path_params, "provider", ""),
      g(conn.path_params, "matchId", "")
    )
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:4702 GET /api/fifa-live/match/:matchId
  def route_match(conn),
    do: sv_send_fifa_match_detail(conn, "", g(conn.path_params, "matchId", ""))

  # JavaScript source: anonymous route handler(req, res) at server.js:4706 GET /api/fifa-live/news
  def route_news(conn) do
    conn = no_cache_headers(conn)

    try do
      StreamVault.Response.json(conn, sv_get_fifa_news_payload())
    rescue
      error ->
        sv_fifa_warn("news endpoint response failed", error)

        case StreamVault.State.get(:fifa_live_news_last_good) do
          nil -> StreamVault.Response.json(conn, sv_fifa_news_payload([], "none"))
          payload -> StreamVault.Response.json(conn, sv_fifa_mark_news_stale(payload))
        end
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:4721 GET /api/fifa-live
  def route_live(conn) do
    conn = conn |> Plug.Conn.fetch_query_params() |> no_cache_headers()

    try do
      force = Enum.any?(["live", "fresh", "priority"], &(g(conn.query_params, &1) == "1"))
      payload = sv_get_fifa_live_payload(%{"allowStale" => true, "forceFresh" => force})

      conn
      |> Plug.Conn.put_resp_header(
        "x-streamvault-fifa-cache",
        if(truthy(g(payload, "stale")), do: "stale-refreshing", else: "fresh")
      )
      |> StreamVault.Response.json(payload)
    rescue
      error ->
        sv_fifa_warn("endpoint response failed", error)
        StreamVault.Response.json(conn, sv_fifa_empty_payload(@real_unavailable, false, "none"))
    end
  end

  # Conversion support for JavaScript optional chaining, coercion, Date, Promise.allSettled,
  # and the module-scoped fifaLive*/fifaMatchDetail* state held by StreamVault.State.
  defp g(value, key_or_path), do: g(value, key_or_path, nil)
  defp g(value, [], _default), do: value

  defp g(value, [head | tail], default) do
    case g(value, head, :__sv_missing__) do
      :__sv_missing__ -> default
      nested -> g(nested, tail, default)
    end
  end

  defp g(map, key, default) when is_map(map) do
    alternate =
      if is_atom(key),
        do: Atom.to_string(key),
        else: if(is_binary(key), do: existing_atom(key), else: :__sv_no_atom__)

    case Map.fetch(map, key) do
      {:ok, value} ->
        value

      :error ->
        case alternate do
          :__sv_no_atom__ -> default
          nil -> default
          other -> Map.get(map, other, default)
        end
    end
  end

  defp g(list, index, default) when is_list(list) and is_integer(index),
    do: Enum.at(list, index, default)

  defp g(_value, _key, default), do: default

  defp existing_atom(key) do
    try do
      String.to_existing_atom(key)
    rescue
      ArgumentError -> nil
    end
  end

  defp truthy(value), do: StreamVault.JS.truthy?(value)
  defp js_or(value, fallback), do: if(truthy(value), do: value, else: fallback)
  defp map_or_empty(value), do: if(is_map(value), do: value, else: %{})

  defp to_js_string(nil), do: ""
  defp to_js_string(true), do: "true"
  defp to_js_string(false), do: "false"
  defp to_js_string(value) when is_binary(value), do: value
  defp to_js_string(value) when is_integer(value), do: Integer.to_string(value)
  defp to_js_string(value) when is_float(value), do: number_string(value)
  defp to_js_string(value) when is_atom(value), do: Atom.to_string(value)
  defp to_js_string(value) when is_list(value), do: Enum.map_join(value, ",", &to_js_string/1)
  defp to_js_string(value) when is_map(value), do: "[object Object]"
  defp to_js_string(value), do: to_string(value)

  defp number_string(value) when is_integer(value), do: Integer.to_string(value)

  defp number_string(value) when is_float(value) do
    if trunc(value) == value, do: Integer.to_string(trunc(value)), else: Float.to_string(value)
  end

  defp number_string(value), do: to_js_string(value)

  defp now_ms, do: System.system_time(:millisecond)
  defp now_iso, do: sv_fifa_iso_date(:now)

  defp to_datetime(:now), do: {:ok, DateTime.utc_now()}
  defp to_datetime(%DateTime{} = value), do: {:ok, value}
  defp to_datetime(%NaiveDateTime{} = value), do: {:ok, DateTime.from_naive!(value, "Etc/UTC")}
  defp to_datetime(%Date{} = value), do: {:ok, DateTime.new!(value, ~T[00:00:00], "Etc/UTC")}

  defp to_datetime(value) when is_integer(value) do
    case DateTime.from_unix(value, :millisecond) do
      {:ok, datetime} -> {:ok, datetime}
      _ -> :error
    end
  end

  defp to_datetime(value) when is_float(value), do: to_datetime(trunc(value))

  defp to_datetime(value) when is_binary(value) do
    text = String.trim(value)

    case DateTime.from_iso8601(text) do
      {:ok, datetime, _offset} ->
        {:ok, datetime}

      {:error, _reason} ->
        case NaiveDateTime.from_iso8601(text) do
          {:ok, naive} ->
            {:ok, DateTime.from_naive!(naive, "Etc/UTC")}

          {:error, _reason} ->
            case Date.from_iso8601(text) do
              {:ok, date} -> {:ok, DateTime.new!(date, ~T[00:00:00], "Etc/UTC")}
              {:error, _reason} -> :error
            end
        end
    end
  end

  defp to_datetime(_), do: :error

  defp parse_date_or_now(value), do: if(truthy(value), do: value, else: :now)

  defp date_sort_value(value) do
    case to_datetime(value) do
      {:ok, datetime} -> DateTime.to_unix(datetime, :millisecond)
      :error -> 0
    end
  end

  defp fast_cache_ms, do: @fifa_live_fast_cache_ms
  defp slow_cache_ms, do: @fifa_live_slow_cache_ms
  defp upstream_timeout_ms, do: @fifa_live_upstream_timeout_ms
  defp news_cache_ms, do: @fifa_live_news_cache_ms
  defp detail_fast_cache_ms, do: @fifa_live_detail_fast_cache_ms
  defp detail_slow_cache_ms, do: @fifa_live_detail_slow_cache_ms

  defp add_ms(_now, :nan), do: :nan
  defp add_ms(now, ttl) when is_number(ttl), do: now + ttl
  defp add_ms(_now, _ttl), do: :nan
  defp js_min(_left, :nan), do: :nan
  defp js_min(:nan, _right), do: :nan
  defp js_min(left, right), do: min(left, right)

  defp cache_valid?(cache, now) do
    expires = g(cache, "expiresAt")
    is_number(expires) and expires > now
  end

  defp normalize_headers(headers) when is_map(headers),
    do: Enum.map(headers, fn {key, value} -> {to_js_string(key), to_js_string(value)} end)

  defp normalize_headers(headers) when is_list(headers),
    do:
      Enum.map(headers, fn
        {key, value} -> {to_js_string(key), to_js_string(value)}
        item -> item
      end)

  defp normalize_headers(_), do: []

  defp response_header(headers, wanted) do
    wanted = String.downcase(wanted)

    case Enum.find(headers, fn {name, _value} -> String.downcase(to_js_string(name)) == wanted end) do
      nil -> ""
      {_name, value} -> to_js_string(value)
    end
  end

  defp timeout_integer(value, fallback) when is_number(value), do: max(0, trunc(value))
  defp timeout_integer(_value, fallback) when is_number(fallback), do: max(0, trunc(fallback))
  defp timeout_integer(_value, _fallback), do: 7_000
  defp integer_or(value, _fallback) when is_integer(value), do: value
  defp integer_or(value, _fallback) when is_float(value), do: trunc(value)
  defp integer_or(_value, fallback), do: fallback

  defp all_settled(functions) do
    functions
    |> Enum.map(fn function ->
      Task.async(fn ->
        try do
          {:fulfilled, function.()}
        rescue
          error -> {:rejected, error}
        catch
          kind, reason -> {:rejected, RuntimeError.exception("#{kind}: #{inspect(reason)}")}
        end
      end)
    end)
    |> Enum.map(&Task.await(&1, :infinity))
  end

  defp normalize_fixture_list(raw, predicate) do
    raw
    |> g("response", [])
    |> sv_fifa_array()
    |> Enum.map(&sv_fifa_normalize_api_football_fixture/1)
    |> Enum.filter(predicate)
  end

  defp uniq_preserving(values) do
    {_seen, result} =
      Enum.reduce(values, {MapSet.new(), []}, fn value, {seen, result} ->
        if MapSet.member?(seen, value),
          do: {seen, result},
          else: {MapSet.put(seen, value), result ++ [value]}
      end)

    result
  end

  defp hd_or_empty([head | _]), do: head
  defp hd_or_empty(_), do: ""

  defp error_message(%{message: message}) when is_binary(message), do: message
  defp error_message({_kind, reason}), do: inspect(reason)
  defp error_message(nil), do: ""
  defp error_message(value) when is_binary(value), do: value
  defp error_message(value), do: inspect(value)

  defp no_cache_headers(conn) do
    conn
    |> Plug.Conn.put_resp_header("cache-control", "no-store, max-age=0, must-revalidate")
    |> Plug.Conn.put_resp_header("pragma", "no-cache")
  end
end

defmodule StreamVault.Live do
  @moduledoc false
  use GenServer

  alias StreamVault.{Command, Files, JS, Paths, Response, State}

  @sv_live_debug System.get_env("SV_LIVE_DEBUG") == "1"
  @sv_live_playlist_max_bytes 1024 * 1024
  @sv_live_media_segment_window max(5, StreamVault.Env.number("SV_LIVE_MEDIA_SEGMENT_WINDOW", 6))
  @sv_live_fast_media_segment_window max(
                                       2,
                                       StreamVault.Env.number(
                                         "SV_LIVE_FAST_MEDIA_SEGMENT_WINDOW",
                                         3
                                       )
                                     )
  @sv_live_playlist_timeout_ms max(
                                 2500,
                                 StreamVault.Env.number("SV_LIVE_PLAYLIST_TIMEOUT_MS", 7000)
                               )
  @sv_live_fast_playlist_timeout_ms max(
                                      2000,
                                      StreamVault.Env.number(
                                        "SV_LIVE_FAST_PLAYLIST_TIMEOUT_MS",
                                        4500
                                      )
                                    )
  @sv_live_segment_cache_ttl_ms max(
                                  15_000,
                                  StreamVault.Env.number("SV_LIVE_SEGMENT_CACHE_TTL_MS", 60_000)
                                )
  @sv_live_segment_cache_max_per_channel max(
                                           4,
                                           StreamVault.Env.number(
                                             "SV_LIVE_SEGMENT_CACHE_MAX_PER_CHANNEL",
                                             10
                                           )
                                         )
  @sv_live_segment_cache_max_bytes max(
                                     32 * 1024 * 1024,
                                     StreamVault.Env.number(
                                       "SV_LIVE_SEGMENT_CACHE_MAX_BYTES",
                                       192 * 1024 * 1024
                                     )
                                   )
  @sv_live_segment_cache_max_segment_bytes max(
                                             1024 * 1024,
                                             StreamVault.Env.number(
                                               "SV_LIVE_SEGMENT_CACHE_MAX_SEGMENT_BYTES",
                                               20 * 1024 * 1024
                                             )
                                           )
  @sv_live_segment_advance_retries max(
                                     0,
                                     StreamVault.Env.number("SV_LIVE_SEGMENT_ADVANCE_RETRIES", 5)
                                   )
  @sv_live_relay_idle_ms max(
                           5 * 60 * 1000,
                           StreamVault.Env.number("SV_LIVE_RELAY_IDLE_MS", 10 * 60 * 1000)
                         )
  @sv_live_relay_stale_ms max(15_000, StreamVault.Env.number("SV_LIVE_RELAY_STALE_MS", 30_000))
  @sv_live_relay_startup_ms max(
                              10_000,
                              StreamVault.Env.number("SV_LIVE_RELAY_STARTUP_MS", 25_000)
                            )
  @sv_live_relay_segment_wait_ms max(
                                   500,
                                   StreamVault.Env.number("SV_LIVE_RELAY_SEGMENT_WAIT_MS", 2500)
                                 )

  @mobile_hls_idle_ms StreamVault.Env.number("MOBILE_HLS_IDLE_MS", 900_000)
  @mobile_hls_max_sessions StreamVault.Env.number("MOBILE_HLS_MAX_SESSIONS", 6)
  @mobile_hls_ffmpeg_threads StreamVault.Env.string("MOBILE_HLS_FFMPEG_THREADS", "1")
  @mobile_hls_profile StreamVault.Env.string("MOBILE_HLS_PROFILE", "mobile-hls-v4-av-sync")
  @mobile_hls_max_width StreamVault.Env.number("MOBILE_HLS_MAX_WIDTH", 854)
  @mobile_hls_max_fps StreamVault.Env.number("MOBILE_HLS_MAX_FPS", 24)
  @mobile_hls_video_maxrate StreamVault.Env.string("MOBILE_HLS_VIDEO_MAXRATE", "1200k")
  @mobile_hls_video_bufsize StreamVault.Env.string("MOBILE_HLS_VIDEO_BUFSIZE", "2400k")
  @mobile_hls_audio_bitrate StreamVault.Env.string("MOBILE_HLS_AUDIO_BITRATE", "96k")

  @heavy_compat_hls_profile StreamVault.Env.string(
                              "HEAVY_COMPAT_HLS_PROFILE",
                              "heavy-compat-hls-v2-av-sync"
                            )
  @heavy_compat_hls_idle_ms StreamVault.Env.number("HEAVY_COMPAT_HLS_IDLE_MS", 30 * 60 * 1000)
  @heavy_compat_hls_max_sessions StreamVault.Env.number("HEAVY_COMPAT_HLS_MAX_SESSIONS", 4)
  @heavy_compat_hls_startup_segments 1
  @heavy_compat_hls_startup_ms StreamVault.Env.number("HEAVY_COMPAT_HLS_STARTUP_MS", 45_000)
  @heavy_compat_hls_segment_time 2
  @heavy_compat_hls_video_crf StreamVault.Env.string("HEAVY_COMPAT_HLS_VIDEO_CRF", "23")
  @heavy_compat_hls_video_maxrate StreamVault.Env.string(
                                    "HEAVY_COMPAT_HLS_VIDEO_MAXRATE",
                                    "2500k"
                                  )
  @heavy_compat_hls_video_bufsize StreamVault.Env.string(
                                    "HEAVY_COMPAT_HLS_VIDEO_BUFSIZE",
                                    "5000k"
                                  )
  @heavy_compat_hls_audio_bitrate StreamVault.Env.string("HEAVY_COMPAT_HLS_AUDIO_BITRATE", "128k")
  @compat_video_pts_filter "setpts=PTS-STARTPTS"
  @compat_audio_pts_filter "asetpts=PTS-STARTPTS,aresample=async=1"
  @media_ffmpeg_stream_max StreamVault.Env.number("MEDIA_FFMPEG_STREAM_MAX", 5)
  @media_ffmpeg_startup_ms StreamVault.Env.number("MEDIA_FFMPEG_STARTUP_MS", 15_000)
  @media_audio_offset_threshold_sec StreamVault.Env.number(
                                      "MEDIA_AUDIO_OFFSET_THRESHOLD_SEC",
                                      0.05
                                    )
  @media_packet_probe_window_sec StreamVault.Env.number("MEDIA_PACKET_PROBE_WINDOW_SEC", 20)
  @media_packet_probe_timeout_ms StreamVault.Env.number("MEDIA_PACKET_PROBE_TIMEOUT_MS", 12_000)
  @media_packet_sync_background System.get_env("MEDIA_PACKET_SYNC_BACKGROUND") != "0"
  @compat_stream_seek_preroll_sec min(
                                    8,
                                    max(
                                      0,
                                      StreamVault.Env.number("COMPAT_STREAM_SEEK_PREROLL_SEC", 4)
                                    )
                                  )
  @sv_playback_verbose System.get_env("SV_PLAYBACK_VERBOSE") == "1"

  def start_link(_options \\ []), do: GenServer.start_link(__MODULE__, %{}, name: __MODULE__)

  @impl true
  def init(state) do
    State.put(:sv_live_segment_cache, %{})
    State.put(:sv_live_segment_cache_bytes, 0)
    State.put(:sv_live_segment_inflight, %{})
    State.put(:sv_live_relay_sessions, %{})
    State.put(:sv_live_relay_retired_dirs, %{})
    State.put(:mobile_hls_sessions, %{})
    State.put(:heavy_compat_hls_sessions, %{})
    State.put(:media_packet_sync_cache, %{values: %{}, order: []})
    State.put(:media_packet_sync_inflight, %{})
    State.put(:media_packet_sync_scheduled, MapSet.new())
    State.put(:active_media_ffmpeg_streams, 0)
    State.put(:media_ffmpeg_release_refs, %{})
    # JavaScript source: server.js:5509 setInterval(live relay cleanup, 30000).unref?.()
    schedule(:relay_cleanup, 30_000)

    # JavaScript source: server.js:5634 setInterval(mobile HLS cleanup, Math.min(MOBILE_HLS_IDLE_MS, 30000)).unref?.()
    schedule(:mobile_cleanup, min(trunc(@mobile_hls_idle_ms), 30_000))

    # JavaScript source: server.js:5801 setInterval(heavy HLS cleanup, Math.min(HEAVY_COMPAT_HLS_IDLE_MS, 60000)).unref?.()
    schedule(:heavy_cleanup, min(trunc(@heavy_compat_hls_idle_ms), 60_000))
    {:ok, state}
  end

  @impl true
  def handle_info(:relay_cleanup, state) do
    cleanup_live_relay_sessions()
    schedule(:relay_cleanup, 30_000)
    {:noreply, state}
  end

  def handle_info(:mobile_cleanup, state) do
    cleanup_mobile_hls_sessions()
    schedule(:mobile_cleanup, min(trunc(@mobile_hls_idle_ms), 30_000))
    {:noreply, state}
  end

  def handle_info(:heavy_cleanup, state) do
    cleanup_heavy_compat_hls_sessions()
    schedule(:heavy_cleanup, min(trunc(@heavy_compat_hls_idle_ms), 60_000))
    {:noreply, state}
  end

  def handle_info({:packet_sync_background, cache_key, options}, state) do
    Task.start(fn ->
      try do
        _ = measure_playback_packet_sync(options)
      after
        State.update(:media_packet_sync_scheduled, MapSet.new(), &MapSet.delete(&1, cache_key))
      end
    end)

    {:noreply, state}
  end

  def handle_info({:restart_relay, channel_id, generation, candidate_index}, state) do
    current = relay_session(channel_id)

    if current && mget(current, :generation) == generation &&
         !process_alive?(mget(current, :process)) do
      sv_start_live_relay(channel_id, "dead relay", candidate_index)
    end

    {:noreply, state}
  end

  @impl true
  def handle_cast({:relay_closed, channel_id, worker, code, stderr_tail}, state) do
    current = relay_session(channel_id)

    if current && mget(current, :process) == worker do
      current = Map.put(current, :process, nil)
      put_relay_session(channel_id, current)

      sv_live_relay_log(channel_id, "FFmpeg exited", %{
        code: code,
        stderr: stderr_tail |> String.trim() |> tail_bytes(500)
      })

      if JS.date_now() - mget(current, :last_access, 0) < @sv_live_relay_idle_ms do
        timer =
          Process.send_after(
            __MODULE__,
            {:restart_relay, channel_id, mget(current, :generation),
             mget(current, :candidate_index, 0) + 1},
            1200
          )

        put_relay_session(channel_id, Map.put(current, :restart_timer, timer))
      end
    end

    {:noreply, state}
  end

  def handle_cast({:relay_error, channel_id, worker, message}, state) do
    current = relay_session(channel_id)

    if current && mget(current, :process) == worker,
      do: sv_live_relay_log(channel_id, "FFmpeg error", %{error: message})

    {:noreply, state}
  end

  def handle_cast({:mobile_output, _session_id, text}, state) do
    IO.puts("[Mobile HLS FFmpeg] #{String.trim(text)}")
    {:noreply, state}
  end

  def handle_cast({:mobile_error, session_id, worker, message}, state) do
    update_named_session(:mobile_hls_sessions, session_id, fn session ->
      if mget(session, :process) == worker, do: Map.put(session, :error, message), else: session
    end)

    IO.puts(:stderr, "[Mobile HLS] spawn error: #{message}")
    {:noreply, state}
  end

  def handle_cast({:mobile_closed, session_id, worker, code}, state) do
    IO.puts("[Mobile HLS] ended #{session_id} code=#{code}")

    State.update(:mobile_hls_sessions, %{}, fn sessions ->
      case Map.get(sessions, session_id) do
        nil ->
          sessions

        session ->
          if mget(session, :process) == worker do
            if mget(session, :error),
              do: Map.put(sessions, session_id, Map.put(session, :ended, true)),
              else: Map.delete(sessions, session_id)
          else
            sessions
          end
      end
    end)

    {:noreply, state}
  end

  def handle_cast({:heavy_output, _key, text}, state) do
    IO.puts("[Heavy Compat HLS FFmpeg] #{String.trim(text)}")
    {:noreply, state}
  end

  def handle_cast({:heavy_error, key, worker, message}, state) do
    update_named_session(:heavy_compat_hls_sessions, key, fn session ->
      if mget(session, :process) == worker, do: Map.put(session, :error, message), else: session
    end)

    IO.puts(:stderr, "[Heavy Compat HLS] spawn error: #{message}")
    {:noreply, state}
  end

  def handle_cast({:heavy_closed, key, worker, code}, state) do
    IO.puts("[Heavy Compat HLS] ended #{key} code=#{code}")

    State.update(:heavy_compat_hls_sessions, %{}, fn sessions ->
      case Map.get(sessions, key) do
        nil ->
          sessions

        session ->
          cond do
            mget(session, :process) != worker ->
              sessions

            mget(session, :stopping, false) ->
              sessions

            code == 0 ->
              Map.put(
                sessions,
                key,
                session |> Map.put(:ended, true) |> Map.put(:last_access, JS.date_now())
              )

            true ->
              Map.delete(sessions, key)
          end
      end
    end)

    {:noreply, state}
  end

  # JavaScript source: svLiveDebugLog(message, data = {})
  def sv_live_debug_log(message, data \\ %{}) do
    if @sv_live_debug, do: IO.puts("[Live Debug] #{message} #{inspect(data)}")
    :ok
  end

  # JavaScript source: svLiveHeaders(sourceUrl)
  def sv_live_headers(source_url) do
    origin =
      case URI.new(source_url) do
        {:ok, %URI{scheme: scheme, host: host} = uri}
        when scheme in ["http", "https"] and is_binary(host) ->
          port = if uri.port && uri.port != URI.default_port(scheme), do: ":#{uri.port}", else: ""
          "#{scheme}://#{host}#{port}"

        _ ->
          ""
      end

    base = [{"user-agent", "Mozilla/5.0 StreamVault-LiveTV/1.0"}, {"accept", "*/*"}]
    if origin == "", do: base, else: base ++ [{"referer", origin <> "/"}, {"origin", origin}]
  end

  # JavaScript source: svLiveSegmentContentType(sourceUrl, upstreamType)
  def sv_live_segment_content_type(source_url, upstream_type) do
    type = upstream_type |> js_string_or_empty() |> String.trim()

    cond do
      Regex.match?(~r/\.m4s(?:$|[?#])/i, source_url) ->
        if(type == "", do: "video/iso.segment", else: type)

      Regex.match?(~r/\.ts(?:$|[?#])/i, source_url) ->
        "video/MP2T"

      true ->
        if(type == "", do: "video/MP2T", else: type)
    end
  end

  # JavaScript source: svLiveSetSegmentHeaders(res, meta = {}, cacheState = 'MISS')
  def sv_live_set_segment_headers(conn, meta \\ %{}, cache_state \\ "MISS") do
    status = mget(meta, :status, 200) || 200

    headers = [
      {"content-type", mget(meta, :content_type, "video/MP2T") || "video/MP2T"},
      {"access-control-allow-origin", "*"},
      {"access-control-expose-headers",
       "Content-Range, Accept-Ranges, Content-Length, Content-Type, X-SV-Upstream-Status, X-SV-Upstream-Ms, X-SV-Live-Cache"},
      {"cache-control", "public, max-age=6"},
      {"x-accel-buffering", "no"},
      {"x-sv-live-cache", cache_state},
      {"x-sv-upstream-status", to_string(mget(meta, :upstream_status, status) || status)},
      {"x-sv-upstream-ms", to_string(nil_to_zero(mget(meta, :upstream_ms, 0)))}
    ]

    headers = optional_header(headers, "accept-ranges", mget(meta, :accept_ranges))
    headers = optional_header(headers, "content-length", mget(meta, :content_length))
    headers = optional_header(headers, "content-range", mget(meta, :content_range))
    conn |> Plug.Conn.put_status(trunc(status)) |> Response.put_headers(headers)
  end

  # JavaScript source: svLivePruneSegmentCache()
  def sv_live_prune_segment_cache do
    now = JS.date_now()

    State.transaction(fn state ->
      cache = Map.get(state, :sv_live_segment_cache, %{})
      bytes = Map.get(state, :sv_live_segment_cache_bytes, 0)

      {cache, bytes} =
        Enum.reduce(cache, {cache, bytes}, fn {key, entry}, {acc, total} ->
          if now - mget(entry, :created_at, 0) > @sv_live_segment_cache_ttl_ms do
            {Map.delete(acc, key), total - nil_to_zero(mget(entry, :bytes, 0))}
          else
            {acc, total}
          end
        end)

      {cache, bytes} =
        cache
        |> Enum.group_by(fn {_key, entry} -> mget(entry, :channel_id) end)
        |> Enum.reduce({cache, bytes}, fn {_channel, entries}, {acc, total} ->
          entries
          |> Enum.sort_by(fn {_key, entry} -> -nil_to_zero(mget(entry, :created_at, 0)) end)
          |> Enum.drop(trunc(@sv_live_segment_cache_max_per_channel))
          |> Enum.reduce({acc, total}, fn {key, entry}, {cache_acc, bytes_acc} ->
            if Map.has_key?(cache_acc, key),
              do: {Map.delete(cache_acc, key), bytes_acc - nil_to_zero(mget(entry, :bytes, 0))},
              else: {cache_acc, bytes_acc}
          end)
        end)

      {cache, bytes} =
        if bytes > @sv_live_segment_cache_max_bytes do
          cache
          |> Enum.sort_by(fn {_key, entry} ->
            nil_to_zero(mget(entry, :last_access) || mget(entry, :created_at, 0))
          end)
          |> Enum.reduce_while({cache, bytes}, fn {key, entry}, {acc, total} ->
            if total <= @sv_live_segment_cache_max_bytes do
              {:halt, {acc, total}}
            else
              {:cont, {Map.delete(acc, key), total - nil_to_zero(mget(entry, :bytes, 0))}}
            end
          end)
        else
          {cache, bytes}
        end

      next =
        state
        |> Map.put(:sv_live_segment_cache, cache)
        |> Map.put(:sv_live_segment_cache_bytes, max(0, bytes))

      {:ok, next}
    end)

    :ok
  end

  # JavaScript source: svLiveStoreSegment(channelId, sourceUrl, meta, body)
  def sv_live_store_segment(channel_id, source_url, meta, body) do
    status = mget(meta, :status, 200) || 200

    if is_binary(body) and byte_size(body) > 0 and
         byte_size(body) <= @sv_live_segment_cache_max_segment_bytes and status >= 200 and
         status < 300 do
      now = JS.date_now()

      State.transaction(fn state ->
        cache = Map.get(state, :sv_live_segment_cache, %{})
        bytes = Map.get(state, :sv_live_segment_cache_bytes, 0)
        previous = Map.get(cache, source_url)
        bytes = bytes - if(previous, do: nil_to_zero(mget(previous, :bytes, 0)), else: 0)

        entry = %{
          channel_id: channel_id,
          source_url: source_url,
          body: body,
          bytes: byte_size(body),
          created_at: now,
          last_access: now,
          meta:
            meta
            |> Map.put(:content_length, Integer.to_string(byte_size(body)))
            |> Map.put(:upstream_ms, mget(meta, :upstream_ms, 0) || 0)
        }

        next =
          state
          |> Map.put(:sv_live_segment_cache, Map.put(cache, source_url, entry))
          |> Map.put(:sv_live_segment_cache_bytes, bytes + byte_size(body))

        {:ok, next}
      end)

      sv_live_prune_segment_cache()
    end

    :ok
  end

  # JavaScript source: svLiveServeCachedSegment(sourceUrl, res)
  def sv_live_serve_cached_segment(source_url, conn) do
    now = JS.date_now()

    State.transaction(fn state ->
      cache = Map.get(state, :sv_live_segment_cache, %{})

      case Map.get(cache, source_url) do
        nil ->
          {{false, conn}, state}

        entry ->
          if now - mget(entry, :created_at, 0) > @sv_live_segment_cache_ttl_ms do
            next =
              state
              |> Map.put(:sv_live_segment_cache, Map.delete(cache, source_url))
              |> Map.update(
                :sv_live_segment_cache_bytes,
                0,
                &(&1 - nil_to_zero(mget(entry, :bytes, 0)))
              )

            {{false, conn}, next}
          else
            updated = Map.put(entry, :last_access, now)
            next = Map.put(state, :sv_live_segment_cache, Map.put(cache, source_url, updated))
            {{true, entry}, next}
          end
      end
    end)
    |> case do
      {false, conn} ->
        {false, conn}

      {true, entry} ->
        conn = sv_live_set_segment_headers(conn, mget(entry, :meta, %{}), "HIT")
        {true, Plug.Conn.send_resp(conn, conn.status || 200, mget(entry, :body, ""))}
    end
  end

  # JavaScript source: svLiveInflightAddClient(inflight, res, cacheState = 'DEDUP')
  def sv_live_inflight_add_client(inflight, client_pid, _cache_state \\ "DEDUP") do
    Map.update(inflight, :clients, MapSet.new([client_pid]), &MapSet.put(&1, client_pid))
  end

  # JavaScript source: svAssertHttpUrl(raw)
  def sv_assert_http_url(raw) do
    value = raw |> js_string_or_empty() |> String.trim()

    case URI.new(value) do
      {:ok, %URI{scheme: scheme, host: host} = uri}
      when scheme in ["http", "https"] and is_binary(host) and host != "" ->
        uri = if is_nil(uri.path) or uri.path == "", do: %{uri | path: "/"}, else: uri
        URI.to_string(uri)

      _ ->
        raise ArgumentError, "Unsupported live URL"
    end
  end

  # JavaScript source: svResolveUrl(base, relative)
  def sv_resolve_url(base, relative) do
    relative = relative |> js_string_or_empty() |> String.trim()
    base |> URI.merge(relative) |> URI.to_string()
  rescue
    _ -> raise ArgumentError, "Invalid URL"
  end

  # JavaScript source: svLiveProxyPath(channelId, upstreamUrl, options = {})
  def sv_live_proxy_path(channel_id, upstream_url, options \\ %{}) do
    if Regex.match?(~r/\.m3u8(?:$|[?#])/i, upstream_url) do
      "/live/#{JS.encode_component(channel_id)}/playlist.m3u8?src=#{JS.encode_component(upstream_url)}" <>
        if(mget(options, :fast, false), do: "&fast=1", else: "")
    else
      "/live/#{JS.encode_component(channel_id)}/segment?url=#{JS.encode_component(upstream_url)}"
    end
  end

  # JavaScript source: svRewriteLiveUri(channelId, baseUrl, uri, options = {})
  def sv_rewrite_live_uri(channel_id, base_url, uri, options \\ %{}) do
    sv_live_proxy_path(channel_id, sv_resolve_url(base_url, uri), options)
  end

  # JavaScript source: svFetchBuffer(url, options = {})
  def sv_fetch_buffer(url, options \\ %{}) do
    source_url = sv_assert_http_url(url)
    started_at = JS.date_now()

    timeout_ms =
      max(1500, js_number_or(mget(options, :timeout_ms) || mget(options, :timeoutMs), 15_000))
      |> trunc()

    request = Finch.build(:get, source_url, sv_live_headers(source_url))

    reducer = fn
      {:status, status}, acc ->
        {:cont, %{acc | status: status}}

      {:headers, headers}, acc ->
        {:cont, %{acc | headers: normalize_response_headers(headers)}}

      {:data, data}, acc ->
        total = acc.total + byte_size(data)

        if total > @sv_live_playlist_max_bytes,
          do: {:halt, %{acc | error: :playlist_too_large}},
          else: {:cont, %{acc | chunks: [data | acc.chunks], total: total}}
    end

    case Finch.stream_while(
           request,
           StreamVault.Finch,
           %{status: nil, headers: %{}, chunks: [], total: 0, error: nil},
           reducer,
           pool_timeout: timeout_ms,
           receive_timeout: timeout_ms
         ) do
      {:ok, %{error: :playlist_too_large}} ->
        raise "Playlist too large"

      {:ok, result} ->
        %{
          status: result.status,
          headers: result.headers,
          body: result.chunks |> Enum.reverse() |> IO.iodata_to_binary(),
          final_url: source_url,
          elapsed_ms: JS.date_now() - started_at
        }

      {:error, %Mint.TransportError{reason: :timeout}} ->
        raise "Timeout"

      {:error, reason} ->
        raise format_error(reason)
    end
  end

  # JavaScript source: rewriteM3u8(content, channelId, sourceBaseUrl, options = {})
  def rewrite_m3u8(content, channel_id, source_base_url, options \\ %{}) do
    content
    |> js_string_or_empty()
    |> String.replace("\r\n", "\n")
    |> String.split("\n", trim: false)
    |> Enum.map(fn line ->
      trimmed = String.trim(line)

      cond do
        trimmed == "" ->
          line

        String.starts_with?(trimmed, "#") ->
          Regex.replace(~r/\bURI=(?:"([^"]+)"|([^,\s]+))/i, line, fn _whole,
                                                                     quoted_uri,
                                                                     bare_uri ->
            uri = if quoted_uri != "", do: quoted_uri, else: bare_uri
            "URI=\"#{sv_rewrite_live_uri(channel_id, source_base_url, uri, options)}\""
          end)

        true ->
          sv_rewrite_live_uri(channel_id, source_base_url, trimmed, options)
      end
    end)
    |> Enum.join("\n")
  end

  # JavaScript source: svAddFastLiveStart(content)
  def sv_add_fast_live_start(content) do
    lines =
      content
      |> js_string_or_empty()
      |> String.replace("\r\n", "\n")
      |> String.split("\n", trim: false)

    if Enum.any?(lines, &String.contains?(&1, "#EXT-X-START")) or
         Enum.any?(lines, &String.contains?(&1, "#EXT-X-STREAM-INF")) do
      Enum.join(lines, "\n")
    else
      found =
        lines
        |> Enum.with_index()
        |> Enum.find_value(fn {line, index} ->
          if index > 0 and String.trim(line) != "" and
               !String.starts_with?(String.trim(line), "#"), do: index, else: nil
        end)

      raw = if found, do: found - 1, else: -2
      insert_at = max(1, raw)

      List.insert_at(lines, insert_at, "#EXT-X-START:TIME-OFFSET=-6,PRECISE=NO")
      |> Enum.join("\n")
    end
  end

  # JavaScript source: svLiveSourceCandidates(ch, requestedSource)
  def sv_live_source_candidates(channel, requested_source) do
    values =
      if JS.truthy?(requested_source) do
        [requested_source]
      else
        [
          mget(channel, :url)
          | if(is_list(mget(channel, :fallbackUrls)),
              do: mget(channel, :fallbackUrls),
              else: mget(channel, :fallback_urls, [])
            )
        ]
      end

    values
    |> Enum.map(&(js_string_or_empty(&1) |> String.trim()))
    |> Enum.reject(&(&1 == ""))
    |> Enum.uniq()
  end

  # JavaScript source: svTrimLiveMediaPlaylist(content, maxSegments = SV_LIVE_MEDIA_SEGMENT_WINDOW)
  def sv_trim_live_media_playlist(content, max_segments \\ @sv_live_media_segment_window) do
    lines =
      content
      |> js_string_or_empty()
      |> String.replace("\r\n", "\n")
      |> String.split("\n", trim: false)

    if Enum.any?(lines, &String.contains?(&1, "#EXT-X-STREAM-INF")) or
         Enum.any?(lines, &Regex.match?(~r/^#EXT-X-(KEY|MAP)\b/i, String.trim(&1))) do
      Enum.join(lines, "\n")
    else
      {prefix, suffix, segments, pending, _saw} =
        Enum.reduce(lines, {[], [], [], [], false}, fn line,
                                                       {prefix, suffix, segments, pending,
                                                        saw_segment} ->
          trimmed = String.trim(line)

          cond do
            trimmed == "" ->
              {prefix, suffix, segments, pending, saw_segment}

            String.starts_with?(trimmed, "#") and
                Regex.match?(
                  ~r/^#EXT(?:INF|-X-PROGRAM-DATE-TIME|-X-BYTERANGE|-X-DISCONTINUITY)/i,
                  trimmed
                ) ->
              {prefix, suffix, segments, pending ++ [line], saw_segment}

            String.starts_with?(trimmed, "#") and saw_segment ->
              {prefix, suffix ++ [line], segments, pending, saw_segment}

            String.starts_with?(trimmed, "#") ->
              {prefix ++ [line], suffix, segments, pending, saw_segment}

            true ->
              {prefix, suffix, segments ++ [pending ++ [line]], [], true}
          end
        end)

      _ = pending
      max_segments = trunc(max_segments)

      if length(segments) <= max_segments do
        Enum.join(lines, "\n")
      else
        dropped = length(segments) - max_segments

        adjusted_prefix =
          Enum.map(prefix, fn line ->
            Regex.replace(~r/^#EXT-X-MEDIA-SEQUENCE:(\d+)/i, line, fn _whole, number ->
              "#EXT-X-MEDIA-SEQUENCE:#{String.to_integer(number) + dropped}"
            end)
          end)

        (adjusted_prefix ++ (segments |> Enum.take(-max_segments) |> List.flatten()) ++ suffix)
        |> Enum.join("\n")
      end
    end
  end

  # JavaScript source: svFetchM3u8Text(url, options = {})
  def sv_fetch_m3u8_text(url, options \\ %{}) do
    result = sv_fetch_buffer(url, options)
    text = result.body

    if result.status < 200 or result.status >= 300,
      do: raise("Upstream playlist HTTP #{result.status}")

    if !String.contains?(text, "#EXTM3U"), do: raise("Upstream is not an M3U8 playlist")

    %{
      status: result.status,
      url: result.final_url || url,
      text: text,
      bytes: byte_size(result.body),
      elapsed_ms: result.elapsed_ms || 0
    }
  end

  # JavaScript source: server.js:5044 GET /live/:channelId/playlist.m3u8 (anonymous async handler)
  def route_live_playlist(conn) do
    conn = Plug.Conn.fetch_query_params(conn)
    channel_id = path_param(conn, "channelId")
    channel = Enum.find(channels(), &(mget(&1, :id) == channel_id))
    requested_source = conn |> query_param("src", "") |> js_string_or_empty() |> String.trim()
    candidates = sv_live_source_candidates(channel, requested_source)
    fast = query_param(conn, "fast") != "0"
    ip = forwarded_ip(conn)

    tracker_stream_start(
      ip,
      channel_id,
      mget(channel, :name, channel_id) || channel_id,
      "live",
      request_header(conn, "user-agent")
    )

    if candidates == [] do
      express_send(conn, "Channel URL missing", 404)
    else
      {fetched, last_error} = fetch_playlist_candidates(candidates, fast, channel_id)

      if is_nil(fetched) do
        error = last_error || "No live playlist candidates worked"
        IO.puts(:stderr, "[Live] Playlist fetch error for #{channel_id}: #{error}")
        express_send(conn, "Cannot reach channel source: #{error}", 502)
      else
        is_master = String.contains?(fetched.text, "#EXT-X-STREAM-INF")

        window =
          if fast, do: @sv_live_fast_media_segment_window, else: @sv_live_media_segment_window

        playlist_text =
          if is_master, do: fetched.text, else: sv_trim_live_media_playlist(fetched.text, window)

        playlist_text =
          if fast and !is_master, do: sv_add_fast_live_start(playlist_text), else: playlist_text

        rewritten = rewrite_m3u8(playlist_text, channel_id, fetched.url, %{fast: fast})

        headers = [
          {"content-type", "application/vnd.apple.mpegurl; charset=utf-8"},
          {"cache-control", "no-store"},
          {"access-control-allow-origin", "*"},
          {"x-sv-live-playlist-type", if(is_master, do: "master", else: "media")},
          {"x-sv-upstream-status", to_string(fetched.status || 0)},
          {"x-sv-upstream-ms", to_string(fetched.elapsed_ms || 0)}
        ]

        headers =
          if is_master,
            do: headers,
            else: headers ++ [{"x-sv-live-segment-window", to_string(window)}]

        sv_live_debug_log("playlist", %{
          channel: channel_id,
          type: if(is_master, do: "master", else: "media"),
          source: fetched.url,
          fetched: fetched.url,
          status: fetched.status,
          ms: fetched.elapsed_ms,
          bytes: fetched.bytes
        })

        conn |> Response.put_headers(headers) |> Plug.Conn.send_resp(200, rewritten)
      end
    end
  end

  # JavaScript source: svLiveAdvanceDatedSegmentUrl(sourceUrl)
  def sv_live_advance_dated_segment_url(source_url) do
    with {:ok, parsed} <- URI.new(source_url),
         path when is_binary(path) <- parsed.path,
         [_, prefix, yyyy, month, day, hour, minute, second, duration_text, extension] <-
           Regex.run(
             ~r/^(.*\/)(\d{4})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d{2})-(\d{5})\.([a-z0-9]+)$/i,
             path
           ),
         {:ok, date} <-
           Date.new(String.to_integer(yyyy), String.to_integer(month), String.to_integer(day)),
         {:ok, time} <-
           Time.new(String.to_integer(hour), String.to_integer(minute), String.to_integer(second)),
         {:ok, datetime} <- DateTime.new(date, time, "Etc/UTC") do
      duration = String.to_integer(duration_text)
      duration_ms = max(1000, round(if(duration == 0, do: 6000, else: duration) / 1000) * 1000)
      next = DateTime.add(datetime, duration_ms, :millisecond)

      next_path =
        prefix <>
          "#{next.year}/#{pad2(next.month)}/#{pad2(next.day)}/#{pad2(next.hour)}/#{pad2(next.minute)}/#{pad2(next.second)}-#{duration_text}.#{extension}"

      URI.to_string(%{parsed | path: next_path})
    else
      _ -> ""
    end
  rescue
    _ -> ""
  end

  # JavaScript source: svStreamLiveSegmentWithRetry(channelId, sourceUrl, res, attempt = 0, redirectsLeft = 5)
  def sv_stream_live_segment_with_retry(
        channel_id,
        source_url,
        conn,
        attempt \\ 0,
        redirects_left \\ 5
      ) do
    sv_live_prune_segment_cache()

    case sv_live_serve_cached_segment(source_url, conn) do
      {true, conn} ->
        conn

      {false, conn} ->
        case claim_live_inflight(channel_id, source_url) do
          {:join, reference, meta, chunks} ->
            consume_live_inflight(
              conn,
              reference,
              meta,
              chunks,
              channel_id,
              source_url,
              attempt,
              redirects_left
            )

          {:owner, reference} ->
            stream_live_inflight_owner(
              conn,
              reference,
              channel_id,
              source_url,
              attempt,
              redirects_left
            )
        end
    end
  end

  # JavaScript source: server.js:5289 GET /live/:channelId/segment (anonymous handler)
  def route_live_segment(conn) do
    conn = Plug.Conn.fetch_query_params(conn)
    channel_id = path_param(conn, "channelId")

    case query_param(conn, "url") do
      nil ->
        express_send(conn, "Missing url param", 400)

      url ->
        try do
          sv_stream_live_segment_with_retry(channel_id, sv_assert_http_url(url), conn, 0)
        rescue
          error in ArgumentError -> express_send(conn, Exception.message(error), 400)
        end
    end
  end

  # JavaScript source: svLiveRelayLog(channelId, message, data = {})
  def sv_live_relay_log(channel_id, message, data \\ %{}) do
    if channel_id == "tsports" or @sv_live_debug do
      IO.puts("[Live Relay:#{channel_id}] #{message} #{inspect(data)}")
    end

    :ok
  end

  # JavaScript source: svLiveRelayChannel(channelId)
  def sv_live_relay_channel(channel_id) do
    if Regex.match?(~r/^[a-z0-9_-]+$/i, js_string_or_empty(channel_id)) do
      Enum.find(channels(), &(mget(&1, :id) == channel_id))
    else
      nil
    end
  end

  # JavaScript source: svLiveRelayRememberDir(channelId, dir)
  def sv_live_relay_remember_dir(channel_id, directory) do
    if JS.truthy?(directory) do
      State.update(:sv_live_relay_retired_dirs, %{}, fn retired_dirs ->
        retired = Map.get(retired_dirs, channel_id, [])

        Map.put(
          retired_dirs,
          channel_id,
          Enum.take(retired ++ [%{dir: directory, expires_at: JS.date_now() + 60_000}], -3)
        )
      end)
    end

    :ok
  end

  # JavaScript source: svLiveRelayPlaylistState(session)
  def sv_live_relay_playlist_state(session) do
    try do
      playlist_path = mget(session, :playlist_path)
      {:ok, stat} = File.stat(playlist_path, time: :posix)
      {:ok, text} = File.read(playlist_path)
      lines = String.split(text, ~r/\r?\n/, trim: false)

      segments =
        lines
        |> Enum.map(&String.trim/1)
        |> Enum.filter(&(&1 != "" and !String.starts_with?(&1, "#")))

      ready_segments =
        Enum.filter(segments, fn file ->
          File.exists?(Path.join(mget(session, :dir), Path.basename(file)))
        end)

      normalized_text =
        lines
        |> Enum.map(fn line ->
          trimmed = String.trim(line)

          if trimmed != "" and !String.starts_with?(trimmed, "#"),
            do: Path.basename(trimmed),
            else: line
        end)
        |> Enum.join("\n")

      %{
        ready: String.contains?(text, "#EXTM3U") and length(ready_segments) >= 1,
        stat: %{mtime_ms: stat.mtime * 1000, raw: stat},
        text: normalized_text,
        segments: length(ready_segments)
      }
    rescue
      _ -> %{ready: false, stat: nil, text: "", segments: 0}
    end
  end

  # JavaScript source: svStopLiveRelay(session, reason)
  def sv_stop_live_relay(session, reason) do
    if session do
      if timer = mget(session, :restart_timer), do: Process.cancel_timer(timer)
      worker = mget(session, :process)
      if process_alive?(worker), do: send(worker, :stop)
      sv_live_relay_log(mget(session, :channel_id), "stopped", %{reason: reason})
    end

    :ok
  end

  # JavaScript source: svStartLiveRelay(channelId, reason = 'start', candidateIndex = 0)
  def sv_start_live_relay(channel_id, reason \\ "start", candidate_index \\ 0) do
    channel = sv_live_relay_channel(channel_id)

    if is_nil(channel) do
      nil
    else
      fallbacks =
        if is_list(mget(channel, :fallbackUrls)),
          do: mget(channel, :fallbackUrls),
          else: mget(channel, :fallback_urls, [])

      candidates =
        [mget(channel, :url) | fallbacks]
        |> Enum.map(&(js_string_or_empty(&1) |> String.trim()))
        |> Enum.reject(&(&1 == ""))
        |> Enum.uniq()

      if candidates == [] do
        nil
      else
        previous = relay_session(channel_id)

        last_access =
          if previous, do: mget(previous, :last_access, JS.date_now()), else: JS.date_now()

        if previous do
          sv_live_relay_remember_dir(channel_id, mget(previous, :dir))
          sv_stop_live_relay(previous, reason)
        end

        File.mkdir_p!(Paths.live_relay())
        generation = "#{JS.date_now()}-#{random_hex(6)}"
        directory = Path.join(Paths.live_relay(), "#{channel_id}-#{generation}")
        File.mkdir_p!(directory)
        playlist_path = Path.join(directory, "index.m3u8")

        selected_index =
          Integer.mod(
            Integer.mod(trunc(candidate_index), length(candidates)) + length(candidates),
            length(candidates)
          )

        source = Enum.at(candidates, selected_index)

        ffmpeg_args = [
          "-hide_banner",
          "-loglevel",
          "warning",
          "-nostdin",
          "-reconnect",
          "1",
          "-reconnect_at_eof",
          "1",
          "-reconnect_streamed",
          "1",
          "-reconnect_delay_max",
          "5",
          "-rw_timeout",
          "15000000",
          "-fflags",
          "+genpts+discardcorrupt",
          "-i",
          source,
          "-map",
          "0:v:0?",
          "-map",
          "0:a:0?",
          "-c",
          "copy",
          "-max_muxing_queue_size",
          "2048",
          "-f",
          "hls",
          "-hls_time",
          "2",
          "-hls_list_size",
          "12",
          "-hls_flags",
          "delete_segments+omit_endlist+independent_segments+temp_file",
          "-hls_segment_filename",
          Path.join(directory, "seg_%09d.ts"),
          playlist_path
        ]

        worker =
          spawn(fn ->
            receive do
              :go -> relay_ffmpeg_worker(channel_id, ffmpeg_args)
            end
          end)

        session = %{
          channel_id: channel_id,
          channel_name: mget(channel, :name, channel_id) || channel_id,
          process: worker,
          generation: generation,
          dir: directory,
          playlist_path: playlist_path,
          source: source,
          candidate_index: selected_index,
          started_at: JS.date_now(),
          last_access: last_access,
          restart_timer: nil,
          stderr_tail: ""
        }

        put_relay_session(channel_id, session)
        send(worker, :go)

        sv_live_relay_log(channel_id, if(reason == "start", do: "start", else: "restart"), %{
          reason: reason,
          source: source,
          pid: inspect(worker)
        })

        session
      end
    end
  end

  # JavaScript source: svEnsureLiveRelay(channelId)
  def sv_ensure_live_relay(channel_id) do
    case relay_session(channel_id) do
      nil ->
        sv_start_live_relay(channel_id, "start", 0)

      session ->
        session = Map.put(session, :last_access, JS.date_now())
        put_relay_session(channel_id, session)
        playlist_state = sv_live_relay_playlist_state(session)
        process_dead = !process_alive?(mget(session, :process))
        stat = mget(playlist_state, :stat)
        stale = stat && JS.date_now() - mget(stat, :mtime_ms, 0) > @sv_live_relay_stale_ms

        startup_stuck =
          is_nil(stat) and
            JS.date_now() - mget(session, :started_at, 0) > @sv_live_relay_startup_ms

        if process_dead or stale or startup_stuck do
          reason =
            if process_dead,
              do: "dead relay",
              else: if(stale, do: "stale playlist", else: "startup stalled")

          sv_start_live_relay(channel_id, reason, mget(session, :candidate_index, 0) + 1)
        else
          session
        end
    end
  end

  # JavaScript source: svWaitForLiveRelayPlaylist(session, timeoutMs = SV_LIVE_RELAY_STARTUP_MS)
  def sv_wait_for_live_relay_playlist(session, timeout_ms \\ @sv_live_relay_startup_ms) do
    wait_for_live_relay_playlist_loop(session, JS.date_now() + trunc(timeout_ms))
  end

  # JavaScript source: svWaitForLiveRelaySegment(channelId, filename)
  def sv_wait_for_live_relay_segment(channel_id, filename) do
    wait_for_live_relay_segment_loop(
      channel_id,
      filename,
      JS.date_now() + trunc(@sv_live_relay_segment_wait_ms)
    )
  end

  # JavaScript source: svHandleLiveRelayPlaylist(req, res)
  def sv_handle_live_relay_playlist(conn) do
    channel_id = path_param(conn, "channelId")
    channel = sv_live_relay_channel(channel_id)

    if is_nil(channel) do
      express_send(conn, "Channel not found", 404)
    else
      tracker_stream_start(
        forwarded_ip(conn),
        channel_id,
        mget(channel, :name, channel_id) || channel_id,
        "live-relay",
        request_header(conn, "user-agent")
      )

      session = sv_ensure_live_relay(channel_id)

      if is_nil(session) do
        express_send(conn, "Channel URL missing", 404)
      else
        session = Map.put(session, :last_access, JS.date_now())
        put_relay_session(channel_id, session)
        state = sv_wait_for_live_relay_playlist(session)

        {session, state} =
          if state do
            {session, state}
          else
            next =
              sv_start_live_relay(
                channel_id,
                "playlist readiness timeout",
                mget(session, :candidate_index, 0) + 1
              )

            {next, if(next, do: sv_wait_for_live_relay_playlist(next), else: nil)}
          end

        _ = session

        if is_nil(state) do
          sv_live_relay_log(channel_id, "playlist unavailable after retry")

          conn
          |> Plug.Conn.put_resp_header("retry-after", "1")
          |> express_send("Live relay is starting", 503)
        else
          conn
          |> Response.put_headers([
            {"content-type", "application/vnd.apple.mpegurl; charset=utf-8"},
            {"cache-control", "no-store"},
            {"access-control-allow-origin", "*"},
            {"x-sv-live-relay-segments", to_string(mget(state, :segments, 0))}
          ])
          |> Plug.Conn.send_resp(200, mget(state, :text, ""))
        end
      end
    end
  end

  # JavaScript source: server.js:5489 GET /live-relay/:channelId/playlist.m3u8 and /live-relay/:channelId/index.m3u8 (svHandleLiveRelayPlaylist)
  def route_live_relay_playlist(conn), do: sv_handle_live_relay_playlist(conn)

  # JavaScript source: server.js:5491 GET /live-relay/:channelId/:segment (anonymous async handler)
  def route_live_relay_segment(conn) do
    channel_id = path_param(conn, "channelId")
    filename = conn |> path_param("segment") |> js_string_or_empty() |> Path.basename()

    cond do
      is_nil(sv_live_relay_channel(channel_id)) ->
        express_send(conn, "Channel not found", 404)

      !Regex.match?(~r/^(?:seg|segment)_\d+\.ts$/i, filename) ->
        express_send(conn, "Invalid relay segment", 400)

      true ->
        if session = relay_session(channel_id),
          do: put_relay_session(channel_id, Map.put(session, :last_access, JS.date_now()))

        file_path = sv_wait_for_live_relay_segment(channel_id, filename)

        if file_path == "" do
          sv_live_relay_log(channel_id, "segment missing after wait", %{filename: filename})
          express_send(conn, "Segment not ready", 404)
        else
          conn
          |> Response.put_headers([
            {"content-type", "video/MP2T"},
            {"cache-control", "public, max-age=6"},
            {"access-control-allow-origin", "*"}
          ])
          |> Plug.Conn.send_file(200, file_path)
        end
    end
  end

  # JavaScript source: server.js:5531 GET /api/live-test/:channelId (anonymous async handler)
  def route_live_test(conn) do
    conn = Plug.Conn.fetch_query_params(conn)
    channel_id = path_param(conn, "channelId")
    channel = Enum.find(channels(), &(mget(&1, :id) == channel_id))
    source_url = query_param(conn, "src") || mget(channel, :url)

    if !JS.truthy?(source_url) do
      Response.json(conn, %{ok: false, error: "Channel missing"}, 404)
    else
      try do
        result = sv_fetch_buffer(source_url)
        text = result.body
        lines = String.split(text, "\n", trim: false)

        Response.json(conn, %{
          ok: true,
          channel: mget(channel, :name, channel_id) || channel_id,
          status: result.status,
          bytes: byte_size(result.body),
          hasM3U: String.contains?(text, "#EXTM3U"),
          mediaLines:
            Enum.count(lines, fn line ->
              String.trim(line) != "" and !String.starts_with?(String.trim(line), "#")
            end),
          keyLines: Enum.count(lines, &String.contains?(&1, "#EXT-X-KEY")),
          mapLines: Enum.count(lines, &String.contains?(&1, "#EXT-X-MAP")),
          preview:
            rewrite_m3u8(text, channel_id, result.final_url || source_url)
            |> String.split("\n", trim: false)
            |> Enum.take(15)
        })
      rescue
        error -> Response.json(conn, %{ok: false, error: Exception.message(error)}, 502)
      end
    end
  end

  # JavaScript source: mobileHlsPresetFromQuality(quality)
  def mobile_hls_preset_from_quality(quality \\ nil) do
    quality = quality |> js_string_or_empty() |> String.downcase()

    if quality in ["720p", "1080p", "high"] do
      %{
        key: "1280-2200k-128k",
        max_width: 1280,
        max_fps: @mobile_hls_max_fps,
        video_maxrate: "2200k",
        video_bufsize: "4400k",
        audio_bitrate: "128k",
        crf: "29"
      }
    else
      %{
        key:
          "#{format_number(@mobile_hls_max_width)}-#{@mobile_hls_video_maxrate}-#{@mobile_hls_audio_bitrate}",
        max_width: @mobile_hls_max_width,
        max_fps: @mobile_hls_max_fps,
        video_maxrate: @mobile_hls_video_maxrate,
        video_bufsize: @mobile_hls_video_bufsize,
        audio_bitrate: @mobile_hls_audio_bitrate,
        crf: "32"
      }
    end
  end

  # JavaScript source: hlsSessionKey(scope, source, startSec, audioKey = '')
  def hls_session_key(scope, source, start_sec, audio_key \\ "") do
    start = js_number_or(start_sec, 0) |> Float.floor() |> trunc()

    :crypto.hash(:sha, "#{@mobile_hls_profile}|#{scope}|#{source}|#{start}|#{audio_key}")
    |> Base.encode16(case: :lower)
    |> binary_part(0, 24)
  end

  # JavaScript source: hlsSessionId(scope, key)
  def hls_session_id(scope, key), do: "#{scope}:#{key}"

  # JavaScript source: touchMobileHlsSession(scope, key)
  def touch_mobile_hls_session(scope, key) do
    session_id = hls_session_id(scope, key)

    State.get_and_update(:mobile_hls_sessions, %{}, fn sessions ->
      case Map.get(sessions, session_id) do
        nil ->
          {nil, sessions}

        session ->
          updated = Map.put(session, :last_access, JS.date_now())
          {updated, Map.put(sessions, session_id, updated)}
      end
    end)
  end

  # JavaScript source: stopMobileHlsSession(scope, key, reason = 'stopped')
  def stop_mobile_hls_session(scope, key, reason \\ "stopped") do
    session_id = hls_session_id(scope, key)

    session =
      State.get_and_update(:mobile_hls_sessions, %{}, fn sessions ->
        case Map.pop(sessions, session_id) do
          {nil, sessions} -> {nil, sessions}
          {session, sessions} -> {Map.put(session, :stopping, true), sessions}
        end
      end)

    if session do
      IO.puts("[Mobile HLS] stop #{session_id} (#{reason})")
      worker = mget(session, :process)
      if process_alive?(worker), do: send(worker, :stop)
      true
    else
      false
    end
  end

  # JavaScript source: cleanupMobileHlsSessions(reason = 'idle')
  def cleanup_mobile_hls_sessions(reason \\ "idle") do
    now = JS.date_now()
    sessions = State.get(:mobile_hls_sessions, %{})

    Enum.each(sessions, fn {session_id, session} ->
      if now - nil_to_zero(mget(session, :last_access) || mget(session, :created_at)) >
           @mobile_hls_idle_ms do
        {scope, key} = split_session_id(session_id)
        stop_mobile_hls_session(scope, key, reason)
      end
    end)

    remaining =
      State.get(:mobile_hls_sessions, %{})
      |> Enum.sort_by(fn {_id, session} ->
        nil_to_zero(mget(session, :last_access) || mget(session, :created_at))
      end)

    excess = max(0, length(remaining) - trunc(@mobile_hls_max_sessions))

    remaining
    |> Enum.take(excess)
    |> Enum.each(fn {session_id, _session} ->
      {scope, key} = split_session_id(session_id)
      stop_mobile_hls_session(scope, key, "session limit")
    end)

    :ok
  end

  # JavaScript source: waitForHlsPlaylist(playlistPath, timeoutMs = 25000, sessionId = '')
  def wait_for_hls_playlist(playlist_path, timeout_ms \\ 25_000, session_id \\ "") do
    wait_for_hls_playlist_loop(playlist_path, trunc(timeout_ms), session_id, JS.date_now())
  end

  # JavaScript source: startMobileHlsSession({ scope, key, input, startSec = 0, audioMap = '0:a:0?', clientId = '', preset = mobileHlsPresetFromQuality(), kghkAudio = false })
  def start_mobile_hls_session(options) do
    scope = mget(options, :scope)
    key = mget(options, :key)
    input = mget(options, :input)
    start_sec = mget(options, :start_sec, mget(options, :startSec, 0)) || 0
    audio_map = mget(options, :audio_map, mget(options, :audioMap, "0:a:0?")) || "0:a:0?"
    client_id = mget(options, :client_id, mget(options, :clientId, "")) || ""
    preset = mget(options, :preset) || mobile_hls_preset_from_quality()
    kghk_audio = mget(options, :kghk_audio, mget(options, :kghkAudio, false)) || false

    File.mkdir_p!(Paths.mobile_hls())
    session_dir = Path.join([Paths.mobile_hls(), to_string(scope), to_string(key)])
    playlist_path = Path.join(session_dir, "index.m3u8")
    session_id = hls_session_id(scope, key)
    existing = State.get(:mobile_hls_sessions, %{}) |> Map.get(session_id)

    if existing && (process_alive?(mget(existing, :process)) or mget(existing, :ended, false)) &&
         File.exists?(playlist_path) do
      update_named_session(
        :mobile_hls_sessions,
        session_id,
        &Map.put(&1, :last_access, JS.date_now())
      )

      playlist_path
    else
      cleanup_mobile_hls_sessions("new session")
      _ = Files.rm_rf_inside(Paths.mobile_hls(), session_dir)
      File.mkdir_p!(session_dir)

      ffmpeg_args = ["-hide_banner", "-loglevel", "warning", "-nostdin"]

      ffmpeg_args =
        if js_number_or(start_sec, 0) > 0,
          do:
            ffmpeg_args ++
              ["-ss", Integer.to_string(js_number_or(start_sec, 0) |> Float.floor() |> trunc())],
          else: ffmpeg_args

      ffmpeg_args =
        if Regex.match?(~r/^https?:\/\//i, input) do
          ffmpeg_args ++
            [
              "-fflags",
              "+genpts",
              "-probesize",
              "1048576",
              "-analyzeduration",
              "1000000",
              "-rw_timeout",
              "15000000"
            ]
        else
          ffmpeg_args
        end

      ffmpeg_args =
        ffmpeg_args ++
          [
            "-i",
            input,
            "-map",
            "0:v:0",
            "-map",
            audio_map,
            "-sn",
            "-dn",
            "-vf",
            "scale=w=min(#{format_number(mget(preset, :max_width))}\\,iw):h=-2,fps=#{format_number(mget(preset, :max_fps))},#{@compat_video_pts_filter}",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-tune",
            "zerolatency",
            "-threads",
            @mobile_hls_ffmpeg_threads,
            "-filter_threads",
            "1",
            "-profile:v",
            "baseline",
            "-level",
            "3.1",
            "-crf",
            to_string(mget(preset, :crf)),
            "-maxrate",
            to_string(mget(preset, :video_maxrate)),
            "-bufsize",
            to_string(mget(preset, :video_bufsize)),
            "-pix_fmt",
            "yuv420p",
            "-g",
            "48",
            "-keyint_min",
            "48",
            "-sc_threshold",
            "0",
            "-c:a",
            "aac",
            "-b:a",
            if(kghk_audio, do: "128k", else: to_string(mget(preset, :audio_bitrate))),
            "-ar",
            "48000",
            "-ac",
            "2",
            "-af",
            @compat_audio_pts_filter,
            "-f",
            "hls",
            "-hls_time",
            "2",
            "-hls_list_size",
            "0",
            "-hls_flags",
            "independent_segments",
            "-hls_segment_filename",
            Path.join(session_dir, "seg_%05d.ts"),
            playlist_path
          ]

      IO.puts("[Mobile HLS] start #{session_id} input=#{input} audioMap=#{audio_map}")

      worker =
        spawn(fn ->
          receive do
            :go -> ffmpeg_worker(:mobile, session_id, ffmpeg_args)
          end
        end)

      now = JS.date_now()

      session = %{
        process: worker,
        dir: session_dir,
        created_at: now,
        last_access: now,
        client_id: client_id,
        error: nil
      }

      State.update(:mobile_hls_sessions, %{}, &Map.put(&1, session_id, session))
      send(worker, :go)
      playlist_path
    end
  end

  # JavaScript source: sendMobileHlsPlaylist(res, scope, key, playlistPath)
  def send_mobile_hls_playlist(conn, scope, key, playlist_path) do
    touch_mobile_hls_session(scope, key)

    try do
      content = wait_for_hls_playlist(playlist_path, 9000, hls_session_id(scope, key))
      touch_mobile_hls_session(scope, key)

      rewritten =
        Regex.replace(~r/^(seg_[^\r\n]+\.ts)$/m, content, "/api/mobile-hls/#{scope}/#{key}/\\1")

      conn
      |> Response.put_headers([
        {"content-type", "application/vnd.apple.mpegurl"},
        {"cache-control", "no-store"},
        {"access-control-allow-origin", "*"}
      ])
      |> Plug.Conn.send_resp(200, rewritten)
    rescue
      error ->
        IO.puts(:stderr, "[Mobile HLS] playlist error: #{Exception.message(error)}")
        express_send(conn, "#EXTM3U\n", 504)
    end
  end

  # JavaScript source: heavyCompatHlsKey(source, startSec, audioKey = '')
  def heavy_compat_hls_key(source, start_sec, audio_key \\ "") do
    start = js_number_or(start_sec, 0) |> Float.floor() |> trunc()

    :crypto.hash(:sha, "#{@heavy_compat_hls_profile}|ftp|#{source}|#{start}|#{audio_key}")
    |> Base.encode16(case: :lower)
    |> binary_part(0, 24)
  end

  # JavaScript source: touchHeavyCompatHlsSession(key)
  def touch_heavy_compat_hls_session(key) do
    State.get_and_update(:heavy_compat_hls_sessions, %{}, fn sessions ->
      case Map.get(sessions, key) do
        nil ->
          {nil, sessions}

        session ->
          updated = Map.put(session, :last_access, JS.date_now())
          {updated, Map.put(sessions, key, updated)}
      end
    end)
  end

  # JavaScript source: stopHeavyCompatHlsSession(key, reason = 'stopped')
  def stop_heavy_compat_hls_session(key, reason \\ "stopped") do
    session =
      State.get_and_update(:heavy_compat_hls_sessions, %{}, fn sessions ->
        case Map.pop(sessions, key) do
          {nil, sessions} -> {nil, sessions}
          {session, sessions} -> {Map.put(session, :stopping, true), sessions}
        end
      end)

    if session do
      IO.puts("[Heavy Compat HLS] stop #{key} (#{reason})")
      worker = mget(session, :process)
      if process_alive?(worker), do: send(worker, :stop)
      true
    else
      false
    end
  end

  # JavaScript source: cleanupHeavyCompatHlsSessions(reason = 'idle')
  def cleanup_heavy_compat_hls_sessions(reason \\ "idle") do
    now = JS.date_now()

    State.get(:heavy_compat_hls_sessions, %{})
    |> Enum.each(fn {key, session} ->
      if now - nil_to_zero(mget(session, :last_access) || mget(session, :created_at)) >
           @heavy_compat_hls_idle_ms do
        stop_heavy_compat_hls_session(key, reason)
      end
    end)

    remaining =
      State.get(:heavy_compat_hls_sessions, %{})
      |> Enum.sort_by(fn {_key, session} ->
        nil_to_zero(mget(session, :last_access) || mget(session, :created_at))
      end)

    excess = max(0, length(remaining) - trunc(@heavy_compat_hls_max_sessions))

    remaining
    |> Enum.take(excess)
    |> Enum.each(fn {key, _} -> stop_heavy_compat_hls_session(key, "session limit") end)

    :ok
  end

  # JavaScript source: heavyCompatPlaylistSegmentCount(content = '')
  def heavy_compat_playlist_segment_count(content \\ "") do
    Regex.scan(~r/^seg_[^\r\n]+\.ts$/m, js_string_or_empty(content)) |> length()
  end

  # JavaScript source: waitForHeavyCompatHlsPlaylist(playlistPath, key, timeoutMs = HEAVY_COMPAT_HLS_STARTUP_MS)
  def wait_for_heavy_compat_hls_playlist(
        playlist_path,
        key,
        timeout_ms \\ @heavy_compat_hls_startup_ms
      ) do
    wait_for_heavy_playlist_loop(playlist_path, key, trunc(timeout_ms), JS.date_now(), "")
  end

  # JavaScript source: startHeavyCompatHlsSession({ key, input, startSec = 0, audioSelection = playbackAudioSelectionFromReq({ query: {} }), kghkAudio = false })
  def start_heavy_compat_hls_session(options) do
    key = mget(options, :key)
    input = mget(options, :input)
    start_sec = mget(options, :start_sec, mget(options, :startSec, 0)) || 0

    audio_selection =
      mget(options, :audio_selection, mget(options, :audioSelection)) ||
        playback_audio_selection(%{})

    kghk_audio = mget(options, :kghk_audio, mget(options, :kghkAudio, false)) || false

    File.mkdir_p!(Paths.heavy_hls())
    session_dir = Path.join(Paths.heavy_hls(), to_string(key))
    playlist_path = Path.join(session_dir, "index.m3u8")
    existing = State.get(:heavy_compat_hls_sessions, %{}) |> Map.get(key)

    cond do
      existing && (process_alive?(mget(existing, :process)) or mget(existing, :ended, false)) ->
        update_named_session(
          :heavy_compat_hls_sessions,
          key,
          &Map.put(&1, :last_access, JS.date_now())
        )

        playlist_path

      completed_heavy_playlist?(playlist_path) ->
        playlist_path

      true ->
        cleanup_heavy_compat_hls_sessions("new heavy session")
        _ = Files.rm_rf_inside(Paths.heavy_hls(), session_dir)
        File.mkdir_p!(session_dir)

        seek_profile = compatibility_seek_profile(input)
        seek_window = compatibility_seek_window(start_sec, seek_profile)

        audio_map =
          mget(audio_selection, :audio_map, mget(audio_selection, :audioMap, "0:a:0?")) ||
            "0:a:0?"

        seek_args =
          if mget(seek_window, :input_start, 0) > 0,
            do: ["-ss", ffmpeg_seconds(mget(seek_window, :input_start))],
            else: []

        trim_args =
          if mget(seek_window, :output_trim, 0) > 0,
            do: ["-ss", ffmpeg_seconds(mget(seek_window, :output_trim))],
            else: []

        ffmpeg_args = ["-hide_banner", "-loglevel", "warning", "-stats_period", "5", "-nostdin"]
        ffmpeg_args = ffmpeg_args ++ seek_args

        ffmpeg_args =
          if Regex.match?(~r/^https?:\/\//i, input) do
            ffmpeg_args ++
              [
                "-fflags",
                "+genpts+nobuffer",
                "-flags",
                "low_delay",
                "-probesize",
                "524288",
                "-analyzeduration",
                "500000",
                "-rw_timeout",
                "15000000"
              ]
          else
            ffmpeg_args
          end

        ffmpeg_args =
          ffmpeg_args ++
            ["-i", input] ++
            trim_args ++
            [
              "-map",
              "0:v:0",
              "-map",
              audio_map,
              "-sn",
              "-dn",
              "-vf",
              @compat_video_pts_filter,
              "-c:v",
              "libx264",
              "-preset",
              "ultrafast",
              "-tune",
              "zerolatency",
              "-crf",
              @heavy_compat_hls_video_crf,
              "-maxrate",
              @heavy_compat_hls_video_maxrate,
              "-bufsize",
              @heavy_compat_hls_video_bufsize,
              "-pix_fmt",
              "yuv420p",
              "-g",
              "48",
              "-keyint_min",
              "48",
              "-sc_threshold",
              "0",
              "-c:a",
              "aac",
              "-b:a",
              if(kghk_audio, do: "128k", else: @heavy_compat_hls_audio_bitrate),
              "-ar",
              "48000",
              "-ac",
              "2",
              "-af",
              @compat_audio_pts_filter,
              "-muxdelay",
              "0",
              "-muxpreload",
              "0",
              "-f",
              "hls",
              "-hls_time",
              to_string(@heavy_compat_hls_segment_time),
              "-hls_list_size",
              "0",
              "-hls_playlist_type",
              "event",
              "-hls_flags",
              "independent_segments",
              "-hls_segment_filename",
              Path.join(session_dir, "seg_%05d.ts"),
              playlist_path
            ]

        title = remote_filename(input)
        audio_idx = mget(audio_selection, :audio_idx, mget(audio_selection, :audioIdx, 0))

        audio_stream =
          mget(audio_selection, :audio_stream_idx, mget(audio_selection, :audioStreamIdx))

        IO.puts(
          "[Heavy Compat HLS Seek] title=\"#{title}\" url=\"#{input}\" requestedStart=#{format_number(mget(seek_window, :exact_start))} " <>
            "inputStart=#{format_number(mget(seek_window, :input_start))} outputTrim=#{format_number(mget(seek_window, :output_trim))} " <>
            "seekArgs=#{Jason.encode!(seek_args ++ trim_args)} audioIdx=#{audio_idx} audioStream=#{audio_stream || "relative"} " <>
            "audioMap=#{audio_map} profile=#{mget(seek_window, :profile)} reason=#{mget(seek_window, :profile_reason)}"
        )

        IO.puts("[Heavy Compat HLS FFmpeg Args] #{Jason.encode!(ffmpeg_args)}")

        worker =
          spawn(fn ->
            receive do
              :go -> ffmpeg_worker(:heavy, key, ffmpeg_args)
            end
          end)

        now = JS.date_now()

        session = %{
          process: worker,
          dir: session_dir,
          playlist_path: playlist_path,
          created_at: now,
          last_access: now,
          start_sec: mget(seek_window, :exact_start),
          input: input,
          audio_map: audio_map,
          error: nil
        }

        State.update(:heavy_compat_hls_sessions, %{}, &Map.put(&1, key, session))
        send(worker, :go)
        playlist_path
    end
  end

  # JavaScript source: sendHeavyCompatHlsPlaylist(res, key, playlistPath)
  def send_heavy_compat_hls_playlist(conn, key, playlist_path) do
    touch_heavy_compat_hls_session(key)

    try do
      content = wait_for_heavy_compat_hls_playlist(playlist_path, key)
      touch_heavy_compat_hls_session(key)

      rewritten =
        Regex.replace(~r/^(seg_[^\r\n]+\.ts)$/m, content, "/api/heavy-compat-hls/ftp/#{key}/\\1")

      conn
      |> Response.put_headers([
        {"content-type", "application/vnd.apple.mpegurl"},
        {"cache-control", "no-store"},
        {"access-control-allow-origin", "*"}
      ])
      |> Plug.Conn.send_resp(200, rewritten)
    rescue
      error ->
        IO.puts(:stderr, "[Heavy Compat HLS] playlist error: #{Exception.message(error)}")
        express_send(conn, "#EXTM3U\n", 504)
    end
  end

  # JavaScript source: server.js:5976 GET /api/heavy-compat-hls/ftp/index.m3u8 (anonymous async handler)
  def route_heavy_compat_hls_ftp(conn) do
    conn = Plug.Conn.fetch_query_params(conn)

    case trusted_remote_playback_media(conn) do
      {:error, status, message} ->
        express_send(conn, message, status)

      {:ok, media, src_url, matched} ->
        traits = remote_compatibility_traits(src_url)

        if !mget(traits, :heavy4kHevc, mget(traits, :heavy_4k_hevc, false)) do
          express_send(conn, "#EXTM3U\n", 400)
        else
          start_sec = playback_start(conn)

          is_kghk =
            is_kghk_title([mget(matched, :title), mget(matched, :name), remote_filename(src_url)])

          audio_result =
            if is_kghk do
              {:ok, resolve_kghk_hls_audio(src_url, remote_filename(src_url))}
            else
              try do
                {:ok, resolve_playback_audio(conn, src_url, remote_filename(src_url))}
              rescue
                error -> {:error, error}
              end
            end

          case audio_result do
            {:error, _error} ->
              express_send(conn, "#EXTM3U\n", 502)

            {:ok, audio_selection} ->
              audio_map =
                mget(audio_selection, :audio_map, mget(audio_selection, :audioMap, "0:a:0?"))

              audio_key =
                "#{audio_map}|#{@heavy_compat_hls_video_crf}|#{@heavy_compat_hls_video_maxrate}|#{@heavy_compat_hls_segment_time}"

              key = heavy_compat_hls_key(src_url, start_sec, audio_key)

              IO.puts(
                "[Heavy Compat HLS] request title=\"#{remote_filename(src_url)}\" matched=#{catalog_log_label(matched)} " <>
                  "requestedUrl=\"#{mget(media, :requested_url, mget(media, :requestedUrl, ""))}\" start=#{format_number(start_sec)} key=#{key}"
              )

              playlist_path =
                start_heavy_compat_hls_session(%{
                  key: key,
                  input: src_url,
                  start_sec: start_sec,
                  audio_selection: audio_selection,
                  kghk_audio: is_kghk
                })

              send_heavy_compat_hls_playlist(conn, key, playlist_path)
          end
        end
    end
  end

  # JavaScript source: server.js:6003 GET /api/mobile-hls/local/:id/index.m3u8 (anonymous async handler)
  def route_mobile_hls_local(conn) do
    conn = Plug.Conn.fetch_query_params(conn)
    index = JS.parse_int(path_param(conn, "id"), 10)
    entry = if is_integer(index) and index >= 0, do: Enum.at(file_index(), index), else: nil

    cond do
      is_nil(entry) ->
        express_send(conn, "Not found", 404)

      !File.exists?(entry_path(entry)) ->
        express_send(conn, "File missing", 404)

      true ->
        file_path = entry_path(entry)
        parsed_start = JS.parse_float(query_param(conn, "start", "undefined"))
        start_sec = if JS.truthy?(parsed_start), do: parsed_start, else: 0
        is_kghk = is_kghk_title([mget(entry, :file)])
        initial_audio = playback_audio_selection(conn.query_params)

        audio_selection =
          if is_kghk do
            resolve_kghk_hls_audio(file_path, mget(entry, :file))
          else
            try do
              resolve_playback_audio(conn, file_path, mget(entry, :file))
            rescue
              error ->
                IO.puts(
                  :stderr,
                  "[Mobile HLS Local] audio selection failed for #{mget(entry, :file)}: #{Exception.message(error)}"
                )

                initial_audio
            end
          end

        audio_map = mget(audio_selection, :audio_map, mget(audio_selection, :audioMap, "0:a:0?"))
        preset = mobile_hls_preset_from_quality(query_param(conn, "quality"))
        key = hls_session_key("local", file_path, start_sec, "#{audio_map}|#{mget(preset, :key)}")
        raw_client = query_param(conn, "client", "") |> js_string_or_empty()

        client_id =
          if Regex.match?(~r/^[a-zA-Z0-9_-]{8,80}$/, raw_client), do: raw_client, else: ""

        audio_idx = mget(audio_selection, :audio_idx, mget(audio_selection, :audioIdx, 0))

        audio_stream =
          mget(audio_selection, :audio_stream_idx, mget(audio_selection, :audioStreamIdx))

        IO.puts(
          "[Mobile HLS Local] #{mget(entry, :file)} audioIdx=#{audio_idx} audioStream=#{audio_stream || "relative"} map=#{audio_map}"
        )

        playlist_path =
          start_mobile_hls_session(%{
            scope: "local",
            key: key,
            input: file_path,
            start_sec: start_sec,
            audio_map: audio_map,
            client_id: client_id,
            preset: preset,
            kghk_audio: is_kghk
          })

        send_mobile_hls_playlist(conn, "local", key, playlist_path)
    end
  end

  # JavaScript source: server.js:6658 GET /api/mobile-hls/ftp/index.m3u8 (anonymous async handler)
  def route_mobile_hls_ftp(conn) do
    conn = Plug.Conn.fetch_query_params(conn)

    case trusted_remote_playback_media(conn) do
      {:error, status, message} ->
        express_send(conn, message, status)

      {:ok, _media, src_url, matched} ->
        parsed_start = JS.parse_float(query_param(conn, "start", "undefined"))
        start_sec = if JS.truthy?(parsed_start), do: parsed_start, else: 0
        label = remote_filename(src_url)
        is_kghk = is_kghk_title([mget(matched, :title), mget(matched, :name), label])
        initial_audio = playback_audio_selection(conn.query_params)

        audio_selection =
          if is_kghk do
            resolve_kghk_hls_audio(src_url, label)
          else
            try do
              resolve_playback_audio(conn, src_url, label)
            rescue
              error ->
                IO.puts(
                  :stderr,
                  "[Mobile HLS FTP] audio selection failed for #{label}: #{Exception.message(error)}"
                )

                initial_audio
            end
          end

        audio_map = mget(audio_selection, :audio_map, mget(audio_selection, :audioMap, "0:a:0?"))
        preset = mobile_hls_preset_from_quality(query_param(conn, "quality"))
        key = hls_session_key("ftp", src_url, start_sec, "#{audio_map}|#{mget(preset, :key)}")
        raw_client = query_param(conn, "client", "") |> js_string_or_empty()

        client_id =
          if Regex.match?(~r/^[a-zA-Z0-9_-]{8,80}$/, raw_client), do: raw_client, else: ""

        audio_idx = mget(audio_selection, :audio_idx, mget(audio_selection, :audioIdx, 0))

        audio_stream =
          mget(audio_selection, :audio_stream_idx, mget(audio_selection, :audioStreamIdx))

        IO.puts(
          "[Mobile HLS FTP] #{label} audioIdx=#{audio_idx} audioStream=#{audio_stream || "relative"} map=#{audio_map}"
        )

        playlist_path =
          start_mobile_hls_session(%{
            scope: "ftp",
            key: key,
            input: src_url,
            start_sec: start_sec,
            audio_map: audio_map,
            client_id: client_id,
            preset: preset,
            kghk_audio: is_kghk
          })

        send_mobile_hls_playlist(conn, "ftp", key, playlist_path)
    end
  end

  # JavaScript source: server.js:6683 GET /api/mobile-hls/:scope/:key/:file (anonymous handler)
  def route_mobile_hls_file(conn, scope, key, file) do
    cond do
      !Regex.match?(~r/^(local|ftp)$/, js_string_or_empty(scope)) ->
        end_response(conn, "", 404)

      !Regex.match?(~r/^[a-f0-9]{24}$/, js_string_or_empty(key)) ->
        end_response(conn, "", 404)

      !Regex.match?(~r/^seg_\d+\.ts$/, js_string_or_empty(file)) ->
        end_response(conn, "", 404)

      true ->
        touch_mobile_hls_session(scope, key)
        file_path = Path.join([Paths.mobile_hls(), scope, key, file])

        cond do
          !contained_path?(Paths.mobile_hls(), file_path) ->
            end_response(conn, "", 404)

          !File.exists?(file_path) ->
            end_response(conn, "", 404)

          true ->
            conn =
              Response.put_headers(conn, [
                {"content-type", "video/MP2T"},
                {"cache-control", "no-store"},
                {"access-control-allow-origin", "*"}
              ])

            try do
              Plug.Conn.send_file(conn, 200, file_path)
            rescue
              error ->
                IO.puts(:stderr, "[Mobile HLS] segment read error: #{Exception.message(error)}")
                if conn.state == :unset, do: end_response(conn, "", 500), else: conn
            end
        end
    end
  end

  # JavaScript source: server.js:6702 GET /api/heavy-compat-hls/ftp/:key/:file (anonymous handler)
  def route_heavy_hls_file(conn, key, file) do
    cond do
      !Regex.match?(~r/^[a-f0-9]{24}$/, js_string_or_empty(key)) ->
        end_response(conn, "", 404)

      !Regex.match?(~r/^seg_\d+\.ts$/, js_string_or_empty(file)) ->
        end_response(conn, "", 404)

      true ->
        touch_heavy_compat_hls_session(key)
        file_path = Path.join([Paths.heavy_hls(), key, file])

        cond do
          !contained_path?(Paths.heavy_hls(), file_path) ->
            end_response(conn, "", 404)

          !File.exists?(file_path) ->
            end_response(conn, "", 404)

          true ->
            conn =
              Response.put_headers(conn, [
                {"content-type", "video/MP2T"},
                {"cache-control", "private, max-age=21600"},
                {"access-control-allow-origin", "*"}
              ])

            try do
              Plug.Conn.send_file(conn, 200, file_path)
            rescue
              error ->
                IO.puts(
                  :stderr,
                  "[Heavy Compat HLS] segment read error: #{Exception.message(error)}"
                )

                if conn.state == :unset, do: end_response(conn, "", 500), else: conn
            end
        end
    end
  end

  # JavaScript source: server.js:6720 POST /api/mobile-hls/stop (anonymous handler)
  def route_mobile_hls_stop(conn) do
    body = if is_map(conn.body_params), do: conn.body_params, else: %{}
    sessions = if is_list(mget(body, :sessions)), do: mget(body, :sessions), else: []
    raw_client = mget(body, :client, "") |> js_string_or_empty()
    client_id = if Regex.match?(~r/^[a-zA-Z0-9_-]{8,80}$/, raw_client), do: raw_client, else: ""

    stopped =
      Enum.reduce(sessions, 0, fn session, count ->
        scope = mget(session, :scope, "") |> js_string_or_empty()
        key = mget(session, :key, "") |> js_string_or_empty()

        if Regex.match?(~r/^(local|ftp)$/, scope) and Regex.match?(~r/^[a-f0-9]{24}$/, key) and
             stop_mobile_hls_session(scope, key, "client closed") do
          count + 1
        else
          count
        end
      end)

    stopped =
      if client_id == "" do
        stopped
      else
        State.get(:mobile_hls_sessions, %{})
        |> Enum.reduce(stopped, fn {session_id, session}, count ->
          if mget(session, :client_id, mget(session, :clientId)) == client_id do
            {scope, key} = split_session_id(session_id)
            if stop_mobile_hls_session(scope, key, "client closed"), do: count + 1, else: count
          else
            count
          end
        end)
      end

    Response.json(conn, %{ok: true, stopped: stopped})
  end

  # JavaScript source: mappedMp4InputArgs(remote)
  def mapped_mp4_input_args(remote) do
    if JS.truthy?(remote),
      do: ["-probesize", "10485760", "-analyzeduration", "10000000", "-rw_timeout", "15000000"],
      else: []
  end

  # JavaScript source: ffmpegSeconds(value)
  def ffmpeg_seconds(value) do
    case JS.number(value) do
      number when is_number(number) -> (number * 1.0) |> Float.round(6) |> format_number()
      _ -> "0"
    end
  end

  # JavaScript source: compatibilitySeekProfileForSource(srcUrl, { compatibilityTranscode = true, mobilePlayback = false } = {})
  def compatibility_seek_profile_for_source(src_url, options \\ %{}) do
    compatibility_transcode =
      mget(options, :compatibility_transcode, mget(options, :compatibilityTranscode, true))

    mobile_playback = mget(options, :mobile_playback, mget(options, :mobilePlayback, false))

    if compatibility_transcode == false do
      %{
        name: "copy-exact",
        reason: "video-copy",
        preroll_sec: 0,
        traits: remote_compatibility_traits(src_url)
      }
    else
      traits = remote_compatibility_traits(src_url)

      if !JS.truthy?(mobile_playback) and
           mget(traits, :heavy4kHevcHdr, mget(traits, :heavy_4k_hevc_hdr, false)) and
           @compat_stream_seek_preroll_sec > 0 do
        %{
          name: "timestamp-preroll",
          reason: "heavy-4k-hevc-hdr",
          preroll_sec: @compat_stream_seek_preroll_sec,
          traits: traits
        }
      else
        %{
          name: "compat-standard",
          reason:
            if(JS.truthy?(mobile_playback), do: "mobile-compat-exact", else: "compat-exact"),
          preroll_sec: 0,
          traits: traits
        }
      end
    end
  end

  # JavaScript source: compatibilitySeekWindow(startSec, profile = compatibilitySeekProfileForSource(''))
  def compatibility_seek_window(start_sec, profile \\ nil) do
    profile = profile || compatibility_seek_profile_for_source("")
    exact_start = max(0, js_number_or(start_sec, 0))

    preroll_sec =
      max(0, js_number_or(mget(profile, :preroll_sec, mget(profile, :prerollSec, 0)), 0))

    if exact_start <= 0 or preroll_sec <= 0 do
      %{
        exact_start: exact_start,
        input_start: exact_start,
        output_trim: 0,
        profile: mget(profile, :name, "compat-standard") || "compat-standard",
        profile_reason: mget(profile, :reason, "exact") || "exact"
      }
    else
      input_start = max(0, exact_start - preroll_sec)

      %{
        exact_start: exact_start,
        input_start: input_start,
        output_trim: max(0, exact_start - input_start),
        profile: mget(profile, :name, "timestamp-preroll") || "timestamp-preroll",
        profile_reason: mget(profile, :reason, "preroll") || "preroll"
      }
    end
  end

  # JavaScript source: mediaPacketSyncCacheKey(input, remote, videoStreamIdx, audioStreamIdx)
  def media_packet_sync_cache_key(input, remote, video_stream_idx, audio_stream_idx) do
    source = js_string_or_empty(input)

    source_key =
      if JS.truthy?(remote) do
        source
      else
        case File.stat(source, time: :posix) do
          {:ok, stat} -> "#{source}:#{stat.size}:#{stat.mtime * 1000}"
          _ -> source
        end
      end

    "#{if(JS.truthy?(remote), do: "remote", else: "local")}|#{source_key}|v#{video_stream_idx}|a#{audio_stream_idx}"
  end

  # JavaScript source: packetPtsSeconds(packet = {})
  def packet_pts_seconds(packet \\ %{}) do
    pts = JS.number(mget(packet, :pts_time, :undefined))

    if is_number(pts) do
      pts
    else
      dts = JS.number(mget(packet, :dts_time, :undefined))
      if is_number(dts), do: dts, else: nil
    end
  end

  # JavaScript source: probeFirstPacketPts({ input, remote = false, videoStreamIdx = 0, audioStreamIdx, startSec = 0 })
  def probe_first_packet_pts(options) do
    input = mget(options, :input)
    remote = mget(options, :remote, false) || false
    video_stream_idx = mget(options, :video_stream_idx, mget(options, :videoStreamIdx, 0))
    audio_stream_idx = mget(options, :audio_stream_idx, mget(options, :audioStreamIdx))
    start_sec = mget(options, :start_sec, mget(options, :startSec, 0)) || 0
    start = max(0, js_number_or(start_sec, 0) |> Float.floor() |> trunc())

    configured_window =
      js_number_or(@media_packet_probe_window_sec, 0) |> Float.floor() |> trunc()

    window_sec = max(4, if(configured_window == 0, do: 20, else: configured_window))

    arguments =
      ["-v", "error"] ++
        mapped_mp4_input_args(remote) ++
        [
          "-read_intervals",
          "#{start}%+#{window_sec}",
          "-show_packets",
          "-show_entries",
          "packet=stream_index,pts_time,dts_time",
          "-of",
          "json",
          input
        ]

    timeout = max(0, trunc(@media_packet_probe_timeout_ms))

    body =
      case Command.collect(Command.executable(:ffprobe), arguments, timeout) do
        {:ok, stdout} -> stdout
        {:error, :timeout} -> raise "packet ffprobe timed out"
        {:error, %{output: stderr}} -> raise "packet ffprobe failed: #{stderr}"
        {:error, error} -> raise format_error(error)
      end

    parsed = Jason.decode!(if(body == "", do: "{}", else: body))
    packets = if is_list(mget(parsed, :packets)), do: mget(parsed, :packets), else: []
    target_video = JS.number(video_stream_idx)
    target_audio = JS.number(audio_stream_idx)

    {video_first_pts, audio_first_pts} =
      Enum.reduce_while(packets, {nil, nil}, fn packet, {video_first, audio_first} ->
        stream_index = JS.number(mget(packet, :stream_index, :undefined))

        if is_number(stream_index) do
          video_first =
            if is_nil(video_first) and stream_index == target_video,
              do: packet_pts_seconds(packet),
              else: video_first

          audio_first =
            if is_nil(audio_first) and stream_index == target_audio,
              do: packet_pts_seconds(packet),
              else: audio_first

          if !is_nil(video_first) and !is_nil(audio_first),
            do: {:halt, {video_first, audio_first}},
            else: {:cont, {video_first, audio_first}}
        else
          {:cont, {video_first, audio_first}}
        end
      end)

    if is_nil(video_first_pts) or is_nil(audio_first_pts) do
      raise "packet pts missing video=#{inspect_js_null(video_first_pts)} audio=#{inspect_js_null(audio_first_pts)}"
    end

    %{video_first_pts: video_first_pts, audio_first_pts: audio_first_pts}
  end

  # JavaScript source: measurePlaybackPacketSync({ input, remote = false, videoStreamIdx = 0, audioStreamIdx = null, startSec = 0, label = 'media', route = 'remux' })
  def measure_playback_packet_sync(options) do
    input = mget(options, :input)
    remote = mget(options, :remote, false) || false
    video_stream_idx = mget(options, :video_stream_idx, mget(options, :videoStreamIdx, 0))
    audio_stream_idx = mget(options, :audio_stream_idx, mget(options, :audioStreamIdx))
    label = mget(options, :label, "media") || "media"
    route = mget(options, :route, "remux") || "remux"
    selected_audio = JS.number(audio_stream_idx)
    selected_video = JS.number(video_stream_idx)

    if !is_number(selected_audio) or selected_audio < 0 do
      packet_sync_empty(false)
    else
      safe_video =
        if is_number(selected_video) and selected_video >= 0, do: selected_video, else: 0

      cache_key = media_packet_sync_cache_key(input, remote, safe_video, selected_audio)

      case packet_sync_cache_get(cache_key) do
        nil ->
          case claim_packet_sync_inflight(cache_key) do
            {:join, reference} ->
              await_packet_sync_result(reference)

            {:owner, reference} ->
              result =
                try do
                  pts =
                    probe_first_packet_pts(%{
                      input: input,
                      remote: remote,
                      video_stream_idx: safe_video,
                      audio_stream_idx: selected_audio,
                      start_sec: 0
                    })

                  calculated_offset =
                    rounded_seconds(mget(pts, :audio_first_pts) - mget(pts, :video_first_pts))

                  correction =
                    if abs(calculated_offset) >= @media_audio_offset_threshold_sec,
                      do: rounded_seconds(-calculated_offset),
                      else: 0

                  measured = %{
                    video_first_pts: rounded_seconds(mget(pts, :video_first_pts)),
                    audio_first_pts: rounded_seconds(mget(pts, :audio_first_pts)),
                    calculated_offset_sec: calculated_offset,
                    correction_applied_sec: correction,
                    measured: true
                  }

                  packet_sync_cache_put(cache_key, measured)

                  if @sv_playback_verbose do
                    IO.puts(
                      "[Media Sync] title=\"#{label}\" route=#{route} videoFirstPts=#{mget(measured, :video_first_pts)} " <>
                        "audioFirstPts=#{mget(measured, :audio_first_pts)} calculatedOffset=#{calculated_offset} correctionApplied=#{correction}"
                    )
                  end

                  measured
                rescue
                  error ->
                    if @sv_playback_verbose,
                      do:
                        IO.puts(
                          :stderr,
                          "[Media Sync] title=\"#{label}\" route=#{route} packet probe failed: #{Exception.message(error)}"
                        )

                    packet_sync_empty(false)
                end

              waiters = finish_packet_sync_inflight(cache_key, reference)
              Enum.each(waiters, &send(&1, {:packet_sync_result, reference, result}))
              result
          end

        cached ->
          cached
      end
    end
  end

  # JavaScript source: cachedPlaybackPacketSync({ input, remote = false, videoStreamIdx = 0, audioStreamIdx = null, audioVideoOffsetSec = 0, label = 'media', route = 'remux' })
  def cached_playback_packet_sync(options) do
    input = mget(options, :input)
    remote = mget(options, :remote, false) || false
    video_stream_idx = mget(options, :video_stream_idx, mget(options, :videoStreamIdx, 0))
    audio_stream_idx = mget(options, :audio_stream_idx, mget(options, :audioStreamIdx))

    audio_video_offset_sec =
      mget(options, :audio_video_offset_sec, mget(options, :audioVideoOffsetSec, 0))

    label = mget(options, :label, "media") || "media"
    route = mget(options, :route, "remux") || "remux"
    selected_audio = JS.number(audio_stream_idx)
    selected_video = JS.number(video_stream_idx)

    if !is_number(selected_audio) or selected_audio < 0 do
      Map.put(packet_sync_empty(false), :source, "none")
    else
      safe_video =
        if is_number(selected_video) and selected_video >= 0, do: selected_video, else: 0

      cache_key = media_packet_sync_cache_key(input, remote, safe_video, selected_audio)

      case packet_sync_cache_get(cache_key) do
        cached when not is_nil(cached) ->
          Map.put(cached, :source, "packet-cache")

        nil ->
          if @media_packet_sync_background do
            schedule_packet_sync_probe(cache_key, %{
              input: input,
              remote: remote,
              video_stream_idx: safe_video,
              audio_stream_idx: selected_audio,
              start_sec: 0,
              label: label,
              route: route
            })
          end

          metadata_offset = JS.number(audio_video_offset_sec)

          metadata_correction =
            if is_number(metadata_offset) and
                 abs(metadata_offset) >= @media_audio_offset_threshold_sec,
               do: rounded_seconds(-metadata_offset),
               else: 0

          %{
            video_first_pts: nil,
            audio_first_pts: nil,
            calculated_offset_sec:
              if(is_number(metadata_offset), do: rounded_seconds(metadata_offset), else: 0),
            correction_applied_sec: metadata_correction,
            measured: false,
            source: if(JS.truthy?(metadata_correction), do: "metadata-cache", else: "none")
          }
      end
    end
  end

  # JavaScript source: ffmpegMp4Args({ input, mode = 'remux', startSec = 0, audioMap = '0:a:0?', audioStreamIdx = null, audioVideoOffsetSec = 0, audioCorrectionSec = 0, remote = false, hevcTag = false, normalizeTimestamps = true })
  def ffmpeg_mp4_args(options) do
    input = mget(options, :input)
    mode = mget(options, :mode, "remux") || "remux"
    start_sec = mget(options, :start_sec, mget(options, :startSec, 0)) || 0
    audio_map = mget(options, :audio_map, mget(options, :audioMap, "0:a:0?")) || "0:a:0?"
    audio_stream_idx = mget(options, :audio_stream_idx, mget(options, :audioStreamIdx))

    audio_correction_sec =
      mget(options, :audio_correction_sec, mget(options, :audioCorrectionSec, 0)) || 0

    remote = mget(options, :remote, false) || false
    hevc_tag = mget(options, :hevc_tag, mget(options, :hevcTag, false)) || false

    normalize_timestamps =
      mget(options, :normalize_timestamps, mget(options, :normalizeTimestamps, true))

    args = ["-hide_banner", "-loglevel", "warning", "-nostdin"]

    args =
      if js_number_or(start_sec, 0) > 0,
        do:
          args ++
            ["-ss", Integer.to_string(js_number_or(start_sec, 0) |> Float.floor() |> trunc())],
        else: args

    args = args ++ ["-fflags", "+genpts"] ++ mapped_mp4_input_args(remote) ++ ["-i", input]
    selected_audio_stream_idx = JS.number(audio_stream_idx)

    selected_audio_correction_sec =
      if normalize_timestamps != false, do: 0, else: JS.number(audio_correction_sec)

    use_offset_audio_input =
      normalize_timestamps == false and is_number(selected_audio_stream_idx) and
        selected_audio_stream_idx >= 0 and
        is_number(selected_audio_correction_sec) and
        abs(selected_audio_correction_sec) >= @media_audio_offset_threshold_sec

    mapped_audio =
      if use_offset_audio_input,
        do: "1:#{format_number(selected_audio_stream_idx)}",
        else: audio_map

    args =
      if use_offset_audio_input do
        second_seek =
          if js_number_or(start_sec, 0) > 0,
            do: ["-ss", Integer.to_string(js_number_or(start_sec, 0) |> Float.floor() |> trunc())],
            else: []

        args ++
          second_seek ++
          ["-itsoffset", ffmpeg_seconds(selected_audio_correction_sec)] ++
          mapped_mp4_input_args(remote) ++ ["-i", input]
      else
        args
      end

    args = args ++ ["-map", "0:v:0", "-map", mapped_audio, "-sn", "-dn"]
    encode_audio = normalize_timestamps != false or mode == "audio" or use_offset_audio_input

    args =
      if encode_audio do
        encoded =
          args ++ ["-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"]

        if normalize_timestamps != false or use_offset_audio_input,
          do: encoded ++ ["-af", @compat_audio_pts_filter],
          else: encoded
      else
        args ++ ["-c", "copy"]
      end

    args = if JS.truthy?(hevc_tag), do: args ++ ["-tag:v", "hvc1"], else: args

    args =
      if normalize_timestamps != false,
        do: args ++ ["-avoid_negative_ts", "make_zero"],
        else: args ++ ["-copyts", "-start_at_zero", "-avoid_negative_ts", "disabled"]

    args ++
      [
        "-max_interleave_delta",
        "0",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flush_packets",
        "1",
        "-movflags",
        "frag_keyframe+empty_moov+default_base_moof",
        "-f",
        "mp4",
        "pipe:1"
      ]
  end

  # JavaScript source: streamFfmpegMp4(req, res, options)
  def stream_ffmpeg_mp4(req, conn, options) do
    mode = if mget(options, :mode) == "audio", do: "audio", else: "remux"
    label = mget(options, :label) || mget(options, :input)
    playback_type = request_query_value(req, "playbackType", "media") |> js_string_or_empty()
    fallback_reason = request_query_value(req, "fallbackReason", "") |> js_string_or_empty()

    case reserve_media_ffmpeg_stream() do
      {:busy, active} ->
        Response.json_error(
          conn,
          429,
          "MEDIA_FFMPEG_BUSY",
          "Media fallback workers are busy; try again in a moment",
          %{
            active: active,
            limit: @media_ffmpeg_stream_max
          }
        )

      {:ok, release_reference} ->
        try do
          sync =
            cached_playback_packet_sync(%{
              input: mget(options, :input),
              remote: JS.truthy?(mget(options, :remote, false)),
              video_stream_idx:
                mget(options, :video_stream_idx, mget(options, :videoStreamIdx, 0)),
              audio_stream_idx: mget(options, :audio_stream_idx, mget(options, :audioStreamIdx)),
              audio_video_offset_sec:
                mget(options, :audio_video_offset_sec, mget(options, :audioVideoOffsetSec)),
              label: label,
              route: mode
            })

          ffmpeg_options =
            options
            |> normalize_option_map()
            |> Map.put(:mode, mode)
            |> Map.put(:audio_correction_sec, mget(sync, :correction_applied_sec, 0))

          arguments = ffmpeg_mp4_args(ffmpeg_options)

          if @sv_playback_verbose do
            normalize =
              mget(options, :normalize_timestamps, mget(options, :normalizeTimestamps, true)) !=
                false

            correction = if normalize, do: 0, else: mget(sync, :correction_applied_sec, 0)

            IO.puts(
              "[Media FFmpeg] playbackType=#{playback_type} route=compat-#{mode} selected source URL=#{mget(options, :input)} " <>
                "fallback reason=#{if(fallback_reason == "", do: "ffmpeg-start", else: fallback_reason)} title=\"#{label}\" " <>
                "start=#{mget(options, :start_sec, mget(options, :startSec, 0)) || 0} audioMap=#{mget(options, :audio_map, mget(options, :audioMap, "0:a:0?")) || "0:a:0?"} " <>
                "audioStream=#{mget(options, :audio_stream_idx, mget(options, :audioStreamIdx)) || "relative"} audioCodec=#{mget(options, :audio_codec, mget(options, :audioCodec, "")) || ""} " <>
                "videoCodec=#{mget(options, :video_codec, mget(options, :videoCodec, "")) || ""} audioStart=#{mget(options, :audio_start_time, mget(options, :audioStartTime, 0)) || 0} " <>
                "videoStart=#{mget(options, :video_start_time, mget(options, :videoStartTime, 0)) || 0} normalizeTimestamps=#{normalize} syncSource=#{mget(sync, :source, "none") || "none"} " <>
                "offset=#{mget(sync, :calculated_offset_sec, 0) || 0} correctionApplied=#{correction}"
            )

            IO.puts("[Media FFmpeg Args] #{Jason.encode!(arguments)}")
          end

          fallback = mget(options, :fallback_original, mget(options, :fallbackOriginal))

          try do
            executable = Command.executable(:ffmpeg)

            port =
              Port.open({:spawn_executable, to_charlist(executable)}, [
                :binary,
                :exit_status,
                :use_stdio,
                args: Enum.map(arguments, &to_charlist/1)
              ])

            await_media_ffmpeg_start(
              port,
              req,
              conn,
              options,
              mode,
              label,
              playback_type,
              fallback_reason,
              fallback,
              release_reference,
              ""
            )
          rescue
            error ->
              reason = "spawn error: #{Exception.message(error)}"

              IO.puts(
                :stderr,
                "[Media FFmpeg] #{mode} spawn error #{label}: #{Exception.message(error)}"
              )

              release_media_ffmpeg_stream(release_reference, "spawn error", mode, label)

              case invoke_original_fallback(
                     conn,
                     fallback,
                     reason,
                     "",
                     playback_type,
                     fallback_reason,
                     mode,
                     label,
                     options,
                     release_reference
                   ) do
                {:ok, fallback_conn} ->
                  fallback_conn

                :no_fallback ->
                  Response.json_error(
                    conn,
                    500,
                    "MEDIA_FFMPEG_SPAWN_FAILED",
                    "Could not start media fallback",
                    %{
                      mode: mode,
                      details: Exception.message(error)
                    }
                  )
              end
          end
        after
          release_media_ffmpeg_stream(release_reference, nil, mode, label)
        end
    end
  end

  def sv_server_playable_item(item, media_type),
    do: StreamVault.Content.sv_server_playable_item(item, media_type)

  defp contained_path?(root, candidate), do: Files.contained?(root, candidate)

  defp inspect_js_null(nil), do: "null"
  defp inspect_js_null(value), do: format_number(value)

  defp packet_sync_empty(measured) do
    %{
      video_first_pts: nil,
      audio_first_pts: nil,
      calculated_offset_sec: 0,
      correction_applied_sec: 0,
      measured: measured
    }
  end

  defp packet_sync_cache_get(cache_key) do
    State.get(:media_packet_sync_cache, %{values: %{}, order: []})
    |> mget(:values, %{})
    |> Map.get(cache_key)
  end

  defp packet_sync_cache_put(cache_key, result) do
    State.update(:media_packet_sync_cache, %{values: %{}, order: []}, fn cache ->
      values = mget(cache, :values, %{})
      order = mget(cache, :order, [])
      already_present = Map.has_key?(values, cache_key)
      values = Map.put(values, cache_key, result)
      order = if already_present, do: order, else: order ++ [cache_key]

      if map_size(values) > 120 do
        case order do
          [oldest | remaining] -> %{values: Map.delete(values, oldest), order: remaining}
          [] -> %{values: values, order: order}
        end
      else
        %{values: values, order: order}
      end
    end)

    result
  end

  defp claim_packet_sync_inflight(cache_key) do
    caller = self()
    candidate_reference = make_ref()

    State.get_and_update(:media_packet_sync_inflight, %{}, fn inflight ->
      case Map.get(inflight, cache_key) do
        nil ->
          entry = %{reference: candidate_reference, waiters: []}
          {{:owner, candidate_reference}, Map.put(inflight, cache_key, entry)}

        entry ->
          reference = mget(entry, :reference)
          waiters = mget(entry, :waiters, []) ++ [caller]
          next_entry = Map.put(entry, :waiters, waiters)
          {{:join, reference}, Map.put(inflight, cache_key, next_entry)}
      end
    end)
  end

  defp await_packet_sync_result(reference) do
    receive do
      {:packet_sync_result, ^reference, result} -> result
    end
  end

  defp finish_packet_sync_inflight(cache_key, reference) do
    State.get_and_update(:media_packet_sync_inflight, %{}, fn inflight ->
      case Map.get(inflight, cache_key) do
        nil ->
          {[], inflight}

        entry ->
          if mget(entry, :reference) == reference do
            {mget(entry, :waiters, []), Map.delete(inflight, cache_key)}
          else
            {[], inflight}
          end
      end
    end)
  end

  defp schedule_packet_sync_probe(cache_key, options) do
    scheduled =
      State.transaction(fn state ->
        inflight = Map.get(state, :media_packet_sync_inflight, %{})
        pending = Map.get(state, :media_packet_sync_scheduled, MapSet.new())

        if Map.has_key?(inflight, cache_key) or MapSet.member?(pending, cache_key) do
          {false, state}
        else
          next_pending = MapSet.put(pending, cache_key)
          {true, Map.put(state, :media_packet_sync_scheduled, next_pending)}
        end
      end)

    if scheduled do
      Process.send_after(__MODULE__, {:packet_sync_background, cache_key, options}, 6000)
    end

    :ok
  end

  defp rounded_seconds(value), do: StreamVault.Core.rounded_seconds(value)

  defp request_query_value(request, key, default) do
    query = mget(request, :query_params, mget(request, :query, %{}))
    value = mget(query, key)
    if JS.truthy?(value), do: value, else: default
  end

  defp normalize_option_map(options) when is_map(options), do: options
  defp normalize_option_map(options) when is_list(options), do: Map.new(options)
  defp normalize_option_map(_options), do: %{}

  defp reserve_media_ffmpeg_stream do
    owner = self()
    release_reference = make_ref()

    State.transaction(fn state ->
      active = Map.get(state, :active_media_ffmpeg_streams, 0)

      if active >= @media_ffmpeg_stream_max do
        {{:busy, active}, state}
      else
        watcher = spawn(fn -> media_ffmpeg_release_watch(owner, release_reference) end)
        references = Map.get(state, :media_ffmpeg_release_refs, %{})

        next_state =
          state
          |> Map.put(:active_media_ffmpeg_streams, active + 1)
          |> Map.put(:media_ffmpeg_release_refs, Map.put(references, release_reference, watcher))

        {{:ok, release_reference}, next_state}
      end
    end)
  end

  defp media_ffmpeg_release_watch(owner, release_reference) do
    monitor = Process.monitor(owner)

    receive do
      {:media_ffmpeg_released, ^release_reference} ->
        Process.demonitor(monitor, [:flush])

      {:DOWN, ^monitor, :process, ^owner, _reason} ->
        release_media_ffmpeg_stream(release_reference, nil, "", "")
    end
  end

  defp release_media_ffmpeg_stream(release_reference, reason, mode, label) do
    {released, watcher} =
      State.transaction(fn state ->
        references = Map.get(state, :media_ffmpeg_release_refs, %{})

        case Map.pop(references, release_reference) do
          {nil, _references} ->
            {{false, nil}, state}

          {watcher, references} ->
            active = max(0, Map.get(state, :active_media_ffmpeg_streams, 0) - 1)

            next_state =
              state
              |> Map.put(:active_media_ffmpeg_streams, active)
              |> Map.put(:media_ffmpeg_release_refs, references)

            {{true, watcher}, next_state}
        end
      end)

    if released do
      if is_pid(watcher) and watcher != self() do
        send(watcher, {:media_ffmpeg_released, release_reference})
      end

      if @sv_playback_verbose and JS.truthy?(reason) do
        IO.puts("[Media FFmpeg] #{mode} released #{label}: #{reason}")
      end
    end

    released
  end

  defp await_media_ffmpeg_start(
         port,
         req,
         conn,
         options,
         mode,
         label,
         playback_type,
         fallback_reason,
         fallback,
         release_reference,
         stderr
       ) do
    monitor = Process.monitor(port)

    await_media_ffmpeg_start_loop(
      port,
      monitor,
      req,
      conn,
      options,
      mode,
      label,
      playback_type,
      fallback_reason,
      fallback,
      release_reference,
      stderr
    )
  end

  defp await_media_ffmpeg_start_loop(
         port,
         monitor,
         req,
         conn,
         options,
         mode,
         label,
         playback_type,
         fallback_reason,
         fallback,
         release_reference,
         stderr
       ) do
    socket = request_transport_socket(req)

    receive do
      {^port, {:data, data}} ->
        case begin_media_ffmpeg_response(conn, data) do
          {:ok, started_conn} ->
            media_ffmpeg_stream_loop(
              port,
              monitor,
              req,
              started_conn,
              mode,
              label,
              release_reference,
              stderr
            )

          {:error, _reason, failed_conn} ->
            close_media_ffmpeg_for_client(
              port,
              monitor,
              failed_conn,
              release_reference,
              mode,
              label
            )
        end

      {^port, {:exit_status, code}} ->
        Process.demonitor(monitor, [:flush])

        media_ffmpeg_prestart_closed(
          code,
          req,
          conn,
          options,
          mode,
          label,
          playback_type,
          fallback_reason,
          fallback,
          release_reference,
          stderr
        )

      {:DOWN, ^monitor, :port, ^port, reason} ->
        media_ffmpeg_prestart_down(
          reason,
          req,
          conn,
          options,
          mode,
          label,
          playback_type,
          fallback_reason,
          fallback,
          release_reference,
          stderr
        )

      {:tcp_closed, ^socket} when not is_nil(socket) ->
        close_media_ffmpeg_for_client(port, monitor, conn, release_reference, mode, label)

      {:ssl_closed, ^socket} when not is_nil(socket) ->
        close_media_ffmpeg_for_client(port, monitor, conn, release_reference, mode, label)

      {:tcp_error, ^socket, _reason} when not is_nil(socket) ->
        close_media_ffmpeg_for_client(port, monitor, conn, release_reference, mode, label)

      {:ssl_error, ^socket, _reason} when not is_nil(socket) ->
        close_media_ffmpeg_for_client(port, monitor, conn, release_reference, mode, label)

      {:bandit, {:rst_stream, _error_code}} ->
        close_media_ffmpeg_for_client(port, monitor, conn, release_reference, mode, label)
    after
      max(0, trunc(@media_ffmpeg_startup_ms)) ->
        IO.puts(:stderr, "[Media FFmpeg] #{mode} startup timeout #{label}")
        terminate_media_ffmpeg(port, monitor)

        case invoke_original_fallback(
               conn,
               fallback,
               "startup timeout",
               stderr,
               playback_type,
               fallback_reason,
               mode,
               label,
               options,
               release_reference
             ) do
          {:ok, fallback_conn} ->
            fallback_conn

          :no_fallback ->
            release_media_ffmpeg_stream(release_reference, "startup timeout", mode, label)

            Response.json_error(
              conn,
              504,
              "MEDIA_FFMPEG_STARTUP_TIMEOUT",
              "Media fallback did not start in time",
              %{
                mode: mode,
                details: tail_bytes(stderr, 1000)
              }
            )
        end
    end
  end

  defp media_ffmpeg_prestart_closed(
         code,
         req,
         conn,
         options,
         mode,
         label,
         playback_type,
         fallback_reason,
         fallback,
         release_reference,
         stderr
       ) do
    release_media_ffmpeg_stream(release_reference, "process close code=#{code}", mode, label)

    if code != 0 do
      IO.puts(:stderr, "[Media FFmpeg] #{mode} failed #{label}: #{String.trim(stderr)}")

      case invoke_original_fallback(
             conn,
             fallback,
             "process close code=#{code}",
             stderr,
             playback_type,
             fallback_reason,
             mode,
             label,
             options,
             release_reference
           ) do
        {:ok, fallback_conn} ->
          fallback_conn

        :no_fallback ->
          Response.json_error(
            conn,
            502,
            "MEDIA_FFMPEG_FAILED",
            "Media fallback failed before playback started",
            %{
              mode: mode,
              details: tail_bytes(stderr, 1000)
            }
          )
      end
    else
      if @sv_playback_verbose, do: IO.puts("[Media FFmpeg] #{mode} ended #{label}")
      await_empty_media_ffmpeg_response(req, conn)
    end
  end

  defp media_ffmpeg_prestart_down(
         reason,
         _req,
         conn,
         options,
         mode,
         label,
         playback_type,
         fallback_reason,
         fallback,
         release_reference,
         stderr
       ) do
    reason_text = "process close: #{format_error(reason)}"
    release_media_ffmpeg_stream(release_reference, reason_text, mode, label)
    IO.puts(:stderr, "[Media FFmpeg] #{mode} failed #{label}: #{reason_text}")

    case invoke_original_fallback(
           conn,
           fallback,
           reason_text,
           stderr,
           playback_type,
           fallback_reason,
           mode,
           label,
           options,
           release_reference
         ) do
      {:ok, fallback_conn} ->
        fallback_conn

      :no_fallback ->
        Response.json_error(
          conn,
          502,
          "MEDIA_FFMPEG_FAILED",
          "Media fallback failed before playback started",
          %{
            mode: mode,
            details: tail_bytes(stderr, 1000)
          }
        )
    end
  end

  defp begin_media_ffmpeg_response(conn, data) do
    started_conn =
      conn
      |> Response.put_headers([
        {"content-type", "video/mp4"},
        {"accept-ranges", "none"},
        {"access-control-allow-origin", "*"},
        {"cache-control", "no-store"}
      ])
      |> Plug.Conn.send_chunked(200)

    case Plug.Conn.chunk(started_conn, data) do
      {:ok, next_conn} -> {:ok, next_conn}
      {:error, reason} -> {:error, reason, started_conn}
    end
  rescue
    error -> {:error, error, conn}
  end

  defp media_ffmpeg_stream_loop(port, monitor, req, conn, mode, label, release_reference, stderr) do
    socket = request_transport_socket(req)

    receive do
      {^port, {:data, data}} ->
        case safe_media_ffmpeg_chunk(conn, data) do
          {:ok, next_conn} ->
            media_ffmpeg_stream_loop(
              port,
              monitor,
              req,
              next_conn,
              mode,
              label,
              release_reference,
              stderr
            )

          {:error, _reason} ->
            close_media_ffmpeg_for_client(port, monitor, conn, release_reference, mode, label)
        end

      {^port, {:exit_status, code}} ->
        Process.demonitor(monitor, [:flush])
        release_media_ffmpeg_stream(release_reference, "process close code=#{code}", mode, label)

        if code != 0 do
          IO.puts(
            :stderr,
            "[Media FFmpeg] #{mode} ended code=#{code} #{label}: #{tail_bytes(stderr, 1000)}"
          )
        else
          if @sv_playback_verbose, do: IO.puts("[Media FFmpeg] #{mode} ended #{label}")
        end

        conn

      {:DOWN, ^monitor, :port, ^port, reason} ->
        reason_text = "process close: #{format_error(reason)}"
        release_media_ffmpeg_stream(release_reference, reason_text, mode, label)
        IO.puts(:stderr, "[Media FFmpeg] #{mode} ended #{label}: #{reason_text}")
        conn

      {:tcp_closed, ^socket} when not is_nil(socket) ->
        close_media_ffmpeg_for_client(port, monitor, conn, release_reference, mode, label)

      {:ssl_closed, ^socket} when not is_nil(socket) ->
        close_media_ffmpeg_for_client(port, monitor, conn, release_reference, mode, label)

      {:tcp_error, ^socket, _reason} when not is_nil(socket) ->
        close_media_ffmpeg_for_client(port, monitor, conn, release_reference, mode, label)

      {:ssl_error, ^socket, _reason} when not is_nil(socket) ->
        close_media_ffmpeg_for_client(port, monitor, conn, release_reference, mode, label)

      {:bandit, {:rst_stream, _error_code}} ->
        close_media_ffmpeg_for_client(port, monitor, conn, release_reference, mode, label)
    end
  end

  defp safe_media_ffmpeg_chunk(conn, data) do
    Plug.Conn.chunk(conn, data)
  rescue
    error -> {:error, error}
  end

  defp close_media_ffmpeg_for_client(port, monitor, conn, release_reference, mode, label) do
    try do
      Command.terminate(port)
    rescue
      _error -> :ok
    after
      Process.demonitor(monitor, [:flush])
      release_media_ffmpeg_stream(release_reference, "client closed", mode, label)
    end

    mark_media_ffmpeg_client_closed(conn)
  end

  defp terminate_media_ffmpeg(port, monitor) do
    try do
      Command.terminate(port)
    rescue
      _error -> :ok
    after
      Process.demonitor(monitor, [:flush])
    end
  end

  defp await_empty_media_ffmpeg_response(req, conn) do
    socket = request_transport_socket(req)

    receive do
      {:tcp_closed, ^socket} when not is_nil(socket) ->
        mark_media_ffmpeg_client_closed(conn)

      {:ssl_closed, ^socket} when not is_nil(socket) ->
        mark_media_ffmpeg_client_closed(conn)

      {:tcp_error, ^socket, _reason} when not is_nil(socket) ->
        mark_media_ffmpeg_client_closed(conn)

      {:ssl_error, ^socket, _reason} when not is_nil(socket) ->
        mark_media_ffmpeg_client_closed(conn)

      {:bandit, {:rst_stream, _error_code}} ->
        mark_media_ffmpeg_client_closed(conn)
    end
  end

  defp request_transport_socket(request) do
    case mget(request, :adapter) do
      {_adapter_module, %{transport: %{socket: %{socket: socket}}}} -> socket
      _ -> nil
    end
  end

  defp mark_media_ffmpeg_client_closed(%Plug.Conn{adapter: {adapter_module, adapter}} = conn)
       when is_map(adapter) do
    transport = mget(adapter, :transport)

    closed_transport =
      cond do
        is_map(transport) and Map.has_key?(transport, :state) ->
          Map.put(transport, :state, :closed)

        is_map(transport) and Map.has_key?(transport, :keepalive) ->
          Map.put(transport, :keepalive, false)

        true ->
          transport
      end

    closed_adapter =
      if is_nil(closed_transport),
        do: adapter,
        else: Map.put(adapter, :transport, closed_transport)

    %{conn | adapter: {adapter_module, closed_adapter}, state: :sent}
  end

  defp mark_media_ffmpeg_client_closed(conn), do: conn

  defp invoke_original_fallback(
         conn,
         fallback,
         reason,
         stderr,
         playback_type,
         fallback_reason,
         mode,
         label,
         options,
         release_reference
       ) do
    callable = is_function(fallback, 1) or is_function(fallback, 0)

    if conn.state != :unset or not callable do
      :no_fallback
    else
      release_media_ffmpeg_stream(release_reference, "fallback original: #{reason}", mode, label)
      displayed_reason = if fallback_reason == "", do: reason, else: fallback_reason

      IO.puts(
        :stderr,
        "[Media FFmpeg] playbackType=#{playback_type} selected source URL=#{mget(options, :input)} " <>
          "fallback reason=#{displayed_reason} #{mode} falling back to original source for #{label}: #{reason}"
      )

      payload = %{reason: reason, stderr: tail_bytes(stderr, 1000)}

      try do
        fallback_conn = if is_function(fallback, 1), do: fallback.(payload), else: fallback.()
        {:ok, fallback_conn}
      rescue
        error ->
          IO.puts(
            :stderr,
            "[Media FFmpeg] original fallback failed #{label}: #{Exception.message(error)}"
          )

          :no_fallback
      catch
        kind, caught ->
          IO.puts(
            :stderr,
            "[Media FFmpeg] original fallback failed #{label}: #{kind}: #{format_error(caught)}"
          )

          :no_fallback
      end
    end
  end

  # Internal implementation for the callback-heavy Node streaming and process lifecycle.
  defp schedule(message, milliseconds),
    do: Process.send_after(self(), message, max(1, milliseconds))

  defp fetch_playlist_candidates(candidates, fast, channel_id) do
    attempts = if fast, do: 2, else: 1
    timeout = if fast, do: @sv_live_fast_playlist_timeout_ms, else: @sv_live_playlist_timeout_ms

    Enum.reduce_while(candidates, {nil, nil}, fn candidate, {_fetched, previous_error} ->
      result =
        Enum.reduce_while(0..(attempts - 1), {:error, previous_error}, fn attempt, _acc ->
          try do
            {:halt, {:ok, sv_fetch_m3u8_text(candidate, %{timeout_ms: timeout})}}
          rescue
            error ->
              message = Exception.message(error)

              sv_live_debug_log("playlist candidate failed", %{
                channel: channel_id,
                candidate: candidate,
                attempt: attempt + 1,
                error: message
              })

              {:cont, {:error, message}}
          end
        end)

      case result do
        {:ok, fetched} -> {:halt, {fetched, previous_error}}
        {:error, error} -> {:cont, {nil, error}}
      end
    end)
  end

  defp claim_live_inflight(channel_id, source_url) do
    State.transaction(fn state ->
      inflights = Map.get(state, :sv_live_segment_inflight, %{})

      case Map.get(inflights, source_url) do
        nil ->
          reference = make_ref()

          inflight = %{
            channel_id: channel_id,
            source_url: source_url,
            reference: reference,
            clients: MapSet.new([self()]),
            chunks: [],
            cached_bytes: 0,
            meta: nil,
            done: false
          }

          {{:owner, reference},
           Map.put(state, :sv_live_segment_inflight, Map.put(inflights, source_url, inflight))}

        inflight ->
          updated = sv_live_inflight_add_client(inflight, self(), "DEDUP")

          reply =
            {:join, mget(inflight, :reference), mget(inflight, :meta),
             mget(inflight, :chunks, [])}

          {reply,
           Map.put(state, :sv_live_segment_inflight, Map.put(inflights, source_url, updated))}
      end
    end)
  end

  defp stream_live_inflight_owner(
         conn,
         reference,
         channel_id,
         source_url,
         attempt,
         redirects_left
       ) do
    started_at = JS.date_now()
    Process.put({:sv_live_conn, reference}, conn)

    request =
      Finch.build(
        :get,
        source_url,
        sv_live_headers(source_url) ++
          [{"connection", "keep-alive"}, {"cache-control", "no-cache"}]
      )

    initial = %{
      conn: conn,
      status: 502,
      headers: %{},
      meta: nil,
      special: nil,
      reference: reference
    }

    reducer = fn
      {:status, status}, acc ->
        {:cont, %{acc | status: status}}

      {:headers, headers}, acc ->
        headers = normalize_response_headers(headers)
        status = acc.status
        location = Map.get(headers, "location")

        cond do
          status in [301, 302, 303, 307, 308] and JS.truthy?(location) and redirects_left > 0 and
              acc.conn.state == :unset ->
            {:halt,
             %{
               acc
               | headers: headers,
                 special:
                   {:retry, sv_resolve_url(source_url, location), attempt, redirects_left - 1, 0}
             }}

          status in [404, 410] and attempt < @sv_live_segment_advance_retries and
              sv_live_advance_dated_segment_url(source_url) != "" ->
            advanced = sv_live_advance_dated_segment_url(source_url)

            sv_live_debug_log("advance expired segment", %{
              status: status,
              attempt: attempt + 1,
              from: source_url,
              to: advanced
            })

            {:halt,
             %{
               acc
               | headers: headers,
                 special: {:retry, advanced, attempt + 1, redirects_left, 80}
             }}

          status >= 400 and attempt < 2 ->
            sv_live_debug_log("retry segment status", %{
              status: status,
              attempt: attempt + 1,
              url: source_url
            })

            {:halt,
             %{
               acc
               | headers: headers,
                 special: {:retry, source_url, attempt + 1, redirects_left, 250}
             }}

          true ->
            meta = %{
              status: status,
              content_type:
                sv_live_segment_content_type(source_url, Map.get(headers, "content-type")),
              accept_ranges: Map.get(headers, "accept-ranges"),
              content_length: Map.get(headers, "content-length"),
              content_range: Map.get(headers, "content-range"),
              upstream_status: status,
              upstream_ms: JS.date_now() - started_at
            }

            clients = set_inflight_meta(source_url, reference, meta)

            broadcast_clients(
              clients,
              self(),
              {:sv_live_meta, reference, meta,
               if(status == acc.status, do: "DEDUP", else: "MISS")}
            )

            sv_live_debug_log("segment", %{
              status: status,
              ms: JS.date_now() - started_at,
              bytes: Map.get(headers, "content-length", ""),
              url: source_url
            })

            next_conn =
              acc.conn
              |> sv_live_set_segment_headers(meta, "MISS")
              |> Plug.Conn.send_chunked(status)

            Process.put({:sv_live_conn, reference}, next_conn)
            {:cont, %{acc | headers: headers, meta: meta, conn: next_conn}}
        end

      {:data, data}, %{special: nil, meta: meta} = acc when not is_nil(meta) ->
        clients = append_inflight_chunk(source_url, reference, data)
        broadcast_clients(clients, self(), {:sv_live_chunk, reference, data})

        case Plug.Conn.chunk(acc.conn, data) do
          {:ok, next_conn} ->
            Process.put({:sv_live_conn, reference}, next_conn)
            {:cont, %{acc | conn: next_conn}}

          {:error, _reason} ->
            clients = remove_inflight_client(source_url, reference, self())

            if MapSet.size(clients) == 0,
              do: {:halt, %{acc | special: :no_clients}},
              else: {:cont, acc}
        end

      {:data, _data}, acc ->
        {:cont, acc}
    end

    result =
      Finch.stream_while(request, StreamVault.Finch, initial, reducer,
        pool_timeout: 45_000,
        receive_timeout: 45_000
      )

    case result do
      {:ok, %{special: {:retry, next_url, next_attempt, next_redirects, delay}} = acc} ->
        retry_live_inflight(
          acc.conn,
          source_url,
          reference,
          channel_id,
          next_url,
          next_attempt,
          next_redirects,
          delay
        )

      {:ok, %{special: :no_clients, conn: conn}} ->
        drop_live_inflight(source_url, reference)
        conn

      {:ok, acc} ->
        finish_live_inflight(acc.conn, source_url, reference, channel_id, acc.meta)

      {:error, reason} ->
        latest_conn = Process.get({:sv_live_conn, reference}, conn)

        handle_live_inflight_error(
          latest_conn,
          source_url,
          reference,
          channel_id,
          attempt,
          redirects_left,
          reason
        )
    end
  rescue
    error ->
      latest_conn = Process.get({:sv_live_conn, reference}, conn)

      handle_live_inflight_error(
        latest_conn,
        source_url,
        reference,
        channel_id,
        attempt,
        redirects_left,
        error
      )
  end

  defp consume_live_inflight(
         conn,
         reference,
         meta,
         chunks,
         channel_id,
         source_url,
         attempt,
         redirects_left
       ) do
    case meta do
      nil ->
        await_live_inflight_start(
          conn,
          reference,
          channel_id,
          source_url,
          attempt,
          redirects_left
        )

      meta ->
        conn =
          conn
          |> sv_live_set_segment_headers(meta, "DEDUP")
          |> Plug.Conn.send_chunked(trunc(mget(meta, :status, 200)))

        conn =
          Enum.reduce_while(chunks, conn, fn chunk, conn ->
            case Plug.Conn.chunk(conn, chunk) do
              {:ok, next} -> {:cont, next}
              {:error, _} -> {:halt, conn}
            end
          end)

        await_live_inflight_data(conn, reference, channel_id, source_url)
    end
  end

  defp await_live_inflight_start(
         conn,
         reference,
         channel_id,
         source_url,
         _attempt,
         _redirects_left
       ) do
    receive do
      {:sv_live_meta, ^reference, meta, _state} ->
        conn =
          conn
          |> sv_live_set_segment_headers(meta, "DEDUP")
          |> Plug.Conn.send_chunked(trunc(mget(meta, :status, 200)))

        await_live_inflight_data(conn, reference, channel_id, source_url)

      {:sv_live_retry, ^reference, next_url, next_attempt, next_redirects, delay} ->
        Process.sleep(delay)

        sv_stream_live_segment_with_retry(
          channel_id,
          next_url,
          conn,
          next_attempt,
          next_redirects
        )

      {:sv_live_error, ^reference, status, message} ->
        end_response(conn, message, status)
    after
      50_000 ->
        remove_inflight_client(source_url, reference, self())
        end_response(conn, "Segment fetch failed", 502)
    end
  end

  defp await_live_inflight_data(conn, reference, channel_id, source_url) do
    receive do
      {:sv_live_chunk, ^reference, data} ->
        case Plug.Conn.chunk(conn, data) do
          {:ok, next_conn} ->
            await_live_inflight_data(next_conn, reference, channel_id, source_url)

          {:error, _} ->
            remove_inflight_client(source_url, reference, self())
            conn
        end

      {:sv_live_end, ^reference} ->
        conn

      {:sv_live_error, ^reference, _status, _message} ->
        conn
    after
      50_000 ->
        remove_inflight_client(source_url, reference, self())
        conn
    end
  end

  defp set_inflight_meta(source_url, reference, meta) do
    State.get_and_update(:sv_live_segment_inflight, %{}, fn inflights ->
      case Map.get(inflights, source_url) do
        %{reference: ^reference} = inflight ->
          updated = Map.put(inflight, :meta, meta)
          {mget(updated, :clients, MapSet.new()), Map.put(inflights, source_url, updated)}

        _ ->
          {MapSet.new(), inflights}
      end
    end)
  end

  defp append_inflight_chunk(source_url, reference, data) do
    State.get_and_update(:sv_live_segment_inflight, %{}, fn inflights ->
      case Map.get(inflights, source_url) do
        %{reference: ^reference} = inflight ->
          cached_bytes = mget(inflight, :cached_bytes, 0)

          updated =
            if cached_bytes + byte_size(data) <= @sv_live_segment_cache_max_segment_bytes do
              inflight
              |> Map.update(:chunks, [data], &(&1 ++ [data]))
              |> Map.put(:cached_bytes, cached_bytes + byte_size(data))
            else
              inflight
            end

          {mget(updated, :clients, MapSet.new()), Map.put(inflights, source_url, updated)}

        _ ->
          {MapSet.new(), inflights}
      end
    end)
  end

  defp finish_live_inflight(conn, source_url, reference, channel_id, meta) do
    inflight = drop_live_inflight(source_url, reference)

    if inflight do
      chunks = mget(inflight, :chunks, [])
      status = mget(meta || %{}, :status, 0)

      if status >= 200 and status < 300 and chunks != [],
        do: sv_live_store_segment(channel_id, source_url, meta, IO.iodata_to_binary(chunks))

      broadcast_clients(mget(inflight, :clients, MapSet.new()), self(), {:sv_live_end, reference})
    end

    Process.delete({:sv_live_conn, reference})
    conn
  end

  defp retry_live_inflight(
         conn,
         source_url,
         reference,
         channel_id,
         next_url,
         next_attempt,
         next_redirects,
         delay
       ) do
    inflight = drop_live_inflight(source_url, reference)

    broadcast_clients(
      mget(inflight || %{}, :clients, MapSet.new()),
      self(),
      {:sv_live_retry, reference, next_url, next_attempt, next_redirects, delay}
    )

    Process.delete({:sv_live_conn, reference})
    Process.sleep(delay)
    sv_stream_live_segment_with_retry(channel_id, next_url, conn, next_attempt, next_redirects)
  end

  defp handle_live_inflight_error(
         conn,
         source_url,
         reference,
         channel_id,
         attempt,
         redirects_left,
         reason
       ) do
    advanced = sv_live_advance_dated_segment_url(source_url)

    cond do
      conn.state != :unset ->
        inflight = drop_live_inflight(source_url, reference)

        broadcast_clients(
          mget(inflight || %{}, :clients, MapSet.new()),
          self(),
          {:sv_live_error, reference, 502, "Segment stream failed"}
        )

        Process.delete({:sv_live_conn, reference})
        conn

      advanced != "" and attempt < @sv_live_segment_advance_retries ->
        sv_live_debug_log("advance segment after error", %{
          error: format_error(reason),
          attempt: attempt + 1,
          from: source_url,
          to: advanced
        })

        retry_live_inflight(
          conn,
          source_url,
          reference,
          channel_id,
          advanced,
          attempt + 1,
          redirects_left,
          80
        )

      attempt < 2 ->
        sv_live_debug_log("retry segment error", %{
          error: format_error(reason),
          attempt: attempt + 1,
          url: source_url
        })

        retry_live_inflight(
          conn,
          source_url,
          reference,
          channel_id,
          source_url,
          attempt + 1,
          redirects_left,
          250
        )

      true ->
        IO.puts(:stderr, "[Live] Segment fetch error: #{format_error(reason)}")
        inflight = drop_live_inflight(source_url, reference)

        broadcast_clients(
          mget(inflight || %{}, :clients, MapSet.new()),
          self(),
          {:sv_live_error, reference, 502, "Segment fetch failed"}
        )

        Process.delete({:sv_live_conn, reference})
        if conn.state == :unset, do: end_response(conn, "Segment fetch failed", 502), else: conn
    end
  end

  defp drop_live_inflight(source_url, reference) do
    State.get_and_update(:sv_live_segment_inflight, %{}, fn inflights ->
      case Map.get(inflights, source_url) do
        %{reference: ^reference} = inflight -> {inflight, Map.delete(inflights, source_url)}
        _ -> {nil, inflights}
      end
    end)
  end

  defp remove_inflight_client(source_url, reference, pid) do
    State.get_and_update(:sv_live_segment_inflight, %{}, fn inflights ->
      case Map.get(inflights, source_url) do
        %{reference: ^reference} = inflight ->
          clients = MapSet.delete(mget(inflight, :clients, MapSet.new()), pid)
          {clients, Map.put(inflights, source_url, Map.put(inflight, :clients, clients))}

        _ ->
          {MapSet.new(), inflights}
      end
    end)
  end

  defp broadcast_clients(clients, excluded, message) do
    Enum.each(clients, fn pid ->
      if pid != excluded and process_alive?(pid), do: send(pid, message)
    end)
  end

  defp relay_session(channel_id),
    do: State.get(:sv_live_relay_sessions, %{}) |> Map.get(channel_id)

  defp put_relay_session(channel_id, session),
    do: State.update(:sv_live_relay_sessions, %{}, &Map.put(&1, channel_id, session))

  defp wait_for_live_relay_playlist_loop(session, deadline) do
    cond do
      mget(relay_session(mget(session, :channel_id)) || %{}, :process) != mget(session, :process) ->
        nil

      true ->
        state = sv_live_relay_playlist_state(session)

        cond do
          mget(state, :ready, false) ->
            state

          !process_alive?(mget(session, :process)) ->
            nil

          JS.date_now() >= deadline ->
            nil

          true ->
            Process.sleep(200)
            wait_for_live_relay_playlist_loop(session, deadline)
        end
    end
  end

  defp wait_for_live_relay_segment_loop(channel_id, filename, deadline) do
    current = relay_session(channel_id)
    retired = State.get(:sv_live_relay_retired_dirs, %{}) |> Map.get(channel_id, [])

    directories =
      [mget(current, :dir) | Enum.map(retired, &mget(&1, :dir))] |> Enum.filter(&JS.truthy?/1)

    found =
      Enum.find_value(directories, "", fn directory ->
        path = Path.join(directory, filename)
        if File.exists?(path), do: path, else: false
      end)

    cond do
      found != "" ->
        found

      JS.date_now() > deadline ->
        ""

      true ->
        Process.sleep(100)
        wait_for_live_relay_segment_loop(channel_id, filename, deadline)
    end
  end

  defp cleanup_live_relay_sessions do
    now = JS.date_now()

    State.get(:sv_live_relay_sessions, %{})
    |> Enum.each(fn {channel_id, session} ->
      if now - mget(session, :last_access, 0) > @sv_live_relay_idle_ms do
        sv_stop_live_relay(session, "idle timeout")
        State.update(:sv_live_relay_sessions, %{}, &Map.delete(&1, channel_id))
        sv_live_relay_remember_dir(channel_id, mget(session, :dir))
      else
        sv_ensure_live_relay(channel_id)
      end
    end)

    State.get(:sv_live_relay_retired_dirs, %{})
    |> Enum.each(fn {channel_id, entries} ->
      {keep, expired} = Enum.split_with(entries, &(mget(&1, :expires_at, 0) > now))
      Enum.each(expired, fn entry -> Task.start(fn -> File.rm_rf(mget(entry, :dir)) end) end)

      State.update(:sv_live_relay_retired_dirs, %{}, fn all ->
        if keep == [], do: Map.delete(all, channel_id), else: Map.put(all, channel_id, keep)
      end)
    end)
  end

  defp relay_ffmpeg_worker(channel_id, arguments) do
    try do
      port = Command.open(Command.executable(:ffmpeg), arguments)
      relay_port_loop(port, channel_id, "")
    rescue
      error ->
        GenServer.cast(__MODULE__, {:relay_error, channel_id, self(), Exception.message(error)})

        GenServer.cast(
          __MODULE__,
          {:relay_closed, channel_id, self(), -1, Exception.message(error)}
        )
    end
  end

  defp relay_port_loop(port, channel_id, tail) do
    receive do
      {^port, {:data, data}} ->
        relay_port_loop(port, channel_id, tail_bytes(tail <> data, 2000))

      {^port, {:exit_status, code}} ->
        GenServer.cast(__MODULE__, {:relay_closed, channel_id, self(), code, tail})

      :stop ->
        Command.terminate(port)
    end
  end

  defp wait_for_hls_playlist_loop(playlist_path, timeout_ms, session_id, started) do
    session =
      if session_id == "",
        do: nil,
        else: State.get(:mobile_hls_sessions, %{}) |> Map.get(session_id)

    cond do
      session && JS.truthy?(mget(session, :error)) ->
        raise mget(session, :error)

      File.exists?(playlist_path) ->
        content = File.read!(playlist_path)

        if length(Regex.scan(~r/\.ts/, content)) >= 2,
          do: content,
          else: continue_hls_wait(playlist_path, timeout_ms, session_id, started)

      JS.date_now() - started >= timeout_ms ->
        raise "Mobile HLS startup timed out"

      true ->
        continue_hls_wait(playlist_path, timeout_ms, session_id, started)
    end
  end

  defp continue_hls_wait(playlist_path, timeout_ms, session_id, started) do
    if JS.date_now() - started >= timeout_ms do
      raise "Mobile HLS startup timed out"
    else
      Process.sleep(250)
      wait_for_hls_playlist_loop(playlist_path, timeout_ms, session_id, started)
    end
  end

  defp wait_for_heavy_playlist_loop(playlist_path, key, timeout_ms, started, last_content) do
    session = State.get(:heavy_compat_hls_sessions, %{}) |> Map.get(key)

    cond do
      session && JS.truthy?(mget(session, :error)) ->
        raise mget(session, :error)

      File.exists?(playlist_path) ->
        content = File.read!(playlist_path)
        segment_count = heavy_compat_playlist_segment_count(content)

        cond do
          String.contains?(content, "#EXT-X-ENDLIST") or
              segment_count >= @heavy_compat_hls_startup_segments ->
            content

          JS.date_now() - started >= timeout_ms and segment_count > 0 ->
            content

          JS.date_now() - started >= timeout_ms ->
            raise "Heavy compatibility HLS startup timed out"

          true ->
            Process.sleep(500)
            wait_for_heavy_playlist_loop(playlist_path, key, timeout_ms, started, content)
        end

      JS.date_now() - started >= timeout_ms and
          heavy_compat_playlist_segment_count(last_content) > 0 ->
        last_content

      JS.date_now() - started >= timeout_ms ->
        raise "Heavy compatibility HLS startup timed out"

      true ->
        Process.sleep(500)
        wait_for_heavy_playlist_loop(playlist_path, key, timeout_ms, started, last_content)
    end
  end

  defp completed_heavy_playlist?(playlist_path) do
    if File.exists?(playlist_path) do
      try do
        content = File.read!(playlist_path)

        String.contains?(content, "#EXT-X-ENDLIST") and
          heavy_compat_playlist_segment_count(content) > 0
      rescue
        _ -> false
      end
    else
      false
    end
  end

  defp ffmpeg_worker(kind, key, arguments) do
    try do
      port = Command.open(Command.executable(:ffmpeg), arguments)
      ffmpeg_port_loop(port, kind, key)
    rescue
      error ->
        GenServer.cast(__MODULE__, {error_tag(kind), key, self(), Exception.message(error)})
        GenServer.cast(__MODULE__, {closed_tag(kind), key, self(), -1})
    end
  end

  defp ffmpeg_port_loop(port, kind, key) do
    receive do
      {^port, {:data, data}} ->
        GenServer.cast(__MODULE__, {output_tag(kind), key, data})
        ffmpeg_port_loop(port, kind, key)

      {^port, {:exit_status, code}} ->
        GenServer.cast(__MODULE__, {closed_tag(kind), key, self(), code})

      :stop ->
        Command.terminate(port)
    end
  end

  defp output_tag(:mobile), do: :mobile_output
  defp output_tag(:heavy), do: :heavy_output
  defp error_tag(:mobile), do: :mobile_error
  defp error_tag(:heavy), do: :heavy_error
  defp closed_tag(:mobile), do: :mobile_closed
  defp closed_tag(:heavy), do: :heavy_closed

  defp trusted_remote_playback_media(conn) do
    names = ["url", "streamUrl", "movie", "movieUrl", "src"]

    case read_remote_url(conn, names) do
      {:error, status, message} ->
        {:error, status, message}

      {:ok, media} ->
        src_url = mget(media, :decoded_url)
        matched = maybe_apply(StreamVault.Core, :find_catalog_item_by_stream_url, [src_url], nil)

        if trusted_remote_url?(src_url, matched) do
          {:ok, media, src_url, matched}
        else
          {:error, 403, "Remote media host is not allowed for browser playback"}
        end
    end
  end

  defp read_remote_url(conn, names) do
    found =
      Enum.find_value(names, fn name ->
        raw = raw_query_param(conn.query_string, name)
        value = if is_nil(raw), do: query_param(conn, name), else: raw
        if value in [nil, ""], do: nil, else: {name, to_string(value)}
      end)

    case found do
      nil ->
        {:error, 400, "Missing #{Enum.join(names, " or ")} parameter"}

      {name, requested_url} ->
        decoded =
          requested_url |> String.replace("+", "%20") |> safe_uri_decode() |> String.trim()

        try do
          normalized = sv_assert_http_url(decoded)

          if live_media_source?(normalized) do
            {:error, 400, "Live TV sources are blocked for media playback"}
          else
            {:ok, %{param: name, requested_url: requested_url, decoded_url: normalized}}
          end
        rescue
          _ ->
            case URI.parse(decoded).scheme do
              scheme when is_binary(scheme) and scheme not in ["http", "https"] ->
                {:error, 400, "Only HTTP/HTTPS media URLs are supported"}

              _ ->
                {:error, 400, "Invalid media URL"}
            end
        end
    end
  end

  defp raw_query_param(query_string, name) do
    Enum.find_value(String.split(query_string || "", "&", trim: false), fn part ->
      case String.split(part, "=", parts: 2) do
        [raw_key, raw_value] -> if safe_uri_decode(raw_key) == name, do: raw_value, else: nil
        [raw_key] -> if safe_uri_decode(raw_key) == name, do: "", else: nil
      end
    end)
  end

  defp trusted_remote_url?(_url, matched) when not is_nil(matched), do: true

  defp trusted_remote_url?(url, nil) do
    host = URI.parse(url).host |> js_string_or_empty() |> String.downcase()

    Regex.match?(~r/^172\.16\.50\.\d{1,3}$/, host) or
      Regex.match?(~r/^172\.22\.\d{1,3}\.\d{1,3}$/, host) or
      Regex.match?(~r/^server[\w-]*\.ftpbd\.net$/i, host)
  end

  defp live_media_source?(url) do
    uri = URI.parse(url)
    path = String.downcase(uri.path || "")
    lower = String.downcase(url)

    path_parts =
      path
      |> String.split("/", trim: true)
      |> Enum.map(&(safe_uri_decode(&1) |> String.downcase()))

    direct =
      String.starts_with?(path, "/live/") or String.starts_with?(path, "/live-relay/") or
        String.contains?(lower, "/live/") or String.contains?(lower, "/live-relay/") or
        String.contains?(lower, "playlist.m3u8") or
        Regex.match?(~r/\btsports(?:hd)?\b|t[ ._-]*sports/i, url)

    direct or
      Enum.any?(channels(), fn channel ->
        id = mget(channel, :id, "") |> js_string_or_empty() |> String.trim() |> String.downcase()

        name =
          mget(channel, :name, "") |> js_string_or_empty() |> String.trim() |> String.downcase()

        urls = [
          mget(channel, :url)
          | mget(channel, :fallbackUrls, mget(channel, :fallback_urls, [])) || []
        ]

        (id != "" and id in path_parts) or
          (name == "t sports" and Regex.match?(~r/t[ ._-]*sports/i, url)) or
          Enum.any?(urls, fn candidate ->
            normalized = normalize_guard_url(candidate) |> String.downcase()
            target = normalize_guard_url(url) |> String.downcase()

            normalized != "" and
              (target == normalized or String.starts_with?(target, normalized <> "?"))
          end)
      end)
  end

  defp normalize_guard_url(value) do
    try do
      sv_assert_http_url(safe_uri_decode(js_string_or_empty(value)))
    rescue
      _ -> js_string_or_empty(value) |> String.trim()
    end
  end

  defp playback_audio_selection(query) do
    absolute = JS.parse_int(Map.get(query, "audioStream", ""), 10)
    relative = JS.parse_int(Map.get(query, "audio", "0"), 10)
    audio_idx = if is_integer(relative), do: max(0, relative), else: 0
    has_absolute = is_integer(absolute) and absolute >= 0

    %{
      audio_idx: audio_idx,
      audio_stream_idx: if(has_absolute, do: absolute, else: nil),
      audio_map: if(has_absolute, do: "0:#{absolute}", else: "0:a:#{audio_idx}?"),
      source: if(has_absolute, do: "absolute-stream", else: "relative-audio")
    }
  end

  defp resolve_kghk_hls_audio(input, label) do
    maybe_apply(
      StreamVault.Core,
      :resolve_kho_gaye_hum_kahan_hls_audio,
      [input, label],
      playback_audio_selection(%{})
      |> Map.put(:audio_map, "0:a:0?")
      |> Map.put(:source, "kghk-hls-audio-pending")
    )
  end

  defp resolve_playback_audio(conn, input, label) do
    if function_exported?(StreamVault.Core, :resolve_playback_audio_selection, 3) do
      apply(StreamVault.Core, :resolve_playback_audio_selection, [conn, input, label])
    else
      playback_audio_selection(conn.query_params)
    end
  end

  defp playback_start(conn) do
    value = JS.parse_float(query_param(conn, "start", "undefined"))
    if is_number(value), do: max(0, value), else: 0
  end

  defp is_kghk_title(values) do
    Enum.any?(values, fn value ->
      title =
        value
        |> js_string_or_empty()
        |> String.split(~r/[?#]/)
        |> List.first()
        |> String.replace(~r/\.[a-z0-9]{2,5}$/i, "")
        |> String.replace(~r/[._-]+/, " ")
        |> String.replace(~r/\s+/, " ")
        |> String.trim()

      Regex.match?(~r/^kho gaye hum kahan(?:\s*[\[(]?2023[\])]?|\s|$)/i, title)
    end)
  end

  defp remote_compatibility_traits(url) do
    fallback = fn ->
      label = safe_uri_decode(js_string_or_empty(url)) |> String.downcase()
      named_4k = Regex.match?(~r/(?:^|[^a-z0-9])(?:2160p|4k|uhd)(?:[^a-z0-9]|$)/i, label)
      hevc = Regex.match?(~r/(?:hevc|h[.\s-]?265|x265)/i, label)

      ten_bit =
        Regex.match?(
          ~r/(?:10[\s-]?bit|hdr10|hdr|dolby[\s._-]?vision|\bdv\b|main[\s._-]?10|p010)/i,
          label
        )

      %{
        named4k: named_4k,
        isHevc: hevc,
        isTenBitHdr: ten_bit,
        heavy4kHevc: named_4k and hevc,
        heavy4kHevcHdr: named_4k and hevc and ten_bit
      }
    end

    maybe_apply(StreamVault.Core, :remote_compatibility_traits, [url], fallback.())
  end

  defp compatibility_seek_profile(input) do
    compatibility_seek_profile_for_source(input, %{
      compatibility_transcode: true,
      mobile_playback: false
    })
  end

  defp remote_filename(url) do
    fallback = fn ->
      path = URI.parse(url).path || url

      path
      |> String.split("/")
      |> List.last()
      |> safe_uri_decode()
      |> case do
        "" -> "remote media"
        value -> value
      end
    end

    maybe_apply(StreamVault.Core, :remote_filename, [url], fallback.())
  end

  defp catalog_log_label(nil), do: "none"

  defp catalog_log_label(item) do
    maybe_apply(
      StreamVault.Core,
      :catalog_log_label,
      [item],
      "#{mget(item, :type)}: #{mget(item, :title) || mget(item, :filename) || "unknown"}"
    )
  end

  defp entry_path(entry), do: Path.join(mget(entry, :dir), mget(entry, :file))
  defp channels, do: State.get(:channels, [])
  defp file_index, do: State.get(:file_index, [])

  defp tracker_stream_start(ip, id, name, type, user_agent) do
    if function_exported?(StreamVault.Tracker, :track_stream_start, 5),
      do: apply(StreamVault.Tracker, :track_stream_start, [ip, id, name, type, user_agent])
  rescue
    _ -> :ok
  end

  defp express_send(conn, body, status) do
    conn
    |> Plug.Conn.put_resp_header("content-type", "text/html; charset=utf-8")
    |> Plug.Conn.send_resp(status, body)
  end

  defp end_response(conn, body, status), do: Plug.Conn.send_resp(conn, status, body)

  defp query_param(conn, key, default \\ nil), do: Map.get(conn.query_params, key, default)

  defp path_param(conn, key),
    do:
      Map.get(conn.path_params, key) || Map.get(conn.params, key) ||
        Map.get(conn.path_params, Macro.underscore(key)) ||
        Map.get(conn.params, Macro.underscore(key))

  defp request_header(conn, key) do
    case Plug.Conn.get_req_header(conn, key) do
      [value | _] -> value
      _ -> ""
    end
  end

  defp forwarded_ip(conn) do
    request_header(conn, "x-forwarded-for")
    |> case do
      "" -> conn.remote_ip |> :inet.ntoa() |> to_string()
      value -> value
    end
    |> String.split(",")
    |> List.first()
    |> String.trim()
  rescue
    _ -> ""
  end

  defp mget(value, key, default \\ nil)
  defp mget(nil, _key, default), do: default

  defp mget(map, key, default) when is_map(map),
    do: Map.get(map, key, Map.get(map, to_string(key), default))

  defp mget(list, key, default) when is_list(list), do: Keyword.get(list, key, default)
  defp mget(_, _, default), do: default

  defp update_named_session(state_key, key, function) do
    State.update(state_key, %{}, fn sessions ->
      case Map.get(sessions, key) do
        nil -> sessions
        session -> Map.put(sessions, key, function.(session))
      end
    end)
  end

  defp maybe_apply(module, function, arguments, default) do
    if Code.ensure_loaded?(module) and function_exported?(module, function, length(arguments)),
      do: apply(module, function, arguments),
      else: default
  end

  defp split_session_id(session_id) do
    case String.split(session_id, ":", parts: 2) do
      [scope, key] -> {scope, key}
      [scope] -> {scope, ""}
    end
  end

  defp normalize_response_headers(headers),
    do: Map.new(headers, fn {key, value} -> {String.downcase(key), value} end)

  defp optional_header(headers, _name, value) when value in [nil, false, "", 0], do: headers
  defp optional_header(headers, name, value), do: headers ++ [{name, to_string(value)}]
  defp nil_to_zero(nil), do: 0
  defp nil_to_zero(value), do: value
  defp js_string_or_empty(nil), do: ""
  defp js_string_or_empty(value), do: to_string(value)

  defp js_number_or(value, fallback) do
    case JS.number(value) do
      :nan -> fallback
      number -> number * 1.0
    end
  end

  defp format_number(number) when is_integer(number), do: Integer.to_string(number)

  defp format_number(number) when is_float(number) and trunc(number) == number,
    do: Integer.to_string(trunc(number))

  defp format_number(number) when is_float(number),
    do: :erlang.float_to_binary(number, [:compact, decimals: 6])

  defp format_number(value), do: to_string(value)
  defp format_error(%{message: message}) when is_binary(message), do: message
  defp format_error(error) when is_exception(error), do: Exception.message(error)
  defp format_error(error), do: inspect(error)
  defp pad2(value), do: value |> Integer.to_string() |> String.pad_leading(2, "0")

  defp random_hex(count),
    do:
      :crypto.strong_rand_bytes(div(count + 1, 2))
      |> Base.encode16(case: :lower)
      |> binary_part(0, count)

  defp tail_bytes(value, count) when byte_size(value) <= count, do: value
  defp tail_bytes(value, count), do: binary_part(value, byte_size(value) - count, count)

  defp safe_uri_decode(value) do
    URI.decode(value)
  rescue
    _ -> value
  end

  defp process_alive?(pid) when is_pid(pid), do: Process.alive?(pid)
  defp process_alive?(_), do: false
end

defmodule StreamVault.Content do
  @moduledoc false
  alias StreamVault.{Core, Files, HTTP, Paths, Response, State}

  @title_details_cache_ms 6 * 60 * 60 * 1000
  @boot_search_version "20260624-playable-only-search1"
  @tmdb_img "https://image.tmdb.org/t/p"
  @home_min_prebuilt_items 8
  @dynamic_home_keys MapSet.new(["warner", "hbo"])
  @franchise_tokens MapSet.new(
                      ~w(avengers batman superman spiderman spider thor hulk marvel dune witcher matrix hobbit potter jurassic avatar deadpool wolverine terminator alien predator conjuring transformers godzilla kong bourne bond creed rocky furious pirates starwars trek)
                    )
  @tmdb_genres %{
    28 => "Action",
    12 => "Adventure",
    16 => "Animation",
    35 => "Comedy",
    80 => "Crime",
    99 => "Documentary",
    18 => "Drama",
    10751 => "Family",
    14 => "Fantasy",
    36 => "History",
    27 => "Horror",
    10402 => "Music",
    9648 => "Mystery",
    10749 => "Romance",
    878 => "Sci-Fi",
    53 => "Thriller",
    10752 => "War",
    37 => "Western",
    10759 => "Action & Adventure",
    10762 => "Kids",
    10763 => "News",
    10764 => "Reality",
    10765 => "Sci-Fi & Fantasy",
    10766 => "Soap",
    10767 => "Talk",
    10768 => "War & Politics"
  }

  @home_sections [
    ["netflixRow", "netflix", "Netflix Originals"],
    ["marvelRow", "marvel", "Marvel Studios"],
    ["dcRow", "dc", "DC"],
    ["universalRow", "universal", "Universal Pictures"],
    ["disneyRow", "disney", "Disney"],
    ["warnerRow", "warner", "Warner Bros"],
    ["hboRow", "hbo", "HBO"],
    ["appleTvRow", "apple", "Apple TV+"],
    ["indianRow", "indian", "Indian Movies & Drama"],
    ["animeRow", "anime", "Anime"],
    ["koreanRow", "koreanDrama", "Korean Drama"],
    ["horrorRow", "horrorNights", "Horror Nights"],
    ["scifiRow", "cyberpunkScifi", "Cyberpunk & Sci-Fi"],
    ["mindfuckRow", "mindfuck", "Mindfuck Movies"],
    ["cultClassicsRow", "cultClassics", "Cult Classics"],
    ["a24Row", "a24", "A24 Collection"],
    ["nostalgia90sRow", "nostalgia90s", "90s Nostalgia"],
    ["midnightCinemaRow", "midnightCinema", "Midnight Cinema"],
    ["trueCrimeRow", "trueCrime", "True Crime"],
    ["thrillerRow", "psychThriller", "Psychological Thriller"],
    ["adultAnimationRow", "adultAnimation", "Adult Animation"],
    ["postApocalypticRow", "postApocalyptic", "Post-Apocalyptic"],
    ["feelGoodRow", "feelGood", "Feel Good Movies"],
    ["darkComedyRow", "darkComedy", "Dark Comedy"],
    ["timeTravelRow", "timeTravel", "Time Travel"],
    ["spaceAiRow", "spaceAi", "Space & AI"],
    ["crimeRow", "crimeSyndicates", "Crime Syndicates"],
    ["zombieRow", "zombie", "Zombie Universe"],
    ["indieGemsRow", "indieGems", "Indie Gems"],
    ["hiddenMasterpiecesRow", "hiddenMasterpieces", "Hidden Masterpieces"],
    ["liveConcertsRow", "liveConcerts", "Live Concerts"],
    ["documentaryRow", "documentaryVault", "Documentary Vault"],
    ["ghibliRow", "ghibli", "Studio Ghibli"],
    ["romanticRow", "romanceMidnight", "Romance After Midnight"],
    ["comingSoonRow", "comingSoon", "Coming Soon"],
    ["dramaRow", "drama", "Drama & Emotion"],
    ["spanishRow", "spanish", "Spanish & Latino"],
    ["highRatedRow", "topRated", "ÃƒÂ¢Ã‚Â­Ã‚Â Top Rated (8+)"],
    ["allRow", "allMovies", "All Movies"],
    ["recentlyAddedRow", "recentlyAdded", "Recently Added"],
    ["mostWatchedTodayRow", "mostWatchedToday", "Most Watched Today"],
    ["trendingRow", "trending", "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â¥ Trending Now"],
    ["seriesRow", "series", "Series"],
    ["newRow", "new", "New to StreamVault"]
  ]

  def initialize_state do
    if not State.get(:content_initialized, false) do
      feed = Files.read_json(Paths.home_feed(), nil)

      rows =
        list(g(feed, "rows"))
        |> Enum.filter(&(truthy(g(&1, "rowId")) and is_list(g(&1, "items"))))
        |> Map.new(&{g(&1, "rowId"), &1})

      ep_cache = Files.read_json(Paths.episode_cache(), %{}) |> map()

      disk =
        if System.get_env("DEBUG_DETAIL_RESET") == "1",
          do: %{},
          else: Files.read_json(Paths.detail_cache(), %{}) |> map()

      if System.get_env("DEBUG_DETAIL_RESET") == "1",
        do: Files.write_json(Paths.detail_cache(), %{}, false)

      State.put(:prebuilt_home_feed, feed)
      State.put(:prebuilt_home_rows, rows)
      State.put(:ep_title_cache, ep_cache)
      State.put(:disk_detail_cache, disk)
      State.put(:title_details_cache, %{})
      State.put(:title_detail_refresh_jobs, MapSet.new())
      State.put(:content_initialized, true)
    end

    :ok
  end

  # JavaScript source: allApiMoviesForDetails()
  def all_api_movies_for_details do
    local = Core.movie_list() || Core.build_movie_list_sync()

    ftp =
      Core.get_cached_movies()
      |> Enum.reject(&Core.is_cartoon_or_anime/1)
      |> Enum.with_index()
      |> Enum.map(fn {movie, index} ->
        %{
          "id" => "ftp_#{index}",
          "name" => g(movie, "title"),
          "file" => g(movie, "filename"),
          "poster" => js_or(g(movie, "poster"), nil),
          "backdrop" => js_or(g(movie, "backdrop"), js_or(g(movie, "poster"), nil)),
          "tmdbId" => js_or(g(movie, "tmdbId"), nil),
          "imdbId" => js_or(g(movie, "imdbId"), ""),
          "overview" => js_or(g(movie, "overview"), ""),
          "year" => js_or(g(movie, "year"), ""),
          "rating" => js_or(g(movie, "rating"), nil),
          "type" => "movie",
          "genre" => js_or(g(movie, "genre"), ""),
          "category" => js_or(g(movie, "category"), ""),
          "runtime" => js_or(g(movie, "runtime"), ""),
          "director" => js_or(g(movie, "director"), ""),
          "language" => js_or(g(movie, "language"), ""),
          "productionCompanies" => js_or(g(movie, "productionCompanies"), []),
          "streamUrl" => g(movie, "streamUrl"),
          "isFtp" => true
        }
      end)

    seen = MapSet.new(Enum.map(local, &g(&1, "name")))
    local ++ Enum.reject(ftp, &MapSet.member?(seen, g(&1, "name")))
  end

  # JavaScript source: allApiSeriesForDetails()
  def all_api_series_for_details do
    local = Core.series_list() || Core.build_series_list_sync()

    ftp =
      Core.get_cached_series()
      |> Enum.reject(&Core.is_cartoon_or_anime/1)
      |> Enum.with_index()
      |> Enum.map(fn {show, index} ->
        seasons =
          list(g(show, "seasons"))
          |> Enum.reduce(%{}, fn season, acc ->
            number = first_digits(g(season, "season"), 1)

            episodes =
              list(g(season, "episodes"))
              |> Enum.with_index()
              |> Enum.map(fn {episode, i} ->
                parsed = Core.parse_series_filename(g(episode, "filename"))
                ep = js_or(g(parsed, "episode"), i + 1)

                %{
                  "streamId" => nil,
                  "episode" => ep,
                  "epTitle" => js_or(trim(g(parsed, "epTitle")), "Episode #{ep}"),
                  "file" => g(episode, "filename"),
                  "streamUrl" => g(episode, "streamUrl"),
                  "thumb" => js_or(g(episode, "thumb"), js_or(g(episode, "thumbnail"), nil)),
                  "overview" => js_or(g(episode, "overview"), ""),
                  "isFtp" => true
                }
              end)

            Map.put(acc, number, episodes)
          end)

        %{
          "id" => "ftp_series_#{index}",
          "name" => g(show, "title"),
          "poster" => js_or(g(show, "poster"), nil),
          "backdrop" => js_or(g(show, "backdrop"), js_or(g(show, "poster"), nil)),
          "tmdbId" => js_or(g(show, "tmdbId"), nil),
          "imdbId" => js_or(g(show, "imdbId"), ""),
          "overview" => js_or(g(show, "overview"), ""),
          "year" => js_or(g(show, "year"), ""),
          "rating" => js_or(g(show, "rating"), nil),
          "genre" => js_or(g(show, "genre"), ""),
          "category" => js_or(g(show, "category"), ""),
          "language" => js_or(g(show, "language"), ""),
          "productionCompanies" => js_or(g(show, "productionCompanies"), []),
          "isFtp" => true,
          "seasons" => seasons
        }
      end)

    seen = MapSet.new(Enum.map(local, &g(&1, "name")))
    local ++ Enum.reject(ftp, &MapSet.member?(seen, g(&1, "name")))
  end

  # JavaScript source: splitDetailGenres(value)
  def split_detail_genres(value),
    do:
      value
      |> js_or("")
      |> str()
      |> String.split(~r/[,\/|]/)
      |> Enum.map(&(String.trim(&1) |> String.downcase()))
      |> Enum.reject(&(&1 == ""))

  # JavaScript source: normalizeDetailTitle(title, fallbackYear = '')
  def normalize_detail_title(title, fallback_year \\ "") do
    raw =
      title
      |> js_or("")
      |> str()
      |> String.replace(~r/\.[a-z0-9]{2,5}$/i, " ")
      |> String.replace(~r/[._]+/, " ")
      |> spaces()

    year = year_from(fallback_year)

    {raw, year} =
      case Regex.run(~r/[\(\[\{]\s*((?:19|20)\d{2})\s*(?:[-â€“]\s*)?[\)\]\}]?/, raw) do
        [whole, found] -> {String.replace(raw, whole, " "), if(year == "", do: found, else: year)}
        _ -> {raw, year}
      end

    year = if year == "", do: year_from(raw), else: year

    clean =
      raw
      |> String.replace(~r/\bS\d{1,2}E\d{1,3}\b/i, " ")
      |> String.replace(
        ~r/\[[^\]]*\]|\([^\)]*(?:Hindi|English|Dual Audio|Audio|ESub|MSubs|WEBRip|BluRay|x264|x265|HEVC|AAC|NF|AMZN|HMAX|DSNP|WEB-DL|HDRip|BRRip)[^\)]*\)/i,
        " "
      )
      |> String.replace(
        ~r/\b(2160p|1080p|720p|540p|480p|4k|uhd|hdr|webrip|web-rip|webdl|web-dl|bluray|brrip|hdrip|hdtv|dvdrip|x264|x265|hevc|aac|dts|ddp?5\.1|5\.1|7\.1|nf|amzn|hmax|dsnp|itunes|mkv|mkvC|mkvCinemas|msmod|pahe|rarbg|yts|galaxyrg|esub|msubs|dual audio|multi audio|hindi|english|bengali|bangla)\b.*$/i,
        " "
      )
      |> String.replace(~r/\b((?:19|20)\d{2})\b/, " ")
      |> String.replace(~r/[^\p{L}\p{N}:'&!?, -]+/u, " ")
      |> spaces()

    %{"title" => clean, "year" => year}
  end

  # JavaScript source: normalizedTitleKey(value)
  def normalized_title_key(value),
    do: Core.sv_normalize_search_text(g(normalize_detail_title(value), "title"))

  # JavaScript source: looseTitleScore(a, b)
  def loose_title_score(a, b) do
    aw = title_words(a, 2)
    bw = title_words(b, 2)

    if MapSet.size(aw) == 0 or MapSet.size(bw) == 0,
      do: 0,
      else:
        MapSet.intersection(aw, bw)
        |> MapSet.size()
        |> Kernel./(max(MapSet.size(aw), MapSet.size(bw)))
  end

  # JavaScript source: svServerPlayableItem(item, mediaType = '')
  def sv_server_playable_item(item, media_type \\ "") do
    if is_nil(item) or g(item, "streamAvailable") == false or g(item, "hasStream") == false do
      false
    else
      type =
        if media_type in ["tv", "series"] or g(item, "type") in ["tv", "series"] or
             truthy(g(item, "seasons")), do: "tv", else: "movie"

      id = str(g(item, "id", ""))

      cond do
        Regex.match?(~r/^tmdb(?:_tv)?_/i, id) and not truthy(g(item, "streamUrl")) ->
          false

        type == "tv" ->
          Enum.any?(map(g(item, "seasons")), fn {_k, eps} ->
            Enum.any?(list(eps), &(truthy(g(&1, "streamUrl")) or not is_nil(g(&1, "streamId"))))
          end) or g(item, "hasStream") == true or g(item, "streamAvailable") == true or
            (truthy(g(item, "isFtp")) and truthy(js_nullish(g(item, "id"), g(item, "name"))))

        true ->
          truthy(g(item, "streamUrl")) or g(item, "hasStream") == true or
            g(item, "streamAvailable") == true or
            (not is_nil(g(item, "id")) and not Regex.match?(~r/^tmdb_/i, id))
      end
    end
  end

  # JavaScript source: svDetailCatalogIndex()
  def detail_catalog_index do
    initialize_state()

    case State.get(:detail_catalog_index) do
      nil ->
        boot = Core.sv_get_boot_search_index()
        items = list(g(boot, "items"))

        index = %{
          "movie" =>
            build_detail_index(Enum.reject(items, &(g(&1, "type") == "series")), "movie"),
          "tv" => build_detail_index(Enum.filter(items, &(g(&1, "type") == "series")), "tv")
        }

        State.put(:detail_catalog_index, index)
        index

      index ->
        index
    end
  end

  # JavaScript source: svDetailItemIdentity(item, type)
  def sv_detail_item_identity(item, type),
    do:
      [
        type,
        js_or(g(item, "tmdbId"), ""),
        js_nullish(g(item, "id"), ""),
        normalized_title_key(
          js_or(g(item, "name"), js_or(g(item, "title"), js_or(g(item, "file"), "")))
        ),
        playback_title_year(
          js_or(g(item, "year"), js_or(g(item, "name"), js_or(g(item, "title"), "")))
        )
      ]
      |> Enum.map(&str/1)
      |> Enum.join("|")

  # JavaScript source: svDetailTitleTokens(value)
  def sv_detail_title_tokens(value) do
    stop =
      MapSet.new(~w(the and for from with part movie series season episode one two three last))

    normalized_title_key(value)
    |> String.split(~r/\s+/, trim: true)
    |> Enum.filter(&(String.length(&1) > 2 and not MapSet.member?(stop, &1)))
  end

  # JavaScript source: svDetailComparableTitle(value)
  def sv_detail_comparable_title(value),
    do:
      normalized_title_key(value)
      |> String.replace(~r/\b(?:tv|mini|web)?\s*series\b/, " ")
      |> String.replace(~r/\b(?:19|20)\d{2}\b/, " ")
      |> String.replace(
        ~r/\b(?:2160p|1080p|720p|540p|480p|4k|uhd|dual|multi|audio|hindi|english)\b/,
        " "
      )
      |> spaces()

  # JavaScript source: svResolvePlayableDetailRecommendations(seed, mediaType, externalItems = [], limit = 18)
  def sv_resolve_playable_detail_recommendations(
        seed,
        media_type,
        external_items \\ [],
        limit \\ 18
      ) do
    type = if media_type == "tv", do: "tv", else: "movie"
    index = g(detail_catalog_index(), type, %{})
    identity = sv_detail_item_identity(seed, type)
    current_title = normalized_title_key(js_or(g(seed, "name"), js_or(g(seed, "title"), "")))

    current_year =
      playback_title_year(
        js_or(g(seed, "year"), js_or(g(seed, "name"), js_or(g(seed, "title"), "")))
      )

    comparable = sv_detail_comparable_title(js_or(g(seed, "name"), js_or(g(seed, "title"), "")))
    genres = split_detail_genres(js_or(g(seed, "genre"), g(seed, "genres")))
    seed_year = number_or(current_year, 0)
    category = trim_lower(g(seed, "category"))
    language = trim_lower(g(seed, "language"))

    tokens =
      MapSet.new(sv_detail_title_tokens(js_or(g(seed, "name"), js_or(g(seed, "title"), ""))))

    state = {[], MapSet.new([identity])}
    franchise = Enum.filter(tokens, &MapSet.member?(@franchise_tokens, &1))

    franchise_rows =
      franchise
      |> Enum.flat_map(&list(g(index, ["tokenMap", &1])))
      |> uniq_terms()
      |> Enum.map(fn row -> {row, Enum.count(list(g(row, "tokens")), &(&1 in franchise))} end)
      |> Enum.filter(&(elem(&1, 1) > 0))
      |> Enum.sort_by(fn {row, score} -> {-score, -number_or(g(row, ["item", "rating"]), 0)} end)
      |> Enum.take(8)
      |> Enum.map(&g(elem(&1, 0), "item"))

    state =
      add_recommendations(
        state,
        franchise_rows,
        seed,
        type,
        current_title,
        current_year,
        comparable,
        limit
      )

    external =
      list(external_items)
      |> Enum.with_index()
      |> Enum.flat_map(fn {candidate, position} ->
        title =
          normalized_title_key(js_or(g(candidate, "name"), js_or(g(candidate, "title"), "")))

        year =
          playback_title_year(
            js_or(
              g(candidate, "year"),
              js_or(g(candidate, "release_date"), js_or(g(candidate, "first_air_date"), ""))
            )
          )

        match = g(index, ["exact", "#{title}|#{year}"]) || g(index, ["exact", title])

        if match do
          candidate_genres = split_detail_genres(js_or(g(candidate, "genre"), g(match, "genre")))

          candidate_tokens =
            sv_detail_title_tokens(js_or(g(candidate, "name"), js_or(g(candidate, "title"), "")))

          candidate_year = number_or(year, 0)

          score =
            max(0, 8 - position * 0.25) + genre_overlap(candidate_genres, genres) * 12 +
              Enum.count(candidate_tokens, &MapSet.member?(tokens, &1)) * 25

          score =
            score + year_bonus(seed_year, candidate_year, [{2, 5}, {5, 3}]) +
              min(number_or(g(match, "rating"), 0), 10) / 10

          [{match, score}]
        else
          []
        end
      end)
      |> Enum.sort_by(&(-elem(&1, 1)))
      |> Enum.take(12)
      |> Enum.map(&elem(&1, 0))

    state =
      add_recommendations(
        state,
        external,
        seed,
        type,
        current_title,
        current_year,
        comparable,
        limit
      )

    if length(elem(state, 0)) >= limit do
      Enum.take(elem(state, 0), limit)
    else
      candidates = MapSet.new()

      candidates =
        Enum.reduce(genres, candidates, fn genre, set ->
          Enum.reduce(
            Enum.take(list(g(index, ["genreMap", genre])), 200),
            set,
            &MapSet.put(&2, &1)
          )
        end)

      candidates =
        Enum.reduce(tokens, candidates, fn token, set ->
          Enum.reduce(
            Enum.take(list(g(index, ["tokenMap", token])), 120),
            set,
            &MapSet.put(&2, &1)
          )
        end)

      candidates =
        if seed_year > 0,
          do:
            Enum.reduce((seed_year - 10)..(seed_year + 10), candidates, fn year, set ->
              Enum.reduce(
                Enum.take(list(g(index, ["yearMap", str(year)])), 35),
                set,
                &MapSet.put(&2, &1)
              )
            end),
          else: candidates

      candidates =
        if MapSet.size(candidates) < limit * 3,
          do:
            candidates
            |> add_rows(Enum.take(list(g(index, ["categoryMap", category])), 180))
            |> add_rows(Enum.take(list(g(index, ["languageMap", language])), 120)),
          else: candidates

      candidates =
        if MapSet.size(candidates) < limit * 2,
          do: add_rows(candidates, list(g(index, "top"))),
          else: candidates

      seen = elem(state, 1)

      scored =
        candidates
        |> Enum.reject(&MapSet.member?(seen, sv_detail_item_identity(g(&1, "item"), type)))
        |> Enum.map(fn row ->
          item = g(row, "item")
          row_genres = list(g(row, "genres"))
          row_tokens = list(g(row, "tokens"))
          row_year = number_or(g(row, "year"), 0)

          relation =
            genre_overlap(row_genres, genres) * 12 +
              Enum.count(row_tokens, &MapSet.member?(tokens, &1)) * 10 +
              year_bonus(seed_year, row_year, [{2, 5}, {5, 3}, {10, 1}])

          relation =
            relation +
              if(category != "" and trim_lower(g(item, "category")) == category, do: 3, else: 0) +
              if(language != "" and trim_lower(g(item, "language")) == language, do: 2, else: 0)

          score =
            relation + number_or(g(row, "rating"), 0) / 10 +
              if(truthy(g(item, "poster")) or truthy(g(item, "backdrop")), do: 0.5, else: 0)

          {item, score, relation}
        end)
        |> Enum.filter(&(elem(&1, 2) > 0))
        |> Enum.sort_by(fn {item, score, _} -> {-score, -number_or(g(item, "rating"), 0)} end)
        |> Enum.map(&elem(&1, 0))

      add_recommendations(
        state,
        scored,
        seed,
        type,
        current_title,
        current_year,
        comparable,
        limit
      )
      |> elem(0)
      |> Enum.take(limit)
    end
  end

  # JavaScript source: playbackTitleYear(value)
  def playback_title_year(value), do: year_from(value)

  # JavaScript source: findPlaybackCatalogItem(items, requestedId, requestedTitle, requestedYear, isPlayable)
  def find_playback_catalog_item(
        items,
        requested_id,
        requested_title,
        requested_year,
        is_playable
      ) do
    available = list(items) |> Enum.filter(&(not is_nil(&1) and is_playable.(&1)))
    id = trim(requested_id)
    title = trim(requested_title)
    year = playback_title_year(js_or(requested_year, title))

    cond do
      title != "" ->
        key = normalized_title_key(title)

        exact =
          Enum.filter(
            available,
            &(normalized_title_key(js_or(g(&1, "name"), js_or(g(&1, "title"), g(&1, "file")))) ==
                key)
          )

        if exact == [], do: nil, else: begin_pool(exact, year, id)

      id == "" ->
        nil

      true ->
        Enum.find(
          available,
          &(str(js_or(g(&1, "id"), "")) == id or str(js_or(g(&1, "tmdbId"), "")) == id)
        )
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:6404 GET /api/playback/movie/:id
  def route_playback_movie(conn, id) do
    conn = Plug.Conn.fetch_query_params(conn)

    movie =
      find_playback_catalog_item(
        all_api_movies_for_details(),
        id,
        g(conn.query_params, "title"),
        g(conn.query_params, "year"),
        &truthy(g(&1, "streamUrl"))
      )

    if is_nil(movie),
      do:
        Response.json_error(
          conn,
          404,
          "MOVIE_PLAYBACK_NOT_FOUND",
          "Playable movie source was not found"
        ),
      else:
        conn
        |> Plug.Conn.put_resp_header("cache-control", "private, max-age=300")
        |> Response.json(%{
          "ok" => true,
          "id" => id,
          "title" => js_or(g(movie, "name"), js_or(g(movie, "title"), "")),
          "streamUrl" => g(movie, "streamUrl"),
          "isFtp" => true,
          "streamAvailable" => true,
          "hasStream" => true
        })
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:6427 GET /api/series/detail
  def route_series_detail(conn) do
    conn = Plug.Conn.fetch_query_params(conn)

    playable = fn item ->
      Enum.any?(map(g(item, "seasons")), fn {_k, eps} ->
        Enum.any?(list(eps), &(truthy(g(&1, "streamUrl")) or not is_nil(g(&1, "streamId"))))
      end)
    end

    show =
      find_playback_catalog_item(
        all_api_series_for_details(),
        g(conn.query_params, "id"),
        js_or(g(conn.query_params, "name"), g(conn.query_params, "title")),
        g(conn.query_params, "year"),
        playable
      )

    if is_nil(show) do
      Response.json_error(
        conn,
        404,
        "SERIES_PLAYBACK_NOT_FOUND",
        "Playable series episodes were not found"
      )
    else
      seasons = map(g(show, "seasons"))
      count = Enum.reduce(seasons, 0, fn {_k, eps}, n -> n + length(list(eps)) end)

      data =
        map(show)
        |> Map.merge(%{
          "id" => js_or(g(conn.query_params, "id"), g(show, "id")),
          "type" => "series",
          "isFtp" => truthy(g(show, "isFtp")),
          "isSummary" => false,
          "streamAvailable" => count > 0,
          "hasStream" => count > 0,
          "seasonCount" => map_size(seasons),
          "episodeCount" => count
        })

      conn
      |> Plug.Conn.put_resp_header("cache-control", "private, max-age=300")
      |> Response.json(data)
    end
  end

  # JavaScript source: localSimilarForDetails(item, mediaType)
  def local_similar_for_details(item, media_type),
    do: sv_resolve_playable_detail_recommendations(item, media_type, [], 18)

  # JavaScript source: localDirectorForDetails(item)
  def local_director_for_details(item) do
    director = trim_lower(g(item, "director"))

    if director == "",
      do: [],
      else:
        all_api_movies_for_details()
        |> Enum.filter(
          &(&1 != item and sv_server_playable_item(&1, "movie") and
              trim_lower(g(&1, "director")) == director)
        )
        |> Enum.take(18)
  end

  # JavaScript source: localDetailsObject(item, mediaType, title = '', options = {})
  def local_details_object(item, media_type, title \\ "", options \\ %{}) do
    fallbacks = g(options, "generateFallbacks", true) != false

    companies =
      if is_list(g(item, "productionCompanies")),
        do:
          g(item, "productionCompanies")
          |> Enum.with_index()
          |> Enum.map(fn {company, i} ->
            if is_binary(company),
              do: %{"id" => i, "name" => company, "logo" => nil},
              else: company
          end)
          |> Enum.filter(&truthy(g(&1, "name"))),
        else: []

    similar =
      if fallbacks,
        do:
          sv_resolve_playable_detail_recommendations(
            item,
            media_type,
            if(is_list(g(item, "similar")), do: g(item, "similar"), else: []),
            18
          ),
        else: []

    director_items =
      if fallbacks,
        do:
          sv_resolve_playable_detail_recommendations(
            item,
            media_type,
            local_director_for_details(item),
            18
          ),
        else: []

    %{
      "ok" => true,
      "localOnly" => true,
      "type" => media_type,
      "id" => js_or(g(item, "id"), js_or(g(item, "name"), "")),
      "tmdbId" => js_or(g(item, "tmdbId"), nil),
      "imdbId" => js_or(g(item, "imdbId"), ""),
      "title" => js_or(g(item, "name"), title),
      "overview" => js_or(g(item, "overview"), ""),
      "poster" => js_or(g(item, "poster"), nil),
      "backdrop" => js_or(g(item, "backdrop"), js_or(g(item, "poster"), nil)),
      "year" => js_or(g(item, "year"), ""),
      "rating" => js_or(g(item, "rating"), nil),
      "runtime" => js_or(g(item, "runtime"), ""),
      "genres" => js_or(g(item, "genre"), ""),
      "language" => js_or(g(item, "language"), ""),
      "ratings" =>
        if(truthy(g(item, "rating")),
          do: [
            %{
              "source" => "Catalog",
              "value" => "#{g(item, "rating")}/10",
              "subvalue" => "Local cache",
              "available" => true
            }
          ],
          else: []
        ),
      "trailers" => list(g(item, "trailers")),
      "cast" => list(g(item, "cast")),
      "crew" => list(g(item, "crew")),
      "productionCompanies" => companies,
      "similar" => similar,
      "moreByDirector" => director_items,
      "director" => js_or(g(item, "director"), nil),
      "episodes" => if(media_type == "tv", do: js_or(g(item, "seasons"), %{}), else: []),
      "about" => [],
      "playbackInfo" => []
    }
  end

  # JavaScript source: svMergePlayableDetailData(item, mediaType, title, detailData, localOnly = false)
  def sv_merge_playable_detail_data(item, media_type, title, detail_data, local_only \\ false) do
    local = local_details_object(item, media_type, title, %{"generateFallbacks" => true})

    if not is_map(detail_data) do
      local
    else
      seed =
        map(item)
        |> Map.merge(%{
          "name" =>
            js_or(
              g(detail_data, "title"),
              js_or(g(local, "title"), js_or(g(item, "name"), title))
            ),
          "year" =>
            js_or(g(detail_data, "year"), js_or(g(local, "year"), js_or(g(item, "year"), ""))),
          "genre" =>
            js_or(
              g(detail_data, "genres"),
              js_or(g(local, "genres"), js_or(g(item, "genre"), ""))
            ),
          "language" =>
            js_or(
              g(detail_data, "language"),
              js_or(g(local, "language"), js_or(g(item, "language"), ""))
            )
        })

      local
      |> Map.merge(detail_data)
      |> Map.merge(%{
        "similar" =>
          sv_resolve_playable_detail_recommendations(
            seed,
            media_type,
            js_or(g(detail_data, "similar"), g(local, "similar")),
            18
          ),
        "moreByDirector" =>
          sv_resolve_playable_detail_recommendations(
            seed,
            media_type,
            js_or(g(detail_data, "moreByDirector"), g(local, "moreByDirector")),
            18
          ),
        "localOnly" => local_only
      })
    end
  end

  # JavaScript source: findLocalDetailItem(mediaType, rawId, title)
  def find_local_detail_item(media_type, raw_id, title) do
    id = raw_id |> js_or("") |> str() |> URI.decode() |> String.trim()

    source =
      if media_type == "tv", do: all_api_series_for_details(), else: all_api_movies_for_details()

    normalized = normalize_detail_title(js_or(title, ""))
    request_title = trim_lower(g(normalized, "title"))
    request_year = js_or(g(normalized, "year"), playback_title_year(title))

    exact =
      if request_title == "",
        do: [],
        else:
          Enum.filter(source, fn item ->
            normalize_detail_title(
              js_or(g(item, "name"), js_or(g(item, "title"), js_or(g(item, "file"), ""))),
              js_or(g(item, "year"), "")
            )
            |> g("title")
            |> trim_lower() == request_title
          end)

    cond do
      exact != [] ->
        begin_pool(exact, request_year, id)

      true ->
        Enum.find(
          source,
          &(id != "" and
              (str(js_or(g(&1, "id"), "")) == id or str(js_or(g(&1, "tmdbId"), "")) == id))
        ) || %{"id" => id, "name" => js_or(title, id), "type" => media_type}
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:6576 GET /api/details/debug
  def route_details_debug(conn) do
    initialize_state()
    matrix = tmdb_get("/movie/603?language=en-US")

    Response.json(conn, %{
      "ok" => true,
      "hasTmdbToken" => truthy(Core.tmdb_token()),
      "movies" => length(Core.movie_list() || []),
      "series" => length(Core.series_list() || []),
      "catalogMovies" => length(list(g(Core.ftp_catalog(), "movies"))),
      "catalogSeries" => length(list(g(Core.ftp_catalog(), "series"))),
      "cacheKeys" => map_size(State.get(:disk_detail_cache, %{})),
      "tmdbTestTitle" => js_or(g(matrix, "title"), nil)
    })
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:6590 GET /api/details/:type/:id
  def route_details(conn, raw_type, raw_id) do
    initialize_state()
    conn = Plug.Conn.fetch_query_params(conn)
    query = conn.query_params

    media_type =
      if String.downcase(str(js_or(raw_type, ""))) in ["tv", "series", "show"],
        do: "tv",
        else: "movie"

    normalized =
      normalize_detail_title(
        js_or(g(query, "title"), js_or(g(query, "name"), js_or(raw_id, ""))),
        js_or(g(query, "year"), "")
      )

    item = find_local_detail_item(media_type, raw_id, g(normalized, "title"))
    requested = tmdb_id_from_request(Map.put(query, "id", raw_id), media_type)

    tmdb_id =
      js_or(
        requested,
        if(Regex.match?(~r/^\d+$/, str(js_or(g(item, "tmdbId"), ""))),
          do: g(item, "tmdbId"),
          else: ""
        )
      )

    key =
      "#{media_type}:#{js_or(tmdb_id, js_or(g(normalized, "title"), js_or(g(item, "name"), raw_id)))}:#{js_or(g(normalized, "year"), js_or(g(item, "year"), ""))}"

    memory = g(State.get(:title_details_cache, %{}), key)
    disk = g(State.get(:disk_detail_cache, %{}), key)

    cached =
      if truthy(g(memory, ["data", "ok"])),
        do: memory,
        else: if(truthy(g(disk, ["data", "ok"])), do: disk, else: nil)

    if cached do
      State.update(:title_details_cache, %{}, &Map.put(&1, key, cached))
      fresh = now_ms() - number_or(g(cached, "time"), 0) < @title_details_cache_ms

      data =
        sv_merge_playable_detail_data(
          item,
          media_type,
          g(normalized, "title"),
          g(cached, "data"),
          false
        )

      if not fresh,
        do:
          sv_queue_detail_refresh(
            key,
            media_type,
            tmdb_id,
            js_or(g(normalized, "title"), g(item, "name")),
            js_or(g(normalized, "year"), g(item, "year"))
          )

      conn
      |> Plug.Conn.put_resp_header(
        "cache-control",
        if(fresh,
          do: "public, max-age=900",
          else: "public, max-age=120, stale-while-revalidate=900"
        )
      )
      |> Response.json(data)
    else
      local = sv_merge_playable_detail_data(item, media_type, g(normalized, "title"), nil, true)

      conn =
        conn
        |> Plug.Conn.put_resp_header(
          "cache-control",
          "public, max-age=120, stale-while-revalidate=900"
        )
        |> Response.json(local)

      sv_queue_detail_refresh(
        key,
        media_type,
        tmdb_id,
        js_or(g(normalized, "title"), g(item, "name")),
        js_or(g(normalized, "year"), g(item, "year"))
      )

      conn
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:6649 POST /api/details/cache/clear
  def route_details_cache_clear(conn) do
    initialize_state()
    State.put(:title_details_cache, %{})
    State.put(:disk_detail_cache, %{})
    if File.exists?(Paths.detail_cache()), do: File.rm(Paths.detail_cache())
    Response.json(conn, %{"ok" => true, "cleared" => true})
  end

  @studio_keywords %{
    "marvel" => [
      "iron man",
      "iron man 2",
      "iron man 3",
      "the incredible hulk",
      "thor",
      "thor the dark world",
      "thor ragnarok",
      "thor love and thunder",
      "captain america",
      "the first avenger",
      "winter soldier",
      "civil war",
      "the avengers",
      "avengers",
      "age of ultron",
      "infinity war",
      "endgame",
      "guardians of the galaxy",
      "ant man",
      "ant-man",
      "doctor strange",
      "black panther",
      "captain marvel",
      "shang chi",
      "eternals",
      "black widow",
      "spider man",
      "spider-man",
      "no way home",
      "homecoming",
      "far from home",
      "venom",
      "deadpool",
      "wolverine",
      "x men",
      "x-men",
      "fantastic four"
    ],
    "dc" => [
      "batman",
      "the batman",
      "dark knight",
      "superman",
      "man of steel",
      "wonder woman",
      "aquaman",
      "justice league",
      "zack snyder",
      "joker",
      "suicide squad",
      "the suicide squad",
      "birds of prey",
      "black adam",
      "shazam",
      "the flash",
      "blue beetle",
      "watchmen",
      "constantine",
      "green lantern",
      "gotham",
      "peacemaker",
      "v for vendetta"
    ],
    "universal" => [
      "jurassic park",
      "jurassic world",
      "fast and furious",
      "fast & furious",
      "the fast and the furious",
      "furious 7",
      "fast five",
      "hobbs and shaw",
      "jaws",
      "e t",
      "et the extra terrestrial",
      "back to the future",
      "bourne",
      "jason bourne",
      "the mummy",
      "mummy returns",
      "despicable me",
      "minions",
      "sing",
      "secret life of pets",
      "kung fu panda",
      "how to train your dragon",
      "shrek",
      "puss in boots",
      "trolls",
      "oppenheimer",
      "nope",
      "get out",
      "us",
      "halloween",
      "the purge"
    ],
    "disney" => [
      "disney",
      "pixar",
      "toy story",
      "finding nemo",
      "finding dory",
      "incredibles",
      "cars",
      "monsters inc",
      "inside out",
      "coco",
      "up",
      "wall e",
      "ratatouille",
      "frozen",
      "moana",
      "encanto",
      "zootopia",
      "lion king",
      "aladdin",
      "beauty and the beast",
      "mulan",
      "little mermaid",
      "lilo stitch",
      "pirates of the caribbean",
      "star wars",
      "mandalorian",
      "ahsoka",
      "obi wan",
      "andor",
      "loki",
      "wandavision",
      "moon knight",
      "ms marvel",
      "hawkeye",
      "she hulk"
    ],
    "warner" => [
      "warner",
      "harry potter",
      "fantastic beasts",
      "lord of the rings",
      "the hobbit",
      "matrix",
      "dune",
      "godzilla",
      "kong",
      "mad max",
      "blade runner",
      "inception",
      "interstellar",
      "tenet",
      "conjuring",
      "annabelle",
      "it chapter",
      "it ",
      "sherlock holmes",
      "ocean",
      "creed",
      "rocky",
      "space jam",
      "barbie",
      "wonka"
    ],
    "hbo" => [
      "hbo",
      "max original",
      "house of the dragon",
      "game of thrones",
      "the last of us",
      "true detective",
      "succession",
      "euphoria",
      "westworld",
      "the wire",
      "sopranos",
      "chernobyl",
      "boardwalk empire",
      "watchmen",
      "mare of easttown",
      "big little lies",
      "white lotus",
      "silicon valley",
      "barry",
      "peacemaker"
    ],
    "apple" => [
      "apple tv",
      "appletv",
      "apple original",
      "ted lasso",
      "severance",
      "silo",
      "foundation",
      "for all mankind",
      "the morning show",
      "slow horses",
      "see",
      "invasion",
      "servant",
      "defending jacob",
      "black bird",
      "shrinking",
      "mythic quest",
      "monarch legacy of monsters",
      "lessons in chemistry",
      "pachinko",
      "masters of the air"
    ]
  }
  @studio_companies %{
    "netflix" => ["netflix"],
    "marvel" => ["marvel studios", "marvel entertainment", "marvel enterprises"],
    "dc" => ["dc entertainment", "dc films", "dc studios", "dc comics"],
    "universal" => [
      "universal pictures",
      "universal studios",
      "illumination",
      "dreamworks animation",
      "focus features"
    ],
    "disney" => [
      "walt disney",
      "disney",
      "pixar",
      "lucasfilm",
      "marvel studios",
      "20th century studios"
    ],
    "warner" => [
      "warner bros",
      "warner brothers",
      "new line cinema",
      "legendary pictures",
      "dc entertainment",
      "castle rock"
    ],
    "hbo" => ["hbo", "home box office", "warner media", "max"],
    "apple" => ["apple tv", "apple studios", "apple original films"]
  }
  @featured_titles %{
    "netflix" => [
      "stranger things",
      "wednesday",
      "squid game",
      "money heist",
      "dark",
      "black mirror",
      "the witcher",
      "narcos",
      "ozark",
      "the crown",
      "bridgerton",
      "house of cards",
      "mindhunter",
      "the queens gambit",
      "sex education",
      "you",
      "lupin",
      "cobra kai",
      "one piece",
      "avatar the last airbender",
      "3 body problem",
      "the night agent",
      "arcane",
      "the sandman",
      "all of us are dead",
      "alice in borderland",
      "kingdom",
      "the gentleman",
      "the gentlemen",
      "dahmer",
      "beef",
      "maid",
      "bodyguard",
      "the umbrella academy",
      "lost in space",
      "the haunting of hill house",
      "the fall of the house of usher",
      "love death robots",
      "our planet",
      "extraction",
      "extraction 2",
      "the gray man",
      "red notice",
      "bird box",
      "enola holmes",
      "the irishman",
      "marriage story",
      "glass onion",
      "dont look up",
      "the adam project",
      "army of the dead",
      "leave the world behind",
      "the old guard",
      "society of the snow",
      "the platform"
    ],
    "marvel" => [
      "avengers endgame",
      "avengers infinity war",
      "the avengers",
      "avengers age of ultron",
      "iron man",
      "iron man 2",
      "iron man 3",
      "captain america the first avenger",
      "captain america the winter soldier",
      "captain america civil war",
      "thor",
      "thor the dark world",
      "thor ragnarok",
      "thor love and thunder",
      "guardians of the galaxy",
      "guardians of the galaxy vol 2",
      "guardians of the galaxy vol 3",
      "spider man homecoming",
      "spider man far from home",
      "spider man no way home",
      "spider man into the spider verse",
      "spider man across the spider verse",
      "black panther",
      "black panther wakanda forever",
      "doctor strange",
      "doctor strange in the multiverse of madness",
      "ant man",
      "ant man and the wasp",
      "ant man and the wasp quantumania",
      "captain marvel",
      "the marvels",
      "shang chi",
      "eternals",
      "black widow",
      "deadpool",
      "deadpool 2",
      "deadpool wolverine",
      "logan",
      "the wolverine",
      "x men days of future past",
      "x men first class",
      "x men",
      "x2",
      "x men apocalypse",
      "fantastic four",
      "daredevil",
      "loki",
      "wandavision",
      "moon knight",
      "the punisher",
      "jessica jones",
      "luke cage",
      "iron fist",
      "hawkeye",
      "ms marvel",
      "she hulk",
      "the falcon and the winter soldier",
      "agents of shield",
      "agent carter",
      "what if",
      "x men 97"
    ],
    "dc" => [
      "the dark knight",
      "the dark knight rises",
      "batman begins",
      "the batman",
      "batman",
      "batman returns",
      "batman forever",
      "batman mask of the phantasm",
      "joker",
      "joker folie a deux",
      "superman",
      "superman ii",
      "superman returns",
      "man of steel",
      "batman v superman",
      "zack snyders justice league",
      "justice league",
      "wonder woman",
      "wonder woman 1984",
      "aquaman",
      "aquaman and the lost kingdom",
      "the flash",
      "shazam",
      "shazam fury of the gods",
      "black adam",
      "blue beetle",
      "suicide squad",
      "the suicide squad",
      "birds of prey",
      "watchmen",
      "constantine",
      "green lantern",
      "v for vendetta",
      "peacemaker",
      "the penguin",
      "gotham",
      "superman and lois",
      "arrow",
      "the flash tv",
      "titans",
      "doom patrol",
      "stargirl",
      "swamp thing",
      "pennyworth",
      "batwoman",
      "smallville",
      "lucifer",
      "young justice",
      "harley quinn"
    ]
  }

  # JavaScript source: svPrebuiltHomePayload(limit)
  def sv_prebuilt_home_payload(limit) do
    initialize_state()
    rows_by_id = State.get(:prebuilt_home_rows, %{})

    if map_size(rows_by_id) == 0 do
      nil
    else
      rows =
        @home_sections
        |> Enum.flat_map(fn [row_id, key, title] ->
          cached = g(rows_by_id, row_id)
          items = list(g(cached, "items"))

          items =
            if MapSet.member?(@dynamic_home_keys, key) or
                 (length(items) > 0 and length(items) < min(limit, @home_min_prebuilt_items)),
               do: longer(items, sv_section_list(key)),
               else: items

          if items == [],
            do: [],
            else: [
              %{
                "rowId" => row_id,
                "sectionKey" => key,
                "title" => title,
                "items" => Enum.take(items, limit)
              }
            ]
        end)

      hero_source =
        case Enum.find(rows, &(g(&1, "rowId") == "newRow")) do
          nil -> g(Enum.at(rows, 0), "items", [])
          row -> g(row, "items", [])
        end

      hero =
        list(hero_source)
        |> Enum.filter(&(truthy(g(&1, "poster")) or truthy(g(&1, "backdrop"))))
        |> Enum.take(10)

      feed = State.get(:prebuilt_home_feed)

      %{
        "ok" => true,
        "generatedAt" => js_or(g(feed, "generatedAt"), nil),
        "source" => "#{js_or(g(feed, "source"), "prebuilt-home-feed")}:cached",
        "hero" => hero,
        "rows" => rows
      }
    end
  end

  # JavaScript source: svNormalMovieItems()
  def sv_normal_movie_items do
    case State.get(:normal_movie_items_cache) do
      nil ->
        local =
          Enum.map(
            Core.movie_list() || Core.build_movie_list_sync(),
            &(map(&1) |> Map.merge(%{"type" => "movie", "_sourceRank" => 0}))
          )

        ftp =
          Core.get_cached_movies()
          |> Enum.reject(&Core.is_cartoon_or_anime/1)
          |> Enum.with_index()
          |> Enum.map(fn {m, i} ->
            %{
              "id" => "ftp_home_#{i}",
              "name" => g(m, "title"),
              "title" => g(m, "title"),
              "file" => js_or(g(m, "filename"), ""),
              "poster" => js_or(g(m, "poster"), nil),
              "backdrop" => js_or(g(m, "backdrop"), js_or(g(m, "poster"), nil)),
              "tmdbId" => js_or(g(m, "tmdbId"), nil),
              "overview" => js_or(g(m, "overview"), ""),
              "year" => js_or(g(m, "year"), ""),
              "rating" => js_or(g(m, "rating"), nil),
              "type" => "movie",
              "genre" => js_or(g(m, "genre"), ""),
              "category" => js_or(g(m, "category"), ""),
              "language" => js_or(g(m, "language"), ""),
              "productionCompanies" => js_or(g(m, "productionCompanies"), []),
              "streamUrl" => g(m, "streamUrl"),
              "isFtp" => true,
              "_sourceRank" => 1
            }
          end)

        value =
          dedupe_by(local ++ ftp, fn item ->
            "#{trim_lower(js_or(g(item, "name"), g(item, "title")))}|#{js_or(g(item, "year"), "")}|#{js_or(g(item, "tmdbId"), "")}|#{js_or(g(item, "streamUrl"), "")}"
          end)

        State.put(:normal_movie_items_cache, value)
        value

      value ->
        value
    end
  end

  # JavaScript source: svNormalSeriesItems()
  def sv_normal_series_items do
    case State.get(:normal_series_items_cache) do
      nil ->
        local =
          Enum.map(
            Core.series_list() || Core.build_series_list_sync(),
            &(map(&1) |> Map.merge(%{"type" => "series", "_sourceRank" => 0}))
          )

        ftp =
          Core.get_cached_series()
          |> Enum.reject(&Core.is_cartoon_or_anime/1)
          |> Enum.with_index()
          |> Enum.map(fn {show, i} ->
            seasons =
              list(g(show, "seasons"))
              |> Enum.reduce(%{}, fn season, acc ->
                Map.put(
                  acc,
                  first_digits(g(season, "season"), 1),
                  list(g(season, "episodes"))
                  |> Enum.with_index()
                  |> Enum.map(fn {ep, j} ->
                    %{
                      "streamId" => nil,
                      "episode" => j + 1,
                      "epTitle" => "Episode #{j + 1}",
                      "file" => g(ep, "filename"),
                      "streamUrl" => g(ep, "streamUrl"),
                      "isFtp" => true
                    }
                  end)
                )
              end)

            %{
              "id" => "ftp_series_home_#{i}",
              "name" => g(show, "title"),
              "title" => g(show, "title"),
              "poster" => js_or(g(show, "poster"), nil),
              "backdrop" => js_or(g(show, "backdrop"), js_or(g(show, "poster"), nil)),
              "tmdbId" => js_or(g(show, "tmdbId"), nil),
              "overview" => js_or(g(show, "overview"), ""),
              "year" => js_or(g(show, "year"), ""),
              "rating" => js_or(g(show, "rating"), nil),
              "genre" => js_or(g(show, "genre"), ""),
              "category" => js_or(g(show, "category"), ""),
              "language" => js_or(g(show, "language"), ""),
              "type" => "series",
              "isFtp" => true,
              "seasons" => seasons,
              "_sourceRank" => 1
            }
          end)

        value =
          dedupe_by(local ++ ftp, fn item ->
            "#{trim_lower(js_or(g(item, "name"), g(item, "title")))}|#{js_or(g(item, "year"), "")}"
          end)

        State.put(:normal_series_items_cache, value)
        value

      value ->
        value
    end
  end

  # JavaScript source: svHomeText(item)
  def sv_home_text(item),
    do:
      ([
         g(item, "name"),
         g(item, "title"),
         g(item, "file"),
         g(item, "overview"),
         g(item, "genre"),
         g(item, "category"),
         g(item, "language"),
         g(item, "year")
       ] ++ list(g(item, "productionCompanies")))
      |> Enum.filter(&truthy/1)
      |> Enum.map(&str/1)
      |> Enum.join(" ")
      |> String.downcase()

  # JavaScript source: svHasAny(text, words)
  def sv_has_any(text, words), do: Enum.any?(words, &String.contains?(text, &1))

  # JavaScript source: svYearNum(item)
  def sv_year_num(item), do: number_or(year_from(g(item, "year")), 0) |> trunc()

  # JavaScript source: svRatingNum(item)
  def sv_rating_num(item), do: number_or(g(item, "rating"), 0)

  # JavaScript source: svHomeSort(items)
  def sv_home_sort(items),
    do:
      Enum.sort(list(items), fn a, b ->
        {bool_num(truthy(g(a, "poster")) or truthy(g(a, "backdrop"))), sv_rating_num(a),
         sv_year_num(a)} >=
          {bool_num(truthy(g(b, "poster")) or truthy(g(b, "backdrop"))), sv_rating_num(b),
           sv_year_num(b)}
      end)

  # JavaScript source: svHomeTitleText(item)
  def sv_home_title_text(item),
    do:
      ([
         g(item, "name"),
         g(item, "title"),
         g(item, "file"),
         g(item, "filename"),
         g(item, "category"),
         g(item, "year")
       ] ++ list(g(item, "productionCompanies")))
      |> Enum.filter(&truthy/1)
      |> Enum.map(&str/1)
      |> Enum.join(" ")
      |> Core.sv_normalize_search_text()

  # JavaScript source: svCompanyText(item)
  def sv_company_text(item),
    do:
      (list(g(item, "productionCompanies")) ++
         [g(item, "studio"), g(item, "network"), g(item, "category")])
      |> Enum.filter(&truthy/1)
      |> Enum.map(&str/1)
      |> Enum.join(" ")
      |> Core.sv_normalize_search_text()

  # JavaScript source: svHasStudioCompany(item, key)
  def sv_has_studio_company(item, key),
    do:
      Enum.any?(
        Map.get(@studio_companies, key, []),
        &String.contains?(sv_company_text(item), Core.sv_normalize_search_text(&1))
      )

  # JavaScript source: svTitlePhraseHit(item, phrase)
  def sv_title_phrase_hit(item, phrase) do
    t = sv_home_title_text(item)
    p = Core.sv_normalize_search_text(phrase)

    p != "" and
      (t == p or String.starts_with?(t, p <> " ") or String.contains?(t, " " <> p <> " ") or
         String.contains?(t, p))
  end

  # JavaScript source: svFeaturedTitleBase(item)
  def sv_featured_title_base(item),
    do:
      Core.sv_normalize_search_text(
        js_or(
          g(item, "name"),
          js_or(g(item, "title"), js_or(g(item, "file"), js_or(g(item, "filename"), "")))
        )
      )
      |> String.replace(~r/\b(19|20)\d{2}\b/, " ")
      |> String.replace(
        ~r/\b(2160p|1080p|720p|480p|4k|uhd|hdr|sdr|web|webrip|webdl|web-dl|bluray|brrip|dvdrip|hdtc|hdts|x264|x265|h264|hevc|aac|ddp|dd5|dts|remux|repack|yify|rarbg|tigole|psa|mkv|mp4|reencoded|dual|audio|hindi|english|esub|msub)\b/,
        " "
      )
      |> String.replace(~r/\b(s\d{1,2}e\d{1,3}|season|episode|vol|volume)\b/, " ")
      |> spaces()

  # JavaScript source: svFeaturedPriorityHit(item, key)
  def sv_featured_priority_hit(item, key) do
    base = sv_featured_title_base(item)
    hay = " #{base} "

    @featured_titles
    |> Map.get(key, [])
    |> Enum.with_index()
    |> Enum.reduce(%{"score" => 0, "phrase" => ""}, fn {raw, index}, best ->
      phrase = Core.sv_normalize_search_text(raw)

      score =
        cond do
          phrase == "" -> 0
          base == phrase -> 320_000 - index * 1_000
          String.starts_with?(base, phrase <> " ") -> 230_000 - index * 1_000
          String.contains?(hay, " #{phrase} ") -> 200_000 - index * 1_000
          String.contains?(base, phrase) -> 170_000 - index * 1_000
          true -> 0
        end

      if score > g(best, "score", 0) do
        %{"score" => score, "phrase" => phrase}
      else
        best
      end
    end)
  end

  # JavaScript source: svFeaturedNetflixIndicatorScore(item)
  def sv_featured_netflix_indicator_score(item) do
    raw =
      ([
         g(item, "name"),
         g(item, "title"),
         g(item, "file"),
         g(item, "filename"),
         g(item, "category")
       ] ++ list(g(item, "productionCompanies")))
      |> Enum.filter(&truthy/1)
      |> Enum.map(&str/1)
      |> Enum.join(" ")
      |> String.downcase()

    cond do
      sv_has_studio_company(item, "netflix") ->
        70_000

      Enum.any?(["netflix", "netflix original", "nf-web", "nf web"], &String.contains?(raw, &1)) or
          Regex.match?(~r/(^|[\s._\-\/])nf([\s._\-\/]|$)/i, raw) ->
        52_000

      true ->
        0
    end
  end

  # JavaScript source: svFeaturedMediaScore(item, key)
  def sv_featured_media_score(item, key) do
    hit = sv_featured_priority_hit(item, key)
    initial_score = g(hit, "score", 0)

    score =
      if key == "netflix" do
        max(initial_score, sv_featured_netflix_indicator_score(item))
      else
        initial_score + if(sv_has_studio_company(item, key), do: 55_000, else: 0)
      end

    if score == 0 do
      %{"score" => 0, "phrase" => ""}
    else
      art =
        cond do
          truthy(g(item, "backdrop")) -> 9_000
          truthy(g(item, "poster")) -> 6_500
          true -> 0
        end

      rating = round(max(0, min(10, sv_rating_num(item))) * 500)
      year = max(0, min(2_500, sv_year_num(item) - 1_980))
      playable = if truthy(g(item, "streamUrl")) or truthy(g(item, "file")), do: 1_200, else: 0

      %{
        "score" => score + art + rating + year + playable,
        "phrase" => g(hit, "phrase")
      }
    end
  end

  # JavaScript source: svFeaturedDedupeKey(item, key, phrase)
  def sv_featured_dedupe_key(item, key, phrase) do
    type = js_or(g(item, "type"), if(truthy(g(item, "seasons")), do: "series", else: "movie"))
    year = js_or(sv_year_num(item), "")
    phrase = js_or(phrase, sv_featured_title_base(item))
    "#{key}|#{type}|#{phrase}|#{year}"
  end

  # JavaScript source: svBetterFeaturedCandidate(a, b)
  def sv_better_featured_candidate(a, b) do
    art_a =
      bool_num(truthy(g(a, ["item", "backdrop"]))) * 3 +
        bool_num(truthy(g(a, ["item", "poster"]))) * 2

    art_b =
      bool_num(truthy(g(b, ["item", "backdrop"]))) * 3 +
        bool_num(truthy(g(b, ["item", "poster"]))) * 2

    score_delta = number_or(g(a, "score"), 0) - number_or(g(b, "score"), 0)

    cond do
      art_a != art_b -> art_a - art_b
      score_delta != 0 -> score_delta
      true -> sv_rating_num(g(a, "item")) - sv_rating_num(g(b, "item"))
    end
  end

  # JavaScript source: svUpgradeTmdbImage(url, wide = false)
  def sv_upgrade_tmdb_image(url, wide \\ false) do
    value = trim(url)

    if value == "" or not String.contains?(value, "image.tmdb.org/t/p/") do
      value
    else
      size = if wide, do: "w1280", else: "w780"
      Regex.replace(~r{/t/p/(?:original|w\d+)/}, value, "/t/p/#{size}/")
    end
  end

  # JavaScript source: svFeaturedHdStudioItem(item)
  def sv_featured_hd_studio_item(item) do
    next = map(item)

    next =
      if truthy(g(next, "poster")) do
        Map.put(next, "poster", sv_upgrade_tmdb_image(g(next, "poster"), false))
      else
        next
      end

    next =
      if truthy(g(next, "backdrop")) do
        Map.put(next, "backdrop", sv_upgrade_tmdb_image(g(next, "backdrop"), true))
      else
        next
      end

    if not truthy(g(next, "backdrop")) and truthy(g(next, "poster")) do
      Map.put(next, "backdrop", g(next, "poster"))
    else
      next
    end
  end

  # JavaScript source: svPopularFeaturedSection(all, key, limit = 500)
  def sv_popular_featured_section(all, key, limit \\ 500) do
    all
    |> Enum.reduce(%{}, fn item, best ->
      if is_nil(item) or not (truthy(g(item, "poster")) or truthy(g(item, "backdrop"))) do
        best
      else
        begin_featured(best, item, key)
      end
    end)
    |> Map.values()
    |> Enum.sort_by(&(-number_or(g(&1, "score"), 0)))
    |> Enum.map(fn hit ->
      if key in ["marvel", "dc"] do
        sv_featured_hd_studio_item(g(hit, "item"))
      else
        g(hit, "item")
      end
    end)
    |> Enum.take(limit)
  end

  # JavaScript source: svStudioScore(item, key)
  def sv_studio_score(item, key) do
    title_text = sv_home_title_text(item)
    companies = if sv_has_studio_company(item, key), do: 500, else: 0

    keyword_score =
      Enum.reduce(Map.get(@studio_keywords, key, []), 0, fn phrase, best ->
        normalized = Core.sv_normalize_search_text(phrase)

        score =
          cond do
            normalized == "" -> 0
            title_text == normalized -> 450
            String.starts_with?(title_text, normalized <> " ") -> 360
            String.contains?(title_text, " #{normalized} ") -> 260
            String.contains?(title_text, normalized) -> 260
            true -> 0
          end

        max(best, score)
      end)

    if companies == 0 and keyword_score == 0 do
      0
    else
      art = if truthy(g(item, "poster")) or truthy(g(item, "backdrop")), do: 60, else: 0
      rating = min(100, round(sv_rating_num(item) * 10))
      year = max(0, min(40, sv_year_num(item) - 1_985))
      companies + keyword_score + art + rating + year
    end
  end

  # JavaScript source: svStudioSection(all, key, limit = 500)
  def sv_studio_section(all, key, limit \\ 500) do
    all
    |> Enum.map(&%{"item" => &1, "score" => sv_studio_score(&1, key)})
    |> Enum.filter(&(g(&1, "score") > 0))
    |> Enum.sort_by(&(-g(&1, "score")))
    |> Enum.map(&g(&1, "item"))
    |> dedupe_by(fn item ->
      title = Core.sv_normalize_search_text(js_or(g(item, "name"), js_or(g(item, "title"), "")))
      "#{title}|#{js_or(g(item, "year"), "")}|#{js_or(g(item, "type"), "")}"
    end)
    |> Enum.take(limit)
  end

  # JavaScript source: svLatestNetflixSection(all)
  def sv_latest_netflix_section(all),
    do: sv_popular_featured_section(all, "netflix") |> Enum.drop(5)

  # JavaScript source: svSectionList(key)
  def sv_section_list(key) do
    cache_key = str(js_or(key, "allMovies"))
    cache = State.get(:section_list_cache, %{})

    case g(cache, cache_key) do
      nil ->
        movies = sv_normal_movie_items()
        series = sv_normal_series_items()
        all = movies ++ series
        list = section_case(key, movies, series, all)
        State.put(:section_list_cache, Map.put(cache, cache_key, list))
        list

      value ->
        value
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:7607 GET /api/section/:key
  def route_section(conn, key) do
    conn = Plug.Conn.fetch_query_params(conn)
    q = conn.query_params

    try do
      key = str(js_or(key, "allMovies"))
      page = max(0, int_or(g(q, "page"), 0))
      limit = min(120, max(1, int_or(g(q, "limit"), 24)))

      prebuilt =
        if g(q, "summary") == "1" and page == 0,
          do:
            State.get(:prebuilt_home_rows, %{})
            |> Map.values()
            |> Enum.find(&(g(&1, "sectionKey") == key)),
          else: nil

      if not MapSet.member?(@dynamic_home_keys, key) and
           length(list(g(prebuilt, "items"))) >= min(limit, @home_min_prebuilt_items) do
        conn
        |> Plug.Conn.put_resp_header(
          "cache-control",
          "public, max-age=300, stale-while-revalidate=3600"
        )
        |> Plug.Conn.put_resp_header("x-streamvault-section", "prebuilt")
        |> Response.json(%{
          "key" => key,
          "items" => Enum.take(g(prebuilt, "items"), limit),
          "total" => length(g(prebuilt, "items")),
          "page" => 0,
          "pages" => 1
        })
      else
        values = sv_section_list(key)
        start = page * limit

        conn
        |> Plug.Conn.put_resp_header("cache-control", "public, max-age=60")
        |> Response.json(%{
          "key" => key,
          "items" => Enum.slice(values, start, limit),
          "total" => length(values),
          "page" => page,
          "pages" => max(1, ceil_div(length(values), limit))
        })
      end
    rescue
      error ->
        IO.puts(:stderr, "/api/section error: #{Exception.message(error)}")

        Response.json(conn, %{
          "key" => key,
          "items" => [],
          "total" => 0,
          "page" => 0,
          "pages" => 0
        })
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:7631 GET /api/home-feed
  def route_home_feed(conn) do
    initialize_state()
    conn = Plug.Conn.fetch_query_params(conn)
    limit = min(50, max(6, int_or(g(conn.query_params, "limit"), 18)))

    try do
      case sv_prebuilt_home_payload(limit) do
        nil ->
          rows =
            @home_sections
            |> Enum.map(fn [row, key, title] ->
              %{
                "rowId" => row,
                "sectionKey" => key,
                "title" => title,
                "items" => Enum.take(sv_section_list(key), limit)
              }
            end)
            |> Enum.filter(&(g(&1, "items") != []))

          source =
            case Enum.find(rows, &(g(&1, "rowId") == "newRow")) do
              nil -> g(Enum.at(rows, 0), "items", [])
              row -> g(row, "items", [])
            end

          hero =
            list(source)
            |> Enum.filter(&(truthy(g(&1, "poster")) or truthy(g(&1, "backdrop"))))
            |> Enum.take(10)

          conn
          |> Plug.Conn.put_resp_header("cache-control", "public, max-age=60")
          |> Response.json(%{"ok" => true, "hero" => hero, "rows" => rows})

        payload ->
          json_cache = State.get(:prebuilt_home_json_cache, %{})
          json = g(json_cache, limit)
          json = if is_nil(json), do: Jason.encode!(payload), else: json

          if is_nil(g(json_cache, limit)),
            do: State.put(:prebuilt_home_json_cache, Map.put(json_cache, limit, json))

          conn
          |> Plug.Conn.put_resp_header(
            "cache-control",
            "public, max-age=300, stale-while-revalidate=3600"
          )
          |> Plug.Conn.put_resp_header("x-streamvault-feed", "prebuilt")
          |> Plug.Conn.put_resp_content_type("application/json")
          |> Plug.Conn.send_resp(200, json)
      end
    rescue
      error ->
        IO.puts(:stderr, "/api/home-feed error: #{Exception.message(error)}")
        Response.json(conn, %{"ok" => false, "hero" => [], "rows" => []})
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:7660 GET /api/movies
  def route_movies(conn) do
    conn = Plug.Conn.fetch_query_params(conn)
    q = conn.query_params

    try do
      local = Core.movie_list() || Core.build_movie_list_sync()

      ftp =
        Core.get_cached_movies()
        |> Enum.reject(&Core.is_cartoon_or_anime/1)
        |> Enum.with_index()
        |> Enum.map(fn {m, i} ->
          %{
            "id" => "ftp_#{i}",
            "name" => g(m, "title"),
            "title" => g(m, "title"),
            "file" => g(m, "filename"),
            "poster" => js_or(g(m, "poster"), nil),
            "backdrop" => js_or(g(m, "backdrop"), js_or(g(m, "poster"), nil)),
            "tmdbId" => js_or(g(m, "tmdbId"), nil),
            "year" => js_or(g(m, "year"), ""),
            "rating" => js_or(g(m, "rating"), nil),
            "type" => "movie",
            "genre" => js_or(g(m, "genre"), ""),
            "category" => js_or(g(m, "category"), ""),
            "streamUrl" => g(m, "streamUrl"),
            "isFtp" => true
          }
        end)

      seen =
        MapSet.new(
          Enum.map(local, fn m ->
            "#{trim_lower(js_or(g(m, "name"), g(m, "title")))}|#{js_or(g(m, "year"), "")}"
          end)
        )

      base =
        local ++
          Enum.reject(
            ftp,
            &MapSet.member?(
              seen,
              "#{trim_lower(js_or(g(&1, "name"), g(&1, "title")))}|#{js_or(g(&1, "year"), "")}"
            )
          )

      has_search = String.length(trim(g(q, "q"))) >= 2

      all =
        if has_search and str(js_or(g(q, "massive"), "1")) != "0" do
          Core.load_massive_catalog()

          dedupe_append(base, Core.massive_movies(), fn m ->
            "#{trim_lower(js_or(g(m, "name"), g(m, "title")))}|#{js_or(g(m, "year"), "")}|#{js_or(g(m, "streamUrl"), g(m, "id"))}"
          end)
        else
          base
        end

      paged = Core.sv_filter_paged(all, conn, true, "movies")

      Response.json(conn, %{
        "movies" => g(paged, "items"),
        "total" => length(g(paged, "list")),
        "page" => g(paged, "page"),
        "pages" => g(paged, "pages")
      })
    rescue
      error ->
        IO.puts(:stderr, "/api/movies error: #{Exception.message(error)}")
        Response.json(conn, %{"movies" => [], "total" => 0, "page" => 0, "pages" => 0})
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:7714 GET /api/search
  def route_search(conn) do
    conn = Plug.Conn.fetch_query_params(conn)
    q = conn.query_params

    try do
      query = trim(g(q, "q"))
      limit = min(120, max(1, int_or(g(q, "limit"), 72)))
      page = max(1, int_or(g(q, "page"), 1))

      if String.length(query) < 2 do
        Response.json(conn, %{
          "items" => [],
          "total" => 0,
          "page" => page,
          "pages" => 0,
          "instant" => true
        })
      else
        kind = search_kind(js_or(g(q, "kind"), js_or(g(q, "type"), "mixed")))

        if str(js_or(g(q, "massive"), "0")) != "1" do
          boot = Core.sv_query_boot_search_paged(query, kind, limit, page)

          Response.json(conn, %{
            "items" => g(boot, "items"),
            "total" => g(boot, "total"),
            "page" => g(boot, "page"),
            "pages" => g(boot, "pages"),
            "instant" => true,
            "indexed" => true,
            "source" => "boot",
            "massive" => false
          })
        else
          values = Core.sv_fast_search(conn, kind) || []
          start = (page - 1) * limit

          Response.json(conn, %{
            "items" => Enum.slice(values, start, limit),
            "total" => length(values),
            "page" => page,
            "pages" => max(1, ceil_div(length(values), limit)),
            "instant" => true,
            "indexed" => true,
            "source" => "massive",
            "massive" => true
          })
        end
      end
    rescue
      error ->
        IO.puts(:stderr, "/api/search error: #{Exception.message(error)}")

        Response.json(conn, %{
          "items" => [],
          "total" => 0,
          "page" => 1,
          "pages" => 0,
          "instant" => false,
          "error" => Exception.message(error)
        })
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:7756 GET /api/boot-search-index
  def route_boot_search_index(conn) do
    conn =
      Plug.Conn.fetch_query_params(conn)
      |> Plug.Conn.put_resp_header(
        "cache-control",
        "public, max-age=86400, stale-while-revalidate=3600"
      )
      |> Plug.Conn.put_resp_header("x-streamvault-search-version", @boot_search_version)

    q = conn.query_params

    try do
      query = trim(g(q, "q"))
      limit = min(120, max(1, int_or(g(q, "limit"), 72)))
      kind = search_kind(js_or(g(q, "kind"), js_or(g(q, "type"), "mixed")))

      if String.length(query) >= 2 do
        boot = Core.sv_query_boot_search_paged(query, kind, limit, 1)

        Response.json(conn, %{
          "ok" => true,
          "version" => @boot_search_version,
          "boot" => true,
          "query" => query,
          "items" => g(boot, "items"),
          "total" => g(boot, "total"),
          "page" => g(boot, "page"),
          "pages" => g(boot, "pages")
        })
      else
        Response.json(conn, Core.sv_get_boot_search_index())
      end
    rescue
      error ->
        conn
        |> Plug.Conn.put_resp_header("cache-control", "no-store")
        |> Response.json(%{
          "ok" => false,
          "version" => @boot_search_version,
          "items" => [],
          "total" => 0,
          "error" => Exception.message(error)
        })
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:7791 GET /boot-search-index.json
  def route_boot_search_file(conn) do
    try do
      payload = Core.sv_get_boot_search_file_payload()
      json = Jason.encode!(payload)
      accept = conn |> Plug.Conn.get_req_header("accept-encoding") |> Enum.join(",")

      conn =
        conn
        |> Plug.Conn.put_resp_header(
          "cache-control",
          "public, max-age=86400, stale-while-revalidate=3600"
        )
        |> Plug.Conn.put_resp_header("x-streamvault-search-version", @boot_search_version)
        |> Plug.Conn.put_resp_content_type("application/json")

      if Regex.match?(~r/\bgzip\b/i, accept) do
        gz = :zlib.gzip(json)

        conn
        |> Plug.Conn.put_resp_header("content-encoding", "gzip")
        |> Plug.Conn.put_resp_header("content-length", str(byte_size(gz)))
        |> Plug.Conn.send_resp(200, gz)
      else
        Plug.Conn.send_resp(conn, 200, json)
      end
    rescue
      error ->
        conn
        |> Plug.Conn.put_resp_header("cache-control", "no-store")
        |> Response.json(%{
          "ok" => false,
          "version" => @boot_search_version,
          "items" => [],
          "total" => 0,
          "error" => Exception.message(error)
        })
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:7817 GET /api/catalog-stats
  def route_catalog_stats(conn) do
    try do
      Core.load_massive_catalog()

      Response.json(conn, %{
        "ok" => true,
        "homepageUntouched" => true,
        "existingMovies" =>
          length(Core.movie_list() || Core.build_movie_list_sync()) +
            length(Core.get_cached_movies()),
        "existingSeries" =>
          length(Core.series_list() || Core.build_series_list_sync()) +
            length(Core.get_cached_series()),
        "massiveMovies" => length(Core.massive_movies()),
        "massiveSeries" => length(Core.massive_series()),
        "massiveTotal" => length(Core.massive_movies()) + length(Core.massive_series())
      })
    rescue
      error -> Response.json(conn, %{"ok" => false, "error" => Exception.message(error)}, 500)
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:7834 GET /api/movies/keywords
  def route_movie_keywords(conn) do
    conn = Plug.Conn.fetch_query_params(conn)

    words =
      str(js_or(g(conn.query_params, "q"), ""))
      |> String.downcase()
      |> String.split(",")
      |> Enum.map(&String.trim/1)
      |> Enum.reject(&(&1 == ""))

    if words == [] do
      Response.json(conn, [])
    else
      cache = Core.poster_cache()

      values =
        Core.get_cached_movies()
        |> Enum.reject(&Core.is_cartoon_or_anime/1)
        |> Enum.filter(fn m ->
          text = g(m, "title", "") |> String.downcase() |> String.replace(~r/[.\-_]/, " ")
          Enum.any?(words, &String.contains?(text, &1))
        end)
        |> Enum.take(200)
        |> Enum.with_index()
        |> Enum.map(fn {m, i} ->
          cleaned = Core.clean_title(g(m, "title", ""))

          hit =
            g(cache, cleaned) ||
              Enum.find(
                Map.values(cache),
                &(truthy(&1) and cleaned != "" and
                    trim_lower(g(&1, "title")) == String.downcase(cleaned))
              )

          %{
            "id" => "ftp_kw_#{i}",
            "name" => g(m, "title"),
            "file" => js_or(g(m, "filename"), ""),
            "tmdbId" => js_or(g(m, "tmdbId"), nil),
            "poster" => js_or(g(m, "poster"), js_or(g(hit, "poster"), nil)),
            "year" => js_or(g(m, "year"), ""),
            "rating" => js_or(g(m, "rating"), js_or(g(hit, "rating"), nil)),
            "type" => "movie",
            "genre" => js_or(g(m, "genre"), js_or(g(hit, "genre"), "")),
            "streamUrl" => g(m, "streamUrl"),
            "isFtp" => true
          }
        end)

      Response.json(conn, values)
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:7870 GET /api/series
  def route_series(conn) do
    conn = Plug.Conn.fetch_query_params(conn)
    q = conn.query_params

    try do
      local = Core.series_list() || Core.build_series_list_sync()
      limit = max(0, int_or(g(q, "limit"), 0))
      raw = Core.get_cached_series()

      source =
        if limit > 0 and trim(g(q, "q")) == "",
          do: Enum.take(raw, max(limit - length(local), 0)),
          else: raw

      ftp = source |> Enum.reject(&Core.is_cartoon_or_anime/1) |> Enum.map(&series_route_item/1)
      seen = MapSet.new(Enum.map(local, &trim_lower(js_or(g(&1, "name"), g(&1, "title")))))

      base =
        local ++
          Enum.reject(
            ftp,
            &MapSet.member?(seen, trim_lower(js_or(g(&1, "name"), g(&1, "title"))))
          )

      search = String.length(trim(g(q, "q"))) >= 2

      cond do
        search and str(js_or(g(q, "massive"), "1")) != "0" ->
          Core.load_massive_catalog()

          all =
            dedupe_append(base, Core.massive_series(), fn s ->
              "#{trim_lower(js_or(g(s, "name"), g(s, "title")))}|#{js_or(g(s, "year"), "")}"
            end)

          paged = Core.sv_filter_paged(all, conn, true, "series")

          Response.json(conn, %{
            "series" => g(paged, "items"),
            "total" => length(g(paged, "list")),
            "page" => g(paged, "page"),
            "pages" => g(paged, "pages")
          })

        str(js_or(g(q, "page"), "")) != "" or trim(g(q, "q")) != "" ->
          paged = Core.sv_filter_paged(base, conn, true, "series")

          Response.json(conn, %{
            "series" => g(paged, "items"),
            "total" => length(g(paged, "list")),
            "page" => g(paged, "page"),
            "pages" => g(paged, "pages")
          })

        true ->
          Response.json(conn, if(limit > 0, do: Enum.take(base, limit), else: base))
      end
    rescue
      error ->
        IO.puts(:stderr, "/api/series error: #{Exception.message(error)}")
        Response.json(conn, [])
    end
  end

  # JavaScript source: saveEpCache()
  def save_ep_cache do
    try do
      Files.write_json(Paths.episode_cache(), State.get(:ep_title_cache, %{}), true)
    rescue
      _ -> :ok
    end
  end

  # JavaScript source: tmdbGet(path)
  def tmdb_get(path) do
    headers = [{"Authorization", "Bearer #{Core.tmdb_token()}"}, {"Accept", "application/json"}]

    case HTTP.request(:get, "https://api.themoviedb.org/3#{path}", headers, nil,
           timeout: 8_000,
           receive_timeout: 8_000
         ) do
      {:ok, response} ->
        case Jason.decode(response.body) do
          {:ok, data} -> data
          _ -> nil
        end

      _ ->
        nil
    end
  end

  # JavaScript source: saveDetailCache()
  def save_detail_cache do
    generation = System.unique_integer([:positive])
    State.put(:detail_cache_save_generation, generation)

    Task.start(fn ->
      Process.sleep(150)

      if State.get(:detail_cache_save_generation) == generation do
        try do
          Files.write_json(Paths.detail_cache(), State.get(:disk_detail_cache, %{}), true)
        rescue
          error ->
            IO.puts(:stderr, "Could not save detail-cache.json: #{Exception.message(error)}")
        end
      end
    end)

    :ok
  end

  # JavaScript source: withTimeout(promise, ms, fallback)
  def with_timeout(function, ms, fallback) when is_function(function, 0) do
    caller = self()
    ref = make_ref()

    Task.start(fn ->
      send(
        caller,
        {ref,
         try do
           function.()
         rescue
           _ -> fallback
         end}
      )
    end)

    receive do
      {^ref, value} -> value
    after
      trunc(ms) -> fallback
    end
  end

  # JavaScript source: svQueueDetailRefresh(cacheKey, mediaType, tmdbId, title, year)
  def sv_queue_detail_refresh(cache_key, media_type, tmdb_id, title, year) do
    initialize_state()

    claimed =
      State.transaction(fn state ->
        jobs = Map.get(state, :title_detail_refresh_jobs, MapSet.new())

        if MapSet.member?(jobs, cache_key),
          do: {false, state},
          else: {true, Map.put(state, :title_detail_refresh_jobs, MapSet.put(jobs, cache_key))}
      end)

    if claimed do
      Task.start(fn ->
        fresh =
          with_timeout(
            fn -> build_tmdb_extended_details(media_type, tmdb_id, title, year) end,
            6500,
            nil
          )

        if truthy(g(fresh, "ok")) do
          entry = %{"time" => now_ms(), "data" => fresh}
          State.update(:title_details_cache, %{}, &Map.put(&1, cache_key, entry))
          State.update(:disk_detail_cache, %{}, &Map.put(&1, cache_key, entry))
          save_detail_cache()
        end

        State.update(:title_detail_refresh_jobs, MapSet.new(), &MapSet.delete(&1, cache_key))
      end)
    end

    claimed
  end

  # JavaScript source: tmdbImage(size, imgPath)
  def tmdb_image(size, img_path),
    do: if(truthy(img_path), do: "#{@tmdb_img}/#{size}#{img_path}", else: nil)

  # JavaScript source: requestMediaType(query)
  def request_media_type(query) do
    type = trim_lower(js_or(g(query, "type"), g(query, "mediaType")))
    id = str(js_or(g(query, "id"), ""))

    if String.starts_with?(id, "tmdb_tv_") or type in ["tv", "series", "show"] do
      "tv"
    else
      "movie"
    end
  end

  # JavaScript source: tmdbIdFromRequest(query, mediaType)
  def tmdb_id_from_request(query, media_type) do
    direct = trim(g(query, "tmdbId"))

    if Regex.match?(~r/^\d+$/, direct) do
      direct
    else
      pattern = if media_type == "tv", do: ~r/^tmdb_tv_(\d+)$/, else: ~r/^tmdb_(\d+)$/

      case Regex.run(pattern, trim(g(query, "id"))) do
        [_, id] -> id
        _other -> ""
      end
    end
  end

  # JavaScript source: resultTitle(item, mediaType)
  def result_title(item, media_type),
    do:
      if(media_type == "tv",
        do: js_or(g(item, "name"), js_or(g(item, "original_name"), "")),
        else: js_or(g(item, "title"), js_or(g(item, "original_title"), ""))
      )

  # JavaScript source: resultYear(item, mediaType)
  def result_year(item, media_type),
    do:
      str(if(media_type == "tv", do: g(item, "first_air_date"), else: g(item, "release_date")))
      |> String.slice(0, 4)

  # JavaScript source: cleanSearchTitle(title)
  def clean_search_title(title), do: g(normalize_detail_title(title), "title")

  # JavaScript source: splitSearchTitleYear(title, year = '')
  def split_search_title_year(title, year \\ ""), do: normalize_detail_title(title, year)

  # JavaScript source: pickTmdbResult(results, title, year, mediaType)
  def pick_tmdb_result(results, title, year, media_type) do
    clean = clean_search_title(title) |> String.downcase()
    desired = str(js_or(year, "")) |> String.slice(0, 4)

    words =
      clean
      |> String.split(~r/\s+/, trim: true)
      |> Enum.filter(&(String.length(&1) > 1))
      |> MapSet.new()

    list(results)
    |> Enum.map(fn item ->
      name = result_title(item, media_type) |> String.downcase()

      iw =
        name
        |> String.split(~r/\s+/, trim: true)
        |> Enum.filter(&(String.length(&1) > 1))
        |> MapSet.new()

      over = MapSet.intersection(words, iw) |> MapSet.size()

      ratio =
        if MapSet.size(words) > 0, do: over / max(MapSet.size(words), MapSet.size(iw)), else: 0

      contains =
        String.length(clean) >= 4 and
          (String.contains?(name, clean) or String.contains?(clean, name))

      match = name == clean or contains or ratio >= 0.55

      score =
        number_or(g(item, "popularity"), 0) / 100 + if(name == clean, do: 20, else: 0) +
          if(contains, do: 8, else: 0) + if(ratio >= 0.55, do: ratio * 6, else: 0) +
          if(desired != "" and result_year(item, media_type) == desired, do: 8, else: 0) +
          if(truthy(g(item, "poster_path")), do: 2, else: 0)

      %{"item" => item, "score" => if(match, do: score, else: 0)}
    end)
    |> Enum.filter(&(g(&1, "score") >= 5))
    |> Enum.sort_by(&(-g(&1, "score")))
    |> Enum.at(0)
    |> g("item")
  end

  # JavaScript source: searchTmdbMedia(title, year, mediaType)
  def search_tmdb_media(title, year, media_type) do
    normalized = split_search_title_year(title, year)
    clean = g(normalized, "title")
    search_year = g(normalized, "year")

    if clean == "" do
      nil
    else
      endpoint = if(media_type == "tv", do: "/search/tv", else: "/search/movie")

      yp =
        if search_year != "",
          do:
            if(media_type == "tv",
              do: "&first_air_date_year=#{URI.encode_www_form(search_year)}",
              else: "&year=#{URI.encode_www_form(search_year)}"
            ),
          else: ""

      data =
        tmdb_get(
          "#{endpoint}?query=#{URI.encode_www_form(clean)}#{yp}&include_adult=false&language=en-US&page=1"
        )

      picked = pick_tmdb_result(g(data, "results", []), clean, search_year, media_type)

      if is_nil(picked) and yp != "" do
        data =
          tmdb_get(
            "#{endpoint}?query=#{URI.encode_www_form(clean)}&include_adult=false&language=en-US&page=1"
          )

        pick_tmdb_result(g(data, "results", []), clean, search_year, media_type)
      else
        picked
      end
    end
  end

  # JavaScript source: mapTmdbMediaCard(item, fallbackType)
  def map_tmdb_media_card(item, fallback_type) do
    type = if(g(item, "media_type") == "tv" or fallback_type == "tv", do: "tv", else: "movie")
    name = result_title(item, type)
    if not truthy(g(item, "id")) or not truthy(name), do: nil, else: begin_card(item, type, name)
  end

  # JavaScript source: mapUniqueMedia(items, fallbackType, currentId)
  def map_unique_media(items, fallback_type, current_id) do
    list(items)
    |> Enum.map(&map_tmdb_media_card(&1, js_or(g(&1, "media_type"), fallback_type)))
    |> Enum.reject(&is_nil/1)
    |> Enum.reject(
      &(str(g(&1, "tmdbId")) == str(current_id) and
          js_or(g(&1, "type"), fallback_type) == fallback_type)
    )
    |> dedupe_by(&"#{g(&1, "type")}:#{g(&1, "tmdbId")}")
    |> Enum.take(24)
  end

  # JavaScript source: mapVideos(videos)
  def map_videos(videos) do
    list(videos)
    |> Enum.filter(
      &(g(&1, "site") == "YouTube" and truthy(g(&1, "key")) and
          g(&1, "type") in ["Trailer", "Teaser"])
    )
    |> Enum.sort_by(fn v ->
      {Map.get(%{"Trailer" => 0, "Teaser" => 1}, g(v, "type"), 9),
       -bool_num(truthy(g(v, "official")))}
    end)
    |> Enum.take(12)
    |> Enum.map(fn v ->
      key = g(v, "key")

      %{
        "name" => js_or(g(v, "name"), js_or(g(v, "type"), "Trailer")),
        "type" => js_or(g(v, "type"), "Video"),
        "key" => key,
        "url" => "https://www.youtube.com/watch?v=#{key}",
        "embedUrl" => "https://www.youtube.com/embed/#{key}",
        "thumbnail" => "https://img.youtube.com/vi/#{key}/hqdefault.jpg",
        "publishedAt" => js_or(g(v, "published_at"), ""),
        "source" => "TMDB"
      }
    end)
  end

  # JavaScript source: httpsGetJson(url, headers = {})
  def https_get_json(url, headers \\ %{}) do
    values =
      [{"Accept", "application/json"}] ++
        Enum.map(map(headers), fn {k, v} -> {str(k), str(v)} end)

    case HTTP.request(:get, url, values, nil, timeout: 8_000, receive_timeout: 8_000) do
      {:ok, response} ->
        case Jason.decode(response.body) do
          {:ok, data} -> data
          _ -> nil
        end

      _ ->
        nil
    end
  end

  # JavaScript source: youtubeTrailerFallback(title, year, mediaType)
  def youtube_trailer_fallback(title, year, media_type) do
    key = env_first(["YOUTUBE_API_KEY", "YT_API_KEY"])

    if key == "" or not truthy(title) do
      []
    else
      query =
        "#{title} #{js_or(year, "")} #{if(media_type == "tv", do: "series", else: "movie")} official trailer"

      data =
        https_get_json(
          "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=6&q=#{URI.encode_www_form(query)}&key=#{URI.encode_www_form(key)}"
        )

      list(g(data, "items"))
      |> Enum.flat_map(fn item ->
        video = g(item, ["id", "videoId"])

        if truthy(video),
          do: [
            %{
              "name" => js_or(g(item, ["snippet", "title"]), "Official Trailer"),
              "type" => "Trailer",
              "key" => video,
              "url" => "https://www.youtube.com/watch?v=#{video}",
              "embedUrl" => "https://www.youtube.com/embed/#{video}",
              "thumbnail" =>
                js_or(
                  g(item, ["snippet", "thumbnails", "high", "url"]),
                  js_or(
                    g(item, ["snippet", "thumbnails", "medium", "url"]),
                    "https://img.youtube.com/vi/#{video}/hqdefault.jpg"
                  )
                ),
              "publishedAt" => js_or(g(item, ["snippet", "publishedAt"]), ""),
              "source" => "YouTube Data API"
            }
          ],
          else: []
      end)
    end
  end

  # JavaScript source: mapPeople(people, roleField, limit = 16)
  def map_people(people, role_field, limit \\ 16),
    do:
      list(people)
      |> Enum.filter(&truthy(g(&1, "name")))
      |> dedupe_optional_id()
      |> Enum.take(limit)
      |> Enum.map(fn p ->
        %{
          "id" => js_or(g(p, "id"), nil),
          "name" => g(p, "name"),
          "role" => js_or(g(p, role_field), js_or(g(p, "job"), js_or(g(p, "department"), ""))),
          "image" => tmdb_image("w185", g(p, "profile_path"))
        }
      end)

  # JavaScript source: mapCompanies(companies)
  def map_companies(companies),
    do:
      list(companies)
      |> Enum.filter(&truthy(g(&1, "name")))
      |> Enum.take(12)
      |> Enum.map(fn c ->
        %{
          "id" => js_or(g(c, "id"), nil),
          "name" => g(c, "name"),
          "logo" => tmdb_image("w300", g(c, "logo_path")),
          "country" => js_or(g(c, "origin_country"), "")
        }
      end)

  # JavaScript source: movieCertification(releaseDates)
  def movie_certification(release_dates) do
    country =
      Enum.find(list(g(release_dates, "results")), &(g(&1, "iso_3166_1") == "US")) ||
        Enum.at(list(g(release_dates, "results")), 0)

    release = Enum.find(list(g(country, "release_dates")), &truthy(g(&1, "certification")))
    js_or(g(release, "certification"), "")
  end

  # JavaScript source: tvCertification(contentRatings)
  def tv_certification(ratings) do
    country =
      Enum.find(list(g(ratings, "results")), &(g(&1, "iso_3166_1") == "US")) ||
        Enum.at(list(g(ratings, "results")), 0)

    js_or(g(country, "rating"), "")
  end

  # JavaScript source: selectDirector(detail, credits, mediaType)
  def select_director(detail, credits, media_type) do
    crew = list(g(credits, "crew"))

    Enum.find(crew, &(g(&1, "job") == "Director")) ||
      Enum.find(crew, &Regex.match?(~r/director/i, str(js_or(g(&1, "job"), "")))) ||
      if(media_type == "tv", do: g(detail, ["created_by", 0]), else: nil)
  end

  # JavaScript source: moreByDirector(detail, credits, mediaType)
  def more_by_director(detail, credits, media_type) do
    person = select_director(detail, credits, media_type)

    if not truthy(g(person, "id")) do
      %{"person" => nil, "items" => []}
    else
      data = tmdb_get("/person/#{g(person, "id")}/combined_credits?language=en-US")

      values =
        data
        |> g("crew")
        |> list()
        |> Enum.filter(&(g(&1, "media_type") in ["movie", "tv"]))
        |> Enum.filter(fn item ->
          job = str(js_or(g(item, "job"), ""))

          if media_type == "movie" do
            Regex.match?(~r/director/i, job)
          else
            Regex.match?(~r/director|creator|writer|producer|showrunner/i, job)
          end
        end)
        |> Enum.sort_by(&(-number_or(g(&1, "popularity"), 0)))

      %{
        "person" => %{
          "id" => g(person, "id"),
          "name" => g(person, "name"),
          "role" =>
            js_or(g(person, "job"), if(media_type == "tv", do: "Creator", else: "Director")),
          "image" => tmdb_image("w185", g(person, "profile_path"))
        },
        "items" => map_unique_media(values, media_type, g(detail, "id"))
      }
    end
  end

  # JavaScript source: formatDateLabel(value)
  def format_date_label(value) do
    if not truthy(value) do
      ""
    else
      case Date.from_iso8601(str(value)) do
        {:ok, date} ->
          "#{Enum.at(~w(January February March April May June July August September October November December), date.month - 1)} #{date.day}, #{date.year}"

        _ ->
          str(value)
      end
    end
  end

  # JavaScript source: languageLabel(detail)
  def language_label(detail) do
    langs = list(g(detail, "spoken_languages"))

    if langs != [],
      do:
        langs
        |> Enum.map(&js_or(g(&1, "english_name"), g(&1, "name")))
        |> Enum.filter(&truthy/1)
        |> Enum.take(3)
        |> Enum.join(", "),
      else:
        if(truthy(g(detail, "original_language")),
          do: String.upcase(str(g(detail, "original_language"))),
          else: ""
        )
  end

  # JavaScript source: aboutItems(detail, mediaType)
  def about_items(detail, media_type) do
    tv = media_type == "tv"
    date = if(tv, do: g(detail, "first_air_date"), else: g(detail, "release_date"))

    runtime =
      if tv,
        do:
          if(truthy(g(detail, ["episode_run_time", 0])),
            do: "#{g(detail, ["episode_run_time", 0])} min episodes",
            else: ""
          ),
        else: if(truthy(g(detail, "runtime")), do: "#{g(detail, "runtime")} min", else: "")

    cert =
      if(tv,
        do: tv_certification(g(detail, "content_ratings")),
        else: movie_certification(g(detail, "release_dates"))
      )

    [
      %{"label" => "Year", "value" => str(js_or(date, "")) |> String.slice(0, 4)},
      %{
        "label" => if(tv, do: "First Aired", else: "Released"),
        "value" => format_date_label(date)
      },
      %{"label" => "Runtime", "value" => runtime},
      %{"label" => "Rating", "value" => cert},
      %{
        "label" => "Genres",
        "value" => list(g(detail, "genres")) |> Enum.map(&g(&1, "name")) |> Enum.join(", ")
      },
      %{"label" => "Language", "value" => language_label(detail)},
      %{
        "label" => "Origin",
        "value" =>
          list(js_or(g(detail, "origin_country"), g(detail, "production_countries")))
          |> Enum.map(&js_or(g(&1, "name"), &1))
          |> Enum.map(&str/1)
          |> Enum.join(", ")
      },
      %{"label" => "Status", "value" => js_or(g(detail, "status"), "")},
      if(tv,
        do: %{
          "label" => "Seasons",
          "value" =>
            if(truthy(g(detail, "number_of_seasons")),
              do: str(g(detail, "number_of_seasons")),
              else: ""
            )
        },
        else: nil
      ),
      if(tv,
        do: %{
          "label" => "Episodes",
          "value" =>
            if(truthy(g(detail, "number_of_episodes")),
              do: str(g(detail, "number_of_episodes")),
              else: ""
            )
        },
        else: nil
      ),
      if(tv,
        do: %{
          "label" => "Networks",
          "value" => list(g(detail, "networks")) |> Enum.map(&g(&1, "name")) |> Enum.join(", ")
        },
        else: nil
      )
    ]
    |> Enum.filter(&(not is_nil(&1) and truthy(g(&1, "value"))))
  end

  # JavaScript source: tmdbExternalIds(mediaType, tmdbId)
  def tmdb_external_ids(media_type, tmdb_id),
    do:
      if(not truthy(tmdb_id),
        do: %{},
        else: tmdb_get("/#{media_type}/#{tmdb_id}/external_ids") || %{}
      )

  # JavaScript source: omdbByImdbId(imdbId)
  def omdb_by_imdb_id(imdb_id) do
    key = env_first(["OMDB_API_KEY", "OMDB_KEY"])

    if key == "" or not truthy(imdb_id),
      do: nil,
      else:
        https_get_json(
          "https://www.omdbapi.com/?i=#{URI.encode_www_form(str(imdb_id))}&apikey=#{URI.encode_www_form(key)}"
        )
  end

  # JavaScript source: omdbRatingValue(omdb, source)
  def omdb_rating_value(omdb, source) do
    item = Enum.find(list(g(omdb, "Ratings")), &(g(&1, "Source") == source))
    value = g(item, "Value")
    if truthy(value) and value != "N/A", do: value, else: ""
  end

  # JavaScript source: ratingItems(detail, externalIds = {}, omdb = null)
  def rating_items(detail, external_ids \\ %{}, omdb \\ nil) do
    external = map(external_ids)
    vote = number_or(g(detail, "vote_average"), 0)

    imdb =
      js_or(
        omdb_rating_value(omdb, "Internet Movie Database"),
        if(truthy(g(omdb, "imdbRating")) and g(omdb, "imdbRating") != "N/A",
          do: "#{g(omdb, "imdbRating")}/10",
          else: ""
        )
      )

    rt = omdb_rating_value(omdb, "Rotten Tomatoes")

    meta =
      js_or(
        omdb_rating_value(omdb, "Metacritic"),
        if(truthy(g(omdb, "Metascore")) and g(omdb, "Metascore") != "N/A",
          do: "#{g(omdb, "Metascore")}/100",
          else: ""
        )
      )

    [
      %{
        "source" => "TMDB",
        "value" => if(vote != 0, do: "#{fixed1(vote)}/10", else: "No Data Available"),
        "subvalue" =>
          if(truthy(g(detail, "vote_count")),
            do: "#{locale_integer(g(detail, "vote_count"))} votes",
            else: ""
          ),
        "available" => vote != 0
      },
      %{
        "source" => "IMDb",
        "value" => js_or(imdb, "No Data Available"),
        "subvalue" =>
          if(truthy(g(external, "imdb_id")), do: "ID #{g(external, "imdb_id")}", else: ""),
        "url" =>
          if(truthy(g(external, "imdb_id")),
            do: "https://www.imdb.com/title/#{g(external, "imdb_id")}/",
            else: ""
          ),
        "available" => truthy(imdb)
      },
      %{
        "source" => "Rotten Tomatoes",
        "value" => js_or(rt, "No Data Available"),
        "subvalue" => if(truthy(omdb), do: "OMDb", else: ""),
        "available" => truthy(rt)
      },
      %{
        "source" => "Metacritic",
        "value" => js_or(meta, "No Data Available"),
        "subvalue" => if(truthy(omdb), do: "OMDb", else: ""),
        "available" => truthy(meta)
      }
    ]
  end

  # JavaScript source: emptyTitleDetails(mediaType, title = '')
  def empty_title_details(media_type, title \\ ""),
    do: %{
      "ok" => false,
      "type" => media_type,
      "title" => title,
      "ratings" => [],
      "trailers" => [],
      "cast" => [],
      "crew" => [],
      "productionCompanies" => [],
      "similar" => [],
      "moreByDirector" => [],
      "director" => nil,
      "about" => [],
      "playbackInfo" => []
    }

  # JavaScript source: tmdbRatingItemsOnly(detail)
  def tmdb_rating_items_only(detail) do
    vote = number_or(g(detail, "vote_average"), 0)

    if vote != 0,
      do: [
        %{
          "source" => "TMDB",
          "value" => "#{fixed1(vote)}/10",
          "subvalue" =>
            if(truthy(g(detail, "vote_count")),
              do: "#{locale_integer(g(detail, "vote_count"))} votes",
              else: ""
            ),
          "available" => true
        }
      ],
      else: []
  end

  # JavaScript source: hasExtendedDetail(data)
  def has_extended_detail(data),
    do:
      not is_nil(data) and
        Enum.any?(
          ["trailers", "cast", "crew", "productionCompanies", "similar", "moreByDirector"],
          &(list(g(data, &1)) != [])
        )

  # JavaScript source: buildTmdbExtendedDetails(mediaType, tmdbId, title, year)
  def build_tmdb_extended_details(media_type, tmdb_id, title, year),
    do: build_tmdb_detail_payload(media_type, tmdb_id, title, year, false)

  # JavaScript source: buildTitleDetails(mediaType, tmdbId, title, year)
  def build_title_details(media_type, tmdb_id, title, year),
    do: build_tmdb_detail_payload(media_type, tmdb_id, title, year, true)

  # JavaScript source: anonymous route handler(req, res) at server.js:8635 GET /api/title-details
  def route_title_details(conn) do
    initialize_state()
    conn = Plug.Conn.fetch_query_params(conn)
    q = conn.query_params
    type = request_media_type(q)

    normalized =
      split_search_title_year(
        js_or(g(q, "title"), js_or(g(q, "name"), "")),
        js_or(g(q, "year"), "")
      )

    title = g(normalized, "title")
    year = g(normalized, "year")
    tmdb = tmdb_id_from_request(q, type)
    key = "#{type}:#{js_or(tmdb, title)}:#{year}"
    cached = g(State.get(:title_details_cache, %{}), key)

    if cached and now_ms() - number_or(g(cached, "time"), 0) < @title_details_cache_ms do
      conn
      |> Plug.Conn.put_resp_header("cache-control", "public, max-age=900")
      |> Response.json(g(cached, "data"))
    else
      try do
        data =
          with_timeout(
            fn -> build_title_details(type, tmdb, title, year) end,
            5000,
            empty_title_details(type, title)
          )

        State.update(
          :title_details_cache,
          %{},
          &Map.put(&1, key, %{"time" => now_ms(), "data" => data})
        )

        conn
        |> Plug.Conn.put_resp_header("cache-control", "public, max-age=900")
        |> Response.json(data)
      rescue
        error ->
          IO.puts(:stderr, "/api/title-details error: #{Exception.message(error)}")
          Response.json(conn, empty_title_details(type, title))
      end
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:8659 GET /api/version
  def route_version(conn),
    do:
      Response.json(conn, %{
        "ok" => true,
        "version" => "title-details-route-active",
        "build" => "20260624-lite-ui-preview-cleanup2",
        "time" => DateTime.utc_now() |> DateTime.truncate(:millisecond) |> DateTime.to_iso8601()
      })

  # JavaScript source: anonymous route handler(req, res) at server.js:8668 GET /api/episode-titles
  def route_episode_titles(conn) do
    initialize_state()
    conn = Plug.Conn.fetch_query_params(conn)
    show = g(conn.query_params, "show")
    season = g(conn.query_params, "season")

    if not truthy(show) or not truthy(season) do
      Response.json(conn, %{"error" => "Missing show or season"}, 400)
    else
      clean =
        str(show)
        |> String.replace(~r/[\[\(][^\]\)]*[\]\)]/, "")
        |> String.replace(
          ~r/\b(720p|1080p|480p|4k|WEBRip|BluRay|x264|x265|HEVC|AAC|NF|AMZN|HDTV)\b.*/i,
          ""
        )
        |> spaces()

      key = "#{clean}__S#{season}"
      cache = State.get(:ep_title_cache, %{})

      if Map.has_key?(cache, key) do
        Response.json(conn, g(cache, key))
      else
        try do
          idkey = "__tmdb_id__#{clean}"
          id = g(cache, idkey)

          id =
            if truthy(id),
              do: id,
              else:
                g(tmdb_get("/search/tv?query=#{URI.encode_www_form(clean)}&page=1"), [
                  "results",
                  0,
                  "id"
                ])

          if not truthy(id) do
            Response.json(conn, [])
          else
            if not Map.has_key?(cache, idkey),
              do: State.update(:ep_title_cache, %{}, &Map.put(&1, idkey, id))

            if not Map.has_key?(cache, idkey), do: save_ep_cache()
            data = tmdb_get("/tv/#{id}/season/#{season}")
            episodes = list(g(data, "episodes"))

            if episodes == [] do
              Response.json(conn, [])
            else
              result =
                Enum.map(episodes, fn e ->
                  %{
                    "episode" => g(e, "episode_number"),
                    "title" => js_or(g(e, "name"), ""),
                    "overview" => js_or(g(e, "overview"), ""),
                    "thumb" =>
                      if(truthy(g(e, "still_path")),
                        do: @tmdb_img <> g(e, "still_path"),
                        else: nil
                      ),
                    "rating" =>
                      if(truthy(g(e, "vote_average")),
                        do: fixed1(g(e, "vote_average")),
                        else: nil
                      ),
                    "airDate" => js_or(g(e, "air_date"), "")
                  }
                end)

              State.update(:ep_title_cache, %{}, &Map.put(&1, key, result))
              save_ep_cache()
              Response.json(conn, result)
            end
          end
        rescue
          error ->
            IO.puts(:stderr, "[TMDB] Error: #{Exception.message(error)}")
            Response.json(conn, [])
        end
      end
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:8716 GET /api/media-info/:id
  def route_media_info(conn, id) do
    conn = Plug.Conn.fetch_query_params(conn)
    idx = parse_int_nil(id)
    entry = if is_integer(idx), do: Enum.at(Core.file_index(), idx), else: nil

    cond do
      is_nil(entry) ->
        Response.json(conn, %{"error" => "Not found"}, 404)

      not File.exists?(Core.entry_path(entry)) ->
        Response.json(conn, %{"error" => "File missing"}, 404)

      true ->
        path = Core.entry_path(entry)
        audio_only = g(conn.query_params, "audioOnly") == "1"

        try do
          info =
            if(audio_only,
              do: Core.get_cached_audio_only_media_info(path),
              else: Core.get_cached_media_info(path)
            )

          tracks = list(g(info, "audioTracks"))

          if audio_only and g(conn.query_params, "playbackType") == "media" do
            Response.json(conn, %{
              "audioTracks" => tracks,
              "duration" => number_or(g(info, "duration"), 0),
              "hasAudio" => tracks != []
            })
          else
            selected = Core.first_playable_audio_stream(tracks)
            audio_index = if selected, do: Enum.find_index(tracks, &(&1 == selected)), else: nil
            Core.log_audio_selection_fix(g(entry, "file"), tracks, selected)

            safety =
              if Core.is_kho_gaye_hum_kahan_title(g(entry, "file")),
                do: Core.kho_gaye_hum_kahan_audio_decision(tracks, g(entry, "file")),
                else: nil

            data =
              map(info)
              |> Map.put(
                "sidecarSubtitleTracks",
                if(audio_only, do: [], else: sidecar_tracks(entry, idx))
              )

            data =
              if is_integer(audio_index),
                do:
                  data
                  |> Map.put("audioIndex", audio_index)
                  |> Map.put("defaultAudioIndex", audio_index),
                else: data

            data =
              if safety,
                do:
                  data
                  |> Map.put("defaultAudioIndex", g(safety, "defaultAudioIndex"))
                  |> Map.put("audioSafeMode", true)
                  |> Map.put("audioStreamsDetected", g(safety, "audioStreamsDetected"))
                  |> Map.put("ffmpegMapping", g(safety, "ffmpegMapping")),
                else: data

            Response.json(conn, data)
          end
        rescue
          error ->
            IO.puts(
              :stderr,
              "[Media Info] Error for #{g(entry, "file")}: #{Exception.message(error)}"
            )

            if audio_only and g(conn.query_params, "playbackType") == "media",
              do:
                Response.json(conn, %{"audioTracks" => [], "duration" => 0, "hasAudio" => false}),
              else:
                Response.json(conn, %{
                  "audioTracks" => [],
                  "subtitleTracks" => [],
                  "sidecarSubtitleTracks" =>
                    if(audio_only, do: [], else: sidecar_tracks(entry, idx)),
                  "videoCodec" => "unknown",
                  "duration" => 0
                })
        end
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:8777 GET /api/duration/:id
  def route_duration(conn, id) do
    idx = parse_int_nil(id)
    entry = if is_integer(idx), do: Enum.at(Core.file_index(), idx), else: nil

    cond do
      is_nil(entry) ->
        Response.json(conn, %{"error" => "Not found"}, 404)

      not File.exists?(Core.entry_path(entry)) ->
        Response.json(conn, %{"error" => "File missing"}, 404)

      true ->
        try do
          Response.json(conn, %{
            "duration" =>
              number_or(
                g(Core.get_cached_duration_only_media_info(Core.entry_path(entry)), "duration"),
                0
              )
          })
        rescue
          error ->
            IO.puts(
              :stderr,
              "[Duration] Error for #{g(entry, "file")}: #{Exception.message(error)}"
            )

            Response.json(conn, %{"duration" => 0})
        end
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:8794 GET /api/qualities/:id
  def route_qualities(conn, id) do
    idx = parse_int_nil(id)
    entry = if is_integer(idx), do: Enum.at(Core.file_index(), idx), else: nil

    cond do
      is_nil(entry) ->
        Response.json(conn, %{"error" => "Not found"}, 404)

      not File.exists?(Core.entry_path(entry)) ->
        Response.json(conn, %{"error" => "File missing"}, 404)

      true ->
        file = str(g(entry, "file"))

        native =
          cond do
            Regex.match?(~r/2160p|4k|uhd/i, file) -> "2160p"
            Regex.match?(~r/1080p/i, file) -> "1080p"
            Regex.match?(~r/720p/i, file) -> "720p"
            Regex.match?(~r/480p/i, file) -> "480p"
            true -> "unknown"
          end

        size =
          case File.stat(Core.entry_path(entry)) do
            {:ok, s} -> round(s.size / (1024 * 1024))
            _ -> 0
          end

        Response.json(conn, %{
          "available" => ["auto", "1080p", "720p", "480p", "360p"],
          "native" => native,
          "sizeMB" => size
        })
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:8812 GET /api/subtitles/:id
  def route_subtitles(conn, id) do
    idx = parse_int_nil(id)
    entry = if is_integer(idx), do: Enum.at(Core.file_index(), idx), else: nil
    Response.json(conn, if(entry, do: sidecar_tracks(entry, idx), else: []))
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:8821 GET /api/history
  def route_history_get(conn), do: Response.json(conn, Core.watch_history())

  # JavaScript source: anonymous route handler(req, res) at server.js:8822 POST /api/history
  def route_history_post(conn) do
    body = map(conn.body_params)
    id = g(body, "id")
    progress = g(body, "progress")

    cond do
      not is_number(id) ->
        Response.json(conn, %{"error" => "valid id required"}, 400)

      not is_number(progress) or progress < 0 or progress > 1 ->
        Response.json(conn, %{"error" => "invalid progress"}, 400)

      true ->
        entry = %{
          "progress" => progress,
          "name" => str(js_or(g(body, "name"), "")) |> String.slice(0, 200),
          "poster" => js_or(g(body, "poster"), nil),
          "duration" => js_or(g(body, "duration"), 0),
          "updatedAt" => now_ms()
        }

        State.update(:watch_history, %{}, &Map.put(&1, str(id), entry))
        Core.save_history()
        Response.json(conn, %{"ok" => true})
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:8830 DELETE /api/history/:id
  def route_history_delete(conn, id) do
    case parse_int_nil(id) do
      nil ->
        Response.json(conn, %{"error" => "invalid id"}, 400)

      value ->
        State.update(:watch_history, %{}, &Map.delete(&1, str(value)))
        Core.save_history()
        Response.json(conn, %{"ok" => true})
    end
  end

  # JavaScript source: anonymous route handler(req, res) at server.js:8839 GET /api/refresh-poster/:id
  def route_refresh_poster(conn, id) do
    idx = parse_int_nil(id)
    entry = if is_integer(idx), do: Enum.at(Core.file_index(), idx), else: nil

    if is_nil(entry) do
      Response.json(conn, %{"error" => "Not found"}, 404)
    else
      key = Path.rootname(Path.basename(g(entry, "file")))
      State.update(:poster_cache, %{}, &Map.delete(&1, key))
      Core.save_cache()

      info =
        Core.omdb_enqueue(
          Core.clean_title(g(entry, "file")),
          if(g(entry, "type") == "episode", do: "series", else: "movie")
        )

      if info do
        State.update(:poster_cache, %{}, &Map.put(&1, key, info))
        Core.save_cache()
        Response.json(conn, info)
      else
        Response.json(conn, %{"error" => "Not found on TMDB"})
      end
    end
  end

  defp build_tmdb_detail_payload(media_type, tmdb_id, title, year, include_omdb) do
    {resolved, search} =
      if truthy(tmdb_id), do: {tmdb_id, nil}, else: begin_search(title, year, media_type)

    if not truthy(resolved) do
      empty_title_details(media_type, title)
    else
      paths = [
        fn -> tmdb_get("/#{media_type}/#{resolved}?language=en-US") end,
        fn -> tmdb_get("/#{media_type}/#{resolved}/credits?language=en-US") end,
        fn -> tmdb_get("/#{media_type}/#{resolved}/videos?language=en-US") end,
        fn -> tmdb_external_ids(media_type, resolved) end,
        fn -> tmdb_get("/#{media_type}/#{resolved}/similar?language=en-US&page=1") end,
        fn -> tmdb_get("/#{media_type}/#{resolved}/recommendations?language=en-US&page=1") end,
        fn ->
          tmdb_get(
            if(media_type == "tv",
              do: "/tv/#{resolved}/content_ratings",
              else: "/movie/#{resolved}/release_dates"
            )
          )
        end
      ]

      [detail_raw, credits_raw, videos_raw, external_raw, similar_raw, recs_raw, ratings_raw] =
        all_concurrent(paths)

      detail =
        if truthy(g(detail_raw, "id")),
          do: map(detail_raw),
          else: %{
            "id" => number_or(resolved, 0),
            "title" =>
              if(media_type == "movie",
                do: js_or(result_title(search, media_type), title),
                else: nil
              ),
            "name" =>
              if(media_type == "tv",
                do: js_or(result_title(search, media_type), title),
                else: nil
              ),
            "overview" => js_or(g(search, "overview"), ""),
            "poster_path" => js_or(g(search, "poster_path"), nil),
            "backdrop_path" => js_or(g(search, "backdrop_path"), nil),
            "release_date" => js_or(g(search, "release_date"), ""),
            "first_air_date" => js_or(g(search, "first_air_date"), ""),
            "vote_average" => js_or(g(search, "vote_average"), 0),
            "vote_count" => js_or(g(search, "vote_count"), 0),
            "genres" => [],
            "status" => ""
          }

      if not truthy(g(detail, "id")) do
        empty_title_details(media_type, title)
      else
        credits = map(credits_raw)
        external = map(external_raw)
        omdb = if(include_omdb, do: omdb_by_imdb_id(g(external, "imdb_id")), else: nil)

        created =
          if media_type == "tv",
            do: Enum.map(list(g(detail, "created_by")), &Map.put(map(&1), "job", "Creator")),
            else: []

        trailers = map_videos(g(videos_raw, "results", []))

        trailers =
          if trailers == [],
            do:
              youtube_trailer_fallback(
                if(media_type == "tv", do: g(detail, "name"), else: g(detail, "title")),
                js_or(result_year(detail, media_type), year),
                media_type
              ),
            else: trailers

        cast = map_people(g(credits, "cast", []), "character", 18)

        crew =
          (created ++ list(g(credits, "crew")))
          |> Enum.filter(
            &Regex.match?(
              ~r/director|creator|producer|writer|screenplay|showrunner/i,
              str(js_or(g(&1, "job"), ""))
            )
          )
          |> map_people("job", 18)

        companies =
          map_companies(
            if list(g(detail, "production_companies")) != [],
              do: g(detail, "production_companies"),
              else: g(detail, "networks")
          )

        mapped =
          map_unique_media(
            list(g(similar_raw, "results")) ++ list(g(recs_raw, "results")),
            media_type,
            g(detail, "id")
          )

        director =
          try do
            more_by_director(detail, credits, media_type)
          rescue
            error ->
              IO.puts(
                :stderr,
                "[#{if(include_omdb, do: "TitleDetails", else: "Details")}] more by director unavailable: #{Exception.message(error)}"
              )

              %{"person" => nil, "items" => []}
          end

        detail =
          Map.put(
            detail,
            if(media_type == "tv", do: "content_ratings", else: "release_dates"),
            js_or(ratings_raw, nil)
          )

        genres = list(g(detail, "genres")) |> Enum.map(&g(&1, "name")) |> Enum.join(", ")

        seed = %{
          "name" => if(media_type == "tv", do: g(detail, "name"), else: g(detail, "title")),
          "year" => result_year(detail, media_type),
          "genre" => genres,
          "language" => language_label(detail)
        }

        similar = sv_resolve_playable_detail_recommendations(seed, media_type, mapped, 18)

        director_items =
          sv_resolve_playable_detail_recommendations(
            seed,
            media_type,
            g(director, "items", []),
            18
          )

        payload = %{
          "ok" => true,
          "tmdbId" => g(detail, "id"),
          "imdbId" => js_or(g(external, "imdb_id"), ""),
          "type" => media_type,
          "title" => if(media_type == "tv", do: g(detail, "name"), else: g(detail, "title")),
          "overview" => js_or(g(detail, "overview"), ""),
          "poster" => tmdb_image("w500", g(detail, "poster_path")),
          "backdrop" => tmdb_image("w1280", g(detail, "backdrop_path")),
          "year" =>
            str(
              if(media_type == "tv",
                do: g(detail, "first_air_date"),
                else: g(detail, "release_date")
              )
            )
            |> String.slice(0, 4),
          "rating" =>
            if(truthy(g(detail, "vote_average")),
              do: fixed1(g(detail, "vote_average")),
              else: nil
            ),
          "runtime" =>
            if(media_type == "movie" and truthy(g(detail, "runtime")),
              do: "#{g(detail, "runtime")} min",
              else: ""
            ),
          "genres" => genres,
          "language" => language_label(detail),
          "ratings" =>
            if(include_omdb,
              do: rating_items(detail, external, omdb),
              else: tmdb_rating_items_only(detail)
            ),
          "trailers" => trailers,
          "cast" => cast,
          "crew" => crew,
          "productionCompanies" => companies,
          "similar" => similar,
          "moreByDirector" => director_items,
          "director" => g(director, "person"),
          "about" => about_items(detail, media_type),
          "playbackInfo" => []
        }

        if include_omdb, do: payload, else: Map.put(payload, "genre", genres)
      end
    end
  end

  defp begin_search(title, year, type) do
    result = search_tmdb_media(title, year, type)
    {g(result, "id"), result}
  end

  defp all_concurrent(functions),
    do:
      functions
      |> Enum.map(fn fun ->
        Task.async(fn ->
          try do
            fun.()
          rescue
            _ -> nil
          end
        end)
      end)
      |> Enum.map(&Task.await(&1, :infinity))

  defp build_detail_index(items, type) do
    playable = Enum.filter(items, &sv_server_playable_item(&1, type))

    rows =
      Enum.map(playable, fn item ->
        title =
          normalized_title_key(
            js_or(g(item, "name"), js_or(g(item, "title"), js_or(g(item, "file"), "")))
          )

        year =
          playback_title_year(
            js_or(g(item, "year"), js_or(g(item, "name"), js_or(g(item, "title"), "")))
          )

        %{
          "item" => item,
          "title" => title,
          "year" => number_or(year, 0),
          "genres" => split_detail_genres(g(item, "genre")),
          "tokens" => sv_detail_title_tokens(js_or(g(item, "name"), js_or(g(item, "title"), ""))),
          "category" => trim_lower(g(item, "category")),
          "language" => trim_lower(g(item, "language")),
          "rating" => min(number_or(g(item, "rating"), 0), 10)
        }
      end)

    exact =
      Enum.reduce(rows, %{}, fn row, acc ->
        title = g(row, "title")
        year = if(g(row, "year") != 0, do: str(g(row, "year")), else: "")

        if title == "",
          do: acc,
          else:
            acc
            |> put_first("#{title}|#{year}", g(row, "item"))
            |> put_first(title, g(row, "item"))
      end)

    token = multi_index(rows, "tokens")
    genres = multi_index(rows, "genres")
    category = single_index(rows, "category")
    language = single_index(rows, "language")

    years =
      rows
      |> Enum.reduce(%{}, fn row, acc -> append_map(acc, str(js_or(g(row, "year"), "")), row) end)

    %{
      "playable" => playable,
      "rows" => rows,
      "exact" => exact,
      "tokenMap" => token,
      "genreMap" => genres,
      "categoryMap" => category,
      "languageMap" => language,
      "yearMap" => years,
      "top" => rows |> Enum.sort_by(&(-g(&1, "rating"))) |> Enum.take(300)
    }
  end

  defp multi_index(rows, key),
    do:
      Enum.reduce(rows, %{}, fn row, acc ->
        Enum.reduce(list(g(row, key)), acc, &append_map(&2, &1, row))
      end)

  defp single_index(rows, key), do: Enum.reduce(rows, %{}, &append_map(&2, g(&1, key), &1))
  defp append_map(map, "", _row), do: map
  defp append_map(map, nil, _row), do: map
  defp append_map(map, key, row), do: Map.update(map, key, [row], &(&1 ++ [row]))

  defp put_first(map, key, value),
    do: if(Map.has_key?(map, key), do: map, else: Map.put(map, key, value))

  defp add_recommendations(
         {resolved, seen},
         items,
         _seed,
         type,
         current_title,
         current_year,
         comparable,
         _limit
       ) do
    Enum.reduce(items, {resolved, seen}, fn item, {out, seen} ->
      title =
        normalized_title_key(
          js_or(g(item, "name"), js_or(g(item, "title"), js_or(g(item, "file"), "")))
        )

      year =
        playback_title_year(
          js_or(g(item, "year"), js_or(g(item, "name"), js_or(g(item, "title"), "")))
        )

      comparable_title =
        sv_detail_comparable_title(
          js_or(g(item, "name"), js_or(g(item, "title"), js_or(g(item, "file"), "")))
        )

      key = sv_detail_item_identity(item, type)

      same_title =
        (title == current_title or (comparable != "" and comparable_title == comparable)) and
          (current_year == "" or year == "" or year == current_year)

      if not sv_server_playable_item(item, type) or same_title or key == "" or
           MapSet.member?(seen, key) do
        {out, seen}
      else
        {out ++ [item], MapSet.put(seen, key)}
      end
    end)
  end

  defp genre_overlap(left, right) do
    Enum.count(left, fn genre ->
      Enum.any?(right, &(String.contains?(genre, &1) or String.contains?(&1, genre)))
    end)
  end

  defp year_bonus(a, b, rules) do
    if a == 0 or b == 0 do
      0
    else
      delta = abs(a - b)

      case Enum.find(rules, fn {maximum, _score} -> delta <= maximum end) do
        nil -> 0
        {_maximum, score} -> score
      end
    end
  end

  defp add_rows(set, rows), do: Enum.reduce(rows, set, &MapSet.put(&2, &1))
  defp uniq_terms(items), do: items |> MapSet.new() |> MapSet.to_list()

  defp begin_pool(exact, year, id) do
    pool =
      if year != "" do
        same_year =
          Enum.filter(exact, fn item ->
            playback_title_year(js_or(g(item, "year"), js_or(g(item, "name"), g(item, "title")))) ==
              year
          end)

        if same_year == [], do: exact, else: same_year
      else
        exact
      end

    Enum.find(pool, fn item ->
      id != "" and
        (str(js_or(g(item, "id"), "")) == id or
           str(js_or(g(item, "tmdbId"), "")) == id)
    end) || Enum.at(pool, 0)
  end

  defp section_case(key, movies, series, all) do
    pick = fn words -> sv_home_sort(Enum.filter(all, &sv_has_any(sv_home_text(&1), words))) end

    case key do
      "series" ->
        sv_home_sort(series)

      "allMovies" ->
        sv_home_sort(movies)

      "topRated" ->
        sv_home_sort(Enum.filter(all, &(sv_rating_num(&1) >= 8)))

      value when value in ["new", "recentlyAdded"] ->
        sv_home_sort(all) |> Enum.sort_by(&(-sv_year_num(&1)))

      value when value in ["trending", "mostWatchedToday"] ->
        sv_home_sort(all) |> Enum.take(300)

      "netflix" ->
        sv_latest_netflix_section(all)

      "marvel" ->
        sv_popular_featured_section(all, "marvel")

      "dc" ->
        sv_popular_featured_section(all, "dc")

      value when value in ["universal", "disney", "warner", "hbo", "apple"] ->
        sv_studio_section(all, value)

      "indian" ->
        pick.([
          "hindi",
          "bangla",
          "bengali",
          "kolkata",
          "tamil",
          "telugu",
          "malayalam",
          "kannada",
          "punjabi",
          "bollywood",
          "south indian",
          "india"
        ])

      "anime" ->
        pick.([
          "anime",
          "animation",
          "japanese",
          "demon slayer",
          "naruto",
          "one piece",
          "jujutsu",
          "attack on titan"
        ])

      "koreanDrama" ->
        pick.(["korean", "k-drama", "k drama", "korea"])

      "horrorNights" ->
        pick.(["horror", "ghost", "haunt", "demon", "evil", "conjuring", "scream", "strangers"])

      "cyberpunkScifi" ->
        pick.([
          "sci-fi",
          "science fiction",
          "cyberpunk",
          "space",
          "alien",
          "robot",
          "ai",
          "future",
          "matrix",
          "blade runner"
        ])

      "mindfuck" ->
        pick.([
          "mind",
          "dream",
          "memory",
          "loop",
          "inception",
          "tenet",
          "shutter island",
          "memento",
          "black mirror"
        ])

      "cultClassics" ->
        pick.(["cult", "classic", "pulp fiction", "fight club", "trainspotting", "big lebowski"])

      "a24" ->
        pick.([
          "a24",
          "hereditary",
          "midsommar",
          "moonlight",
          "lady bird",
          "ex machina",
          "uncut gems",
          "everything everywhere"
        ])

      "nostalgia90s" ->
        sv_home_sort(Enum.filter(all, &(sv_year_num(&1) >= 1990 and sv_year_num(&1) <= 1999)))

      "midnightCinema" ->
        pick.(["midnight", "neon", "noir", "cult", "horror", "thriller"])

      "trueCrime" ->
        pick.(["true crime", "crime documentary", "serial killer", "murder", "detective"])

      "psychThriller" ->
        pick.(["psychological", "thriller", "mystery", "suspense", "obsession"])

      "adultAnimation" ->
        pick.(["adult animation", "rick and morty", "family guy", "south park", "bojack"])

      "postApocalyptic" ->
        pick.([
          "apocalypse",
          "post-apocalyptic",
          "zombie",
          "wasteland",
          "last of us",
          "walking dead"
        ])

      "feelGood" ->
        pick.(["comedy", "family", "feel good", "romance", "adventure"])

      "darkComedy" ->
        pick.(["dark comedy", "black comedy", "satire"])

      "timeTravel" ->
        pick.(["time travel", "time loop", "back to the future", "timeline"])

      "spaceAi" ->
        pick.([
          "space",
          "artificial intelligence",
          " ai ",
          "robot",
          "mars",
          "moon",
          "interstellar"
        ])

      "crimeSyndicates" ->
        pick.(["crime", "mafia", "gang", "cartel", "syndicate", "godfather", "peaky blinders"])

      "zombie" ->
        pick.(["zombie", "undead", "walking dead", "resident evil"])

      "indieGems" ->
        pick.(["indie", "festival", "independent"])

      "hiddenMasterpieces" ->
        sv_home_sort(
          Enum.filter(
            all,
            &(sv_rating_num(&1) >= 7 and (truthy(g(&1, "poster")) or truthy(g(&1, "backdrop"))))
          )
        )
        |> Enum.take(500)

      "liveConcerts" ->
        pick.(["concert", "music", "live", "documentary"])

      "documentaryVault" ->
        pick.(["documentary", "docu", "nature", "history", "biography"])

      "ghibli" ->
        pick.(["ghibli", "miyazaki", "spirited away", "totoro", "howl"])

      "romanceMidnight" ->
        pick.(["romance", "romantic", "love", "relationship"])

      "comingSoon" ->
        sv_home_sort(Enum.filter(all, &(sv_year_num(&1) >= local_year())))

      "drama" ->
        pick.(["drama", "emotion", "life", "family"])

      "spanish" ->
        pick.(["spanish", "latino", "latin", "mexico", "argentina", "colombia"])

      _ ->
        sv_home_sort(all)
    end
  end

  defp begin_featured(best, item, key) do
    ranked = sv_featured_media_score(item, key)

    if g(ranked, "score", 0) == 0 do
      best
    else
      dedupe = sv_featured_dedupe_key(item, key, g(ranked, "phrase"))

      candidate = %{
        "item" => item,
        "score" => g(ranked, "score"),
        "phrase" => g(ranked, "phrase")
      }

      current = g(best, dedupe)

      if is_nil(current) or sv_better_featured_candidate(current, candidate) < 0,
        do: Map.put(best, dedupe, candidate),
        else: best
    end
  end

  defp longer(left, right), do: if(length(right) > length(left), do: right, else: left)

  defp series_route_item(show) do
    seasons =
      list(g(show, "seasons"))
      |> Enum.reduce(%{}, fn season, acc ->
        num = first_digits(g(season, "season"), 1)

        eps =
          list(g(season, "episodes"))
          |> Enum.with_index()
          |> Enum.map(fn {ep, i} ->
            parsed = Core.parse_series_filename(g(ep, "filename"))
            number = js_or(g(parsed, "episode"), i + 1)

            %{
              "streamId" => nil,
              "episode" => number,
              "epTitle" => js_or(trim(g(parsed, "epTitle")), "Episode #{number}"),
              "file" => g(ep, "filename"),
              "streamUrl" => g(ep, "streamUrl"),
              "isFtp" => true
            }
          end)

        Map.put(acc, num, eps)
      end)

    %{
      "name" => g(show, "title"),
      "title" => g(show, "title"),
      "poster" => js_or(g(show, "poster"), nil),
      "backdrop" => js_or(g(show, "backdrop"), js_or(g(show, "poster"), nil)),
      "tmdbId" => js_or(g(show, "tmdbId"), nil),
      "year" => js_or(g(show, "year"), ""),
      "rating" => js_or(g(show, "rating"), nil),
      "genre" => js_or(g(show, "genre"), ""),
      "type" => "series",
      "isFtp" => true,
      "seasons" => seasons
    }
  end

  defp sidecar_tracks(entry, idx),
    do:
      Core.find_subtitle_tracks(g(entry, "dir"), g(entry, "file"))
      |> Enum.with_index()
      |> Enum.map(fn {track, i} ->
        %{
          "index" => i,
          "label" => g(track, "label"),
          "lang" => g(track, "lang"),
          "ext" => g(track, "ext"),
          "src" => "/subtitles/#{idx}/#{i}",
          "sidecar" => true
        }
      end)

  defp g(value, key_or_path), do: g(value, key_or_path, nil)
  defp g(value, [], _default), do: value

  defp g(value, [head | tail], default) do
    case g(value, head, :missing) do
      :missing -> default
      next -> g(next, tail, default)
    end
  end

  defp g(map, key, default) when is_map(map) do
    case Map.fetch(map, key) do
      {:ok, value} -> value
      :error -> Map.get(map, str(key), default)
    end
  end

  defp g(values, index, default) when is_list(values) and is_integer(index) do
    Enum.at(values, index, default)
  end

  defp g(_value, _key, default), do: default

  defp map(value) when is_map(value), do: value
  defp map(_value), do: %{}
  defp list(value) when is_list(value), do: value
  defp list(_value), do: []
  defp truthy(value), do: StreamVault.JS.truthy?(value)
  defp js_or(value, fallback), do: if(truthy(value), do: value, else: fallback)
  defp js_nullish(nil, fallback), do: fallback
  defp js_nullish(value, _fallback), do: value

  defp str(nil), do: ""
  defp str(true), do: "true"
  defp str(false), do: "false"
  defp str(value) when is_binary(value), do: value
  defp str(value) when is_integer(value), do: Integer.to_string(value)

  defp str(value) when is_float(value) do
    if trunc(value) == value, do: Integer.to_string(trunc(value)), else: Float.to_string(value)
  end

  defp str(value) when is_atom(value), do: Atom.to_string(value)
  defp str(value) when is_map(value), do: "[object Object]"
  defp str(value), do: to_string(value)

  defp trim(value), do: value |> js_or("") |> str() |> String.trim()
  defp trim_lower(value), do: value |> trim() |> String.downcase()
  defp spaces(value), do: value |> String.replace(~r/\s+/, " ") |> String.trim()

  defp year_from(value) do
    case Regex.run(~r/(?:19|20)\d{2}/, str(js_or(value, ""))) do
      [year | _rest] -> year
      _other -> ""
    end
  end

  defp title_words(value, minimum_length) do
    value
    |> normalized_title_key()
    |> String.split(~r/\s+/, trim: true)
    |> Enum.filter(&(String.length(&1) > minimum_length))
    |> MapSet.new()
  end

  defp first_digits(value, fallback) do
    case Regex.run(~r/\d+/, str(js_or(value, ""))) do
      [number | _rest] -> int_or(number, fallback)
      _other -> fallback
    end
  end

  defp number_or(value, fallback) do
    case StreamVault.JS.number(value) do
      number when is_number(number) -> number
      _other -> fallback
    end
  end

  defp int_or(value, fallback) do
    case Integer.parse(str(js_or(value, ""))) do
      {number, _rest} -> number
      :error -> fallback
    end
  end

  defp parse_int_nil(value) do
    case Integer.parse(str(value)) do
      {number, _rest} -> number
      :error -> nil
    end
  end

  defp now_ms, do: System.system_time(:millisecond)
  defp bool_num(true), do: 1
  defp bool_num(_value), do: 0
  defp ceil_div(0, _divisor), do: 0
  defp ceil_div(value, divisor), do: div(value + divisor - 1, divisor)

  defp local_year do
    {{year, _month, _day}, _time} = :calendar.local_time()
    year
  end

  defp fixed1(value) do
    :erlang.float_to_binary(number_or(value, 0) * 1.0, decimals: 1)
  end

  defp locale_integer(value) do
    value
    |> number_or(0)
    |> trunc()
    |> Integer.to_string()
    |> String.reverse()
    |> String.graphemes()
    |> Enum.chunk_every(3)
    |> Enum.map(&Enum.join/1)
    |> Enum.join(",")
    |> String.reverse()
  end

  defp env_first(names) do
    names
    |> Enum.map(&System.get_env/1)
    |> Enum.find("", &truthy/1)
  end

  defp search_kind(raw) do
    case trim_lower(raw) do
      value when value in ["movie", "movies"] -> "movie"
      value when value in ["series", "tv", "show", "shows"] -> "series"
      _value -> "mixed"
    end
  end

  defp dedupe_by(items, key_function) do
    {_seen, output} =
      Enum.reduce(items, {MapSet.new(), []}, fn item, {seen, output} ->
        key = key_function.(item)

        if MapSet.member?(seen, key) do
          {seen, output}
        else
          {MapSet.put(seen, key), output ++ [item]}
        end
      end)

    output
  end

  defp dedupe_append(base, extra, key_function) do
    seen = MapSet.new(Enum.map(base, key_function))

    {_seen, added} =
      Enum.reduce(extra, {seen, []}, fn item, {seen, output} ->
        key = key_function.(item)

        if MapSet.member?(seen, key) do
          {seen, output}
        else
          {MapSet.put(seen, key), output ++ [item]}
        end
      end)

    base ++ added
  end

  defp dedupe_optional_id(items) do
    {_seen, output} =
      Enum.reduce(items, {MapSet.new(), []}, fn person, {seen, output} ->
        id = g(person, "id")

        cond do
          not truthy(id) -> {seen, output ++ [person]}
          MapSet.member?(seen, id) -> {seen, output}
          true -> {MapSet.put(seen, id), output ++ [person]}
        end
      end)

    output
  end

  defp begin_card(item, type, name) do
    card = %{
      "id" => if(type == "tv", do: "tmdb_tv_#{g(item, "id")}", else: "tmdb_#{g(item, "id")}"),
      "tmdbId" => g(item, "id"),
      "name" => name,
      "type" => type,
      "poster" => tmdb_image("w500", g(item, "poster_path")),
      "backdrop" => tmdb_image("w1280", g(item, "backdrop_path")),
      "overview" => js_or(g(item, "overview"), ""),
      "year" => result_year(item, type),
      "rating" =>
        if(truthy(g(item, "vote_average")), do: fixed1(g(item, "vote_average")), else: nil),
      "genre" =>
        item
        |> g("genre_ids")
        |> list()
        |> Enum.take(3)
        |> Enum.map(&Map.get(@tmdb_genres, &1))
        |> Enum.filter(&truthy/1)
        |> Enum.join(", "),
      "isTrending" => true,
      "streamUrl" => nil,
      "isFtp" => false
    }

    if type == "tv", do: Map.put(card, "seasons", %{}), else: card
  end
end

defmodule StreamVault.Playback do
  @moduledoc false
  use GenServer

  alias StreamVault.{Command, Core, Files, JS, Paths, Response}

  # The GenServer owns the isolated compatibility-HLS registry.  The FFmpeg
  # ports themselves are owned by long-lived worker processes so they survive
  # the request which creates a session, just as the child processes in Node do.
  def start_link(_options),
    do:
      GenServer.start_link(__MODULE__, %{sessions: %{}, cleanup_timer: nil, conversion_jobs: %{}},
        name: __MODULE__
      )

  @impl true
  def init(state), do: {:ok, state}

  @impl true
  def handle_call({:session, id}, _from, state), do: {:reply, Map.get(state.sessions, id), state}

  def handle_call({:put_session, session}, _from, state) do
    timer = state.cleanup_timer || Process.send_after(self(), :cleanup, 30_000)
    sessions = Map.put(state.sessions, session.id, session)
    {:reply, session, %{state | sessions: sessions, cleanup_timer: timer}}
  end

  def handle_call({:touch_session, id}, _from, state) do
    case Map.fetch(state.sessions, id) do
      {:ok, session} ->
        session = %{session | last_access: JS.date_now()}
        {:reply, session, %{state | sessions: Map.put(state.sessions, id, session)}}

      :error ->
        {:reply, nil, state}
    end
  end

  def handle_call({:stop_session, id, reason, remove_files}, _from, state) do
    {session, sessions} = Map.pop(state.sessions, id)
    stop_session_resources(session, reason, remove_files)
    {:reply, session, %{state | sessions: sessions}}
  end

  def handle_call(:cleanup_sessions, _from, state) do
    state = cleanup_session_state(state)
    {:reply, :ok, state}
  end

  def handle_call(:ensure_cleanup_timer, _from, state) do
    timer = state.cleanup_timer || Process.send_after(self(), :cleanup, 30_000)
    {:reply, :ok, %{state | cleanup_timer: timer}}
  end

  def handle_call({:convert_mobile, options, key, final_path}, from, state) do
    cond do
      completed_mobile_mp4(final_path) ->
        {:reply, {:ok, mobile_conversion_result(key, final_path)}, state}

      job = Map.get(state.conversion_jobs, key) ->
        jobs = Map.put(state.conversion_jobs, key, %{job | waiters: [from | job.waiters]})
        {:noreply, %{state | conversion_jobs: jobs}}

      true ->
        owner = self()

        pid =
          spawn(fn ->
            result =
              try do
                {:ok, perform_mobile_conversion(options, key, final_path)}
              rescue
                error -> {:error, Exception.message(error)}
              catch
                kind, reason -> {:error, Exception.format(kind, reason, __STACKTRACE__)}
              end

            send(owner, {:mobile_conversion_complete, key, result})
          end)

        jobs = Map.put(state.conversion_jobs, key, %{pid: pid, waiters: [from]})
        {:noreply, %{state | conversion_jobs: jobs}}
    end
  end

  @impl true
  def handle_cast({:session_process, id, token, pid}, state) do
    sessions = update_matching_session(state.sessions, id, token, &Map.put(&1, :process, pid))
    {:noreply, %{state | sessions: sessions}}
  end

  def handle_cast({:session_error, id, token, error}, state) do
    sessions =
      update_matching_session(state.sessions, id, token, fn session ->
        %{session | error: error, process: nil}
      end)

    {:noreply, %{state | sessions: sessions}}
  end

  def handle_cast({:session_closed, id, token, status, stderr}, state) do
    sessions =
      update_matching_session(state.sessions, id, token, fn session ->
        error =
          if not session.ready and status != 0,
            do: "FFmpeg exited #{status}: #{tail(stderr, 1000)}",
            else: session.error

        %{session | process: nil, error: error}
      end)

    {:noreply, %{state | sessions: sessions}}
  end

  def handle_cast({:session_ready, id}, state) do
    sessions =
      case Map.fetch(state.sessions, id) do
        {:ok, session} ->
          Map.put(state.sessions, id, %{session | ready: true, last_access: JS.date_now()})

        :error ->
          state.sessions
      end

    {:noreply, %{state | sessions: sessions}}
  end

  @impl true
  def handle_info(:cleanup, state) do
    {:noreply, cleanup_session_state(%{state | cleanup_timer: nil})}
  end

  def handle_info({:mobile_conversion_complete, key, result}, state) do
    case Map.pop(state.conversion_jobs, key) do
      {nil, jobs} ->
        {:noreply, %{state | conversion_jobs: jobs}}

      {job, jobs} ->
        Enum.each(job.waiters, &GenServer.reply(&1, result))
        {:noreply, %{state | conversion_jobs: jobs}}
    end
  end

  defp cleanup_session_state(state) do
    now = JS.date_now()
    idle = Core.config(:mobile_compat_hls_idle_ms)

    {expired, active} =
      Enum.split_with(Map.values(state.sessions), &(now - &1.last_access > idle))

    Enum.each(expired, &stop_session_resources(&1, "idle", true))
    active = Enum.sort_by(active, & &1.last_access)
    maximum = max(0, trunc(Core.config(:mobile_compat_hls_max_sessions) || 4))
    excess = max(0, length(active) - maximum)
    {removed, kept} = Enum.split(active, excess)
    Enum.each(removed, &stop_session_resources(&1, "session limit", true))
    sessions = Map.new(kept, &{&1.id, &1})

    timer =
      if map_size(sessions) == 0, do: nil, else: Process.send_after(self(), :cleanup, 30_000)

    %{state | sessions: sessions, cleanup_timer: timer}
  end

  defp update_matching_session(sessions, id, token, fun) do
    case Map.fetch(sessions, id) do
      {:ok, session} when session.process_token == token -> Map.put(sessions, id, fun.(session))
      _ -> sessions
    end
  end

  defp session(id), do: GenServer.call(__MODULE__, {:session, id})
  defp put_session(value), do: GenServer.call(__MODULE__, {:put_session, value})
  defp touch_session(id), do: GenServer.call(__MODULE__, {:touch_session, id})

  defp g(value, key, default \\ nil), do: JS.get(value, key, default)
  defp list(value), do: JS.array(value)
  defp truthy?(value), do: JS.truthy?(value)
  defp opt(options, key, default \\ nil), do: JS.get(options, key, default)

  defp q(conn, key, default \\ nil) do
    case conn.query_params do
      %Plug.Conn.Unfetched{} -> default
      params when is_map(params) -> Map.get(params, key, default)
      _ -> default
    end
  end

  defp header(conn, name, default \\ nil) do
    case Plug.Conn.get_req_header(conn, String.downcase(name)) do
      [value | _] -> value
      _ -> default
    end
  end

  defp string_key_map(value) when is_map(value),
    do: Map.new(value, fn {key, item} -> {to_string(key), item} end)

  defp string_key_map(_value), do: %{}

  defp finite_number(nil), do: nil

  defp finite_number(value) do
    case JS.number(value) do
      number when is_number(number) -> number
      _ -> nil
    end
  end

  defp number_or_zero(value), do: finite_number(value) || 0

  defp int_or(value, fallback) do
    case JS.parse_int(value) do
      value when is_integer(value) -> value
      _ -> fallback
    end
  end

  defp parse_int_or_nil(value) do
    case JS.parse_int(value) do
      value when is_integer(value) -> value
      _ -> nil
    end
  end

  defp float_or(value, fallback) do
    case JS.parse_float(value) do
      value when is_number(value) -> value
      _ -> fallback
    end
  end

  defp first_integer(values) do
    Enum.find_value(values, fn
      nil ->
        nil

      value ->
        case JS.number(value) do
          number when is_integer(number) -> {:found, number}
          number when is_float(number) and trunc(number) == number -> {:found, trunc(number)}
          _ -> nil
        end
    end)
    |> case do
      {:found, number} -> number
      _ -> nil
    end
  end

  defp js_number_string(value), do: JS.string(value)
  defp random_hex(bytes), do: :crypto.strong_rand_bytes(bytes) |> Base.encode16(case: :lower)

  defp regular_size(path) do
    case File.stat(path) do
      {:ok, %{type: :regular, size: size}} -> size
      _ -> 0
    end
  end

  defp regular_positive?(path), do: regular_size(path) > 0

  defp tail(value, maximum) when is_binary(value) do
    if byte_size(value) <= maximum,
      do: value,
      else: binary_part(value, byte_size(value) - maximum, maximum)
  end

  defp put_headers(conn, headers), do: Response.put_headers(conn, headers)

  defp stop_session_resources(nil, _reason, _remove_files), do: :ok

  defp stop_session_resources(session, reason, remove_files) do
    if is_pid(session.process), do: send(session.process, :stop)
    if remove_files, do: Files.rm_rf_inside(Paths.isolated_hls(), session.dir)
    IO.puts("[Mobile Isolated HLS] stop #{session.id} (#{reason})")
    :ok
  end

  defp open_stdout(executable, arguments) do
    Port.open({:spawn_executable, to_charlist(executable)}, [
      :binary,
      :exit_status,
      :use_stdio,
      args: Enum.map(arguments, &(to_string(&1) |> to_charlist()))
    ])
  end

  defp open_merged(executable, arguments),
    do: Command.open(executable, Enum.map(arguments, &to_string/1))

  defp media_stream_headers(conn, cache_control) do
    headers = [
      {"content-type", "video/mp4"},
      {"accept-ranges", "none"},
      {"access-control-allow-origin", "*"}
    ]

    headers =
      if is_binary(cache_control),
        do: headers ++ [{"cache-control", cache_control}],
        else: headers

    put_headers(conn, headers)
  end

  defp stream_ffmpeg(conn, arguments, _startup_timeout, spawn_error_body) do
    try do
      port = open_stdout(Command.executable(:ffmpeg), arguments)
      stream_ffmpeg_wait(conn, port, false, spawn_error_body)
    rescue
      error ->
        IO.warn("[FFmpeg] spawn error: #{Exception.message(error)}")
        Response.text(conn, spawn_error_body, 500)
    end
  end

  defp stream_ffmpeg_wait(conn, port, started, spawn_error_body) do
    receive do
      {^port, {:data, data}} ->
        if started do
          case Plug.Conn.chunk(conn, data) do
            {:ok, conn} ->
              stream_ffmpeg_wait(conn, port, true, spawn_error_body)

            {:error, _reason} ->
              Command.terminate(port)
              conn
          end
        else
          conn = Plug.Conn.send_chunked(conn, 200)

          case Plug.Conn.chunk(conn, data) do
            {:ok, conn} ->
              stream_ffmpeg_wait(conn, port, true, spawn_error_body)

            {:error, _reason} ->
              Command.terminate(port)
              conn
          end
        end

      {^port, {:exit_status, _status}} ->
        if started, do: conn, else: Plug.Conn.send_resp(conn, 200, "")
    end
  end

  defp subtitle_headers(conn) do
    put_headers(conn, [
      {"content-type", "text/vtt; charset=utf-8"},
      {"access-control-allow-origin", "*"},
      {"cache-control", "public, max-age=3600"}
    ])
  end

  defp stream_subtitle(conn, arguments) do
    try do
      port = open_stdout(Command.executable(:ffmpeg), arguments)
      reference = make_ref()
      timer = Process.send_after(self(), {:subtitle_watchdog, reference, port}, 30_000)
      stream_subtitle_loop(conn, port, reference, timer, false, 0)
    rescue
      error ->
        IO.warn("[Subtitle] spawn error: #{Exception.message(error)}")
        Plug.Conn.send_resp(conn, 500, "WEBVTT\n\n")
    end
  end

  defp stream_subtitle_loop(conn, port, reference, timer, started, bytes) do
    receive do
      {^port, {:data, data}} ->
        {conn, started, continue} =
          if started do
            case Plug.Conn.chunk(conn, data) do
              {:ok, conn} -> {conn, true, true}
              {:error, _} -> {conn, true, false}
            end
          else
            conn = Plug.Conn.send_chunked(conn, 200)

            case Plug.Conn.chunk(conn, data) do
              {:ok, conn} -> {conn, true, true}
              {:error, _} -> {conn, true, false}
            end
          end

        if continue do
          stream_subtitle_loop(conn, port, reference, timer, started, bytes + byte_size(data))
        else
          Process.cancel_timer(timer)
          Command.terminate(port)
          conn
        end

      {^port, {:exit_status, status}} ->
        Process.cancel_timer(timer)
        if status != 0, do: IO.warn("[Subtitle] FFmpeg exited with code #{status}")
        if started or bytes > 0, do: conn, else: Plug.Conn.send_resp(conn, 200, "WEBVTT\n\n")

      {:subtitle_watchdog, ^reference, ^port} ->
        Command.terminate(port)
        if started, do: conn, else: Plug.Conn.send_resp(conn, 504, "WEBVTT\n\n")
    end
  end

  # JavaScript source: localPlaybackPlan(id, req, entry, filePath, duration = 0, audioSelection = null)
  def local_playback_plan(id, req, entry, file_path, duration \\ 0, audio_selection \\ nil) do
    requested =
      if q(req, "forceHls") == "1",
        do: "hls",
        else: Core.normalize_playback_mode(q(req, "mode"), "direct")

    start_sec = Core.playback_start_from_req(req)
    query = Core.playback_query_from_req(req)

    {mode, src} =
      cond do
        requested == "hls" ->
          {requested, Core.local_playback_hls_url(id, req)}

        requested in ["remux", "audio"] ->
          {requested,
           "/api/playback/local/#{JS.encode_component(id)}/stream#{Core.playback_query_from_req(req, %{"mode" => requested})}"}

        true ->
          {"direct", "/stream/#{JS.encode_component(id)}#{query}"}
      end

    result = %{
      "ok" => true,
      "id" => id,
      "filename" => g(entry, "file"),
      "directPlayable" => Core.is_remote_direct_playable(file_path),
      "unsupportedVideoHint" => Core.playback_url_has_unsupported_video_hint(g(entry, "file")),
      "mode" => mode,
      "transport" => mode,
      "src" => src,
      "playUrl" => src,
      "finalPlayUrl" => src,
      "remuxUrl" =>
        "/api/playback/local/#{JS.encode_component(id)}/stream#{Core.playback_query_from_req(req, %{"mode" => "remux"})}",
      "audioTranscodeUrl" =>
        "/api/playback/local/#{JS.encode_component(id)}/stream#{Core.playback_query_from_req(req, %{"mode" => "audio"})}",
      "hlsUrl" => Core.local_playback_hls_url(id, req),
      "duration" => number_or_zero(duration),
      "start" => start_sec
    }

    audio_index =
      first_integer([g(audio_selection, "audioIndex"), g(audio_selection, "audioIdx")])

    result =
      if is_integer(audio_index) do
        Map.merge(result, %{
          "audioIndex" => audio_index,
          "defaultAudioIndex" =>
            first_integer([g(audio_selection, "defaultAudioIndex"), audio_index])
        })
      else
        result
      end

    if truthy?(g(audio_selection, "audioSafeMode")) do
      Map.merge(result, %{
        "defaultAudioIndex" => g(audio_selection, "defaultAudioIndex"),
        "audioSafeMode" => true,
        "audioStreamsDetected" => g(audio_selection, "audioStreamsDetected"),
        "ffmpegMapping" => g(audio_selection, "ffmpegMapping") || g(audio_selection, "audioMap")
      })
    else
      result
    end
  end

  # JavaScript source: mobileCompatibilityProfile(mediaInfo = {}, audioSelection = {}, source = '')
  def mobile_compatibility_profile(media_info \\ %{}, audio_selection \\ %{}, source \\ "") do
    video_codec = g(media_info, "videoCodec", "") |> to_string() |> String.downcase()
    audio_tracks = list(g(media_info, "audioTracks"))
    absolute = finite_number(g(audio_selection, "audioStreamIdx"))
    audio_index = finite_number(g(audio_selection, "audioIdx")) || 0

    selected =
      if is_number(absolute) do
        Enum.find(audio_tracks, &(Core.server_audio_track_absolute_index(&1) == absolute))
      else
        if is_integer(audio_index) and audio_index >= 0,
          do: Enum.at(audio_tracks, audio_index),
          else: nil
      end

    audio_codec =
      (g(selected, "codec") || g(audio_selection, "audioCodec") || "")
      |> to_string()
      |> String.downcase()

    has_audio = audio_tracks != []
    video_can_copy = Regex.match?(~r/^(h264|avc|avc1)$/, video_codec)

    audio_can_copy =
      not has_audio or Regex.match?(~r/^(aac|mp4a)$/, audio_codec) or
        String.contains?(audio_codec, "aac") or String.contains?(audio_codec, "mp4a")

    clean_source =
      source |> to_string() |> String.split(~r/[?#]/, parts: 2) |> hd() |> String.downcase()

    container = g(media_info, "container", "") |> to_string() |> String.downcase()

    direct_container =
      Regex.match?(~r/\.(?:mp4|m4v)$/, clean_source) or
        Regex.match?(~r/(?:^|,)(?:mov|mp4|m4a|3gp|3g2|mj2)(?:,|$)/, container)

    selected_audio_number =
      if truthy?(g(audio_selection, "audioIdx")),
        do: JS.number(g(audio_selection, "audioIdx")),
        else: 0

    first_audio = not has_audio or selected_audio_number == 0

    %{
      "direct" => direct_container and video_can_copy and audio_can_copy and first_audio,
      "remux" => video_can_copy and is_number(absolute),
      "videoCanCopy" => video_can_copy,
      "audioCanCopy" => audio_can_copy,
      "videoCodec" => video_codec,
      "audioCodec" => audio_codec
    }
  end

  # JavaScript source: mobilePlanRequest(req, overrides = {})
  def mobile_plan_request(req, overrides \\ %{}) do
    query = req.query_params |> Map.merge(string_key_map(overrides)) |> Map.delete("forceHls")
    %{req | query_params: query}
  end

  # JavaScript source: isolatedMobileHlsMasterPlaylist()
  def isolated_mobile_hls_master_playlist do
    padding = String.pad_trailing("# StreamVault mobile readiness padding ", 1200, "-")

    "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-INDEPENDENT-SEGMENTS\n#EXT-X-STREAM-INF:BANDWIDTH=2400000\nstream.m3u8\n#{padding}\n"
  end

  # JavaScript source: stopIsolatedMobileHlsSession(session, reason = 'stopped', removeFiles = true)
  def stop_isolated_mobile_hls_session(session, reason \\ "stopped", remove_files \\ true)
  def stop_isolated_mobile_hls_session(nil, _reason, _remove_files), do: nil

  def stop_isolated_mobile_hls_session(%{id: id}, reason, remove_files),
    do: GenServer.call(__MODULE__, {:stop_session, id, reason, remove_files})

  # JavaScript source: cleanupIsolatedMobileHlsSessions()
  def cleanup_isolated_mobile_hls_sessions do
    GenServer.call(__MODULE__, :cleanup_sessions, :infinity)
  end

  # JavaScript source: ensureIsolatedMobileHlsCleanupTimer()
  def ensure_isolated_mobile_hls_cleanup_timer do
    GenServer.call(__MODULE__, :ensure_cleanup_timer, :infinity)
  end

  # JavaScript source: waitForHLSReady(masterPath, streamPath, session, timeoutMs = MOBILE_COMPAT_HLS_READY_MS)
  def wait_for_hls_ready(master_path, stream_path, initial_session, timeout_ms \\ nil) do
    timeout_ms = timeout_ms || Core.config(:mobile_compat_hls_ready_ms)
    wait_hls_loop(master_path, stream_path, initial_session.id, JS.monotonic_ms(), timeout_ms)
  end

  defp wait_hls_loop(master_path, stream_path, id, started, timeout_ms) do
    Process.sleep(250)
    current = session(id) || raise "isolated HLS session stopped"
    if current.error != "", do: raise(current.error)

    segments =
      case File.ls(current.dir) do
        {:ok, files} -> Enum.filter(files, &Regex.match?(~r/^seg_\d+\.ts$/, &1))
        _ -> []
      end

    first_segment =
      Enum.find(segments, fn file ->
        case File.stat(Path.join(current.dir, file)) do
          {:ok, stat} -> stat.size > 0
          _ -> false
        end
      end)

    stream_ready =
      regular_positive?(stream_path) and String.contains?(File.read!(stream_path), ".ts")

    if stream_ready and first_segment and not File.exists?(master_path) do
      :ok = Files.atomic_write(master_path, isolated_mobile_hls_master_playlist())
    end

    cond do
      regular_size(master_path) > 1024 and first_segment ->
        GenServer.cast(__MODULE__, {:session_ready, id})
        true

      JS.monotonic_ms() - started >= timeout_ms ->
        raise "isolated HLS readiness timeout"

      true ->
        wait_hls_loop(master_path, stream_path, id, started, timeout_ms)
    end
  end

  # JavaScript source: isolatedMobileHlsArgs({ input, startSec, audioMap, remux, remote, streamPath, segmentPattern })
  def isolated_mobile_hls_args(options) do
    input = opt(options, :input)
    start_sec = number_or_zero(opt(options, :startSec, 0))
    args = ["-hide_banner", "-loglevel", "warning", "-nostdin"]
    args = if start_sec > 0, do: args ++ ["-ss", to_string(floor(start_sec))], else: args

    args =
      if truthy?(opt(options, :remote, false)),
        do:
          args ++
            ["-rw_timeout", "15000000", "-probesize", "2097152", "-analyzeduration", "2000000"],
        else: args

    args =
      args ++
        [
          "-fflags",
          "+genpts",
          "-i",
          to_string(input),
          "-map",
          "0:v:0",
          "-map",
          opt(options, :audioMap) || "0:a:0?",
          "-sn",
          "-dn"
        ]

    args =
      if truthy?(opt(options, :remux, false)) do
        args ++ ["-c:v", "copy", "-c:a", "copy"]
      else
        args ++
          [
            "-vf",
            "scale=w=min(1280\\,iw):h=-2,fps=30,#{Core.config(:compat_video_pts_filter)}",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-tune",
            "zerolatency",
            "-threads",
            to_string(Core.config(:mobile_hls_ffmpeg_threads)),
            "-filter_threads",
            "1",
            "-profile:v",
            "baseline",
            "-level",
            "3.1",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "28",
            "-maxrate",
            "2200k",
            "-bufsize",
            "4400k",
            "-g",
            "60",
            "-keyint_min",
            "60",
            "-sc_threshold",
            "0",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-ar",
            "48000",
            "-ac",
            "2",
            "-af",
            Core.config(:compat_audio_pts_filter)
          ]
      end

    args ++
      [
        "-max_muxing_queue_size",
        "2048",
        "-f",
        "hls",
        "-hls_segment_type",
        "mpegts",
        "-hls_time",
        "2",
        "-hls_list_size",
        "6",
        "-hls_flags",
        "delete_segments+independent_segments+temp_file",
        "-hls_allow_cache",
        "0",
        "-hls_segment_filename",
        opt(options, :segmentPattern),
        opt(options, :streamPath)
      ]
  end

  # JavaScript source: startIsolatedMobileHls({ scope, mediaId, input, startSec = 0, audioMap, profile, remote = false })
  def start_isolated_mobile_hls(options) do
    cleanup_isolated_mobile_hls_sessions()
    ensure_isolated_mobile_hls_cleanup_timer()
    id = random_hex(16)

    media_key =
      :crypto.hash(:sha, to_string(opt(options, :mediaId)))
      |> Base.encode16(case: :lower)
      |> binary_part(0, 16)

    dir = Path.join([Paths.isolated_hls(), media_key, id])
    master_path = Path.join(dir, "index.m3u8")
    stream_path = Path.join(dir, "stream.m3u8")
    profile = opt(options, :profile, %{})
    remux = truthy?(g(profile, "videoCanCopy")) and truthy?(g(profile, "audioCanCopy"))
    now = JS.date_now()

    session = %{
      id: id,
      scope: opt(options, :scope),
      media_key: media_key,
      dir: dir,
      master_path: master_path,
      stream_path: stream_path,
      process: nil,
      ready: false,
      error: "",
      created_at: now,
      last_access: now,
      process_token: ""
    }

    put_session(session)
    cleanup_isolated_mobile_hls_sessions()
    start_hls_attempt(options, session, remux, 0)
  end

  defp start_hls_attempt(options, original, remux, attempt) when attempt < 2 do
    session = session(original.id) || original
    _ = Files.rm_rf_inside(Paths.isolated_hls(), session.dir)
    :ok = File.mkdir_p(session.dir)
    token = "#{attempt}:#{JS.date_now()}"
    session = %{session | error: "", ready: false, process_token: token}
    put_session(session)

    args =
      isolated_mobile_hls_args(%{
        input: opt(options, :input),
        startSec: opt(options, :startSec, 0),
        audioMap: opt(options, :audioMap),
        remux: remux,
        remote: opt(options, :remote, false),
        streamPath: session.stream_path,
        segmentPattern: Path.join(session.dir, "seg_%06d.ts")
      })

    IO.puts(
      "[Mobile Isolated HLS] start session=#{session.id} attempt=#{attempt + 1} strategy=#{if(remux, do: "remux", else: "transcode")} input=#{opt(options, :input)}"
    )

    pid = spawn(fn -> hls_worker(session.id, token, args) end)
    GenServer.cast(__MODULE__, {:session_process, session.id, token, pid})

    try do
      wait_for_hls_ready(session.master_path, session.stream_path, session)

      %{
        session: session(session.id),
        remux: remux,
        url: "/api/mobile-compat-hls/#{session.id}/index.m3u8"
      }
    rescue
      error ->
        IO.warn(
          "[Mobile Isolated HLS] attempt #{attempt + 1} failed session=#{session.id}: #{Exception.message(error)}"
        )

        put_session(%{
          session
          | process: nil,
            process_token: "failed:#{attempt}:#{JS.date_now()}"
        })

        send(pid, :stop)
        _ = Files.rm_rf_inside(Paths.isolated_hls(), session.dir)

        if attempt == 1 do
          stop_isolated_mobile_hls_session(session, "startup failed")
          reraise error, __STACKTRACE__
        else
          start_hls_attempt(options, session, remux, attempt + 1)
        end
    end
  end

  defp hls_worker(id, token, args) do
    try do
      port = open_merged(Command.executable(:ffmpeg), args)
      hls_worker_loop(port, id, token, "")
    rescue
      error -> GenServer.cast(__MODULE__, {:session_error, id, token, Exception.message(error)})
    end
  end

  defp hls_worker_loop(port, id, token, stderr) do
    receive do
      {^port, {:data, data}} ->
        hls_worker_loop(port, id, token, tail(stderr <> data, 4000))

      {^port, {:exit_status, status}} ->
        GenServer.cast(__MODULE__, {:session_closed, id, token, status, stderr})

      :stop ->
        Command.terminate(port)
    end
  end

  # JavaScript source: server.js lines 9105-9124, GET /api/mobile-compat-hls/:sessionId/:file
  def route_mobile_compat_hls(conn, session_id, file) do
    valid_file =
      Regex.match?(~r/^(?:index|stream)\.m3u8$/, file) or Regex.match?(~r/^seg_\d+\.ts$/, file)

    cond do
      not Core.is_mobile(conn) ->
        Response.empty(conn, 404)

      not Regex.match?(~r/^[a-f0-9]{32}$/, session_id) ->
        Response.empty(conn, 404)

      not valid_file ->
        Response.empty(conn, 404)

      true ->
        case touch_session(session_id) do
          nil ->
            Response.empty(conn, 404)

          current ->
            file_path = Path.join(current.dir, file)

            if not Files.contained?(current.dir, file_path) or not File.exists?(file_path) do
              Response.empty(conn, 404)
            else
              content_type =
                if String.ends_with?(file, ".m3u8"),
                  do: "application/vnd.apple.mpegurl",
                  else: "video/mp2t"

              conn =
                put_headers(conn, [
                  {"content-type", content_type},
                  {"cache-control", "no-store"},
                  {"access-control-allow-origin", "*"}
                ])

              if conn.method == "HEAD",
                do: Plug.Conn.send_resp(conn, 200, ""),
                else: Plug.Conn.send_file(conn, 200, file_path)
            end
        end
    end
  end

  # JavaScript source: mobileConvertedKey(scope, input, audioMap = '')
  def mobile_converted_key(scope, input, audio_map \\ "") do
    :crypto.hash(
      :sha,
      "#{scope}|#{Core.media_stable_cache_key(input)}|#{audio_map}|h264-aac-mp4-v1"
    )
    |> Base.encode16(case: :lower)
  end

  # JavaScript source: completedMobileMp4(filePath)
  def completed_mobile_mp4(file_path),
    do: regular_size(file_path) > Core.config(:mobile_converted_min_bytes)

  # JavaScript source: convertMobileToMp4({ scope, input, audioMap = '0:a:0?', remote = false })
  def convert_mobile_to_mp4(options) do
    scope = opt(options, :scope)
    input = opt(options, :input)
    audio_map = opt(options, :audioMap, "0:a:0?") || "0:a:0?"
    key = mobile_converted_key(scope, input, audio_map)
    final_path = Path.join(Paths.mobile_converted(), "#{key}.mp4")

    case GenServer.call(__MODULE__, {:convert_mobile, options, key, final_path}, :infinity) do
      {:ok, result} -> result
      {:error, message} -> raise message
    end
  end

  defp perform_mobile_conversion(options, key, final_path) do
    input = opt(options, :input)
    audio_map = opt(options, :audioMap, "0:a:0?") || "0:a:0?"
    :ok = File.mkdir_p(Paths.mobile_converted())
    partial = Path.join(Paths.mobile_converted(), "#{key}.#{random_hex(8)}.part.mp4")
    base = ["-hide_banner", "-loglevel", "warning", "-nostdin"]

    base =
      if truthy?(opt(options, :remote, false)),
        do:
          base ++
            ["-rw_timeout", "15000000", "-probesize", "2097152", "-analyzeduration", "2000000"],
        else: base

    arguments =
      base ++
        [
          "-fflags",
          "+genpts",
          "-i",
          input,
          "-map",
          "0:v:0",
          "-map",
          audio_map,
          "-sn",
          "-dn",
          "-vf",
          "scale=w=min(1280\\,iw):h=-2",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-profile:v",
          "baseline",
          "-level",
          "3.1",
          "-pix_fmt",
          "yuv420p",
          "-crf",
          "27",
          "-maxrate",
          "2500k",
          "-bufsize",
          "5000k",
          "-threads",
          to_string(Core.config(:mobile_hls_ffmpeg_threads)),
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-ar",
          "48000",
          "-ac",
          "2",
          "-af",
          Core.config(:compat_audio_pts_filter),
          "-avoid_negative_ts",
          "make_zero",
          "-movflags",
          "+faststart",
          "-f",
          "mp4",
          partial
        ]

    try do
      port = open_merged(Command.executable(:ffmpeg), arguments)
      {status, stderr} = collect_process_exit(port, "")
      if status != 0, do: raise("FFmpeg exited #{status}: #{tail(stderr, 1000)}")

      if not completed_mobile_mp4(partial),
        do: raise("converted MP4 did not pass the 500KB completion gate")

      :ok = File.open(partial, [:read, :write], fn _io -> :ok end)
      _ = File.rm(final_path)
      :ok = File.rename(partial, final_path)

      if not completed_mobile_mp4(final_path),
        do: raise("converted MP4 was not complete after finalization")

      mobile_conversion_result(key, final_path)
    rescue
      error ->
        _ = File.rm(partial)
        reraise error, __STACKTRACE__
    end
  end

  defp collect_process_exit(port, output) do
    receive do
      {^port, {:data, data}} -> collect_process_exit(port, tail(output <> data, 4000))
      {^port, {:exit_status, status}} -> {status, output}
    end
  end

  defp mobile_conversion_result(key, final_path),
    do: %{key: key, filePath: final_path, url: "/media/converted/#{key}.mp4"}

  # JavaScript source: server.js lines 9203-9239, GET /media/converted/:file
  def route_converted_media(conn, file) do
    file_path = Path.join(Paths.mobile_converted(), file)

    cond do
      not Core.is_mobile(conn) -> Response.empty(conn, 404)
      not Regex.match?(~r/^[a-f0-9]{40}\.mp4$/, file) -> Response.empty(conn, 404)
      not completed_mobile_mp4(file_path) -> Response.empty(conn, 404)
      true -> direct_file_response(conn, file_path, "video/mp4", "no-store", nil)
    end
  end

  # JavaScript source: serveMobileLocalPipeline(req, res, idx, entry, filePath)
  def serve_mobile_local_pipeline(conn, idx, entry, file_path) do
    try do
      media_info = Core.get_cached_media_info(file_path)
      audio = Core.resolve_playback_audio_selection(conn, file_path, g(entry, "file"))
      profile = mobile_compatibility_profile(media_info, audio, g(entry, "file"))

      cond do
        profile["direct"] ->
          request =
            mobile_plan_request(conn, %{
              "mode" => "direct",
              "mobile" => "1",
              "audio" => g(audio, "audioIdx"),
              "audioStream" => g(audio, "audioStreamIdx")
            })

          plan =
            local_playback_plan(
              to_string(idx),
              request,
              entry,
              file_path,
              g(media_info, "duration"),
              audio
            )

          Response.json(conn, %{"url" => plan["src"]})

        true ->
          try do
            converted =
              convert_mobile_to_mp4(%{
                scope: "local",
                input: file_path,
                audioMap: g(audio, "audioMap"),
                remote: false
              })

            Response.json(conn, %{"url" => converted.url})
          rescue
            mp4_error ->
              IO.warn(
                "[Mobile Compatibility] MP4 conversion failed for #{g(entry, "file")}; starting HLS fallback: #{Exception.message(mp4_error)}"
              )

              prepared =
                start_isolated_mobile_hls(%{
                  scope: "local",
                  mediaId: idx,
                  input: file_path,
                  startSec: Core.playback_start_from_req(conn),
                  audioMap: g(audio, "audioMap"),
                  profile: profile,
                  remote: false
                })

              Response.json(conn, %{"url" => prepared.url})
          end
      end
    rescue
      error ->
        IO.warn(
          "[Mobile Compatibility] local plan failed for #{g(entry, "file")}: #{Exception.message(error)}"
        )

        Core.json_error(
          conn,
          502,
          "MOBILE_PLAYBACK_PLAN_FAILED",
          "Could not prepare mobile-compatible playback",
          %{"details" => Exception.message(error)}
        )
    end
  end

  # JavaScript source: server.js lines 9276-9294, GET /api/playback/local/:id
  def route_playback_local(conn, id) do
    idx = int_or(id, -1)
    entry = if idx >= 0, do: Enum.at(Core.file_index(), idx), else: nil
    file_path = if entry, do: Core.entry_path(entry), else: nil

    cond do
      is_nil(entry) ->
        Core.json_error(conn, 404, "LOCAL_MEDIA_NOT_FOUND", "Local media was not found")

      not File.exists?(file_path) ->
        Core.json_error(conn, 404, "LOCAL_MEDIA_MISSING", "Local media file is missing")

      not Core.is_mobile_playback_request(conn) ->
        request = mobile_plan_request(conn, %{"mode" => "direct"})
        Response.json(conn, local_playback_plan(to_string(idx), request, entry, file_path))

      true ->
        serve_mobile_local_pipeline(conn, idx, entry, file_path)
    end
  end

  # JavaScript source: server.js lines 9296-9340, GET /api/playback/local/:id/stream
  def route_playback_local_stream(conn, id) do
    idx = int_or(id, -1)
    entry = if idx >= 0, do: Enum.at(Core.file_index(), idx), else: nil
    file_path = if entry, do: Core.entry_path(entry), else: nil

    cond do
      is_nil(entry) ->
        Core.json_error(conn, 404, "LOCAL_MEDIA_NOT_FOUND", "Local media was not found")

      not Core.is_mobile_playback_request(conn) ->
        direct_stream(conn, file_path, entry)

      not File.exists?(file_path) ->
        Core.json_error(conn, 404, "LOCAL_MEDIA_MISSING", "Local media file is missing")

      true ->
        mode = Core.normalize_playback_mode(q(conn, "mode"), "remux")

        if mode not in ["remux", "audio"] do
          Core.json_error(
            conn,
            400,
            "INVALID_PLAYBACK_MODE",
            "Local stream mode must be remux or audio"
          )
        else
          try do
            audio = Core.resolve_playback_audio_selection(conn, file_path, g(entry, "file"))

            case Core.require_absolute_playback_audio(conn, conn, audio, mode, g(entry, "file")) do
              {:error, response} ->
                response

              true ->
                fallback =
                  if mode == "audio" and not is_nil(g(audio, "audioStreamIdx")),
                    do: fn _ -> direct_stream(conn, file_path, entry) end,
                    else: nil

                StreamVault.Live.stream_ffmpeg_mp4(conn, conn, %{
                  input: file_path,
                  mode: mode,
                  startSec: Core.playback_start_from_req(conn),
                  audioMap: g(audio, "audioMap"),
                  audioStreamIdx: g(audio, "audioStreamIdx"),
                  videoStreamIdx: g(audio, "videoStreamIdx"),
                  audioVideoOffsetSec: g(audio, "audioVideoOffsetSec"),
                  audioCodec: g(audio, "audioCodec", ""),
                  videoCodec: g(audio, "videoCodec", ""),
                  audioStartTime: g(audio, "audioStartTime"),
                  videoStartTime: g(audio, "videoStartTime"),
                  remote: false,
                  label: g(entry, "file"),
                  hevcTag: Core.playback_url_has_hevc_hint(g(entry, "file")),
                  fallbackOriginal: fallback
                })
            end
          rescue
            error ->
              Core.json_error(
                conn,
                502,
                "AUDIO_RESOLVE_FAILED",
                "Could not resolve a playable audio stream",
                %{"label" => g(entry, "file"), "details" => Exception.message(error)}
              )
          end
        end
    end
  end

  # JavaScript source: server.js lines 9342-9380, GET /stream/:id
  def route_stream(conn, id) do
    idx = int_or(id, -1)
    entry = if idx >= 0, do: Enum.at(Core.file_index(), idx), else: nil
    file_path = if entry, do: Core.entry_path(entry), else: nil

    cond do
      is_nil(entry) ->
        Response.text(conn, "Not found", 404)

      not Core.is_mobile_playback_request(conn) ->
        direct_stream(conn, file_path, entry)

      not File.exists?(file_path) ->
        Response.text(conn, "File missing", 404)

      true ->
        audio_idx = int_or(q(conn, "audio", "0"), 0)
        explicit_audio = parse_int_or_nil(q(conn, "audioStream", ""))
        subtitle_idx = int_or(q(conn, "subtitle", "-1"), -1)
        smooth = q(conn, "smooth") == "1" or q(conn, "profile") == "smooth"

        force =
          smooth or audio_idx > 0 or (is_number(explicit_audio) and explicit_audio >= 0) or
            subtitle_idx >= 0

        try do
          info = Core.get_cached_media_info(file_path)

          if force or Core.needs_transcode(info, header(conn, "user-agent")),
            do: transcode_stream(conn, file_path, info, entry),
            else: direct_stream(conn, file_path, entry)
        rescue
          error ->
            IO.warn("[Stream] Error for #{g(entry, "file")}: #{Exception.message(error)}")

            transcode_stream(
              conn,
              file_path,
              %{"audioTracks" => [], "subtitleTracks" => [], "videoCodec" => "unknown"},
              entry
            )
        end
    end
  end

  # JavaScript source: server.js lines 9382-9411, GET /api/stream-seek/:id
  def route_stream_seek(conn, id) do
    idx = int_or(id, -1)
    entry = if idx >= 0, do: Enum.at(Core.file_index(), idx), else: nil
    file_path = if entry, do: Core.entry_path(entry), else: nil

    cond do
      is_nil(entry) ->
        Response.text(conn, "Not found", 404)

      not File.exists?(file_path) ->
        Response.text(conn, "File missing", 404)

      true ->
        try do
          _ = Core.get_cached_media_info(file_path)
          start_sec = float_or(q(conn, "start"), 0)
          selection = Core.playback_audio_selection_from_req(conn)
          args = if start_sec > 0, do: ["-ss", js_number_string(start_sec)], else: []

          args =
            args ++
              [
                "-i",
                file_path,
                "-map",
                "0:v:0",
                "-map",
                g(selection, "audioMap"),
                "-c:v",
                "copy",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-ar",
                "48000",
                "-ac",
                "2",
                "-copyts",
                "-start_at_zero",
                "-avoid_negative_ts",
                "disabled",
                "-movflags",
                "frag_keyframe+empty_moov+default_base_moof",
                "-f",
                "mp4",
                "pipe:1"
              ]

          conn |> media_stream_headers(nil) |> stream_ffmpeg(args, 15_000, "FFmpeg error")
        rescue
          error -> Response.text(conn, "Error: #{Exception.message(error)}", 500)
        end
    end
  end

  # JavaScript source: parseSingleByteRange(header, fileSize)
  def parse_single_byte_range(header, file_size) do
    value = to_string(header || "") |> String.trim()

    case Regex.run(~r/^bytes=(\d*)-(\d*)$/i, value) do
      [_, "", ""] ->
        nil

      [_, "", suffix] ->
        with {:ok, suffix_length} <- safe_decimal(suffix),
             true <- suffix_length > 0 do
          start = max(0, file_size - suffix_length)
          finish = file_size - 1

          if start < 0 or start >= file_size or finish < start,
            do: nil,
            else: %{start: start, end: finish}
        else
          _ -> nil
        end

      [_, first, last] ->
        with {:ok, start} <- safe_decimal(first),
             {:ok, finish} <- if(last == "", do: {:ok, file_size - 1}, else: safe_decimal(last)) do
          finish = min(finish, file_size - 1)

          if start < 0 or start >= file_size or finish < start,
            do: nil,
            else: %{start: start, end: finish}
        else
          _ -> nil
        end

      _ ->
        nil
    end
  end

  defp safe_decimal(value) do
    case Integer.parse(value) do
      {number, ""} when number <= 9_007_199_254_740_991 -> {:ok, number}
      _ -> :error
    end
  end

  # JavaScript source: directStream(req, res, filePath, entry)
  def direct_stream(conn, file_path, _entry) do
    case File.stat(file_path) do
      {:ok, stat} ->
        mobile = Core.is_mobile_playback_request(conn)
        quality = q(conn, "quality", "auto")
        bytes_per_sec = if mobile, do: Map.get(Core.quality_tiers(), quality), else: nil
        ext = Path.extname(file_path) |> String.downcase()
        type = Map.get(Core.mime_types(), ext, "video/mp4")

        cache =
          if mobile,
            do: "no-cache, no-store, must-revalidate",
            else: "private, max-age=0, must-revalidate"

        direct_file_response(conn, file_path, type, cache, bytes_per_sec, stat.size)

      {:error, error} ->
        IO.warn("[Direct Stream] Cannot stat file: #{file_path} #{inspect(error)}")
        Response.text(conn, "File not found", 404)
    end
  end

  defp direct_file_response(conn, file_path, type, cache, bytes_per_sec, known_size \\ nil) do
    size = known_size || regular_size(file_path)

    conn =
      put_headers(conn, [
        {"access-control-allow-origin", "*"},
        {"accept-ranges", "bytes"},
        {"cache-control", cache},
        {"content-type", type}
      ])

    case {header(conn, "range"), size} do
      {range, size} when range not in [nil, ""] ->
        case parse_single_byte_range(range, size) do
          nil ->
            conn
            |> put_headers([{"content-range", "bytes */#{size}"}, {"content-length", "0"}])
            |> Plug.Conn.send_resp(416, "")

          %{start: start, end: finish} ->
            length = finish - start + 1

            conn =
              put_headers(conn, [
                {"content-range", "bytes #{start}-#{finish}/#{size}"},
                {"content-length", length}
              ])

            send_file_or_head(conn, 206, file_path, start, length, bytes_per_sec)
        end

      _ ->
        conn = Plug.Conn.put_resp_header(conn, "content-length", to_string(size))
        send_file_or_head(conn, 200, file_path, 0, size, bytes_per_sec)
    end
  end

  defp send_file_or_head(conn, status, _file, _offset, _length, _rate) when conn.method == "HEAD",
    do: Plug.Conn.send_resp(conn, status, "")

  defp send_file_or_head(conn, status, file, offset, length, nil),
    do: Plug.Conn.send_file(conn, status, file, offset, length)

  defp send_file_or_head(conn, status, file, offset, length, rate) do
    conn = Plug.Conn.send_chunked(conn, status)
    throttle_stream(file, conn, rate, offset, length)
  end

  # JavaScript source: throttleStream(readStream, res, bytesPerSec)
  def throttle_stream(file, conn, bytes_per_sec, offset \\ 0, length \\ :all) do
    interval = 100
    _chunk_size = max(8192, floor(bytes_per_sec / (1000 / interval)))
    remaining = if length == :all, do: regular_size(file) - offset, else: length

    case :file.open(String.to_charlist(file), [:read, :binary, :raw]) do
      {:ok, io} ->
        _ = :file.position(io, offset)

        try do
          throttle_loop(io, conn, remaining, 64 * 1024, interval)
        after
          :file.close(io)
        end

      _ ->
        conn
    end
  end

  defp throttle_loop(_io, conn, remaining, _chunk, _interval) when remaining <= 0, do: conn

  defp throttle_loop(io, conn, remaining, chunk, interval) do
    Process.sleep(interval)

    case :file.read(io, min(remaining, chunk)) do
      {:ok, data} ->
        case Plug.Conn.chunk(conn, data) do
          {:ok, next} -> throttle_loop(io, next, remaining - byte_size(data), chunk, interval)
          _ -> conn
        end

      _ ->
        conn
    end
  end

  # JavaScript source: remuxStream(req, res, filePath, entry)
  def remux_stream(conn, file_path, _entry) do
    start_sec = float_or(q(conn, "start"), 0)
    args = if start_sec > 0, do: ["-ss", js_number_string(start_sec)], else: []

    args =
      args ++
        [
          "-i",
          file_path,
          "-map",
          "0:v:0",
          "-map",
          "0:a:0?",
          "-c",
          "copy",
          "-copyts",
          "-start_at_zero",
          "-avoid_negative_ts",
          "disabled",
          "-movflags",
          "frag_keyframe+empty_moov+default_base_moof",
          "-f",
          "mp4",
          "pipe:1"
        ]

    conn |> media_stream_headers("no-cache") |> stream_ffmpeg(args, 15_000, "")
  end

  # JavaScript source: transcodeStream(req, res, filePath, mediaInfo, entry)
  def transcode_stream(conn, file_path, media_info, entry) do
    audio =
      Core.resolve_playback_audio_selection_from_media_info(
        conn,
        media_info,
        g(entry, "file") || "local stream"
      )

    audio_idx = int_or(g(audio, "audioIdx"), 0)
    subtitle_idx = parse_int_or_nil(q(conn, "subtitle"))
    has_subtitle = is_number(subtitle_idx) and subtitle_idx >= 0
    start_sec = float_or(q(conn, "start"), 0)
    mobile = Core.is_mobile_playback_request(conn)
    smooth = q(conn, "smooth") == "1" or q(conn, "profile") == "smooth"
    tracks = list(g(media_info, "audioTracks"))
    selected_idx = if audio_idx < length(tracks), do: audio_idx, else: 0

    selected =
      if(selected_idx >= 0, do: Enum.at(tracks, selected_idx), else: nil) || Enum.at(tracks, 0)

    selected_stream_index = g(selected, "index")

    selected_map =
      cond do
        not is_nil(g(audio, "audioStreamIdx")) -> g(audio, "audioMap")
        is_number(selected_stream_index) -> "0:#{trunc(selected_stream_index)}?"
        true -> "0:a:#{selected_idx}?"
      end

    args = if start_sec > 0, do: ["-ss", js_number_string(start_sec)], else: []

    args =
      args ++
        [
          "-fflags",
          "+genpts",
          "-i",
          file_path,
          "-map",
          "0:v:0",
          "-map",
          if(tracks == [], do: "0:a:0?", else: selected_map)
        ]

    external =
      if has_subtitle,
        do: Core.find_subtitle_tracks(Path.dirname(file_path), g(entry, "file")),
        else: []

    {args, subtitle_filter} =
      cond do
        not has_subtitle ->
          {args, ""}

        track = Enum.at(external, trunc(subtitle_idx)) ->
          {args, "subtitles='#{Core.ffmpeg_filter_escape(g(track, "filePath"))}'"}

        embedded =
            Enum.at(list(g(media_info, "subtitleTracks")), trunc(subtitle_idx) - length(external)) ->
          embedded_index = g(embedded, "index")

          map =
            if is_number(embedded_index),
              do: "0:#{trunc(embedded_index)}",
              else: "0:s:#{trunc(subtitle_idx) - length(external)}"

          {args ++ ["-map", map, "-c:s", "mov_text"], ""}

        true ->
          {args, ""}
      end

    filters = []
    filters = if subtitle_filter != "", do: filters ++ [subtitle_filter], else: filters

    filters =
      cond do
        smooth -> filters ++ ["scale=w=min(#{Core.config(:smooth_max_width)}\\,iw):h=-2"]
        mobile -> filters ++ ["scale=w=min(1280\\,iw):h=-2"]
        true -> filters
      end

    filters = filters ++ [Core.config(:compat_video_pts_filter)]

    args =
      if smooth do
        args ++
          [
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-tune",
            "zerolatency",
            "-b:v",
            Core.config(:smooth_video_bitrate),
            "-maxrate",
            Core.config(:smooth_video_bitrate),
            "-bufsize",
            Core.config(:smooth_video_bufsize),
            "-pix_fmt",
            "yuv420p"
          ]
      else
        args ++
          [
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-tune",
            "zerolatency",
            "-crf",
            if(mobile, do: "29", else: "23"),
            "-maxrate",
            if(mobile, do: "2200k", else: "6M"),
            "-bufsize",
            if(mobile, do: "4400k", else: "12M"),
            "-pix_fmt",
            "yuv420p"
          ] ++ if(mobile, do: ["-profile:v", "baseline", "-level", "3.1"], else: [])
      end

    args = if filters != [], do: args ++ ["-vf", Enum.join(filters, ",")], else: args

    args =
      args ++
        [
          "-c:a",
          "aac",
          "-b:a",
          if(smooth, do: Core.config(:smooth_audio_bitrate), else: "128k"),
          "-ar",
          "48000",
          "-ac",
          "2",
          "-af",
          Core.config(:compat_audio_pts_filter),
          "-avoid_negative_ts",
          "make_zero",
          "-max_interleave_delta",
          "0",
          "-muxdelay",
          "0",
          "-muxpreload",
          "0",
          "-flush_packets",
          "1",
          "-movflags",
          "frag_keyframe+empty_moov+default_base_moof",
          "-f",
          "mp4",
          "pipe:1"
        ]

    conn |> media_stream_headers("no-cache") |> stream_ffmpeg(args, 15_000, "Transcode failed")
  end

  # JavaScript source: server.js lines 9720-9767, GET /subtitles/:id/embedded/:streamIdx.vtt
  def route_embedded_subtitle(conn, id, stream_index) do
    idx = int_or(id, -1)
    stream_idx = parse_int_or_nil(stream_index)
    entry = if idx >= 0, do: Enum.at(Core.file_index(), idx), else: nil
    file_path = if entry, do: Core.entry_path(entry), else: nil

    cond do
      is_nil(entry) ->
        Response.text(conn, "No entry", 404)

      not is_number(stream_idx) or stream_idx < 0 ->
        Response.text(conn, "Invalid subtitle stream", 400)

      not File.exists?(file_path) ->
        Response.text(conn, "File missing", 404)

      true ->
        args = [
          "-hide_banner",
          "-loglevel",
          "error",
          "-nostdin",
          "-i",
          file_path,
          "-map",
          "0:#{trunc(stream_idx)}?",
          "-vn",
          "-an",
          "-c:s",
          "webvtt",
          "-f",
          "webvtt",
          "pipe:1"
        ]

        conn |> subtitle_headers() |> stream_subtitle(args)
    end
  end

  # JavaScript source: server.js lines 9769-9788, GET /subtitles/:id/:trackIdx?
  def route_sidecar_subtitle(conn, id, track_index) do
    idx = int_or(id, -1)
    entry = if idx >= 0, do: Enum.at(Core.file_index(), idx), else: nil

    if is_nil(entry) do
      Response.text(conn, "No entry", 404)
    else
      tracks = Core.find_subtitle_tracks(g(entry, "dir"), g(entry, "file"))
      track_idx = int_or(track_index || "0", 0)
      track = if(track_idx >= 0, do: Enum.at(tracks, track_idx), else: nil) || Enum.at(tracks, 0)

      cond do
        tracks == [] ->
          Response.text(conn, "No subtitles", 404)

        not File.exists?(g(track, "filePath")) ->
          Response.text(conn, "File missing", 404)

        true ->
          conn =
            put_headers(conn, [
              {"content-type", "text/vtt; charset=utf-8"},
              {"access-control-allow-origin", "*"}
            ])

          if g(track, "ext") == ".vtt" do
            Plug.Conn.send_file(conn, 200, g(track, "filePath"))
          else
            case File.read(g(track, "filePath")) do
              {:ok, raw} ->
                Plug.Conn.send_resp(
                  conn,
                  200,
                  if(g(track, "ext") == ".srt", do: srt_to_vtt(raw), else: ass_to_vtt(raw))
                )

              _ ->
                Response.text(conn, "Subtitle read error", 500)
            end
          end
      end
    end
  end

  # JavaScript source: srtToVtt(srt)
  def srt_to_vtt(srt) do
    lines =
      srt |> String.replace("\r\n", "\n") |> String.replace("\r", "\n") |> String.split("\n")

    lines |> srt_to_vtt_lines(0, ["WEBVTT", ""]) |> Enum.join("\n")
  end

  defp srt_to_vtt_lines(lines, index, out) when index >= length(lines), do: out

  defp srt_to_vtt_lines(lines, index, out) do
    line = Enum.at(lines, index)

    cond do
      String.trim(line) == "" ->
        srt_to_vtt_lines(lines, index + 1, out)

      Regex.match?(~r/^\s*\d+\s*$/, line) ->
        srt_to_vtt_lines(lines, index + 1, out)

      Regex.match?(~r/\d{2}:\d{2}:\d{2},\d{3}/, line) ->
        timing = Regex.replace(~r/(\d{2}:\d{2}:\d{2}),(\d{3})/, line, "\\1.\\2")
        {out, index} = srt_to_vtt_cue_lines(lines, index + 1, out ++ [timing])
        srt_to_vtt_lines(lines, index, out ++ [""])

      true ->
        srt_to_vtt_lines(lines, index + 1, out)
    end
  end

  defp srt_to_vtt_cue_lines(lines, index, out) when index >= length(lines), do: {out, index}

  defp srt_to_vtt_cue_lines(lines, index, out) do
    line = Enum.at(lines, index)

    if String.trim(line) == "",
      do: {out, index},
      else: srt_to_vtt_cue_lines(lines, index + 1, out ++ [line])
  end

  # JavaScript source: assToVtt(ass)
  def ass_to_vtt(ass) do
    {out, _index} =
      ass
      |> String.replace("\r\n", "\n")
      |> String.split("\n")
      |> Enum.reduce({["WEBVTT", ""], 1}, fn line, {out, index} ->
        if String.starts_with?(line, "Dialogue:") do
          parts = String.split(line, ",")

          if length(parts) >= 10 do
            text =
              parts
              |> Enum.drop(9)
              |> Enum.join(",")
              |> String.replace(~r/\{[^}]*\}/, "")
              |> String.replace("\\N", "\n")
              |> String.trim()

            if text == "",
              do: {out, index},
              else:
                {out ++
                   [
                     to_string(index),
                     "#{ass_time(Enum.at(parts, 1) |> String.trim())} --> #{ass_time(Enum.at(parts, 2) |> String.trim())}",
                     text,
                     ""
                   ], index + 1}
          else
            {out, index}
          end
        else
          {out, index}
        end
      end)

    Enum.join(out, "\n")
  end

  # JavaScript source: assTime(t)
  def ass_time(value) do
    [h, m, s] = String.split(value, ":")
    [sec | rest] = String.split(s, ".")
    cs = List.first(rest) || "0"

    "#{String.pad_leading(h, 2, "0")}:#{String.pad_leading(m, 2, "0")}:#{String.pad_leading(sec, 2, "0")}.#{String.pad_trailing(cs, 3, "0")}"
  end

  # JavaScript source: streamRemotePlaybackProxy(req, res, media, matched, srcUrl = media.decodedUrl, redirectsLeft = 5)
  def stream_remote_playback_proxy(req, conn, media, matched, src_url \\ nil, redirects_left \\ 5) do
    src_url = src_url || g(media, "decodedUrl")

    headers = [
      {"User-Agent", header(req, "user-agent", "") |> empty_string_fallback("Mozilla/5.0")},
      {"Accept", "*/*"},
      {"Accept-Encoding", "identity"}
    ]

    headers = if value = header(req, "range"), do: headers ++ [{"Range", value}], else: headers
    method = if req.method == "HEAD", do: :head, else: :get

    state = %{
      conn: conn,
      req: req,
      media: media,
      matched: matched,
      src_url: src_url,
      redirects_left: redirects_left,
      mode: :playback,
      status: 200,
      upstream_headers: [],
      action: nil,
      started: false
    }

    case stream_upstream(method, src_url, headers, state) do
      {:redirect, next_url, next_conn} ->
        stream_remote_playback_proxy(req, next_conn, media, matched, next_url, redirects_left - 1)

      {:ok, result_conn} ->
        result_conn

      {:error, error, result_conn} ->
        remote_proxy_transport_error(
          result_conn,
          error,
          g(media, "decodedUrl"),
          "FTP Playback Proxy"
        )
    end
  end

  # JavaScript source: serveMobileFtpPipeline(req, res, media, srcUrl, matched)
  def serve_mobile_ftp_pipeline(req, conn, _media, src_url, _matched) do
    try do
      media_info = Core.get_cached_media_info(src_url)
      label = Core.remote_filename(src_url)
      audio = Core.resolve_playback_audio_selection(req, src_url, label)
      profile = mobile_compatibility_profile(media_info, audio, src_url)

      cond do
        profile["direct"] ->
          request =
            mobile_plan_request(req, %{
              "mode" => "proxy",
              "mobile" => "1",
              "audio" => g(audio, "audioIdx"),
              "audioStream" => g(audio, "audioStreamIdx")
            })

          Response.json(conn, %{"url" => Core.remote_playback_mode_url(src_url, request, "proxy")})

        true ->
          try do
            converted =
              convert_mobile_to_mp4(%{
                scope: "ftp",
                input: src_url,
                audioMap: g(audio, "audioMap"),
                remote: true
              })

            Response.json(conn, %{"url" => converted.url})
          rescue
            mp4_error ->
              IO.warn(
                "[Mobile Compatibility] FTP MP4 conversion failed for #{label}; starting HLS fallback: #{Exception.message(mp4_error)}"
              )

              prepared =
                start_isolated_mobile_hls(%{
                  scope: "ftp",
                  mediaId: src_url,
                  input: src_url,
                  startSec: Core.playback_start_from_req(req),
                  audioMap: g(audio, "audioMap"),
                  profile: profile,
                  remote: true
                })

              Response.json(conn, %{"url" => prepared.url})
          end
      end
    rescue
      error ->
        IO.warn(
          "[Mobile Compatibility] FTP plan failed for #{Core.remote_filename(src_url)}: #{Exception.message(error)}"
        )

        Core.json_error(
          conn,
          502,
          "MOBILE_PLAYBACK_PLAN_FAILED",
          "Could not prepare mobile-compatible playback",
          %{"details" => Exception.message(error)}
        )
    end
  end

  # JavaScript source: server.js lines 10027-10173, GET /api/playback/ftp
  def route_playback_ftp(conn) do
    case Core.read_trusted_remote_playback_media(conn, conn, true) do
      {:error, response} ->
        response

      {:ok, trusted} ->
        media = g(trusted, "media")
        src_url = g(trusted, "srcUrl")
        matched = g(trusted, "matched")

        raw_mode =
          if q(conn, "forceHls") == "1",
            do: "hls",
            else: q(conn, "mode", "") |> to_string() |> String.trim()

        requested_mode =
          if raw_mode != "",
            do: Core.normalize_playback_mode(raw_mode, "direct"),
            else: Core.preferred_remote_playback_mode(src_url)

        mode =
          if raw_mode != "" and requested_mode == "direct", do: "redirect", else: requested_mode

        plan_requested =
          q(conn, "plan") == "1" or q(conn, "json") == "1" or q(conn, "format") == "json"

        if Core.is_mobile(conn) and plan_requested do
          serve_mobile_ftp_pipeline(conn, conn, media, src_url, matched)
        else
          route_playback_ftp_mode(conn, media, src_url, matched, mode, plan_requested)
        end
    end
  end

  defp route_playback_ftp_mode(conn, media, src_url, matched, mode, plan_requested) do
    urls = Core.remote_playback_urls(src_url)
    playback_type = q(conn, "playbackType", "media") || "media"
    fallback_reason = q(conn, "fallbackReason") || if(plan_requested, do: "plan", else: "direct")

    if Core.config(:playback_verbose) do
      IO.puts("[FTP Playback] requested URL: #{g(media, "requestedUrl")}")
      IO.puts("[FTP Playback] decoded URL: #{src_url}")
      IO.puts("[FTP Playback] matched catalog item: #{Core.catalog_log_label(matched)}")
      IO.puts("[FTP Playback] mode: #{if(plan_requested, do: "plan:", else: "")}#{mode}")

      IO.puts(
        "[Media Playback] playbackType=#{playback_type} route=ftp-playback mode=#{mode} selected source URL=#{src_url} fallback reason=#{fallback_reason}"
      )
    end

    cond do
      plan_requested ->
        remote_playback_plan(conn, media, src_url, matched, urls, mode)

      mode == "proxy" ->
        stream_remote_playback_proxy(conn, conn, media, matched)

      mode in ["remux", "audio"] ->
        remote_mapped_stream(conn, media, src_url, matched, mode)

      mode == "hls" ->
        remote_hls_stream(conn, src_url, matched, playback_type, fallback_reason)

      true ->
        conn
        |> put_headers([
          {"access-control-allow-origin", "*"},
          {"accept-ranges", "bytes"},
          {"cache-control", "no-store"}
        ])
        |> Response.redirect(src_url, 302)
    end
  end

  defp remote_playback_plan(conn, media, src_url, matched, urls, mode) do
    label = Core.remote_filename(src_url)
    kghk = Core.is_kho_gaye_hum_kahan_title([g(matched, "name"), g(matched, "title"), label])

    {conn, audio} =
      if mode in ["remux", "audio", "hls"] or kghk do
        try do
          selection = Core.resolve_playback_audio_selection(conn, src_url, label)

          case if(mode in ["remux", "audio"],
                 do: Core.require_absolute_playback_audio(conn, conn, selection, mode, label),
                 else: true
               ) do
            {:error, response} ->
              throw({:response, response})

            true ->
              conn =
                if not is_nil(g(selection, "audioStreamIdx")) and
                     q(conn, "audioStream") != to_string(g(selection, "audioStreamIdx")) do
                  query =
                    conn.query_params
                    |> Map.put("audio", to_string(g(selection, "audioIdx")))
                    |> Map.put("audioStream", to_string(g(selection, "audioStreamIdx")))

                  %{conn | query_params: query}
                else
                  conn
                end

              {conn, selection}
          end
        rescue
          error ->
            details = %{"label" => label, "details" => Exception.message(error)}

            throw(
              {:response,
               Core.json_error(
                 conn,
                 502,
                 "AUDIO_RESOLVE_FAILED",
                 "Could not resolve a playable audio stream",
                 details
               )}
            )
        end
      else
        {conn, nil}
      end

    redirect_url = Core.remote_playback_mode_url(src_url, conn, "redirect")
    proxy_url = Core.remote_playback_mode_url(src_url, conn, "proxy")

    play_url =
      cond do
        mode == "proxy" -> proxy_url
        mode in ["remux", "audio"] -> Core.remote_playback_mode_url(src_url, conn, mode)
        mode == "hls" -> Core.remote_playback_hls_url(src_url, conn)
        true -> redirect_url
      end

    duration =
      if mode in ["remux", "audio", "hls"],
        do: Core.playback_duration_seconds(src_url, label),
        else: 0

    result = %{
      "ok" => true,
      "requestedUrl" => g(media, "requestedUrl"),
      "decodedUrl" => src_url,
      "matchedCatalogItem" => matched,
      "directPlayable" => g(urls, "directPlayable"),
      "unsupportedVideoHint" => Core.playback_url_has_unsupported_video_hint(src_url),
      "mode" => if(mode == "redirect", do: "direct", else: mode),
      "transport" => mode,
      "src" => play_url,
      "playUrl" => play_url,
      "finalPlayUrl" => play_url,
      "redirectUrl" => redirect_url,
      "proxyUrl" => proxy_url,
      "fallbackProxyUrl" => proxy_url,
      "legacyProxyUrl" => g(urls, "legacyProxyUrl"),
      "remuxUrl" => Core.remote_playback_mode_url(src_url, conn, "remux"),
      "audioTranscodeUrl" => Core.remote_playback_mode_url(src_url, conn, "audio"),
      "hlsUrl" => Core.remote_playback_hls_url(src_url, conn),
      "transcodeUrl" => g(urls, "transcodeUrl"),
      "duration" => duration,
      "ftpAudioValidated" => g(audio, "ftpAudioValidated") == true
    }

    audio_index = first_integer([g(audio, "audioIndex"), g(audio, "audioIdx")])

    result =
      if is_integer(audio_index),
        do:
          Map.merge(result, %{
            "audioIndex" => audio_index,
            "defaultAudioIndex" => first_integer([g(audio, "defaultAudioIndex"), audio_index])
          }),
        else: result

    result =
      if truthy?(g(audio, "audioSafeMode")) do
        Map.merge(result, %{
          "defaultAudioIndex" => g(audio, "defaultAudioIndex"),
          "audioSafeMode" => true,
          "audioStreamsDetected" => g(audio, "audioStreamsDetected"),
          "ffmpegMapping" => g(audio, "ffmpegMapping") || g(audio, "audioMap")
        })
      else
        result
      end

    Response.json(conn, result)
  catch
    {:response, response} -> response
  end

  defp remote_mapped_stream(conn, media, src_url, matched, mode) do
    label = Core.remote_filename(src_url)

    try do
      audio = Core.resolve_playback_audio_selection(conn, src_url, label)

      case Core.require_absolute_playback_audio(conn, conn, audio, mode, label) do
        {:error, response} ->
          response

        true ->
          fallback =
            if mode == "audio" and not is_nil(g(audio, "audioStreamIdx")),
              do: fn _ -> stream_remote_playback_proxy(conn, conn, media, matched) end,
              else: nil

          StreamVault.Live.stream_ffmpeg_mp4(conn, conn, %{
            input: src_url,
            mode: mode,
            startSec: Core.playback_start_from_req(conn),
            audioMap: g(audio, "audioMap"),
            audioStreamIdx: g(audio, "audioStreamIdx"),
            videoStreamIdx: g(audio, "videoStreamIdx"),
            audioVideoOffsetSec: g(audio, "audioVideoOffsetSec"),
            audioCodec: g(audio, "audioCodec", ""),
            videoCodec: g(audio, "videoCodec", ""),
            audioStartTime: g(audio, "audioStartTime"),
            videoStartTime: g(audio, "videoStartTime"),
            remote: true,
            label: label,
            hevcTag: Core.playback_url_has_hevc_hint(src_url),
            fallbackOriginal: fallback
          })
      end
    rescue
      error ->
        Core.json_error(
          conn,
          502,
          "AUDIO_RESOLVE_FAILED",
          "Could not resolve a playable audio stream",
          %{"label" => label, "details" => Exception.message(error)}
        )
    end
  end

  defp remote_hls_stream(conn, src_url, matched, playback_type, fallback_reason) do
    start_sec = Core.playback_start_from_req(conn)
    label = Core.remote_filename(src_url)
    kghk = Core.is_kho_gaye_hum_kahan_title([g(matched, "title"), g(matched, "name"), label])
    audio = Core.resolve_playback_audio_selection(conn, src_url, label)
    audio_map = g(audio, "audioMap")

    IO.puts(
      "[FTP Playback HLS] playbackType=#{playback_type} selected source URL=#{src_url} fallback reason=#{fallback_reason} #{label} audioIdx=#{g(audio, "audioIdx")} audioStream=#{g(audio, "audioStreamIdx") || "relative"} map=#{audio_map}"
    )

    preset = StreamVault.Live.mobile_hls_preset_from_quality(q(conn, "quality"))

    key =
      StreamVault.Live.hls_session_key(
        "ftp",
        src_url,
        start_sec,
        "#{audio_map}|#{g(preset, "key", g(preset, :key))}"
      )

    raw_client = q(conn, "client", "") |> to_string()
    client_id = if Regex.match?(~r/^[a-zA-Z0-9_-]{8,80}$/, raw_client), do: raw_client, else: ""

    playlist =
      StreamVault.Live.start_mobile_hls_session(%{
        scope: "ftp",
        key: key,
        input: src_url,
        startSec: start_sec,
        audioMap: audio_map,
        clientId: client_id,
        preset: preset,
        kghkAudio: kghk
      })

    StreamVault.Live.send_mobile_hls_playlist(conn, "ftp", key, playlist)
  end

  # JavaScript source: server.js lines 10175-10215, GET /api/play-url
  def route_play_url(conn) do
    case read_remote_param(conn) do
      {:error, response} ->
        response

      {:ok, media} ->
        matched = Core.find_catalog_item_by_stream_url(g(media, "decodedUrl"))
        urls = Core.remote_play_urls(g(media, "decodedUrl"))
        availability = Core.check_remote_availability(g(media, "decodedUrl"), conn)

        if truthy?(g(availability, "ok")) do
          Response.json(conn, %{
            "ok" => true,
            "requestedUrl" => g(media, "requestedUrl"),
            "decodedUrl" => g(media, "decodedUrl"),
            "matchedCatalogItem" => matched,
            "directPlayable" => g(urls, "directPlayable"),
            "playUrl" => g(urls, "finalPlayUrl"),
            "finalPlayUrl" => g(urls, "finalPlayUrl"),
            "proxyUrl" => g(urls, "proxyUrl"),
            "transcodeUrl" => g(urls, "transcodeUrl"),
            "availability" => availability
          })
        else
          Core.json_error(
            conn,
            404,
            "REMOTE_MEDIA_UNAVAILABLE",
            "Remote media is not available",
            %{
              "requestedUrl" => g(media, "requestedUrl"),
              "decodedUrl" => g(media, "decodedUrl"),
              "matchedCatalogItem" => matched,
              "availability" => availability
            }
          )
        end
    end
  end

  # JavaScript source: server.js lines 10217-10283, GET /api/ftp/media-info and GET /api/ftp/info
  def route_ftp_media_info(conn) do
    case read_remote_param(conn) do
      {:error, response} -> response
      {:ok, media} -> serve_ftp_media_info(conn, media)
    end
  end

  defp serve_ftp_media_info(conn, media) do
    src_url = g(media, "decodedUrl")
    matched = Core.find_catalog_item_by_stream_url(src_url)
    urls = Core.remote_play_urls(src_url)
    audio_only = q(conn, "audioOnly") == "1"

    try do
      info_task =
        Task.async(fn ->
          if audio_only,
            do: Core.get_cached_audio_only_media_info(src_url),
            else: Core.get_cached_media_info(src_url)
        end)

      subtitles_task =
        Task.async(fn ->
          if audio_only,
            do: [],
            else:
              (try do
                 Core.discover_remote_subtitle_tracks(src_url, conn)
               rescue
                 _ -> []
               end)
        end)

      info = Task.await(info_task, :infinity)
      sidecars = Task.await(subtitles_task, :infinity)

      if audio_only and q(conn, "playbackType") == "media" do
        tracks = list(g(info, "audioTracks"))

        Response.json(conn, %{
          "ok" => true,
          "requestedUrl" => g(media, "requestedUrl"),
          "decodedUrl" => src_url,
          "audioTracks" => tracks,
          "duration" => number_or_zero(g(info, "duration")),
          "hasAudio" => tracks != []
        })
      else
        title = g(matched, "name") || g(matched, "title") || Core.remote_filename(src_url)
        validated = Core.first_valid_decoded_audio_stream(src_url, g(info, "audioTracks"), title)
        audio_index = g(validated, "selectedIndex")
        ftp_streams = list(g(validated, "ftpStreams"))

        tracks =
          list(g(info, "audioTracks"))
          |> Enum.with_index()
          |> Enum.map(fn {track, index} -> Enum.at(ftp_streams, index) || track end)

        result =
          %{
            "ok" => true,
            "requestedUrl" => g(media, "requestedUrl"),
            "decodedUrl" => src_url,
            "matchedCatalogItem" => matched,
            "playUrl" => g(urls, "finalPlayUrl"),
            "finalPlayUrl" => g(urls, "finalPlayUrl")
          }
          |> Map.merge(info)
          |> Map.merge(%{
            "audioTracks" => tracks,
            "sidecarSubtitleTracks" => sidecars,
            "duration" => number_or_zero(g(info, "duration")),
            "ftpAudioValidated" => not is_nil(audio_index)
          })

        result =
          if is_nil(audio_index),
            do: result,
            else:
              Map.merge(result, %{"audioIndex" => audio_index, "defaultAudioIndex" => audio_index})

        Response.json(conn, result)
      end
    rescue
      error ->
        Core.json_error(
          conn,
          502,
          "REMOTE_MEDIA_PROBE_FAILED",
          "Remote media is reachable but could not be probed",
          %{
            "requestedUrl" => g(media, "requestedUrl"),
            "decodedUrl" => src_url,
            "matchedCatalogItem" => matched,
            "playUrl" => g(urls, "finalPlayUrl"),
            "duration" => 0,
            "details" => Exception.message(error)
          }
        )
    end
  end

  # JavaScript source: server.js lines 10285-10356, GET /api/ftp/subtitle/:track.vtt
  def route_ftp_subtitle(conn, track) do
    case read_remote_param(conn) do
      {:error, response} ->
        response

      {:ok, media} ->
        src_url = g(media, "decodedUrl")
        sidecar = q(conn, "sidecar", "") |> to_string() |> String.trim()

        if sidecar != "" do
          case resolve_relative_url(src_url, sidecar) do
            {:ok, sidecar_url} ->
              Core.send_remote_sidecar_subtitle_as_vtt(conn, conn, src_url, sidecar_url)

            :error ->
              Core.json_error(conn, 400, "INVALID_SUBTITLE_URL", "Invalid remote subtitle URL")
          end
        else
          track_index = max(0, int_or(track || "0", 0))
          stream_index = parse_int_or_nil(q(conn, "stream", ""))

          map_target =
            if is_integer(stream_index) and stream_index >= 0,
              do: "0:#{stream_index}",
              else: "0:s:#{track_index}"

          arguments = [
            "-hide_banner",
            "-loglevel",
            "error",
            "-nostdin",
            "-probesize",
            "1048576",
            "-analyzeduration",
            "1000000",
            "-rw_timeout",
            "15000000",
            "-i",
            src_url,
            "-map",
            "#{map_target}?",
            "-vn",
            "-an",
            "-c:s",
            "webvtt",
            "-f",
            "webvtt",
            "pipe:1"
          ]

          conn |> subtitle_headers() |> stream_subtitle(arguments)
        end
    end
  end

  # JavaScript source: server.js lines 10358-10518, GET /api/ftp/stream
  def route_ftp_stream(conn) do
    case Core.read_trusted_remote_playback_media(conn, conn, true) do
      {:error, response} ->
        response

      {:ok, trusted} ->
        src_url = g(trusted, "srcUrl")
        start_sec = float_or(q(conn, "start"), 0)

        audio =
          try do
            Core.resolve_playback_audio_selection(conn, src_url, Core.remote_filename(src_url))
          rescue
            error ->
              IO.warn(
                "[FTP Stream] audio selection failed for #{Core.remote_filename(src_url)}: #{Exception.message(error)}"
              )

              Core.playback_audio_selection_from_req(conn)
          end

        audio_index = int_or(g(audio, "audioIdx"), 0)
        audio_stream_index = finite_number(g(audio, "audioStreamIdx"))
        mobile = Core.is_mobile_playback_request(conn)
        smooth = q(conn, "smooth") == "1" or q(conn, "profile") == "smooth"

        copy_video =
          not smooth and not mobile and Core.is_remote_direct_playable(src_url) and
            Core.remote_video_can_copy(src_url)

        compatibility_transcode = not copy_video

        profile =
          StreamVault.Live.compatibility_seek_profile_for_source(src_url, %{
            compatibilityTranscode: compatibility_transcode,
            mobilePlayback: mobile
          })

        window = StreamVault.Live.compatibility_seek_window(start_sec, profile)

        arguments =
          ftp_stream_arguments(
            src_url,
            audio_index,
            audio_stream_index,
            mobile,
            smooth,
            copy_video,
            compatibility_transcode,
            window
          )

        if g(window, :exact_start, 0) > 0 or Core.config(:playback_verbose) do
          IO.puts(
            "[FTP Stream Seek] title=\"#{Core.remote_filename(src_url)}\" url=\"#{src_url}\" requestedStart=#{g(window, :exact_start)} inputStart=#{g(window, :input_start)} outputTrim=#{g(window, :output_trim)} audioIdx=#{audio_index} audioStream=#{audio_stream_index || "relative"} profile=#{g(window, :profile)} reason=#{g(window, :profile_reason)}"
          )

          IO.puts("[FTP Stream FFmpeg Args] #{Jason.encode!(arguments)}")
        end

        conn
        |> media_stream_headers("no-cache")
        |> stream_ffmpeg(arguments, :infinity, "FFmpeg error")
    end
  end

  defp ftp_stream_arguments(
         src_url,
         audio_index,
         audio_stream_index,
         mobile,
         smooth,
         copy_video,
         compatibility_transcode,
         window
       ) do
    arguments = ["-hide_banner", "-loglevel", "warning", "-nostdin"]
    input_start = number_or_zero(g(window, :input_start))
    output_trim = number_or_zero(g(window, :output_trim))

    arguments =
      if input_start > 0,
        do: arguments ++ ["-ss", StreamVault.Live.ffmpeg_seconds(input_start)],
        else: arguments

    arguments =
      if compatibility_transcode do
        arguments ++
          [
            "-fflags",
            "+genpts",
            "-probesize",
            "1048576",
            "-analyzeduration",
            "1000000",
            "-rw_timeout",
            "15000000"
          ]
      else
        arguments ++
          [
            "-fflags",
            "+genpts+nobuffer",
            "-flags",
            "low_delay",
            "-probesize",
            "524288",
            "-analyzeduration",
            "500000",
            "-rw_timeout",
            "15000000"
          ]
      end

    arguments = arguments ++ ["-i", src_url]

    arguments =
      if compatibility_transcode and output_trim > 0,
        do: arguments ++ ["-ss", StreamVault.Live.ffmpeg_seconds(output_trim)],
        else: arguments

    audio_map =
      if is_number(audio_stream_index) and audio_stream_index >= 0,
        do: "0:#{trunc(audio_stream_index)}?",
        else: "0:a:#{audio_index}?"

    arguments = arguments ++ ["-map", "0:v:0", "-map", audio_map, "-sn", "-dn"]

    arguments =
      if copy_video do
        arguments ++ ["-c:v", "copy"]
      else
        filters = []

        filters =
          cond do
            smooth -> filters ++ ["scale=w=min(#{Core.config(:smooth_max_width)}\\,iw):h=-2"]
            mobile -> filters ++ ["scale=w=min(1280\\,iw):h=-2"]
            true -> filters
          end

        arguments =
          arguments ++ ["-vf", Enum.join(filters ++ [Core.config(:compat_video_pts_filter)], ",")]

        arguments =
          if smooth do
            arguments ++
              [
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-tune",
                "zerolatency",
                "-b:v",
                Core.config(:smooth_video_bitrate),
                "-maxrate",
                Core.config(:smooth_video_bitrate),
                "-bufsize",
                Core.config(:smooth_video_bufsize),
                "-pix_fmt",
                "yuv420p",
                "-g",
                "48",
                "-keyint_min",
                "48",
                "-sc_threshold",
                "0"
              ]
          else
            arguments ++
              [
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-tune",
                "zerolatency",
                "-crf",
                if(mobile, do: "30", else: "23"),
                "-maxrate",
                if(mobile, do: "2000k", else: "6M"),
                "-bufsize",
                if(mobile, do: "4000k", else: "12M"),
                "-pix_fmt",
                "yuv420p",
                "-g",
                "48",
                "-keyint_min",
                "48",
                "-sc_threshold",
                "0"
              ]
          end

        if mobile, do: arguments ++ ["-profile:v", "baseline", "-level", "3.1"], else: arguments
      end

    arguments =
      arguments ++
        [
          "-c:a",
          "aac",
          "-b:a",
          if(smooth, do: Core.config(:smooth_audio_bitrate), else: "128k"),
          "-ar",
          "48000",
          "-ac",
          "2"
        ]

    arguments =
      if compatibility_transcode,
        do:
          arguments ++
            ["-af", Core.config(:compat_audio_pts_filter), "-avoid_negative_ts", "make_zero"],
        else: arguments ++ ["-copyts", "-start_at_zero", "-avoid_negative_ts", "disabled"]

    arguments ++
      [
        "-max_interleave_delta",
        "0",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flush_packets",
        "1",
        "-movflags",
        "frag_keyframe+empty_moov+default_base_moof",
        "-f",
        "mp4",
        "pipe:1"
      ]
  end

  # JavaScript source: server.js lines 10520-10595, GET /api/ftp/proxy
  def route_ftp_proxy(conn) do
    case read_remote_param(conn) do
      {:error, response} ->
        response

      {:ok, media} ->
        src_url = g(media, "decodedUrl")
        matched = Core.find_catalog_item_by_stream_url(src_url)

        headers = [
          {"User-Agent", header(conn, "user-agent", "") |> empty_string_fallback("Mozilla/5.0")}
        ]

        headers =
          if value = header(conn, "range"), do: headers ++ [{"Range", value}], else: headers

        state = %{
          conn: conn,
          req: conn,
          media: media,
          matched: matched,
          src_url: src_url,
          redirects_left: 0,
          mode: :legacy,
          status: 200,
          upstream_headers: [],
          action: nil,
          started: false
        }

        case stream_upstream(:get, src_url, headers, state) do
          {:ok, result_conn} ->
            result_conn

          {:redirect, _next, result_conn} ->
            result_conn

          {:error, error, result_conn} ->
            remote_proxy_transport_error(result_conn, error, src_url, "FTP Proxy")
        end
    end
  end

  # JavaScript source: server.js lines 10597-10638, GET /api/ftp/duration
  def route_ftp_duration(conn) do
    case read_remote_param(conn, %{"duration" => 0}) do
      {:error, response} ->
        response

      {:ok, media} ->
        src_url = g(media, "decodedUrl")
        matched = Core.find_catalog_item_by_stream_url(src_url)

        try do
          info = Core.get_cached_duration_only_media_info(src_url)

          Response.json(conn, %{
            "ok" => true,
            "requestedUrl" => g(media, "requestedUrl"),
            "decodedUrl" => src_url,
            "matchedCatalogItem" => matched,
            "duration" => number_or_zero(g(info, "duration"))
          })
        rescue
          error ->
            Core.json_error(
              conn,
              502,
              "REMOTE_DURATION_FAILED",
              "Remote media duration could not be detected",
              %{
                "requestedUrl" => g(media, "requestedUrl"),
                "decodedUrl" => src_url,
                "matchedCatalogItem" => matched,
                "duration" => 0,
                "details" => Exception.message(error)
              }
            )
        end
    end
  end

  # JavaScript source: server.js lines 10640-10691, GET /api/ftp/test
  def route_ftp_test(conn) do
    case read_remote_param(conn) do
      {:error, response} ->
        response

      {:ok, media} ->
        src_url = g(media, "decodedUrl")

        arguments = [
          "-loglevel",
          "error",
          "-i",
          src_url,
          "-t",
          "5",
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-crf",
          "28",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-movflags",
          "frag_keyframe+empty_moov+default_base_moof",
          "-f",
          "mp4",
          "pipe:1"
        ]

        IO.puts("[TEST] FFmpeg args: #{Enum.join(arguments, " ")}")

        case run_ftp_test_process(arguments) do
          {:ok, exit_code, bytes, stderr} ->
            Response.json(conn, %{
              "exitCode" => exit_code,
              "bytesProduced" => bytes,
              "stderr" => stderr,
              "srcUrl" => src_url
            })

          {:error, message} ->
            Response.json(conn, %{"error" => message})
        end
    end
  end

  defp read_remote_param(conn, extra \\ %{}) do
    try do
      {:ok, Core.read_remote_url_param(conn, ["url", "streamUrl", "movie", "movieUrl", "src"])}
    rescue
      error in StreamVault.Core.RemoteURLError ->
        details =
          Map.merge(
            %{"requestedUrl" => error.requested_url, "decodedUrl" => error.decoded_url},
            extra
          )

        {:error,
         Core.json_error(
           conn,
           error.status || 400,
           error.code || "INVALID_URL",
           error.message,
           details
         )}
    end
  end

  defp resolve_relative_url(base, value) do
    try do
      uri = URI.merge(URI.parse(base), value)
      if is_binary(uri.scheme), do: {:ok, URI.to_string(uri)}, else: :error
    rescue
      _ -> :error
    end
  end

  defp empty_string_fallback(value, fallback),
    do: if(value in [nil, ""], do: fallback, else: value)

  defp stream_upstream(method, url, headers, state) do
    request =
      Finch.build(
        method,
        url,
        Enum.map(headers, fn {name, value} -> {to_string(name), to_string(value)} end)
      )

    case Finch.stream_while(request, StreamVault.Finch, state, &proxy_stream_event/2,
           pool_timeout: 20_000,
           receive_timeout: 20_000
         ) do
      {:ok, %{action: {:redirect, next_url}, conn: conn}} -> {:redirect, next_url, conn}
      {:ok, %{conn: conn}} -> {:ok, conn}
      {:error, error, %{conn: conn}} -> {:error, error, conn}
    end
  rescue
    error -> {:error, error, state.conn}
  end

  defp proxy_stream_event({:status, status}, state), do: {:cont, %{state | status: status}}

  defp proxy_stream_event({:headers, headers}, state) do
    state = %{state | upstream_headers: headers}
    status = state.status || 200
    location = upstream_header(headers, "location")

    cond do
      state.mode == :playback and status in [301, 302, 303, 307, 308] and is_binary(location) and
        state.redirects_left > 0 and state.conn.state == :unset ->
        case resolve_relative_url(state.src_url, location) do
          {:ok, next_url} ->
            reason = Core.sv_server_live_source_block_reason(next_url)

            if reason not in [nil, ""] do
              conn =
                Core.json_error(
                  state.conn,
                  400,
                  "LIVE_MEDIA_SOURCE_BLOCKED",
                  "Live TV sources are blocked for media playback",
                  %{
                    "requestedUrl" => g(state.media, "requestedUrl"),
                    "decodedUrl" => next_url,
                    "blockReason" => reason
                  }
                )

              {:halt, %{state | conn: conn, action: :done, started: true}}
            else
              {:halt, %{state | action: {:redirect, next_url}}}
            end

          :error ->
            conn =
              remote_proxy_transport_error(
                state.conn,
                "invalid redirect URL",
                g(state.media, "decodedUrl"),
                "FTP Playback Proxy"
              )

            {:halt, %{state | conn: conn, action: :done, started: true}}
        end

      status >= 400 ->
        conn =
          Core.json_error(
            state.conn,
            status,
            "REMOTE_MEDIA_REQUEST_FAILED",
            "Remote media request failed",
            %{
              "requestedUrl" => g(state.media, "requestedUrl"),
              "decodedUrl" =>
                if(state.mode == :playback, do: g(state.media, "decodedUrl"), else: state.src_url),
              "matchedCatalogItem" => state.matched,
              "upstreamStatus" => status
            }
          )

        {:halt, %{state | conn: conn, action: :done, started: true}}

      true ->
        conn = proxy_response_headers(state, headers, status)

        if state.req.method == "HEAD" do
          conn = Plug.Conn.send_resp(conn, status, "")
          {:halt, %{state | conn: conn, action: :done, started: true}}
        else
          conn = Plug.Conn.send_chunked(conn, status)
          {:cont, %{state | conn: conn, started: true}}
        end
    end
  end

  defp proxy_stream_event({:data, data}, %{started: true} = state) do
    case Plug.Conn.chunk(state.conn, data) do
      {:ok, conn} -> {:cont, %{state | conn: conn}}
      {:error, _reason} -> {:halt, %{state | action: :done}}
    end
  end

  defp proxy_stream_event({:data, _data}, state), do: {:cont, state}
  defp proxy_stream_event({:trailers, _trailers}, state), do: {:cont, state}

  defp proxy_response_headers(state, headers, status) do
    upstream_type = upstream_header(headers, "content-type")

    content_type =
      if upstream_type in [nil, ""] or
           String.contains?(String.downcase(upstream_type), "octet-stream"),
         do: Core.mime_for_media_path(state.src_url),
         else: upstream_type

    response_headers =
      if state.mode == :playback do
        base = [
          {"content-type", content_type},
          {"access-control-allow-origin", "*"},
          {"access-control-expose-headers",
           "Content-Range, Accept-Ranges, Content-Length, Content-Type"},
          {"cache-control", "no-store"}
        ]

        accepts =
          String.downcase(upstream_header(headers, "accept-ranges") || "") == "bytes" or
            (status == 206 and not is_nil(upstream_header(headers, "content-range")))

        if accepts, do: base ++ [{"accept-ranges", "bytes"}], else: base
      else
        cache =
          if Core.is_mobile_playback_request(state.req),
            do: "no-cache",
            else: "private, max-age=0, must-revalidate"

        [
          {"content-type", content_type},
          {"accept-ranges", upstream_header(headers, "accept-ranges") || "bytes"},
          {"access-control-allow-origin", "*"},
          {"cache-control", cache}
        ]
      end

    response_headers =
      if value = upstream_header(headers, "content-length"),
        do: response_headers ++ [{"content-length", value}],
        else: response_headers

    response_headers =
      if value = upstream_header(headers, "content-range"),
        do: response_headers ++ [{"content-range", value}],
        else: response_headers

    put_headers(state.conn, response_headers)
  end

  defp upstream_header(headers, wanted) do
    Enum.find_value(headers, fn {name, value} ->
      if String.downcase(to_string(name)) == wanted, do: value
    end)
  end

  defp remote_proxy_transport_error(conn, error, src_url, label) do
    message = if is_exception(error), do: Exception.message(error), else: to_string(error)
    IO.warn("[#{label}] Error: #{message}")

    if conn.state == :unset do
      if String.contains?(String.downcase(message), "timeout") do
        Core.json_error(conn, 504, "REMOTE_PROXY_TIMEOUT", "Remote media source timed out", %{
          "decodedUrl" => src_url
        })
      else
        Core.json_error(
          conn,
          502,
          "REMOTE_PROXY_FAILED",
          "Could not reach remote media source",
          %{"decodedUrl" => src_url, "details" => message}
        )
      end
    else
      conn
    end
  end

  defp run_ftp_test_process(arguments) do
    stderr_path = Path.join(System.tmp_dir!(), "streamvault-ftp-test-#{random_hex(8)}.stderr")

    try do
      port = open_with_stderr_file(Command.executable(:ffmpeg), arguments, stderr_path)
      reference = make_ref()
      timer = Process.send_after(self(), {:ftp_test_timeout, reference, port}, 15_000)
      {exit_code, bytes} = ftp_test_loop(port, reference, timer, 0)

      stderr =
        case File.read(stderr_path) do
          {:ok, value} -> value
          _ -> ""
        end

      _ = File.rm(stderr_path)
      {:ok, exit_code, bytes, stderr}
    rescue
      error ->
        _ = File.rm(stderr_path)
        {:error, Exception.message(error)}
    end
  end

  defp ftp_test_loop(port, reference, timer, bytes) do
    receive do
      {^port, {:data, data}} ->
        ftp_test_loop(port, reference, timer, bytes + byte_size(data))

      {^port, {:exit_status, status}} ->
        Process.cancel_timer(timer)
        {status, bytes}

      {:ftp_test_timeout, ^reference, ^port} ->
        Command.terminate(port)
        {nil, bytes}
    end
  end

  defp open_with_stderr_file(executable, arguments, stderr_path) do
    if match?({:win32, _}, :os.type()) do
      command =
        Enum.map_join([executable | arguments], " ", &windows_shell_quote/1) <>
          " 2>" <> windows_shell_quote(stderr_path)

      shell = System.find_executable("cmd.exe") || System.find_executable("cmd") || "cmd.exe"

      Port.open({:spawn_executable, to_charlist(shell)}, [
        :binary,
        :exit_status,
        :use_stdio,
        args: Enum.map(["/d", "/v:off", "/s", "/c", command], &to_charlist/1)
      ])
    else
      command =
        Enum.map_join([executable | arguments], " ", &unix_shell_quote/1) <>
          " 2>" <> unix_shell_quote(stderr_path)

      shell = System.find_executable("sh") || "/bin/sh"

      Port.open({:spawn_executable, to_charlist(shell)}, [
        :binary,
        :exit_status,
        :use_stdio,
        args: [~c"-c", to_charlist(command)]
      ])
    end
  end

  defp windows_shell_quote(value) do
    escaped = value |> to_string() |> String.replace("%", "%%") |> String.replace("\"", "\\\"")
    "\"#{escaped}\""
  end

  defp unix_shell_quote(value), do: "'" <> String.replace(to_string(value), "'", "'\"'\"'") <> "'"
end

defmodule StreamVault.Software do
  @moduledoc false

  @genre_ids %{
    28 => "Action",
    12 => "Adventure",
    16 => "Animation",
    35 => "Comedy",
    80 => "Crime",
    99 => "Documentary",
    18 => "Drama",
    10751 => "Family",
    14 => "Fantasy",
    36 => "History",
    27 => "Horror",
    10402 => "Music",
    9648 => "Mystery",
    10749 => "Romance",
    878 => "Science Fiction",
    10770 => "TV Movie",
    53 => "Thriller",
    10752 => "War",
    37 => "Western",
    10759 => "Action & Adventure",
    10762 => "Kids",
    10763 => "News",
    10764 => "Reality",
    10765 => "Sci-Fi & Fantasy",
    10766 => "Soap",
    10767 => "Talk",
    10768 => "War & Politics"
  }

  # JavaScript source: svSoftwareHash(value)
  def software_hash(value) do
    :crypto.hash(:sha, to_string(value || ""))
    |> Base.encode16(case: :lower)
    |> String.slice(0, 16)
  end

  # JavaScript source: svSafeDecode(value)
  def safe_decode(value),
    do:
      StreamVault.JS.safe_decode(
        if(StreamVault.JS.truthy?(value), do: to_string(value), else: "")
      )

  # JavaScript source: svSoftwareExt(value)
  def software_ext(value) do
    value
    |> to_string()
    |> String.split("?")
    |> List.first()
    |> Path.extname()
    |> String.replace_prefix(".", "")
    |> String.downcase()
  end

  # JavaScript source: svFindSoftwareCatalogFiles()
  def find_software_catalog_files do
    explicit = Enum.filter(StreamVault.Paths.software_catalog_candidates(), &File.regular?/1)
    seen = MapSet.new(Enum.map(explicit, &(Path.expand(&1) |> String.downcase())))

    roots = [
      StreamVault.Paths.root(),
      Path.join(StreamVault.Paths.root(), "data"),
      Path.join([StreamVault.Paths.root(), "data", "catalogs"])
    ]

    {files, _seen} =
      Enum.reduce(roots, {explicit, seen}, fn root, {files, seen} ->
        walk_catalogs(root, 0, files, seen)
      end)

    files
  end

  # JavaScript source: svSoftwareTitleFromUrl(value)
  def software_title_from_url(value) do
    raw =
      value
      |> to_string()
      |> String.split("/")
      |> List.last()
      |> case do
        value when value in [nil, ""] -> "Untitled"
        value -> safe_decode(value)
      end

    title =
      raw
      |> then(&Regex.replace(~r/\.[^\/.]+$/, &1, ""))
      |> then(&Regex.replace(~r/[._\-]+/, &1, " "))
      |> then(&Regex.replace(~r/\s+/, &1, " "))
      |> String.trim()

    cond do
      title != "" -> title
      raw != "" -> raw
      true -> "Untitled"
    end
  end

  # JavaScript source: svSoftwarePlatform(item, ext, url)
  def software_platform(item, ext, url) do
    text =
      join_truthy([
        item["platform"],
        item["category"],
        item["type"],
        item["name"],
        item["title"],
        url
      ])
      |> String.downcase()

    cond do
      ext in ["apk", "xapk", "apks"] or String.contains?(text, "android") ->
        "Android"

      ext in ["exe", "msi"] or String.contains?(text, "windows") ->
        "Windows"

      ext in ["dmg", "pkg"] or String.contains?(text, "mac") ->
        "macOS"

      ext in ["iso", "img"] or String.contains?(text, "operating system") or
          String.contains?(text, "/os/") ->
        "OS"

      ext in ["nsp", "xci", "cia", "3ds", "gba", "nds", "nes", "snes", "wbfs"] or
          String.contains?(text, "console") ->
        "Console"

      ext in ["zip", "rar", "7z"] ->
        "Archive"

      true ->
        item["platform"] || "Other"
    end
  end

  # JavaScript source: svSoftwareCategory(item, platform, url)
  def software_category(item, platform, url) do
    text =
      join_truthy([item["category"], item["type"], item["name"], item["title"], url])
      |> String.downcase()

    cond do
      String.contains?(text, "game") ->
        if(platform == "Console", do: "Console Games", else: "Games")

      platform == "Android" ->
        "Android"

      platform == "Windows" ->
        "Software"

      platform == "OS" ->
        "OS"

      platform == "Archive" ->
        "Archives"

      true ->
        item["category"] || platform || "Other"
    end
  end

  # JavaScript source: svNormalizeSoftwareItem(item, idx)
  def normalize_software_item(item, idx) when is_map(item) do
    item = Map.new(item, fn {key, value} -> {to_string(key), value} end)

    url =
      [
        "source",
        "url",
        "href",
        "link",
        "downloadUrl",
        "downloadURL",
        "download_url",
        "directUrl",
        "directURL",
        "fileUrl",
        "fileURL",
        "path",
        "streamUrl",
        "src"
      ]
      |> Enum.find_value("", fn key ->
        if StreamVault.JS.truthy?(item[key]), do: to_string(item[key])
      end)
      |> String.trim()

    if not Regex.match?(~r/^(?:https?|ftp):\/\//i, url) do
      nil
    else
      ext =
        (item["extension"] || item["ext"] || software_ext(url))
        |> to_string()
        |> String.replace(~r/^\./, "")
        |> String.downcase()

      filename =
        item["filename"] || item["file"] ||
          url |> String.split("/") |> List.last() |> safe_decode()

      name =
        (item["name"] || item["title"] || item["label"] ||
           software_title_from_url(filename || url))
        |> to_string()
        |> String.trim()

      if name == "" or String.length(name) < 2 do
        nil
      else
        platform = software_platform(item, ext, url)
        category = software_category(item, platform, url)

        %{
          "id" => to_string(item["id"] || "sw_#{software_hash(url || name || idx)}"),
          "name" => name,
          "filename" => filename,
          "extension" => ext,
          "category" => category,
          "platform" => platform,
          "type" => item["type"] || category,
          "size" => item["size"] || item["bytes"] || item["sizeBytes"] || item["length"],
          "icon" => item["icon"] || item["poster"] || item["image"] || "",
          "source" => url,
          "url" => url
        }
      end
    end
  end

  def normalize_software_item(_item, _idx), do: nil

  # JavaScript source: svReadSoftwareJsonCatalog()
  def read_software_json_catalog do
    files = find_software_catalog_files()

    newest_mtime =
      Enum.reduce(files, 0, fn file, newest ->
        case File.stat(file, time: :posix) do
          {:ok, stat} -> max(newest, stat.mtime)
          _ -> newest
        end
      end)

    cached = StreamVault.State.get(:software_cache)
    cached_mtime = StreamVault.State.get(:software_cache_mtime, 0)

    if cached && cached_mtime == newest_mtime do
      %{"items" => cached, "mtime" => newest_mtime, "source" => Enum.join(files, ", ")}
    else
      {items, _seen} =
        Enum.reduce(files, {[], MapSet.new()}, fn file, {items, seen} ->
          parsed = StreamVault.Files.read_json(file, nil)

          raw =
            cond do
              is_list(parsed) ->
                parsed

              is_map(parsed) ->
                parsed["downloads"] || parsed["items"] || parsed["software"] || parsed["apps"] ||
                  parsed["files"] || []

              true ->
                []
            end

          if is_list(raw) do
            Enum.with_index(raw)
            |> Enum.reduce({items, seen}, fn {item, index}, {items, seen} ->
              normalized = normalize_software_item(item, length(items) + index)

              key =
                if normalized,
                  do:
                    to_string(normalized["source"] || normalized["url"] || normalized["name"])
                    |> String.downcase()

              if is_nil(normalized) or MapSet.member?(seen, key) do
                {items, seen}
              else
                {items ++ [normalized], MapSet.put(seen, key)}
              end
            end)
          else
            {items, seen}
          end
        end)

      by_id = Map.new(items, &{&1["id"], &1})
      StreamVault.State.put(:software_by_id, by_id)
      StreamVault.State.put(:software_cache, items)
      StreamVault.State.put(:software_cache_mtime, newest_mtime)

      IO.puts(
        "ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¦ Software catalog loaded: #{length(items)} downloads from #{length(files)} catalog file(s)"
      )

      %{"items" => items, "mtime" => newest_mtime, "source" => Enum.join(files, ", ")}
    end
  end

  # JavaScript source: svGetSoftwareDownloads()
  def get_software_downloads do
    read_software_json_catalog()["items"]
  rescue
    error ->
      IO.puts(
        :stderr,
        "ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Software catalog unavailable: #{Exception.message(error)}"
      )

      []
  end

  # JavaScript source: server.js lines 10841-10857, GET /api/downloads
  def route_downloads(conn) do
    query = conn.query_params["q"] |> to_string() |> String.trim() |> String.downcase()

    limit =
      conn.query_params["limit"] ||
        "50000"
        |> StreamVault.JS.parse_int()
        |> js_number_default(50_000)
        |> max(1)
        |> min(50_000)

    page =
      conn.query_params["page"] ||
        "0" |> StreamVault.JS.parse_int() |> js_number_default(0) |> max(0)

    items = get_software_downloads()

    items =
      if query == "" do
        items
      else
        terms = String.split(query, ~r/\s+/, trim: true)

        Enum.filter(items, fn item ->
          text =
            join_truthy([
              item["name"],
              item["filename"],
              item["category"],
              item["platform"],
              item["extension"]
            ])
            |> String.downcase()

          Enum.all?(terms, &String.contains?(text, &1))
        end)
      end

    total = length(items)
    start = page * limit

    conn
    |> Plug.Conn.put_resp_header("cache-control", "no-store")
    |> StreamVault.Response.json(%{
      "items" => Enum.slice(items, start, limit),
      "total" => total,
      "page" => page,
      "pages" => max(1, ceil(total / limit))
    })
  end

  # JavaScript source: server.js lines 10859-10865, GET /api/downloads/debug
  def route_downloads_debug(conn) do
    files =
      Enum.map(find_software_catalog_files(), fn file ->
        case File.stat(file) do
          {:ok, stat} -> %{"file" => file, "size" => stat.size}
          _ -> %{"file" => file, "size" => 0}
        end
      end)

    items = get_software_downloads()

    StreamVault.Response.json(conn, %{
      "files" => files,
      "total" => length(items),
      "sample" => Enum.take(items, 3)
    })
  end

  # JavaScript source: server.js lines 10867-10873, GET /download/:id
  def route_download(conn, id) do
    _ = get_software_downloads()

    case StreamVault.State.get(:software_by_id, %{})[to_string(id || "")] do
      %{"source" => source} when source not in [nil, ""] ->
        StreamVault.Response.redirect(conn, source)

      _ ->
        StreamVault.Response.text(conn, "Download not found", 404)
    end
  end

  # JavaScript source: server.js lines 10875-10909, GET /api/trending
  def route_trending(conn) do
    cached = StreamVault.State.get(:trending_cache)
    cached_at = StreamVault.State.get(:trending_cache_time, 0)

    if cached && StreamVault.JS.date_now() - cached_at < 3_600_000 do
      StreamVault.Response.json(conn, cached)
    else
      try do
        movie_task =
          Task.async(fn ->
            StreamVault.Content.tmdb_get("/trending/movie/week?language=en-US")
          end)

        series_task =
          Task.async(fn -> StreamVault.Content.tmdb_get("/trending/tv/week?language=en-US") end)

        movies = Task.await(movie_task, 30_000)
        series = Task.await(series_task, 30_000)

        movie_items =
          Enum.map(movies["results"] || [], &map_trending_movie/1)
          |> Enum.reject(&StreamVault.Core.is_cartoon_or_anime/1)

        series_items =
          Enum.map(series["results"] || [], &map_trending_series/1)
          |> Enum.reject(&StreamVault.Core.is_cartoon_or_anime/1)

        payload = %{"movies" => movie_items, "series" => series_items}
        StreamVault.State.put(:trending_cache, payload)
        StreamVault.State.put(:trending_cache_time, StreamVault.JS.date_now())
        StreamVault.Response.json(conn, payload)
      rescue
        _ -> StreamVault.Response.json(conn, %{"movies" => [], "series" => []})
      end
    end
  end

  defp map_trending_movie(item) do
    %{
      "id" => "tmdb_#{item["id"]}",
      "name" => item["title"],
      "isTrending" => true,
      "poster" => image(item["poster_path"], "w500"),
      "backdrop" => image(item["backdrop_path"], "w1280"),
      "overview" => item["overview"] || "",
      "year" => String.slice(item["release_date"] || "", 0, 4),
      "rating" => rating(item["vote_average"]),
      "genre" => genres(item["genre_ids"]),
      "language" => item["original_language"] || "",
      "type" => "movie",
      "streamUrl" => nil,
      "isFtp" => false
    }
  end

  defp map_trending_series(item) do
    %{
      "id" => "tmdb_tv_#{item["id"]}",
      "name" => item["name"],
      "isTrending" => true,
      "poster" => image(item["poster_path"], "w500"),
      "backdrop" => image(item["backdrop_path"], "w1280"),
      "overview" => item["overview"] || "",
      "year" => String.slice(item["first_air_date"] || "", 0, 4),
      "rating" => rating(item["vote_average"]),
      "genre" => genres(item["genre_ids"]),
      "language" => item["original_language"] || "",
      "type" => "tv",
      "seasons" => %{}
    }
  end

  defp image(nil, _size), do: nil
  defp image(path, size), do: "https://image.tmdb.org/t/p/#{size}#{path}"

  defp rating(value) when is_number(value) and value != 0,
    do: :erlang.float_to_binary(value * 1.0, decimals: 1)

  defp rating(_), do: nil

  defp genres(ids),
    do:
      ids
      |> StreamVault.JS.array()
      |> Enum.take(3)
      |> Enum.map(&@genre_ids[&1])
      |> Enum.reject(&is_nil/1)
      |> Enum.join(", ")

  defp walk_catalogs(_directory, depth, files, seen) when depth > 3, do: {files, seen}

  defp walk_catalogs(directory, depth, files, seen) do
    case File.ls(directory) do
      {:ok, entries} ->
        Enum.reduce(entries, {files, seen}, fn name, {files, seen} ->
          if name in ["node_modules", ".git", "cache", "scan-output", "poster-cache"] do
            {files, seen}
          else
            full = Path.join(directory, name)

            cond do
              File.dir?(full) ->
                walk_catalogs(full, depth + 1, files, seen)

              not Regex.match?(~r/\.json$/i, name) ->
                {files, seen}

              not Regex.match?(~r/(software|download|app|apk|games?)/i, name) ->
                {files, seen}

              true ->
                key = Path.expand(full) |> String.downcase()

                if MapSet.member?(seen, key),
                  do: {files, seen},
                  else: {files ++ [full], MapSet.put(seen, key)}
            end
          end
        end)

      _ ->
        {files, seen}
    end
  end

  defp join_truthy(values),
    do:
      values |> Enum.filter(&StreamVault.JS.truthy?/1) |> Enum.map(&to_string/1) |> Enum.join(" ")

  defp js_number_default(:nan, default), do: default
  defp js_number_default(0, default) when default != 0, do: default
  defp js_number_default(value, _default), do: trunc(value)
end

defmodule StreamVault.Tracker do
  @moduledoc false
  use GenServer

  @sessions_file Path.join(StreamVault.Paths.logs(), "sessions.json")
  @streams_file Path.join(StreamVault.Paths.logs(), "streams.json")
  @events_file Path.join(StreamVault.Paths.logs(), "watch-events.json")
  @errors_file Path.join(StreamVault.Paths.logs(), "errors.json")
  @perf_file Path.join(StreamVault.Paths.logs(), "perf.json")

  def start_link(_options), do: GenServer.start_link(__MODULE__, %{}, name: __MODULE__)

  # JavaScript source: loadJSON(file, fallback)
  def load_json(file, fallback), do: StreamVault.Files.read_json(file, fallback)

  # JavaScript source: purgeStaleSessions()
  def purge_stale_sessions do
    GenServer.call(__MODULE__, :purge_stale_sessions)
  end

  # JavaScript source: maskIp(ip)
  def mask_ip(ip) when ip in [nil, ""], do: "unknown"

  def mask_ip(ip) do
    ip = Regex.replace(~r/^::ffff:/, to_string(ip), "")
    parts = String.split(ip, ".")

    if length(parts) == 4 do
      Enum.take(parts, 3) |> Enum.join(".") |> Kernel.<>(".xxx")
    else
      keep = max(0, String.length(ip) - 4)
      String.slice(ip, 0, keep) <> "xxxx"
    end
  end

  # JavaScript source: persist()
  def persist, do: GenServer.call(__MODULE__, :persist, :infinity)

  # JavaScript source: requestMiddleware(req, res, next)
  def request_middleware(conn) do
    started = StreamVault.JS.date_now()
    ip = request_ip(conn)
    ua = Plug.Conn.get_req_header(conn, "user-agent") |> List.first() || ""
    route = conn.request_path
    GenServer.call(__MODULE__, {:request, ip, ua})

    Plug.Conn.register_before_send(conn, fn conn ->
      GenServer.cast(__MODULE__, {:finished, started, route, conn.status || 200, ip, ua})
      conn
    end)
  end

  # JavaScript source: detectDevice(ua)
  def detect_device(ua) do
    cond do
      Regex.match?(~r/iPhone|iPad|iPod/i, ua) -> "iOS"
      Regex.match?(~r/Android/i, ua) -> "Android"
      Regex.match?(~r/Windows/i, ua) -> "Windows"
      Regex.match?(~r/Macintosh|Mac OS/i, ua) -> "macOS"
      Regex.match?(~r/Linux/i, ua) -> "Linux"
      true -> "Unknown"
    end
  end

  # JavaScript source: trackStreamStart(ip, streamId, name, type, ua)
  def track_stream_start(ip, stream_id, name, type, ua) do
    GenServer.call(__MODULE__, {:stream_start, ip, stream_id, name, type, ua})
  end

  # JavaScript source: trackStreamEnd(key, ip)
  def track_stream_end(key, ip), do: GenServer.call(__MODULE__, {:stream_end, key, ip})

  # JavaScript source: getStats()
  def get_stats, do: GenServer.call(__MODULE__, :get_stats, :infinity)

  # JavaScript source: formatUptime(sec)
  def format_uptime(sec) do
    days = div(sec, 86_400)
    hours = div(rem(sec, 86_400), 3_600)
    minutes = div(rem(sec, 3_600), 60)

    cond do
      days > 0 -> "#{days}d #{hours}h #{minutes}m"
      hours > 0 -> "#{hours}h #{minutes}m"
      true -> "#{minutes}m #{rem(sec, 60)}s"
    end
  end

  @impl true
  def init(_) do
    File.mkdir_p(StreamVault.Paths.logs())
    events = load_json(@events_file, [])

    content_stats =
      Enum.reduce(events, %{}, fn event, stats ->
        name = event["name"]
        timestamp = event["ts"]

        Map.update(
          stats,
          name,
          %{"count" => 1, "lastWatched" => timestamp, "type" => event["type"]},
          fn current ->
            current
            |> Map.update("count", 1, &(&1 + 1))
            |> Map.put("lastWatched", max(timestamp || 0, current["lastWatched"] || 0))
          end
        )
      end)

    state = %{
      sessions: load_json(@sessions_file, %{}),
      active_streams: load_json(@streams_file, %{}),
      perf_samples: load_json(@perf_file, []),
      error_log: load_json(@errors_file, []),
      content_stats: content_stats,
      started_mono: System.monotonic_time(:second)
    }

    Process.send_after(self(), :persist_tick, 10_000)
    {:ok, state}
  end

  @impl true
  def handle_call(:purge_stale_sessions, _from, state) do
    state = purge_state(state)
    {:reply, :ok, state}
  end

  def handle_call(:persist, _from, state) do
    state = purge_state(state)
    persist_state(state)
    {:reply, :ok, state}
  end

  def handle_call({:request, ip, ua}, _from, state) do
    now = StreamVault.JS.date_now()

    session =
      Map.get(state.sessions, ip, %{
        "ip" => ip,
        "maskedIp" => mask_ip(ip),
        "firstSeen" => now,
        "lastSeen" => now,
        "ua" => ua,
        "requests" => 0,
        "currentStream" => nil,
        "device" => detect_device(ua)
      })
      |> Map.put("lastSeen", now)
      |> Map.update("requests", 1, &(&1 + 1))

    {:reply, :ok, %{state | sessions: Map.put(state.sessions, ip, session)}}
  end

  def handle_call({:stream_start, ip, stream_id, name, type, ua}, _from, state) do
    now = StreamVault.JS.date_now()
    key = "#{ip}_#{stream_id}_#{now}"

    stream = %{
      "key" => key,
      "ip" => mask_ip(ip),
      "rawIp" => ip,
      "streamId" => stream_id,
      "name" => name,
      "type" => type,
      "startTime" => now,
      "ua" => ua,
      "device" => detect_device(ua)
    }

    sessions =
      if Map.has_key?(state.sessions, ip) do
        put_in(state.sessions, [ip, "currentStream"], %{
          "name" => name,
          "type" => type,
          "since" => now
        })
      else
        state.sessions
      end

    content_stats =
      Map.update(
        state.content_stats,
        name,
        %{"count" => 1, "lastWatched" => now, "type" => type},
        fn current ->
          current |> Map.update("count", 1, &(&1 + 1)) |> Map.put("lastWatched", now)
        end
      )

    event =
      Jason.encode!(%{
        "ts" => now,
        "ip" => mask_ip(ip),
        "streamId" => stream_id,
        "name" => name,
        "type" => type
      }) <> "\n"

    _ = File.write(String.replace(@events_file, ".json", ".ndjson"), event, [:append])

    next = %{
      state
      | sessions: sessions,
        active_streams: Map.put(state.active_streams, key, stream),
        content_stats: content_stats
    }

    {:reply, key, next}
  end

  def handle_call({:stream_end, key, ip}, _from, state) do
    sessions =
      if Map.has_key?(state.sessions, ip),
        do: put_in(state.sessions, [ip, "currentStream"], nil),
        else: state.sessions

    {:reply, :ok,
     %{state | sessions: sessions, active_streams: Map.delete(state.active_streams, key)}}
  end

  def handle_call(:get_stats, _from, state) do
    state = purge_state(state)
    now = StreamVault.JS.date_now()
    five_minutes_ago = now - 5 * 60 * 1_000

    online_users =
      state.sessions |> Map.values() |> Enum.filter(&((&1["lastSeen"] || 0) > five_minutes_ago))

    streams = Map.values(state.active_streams)
    recent = Enum.take(state.perf_samples, -50)

    average =
      if recent == [] do
        0
      else
        recent |> Enum.reduce(0, &((&1["ms"] || 0) + &2)) |> Kernel./(length(recent)) |> round()
      end

    recent_errors = Enum.filter(state.error_log, &((&1["ts"] || 0) > now - 3_600_000))

    top_content =
      state.content_stats
      |> Enum.sort_by(fn {_name, data} -> -(data["count"] || 0) end)
      |> Enum.take(20)
      |> Enum.map(fn {name, data} -> Map.put(data, "name", name) end)

    watch_events = read_watch_events()
    day_ago = now - 86_400_000

    hourly =
      Enum.reduce(watch_events, List.duplicate(0, 24), fn event, hours ->
        if (event["ts"] || 0) > day_ago do
          hour = local_hour(event["ts"])
          List.update_at(hours, hour, &(&1 + 1))
        else
          hours
        end
      end)

    uptime = max(0, System.monotonic_time(:second) - state.started_mono)
    memory = :erlang.memory()

    payload = %{
      "ts" => now,
      "uptime" => uptime,
      "uptimeStr" => format_uptime(uptime),
      "memory" => %{
        "rss" => memory[:total],
        "heapTotal" => memory[:processes_used],
        "heapUsed" => memory[:processes],
        "external" => memory[:binary],
        "arrayBuffers" => 0
      },
      "nodeVersion" => "v#{System.otp_release()}",
      "activeUsers" => length(online_users),
      "users" => online_users,
      "activeStreams" => streams,
      "streamCount" => length(streams),
      "avgResponseMs" => average,
      "recentPerf" => Enum.take(state.perf_samples, -100),
      "errorCount" => length(recent_errors),
      "recentErrors" => state.error_log |> Enum.take(-50) |> Enum.reverse(),
      "topContent" => top_content,
      "hourlyWatches" => hourly,
      "totalWatches" => length(watch_events)
    }

    {:reply, payload, state}
  end

  @impl true
  def handle_cast({:finished, started, route, status, ip, ua}, state) do
    elapsed = StreamVault.JS.date_now() - started

    perf_samples =
      if Regex.match?(~r/\.(css|js|png|jpg|ico|woff|woff2)$/, route) do
        state.perf_samples
      else
        capped_append(
          state.perf_samples,
          %{
            "ts" => StreamVault.JS.date_now(),
            "route" => route,
            "ms" => elapsed,
            "status" => status
          },
          200
        )
      end

    error_log =
      if status >= 400 do
        capped_append(
          state.error_log,
          %{
            "ts" => StreamVault.JS.date_now(),
            "route" => route,
            "status" => status,
            "ip" => mask_ip(ip),
            "ua" => ua
          },
          500
        )
      else
        state.error_log
      end

    {:noreply, %{state | perf_samples: perf_samples, error_log: error_log}}
  end

  @impl true
  def handle_info(:persist_tick, state) do
    state = purge_state(state)
    persist_state(state)
    Process.send_after(self(), :persist_tick, 10_000)
    {:noreply, state}
  end

  defp purge_state(state) do
    cutoff = StreamVault.JS.date_now() - 5 * 60 * 1_000

    sessions =
      Map.reject(state.sessions, fn {_ip, session} -> (session["lastSeen"] || 0) < cutoff end)

    %{state | sessions: sessions}
  end

  defp persist_state(state) do
    _ = StreamVault.Files.write_json(@sessions_file, state.sessions)
    _ = StreamVault.Files.write_json(@streams_file, state.active_streams)
    _ = StreamVault.Files.write_json(@perf_file, Enum.take(state.perf_samples, -200))
    _ = StreamVault.Files.write_json(@errors_file, Enum.take(state.error_log, -500))
  end

  defp capped_append(values, value, limit), do: values |> Kernel.++([value]) |> Enum.take(-limit)

  defp request_ip(conn) do
    forwarded = Plug.Conn.get_req_header(conn, "x-forwarded-for") |> List.first()

    raw =
      forwarded ||
        case Plug.Conn.get_peer_data(conn) do
          %{address: address} -> address |> :inet.ntoa() |> to_string()
          _ -> ""
        end

    raw |> String.split(",") |> List.first() |> String.trim()
  end

  defp read_watch_events do
    file = String.replace(@events_file, ".json", ".ndjson")

    with true <- File.exists?(file),
         {:ok, body} <- File.read(file) do
      body
      |> String.trim()
      |> String.split("\n", trim: true)
      |> Enum.flat_map(fn line ->
        case Jason.decode(line) do
          {:ok, event} -> [event]
          _ -> []
        end
      end)
    else
      _ -> []
    end
  rescue
    _ -> []
  end

  defp local_hour(milliseconds) do
    {{_year, _month, _day}, {hour, _minute, _second}} =
      :calendar.system_time_to_local_time(milliseconds, :millisecond)

    hour
  rescue
    _ -> 0
  end
end

defmodule StreamVault.Dashboard do
  @moduledoc false

  # JavaScript source: routes/dashboard.js lines 16-22, router.use dashboard CORS
  def cors(conn) do
    conn
    |> Plug.Conn.put_resp_header("access-control-allow-origin", "https://streamvault.fit")
    |> Plug.Conn.put_resp_header("access-control-allow-methods", "GET, OPTIONS")
    |> Plug.Conn.put_resp_header("access-control-allow-headers", "Content-Type, X-Dashboard-Key")
  end

  # JavaScript source: routes/dashboard.js lines 25-37, GET /api/dashboard/ping
  def route_ping(conn) do
    memory = :erlang.memory()
    {load_one, load_five, load_fifteen} = load_average()

    StreamVault.Response.json(conn, %{
      "ok" => true,
      "ts" => StreamVault.JS.date_now(),
      "uptime" => :erlang.statistics(:wall_clock) |> elem(0) |> div(1_000),
      "nodeVersion" => "v#{System.otp_release()}",
      "memory" => %{
        "rss" => memory[:total],
        "heapTotal" => memory[:processes_used],
        "heapUsed" => memory[:processes],
        "external" => memory[:binary],
        "arrayBuffers" => 0
      },
      "loadAvg" => [load_one, load_five, load_fifteen],
      "freemem" => free_memory(),
      "totalmem" => total_memory()
    })
  end

  # JavaScript source: routes/dashboard.js lines 40-48, GET /api/dashboard/stats
  def route_stats(conn) do
    StreamVault.Response.json(conn, StreamVault.Tracker.get_stats())
  rescue
    error ->
      IO.puts(:stderr, "[Dashboard] Stats error: #{Exception.message(error)}")

      StreamVault.Response.json(
        conn,
        %{"error" => "Stats unavailable", "msg" => Exception.message(error)},
        500
      )
  end

  defp load_average do
    case :cpu_sup.avg1() do
      value when is_integer(value) -> {value / 256, :cpu_sup.avg5() / 256, :cpu_sup.avg15() / 256}
      _ -> {0.0, 0.0, 0.0}
    end
  rescue
    _ -> {0.0, 0.0, 0.0}
  end

  defp free_memory do
    case :memsup.get_system_memory_data() do
      values when is_list(values) -> Keyword.get(values, :free_memory, 0)
      _ -> 0
    end
  rescue
    _ -> 0
  end

  defp total_memory do
    case :memsup.get_system_memory_data() do
      values when is_list(values) -> Keyword.get(values, :total_memory, 0)
      _ -> 0
    end
  rescue
    _ -> 0
  end
end

defmodule StreamVault.InfraTelemetry do
  @moduledoc false
  use GenServer

  @max_events 500
  @route_nodes [
    {~r/^\/api\/home-feed(?:\/|$)/, "home-feed-service"},
    {~r/^\/api\/section(?:\/|$)/, "section-service"},
    {~r/^\/api\/movies(?:\/|$)/, "catalog-service"},
    {~r/^\/api\/series(?:\/|$)/, "series-catalog"},
    {~r/^\/api\/search(?:\/|$)/, "search-service"},
    {~r/^\/api\/details(?:\/|$)/, "metadata-service"},
    {~r/^\/api\/title-details(?:\/|$)/, "metadata-service"},
    {~r/^\/api\/media-info(?:\/|$)/, "media-info-service"},
    {~r/^\/api\/duration(?:\/|$)/, "media-info-service"},
    {~r/^\/api\/subtitles(?:\/|$)/, "subtitle-service"},
    {~r/^\/subtitles(?:\/|$)/, "subtitle-service"},
    {~r/^\/api\/playback\/local(?:\/|$)/, "local-playback-service"},
    {~r/^\/stream(?:\/|$)/, "media-stream-router"},
    {~r/^\/api\/stream-seek(?:\/|$)/, "seek-service"},
    {~r/^\/live(?:\/|$)/, "stream-manager"},
    {~r/^\/live-relay(?:\/|$)/, "live-relay-service"},
    {~r/^\/api\/live-relay(?:\/|$)/, "live-relay-service"},
    {~r/^\/api\/mobile-hls(?:\/|$)/, "mobile-hls-transcoder"},
    {~r/^\/api\/playback\/ftp(?:\/|$)/, "ftp-playback-router"},
    {~r/^\/api\/ftp\/stream(?:\/|$)/, "ftp-transcoder"},
    {~r/^\/api\/ftp\/proxy(?:\/|$)/, "ftp-proxy"},
    {~r/^\/api\/ftp\/(?:media-info|info)(?:\/|$)/, "ftp-media-info"},
    {~r/^\/poster-cache(?:\/|$)/, "poster-cache"},
    {~r/^\/api\/channels(?:\/|$)/, "channel-catalog"},
    {~r/^\/api\/downloads(?:\/|$)/, "downloads-service"},
    {~r/^\/(?:api\/)?uploads?(?:\/|$)/, "upload-pipeline"},
    {~r/^\/api\/trending(?:\/|$)/, "tmdb-trending-service"},
    {~r/^\/party(?:\/|$)/, "watch-party-service"},
    {~r/^\/api(?:\/|$)/, "api-gateway"}
  ]

  def start_link(options \\ []), do: GenServer.start_link(__MODULE__, options, name: __MODULE__)

  # JavaScript source: nodeForPath(pathname)
  def node_for_path(pathname) do
    case Enum.find(@route_nodes, fn {pattern, _node} -> Regex.match?(pattern, pathname) end) do
      {_pattern, node} -> node
      nil -> "streamvault-core"
    end
  end

  # JavaScript source: requestKind(pathname)
  def request_kind(pathname) do
    cond do
      Regex.match?(~r/^\/api\/(?:playback\/ftp|ftp\/(?:stream|proxy))(?:\/|$)/, pathname) ->
        "ftp"

      Regex.match?(~r/^\/(?:live|live-relay)(?:\/|$)/, pathname) ->
        "live"

      Regex.match?(~r/^\/(?:stream)(?:\/|$)/, pathname) or
          Regex.match?(
            ~r/^\/api\/(?:playback\/local\/[^\/]+\/stream|mobile-hls)(?:\/|$)/,
            pathname
          ) ->
        "stream"

      true ->
        nil
    end
  end

  # JavaScript source: requestPath(req)
  def request_path(conn),
    do:
      conn.request_path
      |> to_string()
      |> String.split("?")
      |> List.first()
      |> String.slice(0, 512)

  # JavaScript source: clientIp(req)
  def client_ip(conn) do
    forwarded = Plug.Conn.get_req_header(conn, "x-forwarded-for") |> List.first()

    value =
      forwarded ||
        case Plug.Conn.get_peer_data(conn) do
          %{address: address} -> address |> :inet.ntoa() |> to_string()
          _ -> ""
        end

    value
    |> to_string()
    |> String.split(",")
    |> List.first()
    |> String.trim()
    |> String.slice(0, 80)
  end

  # JavaScript source: isLocalAddress(value)
  def local_address?(value),
    do: Regex.replace(~r/^::ffff:/, to_string(value || ""), "") in ["127.0.0.1", "::1"]

  # JavaScript source: safeMessage(value)
  def safe_message(value) do
    if(StreamVault.JS.truthy?(value), do: to_string(value), else: "Unknown error")
    |> then(&Regex.replace(~r/[A-Za-z]:\\(?:[^\\\s]+\\)*[^\s]*/, &1, "[path]"))
    |> then(&Regex.replace(~r/(^|\s)\/(?:[^\/\s]+\/)+[^\s]*/, &1, "\\1[path]"))
    |> then(
      &Regex.replace(
        ~r/\b(SV_INFRA_RELAY_TOKEN|SV_INFRA_TOKEN)\s*[=:]\s*\S+/i,
        &1,
        "\\1=[redacted]"
      )
    )
    |> String.slice(0, 500)
  end

  # JavaScript source: finite(value, fallback = null)
  def finite(value, fallback \\ nil) do
    case StreamVault.JS.number(value) do
      number when is_number(number) -> number
      _ -> fallback
    end
  end

  # JavaScript source: createInfraTelemetry({ app, server, nodeName = os.hostname(), serviceName = 'StreamVault' } = {})
  def create_infra_telemetry(options \\ []), do: options

  # JavaScript source: updateCpuAndRam()
  def update_cpu_and_ram, do: GenServer.cast(__MODULE__, :update_cpu_and_ram)

  # JavaScript source: metrics()
  def metrics, do: GenServer.call(__MODULE__, :metrics)

  # JavaScript source: normalizeEvent(meta = {})
  def normalize_event(meta \\ %{}), do: GenServer.call(__MODULE__, {:normalize_event, meta})

  # JavaScript source: sendRelay(payload)
  def send_relay(payload) do
    case Process.whereis(StreamVault.InfraRelay) do
      nil -> :ok
      pid -> send(pid, {:relay_payload, payload})
    end
  end

  # JavaScript source: emit(meta = {})
  def emit(meta \\ %{}), do: GenServer.call(__MODULE__, {:emit, meta})

  # JavaScript source: beginSession(type, meta = {})
  def begin_session(type, meta \\ %{}),
    do: GenServer.call(__MODULE__, {:begin_session, type, meta})

  # JavaScript source: endSession(type, meta = {})
  def end_session(type, meta \\ %{}), do: GenServer.call(__MODULE__, {:end_session, type, meta})

  # JavaScript source: streamStart(meta = {})
  def stream_start(meta \\ %{}),
    do:
      begin_session(
        if(meta["eventType"] == "live" or meta[:eventType] == "live", do: "live", else: "stream"),
        meta
      )

  # JavaScript source: streamEnd(meta = {})
  def stream_end(meta \\ %{}),
    do:
      end_session(
        if(meta["eventType"] == "live" or meta[:eventType] == "live", do: "live", else: "stream"),
        meta
      )

  # JavaScript source: ftpStart(meta = {})
  def ftp_start(meta \\ %{}), do: begin_session("ftp", meta)

  # JavaScript source: ftpEnd(meta = {})
  def ftp_end(meta \\ %{}), do: end_session("ftp", meta)

  # JavaScript source: cacheHit(meta = {})
  def cache_hit(meta \\ %{}),
    do:
      emit(
        meta
        |> stringify_meta()
        |> Map.put("eventType", "cache")
        |> Map.put("severity", "info")
        |> Map.put_new("message", "cache_hit")
      )

  # JavaScript source: cacheMiss(meta = {})
  def cache_miss(meta \\ %{}),
    do:
      emit(
        meta
        |> stringify_meta()
        |> Map.put("eventType", "cache")
        |> Map.put("severity", "info")
        |> Map.put_new("message", "cache_miss")
      )

  # JavaScript source: error(meta = {})
  def error(meta \\ %{}), do: GenServer.call(__MODULE__, {:error, meta})

  # JavaScript source: requestMiddleware(req, res, next)
  def request_middleware(conn) do
    started = System.monotonic_time(:microsecond)
    pathname = request_path(conn)
    node_id = node_for_path(pathname)
    kind = request_kind(pathname)

    common = %{
      "nodeId" => node_id,
      "sourceNodeId" => "api-gateway",
      "targetNodeId" => node_id,
      "path" => pathname,
      "method" => conn.method,
      "userAgent" => Plug.Conn.get_req_header(conn, "user-agent") |> List.first() || "",
      "ip" => client_ip(conn),
      "timestamp" => StreamVault.JS.date_now()
    }

    GenServer.call(__MODULE__, {:request_begin, kind, common})
    conn = Plug.Conn.assign(conn, :infra_node_id, node_id)

    Plug.Conn.register_before_send(conn, fn conn ->
      latency = Float.round((System.monotonic_time(:microsecond) - started) / 1_000, 1)

      content_length =
        Plug.Conn.get_resp_header(conn, "content-length") |> List.first() |> finite()

      GenServer.cast(
        __MODULE__,
        {:request_complete, kind, common, conn.status || 0, latency, content_length,
         Plug.Conn.get_resp_header(conn, "x-sv-live-cache") |> List.first()}
      )

      conn
    end)
  end

  # JavaScript source: snapshot()
  def snapshot, do: GenServer.call(__MODULE__, :snapshot)

  # JavaScript source: nodeUpdate(nodeId, timestamp = Date.now())
  def node_update(node_id, timestamp \\ StreamVault.JS.date_now()),
    do: GenServer.call(__MODULE__, {:node_update, node_id, timestamp})

  # JavaScript source: broadcastNodeUpdates(timestamp = Date.now())
  def broadcast_node_updates(timestamp \\ StreamVault.JS.date_now()),
    do: GenServer.cast(__MODULE__, {:broadcast_node_updates, timestamp})

  # JavaScript source: authorized(req)
  def authorized?(conn) do
    token = System.get_env("SV_INFRA_TOKEN")

    cond do
      token in [nil, ""] ->
        true

      System.get_env("NODE_ENV") != "production" and local_address?(client_ip(conn)) ->
        true

      true ->
        supplied = Plug.Conn.get_req_header(conn, "authorization") |> List.first() || ""
        supplied = Regex.replace(~r/^Bearer\s+/i, supplied, "")
        byte_size(token) == byte_size(supplied) and :crypto.hash_equals(token, supplied)
    end
  end

  # JavaScript source: attachWebSocket(httpServer)
  def attach_web_socket(_http_server), do: StreamVault.InfraSocket

  # JavaScript source: recordNetworkTotals(received, sent)
  def record_network_totals(received, sent),
    do: GenServer.cast(__MODULE__, {:network_totals, received, sent})

  # JavaScript source: parseDarwinNetwork(output)
  def parse_darwin_network(output) do
    rows =
      output
      |> to_string()
      |> String.trim()
      |> String.split(~r/\r?\n/)
      |> Enum.map(&String.split(String.trim(&1), ~r/\s+/))

    header =
      Enum.find(rows, fn parts ->
        List.first(parts) == "Name" and "Ibytes" in parts and "Obytes" in parts
      end)

    if is_nil(header), do: raise("Network counter columns unavailable")
    start_index = Enum.find_index(rows, &(&1 == header)) + 1
    name_index = Enum.find_index(header, &(&1 == "Name"))
    in_index = Enum.find_index(header, &(&1 == "Ibytes"))
    out_index = Enum.find_index(header, &(&1 == "Obytes"))

    interfaces =
      rows
      |> Enum.drop(start_index)
      |> Enum.reduce(%{}, fn parts, values ->
        name = Enum.at(parts, name_index)
        received = finite(Enum.at(parts, in_index))
        sent = finite(Enum.at(parts, out_index))

        if name in [nil, "lo0"] or is_nil(received) or is_nil(sent) do
          values
        else
          previous = Map.get(values, name, %{received: 0, sent: 0})

          Map.put(values, name, %{
            received: max(previous.received, received),
            sent: max(previous.sent, sent)
          })
        end
      end)

    Enum.reduce(Map.values(interfaces), %{received: 0, sent: 0}, fn value, total ->
      %{received: total.received + value.received, sent: total.sent + value.sent}
    end)
  end

  # JavaScript source: probeNetwork()
  def probe_network do
    Task.start(fn ->
      result =
        case :os.type() do
          {:unix, :linux} -> probe_linux_network()
          {:win32, _} -> probe_windows_network()
          _ -> probe_darwin_network()
        end

      case result do
        {:ok, received, sent} -> record_network_totals(received, sent)
        _ -> GenServer.cast(__MODULE__, :network_unavailable)
      end
    end)
  end

  # JavaScript source: probeDisk()
  def probe_disk do
    Task.start(fn ->
      value =
        case :os.type() do
          {:win32, _} ->
            command =
              "$d=Get-CimInstance Win32_LogicalDisk -ErrorAction Stop|Where-Object {$_.DeviceID -eq $env:SystemDrive}|Select-Object -First 1; if($d.Size -gt 0){[math]::Round((($d.Size-$d.FreeSpace)/$d.Size)*100,1)}"

            case System.cmd(
                   "powershell.exe",
                   ["-NoProfile", "-NonInteractive", "-Command", command], stderr_to_stdout: true) do
              {body, 0} -> finite(String.trim(body))
              _ -> nil
            end

          _ ->
            case System.cmd("df", ["-k", "/"], stderr_to_stdout: true) do
              {body, 0} ->
                case Regex.run(~r/\b(\d+(?:\.\d+)?)%/, body) do
                  [_, percent] -> finite(percent)
                  _ -> nil
                end

              _ ->
                nil
            end
        end

      GenServer.cast(
        __MODULE__,
        {:disk,
         if(is_number(value), do: Float.round(max(0.0, min(100.0, value * 1.0)), 1), else: nil)}
      )
    end)
  end

  # JavaScript source: connectRelay()
  def connect_relay do
    case Process.whereis(StreamVault.InfraRelay) do
      nil -> :ok
      pid -> send(pid, :connect)
    end
  end

  def events, do: GenServer.call(__MODULE__, :events)
  def nodes, do: GenServer.call(__MODULE__, :nodes)
  def websocket_connected(pid), do: GenServer.call(__MODULE__, {:websocket_connected, pid})
  def websocket_disconnected(pid), do: GenServer.cast(__MODULE__, {:websocket_disconnected, pid})
  def report_fatal(message), do: GenServer.cast(__MODULE__, {:fatal_error, message})

  @impl true
  def init(options) do
    started_at = StreamVault.JS.date_now()
    node_name = Keyword.get(options, :node_name, "mac-mini-streamvault")
    service_name = Keyword.get(options, :service_name, "StreamVault")

    node_ids =
      @route_nodes |> Enum.map(&elem(&1, 1)) |> Kernel.++(["streamvault-core"]) |> Enum.uniq()

    activity =
      Map.new(node_ids, fn id -> {id, %{"nodeId" => id, "eventCount" => 0, "lastSeen" => nil}} end)

    state = %{
      started_at: started_at,
      node_name: node_name,
      service_name: service_name,
      events: [],
      node_activity: activity,
      clients: MapSet.new(),
      active_http_requests: 0,
      active_streams: 0,
      active_ftp_transfers: 0,
      active_live_tv_sessions: 0,
      total_requests: 0,
      error_count: 0,
      total_latency_ms: 0,
      completed_requests: 0,
      cpu: 0,
      ram: 0,
      net_in_mbps: nil,
      net_out_mbps: nil,
      disk: nil,
      previous_network: nil,
      last_system_event: nil
    }

    state = update_system_metrics(state)
    Process.send_after(self(), :system_tick, 1_000)
    send(self(), :network_tick)
    send(self(), :disk_tick)
    {:ok, state}
  end

  @impl true
  def handle_call(:metrics, _from, state), do: {:reply, metrics_from_state(state), state}
  def handle_call(:snapshot, _from, state), do: {:reply, snapshot_from_state(state), state}
  def handle_call(:events, _from, state), do: {:reply, state.events, state}
  def handle_call(:nodes, _from, state), do: {:reply, Map.values(state.node_activity), state}

  def handle_call({:normalize_event, meta}, _from, state),
    do: {:reply, normalize_event_from_state(meta, state), state}

  def handle_call({:emit, meta}, _from, state) do
    {event, state} = emit_state(meta, state)
    {:reply, event, state}
  end

  def handle_call({:error, meta}, _from, state) do
    meta =
      meta
      |> stringify_meta()
      |> Map.put("eventType", "error")
      |> Map.put("severity", "error")
      |> Map.update("message", "Unknown error", &safe_message/1)

    {event, state} = emit_state(meta, %{state | error_count: state.error_count + 1})
    {:reply, event, state}
  end

  def handle_call({:begin_session, type, meta}, _from, state) do
    state = increment_session(state, type, 1)

    {event, state} =
      emit_state(
        meta |> stringify_meta() |> Map.put("eventType", type) |> Map.put("severity", "info"),
        state
      )

    {:reply, event, state}
  end

  def handle_call({:end_session, type, meta}, _from, state) do
    state = increment_session(state, type, -1)
    status = finite(meta["statusCode"] || meta[:statusCode], 200)

    {event, state} =
      emit_state(
        meta
        |> stringify_meta()
        |> Map.put("eventType", type)
        |> Map.put("severity", if(status >= 500, do: "error", else: "info")),
        state
      )

    {:reply, event, state}
  end

  def handle_call({:request_begin, kind, common}, _from, state) do
    state = %{
      state
      | active_http_requests: state.active_http_requests + 1,
        total_requests: state.total_requests + 1
    }

    state =
      case kind do
        "ftp" ->
          state |> increment_session("ftp", 1) |> elem_emit(Map.put(common, "eventType", "ftp"))

        value when value in ["live", "stream"] ->
          state |> increment_session(value, 1) |> elem_emit(Map.put(common, "eventType", value))

        _ ->
          state
      end

    {:reply, :ok, state}
  end

  def handle_call({:node_update, node_id, timestamp}, _from, state),
    do: {:reply, node_update_from_state(node_id, timestamp, state), state}

  def handle_call({:websocket_connected, pid}, _from, state) do
    Process.monitor(pid)
    state = %{state | clients: MapSet.put(state.clients, pid)}

    {_event, state} =
      emit_state(
        %{
          "eventType" => "websocket",
          "nodeId" => "streamvault-core",
          "message" => "dashboard_connected"
        },
        state
      )

    updates =
      Enum.map(
        Map.keys(state.node_activity),
        &node_update_from_state(&1, StreamVault.JS.date_now(), state)
      )

    Enum.each(updates, &send(pid, {:infra_ws, Jason.encode!(&1)}))
    {:reply, :ok, state}
  end

  @impl true
  def handle_cast(:update_cpu_and_ram, state), do: {:noreply, update_system_metrics(state)}

  def handle_cast({:fatal_error, message}, state) do
    meta = %{
      "nodeId" => "streamvault-core",
      "eventType" => "error",
      "severity" => "error",
      "message" => safe_message(message),
      "statusCode" => 500
    }

    {_event, state} = emit_state(meta, %{state | error_count: state.error_count + 1})
    {:noreply, state}
  end

  def handle_cast(:network_unavailable, state),
    do: {:noreply, %{state | net_in_mbps: nil, net_out_mbps: nil}}

  def handle_cast({:disk, value}, state), do: {:noreply, %{state | disk: value}}

  def handle_cast({:network_totals, received, sent}, state) do
    now = StreamVault.JS.date_now()
    received = finite(received)
    sent = finite(sent)

    if is_nil(received) or is_nil(sent) do
      {:noreply, %{state | net_in_mbps: nil, net_out_mbps: nil}}
    else
      current = %{received: received, sent: sent, at: now}

      state =
        case state.previous_network do
          %{at: previous_at} = previous when now > previous_at ->
            seconds = (now - previous_at) / 1_000

            inbound =
              Float.round(max(0.0, (received - previous.received) * 8 / seconds / 1_000_000), 2)

            outbound = Float.round(max(0.0, (sent - previous.sent) * 8 / seconds / 1_000_000), 2)
            %{state | previous_network: current, net_in_mbps: inbound, net_out_mbps: outbound}

          _ ->
            %{state | previous_network: current}
        end

      {:noreply, state}
    end
  end

  def handle_cast({:request_complete, kind, common, status, latency, length, cache}, state) do
    state = %{
      state
      | active_http_requests: max(0, state.active_http_requests - 1),
        completed_requests: state.completed_requests + 1,
        total_latency_ms: state.total_latency_ms + latency,
        error_count: state.error_count + if(status >= 500, do: 1, else: 0)
    }

    finished =
      common
      |> Map.put("statusCode", status)
      |> Map.put("latencyMs", latency)
      |> Map.put("bytesOut", length)

    severity =
      cond do
        status >= 500 -> "error"
        status >= 400 -> "warn"
        true -> "info"
      end

    {_event, state} =
      emit_state(finished |> Map.put("eventType", "http") |> Map.put("severity", severity), state)

    state =
      case kind do
        "ftp" ->
          increment_session(state, "ftp", -1)
          |> elem_emit(finished |> Map.put("eventType", "ftp"))

        value when value in ["live", "stream"] ->
          increment_session(state, value, -1)
          |> elem_emit(finished |> Map.put("eventType", value))

        _ ->
          state
      end

    cache = to_string(cache || "") |> String.upcase()

    state =
      if cache in ["HIT", "DEDUP", "MISS"],
        do:
          elem_emit(
            state,
            finished
            |> Map.put("eventType", "cache")
            |> Map.put("severity", "info")
            |> Map.put("message", if(cache == "MISS", do: "cache_miss", else: "cache_hit"))
          ),
        else: state

    {:noreply, state}
  end

  def handle_cast({:broadcast_node_updates, timestamp}, state) do
    Enum.each(Map.keys(state.node_activity), fn node_id ->
      broadcast(state, node_update_from_state(node_id, timestamp, state))
    end)

    {:noreply, state}
  end

  def handle_cast({:websocket_disconnected, pid}, state) do
    state = %{state | clients: MapSet.delete(state.clients, pid)}

    {_event, state} =
      emit_state(
        %{
          "eventType" => "websocket",
          "nodeId" => "streamvault-core",
          "message" => "dashboard_disconnected"
        },
        state
      )

    {:noreply, state}
  end

  @impl true
  def handle_info(:system_tick, state) do
    state = update_system_metrics(state)

    {event, state} =
      emit_state(
        %{
          "eventType" => "system",
          "nodeId" => "streamvault-core",
          "sourceNodeId" => "streamvault-core",
          "targetNodeId" => "streamvault-core",
          "metrics" => metrics_from_state(state)
        },
        state
      )

    Enum.each(Map.keys(state.node_activity), fn node_id ->
      broadcast(state, node_update_from_state(node_id, event["timestamp"], state))
    end)

    Process.send_after(self(), :system_tick, 1_000)
    {:noreply, %{state | last_system_event: event}}
  end

  def handle_info(:network_tick, state) do
    probe_network()
    Process.send_after(self(), :network_tick, 3_000)
    {:noreply, state}
  end

  def handle_info(:disk_tick, state) do
    probe_disk()
    Process.send_after(self(), :disk_tick, 10_000)
    {:noreply, state}
  end

  def handle_info({:DOWN, _ref, :process, pid, _reason}, state),
    do: {:noreply, %{state | clients: MapSet.delete(state.clients, pid)}}

  defp normalize_event_from_state(meta, state) do
    meta = stringify_meta(meta)

    pathname =
      meta
      |> Map.get("path", "")
      |> to_string()
      |> String.split("?")
      |> List.first()
      |> String.slice(0, 512)

    node_id = meta["nodeId"] || node_for_path(pathname)

    %{
      "kind" => "infra_event",
      "eventType" => meta["eventType"] || "http",
      "nodeId" => node_id,
      "sourceNodeId" => meta["sourceNodeId"] || "api-gateway",
      "targetNodeId" => meta["targetNodeId"] || node_id,
      "severity" => meta["severity"] || "info",
      "timestamp" => finite(meta["timestamp"], StreamVault.JS.date_now()),
      "path" => if(pathname == "", do: nil, else: pathname),
      "method" => slice_optional(meta["method"], 16),
      "statusCode" => finite(meta["statusCode"]),
      "latencyMs" => finite(meta["latencyMs"]),
      "bytesOut" => finite(meta["bytesOut"]),
      "userAgent" => slice_optional(meta["userAgent"], 300),
      "ip" => slice_optional(meta["ip"], 80),
      "message" => if(meta["message"], do: safe_message(meta["message"]), else: nil),
      "metrics" => meta["metrics"] || metrics_from_state(state)
    }
  end

  defp emit_state(meta, state) do
    event = normalize_event_from_state(meta, state)
    events = (state.events ++ [event]) |> Enum.take(-@max_events)

    activity =
      Map.get(state.node_activity, event["nodeId"], %{
        "nodeId" => event["nodeId"],
        "eventCount" => 0,
        "lastSeen" => nil
      })

    activity =
      activity
      |> Map.update("eventCount", 1, &(&1 + 1))
      |> Map.put("lastSeen", event["timestamp"])
      |> Map.put("lastEventType", event["eventType"])
      |> Map.put("lastSeverity", event["severity"])
      |> Map.put("lastSourceNodeId", event["sourceNodeId"])

    activity =
      if event["eventType"] == "http" and is_number(event["latencyMs"]) do
        activity
        |> Map.update("completedRequests", 1, &(&1 + 1))
        |> Map.update("totalLatencyMs", event["latencyMs"], &(&1 + event["latencyMs"]))
      else
        activity
      end

    state = %{
      state
      | events: events,
        node_activity: Map.put(state.node_activity, event["nodeId"], activity)
    }

    broadcast(state, event)
    {event, state}
  end

  defp metrics_from_state(state) do
    memory = :erlang.memory()

    average =
      if state.completed_requests > 0,
        do: Float.round(state.total_latency_ms / state.completed_requests, 1),
        else: 0

    %{
      "uptimeSeconds" => Float.round((StreamVault.JS.date_now() - state.started_at) / 1_000, 1),
      "processRssBytes" => memory[:total],
      "processHeapUsedBytes" => memory[:processes_used],
      "processHeapTotalBytes" => memory[:processes],
      "cpu" => state.cpu,
      "ram" => state.ram,
      "netInMbps" => state.net_in_mbps,
      "netOutMbps" => state.net_out_mbps,
      "disk" => state.disk,
      "activeHttpRequests" => state.active_http_requests,
      "activeStreams" => state.active_streams,
      "activeFtpTransfers" => state.active_ftp_transfers,
      "activeLiveTvSessions" => state.active_live_tv_sessions,
      "wsClients" => MapSet.size(state.clients),
      "totalRequests" => state.total_requests,
      "errorCount" => state.error_count,
      "averageLatencyMs" => average
    }
  end

  defp snapshot_from_state(state) do
    %{
      "ok" => true,
      "nodeName" => state.node_name,
      "serviceName" => state.service_name,
      "timestamp" => StreamVault.JS.date_now(),
      "startedAt" => state.started_at,
      "metrics" => metrics_from_state(state),
      "nodes" => Map.values(state.node_activity),
      "lastSystemEvent" => state.last_system_event
    }
  end

  defp node_update_from_state(node_id, timestamp, state) do
    activity = Map.get(state.node_activity, node_id, %{})
    current = metrics_from_state(state)

    bandwidth =
      if is_nil(current["netInMbps"]) and is_nil(current["netOutMbps"]),
        do: nil,
        else: Float.round((current["netInMbps"] || 0) + (current["netOutMbps"] || 0), 2)

    latency =
      if (activity["completedRequests"] || 0) > 0,
        do: Float.round((activity["totalLatencyMs"] || 0) / activity["completedRequests"], 1),
        else: current["averageLatencyMs"]

    recent_error =
      activity["lastSeverity"] == "error" and timestamp - (activity["lastSeen"] || 0) < 3_000

    recently_active =
      node_id == "streamvault-core" or
        ((activity["lastEventType"] && activity["lastEventType"] != "system") and
           timestamp - (activity["lastSeen"] || 0) < 2_000)

    %{
      "type" => "node_update",
      "nodeId" => node_id,
      "status" => if(recent_error, do: "ERROR", else: "ONLINE"),
      "activity" => !!recently_active,
      "eventType" => activity["lastEventType"] || "system",
      "sourceNodeId" => activity["lastSourceNodeId"] || "streamvault-core",
      "targetNodeId" => node_id,
      "severity" => if(recent_error, do: "error", else: "info"),
      "metrics" => %{
        "cpu" => current["cpu"],
        "ram" => current["ram"],
        "disk" => current["disk"],
        "latency" => latency,
        "bandwidth" => bandwidth,
        "netInMbps" => current["netInMbps"],
        "netOutMbps" => current["netOutMbps"],
        "activeStreams" => current["activeStreams"],
        "ftpTransfers" => current["activeFtpTransfers"],
        "httpRequests" => current["activeHttpRequests"],
        "wsClients" => current["wsClients"],
        "totalRequests" => current["totalRequests"],
        "errorCount" => current["errorCount"],
        "uptimeSeconds" => current["uptimeSeconds"]
      },
      "timestamp" => timestamp
    }
  end

  defp broadcast(state, payload) do
    encoded = Jason.encode!(payload)
    Enum.each(state.clients, &send(&1, {:infra_ws, encoded}))
    send_relay(payload)
  end

  defp increment_session(state, "ftp", delta),
    do: %{state | active_ftp_transfers: max(0, state.active_ftp_transfers + delta)}

  defp increment_session(state, "live", delta),
    do: %{
      state
      | active_streams: max(0, state.active_streams + delta),
        active_live_tv_sessions: max(0, state.active_live_tv_sessions + delta)
    }

  defp increment_session(state, _type, delta),
    do: %{state | active_streams: max(0, state.active_streams + delta)}

  defp elem_emit(state, meta) do
    {_event, state} = emit_state(meta, state)
    state
  end

  defp update_system_metrics(state) do
    cpu =
      try do
        :cpu_sup.util() |> finite(0) |> max(0) |> min(100) |> Kernel.*(1.0) |> Float.round(1)
      rescue
        _ -> 0
      end

    ram =
      try do
        values = :memsup.get_system_memory_data()
        total = Keyword.get(values, :total_memory, 0)
        free = Keyword.get(values, :free_memory, 0)
        if total > 0, do: Float.round((total - free) / total * 100, 1), else: 0
      rescue
        _ -> 0
      end

    %{state | cpu: cpu, ram: ram}
  end

  defp probe_linux_network do
    with {:ok, body} <- File.read("/proc/net/dev") do
      totals =
        body
        |> String.split(~r/\r?\n/)
        |> Enum.filter(&String.contains?(&1, ":"))
        |> Enum.reduce(%{received: 0, sent: 0}, fn line, total ->
          [name, values] = String.split(String.trim(line), ":", parts: 2)
          fields = values |> String.trim() |> String.split(~r/\s+/) |> Enum.map(&finite(&1, 0))

          if String.trim(name) == "lo",
            do: total,
            else: %{
              received: total.received + Enum.at(fields, 0, 0),
              sent: total.sent + Enum.at(fields, 8, 0)
            }
        end)

      {:ok, totals.received, totals.sent}
    end
  end

  defp probe_windows_network do
    command =
      "$s=Get-NetAdapterStatistics -ErrorAction Stop; [pscustomobject]@{received=($s|Measure-Object -Property ReceivedBytes -Sum).Sum;sent=($s|Measure-Object -Property SentBytes -Sum).Sum}|ConvertTo-Json -Compress"

    with {body, 0} <-
           System.cmd("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command],
             stderr_to_stdout: true
           ),
         {:ok, decoded} <- Jason.decode(String.trim(body)) do
      {:ok, finite(decoded["received"], 0), finite(decoded["sent"], 0)}
    else
      _ -> :error
    end
  end

  defp probe_darwin_network do
    with {body, 0} <- System.cmd("netstat", ["-ibn"], stderr_to_stdout: true) do
      totals = parse_darwin_network(body)
      {:ok, totals.received, totals.sent}
    else
      _ -> :error
    end
  end

  defp stringify_meta(meta) when is_map(meta),
    do: Map.new(meta, fn {key, value} -> {to_string(key), value} end)

  defp stringify_meta(_), do: %{}
  defp slice_optional(nil, _length), do: nil
  defp slice_optional(value, length), do: value |> to_string() |> String.slice(0, length)
end

defmodule StreamVault.InfraSocket do
  @moduledoc false
  @behaviour WebSock

  @impl true
  def init(_options) do
    :ok = StreamVault.InfraTelemetry.websocket_connected(self())
    {:ok, %{}}
  end

  @impl true
  def handle_in({_message, _options}, state), do: {:ok, state}

  @impl true
  def handle_info({:infra_ws, payload}, state), do: {:push, {:text, payload}, state}

  @impl true
  def terminate(_reason, _state) do
    StreamVault.InfraTelemetry.websocket_disconnected(self())
    :ok
  end
end

defmodule StreamVault.InfraRelay do
  @moduledoc false
  use WebSockex

  def start_link(_options) do
    case System.get_env("SV_INFRA_RELAY_URL") do
      value when value in [nil, ""] ->
        Task.start_link(fn ->
          receive do
            :stop -> :ok
          end
        end)

      url ->
        headers =
          case System.get_env("SV_INFRA_RELAY_TOKEN") do
            value when value in [nil, ""] -> []
            token -> [{"authorization", "Bearer #{token}"}]
          end

        WebSockex.start_link(url, __MODULE__, %{attempts: 0},
          name: __MODULE__,
          extra_headers: headers,
          handle_initial_conn_failure: true
        )
    end
  end

  @impl true
  def handle_connect(_conn, state) do
    StreamVault.InfraTelemetry.emit(%{
      "eventType" => "websocket",
      "nodeId" => "streamvault-core",
      "message" => "relay_connected"
    })

    {:ok, Map.put(state, :attempts, 0)}
  end

  @impl true
  def handle_info({:relay_payload, payload}, state),
    do: {:reply, {:text, Jason.encode!(payload)}, state}

  def handle_info(:connect, state), do: {:ok, state}
  def handle_info(_message, state), do: {:ok, state}

  @impl true
  def handle_disconnect(_status, state) do
    attempts = Map.get(state, :attempts, 0)
    delay = min(30_000, round(1_000 * :math.pow(2, min(attempts, 5))))
    Process.sleep(delay)
    {:reconnect, Map.put(state, :attempts, attempts + 1)}
  end
end

defmodule StreamVault.WatchParty do
  @moduledoc false
  use GenServer

  def start_link(_options), do: GenServer.start_link(__MODULE__, %{}, name: __MODULE__)

  # JavaScript source: getRoom(id)
  def get_room(id), do: GenServer.call(__MODULE__, {:get_room, id})

  # JavaScript source: server.js lines 9841-9866, GET /party/:room/join
  def route_join(conn, raw_room) do
    room_id =
      raw_room
      |> to_string()
      |> then(&Regex.replace(~r/[^a-zA-Z0-9]/, &1, ""))
      |> String.slice(0, 12)

    if room_id == "" do
      StreamVault.Response.text(conn, "Invalid room", 400)
    else
      name =
        (conn.query_params["name"] || "Guest")
        |> to_string()
        |> String.slice(0, 32)
        |> then(&Regex.replace(~r/[<>&"]/, &1, ""))

      {sync, count} = GenServer.call(__MODULE__, {:join, room_id, self(), name})

      conn =
        conn
        |> Plug.Conn.put_resp_header("content-type", "text/event-stream")
        |> Plug.Conn.put_resp_header("cache-control", "no-cache")
        |> Plug.Conn.put_resp_header("connection", "keep-alive")
        |> Plug.Conn.put_resp_header("x-accel-buffering", "no")
        |> Plug.Conn.send_chunked(200)

      initial = Map.merge(%{"type" => "sync"}, sync) |> Map.put("count", count)

      case Plug.Conn.chunk(conn, encode_event(initial)) do
        {:ok, conn} ->
          party_stream_loop(conn, room_id, name)

        {:error, _} ->
          GenServer.cast(__MODULE__, {:leave, room_id, self(), name})
          conn
      end
    end
  end

  # JavaScript source: server.js lines 9868-9891, POST /party/:room/event
  def route_event(conn, raw_room) do
    room_id =
      raw_room
      |> to_string()
      |> then(&Regex.replace(~r/[^a-zA-Z0-9]/, &1, ""))
      |> String.slice(0, 12)

    body = conn.body_params || %{}
    type = body["type"]

    if type not in ["load", "play", "pause", "seek", "chat"] do
      StreamVault.Response.json(conn, %{"error" => "invalid type"}, 400)
    else
      GenServer.call(__MODULE__, {:event, room_id, body})
      StreamVault.Response.json(conn, %{"ok" => true})
    end
  end

  # JavaScript source: broadcast(room, data)
  def broadcast(room, data) do
    GenServer.cast(__MODULE__, {:broadcast, room, data})
  end

  @impl true
  def init(_), do: {:ok, %{}}

  @impl true
  def handle_call({:get_room, id}, _from, rooms) do
    {room, rooms} = ensure_room(rooms, id)
    {:reply, room, rooms}
  end

  def handle_call({:join, id, client, name}, _from, rooms) do
    {room, rooms} = ensure_room(rooms, id)
    Process.monitor(client)
    room = %{room | clients: MapSet.put(room.clients, client)}
    rooms = Map.put(rooms, id, room)
    data = %{"type" => "join", "name" => name, "count" => MapSet.size(room.clients)}
    send_clients(room, data)
    sync = Map.merge(room.state, %{"chat" => room.chat})
    {:reply, {sync, MapSet.size(room.clients)}, rooms}
  end

  def handle_call({:event, id, body}, _from, rooms) do
    {room, rooms} = ensure_room(rooms, id)
    type = body["type"]

    if type == "chat" do
      message = %{
        "name" =>
          if(StreamVault.JS.truthy?(body["name"]), do: to_string(body["name"]), else: "Guest")
          |> String.slice(0, 32),
        "message" =>
          if(StreamVault.JS.truthy?(body["message"]), do: to_string(body["message"]), else: "")
          |> String.slice(0, 300),
        "ts" => StreamVault.JS.date_now()
      }

      room = %{room | chat: (room.chat ++ [message]) |> Enum.take(-50)}
      send_clients(room, Map.put(message, "type", "chat"))
      {:reply, :ok, Map.put(rooms, id, room)}
    else
      state = update_room_state(room.state, type, body)
      state = Map.put(state, "updatedAt", StreamVault.JS.date_now())
      room = %{room | state: state}
      name = if StreamVault.JS.truthy?(body["name"]), do: to_string(body["name"]), else: ""

      send_clients(
        room,
        state |> Map.put("type", type) |> Map.put("name", String.slice(name, 0, 32))
      )

      {:reply, :ok, Map.put(rooms, id, room)}
    end
  end

  @impl true
  def handle_cast({:leave, id, client, name}, rooms) do
    case rooms[id] do
      nil ->
        {:noreply, rooms}

      room ->
        room = %{room | clients: MapSet.delete(room.clients, client)}

        send_clients(room, %{
          "type" => "leave",
          "name" => name,
          "count" => MapSet.size(room.clients)
        })

        if MapSet.size(room.clients) == 0 do
          Process.send_after(self(), {:remove_if_empty, id}, 3_600_000)
        end

        {:noreply, Map.put(rooms, id, room)}
    end
  end

  def handle_cast({:broadcast, id, data}, rooms) when is_binary(id) do
    if rooms[id], do: send_clients(rooms[id], data)
    {:noreply, rooms}
  end

  def handle_cast({:broadcast, room, data}, rooms) when is_map(room) do
    send_clients(room, data)
    {:noreply, rooms}
  end

  @impl true
  def handle_info({:remove_if_empty, id}, rooms) do
    rooms =
      case rooms[id] do
        %{clients: clients} ->
          if MapSet.size(clients) == 0, do: Map.delete(rooms, id), else: rooms

        _ ->
          rooms
      end

    {:noreply, rooms}
  end

  def handle_info({:DOWN, _ref, :process, client, _reason}, rooms) do
    rooms =
      Map.new(rooms, fn {id, room} ->
        {id, %{room | clients: MapSet.delete(room.clients, client)}}
      end)

    {:noreply, rooms}
  end

  defp ensure_room(rooms, id) do
    case rooms[id] do
      nil ->
        now = StreamVault.JS.date_now()

        room = %{
          clients: MapSet.new(),
          state: %{"streamId" => nil, "playing" => false, "time" => 0, "updatedAt" => now},
          chat: [],
          created_at: now
        }

        {room, Map.put(rooms, id, room)}

      room ->
        {room, rooms}
    end
  end

  defp update_room_state(state, "load", body),
    do:
      state
      |> Map.put("streamId", number_value(body["streamId"]))
      |> Map.put("time", 0)
      |> Map.put("playing", false)

  defp update_room_state(state, "play", body),
    do:
      state
      |> Map.put("playing", true)
      |> Map.put("time", truthy_number_or(body["time"], state["time"]))

  defp update_room_state(state, "pause", body),
    do:
      state
      |> Map.put("playing", false)
      |> Map.put("time", truthy_number_or(body["time"], state["time"]))

  defp update_room_state(state, "seek", body),
    do: Map.put(state, "time", truthy_number_or(body["time"], 0))

  defp number_value(value) do
    case StreamVault.JS.number(value) do
      :nan -> nil
      number -> number
    end
  end

  defp truthy_number_or(value, fallback) do
    case StreamVault.JS.number(value) do
      number when number in [:nan, 0] -> fallback
      number -> number
    end
  end

  defp send_clients(room, data) do
    message = encode_event(data)
    Enum.each(room.clients, &send(&1, {:party_event, message}))
  end

  defp encode_event(data), do: "data: #{Jason.encode!(data)}\n\n"

  defp party_stream_loop(conn, room_id, name) do
    receive do
      {:party_event, message} ->
        case Plug.Conn.chunk(conn, message) do
          {:ok, conn} ->
            party_stream_loop(conn, room_id, name)

          {:error, _} ->
            GenServer.cast(__MODULE__, {:leave, room_id, self(), name})
            conn
        end
    after
      25_000 ->
        case Plug.Conn.chunk(conn, ": ping\n\n") do
          {:ok, conn} ->
            party_stream_loop(conn, room_id, name)

          {:error, _} ->
            GenServer.cast(__MODULE__, {:leave, room_id, self(), name})
            conn
        end
    end
  end
end

defmodule StreamVault.Router do
  @moduledoc false

  def call(conn) do
    method = if conn.method == "HEAD", do: "GET", else: conn.method
    parts = conn.path_info
    lower = Enum.map(parts, &String.downcase/1)

    case {method, lower} do
      # JavaScript source: server.js lines 3083-3120, GET /poster-cache
      {"GET", ["poster-cache"]} ->
        StreamVault.Core.route_poster_cache(conn)

      # JavaScript source: server.js lines 3122-3124, GET /api/channels
      {"GET", ["api", "channels"]} ->
        StreamVault.Core.route_channels(conn)

      # JavaScript source: server.js lines 3126-3134, POST /api/channels/reload
      {"POST", ["api", "channels", "reload"]} ->
        StreamVault.Core.route_channels_reload(conn)

      # JavaScript source: server.js lines 4698-4700, GET /api/fifa-live/match/:provider/:matchId
      {"GET", ["api", "fifa-live", "match", _provider, _match_id]} ->
        conn
        |> with_path_params(%{"provider" => at(parts, 3), "matchId" => at(parts, 4)})
        |> StreamVault.Fifa.route_match_with_provider()

      # JavaScript source: server.js lines 4702-4704, GET /api/fifa-live/match/:matchId
      {"GET", ["api", "fifa-live", "match", _match_id]} ->
        conn |> with_path_params(%{"matchId" => at(parts, 3)}) |> StreamVault.Fifa.route_match()

      # JavaScript source: server.js lines 4706-4719, GET /api/fifa-live/news
      {"GET", ["api", "fifa-live", "news"]} ->
        StreamVault.Fifa.route_news(conn)

      # JavaScript source: server.js lines 4721-4746, GET /api/fifa-live
      {"GET", ["api", "fifa-live"]} ->
        StreamVault.Fifa.route_live(conn)

      # JavaScript source: server.js lines 5044-5088, GET /live/:channelId/playlist.m3u8
      {"GET", ["live", _channel_id, "playlist.m3u8"]} ->
        conn
        |> with_path_params(%{"channelId" => at(parts, 1)})
        |> StreamVault.Live.route_live_playlist()

      # JavaScript source: server.js lines 5289-5306, GET /live/:channelId/segment
      {"GET", ["live", _channel_id, "segment"]} ->
        conn
        |> with_path_params(%{"channelId" => at(parts, 1)})
        |> StreamVault.Live.route_live_segment()

      # JavaScript source: server.js line 5489, GET /live-relay/:channelId/playlist.m3u8
      {"GET", ["live-relay", _channel_id, "playlist.m3u8"]} ->
        conn
        |> with_path_params(%{"channelId" => at(parts, 1)})
        |> StreamVault.Live.route_live_relay_playlist()

      # JavaScript source: server.js line 5489, GET /live-relay/:channelId/index.m3u8
      {"GET", ["live-relay", _channel_id, "index.m3u8"]} ->
        conn
        |> with_path_params(%{"channelId" => at(parts, 1)})
        |> StreamVault.Live.route_live_relay_playlist()

      # JavaScript source: server.js lines 5491-5529, GET /live-relay/:channelId/:segment
      {"GET", ["live-relay", _channel_id, _segment]} ->
        conn
        |> with_path_params(%{"channelId" => at(parts, 1), "segment" => at(parts, 2)})
        |> StreamVault.Live.route_live_relay_segment()

      # JavaScript source: server.js lines 5531-5558, GET /api/live-test/:channelId
      {"GET", ["api", "live-test", _channel_id]} ->
        conn
        |> with_path_params(%{"channelId" => at(parts, 2)})
        |> StreamVault.Live.route_live_test()

      # JavaScript source: server.js lines 5976-6001, GET /api/heavy-compat-hls/ftp/index.m3u8
      {"GET", ["api", "heavy-compat-hls", "ftp", "index.m3u8"]} ->
        StreamVault.Live.route_heavy_compat_hls_ftp(conn)

      # JavaScript source: server.js lines 6003-6028, GET /api/mobile-hls/local/:id/index.m3u8
      {"GET", ["api", "mobile-hls", "local", _id, "index.m3u8"]} ->
        conn
        |> with_path_params(%{"id" => at(parts, 3)})
        |> StreamVault.Live.route_mobile_hls_local()

      # JavaScript source: server.js lines 6404-6425, GET /api/playback/movie/:id
      {"GET", ["api", "playback", "movie", _id]} ->
        StreamVault.Content.route_playback_movie(conn, at(parts, 3))

      # JavaScript source: server.js lines 6427-6450, GET /api/series/detail
      {"GET", ["api", "series", "detail"]} ->
        StreamVault.Content.route_series_detail(conn)

      # JavaScript source: server.js lines 6576-6588, GET /api/details/debug
      {"GET", ["api", "details", "debug"]} ->
        StreamVault.Content.route_details_debug(conn)

      # JavaScript source: server.js lines 6590-6647, GET /api/details/:type/:id
      {"GET", ["api", "details", _type, _id]} ->
        StreamVault.Content.route_details(conn, at(parts, 2), at(parts, 3))

      # JavaScript source: server.js lines 6649-6656, POST /api/details/cache/clear
      {"POST", ["api", "details", "cache", "clear"]} ->
        StreamVault.Content.route_details_cache_clear(conn)

      # JavaScript source: server.js lines 6658-6681, GET /api/mobile-hls/ftp/index.m3u8
      {"GET", ["api", "mobile-hls", "ftp", "index.m3u8"]} ->
        StreamVault.Live.route_mobile_hls_ftp(conn)

      # JavaScript source: server.js lines 6683-6700, GET /api/mobile-hls/:scope/:key/:file
      {"GET", ["api", "mobile-hls", _scope, _key, _file]} ->
        StreamVault.Live.route_mobile_hls_file(conn, at(parts, 2), at(parts, 3), at(parts, 4))

      # JavaScript source: server.js lines 6702-6718, GET /api/heavy-compat-hls/ftp/:key/:file
      {"GET", ["api", "heavy-compat-hls", "ftp", _key, _file]} ->
        StreamVault.Live.route_heavy_hls_file(conn, at(parts, 3), at(parts, 4))

      # JavaScript source: server.js lines 6720-6740, POST /api/mobile-hls/stop
      {"POST", ["api", "mobile-hls", "stop"]} ->
        StreamVault.Live.route_mobile_hls_stop(conn)

      # JavaScript source: server.js lines 7607-7629, GET /api/section/:key
      {"GET", ["api", "section", _key]} ->
        StreamVault.Content.route_section(conn, at(parts, 2))

      # JavaScript source: server.js lines 7631-7658, GET /api/home-feed
      {"GET", ["api", "home-feed"]} ->
        StreamVault.Content.route_home_feed(conn)

      # JavaScript source: server.js lines 7660-7712, GET /api/movies
      {"GET", ["api", "movies"]} ->
        StreamVault.Content.route_movies(conn)

      # JavaScript source: server.js lines 7714-7754, GET /api/search
      {"GET", ["api", "search"]} ->
        StreamVault.Content.route_search(conn)

      # JavaScript source: server.js lines 7756-7789, GET /api/boot-search-index
      {"GET", ["api", "boot-search-index"]} ->
        StreamVault.Content.route_boot_search_index(conn)

      # JavaScript source: server.js lines 7791-7815, GET /boot-search-index.json
      {"GET", ["boot-search-index.json"]} ->
        StreamVault.Content.route_boot_search_file(conn)

      # JavaScript source: server.js lines 7817-7832, GET /api/catalog-stats
      {"GET", ["api", "catalog-stats"]} ->
        StreamVault.Content.route_catalog_stats(conn)

      # JavaScript source: server.js lines 7834-7868, GET /api/movies/keywords
      {"GET", ["api", "movies", "keywords"]} ->
        StreamVault.Content.route_movie_keywords(conn)

      # JavaScript source: server.js lines 7870-7942, GET /api/series
      {"GET", ["api", "series"]} ->
        StreamVault.Content.route_series(conn)

      # JavaScript source: server.js lines 8635-8657, GET /api/title-details
      {"GET", ["api", "title-details"]} ->
        StreamVault.Content.route_title_details(conn)

      # JavaScript source: server.js lines 8659-8666, GET /api/version
      {"GET", ["api", "version"]} ->
        StreamVault.Content.route_version(conn)

      # JavaScript source: server.js lines 8668-8714, GET /api/episode-titles
      {"GET", ["api", "episode-titles"]} ->
        StreamVault.Content.route_episode_titles(conn)

      # JavaScript source: server.js lines 8716-8775, GET /api/media-info/:id
      {"GET", ["api", "media-info", _id]} ->
        StreamVault.Content.route_media_info(conn, at(parts, 2))

      # JavaScript source: server.js lines 8777-8792, GET /api/duration/:id
      {"GET", ["api", "duration", _id]} ->
        StreamVault.Content.route_duration(conn, at(parts, 2))

      # JavaScript source: server.js lines 8794-8810, GET /api/qualities/:id
      {"GET", ["api", "qualities", _id]} ->
        StreamVault.Content.route_qualities(conn, at(parts, 2))

      # JavaScript source: server.js lines 8812-8819, GET /api/subtitles/:id
      {"GET", ["api", "subtitles", _id]} ->
        StreamVault.Content.route_subtitles(conn, at(parts, 2))

      # JavaScript source: server.js line 8821, GET /api/history
      {"GET", ["api", "history"]} ->
        StreamVault.Content.route_history_get(conn)

      # JavaScript source: server.js lines 8822-8828, POST /api/history
      {"POST", ["api", "history"]} ->
        StreamVault.Content.route_history_post(conn)

      # JavaScript source: server.js lines 8830-8837, DELETE /api/history/:id
      {"DELETE", ["api", "history", _id]} ->
        StreamVault.Content.route_history_delete(conn, at(parts, 2))

      # JavaScript source: server.js lines 8839-8852, GET /api/refresh-poster/:id
      {"GET", ["api", "refresh-poster", _id]} ->
        StreamVault.Content.route_refresh_poster(conn, at(parts, 2))

      # JavaScript source: server.js lines 9105-9124, GET /api/mobile-compat-hls/:sessionId/:file
      {"GET", ["api", "mobile-compat-hls", _session_id, _file]} ->
        StreamVault.Playback.route_mobile_compat_hls(conn, at(parts, 2), at(parts, 3))

      # JavaScript source: server.js lines 9203-9239, GET /media/converted/:file
      {"GET", ["media", "converted", _file]} ->
        StreamVault.Playback.route_converted_media(conn, at(parts, 2))

      # JavaScript source: server.js lines 9276-9294, GET /api/playback/local/:id
      {"GET", ["api", "playback", "local", _id]} ->
        StreamVault.Playback.route_playback_local(conn, at(parts, 3))

      # JavaScript source: server.js lines 9296-9340, GET /api/playback/local/:id/stream
      {"GET", ["api", "playback", "local", _id, "stream"]} ->
        StreamVault.Playback.route_playback_local_stream(conn, at(parts, 3))

      # JavaScript source: server.js lines 9342-9380, GET /stream/:id
      {"GET", ["stream", _id]} ->
        StreamVault.Playback.route_stream(conn, at(parts, 1))

      # JavaScript source: server.js lines 9382-9411, GET /api/stream-seek/:id
      {"GET", ["api", "stream-seek", _id]} ->
        StreamVault.Playback.route_stream_seek(conn, at(parts, 2))

      # JavaScript source: server.js lines 9720-9767, GET /subtitles/:id/embedded/:streamIdx.vtt
      {"GET", ["subtitles", _id, "embedded", stream_file]} ->
        if String.ends_with?(stream_file, ".vtt"),
          do:
            StreamVault.Playback.route_embedded_subtitle(
              conn,
              at(parts, 1),
              String.slice(at(parts, 3), 0, String.length(at(parts, 3)) - 4)
            ),
          else: not_found(conn)

      # JavaScript source: server.js lines 9769-9788, GET /subtitles/:id/:trackIdx?
      {"GET", ["subtitles", _id]} ->
        StreamVault.Playback.route_sidecar_subtitle(conn, at(parts, 1), nil)

      {"GET", ["subtitles", _id, _track_idx]} ->
        StreamVault.Playback.route_sidecar_subtitle(conn, at(parts, 1), at(parts, 2))

      # JavaScript source: server.js lines 9841-9866, GET /party/:room/join
      {"GET", ["party", _room, "join"]} ->
        StreamVault.WatchParty.route_join(conn, at(parts, 1))

      # JavaScript source: server.js lines 9868-9891, POST /party/:room/event
      {"POST", ["party", _room, "event"]} ->
        StreamVault.WatchParty.route_event(conn, at(parts, 1))

      # JavaScript source: server.js lines 10027-10173, GET /api/playback/ftp
      {"GET", ["api", "playback", "ftp"]} ->
        StreamVault.Playback.route_playback_ftp(conn)

      # JavaScript source: server.js lines 10175-10215, GET /api/play-url
      {"GET", ["api", "play-url"]} ->
        StreamVault.Playback.route_play_url(conn)

      # JavaScript source: server.js lines 10217-10283, GET /api/ftp/media-info
      {"GET", ["api", "ftp", "media-info"]} ->
        StreamVault.Playback.route_ftp_media_info(conn)

      # JavaScript source: server.js lines 10217-10283, GET /api/ftp/info
      {"GET", ["api", "ftp", "info"]} ->
        StreamVault.Playback.route_ftp_media_info(conn)

      # JavaScript source: server.js lines 10285-10356, GET /api/ftp/subtitle/:track.vtt
      {"GET", ["api", "ftp", "subtitle", track_file]} ->
        if String.ends_with?(track_file, ".vtt"),
          do:
            StreamVault.Playback.route_ftp_subtitle(
              conn,
              String.slice(at(parts, 3), 0, String.length(at(parts, 3)) - 4)
            ),
          else: not_found(conn)

      # JavaScript source: server.js lines 10358-10518, GET /api/ftp/stream
      {"GET", ["api", "ftp", "stream"]} ->
        StreamVault.Playback.route_ftp_stream(conn)

      # JavaScript source: server.js lines 10520-10595, GET /api/ftp/proxy
      {"GET", ["api", "ftp", "proxy"]} ->
        StreamVault.Playback.route_ftp_proxy(conn)

      # JavaScript source: server.js lines 10597-10638, GET /api/ftp/duration
      {"GET", ["api", "ftp", "duration"]} ->
        StreamVault.Playback.route_ftp_duration(conn)

      # JavaScript source: server.js lines 10640-10691, GET /api/ftp/test
      {"GET", ["api", "ftp", "test"]} ->
        StreamVault.Playback.route_ftp_test(conn)

      # JavaScript source: server.js lines 10841-10857, GET /api/downloads
      {"GET", ["api", "downloads"]} ->
        StreamVault.Software.route_downloads(conn)

      # JavaScript source: server.js lines 10859-10865, GET /api/downloads/debug
      {"GET", ["api", "downloads", "debug"]} ->
        StreamVault.Software.route_downloads_debug(conn)

      # JavaScript source: server.js lines 10867-10873, GET /download/:id
      {"GET", ["download", _id]} ->
        StreamVault.Software.route_download(conn, at(parts, 1))

      # JavaScript source: server.js lines 10875-10909, GET /api/trending
      {"GET", ["api", "trending"]} ->
        StreamVault.Software.route_trending(conn)

      # JavaScript source: server.js lines 10919-10926, GET /api/infra/health
      {"GET", ["api", "infra", "health"]} ->
        with_infra_access(conn, &infra_health/1)

      # JavaScript source: server.js line 10928, GET /api/infra/snapshot
      {"GET", ["api", "infra", "snapshot"]} ->
        with_infra_access(
          conn,
          &StreamVault.Response.json(&1, StreamVault.InfraTelemetry.snapshot())
        )

      # JavaScript source: server.js line 10929, GET /api/infra/metrics
      {"GET", ["api", "infra", "metrics"]} ->
        with_infra_access(
          conn,
          &StreamVault.Response.json(&1, StreamVault.InfraTelemetry.metrics())
        )

      # JavaScript source: server.js lines 10930-10933, GET /api/infra/events
      {"GET", ["api", "infra", "events"]} ->
        with_infra_access(conn, &infra_events/1)

      # JavaScript source: server.js line 10934, GET /api/infra/nodes
      {"GET", ["api", "infra", "nodes"]} ->
        with_infra_access(
          conn,
          &StreamVault.Response.json(&1, StreamVault.InfraTelemetry.nodes())
        )

      _ ->
        not_found(conn)
    end
  end

  # JavaScript source: requireInfraAccess(req, res, next)
  def require_infra_access(conn), do: StreamVault.InfraTelemetry.authorized?(conn)

  # JavaScript source: server.js lines 10919-10926, GET /api/infra/health
  def infra_health(conn) do
    snapshot = StreamVault.InfraTelemetry.snapshot()

    StreamVault.Response.json(conn, %{
      "ok" => true,
      "nodeName" => "mac-mini-streamvault",
      "serviceName" => "StreamVault",
      "timestamp" => StreamVault.JS.date_now(),
      "uptimeSeconds" => snapshot["metrics"]["uptimeSeconds"]
    })
  end

  # JavaScript source: server.js lines 10930-10933, GET /api/infra/events
  def infra_events(conn) do
    limit =
      conn.query_params["limit"]
      |> StreamVault.JS.parse_int()
      |> number_or(100)
      |> max(1)
      |> min(500)

    StreamVault.Response.json(conn, StreamVault.InfraTelemetry.events() |> Enum.take(-limit))
  end

  # JavaScript source: server.js line 10936, catch-all 404 middleware
  def not_found(conn), do: StreamVault.Response.json(conn, %{"error" => "Not found"}, 404)

  defp with_infra_access(conn, handler) do
    if require_infra_access(conn),
      do: handler.(conn),
      else: StreamVault.Response.json(conn, %{"error" => "Unauthorized"}, 401)
  end

  defp with_path_params(conn, path_params) do
    current_params =
      if is_map(conn.params) and not match?(%Plug.Conn.Unfetched{}, conn.params),
        do: conn.params,
        else: %{}

    %{
      conn
      | path_params: Map.merge(conn.path_params || %{}, path_params),
        params: Map.merge(current_params, path_params)
    }
  end

  defp at(parts, index), do: Enum.at(parts, index)
  defp number_or(:nan, fallback), do: fallback
  defp number_or(0, fallback), do: fallback
  defp number_or(value, _fallback), do: trunc(value)
end

defmodule StreamVault.Endpoint do
  @moduledoc false
  @behaviour Plug

  @parser_options Plug.Parsers.init(
                    parsers: [:json],
                    pass: ["*/*"],
                    json_decoder: Jason,
                    length: 1_000_000
                  )
  @static_options Plug.Static.init(at: "/", from: StreamVault.Paths.public(), gzip: false)

  @impl true
  def init(options), do: options

  @impl true
  def call(conn, _options) do
    cond do
      websocket_upgrade?(conn) and conn.request_path == "/infra/live" ->
        if StreamVault.InfraTelemetry.authorized?(conn) do
          WebSockAdapter.upgrade(conn, StreamVault.InfraSocket, %{}, [])
        else
          conn
          |> Plug.Conn.put_resp_header("connection", "close")
          |> Plug.Conn.send_resp(401, "")
        end

      conn.method == "OPTIONS" and conn.request_path == "/api/ftp/media-info" ->
        early_ftp_media_info_options(conn)

      true ->
        run_http_pipeline(conn)
    end
  rescue
    error -> final_error(conn, error)
  catch
    kind, reason -> final_error(conn, RuntimeError.exception("#{kind}: #{inspect(reason)}"))
  end

  # JavaScript source: server.js lines 15-21, OPTIONS /api/ftp/media-info
  def early_ftp_media_info_options(conn) do
    conn
    |> emergency_headers()
    |> Plug.Conn.send_resp(204, "")
  end

  # JavaScript source: server.js lines 23-30, emergency CORS middleware
  def emergency_headers(conn) do
    conn
    |> Plug.Conn.put_resp_header("access-control-allow-origin", "*")
    |> Plug.Conn.put_resp_header("access-control-allow-methods", "GET,POST,HEAD,OPTIONS")
    |> Plug.Conn.put_resp_header(
      "access-control-allow-headers",
      "Origin, X-Requested-With, Content-Type, Accept, Range, Authorization"
    )
    |> Plug.Conn.put_resp_header(
      "access-control-expose-headers",
      "Content-Length, Content-Range, Accept-Ranges"
    )
  end

  # JavaScript source: server.js lines 32-45, origin allowlist middleware
  def allowlist_headers(conn) do
    allowed = [
      "https://streamvault.fit",
      "https://mediumseagreen-butterfly-834518.hostingersite.com"
    ]

    origin = Plug.Conn.get_req_header(conn, "origin") |> List.first()

    conn =
      if origin in allowed do
        conn
        |> Plug.Conn.put_resp_header("access-control-allow-origin", origin)
        |> Plug.Conn.put_resp_header("vary", "Origin")
      else
        conn
      end

    conn
    |> Plug.Conn.put_resp_header("access-control-allow-methods", "GET,POST,OPTIONS")
    |> Plug.Conn.put_resp_header("access-control-allow-headers", "Content-Type,Range")
  end

  # JavaScript source: server.js lines 3060-3066, OPTIONS *
  def wildcard_options(conn) do
    conn
    |> emergency_headers()
    |> Plug.Conn.send_resp(204, "")
  end

  # JavaScript source: server.js lines 3067-3076, security and final CORS middleware
  def security_headers(conn) do
    csp =
      "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net https://static.cloudflareinsights.com; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://static.cloudflareinsights.com; script-src-elem 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; media-src * blob:; connect-src *"

    conn
    |> Plug.Conn.put_resp_header("x-content-type-options", "nosniff")
    |> Plug.Conn.put_resp_header("x-frame-options", "SAMEORIGIN")
    |> Plug.Conn.put_resp_header("content-security-policy", csp)
    |> Plug.Conn.put_resp_header("access-control-allow-origin", "*")
    |> Plug.Conn.put_resp_header("access-control-allow-methods", "GET, POST, DELETE, OPTIONS")
    |> Plug.Conn.put_resp_header("access-control-allow-headers", "Content-Type, Range")
    |> Plug.Conn.put_resp_header(
      "access-control-expose-headers",
      "Content-Range, Accept-Ranges, Content-Length"
    )
  end

  defp run_http_pipeline(conn) do
    conn = emergency_headers(conn)

    if conn.method == "OPTIONS" do
      Plug.Conn.send_resp(conn, 204, "")
    else
      conn =
        conn
        |> allowlist_headers()
        |> Plug.Conn.fetch_query_params()
        |> Plug.Parsers.call(@parser_options)
        |> StreamVault.Tracker.request_middleware()
        |> security_headers()
        |> StreamVault.InfraTelemetry.request_middleware()

      dispatch_dashboard_static_or_routes(conn)
    end
  end

  defp dispatch_dashboard_static_or_routes(conn) do
    method = if conn.method == "HEAD", do: "GET", else: conn.method

    case {method, conn.path_info} do
      {"GET", ["api", "dashboard", "ping"]} ->
        conn |> StreamVault.Dashboard.cors() |> StreamVault.Dashboard.route_ping()

      {"GET", ["api", "dashboard", "stats"]} ->
        conn |> StreamVault.Dashboard.cors() |> StreamVault.Dashboard.route_stats()

      _ ->
        conn =
          if String.starts_with?(conn.request_path, "/api/dashboard"),
            do: StreamVault.Dashboard.cors(conn),
            else: conn

        static_conn = Plug.Static.call(conn, @static_options)
        if static_conn.halted, do: static_conn, else: StreamVault.Router.call(static_conn)
    end
  end

  defp websocket_upgrade?(conn) do
    Plug.Conn.get_req_header(conn, "upgrade") |> Enum.any?(&(String.downcase(&1) == "websocket"))
  end

  # JavaScript source: server.js lines 10937-10948, final error middleware
  def final_error(conn, error) do
    message = Exception.message(error)
    IO.puts(:stderr, "Unhandled error: #{message}")

    if Process.whereis(StreamVault.InfraTelemetry) do
      StreamVault.InfraTelemetry.error(%{
        "nodeId" => conn.assigns[:infra_node_id] || "streamvault-core",
        "path" => conn.request_path,
        "method" => conn.method,
        "message" => message,
        "statusCode" => 500
      })
    end

    if conn.state in [:unset, :set, :set_chunked, :set_file] do
      StreamVault.Response.json(conn, %{"error" => "Internal server error"}, 500)
    else
      conn
    end
  end
end

defmodule StreamVault.FatalReporter do
  @moduledoc false

  def adding_handler(config), do: {:ok, config}
  def removing_handler(_config), do: :ok
  def changing_config(_operation, _old_config, new_config), do: {:ok, new_config}
  def filter_config(config), do: config

  # JavaScript source: server.js lines 10951-10953, uncaughtExceptionMonitor callback
  # JavaScript source: server.js lines 10954-10957, unhandledRejection callback
  def log(event, _config) do
    if Process.whereis(StreamVault.InfraTelemetry) do
      StreamVault.InfraTelemetry.report_fatal(format_event(event))
    end

    :ok
  end

  defp format_event(%{msg: {:string, message}}), do: IO.iodata_to_binary(message)

  defp format_event(%{msg: {format, arguments}}) when is_list(arguments) do
    try do
      :io_lib.format(format, arguments) |> IO.iodata_to_binary()
    rescue
      _ -> inspect({format, arguments})
    end
  end

  defp format_event(event), do: inspect(event)
end

defmodule StreamVault.Bootstrap do
  @moduledoc false
  use GenServer

  def start_link(_options), do: GenServer.start_link(__MODULE__, %{}, name: __MODULE__)

  @impl true
  def init(state) do
    StreamVault.Core.initialize_state()
    StreamVault.Content.initialize_state()
    Enum.each(cache_directories(), &File.mkdir_p/1)

    StreamVault.Core.build_file_index()
    StreamVault.Core.build_instant_lists()
    StreamVault.Core.filter_cartoons_and_anime()
    StreamVault.Core.sv_get_boot_search_index()

    try do
      StreamVault.Content.detail_catalog_index()
    rescue
      error ->
        IO.puts(:stderr, "Detail recommendation warmup failed: #{Exception.message(error)}")
    end

    if System.get_env("SV_SEARCH_WARMUP") == "1" do
      delay =
        case StreamVault.JS.parse_int(System.get_env("SV_SEARCH_WARMUP_DELAY_MS") || "120000") do
          number when is_integer(number) and number != 0 -> max(30_000, number)
          _ -> 120_000
        end

      Process.send_after(self(), :search_warmup, delay)
    end

    Process.send_after(self(), :background_enrichment, 60_000)
    Process.send_after(self(), :fifa_live_warmup, 750)
    Process.send_after(self(), :fifa_news_warmup, 2_500)
    Process.send_after(self(), :live_relay_prewarm, 2_500)
    {:ok, state}
  end

  @impl true
  def handle_info(:search_warmup, state) do
    try do
      StreamVault.Core.sv_get_fast_search_index()
    rescue
      error ->
        IO.puts(:stderr, "ÃƒÂ¢Ã…Â¡Ã‚Â  Search index warmup failed: #{Exception.message(error)}")
    end

    {:noreply, state}
  end

  def handle_info(:background_enrichment, state) do
    Task.start(fn -> StreamVault.Core.run_background_enrichment() end)
    {:noreply, state}
  end

  def handle_info(:fifa_live_warmup, state) do
    StreamVault.Fifa.sv_warm_fifa_live_cache("startup")
    {:noreply, state}
  end

  def handle_info(:fifa_news_warmup, state) do
    Task.start(fn ->
      try do
        StreamVault.Fifa.sv_get_fifa_news_payload()
      rescue
        error -> StreamVault.Fifa.sv_fifa_warn("startup news warmup failed", error)
      end
    end)

    {:noreply, state}
  end

  def handle_info(:live_relay_prewarm, state) do
    Enum.each(["tsports", "shomoy", "jamuna", "channel24"], fn channel_id ->
      try do
        StreamVault.Live.sv_ensure_live_relay(channel_id)
      rescue
        _ -> :ok
      end
    end)

    {:noreply, state}
  end

  # JavaScript source: getLanIP()
  def get_lan_ip do
    case :inet.getif() do
      {:ok, interfaces} ->
        Enum.find_value(interfaces, "your-laptop-ip", fn
          {{127, _, _, _}, _broadcast, _mask} -> nil
          {{a, b, c, d}, _broadcast, _mask} -> {a, b, c, d} |> :inet.ntoa() |> to_string()
          _ -> nil
        end)

      _ ->
        "your-laptop-ip"
    end
  end

  def after_listen do
    lan = get_lan_ip()
    channels = StreamVault.Core.channels()
    configured = Enum.count(channels, &StreamVault.JS.truthy?(StreamVault.JS.get(&1, "url")))
    file_count = length(StreamVault.Core.file_index())

    IO.puts("\nÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¬ StreamVault Enhanced ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ http://0.0.0.0:3000")
    IO.puts("ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â± iPhone/iPad support ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ http://#{lan}:3000")
    IO.puts("ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Å¾ Auto-transcoding enabled for iOS devices")
    IO.puts("ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â Movies  : #{StreamVault.Paths.movies_dir()}")
    IO.puts("ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Âº Series  : #{StreamVault.Paths.series_dir()}")

    IO.puts(
      "ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¡ Channels: #{length(channels)} loaded, #{configured} with URLs configured"
    )

    if configured == 0,
      do:
        IO.puts(
          "   ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â  Open channels.json and add .m3u8 URLs from the ISP portal (F12 ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Network tab)"
        )

    IO.puts(
      if(StreamVault.JS.truthy?(StreamVault.Core.tmdb_token()),
        do: "ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ TMDB enabled (HD posters + backdrops)",
        else: "ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â  TMDB token missing"
      )
    )

    IO.puts("ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¡ Stream IDs: 0ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“#{file_count - 1}")
    IO.puts("\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â² Using DIRECT STREAMING (fastest playback, no HLS delay)")
    IO.puts("ÃƒÂ¢Ã…â€œÃ‚Â¨ Seeking, pausing, and all controls work instantly\n")

    IO.puts(
      "ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Â¹ Cartoon/Anime filter active ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â only real movies & series are shown"
    )

    IO.puts("ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â¡ Infra telemetry active at /infra/live")
  end

  defp cache_directories do
    [
      StreamVault.Paths.cache(),
      StreamVault.Paths.mobile_hls(),
      StreamVault.Paths.isolated_hls(),
      StreamVault.Paths.mobile_converted(),
      StreamVault.Paths.heavy_hls(),
      StreamVault.Paths.live_relay()
    ]
  end
end

defmodule StreamVault.Application do
  @moduledoc false
  use Application

  @impl true
  def start(_type, _args) do
    _ = Application.ensure_all_started(:os_mon)

    children = [
      {Finch, name: StreamVault.Finch},
      {StreamVault.State, %{}},
      {StreamVault.Tracker, []},
      {StreamVault.InfraTelemetry,
       [node_name: "mac-mini-streamvault", service_name: "StreamVault"]},
      %{id: StreamVault.InfraRelay, start: {StreamVault.InfraRelay, :start_link, [[]]}},
      {StreamVault.WatchParty, []},
      {StreamVault.Bootstrap, []},
      {StreamVault.Live, []},
      {StreamVault.Playback, []},
      {Bandit, plug: StreamVault.Endpoint, ip: {0, 0, 0, 0}, port: 3000, startup_log: false}
    ]

    case Supervisor.start_link(children, strategy: :one_for_one, name: StreamVault.Supervisor) do
      {:ok, supervisor} ->
        _ = :logger.add_handler(:streamvault_infra, StreamVault.FatalReporter, %{level: :error})
        StreamVault.Bootstrap.after_listen()
        {:ok, supervisor}

      other ->
        other
    end
  end
end
