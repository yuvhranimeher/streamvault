{-# LANGUAGE OverloadedStrings #-}

import Data.Aeson
import qualified Data.ByteString.Lazy as BL
import qualified Data.ByteString.Char8 as BS
import qualified Data.ByteString.Lazy.Char8 as LBS
import Data.List
import Network.Socket
import Network.Socket.ByteString (recv, sendAll)

main :: IO ()
main = withSocketsDo $ do
  fixture <- BL.readFile "tools/details-parity-v1/out/haskell-details-fixtures.json"
  addr:_ <- getAddrInfo (Just defaultHints { addrFlags = [AI_PASSIVE] }) (Just "127.0.0.1") (Just "3033")
  sock <- socket (addrFamily addr) Stream defaultProtocol
  setSocketOption sock ReuseAddr 1
  bind sock (addrAddress addr)
  listen sock 10
  putStrLn "Native Haskell details shadow listening: http://127.0.0.1:3033"
  loop sock fixture

loop :: Socket -> BL.ByteString -> IO ()
loop sock fixture = do
  (conn, _) <- accept sock
  req <- recv conn 8192
  let firstLine = takeWhile (/= '\r') (BS.unpack req)
      path = words firstLine
      body =
        if length path >= 2 && "/api/details-shadow/ping" `isPrefixOf` (path !! 1)
        then "{\"ok\":true,\"service\":\"native-haskell-details-shadow\",\"port\":3033}"
        else LBS.unpack fixture
      res = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: "
            ++ show (length body) ++ "\r\n\r\n" ++ body
  sendAll conn (BS.pack res)
  close conn
  loop sock fixture
