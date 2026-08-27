import { parseMarketIndexManifest, parseMarketIndexSeries } from './marketIndexSchema'
import type { MarketIndexManifest, MarketIndexSeries } from '../types/marketIndex'

const DEFAULT_DATA_ROOT = `${import.meta.env.BASE_URL}data/indices/`

export class MarketIndexDataLoadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MarketIndexDataLoadError'
  }
}

export class MarketIndexDataClient {
  private readonly jsonCache = new Map<string, Promise<unknown>>()

  constructor(private readonly dataRoot = DEFAULT_DATA_ROOT) {}

  private buildUrl(path: string): string {
    const root = this.dataRoot.endsWith('/') ? this.dataRoot : `${this.dataRoot}/`
    return `${root}${path.replace(/^\/+/, '')}`
  }

  private loadJson(path: string): Promise<unknown> {
    const url = this.buildUrl(path)
    const cached = this.jsonCache.get(url)
    if (cached) return cached

    const request = fetch(url).then(async (response) => {
      if (!response.ok) throw new MarketIndexDataLoadError(`Failed to load ${url}: HTTP ${response.status}`)
      return response.json() as Promise<unknown>
    })
    this.jsonCache.set(url, request)
    void request.catch(() => this.jsonCache.delete(url))
    return request
  }

  async loadManifest(): Promise<MarketIndexManifest> {
    return parseMarketIndexManifest(await this.loadJson('manifest.json'))
  }

  async loadSeries(dataPath: string): Promise<MarketIndexSeries> {
    return parseMarketIndexSeries(await this.loadJson(dataPath))
  }

  async loadAllSeries(): Promise<MarketIndexSeries[]> {
    const manifest = await this.loadManifest()
    const series = await Promise.all(manifest.indices.map((item) => this.loadSeries(item.dataPath)))
    return series.map((item, index) => {
      const manifestItem = manifest.indices[index]
      if (item.id !== manifestItem.id || item.market !== manifestItem.market || item.alias !== manifestItem.alias) {
        throw new MarketIndexDataLoadError(`Market index manifest mismatch for ${manifestItem.id}`)
      }
      return item
    })
  }

  clearCache(): void {
    this.jsonCache.clear()
  }
}

export const marketIndexDataClient = new MarketIndexDataClient()
