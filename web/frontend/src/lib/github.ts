// GitHub client for the desktop-apps page.
//
// Every read tries github.com directly first and retries through gh-proxy.org.
// The retry covers 403 as well as network failure: unauthenticated api.github.com
// allows 60 requests/hour/IP, and a campus NAT shares one IP across many users,
// so rate-limit 403s are routine rather than exceptional. Both origins send
// `access-control-allow-origin: *`, so either can be read from the browser.

const DIRECT = {
  api: "https://api.github.com",
  raw: "https://raw.githubusercontent.com",
  web: "https://github.com",
};

const PROXY_PREFIX = "https://gh-proxy.org/";

export interface RepoRef {
  owner: string;
  repo: string;
}

export interface ReleaseAsset {
  name: string;
  size: number;
  formattedSize: string;
  /** Direct browser_download_url. */
  url: string;
  /** Same asset via gh-proxy.org, for when GitHub is unreachable. */
  proxyUrl: string;
  platform: Platform;
  /** Installer vs. portable/standalone — shown as a hint on the row. */
  kind: "installer" | "portable" | "package";
}

export interface Release {
  version: string;
  publishedAt: string;
  htmlUrl: string;
  /** GitHub-rendered release notes. Empty when the release has no body. */
  notesHtml: string;
  assets: ReleaseAsset[];
}

export type Platform = "macos" | "windows" | "linux" | "other";

/** Wraps any github.com URL in the mirror. */
export function toProxyUrl(url: string): string {
  return `${PROXY_PREFIX}${url}`;
}

/**
 * Fetch a URL directly, then retry via the mirror. A non-ok response counts as
 * a failure worth retrying (notably 403 rate-limiting), not just a thrown error.
 */
async function fetchWithProxyFallback(directUrl: string, accept: string): Promise<Response> {
  const attempt = async (url: string) => {
    const res = await fetch(url, { headers: { Accept: accept } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  };

  try {
    return await attempt(directUrl);
  } catch {
    return attempt(toProxyUrl(directUrl));
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${units[i]}`;
}

/** The platform this browser is running on, for ordering the download list. */
export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS reports as Mac; both should be offered the macOS build's context.
  if (/Mac|iPhone|iPad|iPod/i.test(ua)) return "macos";
  if (/Win/i.test(ua)) return "windows";
  if (/Linux|Android|X11/i.test(ua)) return "linux";
  return "other";
}

/**
 * Classify by file extension rather than by a per-release filename regex: the
 * desktop app's update check only ever needs the current platform's asset, but
 * this page lists every asset, and extensions survive release-naming changes.
 */
function classifyAsset(name: string): { platform: Platform; kind: ReleaseAsset["kind"] } {
  const lower = name.toLowerCase();
  if (lower.endsWith(".dmg")) return { platform: "macos", kind: "installer" };
  if (lower.endsWith(".exe")) return { platform: "windows", kind: "installer" };
  if (lower.endsWith(".zip")) return { platform: "windows", kind: "portable" };
  if (lower.endsWith(".appimage")) return { platform: "linux", kind: "portable" };
  if (lower.endsWith(".deb") || lower.endsWith(".rpm")) return { platform: "linux", kind: "package" };
  return { platform: "other", kind: "package" };
}

const PLATFORM_LABELS: Record<Platform, string> = {
  macos: "macOS",
  windows: "Windows",
  linux: "Linux",
  other: "Other",
};

export function platformLabel(platform: Platform): string {
  return PLATFORM_LABELS[platform];
}

interface GithubAssetJson {
  name: string;
  size: number;
  browser_download_url: string;
}

export async function fetchLatestRelease({ owner, repo }: RepoRef): Promise<Release> {
  // `html+json` returns the rendered notes as `body_html` alongside the JSON,
  // so the notes cost no extra request (same header the desktop app uses).
  const res = await fetchWithProxyFallback(
    `${DIRECT.api}/repos/${owner}/${repo}/releases/latest`,
    "application/vnd.github.html+json",
  );
  const data = await res.json();

  const assets: ReleaseAsset[] = (data.assets ?? [])
    .map((asset: GithubAssetJson) => ({
      name: asset.name,
      size: asset.size,
      formattedSize: formatBytes(asset.size),
      url: asset.browser_download_url,
      proxyUrl: toProxyUrl(asset.browser_download_url),
      ...classifyAsset(asset.name),
    }))
    .filter((asset: ReleaseAsset) => asset.platform !== "other");

  return {
    version: String(data.tag_name ?? "").replace(/^v/, ""),
    publishedAt: data.published_at ?? "",
    htmlUrl: data.html_url ?? `${DIRECT.web}/${owner}/${repo}/releases`,
    notesHtml: data.body_html ?? "",
    assets,
  };
}

/**
 * README as GitHub-rendered HTML (already sanitized server-side, and styled by
 * the vendored github-markdown.css). Relative image/link targets in the source
 * markdown resolve against the repo, so they're rewritten to absolute URLs.
 *
 * `branch` only feeds those rewrites. Both repos are on `main`, so it defaults
 * rather than costing a repo-info request per repo against the 60/hour budget.
 */
export async function fetchReadmeHtml({ owner, repo }: RepoRef, branch = "main"): Promise<string> {
  const res = await fetchWithProxyFallback(
    `${DIRECT.api}/repos/${owner}/${repo}/readme`,
    "application/vnd.github.html",
  );
  const html = await res.text();

  const rawBase = `${DIRECT.raw}/${owner}/${repo}/${branch}/`;
  const blobBase = `${DIRECT.web}/${owner}/${repo}/blob/${branch}/`;
  const isAbsolute = (value: string) => /^(https?:)?\/\/|^data:|^#|^mailto:/i.test(value);

  return html
    .replace(/src="([^"]+)"/g, (match, url) => (isAbsolute(url) ? match : `src="${rawBase}${url}"`))
    .replace(/href="([^"]+)"/g, (match, url) => (isAbsolute(url) ? match : `href="${blobBase}${url}"`));
}
