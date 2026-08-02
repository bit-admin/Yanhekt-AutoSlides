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
//
// Cross-reads with terms.ts and disclosure.ts (Cloud Notes / public Platform
// storage). Claims about no server-side user archive describe the Service's
// design: credentials and extracted slides are not retained in a Developer
// database after the request that needs them completes.

export const privacyDoc: LegalDoc = {
  id: "privacy",
  title: { en: "Privacy Policy", zh: "私隱政策" },
  updated: "2026-08-03",
  intro: [
    {
      en: 'This Privacy Policy ("Policy") explains how information is handled when you use the AutoSlides web service at learn.ruc.edu.kg (the "Service"), provided by the Developer of AutoSlides. It forms part of, and should be read together with, the Terms and Conditions, the Copyright & Intellectual Property Notice, and the Public Storage Disclosure.',
      zh: "本《私隱政策》（下稱「本政策」）說明閣下使用位於 learn.ruc.edu.kg 的 AutoSlides 網頁服務（下稱「本服務」，由 AutoSlides 開發者提供）時，資料的處理方式。本政策構成《條款及細則》、《版權及知識產權聲明》及《公共儲存空間披露》的一部分，並應與其一併閱讀。",
    },
    {
      en: 'In this Policy, "Developer" means the creator and operator of the Service (contact: info@ruc.edu.kg); "Platform" means the Yanhe Classroom (Yanhekt) systems of the Beijing Institute of Technology; and "User" means you. Capitalised terms not defined here have the meaning given in the Terms where applicable.',
      zh: "在本政策中，「開發者」指本服務的創作者及營運者（聯絡：info@ruc.edu.kg）；「平台」指北京理工大學的延河課堂（Yanhekt）系統；「用戶」指閣下。本政策未定義的大寫用語，在適用情況下具有《條款及細則》所賦予的涵義。",
    },
    {
      en: "**In short:** the Service has no user accounts of its own and no database of User profiles. Your sign-in token, your settings, and the slides you extract are stored in your own browser by default. AI filtering (changeable in Settings) and optional Cloud Notes sync can send slide images to the AI provider you choose or into your own notes on the Platform. The Service itself does not keep a server-side archive of your extracted slides or your school password after the login request that needs them completes.",
      zh: "**簡而言之：** 本服務並無自設的用戶帳戶，亦無用戶檔案資料庫。閣下的登入權杖、設定，以及所提取的幻燈片，預設均儲存在閣下自己的瀏覽器內。AI 篩選（可在設定中更改）及可選的雲筆記同步，可把幻燈片圖像傳送至閣下所選的 AI 服務，或寫入閣下在平台上的筆記。本服務本身不會在伺服器端歸檔閣下提取的幻燈片，亦不會在完成所需的登入請求後保留閣下的學校密碼。",
    },
  ],
  sections: [
    {
      id: "scope",
      heading: { en: "1. Scope and role of the Developer", zh: "範圍及開發者的角色" },
      summary: {
        en: "This Policy covers the web Service; the Platform and school systems have their own policies.",
        zh: "本政策涵蓋網頁服務；平台及學校系統另有其自身政策。",
      },
      paragraphs: [
        {
          en: "**1.1 Scope.** This Policy applies to the AutoSlides web Service at learn.ruc.edu.kg, including its sign-in proxy, Platform API proxy, and related pages published by the Developer as part of that Service. It does not, by itself, govern third-party sites you open from links (for example the Platform, GitHub, or a custom AI endpoint you configure).",
          zh: "**範圍。** 本政策適用於位於 learn.ruc.edu.kg 的 AutoSlides 網頁服務，包括其登入代理、平台 API 代理，以及開發者作為該服務一部分刊出的相關頁面。本政策本身並不管轄閣下從連結開啟的第三方網站（例如平台、GitHub，或閣下設定的自訂 AI 端點）。",
        },
        {
          en: "**1.2 Desktop application.** The AutoSlides desktop application is a separate client that may store data on your computer under its own local configuration. Where that application opens this Policy or the Terms in a browser, the documents describe the web Service and the shared product principles; local desktop file storage remains on your device under your control.",
          zh: "**桌面應用程式。** AutoSlides 桌面應用程式為獨立的客戶端，或會按其本機配置將資料儲存在閣下的電腦上。當該應用程式在瀏覽器中開啟本政策或《條款及細則》時，該等文件描述的是網頁服務及共同的產品原則；桌面本機檔案儲存仍由閣下在其裝置上控制。",
        },
        {
          en: "**1.3 Not the Platform operator.** The Developer is not BIT and does not operate the Platform. Course Content, Platform notes, and Platform object storage are controlled by the Platform under its own terms and policies. The Public Storage Disclosure describes a material property of Platform note-image storage that Users should understand before uploading images to notes.",
          zh: "**並非平台營運者。** 開發者並非 BIT，亦不營運平台。課程內容、平台筆記及平台物件儲存均由平台按其自身條款及政策控制。在用戶將圖像上傳至筆記前，應理解《公共儲存空間披露》所說明的平台筆記圖像儲存的一項重要特性。",
        },
        {
          en: "**1.4 Design principle.** The Service is designed as a **stateless technical intermediary**: it forwards requests you initiate, returns responses, and does not build a Developer-side profile database of Users. The detailed flows below describe where information is held (your browser, the Platform, or a third party you choose) and for what purpose.",
          zh: "**設計原則。** 本服務設計為**無狀態的技術中介**：轉送閣下發起的請求、回傳回應，並不建立開發者端的用戶檔案資料庫。以下各節詳細說明資料存放於何處（閣下的瀏覽器、平台，或閣下選擇的第三方）以及其目的。",
        },
      ],
    },
    {
      id: "on-your-device",
      heading: { en: "2. What stays on your device", zh: "儲存於閣下裝置上的資料" },
      summary: {
        en: "By default your token, settings, and extracted slides live only in this browser.",
        zh: "預設情況下，閣下的權杖、設定及所提取的幻燈片僅保存在此瀏覽器內。",
      },
      paragraphs: [
        {
          en: "**2.1 Sign-in token.** After you sign in, the Platform's access token is kept in your browser's local storage so that you stay signed in between visits. It is not copied into any user-profile database operated by the Service.",
          zh: "**登入權杖。** 閣下登入後，平台的存取權杖會保存在瀏覽器的本機儲存空間（local storage），使閣下在下次到訪時仍保持登入狀態。該權杖不會被寫入本服務營運的任何用戶檔案資料庫。",
        },
        {
          en: "**2.2 Remembered device.** After a successful password or SMS sign-in, the Service may return a sealed device keepsake so the school's sign-in system can skip a later SMS check on the same browser. That sealed blob is stored only in local storage on your device. The Service cannot read its contents without the seal key held on the Worker during a login request. It is not removed when you sign out (so the next password sign-in on this device can still skip SMS); clearing this site's data removes it.",
          zh: "**已記住的裝置。** 密碼或短訊登入成功後，本服務或會回傳一個經密封的裝置憑證，以便學校登入系統在同一瀏覽器上略過其後的短訊驗證。該密封資料僅保存在閣下裝置的本機儲存空間。除登入請求期間 Worker 所持有的密封金鑰外，本服務無法讀取其內容。登出時不會刪除該憑證（以便下次在此裝置以密碼登入時仍可略過短訊）；清除本網站資料即可將其移除。",
        },
        {
          en: "**2.3 Settings.** Your preferences — theme, language, saved searches, subscribed courses, Cloud Notes sync, AI filtering choices, and any AI credentials you enter (for example a GitHub Copilot token or a custom API key) — are kept in local storage on your device only.",
          zh: "**設定。** 閣下的偏好設定——主題、語言、已儲存的搜尋、已訂閱的課程、雲筆記同步、AI 篩選選項，以及閣下輸入的任何 AI 憑證（例如 GitHub Copilot 權杖或自訂 API 金鑰）——僅保存在閣下裝置的本機儲存空間內。",
        },
        {
          en: "**2.4 Extracted slides.** Slides captured during playback are written to your browser's IndexedDB storage on your own device. Exporting to PDF or ZIP is performed locally in your browser. By default the slides are not uploaded anywhere; the optional cases in which a slide image leaves the browser are described in section 5.",
          zh: "**已提取的幻燈片。** 播放期間所擷取的幻燈片會寫入閣下裝置上瀏覽器的 IndexedDB 儲存空間。匯出 PDF 或 ZIP 均在閣下的瀏覽器本機完成。預設不會上傳幻燈片；幻燈片圖像離開瀏覽器的可選情況見第 5 節。",
        },
        {
          en: "**2.5 Cookies.** The Service sets no cookies of its own for advertising, analytics, or cross-site tracking. The Service is protected by Cloudflare, which may set strictly necessary cookies in your browser — for example when a verification check is used to distinguish real visitors from automated traffic. Such cookies exist for security and delivery of the Service and are not used by the Developer to build a marketing profile of you.",
          zh: "**Cookie。** 本服務不會為廣告、分析或跨網站追蹤而設定任何自身的 Cookie。本服務由 Cloudflare 保護，其可能在閣下的瀏覽器中設定必要的 Cookie——例如在使用驗證檢查以區分真實訪客與自動化流量時。該等 Cookie 僅為保安及提供本服務而存在，開發者不會用以建立閣下的營銷剖析檔案。",
        },
        {
          en: "**2.6 Retention on device.** Data in local storage and IndexedDB remains until you clear it, sign out (for the token), uninstall the browser profile, or the browser purges site data under its own policies. The Developer cannot remotely wipe your browser storage.",
          zh: "**裝置上的保留。** 本機儲存空間及 IndexedDB 中的資料會一直保留，直至閣下清除、登出（就權杖而言）、刪除瀏覽器設定檔，或瀏覽器按其自身政策清除網站資料為止。開發者無法遠端抹除閣下瀏覽器的儲存空間。",
        },
      ],
    },
    {
      id: "signing-in",
      heading: { en: "3. Signing in", zh: "登入" },
      summary: {
        en: "Your password is passed to the school's own sign-in system and is not retained by the Service after that request.",
        zh: "閣下的密碼會轉交學校自身的登入系統，本服務在該請求完成後不予保留。",
      },
      paragraphs: [
        {
          en: "**3.1 Password sign-in.** If you sign in with your school account, your username and password are sent over an encrypted connection to the Service, which uses them once to authenticate against the school's own single sign-on system (sso.bit.edu.cn) and obtain an access token. **Your school password is not stored, logged, or retained by the Service after that authentication request completes.**",
          zh: "**密碼登入。** 如閣下以學校帳戶登入，閣下的用戶名稱及密碼會經加密連線傳送至本服務；本服務僅使用一次，向學校自身的統一身份認證系統（sso.bit.edu.cn）進行認證並取得存取權杖。**該認證請求完成後，本服務不會儲存、記錄或保留閣下的學校密碼。**",
        },
        {
          en: "**3.2 SMS second factor.** If the school requires a one-time SMS code, the Service returns a sealed resume token that holds only the mid-login state needed to finish the flow (cookies and form context for the school system). That resume token is kept in your browser's memory for up to five minutes, never written to local storage, and is lost if you reload or cancel. You send the sealed token back with the SMS code; the Service unseals it for that request only, completes the school sign-in, and discards the transient credentials. The Service does not store SMS codes.",
          zh: "**短訊雙重驗證。** 如學校要求一次性短訊驗證碼，本服務會回傳一個經密封的續期權杖，僅載有完成登入流程所需的中途狀態（學校系統的 Cookie 及表單上下文）。該續期權杖最多在閣下瀏覽器的記憶體中保留五分鐘，絕不會寫入本機儲存空間，重新載入或取消即會遺失。閣下將密封權杖連同短訊驗證碼一併送回；本服務僅在該次請求中解密、完成學校登入，並丟棄短暫憑證。本服務不會儲存短訊驗證碼。",
        },
        {
          en: "**3.3 Token sign-in.** Alternatively you may supply a token that already exists in your own browser session on the Platform (including via the optional bookmarklet). In that case your password and SMS code are never sent to the Service.",
          zh: "**權杖登入。** 閣下亦可改為提供已存在於閣下瀏覽器中平台工作階段內的權杖（包括透過可選的書籤小工具）。在此情況下，閣下的密碼及短訊驗證碼絕不會傳送至本服務。",
        },
        {
          en: "**3.4 Signing out.** Signing out deletes the stored Platform token from your browser immediately and asks the Platform to revoke that token. It does not by itself delete your extracted slides, settings, or remembered-device keepsake on this browser.",
          zh: "**登出。** 登出會立即從閣下的瀏覽器中刪除已儲存的平台權杖，並請求平台撤銷該權杖。登出本身不會刪除此瀏覽器上已提取的幻燈片、設定或已記住裝置的憑證。",
        },
        {
          en: "**3.5 Purpose.** Sign-in data is processed solely to authenticate you to the Platform (or to complete a token you already hold) so that the Service can act as your client. It is not used for advertising or sale of personal information.",
          zh: "**目的。** 登入資料僅為向平台認證閣下身分（或完成閣下已持有的權杖）而處理，使本服務能作為閣下的客戶端運作。該等資料不用於廣告或出售個人資料。",
        },
      ],
    },
    {
      id: "through-the-service",
      heading: { en: "4. Requests that pass through the Service", zh: "經由本服務傳送的請求" },
      summary: {
        en: "The Service relays your Platform requests; it keeps no server-side user archive of them.",
        zh: "本服務將閣下對平台的請求轉送出去，並不會在伺服器端為其建立用戶歸檔。",
      },
      paragraphs: [
        {
          en: "**4.1 Why a relay is needed.** A browser cannot call the Platform's API directly (cross-origin and signature requirements), so course listings, playback details, cloud notes, and image uploads you initiate are requested through the Service, which forwards them to the Platform (cbiz.yanhekt.cn) and returns the response to you. Your token travels with those requests because the Platform requires it to identify you.",
          zh: "**為何需要轉送。** 瀏覽器無法直接呼叫平台的 API（跨來源及簽署要求），因此課程列表、播放資訊，以及閣下發起的雲筆記與圖像上傳，均經由本服務請求；本服務將其轉送至平台（cbiz.yanhekt.cn），再把回應傳回閣下。由於平台需要藉此識別閣下身分，閣下的權杖會隨該等請求一併傳送。",
        },
        {
          en: "**4.2 Video.** Recorded lectures are streamed through a relay service (by default relay.ruc.edu.kg; you may configure a different endpoint in Settings). The relay must present your token to the Platform in order to sign each request, so treat any generated stream URL as sensitive. Live streams are fetched by your browser directly from the Platform's content network where the Platform permits it.",
          zh: "**影片。** 錄播課程經由中轉服務串流（預設為 relay.ruc.edu.kg；閣下可在設定中改用其他端點）。該服務須向平台出示閣下的權杖，方能為每個請求簽署，因此任何產生的串流網址均應視作敏感資料。在平台允許的情況下，直播由閣下的瀏覽器直接向平台的內容網絡獲取。",
        },
        {
          en: "**4.3 No server-side user archive.** The Service is designed as a **stateless relay**: it does not operate a Developer database of your account, your viewing history, or the Content you access, and it does not retain school passwords after the login request completes (section 3). Mid-login state for SMS is sealed and held only by your browser for a few minutes. Ordinary request handling may involve ephemeral processing in memory on the edge in order to forward traffic; that is not a persistent archive of your activity for the Developer to browse later.",
          zh: "**並無伺服器端用戶歸檔。** 本服務設計為**無狀態中轉**：並不營運載有閣下帳戶、觀看記錄或所存取內容的開發者資料庫，亦不會在登入請求完成後保留學校密碼（見第 3 節）。短訊登入的中途狀態經密封後僅由閣下的瀏覽器持有數分鐘。一般請求處理或會在邊緣以記憶體進行短暫處理以便轉送流量；此並非供開發者其後瀏覽的持久活動歸檔。",
        },
        {
          en: "**4.4 Hosting and network infrastructure.** Requests are carried over the Developer's hosting and edge provider (Cloudflare). That provider processes network-level data (for example IP address, timestamps, and security signals) as needed to deliver, protect, and operate the Service, under its own terms and infrastructure policies. The Developer does not use that infrastructure to sell your personal information or to serve third-party advertising.",
          zh: "**託管及網絡基礎設施。** 請求經由開發者的託管及邊緣供應商（Cloudflare）傳送。該供應商按提供、保護及營運本服務所需，處理網絡層資料（例如 IP 位址、時間戳及保安訊號），並受其自身條款及基礎設施政策約束。開發者不會利用該基礎設施出售閣下的個人資料或投放第三方廣告。",
        },
      ],
    },
    {
      id: "when-slides-leave",
      heading: {
        en: "5. When slide images leave your browser",
        zh: "幻燈片圖像何時離開閣下的瀏覽器",
      },
      summary: {
        en: "Only when you use AI filtering or Cloud Notes features that send images outward.",
        zh: "僅在閣下使用會向外傳送圖像的 AI 篩選或雲筆記功能時。",
      },
      paragraphs: [
        {
          en: "**5.1 Default.** If you only watch, extract, review, and export slides, those images stay in IndexedDB on your device. Nothing in that path uploads a slide to the Developer as a permanent store or to a third party.",
          zh: "**預設。** 如閣下僅觀看、提取、審閱及匯出幻燈片，該等圖像會留在閣下裝置的 IndexedDB 內。該路徑不會把幻燈片作為永久儲存上傳至開發者，亦不會上傳至第三方。",
        },
        {
          en: "**5.2 AI filtering.** When AI filtering is enabled (it can be turned on or off in Settings), candidate slide images are sent from your browser as base64 PNG frames to the AI provider you have selected, solely so that provider can return a classification (for example slide / not a slide / possible edit). The Service does not use those images to train a model on your behalf. You choose one of the options in sections 5.3–5.5.",
          zh: "**AI 篩選。** 當 AI 篩選已啟用（可在設定中開關）時，候選幻燈片圖像會以 base64 PNG 形式由閣下的瀏覽器直接傳送至閣下所選的 AI 服務，僅供其回傳分類結果（例如：幻燈片／非幻燈片／可能為編輯畫面）。本服務不會用該等圖像代閣下訓練任何模型。閣下可選擇第 5.3 至 5.5 節所述其中一項。",
        },
        {
          en: "**5.3 Built-in AI.** Requests go to the Developer's AI endpoint (openai.ruc.edu.kg), authenticated with your Platform token. The image is used to produce the classification response for that request and is not retained by the Service as a slide library.",
          zh: "**內建 AI。** 請求會送往開發者的 AI 端點（openai.ruc.edu.kg），並以閣下的平台權杖認證。圖像僅用於產生該次請求的分類回應，本服務不會將其作為幻燈片庫保留。",
        },
        {
          en: "**5.4 GitHub Copilot.** After you connect Copilot (device-code flow through copilot.ruc.edu.kg), images and your Copilot access token are sent to that Copilot proxy for classification. Your Copilot token is stored only in this browser's local storage.",
          zh: "**GitHub Copilot。** 閣下連接 Copilot 後（經 copilot.ruc.edu.kg 的裝置碼流程），圖像及閣下的 Copilot 存取權杖會送往該 Copilot 代理以作分類。閣下的 Copilot 權杖僅保存在此瀏覽器的本機儲存空間。",
        },
        {
          en: "**5.5 Custom endpoint.** If you configure an OpenAI-compatible base URL, API key, and model, images and that key are sent from your browser directly to the endpoint you named. That provider's own policies then apply; the Service never sees the key or the image on a server of its own.",
          zh: "**自訂端點。** 如閣下設定 OpenAI 相容的基底網址、API 金鑰及模型，圖像及該金鑰會由閣下的瀏覽器直接送往閣下指定的端點。其後適用該服務供應商自身的政策；本服務的伺服器不會看到該金鑰或圖像。",
        },
        {
          en: '**5.6 Cloud Notes and watch-mode sync.** When Cloud Notes sync is enabled, slides that pass post-processing may be uploaded through the Service to the Platform\'s own storage (Yanhekt MinIO at coss.yanhekt.cn) and inserted into a note under your Platform account (managed groups such as "ASuser"). Images uploaded this way become part of your Platform notes; the Platform hosts them under its own policies. That storage has been observed to allow **anonymous listing and download** of note images — not merely access by persons who already have a direct link — so do not sync private or sensitive material. Manual image inserts in the Notes editor use the same Platform upload path. See the Public Storage Disclosure for the full statement.',
          zh: "**雲筆記及觀看模式同步。** 啟用雲筆記同步後，通過後處理的幻燈片或會經由本服務上傳至平台自身的儲存（延河課堂位於 coss.yanhekt.cn 的 MinIO），並插入閣下平台帳戶下的筆記（例如受管理的「ASuser」群組）。如此上傳的圖像會成為閣下平台筆記的一部分，由平台按其自身政策託管。經觀察，該儲存允許對筆記圖像進行**匿名列出及下載**——而非僅限於已持有直接連結的人存取——因此請勿同步私人或敏感資料。在筆記編輯器中手動插入的圖像，亦使用同一平台上傳路徑。完整說明見《公共儲存空間披露》。",
        },
      ],
    },
    {
      id: "third-parties",
      heading: { en: "6. Third parties", zh: "第三方" },
      summary: {
        en: "The Platform, the school, AI providers you choose, and infrastructure providers each see what they must to perform their role.",
        zh: "平台、學校、閣下選擇的 AI 服務及基礎設施供應商，均會看到履行其角色所需的資料。",
      },
      paragraphs: [
        {
          en: "**6.1 The Platform and the school.** Everything you do through the Service is, from the Platform's perspective, an ordinary use of your own account — including notes you create and images you upload when Cloud Notes is on. The Platform and the school's sign-in system receive and handle that activity under their own policies. The Developer has no control over, and no general visibility into, what they record on their systems.",
          zh: "**平台及學校。** 從平台的角度而言，閣下透過本服務所作的一切，均屬對閣下自身帳戶的一般使用——包括啟用雲筆記時所建立的筆記及上傳的圖像。平台及學校的登入系統會依其自身政策接收及處理該等活動。開發者對其系統上所記錄的內容既無控制權，亦無一般可見性。",
        },
        {
          en: "**6.2 AI providers.** When AI filtering is enabled, the provider you selected (built-in, Copilot, or custom) receives the slide images you submit for classification, as described in section 5. Their handling of those requests is governed by their own terms and policies.",
          zh: "**AI 服務供應商。** 啟用 AI 篩選時，閣下所選的服務（內建、Copilot 或自訂）會收到閣下提交以供分類的幻燈片圖像，詳見第 5 節。其對該等請求的處理受其自身條款及政策管轄。",
        },
        {
          en: "**6.3 GitHub.** The Desktop Apps page fetches release information and documentation from GitHub (and, if GitHub is unreachable, from a mirror such as gh-proxy.org). Opening that page reveals your IP address to those services in the ordinary course of making a request. Connecting Copilot also involves GitHub's device authorization flow. No other page of the Service contacts them for unrelated purposes.",
          zh: "**GitHub。** 「桌面應用」頁面會從 GitHub 獲取發佈資訊及文檔（如無法連接 GitHub，則改用例如 gh-proxy.org 的鏡像）。開啟該頁面時，會如一般網絡請求般向該等服務透露閣下的 IP 位址。連接 Copilot 亦會涉及 GitHub 的裝置授權流程。本服務的其他頁面不會為無關目的與其聯絡。",
        },
        {
          en: "**6.4 Video relay.** The recorded-video relay (default relay.ruc.edu.kg, or another endpoint you configure) receives the stream URL and your Platform token in order to sign and proxy segments. Live streams do not use that relay by default.",
          zh: "**影片中轉。** 錄播影片中轉（預設 relay.ruc.edu.kg，或閣下設定的其他端點）會收到串流網址及閣下的平台權杖，以便簽署及代理分段。直播預設不使用該中轉。",
        },
        {
          en: "**6.5 Infrastructure.** Cloudflare and any other infrastructure providers used to host or protect the Service process technical traffic data as described in section 4.4.",
          zh: "**基礎設施。** Cloudflare 及用於託管或保護本服務的任何其他基礎設施供應商，會按第 4.4 節所述處理技術流量資料。",
        },
      ],
    },
    {
      id: "not-done",
      heading: { en: "7. What the Service does not do", zh: "本服務不會做的事" },
      summary: {
        en: "No advertising, no marketing analytics, no sale of personal information, no training a Developer model on your slides.",
        zh: "沒有廣告、營銷分析、出售個人資料，亦不會用閣下的幻燈片訓練開發者模型。",
      },
      paragraphs: [
        {
          en: "**7.1 No advertising or sale of data.** The Service contains no advertising, no third-party advertising pixels, and no sale of personal information. The Developer does not sell or rent your school credentials, tokens, or extracted slides.",
          zh: "**無廣告或出售資料。** 本服務不含廣告、不含第三方廣告像素，亦不出售個人資料。開發者不會出售或出租閣下的學校憑證、權杖或已提取的幻燈片。",
        },
        {
          en: "**7.2 No marketing profile.** The Service does not build a marketing or behavioural advertising profile of you. It does not use your Content to train a foundation model of the Developer's own on the basis of your extracted slides.",
          zh: "**無營銷剖析。** 本服務不會建立閣下的營銷或行為廣告剖析檔案。亦不會基於閣下提取的幻燈片，使用閣下的內容訓練開發者自身的基礎模型。",
        },
        {
          en: "**7.3 Images leave only when a feature requires it.** Slide images leave your browser only when a feature you use requires it (section 5) — AI filtering you enable, or Cloud Notes / note image upload you use. Local watch, extract, review, and export do not upload slides to the Developer as a library.",
          zh: "**圖像僅在功能需要時離開。** 幻燈片圖像僅在閣下所使用的功能有此需要時才會離開瀏覽器（見第 5 節）——即閣下啟用的 AI 篩選，或閣下使用的雲筆記／筆記圖像上傳。本機觀看、提取、審閱及匯出不會把幻燈片作為資料庫上傳至開發者。",
        },
      ],
    },
    {
      id: "security",
      heading: { en: "8. Security", zh: "保安" },
      summary: {
        en: "Encryption in transit and design choices that limit what the Developer holds; no method is perfect.",
        zh: "傳輸加密及限制開發者持有範圍的設計；但任何方法均非完美。",
      },
      paragraphs: [
        {
          en: "**8.1 Measures.** The Service is delivered over HTTPS. School passwords are used only for the authentication request described in section 3 and are not retained afterwards. SMS mid-login state is sealed for a short period and held in your browser. Platform tokens and AI keys that you store stay in your browser's local storage under your control.",
          zh: "**措施。** 本服務經 HTTPS 提供。學校密碼僅用於第 3 節所述的認證請求，其後不予保留。短訊登入中途狀態經密封並短暫保存在閣下的瀏覽器中。閣下儲存的平台權杖及 AI 金鑰留在閣下控制下的瀏覽器本機儲存空間。",
        },
        {
          en: "**8.2 No perfect security.** No method of transmission or storage is completely secure. The User remains responsible for the physical and account security of their own device, for not sharing tokens or passwords, and for what they choose to upload to the Platform (including note images subject to the Public Storage Disclosure).",
          zh: "**並無完美保安。** 任何傳輸或儲存方法均非完全安全。用戶仍須對其自身裝置的實體及帳戶保安負責，不得分享權杖或密碼，並須對其選擇上傳至平台的內容負責（包括受《公共儲存空間披露》約束的筆記圖像）。",
        },
      ],
    },
    {
      id: "deleting",
      heading: { en: "9. Accessing and deleting your data", zh: "查閱及刪除閣下的資料" },
      summary: {
        en: "Browser data is yours to clear; notes and images on the Platform follow Platform tools.",
        zh: "瀏覽器資料可由閣下自行清除；平台上的筆記與圖像則依平台工具處理。",
      },
      paragraphs: [
        {
          en: "**9.1 Data on your device.** Because the Service keeps its copy of your token, settings, and local slides only in your browser, you can remove that copy yourself: sign out to delete the token (and ask the Platform to revoke it), and clear this site's data in your browser settings to erase settings, the remembered-device keepsake, and every slide stored in IndexedDB. The Service holds no separate server-side archive of those items for the Developer to delete on your behalf.",
          zh: "**裝置上的資料。** 由於本服務對閣下權杖、設定及本機幻燈片的保存僅存在於閣下的瀏覽器內，閣下可自行將其移除：登出即可刪除權杖（並請求平台撤銷該權杖）；在瀏覽器設定中清除本網站的資料，即可抹除設定、已記住裝置憑證，以及 IndexedDB 中所有已儲存的幻燈片。本服務並無另存伺服器端歸檔可供開發者代閣下刪除。",
        },
        {
          en: "**9.2 Data on the Platform.** Deleting local browser data does not remove notes, uploaded images, or other material that already sits in your Platform account (including anything created by Cloud Notes sync). Use the Platform's own note tools — or contact the Platform — to manage or delete that material. It also does not close or alter your school account.",
          zh: "**平台上的資料。** 刪除本機瀏覽器資料，不會移除已存在於閣下平台帳戶中的筆記、已上傳圖像或其他資料（包括雲筆記同步所建立者）。請使用平台自身的筆記工具——或聯絡平台——以管理或刪除該等資料。此舉亦不會關閉或更改閣下的學校帳戶。",
        },
        {
          en: "**9.3 Third-party providers.** Data you sent to an AI provider, GitHub, or a custom endpoint you configured must be managed under that provider's own tools and policies. The Developer cannot delete data from systems it does not control.",
          zh: "**第三方服務供應商。** 閣下傳送至 AI 服務、GitHub 或閣下設定的自訂端點的資料，須按該供應商自身的工具及政策管理。開發者無法從其不控制的系統中刪除資料。",
        },
        {
          en: "**9.4 Questions.** For questions about this Policy or about data the Service processes, contact the Developer at the address in section 11. Requests that concern only Platform-held data should be directed to the Platform or your institution.",
          zh: "**查詢。** 如對本政策或本服務所處理的資料有疑問，請按第 11 節的地址聯絡開發者。僅涉及平台所持資料的請求，應向平台或閣下所屬機構提出。",
        },
      ],
    },
    {
      id: "children",
      heading: { en: "10. Children and institutional use", zh: "未成年人及機構使用" },
      summary: {
        en: "Intended for authorised Platform users; not directed at young children.",
        zh: "供獲授權的平台用戶使用；並非以幼兒為對象。",
      },
      paragraphs: [
        {
          en: "**10.1 Intended audience.** The Service is intended for persons who already have lawful access to the Platform (for example students or staff under institutional rules). It is not directed at children who lack capacity to agree to the Terms or to use the Platform.",
          zh: "**預定對象。** 本服務供已合法存取平台的人士使用（例如按機構規則的學生或教職員）。本服務並非以欠缺同意本條款或使用平台之行為能力的兒童為對象。",
        },
        {
          en: "**10.2 Institutional rules.** Where your institution imposes additional rules on access to course materials, recording, or cloud notes, those rules continue to apply. This Policy does not grant permission that the Platform or your institution has not granted.",
          zh: "**機構規則。** 如閣下所屬機構就課程資料存取、錄製或雲筆記另有規定，該等規定仍然適用。本政策並不授予平台或閣下所屬機構未授予的權限。",
        },
      ],
    },
    {
      id: "changes",
      heading: { en: "11. Changes, language, and contact", zh: "變更、語言及聯絡" },
      summary: {
        en: "Material changes update the date above; English prevails; contact the Developer with questions.",
        zh: "重大變更會更新上方日期；以英文為準；查詢請聯絡開發者。",
      },
      paragraphs: [
        {
          en: "**11.1 Changes.** If this Policy changes materially, the date shown at the top of this page will be updated. Where practicable, the Developer may also provide an in-product notice. Continuing to use the Service after a change becomes effective indicates acceptance of the revised Policy. If you do not agree, you must stop using the Service and may clear site data as described in section 9.",
          zh: "**變更。** 如本政策有重大變更，本頁頂部所示的日期將會更新。在可行情況下，開發者亦可提供產品內通知。變更生效後繼續使用本服務，即表示接受經修訂的政策。如閣下不同意，則必須停止使用本服務，並可按第 9 節所述清除網站資料。",
        },
        {
          en: "**11.2 Language.** In the event of any discrepancy between the English and Chinese versions of this Policy, the English version shall prevail.",
          zh: "**語言。** 本政策的中英版本如有任何歧義，概以英文版本為準。",
        },
        {
          en: "**11.3 Contact.** For questions about this Policy or about personal data processed by the Service, please contact info@ruc.edu.kg. For Platform storage configuration, takedown of Platform-hosted objects, or institutional data-protection processes, contact the Platform or your institution; the Developer cannot delete or reconfigure Platform buckets.",
          zh: "**聯絡。** 如對本政策或本服務所處理的個人資料有任何疑問，請聯絡 info@ruc.edu.kg。有關平台儲存配置、平台託管物件的下架，或機構資料保護程序，請聯絡平台或閣下所屬機構；開發者無法刪除或重新配置平台儲存桶。",
        },
      ],
    },
  ],
};
