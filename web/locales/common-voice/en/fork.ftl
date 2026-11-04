# Strings added by this fork (kept out of upstream files to avoid merge conflicts)

## Sign-in gate
fork-sign-in-title = Please sign in
fork-sign-in-body = This voice repository is only open to registered members. Sign in to record, listen and review.
fork-sign-in-button = Sign in

## Menu
fork-menu-record-story = Record a story
fork-menu-record-story-tooltip = Record or upload a story, conversation or interview
fork-menu-stories = Stories
fork-menu-stories-tooltip = Listen to recorded stories
fork-menu-speakers = Speakers
fork-menu-speakers-tooltip = People who are recorded, and their consent

## Shared
fork-language-mixed = Mixed
fork-interface-language-label = Changes the interface language only
fork-save = Save
fork-cancel = Cancel
fork-loading = Loading…
fork-error = Something went wrong: { $message }
fork-optional = (optional)

## Errors from the server, in place of its own short English messages
## (fork-api-error-<the message as a slug>, see fork/stories/api.ts)
fork-api-error-not-the-current-version = Someone else changed this in the meantime. Reload the page to see their version.
fork-api-error-changed-meanwhile = Someone else saved this in the meantime. Their version is shown; add your changes to it.
fork-api-error-cannot-review-your-own-version = You can't check a version you wrote yourself.
fork-api-error-nothing-to-review = There is nothing to check yet.
fork-api-error-unknown-prompt = That prompt doesn't exist or hasn't been approved yet.
fork-api-error-unknown-dialect = That dialect no longer exists. Reload the page and choose again.
fork-api-error-recording-is-no-longer-accepting-audio = This recording can't take any more audio.
fork-api-error-empty-chunk = A piece of the audio arrived empty. Please try again.
fork-api-error-recording-is-too-large = The recording is too large.
fork-api-error-recording-is-already-complete = This recording is already complete.
fork-api-error-missing-chunks = Part of the audio didn't arrive. Please upload it again.
fork-api-error-cannot-remove-your-own-admin-role = You can't remove your own admin role.
fork-api-error-unknown-user = That member doesn't exist.
fork-api-error-admin-role-required = Only admins can do this.
fork-api-error-moderator-role-required = Only moderators can do this.
fork-api-error-reviewer-role-required = Only reviewers can do this.
fork-api-error-already-transcribed = Segments can't be detected again once something has been transcribed. Adjust them by hand instead.
fork-api-error-name-is-required = Enter a name.
fork-api-error-another-dialect-has-this-name = Another dialect already has this name.
fork-api-error-segment-is-not-in-this-recording = That segment isn't part of this recording. Reload the page.
fork-api-error-you-already-have-a-speaker-profile = You already have a speaker entry for yourself.
fork-api-error-text-ja-is-required = Enter the Japanese text.
fork-api-status-400 = Something in the form isn't right. Check it and try again.
fork-api-status-401 = You've been signed out. Sign in again.
fork-api-status-403 = You don't have permission to do this.
fork-api-status-404 = Not found. It may have been deleted; reload the page.
fork-api-status-409 = Someone else changed this in the meantime. Reload the page.
fork-api-status-413 = The file is too large.
fork-api-status-other = The server couldn't do this. Try again in a moment.

## Error page, without Mozilla's community links
fork-error-page-content-404 = It may have moved or been deleted. Go back to the <homepageLink>home page</homepageLink>.
fork-error-page-content = Reload the page, or go back to the <homepageLink>home page</homepageLink>. If it keeps happening, tell the archive's admins.

## Deleting your account, about this archive rather than Mozilla's dataset
fork-delete-q = When your account is deleted, would you like to ask for your recordings to be deleted too, or kept in the archive?
fork-keep-info = Your recordings stay in the archive, under their speakers' consent as before.
fork-remove-info = The archive's admins will review your request and let you know what they do.

## Stories list
fork-stories-title = Stories
fork-stories-new = New recording
fork-stories-speakers = Speakers
fork-stories-filter-all = All
fork-stories-filter-mine = Mine
fork-stories-empty = No recordings yet.
fork-stories-recorded-on = Recorded: { $date }
fork-stories-location = Place: { $location }
fork-stories-duration = Length: { $duration }
fork-stories-status-uploading = Upload not finished
fork-stories-status-processing = Processing…
fork-stories-status-failed = Processing failed
fork-stories-download-original = Download original
fork-stories-transcribe = Transcribe and translate
fork-stories-progress = { $segments ->
        [one] 1 segment
       *[other] { $segments } segments
    } · transcribed in Latin letters { $latin }, katakana { $kana }{ $japanese ->
        [0] {""}
       *[other] , Japanese { $japanese }
    } · translated into Japanese { $translated }
fork-stories-save-partial = Save the part that was uploaded
fork-stories-resume-upload = Choose the file again to resume the upload

## New recording
fork-new-title = New recording
fork-new-details = About the recording
fork-new-field-title = Title
fork-new-field-description = Description
fork-new-field-languages = Languages spoken
fork-new-field-languages-hint = Choose both for recordings that mix Ainu and Japanese.
fork-new-field-speakers = Speakers
fork-new-field-speakers-hint = Only speakers whose consent to archive is recorded can be chosen.
fork-new-no-speakers = No speakers you can record yet. Add a speaker and their consent first.
fork-new-speaker-no-consent = no consent recorded
fork-new-field-recorded-on = Date recorded
fork-new-field-recorded-on-hint = Year, year and month, or full date, e.g. 1972, 1972-08 or 1972-08-15. Leave empty if unknown.
fork-new-field-location = Place recorded
fork-new-field-location-hint = Leave empty if unknown or if the place should not be stored.
fork-new-how = How do you want to add the audio?
fork-new-record = Record now
fork-new-upload = Upload a file
fork-new-continue = Continue

## Recorder
fork-recorder-start = Start recording
fork-recorder-pause = Pause
fork-recorder-resume = Resume
fork-recorder-finish = Finish
fork-recorder-elapsed = Recorded: { $duration }
fork-recorder-uploaded = Saved to the server: { $count } parts
fork-recorder-uploading = Saving…
fork-recorder-finishing = Saving the last part…
fork-recorder-unsupported = This browser can't record audio. Please use a recent Chrome, Firefox or Safari.
fork-recorder-keep-open = Keep this page open while recording. Audio is saved every 30 seconds.

## Upload
fork-upload-choose = Choose an audio file
fork-upload-progress = Uploaded { $percent }%
fork-upload-start = Upload

## Done
fork-new-done = Saved. The recording will be ready to play in a few minutes.
fork-new-back = Back to stories

## Speakers
fork-speakers-title = Speakers
fork-speakers-intro = People who are recorded. They don't need an account: facilitators can add the elders they record. Real names are only shown to whoever added the speaker and to moderators.
fork-speakers-add = Add a speaker
fork-speakers-field-display-name = Name shown to others
fork-speakers-field-display-name-hint = A nickname or initials is fine.
fork-speakers-field-full-name = Real name
fork-speakers-field-birth-year = Year of birth
fork-speakers-field-gender = Gender
fork-speakers-field-region = Region (where they live or grew up)
fork-speakers-field-notes = Notes
fork-speakers-field-is-self = This is me
fork-speakers-manage = Details and consent
fork-speakers-no-consent = No consent recorded
fork-speakers-consent-summary = Consent ({ $date })
fork-speakers-consent-history = Consent history
fork-speakers-withdrawn = withdrawn { $date }

## Consent
fork-consent-title = Record consent
fork-consent-archive = Keep the recordings in the community archive
fork-consent-community-use = Use within the community (e.g. teaching, events)
fork-consent-research = Use for research
fork-consent-speech-technology = Use to build speech technology (e.g. speech recognition)
fork-consent-method = How was consent given?
fork-consent-method-signed_form = Signed form
fork-consent-method-recorded_statement = Recorded statement
fork-consent-method-verbal = Verbally
fork-consent-method-family_or_community = By family or community (e.g. for archived recordings)
fork-consent-method-other = Other
fork-consent-given-on = Date given
fork-consent-notes = Notes
fork-consent-save = Save consent
fork-consent-withdraw = Withdraw consent
fork-consent-withdraw-confirm = Withdraw this consent? New recordings of this speaker won't be possible until consent is recorded again.

## Transcribing a recording
fork-transcribe-back-to-stories = ← All stories
fork-transcribe-play = Play
fork-transcribe-pause = Pause
fork-transcribe-play-segment = Play segment { $number }
fork-transcribe-back = −{ $seconds } s
fork-transcribe-forward = +{ $seconds } s
fork-transcribe-speed = Speed
fork-transcribe-loop = Repeat the segment
fork-transcribe-help = ▶ on a segment plays it and stops at its end. While typing, Esc plays or pauses the segment. “Split here” and “End here” use the playback position.
fork-transcribe-speaker = Speaker
fork-transcribe-speaker-unset = (not set)
fork-transcribe-transcription-latin = Transcription (Latin letters)
fork-transcribe-transcription-kana = Transcription (katakana)
fork-transcribe-transcription-ja = Transcription (Japanese)
fork-transcribe-japanese-within = Write any Japanese in the transcriptions as Japanese.
fork-transcribe-translation-ja = Japanese translation
fork-transcribe-translation-en = English translation
fork-transcribe-add-english = + Add an English translation
fork-transcribe-saved = Saved
fork-transcribe-conflict = Someone else saved “{ $field }” first: “{ $text }”. Your text is still in the box; saving again replaces theirs.
fork-transcribe-split = Split here
fork-transcribe-end-here = End here
fork-transcribe-merge = Merge with next
fork-transcribe-no-segments = This recording has no segments yet.
fork-transcribe-detect = Find segments automatically
fork-transcribe-detecting = Finding segments… Long recordings take a while.

## Reviewing transcripts
fork-review-unreviewed = Not checked yet
fork-review-approved = ✓ Checked
fork-review-needs-work = Needs work
fork-review-needs-work-comment = Needs work: { $comment }
fork-review-approve = Mark as checked
fork-review-request-changes = Needs work…
fork-review-comment = What needs fixing (optional)
fork-review-send = Send
fork-review-history = Earlier versions
fork-review-history-hide = Hide earlier versions
fork-review-mine = (you)
fork-review-restore = Use this version
fork-review-filter = Only segments that need checking
fork-stories-review-progress = { $approved } checked · { $needsWork ->
        [one] 1 needs work
       *[other] { $needsWork } need work
    }

## Admin
fork-home-intro = A place for the Ainu community to keep its spoken stories, conversations and memories, and to transcribe and translate them together. Only members can see what is here.
fork-admin-title = Admin
fork-admin-only = Only admins can see this page.
fork-admin-roles-intro = Anyone signed in can record, transcribe and translate. Roles add the following:
fork-role-admin = Admin
fork-role-admin-description = gives and removes roles, and can do everything
fork-role-moderator = Moderator
fork-role-moderator-description = looks after recordings and speakers, and can review
fork-role-reviewer = Reviewer
fork-role-reviewer-description = checks transcriptions and translations
fork-admin-filter = Search by name or email
fork-admin-user = Member
fork-admin-role-for = { $role }: { $user }
fork-admin-configured = Admin through the server settings
fork-admin-configured-note = Admins listed in the server's CV_ADMIN_EMAILS setting are always admins; that can only be changed on the server. You can't remove your own admin role.

## Prompts
fork-menu-prompts = Story prompts
fork-menu-prompts-tooltip = Topics and questions to tell stories about
fork-prompts-title = Story prompts
fork-prompts-intro = Topics and questions that help people start telling a story. Pick one to record, or suggest your own: moderators look at suggestions before they appear here.
fork-prompts-empty = No prompts yet.
fork-prompts-record = Record a story about this
fork-prompts-recordings = { $count ->
        [one] 1 story
       *[other] { $count } stories
    }
fork-prompts-withdraw = Withdraw
fork-prompts-to-decide = Suggestions to decide on
fork-prompts-yours = Your suggestions
fork-prompts-status-pending = Waiting for a moderator
fork-prompts-status-rejected = Not used
fork-prompts-approve = Use it
fork-prompts-reject = Don't use it
fork-prompts-suggest = Suggest a prompt
fork-prompts-field-ja = Prompt in Japanese
fork-prompts-field-ain = In Ainu (optional)
fork-prompts-send = Suggest
fork-prompts-sent-pending = Thank you. A moderator will look at it.
fork-prompts-sent-approved = Added.
fork-new-field-prompt = Prompt (optional)
fork-new-no-prompt = None
fork-stories-prompt = Prompt:

## Reports
fork-report-open = Report a problem with this recording
fork-report-title = Report a problem
fork-report-intro = Moderators will see this. Use it for anything that needs their attention, for example if a speaker or their family may not have agreed to this being kept.
fork-report-reason = What kind of problem?
fork-report-reason-consent = Consent: the speaker or family may not agree
fork-report-reason-sensitive = Something that shouldn't be shared
fork-report-reason-wrong_details = Wrong details (speaker, date, place…)
fork-report-reason-audio = Problem with the audio
fork-report-reason-other = Something else
fork-report-segment = Where
fork-report-whole = The whole recording
fork-report-comment = Details (optional)
fork-report-send = Send to moderators
fork-report-sent = Sent. Thank you.
fork-reports-title = Reports
fork-reports-moderators-only = Only moderators can see reports.
fork-reports-open = Open
fork-reports-resolved = Resolved
fork-reports-none = No reports.
fork-reports-resolution = What was done (optional)
fork-reports-resolve = Mark as resolved
fork-reports-resolved-by = Resolved by { $who }, { $when }: { $resolution }

## Dialects
fork-speakers-field-dialects = Dialect(s)
fork-new-field-dialects = Dialect(s)
fork-dialects-add-label = Add a dialect
fork-dialects-add = Add
fork-dialects-remove = Remove { $name }
fork-dialects-hint = Choose from the list, or type a new one. Speakers say what they speak; admins merge entries that turn out to be the same.
fork-stories-filter-dialect = Dialect
fork-stories-all-dialects = All dialects
fork-dialects-title = Dialects
fork-dialects-admin-intro = Anyone can add a dialect. When two entries are the same (for example 沙流 and Saru), merge one into the other: its speakers and recordings move, and its name stays as another name for the entry. To correct a speaker's or recording's dialect, edit it on its own page.
fork-dialects-none = No dialects yet.
fork-dialects-name = Name
fork-dialects-rename = Rename
fork-dialects-counts = { $speakers ->
        [one] 1 speaker
       *[other] { $speakers } speakers
    } · { $recordings ->
        [one] 1 recording
       *[other] { $recordings } recordings
    }
fork-dialects-aliases = Also: { $aliases }
fork-dialects-merge-into = Merge into
fork-dialects-merge = Merge
fork-dialects-merge-confirm = Merge “{ $from }” into “{ $into }”? Its speakers and recordings will move to “{ $into }”. This can't be undone here.
fork-dialects-name-taken = “{ $name }” already exists. To make them one, merge instead.

## Exports
fork-exports-title = Export
fork-exports-intro = Download the archive as a zip, with tables of recordings, speakers and segments (transcriptions, translations and their reviews), and optionally audio. Each export includes only recordings whose every speaker consents, at the time of export, to the purpose you choose. Real names and notes are never included. Every export stays on record here.
fork-exports-new = New export
fork-exports-purpose = What it is for
fork-exports-purpose-archive = Keeping a copy of the archive
fork-exports-purpose-community_use = Community use (teaching, events)
fork-exports-purpose-research = Research
fork-exports-purpose-speech_technology = Speech technology
fork-exports-purpose-archive-note = Recordings whose speakers agreed to their keeping. Speakers' display names are included.
fork-exports-purpose-community_use-note = Recordings whose speakers agreed to community use. Speakers' display names are included.
fork-exports-purpose-research-note = Recordings whose speakers agreed to research. Speakers appear only as codes (S00001…).
fork-exports-purpose-speech_technology-note = Recordings whose speakers agreed to speech technology. Speakers appear only as codes (S00001…).
fork-exports-audio = Audio
fork-exports-audio-none = No audio (tables only)
fork-exports-audio-recordings = Original recordings
fork-exports-audio-segments = A clip for each segment (WAV, 16 kHz)
fork-exports-only-checked = Only transcriptions and translations a reviewer has checked
fork-exports-only-checked-short = only checked text
fork-exports-create = Create export
fork-exports-status-queued = Waiting to start…
fork-exports-status-building = Being built… Exports with audio take a while.
fork-exports-status-ready = Ready
fork-exports-status-failed = Failed
fork-exports-status-deleted = Deleted
fork-exports-contents = { $recordings ->
        [one] 1 recording
       *[other] { $recordings } recordings
    } · { $speakers ->
        [one] 1 speaker
       *[other] { $speakers } speakers
    } · { $segments ->
        [one] 1 segment
       *[other] { $segments } segments
    } · { $size }
fork-exports-download = Download
fork-exports-delete = Delete the file
fork-exports-delete-confirm = Delete this export's file? The record that it was made stays.
fork-exports-deleted-by = Deleted by { $who }, { $when }

## Site name, shown as plain text in place of the Common Voice logo
fork-site-name = Ainu Voice Archive

## Profile
fork-why-profile-text = The information in your profile helps describe the recordings you contribute. Only a username is needed; everything else is optional.
fork-why-demographic-explanation = Age and sex or gender help describe the recordings you make yourself. They are kept in the archive with those recordings and are never shown next to your name. Your username is shown to other members only if you make it visible.
fork-accept-privacy-and-terms = I agree to the <termsLink>terms</termsLink>, and to my information being handled as described in the <privacyLink>privacy notice</privacyLink>.
fork-email-change-information = To change your email address, write to <emailFragment>{ $email }</emailFragment>.
