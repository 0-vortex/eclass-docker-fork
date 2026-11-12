const { StringDecoder } = require('string_decoder')

/** @typedef {import('stream').Readable} ReadableStream */
/**
 * Reads a `docker push` progress stream to its end.
 *
 * Docker answers a push with HTTP 200 and reports most failures (denied, unauthorized, blob upload
 * errors) as `{"error": ..., "errorDetail": {...}}` lines inside this newline-delimited JSON stream,
 * so the request itself does not fail. A line can arrive split across chunks, or share a chunk.
 * @param {ReadableStream} stream -
 * @returns {Promise<void>} - rejects with every error line Docker reported
 * @example
 * await followPushProgress(await image.push({ tag, authconfig }))
 */
const followPushProgress = stream =>
  new Promise((resolve, reject) => {
    const decoder = new StringDecoder('utf8')
    const errors = []
    let buffered = ''
    let settled = false

    const readLine = line => {
      const text = line.trim()
      if (!text) {
        return
      }
      let event
      try {
        event = JSON.parse(text)
      } catch (err) {
        return
      }
      const message = (event.errorDetail && event.errorDetail.message) || event.error
      if (message) {
        errors.push(String(message))
      }
    }

    const settle = err => {
      if (settled) {
        return
      }
      settled = true
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    }

    stream.on('data', chunk => {
      buffered += typeof chunk === 'string' ? chunk : decoder.write(chunk)
      const lines = buffered.split('\n')
      buffered = lines.pop() || ''
      lines.forEach(readLine)
    })
    stream.on('end', () => {
      readLine(buffered + decoder.end())
      if (errors.length > 0) {
        settle(Object.assign(new Error(errors.join('; ')), { progressErrors: errors }))
      } else {
        settle()
      }
    })
    stream.on('error', settle)
    stream.on('close', () => settle(new Error('The push progress stream closed before it ended.')))
  })

module.exports = followPushProgress
