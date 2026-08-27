import { create } from 'zustand'
import type { CorporateActionRecord } from '../../game/corporate/types'
import type { ImportantNewsRecord } from '../../game/news/types'

export type AutoplayNoticeKind = 'event' | 'news'

export interface AutoplayNotice {
  id: string
  kind: AutoplayNoticeKind
  date: string
  title: string
  message: string
}

export interface LoanPaymentFailureAlert {
  id: string
  date: string
  amount: number
  note: string
  consecutiveMissedMonths: number
}

interface AutoplayUiState {
  running: boolean
  notices: AutoplayNotice[]
  loanAlert: LoanPaymentFailureAlert | null
  setRunning: (running: boolean) => void
  enqueueNotices: (notices: AutoplayNotice[]) => void
  dismissNotice: (id: string) => void
  showLoanAlert: (alert: LoanPaymentFailureAlert) => void
  dismissLoanAlert: () => void
  reset: () => void
}

export function buildAutoplayNotices(
  events: CorporateActionRecord[],
  news: ImportantNewsRecord[],
): AutoplayNotice[] {
  return [
    ...events.map((event) => ({
      id: `event:${event.eventId}`,
      kind: 'event' as const,
      date: event.date,
      title: event.title,
      message: event.summary,
    })),
    ...news.map((item) => ({
      id: `news:${item.newsId}`,
      kind: 'news' as const,
      date: item.revealDate,
      title: item.headline,
      message: item.summary,
    })),
  ]
}

export const useAutoplayUiStore = create<AutoplayUiState>((set) => ({
  running: false,
  notices: [],
  loanAlert: null,
  setRunning: (running) => set({ running }),
  enqueueNotices: (incoming) => set((state) => {
    if (incoming.length === 0) return state
    const existingIds = new Set(state.notices.map((notice) => notice.id))
    const unique = incoming.filter((notice) => !existingIds.has(notice.id))
    return unique.length > 0 ? { notices: [...state.notices, ...unique] } : state
  }),
  dismissNotice: (id) => set((state) => ({ notices: state.notices.filter((notice) => notice.id !== id) })),
  showLoanAlert: (loanAlert) => set({ loanAlert }),
  dismissLoanAlert: () => set({ loanAlert: null }),
  reset: () => set({ running: false, notices: [], loanAlert: null }),
}))
