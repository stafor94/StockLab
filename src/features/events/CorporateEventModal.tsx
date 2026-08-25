import type { CorporateActionRecord } from '../../game/corporate/types'

const labels: Record<CorporateActionRecord['type'], string> = {
  DIVIDEND: '배당',
  SPLIT: '주식분할',
  REVERSE_SPLIT: '주식병합',
  MERGER: '합병',
  DELISTING: '상장폐지',
  LISTING: '상장',
  HALT: '거래정지',
  RESUME: '거래재개',
}

interface Props { event: CorporateActionRecord; onConfirm: () => void }

export function CorporateEventModal({ event, onConfirm }: Props) {
  return (
    <div className="event-modal-backdrop" role="presentation">
      <section className="event-modal" role="dialog" aria-modal="true" aria-labelledby="event-modal-title">
        <p className="section-kicker">중요 기업 이벤트 · {labels[event.type]}</p>
        <h2 id="event-modal-title">{event.title}</h2>
        <div className="event-meta"><span>{event.date}</span><span>{event.assetId}</span><span>{event.timing}</span></div>
        <p>{event.summary}</p>
        <div className="event-effect"><strong>계좌 반영</strong><span>{event.note}</span></div>
        <p className="event-stop-note">중요 이벤트를 확인하기 전에는 시간 진행이 중단됩니다.</p>
        <button className="primary-button" type="button" onClick={onConfirm}>확인</button>
      </section>
    </div>
  )
}
