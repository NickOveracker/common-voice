import { completeRecording } from './api'
import { uploadChunkWithRetry } from './chunked-upload'

// Records from the microphone and uploads as it goes, so a long recording is
// not lost if the browser or connection fails part way: at most the last
// FLUSH_INTERVAL_MS of audio is at risk.

const FLUSH_INTERVAL_MS = 30_000
const TIMESLICE_MS = 1000

const MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/webm',
]

export function supportedMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  return MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type)) ?? ''
}

export type RecorderState = 'idle' | 'recording' | 'paused' | 'finishing'

type Listener = (status: {
  state: RecorderState
  elapsedMs: number
  uploadedChunks: number
  pendingUploads: number
  error: Error | null
}) => void

// Minimal typing for the Screen Wake Lock API, not in this TypeScript lib
type WakeLockSentinel = { release: () => Promise<void> }
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> }
}

export class ChunkedRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private buffer: Blob[] = []
  private flushTimer: number | null = null
  private nextIndex = 0
  private uploads: Promise<void> = Promise.resolve()
  private pendingUploads = 0
  private uploadedChunks = 0
  private state: RecorderState = 'idle'
  private error: Error | null = null
  private elapsedBeforePause = 0
  private resumedAt = 0
  private wakeLock: WakeLockSentinel | null = null

  constructor(
    private readonly recordingId: number,
    private readonly listener: Listener
  ) {}

  get mimeType() {
    return this.mediaRecorder?.mimeType ?? null
  }

  elapsedMs() {
    return (
      this.elapsedBeforePause +
      (this.state === 'recording' ? Date.now() - this.resumedAt : 0)
    )
  }

  private notify() {
    this.listener({
      state: this.state,
      elapsedMs: this.elapsedMs(),
      uploadedChunks: this.uploadedChunks,
      pendingUploads: this.pendingUploads,
      error: this.error,
    })
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // Keep the voice as it is: no processing meant for calls
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })
    const mimeType = supportedMimeType()
    this.mediaRecorder = new MediaRecorder(
      this.stream,
      mimeType ? { mimeType } : undefined
    )
    this.mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) this.buffer.push(event.data)
    }
    this.mediaRecorder.start(TIMESLICE_MS)
    this.flushTimer = window.setInterval(() => this.flush(), FLUSH_INTERVAL_MS)
    this.state = 'recording'
    this.resumedAt = Date.now()
    await this.keepScreenOn()
    this.notify()
  }

  pause() {
    if (this.state !== 'recording') return
    this.mediaRecorder.pause()
    this.elapsedBeforePause += Date.now() - this.resumedAt
    this.state = 'paused'
    this.notify()
  }

  resume() {
    if (this.state !== 'paused') return
    this.mediaRecorder.resume()
    this.resumedAt = Date.now()
    this.state = 'recording'
    this.notify()
  }

  // Stops recording, uploads what is left and marks the recording complete.
  async finish() {
    if (this.state === 'idle' || this.state === 'finishing') return
    this.elapsedBeforePause = this.elapsedMs()
    this.state = 'finishing'
    this.notify()

    await new Promise<void>(resolve => {
      this.mediaRecorder.onstop = () => resolve()
      this.mediaRecorder.stop()
    })
    this.cleanUp()
    this.flush()
    await this.uploads
    if (this.error) throw this.error
    await completeRecording(this.recordingId, this.nextIndex)
  }

  // Stops without completing, e.g. when leaving the page.
  abandon() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }
    this.cleanUp()
  }

  private flush() {
    if (this.buffer.length === 0) return
    const data = new Blob(this.buffer, { type: this.mimeType ?? undefined })
    this.buffer = []
    const index = this.nextIndex++
    this.pendingUploads++
    this.notify()
    this.uploads = this.uploads
      .then(() => uploadChunkWithRetry(this.recordingId, index, data))
      .then(() => {
        this.uploadedChunks++
      })
      .catch(error => {
        this.error = error
      })
      .finally(() => {
        this.pendingUploads--
        this.notify()
      })
  }

  private async keepScreenOn() {
    try {
      this.wakeLock =
        (await (navigator as NavigatorWithWakeLock).wakeLock?.request(
          'screen'
        )) ?? null
    } catch (e) {
      // Not supported or not allowed; recording works anyway
    }
  }

  private cleanUp() {
    if (this.flushTimer !== null) window.clearInterval(this.flushTimer)
    this.flushTimer = null
    this.stream?.getTracks().forEach(track => track.stop())
    this.wakeLock?.release().catch((): null => null)
    this.wakeLock = null
  }
}
