const AggregateError = require('aggregate-error')

/**
 * Wraps the plugin's errors so every supported semantic-release version can list them, and so
 * print each SemanticReleaseError's code and details: semantic-release >= 20 reads `err.errors`,
 * older versions iterate the error. aggregate-error 3 only supports iteration.
 * @param {Error[]} errors -
 * @returns {AggregateError} -
 * @example
 * throw toAggregateError([getError('EDOCKERIMAGEPUSH', ctx, reason)])
 */
const toAggregateError = errors => {
  const aggregate = new AggregateError(errors)
  // Iterating yields the errors as aggregate-error normalized them.
  Object.defineProperty(aggregate, 'errors', { value: [...aggregate] })
  return aggregate
}

module.exports = toAggregateError
