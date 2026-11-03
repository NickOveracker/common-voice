// Full-stack browser test of the private instance: sign-in gate, Keycloak
// login, Japanese interface on /ain/ URLs, speakers + consent, recording with
// a fake microphone, processing and playback under the strict CSP.
const { chromium } = require('playwright')

const BASE = 'http://localhost:9000'
const shots = process.argv[2] || '.'
let step = 0
const RUN = Date.now().toString(36)
const SPEAKER = `エカシ ${RUN}`
const TITLE = `E2E ウエペケㇾ ${RUN}`
const log = msg => console.log(`[${++step}] ${msg}`)

;(async () => {
  const browser = await chromium.launch({
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  })
  const context = await browser.newContext({ locale: 'ja-JP' })
  await context.grantPermissions(['microphone'], { origin: BASE })
  const page = await context.newPage()
  const cspErrors = []
  page.on('console', m => {
    if (m.type() === 'error') {
      console.log('  console error:', m.text().slice(0, 300))
      if (/Content Security Policy/i.test(m.text())) cspErrors.push(m.text())
    }
  })
  const external = new Set()
  page.on('request', r => {
    const host = new URL(r.url()).host
    if (
      ![
        'localhost:9000',
        'cvfork-keycloak:8080',
        'cvfork-storage:8080',
      ].includes(host)
    ) {
      external.add(host)
    }
  })

  try {
    await page.goto(BASE)
    await page.waitForSelector('text=ログインしてください', { timeout: 30000 })
    log(`sign-in gate shown in Japanese at ${page.url()}`)
    await page.screenshot({ path: `${shots}/1-gate.png`, fullPage: true })

    const anon = await page.evaluate(
      async () => (await fetch('/api/v1/ain/clips')).status
    )
    log(`anonymous API request status: ${anon}`)
    if (anon !== 403) throw new Error('anonymous API request was not refused')

    await page.click('.sign-in-gate__button')
    await page.waitForSelector('#username', { timeout: 30000 })
    await page.fill('#username', 'facilitator')
    await page.fill('#password', 'test1234')
    await page.click('#kc-login')
    await page.waitForURL(u => u.toString().startsWith(BASE), {
      timeout: 30000,
    })
    await page.waitForLoadState('networkidle')
    log(`signed in, now at ${page.url()}`)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${shots}/1b-signed-in.png`, fullPage: true })

    // Profile setup: no Mozilla newsletter, privacy wording, links or logo
    await page.goto(`${BASE}/ain/profile/info`)
    await page.waitForSelector('.profile-info [name="privacy"]', {
      timeout: 30000,
    })
    await page.waitForTimeout(1000)
    const siteName = await page.textContent('.fork-site-name')
    const title = await page.title()
    log(`header shows "${siteName}", page title "${title}"`)
    if (siteName !== 'アイヌ語音声アーカイブ' || title !== siteName) {
      throw new Error('site name missing from header or title')
    }
    const profile = await page.evaluate(() => ({
      text: document.querySelector('main, #content, body').innerText,
      newsletter: document.querySelectorAll('[name="email-opt-in"]').length,
      mozillaLinks: [...document.querySelectorAll('a[href]')]
        .map(a => a.href)
        .filter(
          href => /mozilla/i.test(href) || href.includes('/language/request')
        ),
      logoImages: document.querySelectorAll('.LogoImage').length,
    }))
    log(
      `profile: newsletter ${profile.newsletter}, Mozilla/request links ${profile.mozillaLinks.length}, logo images ${profile.logoImages}`
    )
    if (
      profile.newsletter ||
      profile.mozillaLinks.length ||
      profile.logoImages
    ) {
      throw new Error(
        'Mozilla leftovers on profile page: ' + profile.mozillaLinks.join(' ')
      )
    }
    if (/Mozilla/i.test(profile.text))
      throw new Error('profile page mentions Mozilla')
    if (!profile.text.includes('プライバシーに関するお知らせ')) {
      throw new Error('community privacy wording missing')
    }
    const gender = await page.$eval(
      '.profile-info select[name="gender"]',
      el => ({
        value: el.value,
        shown: el.selectedOptions[0]?.textContent ?? '',
      })
    )
    log(`gender field: value "${gender.value}", shown "${gender.shown}"`)
    if (gender.value === '' && gender.shown !== '') {
      throw new Error('gender field shows a choice that was not made')
    }
    await page.screenshot({ path: `${shots}/1c-profile.png`, fullPage: true })

    await page.fill('.profile-info [name="username"]', `facilitator-${RUN}`)
    const privacy = page.locator('.profile-info [name="privacy"]')
    if (!(await privacy.isDisabled())) await privacy.check({ force: true })
    const saved = page.waitForResponse(
      r =>
        r.url().endsWith('/api/v1/user_client') &&
        r.request().method() !== 'GET'
    )
    await page.click('.profile-info button.save')
    const saveStatus = (await saved).status()
    log(`profile saved without a terms dialog, status ${saveStatus}`)
    if (saveStatus !== 200) throw new Error('profile save failed')
    const newsletter = await page.evaluate(
      async () =>
        (
          await fetch('/api/v1/newsletter/someone@example.org', {
            method: 'POST',
          })
        ).status
    )
    log(`newsletter sign-up request status: ${newsletter}`)
    if (newsletter !== 404) throw new Error('newsletter route is not disabled')

    await page.goto(`${BASE}/ain/speakers`)
    await page.waitForSelector('text=話者を追加', { timeout: 30000 })
    log('speakers page in Japanese')
    await page.getByLabel('表示名').fill(SPEAKER)
    await page.getByLabel('本名').fill('Test Elder')
    await page.getByLabel('生まれた年').fill('1935')
    await page.getByLabel('地域・方言').fill('沙流')
    await page.click('button:has-text("保存")')
    await page.waitForSelector(`h2:has-text("${SPEAKER}")`)
    log('speaker created')

    await page
      .locator('li', { has: page.locator(`h2:has-text("${SPEAKER}")`) })
      .locator('button:has-text("詳細と同意")')
      .click()
    await page.waitForSelector('text=同意を記録する')
    await page.getByLabel('研究に利用する').check({ force: true })
    await page.click('button:has-text("同意を保存")')
    await page.waitForSelector('text=同意の履歴')
    log('consent recorded')
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: `${shots}/2-speakers.png`, fullPage: true })

    await page.goto(`${BASE}/ain/stories/new`)
    await page.waitForSelector('text=録音について')
    await page.getByLabel('タイトル').fill(TITLE)
    await page.getByLabel('日本語').check({ force: true })
    await page.getByLabel(SPEAKER).check({ force: true })
    await page.getByLabel(/録音日/).fill('1972')
    await page.screenshot({ path: `${shots}/3-new.png`, fullPage: true })
    await page.click('button:has-text("今すぐ録音する")')
    await page.click('button:has-text("録音を開始")')
    log('recording started')
    await page.waitForTimeout(5000)
    await page.click('button:has-text("一時停止")')
    await page.waitForTimeout(1500)
    await page.click('button:has-text("再開")')
    await page.waitForTimeout(3000)
    await page.screenshot({ path: `${shots}/4-recording.png`, fullPage: true })
    await page.click('button:has-text("終了")')
    await page.waitForSelector('text=保存しました', { timeout: 60000 })
    log('recording finished and uploaded')

    let ready = false
    for (let i = 0; i < 60 && !ready; i++) {
      await page.goto(`${BASE}/ain/stories`)
      await page.waitForSelector(`h2:has-text("${TITLE}")`)
      ready =
        (await page
          .locator('li', { has: page.locator(`h2:has-text("${TITLE}")`) })
          .locator('audio')
          .count()) > 0
      if (!ready) await page.waitForTimeout(1000)
    }
    if (!ready) throw new Error('recording never became ready')
    const card = page.locator('li', {
      has: page.locator(`h2:has-text("${TITLE}")`),
    })
    const meta = await card.locator('.fork-stories__meta').first().innerText()
    log(`stories list shows: ${meta}`)

    const audio = await page.evaluate(async () => {
      const el = document.querySelector('audio')
      el.preload = 'auto'
      el.load()
      await new Promise((resolve, reject) => {
        el.onloadedmetadata = resolve
        el.onerror = () => reject(new Error('audio error ' + el.error?.code))
        setTimeout(() => reject(new Error('audio load timeout')), 15000)
      })
      return el.duration
    })
    log(`audio plays in the page, duration ${audio.toFixed(1)}s`)
    // 5 s + 3 s recorded, with a 1.5 s pause that must not be included
    if (audio < 6.5 || audio > 9.5)
      throw new Error(`unexpected duration ${audio}`)
    await page.screenshot({ path: `${shots}/5-stories.png`, fullPage: true })

    // Transcribing: segments found at pauses, played one at a time
    await card.locator('a:has-text("書き起こし・翻訳")').click()
    await page.waitForSelector('.fork-transcribe__segment', { timeout: 30000 })
    const segments = page.locator('.fork-transcribe__segment')
    const segmentCount = await segments.count()
    const ranges = await segments
      .locator('.fork-transcribe__range')
      .allInnerTexts()
    log(`recording page: ${segmentCount} segment(s): ${ranges.join(', ')}`)

    const first = segments.first()
    await first.locator('.fork-transcribe__play').click()
    await page.waitForFunction(
      () => document.querySelector('audio').paused === false,
      null,
      { timeout: 10000 }
    )
    // Stops by itself at the end of the segment
    await page.waitForFunction(
      () => document.querySelector('audio').paused,
      null,
      {
        timeout: 40000,
      }
    )
    const stoppedAt = await page.evaluate(
      () => document.querySelector('audio').currentTime
    )
    log(`segment 1 played and stopped at ${stoppedAt.toFixed(2)}s`)

    // Ainu in Latin letters and in katakana, separately; Japanese stays
    // Japanese within them
    await first
      .getByLabel('書き起こし（ラテン文字）')
      .fill('irankarapte 今日は')
    await first
      .getByLabel('書き起こし（カタカナ）')
      .fill('イランカラㇷ゚テ 今日は')
    await first.getByLabel('日本語訳').fill('こんにちは')
    // Escape in a text box plays the segment
    await first.getByLabel('日本語訳').press('Escape')
    await page.waitForFunction(
      () => document.querySelector('audio').paused === false,
      null,
      { timeout: 10000 }
    )
    log('Escape plays the segment while typing')
    await first.locator('button:has-text("保存")').click()
    await first.locator('text=保存しました').waitFor()

    // Split the first segment in the middle of where playback is
    const middle = await page.evaluate(() => {
      const row = document.querySelector('.fork-transcribe__segment')
      const audio = document.querySelector('audio')
      audio.pause()
      return row.querySelector('.fork-transcribe__range').textContent
    })
    const [startText, endText] = middle
      .replace(/^\d+\.\s*/, '')
      .split('–')
      .map(t => t.trim())
    const toSeconds = t => {
      const [m, sec] = t.split(':')
      return Number(m) * 60 + Number(sec)
    }
    const midSeconds = (toSeconds(startText) + toSeconds(endText)) / 2
    await page.evaluate(t => {
      document.querySelector('audio').currentTime = t
    }, midSeconds)
    await page.waitForTimeout(300)
    await first.locator('button:has-text("ここで分割")').click()
    await page.waitForFunction(
      n => document.querySelectorAll('.fork-transcribe__segment').length === n,
      segmentCount + 1
    )
    log(
      `split segment 1 at ${midSeconds.toFixed(1)}s: ${
        segmentCount + 1
      } segments`
    )
    // Segment 1 now ends at the split: playing it stops there
    await page
      .locator('.fork-transcribe__segment')
      .first()
      .locator('.fork-transcribe__play')
      .click()
    await page.waitForFunction(
      () => document.querySelector('audio').paused === false,
      null,
      { timeout: 10000 }
    )
    await page.waitForFunction(
      () => document.querySelector('audio').paused,
      null,
      { timeout: 20000 }
    )
    const splitStop = await page.evaluate(
      () => document.querySelector('audio').currentTime
    )
    log(`segment 1 stopped at ${splitStop.toFixed(2)}s`)
    if (Math.abs(splitStop - midSeconds) > 0.3) {
      throw new Error('segment did not stop at its end')
    }

    // Merge back: the transcript stays
    await page
      .locator('.fork-transcribe__segment')
      .first()
      .locator('button:has-text("次と結合")')
      .click()
    await page.waitForFunction(
      n => document.querySelectorAll('.fork-transcribe__segment').length === n,
      segmentCount
    )
    await page.reload()
    await page.waitForSelector('.fork-transcribe__segment')
    const kept = page.locator('.fork-transcribe__segment').first()
    const latin = await kept.getByLabel('書き起こし（ラテン文字）').inputValue()
    const kana = await kept.getByLabel('書き起こし（カタカナ）').inputValue()
    log(`merged back; after reload: "${latin}" / "${kana}"`)
    // NFC keeps ㇷ゚ (small fu with a semi-voiced mark) as typed
    if (latin !== 'irankarapte 今日は' || kana !== 'イランカラㇷ゚テ 今日は') {
      throw new Error('transcriptions were not kept')
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: `${shots}/5b-transcribe.png`,
      fullPage: true,
    })
    const storyPath = new URL(page.url()).pathname.replace(/^\/ain\//, '')

    // Interface language switch keeps the contribution language in the URL
    await page.evaluate(() => localStorage.setItem('interface-locale', 'en'))
    await page.goto(`${BASE}/ain/stories`)
    await page.getByRole('heading', { name: 'Stories' }).waitFor()
    log(`English interface at ${page.url()}`)
    await page.screenshot({ path: `${shots}/6-english.png`, fullPage: true })

    // Phone width: no page wider than the screen
    await page.setViewportSize({ width: 390, height: 844 })
    for (const [path, heading] of [
      ['stories', 'Stories'],
      ['stories/new', 'New recording'],
      ['speakers', 'Speakers'],
      [storyPath, TITLE],
    ]) {
      await page.goto(`${BASE}/ain/${path}`)
      await page
        .getByRole('heading', { name: heading, exact: true })
        .first()
        .waitFor()
      await page.waitForTimeout(500)
      const width = await page.evaluate(
        () => document.documentElement.scrollWidth
      )
      log(`phone width: /ain/${path} is ${width}px wide`)
      if (width > 390) {
        const wide = await page.evaluate(() =>
          [...document.querySelectorAll('body *')]
            .filter(el => el.getBoundingClientRect().right > 391)
            .slice(0, 8)
            .map(
              el =>
                `${el.tagName.toLowerCase()}.${[...el.classList].join(
                  '.'
                )} → ${Math.round(el.getBoundingClientRect().right)}px`
            )
        )
        throw new Error(
          `/ain/${path} is wider than the screen:\n  ${wide.join('\n  ')}`
        )
      }
      await page.screenshot({
        path: `${shots}/7-phone-${path.replace('/', '-')}.png`,
        fullPage: true,
      })
    }

    if (cspErrors.length)
      throw new Error('CSP violations: ' + cspErrors.join('\n'))
    log(`external hosts contacted: ${[...external].join(', ') || 'none'}`)
    console.log('E2E PASSED')
  } catch (error) {
    await page.screenshot({ path: `${shots}/failure.png`, fullPage: true })
    console.log('E2E FAILED:', error.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
})()
