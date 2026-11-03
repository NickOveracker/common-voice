import { Request, Response, NextFunction } from 'express'
import { getForkConfig } from './config'

// With CV_REQUIRE_LOGIN=true, only people who signed in through the identity
// provider can use the API. Anonymous visitors can load the site shell and
// its translations, nothing else.

// API paths (relative to /api/v1) needed to render the site before sign-in.
// Anything not listed here, including endpoints added upstream later, is
// closed to anonymous visitors by default.
const ANONYMOUS_PATHS = [
  /^\/ping$/,
  /^\/user_clients?$/,
  /^\/languages$/,
  /^\/languages\/[^/]+\/translations$/,
  /^\/available_languages$/,
  /^\/server_date$/,
]

function isLoggedIn(request: Request): boolean {
  return Boolean(request.session?.user?.email)
}

// Whether the browser-generated (Basic auth) client id may be used. Signed in
// users still need it until they have finished creating their profile.
export function allowsAnonymousClient(request: Request): boolean {
  return !getForkConfig().REQUIRE_LOGIN || isLoggedIn(request)
}

export function requireLoginMiddleware(
  request: Request,
  response: Response,
  next: NextFunction
) {
  if (
    !getForkConfig().REQUIRE_LOGIN ||
    isLoggedIn(request) ||
    (request.method === 'GET' &&
      ANONYMOUS_PATHS.some(pattern => pattern.test(request.path)))
  ) {
    return next()
  }
  // 403 rather than 401: the web client reloads the page on 401, which would
  // loop for visitors who haven't signed in
  response.status(403).json({ message: 'login required' })
}
