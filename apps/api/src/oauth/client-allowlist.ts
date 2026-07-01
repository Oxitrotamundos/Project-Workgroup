// Trust policy de CIMD: solo client_id que sean URL https con hostname EXACTO en la allow-list.
// Es también la mitigación de SSRF (corre antes del fetch server-side del metadata doc).
export function isAllowedClientId(
  clientId: string,
  allowedHosts: string[],
): boolean {
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && allowedHosts.includes(url.hostname);
}
