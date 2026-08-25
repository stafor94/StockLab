export type MarketCode = 'KR' | 'US'
export type AssetKind = 'stock' | 'etf'
export type AssetCurrency = 'KRW' | 'USD'

export interface CalendarCoverage {
  from: string
  to: string
}

export interface CalendarClosure {
  date: string
  reason: string
}

export interface CalendarSource {
  authoritativeProvider: string
  mode: 'bootstrap-seed' | 'generated'
  generatedAt: string | null
}

export interface MarketCalendar {
  schemaVersion: number
  market: MarketCode
  timeZone: string
  coverage: CalendarCoverage
  tradingDates: string[]
  closures: CalendarClosure[]
  source: CalendarSource
}

export type MarketCalendars = Record<MarketCode, MarketCalendar>

export interface AssetManifestItem {
  id: string
  alias: string
  kind: AssetKind
  market: MarketCode
  currency: AssetCurrency
  sector: string
  listedFrom: string
  dataPath: string
}

export interface MarketDataManifest {
  schemaVersion: number
  calendars: Record<MarketCode, string>
  assets: AssetManifestItem[]
}

export interface DailyBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface AssetPriceSource {
  authoritativeProvider: string
  priceBasis: 'historical-unadjusted'
  splitAdjustmentPolicy: string
  generatedAt: string
  splitRestorationCount: number
}

export interface AssetPriceSeries {
  schemaVersion: number
  id: string
  market: MarketCode
  kind: AssetKind
  currency: AssetCurrency
  source?: AssetPriceSource
  bars: DailyBar[]
}
