import { useCallback, useEffect, useRef, useState } from 'react'

export type AutoplaySpeed = 1 | 2 | 5 | 10

const TICK_DELAY_MS: Record<AutoplaySpeed, number> = {
  1: 1000,
  2: 500,
  5: 200,
  10: 100,
}

type AutoplayTick = () => boolean | Promise<boolean>

export function useAutoplay(onTick: AutoplayTick, blocked: boolean) {
  const [running, setRunning] = useState(false)
  const [speed, setSpeedState] = useState<AutoplaySpeed>(1)
  const tickRef = useRef(onTick)
  const inFlightRef = useRef(false)
  tickRef.current = onTick

  const stop = useCallback(() => setRunning(false), [])
  const start = useCallback(() => {
    if (!blocked) setRunning(true)
  }, [blocked])
  const toggle = useCallback(() => setRunning((current) => blocked ? false : !current), [blocked])
  const setSpeed = useCallback((next: AutoplaySpeed) => setSpeedState(next), [])

  useEffect(() => {
    if (blocked && !inFlightRef.current) setRunning(false)
  }, [blocked])

  useEffect(() => {
    if (!running || blocked) return undefined
    let cancelled = false
    let timer: number | null = null

    const schedule = () => {
      timer = window.setTimeout(() => {
        inFlightRef.current = true
        void Promise.resolve(tickRef.current()).then((keepRunning) => {
          inFlightRef.current = false
          if (cancelled) return
          if (!keepRunning) {
            setRunning(false)
            return
          }
          schedule()
        }, () => {
          inFlightRef.current = false
          if (!cancelled) setRunning(false)
        })
      }, TICK_DELAY_MS[speed])
    }

    schedule()
    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [blocked, running, speed])

  return { running, speed, setSpeed, start, stop, toggle }
}
