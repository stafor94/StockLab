import type { ProgressGuidanceResult } from '../progressGuidance'

interface ProgressGuidanceProps {
  guidance: ProgressGuidanceResult
  onAction: () => void
  actionDisabled?: boolean
  disabledReason?: string | null
}

export function ProgressGuidance({ guidance, onAction, actionDisabled = false, disabledReason }: ProgressGuidanceProps) {
  const isInterrupt = guidance.severity === 'critical'
  return (
    <div
      className={`progress-guidance ${guidance.severity}`}
      role={isInterrupt ? 'alert' : 'status'}
      aria-live={isInterrupt ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div className="progress-guidance-copy">
        <span>{guidance.title}</span>
        <p>{guidance.description}</p>
      </div>
      <button className="primary-button" type="button" disabled={actionDisabled} onClick={onAction}>
        {guidance.actionLabel}
      </button>
      {actionDisabled && disabledReason && <p className="progress-guidance-disabled">{disabledReason}</p>}
    </div>
  )
}
