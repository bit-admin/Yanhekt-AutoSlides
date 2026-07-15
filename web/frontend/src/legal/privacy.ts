import type { LegalDoc } from "./types";

// Drafted to describe what this app actually does. Each claim maps to code:
//   - localStorage keys           -> stores/authStore.ts, stores/configStore.ts
//   - slides in IndexedDB         -> lib/slideStore.ts, lib/idb.ts
//   - password -> school SSO      -> src/routes/login.ts (AES, forwarded, not kept)
//   - API proxy                   -> src/routes/yanhektProxy.ts -> cbiz.yanhekt.cn
//   - recorded video relay        -> relay.ruc.edu.kg
//   - GitHub fetch on /apps       -> lib/github.ts
// If any of those change, this document has to change with them.

export const privacyDoc: LegalDoc = {
  id: "privacy",
  title: { en: "Privacy Policy", zh: "私隱政策" },
  updated: "2026-07-15",
  intro: [
    {
      en: 'This policy explains what happens to your information when you use the AutoSlides web service at learn.ruc.edu.kg ("Service"). It forms part of, and should be read together with, the Terms and Conditions.',
      zh: "本政策說明閣下使用 learn.ruc.edu.kg 的 AutoSlides 網頁服務（下稱「本服務」）時，閣下資料的處理方式。本政策構成《條款及細則》的一部分，並應與其一併閱讀。",
    },
    {
      en: "In short: the Service has no user accounts of its own and no database. Your sign-in token, your settings, and every slide you extract stay in your own browser. The Developer never sees your extracted slides.",
      zh: "簡而言之：本服務並無自設的用戶帳戶，亦無資料庫。閣下的登入權杖、設定，以及所提取的每一張幻燈片，均保留在閣下自己的瀏覽器內。開發者永遠不會看到閣下提取的幻燈片。",
    },
  ],
  sections: [
    {
      id: "on-your-device",
      heading: { en: "1. What stays on your device", zh: "儲存於閣下裝置上的資料" },
      summary: {
        en: "Your token, your settings, and your extracted slides never leave your browser.",
        zh: "閣下的權杖、設定及所提取的幻燈片，均不會離開閣下的瀏覽器。",
      },
      paragraphs: [
        {
          en: "**Sign-in token.** After you sign in, the Platform's access token is kept in your browser's local storage so that you stay signed in between visits. It is not copied to any server operated by the Developer.",
          zh: "**登入權杖。** 閣下登入後，平台的存取權杖會保存在瀏覽器的本機儲存空間（local storage），使閣下在下次到訪時仍保持登入狀態。該權杖不會被複製到開發者營運的任何伺服器。",
        },
        {
          en: "**Settings.** Your preferences — such as theme, language, saved searches, and subscribed courses — are kept in local storage on your device only.",
          zh: "**設定。** 閣下的偏好設定（例如主題、語言、已儲存的搜尋及已訂閱的課程）僅保存在閣下裝置的本機儲存空間內。",
        },
        {
          en: "**Extracted slides.** Slides captured during playback are written to your browser's IndexedDB storage on your own device. They are never uploaded, transmitted, or made accessible to the Developer or to any third party. Exporting to PDF or ZIP is performed locally in your browser.",
          zh: "**已提取的幻燈片。** 播放期間所擷取的幻燈片會寫入閣下裝置上瀏覽器的 IndexedDB 儲存空間。該等幻燈片永遠不會被上傳、傳輸，亦不會讓開發者或任何第三方存取。匯出 PDF 或 ZIP 均在閣下的瀏覽器本機完成。",
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
        en: "Your password is passed to the school's own sign-in system and is never stored.",
        zh: "閣下的密碼會轉交學校自身的登入系統，且永不儲存。",
      },
      paragraphs: [
        {
          en: "**Password sign-in.** If you sign in with your school account, your username and password are sent over an encrypted connection to the Service, which uses them once to authenticate against the school's own single sign-on system (sso.bit.edu.cn) and obtain an access token. Your credentials are not stored, logged, or retained by the Service after that request completes.",
          zh: "**密碼登入。** 如閣下以學校帳戶登入，閣下的用戶名稱及密碼會經加密連線傳送至本服務；本服務僅使用一次，向學校自身的統一身份認證系統（sso.bit.edu.cn）進行認證並取得存取權杖。該請求完成後，本服務不會儲存、記錄或保留閣下的登入憑證。",
        },
        {
          en: "**Token sign-in.** Alternatively you may supply a token that already exists in your own browser session on the Platform. In that case your password is never involved at all.",
          zh: "**權杖登入。** 閣下亦可改為提供已存在於閣下瀏覽器中平台工作階段內的權杖。在此情況下，完全不涉及閣下的密碼。",
        },
        {
          en: "**Signing out.** Signing out deletes the stored token from your browser immediately.",
          zh: "**登出。** 登出會立即從閣下的瀏覽器中刪除已儲存的權杖。",
        },
      ],
    },
    {
      id: "through-the-service",
      heading: { en: "3. Requests that pass through the Service", zh: "經由本服務傳送的請求" },
      summary: {
        en: "The Service relays your requests to the Platform; it keeps no record of them.",
        zh: "本服務將閣下的請求轉送至平台，並不會保留任何相關記錄。",
      },
      paragraphs: [
        {
          en: "**Why a relay is needed.** A browser cannot call the Platform's API directly, so course listings and playback details are requested through the Service, which forwards them to the Platform (cbiz.yanhekt.cn) and returns the response to you. Your token travels with those requests because the Platform requires it to identify you.",
          zh: "**為何需要轉送。** 瀏覽器無法直接呼叫平台的 API，因此課程列表及播放資訊會經由本服務請求；本服務將其轉送至平台（cbiz.yanhekt.cn），再把回應傳回閣下。由於平台需要藉此識別閣下身分，閣下的權杖會隨該等請求一併傳送。",
        },
        {
          en: "**Video.** Recorded lectures are streamed through a relay service (relay.ruc.edu.kg), which must present your token to the Platform in order to sign each request. Live streams are fetched by your browser directly from the Platform's content network.",
          zh: "**影片。** 錄播課程經由中轉服務（relay.ruc.edu.kg）串流；該服務須向平台出示閣下的權杖，方能為每個請求簽署。直播則由閣下的瀏覽器直接向平台的內容網絡獲取。",
        },
        {
          en: "**No server-side record.** The Service is a stateless relay: it operates no database and keeps no server-side record of your account, your viewing history, or the Content you access. Requests are carried over the Developer's hosting provider (Cloudflare), whose handling of network traffic is governed by its own policies.",
          zh: "**並無伺服器端記錄。** 本服務為無狀態的中轉服務：並無營運任何資料庫，亦不會在伺服器端保留閣下的帳戶、觀看記錄或所存取內容的任何記錄。請求經由開發者的託管服務供應商（Cloudflare）傳送，其對網絡流量的處理受其自身政策管轄。",
        },
      ],
    },
    {
      id: "third-parties",
      heading: { en: "4. Third parties", zh: "第三方" },
      summary: {
        en: "The Platform, the school's sign-in system, and GitHub each see requests you direct to them.",
        zh: "平台、學校的登入系統及 GitHub 均會看到閣下向其發出的請求。",
      },
      paragraphs: [
        {
          en: "**The Platform and the school.** Everything you do through the Service is, from the Platform's perspective, an ordinary use of your own account. The Platform and the school's sign-in system receive and handle that activity under their own policies. The Developer has no control over, and no visibility into, what they record.",
          zh: "**平台及學校。** 從平台的角度而言，閣下透過本服務所作的一切，均屬對閣下自身帳戶的一般使用。平台及學校的登入系統會依其自身政策接收及處理該等活動。開發者對其所記錄的內容既無控制權，亦無從知悉。",
        },
        {
          en: "**GitHub.** The Desktop Apps page fetches release information and documentation from GitHub (and, if GitHub is unreachable, from the gh-proxy.org mirror). Opening that page reveals your IP address to those services in the ordinary course of making a request. No other page contacts them.",
          zh: "**GitHub。** 「桌面應用」頁面會從 GitHub 獲取發佈資訊及文檔（如無法連接 GitHub，則改用 gh-proxy.org 鏡像）。開啟該頁面時，會如一般網絡請求般向該等服務透露閣下的 IP 位址。其他頁面均不會與其聯絡。",
        },
      ],
    },
    {
      id: "not-done",
      heading: { en: "5. What the Service does not do", zh: "本服務不會做的事" },
      summary: {
        en: "No advertising, no analytics or tracking scripts, no profiling, no selling of data.",
        zh: "沒有廣告、分析或追蹤程式碼、用戶剖析，亦不會出售資料。",
      },
      paragraphs: [
        {
          en: "The Service contains no advertising, no analytics or tracking scripts, and no third-party tracking of any kind. It does not build a profile of you, does not sell or share personal information, and does not use your data to train any model. Your extracted slides are never transmitted anywhere.",
          zh: "本服務不含任何廣告、分析或追蹤程式碼，亦無任何形式的第三方追蹤。本服務不會建立閣下的用戶剖析檔案，不會出售或分享個人資料，亦不會使用閣下的資料訓練任何模型。閣下提取的幻燈片永遠不會被傳送至任何地方。",
        },
      ],
    },
    {
      id: "deleting",
      heading: { en: "6. Deleting your data", zh: "刪除閣下的資料" },
      summary: {
        en: "You hold all of it — clearing your browser's site data erases everything.",
        zh: "所有資料均由閣下持有——清除瀏覽器的網站資料即可全部抹除。",
      },
      paragraphs: [
        {
          en: "Because everything the Service keeps about you is stored in your own browser, you can remove all of it yourself: sign out to delete the token, and clear this site's data in your browser settings to erase your settings and every stored slide. The Developer holds nothing to delete on your behalf. Deleting local data does not affect your account on the Platform.",
          zh: "由於本服務保存的關於閣下的一切資料均儲存於閣下自己的瀏覽器內，閣下可自行將其全部移除：登出即可刪除權杖；在瀏覽器設定中清除本網站的資料，即可抹除閣下的設定及所有已儲存的幻燈片。開發者並無持有任何可代閣下刪除的資料。刪除本機資料不會影響閣下在平台上的帳戶。",
        },
      ],
    },
    {
      id: "changes",
      heading: { en: "7. Changes and contact", zh: "變更及聯絡" },
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
