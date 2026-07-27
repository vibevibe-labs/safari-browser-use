const MAX_SUPPORTED_SAFARI_MAJOR = 26;

export function parseSafariMajor(version) {
  const match = /^(\d+)(?:\.|$)/.exec(version);

  if (!match) {
    throw new Error(`Invalid Safari version: ${version}`);
  }

  return Number(match[1]);
}

export function evaluateSafariVersion(version) {
  const major = parseSafariMajor(version);

  if (major <= MAX_SUPPORTED_SAFARI_MAJOR) {
    return { supported: true, major, reason: null };
  }

  return {
    supported: false,
    major,
    reason: `Safari ${major} includes a native MCP server; use /usr/bin/safaridriver --mcp.`
  };
}
