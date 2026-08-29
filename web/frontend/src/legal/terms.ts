import type { LegalDoc } from "./types";

// Ported from docs/terms.md (desktop-oriented original). Substance retained and
// expanded for the web service: acceptance, licence, credentials, third-party
// relays/AI/Platform storage, termination, and changes. Cross-reads with
// privacy.ts and disclosure.ts — if those documents change on Cloud Notes,
// public storage, or AI paths, re-check the corresponding clauses here.

export const termsDoc: LegalDoc = {
  id: "terms",
  title: { en: "Terms and Conditions", zh: "條款及細則" },
  updated: "2026-08-03",
  intro: [
    {
      en: 'By accessing, downloading, installing, or using the AutoSlides software application or the AutoSlides web service at learn.ruc.edu.kg (together, the "Software" or "Service"), you ("User") signify your agreement to be legally bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, you are not permitted to access or use the Software.',
      zh: "存取、下載、安裝或使用 AutoSlides 軟件應用程式或位於 learn.ruc.edu.kg 的 AutoSlides 網頁服務（合稱「軟件」或「本服務」），即表示閣下（下稱「用戶」）同意受本條款及細則（下稱「條款」）的法律約束。如閣下不同意本條款，則不得存取或使用本軟件。",
    },
    {
      en: "These Terms should be read together with the Privacy Policy, the Copyright & Intellectual Property Notice, and the Public Storage Disclosure published with the Service. Those documents form part of the contractual framework between the User and the Developer. In the event of any conflict on a matter of privacy handling, the Privacy Policy prevails for that matter; on intellectual-property ownership and rights-holder notices, the Copyright & Intellectual Property Notice states the Developer's detailed position; on the public character of Platform note-image storage, the Public Storage Disclosure states the Developer's detailed notice. These Terms govern use of the Software generally.",
      zh: "本條款應與本服務一併刊出的《私隱政策》、《版權及知識產權聲明》及《公共儲存空間披露》一併閱讀。該等文件構成用戶與開發者之間合約框架的一部分。就私隱處理事宜如有衝突，概以《私隱政策》為準；就知識產權歸屬及權利持有人通知，以《版權及知識產權聲明》作為開發者的詳細立場；就平台筆記圖像儲存的公開性質，以《公共儲存空間披露》作為開發者的詳細告知。本條款管轄軟件的一般使用。",
    },
    {
      en: '**In short:** AutoSlides is an independent third-party tool for retrieving and working with course materials from Yanhe Classroom at the User\'s direction. It is not affiliated with BIT. Content remains the rights holders\'. The Software is provided "as is"; the User is responsible for lawful use, for what they upload to the Platform (including note images that may be publicly listable), and for any AI or relay endpoints they enable.',
      zh: "**簡而言之：** AutoSlides 為獨立的第三方工具，按用戶指示從延河課堂獲取及處理課程資料。其與 BIT 無關聯。內容仍屬權利持有人所有。軟件按「原樣」提供；用戶須對合法使用、上傳至平台的內容（包括可能可被公開列出的筆記圖像），以及所啟用的任何 AI 或中轉端點負責。",
    },
  ],
  sections: [
    {
      id: "definitions",
      heading: { en: "1. Definitions", zh: "定義" },
      summary: {
        en: "Defines the Software, Platform, Content, Developer, and related terms.",
        zh: "界定「軟件」、「平台」、「內容」、「開發者」及相關用語。",
      },
      paragraphs: [
        {
          en: '**1.1 "Software" / "Service"** refers to the AutoSlides software application and web service provided by the Developer and designed to interact with the Platform, including any updates, interfaces, documentation, and related components made available by the Developer under these Terms.',
          zh: '**「軟件」／「本服務」** 指由開發者提供、旨在與平台進行交互的 AutoSlides 軟件應用程式及網頁服務，包括開發者在本條款下提供的任何更新、介面、文檔及相關組件。',
        },
        {
          en: '**1.2 "Platform"** refers to the "Yanhe Classroom" (Yanhekt) platform of the Beijing Institute of Technology ("BIT"), including its websites, APIs, content delivery networks, object storage, and related systems as operated by or for BIT or its contractors — not by the Developer.',
          zh: '**「平台」** 指北京理工大學（「BIT」）的「延河課堂」（Yanhekt）平台，包括由其或其承辦商（而非開發者）營運的網站、API、內容分發網絡、物件儲存及相關系統。',
        },
        {
          en: '**1.3 "Content"** refers to all course resources and related materials available on or through the Platform, including but not limited to videos, documents, images, audio files, slides, transcripts, and notes, whether live, recorded, or user-generated on the Platform.',
          zh: '**「內容」** 指於平台上或透過平台提供的所有課程資源及相關資料，包括但不限於影片、文檔、圖像、音訊檔案、幻燈片、逐字稿及筆記，無論屬直播、錄播或平台上的用戶生成內容。',
        },
        {
          en: '**1.4 "Developer"** refers to the creator and owner of the Software (contact: info@ruc.edu.kg).',
          zh: '**「開發者」** 指本軟件的創作者及擁有人（聯絡：info@ruc.edu.kg）。',
        },
        {
          en: '**1.5 "User"** refers to any natural person who accesses or uses the Software.',
          zh: '**「用戶」** 指任何存取或使用本軟件的自然人。',
        },
        {
          en: '**1.6 "Terms"** means these Terms and Conditions, as updated from time to time in accordance with section 13.',
          zh: '**「條款」** 指本條款及細則，並可按第 13 節不時更新。',
        },
      ],
    },
    {
      id: "acceptance",
      heading: { en: "2. Acceptance and eligibility", zh: "接受及資格" },
      summary: {
        en: "Using the Software binds you; you must be allowed to use the Platform.",
        zh: "使用軟件即受約束；用戶須獲准使用平台。",
      },
      paragraphs: [
        {
          en: "**2.1 Binding agreement.** Accessing or using the Software constitutes acceptance of these Terms. If the User does not agree, the User must not access or use the Software and must discontinue any existing use.",
          zh: "**具約束力的協議。** 存取或使用本軟件即構成接受本條款。如用戶不同意，則不得存取或使用本軟件，並須停止任何既有使用。",
        },
        {
          en: "**2.2 Capacity and Platform entitlement.** The User represents that they have legal capacity to enter into these Terms and that they are authorised to access the Platform under the Platform's own rules and any applicable institutional policy (for example as a student, staff member, or other permitted account holder). The Software does not grant Platform access rights; it only operates with credentials or tokens the User already lawfully holds.",
          zh: "**行為能力及平台權限。** 用戶聲明其具有訂立本條款的法律行為能力，並有權按平台自身規則及任何適用機構政策存取平台（例如作為學生、教職員或其他獲准帳戶持有人）。本軟件並不授予平台存取權；其僅在用戶已合法持有的憑證或權杖下運作。",
        },
        {
          en: "**2.3 Electronic acceptance.** Clicking to sign in, continuing past a first-run or legal notice, or otherwise using the Service after these Terms have been presented or linked constitutes electronic acceptance to the same extent as a signed writing, to the extent permitted by applicable law.",
          zh: "**電子接受。** 點擊登入、繼續通過首次使用或法律提示，或在本條款已展示或連結後以其他方式使用本服務，在適用法律允許的範圍內，構成與簽署書面文件同等效力的電子接受。",
        },
      ],
    },
    {
      id: "affiliation",
      heading: { en: "3. Disclaimer of affiliation", zh: "關聯關係聲明" },
      summary: {
        en: "The Software is an independent third-party tool with no connection to BIT.",
        zh: "本軟件為獨立的第三方工具，與 BIT 並無任何關聯。",
      },
      paragraphs: [
        {
          en: "**3.1 Independent development.** The Software is an independent project developed and maintained solely by the Developer. It acts as a third-party utility tool. It is not an official campus product.",
          zh: "**獨立開發。** 本軟件為一項獨立項目，由開發者自行開發及維護。本軟件僅作為第三方實用工具，並非官方校園產品。",
        },
        {
          en: "**3.2 No affiliation.** **This tool is NOT an official application of, and is NOT affiliated with, associated with, endorsed by, sponsored by, or in any way connected to Beijing Institute of Technology (BIT), Yanhe Classroom, or any of their subsidiaries, affiliates, contractors, or operators.** The Developer has no official relationship, partnership, agency, or joint venture with BIT or the Platform.",
          zh: "**無關聯關係。** **本工具並非北京理工大學（BIT）、延河課堂的官方應用程式，亦與其或其任何附屬機構、關聯方、承辦商或營運者無任何關聯、聯繫、獲其認可、贊助或以任何方式相關。** 開發者與 BIT 或平台並無任何官方關係、合夥關係、代理關係或合資關係。",
        },
        {
          en: '**3.3 Trademarks.** All product and company names mentioned herein (including but not limited to "Yanhe Classroom", "Yanhekt", and "BIT") are trademarks™ or registered® trademarks of their respective holders. Use of them in the Software or in these Terms is solely for identification of the third-party systems with which the Software interacts and does not imply any affiliation with or endorsement by those holders.',
          zh: "**商標。** 此處提及的所有產品及公司名稱（包括但不限於「延河課堂」、「Yanhekt」及「BIT」）均為其各自持有人的商標™或註冊®商標。在本軟件或本條款中使用該等名稱，僅為識別本軟件所交互的第三方系統，並不暗示與其有任何關聯或獲其認可。",
        },
        {
          en: "**3.4 No authority to bind.** Nothing in the Software or these Terms authorises the User or any third party to represent that the Developer speaks for BIT or the Platform, or to bind BIT or the Platform to any obligation.",
          zh: "**無權約束。** 本軟件或本條款的任何內容，均不授權用戶或任何第三方聲稱開發者代表 BIT 或平台發言，或以任何義務約束 BIT 或平台。",
        },
      ],
    },
    {
      id: "nature",
      heading: { en: "4. Nature of the Software and licence", zh: "軟件性質及特許" },
      summary: {
        en: "A neutral tool at your direction; personal, revocable licence only.",
        zh: "按用戶指示運作的中立工具；僅授予個人、可撤銷的特許。",
      },
      paragraphs: [
        {
          en: "**4.1 Technical intermediary only.** The Software acts solely as a neutral technical tool designed to facilitate, at the User's explicit direction, the retrieval, playback, local processing (including slide extraction and export), and optional synchronisation of Content and related materials from or to the Platform. It functions as a specialised client, browser-like interface, download or stream manager, and local processing aid — not as a content publisher or campus official channel.",
          zh: "**僅為技術中介。** 本軟件僅作為一項中立的技術工具，專為在用戶明確指示下，協助從平台或向平台獲取、播放、本機處理（包括幻燈片提取及匯出）及可選同步內容及相關資料而設計。其功能相當於專用客戶端、類瀏覽器介面、下載或串流管理器及本機處理輔助——而非內容發布者或校園官方渠道。",
        },
        {
          en: "**4.2 No content ownership or editorial control.** The Software does not create, select, curate, edit, host, or commercially distribute Platform Content as a service of the Developer. Materials retrieved through the Software originate from the Platform's systems (or, where the User uploads images into Platform notes, become part of the Platform's storage under the Platform's control). The Developer exercises no editorial control over Platform Content and assumes no responsibility for its nature, accuracy, legality, completeness, or quality.",
          zh: "**無內容所有權或編輯控制權。** 本軟件並非以開發者服務的形式創作、揀選、策劃、編輯、託管或商業分發平台內容。經本軟件獲取的資料源自平台系統（或，在用戶將圖像上傳至平台筆記的情況下，成為平台控制下的儲存的一部分）。開發者對平台內容不行使任何編輯控制權，亦不對其性質、準確性、合法性、完整性或質量承擔任何責任。",
        },
        {
          en: "**4.3 No endorsement of content.** The availability of the Software to retrieve or process specific Content does not constitute an endorsement, approval, or representation of any opinion by the Developer regarding such Content. Content reflects solely the views of its original authors, BIT, or other rights holders, and **does not represent the views, opinions, or positions of the Developer.**",
          zh: "**不構成對內容的認可。** 本軟件可用於獲取或處理特定內容，並不構成開發者對該等內容的認可、批准或對其發表任何意見。內容僅反映其原創作者、BIT 或其他權利持有人的觀點，**並不代表開發者的觀點、意見或立場。**",
        },
        {
          en: "**4.4 Licence grant.** Subject to these Terms, the Developer grants the User a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable licence to access and use the Software for the User's own lawful, non-commercial study or research purposes in connection with Content the User is otherwise entitled to access on the Platform.",
          zh: "**特許授予。** 在受本條款約束的前提下，開發者授予用戶有限、個人、非獨家、不可轉讓、不可再授權、可撤銷的特許，以供用戶就其有權在平台上存取的內容，為其自身合法、非商業的學習或研究目的而存取及使用本軟件。",
        },
        {
          en: "**4.5 Licence restrictions.** Except as expressly permitted by mandatory applicable law, the User shall not: (a) copy, modify, distribute, sell, lease, or create derivative works of the Software; (b) reverse-engineer, decompile, or attempt to extract source code from the Software except where such restriction is prohibited by law; (c) remove proprietary notices; (d) use the Software to provide a competing hosted service that merely resells access to the Platform; or (e) circumvent technical limitations or abuse endpoints operated by the Developer (including login, API proxy, video relay, or AI endpoints).",
          zh: "**特許限制。** 除強制性適用法律明確允許外，用戶不得：(a) 複製、修改、分發、出售、出租本軟件或創作其衍生作品；(b) 對本軟件進行逆向工程、反編譯或試圖提取源代碼（法律禁止此類限制者除外）；(c) 移除專有權聲明；(d) 使用本軟件提供僅轉售平台存取的競爭性託管服務；或 (e) 規避技術限制或濫用開發者營運的端點（包括登入、API 代理、影片中轉或 AI 端點）。",
        },
        {
          en: "**4.6 No service-level commitment.** The Software may be offered free of charge, may change features over time, and may be interrupted, rate-limited, or discontinued without liability. Availability of Platform Content depends entirely on the Platform and the User's account.",
          zh: "**無服務水平承諾。** 本軟件或免費提供，功能可隨時間變更，並可在不承擔責任的情況下中斷、限速或停止提供。平台內容的可用性完全取決於平台及用戶帳戶。",
        },
      ],
    },
    {
      id: "credentials",
      heading: {
        en: "5. Accounts, credentials, and Platform access",
        zh: "帳戶、憑證及平台存取",
      },
      summary: {
        en: "You use your own Platform credentials; the Developer is not the Platform operator.",
        zh: "用戶使用自身的平台憑證；開發者並非平台營運者。",
      },
      paragraphs: [
        {
          en: "**5.1 No AutoSlides account.** The Service does not create a separate user account database of its own. Sign-in is effected against the school's single sign-on system and/or with a Platform token the User supplies, as further described in the Privacy Policy.",
          zh: "**並無 AutoSlides 帳戶。** 本服務並不建立自設的用戶帳戶資料庫。登入乃透過學校統一身份認證系統及／或用戶提供的平台權杖完成，詳見《私隱政策》。",
        },
        {
          en: "**5.2 User control of credentials.** The User is solely responsible for safeguarding passwords, SMS codes, device keepsakes, Platform tokens, and any API keys or third-party tokens the User enters into the Software (for example GitHub Copilot or a custom AI key). The User must not share credentials in a manner that violates Platform or institutional rules.",
          zh: "**用戶對憑證的控制。** 用戶須自行全權負責保管密碼、短訊驗證碼、裝置憑證、平台權杖，以及用戶輸入本軟件的任何 API 金鑰或第三方權杖（例如 GitHub Copilot 或自訂 AI 金鑰）。用戶不得以違反平台或機構規則的方式分享憑證。",
        },
        {
          en: "**5.3 Acts under the User's credentials.** Any action the Software performs using the User's token or session — including listing courses, streaming, creating or editing Platform notes, and uploading images — is performed as the User vis-à-vis the Platform. The Developer does not assume the User's Platform obligations.",
          zh: "**以用戶憑證進行的行為。** 本軟件使用用戶權杖或工作階段所執行的任何操作——包括列出課程、串流、建立或編輯平台筆記，以及上傳圖像——對平台而言均屬用戶本人的行為。開發者並不承擔用戶對平台的義務。",
        },
        {
          en: "**5.4 Revocation and suspension.** The Platform or the school may revoke, suspend, or condition the User's access at any time. The Developer may refuse, suspend, or terminate access to the Software (including by blocking abuse of Developer-operated endpoints) where the User breaches these Terms or creates risk to the Service or others.",
          zh: "**撤銷及暫停。** 平台或學校可隨時撤銷、暫停或限制用戶的存取。在用戶違反本條款或對本服務或他人造成風險時，開發者可拒絕、暫停或終止對本軟件的存取（包括阻止對開發者營運端點的濫用）。",
        },
      ],
    },
    {
      id: "ip",
      heading: { en: "6. Intellectual property rights", zh: "知識產權" },
      summary: {
        en: "Content belongs to its rights holders; the Software belongs to the Developer.",
        zh: "內容屬其權利持有人所有；軟件屬開發者所有。",
      },
      paragraphs: [
        {
          en: "**6.1 Platform Content.** The User acknowledges and agrees that all right, title, and interest in and to the Content (including but not limited to copyrights, trademarks, and trade secrets) remain the exclusive intellectual property of their original authors, BIT, or respective rights holders. **The Developer claims no ownership, licence, or rights whatsoever to the Content** beyond the limited technical ability to retrieve or process it at the User's direction under the User's own Platform entitlements.",
          zh: "**平台內容。** 用戶確認並同意，內容的所有權利、所有權及權益（包括但不限於版權、商標及商業秘密）均仍屬其原創作者、BIT 或各自的權利持有人之獨有知識產權。**開發者對內容不主張任何所有權、特許權或權利**，惟按用戶指示、在用戶自身平台權限下進行獲取或處理的有限技術能力除外。",
        },
        {
          en: "**6.2 Software IP.** All right, title, and interest in and to the Software (including its code, design, branding, and documentation), excluding third-party components distributed under their own licences, remain with the Developer and its licensors. These Terms do not sell the Software to the User.",
          zh: "**軟件知識產權。** 本軟件（包括其代碼、設計、品牌及文檔）的所有權利、所有權及權益，除按各自特許分發的第三方組件外，均仍屬開發者及其特許人所有。本條款並非向用戶出售本軟件。",
        },
        {
          en: "**6.3 User responsibility for permissions.** The User's right to use the Software is strictly contingent upon the User having valid legal access to the Platform and any permissions required to retrieve, process, store, or upload Content. The User bears sole liability for verifying the copyright and licence status of any Content they process and for complying with Platform and institutional rules.",
          zh: "**用戶對權限的責任。** 用戶使用本軟件的權利，嚴格取決於用戶是否擁有存取平台的合法權限，以及獲取、處理、儲存或上傳內容所需的任何許可。用戶須自行全權負責核實其所處理的任何內容之版權及特許狀況，並遵守平台及機構規則。",
        },
        {
          en: "**6.4 Feedback.** If the User provides suggestions or feedback about the Software, the Developer may use them without obligation or compensation, unless a separate written agreement says otherwise.",
          zh: "**意見回饋。** 如用戶就本軟件提供建議或意見，除非另有書面協議，開發者可在無義務或報酬的情況下使用該等意見。",
        },
      ],
    },
    {
      id: "obligations",
      heading: {
        en: "7. User obligations and prohibited conduct",
        zh: "用戶義務及禁止行為",
      },
      summary: {
        en: "Personal study only — no redistribution, abuse, or unlawful use.",
        zh: "僅限個人學習——不得再分發、濫用或非法使用。",
      },
      paragraphs: [
        {
          en: "The User agrees not to use the Software for any purpose that is unlawful or prohibited by these Terms. The User is solely responsible for their conduct and for any Content they retrieve, process, store, upload, or share. Prohibited activities include, but are not limited to:",
          zh: "用戶同意不將本軟件用於任何非法或本條款禁止的用途。用戶須對其行為，以及所獲取、處理、儲存、上傳或分享的任何內容，自行承擔全部責任。禁止的活動包括但不限於：",
        },
        {
          en: "a. Reproducing, distributing, publicly performing, publicly displaying, modifying, or creating derivative works from any Content without explicit authorisation from the rightful owner, except to the extent mandatory law permits personal use;",
          zh: "a. 未經權利擁有人明確授權，複製、分發、公開表演、公開展示、修改任何內容或創作其衍生作品，惟強制性法律允許的個人使用除外；",
        },
        {
          en: "b. Using the Content or the Software for any commercial purpose, including sale, paid redistribution, or advertising;",
          zh: "b. 將內容或本軟件用於任何商業用途，包括出售、有償再分發或廣告；",
        },
        {
          en: "c. Reverse-engineering, decompiling, or attempting to discover the source code of the Software or the Platform, except where mandatory law prohibits such restriction;",
          zh: "c. 對本軟件或平台進行逆向工程、反編譯，或試圖發現其源代碼，惟強制性法律禁止此類限制者除外；",
        },
        {
          en: "d. Using the Software to infringe the intellectual property rights, privacy rights, or other legal rights of any third party, including BIT, content creators, or other rights holders;",
          zh: "d. 使用本軟件侵犯任何第三方（包括 BIT、內容創作者或其他權利持有人）的知識產權、私隱權或其他合法權利；",
        },
        {
          en: "e. Uploading to Platform notes, Cloud Notes, watch-mode sync, or any similar feature any private, sensitive, or confidential material that the User is not prepared to treat as public, including in light of the Public Storage Disclosure;",
          zh: "e. 向平台筆記、雲筆記、觀看模式同步或任何類似功能上傳用戶不願視為公開的任何私人、敏感或機密資料，包括顧及《公共儲存空間披露》所述情況；",
        },
        {
          en: "f. Abusing Developer-operated infrastructure (login proxy, API proxy, video relay, AI endpoints, or related services), including excessive automated requests, attempts to bypass rate limits or authentication, malware distribution, or interference with other users;",
          zh: "f. 濫用開發者營運的基礎設施（登入代理、API 代理、影片中轉、AI 端點或相關服務），包括過度自動化請求、試圖規避速率限制或認證、分發惡意軟件，或干擾其他用戶；",
        },
        {
          en: "g. Misrepresenting affiliation with BIT, the Platform, or the Developer; or using the Software to violate institutional IT, examination, or academic-integrity rules.",
          zh: "g. 虛報與 BIT、平台或開發者的關聯；或使用本軟件違反機構資訊科技、考試或學術誠信規則。",
        },
        {
          en: "Any breach of these obligations may result in the immediate suspension or termination of the User's right to use the Software and may expose the User to civil and/or criminal liability under applicable law and institutional rules.",
          zh: "任何違反上述義務的行為可能導致用戶使用本軟件的權利被立即暫停或終止，並可能使用戶在適用法律及機構規則下承擔民事及／或刑事責任。",
        },
      ],
    },
    {
      id: "third-parties",
      heading: {
        en: "8. Third-party services and Platform storage",
        zh: "第三方服務及平台儲存",
      },
      summary: {
        en: "Platform, school SSO, relays, AI providers, and public note-image storage are outside the Developer's control.",
        zh: "平台、學校登入、中轉、AI 服務及公開筆記圖像儲存均非開發者所能控制。",
      },
      paragraphs: [
        {
          en: "**8.1 Platform and school systems.** Course data, playback URLs, notes, and uploads are handled by the Platform and, for sign-in, by the school's single sign-on system. Their availability, accuracy, and policies are outside the Developer's control. The User's use of the Platform remains subject to the Platform's and the institution's own terms.",
          zh: "**平台及學校系統。** 課程資料、播放網址、筆記及上傳由平台處理；登入則由學校統一身份認證系統處理。其可用性、準確性及政策均非開發者所能控制。用戶對平台的使用仍受平台及機構自身條款約束。",
        },
        {
          en: "**8.2 Relays and infrastructure.** Recorded playback is proxied by the Service, or by another relay endpoint the User configures. Hosting and edge security for the web Service may be provided by infrastructure providers such as Cloudflare. Those parties process technical traffic as needed to deliver the feature; their own terms may apply to their networks.",
          zh: "**中轉及基礎設施。** 錄播播放由本服務代理，或由用戶設定的其他中轉端點代理。網頁服務的託管及邊緣安全或由 Cloudflare 等基礎設施供應商提供。該等各方按提供功能所需處理技術流量；其自身條款或適用於其網絡。",
        },
        {
          en: "**8.3 AI filtering.** When AI filtering is enabled, slide images may be sent to the AI provider the User has selected (built-in endpoint, GitHub Copilot via a proxy, or a custom OpenAI-compatible endpoint), solely for classification. The Developer does not warrant the accuracy of any classification. Custom endpoints and keys are chosen and controlled by the User; the Developer is not responsible for those providers.",
          zh: "**AI 篩選。** 當 AI 篩選已啟用時，幻燈片圖像或會傳送至用戶所選的 AI 服務（內建端點、經代理的 GitHub Copilot，或自訂 OpenAI 相容端點），僅供分類之用。開發者不保證任何分類的準確性。自訂端點及金鑰由用戶選擇及控制；開發者對該等服務供應商概不負責。",
        },
        {
          en: "**8.4 Cloud Notes and public object storage.** When the User enables Cloud Notes, watch-mode sync, or manual image insert into notes, images may be uploaded to the Platform's own object storage. That storage has been observed to allow anonymous listing and download of note images. **The User must read the Public Storage Disclosure before using those features** and must not place private or sensitive material in note images. The Developer does not operate the Platform's buckets and cannot make Platform-hosted objects private.",
          zh: "**雲筆記及公開物件儲存。** 當用戶啟用雲筆記、觀看模式同步，或於筆記中手動插入圖像時，圖像或會上傳至平台自身的物件儲存。經觀察，該儲存允許對筆記圖像進行匿名列出及下載。**用戶在使用該等功能前必須閱讀《公共儲存空間披露》**，且不得將私人或敏感資料放入筆記圖像。開發者並不營運平台的儲存桶，亦無法使平台託管的物件變為私密。",
        },
        {
          en: "**8.5 Third-party links and tools.** The Software may link to third-party sites or tools (for example release pages on GitHub, or the read-only public-storage browser published for transparency). Those resources are not part of the Software's core licence grant; their operators are solely responsible for them.",
          zh: "**第三方連結及工具。** 本軟件或會連結至第三方網站或工具（例如 GitHub 上的發佈頁，或為透明度而刊出的唯讀公開儲存瀏覽器）。該等資源並非本軟件核心特許的一部分；其營運者須自行對其負責。",
        },
      ],
    },
    {
      id: "warranties",
      heading: { en: "9. Disclaimer of warranties", zh: "保證免責聲明" },
      summary: {
        en: 'The Software is provided "as is", with no warranty of any kind.',
        zh: "本軟件按「原樣」提供，不附帶任何形式的保證。",
      },
      paragraphs: [
        {
          emphasis: true,
          en: 'TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SOFTWARE IS PROVIDED **"AS IS"** AND **"AS AVAILABLE"**, WITH ALL FAULTS AND WITHOUT WARRANTY OF ANY KIND. THE DEVELOPER EXPRESSLY DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.',
          zh: "**在適用法律允許的最大範圍內，本軟件按「原樣」及「按現有」基礎提供，並包含所有瑕疵，不附帶任何形式的保證。開發者明確免除所有明示、隱含、法定或其他保證，包括但不限於對適銷性、特定用途的適用性、所有權及不侵權的隱含保證。**",
        },
        {
          emphasis: true,
          en: "THE DEVELOPER DOES NOT WARRANT THAT THE SOFTWARE WILL MEET THE USER'S REQUIREMENTS, BE UNINTERRUPTED, SECURE, TIMELY, OR ERROR-FREE, NOR THAT DEFECTS WILL BE CORRECTED. THE DEVELOPER MAKES NO WARRANTY AS TO THE LEGALITY, ACCURACY, AVAILABILITY, OR SECURITY OF THE PLATFORM, SCHOOL SIGN-IN SYSTEMS, THIRD-PARTY RELAYS, AI PROVIDERS, OR ANY CONTENT. THE DEVELOPER DOES NOT WARRANT THAT PLATFORM NOTE IMAGES OR OTHER UPLOADS WILL REMAIN PRIVATE OR CONFIDENTIAL.",
          zh: "**開發者不保證本軟件將滿足用戶的要求、不會中斷、安全、適時或沒有錯誤，亦不保證缺陷將獲修正。開發者對平台、學校登入系統、第三方中轉、AI 服務或任何內容的合法性、準確性、可用性或安全性不作任何保證。開發者不保證平台筆記圖像或其他上傳內容將保持私密或機密。**",
        },
      ],
    },
    {
      id: "liability",
      heading: { en: "10. Limitation of liability", zh: "責任限制" },
      summary: {
        en: "The Developer is not liable for damages arising from use of the Software.",
        zh: "開發者對因使用本軟件而引起的損害概不負責。",
      },
      paragraphs: [
        {
          emphasis: true,
          en: "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE DEVELOPER BE LIABLE FOR ANY DIRECT, INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES, INCLUDING WITHOUT LIMITATION DAMAGES FOR LOSS OF DATA, LOSS OF PROFITS, BUSINESS INTERRUPTION, PERSONAL INJURY, PRIVACY BREACH, INTELLECTUAL PROPERTY DISPUTES, THIRD-PARTY CLAIMS, OR ANY OTHER DAMAGES OR LOSSES, ARISING OUT OF OR IN ANY WAY RELATED TO: (A) THE USE OR INABILITY TO USE THE SOFTWARE; (B) THE PLATFORM, ITS CONTENT, OR ITS STORAGE CONFIGURATION; (C) UNAUTHORISED ACCESS TO OR ALTERATION OF THE USER'S TRANSMISSIONS OR DATA; (D) AI CLASSIFICATIONS OR THIRD-PARTY SERVICES; OR (E) ANY OTHER MATTER RELATING TO THE SOFTWARE — HOWEVER CAUSED, REGARDLESS OF THE THEORY OF LIABILITY (CONTRACT, TORT INCLUDING NEGLIGENCE, STRICT LIABILITY, OR OTHERWISE), AND EVEN IF THE DEVELOPER HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.",
          zh: "**在適用法律允許的最大範圍內，在任何情況下，對於因以下各項引起或與之相關的任何直接、間接、懲罰性、附帶、特殊、懲戒性或後果性損害（包括但不限於數據丟失、利潤損失、業務中斷、人身傷害、私隱事故、知識產權爭議、第三方索賠或任何其他損害或損失），開發者概不負責：** (A) 使用或無法使用本軟件；(B) 平台、其內容或其儲存配置；(C) 未經授權存取或更改用戶的傳輸或資料；(D) AI 分類或第三方服務；或 (E) 與本軟件有關的任何其他事宜——無論因何引起，亦無論基於何種責任理論（合約、包括疏忽在內的侵權、嚴格責任或其他），即使開發者已被告知發生此類損害的可能性。",
        },
        {
          emphasis: true,
          en: "IF, NOTWITHSTANDING THE FOREGOING, THE DEVELOPER IS FOUND LIABLE TO THE USER FOR ANY CLAIM ARISING OUT OF OR RELATING TO THE SOFTWARE OR THESE TERMS, THE DEVELOPER'S TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE GREATER OF: (I) THE AMOUNT (IF ANY) THE USER PAID TO THE DEVELOPER SPECIFICALLY FOR THE SOFTWARE IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM; OR (II) USD 50 (FIFTY UNITED STATES DOLLARS). BECAUSE THE SOFTWARE IS TYPICALLY PROVIDED FREE OF CHARGE, THIS AMOUNT WILL OFTEN BE USD 50. SOME JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS; IN THOSE JURISDICTIONS THE DEVELOPER'S LIABILITY IS LIMITED TO THE MAXIMUM EXTENT PERMITTED BY LAW.",
          zh: "**即使有前述規定，如開發者仍被裁定須就因本軟件或本條款引起或與之相關的任何索賠對用戶承擔責任，開發者的全部累計責任不得超過以下較高者：** (I) 用戶在索賠前十二（12）個月內就本軟件向開發者支付的金額（如有）；或 (II) 五十（50）美元。由於本軟件通常免費提供，該金額往往為 50 美元。部分司法管轄區不允許某些限制；在該等司法管轄區，開發者的責任限於法律允許的最大範圍。",
        },
      ],
    },
    {
      id: "indemnification",
      heading: { en: "11. Indemnification", zh: "彌償" },
      summary: {
        en: "You cover the Developer against claims arising from your use of the Software.",
        zh: "用戶須就其使用本軟件所引起的索賠向開發者作出彌償。",
      },
      paragraphs: [
        {
          en: "The User agrees to indemnify, defend, and hold harmless the Developer and its affiliates, and their respective officers, agents, and contractors, from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or in any way connected with: (a) the User's access to or use of the Software; (b) the User's violation of these Terms; (c) the User's infringement or misappropriation of any third-party right, including any intellectual property, privacy, or publicity right; (d) Content the User retrieves, processes, uploads, or publishes, including note images and materials sent to AI providers; or (e) the User's violation of Platform, school, or institutional rules.",
          zh: "用戶同意彌償、抗辯並使開發者及其關聯方，以及其各自的負責人、代理人及承辦商，免受因以下原因引起或與之相關的任何及所有索賠、責任、損害、損失、成本及費用（包括合理的律師費）的損害：(a) 用戶存取或使用本軟件；(b) 用戶違反本條款；(c) 用戶侵犯或盜用任何第三方權利，包括任何知識產權、私隱權或肖像權；(d) 用戶獲取、處理、上傳或發布的內容，包括筆記圖像及送往 AI 服務的資料；或 (e) 用戶違反平台、學校或機構規則。",
        },
      ],
    },
    {
      id: "termination",
      heading: { en: "12. Termination", zh: "終止" },
      summary: {
        en: "You may stop anytime; the Developer may suspend or end access for breach or risk.",
        zh: "用戶可隨時停止；開發者可因違約或風險暫停或終止存取。",
      },
      paragraphs: [
        {
          en: "**12.1 By the User.** The User may stop using the Software at any time by discontinuing access, signing out, uninstalling the application, and/or clearing site data as described in the Privacy Policy.",
          zh: "**由用戶終止。** 用戶可隨時停止使用本軟件，方法包括停止存取、登出、卸載應用程式，及／或按《私隱政策》所述清除網站資料。",
        },
        {
          en: "**12.2 By the Developer.** The Developer may suspend or terminate the User's access to the Software, or discontinue the Software in whole or in part, at any time, with or without notice, including where the User breaches these Terms, where continued operation poses legal or security risk, or where the Developer ceases to offer the Service.",
          zh: "**由開發者終止。** 開發者可隨時暫停或終止用戶對本軟件的存取，或全部或部分停止提供本軟件，無論是否事先通知，包括在用戶違反本條款、繼續營運構成法律或保安風險，或開發者停止提供本服務的情況下。",
        },
        {
          en: "**12.3 Survival.** Upon termination, the licence under section 4 ends immediately. Sections that by their nature should survive (including intellectual property acknowledgements, disclaimers, limitations of liability, indemnification, and general provisions) shall survive termination.",
          zh: "**存續。** 終止後，第 4 節下的特許立即結束。依其性質應存續的章節（包括知識產權確認、免責聲明、責任限制、彌償及一般條款）於終止後仍然有效。",
        },
        {
          en: "**12.4 Platform data.** Termination of Software access does not by itself delete Content or notes stored on the Platform. The User must use Platform tools or contact the Platform to manage that material.",
          zh: "**平台資料。** 終止軟件存取本身並不會刪除儲存於平台上的內容或筆記。用戶須使用平台工具或聯絡平台以管理該等資料。",
        },
      ],
    },
    {
      id: "changes",
      heading: { en: "13. Changes to these Terms", zh: "條款變更" },
      summary: {
        en: "Material updates revise the date above; continued use means acceptance.",
        zh: "重大更新會修訂上方日期；繼續使用即表示接受。",
      },
      paragraphs: [
        {
          en: "**13.1 Updates.** The Developer may modify these Terms from time to time. When a material change is made, the date shown at the top of this page will be updated. The Developer may also provide additional notice in the Service where practicable.",
          zh: "**更新。** 開發者可不時修改本條款。作出重大變更時，本頁頂部所示的日期將會更新。在可行情況下，開發者亦可在本服務內提供額外通知。",
        },
        {
          en: "**13.2 Acceptance of changes.** Continued access to or use of the Software after the updated Terms become effective constitutes acceptance of the revised Terms. If the User does not agree, the User must stop using the Software.",
          zh: "**接受變更。** 在經更新的條款生效後繼續存取或使用本軟件，即構成接受經修訂的條款。如用戶不同意，則必須停止使用本軟件。",
        },
      ],
    },
    {
      id: "general",
      heading: { en: "14. General provisions", zh: "一般條款" },
      summary: {
        en: "Governing law, language, severability, entire agreement, and contact.",
        zh: "管轄法律、語言、可分割性、完整協議及聯絡。",
      },
      paragraphs: [
        {
          en: "**14.1 Governing law.** These Terms shall be governed by and construed in accordance with the laws of the Hong Kong Special Administrative Region, without regard to its conflict-of-law principles. Subject to mandatory consumer protections that cannot be waived, the courts of Hong Kong SAR shall have jurisdiction over disputes arising out of or relating to these Terms, without prejudice to the Developer's right to seek relief in any other jurisdiction.",
          zh: "**管轄法律。** 本條款應受香港特別行政區法律管轄並據其解釋，而不考慮其法律衝突原則。在不可放棄的強制性消費者保護規限下，香港特別行政區法院對因本條款引起或與之相關的爭議具有司法管轄權，惟不影響開發者在任何其他司法管轄區尋求濟助的權利。",
        },
        {
          en: "**14.2 Language.** In the event of any discrepancy or inconsistency between the English and Chinese versions of these Terms, the English version shall prevail.",
          zh: "**語言。** 本條款及細則的中英版本如有任何歧義或不一致，概以英文版本為準。",
        },
        {
          en: "**14.3 Severability.** If any provision of these Terms is held to be unenforceable or invalid, such provision will be modified and interpreted to accomplish its objectives to the greatest extent possible under applicable law, and the remaining provisions will continue in full force and effect.",
          zh: "**可分割性。** 如本條款的任何規定被裁定為不可執行或無效，則該規定將在適用法律允許的最大範圍內予以修改及解釋，以實現其目標，而其餘規定將繼續完全有效。",
        },
        {
          en: "**14.4 Entire agreement.** These Terms, together with the Privacy Policy, the Copyright & Intellectual Property Notice, and the Public Storage Disclosure (and any other legal notices the Developer expressly designates as part of the agreement), constitute the entire agreement between the User and the Developer regarding the use of the Software and supersede all prior or contemporaneous agreements and understandings on that subject. No purchase order or other User document modifies these Terms unless the Developer agrees in a signed writing.",
          zh: "**完整協議。** 本條款連同《私隱政策》、《版權及知識產權聲明》及《公共儲存空間披露》（以及開發者明確指定為協議一部分的任何其他法律通知），構成用戶與開發者之間關於使用本軟件的完整協議，並取代關於該事宜的所有先前或同時的協議及諒解。除非開發者以簽署書面文件同意，否則任何採購單或其他用戶文件均不得修改本條款。",
        },
        {
          en: "**14.5 No waiver.** Failure by the Developer to enforce any provision of these Terms is not a waiver of that provision or of the right to enforce it later. Any waiver must be in writing to be effective.",
          zh: "**不棄權。** 開發者未執行本條款任何規定，並不構成對該規定或日後執行權利的放棄。任何棄權須以書面作出方為有效。",
        },
        {
          en: "**14.6 Assignment.** The User may not assign or transfer these Terms or any rights hereunder without the Developer's prior written consent. The Developer may assign these Terms in connection with a reorganisation, or a transfer of the Software or related assets, without notice.",
          zh: "**轉讓。** 未經開發者事先書面同意，用戶不得轉讓本條款或其下任何權利。開發者可在重組或轉讓本軟件或相關資產時轉讓本條款，而無需通知。",
        },
        {
          en: "**14.7 Force majeure.** The Developer is not liable for any failure or delay caused by circumstances beyond its reasonable control, including network or Platform outages, failures of third-party providers, acts of government, natural disasters, or war.",
          zh: "**不可抗力。** 對於因其合理控制以外的情況（包括網絡或平台中斷、第三方供應商故障、政府行為、自然災害或戰爭）所導致的任何不履行或延誤，開發者概不負責。",
        },
        {
          en: "**14.8 Contact.** For technical or legal inquiries regarding these Terms or the Software, please contact info@ruc.edu.kg.",
          zh: "**聯絡。** 如對本條款或本軟件有技術或法律查詢，請聯絡 info@ruc.edu.kg。",
        },
      ],
    },
  ],
};
