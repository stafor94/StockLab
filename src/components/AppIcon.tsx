export type AppIconName = 'home' | 'market' | 'portfolio' | 'news' | 'assets' | 'chevron' | 'settings'

interface AppIconProps {
  name: AppIconName
  size?: number
  className?: string
}

export function AppIcon({ name, size = 22, className }: AppIconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className,
  }

  if (name === 'home') return <svg {...common}><path d="M3.5 10.8 12 3.7l8.5 7.1"/><path d="M5.5 9.7v10.1h13V9.7"/><path d="M9.5 19.8v-6h5v6"/></svg>
  if (name === 'market') return <svg {...common}><path d="M4 4v16h16"/><path d="m7 15 3-4 3 2 4-6"/><path d="M17 7h3v3"/></svg>
  if (name === 'portfolio') return <svg {...common}><path d="M12 3a9 9 0 1 0 9 9h-9Z"/><path d="M14.5 3.4A9 9 0 0 1 20.6 9H14.5Z"/></svg>
  if (name === 'news') return <svg {...common}><path d="M5 4.5h13.5v15H5z"/><path d="M8 8h7.5M8 11.5h7.5M8 15h4.5"/><path d="M18.5 7H21v10.5a2 2 0 0 1-2 2h-.5"/></svg>
  if (name === 'assets') return <svg {...common}><path d="M4 7.5h15.5a1.5 1.5 0 0 1 1.5 1.5v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z"/></svg>
  if (name === 'settings') return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4.2 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2.4v-4h.1A1.7 1.7 0 0 0 4.2 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.66 3.8l.06.06A1.7 1.7 0 0 0 8.6 4.2a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2.4h4v.1a1.7 1.7 0 0 0 1 1.7 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 8.6a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.1v4h-.1a1.7 1.7 0 0 0-1.7 1Z"/></svg>
  return <svg {...common}><path d="m9 6 6 6-6 6"/></svg>
}
