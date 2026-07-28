import type { LegalDoc } from "./types";

// Drafted to describe what this app actually does. Each claim maps to code:
//   - localStorage keys           -> stores/authStore.ts, stores/configStore.ts
//   - slides in IndexedDB         -> lib/slideStore.ts, lib/idb.ts
//   - password / SMS / keepsake   -> src/routes/login.ts, src/lib/campusSso.ts,
//                                    src/lib/resumeSeal.ts, stores/authStore.ts
//   - API proxy (incl. notes)     -> src/routes/yanhektProxy.ts -> cbiz.yanhekt.cn
//   - recorded video relay        -> lib/streamUrls.ts (default relay.ruc.edu.kg;
//                                    optional custom endpoint in config)
//   - cloud notes / watch sync    -> stores/watchNotesStore.ts, stores/cloudStorageStore.ts,
//                                    lib/notes/notesClient.ts  (MinIO upload + note content)
//   - AI filtering                -> lib/ai/aiFilteringClient.ts, lib/ai/llmClient.ts,
//                                    lib/ai/copilotAuth.ts
//                                    (openai.ruc.edu.kg / copilot.ruc.edu.kg / custom)
//   - GitHub fetch on /apps       -> lib/github.ts
// If any of those change, this document has to change with them.

export const privacyDoc: LegalDoc = {
  id: "privacy",
  title: { en: "Privacy Policy", zh: "私隱政策" },
  updated: "2026-07-29",
  intro: [
    {
      en: 'This policy explains what happens to your information when you use the AutoSlides web service at learn.ruc.edu.kg ("Service"). It forms part of, and should be read together with, the Terms and Conditions.',
      zh: "本政策說明閣下使用 learn.ruc.edu.kg 的 AutoSlides 網頁服務（下稱「本服務」）時，閣下資料的處理方式。本政策構成《條款及細則》的一部分，並應與其一併閱讀。",
    },
    {
      en: "In short: the Service has no user accounts of its own and no database of its own. Your sign-in token, your settings, and the slides you extract are stored in your own browser by default. AI filtering (on by default; changeable in Settings) and optional Cloud Notes sync can send slide images to the AI provider you choose or into your own notes on the Platform. The Service itself does not keep a server-side copy of your extracted slides.",
      zh: "簡而言之：本服務並無自設的用戶帳戶，亦無自設的資料庫。閣下的登入權杖、設定，以及所提取的幻燈片，預設均儲存在閣下自己的瀏覽器內。AI 篩選（預設開啟，可在設定中更改）及可選的雲筆記同步，可把幻燈片圖像傳送至閣下所選的 AI 服務，或寫入閣下在平台上的筆記。本服務本身不會在伺服器端保存閣下提取的幻燈片副本。",
    },
  ],
  sections: [
    {
      id: "on-your-device",
      heading: { en: "1. What stays on your device", zh: "儲存於閣下裝置上的資料" },
      summary: {
        en: "By default your token, settings, and extracted slides live only in this browser.",
        zh: "預設情況下，閣下的權杖、設定及所提取的幻燈片僅保存在此瀏覽器內。",
      },
      paragraphs: [
        {
          en: "**Sign-in token.** After you sign in, the Platform's access token is kept in your browser's local storage so that you stay signed in between visits. It is not copied into any database operated by the Service.",
          zh: "**登入權杖。** 閣下登入後，平台的存取權杖會保存在瀏覽器的本機儲存空間（local storage），使閣下在下次到訪時仍保持登入狀態。該權杖不會被寫入本服務營運的任何資料庫。",
        },
        {
          en: "**Remembered device.** After a successful password or SMS sign-in, the Service may return a sealed device keepsake so the school's sign-in system can skip a later SMS check on the same browser. That sealed blob is stored only in local storage on your device; the Service cannot read its contents without the seal key held on the Worker during a login request. It is not removed when you sign out (so the next password sign-in on this device can still skip SMS); clearing this site's data removes it.",
          zh: "**已記住的裝置。** 密碼或短訊登入成功後，本服務或會回傳一個經密封的裝置憑證，以便學校登入系統在同一瀏覽器上略過其後的短訊驗證。該密封資料僅保存在閣下裝置的本機儲存空間；除登入請求期間 Worker 所持有的密封金鑰外，本服務無法讀取其內容。登出時不會刪除該憑證（以便下次在此裝置以密碼登入時仍可略過短訊）；清除本網站資料即可將其移除。",
        },
        {
          en: "**Settings.** Your preferences — theme, language, saved searches, subscribed courses, Cloud Notes sync, AI filtering choices, and any AI credentials you enter (for example a GitHub Copilot token or a custom API key) — are kept in local storage on your device only.",
          zh: "**設定。** 閣下的偏好設定——主題、語言、已儲存的搜尋、已訂閱的課程、雲筆記同步、AI 篩選選項，以及閣下輸入的任何 AI 憑證（例如 GitHub Copilot 權杖或自訂 API 金鑰）——僅保存在閣下裝置的本機儲存空間內。",
        },
        {
          en: "**Extracted slides.** Slides captured during playback are written to your browser's IndexedDB storage on your own device. Exporting to PDF or ZIP is performed locally in your browser. By default the slides are not uploaded anywhere; the optional cases in which a slide image leaves the browser are described in section 4.",
          zh: "**已提取的幻燈片。** 播放期間所擷取的幻燈片會寫入閣下裝置上瀏覽器的 IndexedDB 儲存空間。匯出 PDF 或 ZIP 均在閣下的瀏覽器本機完成。預設不會上傳幻燈片；幻燈片圖像離開瀏覽器的可選情況見第 4 節。",
        },
        {
          en: "**Cookies.** The Service sets no cookies of its own, and uses none for advertising, analytics, or tracking. The Service is protected by Cloudflare, which may set strictly necessary cookies in your browser — for example when a verification check is used to distinguish real visitors from automated traffic. Such cookies exist for security and are not used to profile you or to follow you across other sites.",
          zh: "**Cookie。** 本服務不會設定任何自身的 Cookie，亦不會將 Cookie 用於廣告、分析或追蹤。本服務由 Cloudflare 保護，其可能在閣下的瀏覽器中設定必要的 Cookie——例如在使用驗證檢查以區分真實訪客與自動化流量時。該等 Cookie 僅為保安而存在，不會用於剖析閣下或跨網站追蹤閣下。",
        },
      ],
    },
    {
      id: "signing-in",
      heading: { en: "2. Signing in", zh: "登入" },
      summary: {
        en: "Your password is passed to the school's own sign-in system and is never stored by the Service.",
        zh: "閣下的密碼會轉交學校自身的登入系統，本服務永不儲存。",
      },
      paragraphs: [
        {
          en: "**Password sign-in.** If you sign in with your school account, your username and password are sent over an encrypted connection to the Service, which uses them once to authenticate against the school's own single sign-on system (sso.bit.edu.cn) and obtain an access token. Your credentials are not stored, logged, or retained by the Service after that request completes.",
          zh: "**密碼登入。** 如閣下以學校帳戶登入，閣下的用戶名稱及密碼會經加密連線傳送至本服務；本服務僅使用一次，向學校自身的統一身份認證系統（sso.bit.edu.cn）進行認證並取得存取權杖。該請求完成後，本服務不會儲存、記錄或保留閣下的登入憑證。",
        },
        {
          en: "**SMS second factor.** If the school requires a one-time SMS code, the Service returns a sealed resume token that holds only the mid-login state needed to finish the flow (cookies and form context for the school system). That resume token is kept in your browser's memory for up to five minutes, never written to local storage, and is lost if you reload or cancel. You send the sealed token back with the SMS code; the Service unseals it for that request only, completes the school sign-in, and discards the credentials. The Service does not store SMS codes.",
          zh: "**短訊雙重驗證。** 如學校要求一次性短訊驗證碼，本服務會回傳一個經密封的續期權杖，僅載有完成登入流程所需的中途狀態（學校系統的 Cookie 及表單上下文）。該續期權杖最多在閣下瀏覽器的記憶體中保留五分鐘，絕不會寫入本機儲存空間，重新載入或取消即會遺失。閣下將密封權杖連同短訊驗證碼一併送回；本服務僅在該次請求中解密、完成學校登入，並丟棄相關憑證。本服務不會儲存短訊驗證碼。",
        },
        {
          en: "**Token sign-in.** Alternatively you may supply a token that already exists in your own browser session on the Platform (including via the optional bookmarklet). In that case your password and SMS code are never involved.",
          zh: "**權杖登入。** 閣下亦可改為提供已存在於閣下瀏覽器中平台工作階段內的權杖（包括透過可選的書籤小工具）。在此情況下，完全不涉及閣下的密碼及短訊驗證碼。",
        },
        {
          en: "**Signing out.** Signing out deletes the stored Platform token from your browser immediately and asks the Platform to revoke that token. It does not by itself delete your extracted slides, settings, or remembered-device keepsake on this browser.",
          zh: "**登出。** 登出會立即從閣下的瀏覽器中刪除已儲存的平台權杖，並請求平台撤銷該權杖。登出本身不會刪除此瀏覽器上已提取的幻燈片、設定或已記住裝置的憑證。",
        },
      ],
    },
    {
      id: "through-the-service",
      heading: { en: "3. Requests that pass through the Service", zh: "經由本服務傳送的請求" },
      summary: {
        en: "The Service relays your Platform requests; it keeps no server-side record of them.",
        zh: "本服務將閣下對平台的請求轉送出去，並不會在伺服器端保留相關記錄。",
      },
      paragraphs: [
        {
          en: "**Why a relay is needed.** A browser cannot call the Platform's API directly, so course listings, playback details, cloud notes, and image uploads you initiate are requested through the Service, which forwards them to the Platform (cbiz.yanhekt.cn) and returns the response to you. Your token travels with those requests because the Platform requires it to identify you.",
          zh: "**為何需要轉送。** 瀏覽器無法直接呼叫平台的 API，因此課程列表、播放資訊，以及閣下發起的雲筆記與圖像上傳，均經由本服務請求；本服務將其轉送至平台（cbiz.yanhekt.cn），再把回應傳回閣下。由於平台需要藉此識別閣下身分，閣下的權杖會隨該等請求一併傳送。",
        },
        {
          en: "**Video.** Recorded lectures are streamed through a relay service (by default relay.ruc.edu.kg; you may configure a different endpoint in Settings). The relay must present your token to the Platform in order to sign each request, so treat any generated stream URL as sensitive. Live streams are fetched by your browser directly from the Platform's content network.",
          zh: "**影片。** 錄播課程經由中轉服務串流（預設為 relay.ruc.edu.kg；閣下可在設定中改用其他端點）。該服務須向平台出示閣下的權杖，方能為每個請求簽署，因此任何產生的串流網址均應視作敏感資料。直播則由閣下的瀏覽器直接向平台的內容網絡獲取。",
        },
        {
          en: "**No server-side record.** The Service is a stateless relay: it operates no database of its own and keeps no server-side record of your account, your viewing history, or the Content you access. Mid-login state for SMS is sealed and held only by your browser for a few minutes (section 2). Requests are carried over the Developer's hosting provider (Cloudflare), whose handling of network traffic is governed by its own policies.",
          zh: "**並無伺服器端記錄。** 本服務為無狀態的中轉服務：並無自設的資料庫，亦不會在伺服器端保留閣下的帳戶、觀看記錄或所存取內容的任何記錄。短訊登入的中途狀態經密封後僅由閣下的瀏覽器持有數分鐘（見第 2 節）。請求經由開發者的託管服務供應商（Cloudflare）傳送，其對網絡流量的處理受其自身政策管轄。",
        },
      ],
    },
    {
      id: "when-slides-leave",
      heading: {
        en: "4. When slide images leave your browser",
        zh: "幻燈片圖像何時離開閣下的瀏覽器",
      },
      summary: {
        en: "Only when you use AI filtering or Cloud Notes features that send images outward.",
        zh: "僅在閣下使用會向外傳送圖像的 AI 篩選或雲筆記功能時。",
      },
      paragraphs: [
        {
          en: "**Default.** If you only watch, extract, review, and export slides, those images stay in IndexedDB on your device. Nothing in that path uploads a slide to the Developer or to a third party.",
          zh: "**預設。** 如閣下僅觀看、提取、審閱及匯出幻燈片，該等圖像會留在閣下裝置的 IndexedDB 內。該路徑不會把幻燈片上傳至開發者或任何第三方。",
        },
        {
          en: "**AI filtering.** When AI filtering is enabled (it can be turned on or off in Settings), candidate slide images are sent from your browser as base64 PNG frames to the AI provider you have selected, solely so that provider can return a classification (for example slide / not a slide / possible edit). The Service does not use those images to train a model on your behalf. You choose one of:",
          zh: "**AI 篩選。** 當 AI 篩選已啟用（可在設定中開關）時，候選幻燈片圖像會以 base64 PNG 形式由閣下的瀏覽器直接傳送至閣下所選的 AI 服務，僅供其回傳分類結果（例如：幻燈片／非幻燈片／可能為編輯畫面）。本服務不會用該等圖像代閣下訓練任何模型。閣下可選擇以下其中一項：",
        },
        {
          en: "**Built-in AI.** Requests go to the Developer's AI endpoint (openai.ruc.edu.kg), authenticated with your Platform token. The image is used to produce the classification response for that request.",
          zh: "**內建 AI。** 請求會送往開發者的 AI 端點（openai.ruc.edu.kg），並以閣下的平台權杖認證。圖像僅用於產生該次請求的分類回應。",
        },
        {
          en: "**GitHub Copilot.** After you connect Copilot (device-code flow through copilot.ruc.edu.kg), images and your Copilot access token are sent to that Copilot proxy for classification. Your Copilot token is stored only in this browser's local storage.",
          zh: "**GitHub Copilot。** 閣下連接 Copilot 後（經 copilot.ruc.edu.kg 的裝置碼流程），圖像及閣下的 Copilot 存取權杖會送往該 Copilot 代理以作分類。閣下的 Copilot 權杖僅保存在此瀏覽器的本機儲存空間。",
        },
        {
          en: "**Custom endpoint.** If you configure an OpenAI-compatible base URL, API key, and model, images and that key are sent from your browser directly to the endpoint you named. That provider's own policies then apply; the Service never sees the key or the image on a server of its own.",
          zh: "**自訂端點。** 如閣下設定 OpenAI 相容的基底網址、API 金鑰及模型，圖像及該金鑰會由閣下的瀏覽器直接送往閣下指定的端點。其後適用該服務供應商自身的政策；本服務的伺服器不會看到該金鑰或圖像。",
        },
        {
          en: '**Cloud Notes and watch-mode sync.** When Cloud Notes sync is enabled, slides that pass post-processing may be uploaded through the Service to the Platform\'s own storage (Yanhekt MinIO) and inserted into a note under your Platform account (managed groups such as "ASuser"). Images uploaded this way become part of your Platform notes; the Platform hosts them under its own policies. Slide images hosted on the Platform\'s public storage may be viewable by anyone who has the link — do not sync private or sensitive material. Manual image inserts in the Notes editor use the same Platform upload path.',
          zh: "**雲筆記及觀看模式同步。** 啟用雲筆記同步後，通過後處理的幻燈片或會經由本服務上傳至平台自身的儲存（延河課堂 MinIO），並插入閣下平台帳戶下的筆記（例如受管理的「ASuser」群組）。如此上傳的圖像會成為閣下平台筆記的一部分，由平台按其自身政策託管。託管於平台公開儲存的幻燈片圖像，任何持有連結的人均可能查看——請勿同步私人或敏感資料。在筆記編輯器中手動插入的圖像，亦使用同一平台上傳路徑。",
        },
      ],
    },
    {
      id: "third-parties",
      heading: { en: "5. Third parties", zh: "第三方" },
      summary: {
        en: "The Platform, the school, AI providers you choose, and GitHub each see what you send them.",
        zh: "平台、學校、閣下選擇的 AI 服務及 GitHub，均會看到閣下向其傳送的內容。",
      },
      paragraphs: [
        {
          en: "**The Platform and the school.** Everything you do through the Service is, from the Platform's perspective, an ordinary use of your own account — including notes you create and images you upload when Cloud Notes is on. The Platform and the school's sign-in system receive and handle that activity under their own policies. The Developer has no control over, and no visibility into, what they record.",
          zh: "**平台及學校。** 從平台的角度而言，閣下透過本服務所作的一切，均屬對閣下自身帳戶的一般使用——包括啟用雲筆記時所建立的筆記及上傳的圖像。平台及學校的登入系統會依其自身政策接收及處理該等活動。開發者對其所記錄的內容既無控制權，亦無從知悉。",
        },
        {
          en: "**AI providers.** When AI filtering is enabled, the provider you selected (built-in, Copilot, or custom) receives the slide images you submit for classification, as described in section 4. Their handling of those requests is governed by their own terms and policies.",
          zh: "**AI 服務供應商。** 啟用 AI 篩選時，閣下所選的服務（內建、Copilot 或自訂）會收到閣下提交以供分類的幻燈片圖像，詳見第 4 節。其對該等請求的處理受其自身條款及政策管轄。",
        },
        {
          en: "**GitHub.** The Desktop Apps page fetches release information and documentation from GitHub (and, if GitHub is unreachable, from the gh-proxy.org mirror). Opening that page reveals your IP address to those services in the ordinary course of making a request. Connecting Copilot also involves GitHub's device authorization flow. No other page contacts them for unrelated purposes.",
          zh: "**GitHub。** 「桌面應用」頁面會從 GitHub 獲取發佈資訊及文檔（如無法連接 GitHub，則改用 gh-proxy.org 鏡像）。開啟該頁面時，會如一般網絡請求般向該等服務透露閣下的 IP 位址。連接 Copilot 亦會涉及 GitHub 的裝置授權流程。其他頁面不會為無關目的與其聯絡。",
        },
        {
          en: "**Video relay.** The recorded-video relay (default relay.ruc.edu.kg, or another endpoint you configure) receives the stream URL and your Platform token in order to sign and proxy segments. Live streams do not use the relay.",
          zh: "**影片中轉。** 錄播影片中轉（預設 relay.ruc.edu.kg，或閣下設定的其他端點）會收到串流網址及閣下的平台權杖，以便簽署及代理分段。直播不使用該中轉。",
        },
      ],
    },
    {
      id: "not-done",
      heading: { en: "6. What the Service does not do", zh: "本服務不會做的事" },
      summary: {
        en: "No advertising, no analytics or tracking scripts, no profiling, no selling of data.",
        zh: "沒有廣告、分析或追蹤程式碼、用戶剖析，亦不會出售資料。",
      },
      paragraphs: [
        {
          en: "The Service contains no advertising, no analytics or tracking scripts, and no third-party tracking of any kind. It does not build a profile of you, does not sell or share personal information for advertising, and does not use your data to train a model of its own. Slide images leave your browser only when a feature you use requires it (section 4).",
          zh: "本服務不含任何廣告、分析或追蹤程式碼，亦無任何形式的第三方追蹤。本服務不會建立閣下的用戶剖析檔案，不會為廣告而出售或分享個人資料，亦不會使用閣下的資料訓練其自身的模型。幻燈片圖像僅在閣下所使用的功能有此需要時才會離開瀏覽器（見第 4 節）。",
        },
      ],
    },
    {
      id: "deleting",
      heading: { en: "7. Deleting your data", zh: "刪除閣下的資料" },
      summary: {
        en: "Browser data is yours to clear; notes and images on the Platform follow Platform tools.",
        zh: "瀏覽器資料可由閣下自行清除；平台上的筆記與圖像則依平台工具處理。",
      },
      paragraphs: [
        {
          en: "Because the Service keeps its copy of your token, settings, and local slides only in your browser, you can remove that copy yourself: sign out to delete the token (and ask the Platform to revoke it), and clear this site's data in your browser settings to erase settings, the remembered-device keepsake, and every slide stored in IndexedDB. The Service holds no separate server-side archive of those items for the Developer to delete on your behalf.",
          zh: "由於本服務對閣下權杖、設定及本機幻燈片的保存僅存在於閣下的瀏覽器內，閣下可自行將其移除：登出即可刪除權杖（並請求平台撤銷該權杖）；在瀏覽器設定中清除本網站的資料，即可抹除設定、已記住裝置憑證，以及 IndexedDB 中所有已儲存的幻燈片。本服務並無另存伺服器端歸檔可供開發者代閣下刪除。",
        },
        {
          en: "Deleting local browser data does not remove notes, uploaded images, or other material that already sits in your Platform account (including anything created by Cloud Notes sync). Use the Platform's own note tools — or contact the Platform — to manage or delete that material. It also does not close or alter your school account.",
          zh: "刪除本機瀏覽器資料，不會移除已存在於閣下平台帳戶中的筆記、已上傳圖像或其他資料（包括雲筆記同步所建立者）。請使用平台自身的筆記工具——或聯絡平台——以管理或刪除該等資料。此舉亦不會關閉或更改閣下的學校帳戶。",
        },
      ],
    },
    {
      id: "changes",
      heading: { en: "8. Changes and contact", zh: "變更及聯絡" },
      summary: {
        en: "Material changes update the date above; questions go to the Developer.",
        zh: "重大變更會更新上方的日期；查詢請聯絡開發者。",
      },
      paragraphs: [
        {
          en: "If this policy changes materially, the date shown at the top of this page will be updated. Continuing to use the Service after a change indicates acceptance of the revised policy.",
          zh: "如本政策有重大變更，本頁頂部所示的日期將會更新。變更後繼續使用本服務，即表示接受經修訂的政策。",
        },
        {
          en: "**Language:** In the event of any discrepancy between the English and Chinese versions of this policy, the English version shall prevail.",
          zh: "**語言：** 本政策的中英版本如有任何歧義，概以英文版本為準。",
        },
        {
          en: "**Contact:** For questions about this policy or your data, please contact info@ruc.edu.kg.",
          zh: "**聯絡：** 如對本政策或閣下的資料有任何疑問，請聯絡 info@ruc.edu.kg。",
        },
      ],
    },
  ],
};
