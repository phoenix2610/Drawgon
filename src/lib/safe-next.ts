export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  if (value.startsWith('/login') || value.startsWith('/signup')) return '/';
  return value;
}
