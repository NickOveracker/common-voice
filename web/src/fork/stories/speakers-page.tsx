import * as React from 'react'
import { Localized, useLocalization } from '@fluent/react'

import Page from '../../components/ui/page'
import PageHeading from '../../components/ui/page-heading'
import {
  Button,
  LabeledCheckbox,
  LabeledInput,
  LabeledSelect,
  LabeledTextArea,
  Spinner,
} from '../../components/ui/ui'
import {
  addConsent,
  Consent,
  CONSENT_METHODS,
  ConsentMethod,
  createSpeaker,
  getSpeaker,
  listSpeakers,
  Speaker,
  withdrawConsent,
} from './api'

import './stories.css'

const CONSENT_SCOPES = [
  ['archive', 'fork-consent-archive'],
  ['community_use', 'fork-consent-community-use'],
  ['research', 'fork-consent-research'],
  ['speech_technology', 'fork-consent-speech-technology'],
] as const

type Scope = typeof CONSENT_SCOPES[number][0]

const ErrorMessage = ({ message }: { message: string }) => (
  <Localized id="fork-error" vars={{ message }}>
    <p className="fork-stories__error" role="alert" />
  </Localized>
)

const today = () => new Date().toISOString().slice(0, 10)

const ConsentSummary = ({ consent }: { consent: Consent }) => {
  const { l10n } = useLocalization()
  return (
    <div>
      <Localized
        id="fork-speakers-consent-summary"
        vars={{ date: consent.given_on ?? consent.created_at.slice(0, 10) }}>
        <strong />
      </Localized>
      <ul className="fork-stories__consent">
        {CONSENT_SCOPES.map(([scope, id]) => (
          <li key={scope}>
            {consent[scope] ? '✓' : '✗'} {l10n.getString(id)}
          </li>
        ))}
        <li>{l10n.getString(`fork-consent-method-${consent.method}`)}</li>
      </ul>
    </div>
  )
}

const ConsentForm = ({
  speakerId,
  onSaved,
}: {
  speakerId: number
  onSaved: () => void
}) => {
  const { l10n } = useLocalization()
  const [scopes, setScopes] = React.useState<Record<Scope, boolean>>({
    archive: true,
    community_use: false,
    research: false,
    speech_technology: false,
  })
  const [method, setMethod] = React.useState<ConsentMethod>('signed_form')
  const [givenOn, setGivenOn] = React.useState(today())
  const [notes, setNotes] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const save = async () => {
    try {
      await addConsent(speakerId, {
        ...scopes,
        method,
        given_on: givenOn || null,
        notes: notes.trim() || null,
      })
      onSaved()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <form
      className="fork-stories__form"
      onSubmit={event => event.preventDefault()}>
      <Localized id="fork-consent-title">
        <h3 />
      </Localized>
      {CONSENT_SCOPES.map(([scope, id]) => (
        <LabeledCheckbox
          key={scope}
          label={l10n.getString(id)}
          checked={scopes[scope]}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setScopes({ ...scopes, [scope]: event.target.checked })
          }
        />
      ))}
      <LabeledSelect
        label={l10n.getString('fork-consent-method')}
        value={method}
        onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
          setMethod(event.target.value as ConsentMethod)
        }>
        {CONSENT_METHODS.map(option => (
          <option key={option} value={option}>
            {l10n.getString(`fork-consent-method-${option}`)}
          </option>
        ))}
      </LabeledSelect>
      <LabeledInput
        type="date"
        label={l10n.getString('fork-consent-given-on')}
        value={givenOn}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          setGivenOn(event.target.value)
        }
      />
      <LabeledTextArea
        label={l10n.getString('fork-consent-notes')}
        value={notes}
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
          setNotes(event.target.value)
        }
      />
      <Localized id="fork-consent-save">
        <Button rounded onClick={save} />
      </Localized>
      {error && <ErrorMessage message={error} />}
    </form>
  )
}

const SpeakerDetails = ({
  speakerId,
  onChange,
}: {
  speakerId: number
  onChange: () => void
}) => {
  const { l10n } = useLocalization()
  const [speaker, setSpeaker] = React.useState<Speaker | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    getSpeaker(speakerId)
      .then(setSpeaker)
      .catch(e => setError(e.message))
  }, [speakerId])
  React.useEffect(load, [load])

  const withdraw = async (consentId: number) => {
    if (!window.confirm(l10n.getString('fork-consent-withdraw-confirm'))) return
    try {
      await withdrawConsent(speakerId, consentId)
      load()
      onChange()
    } catch (e) {
      setError(e.message)
    }
  }

  if (error) return <ErrorMessage message={error} />
  if (!speaker) return <Spinner isFloating={false} />

  return (
    <div className="fork-stories__details">
      {speaker.full_name && <p>{speaker.full_name}</p>}
      {speaker.notes && <p>{speaker.notes}</p>}
      {speaker.consent && (
        <Localized id="fork-consent-withdraw">
          <Button
            rounded
            outline
            onClick={() => withdraw(speaker.consent.id)}
          />
        </Localized>
      )}
      <ConsentForm
        speakerId={speakerId}
        onSaved={() => {
          load()
          onChange()
        }}
      />
      {speaker.consent_history.length > 0 && (
        <>
          <Localized id="fork-speakers-consent-history">
            <h3 />
          </Localized>
          <ul className="fork-stories__list">
            {speaker.consent_history.map(consent => (
              <li key={consent.id}>
                <ConsentSummary consent={consent} />
                {consent.withdrawn_at && (
                  <Localized
                    id="fork-speakers-withdrawn"
                    vars={{ date: consent.withdrawn_at.slice(0, 10) }}>
                    <p className="fork-stories__status" />
                  </Localized>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

const NewSpeakerForm = ({ onCreated }: { onCreated: () => void }) => {
  const { l10n } = useLocalization()
  const empty = {
    display_name: '',
    full_name: '',
    birth_year: '',
    gender: '',
    region: '',
    notes: '',
  }
  const [fields, setFields] = React.useState(empty)
  const [isSelf, setIsSelf] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const field = (name: keyof typeof empty, labelId: string, props = {}) => (
    <LabeledInput
      label={l10n.getString(labelId)}
      value={fields[name]}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
        setFields({ ...fields, [name]: event.target.value })
      }
      {...props}
    />
  )

  const save = async () => {
    try {
      const orNull = (value: string) => value.trim() || null
      await createSpeaker({
        display_name: fields.display_name.trim(),
        full_name: orNull(fields.full_name),
        birth_year: fields.birth_year ? Number(fields.birth_year) : null,
        gender: orNull(fields.gender),
        region: orNull(fields.region),
        notes: orNull(fields.notes),
        is_self: isSelf,
      })
      setFields(empty)
      setIsSelf(false)
      onCreated()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <form
      className="fork-stories__form"
      onSubmit={event => event.preventDefault()}>
      <Localized id="fork-speakers-add">
        <h2 />
      </Localized>
      {field('display_name', 'fork-speakers-field-display-name', {
        required: true,
        maxLength: 255,
      })}
      <Localized id="fork-speakers-field-display-name-hint">
        <p className="fork-stories__hint" />
      </Localized>
      {field('full_name', 'fork-speakers-field-full-name', { maxLength: 255 })}
      {field('birth_year', 'fork-speakers-field-birth-year', {
        type: 'number',
        min: 1850,
        max: 2100,
      })}
      {field('gender', 'fork-speakers-field-gender', { maxLength: 64 })}
      {field('region', 'fork-speakers-field-region', { maxLength: 255 })}
      <LabeledTextArea
        label={l10n.getString('fork-speakers-field-notes')}
        value={fields.notes}
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
          setFields({ ...fields, notes: event.target.value })
        }
      />
      <LabeledCheckbox
        label={l10n.getString('fork-speakers-field-is-self')}
        checked={isSelf}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          setIsSelf(event.target.checked)
        }
      />
      <Localized id="fork-save">
        <Button rounded disabled={!fields.display_name.trim()} onClick={save} />
      </Localized>
      {error && <ErrorMessage message={error} />}
    </form>
  )
}

const SpeakersPage = () => {
  const [speakers, setSpeakers] = React.useState<Speaker[] | null>(null)
  const [openId, setOpenId] = React.useState<number | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    listSpeakers()
      .then(setSpeakers)
      .catch(e => setError(e.message))
  }, [])
  React.useEffect(load, [load])

  return (
    <Page className="fork-stories" isCentered>
      <PageHeading>
        <Localized id="fork-speakers-title" />
      </PageHeading>
      <Localized id="fork-speakers-intro">
        <p />
      </Localized>
      {error && <ErrorMessage message={error} />}
      {!speakers && !error && <Spinner />}

      <ul className="fork-stories__list">
        {speakers?.map(speaker => (
          <li key={speaker.id} className="fork-stories__card">
            <h2>
              {speaker.display_name}
              {speaker.birth_year && ` (${speaker.birth_year})`}
            </h2>
            {speaker.region && <p>{speaker.region}</p>}
            {speaker.consent ? (
              <ConsentSummary consent={speaker.consent} />
            ) : (
              <Localized id="fork-speakers-no-consent">
                <p className="fork-stories__status" />
              </Localized>
            )}
            {speaker.can_manage && (
              <Button
                rounded
                outline
                aria-expanded={openId === speaker.id}
                onClick={() =>
                  setOpenId(openId === speaker.id ? null : speaker.id)
                }>
                <Localized id="fork-speakers-manage">
                  <span />
                </Localized>{' '}
                <span aria-hidden="true">
                  {openId === speaker.id ? '▲' : '▼'}
                </span>
              </Button>
            )}
            {openId === speaker.id && (
              <SpeakerDetails speakerId={speaker.id} onChange={load} />
            )}
          </li>
        ))}
      </ul>

      <NewSpeakerForm onCreated={load} />
    </Page>
  )
}

export default SpeakersPage
