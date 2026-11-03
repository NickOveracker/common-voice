import { completeRecording, getRecording, uploadChunk } from './api'

// Matches CHUNK_MAX_BYTES on the server (8 MiB) with room to spare.
export const CHUNK_BYTES = 4 * 1024 * 1024

const RETRY_DELAYS_MS = [1000, 3000, 10000, 30000]

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Uploads one chunk, retrying network failures and server errors.
export async function uploadChunkWithRetry(
  recordingId: number,
  index: number,
  data: Blob
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await uploadChunk(recordingId, index, data)
    } catch (error) {
      const status = (error as { status?: number }).status
      const retryable = status === undefined || status >= 500
      if (!retryable || attempt >= RETRY_DELAYS_MS.length) throw error
      await sleep(RETRY_DELAYS_MS[attempt])
    }
  }
}

// Uploads a file in chunks, skipping chunks the server already has (so an
// interrupted upload can be resumed), then marks the recording complete.
export async function uploadFile(
  recordingId: number,
  file: Blob,
  onProgress: (fraction: number) => void
): Promise<void> {
  const chunkCount = Math.max(1, Math.ceil(file.size / CHUNK_BYTES))
  const { uploaded_chunks = [] } = await getRecording(recordingId)
  const done = new Set(uploaded_chunks)

  onProgress(done.size / chunkCount)
  for (let index = 0; index < chunkCount; index++) {
    if (done.has(index)) continue
    const chunk = file.slice(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES)
    await uploadChunkWithRetry(recordingId, index, chunk)
    done.add(index)
    onProgress(done.size / chunkCount)
  }

  await completeRecording(recordingId, chunkCount)
}
