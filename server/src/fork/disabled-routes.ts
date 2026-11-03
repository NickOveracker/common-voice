import { Request, Response, NextFunction } from 'express'
import { getForkConfig } from './config'

// Upstream API paths (relative to /api/v1) that send people's data to
// Mozilla's services. With CV_PRIVATE_INSTANCE=true they answer 404.
const DISABLED_PATHS = [
  // Posts the email address to Mozilla's newsletter service
  /^\/newsletter\//,
]

export function disabledRoutesMiddleware(
  request: Request,
  response: Response,
  next: NextFunction
) {
  if (
    getForkConfig().PRIVATE_INSTANCE &&
    DISABLED_PATHS.some(pattern => pattern.test(request.path))
  ) {
    return response.status(404).json({ message: 'not available' })
  }
  next()
}
