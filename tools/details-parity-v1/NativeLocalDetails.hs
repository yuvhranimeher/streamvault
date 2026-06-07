{-# LANGUAGE OverloadedStrings #-}

import Data.Aeson
import Data.Aeson.KeyMap as KM
import Data.Aeson.Key as K
import qualified Data.ByteString.Lazy as BL
import qualified Data.Text as T
import Data.Maybe
import qualified Data.Vector as V
import System.Directory

txt :: Object -> [T.Text] -> T.Text
txt o keys = fromMaybe "" $ listToMaybe $ mapMaybe get keys
  where
    get k = case KM.lookup (K.fromText k) o of
      Just (String s) -> Just s
      Just (Number n) -> Just (T.pack (show n))
      _ -> Nothing

boolHas :: Object -> [T.Text] -> Bool
boolHas o keys = any has keys
  where
    has k = case KM.lookup (K.fromText k) o of
      Just (String s) -> not (T.null s)
      Just Null -> False
      Just _ -> True
      _ -> False

arrVal :: Value
arrVal = Array V.empty

normTitle :: T.Text -> T.Text
normTitle = T.toLower . T.strip

matchItem :: T.Text -> [Value] -> Maybe Object
matchItem title xs = listToMaybe $ mapMaybe go xs
  where
    wanted = normTitle title
    go (Object o)
      | normTitle (txt o ["title","name"]) == wanted = Just o
      | otherwise = Nothing
    go _ = Nothing

main :: IO ()
main = do
  createDirectoryIfMissing True "tools/details-parity-v1/out"

  catalogRaw <- BL.readFile "catalog.json"
  nodeRaw <- BL.readFile "tools/details-parity-v1/out/node-details-fixtures.json"

  let Just (Object catalog) = decode catalogRaw :: Maybe Value
  let Just (Object node) = decode nodeRaw :: Maybe Value

  let movies = case KM.lookup "movies" catalog of Just (Array a) -> V.toList a; _ -> []
  let series = case KM.lookup "series" catalog of Just (Array a) -> V.toList a; _ -> []
  let rows = case KM.lookup "results" node of Just (Array a) -> V.toList a; _ -> []

  let build row =
        case row of
          Object r ->
            let req = case KM.lookup "request" r of Just (Object x) -> x; _ -> KM.empty
                typ = txt req ["type"]
                title = txt req ["title"]
                source = if typ == "tv" then series else movies
                found = matchItem title source
                item = fromMaybe KM.empty found
                dataObj = object
                  [ "ok" .= isJust found
                  , "type" .= typ
                  , "title" .= txt item ["title","name"]
                  , "name" .= txt item ["name","title"]
                  , "year" .= txt item ["year"]
                  , "rating" .= txt item ["rating"]
                  , "runtime" .= txt item ["runtime"]
                  , "language" .= txt item ["language"]
                  , "genre" .= txt item ["genre"]
                  , "genres" .= txt item ["genre"]
                  , "poster" .= txt item ["poster"]
                  , "backdrop" .= txt item ["backdrop"]
                  , "overview" .= txt item ["overview"]
                  , "cast" .= arrVal
                  , "crew" .= arrVal
                  , "trailers" .= arrVal
                  , "similar" .= arrVal
                  , "productionCompanies" .= arrVal
                  , "moreByDirector" .= arrVal
                  , "about" .= arrVal
                  , "playbackInfo" .= arrVal
                  ]
            in object
              [ "request" .= Object req
              , "status" .= (200 :: Int)
              , "ok" .= isJust found
              , "data" .= dataObj
              ]
          _ -> object []

  BL.writeFile "tools/details-parity-v1/out/haskell-details-fixtures.json" $
    encode $ object
      [ "generatedAt" .= ("native-local-haskell" :: T.Text)
      , "base" .= ("native-local-fixture" :: T.Text)
      , "count" .= length rows
      , "results" .= map build rows
      ]

  putStrLn "Wrote tools/details-parity-v1/out/haskell-details-fixtures.json"
