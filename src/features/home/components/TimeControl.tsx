import type { AutoplaySpeed } from '../useAutoplay'
import { autoplaySpeeds } from '../useHomeDashboardController'
import type { ProgressGuidanceResult } from '../progressGuidance'
import { ProgressGuidance } from './ProgressGuidance'

export interface TimeControlProps {
  guidance: ProgressGuidanceResult
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
  onAdvanceWeek: () => void
  onAdvanceMonth: () => void
}

export function TimeControl(props: TimeControlProps) {
  const secondaryDisabled = !props.timelineReady || props.running || props.sessionAdvanceBlocked || props.processingSession
  return (
    <section className="time-control-section" aria-labelledby="time-control-title">
      <header><div><p className="section-kicker">게임 진행</p><h2 id="time-control-title">시간 진행</h2></div>{props.running && <span className="running-status">자동진행 {props.speed}×</span>}</header>
      <ProgressGuidance guidance={props.guidance} actionDisabled={props.primaryDisabled} disabledReason={props.primaryDisabled ? '데이터를 불러오거나 현재 작업을 마칠 때까지 이 행동을 사용할 수 없습니다. 오류가 계속되면 다시 시도하세요.' : null} onAction={props.onPrimary} />
      <div className="time-secondary-actions" aria-label="빠른 날짜 진행">
        <button type="button" disabled={secondaryDisabled} onClick={props.onAdvanceWeek}>+1주</button>
        <button type="button" disabled={secondaryDisabled} onClick={props.onAdvanceMonth}>+1개월</button>
      </div>
      <div className="autoplay-control-row">
        <div><span className="control-caption">속도</span><div className="segmented-control compact" aria-label="자동진행 속도">{autoplaySpeeds.map((speed) => <button type="button" aria-pressed={props.speed === speed} className={props.speed === speed ? 'active' : ''} key={speed} onClick={() => props.onSpeedChange(speed)}>{speed}×</button>)}</div></div>
        <button className={`secondary-button autoplay-toggle ${props.running ? 'running' : ''}`} type="button" disabled={!props.timelineReady || props.processingSession} onClick={props.onToggleAutoplay}>{props.running ? '일시정지' : '자동진행'}</button>
      </div>
    </section>
  )
}
