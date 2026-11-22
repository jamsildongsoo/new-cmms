const metadata = require('./support/metadata.cjs')
/** 실제 Chromium에서 분리된 구매·재고 화면과 API 경계를 검증한다. 서버 응답은 fixture다. */
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const { CDP, until } = require('./support/browser.cjs')
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
    inventoryReads = [],
    saved = {}
  let purchaseListFailure = false
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
        'CODE',
        'MATL',
        'PURREQ',
        'PURORD',
        'INVDOC',
        'STOCK',
        'LEDGER',
        'MCLOSE',
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
    const period = { yearMonth: '202611', locked: false }
    const report = () => ({
      period,
      warehouses: [],
      nextMonth: '202612',
    })
    cdp.handlers.push((event) => {
      if (event.method === 'Runtime.exceptionThrown')
        failures.push(event.params.exceptionDetails.text)
      if (event.method === 'Page.javascriptDialogOpening') {
        void cdp.send(
          'Page.handleJavaScriptDialog',
          { accept: true, promptText: '입력 오류 취소' },
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
        if (method === 'GET' && route.startsWith('/inventory-document'))
          inventoryReads.push(route)
        if (method !== 'OPTIONS') {
          if (route === '/system/metadata') body = metadata
          else if (route === '/auth/me') body = user
          else if (route === '/material/options')
            body = {
              types: [{ value: 'PART', label: '부품' }],
              units: [
                { value: 'EA', label: '개' },
                { value: 'KG', label: '킬로그램' },
              ],
            }
          else if (
            (route === '/purchase-request' || route === '/purchase-order') &&
            method === 'GET'
          ) {
            const url = new URL(data.request.url),
              page = Number(url.searchParams.get('page') || 1),
              search = url.searchParams.get('search') || ''
            const rows = Array.from({ length: 21 }, (_, i) => ({
              requestId: `REQ-${i + 1}`,
              orderId: `PO-${i + 1}`,
              documentNo: `관리-${i + 1}`,
              title: `목록 문서 ${i + 1}`,
              requestDate: '20261115',
              orderDate: '20261115',
              status: 'D',
              totalAmount: '10',
            })).filter((r) => `${r.documentNo} ${r.title}`.includes(search))
            body = {
              items: rows.slice((page - 1) * 20, page * 20),
              total: rows.length,
              page,
              limit: 20,
            }
          } else if (route === '/purchase-request/options') body = baseOptions
          else if (route === '/purchase-order/options')
            body = {
              ...baseOptions,
              vendors,
              requests: [
                {
                  requestId: 'PURREQ-1',
                  documentNo: '요청-1',
                  title: '요청에서 가져온 제목',
                },
                {
                  requestId: 'PURREQ-2',
                  documentNo: '',
                  title: '두 번째 요청',
                },
              ],
            }
          else if (route === '/purchase-order/request-preview') {
            const payload = JSON.parse(data.request.postData)
            body = {
              title:
                payload.requestId === 'PURREQ-1'
                  ? '요청에서 가져온 제목'
                  : '두 번째 요청',
              content: '요청 본문',
              note: '요청 비고',
              expectedDeliveryDate: '20261201',
              items: [
                {
                  itemId: crypto.randomUUID(),
                  materialId: 'M1',
                  materialName: '베어링',
                  spec: '6205',
                  baseUnit: 'EA',
                  quantity: '10',
                  note: null,
                  unitPrice: null,
                  amount: null,
                },
              ],
            }
          } else if (/^\/purchase-order\/request\/.+\/orders$/.test(route))
            body = [
              {
                orderId: 'OLD-PO',
                documentNo: '기존발주',
                title: '반려된 발주',
                status: 'R',
                createdAt: '2026-11-01T00:00:00Z',
              },
            ]
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
                spec: i.spec ?? '6205',
                baseUnit: 'EA',
                amount: isOrder ? '30' : undefined,
              })),
              ...(isOrder
                ? {
                    vendor: vendors.find(
                      (v) => v.vendorId === payload.vendorId,
                    ),
                    refModule: payload.refModule ?? null,
                    refId: payload.refId ?? null,
                    totalAmount: '30',
                  }
                : {}),
            }
            saved[`${route}/${id}`] = body
          } else if (route === '/inventory-document' && method === 'POST') {
            const payload = JSON.parse(data.request.postData),
              id = 'INVDOC-202611-00001'
            calls.push({ route, payload })
            body = {
              ...payload,
              inventoryDocumentId: id,
              status: 'C',
              postingSequence: '1',
              createdBy: 'owner',
              createdAt: '2026-11-15T00:00:00Z',
              updatedBy: null,
              updatedAt: null,
              cancelReason: null,
              cancelledBy: null,
              cancelledAt: null,
              items: payload.items.map((i) => ({
                ...i,
                materialName: '베어링',
                spec: '6205',
                baseUnit: 'EA',
                amount: '20',
              })),
            }
            saved[`${route}/${id}`] = body
          } else if (
            route.endsWith('/cancel') &&
            route.startsWith('/inventory-document/')
          ) {
            const payload = JSON.parse(data.request.postData),
              key = route.slice(0, -7)
            calls.push({ route, payload })
            body = {
              ...saved[key],
              status: 'X',
              cancelReason: payload.reason,
              cancelledBy: 'owner',
              cancelledAt: '2026-11-15T01:00:00Z',
            }
            saved[key] = body
          } else if (
            route.endsWith('/confirm') &&
            route.startsWith('/inventory-document/')
          ) {
            const payload = JSON.parse(data.request.postData),
              key = route.slice(0, -8)
            calls.push({ route, payload })
            body = {
              ...saved[key],
              ...payload,
              status: 'C',
              postingSequence: '2',
              confirmedBy: 'owner',
              confirmedAt: '2026-11-15T02:00:00Z',
            }
            saved[key] = body
          } else if (route === '/inventory-document/WAITING') {
            body = saved[route] ??= {
              ...saved['/inventory-document/INVDOC-202611-00001'],
              inventoryDocumentId: 'WAITING',
              title: '수령 대기 검증',
              type: 'IN',
              kind: 'TRANSFER',
              status: 'W',
              warehouseId: 'W2',
              refModule: 'INVDOC',
              refId: 'OUT-1',
              postingSequence: null,
              confirmedBy: null,
              confirmedAt: null,
              cancelledBy: null,
              cancelledAt: null,
              cancelReason: null,
            }
          } else if (saved[route]) body = saved[route]
          else if (route === '/monthly-closing') body = [period]
          else if (route.startsWith('/monthly-closing/')) {
            if (method === 'POST') {
              calls.push({ route })
              period.locked = route.endsWith('/close')
            }
            body = report()
          } else if (route === '/stock-status')
            body = { warehouses: [], sites: [] }
          else if (route === '/inventory-document') {
            const page = Number(
              new URL(data.request.url).searchParams.get('page') || 1,
            )
            body = {
              items: [
                {
                  inventoryDocumentId: `INV-${page}`,
                  documentNo: '',
                  title: `재고 목록 ${page}`,
                  type: 'IN',
                  kind: 'GENERAL',
                  postingDate: '20261115',
                  siteId: 'S1',
                  warehouseId: 'W1',
                  status: 'C',
                },
              ],
              total: 21,
              limit: 20,
              page,
            }
          } else if (route === '/inventory-document/options')
            body = {
              ...baseOptions,
              warehouses: [
                { siteId: 'S1', warehouseId: 'W1', name: '창고' },
                { siteId: 'S1', warehouseId: 'W2', name: '수령 창고' },
              ],
              orders: [],
              periods: [period],
            }
        }
        await cdp.send(
          'Fetch.fulfillRequest',
          {
            requestId: data.requestId,
            responseCode:
              method === 'OPTIONS'
                ? 204
                : purchaseListFailure &&
                    method === 'GET' &&
                    (route === '/purchase-request' ||
                      route === '/purchase-order')
                  ? 500
                  : 200,
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
            `(document.body?.textContent ?? '').includes(${JSON.stringify(title)}) && !(document.body?.textContent ?? '').includes('불러오는 중…')`,
          ).catch(() => false),
        title,
      )
    }
    const click = async (label) => {
      await until(
        () =>
          evalJS(
            `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(label)} && !b.disabled)`,
          ),
        `button ${label}`,
      )
      return evalJS(
        `(()=>{const el=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!el||el.disabled)throw Error('Button unavailable: '+${JSON.stringify(label)});el.click()})()`,
      )
    }
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
        "[...document.querySelectorAll('label')].some(l=>l.textContent.startsWith('거래처'))",
      ),
      false,
    )
    await field('요청명', '수량 요청')
    await click('품목 추가')
    await fill('[aria-label="1행 자재"]', 'M1')
    await fill('[aria-label="1행 수량"]', '3')
    await click('임시저장')
    await until(
      () => calls.some((c) => c.route === '/purchase-request'),
      'request saved',
    )
    const requestPayload = calls.find(
      (c) => c.route === '/purchase-request',
    ).payload
    for (const key of [
      'vendorId',
      'toSiteId',
      'orderDate',
      'expectedDeliveryDate',
      'refModule',
      'refId',
      'deliveryLocation',
    ])
      assert.equal(key in requestPayload, false, key)
    assert.equal('unitPrice' in requestPayload.items[0], false)
    console.log(
      'PASS purchase request saves only request fields and quantities',
    )
    await open('/purchase-order/new', '구매발주서')
    await field('발주명', '거래처 발주')
    await field('거래처', 'V1')
    assert.equal(
      await evalJS(
        "[...document.querySelectorAll('input')].some(i=>i.value==='업체 1'&&i.readOnly)",
      ),
      true,
    )
    await field('거래처', 'V2')
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
    await click('임시저장')
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
    await open('/purchase-order/new', '구매발주서')
    await field('참조 구매요청', 'PURREQ-1')
    await until(
      () =>
        evalJS(
          "document.querySelector('[aria-label=\"1행 수량\"]')?.value==='10'",
        ),
      'request copied',
    )
    assert.equal(
      await evalJS(
        "[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith('발주명')).querySelector('input').value",
      ),
      '요청에서 가져온 제목',
    )
    assert.equal(
      await evalJS(
        'document.querySelector(\'[aria-label="1행 수량"]\').disabled',
      ),
      false,
    )
    await fill('[aria-label="1행 수량"]', '4')
    await fill('[aria-label="1행 규격"]', '발주 수정 규격')
    await click('품목 추가')
    await until(
      () => evalJS('!!document.querySelector(\'[aria-label="2행 자재"]\')'),
      'extra line added',
    )
    await evalJS(
      "[...document.querySelectorAll('tbody tr')][1].querySelector('button').click()",
    )
    await field('참조 구매요청', '')
    assert.equal(
      await evalJS('document.querySelector(\'[aria-label="1행 수량"]\').value'),
      '4',
    )
    await field('참조 구매요청', 'PURREQ-1')
    await until(
      () =>
        evalJS(
          "document.querySelector('[aria-label=\"1행 수량\"]').value==='10'",
        ),
      'request reloaded',
    )
    await fill('[aria-label="1행 수량"]', '4')
    await fill('[aria-label="1행 규격"]', '발주 수정 규격')
    await fill('[aria-label="1행 단가"]', '20')
    await field('거래처', 'V1')
    await until(
      () => evalJS("document.body.textContent.includes('반려된 발주')"),
      'linked history shown',
    )
    await click('임시저장')
    await until(
      () => calls.filter((c) => c.route === '/purchase-order').length === 2,
      'linked order saved',
    )
    const linkedPayload = calls.filter((c) => c.route === '/purchase-order')[1]
      .payload
    assert.equal(linkedPayload.refModule, 'PURREQ')
    assert.equal(linkedPayload.refId, 'PURREQ-1')
    assert.equal(linkedPayload.items[0].quantity, '4')
    assert.equal(linkedPayload.items[0].spec, '발주 수정 규격')
    assert.equal('requestIds' in linkedPayload, false)
    await until(
      () =>
        evalJS(
          "document.querySelector('[aria-label=\"1행 수량\"]')?.value==='4'",
        ),
      'saved copied edits retained',
    )
    console.log(
      'PASS single request copies once, editable items, detach keeps inputs, reload copies and linked history remains visible',
    )
    for (const route of ['/purchase-request', '/purchase-order']) {
      await open(route, route.endsWith('request') ? '구매요청서' : '구매발주서')
      await until(
        () => evalJS("document.body.textContent.includes('총 21건')"),
        'list total',
      )
      assert.equal(
        await evalJS(
          "[...document.querySelectorAll('select[aria-label=상태],input[type=date]')].length",
        ),
        0,
      )
      await click('다음')
      await until(
        () =>
          evalJS(
            "document.body.textContent.includes('2 / 2 페이지') && document.body.textContent.includes('목록 문서 21')",
          ),
        'second page',
      )
      await fill('[aria-label="검색어"]', '관리-21')
      await click('검색')
      await until(
        () =>
          evalJS(
            "document.body.textContent.includes('총 1건') && document.body.textContent.includes('1 / 1 페이지')",
          ),
        'search resets page',
      )
      purchaseListFailure = true
      await click('검색')
      await until(
        () => evalJS("!!document.querySelector('[role=alert]')"),
        'list error',
      )
      assert.equal(
        await evalJS("document.body.textContent.includes('목록 문서 21')"),
        false,
      )
      assert.equal(
        await evalJS(
          "[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='인쇄').disabled",
        ),
        true,
      )
      purchaseListFailure = false
    }
    console.log(
      'PASS purchase lists paginate, reset search page, and hide stale results on failure',
    )
    const beforeList = inventoryReads.length
    await open('/inventory-in', '입고')
    await until(
      () => evalJS("document.body.textContent.includes('재고 목록 1')"),
      'inventory list',
    )
    await click('다음')
    await until(
      () => evalJS("document.body.textContent.includes('재고 목록 2')"),
      'inventory next page',
    )
    assert.deepEqual(inventoryReads.slice(beforeList), [
      '/inventory-document',
      '/inventory-document',
    ])
    assert.equal(
      inventoryReads.slice(beforeList).includes('/inventory-document/options'),
      false,
    )
    assert.equal(
      await evalJS(
        "[...document.querySelectorAll('main button')].some(b => b.textContent.trim() === '입고 대기')",
      ),
      false,
    )
    console.log('PASS inventory menus use paginated lists without pending tabs')
    await open('/monthly-closing', '재고 월 마감')
    await click('마감')
    await until(
      () => calls.some((c) => c.route.endsWith('/close')),
      'month closed',
    )
    await until(
      () => evalJS("document.body.textContent.includes('월 마감')"),
      'closed month shown',
    )
    console.log(
      'PASS separated monthly closing screen calls monthly closing API',
    )
    await open('/stock-status', '재고 현황')
    await open('/stock-ledger', '재고 수불장')
    period.locked = false
    await open('/inventory-in/new', '입고')
    await field('전기일', '2026-11-15')
    await until(
      () =>
        evalJS(
          "[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='확정')?.disabled===false",
        ),
      'open posting month',
    )
    assert.equal(
      await evalJS(
        "[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='저장'||b.textContent.trim()==='임시저장')",
      ),
      false,
    )
    assert.equal(
      await evalJS(
        "[...document.querySelectorAll('main label')].find(l=>l.textContent.startsWith('담당부서')).querySelector('input').readOnly",
      ),
      true,
    )
    await field('전표명', '일반입고 검증')
    await field('수불 유형', 'IN:GENERAL')
    await field('입고 창고', 'W1')
    await click('품목 추가')
    await fill('[aria-label="1행 자재"]', 'M1')
    await fill('[aria-label="1행 수량"]', '2')
    await fill('[aria-label="1행 단가"]', '10')
    await click('확정')
    await until(
      () => calls.some((c) => c.route === '/inventory-document'),
      'atomic inventory created',
    )
    const inventoryPayload = calls.find(
      (c) => c.route === '/inventory-document',
    ).payload
    assert.equal(inventoryPayload.type, 'IN')
    assert.equal(inventoryPayload.kind, 'GENERAL')
    assert.equal('typeCode' in inventoryPayload, false)
    await until(
      () =>
        evalJS(
          "location.pathname.includes('INVDOC-202611-00001') && [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='확정 취소')",
        ),
      'confirmed detail',
    )
    await click('확정 취소')
    await until(
      () => evalJS("document.body.textContent.includes('입력 오류 취소')"),
      'cancellation detail',
    )
    assert.equal(
      calls.find((c) => c.route.endsWith('/cancel')).payload.reason,
      '입력 오류 취소',
    )
    await click('인쇄')
    const printText = await evalJS(
      "[...document.querySelectorAll('iframe')].at(-1).contentDocument.body.textContent",
    )
    assert.ok(
      printText.includes('취소사유') && printText.includes('입력 오류 취소'),
    )
    await open('/inventory-transfer/new', '타창고출고')
    await until(
      () => evalJS("document.body.textContent.includes('수령 창고')"),
      'transfer form',
    )
    assert.equal(
      await evalJS(
        "[...document.querySelectorAll('main label')].find(l=>l.textContent.startsWith('수령 창고')).querySelector('select').required",
      ),
      true,
    )
    await field('수령 창고', JSON.stringify(['S1', 'W2']))
    assert.equal(
      await evalJS(
        "[...document.querySelectorAll('main label')].find(l=>l.textContent.startsWith('수령 사업장')).querySelector('input').value",
      ),
      'S1',
    )
    assert.equal(
      await evalJS(
        "[...document.querySelectorAll('main label')].find(l=>l.textContent.startsWith('수불 유형')).querySelector('select').options.length",
      ),
      1,
    )
    console.log(
      'PASS transfer menu fixes the variant and derives destination site from the required warehouse',
    )

    await open('/inventory-document/WAITING', '수령 대기')
    await field('전기일', '2026-11-16')
    await click('입고 확정')
    await until(
      () => calls.some((c) => c.route.endsWith('/WAITING/confirm')),
      'receipt confirmation',
    )
    await until(
      () =>
        evalJS(
          "[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='확정 취소')",
        ),
      'receipt confirmed',
    )
    assert.equal(saved['/inventory-document/WAITING'].items[0].amount, '20')
    assert.equal(
      calls.find((c) => c.route.endsWith('/WAITING/confirm')).payload
        .postingDate,
      '20261116',
    )
    console.log(
      'PASS waiting receipt confirms the existing document and preserves its amount',
    )

    await open('/material/new', '자재')
    await until(
      () =>
        evalJS(
          "[...document.querySelectorAll('main select')].some(select => [...select.options].some(option => option.value === 'EA' && option.text.includes('개')) && [...select.options].some(option => option.value === 'KG'))",
        ),
      'common UNIT choices loaded',
    )
    console.log('PASS material unit choices come from the common UNIT group')
    await open('/code-items?codeId=UNIT', '공통코드 관리')
    await until(
      () =>
        evalJS(
          "[...document.querySelectorAll('select option')].some(o => o.value === 'EQUIP_TYPE' && o.textContent.includes('설비 유형'))",
        ),
      'metadata code groups',
    )
    await open('/code-items/new?codeId=EQUIP_TYPE', '공통코드 신규 작성')
    assert.equal(
      await evalJS(
        "document.body.textContent.includes('EQUIP_TYPE - 설비 유형')",
      ),
      true,
    )
    assert.equal(
      await evalJS(
        "[...document.querySelectorAll('a')].some(a => a.getAttribute('href') === '/permissions')",
      ),
      false,
    )
    console.log(
      'PASS common code editor uses metadata groups and permission CRUD navigation is absent',
    )
    const originalPermissions = user.permissions
    user.permissions = []
    const readsBeforeDenied = inventoryReads.length
    await open('/inventory-in', '조회 권한이 없습니다.')
    assert.equal(inventoryReads.length, readsBeforeDenied)
    assert.equal(
      await evalJS(
        'document.querySelector(\'nav a[href="/inventory-transfer"]\') !== null && document.querySelector(\'nav a[href="/purchase-order"]\') !== null',
      ),
      true,
    )
    user.permissions = originalPermissions
    console.log(
      'PASS menus remain visible while a denied page makes no inventory requests',
    )
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
