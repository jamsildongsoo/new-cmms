const metadata = require('./support/metadata.cjs')
/** 빌드된 SPA를 Chromium에서 실행하여 Context 복원과 세션 응답 경합을 검증한다. API는 이 테스트의 fixture 응답이다. */
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const dist = path.resolve(__dirname, '../dist')
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const { CDP, until } = require('./support/browser.cjs')
async function main() {
  await fs.access(path.join(dist, 'index.html'))
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'cmms-browser-'))
  const server = http.createServer(async (req, res) => {
    const name = decodeURIComponent(
      new URL(req.url, 'http://localhost').pathname,
    )
    const candidate = path.resolve(dist, '.' + name)
    if (!candidate.startsWith(dist + path.sep) && candidate !== dist) {
      res.writeHead(404)
      res.end()
      return
    }
    let file = candidate
    try {
      if (!(await fs.stat(file)).isFile()) file = path.join(dist, 'index.html')
    } catch {
      file = path.join(dist, 'index.html')
    }
    res.setHeader(
      'Content-Type',
      {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
      }[path.extname(file)] ?? 'application/octet-stream',
    )
    res.end(await fs.readFile(file))
  })
  let chrome, cdp
  try {
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const origin = `http://127.0.0.1:${server.address().port}`
    chrome = spawn(
      process.env.CHROME_PATH ?? '/opt/google/chrome/chrome',
      [
        '--headless=new',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--remote-debugging-port=0',
        `--user-data-dir=${profile}`,
        'about:blank',
      ],
      { stdio: 'ignore' },
    )
    let endpoint
    await until(async () => {
      try {
        endpoint = (
          await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')
        )
          .trim()
          .split('\n')
        return endpoint.length === 2
      } catch {
        return false
      }
    }, 'Chromium startup')
    const socket = new WebSocket(`ws://127.0.0.1:${endpoint[0]}${endpoint[1]}`)
    await once(socket, 'open')
    cdp = new CDP(socket)
    const fixture = {
      status: 200,
      delay: false,
      held: [],
      meCount: 0,
      metadataCount: 0,
      metadataStatus: 200,
      refreshStatus: 401,
      refreshCount: 0,
    }
    const user = (companyId) => ({
      companyId,
      userId: 'owner',
      roleId: 'READER',
      siteId: 'S1',
      deptId: 'D1',
      accessScope: 'COMPANY_ALL',
      permissions: [],
    })
    async function reply(session, event, status, body) {
      await cdp.send(
        'Fetch.fulfillRequest',
        {
          requestId: event.requestId,
          responseCode: status,
          responseHeaders: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Access-Control-Allow-Origin', value: origin },
            {
              name: 'Access-Control-Allow-Headers',
              value: 'authorization,content-type',
            },
            {
              name: 'Access-Control-Allow-Methods',
              value: 'GET,POST,PATCH,DELETE,OPTIONS',
            },
          ],
          body: Buffer.from(JSON.stringify(body)).toString('base64'),
        },
        session,
      )
    }
    cdp.handlers.push((event) => {
      if (event.method === 'Page.javascriptDialogOpening') {
        void cdp.send(
          'Page.handleJavaScriptDialog',
          { accept: true },
          event.sessionId,
        )
        return
      }
      if (event.method !== 'Fetch.requestPaused') return
      const data = event.params,
        session = event.sessionId
      void (async () => {
        if (data.request.method === 'OPTIONS')
          return reply(session, data, 204, {})
        const route = new URL(data.request.url).pathname
        if (route.endsWith('/system/metadata')) {
          fixture.metadataCount++
          return reply(
            session,
            data,
            fixture.metadataStatus,
            fixture.metadataStatus === 200
              ? metadata
              : { message: 'metadata unavailable' },
          )
        }
        if (route.endsWith('/auth/login')) {
          const payload = JSON.parse(data.request.postData)
          return reply(session, data, 201, {
            accessToken: `token-${payload.companyId}`,
            tokenType: 'Bearer',
            user: user(payload.companyId),
          })
        }
        if (route.endsWith('/auth/refresh')) {
          fixture.refreshCount++
          return reply(
            session,
            data,
            fixture.refreshStatus,
            fixture.refreshStatus === 200
              ? { accessToken: 'token-A-refreshed' }
              : { message: 'refresh expired' },
          )
        }
        if (route.endsWith('/auth/me')) {
          fixture.meCount++
          const token =
            Object.entries(data.request.headers).find(
              ([key]) => key.toLowerCase() === 'authorization',
            )?.[1] ?? ''
          const status = token.endsWith('refreshed') ? 200 : fixture.status
          if (fixture.delay) {
            fixture.held.push({ session, data })
            return
          }
          return reply(
            session,
            data,
            status,
            status === 200
              ? user(token.endsWith('B') ? 'B' : 'A')
              : { message: 'fixture error' },
          )
        }
        return reply(session, data, 200, [])
      })().catch((error) => {
        console.error(error)
        process.exitCode = 1
      })
    })
    async function page(route) {
      const { targetId } = await cdp.send('Target.createTarget', {
        url: 'about:blank',
      })
      const { sessionId } = await cdp.send('Target.attachToTarget', {
        targetId,
        flatten: true,
      })
      await cdp.send('Page.enable', {}, sessionId)
      await cdp.send('Runtime.enable', {}, sessionId)
      await cdp.send(
        'Fetch.enable',
        { patterns: [{ urlPattern: '*api/*' }] },
        sessionId,
      )
      await cdp.send('Page.navigate', { url: origin + route }, sessionId)
      return sessionId
    }
    async function click(session, label) {
      await cdp.eval(
        session,
        `(() => {const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}); if(!button)throw Error('Button missing'); button.click()})()`,
      )
    }
    async function login(session, companyId) {
      await until(
        () =>
          cdp.eval(
            session,
            `location.pathname==='/login' && document.querySelectorAll('input[required]').length===3`,
          ),
        'login screen',
      )
      await cdp.eval(
        session,
        `(() => {const inputs=[...document.querySelectorAll('input[required]')]; const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; [${JSON.stringify(companyId)},'owner','test-password'].forEach((value,index)=>{setter.call(inputs[index],value); inputs[index].dispatchEvent(new Event('input',{bubbles:true}))})})()`,
      )
      await click(session, '로그인')
      await until(
        () =>
          cdp.eval(
            session,
            `location.pathname!=='/login' && (document.body?.textContent ?? '').includes('회사 ${companyId}')`,
          ),
        `login ${companyId}`,
      )
    }
    const first = await page('/boards/new')
    await login(first, 'A')
    assert.equal(
      await cdp.eval(first, `localStorage.getItem('cmms.accessToken')`),
      'token-A',
    )
    assert.deepEqual(await cdp.eval(first, `Object.keys(localStorage)`), [
      'cmms.accessToken',
    ])
    console.log(
      'PASS login uses server context and stores only the access token',
    )
    await cdp.eval(
      first,
      `(() => {const input=document.querySelector('input[required]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'미저장 제목');input.dispatchEvent(new Event('input',{bubbles:true}))})()`,
    )
    const metadataCount = fixture.metadataCount
    const oldCount = fixture.meCount
    await cdp.eval(first, `window.dispatchEvent(new Event('focus'))`)
    await until(() => fixture.meCount > oldCount, 'focus reload')
    await wait(150)
    assert.equal(
      await cdp.eval(first, `document.querySelector('input[required]').value`),
      '미저장 제목',
    )
    assert.equal(fixture.metadataCount, metadataCount)
    console.log(
      'PASS same-user context reload preserves local form input and reuses metadata',
    )
    fixture.status = 403
    await cdp.eval(first, `window.dispatchEvent(new Event('focus'))`)
    await wait(200)
    assert.equal(
      await cdp.eval(first, `localStorage.getItem('cmms.accessToken')`),
      'token-A',
    )
    console.log('PASS 403 preserves the session')
    fixture.status = 500
    await cdp.send('Page.reload', {}, first)
    await until(
      () =>
        cdp.eval(
          first,
          `(document.body?.textContent ?? '').includes('다시 시도') && !(document.body?.textContent ?? '').includes('게시글 작성')`,
        ),
      'server-error restore screen',
    )
    assert.equal(
      await cdp.eval(first, `localStorage.getItem('cmms.accessToken')`),
      'token-A',
    )
    fixture.status = 200
    await click(first, '다시 시도')
    await until(
      () =>
        cdp.eval(
          first,
          `(document.body?.textContent ?? '').includes('게시글 작성')`,
        ),
      'retry restores user',
    )
    assert.equal(
      await cdp.eval(first, `document.querySelector('input[required]').value`),
      '',
    )
    console.log(
      'PASS reload waits for /me, preserves tokens on 500, and retries without restoring unsaved input',
    )
    fixture.metadataStatus = 500
    await cdp.send('Page.reload', {}, first)
    await until(
      () =>
        cdp.eval(
          first,
          "document.body.textContent.includes('공통 코드 목록을 불러오지 못했습니다.') && !document.body.textContent.includes('게시글 작성')",
        ),
      'metadata failure blocks business screen',
    )
    assert.equal(
      await cdp.eval(first, "localStorage.getItem('cmms.accessToken')"),
      'token-A',
    )
    fixture.metadataStatus = 200
    await click(first, '다시 시도')
    await until(
      () =>
        cdp.eval(first, "document.body.textContent.includes('게시글 작성')"),
      'metadata retry restores screen',
    )
    console.log(
      'PASS metadata failure retains authentication and supports retry',
    )
    fixture.delay = true
    await cdp.eval(first, `window.dispatchEvent(new Event('focus'))`)
    await until(() => fixture.held.length > 0, 'old /me request')
    await click(first, '로그아웃')
    fixture.delay = false
    await login(first, 'B')
    for (const held of fixture.held.splice(0))
      await reply(held.session, held.data, 401, { message: 'late old session' })
    await wait(150)
    assert.equal(
      await cdp.eval(first, `localStorage.getItem('cmms.accessToken')`),
      'token-B',
    )
    assert.equal(
      await cdp.eval(
        first,
        `(document.body?.textContent ?? '').includes('회사 B')`,
      ),
      true,
    )
    console.log('PASS a late old-token 401 cannot clear a new company session')
    fixture.delay = true
    await cdp.eval(first, `window.dispatchEvent(new Event('focus'))`)
    await until(() => fixture.held.length > 0, 'stale user request')
    await click(first, '로그아웃')
    fixture.delay = false
    for (const held of fixture.held.splice(0))
      await reply(held.session, held.data, 200, user('B'))
    await wait(150)
    assert.equal(await cdp.eval(first, `location.pathname`), '/login')
    assert.equal(
      await cdp.eval(first, `localStorage.getItem('cmms.accessToken')`),
      null,
    )
    console.log('PASS a late /me response cannot restore a logged-out user')
    await login(first, 'A')
    const second = await page('/')
    await until(
      () =>
        cdp.eval(
          second,
          `(document.body?.textContent ?? '').includes('회사 A')`,
        ),
      'second-tab restoration',
    )
    await click(second, '로그아웃')
    await until(
      () => cdp.eval(first, `location.pathname==='/login'`),
      'cross-tab logout',
    )
    console.log('PASS storage events synchronize logout between tabs')
    await login(first, 'A')
    fixture.status = 401
    fixture.refreshStatus = 200
    await cdp.eval(first, `window.dispatchEvent(new Event('focus'))`)
    await until(
      () => cdp.eval(first, `localStorage.getItem('cmms.accessToken')==='token-A-refreshed'`),
      'access token refresh',
    )
    assert.equal(await cdp.eval(first, `location.pathname !== '/login'`), true)
    console.log('PASS expired access token refreshes without logout')
    fixture.refreshStatus = 401
    await cdp.eval(first, `localStorage.setItem('cmms.accessToken','token-A')`)
    await cdp.send('Page.reload', {}, first)
    await until(
      () =>
        cdp.eval(
          first,
          `location.pathname==='/login' && localStorage.getItem('cmms.accessToken')===null`,
        ),
      'expired token cleanup',
    )
    console.log(
      'PASS current-token 401 clears both token and protected context',
    )
    assert.equal(
      await cdp.eval(first, "document.querySelector('h1').parentElement.contains(document.querySelector('form')) && !document.querySelector('form').contains(document.querySelector('h1'))"),
      true,
    )
    fixture.status = 200
    await cdp.eval(first, "document.querySelector('input[type=checkbox]').click()")
    await login(first, 'A')
    assert.deepEqual(
      await cdp.eval(first, "JSON.parse(localStorage.getItem('cmms.rememberedLogin'))"),
      { companyId: 'A', userId: 'owner' },
    )
    await cdp.eval(first, "localStorage.removeItem('cmms.accessToken')")
    await cdp.send('Page.navigate', { url: origin + '/login' }, first)
    await until(
      () => cdp.eval(first, "location.pathname==='/login' && document.querySelectorAll('input[required]').length===3"),
      'remembered login screen',
    )
    assert.deepEqual(
      await cdp.eval(first, "[...document.querySelectorAll('input[required]')].map(input => input.value)"),
      ['A', 'owner', ''],
    )
    assert.equal(await cdp.eval(first, "document.querySelector('input[type=checkbox]').checked"), true)
    await cdp.eval(first, "document.querySelector('input[type=checkbox]').click()")
    assert.equal(await cdp.eval(first, "localStorage.getItem('cmms.rememberedLogin')"), null)
    console.log('PASS remembered company/user IDs restore without a password and can be cleared')
    await cdp.send('Browser.close')
    socket.close()
  } finally {
    if (chrome && chrome.exitCode === null) {
      chrome.kill('SIGTERM')
      await Promise.race([once(chrome, 'exit'), wait(3000)])
    }
    await new Promise((resolve) => server.close(resolve))
    await fs.rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    })
  }
}
if (require.main === module) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
