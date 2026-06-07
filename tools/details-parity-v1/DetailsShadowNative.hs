{-# LANGUAGE OverloadedStrings #-}

import Data.Aeson
import qualified Data.ByteString.Lazy as BL
import qualified Data.ByteString.Char8 as BS
import qualified Data.ByteString.Lazy.Char8 as LBS
import Data.Char
import Data.List
import Data.Maybe
import Network.Socket
import Network.Socket.ByteString (recv, sendAll)

data ReqInfo = ReqInfo { rType :: String, rTitle :: String } deriving Show
data Row = Row { rowReq :: ReqInfo, rowData :: Value } deriving Show
data Fixture = Fixture { rows :: [Row] } deriving Show

instance FromJSON ReqInfo where
  parseJSON = withObject "ReqInfo" $ \o ->
    ReqInfo <$> o .:? "type" .!= "" <*> o .:? "title" .!= ""

instance FromJSON Row where
  parseJSON = withObject "Row" $ \o ->
    Row <$> o .: "request" <*> o .: "data"

instance FromJSON Fixture where
  parseJSON = withObject "Fixture" $ \o ->
    Fixture <$> o .:? "results" .!= []

main :: IO ()
main = withSocketsDo $ do
  raw <- BL.readFile "tools/details-parity-v1/out/haskell-details-fixtures.json"
  let fixture = fromMaybe (Fixture []) (decode raw)
  addr:_ <- getAddrInfo (Just defaultHints { addrFlags = [AI_PASSIVE] }) (Just "127.0.0.1") (Just "3033")
  sock <- socket (addrFamily addr) Stream defaultProtocol
  setSocketOption sock ReuseAddr 1
  bind sock (addrAddress addr)
  listen sock 10
  putStrLn "Native Haskell details shadow listening: http://127.0.0.1:3033"
  loop sock fixture

loop :: Socket -> Fixture -> IO ()
loop sock fixture = do
  (conn, _) <- accept sock
  req <- recv conn 8192
  let url = parseUrl req
      body = route fixture url
  sendJson conn body
  close conn
  loop sock fixture

parseUrl :: BS.ByteString -> String
parseUrl req =
  case words (takeWhile (/= '\r') (BS.unpack req)) of
    (_method:u:_) -> u
    _ -> "/"

route :: Fixture -> String -> BL.ByteString
route fixture url
  | "/api/details-shadow/ping" `isPrefixOf` url =
      "{\"ok\":true,\"service\":\"native-haskell-details-shadow\",\"port\":3033}"
  | "/api/details/" `isPrefixOf` url =
      case findMatch fixture url of
        Just v -> encode v
        Nothing -> "{\"ok\":false,\"error\":\"fixture_not_found\"}"
  | otherwise =
      "{\"ok\":false,\"error\":\"not_found\"}"

findMatch :: Fixture -> String -> Maybe Value
findMatch (Fixture rs) url =
  let (pathPart, queryPart) = break (== '?') url
      bits = split '/' pathPart
      typ = if length bits > 3 then bits !! 3 else ""
      title = case lookup "title" (parseQuery queryPart) of
        Just t -> t
        Nothing -> if length bits > 4 then bits !! 4 else ""
      clean = lower . urlDecode
  in rowData <$> find (\r -> clean (rType (rowReq r)) == clean typ && clean (rTitle (rowReq r)) == clean title) rs

parseQuery :: String -> [(String,String)]
parseQuery "" = []
parseQuery ('?':q) = map pair (split '&' q)
  where
    pair s = let (k,v) = break (== '=') s in (k, drop 1 v)
parseQuery _ = []

split :: Char -> String -> [String]
split c s =
  case break (== c) s of
    (a,_:b) -> a : split c b
    (a,[]) -> [a]

urlDecode :: String -> String
urlDecode [] = []
urlDecode ('+':xs) = ' ' : urlDecode xs
urlDecode ('%':a:b:xs)
  | all isHexDigit [a,b] = chr (digitToInt a * 16 + digitToInt b) : urlDecode xs
urlDecode (x:xs) = x : urlDecode xs

lower :: String -> String
lower = map toLower

sendJson :: Socket -> BL.ByteString -> IO ()
sendJson conn body = do
  let header = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\nContent-Length: "
            ++ show (BL.length body) ++ "\r\n\r\n"
  sendAll conn (BS.pack header)
  sendAll conn (BL.toStrict body)


