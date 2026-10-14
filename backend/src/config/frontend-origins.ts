export function getFrontendOrigins(
  value: string | undefined = process.env.FRONTEND_URL,
): string[] {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return origins.length > 0 ? origins : ['http://localhost:5173'];
}
