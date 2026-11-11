const patterns = {
  "#semver#": String.raw`((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?)`,
  "#simple#": String.raw`([0-9]*)`,
};

export function expandPattern(pattern) {
  return pattern.replace(/#semver#|#simple#/g, (token) => patterns[token]);
}

export function matchVersion(expression, candidate) {
  if (typeof candidate !== "string" || candidate.length === 0) return undefined;
  const match = expression.exec(candidate);
  return match && (match.length > 1 ? match[1] : match[0]) || undefined;
}
