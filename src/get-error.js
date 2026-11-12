const SemanticReleaseError = require('@semantic-release/error')
const ERROR_DEFINITIONS = require('./errors')

/** @typedef {import('semantic-release').Context} Context */
/**
 * @param {string} code -
 * @param {Context} ctx -
 * @param {string} [reason] - what actually failed, appended to the details
 * @returns {Error} -
 * @example
 * const throw getError('CUSTOMERROR')
 */
module.exports = (code, ctx, reason) => {
  const { message, details } = ERROR_DEFINITIONS.get(code)(ctx)
  return new SemanticReleaseError(message, code, reason ? `${details}\n\n${reason}` : details)
}
