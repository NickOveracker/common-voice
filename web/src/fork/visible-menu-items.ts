import type { MenuConfig } from '../components/layout/nav/contribute-menu'
import type { NavItem } from '../components/layout/nav/nav'
import URLS from '../urls'
import { IS_PRIVATE_INSTANCE } from './config'

// Upstream pages that are hidden on private instances: Mozilla's own content,
// public datasets, and links to Mozilla's spontaneous speech service.
// See also HIDDEN_PAGES in private-routes.tsx.
const HIDDEN_INTERNAL_LINKS: string[] = [
  URLS.ABOUT,
  URLS.PARTNER,
  URLS.LANGUAGES,
]

const HIDDEN_MENUS: NavItem[] = ['download', 'about']

// Hidden menus are left out of the returned object entirely.
export function visibleMenuItems(
  menuItems: Record<NavItem, MenuConfig>
): Record<NavItem, MenuConfig> {
  if (!IS_PRIVATE_INSTANCE) return menuItems

  const visible: Partial<Record<NavItem, MenuConfig>> = {}
  for (const [key, menu] of Object.entries(menuItems) as [
    NavItem,
    MenuConfig
  ][]) {
    if (HIDDEN_MENUS.includes(key)) continue
    visible[key] = {
      ...menu,
      items: menu.items?.filter(
        item =>
          !item.externalHref &&
          !HIDDEN_INTERNAL_LINKS.includes(item.internalHref)
      ),
    }
  }
  return visible as Record<NavItem, MenuConfig>
}
