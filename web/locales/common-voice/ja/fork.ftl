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
fork-interface-language-label = 画面の表示言語だけが変わります
fork-save = 保存
fork-cancel = キャンセル
fork-loading = 読み込み中…
fork-error = エラーが発生しました: { $message }
fork-optional = （任意）

## Errors from the server, in place of its own short English messages
## (fork-api-error-<the message as a slug>, see fork/stories/api.ts)
fork-api-error-not-the-current-version = その間にほかの人が変更しました。ページを再読み込みすると、その版が表示されます。
fork-api-error-changed-meanwhile = その間にほかの人が保存しました。その版を表示しているので、自分の変更を加えてください。
fork-api-error-cannot-review-your-own-version = 自分で書いた版は確認できません。
fork-api-error-nothing-to-review = まだ確認するものがありません。
fork-api-error-unknown-prompt = そのテーマは存在しないか、まだ承認されていません。
fork-api-error-unknown-dialect = その方言はもうありません。ページを再読み込みして、選び直してください。
fork-api-error-recording-is-no-longer-accepting-audio = この録音には、これ以上音声を追加できません。
fork-api-error-empty-chunk = 音声の一部が空のまま届きました。もう一度お試しください。
fork-api-error-recording-is-too-large = 録音が大きすぎます。
fork-api-error-recording-is-already-complete = この録音はすでに完了しています。
fork-api-error-missing-chunks = 音声の一部が届いていません。もう一度アップロードしてください。
fork-api-error-cannot-remove-your-own-admin-role = 自分の管理者の役割は外せません。
fork-api-error-unknown-user = そのメンバーは存在しません。
fork-api-error-admin-role-required = 管理者だけができる操作です。
fork-api-error-moderator-role-required = モデレーターだけができる操作です。
fork-api-error-reviewer-role-required = 確認担当だけができる操作です。
fork-api-error-already-transcribed = 書き起こしが始まった録音では、区間を検出し直せません。区間は手で調整してください。
fork-api-error-name-is-required = 名前を入力してください。
fork-api-error-another-dialect-has-this-name = この名前の方言はすでにあります。
fork-api-error-segment-is-not-in-this-recording = その区間はこの録音のものではありません。ページを再読み込みしてください。
fork-api-error-you-already-have-a-speaker-profile = 自分自身の話者はすでに登録されています。
fork-api-error-text-ja-is-required = 日本語の文を入力してください。
fork-api-status-400 = 入力内容に問題があります。確認して、もう一度お試しください。
fork-api-status-401 = ログアウトされました。もう一度ログインしてください。
fork-api-status-403 = この操作をする権限がありません。
fork-api-status-404 = 見つかりません。削除された可能性があります。ページを再読み込みしてください。
fork-api-status-409 = その間にほかの人が変更しました。ページを再読み込みしてください。
fork-api-status-413 = ファイルが大きすぎます。
fork-api-status-other = サーバーで処理できませんでした。しばらくしてから、もう一度お試しください。

## Error page, without Mozilla's community links
fork-error-page-content-404 = 移動したか、削除された可能性があります。<homepageLink>ホーム</homepageLink>に戻ってください。
fork-error-page-content = ページを再読み込みするか、<homepageLink>ホーム</homepageLink>に戻ってください。繰り返し起きる場合は、アーカイブの管理者に知らせてください。

## Deleting your account, about this archive rather than Mozilla's dataset
fork-delete-q = アカウントを削除するとき、あなたの録音も削除するよう依頼しますか？それともアーカイブに残しますか？
fork-keep-info = あなたの録音はアーカイブに残り、これまでどおり話者の同意に従って扱われます。
fork-remove-info = アーカイブの管理者が依頼を確認し、どう対応したかをお知らせします。

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
fork-stories-progress = 区間 { $segments } · 書き起こし済み ラテン文字 { $latin }・カタカナ { $kana }{ $japanese ->
        [0] {""}
       *[other] ・日本語 { $japanese }
    } · 日本語訳済み { $translated }
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
fork-speakers-field-region = 地域（住んでいる・育った所）
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
fork-transcribe-transcription-latin = 書き起こし（ラテン文字）
fork-transcribe-transcription-kana = 書き起こし（カタカナ）
fork-transcribe-transcription-ja = 書き起こし（日本語）
fork-transcribe-japanese-within = 書き起こしの中の日本語の部分は、日本語で書いてください。
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

## Reviewing transcripts
fork-review-unreviewed = 未確認
fork-review-approved = ✓ 確認済み
fork-review-needs-work = 要修正
fork-review-needs-work-comment = 要修正：{ $comment }
fork-review-approve = 確認済みにする
fork-review-request-changes = 要修正にする…
fork-review-comment = 直すべき点（任意）
fork-review-send = 送信
fork-review-history = 以前の版
fork-review-history-hide = 以前の版を閉じる
fork-review-mine = （自分）
fork-review-restore = この版に戻す
fork-review-filter = 確認が必要な区間だけ表示
fork-stories-review-progress = 確認済み { $approved } · 要修正 { $needsWork }

## Admin
fork-home-intro = アイヌのコミュニティが、語りや会話、思い出の声を残し、みんなで書き起こし・翻訳するための場所です。ここにあるものは、メンバーだけが見られます。
fork-admin-title = 管理
fork-admin-only = このページは管理者のみが見られます。
fork-admin-roles-intro = ログインした人は誰でも、録音・書き起こし・翻訳ができます。役割を与えると、次のこともできるようになります。
fork-role-admin = 管理者
fork-role-admin-description = 役割を与えたり外したりでき、すべての操作ができます
fork-role-moderator = モデレーター
fork-role-moderator-description = 録音と話者を管理し、確認もできます
fork-role-reviewer = 確認担当
fork-role-reviewer-description = 書き起こしと翻訳を確認します
fork-admin-filter = 名前またはメールアドレスで検索
fork-admin-user = メンバー
fork-admin-role-for = { $role }：{ $user }
fork-admin-configured = サーバーの設定による管理者
fork-admin-configured-note = サーバーの CV_ADMIN_EMAILS に設定された人は常に管理者で、変更はサーバー側でのみできます。自分の管理者の役割は外せません。

## Prompts
fork-menu-prompts = 語りのテーマ
fork-menu-prompts-tooltip = 語ってもらうための話題や問いかけ
fork-prompts-title = 語りのテーマ
fork-prompts-intro = 語りを始めるきっかけになる話題や問いかけです。テーマを選んで録音するか、新しいテーマを提案してください。提案はモデレーターが確認してからここに載ります。
fork-prompts-empty = まだテーマがありません。
fork-prompts-record = このテーマで録音する
fork-prompts-recordings = 語り { $count } 件
fork-prompts-withdraw = 取り下げる
fork-prompts-to-decide = 確認待ちの提案
fork-prompts-yours = あなたの提案
fork-prompts-status-pending = モデレーターの確認待ち
fork-prompts-status-rejected = 採用されていません
fork-prompts-approve = 採用する
fork-prompts-reject = 採用しない
fork-prompts-suggest = テーマを提案する
fork-prompts-field-ja = テーマ（日本語）
fork-prompts-field-ain = アイヌ語（任意）
fork-prompts-send = 提案する
fork-prompts-sent-pending = ありがとうございます。モデレーターが確認します。
fork-prompts-sent-approved = 追加しました。
fork-new-field-prompt = テーマ（任意）
fork-new-no-prompt = なし
fork-stories-prompt = テーマ：

## Reports
fork-report-open = この録音について問題を報告する
fork-report-title = 問題を報告する
fork-report-intro = モデレーターに届きます。対応が必要なことがあれば知らせてください。たとえば、話者やその家族が、この録音を残すことに同意していないかもしれない場合などです。
fork-report-reason = どのような問題ですか
fork-report-reason-consent = 同意：話者や家族が同意していないかもしれない
fork-report-reason-sensitive = 共有すべきでない内容がある
fork-report-reason-wrong_details = 情報の誤り（話者・日付・場所など）
fork-report-reason-audio = 音声の問題
fork-report-reason-other = その他
fork-report-segment = 場所
fork-report-whole = 録音全体
fork-report-comment = 詳細（任意）
fork-report-send = モデレーターに送る
fork-report-sent = 送信しました。ありがとうございます。
fork-reports-title = 報告
fork-reports-moderators-only = 報告を見られるのはモデレーターだけです。
fork-reports-open = 未対応
fork-reports-resolved = 対応済み
fork-reports-none = 報告はありません。
fork-reports-resolution = 対応の内容（任意）
fork-reports-resolve = 対応済みにする
fork-reports-resolved-by = { $who } が対応（{ $when }）：{ $resolution }

## Dialects
fork-speakers-field-dialects = 方言
fork-new-field-dialects = 方言
fork-dialects-add-label = 方言を追加
fork-dialects-add = 追加
fork-dialects-remove = { $name } を外す
fork-dialects-hint = 一覧から選ぶか、新しく入力してください。方言は話者本人の申告に従います。同じものが別々に登録された場合は、管理者がまとめます。
fork-stories-filter-dialect = 方言
fork-stories-all-dialects = すべての方言
fork-dialects-title = 方言
fork-dialects-admin-intro = 方言は誰でも追加できます。同じ方言が別々に登録されたとき（たとえば「沙流」と「Saru」）は、一方をもう一方にまとめてください。話者と録音が移り、まとめた名前は別名として残ります。話者や録音の方言を直すには、それぞれのページで編集してください。
fork-dialects-none = まだ方言がありません。
fork-dialects-name = 名前
fork-dialects-rename = 名前を変更
fork-dialects-counts = 話者 { $speakers } · 録音 { $recordings }
fork-dialects-aliases = 別名：{ $aliases }
fork-dialects-merge-into = まとめる先
fork-dialects-merge = まとめる
fork-dialects-merge-confirm = 「{ $from }」を「{ $into }」にまとめますか？ 話者と録音は「{ $into }」に移ります。この画面では元に戻せません。
fork-dialects-name-taken = 「{ $name }」はすでにあります。ひとつにするには、まとめてください。

## Exports
fork-exports-title = 書き出し
fork-exports-intro = アーカイブを zip ファイルとしてダウンロードします。録音・話者・区間（書き起こし、翻訳、その確認）の表と、必要なら音声を含みます。書き出す時点で、すべての話者が選んだ目的に同意している録音だけが入ります。本名とメモは含みません。書き出しの記録はすべてここに残ります。
fork-exports-new = 新しい書き出し
fork-exports-purpose = 目的
fork-exports-purpose-archive = アーカイブの保存（複製）
fork-exports-purpose-community_use = コミュニティ内での利用（教育・行事など）
fork-exports-purpose-research = 研究
fork-exports-purpose-speech_technology = 音声技術の開発
fork-exports-purpose-archive-note = 保存に同意した話者の録音です。話者の表示名を含みます。
fork-exports-purpose-community_use-note = コミュニティ内での利用に同意した話者の録音です。話者の表示名を含みます。
fork-exports-purpose-research-note = 研究に同意した話者の録音です。話者は記号（S00001 など）だけで示します。
fork-exports-purpose-speech_technology-note = 音声技術の開発に同意した話者の録音です。話者は記号（S00001 など）だけで示します。
fork-exports-audio = 音声
fork-exports-audio-none = 音声なし（表のみ）
fork-exports-audio-recordings = 元の録音ファイル
fork-exports-audio-segments = 区間ごとの音声（WAV、16 kHz）
fork-exports-only-checked = 確認担当が確認済みにした書き起こし・翻訳だけを含める
fork-exports-only-checked-short = 確認済みのみ
fork-exports-create = 書き出す
fork-exports-status-queued = 開始を待っています…
fork-exports-status-building = 作成中です…音声を含む場合は時間がかかります。
fork-exports-status-ready = 完了
fork-exports-status-failed = 失敗しました
fork-exports-status-deleted = 削除済み
fork-exports-contents = 録音 { $recordings } · 話者 { $speakers } · 区間 { $segments } · { $size }
fork-exports-download = ダウンロード
fork-exports-delete = ファイルを削除
fork-exports-delete-confirm = この書き出しのファイルを削除しますか？ 書き出した記録は残ります。
fork-exports-deleted-by = { $who } が削除（{ $when }）

## Site name, shown as plain text in place of the Common Voice logo
fork-site-name = アイヌ語音声アーカイブ

## Profile
fork-why-profile-text = プロフィールの情報は、あなたが提供する録音を説明するために役立ちます。必要なのはユーザー名だけで、ほかの項目はすべて任意です。
fork-why-demographic-explanation = 年齢と性別は、ご自身の録音を説明するための情報です。録音とともにアーカイブに保存されますが、あなたの名前と並べて表示されることはありません。ユーザー名は、表示する設定にした場合にのみ他のメンバーに表示されます。
fork-accept-privacy-and-terms = <termsLink>利用規約</termsLink>に同意し、<privacyLink>プライバシーに関するお知らせ</privacyLink>に記載のとおり私の情報が取り扱われることに同意します。
fork-email-change-information = メールアドレスを変更するには、<emailFragment>{ $email }</emailFragment> までご連絡ください。
