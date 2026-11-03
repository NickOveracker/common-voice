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
fork-save = Save
fork-cancel = Cancel
fork-loading = Loading…
fork-error = Something went wrong: { $message }
fork-optional = (optional)

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
fork-stories-progress = { $segments } segments · transcribed in Latin letters { $latin }, katakana { $kana }{ $japanese ->
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
fork-speakers-field-region = Region or dialect
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
fork-stories-review-progress = { $approved } checked · { $needsWork } need work

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

## Site name, shown as plain text in place of the Common Voice logo
fork-site-name = Ainu Voice Archive

## Profile
fork-why-profile-text = The information in your profile helps describe the recordings you contribute. Only a username is needed; everything else is optional.
fork-why-demographic-explanation = Age and sex or gender help describe the recordings you make yourself. They are kept in the archive with those recordings and are never shown next to your name. Your username is shown to other members only if you make it visible.
fork-accept-privacy-and-terms = I agree to the <termsLink>terms</termsLink>, and to my information being handled as described in the <privacyLink>privacy notice</privacyLink>.
fork-email-change-information = To change your email address, write to <emailFragment>{ $email }</emailFragment>.
