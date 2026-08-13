{-# LANGUAGE DataKinds #-}
{-# LANGUAGE KindSignatures #-}
{-# LANGUAGE TypeFamilies #-}
module StreamVault.TypeLevel where

data Stage = Raw | Probed | Validated | Planned | Serving
data Pipe (s :: Stage) = Pipe

type family Next (s :: Stage) :: Stage where
  Next 'Raw = 'Probed
  Next 'Probed = 'Validated
  Next 'Validated = 'Planned
  Next 'Planned = 'Serving
  Next 'Serving = 'Serving
