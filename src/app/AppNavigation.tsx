import { AppIcon, type AppIconName } from '../components/AppIcon'

export const navigationItems = [
  { label: '홈', icon: 'home' },
  { label: '시장', icon: 'market' },
  { label: '포트폴리오', icon: 'portfolio' },
  { label: '뉴스', icon: 'news' },
  { label: '자산', icon: 'assets' },
] as const satisfies ReadonlyArray<{ label: string; icon: AppIconName }>

export type NavigationItem = (typeof navigationItems)[number]['label']

export function AppHeader({ gameDate }: { gameDate: string }) {
  return (
    <header className="app-header">
      <div className="app-header-brand"><h1>StockLab</h1><span>v{__APP_VERSION__}</span></div>
      <div className="app-game-date" aria-label="게임 날짜"><span>게임 날짜</span><strong>{gameDate}</strong></div>
    </header>
  )
}

interface AppNavigationProps {
  active: NavigationItem
  onChange: (item: NavigationItem) => void
}

export function AppNavigation({ active, onChange }: AppNavigationProps) {
  return (
    <nav className="app-navigation" aria-label="주 메뉴">
      {navigationItems.map((item) => (
        <button
          type="button"
          key={item.label}
          className={active === item.label ? 'active' : ''}
          aria-current={active === item.label ? 'page' : undefined}
          onClick={() => onChange(item.label)}
        >
          <AppIcon name={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
