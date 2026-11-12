const Dockerode = require('dockerode')

const toAggregateError = require('./aggregate-error')
const { describeError } = require('./describe-error')
const getError = require('./get-error')

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
  const baseImageTag = ctx.nextRelease.channel || 'latest';
  let target
  try {
    const docker = new Dockerode()
    const image = docker.getImage(pluginConfig.baseImageName)
    const tags = [ctx.nextRelease.version]
    if (pluginConfig.additionalTags && pluginConfig.additionalTags.length > 0) {
      tags.push(...pluginConfig.additionalTags)
    }
    for (const tag of tags) {
      target = `${pluginConfig.baseImageName}:${tag}`
      ctx.logger.log(
        `Tagging docker image ${pluginConfig.baseImageName}:${baseImageTag} to ${target}`
      )
      await image.tag({ repo: pluginConfig.baseImageName, tag })
    }
    for (const { imageName } of pluginConfig.registries) {
      for (const tag of [...tags, baseImageTag]) {
        target = `${imageName}:${tag}`
        ctx.logger.log(
          `Tagging docker image ${pluginConfig.baseImageName}:${baseImageTag} to ${target}`
        )
        await image.tag({ repo: imageName, tag })
      }
    }
  } catch (err) {
    const reason = `Tagging docker image ${pluginConfig.baseImageName}:${baseImageTag}${
      target ? ` to ${target}` : ''
    } failed: ${describeError(err)}`
    ctx.logger.error(reason)
    throw toAggregateError([getError('EDOCKERIMAGETAG', ctx, reason)])
  }
}
