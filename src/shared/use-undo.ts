import { useCallback, useRef, useState } from "react"

const MAX_HISTORY = 50

export function useUndo<T>(initial: T) {
  const pastRef = useRef<T[]>([])
  const futureRef = useRef<T[]>([])

  const [current, setCurrent] = useState<T>(initial)

  const push = useCallback((next: T | ((prev: T) => T)) => {
    setCurrent((prev) => {
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next
      pastRef.current = [...pastRef.current.slice(-MAX_HISTORY), prev]
      futureRef.current = []
      return resolved
    })
  }, [])

  const undo = useCallback(() => {
    const prev = pastRef.current.pop()
    if (prev === undefined) return
    setCurrent((curr) => {
      futureRef.current.push(curr)
      return prev
    })
  }, [])

  const redo = useCallback(() => {
    const next = futureRef.current.pop()
    if (next === undefined) return
    setCurrent((curr) => {
      pastRef.current.push(curr)
      return next
    })
  }, [])

  return {
    value: current,
    setValue: push,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  }
}
