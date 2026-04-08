export function toGitHubLoginUrl(targetUrl: string): string {
  return `https://github.com/login?return_to=${encodeURIComponent(targetUrl)}`;
}
