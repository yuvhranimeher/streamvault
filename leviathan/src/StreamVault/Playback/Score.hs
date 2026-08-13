module StreamVault.Playback.Score where
import StreamVault.Capabilities
import StreamVault.Media

data Compatibility = Native | Remuxable | Incompatible deriving (Eq,Ord,Show)
data Score = Score { compatibilityScore :: Int, transportScore :: Int, verificationScore :: Int, rangeScore :: Int, latencyScore :: Int, resolutionScore :: Int, biasScore :: Int, totalScore :: Int } deriving (Eq,Show)

compatibility :: ClientCapabilities -> MediaSource -> Compatibility
compatibility caps src
  | container src `elem` containers caps && videoCodec src `elem` videoCodecs caps && audioOK = Native
  | videoCodec src `elem` videoCodecs caps && audioOK = Remuxable
  | otherwise = Incompatible
 where audioOK = null (audioCodecs src) || any (`elem` audioCodecs caps) (audioCodecs src)

scoreSource :: ClientCapabilities -> MediaSource -> Score
scoreSource caps src = Score a b c d e f g (a+b+c+d+e+f+g)
 where
  a = case compatibility caps src of Native -> 5000; Remuxable -> 2500; Incompatible -> -3000
  b = case protocol src of TLSHTTP -> 900; LocalFile -> 800; HLSUpstream -> 600; PlainHTTP -> 250; FTP -> 50
  c = if verified src then 700 else -400
  d = if rangeCapable src then 500 else -650
  e = maybe 0 (\ms -> max (-700) (500-ms `div` 2)) (latencyMs src)
  f = case resolution src of
        Nothing -> 0
        Just r -> networkPenalty r + sizePenalty r
  g = priorityBias src
  networkPenalty r = case network caps of Slow | height r > 480 -> -1200; Constrained | height r > 720 -> -900; _ -> 0
  sizePenalty r = maybe 0 (\m -> if width r > m then -800 else 250) (maxWidth caps)
