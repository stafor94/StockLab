import type { ImportantNewsRecord } from '../../game/news/types'

const categoryLabel = { COMPANY: '기업', MARKET: '시장', MACRO: '거시경제', POLICY: '정책' } as const

export function ImportantNewsModal({ news, onConfirm, onOpenNews }: { news: ImportantNewsRecord; onConfirm: () => void; onOpenNews: () => void }) {
  return (
    <div className="event-modal-backdrop" role="presentation">
      <section className="event-modal" role="dialog" aria-modal="true" aria-label="중요 뉴스">
        <p className="section-label">IMPORTANT NEWS</p>
        <h2>{news.headline}</h2>
        <div className="event-meta"><span>{news.revealDate}</span><span>{categoryLabel[news.category]}</span><span>{news.market}</span><span>{news.timing}</span></div>
        <p>{news.summary}</p>
        <p className="event-stop-note">중요 뉴스가 공개되어 자동진행이 멈췄습니다. 내용을 확인한 뒤 계속 진행할 수 있습니다.</p>
        <div className="important-news-actions"><button type="button" onClick={onOpenNews}>뉴스 보기</button><button type="button" onClick={onConfirm}>확인</button></div>
      </section>
    </div>
  )
}
