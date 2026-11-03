import { spawn } from 'child_process'

// Finds a first division of a recording into segments, cutting in the middle
// of pauses. It only has to be a reasonable start: people adjust the
// segments by hand while transcribing.

export type Pause = { startMs: number; endMs: number }
export type PlannedSegment = { start_ms: number; end_ms: number }

export const SEGMENTATION = {
  // Pauses at least this long are candidates for a cut
  minPauseMs: 500,
  // Cut at the first pause after this much speech...
  minSegmentMs: 3000,
  // ...but if there is none before this, cut at the longest pause...
  maxSegmentMs: 20000,
  // ...and if there is none before this either, cut here regardless
  hardMaxSegmentMs: 30000,
}

export function planSegments(
  durationMs: number,
  pauses: Pause[],
  settings = SEGMENTATION
): PlannedSegment[] {
  if (durationMs <= 0) return []

  const cuts = pauses
    .filter(pause => pause.startMs > 0 && pause.endMs < durationMs)
    .map(pause => ({
      at: Math.round((pause.startMs + pause.endMs) / 2),
      length: pause.endMs - pause.startMs,
    }))
    .sort((a, b) => a.at - b.at)

  const segments: PlannedSegment[] = []
  let start = 0
  while (durationMs - start > settings.hardMaxSegmentMs) {
    // Never leave a last segment shorter than minSegmentMs
    const latest = durationMs - settings.minSegmentMs
    const inRange = (from: number, to: number) =>
      cuts.filter(
        cut => cut.at >= start + from && cut.at <= Math.min(start + to, latest)
      )

    const first = inRange(settings.minSegmentMs, settings.maxSegmentMs)[0]
    const longest = inRange(
      settings.minSegmentMs,
      settings.hardMaxSegmentMs
    ).reduce<typeof cuts[number] | undefined>(
      (best, cut) => (!best || cut.length > best.length ? cut : best),
      undefined
    )
    const end =
      first?.at ??
      longest?.at ??
      Math.min(start + settings.hardMaxSegmentMs, latest)

    segments.push({ start_ms: start, end_ms: end })
    start = end
  }

  // The rest is short enough for one segment, but may still have pauses
  for (const cut of cuts) {
    if (
      cut.at >= start + settings.minSegmentMs &&
      durationMs - cut.at >= settings.minSegmentMs
    ) {
      segments.push({ start_ms: start, end_ms: cut.at })
      start = cut.at
    }
  }
  segments.push({ start_ms: start, end_ms: durationMs })
  return segments
}

function ffmpegStderr(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-nostats', ...args])
    let stderr = ''
    child.stderr.on('data', data => (stderr += data))
    child.on('error', reject)
    child.on('close', code =>
      code === 0
        ? resolve(stderr)
        : reject(
            new Error(`ffmpeg exited with ${code}: ${stderr.slice(-2000)}`)
          )
    )
  })
}

// Pauses are quieter than the recording's average loudness by some margin,
// rather than below a fixed level: archived tapes can have a lot of hiss.
export async function detectPauses(file: string): Promise<Pause[]> {
  const volume = await ffmpegStderr([
    '-i',
    file,
    '-af',
    'volumedetect',
    '-f',
    'null',
    '-',
  ])
  const mean = parseFloat(/mean_volume: (-?[\d.]+) dB/.exec(volume)?.[1])
  const threshold = Number.isFinite(mean)
    ? Math.min(-20, Math.max(-60, mean - 12))
    : -35

  const output = await ffmpegStderr([
    '-i',
    file,
    '-af',
    `silencedetect=noise=${threshold}dB:d=${SEGMENTATION.minPauseMs / 1000}`,
    '-f',
    'null',
    '-',
  ])

  const pauses: Pause[] = []
  let startMs: number | null = null
  for (const line of output.split('\n')) {
    const start = /silence_start: (-?[\d.]+)/.exec(line)
    const end = /silence_end: (-?[\d.]+)/.exec(line)
    if (start) startMs = Math.max(0, Math.round(parseFloat(start[1]) * 1000))
    if (end && startMs !== null) {
      pauses.push({ startMs, endMs: Math.round(parseFloat(end[1]) * 1000) })
      startMs = null
    }
  }
  return pauses
}
