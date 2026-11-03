import { Request, Response } from 'express'

const loadMiddleware = (requireLogin: boolean) => {
  process.env.CV_REQUIRE_LOGIN = requireLogin ? 'true' : ''
  let module: typeof import('../../fork/require-login')
  jest.isolateModules(() => {
    module = require('../../fork/require-login')
  })
  return module
}

const run = (
  requireLogin: boolean,
  request: { method: string; path: string; email?: string }
) => {
  const { requireLoginMiddleware } = loadMiddleware(requireLogin)
  const next = jest.fn()
  const json = jest.fn()
  const response = { status: jest.fn(() => ({ json })) }
  requireLoginMiddleware(
    {
      method: request.method,
      path: request.path,
      session: request.email ? { user: { email: request.email } } : {},
    } as unknown as Request,
    response as unknown as Response,
    next
  )
  return { next, status: response.status }
}

describe('requireLoginMiddleware', () => {
  afterAll(() => {
    delete process.env.CV_REQUIRE_LOGIN
  })

  it('lets everything through when login is not required', () => {
    const { next } = run(false, { method: 'GET', path: '/clips' })
    expect(next).toHaveBeenCalled()
  })

  it('rejects anonymous requests for data', () => {
    for (const path of [
      '/clips',
      '/ain/clips',
      '/statistics/clips',
      '/datasets',
    ]) {
      const { next, status } = run(true, { method: 'GET', path })
      expect(next).not.toHaveBeenCalled()
      expect(status).toHaveBeenCalledWith(401)
    }
  })

  it('rejects anonymous writes even to allowed paths', () => {
    const { status } = run(true, { method: 'POST', path: '/languages' })
    expect(status).toHaveBeenCalledWith(401)
  })

  it('allows what the site needs before sign-in', () => {
    for (const path of [
      '/languages',
      '/languages/ain/translations',
      '/user_client',
    ]) {
      const { next } = run(true, { method: 'GET', path })
      expect(next).toHaveBeenCalled()
    }
  })

  it('lets signed-in users through', () => {
    const { next } = run(true, {
      method: 'POST',
      path: '/ain/clips',
      email: 'speaker@example.org',
    })
    expect(next).toHaveBeenCalled()
  })

  it('only accepts anonymous client ids for signed-in users', () => {
    const { allowsAnonymousClient } = loadMiddleware(true)
    expect(allowsAnonymousClient({ session: {} } as unknown as Request)).toBe(
      false
    )
    expect(
      allowsAnonymousClient({
        session: { user: { email: 'speaker@example.org' } },
      } as unknown as Request)
    ).toBe(true)
  })
})
