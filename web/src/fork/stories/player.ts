import * as React from 'react'

// Playback for transcribing: play one segment (stopping at its end, or
// looping it), skip back and forward, and slow down.

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5]
export const SKIP_MS = 5000

export type Bounds = { start_ms: number; end_ms: number }

export function usePlayer() {
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [timeMs, setTimeMs] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)
  const [rate, setRateState] = React.useState(1)
  const [loop, setLoop] = React.useState(false)
  // The segment being played, if any: playback stops (or loops) at its end
  const [bounds, setBounds] = React.useState<Bounds | null>(null)

  const state = React.useRef({ bounds, loop })
  state.current = { bounds, loop }

  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    let frame = 0
    const tick = () => {
      const { bounds, loop } = state.current
      const now = audio.currentTime * 1000
      if (bounds && !audio.paused && now >= bounds.end_ms) {
        if (loop) {
          audio.currentTime = bounds.start_ms / 1000
        } else {
          audio.pause()
          audio.currentTime = bounds.end_ms / 1000
        }
      }
      setTimeMs(audio.currentTime * 1000)
      if (!audio.paused) frame = requestAnimationFrame(tick)
    }
    const onPlay = () => {
      setPlaying(true)
      frame = requestAnimationFrame(tick)
    }
    const onPause = () => {
      setPlaying(false)
      cancelAnimationFrame(frame)
      setTimeMs(audio.currentTime * 1000)
    }
    const onSeeked = () => setTimeMs(audio.currentTime * 1000)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('seeked', onSeeked)
    return () => {
      cancelAnimationFrame(frame)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('seeked', onSeeked)
    }
  }, [])

  const play = () => audioRef.current?.play().catch((): null => null)

  // Plays a segment from its start, or pauses it if it is playing
  const playSegment = (segment: Bounds) => {
    const audio = audioRef.current
    if (!audio) return
    const same =
      bounds?.start_ms === segment.start_ms && bounds?.end_ms === segment.end_ms
    if (same && !audio.paused) {
      audio.pause()
      return
    }
    setBounds(segment)
    state.current = { ...state.current, bounds: segment }
    const now = audio.currentTime * 1000
    // Resume within the segment; otherwise start it over
    if (!same || now < segment.start_ms || now >= segment.end_ms - 50) {
      audio.currentTime = segment.start_ms / 1000
    }
    play()
  }

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.paused) return audio.pause()
    // Stopped at the end of a segment: play on past it
    const { bounds } = state.current
    if (bounds && audio.currentTime * 1000 >= bounds.end_ms - 50) {
      setBounds(null)
      state.current = { ...state.current, bounds: null }
    }
    play()
  }

  const seek = (ms: number) => {
    const audio = audioRef.current
    if (!audio) return
    const target = Math.max(0, ms)
    // Leaving the segment being played: play on freely from there
    const { bounds } = state.current
    if (bounds && (target < bounds.start_ms || target >= bounds.end_ms)) {
      setBounds(null)
      state.current = { ...state.current, bounds: null }
    }
    audio.currentTime = target / 1000
  }

  const skip = (deltaMs: number) => {
    const audio = audioRef.current
    if (audio) seek(audio.currentTime * 1000 + deltaMs)
  }

  const setRate = (value: number) => {
    setRateState(value)
    if (audioRef.current) audioRef.current.playbackRate = value
  }

  return {
    audioRef,
    timeMs,
    playing,
    rate,
    setRate,
    loop,
    setLoop,
    bounds,
    // Plays freely, without stopping at a segment's end
    clearBounds: () => setBounds(null),
    playSegment,
    toggle,
    skip,
    seek,
  }
}

export type Player = ReturnType<typeof usePlayer>
