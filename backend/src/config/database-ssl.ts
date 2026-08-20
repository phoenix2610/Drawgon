/**
 * Managed Postgres (Supabase, Neon, Railway) terminates TLS and rejects
 * plaintext connections; a local Docker Postgres has no certificate at all.
 * Decide from the host rather than making callers remember which is which.
 *
 * `rejectUnauthorized: false` is what Supabase's own connection snippets use:
 * their pooler presents a certificate Node's default CA bundle does not
 * trust. Traffic is still encrypted, but the server identity is not verified.
 * Supply Supabase's CA via `PGSSLROOTCERT` if you need that guarantee.
 */
export type PostgresSsl = false | { rejectUnauthorized: boolean };

export function getDatabaseSsl(
  url: string = process.env.DATABASE_URL ?? '',
): PostgresSsl {
  if (!url) return false;
  if (/sslmode=disable/i.test(url)) return false;

  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)[:/]/i.test(
    url,
  );
  return isLocal ? false : { rejectUnauthorized: false };
}
