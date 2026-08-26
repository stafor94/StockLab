import { AssetAvatar, EmptyState, SectionHeader } from '../../components/ui'
import type { PositionValuation } from '../../game/portfolio/types'
import type { AssetManifestItem } from '../../types/market'

const number = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 })
function priceSourceLabel(source: PositionValuation['priceSource']): string { if (source === 'today-open') return '시가'; if (source === 'today-close') return '종가'; return '최근 종가' }

interface PortfolioHoldingsProps {
  positions: PositionValuation[]
  assets: AssetManifestItem[]
  isOrderAvailable?: (position: PositionValuation, asset: AssetManifestItem) => boolean
  onOpenOrder?: (asset: AssetManifestItem) => void
}

export function PortfolioHoldings({ positions, assets, isOrderAvailable, onOpenOrder }: PortfolioHoldingsProps) {
  return (
    <section className="holdings-section">
      <SectionHeader title="보유 종목" meta={<span className="section-count">{positions.length}개</span>} />
      {positions.length === 0 ? <EmptyState title="보유 중인 종목이 없습니다." description="시장 화면에서 종목을 선택해 주문할 수 있습니다." /> : <div className="holding-list">{positions.map((position) => {
        const asset = assets.find((item) => item.id === position.assetId)
        const market = asset?.market ?? (position.currency === 'KRW' ? 'KR' : 'US')
        const kind = asset?.kind ?? 'stock'
        const canOpenOrder = Boolean(asset && onOpenOrder && isOrderAvailable?.(position, asset))
        const content = <><AssetAvatar market={market} kind={kind}/><div className="holding-copy"><strong>{asset?.alias ?? position.assetId}</strong><span>{position.assetId} · {number.format(position.quantity)}주</span></div><div className="holding-values"><strong className="financial-amount">{position.marketValue === null ? '가격 대기' : `${position.currency === 'KRW' ? '₩' : '$'}${number.format(position.marketValue)}`}</strong><span className={(position.unrealizedPnl ?? 0) >= 0 ? 'positive' : 'negative'}>{position.unrealizedPnl === null ? '손익 계산 중' : `${position.unrealizedPnl >= 0 ? '+' : '-'}${position.currency === 'KRW' ? '₩' : '$'}${number.format(Math.abs(position.unrealizedPnl))} · ${position.unrealizedRate === null ? '-' : `${position.unrealizedRate >= 0 ? '+' : ''}${position.unrealizedRate.toFixed(2)}%`}`}</span><small>{position.priceDate ? `${position.priceDate} ${priceSourceLabel(position.priceSource)}` : '가격 데이터 확인 중'}</small>{canOpenOrder && <small className="holding-order-hint">눌러서 주문</small>}</div></>

        if (canOpenOrder && asset) {
          return <button key={position.assetId} className="holding-row holding-order-row" type="button" aria-label={`${asset.alias} 주문 거래 열기`} onClick={() => onOpenOrder?.(asset)}>{content}</button>
        }
        return <article key={position.assetId} className="holding-row">{content}</article>
      })}</div>}
    </section>
  )
}
