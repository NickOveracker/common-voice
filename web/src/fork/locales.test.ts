import * as fs from 'fs'
import * as path from 'path'
import { parse } from '@fluent/syntax'

const LOCALES = path.join(__dirname, '../../locales/common-voice')

const messageIds = (dir: string, except?: string): string[] =>
  fs.readdirSync(dir).flatMap(name => {
    const file = path.join(dir, name)
    if (fs.statSync(file).isDirectory()) return messageIds(file, except)
    if (!name.endsWith('.ftl') || file === except) return []
    return parse(fs.readFileSync(file, 'utf8'), {}).body.flatMap(entry =>
      entry.type === 'Message' ? [entry.id.name] : []
    )
  })

describe('fork-upstream.ftl (Japanese for untranslated upstream strings)', () => {
  const file = path.join(LOCALES, 'ja', 'fork-upstream.ftl')
  const ours = messageIds(path.dirname(file)).filter(
    id => !messageIds(path.dirname(file), file).includes(id)
  )
  const fileIds = parse(fs.readFileSync(file, 'utf8'), {}).body.flatMap(entry =>
    entry.type === 'Message' ? [entry.id.name] : []
  )

  it('only has messages upstream has not translated (delete the rest)', () => {
    expect(fileIds.filter(id => !ours.includes(id))).toEqual([])
  })

  it('only has messages upstream still uses in English', () => {
    const english = messageIds(path.join(LOCALES, 'en'))
    expect(fileIds.filter(id => !english.includes(id))).toEqual([])
  })
})
