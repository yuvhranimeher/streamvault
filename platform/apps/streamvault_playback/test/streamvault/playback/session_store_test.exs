defmodule StreamVault.Playback.SessionStoreTest do
  use ExUnit.Case, async: false

  alias StreamVault.Playback.SessionStore

  test "opens, updates, and closes a session" do
    session = SessionStore.open("movie", "browser", %{strategy: :direct})
    assert {:ok, touched} = SessionStore.touch(session.id, %{position: 42})
    assert touched.position == 42
    assert :ok = SessionStore.close(session.id)
    assert :error = SessionStore.get(session.id)
  end
end
