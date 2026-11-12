const { test } = require('node:test')
const assert = require('node:assert/strict')
const Dockerode = require('dockerode')

const publish = require('../src/publish')
const { SECRET, config, makeCtx, progress, dockerError, errorsOf } = require('./helpers')

const pushed = [
  '{"status":"The push refers to repository [ghcr.io/acme/app]"}\n',
  '{"status":"Pushed","progressDetail":{},"id":"e0b1ba9906d2"}\n',
  '{"status":"latest: digest: sha256:8d39 size: 476"}\n'
]

test('publish sends the registry credentials as authconfig, not as push options', async t => {
  const pushes = []
  t.mock.method(Dockerode.prototype, 'getImage', () => ({
    push: async opts => {
      pushes.push(opts)
      return progress(pushed)
    }
  }))

  await publish(config(), makeCtx())

  assert.deepEqual(
    pushes.map(opts => opts.tag),
    ['latest', '1.2.3']
  )
  for (const opts of pushes) {
    // dockerode only sends `authconfig` as the X-Registry-Auth header; Docker >= 28.3.3 reads nothing else.
    assert.deepEqual(opts.authconfig, { username: 'octocat', password: SECRET, serveraddress: 'ghcr.io' })
    assert.deepEqual(Object.keys(opts).sort(), ['authconfig', 'tag'])
  }
})

test('publish fails with the error lines Docker writes to the push progress stream', async t => {
  t.mock.method(Dockerode.prototype, 'getImage', () => ({
    push: async () =>
      progress([
        '{"status":"The push refers to repository [ghcr.io/acme/app]"}\n',
        '{"status":"Waiting","progressDetail":{},"id":"e0b1ba9906d2"}\n',
        '{"errorDetail":{"message":"push access denied: no basic auth credentials"},' +
          '"error":"push access denied: no basic auth credentials"}\n'
      ])
  }))
  const ctx = makeCtx()

  const err = await publish(config(), ctx).then(
    () => assert.fail('publish should fail'),
    error => error
  )

  const [error] = errorsOf(err)
  assert.equal(error.code, 'EDOCKERIMAGEPUSH')
  assert.equal(error.semanticRelease, true)
  assert.match(error.details, /ghcr\.io\/acme\/app:latest/)
  assert.match(error.details, /push access denied: no basic auth credentials/)
  assert.match(ctx.logs.error.join('\n'), /ghcr\.io\/acme\/app:latest.*push access denied: no basic auth credentials/)
})

test('publish reads progress lines split across chunks or sharing one', async t => {
  t.mock.method(Dockerode.prototype, 'getImage', () => ({
    push: async () =>
      progress(['{"status":"Waiting"}\n{"status":"Pus', 'hing"}\n{"error":"blob upload unknown"}\n'])
  }))
  const ctx = makeCtx()

  const err = await publish(config(), ctx).then(
    () => assert.fail('publish should fail'),
    error => error
  )

  const [error] = errorsOf(err)
  assert.equal(error.code, 'EDOCKERIMAGEPUSH')
  assert.match(error.details, /blob upload unknown/)
})

test('publish reports the status code when Docker rejects the push request', async t => {
  t.mock.method(Dockerode.prototype, 'getImage', () => ({
    push: async () => {
      throw dockerError('(HTTP code 404) no such image - An image does not exist locally with the tag: ghcr.io/acme/app ', 404)
    }
  }))
  const ctx = makeCtx()

  const err = await publish(config(), ctx).then(
    () => assert.fail('publish should fail'),
    error => error
  )

  const [error] = errorsOf(err)
  assert.equal(error.code, 'EDOCKERIMAGEPUSH')
  assert.match(error.details, /status code 404/)
  assert.match(ctx.logs.error.join('\n'), /An image does not exist locally with the tag: ghcr\.io\/acme\/app.*status code 404/)
})

test('publish never logs the registry password', async t => {
  t.mock.method(Dockerode.prototype, 'getImage', () => ({
    push: async () => {
      throw dockerError(`(HTTP code 500) server error - bad credentials ${SECRET} `, 500)
    }
  }))
  const ctx = makeCtx()

  const err = await publish(config(), ctx).then(
    () => assert.fail('publish should fail'),
    error => error
  )

  const [error] = errorsOf(err)
  const everything = [error.message, error.details, ...Object.values(ctx.logs).flat()].join('\n')
  assert.ok(!everything.includes(SECRET), 'the password must not appear in errors or logs')
  assert.match(error.details, /bad credentials \[secure\]/)
})
