import { Request, Response } from 'express'
import { Storage } from '@google-cloud/storage'
import { taskEither as TE } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import { Readable } from 'stream'
import { getConfig } from '../../config-helper'
import { getForkConfig } from '../config'
import {
  deleteFileFromBucket,
  downloadFileFromBucket,
  getSignedUrlFromBucket,
  streamUploadToBucket,
  uploadToBucket,
} from '../../infrastructure/storage/storage'

// Recordings share the clips bucket, under their own prefix.
const PREFIX = 'fork-recordings'

const bucket = () => getConfig().CLIP_BUCKET_NAME

const run = async <A>(task: TE.TaskEither<Error, A>): Promise<A> =>
  pipe(await task(), result => {
    if (result._tag === 'Left') throw result.left
    return result.right
  })

export const chunkPath = (recordingId: number, index: number) =>
  `${PREFIX}/${recordingId}/chunks/${String(index).padStart(6, '0')}`

export const originalPath = (recordingId: number) =>
  `${PREFIX}/${recordingId}/original`

export const playbackPath = (recordingId: number) =>
  `${PREFIX}/${recordingId}/playback.mp3`

export const exportPath = (exportId: number) => `fork-exports/${exportId}.zip`

export const putObject = (path: string, data: Buffer) =>
  run(uploadToBucket(bucket())(path)(data))

export const putStream = (path: string, data: Readable) =>
  run(streamUploadToBucket(bucket())(path)(data))

export const getObject = (path: string) =>
  run(downloadFileFromBucket(bucket())(path))

export const deleteObject = (path: string) =>
  run(deleteFileFromBucket(bucket())(path))

// URL the browser can fetch the file from. Same approach as
// Bucket.getPublicUrl(): fake-gcs in local development can't sign URLs, and
// its address inside docker isn't reachable from the browser.
export async function getAudioUrl(path: string): Promise<string> {
  if (getConfig().ENVIRONMENT === 'local') {
    const origin = getForkConfig().STORAGE_ORIGIN || 'http://localhost:8080'
    return `${origin}/storage/v1/b/${bucket()}/o/${encodeURIComponent(
      path
    )}?alt=media`
  }
  return run(getSignedUrlFromBucket(bucket())(path))
}

let client: Storage | null = null

// Same client settings as infrastructure/storage/storage.ts
function storageClient(): Storage {
  if (!client) {
    const endpoint =
      getForkConfig().STORAGE_ENDPOINT ||
      (getConfig().ENVIRONMENT === 'local'
        ? getConfig().STORAGE_LOCAL_DEVELOPMENT_ENDPOINT
        : '')
    client = endpoint
      ? new Storage({
          apiEndpoint: endpoint,
          projectId: 'local',
          useAuthWithCustomEndpoint: false,
        })
      : new Storage()
  }
  return client
}

// Whether files are streamed through the app (storage on the server's own
// disk) rather than linked to (Google Cloud Storage)
export const streamsThroughApp = () => Boolean(getForkConfig().STORAGE_ENDPOINT)

// Downloads straight to a file: originals can be gigabytes, too big for the
// in-memory download the upstream storage helpers do.
export async function downloadToFile(path: string, destination: string) {
  await storageClient().bucket(bucket()).file(path).download({ destination })
}

// Sends a stored file to the browser, honouring Range requests so that long
// recordings can be seeked without downloading them whole. Permission checks
// are the caller's.
export async function streamObject(
  path: string,
  request: Request,
  response: Response,
  options: { contentType: string; downloadName?: string }
) {
  const file = storageClient().bucket(bucket()).file(path)
  const [metadata] = await file.getMetadata()
  const size = Number(metadata.size)

  response.set({
    'Accept-Ranges': 'bytes',
    'Content-Type': options.contentType,
    'Cache-Control': 'private, max-age=3600',
    ...(options.downloadName
      ? {
          'Content-Disposition': `attachment; filename="${options.downloadName}"`,
        }
      : {}),
  })

  let start = 0
  let end = size - 1
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? '')
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1])
      end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
    } else {
      // The last n bytes
      start = Math.max(0, size - Number(range[2]))
    }
    if (start > end || start >= size) {
      response.set('Content-Range', `bytes */${size}`)
      return response.sendStatus(416)
    }
    response.status(206).set('Content-Range', `bytes ${start}-${end}/${size}`)
  }
  response.set('Content-Length', String(size === 0 ? 0 : end - start + 1))
  if (request.method === 'HEAD' || size === 0) return response.end()

  await new Promise<void>((resolve, reject) => {
    file
      .createReadStream({ start, end })
      .on('error', error => {
        // Headers are already sent; all that can be done is to stop
        response.destroy(error)
        reject(error)
      })
      .on('end', resolve)
      .pipe(response)
  })
}
