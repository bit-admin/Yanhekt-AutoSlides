export function fixUrlEscaping(url: string): string {
  return url.replace(/\\\//g, '/');
}

export function extractHostFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    console.error('Error extracting host from URL:', url, error);
    return 'localhost';
  }
}

export function resolveUrl(base: string, relative: string): string {
  if (relative.startsWith('http')) {
    return relative;
  }

  const baseUrl = new URL(base);

  if (relative.startsWith('/')) {
    return `${baseUrl.protocol}//${baseUrl.host}${relative}`;
  }

  const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);
  return `${baseUrl.protocol}//${baseUrl.host}${basePath}${relative}`;
}

export function rewriteM3u8TsUrls(
  content: string,
  proxyPort: number,
  baseUrl: string,
  routePrefix: 'live' | 'recorded'
): string {
  const lines = content.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    if (!line.startsWith('#') && line.trim() !== '') {
      const tsFileName = line.trim();
      const segment = routePrefix === 'live' ? `live/${tsFileName}` : `recorded/${tsFileName}`;
      const proxyTsUrl = `http://localhost:${proxyPort}/${segment}?baseUrl=${encodeURIComponent(baseUrl)}`;
      result.push(proxyTsUrl);
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}
