/** Returns the URL only when it is an absolute http(s) link; blocks `javascript:` and similar. */
export function safeExternalUrl(value: string | undefined | null): string | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}
