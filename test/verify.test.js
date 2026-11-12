const { test } = require('node:test')
const assert = require('node:assert/strict')
const Dockerode = require('dockerode')

const verifyConditions = require('../src/verify')
const { SECRET, config, makeCtx, dockerError, errorsOf } = require('./helpers')

test('verifyConditions reports why the registry login failed, without the password', async t => {
  t.mock.method(Dockerode.prototype, 'checkAuth', async () => {
    throw dockerError(
      `(HTTP code 500) server error - login attempt to https://ghcr.io/v2/ failed with status: 401 Unauthorized ${SECRET} `,
      500
    )
  })
  const ctx = makeCtx()

  const err = await verifyConditions(config(), ctx).then(
    () => assert.fail('verifyConditions should fail'),
    error => error
  )

  const [error] = errorsOf(err)
  assert.equal(error.code, 'EDOCKERLOGIN')
  assert.equal(error.semanticRelease, true)
  assert.match(error.details, /ghcr\.io/)
  assert.match(error.details, /failed with status: 401 Unauthorized/)
  assert.match(error.details, /status code 500/)
  assert.match(ctx.logs.error.join('\n'), /ghcr\.io.*401 Unauthorized/)
  const everything = [error.message, error.details, ...Object.values(ctx.logs).flat()].join('\n')
  assert.ok(!everything.includes(SECRET), 'the password must not appear in errors or logs')
})

test('verifyConditions still reports missing registry credentials', async t => {
  t.mock.method(Dockerode.prototype, 'checkAuth', async () => ({ Status: 'Login Succeeded' }))
  const ctx = makeCtx()
  delete ctx.env.DOCKER_USER
  delete ctx.env.DOCKER_PASSWORD

  const err = await verifyConditions(config(), ctx).then(
    () => assert.fail('verifyConditions should fail'),
    error => error
  )

  assert.deepEqual(
    errorsOf(err).map(error => error.code),
    ['ENODOCKERUSER', 'ENODOCKERPASSWORD']
  )
})
