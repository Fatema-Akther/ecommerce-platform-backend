export function resolveCourierConfig(keyRef: string) {
  const apiKey =
    process.env[`${keyRef}_API_KEY`]?.trim();

  const secretKey =
    process.env[`${keyRef}_SECRET`]?.trim();

  const baseUrl =
    process.env[`${keyRef}_BASE_URL`]
      ?.trim()
      .replace(/\/+$/, '');

  if (!apiKey || !baseUrl) {
    throw new Error(
      `Missing ENV config for keyRef: ${keyRef}`,
    );
  }

  return {
    apiKey,
    secretKey,
    baseUrl,
  };
}


export function resolveCourierSecretConfig(keyRef: string) {
  const config = resolveCourierConfig(keyRef);

  if (!config.secretKey) {
    throw new Error(
      `Missing SECRET config for keyRef: ${keyRef}`,
    );
  }

  return {
    ...config,
    secretKey: config.secretKey,
  };
}