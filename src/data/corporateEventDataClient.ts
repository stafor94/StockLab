import { mergeCorporateEventDatasets, parseCorporateEventDataset } from './corporateEventSchema'
import { CORPORATE_EVENT_SHARD_FILES } from './corporateEventShards'
import type { CorporateEventDataset } from '../game/corporate/types'

const CORE_PATH = `${import.meta.env.BASE_URL}data/events/corporate.json`
const DEFAULT_SHARD_PATHS = CORPORATE_EVENT_SHARD_FILES.map((file) => `${import.meta.env.BASE_URL}data/events/${file}`)

let cached: Promise<CorporateEventDataset> | null = null

async function loadDataset(path: string): Promise<CorporateEventDataset> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`Failed to load corporate events: HTTP ${response.status}`)
  return parseCorporateEventDataset(await response.json() as unknown)
}

export async function loadCorporateEventDataset(path = CORE_PATH): Promise<CorporateEventDataset> {
  if (path !== CORE_PATH) return loadDataset(path)
  if (cached) return cached
  const request = Promise.all(DEFAULT_SHARD_PATHS.map(loadDataset)).then(mergeCorporateEventDatasets)
  cached = request
  void request.catch(() => { cached = null })
  return request
}
