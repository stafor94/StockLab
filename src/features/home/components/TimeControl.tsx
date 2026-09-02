import { HelpLink } from '../../help/HelpCenter'
import type { AutoplaySpeed } from '../useAutoplay'
import { autoplaySpeeds } from '../useHomeDashboardController'

export interface TimeControlProps {
  message: string
  primaryLabel: string
  primaryDisabled: boolean
  onPrimary: () => void
  timelineReady: boolean
  sessionAdvanceBlocked: boolean
  processingSession: boolean
  running: boolean
  speed: AutoplaySpeed
  onSpeedChange: (speed: AutoplaySpeed) => void
  onToggleAutoplay: () => void
}

export function TimeControl(props: TimeControlProps) {
  return (
    <section className="time-control-section" aria-labelledby="time-control-title">
      <header><div><p className="section-kicker">게임 진행</p><h2 id="time-control-title">시간 진행</h2></div>{props.running && <span className="running-status">자동진행 {props.speed}×</span>}</header>
      <p className="time-control-message" aria-live="polite">{props.message} <HelpLink section={props.sessionAdvanceBlocked ? 'day' : 'autoplay'} /></p>
      <button className="primary-button time-primary-action" type="button" disabled={props.primaryDisabled} onClick={props.onPrimary}>{props.primaryLabel}</button>
      <div className="autoplay-control-row">
        <div><span className="control-caption">속도</span><div className="segmented-control compact" aria-label="자동진행 속도">{autoplaySpeeds.map((speed) => <button type="button" aria-pressed={props.speed === speed} className={props.speed === speed ? 'active' : ''} key={speed} onClick={() => props.onSpeedChange(speed)}>{speed}×</button>)}</div></div>
        <button className={`secondary-button autoplay-toggle ${props.running ? 'running' : ''}`} type="button" disabled={!props.timelineReady || props.processingSession} onClick={props.onToggleAutoplay}>{props.running ? '일시정지' : '자동진행'}</button>
      </div>
    </section>
  )
}
