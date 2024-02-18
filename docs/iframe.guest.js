const MSG_CALL_FUNCTION = 1

const SOURCE = 'rex/widgets/iframe'
const GUEST = 'rex-widgets-iframe-guest'

const params = new URLSearchParams(location.search)
const guest = params.get(GUEST)
if (!guest) {
  throw new Error('Missing parameter "rex-widgets-iframe-guest".')
}

let parentOrigin = '*'

export function setParentOrigin(origin) {
  parentOrigin = origin
}

const deferredRequests = new Map()

function createDeferred() {
  let resolve, reject
  const promise = new Promise((ok, fail) => {
    resolve = ok
    reject = fail
  })
  return { promise, resolve, reject }
}

function createDeferredRequest(id) {
  const deferred = createDeferred()
  deferredRequests.set(id, deferred)
  return deferred
}

function getDeferredRequest(id) {
  const deferred = deferredRequests.get(id)
  deferredRequests.delete(id)
  return deferred
}

function createError(props) {
  const error = new Error()
  for (const prop in props) {
    error[prop] = props[prop]
  }
  return error
}

function forwardReply(data) {
  const { index, name, args, value, error } = data
  if (index && name && args && (value !== undefined || error)) {
    console.log(`[iframe] received ${error ? 'failed ' : ''}reply from ${name} with event.data "${formatData(data)}"`)
    const { resolve, reject } = getDeferredRequest(index)
    if (error) {
      reject(createError(error))
    } else {
      resolve(value)
    }
  } else {
    console.warn(`[iframe] ignoring invalid reply to "${name}" with event.data "${formatData(data)}"`)
  }
}

function formatData(data) {
  const stringData = data ? JSON.stringify(data) : 'null'
  return stringData.length > 100 ? `${stringData.slice(0, 100)}...` : stringData
}

function handleRequest(data) {
  switch (data.type) {
    case MSG_CALL_FUNCTION:
      forwardReply(data)
      break
    default:
      console.warn(`[iframe] ignoring unrecognised data.type "${data.type}" with event.data "${formatData(data)}"`)
  }
}

function receiveMessage({ data, origin }) {
  if (data && data.source === SOURCE) {
    if (data.guest === guest) {
      if (parentOrigin === '*' || origin === parentOrigin) {
        handleRequest(data)
      } else {
        console.warn(
          `[iframe] ignoring event.origin different from parentOrigin ("${origin}" != "${parentOrigin}") with event.data "${formatData(data)}"`
        )
      }
    } else {
      console.warn(`[iframe] ignoring unrecognised guest ("${data.guest}" != "${guest}") in event data "${formatData(data)}"`)
    }
  } else {
    console.warn(`[iframe] ignoring unrecognised event.data: "${formatData(data)}..."`)
  }
}

console.log('[iframe] listening on the event message')
addEventListener('message', receiveMessage, false)

let requestIndex = 0

function nextRequestIndex() {
  if (requestIndex === Number.MAX_SAFE_INTEGER) {
    requestIndex = 0
  }
  return String(++requestIndex)
}

export function callFunction(name, ...args) {
  const data = { guest, index: nextRequestIndex(), type: MSG_CALL_FUNCTION, name, args }
  console.log(`[iframe] posting request for calling ${name} with args "${formatData(args)}" and event.data "${formatData(data)}"`)
  const { promise } = createDeferredRequest(data.index)
  data.source = SOURCE
  parent.postMessage(data, parentOrigin)
  return promise
}
