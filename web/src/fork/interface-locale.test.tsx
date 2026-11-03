type Module = typeof import('./interface-locale') & {
  React: typeof import('react')
  ReactDOM: typeof import('react-dom')
  act: typeof import('react-dom/test-utils').act
}

// React and the renderer must come from the same isolated module registry
// as the module under test, or hooks see two copies of React.
const load = (privateInstance: boolean): Module => {
  process.env.CV_PRIVATE_INSTANCE = privateInstance ? 'true' : ''
  let module: Module
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-var-requires */
    module = {
      ...require('./interface-locale'),
      React: require('react'),
      ReactDOM: require('react-dom'),
      act: require('react-dom/test-utils').act,
    }
    /* eslint-enable @typescript-eslint/no-var-requires */
  })
  return module
}

const languages = {
  isLoading: false,
  translatedLocales: ['en', 'ja', 'ain'],
  contributableLocales: ['ain'],
}

const resolve = (module: Module) => {
  let result: string
  const Probe = (): null => {
    const [locale] = module.useInterfaceLocale(languages.translatedLocales)
    result = locale
    return null
  }
  module.ReactDOM.render(
    module.React.createElement(Probe),
    document.createElement('div')
  )
  return result
}

const setNavigatorLanguages = (languages: string[]) =>
  Object.defineProperty(navigator, 'languages', {
    value: languages,
    configurable: true,
  })

describe('interface locale', () => {
  beforeEach(() => localStorage.clear())
  afterAll(() => {
    delete process.env.CV_PRIVATE_INSTANCE
  })

  it('keeps upstream behaviour by default', () => {
    const module = load(false)
    expect(module.routeLocales(languages)).toEqual(['en', 'ja', 'ain'])
    expect(module.defaultRouteLocale(languages)).toBe('en')
    expect(module.interfaceLocales(['ja', 'en'], 'en')).toEqual(['ja', 'en'])
    expect(module.currentInterfaceLocale()).toBeNull()
  })

  it('uses the contribution language in URLs on private instances', () => {
    const module = load(true)
    expect(module.routeLocales(languages)).toEqual(['ain'])
    expect(module.defaultRouteLocale(languages)).toBe('ain')
    expect(module.interfaceLocales(['ain'], 'ja')).toEqual(['ja'])
  })

  it('defaults the interface to Japanese', () => {
    setNavigatorLanguages(['fr-FR'])
    expect(resolve(load(true))).toBe('ja')
  })

  it('never picks Ainu automatically', () => {
    setNavigatorLanguages(['ain', 'en-US'])
    expect(resolve(load(true))).toBe('en')
  })

  it('remembers the chosen interface language', () => {
    setNavigatorLanguages(['en-US'])
    const module = load(true)
    module.setInterfaceLocale('ain')
    expect(resolve(module)).toBe('ain')
  })

  it('applies the stored choice once the languages have loaded', () => {
    setNavigatorLanguages(['ja-JP'])
    const module = load(true)
    localStorage.setItem('interface-locale', 'en')

    let result: string
    const Probe = ({ available }: { available: string[] }): null => {
      const [locale] = module.useInterfaceLocale(available)
      result = locale
      return null
    }
    const container = document.createElement('div')
    module.act(() => {
      module.ReactDOM.render(
        module.React.createElement(Probe, { available: [] }),
        container
      )
    })
    module.act(() => {
      module.ReactDOM.render(
        module.React.createElement(Probe, {
          available: languages.translatedLocales,
        }),
        container
      )
    })
    expect(result).toBe('en')
  })
})
