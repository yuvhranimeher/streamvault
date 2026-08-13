{-# LANGUAGE DataKinds #-}
{-# LANGUAGE TypeOperators #-}

module StreamVault.Planner.API
  ( API
  , apiProxy
  ) where

import Data.Proxy (Proxy (..))
import Servant
import StreamVault.Planner.Types

type API =
       "health" :> Get '[JSON] Health
  :<|> "v1" :> "plan" :> ReqBody '[JSON] PlanRequest :> Post '[JSON] PlanResponse
  :<|> "v1" :> "range" :> ReqBody '[JSON] RangeRequest :> Post '[JSON] RangeResponse

apiProxy :: Proxy API
apiProxy = Proxy
