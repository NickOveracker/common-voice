import * as React from 'react'
import { Localized, useLocalization } from '@fluent/react'

import { Button, LabeledInput, LabeledSelect } from '../../components/ui/ui'
import {
  DialectEntry,
  listDialects,
  mergeDialect,
  renameDialect,
  StoriesApiError,
} from '../stories/api'

// Tidying up dialects, which anyone can add: renaming entries, and merging
// two that are the same. A merged name stays as an alias, so it still finds
// the entry.

const DialectRow = ({
  dialect,
  others,
  onChanged,
}: {
  dialect: DialectEntry
  others: DialectEntry[]
  onChanged: () => void
}) => {
  const { l10n } = useLocalization()
  const [name, setName] = React.useState(dialect.name)
  const [intoId, setIntoId] = React.useState<number | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const run = async (action: () => Promise<unknown>) => {
    setError(null)
    try {
      await action()
      onChanged()
    } catch (e) {
      setError(
        e instanceof StoriesApiError && e.status === 409
          ? l10n.getString('fork-dialects-name-taken', {
              name: e.body?.dialect?.name ?? name,
            })
          : e.message
      )
    }
  }

  const into = others.find(other => other.id === intoId)

  return (
    <li className="fork-stories__card fork-dialects__entry">
      <div className="fork-review__comment">
        <LabeledInput
          label={l10n.getString('fork-dialects-name')}
          value={name}
          maxLength={255}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setName(event.target.value)
          }
        />
        <Localized id="fork-dialects-rename">
          <Button
            rounded
            outline
            disabled={!name.trim() || name.trim() === dialect.name}
            onClick={() => run(() => renameDialect(dialect.id, name.trim()))}
          />
        </Localized>
      </div>
      <Localized
        id="fork-dialects-counts"
        vars={{ speakers: dialect.speakers, recordings: dialect.recordings }}>
        <p className="fork-stories__meta" />
      </Localized>
      {dialect.aliases.length > 0 && (
        <Localized
          id="fork-dialects-aliases"
          vars={{ aliases: dialect.aliases.join(', ') }}>
          <p className="fork-stories__meta" />
        </Localized>
      )}
      {others.length > 0 && (
        <div className="fork-review__comment">
          <LabeledSelect
            label={l10n.getString('fork-dialects-merge-into')}
            value={intoId ?? ''}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
              setIntoId(Number(event.target.value) || null)
            }>
            <option value="" />
            {others.map(other => (
              <option key={other.id} value={other.id}>
                {other.name}
              </option>
            ))}
          </LabeledSelect>
          <Localized id="fork-dialects-merge">
            <Button
              rounded
              outline
              disabled={!into}
              onClick={() => {
                const confirmed = window.confirm(
                  l10n.getString('fork-dialects-merge-confirm', {
                    from: dialect.name,
                    into: into.name,
                  })
                )
                if (confirmed) run(() => mergeDialect(dialect.id, into.id))
              }}
            />
          </Localized>
        </div>
      )}
      {error && (
        <Localized id="fork-error" vars={{ message: error }}>
          <p className="fork-stories__error" role="alert" />
        </Localized>
      )}
    </li>
  )
}

const DialectsAdmin = () => {
  const [dialects, setDialects] = React.useState<DialectEntry[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    listDialects()
      .then(setDialects)
      .catch(e => setError(e.message))
  }, [])
  React.useEffect(load, [load])

  return (
    <section className="fork-dialects__admin">
      <Localized id="fork-dialects-title">
        <h2 />
      </Localized>
      <Localized id="fork-dialects-admin-intro">
        <p />
      </Localized>
      {error && (
        <Localized id="fork-error" vars={{ message: error }}>
          <p className="fork-stories__error" role="alert" />
        </Localized>
      )}
      {dialects?.length === 0 && (
        <Localized id="fork-dialects-none">
          <p />
        </Localized>
      )}
      <ul className="fork-stories__list">
        {dialects?.map(dialect => (
          <DialectRow
            // Remount after a rename or merge, so the name box shows it
            key={`${dialect.id}-${dialect.name}-${dialect.aliases.length}`}
            dialect={dialect}
            others={dialects.filter(other => other.id !== dialect.id)}
            onChanged={load}
          />
        ))}
      </ul>
    </section>
  )
}

export default DialectsAdmin
