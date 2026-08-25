import { parseNewsManifest, parseNewsYearDataset } from './newsSchema'
import type { NewsItem, NewsManifest } from '../game/news/types'

const DEFAULT_NEWS_ROOT = `${import.meta.env.BASE_URL}data/news/`

export class NewsDataLoadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NewsDataLoadError'
  }
}

export class NewsDataClient {
  private readonly jsonCache = new Map<string, Promise<unknown>>()
  private datasetPromise: Promise<{ manifest: NewsManifest; items: NewsItem[] }> | null = null

  constructor(private readonly root = DEFAULT_NEWS_ROOT) {}

  private buildUrl(path: string): string {
    const base = this.root.endsWith('/') ? this.root : `${this.root}/`
    return `${base}${path.replace(/^\/+/, '')}`
  }

  private loadJson(path: string): Promise<unknown> {
    const url = this.buildUrl(path)
    const cached = this.jsonCache.get(url)
    if (cached) return cached
    const request = fetch(url).then(async (response) => {
      if (!response.ok) throw new NewsDataLoadError(`Failed to load ${url}: HTTP ${response.status}`)
      return response.json() as Promise<unknown>
    })
    this.jsonCache.set(url, request)
    void request.catch(() => this.jsonCache.delete(url))
    return request
  }

  async loadManifest(): Promise<NewsManifest> {
    return parseNewsManifest(await this.loadJson('manifest.json'))
  }

  async loadAll(): Promise<{ manifest: NewsManifest; items: NewsItem[] }> {
    if (this.datasetPromise) return this.datasetPromise
    this.datasetPromise = (async () => {
      const manifest = await this.loadManifest()
      const datasets = await Promise.all(manifest.years.map(async (entry) => {
        const dataset = parseNewsYearDataset(await this.loadJson(entry.path))
        if (dataset.year !== entry.year) throw new NewsDataLoadError(`News year mismatch: expected ${entry.year}, got ${dataset.year}`)
        return dataset
      }))
      const items = datasets.flatMap((dataset) => dataset.items).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
      return { manifest, items }
    })()
    void this.datasetPromise.catch(() => { this.datasetPromise = null })
    return this.datasetPromise
  }

  clearCache(): void {
    this.jsonCache.clear()
    this.datasetPromise = null
  }
}

export const newsDataClient = new NewsDataClient()
