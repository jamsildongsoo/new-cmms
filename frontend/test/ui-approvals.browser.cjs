const metadata = require('./support/metadata.cjs')
/** 실제 Chromium에서 결재선 유형 전환, 문서 메타정보, 한글 UI와 모바일 배치를 검증한다. API는 fixture다. */
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
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'cmms-ui-browser-'))
  const users = [
    {
      userId: 'A',
      userName: '김결재',
      deptId: 'D1',
      deptName: '설비팀',
      title: '팀장',
      position: '',
    },
    {
      userId: 'B',
      userName: '이합의',
      deptId: 'D2',
      deptName: '안전팀',
      title: '',
      position: '대리',
    },
    {
      userId: 'C',
      userName: '박참조',
      deptId: 'D3',
      deptName: '생산팀',
      title: '',
      position: '',
    },
    {
      userId: 'owner',
      userName: '홍작성',
      deptId: 'D1',
      deptName: '설비팀',
      title: '',
      position: '',
    },
  ]
  let actor = 'owner',
    saved,
    listCalls = 0,
    savedPm = null,
    savedEquipment = null,
    listRowsOverride = null,
    createdRole = null,
    failCreatedRolePermissions = true
  const listRequests = []
  const writes = [],
    failures = []
  const context = () => ({
    companyId: 'TEST',
    userId: actor,
    roleId: 'USER',
    siteId: 'S1',
    deptId: 'D1',
    accessScope: 'OWN_DEPARTMENT',
    permissions: [
      ...(actor === 'owner' ? ['LOGHIST:read'] : []),
      'ROLE:read',
      'ROLE:create',
      'ROLE:update',
      'EQUIP:read',
      'EQUIP:create',
      'EQUIP:update',
      'PMAINT:read',
      'PMAINT:create',
      'PMAINT:update',
      'PERMIT:read',
      'PERREQ:read',
      'WRKORD:read',
      'WRKORD:create',
      'WRKORD:update',
      'WRKREQ:read',
      'WRKREQ:create',
      'WRKREQ:update',
    ],
  })
  const makeDocument = (payload, id = 'AP-202611-00001') => ({
    companyId: 'TEST',
    approvalId: id,
    documentNo: payload.documentNo || '',
    title: payload.title,
    contentJson: payload.contentJson,
    submitterId: 'owner',
    status: 'D',
    refModule: payload.refModule || null,
    refId: payload.refId || null,
    attachmentId: null,
    createdAt: '2026-11-13T01:00:00Z',
    createdBy: 'owner',
    updatedAt: null,
    updatedBy: null,
    submittedAt: null,
    completedAt: null,
    steps: [
      { stepNo: 0, type: 'SUBMITTER', userId: 'owner', status: null },
      ...payload.steps.map((step, index) => ({
        ...step,
        stepNo: index + 1,
        status: null,
      })),
    ].map((step) => ({
      ...users.find((user) => user.userId === step.userId),
      ...step,
      approvalId: id,
      actedAt: null,
      comment: null,
    })),
  })
  const permit = makeDocument(
    {
      title: '작업허가 고정 결재선',
      refModule: 'PERMIT',
      refId: 'WP-1',
      contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
      steps: [
        { userId: 'A', type: 'APPROVER' },
        { userId: 'B', type: 'APPROVER' },
      ],
    },
    'AP-PERMIT',
  )
  const contacts = { email: 'owner@example.com', phoneNumber: '010-1111-2222' }
  const profileForActor = () => ({
    ...context(),
    ...users.find((user) => user.userId === actor),
    name: users.find((user) => user.userId === actor)?.userName || actor,
    ...contacts,
    companyName: '테스트회사',
    siteName: '제1사업장',
    roleName: '사용자',
  })
  const historyRows = [
    {
      id: 'h1',
      companyId: 'TEST',
      userId: 'owner',
      success: true,
      failureReason: null,
      ipAddress: '127.0.0.1',
      userAgent: 'fixture browser',
      attemptedAt: '2026-11-14T01:00:00Z',
    },
    {
      id: 'h2',
      companyId: 'TEST',
      userId: 'owner',
      success: false,
      failureReason: 'INVALID_PASSWORD',
      ipAddress: '127.0.0.1',
      userAgent: 'fixture browser',
      attemptedAt: '2026-11-14T00:00:00Z',
    },
  ]
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      const route = url.pathname.replace(/^\/api/, '')
      const json = (body, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(body))
      }
      if (url.pathname.startsWith('/api/')) {
        if (route === '/system/metadata') return json(metadata)
        if (route === '/auth/me') return json(context())
        if (route === '/roles/permission-options')
          return json([
            {
              permissionId: 'EQUIP:create',
              module: 'EQUIP',
              moduleLabel: '설비',
              action: 'create',
              name: '설비 등록',
            },
            {
              permissionId: 'EQUIP:read',
              module: 'EQUIP',
              moduleLabel: '설비',
              action: 'read',
              name: '설비 조회',
            },
            {
              permissionId: 'EQUIP:update',
              module: 'EQUIP',
              moduleLabel: '설비',
              action: 'update',
              name: '설비 수정',
            },
            {
              permissionId: 'LOGHIST:read',
              module: 'LOGHIST',
              moduleLabel: '로그인 이력',
              action: 'read',
              name: '로그인 이력 조회',
            },
          ])
        if (route === '/roles/USER/permissions') {
          if (req.method === 'PUT') {
            const chunks = []
            for await (const chunk of req) chunks.push(chunk)
            const payload = JSON.parse(Buffer.concat(chunks).toString())
            writes.push({ route, payload })
            return json(payload.permissionIds)
          }
          return json(['EQUIP:read', 'EQUIP:update'])
        }
        if (route === '/roles/USER')
          return json({ roleId: 'USER', name: '사용자' })
        if (route === '/roles' && req.method === 'POST') {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const payload = JSON.parse(Buffer.concat(chunks).toString())
          writes.push({ route, payload })
          if (createdRole) return json({ message: 'Role already exists' }, 409)
          createdRole = { roleId: payload.roleId, name: payload.name }
          return json(createdRole)
        }
        if (route === '/roles/NEW/permissions') {
          if (req.method === 'PUT') {
            const chunks = []
            for await (const chunk of req) chunks.push(chunk)
            const payload = JSON.parse(Buffer.concat(chunks).toString())
            writes.push({ route, payload })
            if (failCreatedRolePermissions) {
              failCreatedRolePermissions = false
              return json({ message: '권한 저장 실패' }, 500)
            }
            return json(payload.permissionIds)
          }
          return json([])
        }
        if (route === '/roles/NEW' && createdRole) {
          if (req.method === 'PATCH') {
            const chunks = []
            for await (const chunk of req) chunks.push(chunk)
            const payload = JSON.parse(Buffer.concat(chunks).toString())
            createdRole = { ...createdRole, ...payload }
          }
          return json(createdRole)
        }
        if (route === '/users/me/profile' && req.method === 'GET')
          return json(profileForActor())
        if (route === '/auth/login-history') {
          const items = historyRows.filter(
            (row) =>
              (!url.searchParams.get('result') ||
                row.success ===
                  (url.searchParams.get('result') === 'success')) &&
              (!url.searchParams.get('userId') ||
                row.userId === url.searchParams.get('userId')),
          )
          return json({
            items,
            total: items.length,
            page: Number(url.searchParams.get('page') || 1),
            limit: 20,
          })
        }
        if (route === '/approvals/users')
          return json(
            users.filter((user) => user.userId === url.searchParams.get('q')),
          )
        if (route === '/directory/users') {
          const term = (url.searchParams.get('q') || '').toLowerCase()
          const candidates = [
            ...users,
            { userId: 'owner2', userName: '홍작성', deptId: 'D2', deptName: '안전팀', title: '대리', position: '' },
          ]
          return json(candidates.filter((user) =>
            [user.userId, user.userName].some((value) => value.toLowerCase().includes(term)),
          ).slice(0, 10))
        }
        if (route.startsWith('/approvals/users/'))
          return json(
            users.find((user) => user.userId === route.split('/').at(-1)),
          )
        if (route === '/boards' && req.method === 'GET') {
          if (url.searchParams.get('search') === '실패검색')
            return json({ message: '게시판 조회 실패' }, 500)
          return json({
            items: [
              {
                boardId: 'BORD-202611-00001',
                title: '게시판 이전 결과',
                createdBy: 'owner',
                createdAt: '2026-11-15T01:00:00Z',
              },
            ],
            total: 1,
            page: 1,
            limit: 20,
          })
        }
        if (route.startsWith('/approvals/boxes/')) {
          listCalls++
          listRequests.push(Object.fromEntries(url.searchParams))
          const search = (url.searchParams.get('search') || '').toLowerCase()
          const searchType = url.searchParams.get('searchType') || 'title'
          const rows = (listRowsOverride ?? (saved ? [saved] : [])).filter(
            (row) =>
              String(row[searchType]).toLowerCase().includes(search),
          )
          const page = Number(url.searchParams.get('page') || 1),
            limit = Number(url.searchParams.get('limit') || 20)
          return json({
            items: rows
              .slice((page - 1) * limit, page * limit)
              .map(
                ({
                  approvalId,
                  documentNo,
                  title,
                  submitterId,
                  status,
                  createdAt,
                }) => ({
                  approvalId,
                  documentNo,
                  title,
                  submitterId,
                  status,
                  createdAt,
                }),
              ),
            page,
            limit,
            total: rows.length,
          })
        }
        if (route === '/equipment/options')
          return json({
            sites: [{ value: 'S1', label: '제1사업장' }],
            departments: [{ value: 'D1', label: '설비팀' }],
            types: [{ value: 'PUMP', label: '펌프' }],
          })
        if (route === '/equipment' && req.method === 'GET')
          return json({ items: savedEquipment ? [savedEquipment] : [], total: savedEquipment ? 1 : 0, page: 1, limit: 20 })
        if (route === '/equipment/tree')
          return json(savedEquipment ? [savedEquipment] : [])
        if (route === '/equipment/EQ-FORM' && req.method === 'GET')
          return json(savedEquipment)
        if (route === '/preventive-maintenance' && req.method === 'GET') {
          const search = (url.searchParams.get('search') || '').toLowerCase(),
            searchType = url.searchParams.get('searchType'),
            page = Number(url.searchParams.get('page') || 1)
          const rows = Array.from({ length: 21 }, (_, index) => ({
            ...savedPm,
            pmId: `PM-LIST-${index + 1}`,
            title: `목록 점검 ${index + 1}`,
          })).filter((row) =>
            (searchType ? [row[searchType]] : [row.pmId, row.documentNo, row.title, row.equipmentId]).some(
              (value) => String(value).toLowerCase().includes(search),
            ),
          )
          return json({
            items: rows.slice((page - 1) * 20, page * 20),
            page,
            limit: 20,
            total: rows.length,
          })
        }
        if (route === '/preventive-maintenance/options')
          return json({
            sites: [{ value: 'S1', label: '서울사업장' }],
            departments: [
              { value: 'D1', label: '설비팀' },
              { value: 'D2', label: '안전팀' },
            ],
            users: [{ value: 'owner', label: '홍작성' }],
            equipment: [
              {
                equipmentId: 'EQ1',
                name: '펌프',
                inspectionPeriod: 1,
                inspectionUnit: 'MONTH',
              },
            ],
            types: [],
            units: [],
          })
        if (route === '/preventive-maintenance/PMAINT-202611-00001')
          return json(savedPm)
        if (
          (route === '/work-permit' || route === '/work-permit-request') &&
          req.method === 'GET'
        ) {
          const request = route === '/work-permit-request',
            page = Number(url.searchParams.get('page') || 1),
            search = (url.searchParams.get('search') || '').toLowerCase()
          const rows = Array.from({ length: 21 }, (_, index) => ({
            workPermitId: `PERMIT-${index + 1}`,
            workPermitRequestId: `PERREQ-${index + 1}`,
            documentNo: `관리-${index + 1}`,
            title: `허가 문서 ${index + 1}`,
            applicantName: '신청인',
            status: 'D',
          })).filter((row) =>
            [
              request ? row.workPermitRequestId : row.workPermitId,
              row.documentNo,
              row.title,
            ].some((value) => value.toLowerCase().includes(search)),
          )
          return json({
            items: rows.slice((page - 1) * 20, page * 20),
            total: rows.length,
            page,
            limit: 20,
          })
        }
        if (route === '/work-permit/options')
          return json({
            sites: [{ value: 'S1', label: '서울사업장' }],
            departments: [{ value: 'D1', label: '설비팀' }],
            names: { GENERAL: '일반' },
            templates: [],
            documents: [],
            users: [{ value: 'A', label: '김결재' }],
          })
        if (route === '/work-permit-request/options')
          return json({
            sites: [{ value: 'S1', label: '서울사업장' }],
            departments: [{ value: 'D1', label: '설비팀' }],
          })
        if (
          route === '/work-permit/PERMIT-HISTORY' ||
          route === '/work-permit-request/PERREQ-PRINT'
        )
          return json({
            workPermitId: 'PERMIT-HISTORY',
            workPermitRequestId: 'PERREQ-PRINT',
            documentNo: '관리번호',
            data: {
              title: '이력 허가',
              applicationDate: '20261115',
              applicantType: 'INTERNAL',
              applicantName: '신청인',
              organization: '소속',
              phoneNumber: '010-1111',
              workType: 'INTERNAL',
              location: '현장',
              equipmentNo: '자유입력',
              equipmentName: '임시 설비',
              startTime: '20261115:09',
              endTime: '20261115:18',
              summary: '작업개요',
            },
            createdBy: 'owner',
            createdAt: '2026-11-15T00:00:00Z',
            status: 'C',
            attachmentId: null,
            refModule: null,
            refId: null,
            sections: [],
            permitTypes: ['GENERAL'],
            documentFiles: [],
            issuerId: 'OLD',
            issuerName: null,
            approverId: 'A',
            approverName: '김결재',
          })
        if (
          (route === '/work-request' || route === '/work-order') &&
          req.method === 'GET'
        ) {
          const isOrder = route === '/work-order',
            search = (url.searchParams.get('search') || '').toLowerCase(),
            page = Number(url.searchParams.get('page') || 1)
          const rows = Array.from({ length: 21 }, (_, index) => ({
            workRequestId: `WRKREQ-${index + 1}`,
            workOrderId: `WRKORD-${index + 1}`,
            documentNo: `관리-${index + 1}`,
            title: `검색 문서 ${index + 1}`,
            equipmentId: 'EQ1',
            occurredDate: '20261115',
            workDate: '20261115',
            orderKind: 'PLAN',
            totalCost: 10,
            priorityCode: '중',
            status: 'D',
          })).filter((row) =>
            [
              isOrder ? row.workOrderId : row.workRequestId,
              row.documentNo,
              row.title,
              row.equipmentId,
            ].some((value) => value.toLowerCase().includes(search)),
          )
          return json({
            items: rows.slice((page - 1) * 20, page * 20),
            total: rows.length,
            page,
            limit: 20,
          })
        }
        if (route === '/work-request/WRKREQ-EDIT/plans') return json([])
        if (route === '/work-request/WRKREQ-EDIT')
          return json({
            workRequestId: 'WRKREQ-EDIT',
            title: '저장된 의뢰명',
            documentNo: '',
            equipmentId: 'EQ1',
            occurredDate: '20261115',
            content: '저장 본문',
            priorityCode: '중',
            attachmentId: null,
            note: '',
            status: 'D',
            createdBy: 'owner',
            createdAt: '2026-11-15T00:00:00Z',
            siteId: 'S1',
            deptId: 'D1',
          })
        if (route === '/work-request/options')
          return json({
            sites: [{ value: 'S1', label: '서울사업장' }],
            departments: [{ value: 'D1', label: '설비팀' }],
            users: [{ value: 'owner', label: '홍작성' }],
            equipment: [],
            siteId: 'S1',
            deptId: 'D1',
          })
        if (route === '/approvals/AP-PERMIT') return json(permit)
        if (req.method === 'POST' || req.method === 'PATCH') {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const payload = JSON.parse(Buffer.concat(chunks).toString() || '{}')
          writes.push({ route, payload })
          if (route === '/equipment') {
            savedEquipment = {
              ...payload,
              companyId: 'TEST',
              createdBy: 'owner',
              createdAt: '2026-11-15T01:00:00Z',
              updatedBy: null,
              updatedAt: null,
              deleteYn: 'N',
            }
            return json(savedEquipment, 201)
          }
          if (route === '/preventive-maintenance') {
            savedPm = {
              ...payload,
              companyId: 'TEST',
              pmId: 'PMAINT-202611-00001',
              siteId: 'S1',
              deptName: '안전팀',
              requesterId: 'owner',
              createdBy: 'owner',
              status: 'D',
              deleteYn: 'N',
              createdAt: '2026-11-14T01:00:00Z',
            }
            return json(savedPm)
          }
          if (route === '/users/me/profile') {
            Object.assign(contacts, payload)
            return json(profileForActor())
          }
          if (route === '/users/me/password') {
            if (payload.currentPassword !== 'test-password')
              return json(
                { message: '현재 비밀번호가 일치하지 않습니다.' },
                400,
              )
            return json({
              message: '비밀번호를 변경했습니다. 다시 로그인해 주세요.',
            })
          }
          if (route === '/approvals') {
            saved = makeDocument(payload)
            return json(saved, 201)
          }
          if (route.endsWith('/submit')) {
            saved.status = 'P'
            saved.submittedAt = '2026-11-13T02:00:00Z'
            saved.steps
              .filter((step) => ['SUBMITTER', 'REFERENCE'].includes(step.type))
              .forEach((step) => {
                step.status = 'Y'
              })
            return json(saved)
          }
          if (route.endsWith('/approve')) {
            const step = saved.steps.find(
              (step) =>
                ['APPROVER', 'AGREE'].includes(step.type) && !step.status,
            )
            step.status = 'Y'
            step.comment = payload.comment
            step.actedAt = '2026-11-13T03:00:00Z'
            if (
              !saved.steps.some(
                (step) =>
                  ['APPROVER', 'AGREE'].includes(step.type) && !step.status,
              )
            ) {
              saved.status = 'C'
              saved.completedAt = step.actedAt
            }
            return json(
              saved.status === 'C'
                ? {
                    ...saved,
                    sourceSyncWarning:
                      '결재 처리는 완료되었으나 원문 상태 반영에 실패했습니다. 관리자에게 문의해 주세요.',
                  }
                : saved,
            )
          }
          if (req.method === 'PATCH') {
            saved = makeDocument(payload)
            return json(saved)
          }
        }
        if (route === '/approvals/AP-202611-00001') return json(saved)
        return json({ message: 'Unexpected fixture route' }, 404)
      }
      let file = path.resolve(dist, '.' + url.pathname)
      if (!file.startsWith(dist + path.sep))
        file = path.join(dist, 'index.html')
      try {
        if (!(await fs.stat(file)).isFile())
          file = path.join(dist, 'index.html')
      } catch {
        file = path.join(dist, 'index.html')
      }
      res.setHeader(
        'Content-Type',
        {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
        }[path.extname(file)] || 'application/octet-stream',
      )
      res.end(await fs.readFile(file))
    } catch (error) {
      failures.push(error.message)
      res.writeHead(500)
      res.end()
    }
  })
  let chrome, cdp, socket
  try {
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const origin = `http://127.0.0.1:${server.address().port}`
    chrome = spawn(
      process.env.CHROME_PATH || '/opt/google/chrome/chrome',
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
    socket = new WebSocket(`ws://127.0.0.1:${endpoint[0]}${endpoint[1]}`)
    await once(socket, 'open')
    cdp = new CDP(socket)
    const { targetId } = await cdp.send('Target.createTarget', {
      url: 'about:blank',
    })
    const { sessionId } = await cdp.send('Target.attachToTarget', {
      targetId,
      flatten: true,
    })
    await cdp.send('Page.enable', {}, sessionId)
    await cdp.send('Runtime.enable', {}, sessionId)
    cdp.handlers.push((event) => {
      if (event.method === 'Runtime.exceptionThrown')
        failures.push(
          event.params.exceptionDetails.exception?.description ||
            event.params.exceptionDetails.text,
        )
      if (event.method === 'Page.javascriptDialogOpening')
        void cdp.send(
          'Page.handleJavaScriptDialog',
          { accept: true },
          sessionId,
        )
    })
    await cdp.send(
      'Page.addScriptToEvaluateOnNewDocument',
      { source: "localStorage.setItem('cmms.accessToken','fixture-token')" },
      sessionId,
    )
    const evaluate = (expression) => cdp.eval(sessionId, expression)
    const navigate = async (route, expected) => {
      await cdp.send('Page.navigate', { url: origin + route }, sessionId)
      await until(
        () =>
          evaluate(
            `location.pathname === ${JSON.stringify(new URL(origin + route).pathname)} && (document.body?.textContent ?? '').includes(${JSON.stringify(expected)})`,
          ).catch(() => false),
        expected,
      )
    }
    const click = (label) =>
      evaluate(
        `(() => {const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}); if(!button)throw Error('Missing button '+${JSON.stringify(label)}); button.click()})()`,
      )
    const input = (selector, value, select = false) =>
      evaluate(
        `(() => {const element=document.querySelector(${JSON.stringify(selector)}); if(!element)throw Error('Missing input'); Object.getOwnPropertyDescriptor(${select ? 'HTMLSelectElement' : 'HTMLInputElement'}.prototype,'value').set.call(element,${JSON.stringify(value)}); element.dispatchEvent(new Event(${select ? "'change'" : "'input'"},{bubbles:true}))})()`,
      )
    const types = () =>
      evaluate(
        "[...document.querySelectorAll('tbody tr')].map(row=>({name:row.children[1].textContent,type:row.querySelector('select')?.value,no:row.children[0].textContent.trim()}))",
      )
    const add = async (id) => {
      await input('input[role="combobox"]', id)
      await until(
        () =>
          evaluate(
            `document.querySelector('[role="option"]')?.textContent.includes('(${id})')`,
          ),
        `search ${id}`,
      )
      await evaluate(
        "document.querySelector('[role=option]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}))",
      )
      await until(
        async () => (await types()).some((row) => row.name.includes(`(${id})`)),
        `add ${id}`,
      )
    }
    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false },
      sessionId,
    )
    await navigate('/approvals/new', '결재 작성')
    await until(
      () =>
        evaluate(
          "document.querySelector('header summary')?.textContent.includes('홍작성')",
        ),
      'user display name',
    )
    assert.deepEqual(
      await evaluate(
        "[...document.querySelector('#approval-form > div.grid.grid-cols-12').children].map(e=>e.className.includes('col-span-6'))",
      ),
      [true, true],
    )
    assert.equal(
      await evaluate(
        "document.querySelector('#approval-form > div.grid.grid-cols-12 > div > div').classList.contains('grid-cols-2')",
      ),
      true,
    )
    assert.equal(
      await evaluate(
        "getComputedStyle(document.querySelector('input[required]')).fontSize",
      ),
      '12px',
    )
    assert.equal(
      await evaluate(
        "getComputedStyle(document.querySelector('label:has(input[required]) span')).fontSize",
      ),
      '14px',
    )
    assert.equal(
      await evaluate("getComputedStyle(document.querySelector('h1')).fontSize"),
      '18px',
    )
    assert.deepEqual(
      await evaluate(
        "[...document.querySelector('section .page-actions').querySelectorAll('button')].map(b=>b.textContent.trim())",
      ),
      ['목록', '인쇄', '임시저장', '상신'],
    )
    await input('input[required]', '냉각수 펌프 보수 시행 요청')
    await input('input[aria-label="관리번호"]', '설비팀-2026-015')
    await add('A')
    await add('C')
    await input('select[aria-label="박참조 유형"]', 'REFERENCE', true)
    await add('B')
    await input('select[aria-label="이합의 유형"]', 'AGREE', true)
    assert.deepEqual(
      (await types()).map(({ type, no }) => [type, no]),
      [
        ['APPROVER', '1'],
        ['AGREE', '2'],
        ['REFERENCE', '—'],
      ],
    )
    await input('select[aria-label="김결재 유형"]', 'REFERENCE', true)
    assert.deepEqual(
      (await types()).map(({ type, no }) => [type, no]),
      [
        ['AGREE', '1'],
        ['REFERENCE', '—'],
        ['REFERENCE', '—'],
      ],
    )
    await input('select[aria-label="이합의 유형"]', 'REFERENCE', true)
    await click('임시저장')
    assert.equal(writes.length, 0)
    assert.equal(
      await evaluate(
        "document.body.textContent.includes('결재자 또는 합의자를 한 명 이상 추가해 주세요.')",
      ),
      true,
    )
    await input('select[aria-label="이합의 유형"]', 'AGREE', true)
    await input('select[aria-label="김결재 유형"]', 'APPROVER', true)
    await evaluate(
      "document.querySelector('button[aria-label=" +
        JSON.stringify('김결재 위로 이동') +
        "]').click()",
    )
    assert.deepEqual(
      (await types()).map(({ type, no }) => [type, no]),
      [
        ['APPROVER', '1'],
        ['AGREE', '2'],
        ['REFERENCE', '—'],
      ],
    )
    await input('input[role="combobox"]', 'A')
    await wait(350)
    assert.equal(
      await evaluate("document.querySelectorAll('[role=option]').length"),
      0,
    )
    await input('input[role="combobox"]', '')
    await click('임시저장')
    await until(
      () =>
        evaluate(
          "location.pathname==='/approvals/AP-202611-00001' && document.querySelector('h1')?.textContent==='결재 수정'",
        ),
      'draft saved',
    )
    assert.deepEqual(writes[0].payload.steps, [
      { type: 'APPROVER', userId: 'A' },
      { type: 'AGREE', userId: 'B' },
      { type: 'REFERENCE', userId: 'C' },
    ])
    assert.equal(writes[0].payload.documentNo, '설비팀-2026-015')
    console.log(
      'PASS unified approval line reorders references, preserves processing order, prevents duplicates and saves the existing API payload',
    )
    await click('상신')
    await until(
      () =>
        evaluate(
          "document.querySelector('h1')?.textContent.includes('결재 중')",
        ),
      'submitted view',
    )
    assert.equal(
      await evaluate(
        "document.querySelectorAll('input[aria-label=관리번호]').length",
      ),
      0,
    )
    assert.equal(
      await evaluate(
        "document.querySelector('tbody tr:last-child td').textContent",
      ),
      '—',
    )
    actor = 'A'
    await navigate('/approvals/AP-202611-00001', '결재 의견')
    await click('승인')
    await until(
      () => saved.steps.find((s) => s.userId === 'A').status === 'Y',
      'approved A',
    )
    actor = 'B'
    await navigate('/approvals/AP-202611-00001', '결재 의견')
    assert.equal(
      await evaluate(
        "[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='동의')",
      ),
      true,
    )
    await click('동의')
    await until(() => saved.status === 'C', 'agreed B')
    await until(
      () =>
        evaluate(
          "document.body.textContent.includes('원문 상태 반영에 실패했습니다.')",
        ),
      'committed approval warning',
    )
    assert.equal(
      await evaluate(
        "[...document.querySelectorAll('button')].some(button => ['승인','동의'].includes(button.textContent.trim()))",
      ),
      false,
    )
    await until(
      () =>
        evaluate("document.querySelector('h1')?.textContent.includes('완결')"),
      'completed view',
    )
    assert.equal(writes.at(-1).route, '/approvals/AP-202611-00001/approve')
    console.log(
      'PASS approval view shows reference dashes and agreement actions use the unchanged approval API',
    )
    actor = 'owner'
    await navigate('/approvals/AP-PERMIT', '결재선')
    assert.equal(
      await evaluate(
        "document.querySelectorAll('tbody select:disabled').length",
      ),
      0,
    )
    await add('C')
    await input('select[aria-label="박참조 유형"]', 'REFERENCE', true)
    assert.deepEqual(
      (await types()).map(({ type, no }) => [type, no]),
      [
        ['APPROVER', '1'],
        ['APPROVER', '2'],
        ['REFERENCE', '—'],
      ],
    )
    console.log(
      'PASS work-permit approval line is editable independently of issuer/approver fields',
    )
    await navigate('/approvals?box=submit', '검색 결과 1건')
    const listScreenshot = await cdp.send(
      'Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: true },
      sessionId,
    )
    await fs.writeFile(
      '/tmp/cmms-approval-list.png',
      Buffer.from(listScreenshot.data, 'base64'),
    )
    const count = listCalls
    await click('상신함')
    await wait(100)
    assert.equal(listCalls, count)
    await input(
      'input[placeholder="검색어 입력"]',
      '설비팀-2026-015',
    )
    await input('form select', 'documentNo', true)
    await click('검색')
    await until(
      () => evaluate("document.body.textContent.includes('검색 결과 1건')"),
      'server search result',
    )
    assert.ok(listCalls > count)
    assert.equal(listRequests.at(-1).searchType, 'documentNo')
    assert.equal('status' in listRequests.at(-1), false)
    assert.equal(
      await evaluate(
        "[...document.querySelectorAll('section button')].some(button => button.textContent.trim() === '인쇄')",
      ),
      false,
    )
    await input(
      'input[placeholder="검색어 입력"]',
      '없는번호',
    )
    await click('검색')
    await until(
      () => evaluate("document.body.textContent.includes('검색 결과 0건')"),
      'filtered empty',
    )
    await click('초기화')
    await until(
      () => evaluate("document.body.textContent.includes('검색 결과 1건')"),
      'filter reset',
    )
    await input('form select', 'submitterId', true)
    await input('input[aria-label="작성자 검색"]', '홍작')
    await until(
      () => evaluate("document.querySelectorAll('[role=listbox] [role=option]').length === 2"),
      'same-name author candidates',
    )
    assert.equal(
      await evaluate("document.querySelector('[role=listbox]').textContent.includes('안전팀')"),
      true,
    )
    await evaluate("document.querySelector('[role=listbox] [role=option]').click()")
    assert.equal(await evaluate("document.querySelector('input[role=combobox]').value"), 'owner')
    await click('검색')
    await until(() => listRequests.at(-1).searchType === 'submitterId', 'author search request')
    assert.equal(listRequests.at(-1).search, 'owner')
    await until(() => evaluate("document.body.textContent.includes('검색 결과 1건')"), 'author search result')
    const authorRequests = listRequests.length
    await input('input[aria-label="작성자 검색"]', 'owner')
    await click('검색')
    await until(() => listRequests.length > authorRequests, 'direct author ID search')
    assert.equal(listRequests.at(-1).search, 'owner')
    await click('초기화')
    assert.equal(
      await evaluate(
        "[...document.querySelectorAll('[role=columnheader]')].filter(c=>c.textContent.includes('번호')).length",
      ),
      1,
    )
    await evaluate("document.querySelector('header summary').click()")
    await click('내 정보 수정')
    await until(
      () => evaluate("Boolean(document.querySelector('dialog[open]'))"),
      'account panel open',
    )
    assert.equal(await evaluate("document.querySelector('dialog').open"), true)
    await click('취소')
    assert.equal(
      await evaluate("Boolean(document.querySelector('dialog[open]'))"),
      false,
    )
    listRowsOverride = Array.from({ length: 21 }, (_, index) => ({
      ...saved,
      approvalId: `PAGE-${index + 1}`,
      title: `페이지 문서 ${index + 1}`,
    }))
    await navigate('/approvals?box=submit', '검색 결과 21건')
    assert.equal(
      await evaluate(
        "document.querySelectorAll('[role=table] [role=row]').length - 1",
      ),
      20,
    )
    await click('다음')
    await until(
      () =>
        evaluate(
          "document.body.textContent.includes('2 / 2 페이지') && document.body.textContent.includes('페이지 문서 21')",
        ),
      'second server page',
    )
    assert.equal(listRequests.at(-1).page, '2')
    await click('종결함')
    await until(() => listRequests.at(-1).page === '1', 'box resets page')
    listRowsOverride = null
    console.log(
      'PASS document number search/reset, combined number column and user information panel',
    )
    await navigate('/equipment/new', '설비 마스터')
    await until(
      () =>
        evaluate(
          "document.querySelector('main input[required]:not(:disabled)') !== null",
        ),
      'equipment options ready',
    )
    const fieldSelector = (label) =>
      `(() => { const label = [...document.querySelectorAll('main label')].find(el => el.querySelector(':scope > span')?.textContent.replaceAll('*','').trim() === ${JSON.stringify(label)}); if (!label) throw Error('Missing equipment field'); return label.querySelector('input,select') })()`
    const setEquipmentField = async (label, value) => {
      await evaluate(
        `(() => { const el = ${fieldSelector(label)}; const isSelect = el.tagName === 'SELECT'; Object.getOwnPropertyDescriptor(isSelect ? HTMLSelectElement.prototype : HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event(isSelect ? 'change' : 'input',{bubbles:true})) })()`,
      )
    }
    assert.equal(await evaluate(`${fieldSelector('점검일')}.type`), 'date')
    assert.equal(await evaluate(`${fieldSelector('법정점검일')}.type`), 'date')
    assert.equal(await evaluate(`${fieldSelector('점검 주기')}.type`), 'number')
    assert.equal(
      await evaluate(`${fieldSelector('법정점검 주기')}.type`),
      'number',
    )
    assert.equal(
      await evaluate(`${fieldSelector('점검 주기 단위')}.tagName`),
      'SELECT',
    )
    assert.equal(
      await evaluate(`${fieldSelector('법정점검 주기 단위')}.tagName`),
      'SELECT',
    )
    await setEquipmentField('설비번호', 'EQ-FORM')
    await setEquipmentField('설비명', '입력 검증 설비')
    await setEquipmentField('사업장', 'S1')
    await setEquipmentField('담당 부서', 'D1')
    await setEquipmentField('설비 유형', 'PUMP')
    await setEquipmentField('점검 주기', '1')
    await setEquipmentField('점검 주기 단위', 'MONTH')
    await setEquipmentField('점검일', '2026-11-15')
    await setEquipmentField('다음 점검일', '2026-12-15')
    await setEquipmentField('법정점검 주기', '2')
    await setEquipmentField('법정점검 주기 단위', 'YEAR')
    await setEquipmentField('법정점검일', '2026-11-15')
    await setEquipmentField('다음 법정점검일', '2028-11-15')
    await click('저장')
    await until(
      () => evaluate("location.pathname === '/equipment/EQ-FORM'"),
      'equipment saved',
    )
    assert.deepEqual(
      [
        savedEquipment.inspectionDate,
        savedEquipment.inspectionPeriod,
        savedEquipment.inspectionUnit,
        savedEquipment.nextInspectionDate,
      ],
      ['20261115', 1, 'MONTH', '20261215'],
    )
    assert.deepEqual(
      [
        savedEquipment.legalInspectionDate,
        savedEquipment.legalInspectionPeriod,
        savedEquipment.legalInspectionUnit,
      ],
      ['20261115', 2, 'YEAR'],
    )
    await until(
      () => evaluate(`${fieldSelector('점검일')}.value === '2026-11-15'`),
      'saved date restored',
    )
    console.log(
      'PASS equipment dates, integer cycles and fixed unit selections save canonical API values',
    )
    await navigate('/equipment', '설비 마스터')
    assert.deepEqual(
      await evaluate("[...document.querySelectorAll('[role=columnheader]')].map(node => node.textContent.trim())"),
      ['설비번호', '설비명', '설비유형', '사업장', '담당부서', '제조사', '모델', '설치일', '점검일', '다음점검일'],
    )
    assert.equal(await evaluate("[...document.querySelectorAll('main button')].some(button => button.textContent.trim()==='트리')"), false)
    assert.equal(await evaluate("document.querySelector('select[aria-label=\"사업장 필터\"]') !== null"), true)
    console.log('PASS equipment list uses the requested columns and no tree view')
    await navigate('/preventive-maintenance/new', '예방점검')
    await until(
      () =>
        evaluate(
          "Boolean(document.querySelector('main select[required]:not(:disabled)'))",
        ),
      'PM options loaded',
    )
    assert.equal(
      await evaluate(`${fieldSelector('점검일')}.value`),
      await evaluate(
        "new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())",
      ),
    )
    assert.equal(await evaluate(`${fieldSelector('점검일')}.required`), true)
    await input('main input[required]', '예방점검 범위 확인')
    await input('main select[required]', 'EQ1', true)
    assert.deepEqual(
      await evaluate(
        '[...document.querySelectorAll(\'input[aria-label^="설비 점검 주기"]\')].map(input => [input.value,input.readOnly])',
      ),
      [
        ['1', true],
        ['월', true],
      ],
    )
    await setEquipmentField('점검일', '2026-11-15')
    assert.equal(
      await evaluate(`${fieldSelector('다음 점검일')}.value`),
      '2026-12-15',
    )
    await setEquipmentField('다음 점검일', '2026-12-20')

    assert.equal(
      await evaluate(
        "[...document.querySelectorAll('main label')].find(label=>label.textContent.startsWith('점검부서')).querySelector('select').disabled",
      ),
      true,
    )
    await click('임시저장')
    await until(
      () =>
        evaluate(
          "location.pathname === '/preventive-maintenance/PMAINT-202611-00001'",
        ),
      'PM saved',
    )
    const pmPayload = writes.find(
      (write) => write.route === '/preventive-maintenance',
    ).payload
    assert.equal(pmPayload.deptId, 'D1')
    assert.equal('inspectionDeptId' in pmPayload, false)
    assert.equal('siteId' in pmPayload, false)
    console.log(
      'PASS preventive-maintenance uses deptId, uses the read-only login department and leaves site assignment to the backend',
    )
    assert.equal(savedPm.inspectionDate, '20261115')
    assert.equal(savedPm.nextInspectionDate, '20261220')
    assert.equal('inspectionPeriod' in savedPm, false)
    assert.equal('inspectionUnit' in savedPm, false)
    await navigate('/preventive-maintenance', '총 21건')
    assert.equal(
      await evaluate(
        "document.querySelectorAll('main select,main input[type=date]').length",
      ),
      1,
    )
    await click('다음')
    await until(
      () =>
        evaluate(
          "document.body.textContent.includes('2 / 2 페이지') && document.body.textContent.includes('목록 점검 21')",
        ),
      'PM second page',
    )
    await input('select[aria-label="예방점검 검색 기준"]', 'pmId', true)
    await input('input[aria-label="예방점검 검색"]', 'PM-LIST-21')
    await click('검색')
    await until(
      () =>
        evaluate(
          "document.body.textContent.includes('총 1건') && document.body.textContent.includes('1 / 1 페이지')",
        ),
      'PM keyword search resets page',
    )
    console.log(
      'PASS PM default required date, read-only equipment cycle, manual next-date override and server pagination/search',
    )
    for (const route of ['/work-request', '/work-order']) {
      await navigate(route, '총 21건')
      assert.equal(
        await evaluate(
          "document.querySelectorAll('main select,main input[type=date]').length",
        ),
        0,
      )
      assert.equal(
        await evaluate(
          "[...document.querySelectorAll('[role=columnheader]')].some(el => el.textContent === '문서번호')",
        ),
        true,
      )
      assert.equal(
        await evaluate(
          "[...document.querySelectorAll('[role=columnheader]')].some(el => el.textContent === '관리번호')",
        ),
        true,
      )
      await click('다음')
      await until(
        () => evaluate("document.body.textContent.includes('2 / 2 페이지')"),
        'work second page',
      )
      await input(
        'input[aria-label="검색어"]',
        route === '/work-order' ? 'WRKORD-21' : 'WRKREQ-21',
      )
      await click('검색')
      await until(
        () =>
          evaluate(
            "document.body.textContent.includes('총 1건') && document.body.textContent.includes('1 / 1 페이지')",
          ),
        'work ID search',
      )
    }
    for (const route of ['/work-permit-request', '/work-permit']) {
      await navigate(route, '총 21건')
      assert.equal(
        await evaluate(
          'document.querySelector(\'input[aria-label="허가 문서 검색"]\').placeholder',
        ),
        '문서번호·관리번호·작업명',
      )
      await click('다음')
      await until(
        () => evaluate("document.body.textContent.includes('2 / 2 페이지')"),
        'permit second page',
      )
      await input(
        'input[aria-label="허가 문서 검색"]',
        route === '/work-permit' ? 'PERMIT-21' : 'PERREQ-21',
      )
      await click('검색')
      await until(
        () =>
          evaluate(
            "document.body.textContent.includes('총 1건') && document.body.textContent.includes('1 / 1 페이지')",
          ),
        'permit search resets page',
      )
    }
    await navigate('/work-permit/PERMIT-HISTORY', '작업 허가서')
    await until(
      () =>
        evaluate(
          "[...document.querySelectorAll('select option')].some(option=>option.value==='A')",
        ),
      'active permit users loaded',
    )
    assert.equal(
      await evaluate(
        "[...document.querySelectorAll('select option')].some(option => option.value === 'OLD')",
      ),
      false,
    )
    await navigate('/work-permit-request/PERREQ-PRINT', '허가 요청서')
    await until(
      () =>
        evaluate(
          "[...document.querySelectorAll('main button')].find(button => button.textContent.trim() === '인쇄')?.disabled === false",
        ),
      'request print ready',
    )
    const requestPrintText = await evaluate(
      "(() => { [...document.querySelectorAll('main button')].find(button => button.textContent.trim() === '인쇄').click(); return [...document.querySelectorAll('iframe')].at(-1).contentDocument.body.textContent })()",
    )
    assert.equal(requestPrintText.includes('연락처'), false)
    assert.equal(requestPrintText.includes('phoneNumber'), false)
    assert.equal(requestPrintText.includes('applicationDate'), false)
    console.log(
      'PASS permit/request pagination and search, active-only issuer choices and Korean request print labels',
    )
    await navigate('/work-request/WRKREQ-EDIT', '작업의뢰서')
    await until(
      () =>
        evaluate(
          "document.querySelector('main input[required]:not(:disabled)') !== null",
        ),
      'request editor ready',
    )
    await input('main input[required]', '미저장 의뢰명')
    await evaluate("window.dispatchEvent(new Event('focus'))")
    await wait(400)
    assert.equal(
      await evaluate("document.querySelector('main input[required]').value"),
      '미저장 의뢰명',
    )
    console.log(
      'PASS work request/order server pagination, system ID search, separate number columns and request input preservation',
    )
    await navigate('/work-request/new', '작업의뢰서')
    assert.equal(
      await evaluate(
        "[...document.querySelectorAll('main select')].some(select => ['상','중','하'].every(label => [...select.options].some(option => option.value === label && option.text === label)))",
      ),
      true,
    )
    console.log(
      'PASS frontend-only high/medium/low priority options without a code-group response',
    )
    assert.equal(
      await evaluate(
        "document.querySelectorAll('input[aria-label=관리번호]').length",
      ),
      1,
    )
    assert.equal(
      await evaluate(
        "document.querySelector('main').textContent.includes('저장 시 자동 생성')",
      ),
      true,
    )
    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      { width: 390, height: 844, deviceScaleFactor: 1, mobile: true },
      sessionId,
    )
    await navigate('/approvals/new', '결재 작성')
    await add('A')
    await add('C')
    await input('select[aria-label="박참조 유형"]', 'REFERENCE', true)
    assert.equal(
      await evaluate('document.documentElement.scrollWidth <= innerWidth'),
      true,
    )
    assert.equal(
      await evaluate(
        "document.querySelector('table').parentElement.scrollWidth > document.querySelector('table').parentElement.clientWidth",
      ),
      true,
    )
    const screenshot = await cdp.send(
      'Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: true },
      sessionId,
    )
    await fs.writeFile(
      '/tmp/cmms-ui-mobile.png',
      Buffer.from(screenshot.data, 'base64'),
    )
    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false },
      sessionId,
    )
    await input('input[required]', '냉각수 펌프 보수 시행 요청')
    const desktop = await cdp.send(
      'Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: true },
      sessionId,
    )
    await fs.writeFile(
      '/tmp/cmms-ui-desktop.png',
      Buffer.from(desktop.data, 'base64'),
    )
    console.log(
      'PASS compact document metadata and mobile table scrolling without page overflow',
    )
    await navigate('/roles/USER', '모듈별 역할 권한')
    assert.deepEqual(
      await evaluate(
        "Array.from(document.querySelectorAll('table thead th')).map(el => el.textContent)",
      ),
      ['모듈', '등록', '조회', '수정', '삭제'],
    )
    assert.equal(
      await evaluate(
        "document.querySelectorAll('table input[type=checkbox]').length",
      ),
      4,
    )
    assert.equal(
      await evaluate(
        'document.querySelector(\'[aria-label="설비 조회"]\').checked',
      ),
      true,
    )
    await evaluate(
      'document.querySelector(\'[aria-label="설비 수정"]\').click()',
    )
    await evaluate(
      'document.querySelector(\'[aria-label="설비 등록"]\').click()',
    )
    assert.equal(
      await evaluate(
        'document.querySelector(\'[aria-label="설비 조회"]\').checked',
      ),
      true,
    )
    await evaluate("document.querySelector('button[type=submit]').click()")
    await until(
      () => writes.some((write) => write.route === '/roles/USER/permissions'),
      'role permission save',
    )
    assert.deepEqual(
      writes
        .find((write) => write.route === '/roles/USER/permissions')
        .payload.permissionIds.sort(),
      ['EQUIP:create', 'EQUIP:read'],
    )
    console.log(
      'PASS Korean permission matrix, independent checkboxes and existing save contract',
    )
    await navigate('/roles/new', '권한 관리')
    await input('#identity-form .grid > label:nth-child(1) input', 'NEW')
    await input('#identity-form .grid > label:nth-child(2) input', '신규 역할')
    await evaluate(
      'document.querySelector(\'[aria-label="설비 조회"]\').click()',
    )
    await click('저장')
    await until(
      () =>
        evaluate(
          "location.pathname === '/roles/NEW/edit' && document.querySelector('[role=alert]')?.textContent.includes('역할은 생성됐지만 권한 저장에 실패했습니다')",
        ),
      'created role edit page after permission failure',
    )
    assert.equal(
      await evaluate("document.querySelector('[role=alert]')?.textContent.includes('역할은 생성됐지만 권한 저장에 실패했습니다')"),
      true,
    )
    assert.equal(
      await evaluate('document.querySelector(\'[aria-label="설비 조회"]\').checked'),
      true,
    )
    await click('저장')
    await until(
      () => evaluate("location.pathname === '/roles/NEW'"),
      'role detail page after permission retry',
    )
    assert.equal(writes.filter((write) => write.route === '/roles').length, 1)
    assert.equal(
      writes.filter((write) => write.route === '/roles/NEW/permissions').length,
      2,
    )
    console.log('PASS created role can retry permission save after partial failure')
    await navigate('/boards', '게시판 이전 결과')
    await input('input[aria-label="게시글 검색"]', '실패검색')
    await click('조회')
    await until(
      () => evaluate("document.body.textContent.includes('게시판 조회 실패')"),
      'board query failure',
    )
    assert.equal(
      await evaluate("document.body.textContent.includes('게시판 이전 결과')"),
      false,
    )
    assert.equal(
      await evaluate(
        "[...document.querySelectorAll('main button')].find(button => button.textContent.trim() === '인쇄').disabled",
      ),
      true,
    )
    await input('input[aria-label="게시글 검색"]', '')
    await click('조회')
    await until(
      () =>
        evaluate(
          "document.body.textContent.includes('게시판 이전 결과') && !document.body.textContent.includes('게시판 조회 실패')",
        ),
      'board query retry',
    )
    console.log(
      'PASS board list hides stale data after query failure and recovers on retry',
    )
    await navigate('/login-history', '검색 결과 2건')
    await input('main select', 'failure', true)
    await click('검색')
    await until(
      () => evaluate("document.body.textContent.includes('검색 결과 1건')"),
      'history result filter',
    )
    assert.equal(
      await evaluate("document.body.textContent.includes('비밀번호 불일치')"),
      true,
    )
    await click('초기화')
    await until(
      () => evaluate("document.body.textContent.includes('검색 결과 2건')"),
      'history reset',
    )
    await evaluate("document.querySelector('header summary').click()")
    await click('내 정보 수정')
    await until(
      () => evaluate("Boolean(document.querySelector('dialog[open]'))"),
      'profile editing',
    )
    await input('dialog input[type=email]', 'updated@example.com')
    await input('dialog input[type=tel]', '010-9999-8888')
    await click('저장')
    await until(
      () =>
        evaluate(
          "document.body.textContent.includes('내 정보를 저장했습니다.')",
        ),
      'profile saved',
    )
    assert.deepEqual(
      writes.find((write) => write.route === '/users/me/profile').payload,
      { email: 'updated@example.com', phoneNumber: '010-9999-8888' },
    )
    await click('취소')
    await evaluate("document.querySelector('header summary').click()")
    await click('비밀번호 변경')
    await until(
      () => evaluate("Boolean(document.querySelector('dialog[open]'))"),
      'password panel',
    )
    // Each field has its own label, so locate password inputs by their order.
    const setPassword = (index, value) =>
      evaluate(
        `(() => {const element=document.querySelectorAll('dialog input[type=password]')[${index}]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,${JSON.stringify(value)}); element.dispatchEvent(new Event('input',{bubbles:true}))})()`,
      )
    await setPassword(0, 'wrong')
    await setPassword(1, 'new-password-123')
    await setPassword(2, 'mismatch-123')
    await evaluate(
      "document.querySelector('dialog button[type=submit]').click()",
    )
    await until(
      () =>
        evaluate(
          "document.body.textContent.includes('새 비밀번호와 확인 입력이 일치하지 않습니다.')",
        ),
      'password confirmation',
    )
    await setPassword(2, 'new-password-123')
    await evaluate(
      "document.querySelector('dialog button[type=submit]').click()",
    )
    await until(
      () =>
        evaluate(
          "document.body.textContent.includes('현재 비밀번호가 일치하지 않습니다.')",
        ),
      'current password error',
    )
    assert.equal(
      await evaluate("localStorage.getItem('cmms.accessToken')"),
      'fixture-token',
    )
    await setPassword(0, 'test-password')
    await evaluate(
      "document.querySelector('dialog button[type=submit]').click()",
    )
    await until(
      () =>
        evaluate(
          "location.pathname === '/login' && localStorage.getItem('cmms.accessToken') === null",
        ),
      'password logout',
    )
    await until(
      () =>
        evaluate(
          "(document.body?.textContent ?? '').includes('새 비밀번호로 다시 로그인해 주세요.')",
        ),
      'password change login notice',
    )
    assert.deepEqual(
      Object.keys(
        writes.filter((write) => write.route === '/users/me/password').at(-1)
          .payload,
      ).sort(),
      ['currentPassword', 'newPassword'],
    )
    console.log(
      'PASS profile contact editing, login history filters, password validation and logout after password change',
    )
    assert.deepEqual(failures, [])
    await cdp.send('Browser.close')
    socket.close()
  } finally {
    if (chrome && chrome.exitCode === null) {
      chrome.kill('SIGTERM')
      await Promise.race([once(chrome, 'exit'), wait(3000)])
    }
    socket?.close()
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
