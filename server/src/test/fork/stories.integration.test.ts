// End-to-end test of speakers, consent and recordings against a real MySQL
// database, Redis, fake-gcs-server and ffmpeg. Skipped unless
// CV_FORK_INTEGRATION=true; see FORK.md for how to run it.
import * as express from 'express'
import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { AddressInfo } from 'net'
import { Server } from 'http'
import { Storage } from '@google-cloud/storage'
import { ValidationError } from 'express-json-validator-middleware'
import { getConfig } from '../../config-helper'
import { getMySQLInstance } from '../../lib/model/db/mysql'
import forkRouter from '../../fork/routes'
import { setupRecordingProcessingQueue } from '../../fork/stories/processing'
import { importStaticLocales } from '../../fork/locales'

const describeIntegration =
  process.env.CV_FORK_INTEGRATION === 'true' ? describe : describe.skip

const FACILITATOR = {
  client_id: '11111111-1111-4111-8111-111111111111',
  email: 'facilitator@example.org',
}
const MEMBER = {
  client_id: '22222222-2222-4222-8222-222222222222',
  email: 'member@example.org',
}

describeIntegration('stories API', () => {
  let server: Server
  let baseUrl: string

  // Requests act as the user whose client_id is in the x-test-user header
  const api = async (
    user: typeof FACILITATOR,
    method: string,
    url: string,
    body?: unknown,
    raw?: Buffer
  ) => {
    const response = await fetch(`${baseUrl}/community${url}`, {
      method,
      redirect: 'manual',
      headers: {
        'x-test-user': user.client_id,
        'content-type': raw ? 'application/octet-stream' : 'application/json',
      },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    })
    const text = await response.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch (e) {
      // not JSON
    }
    return { status: response.status, json, headers: response.headers }
  }

  beforeAll(async () => {
    // db-migrate only finds compiled migrations, so this needs `yarn build`
    // first and uses the compiled schema code.
    /* eslint-disable @typescript-eslint/no-var-requires */
    const Mysql = require('../../../js/lib/model/db/mysql').default
    const Schema = require('../../../js/lib/model/db/schema').default
    /* eslint-enable @typescript-eslint/no-var-requires */
    const schema = new Schema(new Mysql())
    await schema.ensure()
    await schema.upgrade()

    const db = getMySQLInstance()
    for (const user of [FACILITATOR, MEMBER]) {
      await db.query(
        `INSERT IGNORE INTO user_clients (client_id, email, username) VALUES (?, ?, ?)`,
        [user.client_id, user.email, user.email]
      )
    }

    const { STORAGE_LOCAL_DEVELOPMENT_ENDPOINT, CLIP_BUCKET_NAME } = getConfig()
    await new Storage({
      apiEndpoint: STORAGE_LOCAL_DEVELOPMENT_ENDPOINT,
      projectId: 'local',
      useAuthWithCustomEndpoint: false,
    })
      .createBucket(CLIP_BUCKET_NAME)
      .catch((): null => null)

    setupRecordingProcessingQueue()

    const users = [FACILITATOR, MEMBER]
    const app = express()
    app.use(express.json())
    app.use((request, _response, next) => {
      const user = users.find(
        u => u.client_id === request.header('x-test-user')
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(request as any).session = { user }
      next()
    })
    app.use('/community', forkRouter)
    app.use(
      (
        error: Error,
        _request: express.Request,
        response: express.Response,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _next: express.NextFunction
      ) => {
        if (error instanceof ValidationError) {
          return response.status(400).json({ message: 'invalid request' })
        }
        console.error(error)
        response.status(500).json({ message: String(error) })
      }
    )
    server = app.listen(0)
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`
  }, 120_000)

  afterAll(() => {
    server?.close()
  })

  let speakerId: number

  it('creates a speaker whose real name only the facilitator sees', async () => {
    const created = await api(FACILITATOR, 'POST', '/speakers', {
      display_name: 'Elder A',
      full_name: 'Real Name',
      birth_year: 1938,
      region: 'Saru',
    })
    expect(created.status).toBe(201)
    speakerId = created.json.id

    const own = await api(FACILITATOR, 'GET', `/speakers/${speakerId}`)
    expect(own.json.full_name).toBe('Real Name')

    const other = await api(MEMBER, 'GET', `/speakers/${speakerId}`)
    expect(other.json.display_name).toBe('Elder A')
    expect(other.json.full_name).toBeNull()
    expect(other.json.can_manage).toBe(false)
  })

  it('requires consent to archive before recording', async () => {
    const recording = {
      title: 'A story',
      languages: ['ain', 'ja'],
      speaker_ids: [speakerId],
      source: 'upload',
    }
    const refused = await api(FACILITATOR, 'POST', '/recordings', recording)
    expect(refused.status).toBe(400)
    expect(refused.json.message).toMatch(/consent/)

    const consent = await api(
      FACILITATOR,
      'POST',
      `/speakers/${speakerId}/consents`,
      {
        archive: true,
        community_use: true,
        research: false,
        speech_technology: false,
        method: 'family_or_community',
        given_on: '1999-01-01',
      }
    )
    expect(consent.status).toBe(201)

    // A date, not a timestamp that could move to another day
    const speaker = await api(FACILITATOR, 'GET', `/speakers/${speakerId}`)
    expect(speaker.json.consent.given_on).toBe('1999-01-01')
  })

  it('only lets people who manage a speaker record them', async () => {
    const refused = await api(MEMBER, 'POST', '/recordings', {
      title: 'Not mine',
      languages: ['ain'],
      speaker_ids: [speakerId],
      source: 'browser',
    })
    expect(refused.status).toBe(400)
    expect(refused.json.message).toMatch(/not allowed/)
  })

  it('uploads in chunks and processes the recording', async () => {
    const created = await api(FACILITATOR, 'POST', '/recordings', {
      title: 'Uwepeker',
      languages: ['ain', 'ja'],
      speaker_ids: [speakerId],
      source: 'upload',
      recorded_on: '1972',
      location: null,
      original_filename: 'story.webm',
    })
    expect(created.status).toBe(201)
    const id = created.json.id

    // 3 seconds of audio, split at arbitrary byte boundaries
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stories-test-'))
    const file = path.join(dir, 'story.webm')
    execFileSync('ffmpeg', [
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=3',
      '-c:a',
      'libopus',
      file,
    ])
    const audio = fs.readFileSync(file)
    const third = Math.ceil(audio.length / 3)
    const chunks = [0, 1, 2].map(i =>
      audio.subarray(i * third, (i + 1) * third)
    )

    expect(
      (
        await api(
          MEMBER,
          'PUT',
          `/recordings/${id}/chunks/0`,
          undefined,
          chunks[0]
        )
      ).status
    ).toBe(403)

    // Out of order, as resumed uploads would be
    for (const i of [2, 0]) {
      const put = await api(
        FACILITATOR,
        'PUT',
        `/recordings/${id}/chunks/${i}`,
        undefined,
        chunks[i]
      )
      expect(put.status).toBe(204)
    }

    const early = await api(FACILITATOR, 'POST', `/recordings/${id}/complete`, {
      chunk_count: 3,
    })
    expect(early.status).toBe(400)
    expect(early.json.uploaded_chunks).toEqual([0, 2])

    // Others don't see unfinished uploads
    const list = await api(MEMBER, 'GET', '/recordings')
    expect(list.json.map((r: { id: number }) => r.id)).not.toContain(id)

    await api(
      FACILITATOR,
      'PUT',
      `/recordings/${id}/chunks/1`,
      undefined,
      chunks[1]
    )
    const complete = await api(
      FACILITATOR,
      'POST',
      `/recordings/${id}/complete`,
      {
        chunk_count: 3,
      }
    )
    expect(complete.status).toBe(202)

    const late = await api(
      FACILITATOR,
      'PUT',
      `/recordings/${id}/chunks/3`,
      undefined,
      chunks[0]
    )
    expect(late.status).toBe(409)

    let recording
    for (let attempt = 0; attempt < 60; attempt++) {
      recording = (await api(MEMBER, 'GET', `/recordings/${id}`)).json
      if (recording.status !== 'processing') break
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    expect(recording.status).toBe('ready')
    expect(Math.abs(recording.duration_ms - 3000)).toBeLessThan(150)
    expect(recording.size_bytes).toBe(audio.length)
    expect(recording.recorded_on).toBe('1972')
    expect(recording.location).toBeNull()
    expect(recording.speakers).toEqual([
      { id: speakerId, display_name: 'Elder A' },
    ])

    // Members can listen; only the facilitator gets the original
    const playback = await api(MEMBER, 'GET', `/recordings/${id}/audio`)
    expect(playback.status).toBe(302)
    expect(
      (await api(MEMBER, 'GET', `/recordings/${id}/audio?original=true`)).status
    ).toBe(403)
    const original = await api(
      FACILITATOR,
      'GET',
      `/recordings/${id}/audio?original=true`
    )
    expect(original.status).toBe(302)

    // The redirect points at the browser-facing storage origin; fetch the
    // same object through the docker-internal endpoint.
    const { STORAGE_LOCAL_DEVELOPMENT_ENDPOINT } = getConfig()
    const toInternal = (url: string) =>
      url.replace(/^https?:\/\/[^/]+/, STORAGE_LOCAL_DEVELOPMENT_ENDPOINT)
    const originalBytes = Buffer.from(
      await (
        await fetch(toInternal(original.headers.get('location')))
      ).arrayBuffer()
    )
    expect(originalBytes.equals(audio)).toBe(true)
    const mp3 = Buffer.from(
      await (
        await fetch(toInternal(playback.headers.get('location')))
      ).arrayBuffer()
    )
    // MP3 frame sync or ID3 header
    expect(mp3[0] === 0xff || mp3.subarray(0, 3).toString() === 'ID3').toBe(
      true
    )
  }, 60_000)

  it('blocks new recordings once consent is withdrawn', async () => {
    const speaker = await api(FACILITATOR, 'GET', `/speakers/${speakerId}`)
    const withdraw = await api(
      FACILITATOR,
      'POST',
      `/speakers/${speakerId}/consents/${speaker.json.consent.id}/withdraw`
    )
    expect(withdraw.status).toBe(204)

    const refused = await api(FACILITATOR, 'POST', '/recordings', {
      title: 'After withdrawal',
      languages: ['ain'],
      speaker_ids: [speakerId],
      source: 'browser',
    })
    expect(refused.status).toBe(400)
    expect(refused.json.message).toMatch(/consent/)
  })
  it('imports only the configured locales', async () => {
    process.env.CV_LOCALES = 'en,ja,ain'
    process.env.CV_CONTRIBUTABLE_LOCALES = 'ain'
    let importLocales: typeof importStaticLocales
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      importLocales = require('../../fork/locales').importStaticLocales
    })
    await importLocales()

    const [rows] = await getMySQLInstance().query(
      `SELECT name, is_translated, is_contributable FROM locales
       WHERE is_translated = 1 OR is_contributable = 1 ORDER BY name`
    )
    expect(rows).toEqual([
      { name: 'ain', is_translated: 1, is_contributable: 1 },
      { name: 'en', is_translated: 1, is_contributable: 0 },
      { name: 'ja', is_translated: 1, is_contributable: 0 },
    ])
  })

  it('lets admins from CV_ADMIN_EMAILS grant roles', async () => {
    // FACILITATOR is an admin through CV_ADMIN_EMAILS (see FORK.md)
    const forbidden = await api(MEMBER, 'GET', '/admin/users')
    expect(forbidden.status).toBe(403)

    const users = await api(FACILITATOR, 'GET', '/admin/users')
    expect(users.status).toBe(200)
    expect(users.json.map((u: { email: string }) => u.email)).toEqual([
      FACILITATOR.email,
      MEMBER.email,
    ])

    const grant = await api(
      FACILITATOR,
      'PUT',
      `/admin/users/${MEMBER.client_id}/roles/moderator`
    )
    expect(grant.status).toBe(204)
    expect((await api(MEMBER, 'GET', '/roles')).json.roles).toEqual([
      'moderator',
    ])

    // Moderators manage every speaker, including real names
    const speaker = await api(MEMBER, 'GET', `/speakers/${speakerId}`)
    expect(speaker.json.full_name).toBe('Real Name')

    expect(
      (
        await api(
          FACILITATOR,
          'PUT',
          `/admin/users/${MEMBER.client_id}/roles/king`
        )
      ).status
    ).toBe(400)
    const revoke = await api(
      FACILITATOR,
      'DELETE',
      `/admin/users/${MEMBER.client_id}/roles/moderator`
    )
    expect(revoke.status).toBe(204)
    expect((await api(MEMBER, 'GET', '/roles')).json.roles).toEqual([])
  })
})
