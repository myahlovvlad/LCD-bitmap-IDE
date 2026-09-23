export const RELEASES_URL = 'https://github.com/myahlovvlad/LCD-bitmap-IDE/releases/latest';
const LATEST_RELEASE_API_URL = 'https://api.github.com/repos/myahlovvlad/LCD-bitmap-IDE/releases/latest';

export interface AvailableUpdate {
  version: string;
  releaseUrl: string;
  publishedAt?: string;
  notes?: string;
}

interface GithubReleaseResponse {
  tag_name?: unknown;
  html_url?: unknown;
  published_at?: unknown;
  body?: unknown;
}

export function compareVersions(left: string, right: string): number {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  if (!leftParts || !rightParts) return 0;
  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts.numbers[index] - rightParts.numbers[index];
    if (difference !== 0) return difference;
  }
  if (leftParts.prerelease === rightParts.prerelease) return 0;
  if (!leftParts.prerelease) return 1;
  if (!rightParts.prerelease) return -1;
  return leftParts.prerelease.localeCompare(rightParts.prerelease, undefined, { numeric: true });
}

export async function checkForUpdate(currentVersion: string, request: typeof fetch = fetch): Promise<AvailableUpdate | null> {
  const response = await request(LATEST_RELEASE_API_URL, {
    headers: { Accept: 'application/vnd.github+json' }
  });
  if (!response.ok) throw new Error(`Update service returned ${response.status}`);
  const release = await response.json() as GithubReleaseResponse;
  const version = typeof release.tag_name === 'string' ? release.tag_name.replace(/^v/i, '').trim() : '';
  const releaseUrl = typeof release.html_url === 'string' ? release.html_url : RELEASES_URL;
  if (!version || compareVersions(version, currentVersion) <= 0) return null;
  return {
    version,
    releaseUrl,
    publishedAt: typeof release.published_at === 'string' ? release.published_at : undefined,
    notes: typeof release.body === 'string' ? release.body : undefined
  };
}

function parseVersion(value: string): { numbers: [number, number, number]; prerelease: string } | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value.trim());
  if (!match) return null;
  return {
    numbers: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ?? ''
  };
}
