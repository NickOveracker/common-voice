import * as React from 'react'

import { IS_PRIVATE_INSTANCE } from './config'

const Nothing = (): null => null

// Hides an upstream element on private instances by swapping its tag, so the
// upstream file changes by one name instead of being re-indented:
//
//   const NewsletterCheckbox = hiddenOnPrivateInstance(LabeledCheckbox)
//   <NewsletterCheckbox ...same props... />
export function hiddenOnPrivateInstance<C extends React.ElementType>(
  component: C
): C {
  return IS_PRIVATE_INSTANCE ? (Nothing as unknown as C) : component
}
