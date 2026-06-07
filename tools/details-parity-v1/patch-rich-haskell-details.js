const fs = require("fs");
const path = require("path");

const file = "tools/details-parity-v1/NativeCachedDetails.hs";
let s = fs.readFileSync(file, "utf8");

if (!s.includes("richNormalize :: Object -> Object")) {
  s = s.replace(
'buildRow :: Object -> [(T.Text, Object)] -> Value -> Value',
`getObj :: Object -> T.Text -> Object
getObj o k = case KM.lookup (fromText k) o of
  Just (Object x) -> x
  _ -> KM.empty

getArr :: Object -> [T.Text] -> Value
getArr o keys = fromMaybe arrEmpty (listToMaybe (mapMaybe go keys))
  where
    go k = case KM.lookup (fromText k) o of
      Just (Array a) -> Just (Array a)
      Just (Object x) ->
        case KM.lookup (fromText "results") x of
          Just (Array a) -> Just (Array a)
          _ -> Nothing
      _ -> Nothing

putIfMissingVal :: T.Text -> Value -> Object -> Object
putIfMissingVal k v o =
  case KM.lookup (fromText k) o of
    Just (Array a) | V.length a > 0 -> o
    Just (String t) | not (T.null t) -> o
    Just _ -> o
    _ -> KM.insert (fromText k) v o

richNormalize :: Object -> Object
richNormalize o =
  let credits = getObj o "credits"
      videos = getObj o "videos"
      similarObj = getObj o "similar"
      recObj = getObj o "recommendations"

      castV = getArr credits ["cast"]
      crewV = getArr credits ["crew"]
      trailersV = getArr videos ["results"]
      similarV =
        case getArr similarObj ["results"] of
          Array a | V.length a > 0 -> Array a
          _ -> getArr recObj ["results"]

      companiesV = getArr o ["productionCompanies","production_companies"]
      genresV = getArr o ["genres"]
      genreText = txt o ["genre"]
      runtimeText = txt o ["runtime"]
      langText = txt o ["language","original_language"]
      ratingText = txt o ["rating","vote_average"]
      yearText = txt o ["year","release_date","first_air_date"]

      o1 = putIfMissingVal "cast" castV o
      o2 = putIfMissingVal "crew" crewV o1
      o3 = putIfMissingVal "trailers" trailersV o2
      o4 = putIfMissingVal "similar" similarV o3
      o5 = putIfMissingVal "productionCompanies" companiesV o4
      o6 = putIfMissing "genre" genreText o5
      o7 = putIfMissing "genres" genreText o6
      o8 = putIfMissing "runtime" runtimeText o7
      o9 = putIfMissing "language" langText o8
      o10 = putIfMissing "rating" ratingText o9
      o11 = putIfMissing "year" yearText o10
  in o11

buildRow :: Object -> [(T.Text, Object)] -> Value -> Value`
  );

  s = s.replace(
'Just f -> KM.union f local',
'Just f -> KM.union (richNormalize f) local'
  );
}

fs.writeFileSync(file, s);
console.log("Patched NativeCachedDetails.hs rich normalization");
