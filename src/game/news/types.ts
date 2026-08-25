import type { MarketCode } from '../../types/market'

export type NewsTiming = 'PRE_OPEN' | 'INTRADAY' | 'POST_CLOSE'
export type NewsCategory = 'COMPANY' | 'MARKET' | 'MACRO' | 'POLICY'
export type NewsMarket = MarketCode | 'GLOBAL'

export interface NewsItem {
  id: string
  date: string
  timing: NewsTiming
  category: NewsCategory
  market: NewsMarket
  headline: string
  summary: string
  article: string[]
  important: boolean
  relatedAssetIds: string[]
  relatedSectors: string[]
  sourceReferences: string[]
}

export interface NewsManifestYear {
  year: number
  path: string
}

export interface NewsManifest {
  schemaVersion: number
  coverage: { from: string; to: string }
  source: {
    mode: 'empty-seed' | 'curated'
    generatedAt: string | null
  }
  years: NewsManifestYear[]
}

export interface NewsYearDataset {
  schemaVersion: number
  year: number
  items: NewsItem[]
}

export interface ImportantNewsRecord {
  newsId: string
  publishedDate: string
  revealDate: string
  timing: NewsTiming
  category: NewsCategory
  market: NewsMarket
  headline: string
  summary: string
}
