export interface TutorialStep {
  id: 'goal' | 'market' | 'order' | 'day' | 'risk'
  eyebrow: string
  title: string
  description: string
  targetId?: string
}

export const tutorialSteps: readonly TutorialStep[] = [
  {
    id: 'goal',
    eyebrow: 'StockLab의 목표',
    title: '미래를 모른 채 투자해 보세요',
    description: '과거 시점에 공개된 정보만 보고 자산을 운용합니다. 튜토리얼을 건너뛰어도 바로 거래할 수 있어요.',
  },
  {
    id: 'market',
    eyebrow: '시장 살펴보기',
    title: '그날까지 알려진 정보만 확인해요',
    description: '시장 화면에서 종목의 과거 차트와 현재 게임 날짜까지 공개된 정보를 확인할 수 있습니다.',
    targetId: 'navigation-market',
  },
  {
    id: 'order',
    eyebrow: '주문하기',
    title: '개장 전에 주문을 준비하세요',
    description: '개장 전에 낸 주문은 그날의 실제 시가에 단 한 번 체결됩니다. 미래의 고가·저가·종가는 미리 보이지 않습니다.',
  },
  {
    id: 'day',
    eyebrow: '하루 진행',
    title: '한 거래일을 순서대로 진행해요',
    description: '개장 전 → 장중 → 장 마감 → 다음 게임일 순서입니다. 진행 버튼에서 각 단계를 직접 넘기거나 자동진행할 수 있습니다.',
    targetId: 'game-progress-trigger',
  },
  {
    id: 'risk',
    eyebrow: '멈춤과 위험',
    title: '중요한 순간에는 자동으로 멈춰요',
    description: '대출이자 납부 실패와 중요 뉴스·기업 이벤트는 자동진행을 멈춥니다. 중단 사유를 확인한 뒤 다시 판단하세요.',
  },
]
