const MSG_CALL_FUNCTION = 1

const SOURCE = 'rex/widgets/iframe'

const guests = new Map()
let guestIndex = 0

function nextGuestIndex() {
  if (guestIndex === Number.MAX_SAFE_INTEGER) {
    guestIndex = 0
  }
  return String(++guestIndex)
}

export function addGuest(widgetData, iframeOrigin) {
  const index = nextGuestIndex()
  const guest = { index, widgetData, iframeOrigin }
  guests.set(index, guest)
}

function getGuest(index) {
  const guest = guests.get(index)
  if (!guest) throw new Error(`Guest ${index} not found.`)
  return guest
}

console.log('[page] listening on the event message')
addEventListener('message', receiveRequest, false)

const functionHandlers = {
  getWidgetData({ data }) {
    return data
  }
}

function receiveRequest(event) {
  if (event.data && event.data.source === SOURCE) {
    const { guest } = event.data
    try {
      const options = getGuest(guest)
      if (event.origin === options.iframeOrigin) {
        handleRequest(event.data, options, event.source)
      } else {
        console.warn(`[page] ignoring event.origin different from parentOrigin: "${event.origin}" != "{${options.iframeOrigin}}" with event.data "${formatData(event.data)}"`)
      }
    } catch (err) {
      console.warn(`[page] ignoring unrecognised guest "${guest}" in event data "${formatData(event.data)}"`)
    }
  } else {
    console.warn(`[page] ignoring unrecognised event.data "${formatData(event.data)}"`)
  }
}

function handleRequest(data, options, targetFrame) {
  switch (data.type) {
    case MSG_CALL_FUNCTION:
      postReply(data, options, targetFrame)
      break
    default:
      console.warn(`[page] ignoring unrecognised data.type "${data.type}" in event.data "${formatData(data)}"`)
  }
}

async function postReply(data, { widgetData, iframeOrigin }, targetFrame) {
  const handler = functionHandlers[data.name]
  if (handler) {
    console.log(`[page] received request for ${data.name} with event.data "${formatData(data)}"`)
    try {
      data.value = (await handler({ data: widgetData, args: data.args })) ?? null
    } catch (err) {
      data.error = convertError(err)
    }
    console.log(`[page] posting reply to ${data.name} with event.data "${formatData(data)}"`)
    targetFrame.postMessage(data, iframeOrigin)
  } else {
    console.warn(`[page] ignoring unrecognised function handler "${data.name}" in event.data "${formatData(data)}"`)
  }
}

function convertError(err) {
  const obj = { message: err.message }
  for (const prop in err) {
    obj[prop] = err[prop]
  }
  return obj
}

function formatData(data) {
  const stringData = data ? JSON.stringify(data) : 'null'
  return stringData.length > 100 ? `${stringData.slice(0, 100)}...` : stringData
}
