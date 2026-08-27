import { useEffect, useState } from 'react'
import { AppIcon, type AppIconName } from '../components/AppIcon'
import { formatKstGameDate, getKstGameTime } from '../game/calendar/marketTimeline'
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

export function AppHeader({ gameTimestamp, onOpenSettings }: { gameTimestamp: string; onOpenSettings: () => void }) {
  const { openHelp } = useHelp()
  return (
    <header className="app-header">
      <div className="app-header-brand"><h1>StockLab</h1><span>v{__APP_VERSION__}</span></div>
      <div className="app-header-actions">
        <div className="app-game-date" aria-label={`현재 날짜 ${formatKstGameDate(gameTimestamp)} ${getKstGameTime(gameTimestamp)}`}>
          <span>현재 날짜</span>
          <div><strong>{formatKstGameDate(gameTimestamp)}</strong><time dateTime={gameTimestamp}>{getKstGameTime(gameTimestamp)}</time></div>
        </div>
        <div className="app-header-utility-actions">
          <button className="header-help-button" type="button" onClick={() => openHelp()}>도움말</button>
          <button className="header-settings-button" type="button" aria-label="설정" onClick={onOpenSettings}><AppIcon name="settings" size={20} /></button>
        </div>
      </div>
    </header>
  )
}

interface AppNavigationProps {
  active: NavigationItem
  onChange: (item: NavigationItem) => void
  guidance?: Partial<Record<NavigationItem, NavigationGuidance>>
}

function clearFocusedNavigationItem() {
  const focused = document.activeElement
  if (focused instanceof HTMLElement && focused.closest('.app-navigation')) focused.blur()
}

export function AppNavigation({ active, onChange, guidance = {} }: AppNavigationProps) {
  const [keyboardModality, setKeyboardModality] = useState(false)

  useEffect(() => {
    const handleKeyboardInput = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      setKeyboardModality(true)
    }
    const handlePointerInput = () => setKeyboardModality(false)
    window.addEventListener('keydown', handleKeyboardInput, true)
    window.addEventListener('pointerdown', handlePointerInput, true)
    return () => {
      window.removeEventListener('keydown', handleKeyboardInput, true)
      window.removeEventListener('pointerdown', handlePointerInput, true)
    }
  }, [])

  return (
    <nav className="app-navigation" aria-label="주 메뉴" data-keyboard-focus={keyboardModality ? 'true' : 'false'}>
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
            onPointerDown={() => {
              setKeyboardModality(false)
              clearFocusedNavigationItem()
            }}
            onClick={(event) => {
              onChange(item.label)
              if (event.detail > 0) {
                setKeyboardModality(false)
                event.currentTarget.blur()
              } else {
                setKeyboardModality(true)
              }
            }}
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
