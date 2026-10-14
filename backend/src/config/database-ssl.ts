export type PostgresSsl = false | { rejectUnauthorized: boolean };

export function getDatabaseSsl(
  url: string = process.env.DATABASE_URL ?? '',
): PostgresSsl {
  if (!url) return false;
  if (/sslmode=disable/i.test(url)) return false;

  const isLocal =
    /@(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)[:/]/i.test(url);
  return isLocal ? false : { rejectUnauthorized: false };
}
