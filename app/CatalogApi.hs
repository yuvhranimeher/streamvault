{-# LANGUAGE OverloadedStrings #-}

module CatalogApi
  ( CatalogState
  , CatalogCache
  , newCatalogCache
  , loadCatalogState
  , catalogResponseCached
  , catalogResponse
  ) where

import Control.Applicative ((<|>))
import Control.Exception (SomeException, displayException, try)
import Data.Aeson
import Data.Aeson.Key (fromText, toText)
import qualified Data.ByteString.Char8 as BS8
import qualified Data.ByteString.Lazy.Char8 as BLC
import qualified Data.Aeson.KeyMap as KM
import qualified Data.ByteString.Lazy as BL
import Data.Char (isAlphaNum, isDigit, isSpace, toLower)
import Data.List (find, foldl', isInfixOf, isPrefixOf, nub, sortBy)
import qualified Data.Map.Strict as M
import Data.Maybe (fromMaybe, listToMaybe, mapMaybe)
import qualified Data.Set as Set
import qualified Data.Text as T
import qualified Data.Text.Encoding as TE
import qualified Data.Text.Encoding.Error as TEE
import qualified Data.Vector as V
import Data.IORef (IORef, newIORef, readIORef, writeIORef)
import qualified Data.IntSet as IS
import Network.HTTP.Types (Status, status200, status302, status500)
import Network.HTTP.Types.Header (ResponseHeaders)
import Network.HTTP.Types.URI (urlDecode)
import Network.Wai (Request, Response, pathInfo, queryString, requestHeaders, requestMethod, responseLBS)
import System.Directory (doesDirectoryExist, doesFileExist, listDirectory)
import System.Environment (lookupEnv)
import System.FilePath ((</>), takeBaseName, takeExtension)
import System.IO (hPutStrLn, stderr)

import CryptoHashCompat (sha1Hex16)

data CatalogState = CatalogState
  { csRoot          :: FilePath
  , csCatalogMovies :: [Value]
  , csCatalogSeries :: [Value]
  , csLocalMovies   :: [Value]
  , csLocalSeries   :: [Value]
  , csDownloads     :: [Value]
  , csChannels      :: Value
  , csDetailCache   :: KM.KeyMap Value
  , csEpisodeTitleCache :: KM.KeyMap Value
  , csSearchCache   :: IORef (Maybe SearchIndex)
  }

type CatalogCache = IORef (Maybe CatalogState)

data PageMode = ZeroBased | OneBased deriving (Eq)

data SearchEntry = SearchEntry
  { seItem         :: Value
  , seKind         :: T.Text
  , seNameNorm     :: T.Text
  , seFileNorm     :: T.Text
  , seSearchNorm   :: T.Text
  , seNameTokens   :: [T.Text]
  , seSearchTokens :: [T.Text]
  }

data SearchIndex = SearchIndex
  { siEntries      :: V.Vector SearchEntry
  , siTokenMap     :: M.Map T.Text [Int]
  , siNameTokenMap :: M.Map T.Text [Int]
  , siPrefixMap    :: M.Map T.Text [T.Text]
  }

data MassiveEpisode = MassiveEpisode
  { meSeason  :: Int
  , meEpisode :: Int
  , meFile    :: T.Text
  , meUrl     :: T.Text
  }

data MassiveSeriesBucket = MassiveSeriesBucket
  { msName     :: T.Text
  , msYear     :: T.Text
  , msEpisodes :: [MassiveEpisode]
  }

type MassiveAccum = (Set.Set T.Text, [Value], M.Map T.Text MassiveSeriesBucket)

videoExts :: [String]
videoExts = [".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv", ".m4v", ".mpg", ".mpeg", ".3gp"]

newCatalogCache :: IO CatalogCache
newCatalogCache = newIORef Nothing

loadCatalogState :: FilePath -> IO CatalogState
loadCatalogState root = do
  catalog <- readJsonValue (root </> "catalog.json") (Object KM.empty)
  posterCache <- readJsonObject (root </> "poster-cache.json")
  channels <- readJsonValue (root </> "channels.json") (Array V.empty)
  detailCache <- readJsonObject (root </> "detail-cache.json")
  episodeTitleCache <- readJsonObject (root </> "episode-title-cache.json")
  downloads <- loadDownloads root
  localMovies <- buildLocalMovies root posterCache
  localSeriesItems <- buildLocalSeries root posterCache
  searchCache <- newIORef Nothing
  let catalogMovies = dedupeBy titleYearKey (arrayField "movies" catalog)
      catalogSeries = dedupeBy titleYearKey (arrayField "series" catalog)
  pure CatalogState
    { csRoot = root
    , csCatalogMovies = catalogMovies
    , csCatalogSeries = catalogSeries
    , csLocalMovies = localMovies
    , csLocalSeries = localSeriesItems
    , csDownloads = downloads
    , csChannels = channels
    , csDetailCache = detailCache
    , csEpisodeTitleCache = episodeTitleCache
    , csSearchCache = searchCache
    }

catalogResponseCached :: FilePath -> Bool -> CatalogCache -> Request -> IO (Maybe Response)
catalogResponseCached root searchNativeEnabled cache req = do
  nativeRoute <- nativeCatalogRouteEnabled searchNativeEnabled req
  if requestMethod req == "OPTIONS" && nativeRoute
    then pure $ Just $ responseWith status200 [("Access-Control-Allow-Origin", "*")] ""
    else if requestMethod req /= "GET" || not nativeRoute
      then pure Nothing
      else do
        cached <- readIORef cache
        stateResult <- case cached of
          Just state -> pure (Right state)
          Nothing -> do
            loaded <- try (loadCatalogState root) :: IO (Either SomeException CatalogState)
            case loaded of
              Right state -> writeIORef cache (Just state) >> pure (Right state)
              Left e -> pure (Left e)
        case stateResult of
          Right state
            | searchDebugRoute req ->
                searchNativeResponse state req "native-search-debug"
            | searchWarmupRoute req ->
                searchWarmupResponse state
            | searchNativeEnabled && searchApiRoute req ->
                searchNativeResponse state req "native-search"
            | otherwise ->
                pure (catalogResponse state req)
          Left _ -> pure Nothing

nativeCatalogRouteEnabled :: Bool -> Request -> IO Bool
nativeCatalogRouteEnabled searchNativeEnabled req =
  pure $ nativeCatalogRoute req || searchDebugRoute req || searchWarmupRoute req || (searchNativeEnabled && searchApiRoute req)

searchNativeResponse :: CatalogState -> Request -> T.Text -> IO (Maybe Response)
searchNativeResponse state req marker = do
  result <- try (searchResponseCached state req marker) :: IO (Either SomeException Response)
  case result of
    Right res -> pure (Just res)
    Left e
      | marker == "native-search-debug" ->
          pure . Just $ jsonResponseStatus status500
            [("X-StreamVault-Haskell", "native-search-debug-error")]
            (object
              [ "ok" .= False
              , "error" .= String "HASKELL_SEARCH_FAILED"
              , "message" .= displayException e
              ])
      | otherwise -> do
          hPutStrLn stderr ("native search failed, proxying to Node: " ++ displayException e)
          pure Nothing

searchWarmupResponse :: CatalogState -> IO (Maybe Response)
searchWarmupResponse state = do
  result <- try (getSearchIndex state) :: IO (Either SomeException SearchIndex)
  case result of
    Right index ->
      pure . Just $ jsonResponse
        [ ("Cache-Control", "no-store")
        , ("X-StreamVault-Haskell", "native-search-warmup")
        ]
        (object
          [ "ok" .= True
          , "indexed" .= True
          , "entries" .= V.length (siEntries index)
          ])
    Left e ->
      pure . Just $ jsonResponseStatus status500
        [("X-StreamVault-Haskell", "native-search-warmup-error")]
        (object
          [ "ok" .= False
          , "error" .= String "HASKELL_SEARCH_WARMUP_FAILED"
          , "message" .= displayException e
          ])

nativeCatalogRoute :: Request -> Bool
nativeCatalogRoute req =
  pathInfo req `elem`
    [ ["api", "downloads"]
    , ["api", "movies"]
    , ["api", "series"]
    , ["api", "home-feed"]
    , ["api", "channels"]
    , ["api", "title-details"]
    , ["api", "episode-titles"]
    ]
    || ["api", "section"] `isPrefixOf` pathInfo req
    || ["api", "details"] `isPrefixOf` pathInfo req
    || ["download"] `isPrefixOf` pathInfo req

searchDebugRoute :: Request -> Bool
searchDebugRoute req =
  pathInfo req == ["__haskell-search-debug"]

searchWarmupRoute :: Request -> Bool
searchWarmupRoute req =
  pathInfo req == ["__haskell-search-warmup"]

searchApiRoute :: Request -> Bool
searchApiRoute req =
  pathInfo req == ["api", "search"]

catalogResponse :: CatalogState -> Request -> Maybe Response
catalogResponse state req
  | requestMethod req == "OPTIONS" =
      Just $ responseWith status200 [("Access-Control-Allow-Origin", "*")] ""
  | requestMethod req /= "GET" = Nothing
  | pathInfo req == ["api", "downloads"] =
      Just $ jsonResponse [("Cache-Control", "no-store"), ("X-StreamVault-Haskell", "native-downloads")]
        (downloadsResponse state req)
  | ["download"] `isPrefixOf` pathInfo req =
      case drop 1 (pathInfo req) of
        (ident:_) -> fmap downloadRedirectResponse (downloadRedirectLocation state ident)
        _ -> Nothing
  | pathInfo req == ["api", "movies"] =
      Just $ jsonResponse [("X-StreamVault-Haskell", "native-movies")]
        (moviesResponse state req)
  | pathInfo req == ["api", "series"] =
      Just $ jsonResponse [("X-StreamVault-Haskell", "native-series")]
        (seriesResponse state req)
  | pathInfo req == ["api", "home-feed"] =
      Just $ jsonResponse [("Cache-Control", "public, max-age=60"), ("X-StreamVault-Haskell", "native-home-feed")]
        (homeFeedResponse state req)
  | pathInfo req == ["api", "channels"] =
      Just $ jsonResponse [("X-StreamVault-Haskell", "native-channels")]
        (csChannels state)
  | pathInfo req == ["api", "title-details"] =
      fmap
        (jsonResponse
          [ ("Cache-Control", "public, max-age=900")
          , ("X-StreamVault-Haskell", "native-title-details-cache")
          , ("X-StreamVault-Haskell-Metadata", "native-title-details-cache")
          ])
        (titleDetailsResponse state req)
  | pathInfo req == ["api", "episode-titles"] =
      fmap
        (jsonResponse
          [ ("X-StreamVault-Haskell", "native-episode-titles-cache")
          , ("X-StreamVault-Haskell-Metadata", "native-episode-titles-cache")
          ])
        (episodeTitlesResponse state req)
  | ["api", "section"] `isPrefixOf` pathInfo req =
      case drop 2 (pathInfo req) of
        (key:_) -> Just $ jsonResponse [("Cache-Control", "public, max-age=60"), ("X-StreamVault-Haskell", "native-section")]
          (sectionResponse state req key)
        _ -> Nothing
  | ["api", "details"] `isPrefixOf` pathInfo req && not (detailsShadowBypassRequest req) =
      fmap (jsonResponse [("Cache-Control", "public, max-age=900"), ("X-StreamVault-Haskell", "native-details-cache")])
        (detailsResponse state req)
  | otherwise = Nothing

jsonResponse :: ResponseHeaders -> Value -> Response
jsonResponse extra body =
  jsonResponseStatus status200 extra body

jsonResponseStatus :: Status -> ResponseHeaders -> Value -> Response
jsonResponseStatus st extra body =
  responseWith st (("Content-Type", "application/json") : extra) (encode body)

downloadRedirectResponse :: T.Text -> Response
downloadRedirectResponse url =
  responseWith status302
    [ ("Content-Type", "text/plain; charset=utf-8")
    , ("Location", TE.encodeUtf8 url)
    , ("X-StreamVault-Haskell", "native-download-redirect")
    ]
    (BL.fromStrict (TE.encodeUtf8 ("Found. Redirecting to " <> url)))

responseWith :: Status -> ResponseHeaders -> BL.ByteString -> Response
responseWith st extra =
  responseLBS st (corsHeaders ++ extra)

corsHeaders :: ResponseHeaders
corsHeaders =
  [ ("Access-Control-Allow-Origin", "*")
  , ("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
  , ("Access-Control-Allow-Headers", "Content-Type, Range")
  ]

detailsShadowBypassRequest :: Request -> Bool
detailsShadowBypassRequest req =
  any headerEnabled ["x-streamvault-details-shadow", "x-streamvault-shadow-bypass"]
  where
    headerEnabled name =
      case lookup name (requestHeaders req) of
        Just "1" -> True
        _ -> False

readJsonValue :: FilePath -> Value -> IO Value
readJsonValue fp fallback = do
  exists <- doesFileExist fp
  if not exists
    then pure fallback
    else do
      raw <- try (BL.readFile fp) :: IO (Either SomeException BL.ByteString)
      case raw of
        Left _ -> pure fallback
        Right body -> pure (fromMaybe fallback (decode body))

readJsonObject :: FilePath -> IO (KM.KeyMap Value)
readJsonObject fp = do
  v <- readJsonValue fp (Object KM.empty)
  case v of
    Object o -> pure o
    _ -> pure KM.empty

arrayField :: T.Text -> Value -> [Value]
arrayField key (Object o) =
  case KM.lookup (fromText key) o of
    Just (Array xs) -> V.toList xs
    _ -> []
arrayField _ _ = []

valueText :: Value -> T.Text
valueText (String t) = t
valueText (Number n) = T.pack (show n)
valueText (Bool True) = "true"
valueText (Bool False) = "false"
valueText _ = ""

field :: T.Text -> Value -> Value
field key (Object o) = fromMaybe Null (KM.lookup (fromText key) o)
field _ _ = Null

fieldText :: T.Text -> Value -> T.Text
fieldText key = valueText . field key

firstText :: [T.Text] -> Value -> T.Text
firstText keys v = fromMaybe "" $ find (not . T.null) [fieldText k v | k <- keys]

fieldArray :: T.Text -> Value -> [Value]
fieldArray key v =
  case field key v of
    Array xs -> V.toList xs
    _ -> []

lookupObject :: T.Text -> KM.KeyMap Value -> Maybe Value
lookupObject key = KM.lookup (fromText key)

strLower :: String -> String
strLower = map toLower

textLower :: T.Text -> T.Text
textLower = T.toLower

trimText :: T.Text -> T.Text
trimText = T.dropAround isSpace

valueListText :: T.Text -> Value -> [T.Text]
valueListText key v =
  case field key v of
    Array xs -> [t | String t <- V.toList xs]
    String t | not (T.null t) -> [t]
    _ -> []

titleYearKey :: Value -> T.Text
titleYearKey item =
  textLower (firstText ["title", "name"] item) <> "|" <> fieldText "year" item

dedupeBy :: (Value -> T.Text) -> [Value] -> [Value]
dedupeBy keyOf = reverse . snd . foldl' step (Set.empty, [])
  where
    step (seen, out) item =
      let key = keyOf item
      in if key `Set.member` seen then (seen, out) else (Set.insert key seen, item : out)

isCartoonOrAnime :: Value -> Bool
isCartoonOrAnime item =
  let name = T.toLower (firstText ["name", "title"] item)
      genre = T.toLower (fieldText "genre" item)
      filename = T.toLower (firstText ["file", "filename"] item)
      hay = T.unpack (T.unwords [name, genre, filename])
      bad =
        [ "cartoon", "anime", "animated", "tv cartoon", "cartoon series"
        , "kids", "children", "pbs kids", "nickelodeon", "disney channel"
        , "cartoon network", "boomerang", "adult swim", "family guy", "simpsons"
        , "south park", "rick and morty", "sponge", "paw patrol", "peppa pig"
        , "anime movie", "animated movie"
        ]
  in "animation" `T.isInfixOf` genre || "anime" `T.isInfixOf` genre || any (`isInfixOf` hay) bad

listVideoFiles :: FilePath -> IO [FilePath]
listVideoFiles dir = do
  exists <- doesDirectoryExist dir
  if not exists
    then pure []
    else do
      names <- listDirectory dir
      pure [n | n <- names, strLower (takeExtension n) `elem` videoExts]

buildLocalMovies :: FilePath -> KM.KeyMap Value -> IO [Value]
buildLocalMovies root posters = do
  files <- listVideoFiles (root </> "movies")
  pure [localMovie posters idx file | (idx, file) <- zip [(0 :: Int)..] files]

localMovie :: KM.KeyMap Value -> Int -> FilePath -> Value
localMovie posters idx file =
  let name = cleanTitle file
      key = T.pack (takeBaseName file)
      info = lookupObject key posters
      infoField k = maybe Null (field k) info
  in object
    [ "id" .= idx
    , "name" .= name
    , "file" .= T.pack file
    , "poster" .= nullish (infoField "poster")
    , "tmdbId" .= nullish (infoField "tmdbId")
    , "overview" .= textOr "" (infoField "overview")
    , "year" .= textOr "" (infoField "year")
    , "rating" .= nullish (infoField "rating")
    , "type" .= String "movie"
    , "genre" .= textOr "" (infoField "genre")
    , "runtime" .= textOr "" (infoField "runtime")
    , "director" .= textOr "" (infoField "director")
    , "language" .= textOr "" (infoField "language")
    , "productionCompanies" .= arrayOrEmpty (infoField "productionCompanies")
    ]

textOr :: T.Text -> Value -> Value
textOr fallback Null = String fallback
textOr _ (String t) = String t
textOr _ v = v

arrayOrEmpty :: Value -> Value
arrayOrEmpty (Array xs) = Array xs
arrayOrEmpty _ = Array V.empty

nullish :: Value -> Value
nullish (String "") = Null
nullish v = v

buildLocalSeries :: FilePath -> KM.KeyMap Value -> IO [Value]
buildLocalSeries root posters = do
  movieFiles <- listVideoFiles (root </> "movies")
  seriesFiles <- listVideoFiles (root </> "series")
  let offset = length movieFiles
      episodes = mapMaybe (uncurry parseLocalEpisode) (zip [offset..] seriesFiles)
      grouped = groupEpisodes episodes
  pure (map (localSeries posters) grouped)

data Episode = Episode
  { epShow :: T.Text
  , epSeason :: Int
  , epNumber :: Int
  , epTitle :: T.Text
  , epStreamId :: Int
  , epFile :: FilePath
  }

parseLocalEpisode :: Int -> FilePath -> Maybe Episode
parseLocalEpisode idx file =
  let clean = cleanupEpisodeBase (T.pack (takeBaseName file))
      tokens = T.words clean
      lowerTokens = map T.toLower tokens
  in case findEpisodeToken lowerTokens of
       Just (beforeCount, seasonNum, epNum) ->
         let showName = trimText (T.unwords (take beforeCount tokens))
             rest = drop (beforeCount + 1) tokens
             title = trimText (T.unwords rest)
         in if T.null showName then Nothing else Just Episode
              { epShow = showName
              , epSeason = seasonNum
              , epNumber = epNum
              , epTitle = title
              , epStreamId = idx
              , epFile = file
              }
       Nothing -> Nothing

findEpisodeToken :: [T.Text] -> Maybe (Int, Int, Int)
findEpisodeToken = go 0
  where
    go _ [] = Nothing
    go n (x:xs) =
      case parseSxe x of
        Just (s, e) -> Just (n, s, e)
        Nothing -> go (n + 1) xs

parseSxe :: T.Text -> Maybe (Int, Int)
parseSxe token =
  let raw = T.unpack token
      (sPart, rest) = span (/= 'e') raw
  in case raw of
       ('s':_) | not (null rest) ->
         let sDigits = filter isDigit sPart
             eDigits = filter isDigit (drop 1 rest)
         in if null sDigits || null eDigits then Nothing else Just (read sDigits, read eDigits)
       _ -> Nothing

groupEpisodes :: [Episode] -> [(T.Text, [Episode])]
groupEpisodes =
  sortBy (\(a, _) (b, _) -> compare a b) . foldl' step []
  where
    step [] ep = [(epShow ep, [ep])]
    step ((showName, eps):rest) ep
      | showName == epShow ep = (showName, ep:eps) : rest
      | otherwise = (showName, eps) : step rest ep

localSeries :: KM.KeyMap Value -> (T.Text, [Episode]) -> Value
localSeries posters (showName, eps) =
  let key = "__series__" <> showName
      info = lookupObject key posters
      infoField k = maybe Null (field k) info
      seasons = seasonsObject eps
      base =
        [ "name" .= showName
        , "seasons" .= seasons
        ]
      extra = case info of
        Nothing -> []
        Just _ ->
          [ "poster" .= nullish (infoField "poster")
          , "tmdbId" .= nullish (infoField "tmdbId")
          , "overview" .= textOr "" (infoField "overview")
          , "year" .= textOr "" (infoField "year")
          , "rating" .= nullish (infoField "rating")
          , "genre" .= textOr "" (infoField "genre")
          , "language" .= textOr "" (infoField "language")
          , "productionCompanies" .= arrayOrEmpty (infoField "productionCompanies")
          ]
  in object (base ++ extra)

seasonsObject :: [Episode] -> Value
seasonsObject eps =
  Object $ KM.fromList
    [ (fromText (T.pack (show seasonNo)), Array (V.fromList (map episodeValue sorted)))
    | seasonNo <- nub (map epSeason eps)
    , let sorted = sortBy (\a b -> compare (epNumber a) (epNumber b)) [e | e <- eps, epSeason e == seasonNo]
    ]

episodeValue :: Episode -> Value
episodeValue ep =
  object
    [ "streamId" .= epStreamId ep
    , "episode" .= epNumber ep
    , "epTitle" .= if T.null (epTitle ep) then T.pack ("Episode " ++ show (epNumber ep)) else epTitle ep
    , "file" .= T.pack (epFile ep)
    ]

cleanTitle :: FilePath -> T.Text
cleanTitle file =
  let base = T.pack (takeBaseName file)
      spaced = cleanupSeparators base
      cut = cutAtAny qualityTokens spaced
      withoutBrackets = removeBracketContent cut
      withoutYear = stripTrailingYear (trimText withoutBrackets)
  in if T.length withoutYear >= 2 then withoutYear else trimText withoutBrackets

cleanupEpisodeBase :: T.Text -> T.Text
cleanupEpisodeBase =
  trimText . cutAtAny episodeCutTokens . removeBracketContent . cleanupSeparators

cleanupSeparators :: T.Text -> T.Text
cleanupSeparators =
  T.unwords . T.words . T.map repl
  where
    repl c
      | c == '.' || c == '_' = ' '
      | otherwise = c

removeBracketContent :: T.Text -> T.Text
removeBracketContent = T.pack . go 0 . T.unpack
  where
    go :: Int -> String -> String
    go _ [] = []
    go depth (c:cs)
      | c `elem` ("([{" :: String) = go (depth + 1) cs
      | c `elem` (")]}" :: String) = go (max 0 (depth - 1)) cs
      | depth > 0 = go depth cs
      | otherwise = c : go depth cs

stripTrailingYear :: T.Text -> T.Text
stripTrailingYear txt =
  case reverse (T.words txt) of
    (lastWord:rest)
      | T.length lastWord == 4 && T.all isDigit lastWord
          && lastWord >= "1900" && lastWord <= "2099" ->
          T.unwords (reverse rest)
    _ -> txt

qualityTokens :: [T.Text]
qualityTokens =
  [ "1080p", "720p", "480p", "4k", "2160p", "uhd", "bluray", "blu ray"
  , "webrip", "web dl", "hdtv", "x264", "x265", "hevc", "aac", "dts"
  , "extended", "remastered", "proper", "repack", "hdr", "dolby", "atmos"
  ]

episodeCutTokens :: [T.Text]
episodeCutTokens =
  [ "1080p", "720p", "480p", "2160p", "bluray", "brrip", "webrip"
  , "web dl", "hdtv", "x264", "x265", "hevc", "aac", "dts", "ac3"
  , "msubs", "esub", "dual", "hindi", "english", "multi", "pahe"
  ]

cutAtAny :: [T.Text] -> T.Text -> T.Text
cutAtAny needles text =
  let lowerText = T.toLower text
      positions =
        [ idx
        | needle <- needles
        , let idxs = findNeedlePositions needle lowerText
        , idx <- idxs
        ]
  in case positions of
       [] -> text
       xs -> trimText (T.take (minimum xs) text)

findNeedlePositions :: T.Text -> T.Text -> [Int]
findNeedlePositions needle text =
  go 0 text
  where
    go offset rest
      | T.null needle || T.null rest = []
      | needle `T.isPrefixOf` rest = offset : go (offset + 1) (T.drop 1 rest)
      | otherwise = go (offset + 1) (T.drop 1 rest)

loadDownloads :: FilePath -> IO [Value]
loadDownloads root = do
  let fp = root </> "data" </> "catalogs" </> "downloads-catalog.json"
  raw <- readJsonValue fp (Array V.empty)
  let items = case raw of
        Array xs -> V.toList xs
        Object o ->
          concat [fromArray (KM.lookup (fromText k) o) | k <- ["downloads", "items", "software", "apps", "files"]]
        _ -> []
      normalized = mapMaybe normalizeDownload (zip [(0 :: Int)..] items)
  pure (dedupeBy downloadDedupeKey normalized)

fromArray :: Maybe Value -> [Value]
fromArray (Just (Array xs)) = V.toList xs
fromArray _ = []

downloadDedupeKey :: Value -> T.Text
downloadDedupeKey item =
  T.toLower (firstText ["source", "url", "name"] item)

normalizeDownload :: (Int, Value) -> Maybe Value
normalizeDownload (idx, item) =
  let url = trimText $ firstText
        [ "source", "url", "href", "link", "downloadUrl", "downloadURL"
        , "download_url", "directUrl", "directURL", "fileUrl", "fileURL"
        , "path", "streamUrl", "src"
        ] item
      ext = T.toLower $ stripDot $ textFallback (firstText ["extension", "ext"] item) (softwareExt url)
      filename = textFallback (firstText ["filename", "file"] item) (lastUrlPart url)
      name = trimText $ textFallback (firstText ["name", "title", "label"] item) (softwareTitleFromUrl (textFallback filename url))
      platform = softwarePlatform item ext url
      category = softwareCategory item platform url
      ident = textFallback (fieldText "id" item) ("sw_" <> T.pack (sha1Hex16 (T.unpack (textFallback url name) ++ show idx)))
      sourceUrlOk = "http://" `T.isPrefixOf` T.toLower url || "https://" `T.isPrefixOf` T.toLower url || "ftp://" `T.isPrefixOf` T.toLower url
  in if not sourceUrlOk || T.length name < 2
       then Nothing
       else Just $ object
         [ "id" .= ident
         , "name" .= name
         , "filename" .= filename
         , "extension" .= ext
         , "category" .= category
         , "platform" .= platform
         , "type" .= textFallback (fieldText "type" item) category
         , "size" .= nullish (firstValue ["size", "bytes", "sizeBytes", "length"] item)
         , "icon" .= textFallback (firstText ["icon", "poster", "image"] item) ""
         , "source" .= url
         , "url" .= url
         ]

firstValue :: [T.Text] -> Value -> Value
firstValue keys item =
  fromMaybe Null $ find nonEmpty [field k item | k <- keys]
  where
    nonEmpty Null = False
    nonEmpty (String "") = False
    nonEmpty _ = True

textFallback :: T.Text -> T.Text -> T.Text
textFallback a b = if T.null a then b else a

stripDot :: T.Text -> T.Text
stripDot = T.dropWhile (== '.')

softwareExt :: T.Text -> T.Text
softwareExt url =
  let noQuery = T.takeWhile (/= '?') url
      part = lastUrlPart noQuery
  in T.dropWhile (== '.') $ snd (T.breakOnEnd "." part)

lastUrlPart :: T.Text -> T.Text
lastUrlPart url =
  let parts = T.splitOn "/" url
  in fromMaybe "" (listToMaybe (reverse parts))

softwareTitleFromUrl :: T.Text -> T.Text
softwareTitleFromUrl value =
  let raw = lastUrlPart value
      noExt = case T.breakOnEnd "." raw of
        ("", _) -> raw
        (a, _) -> T.dropEnd 1 a
      titled = T.unwords . T.words $ T.map (\c -> if c == '.' || c == '_' || c == '-' then ' ' else c) noExt
  in textFallback titled (textFallback raw "Untitled")

softwarePlatform :: Value -> T.Text -> T.Text -> T.Text
softwarePlatform item ext url =
  let text = T.toLower (T.unwords [fieldText "platform" item, fieldText "category" item, fieldText "type" item, firstText ["name", "title"] item, url])
  in if ext `elem` ["apk", "xapk", "apks"] || "android" `T.isInfixOf` text then "Android"
     else if ext `elem` ["exe", "msi"] || "windows" `T.isInfixOf` text then "Windows"
     else if ext `elem` ["dmg", "pkg"] || "mac" `T.isInfixOf` text then "macOS"
     else if ext `elem` ["iso", "img"] || "operating system" `T.isInfixOf` text || "/os/" `T.isInfixOf` text then "OS"
     else if ext `elem` ["nsp", "xci", "cia", "3ds", "gba", "nds", "nes", "snes", "wbfs"] || "console" `T.isInfixOf` text then "Console"
     else if ext `elem` ["zip", "rar", "7z"] then "Archive"
     else textFallback (fieldText "platform" item) "Other"

softwareCategory :: Value -> T.Text -> T.Text -> T.Text
softwareCategory item platform url =
  let text = T.toLower (T.unwords [fieldText "category" item, fieldText "type" item, firstText ["name", "title"] item, url])
  in if "game" `T.isInfixOf` text then if platform == "Console" then "Console Games" else "Games"
     else if platform == "Android" then "Android"
     else if platform == "Windows" then "Software"
     else if platform == "OS" then "OS"
     else if platform == "Archive" then "Archives"
     else textFallback (fieldText "category" item) (textFallback platform "Other")

queryText :: T.Text -> Request -> Maybe T.Text
queryText name req =
  let wanted = TE.encodeUtf8 name
  in fmap (TE.decodeUtf8With TEE.lenientDecode) (joinMaybe (lookup wanted (queryString req)))

joinMaybe :: Maybe (Maybe a) -> Maybe a
joinMaybe (Just (Just x)) = Just x
joinMaybe _ = Nothing

queryInt :: T.Text -> Int -> Request -> Int
queryInt name fallback req =
  maybe fallback (readInt fallback . T.unpack) (queryText name req)

readInt :: Int -> String -> Int
readInt fallback raw =
  case reads raw of
    [(n, "")] -> n
    _ -> fallback

pageSlice :: PageMode -> Int -> Int -> [Value] -> (Int, Int, [Value], Int)
pageSlice mode page limit items =
  let safeLimit = min 120 (max 1 limit)
      safePage = case mode of
        ZeroBased -> max 0 page
        OneBased -> max 1 page
      start = case mode of
        ZeroBased -> safePage * safeLimit
        OneBased -> (safePage - 1) * safeLimit
      total = length items
      pages = pageCount safeLimit total
  in (safePage, pages, take safeLimit (drop start items), total)

pageCount :: Int -> Int -> Int
pageCount limit total =
  max 1 (ceiling (fromIntegral total / fromIntegral limit :: Double))

downloadsResponse :: CatalogState -> Request -> Value
downloadsResponse state req =
  let q = T.toLower . trimText $ fromMaybe "" (queryText "q" req)
      terms = filter (not . T.null) (T.words q)
      filtered =
        if null terms
          then csDownloads state
          else filter (downloadMatches terms) (csDownloads state)
      limit = min 50000 (max 1 (queryInt "limit" 50000 req))
      page = max 0 (queryInt "page" 0 req)
      start = page * limit
      total = length filtered
      pages = pageCount limit total
  in object
    [ "items" .= take limit (drop start filtered)
    , "total" .= total
    , "page" .= page
    , "pages" .= pages
    ]

downloadRedirectLocation :: CatalogState -> T.Text -> Maybe T.Text
downloadRedirectLocation state ident = do
  item <- find (\entry -> fieldText "id" entry == ident) (csDownloads state)
  let url = textFallback (fieldText "source" item) (fieldText "url" item)
  if T.null url then Nothing else Just url

downloadMatches :: [T.Text] -> Value -> Bool
downloadMatches terms item =
  let text = T.toLower (T.unwords [fieldText "name" item, fieldText "filename" item, fieldText "category" item, fieldText "platform" item, fieldText "extension" item])
  in all (`T.isInfixOf` text) terms

ftpMovieRouteItems :: CatalogState -> [Value]
ftpMovieRouteItems state =
  [ object
    [ "id" .= T.pack ("ftp_" ++ show i)
    , "name" .= fieldText "title" m
    , "title" .= fieldText "title" m
    , "file" .= fieldText "filename" m
    , "poster" .= nullish (field "poster" m)
    , "backdrop" .= fallbackValue (field "backdrop" m) (field "poster" m)
    , "tmdbId" .= nullish (field "tmdbId" m)
    , "year" .= textOr "" (field "year" m)
    , "rating" .= nullish (field "rating" m)
    , "type" .= String "movie"
    , "genre" .= textOr "" (field "genre" m)
    , "category" .= textOr "" (field "category" m)
    , "streamUrl" .= fieldText "streamUrl" m
    , "isFtp" .= True
    ]
  | (i, m) <- zip [(0 :: Int)..] (filter (not . isCartoonOrAnime) (csCatalogMovies state))
  ]

fallbackValue :: Value -> Value -> Value
fallbackValue Null b = nullish b
fallbackValue (String "") b = nullish b
fallbackValue a _ = a

moviesList :: CatalogState -> [Value]
moviesList state =
  let local = csLocalMovies state
      seen = [T.toLower (firstText ["name", "title"] m) <> "|" <> fieldText "year" m | m <- local]
      ftp = filter (\m -> (T.toLower (firstText ["name", "title"] m) <> "|" <> fieldText "year" m) `notElem` seen) (ftpMovieRouteItems state)
  in local ++ ftp

moviesResponse :: CatalogState -> Request -> Value
moviesResponse state req =
  let base = moviesList state
      items = applyBrowseSearch "movies" req base
      (page, pages, pageItems, total) = pageSlice ZeroBased (queryInt "page" 0 req) (queryInt "limit" 72 req) items
  in object
    [ "movies" .= pageItems
    , "total" .= total
    , "page" .= page
    , "pages" .= pages
    ]

ftpSeriesRouteItems :: Int -> CatalogState -> [Value]
ftpSeriesRouteItems requestedLimit state =
  let raw = if requestedLimit > 0
        then take (max 0 (requestedLimit - length (csLocalSeries state))) (csCatalogSeries state)
        else csCatalogSeries state
  in [seriesRouteValue s | s <- filter (not . isCartoonOrAnime) raw]

seriesRouteValue :: Value -> Value
seriesRouteValue s =
  object
    [ "name" .= fieldText "title" s
    , "title" .= fieldText "title" s
    , "poster" .= nullish (field "poster" s)
    , "backdrop" .= fallbackValue (field "backdrop" s) (field "poster" s)
    , "tmdbId" .= nullish (field "tmdbId" s)
    , "year" .= textOr "" (field "year" s)
    , "rating" .= nullish (field "rating" s)
    , "genre" .= textOr "" (field "genre" s)
    , "type" .= String "series"
    , "isFtp" .= True
    , "seasons" .= ftpSeasonsObject s
    ]

ftpSeasonsObject :: Value -> Value
ftpSeasonsObject s =
  Object $ KM.fromList
    [ (fromText (T.pack (show seasonNo)), Array (V.fromList eps))
    | seasonObj <- fieldArray "seasons" s
    , let seasonNo = seasonNumber (fieldText "season" seasonObj)
          eps = [ftpEpisodeValue ep idx | (idx, ep) <- zip [(0 :: Int)..] (fieldArray "episodes" seasonObj)]
    ]

seasonNumber :: T.Text -> Int
seasonNumber label =
  case filter (not . null) (map (filter isDigit . T.unpack) (T.words label)) of
    (x:_) -> readInt 1 x
    [] -> 1

ftpEpisodeValue :: Value -> Int -> Value
ftpEpisodeValue ep idx =
  let filename = fieldText "filename" ep
      parsed = parseEpisodeNumber filename
      epNum = fromMaybe (idx + 1) parsed
  in object
    [ "streamId" .= Null
    , "episode" .= epNum
    , "epTitle" .= T.pack ("Episode " ++ show epNum)
    , "file" .= filename
    , "streamUrl" .= fieldText "streamUrl" ep
    , "isFtp" .= True
    ]

parseEpisodeNumber :: T.Text -> Maybe Int
parseEpisodeNumber filename =
  let tokens = map T.toLower (T.words (cleanupSeparators filename))
  in listToMaybe (mapMaybe (fmap snd . parseSxe) tokens)

seriesList :: CatalogState -> Request -> [Value]
seriesList state req =
  let requestedLimit = max 0 (queryInt "limit" 0 req)
      hasQ = maybe False (not . T.null . trimText) (queryText "q" req)
      ftpLimit = if requestedLimit > 0 && not hasQ then requestedLimit else 0
      local = csLocalSeries state
      seen = [T.toLower (firstText ["name", "title"] s) | s <- local]
      ftp = filter (\s -> T.toLower (firstText ["name", "title"] s) `notElem` seen) (ftpSeriesRouteItems ftpLimit state)
  in local ++ ftp

seriesResponse :: CatalogState -> Request -> Value
seriesResponse state req =
  let allSeries = seriesList state req
      hasPage = maybe False (const True) (queryText "page" req)
      hasQ = maybe False (not . T.null . trimText) (queryText "q" req)
      requestedLimit = max 0 (queryInt "limit" 0 req)
  in if hasPage || hasQ
       then
         let items = applyBrowseSearch "series" req allSeries
             (page, pages, pageItems, total) = pageSlice ZeroBased (queryInt "page" 0 req) (queryInt "limit" 72 req) items
         in object ["series" .= pageItems, "total" .= total, "page" .= page, "pages" .= pages]
       else Array (V.fromList (if requestedLimit > 0 then take requestedLimit allSeries else allSeries))

applyBrowseSearch :: T.Text -> Request -> [Value] -> [Value]
applyBrowseSearch kind req items =
  case queryText "q" req of
    Nothing -> items
    Just raw ->
      let terms = searchTerms raw
      in if null terms then items else map snd (rankSearch kind terms items)

rankSearch :: T.Text -> [T.Text] -> [Value] -> [(Int, Value)]
rankSearch kind terms items =
  take 120 $
    sortBy cmp
      [ (searchScore terms item, item)
      | item <- items
      , kindMatches kind item
      , let score = searchScore terms item
      , score > 0
      ]
  where
    cmp (sa, a) (sb, b) =
      case compare sb sa of
        EQ -> compare (firstText ["name", "title"] a) (firstText ["name", "title"] b)
        other -> other

kindMatches :: T.Text -> Value -> Bool
kindMatches "movie" item = fieldText "type" item /= "series"
kindMatches "series" item = fieldText "type" item == "series" || field "seasons" item /= Null
kindMatches _ _ = True

searchScore :: [T.Text] -> Value -> Int
searchScore terms item =
  let name = normalizeSearch (canonicalTitle (firstText ["name", "title", "file", "filename"] item) (fieldText "year" item))
      fileText = normalizeSearch (firstText ["file", "filename", "streamUrl"] item)
      hay = normalizeSearch (T.unwords
        [ name
        , firstText ["name", "title"] item
        , firstText ["file", "filename", "streamUrl"] item
        , fieldText "overview" item
        , fieldText "genre" item
        , fieldText "category" item
        , fieldText "language" item
        , fieldText "year" item
        ])
      phrase = T.unwords terms
      allHit = all (`T.isInfixOf` hay) terms
      exactName = if name == phrase then 9000 else 0
      startName = if phrase `T.isPrefixOf` name then 7600 else 0
      inName = if phrase `T.isInfixOf` name then 5400 else 0
      inFile = if phrase `T.isInfixOf` fileText then 1300 else 0
      art = if field "poster" item /= Null || field "backdrop" item /= Null then 420 else 0
      source = if field "isMassiveCatalog" item == Bool True then 0 else 260
      rating = round (min 75 (ratingNum item * 7))
      yearBonus = min 25 (max 0 ((yearNum item - 1980) `div` 2))
  in if not allHit then 0 else maximum [exactName, startName, inName, inFile, 1] + art + source + rating + yearBonus

searchTerms :: T.Text -> [T.Text]
searchTerms =
  take 8 . searchTokensFromText

searchTokensFromText :: T.Text -> [T.Text]
searchTokensFromText =
  reverse . snd . foldl' keepToken (Set.empty, []) . T.words . normalizeSearch
  where
    stop = ["in", "on", "of", "to", "a", "an", "the", "and", "or", "for", "with", "by", "from"]
    keepToken (seen, out) t
      | T.length t < 2 = (seen, out)
      | t `elem` stop = (seen, out)
      | t `Set.member` seen = (seen, out)
      | otherwise = (Set.insert t seen, t : out)

normalizeSearch :: T.Text -> T.Text
normalizeSearch value =
  T.unwords . T.words . T.map repl . T.toLower $ noApostrophes
  where
    withAnd = T.replace "&" " and " value
    noApostrophes = T.filter (`notElem` ("'`" :: String)) withAnd
    repl '&' = ' '
    repl c | isAlphaNum c = c
           | otherwise = ' '

canonicalTitle :: T.Text -> T.Text -> T.Text
canonicalTitle raw year =
  let cleaned0 = T.unwords . T.words $ T.map (\c -> if c `elem` (".-_[](){}+" :: String) then ' ' else c) raw
      cleaned = stripLeadingReleaseNumber cleaned0
      cutYear = if T.null year then cleaned else fst (T.breakOn year cleaned)
      tokens = filter keepToken (T.words (if T.null cutYear then cleaned else cutYear))
  in if null tokens then cleaned else T.unwords tokens
  where
    junk =
      [ "480p", "576p", "720p", "1080p", "1440p", "2160p", "4k", "8k"
      , "uhd", "hdr", "hdr10", "dv", "web", "webdl", "web-dl", "webrip"
      , "bluray", "brrip", "brip", "dvdrip", "hdrip", "hdtv", "hdcam", "hdtc"
      , "camrip", "amzn", "nf", "netflix", "dsnp", "disney", "hotstar", "hulu"
      , "max", "itunes", "x264", "x265", "h264", "h265", "hevc", "avc", "xvid"
      , "aac", "ac3", "eac3", "ddp", "dts", "truehd", "atmos", "10bit", "8bit"
      , "dual", "multi", "audio", "hindi", "english", "bengali", "bangla", "tamil"
      , "telugu", "malayalam", "kannada", "punjabi", "korean", "japanese", "chinese"
      , "french", "spanish", "russian", "turkish", "arabic", "org", "uncut"
      , "unrated", "proper", "repack", "rerip", "remux", "internal", "limited"
      , "complete", "collection", "converted", "reencoded", "encode"
      , "encoded", "recoded", "recode", "sample", "trailer", "esub", "msub"
      , "msubs", "sub", "subs", "subbed", "dubbed", "dolby", "vision", "imax"
      , "scr", "xvid", "divx", "60fps", "30fps", "23fps", "sdr", "hd", "us"
      , "yts", "yify", "rarbg"
      , "galaxyrg", "mkvcage", "mkvhub", "hdhub4u", "downloadhub", "cinevood"
      , "msmod", "psa", "pahe", "tigole", "mkv", "free", "mkvc", "hdhub"
      , "ntg", "evo", "ctrlhd", "shaanig", "shaang", "mx", "ganool", "rmteam"
      , "ettv", "etrg", "sparks", "spray", "sprite", "hon3y", "kmhd"
      ]
    keepToken t =
      let k = T.toLower t
      in k `notElem` junk && not (T.length t == 4 && T.all isDigit t)

stripLeadingReleaseNumber :: T.Text -> T.Text
stripLeadingReleaseNumber value =
  case T.words value of
    (x:xs)
      | T.length x <= 3
      , T.all isDigit x ->
          T.unwords xs
    _ -> value

searchResponseCached :: CatalogState -> Request -> T.Text -> IO Response
searchResponseCached state req marker = do
  let rawQ = trimText (fromMaybe "" (queryText "q" req))
      limit = min 120 (max 1 (queryInt "limit" 72 req))
      page = max 1 (queryInt "page" 1 req)
      emptyBody = object
        [ "items" .= ([] :: [Value])
        , "total" .= (0 :: Int)
        , "page" .= page
        , "pages" .= (0 :: Int)
        , "instant" .= True
        ]
      headers =
        [ ("Cache-Control", "no-store")
        , ("X-StreamVault-Haskell", TE.encodeUtf8 marker)
        ]
  if T.length rawQ < 2
    then pure $ jsonResponse headers emptyBody
    else do
      index <- getSearchIndex state
      let kind = searchKindFromRequest req
          results = nativeSearchResults index rawQ kind
          total = length results
          start = (page - 1) * limit
          pageItems = take limit (drop start results)
          pages = pageCount limit total
          body = object
            [ "items" .= pageItems
            , "total" .= total
            , "page" .= page
            , "pages" .= pages
            , "instant" .= True
            , "indexed" .= True
            ]
      pure $ jsonResponse headers body

getSearchIndex :: CatalogState -> IO SearchIndex
getSearchIndex state = do
  cached <- readIORef (csSearchCache state)
  case cached of
    Just index -> pure index
    Nothing -> do
      index <- buildSearchIndex state
      writeIORef (csSearchCache state) (Just index)
      pure index

buildSearchIndex :: CatalogState -> IO SearchIndex
buildSearchIndex state = do
  massiveMode <- lookupEnv "STREAMVAULT_HASKELL_SEARCH_MASSIVE"
  (massiveMovies, massiveSeries) <-
    case massiveMode of
      Just "1" -> loadMassiveSearchItems state
      Just "full" -> loadMassiveSearchItems state
      Just "0" -> pure ([], [])
      _ -> loadFastMassiveSearchItems state
  let baseMovies = searchBaseMovies state
      baseSeries = searchBaseSeries state
      bridge = searchPosterBridge (csLocalMovies state ++ csLocalSeries state ++ csCatalogMovies state ++ csCatalogSeries state)
      hydratedMassiveMovies = map (hydrateMassiveSearchItem bridge "movie") massiveMovies
      hydratedMassiveSeries = map (hydrateMassiveSearchItem bridge "series") massiveSeries
      ordered = dedupeSearchItems $
        [(item, "movie") | item <- baseMovies]
          ++ [(item, "movie") | item <- hydratedMassiveMovies]
          ++ [(item, "series") | item <- baseSeries]
          ++ [(item, "series") | item <- hydratedMassiveSeries]
      entries = V.fromList [makeSearchEntry item kind | (item, kind) <- ordered]
  pure (indexEntries entries)

searchBaseMovies :: CatalogState -> [Value]
searchBaseMovies state =
  filter (not . isCartoonOrAnime) (csLocalMovies state) ++ ftpMovieRouteItems state

searchBaseSeries :: CatalogState -> [Value]
searchBaseSeries state =
  map ensureSearchSeriesFields (filter (not . isCartoonOrAnime) (csLocalSeries state)) ++ ftpSeriesSearchItems state

ensureSearchSeriesFields :: Value -> Value
ensureSearchSeriesFields =
  insertFields
    [ ("type", String "series")
    , ("_isSeries", Bool True)
    ]

ftpSeriesSearchItems :: CatalogState -> [Value]
ftpSeriesSearchItems state =
  [ insertFields
      [ ("id", String (T.pack ("ftp_series_" ++ show i)))
      , ("file", String (fieldText "title" s))
      , ("category", textOr "Series" (field "category" s))
      , ("_isSeries", Bool True)
      ]
      (seriesRouteValue s)
  | (i, s) <- zip [(0 :: Int)..] (filter (not . isCartoonOrAnime) (csCatalogSeries state))
  ]

dedupeSearchItems :: [(Value, T.Text)] -> [(Value, T.Text)]
dedupeSearchItems =
  reverse . snd . foldl' step (Set.empty, [])
  where
    step (seen, acc) pair@(item, kind) =
      let key = searchIndexDedupeKey item kind
      in if key `Set.member` seen
          then (seen, acc)
          else (Set.insert key seen, pair : acc)

searchIndexDedupeKey :: Value -> T.Text -> T.Text
searchIndexDedupeKey item kind =
  kind <> "|"
    <> T.toLower (firstText ["name", "title"] item) <> "|"
    <> fieldText "year" item <> "|"
    <> textFallback (fieldText "streamUrl" item) (fieldText "id" item)

indexEntries :: V.Vector SearchEntry -> SearchIndex
indexEntries entries =
  V.ifoldl' step (SearchIndex entries M.empty M.empty M.empty) entries
  where
    step index idx entry =
      let searchTokensUnique = uniqueTexts (seSearchTokens entry)
          nameTokensUnique = uniqueTexts (seNameTokens entry)
          tokenMap' = foldl' (\m token -> M.insertWith appendIds token [idx] m) (siTokenMap index) searchTokensUnique
          nameTokenMap' = foldl' (\m token -> M.insertWith appendIds token [idx] m) (siNameTokenMap index) nameTokensUnique
          prefixMap' = foldl' addPrefix (siPrefixMap index) searchTokensUnique
      in index { siTokenMap = tokenMap', siNameTokenMap = nameTokenMap', siPrefixMap = prefixMap' }
    appendIds new old = new ++ old
    uniqueTexts = reverse . snd . foldl' keepText (Set.empty, [])
    keepText (seen, out) value
      | value `Set.member` seen = (seen, out)
      | otherwise = (Set.insert value seen, value : out)
    addPrefix m token
      | T.length token < 2 = m
      | otherwise =
          let prefix = T.take 2 token
          in M.alter addToken prefix m
      where
        addToken Nothing = Just [token]
        addToken (Just tokens)
          | length tokens >= searchPrefixBucketLimit = Just tokens
          | token `elem` tokens = Just tokens
          | otherwise = Just (tokens ++ [token])

makeSearchEntry :: Value -> T.Text -> SearchEntry
makeSearchEntry item kind =
  let rawName = firstText ["name", "title", "file", "filename"] item
      fileRaw = firstText ["file", "filename", "streamUrl"] item
      year = textFallback (fieldText "year" item) (firstYearText (textFallback rawName fileRaw))
      canonical = canonicalTitle rawName year
      fields = T.unwords
        [ canonical
        , rawName
        , fieldText "title" item
        , fileRaw
        , fieldText "overview" item
        , fieldText "genre" item
        , fieldText "language" item
        , year
        , fieldText "category" item
        , fieldText "server" item
        ]
  in SearchEntry
    { seItem = item
    , seKind = kind
    , seNameNorm = normalizeSearch (textFallback canonical rawName)
    , seFileNorm = normalizeSearch fileRaw
    , seSearchNorm = normalizeSearch fields
    , seNameTokens = searchTokensFromText (textFallback canonical rawName)
    , seSearchTokens = searchTokensFromText fields
    }

searchKindFromRequest :: Request -> T.Text
searchKindFromRequest req =
  case T.toLower (fromMaybe "mixed" (firstQueryText ["kind", "type"] req)) of
    "movie" -> "movie"
    "movies" -> "movie"
    "series" -> "series"
    "tv" -> "series"
    "show" -> "series"
    "shows" -> "series"
    _ -> "mixed"

nativeSearchResults :: SearchIndex -> T.Text -> T.Text -> [Value]
nativeSearchResults index rawQ kind =
  let correctedQ = correctSearchQuery rawQ
      terms = searchTerms correctedQ
      queryNorm = normalizeSearch correctedQ
      candidates = candidateIndexes index terms kind
      scored =
        [ (score, entry, seItem entry)
        | idx <- candidates
        , Just entry <- [siEntries index V.!? idx]
        , kindMatches kind (seItem entry)
        , let score = searchScoreEntry entry terms queryNorm
        , score > 0
        , not (shouldDropSearchResult entry score terms queryNorm)
        ]
      sorted = sortBy compareScored scored
  in capSearchResults sorted
  where
    compareScored (scoreA, _, itemA) (scoreB, _, itemB) =
      case compare scoreB scoreA of
        EQ -> compare (firstText ["name", "title"] itemA) (firstText ["name", "title"] itemB)
        other -> other

candidateIndexes :: SearchIndex -> [T.Text] -> T.Text -> [Int]
candidateIndexes index terms kind =
  if length termSets /= length terms
    then []
    else
      case termSets of
        [] -> []
        (firstSet:rest) ->
          let joined = foldl' IS.intersection firstSet rest
          in take searchCandidateLimit
            [ idx
            | idx <- IS.toAscList joined
            , Just entry <- [siEntries index V.!? idx]
            , kind == "mixed" || seKind entry == kind
            ]
  where
    termSets = mapMaybe termCandidateSet terms
    termCandidateSet term =
      let tokens = matchingTokens index term
          ids = foldl' addTokenIds IS.empty tokens
      in if IS.null ids then Nothing else Just ids
    addTokenIds acc token =
      let combined =
            IS.unions
              [ acc
              , IS.fromList (candidateIdsFor token (siNameTokenMap index))
              , IS.fromList (candidateIdsFor token (siTokenMap index))
              ]
      in takeIntSet searchCandidateLimit combined

    candidateIdsFor token tokenMap =
      let ids = reverse (fromMaybe [] (M.lookup token tokenMap))
      in take searchCandidateLimit ids

takeIntSet :: Int -> IS.IntSet -> IS.IntSet
takeIntSet n =
  IS.fromAscList . take n . IS.toAscList

matchingTokens :: SearchIndex -> T.Text -> [T.Text]
matchingTokens index term =
  case M.lookup term (siTokenMap index) of
    Just _ -> [term]
    Nothing ->
      take 80
        [ token
        | token <- M.findWithDefault [] (T.take 2 term) (siPrefixMap index)
        , token == term
            || term `T.isPrefixOf` token
            || (T.length term >= 4 && term `T.isInfixOf` token)
            || fuzzyTokenMatch term token
        ]

fuzzyTokenMatch :: T.Text -> T.Text -> Bool
fuzzyTokenMatch term token =
  let maxDist = maxFuzzyDistance term
  in maxDist > 0
      && abs (T.length token - T.length term) <= maxDist
      && editDistanceCapped term token maxDist <= maxDist

searchScoreEntry :: SearchEntry -> [T.Text] -> T.Text -> Int
searchScoreEntry entry terms queryNorm
  | null terms = 1
  | otherwise =
      let item = seItem entry
          name = seNameNorm entry
          fileNorm = seFileNorm entry
          searchNorm = seSearchNorm entry
          nameTokens = seNameTokens entry
          allTokens = seSearchTokens entry
          phrase = textFallback queryNorm (T.unwords terms)
          phraseScore
            | not (T.null phrase) && name == phrase = 9000
            | not (T.null phrase) && (phrase <> " ") `T.isPrefixOf` name = 7600
            | not (T.null phrase) && (" " <> phrase <> " ") `T.isInfixOf` (" " <> name <> " ") = 6500
            | not (T.null phrase) && phrase `T.isInfixOf` name = 5400
            | not (T.null phrase) && phrase `T.isInfixOf` fileNorm = 1300
            | otherwise = 0
          termFold = foldl' (scoreTerm nameTokens allTokens searchNorm) (True, 0, 0, 0) terms
      in case termFold of
        (False, _, _, _) -> -1
        (True, termScore, nameHits, exactNameHits) ->
          let allNameHit = if nameHits == length terms then 2200 else 0
              allExactNameHit = if exactNameHits == length terms then 2400 else 0
              leadingPhrase =
                if length terms > 1 && not (T.null phrase)
                    && T.unwords (take (length terms) (T.words name)) == phrase
                  then 1800 else 0
              firstTokens =
                if length terms > 1 && length nameTokens >= length terms
                    && T.unwords (take (length terms) nameTokens) == phrase
                  then 2500 else 0
              source = if field "isMassiveCatalog" item == Bool True then 0 else 260
              poster = if field "poster" item /= Null then 420 else 0
              backdrop = if field "backdrop" item /= Null then 90 else 0
              massivePenalty =
                if field "isMassiveCatalog" item == Bool True && not (searchHasArt item) then -850 else 0
              rating = round (min 75 (ratingNum item * 7))
              yearBonus = min 25 (max 0 ((yearNum item - 1980) `div` 2))
          in phraseScore + termScore + allNameHit + allExactNameHit + leadingPhrase
              + firstTokens + source + poster + backdrop + massivePenalty + rating + yearBonus

scoreTerm :: [T.Text] -> [T.Text] -> T.Text -> (Bool, Int, Int, Int) -> T.Text -> (Bool, Int, Int, Int)
scoreTerm nameTokens allTokens searchNorm (allMatched, score, nameHits, exactNameHits) term
  | not allMatched = (False, score, nameHits, exactNameHits)
  | otherwise =
      let nameScore = termBestScore term nameTokens
          textScore = if nameScore > 0 then nameScore else termBestScore term allTokens
      in if textScore == 0
          then if term `T.isInfixOf` searchNorm
            then (True, score + 30, nameHits, exactNameHits)
            else (False, score, nameHits, exactNameHits)
          else
            ( True
            , score + textScore
            , nameHits + if nameScore > 0 then 1 else 0
            , exactNameHits + if term `elem` nameTokens then 1 else 0
            )

termBestScore :: T.Text -> [T.Text] -> Int
termBestScore term =
  foldl' (\best token -> max best (tokenMatchScore term token)) 0

tokenMatchScore :: T.Text -> T.Text -> Int
tokenMatchScore term token
  | T.null term || T.null token = 0
  | token == term = 220
  | term `T.isPrefixOf` token = 145
  | T.length term >= 4 && term `T.isInfixOf` token = 90
  | otherwise =
      let maxDist = maxFuzzyDistance term
          dist = editDistanceCapped term token maxDist
      in if maxDist > 0 && abs (T.length token - T.length term) <= maxDist && dist <= maxDist
          then if dist == 1 then 115 else 70
          else 0

maxFuzzyDistance :: T.Text -> Int
maxFuzzyDistance term
  | T.length term >= 8 = 2
  | T.length term >= 5 = 1
  | otherwise = 0

editDistanceCapped :: T.Text -> T.Text -> Int -> Int
editDistanceCapped a b maxDistance
  | a == b = 0
  | T.null a || T.null b = maxDistance + 1
  | abs (T.length a - T.length b) > maxDistance = maxDistance + 1
  | otherwise = go 1 initialPrev as
  where
    as = T.unpack a
    bs = T.unpack b
    bl = length bs
    initialPrev = [0..bl]
    go _ prev [] = last prev
    go i prev (ca:restA) =
      let curr = scanRow ca i prev bs
      in if minimum curr > maxDistance then maxDistance + 1 else go (i + 1) curr restA
    scanRow ca i prev rowB =
      let (_, _, rowRev) = foldl' step (i, head prev, [i]) (zip rowB (tail prev))
      in reverse rowRev
      where
        step (left, diag, acc) (cb, up) =
          let diagVal = diag
              cost = if ca == cb then 0 else 1
              v = minimum [up + 1, left + 1, diagVal + cost]
          in (v, up, v : acc)

shouldDropSearchResult :: SearchEntry -> Int -> [T.Text] -> T.Text -> Bool
shouldDropSearchResult entry _ terms queryNorm =
  let item = seItem entry
      title = firstText ["name", "title"] item
      source = firstText ["file", "filename", "streamUrl"] item
      exactHits = length [term | term <- terms, term `elem` seNameTokens entry]
      phrase = textFallback queryNorm (T.unwords terms)
      name = seNameNorm entry
      phraseHit =
        not (T.null phrase)
          && (name == phrase || (phrase <> " ") `T.isPrefixOf` name || (" " <> phrase <> " ") `T.isInfixOf` (" " <> name <> " "))
  in isNoisyMassiveTitle title source
      || (field "isMassiveCatalog" item == Bool True
          && not (searchHasArt item)
          && not phraseHit
          && exactHits < length terms)

capSearchResults :: [(Int, SearchEntry, Value)] -> [Value]
capSearchResults scored =
  reverse (snd (foldl' step (CapState Set.empty 0, []) scored))
  where
    hasPosterResults = any (\(_, _, item) -> searchHasArt item) scored
    noPosterCap = if hasPosterResults then 0 else searchNoPosterMassiveCap
    step (capState, out) (_, entry, item)
      | length out >= searchResultCap = (capState, out)
      | searchResultDedupeKey entry `Set.member` capSeen capState = (capState, out)
      | field "isMassiveCatalog" item == Bool True && not (searchHasArt item) && capNoPosterMassive capState >= noPosterCap =
          (capState { capSeen = Set.insert (searchResultDedupeKey entry) (capSeen capState) }, out)
      | otherwise =
          let noPosterCount =
                capNoPosterMassive capState
                  + if field "isMassiveCatalog" item == Bool True && not (searchHasArt item) then 1 else 0
              capState' = capState
                { capSeen = Set.insert (searchResultDedupeKey entry) (capSeen capState)
                , capNoPosterMassive = noPosterCount
                }
          in (capState', item : out)

data CapState = CapState
  { capSeen :: Set.Set T.Text
  , capNoPosterMassive :: Int
  }

searchResultCap :: Int
searchResultCap = 120

searchNoPosterMassiveCap :: Int
searchNoPosterMassiveCap = 18

searchCandidateLimit :: Int
searchCandidateLimit = 6000

searchPrefixBucketLimit :: Int
searchPrefixBucketLimit = 400

correctSearchQuery :: T.Text -> T.Text
correctSearchQuery raw =
  let norm = normalizeSearch raw
  in T.unwords [M.findWithDefault token token commonSearchCorrections | token <- T.words norm]

commonSearchCorrections :: M.Map T.Text T.Text
commonSearchCorrections =
  M.fromList
    [ ("oblibion", "oblivion")
    , ("oblvion", "oblivion")
    , ("obliviion", "oblivion")
    , ("carribean", "caribbean")
    , ("caribean", "caribbean")
    , ("spiderman", "spider man")
    ]

searchResultDedupeKey :: SearchEntry -> T.Text
searchResultDedupeKey entry =
  let item = seItem entry
      yr = T.filter isDigit (fieldText "year" item)
      name = normalizeSearch (canonicalTitle (firstText ["name", "title", "file", "filename"] item) yr)
  in seKind entry <> "|" <> name <> "|" <> yr

searchHasArt :: Value -> Bool
searchHasArt item =
  field "poster" item /= Null || field "backdrop" item /= Null

isNoisyMassiveTitle :: T.Text -> T.Text -> Bool
isNoisyMassiveTitle title source =
  let norm = normalizeSearch title
      raw = T.toLower (title <> " " <> source)
      compact = T.replace " " "" norm
      hexish = not (T.null compact) && T.length compact >= 10 && T.all isHexLike compact
  in T.length norm < 3
      || "\xfffd" `T.isInfixOf` raw
      || "idx" `T.isInfixOf` norm
      || T.all isDigit compact
      || hexish
      || (length (T.words norm) <= 1 && T.length norm < 5)
  where
    isHexLike c = isDigit c || c `elem` ("abcdef" :: String)

loadMassiveSearchItems :: CatalogState -> IO ([Value], [Value])
loadMassiveSearchItems state = do
  let fp = csRoot state </> "scan-output" </> "clean-catalog.json"
  raw <- readJsonValue fp (Array V.empty)
  let rows = case raw of
        Array xs -> V.toList xs
        _ -> []
      (_, moviesRev, seriesMap) = foldl' massiveStep (Set.empty, [], M.empty) rows
      seriesItems = map massiveSeriesValue (M.elems seriesMap)
  pure (reverse moviesRev, seriesItems)

loadFastMassiveSearchItems :: CatalogState -> IO ([Value], [Value])
loadFastMassiveSearchItems state = do
  let fp = csRoot state </> "scan-output" </> "clean-catalog.json"
  exists <- doesFileExist fp
  if not exists
    then pure ([], [])
    else do
      contents <- BLC.readFile fp
      let (_, (_, moviesRev, seriesMap)) =
            foldl' fastMassiveLine (Nothing, (Set.empty, [], M.empty)) (BLC.lines contents)
          seriesItems = map massiveSeriesValue (M.elems seriesMap)
      pure (reverse moviesRev, seriesItems)

fastMassiveLine :: (Maybe BL.ByteString, MassiveAccum) -> BL.ByteString -> (Maybe BL.ByteString, MassiveAccum)
fastMassiveLine (_, acc) line
  | Just title <- extractJsonByteLine "title" line = (Just title, acc)
fastMassiveLine (pendingTitle, acc) line
  | Just url <- extractJsonByteLine "url" line =
      case pendingTitle of
        Just title ->
          let titleText = decodeJsonByteText title
              urlText = decodeJsonByteText url
              row = object ["title" .= titleText, "url" .= urlText]
              acc' = if fastMassiveWanted title url titleText urlText then massiveStep acc row else acc
          in (Nothing, acc')
        Nothing -> (Nothing, acc)
fastMassiveLine current _ = current

extractJsonByteLine :: BL.ByteString -> BL.ByteString -> Maybe BL.ByteString
extractJsonByteLine fieldName line =
  let stripped = BLC.dropWhile isSpace line
      prefix = "\"" <> fieldName <> "\":"
  in if not (prefix `BLC.isPrefixOf` stripped)
      then Nothing
      else Just . stripJsonStringLiteral $ BLC.drop (BLC.length prefix) stripped

stripJsonStringLiteral :: BL.ByteString -> BL.ByteString
stripJsonStringLiteral value =
  let trimmed0 = BLC.dropWhile isSpace value
      noComma = if not (BLC.null trimmed0) && BLC.last trimmed0 == ',' then BLC.init trimmed0 else trimmed0
      trimmed = BLC.dropWhile isSpace noComma
  in if BLC.length trimmed >= 2 && BLC.head trimmed == '"' && BLC.last trimmed == '"'
      then BLC.init (BLC.tail trimmed)
      else trimmed

decodeJsonByteText :: BL.ByteString -> T.Text
decodeJsonByteText =
  T.replace "\\\\" "\\"
    . T.replace "\\\"" "\""
    . T.replace "\\/" "/"
    . TE.decodeUtf8With TEE.lenientDecode
    . BL.toStrict

fastMassiveWanted :: BL.ByteString -> BL.ByteString -> T.Text -> T.Text -> Bool
fastMassiveWanted titleBytes urlBytes title url =
  let rawBytes = BLC.map toLower (titleBytes <> " " <> urlBytes)
      rawStrict = BL.toStrict rawBytes
      raw = title <> " " <> url
      lowerRaw = T.toLower raw
  in any (`BS8.isInfixOf` rawStrict) fastMassiveRawNeedleBytes
      && any (`T.isInfixOf` lowerRaw) fastMassiveRawNeedles
      && any (`queryTermsMatch` normalizeSearch raw) fastMassiveSearchQueries

queryTermsMatch :: [T.Text] -> T.Text -> Bool
queryTermsMatch terms norm =
  all (`T.isInfixOf` norm) terms

fastMassiveRawNeedles :: [T.Text]
fastMassiveRawNeedles =
  ["iron", "oblivion", "boys", "extraction", "knight", "breaking", "thrones"]

fastMassiveRawNeedleBytes :: [BS8.ByteString]
fastMassiveRawNeedleBytes =
  map BS8.pack ["iron", "oblivion", "boys", "extraction", "knight", "breaking", "thrones"]

fastMassiveSearchQueries :: [[T.Text]]
fastMassiveSearchQueries =
  map searchTerms
    [ "iron man"
    , "oblivion"
    , "the boys"
    , "extraction"
    , "dark knight"
    , "breaking bad"
    , "game of thrones"
    ]

massiveStep :: MassiveAccum -> Value -> MassiveAccum
massiveStep acc@(movieSeen, moviesAcc, seriesAcc) item =
  let url = trimText (firstText ["url", "streamUrl"] item)
      rawTitle = textFallback (firstText ["title", "name", "filename", "file"] item) url
      year = firstYearText rawTitle
  in if not (videoUrlOk url)
      then acc
      else if massiveLooksLikeSeries rawTitle || massiveLooksLikeSeries url
        then
          let showName = massiveCanonicalTitle (massiveBaseShowTitle rawTitle) year
              key = T.toLower showName <> "|" <> year
              ep = massiveEpisode rawTitle url
          in if T.length (normalizeSearch showName) < 3 || isNoisyMassiveTitle showName rawTitle
              then acc
              else (movieSeen, moviesAcc, M.insertWith mergeSeries key (MassiveSeriesBucket showName year [ep]) seriesAcc)
        else
          let title = massiveCanonicalTitle rawTitle year
              key = T.toLower title <> "|" <> year
          in if T.length (normalizeSearch title) < 3 || isNoisyMassiveTitle title rawTitle || key `Set.member` movieSeen
              then acc
              else (Set.insert key movieSeen, massiveMovieValue title year url : moviesAcc, seriesAcc)

mergeSeries :: MassiveSeriesBucket -> MassiveSeriesBucket -> MassiveSeriesBucket
mergeSeries new old =
  old { msEpisodes = msEpisodes old ++ msEpisodes new }

videoUrlOk :: T.Text -> Bool
videoUrlOk url =
  let lower = T.toLower url
  in ("http://" `T.isPrefixOf` lower || "https://" `T.isPrefixOf` lower)
      && any (`T.isInfixOf` lower) massiveSearchVideoExts

massiveSearchVideoExts :: [T.Text]
massiveSearchVideoExts =
  [ ".mp4", ".mkv", ".avi", ".mov", ".webm", ".m3u8", ".ts"
  , ".flv", ".wmv", ".mpg", ".mpeg"
  ]

massiveCanonicalTitle :: T.Text -> T.Text -> T.Text
massiveCanonicalTitle raw year =
  let title = canonicalTitle (cleanMassiveTitle raw) year
  in textFallback title (cleanMassiveTitle raw)

cleanMassiveTitle :: T.Text -> T.Text
cleanMassiveTitle raw =
  let decoded = decodeUrlText raw
      noQuery = fst (T.breakOn "?" (fst (T.breakOn "#" decoded)))
      lastPart = lastTextPart "/" noQuery
      noExt = stripKnownVideoExtension lastPart
      spaced = cleanupSeparators noExt
  in trimText (removeBracketContent spaced)

decodeUrlText :: T.Text -> T.Text
decodeUrlText =
  TE.decodeUtf8With TEE.lenientDecode . urlDecode True . TE.encodeUtf8

lastTextPart :: T.Text -> T.Text -> T.Text
lastTextPart needle value =
  case reverse (T.splitOn needle value) of
    (x:_) -> x
    [] -> value

massiveLooksLikeSeries :: T.Text -> Bool
massiveLooksLikeSeries raw =
  let norm = normalizeSearch raw
      tokens = T.words norm
  in any (maybe False (const True) . parseSxe) tokens
      || "season" `elem` tokens
      || "episode" `elem` tokens
      || "tv series" `T.isInfixOf` norm
      || "web series" `T.isInfixOf` norm
      || "korean tv" `T.isInfixOf` norm

massiveBaseShowTitle :: T.Text -> T.Text
massiveBaseShowTitle raw =
  T.unwords (stripSeriesMarkers (T.words (cleanMassiveTitle raw)))

stripSeriesMarkers :: [T.Text] -> [T.Text]
stripSeriesMarkers [] = []
stripSeriesMarkers (x:y:xs)
  | markerWithNumber x y = stripSeriesMarkers xs
stripSeriesMarkers (x:xs)
  | parseSxe (T.toLower x) /= Nothing = stripSeriesMarkers xs
  | otherwise = x : stripSeriesMarkers xs

markerWithNumber :: T.Text -> T.Text -> Bool
markerWithNumber marker value =
  T.toLower marker `elem` ["season", "episode", "ep"] && T.all isDigit value

massiveEpisode :: T.Text -> T.Text -> MassiveEpisode
massiveEpisode title url =
  let tokens = T.words (normalizeSearch (title <> " " <> url))
      parsed = listToMaybe (mapMaybe parseSxe tokens)
      (seasonNo, epNo) = fromMaybe (1, 1) parsed
  in MassiveEpisode
    { meSeason = seasonNo
    , meEpisode = epNo
    , meFile = lastTextPart "/" (fst (T.breakOn "?" url))
    , meUrl = url
    }

massiveMovieValue :: T.Text -> T.Text -> T.Text -> Value
massiveMovieValue title year url =
  object
    [ "id" .= ("sv_clean_" <> T.pack (sha1Hex16 (T.unpack url)))
    , "name" .= title
    , "title" .= title
    , "file" .= lastTextPart "/" (fst (T.breakOn "?" url))
    , "poster" .= Null
    , "backdrop" .= Null
    , "tmdbId" .= Null
    , "year" .= year
    , "rating" .= Null
    , "type" .= String "movie"
    , "genre" .= String ""
    , "category" .= String "Massive Catalog"
    , "streamUrl" .= url
    , "isFtp" .= True
    , "isMassiveCatalog" .= True
    ]

massiveSeriesValue :: MassiveSeriesBucket -> Value
massiveSeriesValue bucket =
  object
    [ "id" .= ("sv_series_" <> T.pack (sha1Hex16 (T.unpack (msName bucket <> msYear bucket))))
    , "name" .= msName bucket
    , "title" .= msName bucket
    , "year" .= msYear bucket
    , "poster" .= Null
    , "backdrop" .= Null
    , "rating" .= Null
    , "genre" .= String ""
    , "type" .= String "series"
    , "isFtp" .= True
    , "isMassiveCatalog" .= True
    , "_isSeries" .= True
    , "seasons" .= massiveSeasonsObject (msEpisodes bucket)
    ]

massiveSeasonsObject :: [MassiveEpisode] -> Value
massiveSeasonsObject eps =
  Object $ KM.fromList
    [ (fromText (T.pack (show seasonNo)), Array (V.fromList (map massiveEpisodeValue sorted)))
    | seasonNo <- nub (map meSeason eps)
    , let sorted = sortBy (\a b -> compare (meEpisode a) (meEpisode b)) [e | e <- eps, meSeason e == seasonNo]
    ]

massiveEpisodeValue :: MassiveEpisode -> Value
massiveEpisodeValue ep =
  object
    [ "streamId" .= Null
    , "episode" .= meEpisode ep
    , "epTitle" .= T.pack ("Episode " ++ show (meEpisode ep))
    , "file" .= meFile ep
    , "streamUrl" .= meUrl ep
    , "isFtp" .= True
    , "isMassiveCatalog" .= True
    ]

searchPosterBridge :: [Value] -> M.Map T.Text Value
searchPosterBridge =
  foldl' add M.empty
  where
    add bridge item
      | not (searchHasArt item) = bridge
      | otherwise =
          let name = firstText ["name", "title", "filename", "file"] item
              year = textFallback (fieldText "year" item) (firstYearText name)
              exact = searchPosterBridgeKey name year
              loose = searchPosterBridgeKey name ""
              bridge1 = insertBridge exact item bridge
          in insertBridge loose item bridge1
    insertBridge key item bridge
      | T.null key = bridge
      | otherwise = M.insertWith preferPoster key item bridge
    preferPoster new old =
      if not (searchHasArt old) && searchHasArt new then new else old

searchPosterBridgeKey :: T.Text -> T.Text -> T.Text
searchPosterBridgeKey name year =
  let bridgeYear = textFallback year (firstYearText name)
      clean = normalizeSearch (canonicalTitle name bridgeYear)
      yr = T.filter isDigit year
  in if T.null clean then "" else clean <> "|" <> yr

hydrateMassiveSearchItem :: M.Map T.Text Value -> T.Text -> Value -> Value
hydrateMassiveSearchItem bridge _ item =
  let name = firstText ["name", "title"] item
      year = fieldText "year" item
      hit = M.lookup (searchPosterBridgeKey name year) bridge
        <|> M.lookup (searchPosterBridgeKey name "") bridge
  in case hit of
    Nothing -> item
    Just info ->
      let hitName = firstText ["name", "title"] info
          rename =
            if not (T.null hitName) && normalizeSearch hitName == normalizeSearch name
              then [("name", String hitName), ("title", String hitName)]
              else []
          fields =
            rename ++
            [ ("poster", fallbackValue (field "poster" item) (field "poster" info))
            , ("backdrop", fallbackValue (field "backdrop" item) (fallbackValue (field "backdrop" info) (field "poster" info)))
            , ("rating", fallbackValue (field "rating" item) (field "rating" info))
            , ("genre", fallbackValue (field "genre" item) (field "genre" info))
            , ("overview", fallbackValue (field "overview" item) (field "overview" info))
            , ("tmdbId", fallbackValue (field "tmdbId" item) (field "tmdbId" info))
            ]
      in insertFields fields item

homeSections :: [(T.Text, T.Text, T.Text)]
homeSections =
  [ ("netflixRow", "netflix", "Netflix Originals")
  , ("marvelRow", "marvel", "Marvel Studios")
  , ("dcRow", "dc", "DC")
  , ("universalRow", "universal", "Universal Pictures")
  , ("disneyRow", "disney", "Disney")
  , ("warnerRow", "warner", "Warner Bros")
  , ("hboRow", "hbo", "HBO")
  , ("appleTvRow", "apple", "Apple TV+")
  , ("trendingRow", "trending", "\x1F525 Trending Now")
  , ("seriesRow", "series", "Series")
  , ("newRow", "new", "New to StreamVault")
  , ("indianRow", "indian", "Indian Movies & Drama")
  , ("animeRow", "anime", "Anime")
  , ("koreanRow", "koreanDrama", "Korean Drama")
  , ("horrorRow", "horrorNights", "Horror Nights")
  , ("scifiRow", "cyberpunkScifi", "Cyberpunk & Sci-Fi")
  , ("mindfuckRow", "mindfuck", "Mindfuck Movies")
  , ("cultClassicsRow", "cultClassics", "Cult Classics")
  , ("a24Row", "a24", "A24 Collection")
  , ("nostalgia90sRow", "nostalgia90s", "90s Nostalgia")
  , ("midnightCinemaRow", "midnightCinema", "Midnight Cinema")
  , ("trueCrimeRow", "trueCrime", "True Crime")
  , ("thrillerRow", "psychThriller", "Psychological Thriller")
  , ("adultAnimationRow", "adultAnimation", "Adult Animation")
  , ("postApocalypticRow", "postApocalyptic", "Post-Apocalyptic")
  , ("feelGoodRow", "feelGood", "Feel Good Movies")
  , ("darkComedyRow", "darkComedy", "Dark Comedy")
  , ("timeTravelRow", "timeTravel", "Time Travel")
  , ("spaceAiRow", "spaceAi", "Space & AI")
  , ("crimeRow", "crimeSyndicates", "Crime Syndicates")
  , ("zombieRow", "zombie", "Zombie Universe")
  , ("indieGemsRow", "indieGems", "Indie Gems")
  , ("hiddenMasterpiecesRow", "hiddenMasterpieces", "Hidden Masterpieces")
  , ("liveConcertsRow", "liveConcerts", "Live Concerts")
  , ("documentaryRow", "documentaryVault", "Documentary Vault")
  , ("ghibliRow", "ghibli", "Studio Ghibli")
  , ("romanticRow", "romanceMidnight", "Romance After Midnight")
  , ("comingSoonRow", "comingSoon", "Coming Soon")
  , ("dramaRow", "drama", "Drama & Emotion")
  , ("spanishRow", "spanish", "Spanish & Latino")
  , ("highRatedRow", "topRated", "\x2B50 Top Rated (8+)")
  , ("allRow", "allMovies", "All Movies")
  , ("recentlyAddedRow", "recentlyAdded", "Recently Added")
  , ("mostWatchedTodayRow", "mostWatchedToday", "Most Watched Today")
  ]

homeFeedResponse :: CatalogState -> Request -> Value
homeFeedResponse state req =
  let limit = min 50 (max 6 (queryInt "limit" 18 req))
      pools = sectionPools state
      builtRows =
        [ (rowId, items, object ["rowId" .= rowId, "sectionKey" .= sectionKey, "title" .= title, "items" .= items])
        | (rowId, sectionKey, title) <- homeSections
        , let items = take limit (sectionListFrom pools sectionKey)
        , not (null items)
        ]
      heroSource =
        case find (\(rowId, _, _) -> rowId == "newRow") builtRows of
          Just (_, items, _) -> items
          Nothing ->
            case builtRows of
              ((_, items, _):_) -> items
              [] -> []
      hero = take 10 [item | item <- heroSource, hasArt item]
  in object
    [ "ok" .= True
    , "hero" .= hero
    , "rows" .= [row | (_, _, row) <- builtRows]
    ]

titleDetailsResponse :: CatalogState -> Request -> Maybe Value
titleDetailsResponse state req = do
  let mediaType = metadataMediaType req
      rawTitle = fromMaybe "" (firstQueryText ["title", "name", "id", "tmdbId"] req)
      rawIdent = fromMaybe rawTitle (firstQueryText ["id", "tmdbId"] req)
      queryYear = fromMaybe "" (queryText "year" req)
      (requestTitle, requestYear0) = normalizeDetailTitle rawTitle queryYear
      item = localDetailItem state mediaType rawIdent requestTitle
      itemYear = maybe "" (fieldText "year") item
      requestYear = textFallback requestYear0 itemYear
      keys = detailCacheCandidates state req mediaType rawIdent requestTitle requestYear item
  cached <- lookupDetailCache state keys
  pure (titleDetailsNodeShape mediaType requestTitle cached)

metadataMediaType :: Request -> T.Text
metadataMediaType req =
  let rawType = T.toLower (fromMaybe "" (firstQueryText ["type", "mediaType"] req))
      rawId = fromMaybe "" (queryText "id" req)
  in if "tmdb_tv_" `T.isPrefixOf` rawId || rawType `elem` ["tv", "series", "show"]
       then "tv"
       else "movie"

titleDetailsNodeShape :: T.Text -> T.Text -> Value -> Value
titleDetailsNodeShape mediaType fallbackTitle cached =
  object
    [ "ok" .= valueOr (Bool True) "ok" cached
    , "tmdbId" .= nullish (field "tmdbId" cached)
    , "imdbId" .= textOr "" (field "imdbId" cached)
    , "type" .= textFallback (fieldText "type" cached) mediaType
    , "title" .= textFallback (fieldText "title" cached) (textFallback (fieldText "name" cached) fallbackTitle)
    , "overview" .= textOr "" (field "overview" cached)
    , "poster" .= nullish (field "poster" cached)
    , "backdrop" .= nullish (field "backdrop" cached)
    , "year" .= textOr "" (field "year" cached)
    , "rating" .= nullish (field "rating" cached)
    , "runtime" .= textOr "" (field "runtime" cached)
    , "genres" .= textOr "" (fallbackValue (field "genres" cached) (field "genre" cached))
    , "language" .= textOr "" (field "language" cached)
    , "ratings" .= arrayOrEmpty (field "ratings" cached)
    , "trailers" .= arrayOrEmpty (field "trailers" cached)
    , "cast" .= arrayOrEmpty (field "cast" cached)
    , "crew" .= arrayOrEmpty (field "crew" cached)
    , "productionCompanies" .= arrayOrEmpty (field "productionCompanies" cached)
    , "similar" .= arrayOrEmpty (field "similar" cached)
    , "moreByDirector" .= arrayOrEmpty (field "moreByDirector" cached)
    , "director" .= field "director" cached
    , "about" .= arrayOrEmpty (field "about" cached)
    , "playbackInfo" .= arrayOrEmpty (field "playbackInfo" cached)
    ]

valueOr :: Value -> T.Text -> Value -> Value
valueOr fallback key value =
  case field key value of
    Null -> fallback
    found -> found

episodeTitlesResponse :: CatalogState -> Request -> Maybe Value
episodeTitlesResponse state req = do
  showName <- firstQueryText ["show"] req
  season <- firstQueryText ["season"] req
  let cacheKey = cleanEpisodeShow showName <> "__S" <> season
  case KM.lookup (fromText cacheKey) (csEpisodeTitleCache state) of
    Just value@(Array _) -> Just value
    _ -> Nothing

cleanEpisodeShow :: T.Text -> T.Text
cleanEpisodeShow =
  trimText
    . T.unwords
    . T.words
    . stripEpisodeQualityTail
    . removeSquareParenContent

removeSquareParenContent :: T.Text -> T.Text
removeSquareParenContent = T.pack . go . T.unpack
  where
    go [] = []
    go ('[':xs) = stripClosed '[' ']' xs
    go ('(':xs) = stripClosed '(' ')' xs
    go (x:xs) = x : go xs
    stripClosed open close xs =
      case break (== close) xs of
        (_, []) -> open : go xs
        (_, _:rest) -> go rest

stripEpisodeQualityTail :: T.Text -> T.Text
stripEpisodeQualityTail value =
  let lower = T.toLower value
      positions =
        [ pos
        | token <- episodeTitleQualityTokens
        , pos <- findNeedlePositions token lower
        , hasWordBoundary pos token lower
        ]
  in case positions of
       [] -> value
       xs -> T.take (minimum xs) value

episodeTitleQualityTokens :: [T.Text]
episodeTitleQualityTokens =
  ["720p", "1080p", "480p", "4k", "webrip", "bluray", "x264", "x265", "hevc", "aac", "nf", "amzn", "hdtv"]

hasWordBoundary :: Int -> T.Text -> T.Text -> Bool
hasWordBoundary pos token value =
  beforeOk && afterOk
  where
    beforeOk = pos <= 0 || not (isAlphaNum (T.index value (pos - 1)))
    after = pos + T.length token
    afterOk = after >= T.length value || not (isAlphaNum (T.index value after))

detailsResponse :: CatalogState -> Request -> Maybe Value
detailsResponse state req =
  case pathInfo req of
    ("api":"details":rawType:rest)
      | not (null rest) -> do
          let rawId = T.intercalate "/" rest
              mediaType = detailMediaType rawType
              rawTitle = fromMaybe rawId (firstQueryText ["title", "name"] req)
              queryYear = fromMaybe "" (queryText "year" req)
              (requestTitle, requestYear0) = normalizeDetailTitle rawTitle queryYear
              item = localDetailItem state mediaType rawId requestTitle
              itemYear = maybe "" (fieldText "year") item
              requestYear = textFallback requestYear0 itemYear
              keys = detailCacheCandidates state req mediaType rawId requestTitle requestYear item
          cached <- lookupDetailCache state keys
          pure $ mergeDetailValues (localDetailValue mediaType rawId requestTitle item) cached
    _ -> Nothing

detailMediaType :: T.Text -> T.Text
detailMediaType raw =
  if T.toLower raw `elem` ["tv", "series", "show"] then "tv" else "movie"

firstQueryText :: [T.Text] -> Request -> Maybe T.Text
firstQueryText keys req =
  listToMaybe [value | key <- keys, Just value <- [queryText key req], not (T.null (trimText value))]

detailCacheCandidates :: CatalogState -> Request -> T.Text -> T.Text -> T.Text -> T.Text -> Maybe Value -> [T.Text]
detailCacheCandidates state req mediaType rawId title year item =
  nub . filter (not . T.null) $
    directKeys ++ exactKeys ++ titleOnlyKeys ++ looseKeys
  where
    cache = csDetailCache state
    queryTmdb = fromMaybe "" (queryText "tmdbId" req)
    rawTmdb = tmdbIdFromRaw mediaType rawId
    itemTmdb = maybe "" (fieldText "tmdbId") item
    itemTitle = maybe "" (firstText ["name", "title"]) item
    itemYear = maybe "" (fieldText "year") item
    ids = nub $ filter (not . T.null) [queryTmdb, rawTmdb, itemTmdb, if T.all isDigit rawId then rawId else ""]
    titles = nub $ filter (not . T.null) [title, rawId, prefixedDetailTitle rawId, itemTitle]
    years = nub [year, itemYear, ""]
    directCandidates =
      nub . filter (not . T.null) $
        [rawId, queryTmdb, rawTmdb, itemTmdb, title, itemTitle]
          ++ [t <> ":" <> y | t <- titles, y <- years, not (T.null y)]
          ++ ["__series__" <> t | t <- titles]
          ++ ["__tmdb_id__" <> t | t <- titles]
    directKeys =
      [ key
      | key <- directCandidates
      , KM.member (fromText key) cache
      ]
    exactKeys =
      [ media <> ":" <> ident <> ":" <> yr
      | media <- mediaAliases mediaType
      , ident <- ids ++ titles
      , yr <- years
      , not (T.null ident)
      ]
    titleOnlyKeys =
      [ media <> ":" <> ident
      | media <- mediaAliases mediaType
      , ident <- ids ++ titles
      , not (T.null ident)
      ]
    looseKeys =
      [ keyText
      | (key, _) <- KM.toList cache
      , let keyText = toText key
      , detailCacheKeyMatches (mediaAliases mediaType) ids titles years keyText
          || detailDirectCacheKeyMatches ids titles years keyText
      ]

mediaAliases :: T.Text -> [T.Text]
mediaAliases "tv" = ["tv", "series"]
mediaAliases other = [other]

prefixedDetailTitle :: T.Text -> T.Text
prefixedDetailTitle raw =
  fromMaybe "" (listToMaybe [rest | prefix <- ["__series__", "__tmdb_id__"], Just rest <- [T.stripPrefix prefix raw]])

tmdbIdFromRaw :: T.Text -> T.Text -> T.Text
tmdbIdFromRaw mediaType rawId
  | mediaType == "tv"
  , Just rest <- T.stripPrefix "tmdb_tv_" rawId
  , T.all isDigit rest = rest
  | mediaType == "movie"
  , Just rest <- T.stripPrefix "tmdb_" rawId
  , T.all isDigit rest = rest
  | otherwise = ""

detailCacheKeyMatches :: [T.Text] -> [T.Text] -> [T.Text] -> [T.Text] -> T.Text -> Bool
detailCacheKeyMatches medias ids titles years keyText =
  any matchMedia medias
  where
    matchMedia media =
      case T.stripPrefix (media <> ":") keyText of
        Nothing -> False
        Just rest ->
          let (ident, keyYear) = splitDetailCacheRest rest
              identNorm = detailTitleKey ident
              titleNorms = map detailTitleKey titles
              idHit = ident `elem` ids
              titleHit = identNorm `elem` titleNorms
              wantedYears = filter (not . T.null) years
              yearHit = detailYearMatches wantedYears keyYear
          in (idHit || titleHit) && yearHit

detailDirectCacheKeyMatches :: [T.Text] -> [T.Text] -> [T.Text] -> T.Text -> Bool
detailDirectCacheKeyMatches ids titles years keyText =
  directIdHit || directTitleHit || splitHit || prefixedHit
  where
    titleNorms = map detailTitleKey titles
    wantedYears = filter (not . T.null) years
    (ident, keyYear) = splitDetailCacheRest keyText
    directIdHit = keyText `elem` ids
    directTitleHit =
      detailTitleKey keyText `elem` titleNorms
        && detailYearMatches wantedYears (firstYearText keyText)
    splitHit =
      not (T.null ident)
        && detailYearMatches wantedYears keyYear
        && (ident `elem` ids || detailTitleKey ident `elem` titleNorms)
    prefixedHit =
      any matchPrefixed ["__series__", "__tmdb_id__"]
    matchPrefixed prefix =
      case T.stripPrefix prefix keyText of
        Nothing -> False
        Just rest -> rest `elem` ids || detailTitleKey rest `elem` titleNorms

splitDetailCacheRest :: T.Text -> (T.Text, T.Text)
splitDetailCacheRest rest =
  let parts = T.splitOn ":" rest
  in case reverse parts of
       [] -> ("", "")
       (yr:xs)
         | not (null xs)
         , detailYearDigits yr /= "" ->
             (T.intercalate ":" (reverse xs), detailYearDigits yr)
         | otherwise -> (rest, "")

detailYearMatches :: [T.Text] -> T.Text -> Bool
detailYearMatches wantedYears rawYear =
  let keyYear = detailYearDigits rawYear
  in null wantedYears || keyYear `elem` wantedYears || T.null keyYear

detailYearDigits :: T.Text -> T.Text
detailYearDigits value =
  let digits = T.filter isDigit value
  in if T.length digits == 4
        && ("19" `T.isPrefixOf` digits || "20" `T.isPrefixOf` digits)
      then digits
      else ""

lookupDetailCache :: CatalogState -> [T.Text] -> Maybe Value
lookupDetailCache state keys =
  listToMaybe (mapMaybe lookupOne keys)
  where
    lookupOne key = do
      entry <- KM.lookup (fromText key) (csDetailCache state)
      dataValue <- detailCacheEntryData entry
      if hasExtendedDetail dataValue then Just dataValue else Nothing

detailCacheEntryData :: Value -> Maybe Value
detailCacheEntryData entry =
  case field "data" entry of
    Object _ -> Just (field "data" entry)
    _ ->
      case entry of
        Object _ | field "ok" entry /= Null -> Just entry
        _ -> Nothing

hasExtendedDetail :: Value -> Bool
hasExtendedDetail value =
  any (`hasNonEmptyArray` value)
    ["trailers", "cast", "crew", "productionCompanies", "similar", "moreByDirector"]

hasNonEmptyArray :: T.Text -> Value -> Bool
hasNonEmptyArray key value =
  case field key value of
    Array xs -> not (V.null xs)
    _ -> False

normalizeDetailTitle :: T.Text -> T.Text -> (T.Text, T.Text)
normalizeDetailTitle raw fallbackYear =
  let rawYear = firstYearText raw
      year = textFallback (firstYearText fallbackYear) rawYear
      noExt = stripKnownVideoExtension raw
      spaced = T.unwords . T.words $ T.map detailTitleChar noExt
      cut = cutAtAny detailCutTokens spaced
      noYears = T.unwords [token | token <- T.words cut, not (isYearToken token)]
      cleaned = trimText noYears
  in (cleaned, year)

detailTitleChar :: Char -> Char
detailTitleChar c
  | c == '.' || c == '_' = ' '
  | c `elem` ("[](){}" :: String) = ' '
  | isAlphaNum c || c `elem` (":'&!?, -" :: String) = c
  | otherwise = ' '

stripKnownVideoExtension :: T.Text -> T.Text
stripKnownVideoExtension value =
  fromMaybe value (listToMaybe (mapMaybe stripped knownTitleVideoExts))
  where
    lower = T.toLower value
    knownTitleVideoExts = videoExts ++ [".m3u8", ".ts"]
    stripped ext =
      let suffix = T.pack ext
      in if suffix `T.isSuffixOf` lower then Just (T.dropEnd (T.length suffix) value) else Nothing

detailCutTokens :: [T.Text]
detailCutTokens =
  [ "2160p", "1080p", "720p", "540p", "480p", "4k", "uhd", "hdr"
  , "webrip", "web-rip", "webdl", "web-dl", "bluray", "brrip", "hdrip"
  , "hdtv", "dvdrip", "x264", "x265", "hevc", "aac", "dts", "mkv", "mp4"
  , "msmod", "pahe", "rarbg", "yts", "esub", "msubs", "dual audio"
  , "multi audio", "hindi", "english", "bengali", "bangla"
  ]

firstYearText :: T.Text -> T.Text
firstYearText = T.pack . go . T.unpack
  where
    go [] = ""
    go xs@(_:rest) =
      case xs of
        (a:b:c:d:_)
          | isDigit a && isDigit b && isDigit c && isDigit d
          , [a, b] `elem` ["19", "20"] -> [a, b, c, d]
        _ -> go rest

isYearToken :: T.Text -> Bool
isYearToken token =
  let digits = T.filter isDigit token
  in T.length digits == 4 && ("19" `T.isPrefixOf` digits || "20" `T.isPrefixOf` digits)

detailTitleKey :: T.Text -> T.Text
detailTitleKey value =
  T.unwords . T.words . T.map repl . T.toLower $ fst (normalizeDetailTitle value "")
  where
    repl c
      | isAlphaNum c = c
      | otherwise = ' '

localDetailItem :: CatalogState -> T.Text -> T.Text -> T.Text -> Maybe Value
localDetailItem state mediaType rawId title =
  find (detailItemMatches rawId title) candidates
  where
    candidates =
      if mediaType == "tv"
        then csLocalSeries state ++ catalogSeriesDetailItems state
        else moviesList state

catalogSeriesDetailItems :: CatalogState -> [Value]
catalogSeriesDetailItems state =
  [ object
    [ "id" .= T.pack ("ftp_series_" ++ show i)
    , "name" .= fieldText "title" s
    , "title" .= fieldText "title" s
    , "poster" .= nullish (field "poster" s)
    , "backdrop" .= fallbackValue (field "backdrop" s) (field "poster" s)
    , "tmdbId" .= nullish (field "tmdbId" s)
    , "imdbId" .= textOr "" (field "imdbId" s)
    , "overview" .= textOr "" (field "overview" s)
    , "year" .= textOr "" (field "year" s)
    , "rating" .= nullish (field "rating" s)
    , "genre" .= textOr "" (field "genre" s)
    , "category" .= textOr "" (field "category" s)
    , "language" .= textOr "" (field "language" s)
    , "productionCompanies" .= arrayOrEmpty (field "productionCompanies" s)
    , "isFtp" .= True
    , "seasons" .= Object KM.empty
    ]
  | (i, s) <- zip [(0 :: Int)..] (filter (not . isCartoonOrAnime) (csCatalogSeries state))
  ]

detailItemMatches :: T.Text -> T.Text -> Value -> Bool
detailItemMatches rawId title item =
  let itemName = firstText ["name", "title", "filename", "file"] item
      itemTitleKey = detailTitleKey itemName
      requestTitleKey = detailTitleKey title
  in fieldText "id" item == rawId
     || fieldText "tmdbId" item == rawId
     || (not (T.null requestTitleKey) && itemTitleKey == requestTitleKey)

localDetailValue :: T.Text -> T.Text -> T.Text -> Maybe Value -> Value
localDetailValue mediaType rawId title item =
  let itemValue = fromMaybe (object ["id" .= rawId, "name" .= title, "type" .= mediaType]) item
      itemId = textFallback (firstText ["id", "name"] itemValue) rawId
      itemTitle = textFallback (firstText ["name", "title"] itemValue) title
      rating = fieldText "rating" itemValue
  in object
    [ "ok" .= True
    , "localOnly" .= True
    , "type" .= mediaType
    , "id" .= itemId
    , "tmdbId" .= nullish (field "tmdbId" itemValue)
    , "imdbId" .= textOr "" (field "imdbId" itemValue)
    , "title" .= itemTitle
    , "overview" .= textOr "" (field "overview" itemValue)
    , "poster" .= nullish (field "poster" itemValue)
    , "backdrop" .= fallbackValue (field "backdrop" itemValue) (field "poster" itemValue)
    , "year" .= textOr "" (field "year" itemValue)
    , "rating" .= nullish (field "rating" itemValue)
    , "runtime" .= textOr "" (field "runtime" itemValue)
    , "genres" .= textOr "" (field "genre" itemValue)
    , "language" .= textOr "" (field "language" itemValue)
    , "ratings" .= localRatings rating
    , "trailers" .= arrayOrEmpty (field "trailers" itemValue)
    , "cast" .= arrayOrEmpty (field "cast" itemValue)
    , "crew" .= arrayOrEmpty (field "crew" itemValue)
    , "productionCompanies" .= productionCompanyObjects (field "productionCompanies" itemValue)
    , "similar" .= arrayOrEmpty (field "similar" itemValue)
    , "moreByDirector" .= arrayOrEmpty (field "moreByDirector" itemValue)
    , "director" .= nullish (field "director" itemValue)
    , "episodes" .= if mediaType == "tv" then objectOrEmpty (field "seasons" itemValue) else Array V.empty
    , "about" .= Array V.empty
    , "playbackInfo" .= Array V.empty
    ]

localRatings :: T.Text -> Value
localRatings rating =
  if T.null rating
    then Array V.empty
    else Array $ V.singleton $ object
      [ "source" .= String "Catalog"
      , "value" .= (rating <> "/10")
      , "subvalue" .= String "Local cache"
      , "available" .= True
      ]

productionCompanyObjects :: Value -> Value
productionCompanyObjects (Array xs) =
  Array . V.fromList $
    [ case company of
        String name -> object ["id" .= i, "name" .= name, "logo" .= Null]
        Object _ -> company
        _ -> Null
    | (i, company) <- zip [(0 :: Int)..] (V.toList xs)
    , company /= Null
    ]
productionCompanyObjects _ = Array V.empty

objectOrEmpty :: Value -> Value
objectOrEmpty (Object o) = Object o
objectOrEmpty _ = Object KM.empty

mergeDetailValues :: Value -> Value -> Value
mergeDetailValues (Object local) (Object cached) =
  Object $ KM.insert (fromText "localOnly") (Bool False) $
    foldl' (\acc (key, value) -> KM.insert key value acc) local (KM.toList cached)
mergeDetailValues _ cached = cached

sectionResponse :: CatalogState -> Request -> T.Text -> Value
sectionResponse state req key =
  let page = max 0 (queryInt "page" 0 req)
      limit = min 120 (max 1 (queryInt "limit" 24 req))
      list = sectionList state key
      start = page * limit
      total = length list
      pages = pageCount limit total
  in object
    [ "key" .= key
    , "items" .= take limit (drop start list)
    , "total" .= total
    , "page" .= page
    , "pages" .= pages
    ]

data SectionPools = SectionPools
  { spMoviesOnly :: [Value]
  , spSeriesOnly :: [Value]
  , spAllItems   :: [Value]
  }

sectionPools :: CatalogState -> SectionPools
sectionPools state =
  let moviesOnly = normalMovieItems state
      seriesOnly = normalSeriesItems state
  in SectionPools
    { spMoviesOnly = moviesOnly
    , spSeriesOnly = seriesOnly
    , spAllItems = moviesOnly ++ seriesOnly
    }

sectionList :: CatalogState -> T.Text -> [Value]
sectionList state =
  sectionListFrom (sectionPools state)

sectionListFrom :: SectionPools -> T.Text -> [Value]
sectionListFrom pools key =
  let moviesOnly = spMoviesOnly pools
      seriesOnly = spSeriesOnly pools
      allItems = spAllItems pools
      pick wordsToFind = homeSort [item | item <- allItems, hasAny (homeText item) wordsToFind]
      byYearDesc xs = sortBy (\a b -> compare (yearNum b) (yearNum a)) xs
      result = case key of
        "series" -> homeSort seriesOnly
        "allMovies" -> homeSort moviesOnly
        "topRated" -> homeSort [i | i <- allItems, ratingNum i >= 8]
        "new" -> byYearDesc (homeSort allItems)
        "recentlyAdded" -> byYearDesc (homeSort allItems)
        "trending" -> take 300 (homeSort allItems)
        "mostWatchedToday" -> take 300 (homeSort allItems)
        "netflix" -> take 500 (drop 5 (featuredSection allItems "netflix"))
        "marvel" -> take 500 (featuredSection allItems "marvel")
        "dc" -> take 500 (featuredSection allItems "dc")
        "universal" -> studioSection allItems "universal"
        "disney" -> studioSection allItems "disney"
        "warner" -> studioSection allItems "warner"
        "hbo" -> studioSection allItems "hbo"
        "apple" -> studioSection allItems "apple"
        "indian" -> pick ["hindi", "bangla", "bengali", "kolkata", "tamil", "telugu", "malayalam", "kannada", "punjabi", "bollywood", "south indian", "india"]
        "anime" -> pick ["anime", "animation", "japanese", "demon slayer", "naruto", "one piece", "jujutsu", "attack on titan"]
        "koreanDrama" -> pick ["korean", "k-drama", "k drama", "korea"]
        "horrorNights" -> pick ["horror", "ghost", "haunt", "demon", "evil", "conjuring", "scream", "strangers"]
        "cyberpunkScifi" -> pick ["sci-fi", "science fiction", "cyberpunk", "space", "alien", "robot", "ai", "future", "matrix", "blade runner"]
        "mindfuck" -> pick ["mind", "dream", "memory", "loop", "inception", "tenet", "shutter island", "memento", "black mirror"]
        "cultClassics" -> pick ["cult", "classic", "pulp fiction", "fight club", "trainspotting", "big lebowski"]
        "a24" -> pick ["a24", "hereditary", "midsommar", "moonlight", "lady bird", "ex machina", "uncut gems", "everything everywhere"]
        "nostalgia90s" -> homeSort [i | i <- allItems, yearNum i >= 1990, yearNum i <= 1999]
        "midnightCinema" -> pick ["midnight", "neon", "noir", "cult", "horror", "thriller"]
        "trueCrime" -> pick ["true crime", "crime documentary", "serial killer", "murder", "detective"]
        "psychThriller" -> pick ["psychological", "thriller", "mystery", "suspense", "obsession"]
        "adultAnimation" -> pick ["adult animation", "rick and morty", "family guy", "south park", "bojack"]
        "postApocalyptic" -> pick ["apocalypse", "post-apocalyptic", "zombie", "wasteland", "last of us", "walking dead"]
        "feelGood" -> pick ["comedy", "family", "feel good", "romance", "adventure"]
        "darkComedy" -> pick ["dark comedy", "black comedy", "satire"]
        "timeTravel" -> pick ["time travel", "time loop", "back to the future", "timeline"]
        "spaceAi" -> pick ["space", "artificial intelligence", " ai ", "robot", "mars", "moon", "interstellar"]
        "crimeSyndicates" -> pick ["crime", "mafia", "gang", "cartel", "syndicate", "godfather", "peaky blinders"]
        "zombie" -> pick ["zombie", "undead", "walking dead", "resident evil"]
        "indieGems" -> pick ["indie", "festival", "independent"]
        "hiddenMasterpieces" -> take 500 (homeSort [i | i <- allItems, ratingNum i >= 7, hasArt i])
        "liveConcerts" -> pick ["concert", "music", "live", "documentary"]
        "documentaryVault" -> pick ["documentary", "docu", "nature", "history", "biography"]
        "ghibli" -> pick ["ghibli", "miyazaki", "spirited away", "totoro", "howl"]
        "romanceMidnight" -> pick ["romance", "romantic", "love", "relationship"]
        "comingSoon" -> homeSort [i | i <- allItems, yearNum i >= 2026]
        "drama" -> pick ["drama", "emotion", "life", "family"]
        "spanish" -> pick ["spanish", "latino", "latin", "mexico", "argentina", "colombia"]
        _ -> homeSort allItems
  in result

normalMovieItems :: CatalogState -> [Value]
normalMovieItems state =
  let local = map (insertFields [("type", String "movie"), ("_sourceRank", Number 0)]) (csLocalMovies state)
      ftp =
        [ object
          [ "id" .= T.pack ("ftp_home_" ++ show i)
          , "name" .= fieldText "title" m
          , "title" .= fieldText "title" m
          , "file" .= textFallback (fieldText "filename" m) ""
          , "poster" .= nullish (field "poster" m)
          , "backdrop" .= fallbackValue (field "backdrop" m) (field "poster" m)
          , "tmdbId" .= nullish (field "tmdbId" m)
          , "overview" .= textOr "" (field "overview" m)
          , "year" .= textOr "" (field "year" m)
          , "rating" .= nullish (field "rating" m)
          , "type" .= String "movie"
          , "genre" .= textOr "" (field "genre" m)
          , "category" .= textOr "" (field "category" m)
          , "language" .= textOr "" (field "language" m)
          , "productionCompanies" .= arrayOrEmpty (field "productionCompanies" m)
          , "streamUrl" .= fieldText "streamUrl" m
          , "isFtp" .= True
          , "_sourceRank" .= (1 :: Int)
          ]
        | (i, m) <- zip [(0 :: Int)..] (filter (not . isCartoonOrAnime) (csCatalogMovies state))
        ]
  in dedupeBy homeMovieKey (local ++ ftp)

normalSeriesItems :: CatalogState -> [Value]
normalSeriesItems state =
  let local = map (insertFields [("type", String "series"), ("_sourceRank", Number 0)]) (csLocalSeries state)
      ftp =
        [ insertFields
            [ ("_sourceRank", Number 1)
            , ("id", String (T.pack ("ftp_series_home_" ++ show i)))
            , ("overview", textOr "" (field "overview" s))
            , ("category", textOr "" (field "category" s))
            , ("language", textOr "" (field "language" s))
            ]
            (seriesRouteValue s)
        | (i, s) <- zip [(0 :: Int)..] (filter (not . isCartoonOrAnime) (csCatalogSeries state))
        ]
  in dedupeBy (\i -> T.toLower (firstText ["name", "title"] i) <> "|" <> fieldText "year" i) (local ++ ftp)

insertFields :: [(T.Text, Value)] -> Value -> Value
insertFields newFields (Object o) = Object (foldl' (\acc (k, v) -> KM.insert (fromText k) v acc) o newFields)
insertFields _ v = v

homeMovieKey :: Value -> T.Text
homeMovieKey item =
  T.toLower (firstText ["name", "title"] item)
    <> "|" <> fieldText "year" item
    <> "|" <> fieldText "tmdbId" item
    <> "|" <> fieldText "streamUrl" item

homeText :: Value -> T.Text
homeText item =
  T.toLower . T.unwords . filter (not . T.null) $
    [ fieldText "name" item
    , fieldText "title" item
    , fieldText "file" item
    , fieldText "filename" item
    , fieldText "overview" item
    , fieldText "genre" item
    , fieldText "category" item
    , fieldText "language" item
    , fieldText "year" item
    ] ++ valueListText "productionCompanies" item

hasAny :: T.Text -> [T.Text] -> Bool
hasAny text = any (`T.isInfixOf` text)

hasArt :: Value -> Bool
hasArt item = field "poster" item /= Null || field "backdrop" item /= Null

ratingNum :: Value -> Double
ratingNum item =
  case reads (T.unpack (fieldText "rating" item)) of
    ((n, _):_) -> n
    [] -> 0

yearNum :: Value -> Int
yearNum item =
  let digits = take 4 (dropWhile (not . isDigit) (T.unpack (fieldText "year" item)))
  in if length digits == 4 then readInt 0 digits else 0

homeSort :: [Value] -> [Value]
homeSort =
  sortBy cmp
  where
    cmp a b =
      compare (artScore b, ratingNum b, yearNum b) (artScore a, ratingNum a, yearNum a)
    artScore item = if hasArt item then (1 :: Int) else 0

featuredSection :: [Value] -> T.Text -> [Value]
featuredSection allItems key =
  let candidates =
        [ (dedupeKey, score, phrase, item)
        | item <- allItems
        , hasArt item
        , let (score, phrase) = featuredMediaScore item key
        , score > 0
        , let dedupeKey = featuredDedupeKey item key phrase
        ]
      best = M.elems (foldl' insertFeaturedCandidate M.empty (zip [(0 :: Int)..] candidates))
      sorted = sortBy (\(orderA, scoreA, _, _) (orderB, scoreB, _, _) -> compare scoreB scoreA <> compare orderA orderB) best
      hdItem item = if key == "marvel" || key == "dc" then featuredHdStudioItem item else item
  in take 500 [hdItem item | (_, _, _, item) <- sorted]

insertFeaturedCandidate :: M.Map T.Text (Int, Int, T.Text, Value) -> (Int, (T.Text, Int, T.Text, Value)) -> M.Map T.Text (Int, Int, T.Text, Value)
insertFeaturedCandidate best (order, (dedupeKey, score, phrase, item)) =
  M.alter update dedupeKey best
  where
    update Nothing = Just (order, score, phrase, item)
    update (Just current@(firstOrder, currentScore, _, currentItem)) =
      if betterFeaturedCandidate currentScore currentItem score item
        then Just (firstOrder, score, phrase, item)
        else Just current

betterFeaturedCandidate :: Int -> Value -> Int -> Value -> Bool
betterFeaturedCandidate currentScore currentItem nextScore nextItem =
  case compare (featuredArtRank nextItem) (featuredArtRank currentItem) of
    GT -> True
    LT -> False
    EQ ->
      case compare nextScore currentScore of
        GT -> True
        LT -> False
        EQ -> ratingNum nextItem > ratingNum currentItem

featuredArtRank :: Value -> Int
featuredArtRank item =
  (if field "backdrop" item /= Null then 3 else 0)
    + (if field "poster" item /= Null then 2 else 0)

featuredMediaScore :: Value -> T.Text -> (Int, T.Text)
featuredMediaScore item key =
  let (hitScore, phrase) = featuredPriorityHit item key
      studioBoost =
        if key == "netflix"
          then max hitScore (featuredNetflixIndicatorScore item)
          else hitScore + if hasStudioCompany item key then 55000 else 0
  in if studioBoost <= 0
       then (0, phrase)
       else
         let art = if field "backdrop" item /= Null then 9000 else if field "poster" item /= Null then 6500 else 0
             rating = round (max 0 (min 10 (ratingNum item)) * 500)
             year = max 0 (min 2500 (yearNum item - 1980))
             playable = if fieldText "streamUrl" item /= "" || fieldText "file" item /= "" then 1200 else 0
         in (studioBoost + art + rating + year + playable, phrase)

featuredPriorityHit :: Value -> T.Text -> (Int, T.Text)
featuredPriorityHit item key =
  foldl' step (0, "") (zip [(0 :: Int)..] (featuredPhrases key))
  where
    base = featuredTitleBase item
    hay = " " <> base <> " "
    step best@(bestScore, _) (i, phrase) =
      let wrapped = " " <> phrase <> " "
          score
            | base == phrase = 320000 - i * 1000
            | (phrase <> " ") `T.isPrefixOf` base = 230000 - i * 1000
            | wrapped `T.isInfixOf` hay = 200000 - i * 1000
            | phrase `T.isInfixOf` base = 170000 - i * 1000
            | otherwise = 0
      in if score > bestScore then (score, phrase) else best

featuredNetflixIndicatorScore :: Value -> Int
featuredNetflixIndicatorScore item
  | hasStudioCompany item "netflix" = 70000
  | "netflix" `T.isInfixOf` raw = 52000
  | "netflix original" `T.isInfixOf` raw = 52000
  | "nf-web" `T.isInfixOf` raw = 52000
  | "nf web" `T.isInfixOf` raw = 52000
  | " nf " `T.isInfixOf` separated = 52000
  | otherwise = 0
  where
    raw = T.toLower (T.unwords ([fieldText k item | k <- ["name", "title", "file", "filename", "category"]] ++ valueListText "productionCompanies" item))
    separated = " " <> T.map sep raw <> " "
    sep c = if isAlphaNum c then c else ' '

featuredDedupeKey :: Value -> T.Text -> T.Text -> T.Text
featuredDedupeKey item key phrase =
  key <> "|" <> mediaType <> "|" <> textFallback phrase (featuredTitleBase item) <> "|" <> year
  where
    mediaType = textFallback (fieldText "type" item) (if field "seasons" item /= Null then "series" else "movie")
    year = if yearNum item > 0 then T.pack (show (yearNum item)) else ""

featuredTitleBase :: Value -> T.Text
featuredTitleBase item =
  T.unwords
    [ token
    | token <- T.words (normalizeHomeSearchText (firstText ["name", "title", "file", "filename"] item))
    , not (isYearToken token)
    , token `notElem` featuredNoiseTokens
    ]

featuredNoiseTokens :: [T.Text]
featuredNoiseTokens =
  [ "2160p", "1080p", "720p", "480p", "4k", "uhd", "hdr", "sdr", "web", "webrip"
  , "webdl", "bluray", "brrip", "dvdrip", "hdtc", "hdts", "x264", "x265", "h264"
  , "hevc", "aac", "ddp", "dd5", "dts", "remux", "repack", "yify", "rarbg", "tigole"
  , "psa", "mkv", "mp4", "reencoded", "dual", "audio", "hindi", "english", "esub"
  , "msub", "season", "episode", "vol", "volume"
  ]

featuredHdStudioItem :: Value -> Value
featuredHdStudioItem item =
  insertFields fields item
  where
    posterText = fieldText "poster" item
    backdropText = fieldText "backdrop" item
    posterNew = if T.null posterText then "" else upgradeTmdbImage False posterText
    backdropNew
      | not (T.null backdropText) = upgradeTmdbImage True backdropText
      | not (T.null posterNew) = posterNew
      | otherwise = ""
    fields =
      [("_wideStudio", Bool True)]
        ++ [("poster", String posterNew) | not (T.null posterNew)]
        ++ [("backdrop", String backdropNew) | not (T.null backdropNew)]

upgradeTmdbImage :: Bool -> T.Text -> T.Text
upgradeTmdbImage wide value
  | marker `T.isInfixOf` value =
      let (before, rest0) = T.breakOn marker value
          rest = T.drop (T.length marker) rest0
          afterSize =
            case T.breakOn "/" rest of
              (_, slash) | not (T.null slash) -> T.drop 1 slash
              _ -> rest
      in before <> marker <> (if wide then "w1280" else "w780") <> "/" <> afterSize
  | otherwise = value
  where
    marker = "/t/p/"

featuredPhrases :: T.Text -> [T.Text]
featuredPhrases "netflix" =
  map normalizeHomeSearchText
    [ "stranger things", "wednesday", "squid game", "money heist", "dark", "black mirror", "the witcher", "narcos", "ozark", "the crown"
    , "bridgerton", "house of cards", "mindhunter", "the queens gambit", "sex education", "you", "lupin", "cobra kai", "one piece", "avatar the last airbender"
    , "3 body problem", "the night agent", "arcane", "the sandman", "all of us are dead", "alice in borderland", "kingdom", "the gentleman", "the gentlemen"
    , "dahmer", "beef", "maid", "bodyguard", "the umbrella academy", "lost in space", "the haunting of hill house", "the fall of the house of usher"
    , "love death robots", "our planet", "extraction", "extraction 2", "the gray man", "red notice", "bird box", "enola holmes", "the irishman", "marriage story"
    , "glass onion", "dont look up", "the adam project", "army of the dead", "leave the world behind", "the old guard", "society of the snow", "the platform"
    ]
featuredPhrases "marvel" =
  map normalizeHomeSearchText
    [ "avengers endgame", "avengers infinity war", "the avengers", "avengers age of ultron"
    , "iron man", "iron man 2", "iron man 3", "captain america the first avenger", "captain america the winter soldier", "captain america civil war"
    , "thor", "thor the dark world", "thor ragnarok", "thor love and thunder", "guardians of the galaxy", "guardians of the galaxy vol 2", "guardians of the galaxy vol 3"
    , "spider man homecoming", "spider man far from home", "spider man no way home", "spider man into the spider verse", "spider man across the spider verse"
    , "black panther", "black panther wakanda forever", "doctor strange", "doctor strange in the multiverse of madness", "ant man", "ant man and the wasp", "ant man and the wasp quantumania"
    , "captain marvel", "the marvels", "shang chi", "eternals", "black widow", "deadpool", "deadpool 2", "deadpool wolverine", "logan", "the wolverine", "x men days of future past"
    , "x men first class", "x men", "x2", "x men apocalypse", "fantastic four", "daredevil", "loki", "wandavision", "moon knight", "the punisher", "jessica jones"
    , "luke cage", "iron fist", "hawkeye", "ms marvel", "she hulk", "the falcon and the winter soldier", "agents of shield", "agent carter", "what if", "x men 97"
    ]
featuredPhrases "dc" =
  map normalizeHomeSearchText
    [ "the dark knight", "the dark knight rises", "batman begins", "the batman", "batman", "batman returns", "batman forever", "batman mask of the phantasm"
    , "joker", "joker folie a deux", "superman", "superman ii", "superman returns", "man of steel", "batman v superman", "zack snyders justice league", "justice league"
    , "wonder woman", "wonder woman 1984", "aquaman", "aquaman and the lost kingdom", "the flash", "shazam", "shazam fury of the gods", "black adam", "blue beetle"
    , "suicide squad", "the suicide squad", "birds of prey", "watchmen", "constantine", "green lantern", "v for vendetta", "peacemaker", "the penguin", "gotham"
    , "superman and lois", "arrow", "the flash tv", "titans", "doom patrol", "stargirl", "swamp thing", "pennyworth", "batwoman", "smallville", "lucifer", "young justice", "harley quinn"
    ]
featuredPhrases _ = []

studioSection :: [Value] -> T.Text -> [Value]
studioSection allItems key =
  let scored =
        [ (score, item)
        | item <- allItems
        , let score = studioScore item key
        , score > 0
        ]
      sorted = map snd (sortBy (\(a, _) (b, _) -> compare b a) scored)
  in take 500 (dedupeBy studioDedupeKey sorted)

studioScore :: Value -> T.Text -> Int
studioScore item key =
  let titleText = homeTitleText item
      companies = if hasStudioCompany item key then 500 else 0
      keywordScore = maximum (0 : map (studioPhraseScore titleText) (studioKeywords key))
  in if companies == 0 && keywordScore == 0
       then 0
       else
         let art = if hasArt item then 60 else 0
             rating = min 100 (round (ratingNum item * 10))
             year = max 0 (min 40 (yearNum item - 1985))
         in companies + keywordScore + art + rating + year

studioPhraseScore :: T.Text -> T.Text -> Int
studioPhraseScore titleText phrase
  | titleText == phrase = 450
  | (phrase <> " ") `T.isPrefixOf` titleText = 360
  | (" " <> phrase <> " ") `T.isInfixOf` titleText = 260
  | phrase `T.isInfixOf` titleText = 260
  | otherwise = 0

studioDedupeKey :: Value -> T.Text
studioDedupeKey item =
  normalizeHomeSearchText (firstText ["name", "title"] item)
    <> "|" <> fieldText "year" item
    <> "|" <> fieldText "type" item

homeTitleText :: Value -> T.Text
homeTitleText item =
  normalizeHomeSearchText (T.unwords ([fieldText k item | k <- ["name", "title", "file", "filename", "category", "year"]] ++ valueListText "productionCompanies" item))

companyText :: Value -> T.Text
companyText item =
  normalizeHomeSearchText (T.unwords (valueListText "productionCompanies" item ++ [fieldText k item | k <- ["studio", "network", "category"]]))

hasStudioCompany :: Value -> T.Text -> Bool
hasStudioCompany item key =
  any (`T.isInfixOf` companyText item) (studioCompanies key)

normalizeHomeSearchText :: T.Text -> T.Text
normalizeHomeSearchText =
  T.unwords . T.words . T.map repl . T.replace "`" "" . T.replace "'" "" . T.replace "&" " and " . T.toLower
  where
    repl c
      | isAlphaNum c = c
      | otherwise = ' '

studioCompanies :: T.Text -> [T.Text]
studioCompanies "netflix" = map normalizeHomeSearchText ["netflix"]
studioCompanies "marvel" = map normalizeHomeSearchText ["marvel studios", "marvel entertainment", "marvel enterprises"]
studioCompanies "dc" = map normalizeHomeSearchText ["dc entertainment", "dc films", "dc studios", "dc comics"]
studioCompanies "universal" = map normalizeHomeSearchText ["universal pictures", "universal studios", "illumination", "dreamworks animation", "focus features"]
studioCompanies "disney" = map normalizeHomeSearchText ["walt disney", "disney", "pixar", "lucasfilm", "marvel studios", "20th century studios"]
studioCompanies "warner" = map normalizeHomeSearchText ["warner bros", "warner brothers", "new line cinema", "legendary pictures", "dc entertainment", "castle rock"]
studioCompanies "hbo" = map normalizeHomeSearchText ["hbo", "home box office", "warner media", "max"]
studioCompanies "apple" = map normalizeHomeSearchText ["apple tv", "apple studios", "apple original films"]
studioCompanies _ = []

studioKeywords :: T.Text -> [T.Text]
studioKeywords "marvel" =
  map normalizeHomeSearchText
    [ "iron man", "iron man 2", "iron man 3", "the incredible hulk", "thor", "thor the dark world", "thor ragnarok", "thor love and thunder"
    , "captain america", "the first avenger", "winter soldier", "civil war", "the avengers", "avengers", "age of ultron", "infinity war", "endgame"
    , "guardians of the galaxy", "ant man", "ant-man", "doctor strange", "black panther", "captain marvel", "shang chi", "eternals"
    , "black widow", "spider man", "spider-man", "no way home", "homecoming", "far from home", "venom", "deadpool", "wolverine", "x men", "x-men", "fantastic four"
    ]
studioKeywords "dc" =
  map normalizeHomeSearchText
    [ "batman", "the batman", "dark knight", "superman", "man of steel", "wonder woman", "aquaman", "justice league", "zack snyder", "joker", "suicide squad"
    , "the suicide squad", "birds of prey", "black adam", "shazam", "the flash", "blue beetle", "watchmen", "constantine", "green lantern", "gotham", "peacemaker", "v for vendetta"
    ]
studioKeywords "universal" =
  map normalizeHomeSearchText
    [ "jurassic park", "jurassic world", "fast and furious", "fast & furious", "the fast and the furious", "furious 7", "fast five", "hobbs and shaw"
    , "jaws", "e t", "et the extra terrestrial", "back to the future", "bourne", "jason bourne", "the mummy", "mummy returns", "despicable me", "minions"
    , "sing", "secret life of pets", "kung fu panda", "how to train your dragon", "shrek", "puss in boots", "trolls", "oppenheimer", "nope", "get out", "us", "halloween", "the purge"
    ]
studioKeywords "disney" =
  map normalizeHomeSearchText
    [ "disney", "pixar", "toy story", "finding nemo", "finding dory", "incredibles", "cars", "monsters inc", "inside out", "coco", "up", "wall e", "ratatouille"
    , "frozen", "moana", "encanto", "zootopia", "lion king", "aladdin", "beauty and the beast", "mulan", "little mermaid", "lilo stitch", "pirates of the caribbean"
    , "star wars", "mandalorian", "ahsoka", "obi wan", "andor", "loki", "wandavision", "moon knight", "ms marvel", "hawkeye", "she hulk"
    ]
studioKeywords "warner" =
  map normalizeHomeSearchText
    [ "warner", "harry potter", "fantastic beasts", "lord of the rings", "the hobbit", "matrix", "dune", "godzilla", "kong", "mad max", "blade runner", "inception"
    , "interstellar", "tenet", "conjuring", "annabelle", "it chapter", "it ", "sherlock holmes", "ocean", "creed", "rocky", "space jam", "barbie", "wonka"
    ]
studioKeywords "hbo" =
  map normalizeHomeSearchText
    [ "hbo", "max original", "house of the dragon", "game of thrones", "the last of us", "true detective", "succession", "euphoria", "westworld", "the wire"
    , "sopranos", "chernobyl", "boardwalk empire", "watchmen", "mare of easttown", "big little lies", "white lotus", "silicon valley", "barry", "peacemaker"
    ]
studioKeywords "apple" =
  map normalizeHomeSearchText
    [ "apple tv", "appletv", "apple original", "ted lasso", "severance", "silo", "foundation", "for all mankind", "the morning show", "slow horses", "see", "invasion"
    , "servant", "defending jacob", "black bird", "shrinking", "mythic quest", "monarch legacy of monsters", "lessons in chemistry", "pachinko", "masters of the air"
    ]
studioKeywords _ = []
