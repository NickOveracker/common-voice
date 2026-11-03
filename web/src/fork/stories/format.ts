export function formatDuration(ms: number | null): string {
  if (ms === null) return ''
  const totalSeconds = Math.round(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`
}

// Chunks [0, n) that were uploaded without gaps
export function contiguousChunkCount(uploaded: number[]): number {
  const set = new Set(uploaded)
  let count = 0
  while (set.has(count)) count++
  return count
}

// Position in a recording, to a tenth of a second: 1:02.3
export function formatTime(ms: number): string {
  const tenths = Math.floor(ms / 100)
  const minutes = Math.floor(tenths / 600)
  const seconds = ((tenths % 600) / 10).toFixed(1).padStart(4, '0')
  return `${minutes}:${seconds}`
}
