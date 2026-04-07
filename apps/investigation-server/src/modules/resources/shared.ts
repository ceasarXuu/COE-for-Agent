export function getResourceSegments(url: URL): string[] {
  return [url.host, ...url.pathname.split('/').filter(Boolean)];
}

export function getCaseIdFromUrl(url: URL): string {
  return getResourceSegments(url)[1] ?? '';
}

export function parseIntegerSearchParam(url: URL, name: string): number | null {
  const value = url.searchParams.get(name);
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export function parseRequestedRevision(url: URL): number | null {
  const parsed = parseIntegerSearchParam(url, 'atRevision');
  return parsed === null ? null : Math.max(0, parsed);
}