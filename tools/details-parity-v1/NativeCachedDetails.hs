{-# LANGUAGE OverloadedStrings #-}

import Data.Aeson
import Data.Aeson.Key (fromText, toText)
import qualified Data.Aeson.KeyMap as KM
import qualified Data.ByteString.Lazy as BL
import qualified Data.Text as T
import qualified Data.Vector as V
import Data.Maybe
import Data.Char
import Data.Scientific
import System.Directory

txt :: Object -> [T.Text] -> T.Text
txt o keys = fromMaybe "" $ listToMaybe $ mapMaybe get keys
  where
    get k = case KM.lookup (fromText k) o of
      Just (String s) -> Just s
      Just (Number n) -> Just (T.pack (formatScientific Fixed Nothing n))
      Just (Bool b) -> Just (if b then "true" else "false")
      _ -> Nothing

val :: Object -> T.Text -> Value -> Value
val o k fallback = fromMaybe fallback (KM.lookup (fromText k) o)

loose :: T.Text -> T.Text
loose = T.unwords . T.words . T.toLower . T.map clean
  where clean c = if isAlphaNum c || isSpace c then c else ' '

arrEmpty :: Value
arrEmpty = Array V.empty

readJson :: FilePath -> IO (Maybe Value)
readJson p = do
  ok <- doesFileExist p
  if ok then decode <$> BL.readFile p else pure Nothing

rowsOf :: Value -> [Value]
rowsOf (Object o) = case KM.lookup "results" o of
  Just (Array a) -> V.toList a
  _ -> []
rowsOf _ = []

requestOf :: Value -> Object
requestOf (Object o) = case KM.lookup "request" o of
  Just (Object r) -> r
  _ -> KM.empty
requestOf _ = KM.empty

dataOf :: Value -> Object
dataOf (Object o) = case KM.lookup "data" o of
  Just (Object d) -> d
  _ -> KM.empty
dataOf _ = KM.empty

typeNorm :: T.Text -> T.Text
typeNorm t
  | t `elem` ["tv","series","show"] = "tv"
  | t == "movie" = "movie"
  | otherwise = t

parseKeyMeta :: T.Text -> (T.Text, T.Text)
parseKeyMeta k
  | "__series__" `T.isPrefixOf` k = ("tv", T.drop 10 k)
  | "__movie__" `T.isPrefixOf` k = ("movie", T.drop 9 k)
  | "series:" `T.isPrefixOf` k = ("tv", T.drop 7 k)
  | "tv:" `T.isPrefixOf` k = ("tv", T.drop 3 k)
  | "movie:" `T.isPrefixOf` k =
      let parts = T.splitOn ":" (T.drop 6 k)
      in ("movie", if length parts > 1 then T.intercalate ":" (init parts) else T.drop 6 k)
  | otherwise = ("", k)

putMissing :: T.Text -> T.Text -> Object -> Object
putMissing k v o
  | v == "" = o
  | txt o [k] /= "" = o
  | otherwise = KM.insert (fromText k) (String v) o

enrichFromKey :: T.Text -> Object -> Object
enrichFromKey k o =
  let (kt, title) = parseKeyMeta k
      o1 = putMissing "title" title o
      o2 = putMissing "name" title o1
      o3 = putMissing "type" kt o2
  in o3

cacheObjects :: Value -> [(T.Text, Object)]
cacheObjects (Object o) = mapMaybe go (KM.toList o)
  where
    go (k,v) = case v of
      Object x ->
        let key = toText k
            d = case KM.lookup "data" x of
              Just (Object y) -> y
              _ -> x
            enriched = enrichFromKey key d
        in if txt enriched ["poster","backdrop","overview","rating","genre","language","title","name"] /= ""
           then Just (key, enriched)
           else Nothing
      _ -> Nothing
cacheObjects _ = []

catalogItems :: Object -> T.Text -> [Value]
catalogItems catalog typ =
  let key = if typ == "tv" then "series" else "movies"
  in case KM.lookup key catalog of
    Just (Array a) -> V.toList a
    _ -> []

matchLocal :: T.Text -> T.Text -> [Value] -> Object
matchLocal typ title xs = fromMaybe KM.empty $ listToMaybe $ mapMaybe go xs
  where
    wanted = loose title
    go (Object o) =
      let t = loose (txt o ["title","name"])
      in if t == wanted || wanted `T.isInfixOf` t || t `T.isInfixOf` wanted
         then Just o else Nothing
    go _ = Nothing

matchFresh :: T.Text -> T.Text -> T.Text -> [(T.Text, Object)] -> Maybe Object
matchFresh typ reqTitle nodeTmdbId caches = listToMaybe $ mapMaybe good caches
  where
    wanted = loose reqTitle
    good (key,d) =
      let (keyType, keyTitle) = parseKeyMeta key
          did = txt d ["tmdbId","id"]
          dt = loose (txt d ["title","name"])
          kt = loose keyTitle
          mt = typeNorm (txt d ["type","media_type"])
          keyTypeNorm = typeNorm keyType
          typeOk = mt == "" || mt == typ || keyTypeNorm == "" || keyTypeNorm == typ
          idOk = nodeTmdbId /= "" && did == nodeTmdbId
          titleOk = wanted /= "" && (dt == wanted || kt == wanted || wanted `T.isInfixOf` dt || dt `T.isInfixOf` wanted || wanted `T.isInfixOf` kt || kt `T.isInfixOf` wanted)
      in if typeOk && (idOk || titleOk) then Just d else Nothing

localObject :: T.Text -> T.Text -> Object -> Object
localObject typ reqTitle item =
  let title = let t = txt item ["title","name"] in if t == "" then reqTitle else t
  in KM.fromList
    [ ("ok", Bool True), ("localOnly", Bool True), ("type", String typ)
    , ("title", String title), ("name", String title)
    , ("overview", String (txt item ["overview"]))
    , ("poster", String (txt item ["poster"]))
    , ("backdrop", String (txt item ["backdrop","poster"]))
    , ("year", String (txt item ["year"]))
    , ("rating", String (txt item ["rating"]))
    , ("runtime", String (txt item ["runtime"]))
    , ("genre", String (txt item ["genre"]))
    , ("genres", String (txt item ["genre"]))
    , ("language", String (txt item ["language"]))
    , ("ratings", arrEmpty), ("trailers", arrEmpty), ("cast", arrEmpty), ("crew", arrEmpty)
    , ("productionCompanies", val item "productionCompanies" arrEmpty)
    , ("similar", arrEmpty), ("moreByDirector", arrEmpty), ("director", Null)
    , ("about", arrEmpty), ("playbackInfo", arrEmpty)
    ]

buildRow :: Object -> [(T.Text, Object)] -> Value -> Value
buildRow catalog caches row =
  let req = requestOf row
      nodeData = dataOf row
      typ = typeNorm (txt req ["type"])
      title = txt req ["title"]
      nodeTmdbId = txt nodeData ["tmdbId","id"]
      local = localObject typ title (matchLocal typ title (catalogItems catalog typ))
      fresh = matchFresh typ title nodeTmdbId caches
      merged0 = case fresh of
        Just f -> KM.union f local
        Nothing -> local
      merged = KM.insert "localOnly" (Bool (isNothing fresh)) merged0
  in object [ "request" .= Object req, "status" .= (200 :: Int), "ok" .= True, "data" .= Object merged ]

main :: IO ()
main = do
  createDirectoryIfMissing True "tools/details-parity-v1/out"

  Just (Object catalog) <- readJson "catalog.json"
  Just node <- readJson "tools/details-parity-v1/out/node-details-fixtures.json"

  detailCache <- readJson "detail-cache.json"
  posterCache <- readJson "poster-cache.json"

  let caches = maybe [] cacheObjects detailCache ++ maybe [] cacheObjects posterCache
  let rows = rowsOf node
  let built = map (buildRow catalog caches) rows

  BL.writeFile "tools/details-parity-v1/out/haskell-details-fixtures.json" $
    encode $ object
      [ "generatedAt" .= ("native-cache-v2-haskell" :: T.Text)
      , "base" .= ("detail-cache+poster-cache-readonly" :: T.Text)
      , "cacheEntries" .= length caches
      , "count" .= length built
      , "results" .= built
      ]

  putStrLn ("Wrote Haskell fixtures using cache entries: " ++ show (length caches))
