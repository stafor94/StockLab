import { useEffect, useMemo, useRef } from 'react'
import { useAutoplayUiStore } from './autoplayUiStore'

const AUTOPLAY_TOAST_DURATION_MS = 3_000
const MAX_VISIBLE_AUTOPLAY_TOASTS = 3

export function AutoplayToastViewport() {
  const notices = useAutoplayUiStore((state) => state.notices)
  const dismissNotice = useAutoplayUiStore((state) => state.dismissNotice)
  const timersRef = useRef(new Map<string, number>())
  const visibleNotices = useMemo(() => notices.slice(0, MAX_VISIBLE_AUTOPLAY_TOASTS), [notices])

  useEffect(() => {
    for (const notice of visibleNotices) {
      if (timersRef.current.has(notice.id)) continue
      const timer = window.setTimeout(() => {
        timersRef.current.delete(notice.id)
        dismissNotice(notice.id)
      }, AUTOPLAY_TOAST_DURATION_MS)
      timersRef.current.set(notice.id, timer)
    }
  }, [dismissNotice, visibleNotices])

  useEffect(() => () => {
    for (const timer of timersRef.current.values()) window.clearTimeout(timer)
    timersRef.current.clear()
  }, [])

  if (visibleNotices.length === 0) return null

  return (
    <div className="autoplay-toast-viewport" aria-label="자동진행 알림" aria-live="polite" aria-relevant="additions">
      {visibleNotices.map((notice) => (
        <article className={`autoplay-toast ${notice.kind}`} role="status" key={notice.id}>
          <div className="autoplay-toast-meta">
            <span>{notice.kind === 'news' ? '뉴스' : '기업 이벤트'}</span>
            <time>{notice.date}</time>
          </div>
          <strong>{notice.title}</strong>
          <p>{notice.message}</p>
        </article>
      ))}
    </div>
  )
}
