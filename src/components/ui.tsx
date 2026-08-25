import type { ReactNode } from 'react'

interface SectionHeaderProps {
  title: string
  description?: string
  meta?: ReactNode
  actionLabel?: string
  onAction?: () => void
}

export function SectionHeader({ title, description, meta, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <header className="section-header">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      <div className="section-header-tail">
        {meta}
        {actionLabel && onAction && <button className="text-action" type="button" onClick={onAction}>{actionLabel}<span aria-hidden="true">›</span></button>}
      </div>
    </header>
  )
}

interface EmptyStateProps {
  title: string
  description?: string
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return <div className="compact-empty-state"><strong>{title}</strong>{description && <p>{description}</p>}</div>
}

interface AssetAvatarProps {
  market: 'KR' | 'US'
  kind: 'stock' | 'etf'
}

export function AssetAvatar({ market, kind }: AssetAvatarProps) {
  const label = kind === 'etf' ? 'ETF' : market
  return <span className={`asset-avatar ${market.toLowerCase()} ${kind}`} aria-hidden="true">{label}</span>
}
