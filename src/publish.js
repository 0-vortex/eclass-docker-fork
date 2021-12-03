const AggregateError = require('aggregate-error')
const Dockerode = require('dockerode')

const getError = require('./get-error')
const getAuth = require('./getAuth')
const isTagPushAllowed = require('./is-tag-push-allowed')
const getReleaseInfo = require("./getReleaseInfo");

/** @typedef {import('stream').Readable} ReadableStream */
/**
 * @param {ReadableStream} response -
 * @returns {Promise<void>} -
 * @example
 * pushImage(response)
 */
const pushImage = response => {
  return new Promise((resolve, reject) => {
    let error
    response.on('data', chunk => {
      const data = JSON.parse(chunk.toString())
      if (data.error) {
        error = new Error(data.error)
      }
    })
    response.on('end', () => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
    response.on('error', error => {
      reject(error)
    })
  })
}

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

  try {
    const docker = new Dockerode()
    const baseImageTag = ctx.nextRelease.channel || 'latest';
    console.log(`baseImageTag: ${baseImageTag}`);
    console.log(`ctx.nextRelease.version: ${ctx.nextRelease.version}`);
    console.log(`ctx.nextRelease`, ctx.nextRelease);

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
      const options = {
        password: password,
        serveraddress: url,
        username: user
      }
      for (const tag of tags) {
        if (isTagPushAllowed(tag, registry)) {
          ctx.logger.log(`Pushing docker image ${imageName}:${tag}`)
          const response = await image.push({ tag, ...options })
          // @ts-ignore
          await pushImage(response)

          if (tag === baseImageTag) {
            latestImage = imageName;
            latestRegistry = registry.url;
          }
        } else {
          ctx.logger.log(`Skip push docker image ${imageName}:${tag}`)
        }
      }

      console.log(`latestImage: ${latestImage}`);
      console.log(`latestRegistry: ${latestRegistry}`);
      if (latestImage && latestRegistry) {
        return getReleaseInfo(latestImage, latestRegistry, baseImageTag);
      }
    }
  } catch (err) {
    throw new AggregateError([getError('EDOCKERIMAGEPUSH', ctx)])
  }
}
