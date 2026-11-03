import * as React from 'react'
import { Localized, useLocalization } from '@fluent/react'

import Page from '../../components/ui/page'
import PageHeading from '../../components/ui/page-heading'
import {
  Button,
  LabeledTextArea,
  LinkButton,
  Spinner,
} from '../../components/ui/ui'
import FORK_URLS from '../urls'
import {
  createPrompt,
  getOwnRoles,
  listPrompts,
  Prompt,
  updatePrompt,
} from './api'

import PromptText from './prompt-text'

import './stories.css'

// Prompts for stories: approved ones to record from, a form to suggest new
// ones, and for moderators the suggestions waiting for a decision.

const ErrorMessage = ({ message }: { message: string }) => (
  <Localized id="fork-error" vars={{ message }}>
    <p className="fork-stories__error" role="alert" />
  </Localized>
)

const SuggestForm = ({ onCreated }: { onCreated: () => void }) => {
  const { l10n } = useLocalization()
  const [textJa, setTextJa] = React.useState('')
  const [textAin, setTextAin] = React.useState('')
  const [sent, setSent] = React.useState<Prompt['status'] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async () => {
    setError(null)
    try {
      const { status } = await createPrompt({
        text_ja: textJa.trim(),
        text_ain: textAin.trim() || null,
      })
      setTextJa('')
      setTextAin('')
      setSent(status)
      onCreated()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <form
      className="fork-stories__form"
      onSubmit={event => event.preventDefault()}>
      <Localized id="fork-prompts-suggest">
        <h2 />
      </Localized>
      <LabeledTextArea
        label={l10n.getString('fork-prompts-field-ja')}
        required
        maxLength={1000}
        value={textJa}
        lang="ja"
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
          setSent(null)
          setTextJa(event.target.value)
        }}
      />
      <LabeledTextArea
        label={l10n.getString('fork-prompts-field-ain')}
        maxLength={1000}
        value={textAin}
        lang="ain"
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
          setTextAin(event.target.value)
        }
      />
      <Localized id="fork-prompts-send">
        <Button rounded disabled={!textJa.trim()} onClick={submit} />
      </Localized>
      {sent && (
        <Localized
          id={
            sent === 'approved'
              ? 'fork-prompts-sent-approved'
              : 'fork-prompts-sent-pending'
          }>
          <p className="fork-stories__status" role="status" />
        </Localized>
      )}
      {error && <ErrorMessage message={error} />}
    </form>
  )
}

const PromptsPage = () => {
  const [prompts, setPrompts] = React.useState<Prompt[] | null>(null)
  const [isModerator, setIsModerator] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(() => {
    listPrompts()
      .then(setPrompts)
      .catch(e => setError(e.message))
  }, [])

  React.useEffect(() => {
    load()
    getOwnRoles()
      .then(({ roles }) =>
        setIsModerator(roles.includes('moderator') || roles.includes('admin'))
      )
      .catch((): null => null)
  }, [load])

  const decide = async (id: number, status: Prompt['status']) => {
    setError(null)
    try {
      await updatePrompt(id, { status })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  const approved = prompts?.filter(p => p.status === 'approved') ?? []
  const others = prompts?.filter(p => p.status !== 'approved') ?? []

  return (
    <Page className="fork-stories fork-prompts" isCentered>
      <PageHeading>
        <Localized id="fork-prompts-title" />
      </PageHeading>
      <Localized id="fork-prompts-intro">
        <p />
      </Localized>
      {error && <ErrorMessage message={error} />}
      {!prompts && !error && <Spinner />}
      {prompts && approved.length === 0 && (
        <Localized id="fork-prompts-empty">
          <p />
        </Localized>
      )}
      <ul className="fork-stories__list">
        {approved.map(prompt => (
          <li key={prompt.id} className="fork-stories__card fork-prompts__card">
            <p className="fork-prompts__text">
              <PromptText prompt={prompt} />
            </p>
            <div className="fork-stories__card-actions">
              <Localized id="fork-prompts-record">
                <LinkButton
                  rounded
                  outline
                  to={`${FORK_URLS.STORIES_NEW}?prompt=${prompt.id}`}
                />
              </Localized>
              {prompt.recordings > 0 && (
                <Localized
                  id="fork-prompts-recordings"
                  vars={{ count: prompt.recordings }}>
                  <span className="fork-stories__meta" />
                </Localized>
              )}
              {isModerator && (
                <Localized id="fork-prompts-withdraw">
                  <button
                    type="button"
                    className="fork-transcribe__link"
                    onClick={() => decide(prompt.id, 'rejected')}
                  />
                </Localized>
              )}
            </div>
          </li>
        ))}
      </ul>

      {others.length > 0 && (
        <>
          <Localized
            id={isModerator ? 'fork-prompts-to-decide' : 'fork-prompts-yours'}>
            <h2 />
          </Localized>
          <ul className="fork-stories__list">
            {others.map(prompt => (
              <li
                key={prompt.id}
                className="fork-stories__card fork-prompts__card">
                <p className="fork-prompts__text">
                  <PromptText prompt={prompt} />
                </p>
                <div className="fork-stories__card-actions">
                  <Localized id={`fork-prompts-status-${prompt.status}`}>
                    <span className="fork-stories__meta" />
                  </Localized>
                  {isModerator && (
                    <>
                      <Localized id="fork-prompts-approve">
                        <Button
                          rounded
                          outline
                          onClick={() => decide(prompt.id, 'approved')}
                        />
                      </Localized>
                      {prompt.status === 'pending' && (
                        <Localized id="fork-prompts-reject">
                          <Button
                            rounded
                            outline
                            onClick={() => decide(prompt.id, 'rejected')}
                          />
                        </Localized>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <SuggestForm onCreated={load} />
    </Page>
  )
}

export default PromptsPage
