const SECRET_REPLACEMENT = '[secure]'

/**
 * Masks every occurrence of the given secrets, as is and URI-encoded.
 * @param {string} text -
 * @param {Array<string | undefined>} secrets -
 * @returns {string} -
 * @example
 * redact(message, [password])
 */
const redact = (text, secrets) =>
  secrets
    .filter(secret => typeof secret === 'string' && secret.length > 0)
    .flatMap(secret => [secret, encodeURIComponent(secret)])
    .reduce((masked, secret) => masked.split(secret).join(SECRET_REPLACEMENT), String(text))

/**
 * Describes a Docker error for the logs: its message, plus the HTTP status code of a rejected
 * request or the system error code (for example ECONNREFUSED on the Docker socket).
 * @param {*} err -
 * @param {Array<string | undefined>} [secrets] - values to mask, such as the registry password
 * @returns {string} -
 * @example
 * describeError(err, [password])
 */
const describeError = (err, secrets = []) => {
  const message = String((err && err.message) || err).trim()
  const extra = []
  if (err && err.statusCode) {
    extra.push(`status code ${err.statusCode}`)
  }
  if (err && typeof err.code === 'string') {
    extra.push(`code ${err.code}`)
  }
  return redact(extra.length > 0 ? `${message} (${extra.join(', ')})` : message, secrets)
}

module.exports = { describeError, redact }
