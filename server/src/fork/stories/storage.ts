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
