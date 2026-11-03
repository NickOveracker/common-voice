import * as express from 'express'
import PromiseRouter from 'express-promise-router'
import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { validateStrict } from '../../lib/validation'
import {
  CompleteRecordingRequest,
  CreateConsentRequest,
  CreateRecordingRequest,
  CreateSpeakerRequest,
  UpdateRecordingRequest,
  UpdateSpeakerRequest,
} from './schemas'
import {
  addConsent,
  createSpeaker,
  getSpeaker,
  listSpeakers,
  updateSpeaker,
  withdrawConsent,
} from './speakers'
import {
  CHUNK_MAX_BYTES,
  completeRecording,
  createRecording,
  getRecording,
  getRecordingAudio,
  listRecordings,
  updateRecording,
  uploadChunk,
} from './recordings'

// Speakers and recordings, mounted at /api/v1/community. Everything here
// needs a signed-in user with a profile, even when CV_REQUIRE_LOGIN is off.
const requireSignedIn = (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  const user = request.session?.user
  if (user?.email && user?.client_id) return next()
  // 403, not 401: see require-login.ts
  response.status(StatusCodes.FORBIDDEN).json({ message: 'sign in first' })
}

export default PromiseRouter({ mergeParams: true })
  .use(['/speakers', '/recordings'], requireSignedIn)
  .get('/speakers', listSpeakers)
  .post(
    '/speakers',
    validateStrict({ body: CreateSpeakerRequest }),
    createSpeaker
  )
  .get('/speakers/:speakerId(\\d+)', getSpeaker)
  .patch(
    '/speakers/:speakerId(\\d+)',
    validateStrict({ body: UpdateSpeakerRequest }),
    updateSpeaker
  )
  .post(
    '/speakers/:speakerId(\\d+)/consents',
    validateStrict({ body: CreateConsentRequest }),
    addConsent
  )
  .post(
    '/speakers/:speakerId(\\d+)/consents/:consentId(\\d+)/withdraw',
    withdrawConsent
  )
  .get('/recordings', listRecordings)
  .post(
    '/recordings',
    validateStrict({ body: CreateRecordingRequest }),
    createRecording
  )
  .get('/recordings/:recordingId(\\d+)', getRecording)
  .patch(
    '/recordings/:recordingId(\\d+)',
    validateStrict({ body: UpdateRecordingRequest }),
    updateRecording
  )
  .put(
    '/recordings/:recordingId(\\d+)/chunks/:chunkIndex(\\d+)',
    express.raw({ type: () => true, limit: CHUNK_MAX_BYTES }),
    uploadChunk
  )
  .post(
    '/recordings/:recordingId(\\d+)/complete',
    validateStrict({ body: CompleteRecordingRequest }),
    completeRecording
  )
  .get('/recordings/:recordingId(\\d+)/audio', getRecordingAudio)
