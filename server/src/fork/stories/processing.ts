import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { spawn } from 'child_process'
import * as Queue from 'bull'
import { getMySQLInstance } from '../../lib/model/db/mysql'
import { getQueue } from '../../infrastructure/queues/queues'
import {
  chunkPath,
  deleteObject,
  getObject,
  originalPath,
  playbackPath,
  putStream,
} from './storage'

// Joins the uploaded chunks of a recording, keeps the joined file as the
// original, and makes an MP3 copy for playback. Recordings can be hours long,
// so this works on temporary files rather than in memory.

const QUEUE_NAME = 'fork-recording-processing'
const JOB_NAME = 'process-recording'

const db = getMySQLInstance()

type ProcessRecordingJob = { recordingId: number }

let queue: Queue.Queue<ProcessRecordingJob> | null = null

export function setupRecordingProcessingQueue() {
  queue = getQueue<ProcessRecordingJob>(QUEUE_NAME)()
  // One at a time: transcoding long recordings is CPU heavy
  queue.process(JOB_NAME, 1, job => processRecording(job.data.recordingId))
  queue.on('failed', (job, error) =>
    console.error(
      `[recordings] processing ${job.data.recordingId} failed`,
      error
    )
  )
}

export async function queueRecordingProcessing(recordingId: number) {
  if (!queue) throw new Error('recording processing queue is not set up')
  await queue.add(
    JOB_NAME,
    { recordingId },
    { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } }
  )
}

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args)
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', data => (stdout += data))
    child.stderr.on('data', data => (stderr += data))
    child.on('error', reject)
    child.on('close', code =>
      code === 0
        ? resolve(stdout)
        : reject(
            new Error(`${command} exited with ${code}: ${stderr.slice(-2000)}`)
          )
    )
  })
}

export async function transcodeForPlayback(input: string, output: string) {
  await run('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-i',
    input,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '44100',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '64k',
    output,
  ])
}

export async function durationMs(file: string): Promise<number> {
  const output = await run('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    file,
  ])
  return Math.round(parseFloat(output.trim()) * 1000)
}

export async function processRecording(recordingId: number) {
  const [[recording]] = await db.query(
    `SELECT id, status FROM fork_recordings WHERE id = ?`,
    [recordingId]
  )
  // 'failed' too, so the queue's retries can run after a failed attempt
  if (!recording || !['processing', 'failed'].includes(recording.status)) {
    return
  }

  const [chunks] = await db.query(
    `SELECT chunk_index FROM fork_recording_chunks WHERE recording_id = ? ORDER BY chunk_index`,
    [recordingId]
  )

  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'recording-'))
  const original = path.join(dir, 'original')
  const playback = path.join(dir, 'playback.mp3')

  try {
    const out = fs.createWriteStream(original)
    for (const { chunk_index } of chunks) {
      const data = await getObject(chunkPath(recordingId, chunk_index))
      if (!out.write(data)) {
        await new Promise(resolve => out.once('drain', resolve))
      }
    }
    await new Promise<void>((resolve, reject) =>
      out.end((error?: Error) => (error ? reject(error) : resolve()))
    )

    await transcodeForPlayback(original, playback)
    const duration = await durationMs(playback)

    await putStream(originalPath(recordingId), fs.createReadStream(original))
    await putStream(playbackPath(recordingId), fs.createReadStream(playback))

    await db.query(
      `
      UPDATE fork_recordings
      SET status = 'ready', original_path = ?, playback_path = ?, duration_ms = ?, error = NULL
      WHERE id = ?
      `,
      [
        originalPath(recordingId),
        playbackPath(recordingId),
        duration,
        recordingId,
      ]
    )

    // The joined original replaces the chunks
    for (const { chunk_index } of chunks) {
      await deleteObject(chunkPath(recordingId, chunk_index)).catch(() => null)
    }
    await db.query(`DELETE FROM fork_recording_chunks WHERE recording_id = ?`, [
      recordingId,
    ])
  } catch (error) {
    await db.query(
      `UPDATE fork_recordings SET status = 'failed', error = ? WHERE id = ?`,
      [String(error?.message ?? error).slice(0, 5000), recordingId]
    )
    throw error
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true })
  }
}
