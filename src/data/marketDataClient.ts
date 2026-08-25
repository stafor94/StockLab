import {
  parseAssetPriceSeries,
  parseMarketCalendar,
  parseMarketDataManifest,
} from './schema'
import type {
  AssetPriceSeries,
  MarketCalendar,
  MarketCode,
  MarketDataManifest,
} from '../types/market'

const DEFAULT_DATA_ROOT = `${import.meta.env.BASE_URL}data/`

export class MarketDataLoadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MarketDataLoadError'
  }
}

export class MarketDataClient {
  private readonly jsonCache = new Map<string, Promise<unknown>>()

  constructor(private readonly dataRoot = DEFAULT_DATA_ROOT) {}

  private buildUrl(path: string): string {
    const root = this.dataRoot.endsWith('/') ? this.dataRoot : `${this.dataRoot}/`
    return `${root}${path.replace(/^\/+/, '')}`
  }

  private loadJson(path: string): Promise<unknown> {
    const url = this.buildUrl(path)
    const cached = this.jsonCache.get(url)
    if (cached) {
      return cached
    }

    const request = fetch(url).then(async (response) => {
      if (!response.ok) {
        throw new MarketDataLoadError(`Failed to load ${url}: HTTP ${response.status}`)
      }
      return response.json() as Promise<unknown>
    })

    this.jsonCache.set(url, request)
    void request.catch(() => this.jsonCache.delete(url))
    return request
  }

  async loadManifest(): Promise<MarketDataManifest> {
    return parseMarketDataManifest(await this.loadJson('manifest.json'))
  }

  async loadCalendar(market: MarketCode): Promise<MarketCalendar> {
    const manifest = await this.loadManifest()
    return parseMarketCalendar(await this.loadJson(manifest.calendars[market]))
  }

  async loadAssetPriceSeries(assetId: string): Promise<AssetPriceSeries> {
    const manifest = await this.loadManifest()
    const asset = manifest.assets.find((item) => item.id === assetId)
    if (!asset) {
      throw new MarketDataLoadError(`Unknown asset id: ${assetId}`)
    }
    return parseAssetPriceSeries(await this.loadJson(asset.dataPath))
  }

  clearCache(): void {
    this.jsonCache.clear()
  }
}

export const marketDataClient = new MarketDataClient()
