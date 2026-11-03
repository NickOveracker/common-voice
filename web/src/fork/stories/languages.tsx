import * as React from 'react'
import { Localized } from '@fluent/react'

import { RecordingLanguage } from './api'

// "Ainu", "Japanese", or "Mixed" for recordings in both
export const RecordingLanguages = ({
  languages,
}: {
  languages: RecordingLanguage[]
}) =>
  languages.length > 1 ? (
    <Localized id="fork-language-mixed">
      <span />
    </Localized>
  ) : (
    <Localized id={languages[0]}>
      <span />
    </Localized>
  )
