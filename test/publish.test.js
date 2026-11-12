const { test } = require('node:test')
const assert = require('node:assert/strict')
const Dockerode = require('dockerode')

const publish = require('../src/publish')
const { SECRET, config, makeCtx, progress } = require('./helpers')

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
