import * as React from 'react'

import LanguageSelect from '../components/localization-select/language-select'
import { useTypedSelector } from '../stores/tree'
import { IS_PRIVATE_INSTANCE } from './config'
import { useInterfaceLocale } from './interface-locale'

type Props = React.ComponentProps<typeof LanguageSelect>

// On private instances, the header language menu switches the interface
// language only. The contribution language stays in the URL
// (see interface-locale.ts).
const HeaderLanguageSelect = (props: Props) => {
  const languages = useTypedSelector(({ languages }) => languages)
  const [interfaceLocale, setInterfaceLocale] = useInterfaceLocale(
    languages.translatedLocales ?? []
  )

  if (!IS_PRIVATE_INSTANCE) {
    return <LanguageSelect {...props} />
  }

  return (
    <LanguageSelect
      {...props}
      locale={interfaceLocale}
      userLanguages={[]}
      onLocaleChange={setInterfaceLocale}
    />
  )
}

export default HeaderLanguageSelect
