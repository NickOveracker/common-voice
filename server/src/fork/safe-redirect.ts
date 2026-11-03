// Only allow redirects to paths on this site. Upstream passes the ?redirect=
// parameter of /login straight to the post-login redirect, so a crafted link
// could send people to another site right after they sign in.
export function safeRedirect(redirect: unknown): string | null {
  if (typeof redirect !== 'string') return null
  // "/path" but not "//host" or "/\host", which browsers treat as other hosts
  return /^\/(?![/\\])/.test(redirect) ? redirect : null
}
