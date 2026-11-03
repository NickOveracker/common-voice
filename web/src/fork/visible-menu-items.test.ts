import { menuItems } from '../components/layout/nav/menu-items'
import FORK_URLS from './urls'

const loadVisibleMenuItems = (privateInstance: boolean) => {
  process.env.CV_PRIVATE_INSTANCE = privateInstance ? 'true' : ''
  let module: typeof import('./visible-menu-items')
  jest.isolateModules(() => {
    module = require('./visible-menu-items')
  })
  return module.visibleMenuItems
}

describe('visibleMenuItems', () => {
  afterAll(() => {
    delete process.env.CV_PRIVATE_INSTANCE
  })

  it('keeps all menus upstream', () => {
    expect(loadVisibleMenuItems(false)(menuItems)).toBe(menuItems)
  })

  it('hides Mozilla menus and external links on private instances', () => {
    const visible = loadVisibleMenuItems(true)(menuItems)
    expect(Object.keys(visible)).toEqual(['speak', 'listen'])

    const items = Object.values(visible).flatMap(menu => menu.items)
    expect(items.some(item => item.externalHref)).toBe(false)
    expect(items.map(item => item.internalHref)).toEqual([
      FORK_URLS.STORIES_NEW,
      FORK_URLS.PROMPTS,
      FORK_URLS.SPEAKERS,
      FORK_URLS.STORIES,
    ])
  })
})
