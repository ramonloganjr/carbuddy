/**
 * Map domain deep links onto app routes.
 *
 * `@carbuddy/domain` emits vehicle-scoped links — `carbuddy://vehicle/<id>/
 * maintenance/<scheduleId>` — because on the server a notification has to name
 * which vehicle it is about. The app's router is organised around resources
 * instead, since the selected vehicle is already app state.
 *
 * Normalising in one place beats scattering redirect routes through the tree:
 * the domain keeps emitting links that make sense on their own, and the router
 * keeps a flat shape, with exactly one function to update when either changes.
 */

const SCHEME = /^carbuddy(-\w+)?:\/\//;

/** Ordered most-specific first; the first match wins. */
const RULES: { pattern: RegExp; route: (groups: string[]) => string }[] = [
  {
    pattern: /^vehicle\/([^/]+)\/maintenance\/record\/([^/]+)$/,
    route: ([, recordId]) => `/maintenance/record/${recordId}`,
  },
  {
    pattern: /^vehicle\/([^/]+)\/maintenance\/([^/]+)$/,
    route: ([, scheduleId]) => `/maintenance/${scheduleId}`,
  },
  {
    pattern: /^vehicle\/([^/]+)\/components\/([^/]+)$/,
    route: ([, componentId]) => `/components/${componentId}`,
  },
  {
    pattern: /^vehicle\/([^/]+)\/fuel\/insights$/,
    route: ([vehicleId]) => `/vehicle/${vehicleId}/health`,
  },
  {
    pattern: /^vehicle\/([^/]+)\/fuel\/([^/]+)$/,
    route: ([, recordId]) => `/fuel/${recordId}`,
  },
  {
    pattern: /^vehicle\/([^/]+)\/expenses\/([^/]+)$/,
    route: ([vehicleId]) => `/vehicle/${vehicleId}/analytics`,
  },
  {
    pattern: /^vehicle\/([^/]+)\/(analytics|health)$/,
    route: ([vehicleId, section]) => `/vehicle/${vehicleId}/${section}`,
  },
  { pattern: /^vehicle\/([^/]+)$/, route: ([vehicleId]) => `/vehicle/${vehicleId}` },
  { pattern: /^documents\/([^/]+)$/, route: ([documentId]) => `/documents/${documentId}` },
  { pattern: /^reminders\/([^/]+)$/, route: () => '/(tabs)' },
];

/**
 * Returns an app route, or null when the link cannot be resolved.
 *
 * Null rather than a guess: navigating somewhere arbitrary because a link did
 * not parse is more confusing than not navigating at all, and the caller can
 * fall back to the dashboard deliberately.
 */
export function resolveDeepLink(url: string | undefined): string | null {
  if (!url) return null;

  const path = url.replace(SCHEME, '').replace(/^\//, '').split('?')[0] ?? '';
  if (path.length === 0) return '/(tabs)';

  for (const rule of RULES) {
    const match = rule.pattern.exec(path);
    if (match) {
      const groups = match.slice(1).filter((value): value is string => value !== undefined);
      return rule.route(groups);
    }
  }

  // Anything else is passed through as-is; expo-router will render the
  // not-found screen if it does not exist, which is the honest outcome.
  return `/${path}`;
}
