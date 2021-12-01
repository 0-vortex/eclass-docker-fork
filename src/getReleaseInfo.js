const getReleaseInfo = (imageName, registry, tag) => ({
    name: `${registry} container (@${tag} dist-tag)`,
    url: `${imageName}`.replace(
      new RegExp('^((?:ghcr|docker|quay).io)', 'gi'),
      matched => ({
        "ghcr.io": "https://ghcr.io",
        "docker.io": "https://hub.docker.com/r",
        "quay.io": "https://quay.io/repository"
      })[matched]
    ),
    channel: tag,
  });

module.exports = getReleaseInfo;
