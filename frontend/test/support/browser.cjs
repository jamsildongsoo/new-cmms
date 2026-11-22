/** Chromium 원격 디버깅 연결과 비동기 대기는 브라우저 테스트에서 공유한다. */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(fn, description, timeout = 12000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (await fn()) return
    await wait(50)
  }
  throw Error(`Timeout: ${description}`)
}
class CDP {
  constructor(socket) {
    this.socket = socket
    this.next = 0
    this.pending = new Map()
    this.handlers = []
    socket.addEventListener('message', ({ data }) => {
      const event = JSON.parse(data)
      if (event.id) {
        const pending = this.pending.get(event.id)
        if (pending) {
          this.pending.delete(event.id)
          clearTimeout(pending.timer)
          event.error
            ? pending.reject(Error(event.error.message))
            : pending.resolve(event.result)
        }
      } else for (const fn of this.handlers) fn(event)
    })
  }
  send(method, params = {}, sessionId) {
    const id = ++this.next
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(Error(`CDP timeout: ${method}`))
      }, 15000)
      this.pending.set(id, { resolve, reject, timer })
      this.socket.send(
        JSON.stringify({
          id,
          method,
          params,
          ...(sessionId ? { sessionId } : {}),
        }),
      )
    })
  }
  async eval(session, expression) {
    const result = await this.send(
      'Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true },
      session,
    )
    if (result.exceptionDetails)
      throw Error(
        result.exceptionDetails.text + ': ' + result.result?.description,
      )
    return result.result?.value
  }
}

module.exports = { CDP, until }
