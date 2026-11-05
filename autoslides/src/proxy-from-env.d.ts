// proxy-from-env ships no types. Its one export: the proxy the environment
// (HTTP_PROXY / HTTPS_PROXY / ALL_PROXY, minus NO_PROXY) names for a URL, or ''.
declare module 'proxy-from-env' {
  export function getProxyForUrl(url: string | URL): string;
}
