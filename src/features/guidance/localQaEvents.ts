export const QA_EVENT_STORAGE_KEY = 'stocklab.qa-events'

export type LocalQaEventName = 'guidance_action' | 'first_market_open' | 'first_day_closed' | 'tutorial_completed' | 'tutorial_skipped' | 'guidance_blocked'

export interface LocalQaEvent { name: LocalQaEventName; at: string; step?: string; actionCount?: number }

export function recordLocalQaEvent(event: Omit<LocalQaEvent, 'at'>): void {
  if (typeof localStorage === 'undefined') return
  const existing = readLocalQaEvents()
  existing.push({ ...event, at: new Date().toISOString() })
  localStorage.setItem(QA_EVENT_STORAGE_KEY, JSON.stringify(existing.slice(-200)))
}

export function readLocalQaEvents(): LocalQaEvent[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const value: unknown = JSON.parse(localStorage.getItem(QA_EVENT_STORAGE_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is LocalQaEvent => typeof item === 'object' && item !== null && 'name' in item && 'at' in item) : []
  } catch { return [] }
}
