import { parseCorporateEventDataset } from './corporateEventSchema'
import type { CorporateEventDataset } from '../game/corporate/types'

const DEFAULT_PATH = `${import.meta.env.BASE_URL}data/events/corporate.json`

let cached: Promise<CorporateEventDataset> | null = null

export async function loadCorporateEventDataset(path = DEFAULT_PATH): Promise<CorporateEventDataset> {
  if (path === DEFAULT_PATH && cached) return cached
  const request = fetch(path).then(async (response) => {
    if (!response.ok) throw new Error(`Failed to load corporate events: HTTP ${response.status}`)
    return parseCorporateEventDataset(await response.json() as unknown)
  })
  if (path === DEFAULT_PATH) {
    cached = request
    void request.catch(() => { cached = null })
  }
  return request
}
