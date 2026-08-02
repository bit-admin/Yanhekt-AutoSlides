import type { LegalDoc } from "./types";

// End-user disclosure of Yanhekt Platform public object storage as it affects
// Cloud Notes image uploads. Drawn from read-only research on coss.yanhekt.cn
// (see REFERENCE/report.md); not an exploit writeup. The interactive browser
// for the same store is at https://coss.ruc.edu.kg.
//
// Aligns with privacy.ts Cloud Notes paragraph (Platform MinIO hosts note
// images). If that upload path changes, update both documents.

export const disclosureDoc: LegalDoc = {
  id: "disclosure",
  title: { en: "Public Storage Disclosure", zh: "公共儲存空間披露" },
  updated: "2026-08-03",
  intro: [
    {
      en: 'This Public Storage Disclosure ("Disclosure") is published by the Developer of AutoSlides in connection with the AutoSlides software and web service (together, the "Software" or "Service"). It describes a material property of the object-storage configuration of the Yanhe Classroom platform of the Beijing Institute of Technology ("Platform" / "Yanhekt") that affects images and other media attached to notes on the Platform — including images uploaded or synced through AutoSlides Cloud Notes and watch-mode sync.',
      zh: "本《公共儲存空間披露》（下稱「本披露」）由 AutoSlides 開發者就 AutoSlides 軟件及網頁服務（合稱「軟件」或「本服務」）刊出。本披露說明北京理工大學延河課堂平台（下稱「平台」／「延河課堂」）物件儲存配置的一項重要特性，該特性影響附加於平台筆記的圖像及其他媒體——包括經 AutoSlides 雲筆記及觀看模式同步所上傳或同步的圖像。",
    },
    {
      en: "This Disclosure is provided so that Users may make an informed decision about what material is appropriate to place in a Platform note. It forms part of, and should be read together with, the Terms and Conditions and the Privacy Policy. In the event of any conflict between this Disclosure and those documents on a matter of contract or privacy handling by the Service, the Terms and the Privacy Policy prevail as to the Service; this Disclosure is intended to describe observed Platform storage behaviour that the Developer does not control.",
      zh: "刊出本披露，旨在讓用戶就何種資料適宜放進平台筆記作出知情決定。本披露構成《條款及細則》及《私隱政策》的一部分，並應與其一併閱讀。就本服務的合約或私隱處理事宜，如本披露與該等文件有任何衝突，概以《條款及細則》及《私隱政策》為準；本披露旨在描述開發者無法控制的、經觀察所得的平台儲存行為。",
    },
    {
      en: "**In short:** note images hosted on the Platform are stored in public object storage that can be **listed and downloaded without signing in**. Treat every note image as world-readable. AutoSlides only communicates with the Platform's note APIs; it does not host those image files on AutoSlides servers, and it cannot change the Platform's bucket policies.",
      zh: "**簡而言之：** 託管於平台的筆記圖像存放於可在**未登入情況下列出及下載**的公開物件儲存空間。請將每一張筆記圖像視為可被任何人讀取。AutoSlides 僅與平台的筆記 API 通訊；不會在 AutoSlides 伺服器上託管該等圖像檔案，亦無法更改平台的儲存桶政策。",
    },
  ],
  sections: [
    {
      id: "purpose-scope",
      heading: {
        en: "1. Purpose and scope",
        zh: "目的及範圍",
      },
      summary: {
        en: "Informs Users about Platform storage exposure that affects note images.",
        zh: "向用戶說明影響筆記圖像的平台儲存暴露情況。",
      },
      paragraphs: [
        {
          en: "**1.1 Purpose.** The purpose of this Disclosure is informational and cautionary. It identifies a configuration of the Platform's public object store that bears on the confidentiality Users may reasonably expect for media attached to notes. It is not legal advice, not a warranty regarding the Platform, and not an invitation to access Platform storage other than through ordinary, authorised use of the Platform or the Software.",
          zh: "**目的。** 本披露旨在提供資訊及警示。其指出平台公開物件儲存的一項配置，該配置影響用戶就附加於筆記的媒體可合理預期的保密程度。本披露並非法律意見，並非就平台作出的保證，亦非邀請用戶以有別於透過平台或軟件的一般授權使用以外的方式存取平台儲存。",
        },
        {
          en: '**1.2 Scope.** This Disclosure concerns object storage operated by or for the Platform at the host **coss.yanhekt.cn** (an S3-compatible MinIO deployment behind a reverse proxy), in so far as that storage receives user-uploaded note images and related media. It does not redefine the Software\'s own data handling, which is set out in the Privacy Policy, nor does it alter the User\'s obligations under the Terms.',
          zh: "**範圍。** 本披露涉及由平台營運或代其營運、位於主機 **coss.yanhekt.cn**（反向代理後的 S3 相容 MinIO 部署）的物件儲存，惟僅限於該儲存接收用戶上傳的筆記圖像及相關媒體的範圍。本披露並不重新界定軟件自身的資料處理方式（詳見《私隱政策》），亦不更改用戶在《條款及細則》下的義務。",
        },
        {
          en: "**1.3 No control of the Platform.** The Software is an independent third-party tool. The Developer does not operate the Platform, does not administer **coss.yanhekt.cn**, and does not set or enforce the Platform's storage, listing, CORS, or access-control policies. Whether a note image remains publicly listable or downloadable is determined solely by the Platform's configuration and may change without notice to the Developer.",
          zh: "**不控制平台。** 本軟件為獨立的第三方工具。開發者並不營運平台，並不管理 **coss.yanhekt.cn**，亦不設定或執行平台的儲存、列出、CORS 或存取控制政策。筆記圖像是否繼續可被公開列出或下載，完全取決於平台的配置，並可能在未通知開發者的情況下變更。",
        },
      ],
    },
    {
      id: "public-exposure",
      heading: {
        en: "2. Observed public accessibility of Platform object storage",
        zh: "經觀察所得的平台物件儲存公開存取情況",
      },
      summary: {
        en: "The Platform's media buckets can be listed and read anonymously.",
        zh: "平台的媒體儲存桶可被匿名列出及讀取。",
      },
      paragraphs: [
        {
          en: '**2.1 Object store.** The Platform serves user-uploaded media from an S3-compatible object store at **coss.yanhekt.cn**. Among its buckets is **images**, which holds note-feature uploads — including files created when a User inserts a picture into a note on the Platform, and files created when AutoSlides appends a captured slide to a Cloud Note or watch-mode note.',
          zh: "**物件儲存。** 平台透過 **coss.yanhekt.cn** 上的 S3 相容物件儲存提供用戶上傳的媒體。其中 **images** 儲存桶存放筆記功能相關上傳——包括用戶在平台筆記中插入圖片時所產生的檔案，以及 AutoSlides 將擷取的幻燈片追加至雲筆記或觀看模式筆記時所產生的檔案。",
        },
        {
          en: "**2.2 Anonymous list and read.** That **images** bucket accepts anonymous list and read requests. Any person on the public internet may, without a Platform account, without the User's credentials, and without a signed or expiring URL: (a) enumerate object keys, sizes, and last-modified timestamps via standard S3 listing (`ListObjects` / `ListObjectsV2`); and (b) download the corresponding object bytes via ordinary HTTP `GET` / `HEAD` requests. The same class of anonymous access has been observed on several sibling media buckets on the same host (including, among others, stores used for videos, audio, lecture transcripts and OCR text, and AI-assistant uploads). The existence of those sibling buckets is noted only to show that the exposure is not confined to a single path; this Disclosure is addressed to Users primarily because of **images** note uploads.",
          zh: "**匿名列出及讀取。** 該 **images** 儲存桶接受匿名的列出及讀取請求。任何人均可在無需平台帳戶、無需用戶憑證、亦無需簽署或限時 URL 的情況下：(a) 透過標準 S3 列出介面（`ListObjects`／`ListObjectsV2`）枚舉物件鍵名、大小及最後修改時間；以及 (b) 透過一般 HTTP `GET`／`HEAD` 請求下載相應物件內容。同一主機上若干同類媒體儲存桶（包括但不限於用於影片、音訊、課堂逐字稿與 OCR 文本，以及 AI 助教上傳的儲存）亦曾觀察到同類匿名存取。提及該等相關儲存桶，僅為說明暴露並非限於單一路徑；本披露主要因 **images** 筆記上傳而面向用戶。",
        },
        {
          en: '**2.3 Naming does not provide confidentiality.** Object keys under **images** commonly follow date-partitioned prefixes (for example `YYYY/M/…`) or content-addressed hash paths. Once a bucket is anonymously **listable**, such names do not afford meaningful privacy: the listing itself discloses every key, and the object may then be retrieved by anyone who obtains that key from the listing. "Unguessable" or hash-based URLs are not a substitute for access control when listing is public.',
          zh: "**命名並不提供保密性。** **images** 下的物件鍵名通常採用日期分區前綴（例如 `YYYY/M/…`）或以內容為基礎的雜湊路徑。一旦儲存桶可被匿名**列出**，該等命名並不能提供實質私隱保護：列出本身即披露每一個鍵名，而任何人從列表取得該鍵名後即可擷取物件。「難以猜測」或以雜湊為基礎的 URL，在列出為公開的情況下，並不能取代存取控制。",
        },
        {
          en: "**2.4 Cross-origin readability.** Listing and object responses from the store have been observed to reflect arbitrary request `Origin` values with permissive CORS headers. Practical consequence for Users: third-party websites can programmatically list and fetch public objects from a visitor's browser without using AutoSlides. That fact reinforces, rather than creates, the public character of the storage described above.",
          zh: "**跨來源可讀性。** 經觀察，該儲存的列出及物件回應會以寬鬆的 CORS 標頭反映任意請求 `Origin`。對用戶的實際影響是：第三方網站可在訪客的瀏覽器中以程式方式列出及擷取公開物件，而無需使用 AutoSlides。此點強化——而非創設——上文所述儲存的公開性質。",
        },
        {
          en: "**2.5 Illustrative demonstration.** An interactive, **read-only** browser for the same public store is published at [coss.ruc.edu.kg](https://coss.ruc.edu.kg). It demonstrates anonymous listing and preview from an ordinary web browser and does not require AutoSlides credentials. It is offered as a transparency aid for this Disclosure; it is not part of the Software's note-upload path, and it does not grant any right to bulk-download, republish, or misuse Platform content.",
          zh: "**示範說明。** 同一公開儲存空間的**唯讀**互動瀏覽器刊於 [coss.ruc.edu.kg](https://coss.ruc.edu.kg)。該工具可在一般網頁瀏覽器中示範匿名列出及預覽，無需 AutoSlides 憑證。其作為本披露的透明度輔助而提供；並非軟件筆記上傳路徑的一部分，亦不授予批量下載、再發布或濫用平台內容的任何權利。",
        },
        {
          en: "**2.6 Scale (illustrative, point-in-time).** At the time of the underlying research, the **images** bucket alone contained on the order of thousands of objects and well over a gigabyte of data spanning multi-year uploads; across the publicly listable buckets on the host, object counts and total size were substantially larger. Exact counts change continuously as the Platform and its users write new objects. The figures are given only to convey that the exposure is systemic and long-lived, not hypothetical or limited to a handful of test files.",
          zh: "**規模（說明性、時點性）。** 在相關研究進行時，僅 **images** 儲存桶已載有數以千計的物件及遠超一吉字節、橫跨多年的上傳資料；在該主機上可公開列出的各儲存桶合計，物件數量及總容量則顯著更大。確切數字會隨平台及其用戶持續寫入新物件而變動。提供該等數字僅為說明暴露屬系統性且長期存在，而非假設性或僅限於少數測試檔案。",
        },
      ],
    },
    {
      id: "implications",
      heading: {
        en: "3. Implications for confidentiality of note images",
        zh: "對筆記圖像保密性的影響",
      },
      summary: {
        en: "Note images should be treated as world-readable, not merely link-shared.",
        zh: "筆記圖像應視為可被任何人讀取，而非僅限於持有連結者。",
      },
      paragraphs: [
        {
          en: "**3.1 No reasonable expectation of secrecy for note images.** Because the Platform's note-image storage is anonymously listable and readable, a User should not assume that an image attached to a Platform note is confidential, private to the note's audience, or discoverable only by persons who already possess a direct link. Discovery may occur through bulk listing of the public bucket, not only through sharing of a URL.",
          zh: "**對筆記圖像不應有合理的保密預期。** 由於平台的筆記圖像儲存可被匿名列出及讀取，用戶不應假定附加於平台筆記的圖像屬機密、僅限筆記對象可知，或僅能由已持有直接連結的人發現。發現可透過對公開儲存桶的批量列出而發生，而不僅限於 URL 分享。",
        },
        {
          en: "**3.2 Applies regardless of how the image was added.** The same storage path is used whether the image is inserted manually in a notes editor on the Platform, uploaded through AutoSlides Cloud Notes, appended by watch-mode sync after post-processing, or imported by another AutoSlides feature that writes into a Platform note. The Software's feature name does not change the Platform's hosting of the resulting object.",
          zh: "**不論圖像如何加入均適用。** 無論圖像是在平台筆記編輯器中手動插入、經 AutoSlides 雲筆記上傳、經觀看模式同步在後處理後追加，或由 AutoSlides 其他寫入平台筆記的功能匯入，均使用同一儲存路徑。軟件的功能名稱並不改變平台對所產生物件的託管方式。",
        },
        {
          en: "**3.3 Platform policies govern.** Once uploaded, the object lives under the Platform's object store and under the Platform's terms, policies, and technical configuration. The Developer cannot promise that the Platform will restrict listing, rotate keys, expire objects, or notify Users of further exposure.",
          zh: "**受平台政策管轄。** 上傳後，物件存放於平台的物件儲存空間，並受平台的條款、政策及技術配置約束。開發者不能保證平台會限制列出、輪替鍵名、使物件過期，或就進一步暴露通知用戶。",
        },
      ],
    },
    {
      id: "autoslides-role",
      heading: {
        en: "4. Role of AutoSlides and the Developer",
        zh: "AutoSlides 及開發者之角色",
      },
      summary: {
        en: "AutoSlides proxies note APIs, does not host images, and uses reasonable efforts to warn Users.",
        zh: "AutoSlides 代理筆記 API、不託管圖像，並以合理努力向用戶作出警示。",
      },
      paragraphs: [
        {
          en: "**4.1 Client and proxy only.** AutoSlides is a client application and, for the web service, a thin API proxy to the Platform. When a User uploads or syncs a note image through the Software, the bytes are transmitted to the Platform's own note and storage APIs (via the Service where a browser cannot call those APIs directly). The resulting object is created and stored by the Platform.",
          zh: "**僅為客戶端及代理。** AutoSlides 是客戶端應用程式；網頁服務則另提供通往平台的精簡 API 代理。用戶經軟件上傳或同步筆記圖像時，檔案位元組會傳送至平台自身的筆記及儲存 API（在瀏覽器無法直接呼叫該等 API 時，則經由本服務轉送）。所產生的物件由平台建立及儲存。",
        },
        {
          en: "**4.2 No AutoSlides hosting of note-image bytes.** The Service does not retain a server-side copy of those note images for the Developer's own storage, does not operate the MinIO buckets described in this Disclosure, and does not offer a setting that can make Platform-hosted note images private. Whether a note image is publicly listable or downloadable is determined by the Platform's configuration, not by a preference inside AutoSlides.",
          zh: "**AutoSlides 不託管筆記圖像位元組。** 本服務不會為開發者自身儲存而在伺服器端保留該等筆記圖像的副本，並不營運本披露所述的 MinIO 儲存桶，亦不提供任何可令平台託管的筆記圖像變為私密的設定。筆記圖像是否可被公開列出或下載，取決於平台的配置，而非 AutoSlides 內的偏好選項。",
        },
        {
          en: "**4.3 Reasonable efforts to inform Users.** Because the Developer cannot alter the Platform's object-store policies, the Developer has taken, and continues to take, **reasonable efforts** to bring the public character of Platform note-image storage to the attention of Users before and while they use features that may upload images. Those efforts include, without limitation: (a) publishing this Disclosure as a standing legal document of the Service; (b) describing the same risk in the Privacy Policy in connection with Cloud Notes and watch-mode sync; (c) linking to this Disclosure from the Service's sign-in page, first-run notice, and navigation or footer legal links; (d) presenting a contextual in-product notice on the Notes / Cloud Notes surfaces that use Platform image upload, with a link to this Disclosure (which the User may dismiss for interface convenience, without withdrawing the permanent availability of this page); and (e) where the desktop application offers the same Cloud Notes features, providing a corresponding notice that links to this Disclosure. The form, placement, and wording of such notices may evolve; their purpose is to enable an informed choice, not to guarantee that every User has read every notice on every visit.",
          zh: "**向用戶作出告知的合理努力。** 由於開發者無法更改平台的物件儲存政策，開發者已採取並持續採取**合理努力**，在用戶使用可能上傳圖像的功能之前及期間，提請用戶注意平台筆記圖像儲存的公開性質。該等努力包括但不限於：(a) 將本披露作為本服務的常設法律文件刊出；(b) 在《私隱政策》中就雲筆記及觀看模式同步描述同一風險；(c) 於本服務的登入頁、首次使用提示，以及導航或頁腳法律連結中連至本披露；(d) 在使用平台圖像上傳的筆記／雲筆記介面提供情境提示，並連至本披露（用戶可為介面便利而關閉該提示，惟不影響本頁的長期可供查閱）；以及 (e) 在桌面應用程式提供相同雲筆記功能時，提供相應提示並連至本披露。該等提示的形式、位置及措辭或會演變；其目的在於促成知情選擇，而非保證每位用戶在每次到訪時均已閱讀每一則提示。",
        },
        {
          en: "**4.4 Effect of notices; User remains responsible.** The notices described in section 4.3 are provided in good faith as a transparency measure. They do not convert the Developer into the operator of the Platform's storage, do not create any duty to monitor what the User uploads, and do not restore confidentiality to objects once they reside in a publicly listable Platform bucket. A User who proceeds to attach, sync, or import images to a Platform note after those notices have been made available is deemed to do so with knowledge of the risk described in this Disclosure. Dismissing a banner, skipping a first-run screen, or failing to open this page does not shift responsibility for the contents of note images onto the Developer.",
          zh: "**提示的效力；用戶仍須負責。** 第 4.3 節所述提示乃本著善意作為透明度措施而提供。該等提示並不使開發者成為平台儲存的營運者，亦不產生監察用戶上傳內容的義務，更不能使已存放於可公開列出的平台儲存桶中的物件恢復保密性。在該等提示已可供閱覽的情況下，用戶仍將圖像附加、同步或匯入平台筆記，即視為知悉本披露所述風險而為之。關閉橫幅、略過首次使用畫面，或未開啟本頁，均不會把筆記圖像內容的責任轉移至開發者。",
        },
        {
          emphasis: true,
          en: "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, AND WITHOUT LIMITING THE TERMS (INCLUDING THE DISCLAIMER OF WARRANTIES AND LIMITATION OF LIABILITY) OR SECTIONS 4.3 AND 4.4 OF THIS DISCLOSURE, **THE DEVELOPER ASSUMES NO RESPONSIBILITY OR LIABILITY** FOR: (A) THE PLATFORM'S DECISION TO PERMIT ANONYMOUS LISTING OR READING OF USER-UPLOADED MEDIA; (B) ANY THIRD-PARTY ACCESS TO, COPYING OF, OR FURTHER DISTRIBUTION OF SUCH MEDIA ONCE SO EXPOSED; OR (C) ANY LOSS, DAMAGE, CLAIM, OR EXPENSE ARISING FROM A USER PLACING SENSITIVE, PRIVATE, OR CONFIDENTIAL MATERIAL IN A NOTE IMAGE. **REASONABLE EFFORTS TO INFORM USERS ARE NOT A WARRANTY** THAT THE PLATFORM IS SAFE FOR PRIVATE MATERIAL, AND ARE **NOT AN UNDERTAKING** THAT THE DEVELOPER CAN OR WILL CAUSE THE PLATFORM TO CHANGE ITS STORAGE CONFIGURATION.",
          zh: "**在適用法律允許的最大範圍內，在不限制《條款及細則》（包括保證免責及責任限制）以及本披露第 4.3 及 4.4 節的前提下，開發者對以下各項概不承擔任何責任：** (A) 平台允許匿名列出或讀取用戶上傳媒體的決定；(B) 該等媒體一旦如此暴露後遭第三方存取、複製或進一步分發；或 (C) 因用戶將敏感、私人或機密資料放入筆記圖像而產生的任何損失、損害、索賠或開支。**向用戶作出告知的合理努力，並非保證平台適宜存放私人資料，亦非承諾開發者能夠或將會促使平台更改其儲存配置。**",
        },
      ],
    },
    {
      id: "user-guidelines",
      heading: {
        en: "5. User responsibilities regarding note images",
        zh: "用戶就筆記圖像的責任",
      },
      summary: {
        en: "Assume every note image is world-readable; do not upload sensitive material.",
        zh: "請假定每一張筆記圖像均可被任何人讀取；請勿上傳敏感資料。",
      },
      paragraphs: [
        {
          en: "**Warning.** Because the Platform's note-image storage is anonymously listable and readable, the User should assume that any image attached to a Platform note — whether uploaded by hand in a notes editor, synced from watch mode, or imported by another AutoSlides feature — can be discovered, viewed, downloaded, and further redistributed by strangers on the internet.",
          zh: "**警告。** 由於平台的筆記圖像儲存可被匿名列出及讀取，用戶應假定附加於平台筆記的任何圖像——無論是在筆記編輯器中手動上傳、經觀看模式同步，或由 AutoSlides 其他功能匯入——均可能被互聯網上的陌生人發現、查看、下載及進一步再分發。",
          emphasis: true,
        },
        {
          en: "**5.1 Prohibited and inadvisable content.** The User must not include in note images any material that the User is not prepared to treat as public. Without limitation, that includes: identity documents and other government-issued credentials; passwords, tokens, QR codes used for authentication, or similar secrets; confidential coursework, examination materials, or institutional files the User is not authorised to redistribute; medical, financial, or other sensitive personal records; and personal photographs or recordings that the User would not publish on a public website.",
          zh: "**禁止及不宜的內容。** 用戶不得在筆記圖像中包含其不願視為公開的任何資料。在不限制前述原則的情況下，這包括：身份證明文件及其他政府簽發的證件；密碼、權杖、用於認證的二維碼或類似秘密；用戶無權再分發的機密課業、試卷或機構檔案；醫療、財務或其他敏感個人紀錄；以及用戶不會公開張貼於網站上的個人照片或錄音錄影。",
        },
        {
          en: "**5.2 Compliance with Platform and law.** Nothing in this Disclosure authorises the User to upload Content in breach of the Platform's own terms, institutional rules, or applicable law, or to scrape, bulk-download, or republish Platform storage. The User remains solely responsible for verifying that they have the right to process and store any Content they place in a note.",
          zh: "**遵守平台及法律。** 本披露的任何內容均不授權用戶以上傳違反平台自身條款、機構規定或適用法律的內容，或以抓取、批量下載或再發布平台儲存。用戶仍須自行全權負責核實其有權處理及儲存其放入筆記的任何內容。",
        },
        {
          en: "**5.3 Remediation on the User side.** If the User has already uploaded sensitive images to a Platform note, the User should remove or replace them using the Platform's own note tools where available, treat any previously issued URLs as compromised, and contact the Platform if institutional data-protection procedures so require. Clearing AutoSlides browser data does not by itself delete objects already stored on the Platform.",
          zh: "**用戶端補救。** 如用戶已將敏感圖像上傳至平台筆記，應在可行情況下使用平台自身的筆記工具予以移除或替換，將任何先前發出的 URL 視為已洩露，並在機構資料保護程序有此要求時聯絡平台。清除 AutoSlides 瀏覽器資料本身並不會刪除已儲存於平台的物件。",
        },
      ],
    },
    {
      id: "research-remediation",
      heading: {
        en: "6. Research basis, limitations, and operator note",
        zh: "研究依據、限制及營運者備註",
      },
      summary: {
        en: "Findings came from anonymous read-only requests; operators should lock down listing.",
        zh: "發現來自匿名唯讀請求；營運者應限制公開列出。",
      },
      paragraphs: [
        {
          en: "**6.1 Method.** The behaviour described in this Disclosure was observed through anonymous, **read-only** HTTP and S3 listing requests (`GET`, `HEAD`, `ListObjects` / `ListObjectsV2`) against endpoints reachable without authentication. Nothing was written, modified, or deleted on the Platform's store in the course of that research; no Platform accounts or tokens were used for the listing and characterisation work; and object bodies were not bulk-downloaded for the purpose of this Disclosure. Sample reads, where performed, were limited to what was necessary to characterise response behaviour (for example content type, range support, or error shape).",
          zh: "**方法。** 本披露所述行為，乃透過對無需認證即可到達的端點發出匿名、**唯讀** 的 HTTP 及 S3 列出請求（`GET`、`HEAD`、`ListObjects`／`ListObjectsV2`）而觀察所得。該研究過程中並無在平台儲存上寫入、修改或刪除任何內容；列出及行為特徵分析並未使用平台帳戶或權杖；亦未為本披露之目的而大量下載物件內容。如有進行樣本讀取，僅限於描述回應行為所需的範圍（例如內容類型、範圍請求支援或錯誤形態）。",
        },
        {
          en: "**6.2 Limitations.** Observations are point-in-time and may become incomplete if the Platform changes network controls, bucket policies, edge rules, or CORS configuration. Absence of a described behaviour from a later test does not mean the underlying objects were never exposed, nor that copies obtained by third parties while exposure lasted have been purged. This Disclosure does not catalogue every bucket, path, or edge-case bypass that may exist on the host; it states what is material for Users of note-image features.",
          zh: "**限制。** 觀察結果屬時點性；如平台更改網絡控制、儲存桶政策、邊緣規則或 CORS 配置，本披露可能變得不完整。其後測試中未再現所述行為，並不表示相關物件從未暴露，亦不表示在暴露期間被第三方取得的副本已被清除。本披露並非羅列該主機上每一個儲存桶、路徑或邊緣特例繞過方式；其僅陳述對筆記圖像功能用戶屬重要的事實。",
        },
        {
          en: "**6.3 For Platform operators.** Anonymous `s3:ListBucket` (and open object read) on buckets that hold user content should be removed. Objects that are intended to be private should require authentication or short-lived signed URLs; protection should apply consistently to the data class (user-uploaded images, voice, documents, transcripts), not only to selected path prefixes. Restricting CORS to application origins, avoiding reliance on unguessable keys as the sole control, sanitising accidental uploads (for example `.DS_Store` and backup artefacts), and reviewing publicly exposed health or metadata endpoints are further hardening steps. **AutoSlides cannot apply those fixes on the Platform's behalf.**",
          zh: "**致平台營運者。** 承載用戶內容的儲存桶上的匿名 `s3:ListBucket`（以及開放的物件讀取）應予移除。擬作為私密的物件應要求認證或短效簽署 URL；保護措施應一致適用於整類資料（用戶上傳的圖像、語音、文件、逐字稿），而非僅限於個別路徑前綴。將 CORS 限制於應用程式來源、避免僅依賴難以猜測的鍵名作為唯一控制、清理誤上傳檔案（例如 `.DS_Store` 及備份產物），以及檢視公開暴露的健康檢查或中繼資料端點，亦屬進一步加固步驟。**AutoSlides 無法代平台套用該等修復。**",
        },
      ],
    },
    {
      id: "changes-contact",
      heading: {
        en: "7. Changes, language, and contact",
        zh: "變更、語言及聯絡",
      },
      summary: {
        en: "Material updates change the date above; English prevails; contact the Developer with questions.",
        zh: "重大更新會更改上方日期；以英文為準；查詢請聯絡開發者。",
      },
      paragraphs: [
        {
          en: "**7.1 Changes.** If this Disclosure is updated materially — including because the Platform's observed storage behaviour changes, or because the Software's note-upload path changes — the date shown at the top of this page will be revised. Continuing to use Cloud Notes, watch-mode sync, or other features that upload images to the Platform after such a revision indicates that the User has read the updated Disclosure.",
          zh: "**變更。** 如本披露有重大更新——包括因平台經觀察的儲存行為變更，或因軟件的筆記上傳路徑變更——本頁頂部所示的日期將會修訂。在該等修訂後繼續使用雲筆記、觀看模式同步或其他會向平台上傳圖像的功能，即表示用戶已閱讀經更新的披露。",
        },
        {
          en: "**7.2 Language.** In the event of any discrepancy between the English and Chinese versions of this Disclosure, the English version shall prevail.",
          zh: "**語言。** 本披露的中英版本如有任何歧義，概以英文版本為準。",
        },
        {
          en: "**7.3 Contact.** For questions about this Disclosure as it relates to AutoSlides, please contact info@ruc.edu.kg. Questions about the Platform's storage configuration, takedown of Platform-hosted objects, or institutional data-protection processes should be directed to the Platform or the relevant institution; the Developer cannot delete or lock Platform buckets.",
          zh: "**聯絡。** 如對本披露與 AutoSlides 相關的事宜有任何疑問，請聯絡 info@ruc.edu.kg。有關平台儲存配置、平台託管物件的下架，或機構資料保護程序的查詢，應向平台或相關機構提出；開發者無法刪除或鎖定平台儲存桶。",
        },
      ],
    },
  ],
};
