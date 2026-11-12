const { test } = require('node:test')
const assert = require('node:assert/strict')
const Dockerode = require('dockerode')

const prepare = require('../src/prepare')
const { config, makeCtx, dockerError, errorsOf } = require('./helpers')

test('prepare reports why tagging the image failed', async t => {
  t.mock.method(Dockerode.prototype, 'getImage', () => ({
    tag: async () => {
      throw dockerError('(HTTP code 404) no such image - No such image: acme/app:latest ', 404)
    }
  }))
  const ctx = makeCtx()

  const err = await prepare(config(), ctx).then(
    () => assert.fail('prepare should fail'),
    error => error
  )

  const [error] = errorsOf(err)
  assert.equal(error.code, 'EDOCKERIMAGETAG')
  assert.equal(error.semanticRelease, true)
  assert.match(error.details, /acme\/app:1\.2\.3/)
  assert.match(error.details, /No such image: acme\/app:latest/)
  assert.match(error.details, /status code 404/)
  assert.match(ctx.logs.error.join('\n'), /acme\/app:1\.2\.3.*No such image: acme\/app:latest.*status code 404/)
})
