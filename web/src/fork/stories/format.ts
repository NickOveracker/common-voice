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
