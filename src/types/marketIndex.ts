import type { DailyBar, MarketCode } from './market'

export interface MarketIndexManifestItem {
  id: string
  alias: string
  market: MarketCode
  dataPath: string
}

export interface MarketIndexManifest {
  schemaVersion: number
  indices: MarketIndexManifestItem[]
}

export interface MarketIndexSource {
  authoritativeProvider: string
  generatedAt: string
  reference: string
}

export interface MarketIndexSeries {
  schemaVersion: number
  id: string
  alias: string
  market: MarketCode
  source: MarketIndexSource
  bars: DailyBar[]
}
