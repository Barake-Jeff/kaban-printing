// Web push makes the server POST to a URL the browser hands us, so only browser push
// services are accepted (OWASP API7, SSRF). Add a host here if a supported browser uses
// another push service; subscriptions from unlisted services are refused with a 400.
const EXACT_HOSTS = new Set([
  'fcm.googleapis.com',                  // Chrome, Android, Opera, Brave, Samsung Internet
  'updates.push.services.mozilla.com',   // Firefox
  'web.push.apple.com',                  // Safari (macOS + iOS)
]);
// Edge delivers through WNS on per-region hosts (wns2-xxx.notify.windows.com).
// The leading dot keeps "evilnotify.windows.com" from matching.
const HOST_SUFFIXES = ['.notify.windows.com'];

/**
 * True only for an https URL on the default port, with no credentials, whose host is a
 * known browser push service. Used by SubscribeDto and again before every send, so rows
 * stored before this check existed can't be used either.
 */
export function isAllowedPushEndpoint(value: unknown): boolean {
  if (typeof value !== 'string') return false;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  // web-push sends with Node's legacy url.parse(), which reads some inputs differently:
  // "https:fcm.googleapis.com/x" is FCM to new URL() but has no host for url.parse(), and
  // https.request then defaults to localhost. Browsers always hand over the canonical
  // serialisation, so requiring it exactly leaves no room for the two parsers to disagree.
  if (url.href !== value) return false;

  if (url.protocol !== 'https:' || url.port !== '' || url.username || url.password) return false;

  const host = url.hostname.toLowerCase();
  return EXACT_HOSTS.has(host) || HOST_SUFFIXES.some(suffix => host.endsWith(suffix));
}
