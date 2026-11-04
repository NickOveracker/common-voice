// Finds English on the Japanese interface: every message that has no
// Japanese is served as a ⟦marker⟧ instead, and the pages, menus and dialogs
// people use are walked as signed-out visitors, a new member, an admin (also
// at phone width) and a reviewer. Fails if any marker shows. Run by run.sh
// after the browser test, against its data.
//
//   node untranslated.js NEW_USERNAME   (a Keycloak account never signed in)
//
// Missing Japanese for upstream strings goes in
// web/locales/common-voice/ja/fork-upstream.ftl, for fork strings in fork.ftl.
const { chromium } = require('playwright')

const BASE = 'http://localhost:9000'
const NEWCOMER = process.argv[2]
const PASSWORD = 'test1234'

// Message ids, and their attributes, in a Fluent file
const messages = ftl => {
  const out = new Map()
  let current = null
  for (const line of ftl.split('\n')) {
    const message = /^(-?[a-zA-Z][\w-]*)\s*=/.exec(line)
    const attribute = /^\s+\.([a-zA-Z][\w-]*)\s*=/.exec(line)
    if (message) out.set((current = message[1]), [])
    else if (attribute && current) out.get(current).push(attribute[1])
    else if (line && !/^\s/.test(line)) current = null
  }
  return out
}

const seen = new Map()
let untranslated

const collect = async (page, where) => {
  await page.waitForTimeout(700)
  const found = await page.evaluate(() => {
    const out = new Set()
    const grab = s => (s || '').replace(/⟦([^⟧]+)⟧/g, (_, id) => out.add(id))
    grab(document.body.innerText)
    grab(document.title)
    for (const el of document.querySelectorAll('*')) {
      if (el.checkVisibility && !el.checkVisibility()) continue
      for (const name of ['placeholder', 'aria-label', 'title', 'alt', 'value'])
        grab(el.getAttribute(name))
    }
    return [...out]
  })
  for (const marker of found) {
    // CSS may have changed the case (text-transform)
    const id = untranslated.get(marker.toLowerCase()) ?? marker
    if (!seen.has(id)) seen.set(id, new Set())
    seen.get(id).add(where)
  }
}

// Optional steps: a page that changed shouldn't stop the rest
const step = async (label, fn) => {
  try {
    await fn()
  } catch (e) {
    console.log(`  (skipped ${label}: ${e.message.split('\n')[0]})`)
  }
}

;(async () => {
  const text = async locale =>
    (await fetch(`${BASE}/api/v1/languages/${locale}/translations`)).text()
  const en = messages(await text('en'))
  const ja = messages(await text('ja'))
  let markers = ''
  untranslated = new Map()
  for (const [id, attributes] of en) {
    if (ja.has(id) || id.startsWith('-')) continue
    markers += `${id} = ⟦${id}⟧\n`
    for (const name of attributes) markers += `    .${name} = ⟦${id}.${name}⟧\n`
    untranslated.set(id.toLowerCase(), id)
  }
  console.log(`${untranslated.size} of ${en.size} messages have no Japanese`)

  const browser = await chromium.launch({
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  })
  const session = async (viewport, user, fn) => {
    const phone = viewport.width < 500
    const context = await browser.newContext({
      locale: 'ja-JP',
      viewport,
      isMobile: phone,
      hasTouch: phone,
    })
    await context.grantPermissions(['microphone'], { origin: BASE })
    await context.route('**/api/v1/languages/ja/translations', async route => {
      // A dropped connection, or a page left meanwhile, shouldn't stop the run
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await route.fetch()
          const body = (await response.text()) + '\n' + markers
          return await route.fulfill({ response, body })
        } catch (e) {
          if (/closed|disposed/i.test(e.message)) return
        }
      }
      await route.abort().catch(() => {})
    })
    await context.addInitScript(() =>
      localStorage.setItem('interface-locale', 'ja')
    )
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    await page.goto(`${BASE}/ain`)
    await page.waitForSelector('.sign-in-gate__button')
    if (user) {
      await page.click('.sign-in-gate__button')
      await page.fill('#username', user)
      await page.fill('#password', PASSWORD)
      await page.click('#kc-login')
      await page.waitForURL(u => u.toString().startsWith(BASE))
      await page.waitForLoadState('networkidle')
    }
    await fn(page)
    await context.close()
  }
  const visit = async (page, path, where = path) => {
    await page.goto(BASE + path)
    await page.waitForLoadState('networkidle')
    await collect(page, where)
  }
  const desktop = { width: 1280, height: 900 }
  const phone = { width: 412, height: 915 }

  for (const viewport of [desktop, phone]) {
    await session(viewport, null, async page => {
      await collect(page, `sign-in page ${viewport.width}px`)
      await step('sign-in language menu', async () => {
        await page.click('.sign-in-gate__language button')
        await collect(page, 'sign-in language menu')
      })
      await visit(page, '/ain/privacy', 'privacy, signed out')
      await visit(page, '/ain/terms', 'terms, signed out')
    })
  }

  if (NEWCOMER)
    await session(desktop, NEWCOMER, async page => {
      await collect(page, 'first sign-in')
      await visit(page, '/ain/profile/info', 'profile setup')
      await step('profile saved empty', async () => {
        await page.click('.profile-info button.save', { force: true })
        await collect(page, 'profile setup, saved empty')
      })
      await step('profile saved', async () => {
        await page.fill('.profile-info [name="username"]', NEWCOMER)
        await page
          .locator('.profile-info [name="privacy"]')
          .check({ force: true })
        await page.click('.profile-info button.save')
        await collect(page, 'profile setup, saved')
      })
      await visit(page, '/ain', 'home, new member')
      await visit(page, '/ain/stories', 'stories, new member')
      await visit(page, '/ain/speakers', 'speakers, new member')
    })

  await session(desktop, 'facilitator', async page => {
    for (const path of [
      '/ain',
      '/ain/stories',
      '/ain/stories/new',
      '/ain/speakers',
      '/ain/prompts',
      '/ain/reports',
      '/ain/admin',
      '/ain/exports',
      '/ain/profile/info',
      '/ain/profile/settings',
      '/ain/profile/delete',
      '/ain/profile/avatar',
      '/ain/profile/download',
      '/ain/privacy',
      '/ain/terms',
      '/ain/dashboard',
      '/ain/no-such-page',
      '/ain/speak',
    ])
      await step(path, () => visit(page, path))

    await step('header language menu', async () => {
      await page.goto(`${BASE}/ain/stories`)
      await page.click('.header .language-select-container button')
      await collect(page, 'header language menu')
    })
    await step('new recording', async () => {
      const start = async () => {
        await page.goto(`${BASE}/ain/stories/new`)
        await page.waitForLoadState('networkidle')
        // The buttons wait for a title, a language and a speaker
        await page.getByLabel('タイトル').fill('untranslated check')
        await page.getByLabel('日本語').check({ force: true })
        await page
          .locator(
            'fieldset:has(legend:has-text("話者")) input[type="checkbox"]:not([disabled])'
          )
          .first()
          .check({ force: true })
      }
      await start()
      for (const label of ['今すぐ録音する', 'ファイルをアップロードする']) {
        const button = page.locator(`button:has-text("${label}")`).first()
        // Uploading waits for a file to be chosen
        if (await button.isEnabled().catch(() => false)) {
          await button.click()
          await collect(page, `new recording → ${label}`)
          await start()
        }
      }
    })
    await step('speaker details', async () => {
      await page.goto(`${BASE}/ain/speakers`)
      await page.waitForLoadState('networkidle')
      await page.locator('button:has-text("詳細と同意")').first().click()
      await collect(page, 'speaker details')
    })
    await step('story', async () => {
      const id = await page.evaluate(
        async () =>
          (
            await (await fetch('/api/v1/community/recordings')).json()
          ).find(r => r.status === 'ready')?.id
      )
      await visit(page, `/ain/stories/${id}`, 'story')
      for (const label of ['問題を報告', '以前の版', '英訳を追加']) {
        const control = page
          .locator(`button:has-text("${label}"), a:has-text("${label}")`)
          .first()
        if (await control.isVisible().catch(() => false)) {
          await control.click()
          await collect(page, `story → ${label}`)
        }
      }
    })
    await step('profile saved', async () => {
      await visit(page, '/ain/profile/info', 'profile')
      await page.click('.profile-info button.save')
      await collect(page, 'profile saved')
    })
  })

  await session(phone, 'facilitator', async page => {
    await collect(page, 'home, phone')
    await step('phone menu', async () => {
      await page.click('.mobile-menu-icon')
      await collect(page, 'phone menu')
    })
    await visit(page, '/ain/profile/info', 'profile, phone')
  })

  await session(desktop, 'reviewer', async page => {
    for (const path of [
      '/ain',
      '/ain/stories',
      '/ain/speakers',
      '/ain/admin',
      '/ain/reports',
      '/ain/exports',
    ])
      await step(path, () => visit(page, path, `${path} (reviewer)`))
  })

  await browser.close()
  for (const [id, where] of [...seen].sort())
    console.log(`  ${id}: ${[...where].slice(0, 3).join('; ')}`)
  if (seen.size) {
    console.log(`UNTRANSLATED: ${seen.size} messages show in English`)
    process.exitCode = 1
  } else console.log('UNTRANSLATED: none')
})().catch(e => {
  console.log('UNTRANSLATED CHECK FAILED:', e.message)
  process.exitCode = 1
})
