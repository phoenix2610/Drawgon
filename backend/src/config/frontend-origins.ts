/**
 * FRONTEND_URL may list several origins, comma-separated, so the same API can
 * serve more than one deployed frontend at once (e.g. Netlify and Vercel
 * while migrating between them). CORS, better-auth's trustedOrigins and the
 * voice gateway must all agree on this list, or a frontend that passes one
 * check fails another — so they all read it from here.
 */
export function getFrontendOrigins(
  value: string | undefined = process.env.FRONTEND_URL,
): string[] {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return origins.length > 0 ? origins : ['http://localhost:5173'];
}
