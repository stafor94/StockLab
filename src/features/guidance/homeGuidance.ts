export type HomeGuidanceState =
  | 'loading'
  | 'preopen-empty'
  | 'preopen-ordered'
  | 'opened'
  | 'closed'
  | 'attention-required'
  | 'autoplay'
  | 'blocked'

export type HomeGuidanceAction = 'open-market' | 'run-primary' | 'none'

export interface HomeGuidanceInput {
  gameDate: string
  sessionPhase: 'preopen' | 'opened' | 'closed'
  isTradingDate: boolean
  pendingOrderCount: number
  hasPendingAttention: boolean
  autoplayRunning: boolean
  ready: boolean
  hasError: boolean
  processing: boolean
}

export interface HomeGuidanceModel {
  state: HomeGuidanceState
  currentStage: string
  recommendation: string
  primaryLabel: '시장 둘러보기' | '주문 확인' | '장 시작' | '장 마감' | '다음 날로'
  action: HomeGuidanceAction
  disabled: boolean
}

const phaseLabels = { preopen: '개장 전', opened: '장중', closed: '장 마감' } as const

/** 현재 저장 상태만을 사용자에게 안전하게 공개할 다음 행동으로 변환한다. */
export function createHomeGuidance(input: HomeGuidanceInput): HomeGuidanceModel {
  const currentStage = `${input.gameDate} · ${input.isTradingDate ? phaseLabels[input.sessionPhase] : '휴장'}`
  const base = (model: Omit<HomeGuidanceModel, 'currentStage'>): HomeGuidanceModel => ({ currentStage, ...model })

  if (input.hasError) return base({ state: 'blocked', recommendation: '필수 게임 데이터를 확인할 수 없어 진행할 수 없습니다. 데이터 상태를 확인해 주세요.', primaryLabel: '다음 날로', action: 'none', disabled: true })
  if (!input.ready) return base({ state: 'loading', recommendation: '시장 일정과 게임 데이터를 불러오는 중입니다.', primaryLabel: '장 시작', action: 'none', disabled: true })
  if (input.hasPendingAttention) return base({ state: 'attention-required', recommendation: '화면에 표시된 중요 뉴스 또는 기업 이벤트를 먼저 확인해 주세요.', primaryLabel: '다음 날로', action: 'none', disabled: true })
  if (input.autoplayRunning) return base({ state: 'autoplay', recommendation: '자동진행 중입니다. 중요 정보나 진행할 수 없는 상태에서는 자동으로 멈춥니다.', primaryLabel: input.sessionPhase === 'opened' ? '장 마감' : input.sessionPhase === 'closed' || !input.isTradingDate ? '다음 날로' : '장 시작', action: 'none', disabled: true })
  if (!input.isTradingDate || input.sessionPhase === 'closed') return base({ state: 'closed', recommendation: input.isTradingDate ? '오늘 공개된 정보를 확인한 뒤 다음 날로 진행하세요.' : '오늘은 휴장입니다. 다음 게임 날짜로 진행하세요.', primaryLabel: '다음 날로', action: 'run-primary', disabled: input.processing })
  if (input.sessionPhase === 'opened') return base({ state: 'opened', recommendation: '현재 공개된 시가와 주문 결과를 확인한 뒤 장을 마감하세요.', primaryLabel: '장 마감', action: 'run-primary', disabled: input.processing })
  if (input.pendingOrderCount > 0) return base({ state: 'preopen-ordered', recommendation: `오늘 접수된 주문 ${input.pendingOrderCount}건을 확인하거나 장을 시작하세요.`, primaryLabel: '주문 확인', action: 'open-market', disabled: input.processing })
  return base({ state: 'preopen-empty', recommendation: '시장에서 종목을 살펴보고 주문하거나 바로 장을 시작하세요.', primaryLabel: '시장 둘러보기', action: 'open-market', disabled: input.processing })
}
