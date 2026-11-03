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

  it('finds segments at pauses, and lets anyone transcribe them', async () => {
    // 14 s: speech-like tone with pauses at 4–5 s and 9–10 s
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'segments-test-'))
    const file = path.join(dir, 'pauses.webm')
    execFileSync('ffmpeg', [
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'aevalsrc=if(lt(mod(t\\,5)\\,4)\\,0.5*sin(2*PI*440*t)\\,0):d=14',
      '-c:a',
      'libopus',
      file,
    ])
    const created = await api(FACILITATOR, 'POST', '/recordings', {
      title: 'With pauses',
      languages: ['ain'],
      speaker_ids: [speakerId],
      source: 'upload',
    })
    const id = created.json.id
    await api(
      FACILITATOR,
      'PUT',
      `/recordings/${id}/chunks/0`,
      undefined,
      fs.readFileSync(file)
    )
    await api(FACILITATOR, 'POST', `/recordings/${id}/complete`, {
      chunk_count: 1,
    })
    let recording
    for (let attempt = 0; attempt < 60; attempt++) {
      recording = (await api(MEMBER, 'GET', `/recordings/${id}`)).json
      if (recording.status !== 'processing') break
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    expect(recording.status).toBe('ready')
    expect(recording.progress).toMatchObject({
      segments: 3,
      transcription_latin: 0,
      transcription_kana: 0,
      translation_ja: 0,
    })

    let segments = (await api(MEMBER, 'GET', `/recordings/${id}/segments`)).json
    expect(segments).toHaveLength(3)
    expect(segments[0].start_ms).toBe(0)
    expect(Math.abs(segments[0].end_ms - 4500)).toBeLessThan(300)
    expect(Math.abs(segments[1].end_ms - 9500)).toBeLessThan(300)
    expect(segments[2].end_ms).toBe(recording.duration_ms)
    // The recording's only speaker
    expect(segments.map((s: { speaker_id: number }) => s.speaker_id)).toEqual([
      speakerId,
      speakerId,
      speakerId,
    ])
    const [first, second, third] = segments

    // Anyone signed in can transcribe, starting from no version
    const transcribed = await api(
      MEMBER,
      'POST',
      `/segments/${first.id}/transcripts`,
      {
        kind: 'transcription_latin',
        text: 'tan to ta  ', // trimmed
        base_id: null,
      }
    )
    expect(transcribed.status).toBe(201)
    expect(transcribed.json).toMatchObject({
      text: 'tan to ta',
      is_mine: true,
    })

    // The katakana transcription is separate, and can hold Japanese
    const kana = await api(
      FACILITATOR,
      'POST',
      `/segments/${first.id}/transcripts`,
      {
        kind: 'transcription_kana',
        text: 'タント タ 今日は',
        base_id: null,
      }
    )
    expect(kana.status).toBe(201)

    // A second edit that started from no version is refused, not lost
    const stale = await api(
      FACILITATOR,
      'POST',
      `/segments/${first.id}/transcripts`,
      {
        kind: 'transcription_latin',
        text: 'tanto',
        base_id: null,
      }
    )
    expect(stale.status).toBe(409)
    expect(stale.json.current.text).toBe('tan to ta')

    const revised = await api(
      FACILITATOR,
      'POST',
      `/segments/${first.id}/transcripts`,
      {
        kind: 'transcription_latin',
        text: 'tanto ta',
        base_id: transcribed.json.id,
      }
    )
    expect(revised.status).toBe(201)
    await api(MEMBER, 'POST', `/segments/${first.id}/transcripts`, {
      kind: 'translation_ja',
      text: '今日は',
      base_id: null,
    })
    await api(MEMBER, 'POST', `/segments/${second.id}/transcripts`, {
      kind: 'transcription_latin',
      text: 'pirka',
      base_id: null,
    })

    // Every version is kept
    const versions = await api(
      MEMBER,
      'GET',
      `/segments/${first.id}/transcripts?kind=transcription_latin`
    )
    expect(versions.json.map((v: { text: string }) => v.text)).toEqual([
      'tanto ta',
      'tan to ta',
    ])

    // Only the recording's own speakers, and boundaries in range
    expect(
      (
        await api(MEMBER, 'PATCH', `/segments/${first.id}`, {
          speaker_id: 999999,
        })
      ).status
    ).toBe(400)
    expect(
      (
        await api(MEMBER, 'PATCH', `/segments/${first.id}`, {
          end_ms: second.end_ms + 1000,
        })
      ).status
    ).toBe(400)
    expect(
      (
        await api(MEMBER, 'PATCH', `/segments/${third.id}`, {
          end_ms: 13000,
        })
      ).status
    ).toBe(400)

    // Moving a boundary moves the next segment's start too
    segments = (
      await api(MEMBER, 'PATCH', `/segments/${first.id}`, {
        end_ms: 4000,
        speaker_id: speakerId,
        languages: ['ain', 'ja'],
      })
    ).json
    expect(segments[0]).toMatchObject({
      end_ms: 4000,
      speaker_id: speakerId,
      languages: ['ain', 'ja'],
    })
    expect(segments[1].start_ms).toBe(4000)

    // Splitting: the first part keeps the transcript
    segments = (
      await api(MEMBER, 'POST', `/segments/${second.id}/split`, {
        at_ms: 7000,
      })
    ).json
    expect(segments.map((s: { start_ms: number }) => s.start_ms)).toEqual([
      0,
      4000,
      7000,
      third.start_ms,
    ])
    expect(segments[1].transcription_latin.text).toBe('pirka')
    expect(segments[2].transcription_latin).toBeNull()
    expect(
      (
        await api(MEMBER, 'POST', `/segments/${second.id}/split`, {
          at_ms: 7100,
        })
      ).status
    ).toBe(400)

    // Merging joins the transcripts into a new version
    segments = (await api(MEMBER, 'POST', `/segments/${first.id}/merge`)).json
    expect(segments).toHaveLength(3)
    expect(segments[0]).toMatchObject({ start_ms: 0, end_ms: 7000 })
    expect(segments[0].transcription_latin.text).toBe('tanto ta pirka')
    expect(segments[0].transcription_kana.text).toBe('タント タ 今日は')
    expect(segments[0].translation_ja.text).toBe('今日は')

    const listed = (await api(MEMBER, 'GET', '/recordings')).json.find(
      (r: { id: number }) => r.id === id
    )
    expect(listed.progress).toEqual({
      segments: 3,
      approved: 0,
      needs_work: 0,
      transcription_latin: 1,
      transcription_kana: 1,
      transcription_ja: 0,
      translation_ja: 1,
      translation_en: 0,
    })

    // Reviews. The merged versions were saved by MEMBER, who has no role;
    // FACILITATOR is an admin, which includes reviewing.
    const latin = segments[0].transcription_latin
    const translation = segments[0].translation_ja
    expect(
      (
        await api(MEMBER, 'POST', `/transcripts/${latin.id}/reviews`, {
          verdict: 'approved',
        })
      ).status
    ).toBe(403)
    expect(
      (
        await api(
          FACILITATOR,
          'POST',
          `/transcripts/${transcribed.json.id}/reviews`,
          { verdict: 'approved' }
        )
      ).status
    ).toBe(409) // an old version
    const approved = await api(
      FACILITATOR,
      'POST',
      `/transcripts/${latin.id}/reviews`,
      { verdict: 'approved' }
    )
    expect(approved.status).toBe(201)
    await api(FACILITATOR, 'POST', `/transcripts/${translation.id}/reviews`, {
      verdict: 'needs_work',
      comment: ' ㇷ゚ is missing ',
    })
    segments = (await api(MEMBER, 'GET', `/recordings/${id}/segments`)).json
    expect(segments[0].transcription_latin.review).toMatchObject({
      verdict: 'approved',
      is_mine: false,
    })
    expect(segments[0].translation_ja.review).toMatchObject({
      verdict: 'needs_work',
      comment: 'ㇷ゚ is missing',
    })
    let progress = (await api(MEMBER, 'GET', `/recordings/${id}`)).json.progress
    expect(progress).toMatchObject({ approved: 1, needs_work: 1 })

    // Nobody reviews their own version (FACILITATOR wrote the katakana)
    expect(
      (
        await api(
          FACILITATOR,
          'POST',
          `/transcripts/${segments[0].transcription_kana.id}/reviews`,
          { verdict: 'approved' }
        )
      ).status
    ).toBe(403)
    const own = await api(
      FACILITATOR,
      'POST',
      `/segments/${segments[1].id}/transcripts`,
      { kind: 'translation_ja', text: 'よい', base_id: null }
    )
    expect(
      (
        await api(FACILITATOR, 'POST', `/transcripts/${own.json.id}/reviews`, {
          verdict: 'approved',
        })
      ).status
    ).toBe(403)

    // A new version starts unreviewed
    const fixed = await api(
      MEMBER,
      'POST',
      `/segments/${segments[0].id}/transcripts`,
      {
        kind: 'translation_ja',
        text: '今日は、よい',
        base_id: translation.id,
      }
    )
    expect(fixed.json.review).toBeNull()
    progress = (await api(MEMBER, 'GET', `/recordings/${id}`)).json.progress
    expect(progress).toMatchObject({ approved: 1, needs_work: 0 })
    const history = (
      await api(
        MEMBER,
        'GET',
        `/segments/${segments[0].id}/transcripts?kind=translation_ja`
      )
    ).json
    expect(history[1].review.verdict).toBe('needs_work')

    // Detecting again would throw transcripts away: refused. Only those who
    // manage the recording may ask.
    expect(
      (await api(MEMBER, 'POST', `/recordings/${id}/segments/detect`)).status
    ).toBe(403)
    expect(
      (await api(FACILITATOR, 'POST', `/recordings/${id}/segments/detect`))
        .status
    ).toBe(409)
  })

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
    expect(
      users.json.map((u: { email: string; configured_admin: boolean }) => [
        u.email,
        u.configured_admin,
      ])
    ).toEqual([
      [FACILITATOR.email, true],
      [MEMBER.email, false],
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

  it('offers approved prompts, suggested by anyone', async () => {
    // A member's suggestion waits for a moderator; only they see it
    const suggested = await api(MEMBER, 'POST', '/prompts', {
      text_ja: ' 子どもの頃の遊び ',
      text_ain: null,
    })
    expect(suggested.status).toBe(201)
    expect(suggested.json.status).toBe('pending')
    const mine = (await api(MEMBER, 'GET', '/prompts')).json
    expect(mine).toContainEqual(
      expect.objectContaining({
        id: suggested.json.id,
        text_ja: '子どもの頃の遊び',
        status: 'pending',
        is_mine: true,
      })
    )
    expect(
      (
        await api(MEMBER, 'PATCH', `/prompts/${suggested.json.id}`, {
          status: 'approved',
        })
      ).status
    ).toBe(403)

    // Moderators' own suggestions are approved straight away
    const fromModerator = await api(FACILITATOR, 'POST', '/prompts', {
      text_ja: 'カムイの話',
      text_ain: 'kamuy oruspe',
    })
    expect(fromModerator.json.status).toBe('approved')
    expect(
      (
        await api(FACILITATOR, 'PATCH', `/prompts/${suggested.json.id}`, {
          status: 'rejected',
        })
      ).status
    ).toBe(204)

    // Recordings can only answer approved prompts
    const speaker = await api(FACILITATOR, 'POST', '/speakers', {
      display_name: 'Elder B',
    })
    await api(FACILITATOR, 'POST', `/speakers/${speaker.json.id}/consents`, {
      archive: true,
      community_use: true,
      research: false,
      speech_technology: false,
      method: 'verbal',
    })
    const recording = {
      title: 'Kamuy',
      languages: ['ain'],
      speaker_ids: [speaker.json.id],
      source: 'upload',
    }
    expect(
      (
        await api(FACILITATOR, 'POST', '/recordings', {
          ...recording,
          prompt_id: suggested.json.id,
        })
      ).status
    ).toBe(400)
    const created = await api(FACILITATOR, 'POST', '/recordings', {
      ...recording,
      prompt_id: fromModerator.json.id,
    })
    expect(created.status).toBe(201)
    const shown = (
      await api(FACILITATOR, 'GET', `/recordings/${created.json.id}`)
    ).json
    expect(shown.prompt).toEqual({
      id: fromModerator.json.id,
      text_ja: 'カムイの話',
      text_ain: 'kamuy oruspe',
    })

    // Members see approved prompts, not others' rejected ones
    const forFacilitator = (await api(FACILITATOR, 'GET', '/prompts')).json
    expect(forFacilitator.map((p: { id: number }) => p.id)).toContain(
      suggested.json.id
    )
    await api(FACILITATOR, 'POST', '/prompts', { text_ja: '漁の話' })
    const forMember = (await api(MEMBER, 'GET', '/prompts')).json
    expect(
      forMember.map((p: { text_ja: string; status: string }) => [
        p.text_ja,
        p.status,
      ])
    ).toEqual([
      ['漁の話', 'approved'],
      ['カムイの話', 'approved'],
      ['子どもの頃の遊び', 'rejected'],
    ])
  })

  it('lets anyone report a problem, and moderators resolve it', async () => {
    const [recording] = (await api(MEMBER, 'GET', '/recordings')).json
    const segments = (
      await api(MEMBER, 'GET', `/recordings/${recording.id}/segments`)
    ).json

    const reported = await api(
      MEMBER,
      'POST',
      `/recordings/${recording.id}/reports`,
      {
        reason: 'consent',
        comment: ' Not sure the family agreed ',
        segment_id: segments[0]?.id ?? null,
      }
    )
    expect(reported.status).toBe(201)
    expect(
      (
        await api(MEMBER, 'POST', `/recordings/${recording.id}/reports`, {
          reason: 'other',
          segment_id: 999999,
        })
      ).status
    ).toBe(400)

    // Only moderators see and resolve reports
    expect((await api(MEMBER, 'GET', '/reports')).status).toBe(403)
    const open = (await api(FACILITATOR, 'GET', '/reports')).json
    expect(open).toContainEqual(
      expect.objectContaining({
        id: reported.json.id,
        recording_title: recording.title,
        reason: 'consent',
        comment: 'Not sure the family agreed',
        reported_by: MEMBER.email,
      })
    )
    expect(
      (
        await api(MEMBER, 'POST', `/reports/${reported.json.id}/resolve`, {
          resolution: 'no',
        })
      ).status
    ).toBe(403)
    const resolved = await api(
      FACILITATOR,
      'POST',
      `/reports/${reported.json.id}/resolve`,
      { resolution: 'Asked the family: they agreed in 2019.' }
    )
    expect(resolved.status).toBe(204)
    expect(
      (await api(FACILITATOR, 'GET', '/reports')).json.map(
        (r: { id: number }) => r.id
      )
    ).not.toContain(reported.json.id)
    const done = (await api(FACILITATOR, 'GET', '/reports?status=resolved'))
      .json
    expect(done[0]).toMatchObject({
      id: reported.json.id,
      status: 'resolved',
      resolution: 'Asked the family: they agreed in 2019.',
      resolved_by: FACILITATOR.email,
    })
  })

  it('lets anyone add dialects, and admins merge them', async () => {
    // No approval needed; the same name in another case or width is found
    const saru = await api(MEMBER, 'POST', '/dialects', { name: ' Saru ' })
    expect(saru.status).toBe(201)
    expect(saru.json).toMatchObject({ name: 'Saru', created: true })
    for (const name of ['saru', 'Ｓａｒｕ']) {
      const again = await api(FACILITATOR, 'POST', '/dialects', { name })
      expect(again.json).toEqual({
        id: saru.json.id,
        name: 'Saru',
        created: false,
      })
    }
    const kanji = await api(FACILITATOR, 'POST', '/dialects', { name: '沙流' })
    expect(kanji.status).toBe(201)

    // Speakers say what they speak; recordings start with their speakers'
    const speaker = await api(FACILITATOR, 'POST', '/speakers', {
      display_name: 'Elder C',
      region: '平取',
      dialect_ids: [kanji.json.id],
    })
    await api(FACILITATOR, 'POST', `/speakers/${speaker.json.id}/consents`, {
      archive: true,
      community_use: false,
      research: false,
      speech_technology: false,
      method: 'verbal',
    })
    const recording = await api(FACILITATOR, 'POST', '/recordings', {
      title: 'Saru story',
      languages: ['ain'],
      speaker_ids: [speaker.json.id],
      source: 'upload',
    })
    expect(
      (await api(MEMBER, 'GET', `/recordings/${recording.json.id}`)).json
        .dialects
    ).toEqual([{ id: kanji.json.id, name: '沙流' }])
    expect(
      (
        await api(FACILITATOR, 'POST', '/speakers', {
          display_name: 'Nobody',
          dialect_ids: [999999],
        })
      ).status
    ).toBe(400)

    // Only admins tidy up; renaming onto another entry is a merge instead
    expect(
      (
        await api(MEMBER, 'POST', `/dialects/${kanji.json.id}/merge`, {
          into_id: saru.json.id,
        })
      ).status
    ).toBe(403)
    expect(
      (
        await api(FACILITATOR, 'PATCH', `/dialects/${kanji.json.id}`, {
          name: 'SARU',
        })
      ).status
    ).toBe(409)
    expect(
      (
        await api(FACILITATOR, 'POST', `/dialects/${kanji.json.id}/merge`, {
          into_id: saru.json.id,
        })
      ).status
    ).toBe(204)

    // Everything moved, and the old name now finds the merged entry
    const speakerAfter = await api(
      MEMBER,
      'GET',
      `/speakers/${speaker.json.id}`
    )
    expect(speakerAfter.json.dialects).toEqual([
      { id: saru.json.id, name: 'Saru' },
    ])
    const list = (await api(MEMBER, 'GET', '/dialects')).json
    expect(list).toEqual([
      {
        id: saru.json.id,
        name: 'Saru',
        aliases: ['沙流'],
        speakers: 1,
        recordings: 1,
      },
    ])
    expect(
      (await api(MEMBER, 'POST', '/dialects', { name: '沙流' })).json.id
    ).toBe(saru.json.id)
    const filtered = (
      await api(FACILITATOR, 'GET', `/recordings?dialect=${saru.json.id}`)
    ).json
    expect(filtered.map((r: { id: number }) => r.id)).toEqual([
      recording.json.id,
    ])

    // Corrections: whoever manages the speaker (here an admin) changes it
    expect(
      (
        await api(FACILITATOR, 'PATCH', `/speakers/${speaker.json.id}`, {
          dialect_ids: [],
        })
      ).status
    ).toBe(204)
    expect(
      (await api(MEMBER, 'GET', `/speakers/${speaker.json.id}`)).json.dialects
    ).toEqual([])
  })
})
