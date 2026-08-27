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
    description: '과거 시점에 공개된 정보만 보고 자산을 운용합니다. 튜토리얼을 건너뛰어도 바로 게임을 진행할 수 있어요.',
  },
  {
    id: 'market',
    eyebrow: '시장 살펴보기',
    title: '시장마다 자기 시간대로 움직여요',
    description: '국내장과 미국장은 서로 다른 거래일·거래시간과 휴장일을 따릅니다. 시장 화면은 각 시장에서 현재까지 확정된 가격만 보여줍니다.',
    targetId: 'navigation-market',
  },
  {
    id: 'order',
    eyebrow: '주문하기',
    title: '지금 열린 시장에서만 거래하세요',
    description: '국내장 또는 미국장이 열리면 그 시장의 실제 시가로 매수·매도할 수 있습니다. 다른 시장과 이미 마감한 시장은 거래할 수 없고 미래의 고가·저가·종가는 마감 전에는 보이지 않습니다.',
  },
  {
    id: 'day',
    eyebrow: '시간 진행',
    title: '다음 실제 시장 이벤트로 진행해요',
    description: '게임 진행 버튼은 국내장 시작·마감과 미국장 시작·마감을 실제 시간순으로 선택합니다. 휴장일과 주말은 건너뛰며 +1주·+1개월은 중간 이벤트를 내부적으로 모두 처리합니다.',
    targetId: 'game-progress-trigger',
  },
  {
    id: 'risk',
    eyebrow: '멈춤과 위험',
    title: '중요한 순간에는 자동으로 멈춰요',
    description: '대출이자 납부 실패와 중요 뉴스·기업 이벤트는 자동진행을 멈춥니다. 중단 사유를 확인한 뒤 다시 판단하세요.',
  },
]
