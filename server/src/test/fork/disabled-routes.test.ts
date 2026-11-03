import { Request, Response } from 'express'

const run = (privateInstance: boolean, path: string) => {
  process.env.CV_PRIVATE_INSTANCE = privateInstance ? 'true' : ''
  let module: typeof import('../../fork/disabled-routes')
  jest.isolateModules(() => {
    module = require('../../fork/disabled-routes')
  })
  const next = jest.fn()
  const json = jest.fn()
  const response = { status: jest.fn(() => ({ json })) }
  module.disabledRoutesMiddleware(
    { method: 'POST', path } as unknown as Request,
    response as unknown as Response,
    next
  )
  return { next, status: response.status }
}

describe('disabledRoutesMiddleware', () => {
  afterAll(() => {
    delete process.env.CV_PRIVATE_INSTANCE
  })

  it('keeps the newsletter sign-up upstream', () => {
    const { next } = run(false, '/newsletter/someone@example.org')
    expect(next).toHaveBeenCalled()
  })

  it('turns off the newsletter sign-up on a private instance', () => {
    const { next, status } = run(true, '/newsletter/someone@example.org')
    expect(next).not.toHaveBeenCalled()
    expect(status).toHaveBeenCalledWith(404)
  })

  it('leaves other routes alone on a private instance', () => {
    const { next } = run(true, '/user_client')
    expect(next).toHaveBeenCalled()
  })
})
