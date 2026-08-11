/**
 * Groups repeats of the same failure into one bucket. Strips uuids and numbers
 * out of the message and route so "engagement abc-123 not found" and
 * "engagement def-456 not found" fingerprint identically.
 *
 * Shared by the browser reporter (error-reporting.ts) and the server logger
 * (error-log.ts), so it lives in its own module with no 'use client' marker.
 */
export function fingerprint(kind: string, message: string, route: string): string {
  const normalized = message
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, ':id')
    .replace(/\d+/g, ':n')
    .slice(0, 200)
  const normalizedRoute = route.replace(/\/[0-9a-f-]{8,}/gi, '/:id').replace(/\/\d+/g, '/:n')
  return `${kind}|${normalizedRoute}|${normalized}`
}
