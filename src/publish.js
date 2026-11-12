const Dockerode = require('dockerode')

const toAggregateError = require('./aggregate-error')
const { describeError } = require('./describe-error')
const followPushProgress = require('./push-progress')
const getError = require('./get-error')
const getAuth = require('./getAuth')
const isTagPushAllowed = require('./is-tag-push-allowed')
const getReleaseInfo = require("./getReleaseInfo");

/**
 * @typedef {import('./types').Context} Context
 * @typedef {import('./types').Config} Config
 */
/**
 * @param {Config} pluginConfig -
 * @param {Context} ctx -
 * @returns {Promise<*>} -
 * @example
 * verifyConditions(pluginConfig, ctx)
 */
module.exports = async (pluginConfig, ctx) => {
  let latestImage;
  let latestRegistry;

  const docker = new Dockerode()
  const baseImageTag = ctx.nextRelease.channel || 'latest';

  const tags = [baseImageTag, ctx.nextRelease.version]
  if (pluginConfig.additionalTags && pluginConfig.additionalTags.length > 0) {
    tags.push(...pluginConfig.additionalTags)
  }
  for (const registry of pluginConfig.registries) {
    const { user, password, url, imageName } = getAuth(
      registry.user,
      registry.password,
      registry.url,
      registry.imageName,
      ctx
    )
    const image = docker.getImage(imageName)
    // dockerode sends `authconfig` as the X-Registry-Auth header. Passed as plain push options,
    // the credentials only reached the query string and the request body, which Docker Engine
    // >= 28.3.3 no longer reads, so the push went out anonymously and the registry refused it.
    const authconfig = {
      password: password,
      serveraddress: url,
      username: user
    }
    for (const tag of tags) {
      if (isTagPushAllowed(tag, registry)) {
        ctx.logger.log(`Pushing docker image ${imageName}:${tag}`)
        try {
          const response = await image.push({ tag, authconfig })
          // Docker reports most push failures inside the progress stream, not as a failed request.
          // @ts-ignore
          await followPushProgress(response)
        } catch (err) {
          const reason = `Pushing docker image ${imageName}:${tag} failed: ${describeError(err, [password])}`
          ctx.logger.error(reason)
          throw toAggregateError([getError('EDOCKERIMAGEPUSH', ctx, reason)])
        }

        if (tag === baseImageTag) {
          latestImage = imageName;
          latestRegistry = registry.url;
        }
      } else {
        ctx.logger.log(`Skip push docker image ${imageName}:${tag}`)
      }
    }

    if (latestImage && latestRegistry) {
      return getReleaseInfo(latestImage, latestRegistry, baseImageTag);
    }
  }
}
