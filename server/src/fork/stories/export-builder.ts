import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { spawn } from 'child_process'
import * as archiver from 'archiver'
import { getMySQLInstance } from '../../lib/model/db/mysql'
import { currentConsents } from './speakers'
import { dialectsOf } from './dialects'
import { promptsById } from './prompts'
import { TRANSCRIPT_KINDS } from './schemas'
import { downloadToFile, exportPath, putStream } from './storage'

// Builds an export: a zip with a README, tables of recordings, speakers and
// segments, and optionally audio. A recording is included only if every
// one of its speakers currently consents to the export's purpose, so
// withdrawn consent leaves it out. Real names and notes are never included;
// display names only for the archive and community use.

export const EXPORT_PURPOSES = [
  'archive',
  'community_use',
  'research',
  'speech_technology',
] as const
export type Purpose = typeof EXPORT_PURPOSES[number]

type ExportRow = {
  id: number
  purpose: Purpose
  audio: 'none' | 'recordings' | 'segments'
  only_checked: number
}

const db = getMySQLInstance()

// Purposes for which speakers' display names (often nicknames) are kept
const NAMED_PURPOSES: Purpose[] = ['archive', 'community_use']

const code = (prefix: string, id: number) =>
  `${prefix}${String(id).padStart(5, '0')}`

// CSV that Excel opens correctly in Japanese: UTF-8 with a byte order mark,
// every field quoted
export function toCsv(header: string[], rows: unknown[][]): string {
  const field = (value: unknown) =>
    `"${(value === null || value === undefined ? '' : String(value)).replace(
      /"/g,
      '""'
    )}"`
  return (
    '﻿' +
    [header, ...rows].map(row => row.map(field).join(',')).join('\r\n') +
    '\r\n'
  )
}

const EXTENSIONS: Record<string, string> = {
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/flac': '.flac',
}

function originalExtension(filename: string | null, mime: string | null) {
  const fromName = filename ? path.extname(filename).toLowerCase() : ''
  if (/^\.[a-z0-9]{1,5}$/.test(fromName)) return fromName
  return EXTENSIONS[(mime ?? '').split(';')[0]] ?? '.bin'
}

function cutClip(input: string, startMs: number, endMs: number, out: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-ss',
      String(startMs / 1000),
      '-to',
      String(endMs / 1000),
      '-i',
      input,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      out,
    ])
    let stderr = ''
    child.stderr.on('data', data => (stderr += data))
    child.on('error', reject)
    child.on('close', status =>
      status === 0
        ? resolve()
        : reject(
            new Error(`ffmpeg exited with ${status}: ${stderr.slice(-2000)}`)
          )
    )
  })
}

function readme(
  row: ExportRow,
  counts: { recordings: number; speakers: number; segments: number }
) {
  const date = new Date().toISOString().slice(0, 10)
  const purposeJa: Record<Purpose, string> = {
    archive: 'アーカイブ（保存）',
    community_use: 'コミュニティ内での利用',
    research: '研究',
    speech_technology: '音声技術の開発',
  }
  const purposeEn: Record<Purpose, string> = {
    archive: 'archive (keeping)',
    community_use: 'community use',
    research: 'research',
    speech_technology: 'speech technology',
  }
  return `アイヌ語音声アーカイブ 書き出し / Ainu voice archive export
${date} · #${row.id}

【日本語】
目的：${purposeJa[row.purpose]}
録音 ${counts.recordings} 件、話者 ${counts.speakers} 人、区間 ${
    counts.segments
  } 件。

書き出した時点で、すべての話者がこの目的に同意している録音だけを含みます。
同意は後で変わることがあります。使う前に、アーカイブで最新の同意を確認してください。
同意が取り下げられた場合は、このファイルの該当部分を削除してください。
本名とメモは含みません。${
    NAMED_PURPOSES.includes(row.purpose)
      ? '話者の表示名を含みます。'
      : '話者は記号（S00001 など）だけで示します。'
  }${
    row.only_checked
      ? '\n確認担当が「確認済み」にした書き起こし・翻訳だけを含みます。'
      : '\n書き起こし・翻訳には、未確認のものも含みます（*_review の列を見てください）。'
  }

ファイル
- recordings.csv：録音（R00001 など）。languages は ain / ja、dialects は方言。
- speakers.csv：話者（S00001 など）。
- segments.csv：区間ごとの書き起こし（ラテン文字・カタカナ・日本語）と翻訳。
  時間はミリ秒。*_review は approved（確認済み）、needs_work（要修正）、空欄（未確認）。
${
  row.audio === 'recordings'
    ? '- audio/：元の録音ファイル。\n'
    : row.audio === 'segments'
    ? '- clips/：区間ごとの音声（WAV、16 kHz、モノラル）。\n'
    : ''
}
【English】
Purpose: ${purposeEn[row.purpose]}
${counts.recordings} recordings, ${counts.speakers} speakers, ${
    counts.segments
  } segments.

Only recordings whose every speaker consented to this purpose at the time of export are included.
Consent can change later: check current consent in the archive before use,
and delete the affected parts of this export if consent is withdrawn.
Real names and notes are never included. ${
    NAMED_PURPOSES.includes(row.purpose)
      ? 'Speakers’ display names are included.'
      : 'Speakers are identified by code only (S00001 etc.).'
  }${
    row.only_checked
      ? '\nOnly transcriptions and translations a reviewer has checked are included.'
      : '\nTranscriptions and translations include unchecked ones (see the *_review columns).'
  }

Files
- recordings.csv: recordings (R00001 etc.). languages are ain / ja.
- speakers.csv: speakers (S00001 etc.).
- segments.csv: per segment, transcriptions (Latin letters, katakana, Japanese) and translations.
  Times in milliseconds. *_review is approved, needs_work, or empty (not checked).
${
  row.audio === 'recordings'
    ? '- audio/: the original recordings.\n'
    : row.audio === 'segments'
    ? '- clips/: audio for each segment (WAV, 16 kHz, mono).\n'
    : ''
}`
}

export async function buildExport(exportId: number) {
  const [[row]]: [ExportRow[]] = await db.query(
    `SELECT * FROM fork_exports WHERE id = ? AND status IN ('queued', 'building', 'failed')`,
    [exportId]
  )
  if (!row) return
  await db.query(`UPDATE fork_exports SET status = 'building' WHERE id = ?`, [
    exportId,
  ])

  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'export-'))
  try {
    // Recordings whose every speaker consents to this purpose now
    const [recordings] = await db.query(
      `SELECT * FROM fork_recordings WHERE status = 'ready' ORDER BY id`
    )
    const [links] = await db.query(
      `SELECT recording_id, speaker_id FROM fork_recording_speakers`
    )
    const speakersOf = new Map<number, number[]>()
    for (const { recording_id, speaker_id } of links) {
      speakersOf.set(recording_id, [
        ...(speakersOf.get(recording_id) ?? []),
        speaker_id,
      ])
    }
    const consents = await currentConsents([
      ...new Set(links.map((l: { speaker_id: number }) => l.speaker_id)),
    ] as number[])
    const included = recordings.filter((recording: { id: number }) => {
      const speakerIds = speakersOf.get(recording.id) ?? []
      return (
        speakerIds.length > 0 &&
        speakerIds.every(id => consents.get(id)?.[row.purpose] === true)
      )
    })
    const recordingIds: number[] = included.map((r: { id: number }) => r.id)
    const speakerIds = [
      ...new Set(recordingIds.flatMap(id => speakersOf.get(id) ?? [])),
    ]

    const [speakers] = speakerIds.length
      ? await db.query(
          `SELECT id, display_name, birth_year, gender, region FROM fork_speakers WHERE id IN (?) ORDER BY id`,
          [speakerIds]
        )
      : [[]]
    const speakerDialects = await dialectsOf('speaker', speakerIds)
    const recordingDialects = await dialectsOf('recording', recordingIds)
    const prompts = await promptsById(
      included
        .map((r: { prompt_id: number | null }) => r.prompt_id)
        .filter(Boolean)
    )

    const [segments] = recordingIds.length
      ? await db.query(
          `SELECT * FROM fork_segments WHERE recording_id IN (?) ORDER BY recording_id, start_ms`,
          [recordingIds]
        )
      : [[]]
    const segmentIds = segments.map((s: { id: number }) => s.id)
    const [transcripts] = segmentIds.length
      ? await db.query(
          `
          SELECT t.id, t.segment_id, t.kind, t.text,
            (SELECT verdict FROM fork_transcript_reviews r
             WHERE r.transcript_id = t.id ORDER BY r.id DESC LIMIT 1) AS verdict
          FROM fork_transcripts t
          JOIN (
            SELECT MAX(id) AS id FROM fork_transcripts
            WHERE segment_id IN (?) GROUP BY segment_id, kind
          ) latest ON latest.id = t.id
          `,
          [segmentIds]
        )
      : [[]]

    const named = NAMED_PURPOSES.includes(row.purpose)
    const names = (list: { name: string }[] | undefined) =>
      (list ?? []).map(d => d.name).join('; ')

    const recordingsCsv = toCsv(
      [
        'recording',
        'title',
        'description',
        'languages',
        'dialects',
        'speakers',
        'recorded_on',
        'location',
        'prompt_ja',
        'prompt_ain',
        'duration_ms',
        'source',
        'audio_file',
      ],
      included.map(
        (r: {
          id: number
          title: string
          description: string | null
          languages: string
          recorded_on: string | null
          location: string | null
          prompt_id: number | null
          duration_ms: number
          source: string
          original_filename: string | null
          original_mime: string | null
        }) => [
          code('R', r.id),
          r.title,
          r.description,
          r.languages.replace(/,/g, ' '),
          names(recordingDialects.get(r.id)),
          (speakersOf.get(r.id) ?? []).map(id => code('S', id)).join(' '),
          r.recorded_on,
          r.location,
          prompts.get(r.prompt_id)?.text_ja,
          prompts.get(r.prompt_id)?.text_ain,
          r.duration_ms,
          r.source,
          row.audio === 'recordings'
            ? `audio/${code('R', r.id)}${originalExtension(
                r.original_filename,
                r.original_mime
              )}`
            : '',
        ]
      )
    )

    const speakersCsv = toCsv(
      [
        'speaker',
        ...(named ? ['display_name'] : []),
        'birth_year',
        'gender',
        'region',
        'dialects',
      ],
      speakers.map(
        (s: {
          id: number
          display_name: string
          birth_year: number | null
          gender: string | null
          region: string | null
        }) => [
          code('S', s.id),
          ...(named ? [s.display_name] : []),
          s.birth_year,
          s.gender,
          s.region,
          names(speakerDialects.get(s.id)),
        ]
      )
    )

    const indexInRecording = new Map<number, number>()
    const segmentRows = segments.map(
      (s: {
        id: number
        recording_id: number
        start_ms: number
        end_ms: number
        speaker_id: number | null
        languages: string | null
      }) => {
        const n = (indexInRecording.get(s.recording_id) ?? 0) + 1
        indexInRecording.set(s.recording_id, n)
        const clip = `${code('R', s.recording_id)}_${String(n).padStart(
          4,
          '0'
        )}`
        const texts = TRANSCRIPT_KINDS.flatMap(kind => {
          const t = transcripts.find(
            (x: { segment_id: number; kind: string }) =>
              x.segment_id === s.id && x.kind === kind
          )
          const verdict = t?.text ? t.verdict ?? '' : ''
          const text =
            row.only_checked && verdict !== 'approved' ? '' : t?.text ?? ''
          return [text, text ? verdict : '']
        })
        return {
          segment: s,
          clip,
          cells: [
            clip,
            code('R', s.recording_id),
            s.start_ms,
            s.end_ms,
            s.speaker_id ? code('S', s.speaker_id) : '',
            (s.languages ?? '').replace(/,/g, ' '),
            ...texts,
            row.audio === 'segments' ? `clips/${clip}.wav` : '',
          ],
        }
      }
    )
    const segmentsCsv = toCsv(
      [
        'segment',
        'recording',
        'start_ms',
        'end_ms',
        'speaker',
        'languages',
        ...TRANSCRIPT_KINDS.flatMap(kind => [kind, `${kind}_review`]),
        'audio_file',
      ],
      segmentRows.map((r: { cells: unknown[] }) => r.cells)
    )

    // The zip is written to disk, then uploaded
    const zipFile = path.join(dir, 'export.zip')
    const output = fs.createWriteStream(zipFile)
    const archive = archiver('zip', { zlib: { level: 6 } })
    const finished = new Promise<void>((resolve, reject) => {
      output.on('close', resolve)
      archive.on('error', reject)
    })
    archive.pipe(output)
    const counts = {
      recordings: included.length,
      speakers: speakers.length,
      segments: segments.length,
    }
    archive.append(readme(row, counts), { name: 'README.txt' })
    archive.append(recordingsCsv, { name: 'recordings.csv' })
    archive.append(speakersCsv, { name: 'speakers.csv' })
    archive.append(segmentsCsv, { name: 'segments.csv' })

    // Audio, one recording at a time; temporary files stay until the zip is
    // written, since the archive reads them as it goes
    if (row.audio !== 'none') {
      for (const recording of included) {
        const original = path.join(
          dir,
          `${code('R', recording.id)}${originalExtension(
            recording.original_filename,
            recording.original_mime
          )}`
        )
        await downloadToFile(recording.original_path, original)
        if (row.audio === 'recordings') {
          archive.file(original, { name: `audio/${path.basename(original)}` })
          continue
        }
        for (const { segment, clip } of segmentRows.filter(
          (r: { segment: { recording_id: number } }) =>
            r.segment.recording_id === recording.id
        )) {
          const wav = path.join(dir, `${clip}.wav`)
          await cutClip(original, segment.start_ms, segment.end_ms, wav)
          archive.file(wav, { name: `clips/${clip}.wav` })
        }
      }
    }

    await archive.finalize()
    await finished

    const size = (await fs.promises.stat(zipFile)).size
    await putStream(exportPath(exportId), fs.createReadStream(zipFile))
    await db.query(
      `
      UPDATE fork_exports
      SET status = 'ready', path = ?, size_bytes = ?, recordings = ?,
        speakers = ?, segments = ?, error = NULL, finished_at = NOW()
      WHERE id = ?
      `,
      [
        exportPath(exportId),
        size,
        counts.recordings,
        counts.speakers,
        counts.segments,
        exportId,
      ]
    )
  } catch (error) {
    await db.query(
      `UPDATE fork_exports SET status = 'failed', error = ? WHERE id = ?`,
      [String(error?.message ?? error).slice(0, 5000), exportId]
    )
    throw error
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true })
  }
}
