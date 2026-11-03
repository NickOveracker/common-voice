// Smoke test of a deployed instance, over its real HTTPS address: sign in,
// set up a profile, add a speaker with consent, record from a fake
// microphone (browsers only allow it on secure pages), wait for processing,
// and seek in the audio. Uses a throwaway account; see deploy/README.md.
//
//   BASE=https://… SIGNIN_USER=… SIGNIN_PASSWORD=… node smoke.js
const { chromium } = require('playwright')

const { BASE, SIGNIN_USER, SIGNIN_PASSWORD } = process.env
const RUN = Date.now().toString(36)
let step = 0
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
  const api = (method, path, body) =>
    page.evaluate(
      async ({ method, path, body }) => {
        const response = await fetch(`/api/v1/community${path}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        })
        return { status: response.status, json: await response.json().catch(() => null) }
      },
      { method, path, body }
    )

  try {
    await page.goto(`${BASE}/ain`)
    await page.waitForSelector('text=ログインしてください', { timeout: 30000 })
    log(`sign-in gate at ${page.url()}, secure context: ${await page.evaluate(() => window.isSecureContext)}`)

    await page.click('.sign-in-gate__button')
    await page.waitForSelector('#username', { timeout: 30000 })
    log(`Keycloak sign-in page at ${new URL(page.url()).origin}`)
    await page.fill('#username', SIGNIN_USER)
    await page.fill('#password', SIGNIN_PASSWORD)
    await page.click('#kc-login')
    await page.waitForURL(u => u.toString().startsWith(BASE), { timeout: 30000 })
    await page.waitForLoadState('networkidle')
    log(`signed in, at ${page.url()}`)

    await page.goto(`${BASE}/ain/profile/info`)
    await page.fill('.profile-info [name="username"]', `smoke-${RUN}`)
    await page.locator('.profile-info [name="privacy"]').check({ force: true })
    const saved = page.waitForResponse(
      r => r.url().endsWith('/api/v1/user_client') && r.request().method() !== 'GET'
    )
    await page.click('.profile-info button.save')
    log(`profile saved: ${(await saved).status()}`)

    const speaker = await api('POST', '/speakers', { display_name: `smoke ${RUN}` })
    await api('POST', `/speakers/${speaker.json.id}/consents`, {
      archive: true,
      community_use: false,
      research: false,
      speech_technology: false,
      method: 'other',
    })
    log(`speaker ${speaker.json.id} with consent`)

    await page.goto(`${BASE}/ain/stories/new`)
    await page.getByLabel('タイトル').fill(`smoke ${RUN}`)
    await page.getByLabel(`smoke ${RUN}`).check({ force: true })
    await page.click('button:has-text("今すぐ録音する")')
    await page.click('button:has-text("録音を開始")')
    await page.waitForTimeout(4000)
    await page.click('button:has-text("終了")')
    await page.waitForSelector('text=保存しました', { timeout: 60000 })
    log('recorded 4 s from the microphone and uploaded')

    const { json: recordings } = await api('GET', '/recordings?mine=true')
    const recording = recordings.find(r => r.title === `smoke ${RUN}`)
    let status = recording.status
    for (let i = 0; i < 60 && status !== 'ready'; i++) {
      await page.waitForTimeout(1000)
      status = (await api('GET', `/recordings/${recording.id}`)).json.status
    }
    log(`recording ${recording.id} processed: ${status}`)
    if (status !== 'ready') throw new Error('processing did not finish')

    const audio = await page.evaluate(async id => {
      const response = await fetch(`/api/v1/community/recordings/${id}/audio`, {
        headers: { Range: 'bytes=0-99' },
      })
      return { status: response.status, range: response.headers.get('content-range'), url: response.url }
    }, recording.id)
    log(`audio over HTTPS: ${audio.status} ${audio.range} from ${new URL(audio.url).host}`)
    if (audio.status !== 206) throw new Error('audio range request failed')

    const segments = (await api('GET', `/recordings/${recording.id}/segments`)).json
    log(`segments detected: ${segments.length}`)
    console.log(`SMOKE PASSED recording=${recording.id} speaker=${speaker.json.id}`)
  } catch (error) {
    console.log('SMOKE FAILED:', error.message)
    console.log('  at', page.url())
    console.log(
      '  page says:',
      (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400)
    )
    process.exitCode = 1
  } finally {
    await browser.close()
  }
})()
