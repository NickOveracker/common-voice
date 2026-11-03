// Settings for self-hosted, private deployments, fixed at build time.
// See server/src/fork/config.ts for the server side.

// Build without analytics, donation widgets or Mozilla branding, and treat
// this site as the production site.
export const IS_PRIVATE_INSTANCE = process.env.CV_PRIVATE_INSTANCE === 'true'

// Where requests that upstream sends to Mozilla (e.g. account deletion) go.
export const CONTACT_EMAIL =
  process.env.CV_CONTACT_EMAIL || 'commonvoice@mozilla.com'
