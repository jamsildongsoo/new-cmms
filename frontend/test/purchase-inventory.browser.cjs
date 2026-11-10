/** 실제 Chromium에서 분리된 구매·재고 화면과 API 경계를 검증한다. 서버 응답은 fixture다. */
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const { CDP, until } = require('./auth-session.browser.cjs')
const dist = path.resolve(__dirname, '../dist')
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function main() {
  const profile = await fs.mkdtemp(
    path.join(os.tmpdir(), 'cmms-purchase-browser-'),
  )
  const server = http.createServer(async (req, res) => {
    let file = path.join(dist, new URL(req.url, 'http://localhost').pathname)
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
  const failures = [],
    calls = [],
    saved = {}
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
    const user = {
      companyId: 'TEST',
      userId: 'owner',
      roleId: 'ADMIN',
      siteId: 'S1',
      deptId: 'D1',
      accessScope: 'COMPANY_ALL',
      permissions: [
        'purchase_request',
        'purchase_order',
        'inventory_document',
        'stock_status',
        'stock_ledger',
        'monthly_closing',
      ].flatMap((m) =>
        ['create', 'read', 'update', 'delete'].map((a) => `${m}:${a}`),
      ),
    }
    const baseOptions = {
      materials: [
        { materialId: 'M1', name: '베어링', spec: '6205', baseUnit: 'EA' },
      ],
      sites: [{ value: 'S1', label: '사업장' }],
      departments: [{ value: 'D1', label: '부서' }],
      users: [{ value: 'owner', label: '담당자' }],
      types: [],
    }
    const vendors = ['V1', 'V2'].map((vendorId, i) => ({
      vendorId,
      name: `업체 ${i + 1}`,
      registrationNumber: `REG${i + 1}`,
      phoneNumber: `010${i + 1}`,
      contactName: `담당 ${i + 1}`,
      email: `v${i + 1}@example.com`,
    }))
    const period = { yearMonth: '202611', locked: false, summaryDirty: true }
    const report = () => ({
      period,
      warehouses: [],
      sites: [],
      transits: [],
      draftCount: 0,
      nextMonth: '202612',
    })
    cdp.handlers.push((event) => {
      if (event.method === 'Runtime.exceptionThrown')
        failures.push(event.params.exceptionDetails.text)
      if (event.method === 'Page.javascriptDialogOpening') {
        void cdp.send(
          'Page.handleJavaScriptDialog',
          { accept: true },
          event.sessionId,
        )
        return
      }
      if (event.method !== 'Fetch.requestPaused') return
      void (async () => {
        const data = event.params,
          route = new URL(data.request.url).pathname.replace(/^\/api/, ''),
          method = data.request.method
        let body = []
        if (method !== 'OPTIONS') {
          if (route === '/auth/me') body = user
          else if (route === '/purchase-request/options') body = baseOptions
          else if (route === '/purchase-order/options')
            body = { ...baseOptions, vendors, requests: [] }
          else if (
            /^\/purchase-(request|order)$/.test(route) &&
            method === 'POST'
          ) {
            const payload = JSON.parse(data.request.postData),
              isOrder = route.endsWith('order'),
              id = isOrder ? 'PURORD-202611-00001' : 'PURREQ-202611-00001'
            calls.push({ route, payload })
            body = {
              ...payload,
              companyId: 'TEST',
              [isOrder ? 'orderId' : 'requestId']: id,
              status: 'D',
              createdBy: 'owner',
              createdAt: '2026-11-10',
              updatedBy: null,
              updatedAt: null,
              attachmentId: null,
              items: payload.items.map((i) => ({
                ...i,
                materialName: '베어링',
                spec: '6205',
                baseUnit: 'EA',
                amount: isOrder ? '30' : undefined,
              })),
              ...(isOrder
                ? {
                    vendor: vendors.find(
                      (v) => v.vendorId === payload.vendorId,
                    ),
                    sourceRequestIds: [],
                    allocations: [],
                    totalAmount: '30',
                  }
                : {}),
            }
            saved[`${route}/${id}`] = body
          } else if (saved[route]) body = saved[route]
          else if (route === '/monthly-closing') body = [period]
          else if (route.startsWith('/monthly-closing/')) {
            if (method === 'POST') {
              calls.push({ route })
              period.locked = route.endsWith('/close')
              period.summaryDirty = !period.locked
            }
            body = report()
          } else if (route === '/stock-status')
            body = { warehouses: [], sites: [] }
          else if (route === '/inventory-document/options')
            body = {
              ...baseOptions,
              warehouses: [{ siteId: 'S1', warehouseId: 'W1', name: '창고' }],
              orders: [],
              periods: [period],
              transfers: [],
            }
        }
        await cdp.send(
          'Fetch.fulfillRequest',
          {
            requestId: data.requestId,
            responseCode: method === 'OPTIONS' ? 204 : 200,
            responseHeaders: [
              { name: 'Content-Type', value: 'application/json' },
              { name: 'Access-Control-Allow-Origin', value: origin },
              {
                name: 'Access-Control-Allow-Headers',
                value: 'authorization,content-type,idempotency-key',
              },
              {
                name: 'Access-Control-Allow-Methods',
                value: 'GET,POST,PATCH,DELETE,OPTIONS',
              },
            ],
            body: Buffer.from(JSON.stringify(body)).toString('base64'),
          },
          event.sessionId,
        )
      })().catch((error) => failures.push(String(error)))
    })
    const { targetId } = await cdp.send('Target.createTarget', {
        url: 'about:blank',
      }),
      { sessionId: session } = await cdp.send('Target.attachToTarget', {
        targetId,
        flatten: true,
      })
    await cdp.send('Page.enable', {}, session)
    await cdp.send('Runtime.enable', {}, session)
    await cdp.send(
      'Page.addScriptToEvaluateOnNewDocument',
      { source: "localStorage.setItem('cmms.accessToken','fixture-token')" },
      session,
    )
    await cdp.send(
      'Fetch.enable',
      { patterns: [{ urlPattern: '*api/*' }] },
      session,
    )
    const evalJS = (code) => cdp.eval(session, code)
    const open = async (route, title) => {
      await cdp.send('Page.navigate', { url: origin + route }, session)
      await until(
        () =>
          evalJS(
            `document.body.textContent.includes(${JSON.stringify(title)}) && !document.body.textContent.includes('조회 중...')`,
          ),
        title,
      )
    }
    const click = (label) =>
      evalJS(
        `(()=>{const el=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!el||el.disabled)throw Error('Button unavailable: '+${JSON.stringify(label)});el.click()})()`,
      )
    const fill = (selector, value) =>
      evalJS(
        `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing input');const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))})()`,
      )
    const field = (label, value) =>
      evalJS(
        `(()=>{const el=[...document.querySelectorAll('label')].find(l=>l.querySelector('span')?.textContent.startsWith(${JSON.stringify(label)}))?.querySelector('input,select');if(!el)throw Error('Missing field: '+${JSON.stringify(label)});const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))})()`,
      )
    await open('/purchase-request/new', '구매요청서')
    assert.equal(
      await evalJS(
        "[...document.querySelectorAll('label')].some(l=>l.textContent.startsWith('벤더'))",
      ),
      false,
    )
    await field('요청명', '수량 요청')
    await click('품목 추가')
    await fill('[aria-label="1행 자재"]', 'M1')
    await fill('[aria-label="1행 수량"]', '3')
    await click('저장')
    await until(
      () => calls.some((c) => c.route === '/purchase-request'),
      'request saved',
    )
    const requestPayload = calls.find(
      (c) => c.route === '/purchase-request',
    ).payload
    for (const key of [
      'vendorId',
      'orderDate',
      'expectedDeliveryDate',
      'requestIds',
      'deliveryLocation',
    ])
      assert.equal(key in requestPayload, false, key)
    assert.equal('unitPrice' in requestPayload.items[0], false)
    console.log(
      'PASS purchase request saves only request fields and quantities',
    )
    await open('/purchase-order/new', '구매발주서')
    await field('발주명', '벤더 발주')
    await field('벤더', 'V1')
    assert.equal(
      await evalJS(
        "[...document.querySelectorAll('input')].some(i=>i.value==='업체 1'&&i.readOnly)",
      ),
      true,
    )
    await field('벤더', 'V2')
    assert.equal(
      await evalJS(
        "[...document.querySelectorAll('input')].some(i=>i.value==='업체 2'&&i.readOnly)",
      ),
      true,
    )
    await click('품목 추가')
    await fill('[aria-label="1행 자재"]', 'M1')
    await fill('[aria-label="1행 수량"]', '3')
    await fill('[aria-label="1행 단가"]', '10')
    await click('저장')
    await until(
      () => calls.some((c) => c.route === '/purchase-order'),
      'order saved',
    )
    const orderPayload = calls.find(
      (c) => c.route === '/purchase-order',
    ).payload
    assert.equal(orderPayload.vendorId, 'V2')
    assert.equal(orderPayload.items[0].unitPrice, '10')
    assert.equal(
      Object.keys(orderPayload).some((k) => k.startsWith('supplier')),
      false,
    )
    assert.equal('requestDate' in orderPayload, false)
    console.log(
      'PASS purchase order switches vendor details and saves order pricing without supplier fields',
    )
    await open('/monthly-closing', '재고 월 마감')
    await click('마감')
    await until(
      () => calls.some((c) => c.route.endsWith('/close')),
      'month closed',
    )
    await until(
      () => evalJS("document.body.textContent.includes('마감(Lock)')"),
      'closed month shown',
    )
    console.log(
      'PASS separated monthly closing screen calls monthly closing API',
    )
    await open('/stock-status', '재고 현황')
    await open('/stock-ledger', '재고 수불장')
    await open('/inventory-document/new', '재고전표')
    assert.deepEqual(failures, [])
    console.log(
      'PASS stock reports and inventory transaction screens render without runtime errors',
    )
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
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
