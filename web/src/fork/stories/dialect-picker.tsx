import * as React from 'react'
import { Localized, useLocalization } from '@fluent/react'

import { Button, LabeledInput } from '../../components/ui/ui'
import { createDialect, Dialect, DialectEntry, listDialects } from './api'

// Chooses dialects. Typing a name that isn't listed adds it: speakers say
// what they speak, and admins merge duplicates later.

let suggestionsId = 0

const DialectPicker = ({
  label,
  value,
  onChange,
}: {
  label: string
  value: Dialect[]
  onChange: (dialects: Dialect[]) => void
}) => {
  const { l10n } = useLocalization()
  const [known, setKnown] = React.useState<DialectEntry[]>([])
  const [name, setName] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const listId = React.useMemo(() => `fork-dialects-${++suggestionsId}`, [])

  React.useEffect(() => {
    listDialects()
      .then(setKnown)
      .catch((): null => null)
  }, [])

  const add = async () => {
    if (!name.trim()) return
    setError(null)
    try {
      // The server finds an existing entry with this name, or adds one
      const dialect = await createDialect(name)
      if (!value.some(d => d.id === dialect.id)) {
        onChange([...value, { id: dialect.id, name: dialect.name }])
      }
      setName('')
      listDialects()
        .then(setKnown)
        .catch((): null => null)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="fork-dialects">
      <span className="fork-dialects__label">{label}</span>
      <ul className="fork-dialects__chosen">
        {value.map(dialect => (
          <li key={dialect.id} className="fork-dialects__chip">
            {dialect.name}
            <button
              type="button"
              aria-label={l10n.getString('fork-dialects-remove', {
                name: dialect.name,
              })}
              onClick={() => onChange(value.filter(d => d.id !== dialect.id))}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="fork-dialects__add">
        <LabeledInput
          label={l10n.getString('fork-dialects-add-label')}
          value={name}
          maxLength={255}
          list={listId}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setName(event.target.value)
          }
          onKeyDown={(event: React.KeyboardEvent) => {
            // Not while an input method is composing: Enter confirms there
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              add()
            }
          }}
        />
        <datalist id={listId}>
          {known.flatMap(dialect => [
            <option key={dialect.id} value={dialect.name} />,
            ...dialect.aliases.map(alias => (
              <option key={`${dialect.id}-${alias}`} value={alias}>
                {dialect.name}
              </option>
            )),
          ])}
        </datalist>
        <Localized id="fork-dialects-add">
          <Button rounded outline disabled={!name.trim()} onClick={add} />
        </Localized>
      </div>
      <Localized id="fork-dialects-hint">
        <p className="fork-stories__hint" />
      </Localized>
      {error && (
        <Localized id="fork-error" vars={{ message: error }}>
          <p className="fork-stories__error" role="alert" />
        </Localized>
      )}
    </div>
  )
}

export default DialectPicker
