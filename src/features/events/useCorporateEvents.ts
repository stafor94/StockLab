import { useEffect, useState } from 'react'
import { loadCorporateEventDataset } from '../../data/corporateEventDataClient'
import type { CorporateEventDataset } from '../../game/corporate/types'

export function useCorporateEvents() {
  const [dataset, setDataset] = useState<CorporateEventDataset | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    loadCorporateEventDataset()
      .then((value) => {
        if (!active) return
        setDataset(value)
        setStatus('ready')
      })
      .catch((reason: unknown) => {
        if (!active) return
        setError(reason instanceof Error ? reason.message : '기업 이벤트 데이터를 불러오지 못했습니다.')
        setStatus('error')
      })
    return () => { active = false }
  }, [])

  return { dataset, status, error }
}
