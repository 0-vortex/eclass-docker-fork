const { PassThrough } = require('node:stream')
const { format } = require('node:util')

const SECRET = 'test-registry-password-4f9c'

const config = () => ({
  baseImageName: 'acme/app',
  registries: [
    {
      url: 'ghcr.io',
      imageName: 'ghcr.io/acme/app',
      user: 'DOCKER_USER',
      password: 'DOCKER_PASSWORD'
    }
  ]
})

const makeCtx = () => {
  const logs = { log: [], info: [], warn: [], error: [], success: [] }
  const logger = {}
  for (const level of Object.keys(logs)) {
    logger[level] = (...args) => logs[level].push(format(...args))
  }
  return {
    env: { DOCKER_USER: 'octocat', DOCKER_PASSWORD: SECRET },
    logger,
    logs,
    nextRelease: { version: '1.2.3', channel: undefined }
  }
}

/**
 * A push response as Docker streams it: newline-delimited JSON, chunked however the socket delivers it.
 * @param {string[]} chunks -
 * @returns {PassThrough} -
 */
const progress = chunks => {
  const stream = new PassThrough()
  setImmediate(() => {
    for (const chunk of chunks) {
      stream.write(chunk)
    }
    stream.end()
  })
  return stream
}

/**
 * An error shaped like the ones docker-modem rejects with.
 * @param {string} message -
 * @param {number} statusCode -
 * @returns {Error} -
 */
const dockerError = (message, statusCode) =>
  Object.assign(new Error(message), { statusCode, reason: 'server error', json: { message } })

/**
 * The errors semantic-release reads from a plugin failure: `err.errors` (>= 20) or iteration (< 20).
 * @param {*} err -
 * @returns {Array<*>} -
 */
const errorsOf = err => {
  if (!Array.isArray(err.errors)) {
    throw new Error('expected an aggregate error with an `errors` array')
  }
  if (typeof err[Symbol.iterator] !== 'function') {
    throw new Error('expected an iterable aggregate error')
  }
  return err.errors
}

module.exports = { SECRET, config, makeCtx, progress, dockerError, errorsOf }
