# Strings added by this fork (kept out of upstream files to avoid merge conflicts)

## Sign-in gate
fork-sign-in-title = ログインしてください
fork-sign-in-body = この音声アーカイブは登録メンバーのみが利用できます。録音・聞き取り・確認をするにはログインしてください。
fork-sign-in-button = ログイン

## Menu
fork-menu-record-story = 語りを録音する
fork-menu-record-story-tooltip = 昔話・会話・聞き取りを録音またはアップロードする
fork-menu-stories = 語り
fork-menu-stories-tooltip = 録音された語りを聞く
fork-menu-speakers = 話者
fork-menu-speakers-tooltip = 録音される人とその同意

## Shared
fork-language-mixed = 混在
fork-save = 保存
fork-cancel = キャンセル
fork-loading = 読み込み中…
fork-error = エラーが発生しました: { $message }
fork-optional = （任意）

## Stories list
fork-stories-title = 語り
fork-stories-new = 新しい録音
fork-stories-speakers = 話者
fork-stories-filter-all = すべて
fork-stories-filter-mine = 自分の録音
fork-stories-empty = まだ録音はありません。
fork-stories-recorded-on = 録音日: { $date }
fork-stories-location = 場所: { $location }
fork-stories-duration = 長さ: { $duration }
fork-stories-status-uploading = アップロード未完了
fork-stories-status-processing = 処理中…
fork-stories-status-failed = 処理に失敗しました
fork-stories-download-original = 元のファイルをダウンロード
fork-stories-transcribe = 書き起こし・翻訳
fork-stories-progress = 区間 { $segments } · 書き起こし済み { $transcribed } · 日本語訳済み { $translated }
fork-stories-save-partial = アップロード済みの部分を保存する
fork-stories-resume-upload = 同じファイルを選び直すとアップロードを再開できます

## New recording
fork-new-title = 新しい録音
fork-new-details = 録音について
fork-new-field-title = タイトル
fork-new-field-description = 説明
fork-new-field-languages = 話されている言語
fork-new-field-languages-hint = アイヌ語と日本語が混ざる場合は両方を選んでください。
fork-new-field-speakers = 話者
fork-new-field-speakers-hint = 保存への同意が記録されている話者のみ選べます。
fork-new-no-speakers = 録音できる話者がまだいません。先に話者と同意を登録してください。
fork-new-speaker-no-consent = 同意未登録
fork-new-field-recorded-on = 録音日
fork-new-field-recorded-on-hint = 年、年月、または日付（例: 1972、1972-08、1972-08-15）。不明な場合は空欄にしてください。
fork-new-field-location = 録音場所
fork-new-field-location-hint = 不明な場合や記録しない場合は空欄にしてください。
fork-new-how = 音声をどのように追加しますか？
fork-new-record = 今すぐ録音する
fork-new-upload = ファイルをアップロードする
fork-new-continue = 次へ

## Recorder
fork-recorder-start = 録音を開始
fork-recorder-pause = 一時停止
fork-recorder-resume = 再開
fork-recorder-finish = 終了
fork-recorder-elapsed = 録音時間: { $duration }
fork-recorder-uploaded = サーバーに保存済み: { $count } 個
fork-recorder-uploading = 保存中…
fork-recorder-finishing = 最後の部分を保存中…
fork-recorder-unsupported = このブラウザでは録音できません。最新の Chrome、Firefox、Safari をお使いください。
fork-recorder-keep-open = 録音中はこのページを開いたままにしてください。音声は30秒ごとに保存されます。

## Upload
fork-upload-choose = 音声ファイルを選ぶ
fork-upload-progress = アップロード済み { $percent }%
fork-upload-start = アップロード

## Done
fork-new-done = 保存しました。数分後に再生できるようになります。
fork-new-back = 語りの一覧へ

## Speakers
fork-speakers-title = 話者
fork-speakers-intro = 録音される人です。アカウントは必要ありません。聞き取りをする人が、録音するお年寄りを登録できます。本名は登録した人とモデレーターにのみ表示されます。
fork-speakers-add = 話者を追加
fork-speakers-field-display-name = 表示名
fork-speakers-field-display-name-hint = ニックネームやイニシャルでも構いません。
fork-speakers-field-full-name = 本名
fork-speakers-field-birth-year = 生まれた年
fork-speakers-field-gender = 性別
fork-speakers-field-region = 地域・方言
fork-speakers-field-notes = メモ
fork-speakers-field-is-self = 自分自身
fork-speakers-manage = 詳細と同意
fork-speakers-no-consent = 同意未登録
fork-speakers-consent-summary = 同意（{ $date }）
fork-speakers-consent-history = 同意の履歴
fork-speakers-withdrawn = { $date } に撤回

## Consent
fork-consent-title = 同意を記録する
fork-consent-archive = 録音をコミュニティのアーカイブに保存する
fork-consent-community-use = コミュニティ内で利用する（教育・行事など）
fork-consent-research = 研究に利用する
fork-consent-speech-technology = 音声技術の開発に利用する（音声認識など）
fork-consent-method = 同意の方法
fork-consent-method-signed_form = 署名した書面
fork-consent-method-recorded_statement = 録音による意思表示
fork-consent-method-verbal = 口頭
fork-consent-method-family_or_community = 家族またはコミュニティによる同意（過去の録音など）
fork-consent-method-other = その他
fork-consent-given-on = 同意した日
fork-consent-notes = メモ
fork-consent-save = 同意を保存
fork-consent-withdraw = 同意を撤回
fork-consent-withdraw-confirm = この同意を撤回しますか？再び同意が記録されるまで、この話者の新しい録音はできなくなります。

## Transcribing a recording
fork-transcribe-back-to-stories = ← 語りの一覧へ
fork-transcribe-play = 再生
fork-transcribe-pause = 一時停止
fork-transcribe-play-segment = 区間 { $number } を再生
fork-transcribe-back = { $seconds }秒戻る
fork-transcribe-forward = { $seconds }秒進む
fork-transcribe-speed = 速度
fork-transcribe-loop = 区間をくり返す
fork-transcribe-help = 区間の ▶ を押すと、その区間を再生して終わりで止まります。入力中は Esc キーで再生・一時停止できます。「ここで分割」と「終わりをここに」は再生位置を使います。
fork-transcribe-speaker = 話者
fork-transcribe-speaker-unset = （未設定）
fork-transcribe-transcription = 書き起こし
fork-transcribe-script = 表記
fork-transcribe-script-latin = ラテン文字
fork-transcribe-script-katakana = カタカナ
fork-transcribe-script-mixed = 混在
fork-transcribe-translation-ja = 日本語訳
fork-transcribe-translation-en = 英訳
fork-transcribe-add-english = ＋ 英訳を追加
fork-transcribe-saved = 保存しました
fork-transcribe-conflict = 「{ $field }」は、ほかの人が先に保存しました：「{ $text }」。あなたの入力はそのまま残っています。もう一度保存すると置き換わります。
fork-transcribe-split = ここで分割
fork-transcribe-end-here = 終わりをここに
fork-transcribe-merge = 次と結合
fork-transcribe-no-segments = この録音にはまだ区間がありません。
fork-transcribe-detect = 区間を自動で検出する
fork-transcribe-detecting = 区間を検出しています…長い録音は時間がかかります。

## Site name, shown as plain text in place of the Common Voice logo
fork-site-name = アイヌ語音声アーカイブ

## Profile
fork-why-profile-text = プロフィールの情報は、あなたが提供する録音を説明するために役立ちます。必要なのはユーザー名だけで、ほかの項目はすべて任意です。
fork-why-demographic-explanation = 年齢と性別は、ご自身の録音を説明するための情報です。録音とともにアーカイブに保存されますが、あなたの名前と並べて表示されることはありません。ユーザー名は、表示する設定にした場合にのみ他のメンバーに表示されます。
fork-accept-privacy-and-terms = <termsLink>利用規約</termsLink>に同意し、<privacyLink>プライバシーに関するお知らせ</privacyLink>に記載のとおり私の情報が取り扱われることに同意します。
fork-email-change-information = メールアドレスを変更するには、<emailFragment>{ $email }</emailFragment> までご連絡ください。
