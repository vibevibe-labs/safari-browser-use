const SUPPORTED_SAFARI_MAJOR = 26;

export function parseSafariMajor(version) {
  const match = /^(\d+)(?:\.|$)/.exec(version);

  if (!match) {
    throw new Error(`Invalid Safari version: ${version}`);
  }

  return Number(match[1]);
}

export function evaluateSafariVersion(version) {
  const major = parseSafariMajor(version);

  if (major === SUPPORTED_SAFARI_MAJOR) {
    return { supported: true, major, reason: null };
  }

  const reason = major < SUPPORTED_SAFARI_MAJOR
    ? `Safari 26 is required; found Safari ${major}.`
    : `Safari ${major} is not supported; install Safari 26.`;

  return { supported: false, major, reason };
}
