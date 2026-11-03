import type { MenuConfig } from '../components/layout/nav/contribute-menu'
import type { NavItem } from '../components/layout/nav/nav'
import type { ContributeMenuItem } from '../components/layout/nav/contribute-menu'
import {
  BookmarkIcon,
  ChatBubbleIcon,
  Play,
  UserIcon,
} from '../components/ui/icons'
import URLS from '../urls'
import FORK_URLS from './urls'
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

// Pages added by this fork, appended to upstream menus
const FORK_ITEMS: Partial<Record<NavItem, ContributeMenuItem[]>> = {
  speak: [
    {
      icon: ChatBubbleIcon,
      internalHref: FORK_URLS.STORIES_NEW,
      localizedId: 'fork-menu-record-story',
      menuItemTooltip: 'fork-menu-record-story-tooltip',
      menuItemAriaLabel: 'fork-menu-record-story',
      requiresAuth: true,
      type: 'general',
    },
    {
      icon: BookmarkIcon,
      internalHref: FORK_URLS.PROMPTS,
      localizedId: 'fork-menu-prompts',
      menuItemTooltip: 'fork-menu-prompts-tooltip',
      menuItemAriaLabel: 'fork-menu-prompts',
      requiresAuth: true,
      type: 'general',
    },
    {
      icon: UserIcon,
      internalHref: FORK_URLS.SPEAKERS,
      localizedId: 'fork-menu-speakers',
      menuItemTooltip: 'fork-menu-speakers-tooltip',
      menuItemAriaLabel: 'fork-menu-speakers',
      requiresAuth: true,
      type: 'general',
    },
  ],
  listen: [
    {
      icon: Play,
      internalHref: FORK_URLS.STORIES,
      localizedId: 'fork-menu-stories',
      menuItemTooltip: 'fork-menu-stories-tooltip',
      menuItemAriaLabel: 'fork-menu-stories',
      requiresAuth: true,
      type: 'general',
    },
  ],
}

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
      items: [
        ...(menu.items ?? []).filter(
          item =>
            !item.externalHref &&
            !HIDDEN_INTERNAL_LINKS.includes(item.internalHref)
        ),
        ...(FORK_ITEMS[key] ?? []),
      ],
    }
  }
  return visible as Record<NavItem, MenuConfig>
}
