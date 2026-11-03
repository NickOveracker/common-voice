import * as React from 'react'

import { Prompt } from './api'

// A prompt in Japanese, with its Ainu version if there is one
const PromptText = ({
  prompt,
}: {
  prompt: Pick<Prompt, 'text_ja' | 'text_ain'>
}) => (
  <>
    <span lang="ja">{prompt.text_ja}</span>
    {prompt.text_ain && (
      <span className="fork-prompts__ain" lang="ain">
        {prompt.text_ain}
      </span>
    )}
  </>
)

export default PromptText
