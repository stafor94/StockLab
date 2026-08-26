import { AppIcon, type AppIconName } from '../components/AppIcon'
import { useHelp } from '../features/help/HelpCenter'
import type { NavigationGuidance } from '../features/guidance/guidanceSelector'

export const navigationItems = [
  { label: '홈', icon: 'home' },
  { label: '시장', icon: 'market' },
  { label: '포트폴리오', icon: 'portfolio' },
  { label: '뉴스', icon: 'news' },
  { label: '자산', icon: 'assets' },
] as const satisfies ReadonlyArray<{ label: string; icon: AppIconName }>

export type NavigationItem = (typeof navigationItems)[number]['label']

export function AppHeader({ gameDate }: { gameDate: string }) {
  const { openHelp } = useHelp()
  return (
    <header className="app-header">
      <div className="app-header-brand"><h1>StockLab</h1><span>v{__APP_VERSION__}</span></div>
      <div className="app-header-actions">
        <div className="app-game-date" aria-label="게임 날짜"><span>게임 날짜</span><strong>{gameDate}</strong></div>
        <button className="header-help-button" type="button" onClick={() => openHelp()}>도움말</button>
      </div>
    </header>
  )
}

interface AppNavigationProps {
  active: NavigationItem
  onChange: (item: NavigationItem) => void
  guidance?: Partial<Record<NavigationItem, NavigationGuidance>>
}

export function AppNavigation({ active, onChange, guidance = {} }: AppNavigationProps) {
  return (
    <nav className="app-navigation" aria-label="주 메뉴">
      {navigationItems.map((item) => {
        const badge = guidance[item.label] ?? {}
        const label = badge.attentionReason ? `${item.label}, ${badge.attentionReason}` : item.label
        return (
          <button
            type="button"
            key={item.label}
            className={[active === item.label ? 'active' : '', badge.isRecommended ? 'guidance-recommended' : ''].filter(Boolean).join(' ')}
            aria-label={label}
            aria-current={active === item.label ? 'page' : undefined}
            data-tutorial-id={item.label === '시장' ? 'navigation-market' : undefined}
            onClick={() => onChange(item.label)}
          >
            <AppIcon name={item.icon} />
            <span>{item.label}</span>
            {badge.attentionCount ? <span className="navigation-attention" aria-hidden="true">{badge.attentionCount > 9 ? '9+' : badge.attentionCount}</span> : null}
            {badge.isExperienced ? <span className="navigation-check" aria-hidden="true">✓</span> : null}
          </button>
        )
      })}
    </nav>
  )
}
