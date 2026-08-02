import type { LegalDoc } from "./types";

// Copyright & Intellectual Property Notice — ownership of Software vs Platform
// Content, user duties, export/reminder efforts, and rights-holder contact.
// Complements Terms §6 (IP) without replacing the contract. Cross-reads with
// disclosure.ts for note images on public Platform storage.

export const copyrightDoc: LegalDoc = {
  id: "copyright",
  title: {
    en: "Copyright & Intellectual Property Notice",
    zh: "版權及知識產權聲明",
  },
  updated: "2026-08-03",
  intro: [
    {
      en: 'This Copyright & Intellectual Property Notice ("Notice") is published by the Developer of AutoSlides in connection with the AutoSlides software application and web service at learn.ruc.edu.kg (together, the "Software" or "Service"). It explains who owns what, what Users must and must not do with course materials, and how the Developer uses reasonable efforts to remind Users that exported or processed files may contain copyrighted material.',
      zh: "本《版權及知識產權聲明》（下稱「本聲明」）由 AutoSlides 開發者就 AutoSlides 軟件應用程式及位於 learn.ruc.edu.kg 的網頁服務（合稱「軟件」或「本服務」）刊出。本聲明說明各項權利的歸屬、用戶對課程資料必須遵守及不得從事的行為，以及開發者如何以合理努力提醒用戶：匯出或處理後的檔案可能含有受版權保護的材料。",
    },
    {
      en: "This Notice should be read together with the Terms and Conditions, the Privacy Policy, and the Public Storage Disclosure. It does not replace those documents. In the event of any conflict on a matter of contract between the User and the Developer, the Terms prevail; this Notice is intended to state intellectual-property positions and practical notice procedures in fuller detail.",
      zh: "本聲明應與《條款及細則》、《私隱政策》及《公共儲存空間披露》一併閱讀，並不能取代該等文件。就用戶與開發者之間的合約事宜如有衝突，概以《條款及細則》為準；本聲明旨在更詳細地陳述知識產權立場及實際通知程序。",
    },
    {
      en: '**In short:** Platform course videos, slides, and related materials belong to their authors, BIT, or other rights holders — **not** to AutoSlides. The Software is only a tool that acts at your direction. Treat extracted slides, PDFs, ZIPs, and note images as potentially copyrighted. Do not redistribute them. The Developer takes reasonable steps to warn Users (this Notice, in-product legal links, and export metadata reminders such as "This file may contain copyrighted material").',
      zh: "**簡而言之：** 平台的課程影片、幻燈片及相關資料屬其作者、BIT 或其他權利持有人所有——**並非** AutoSlides 所有。本軟件僅為按閣下指示運作的工具。請將已提取的幻燈片、PDF、ZIP 及筆記圖像視為可能受版權保護。請勿再分發。開發者採取合理步驟向用戶作出警示（本聲明、產品內法律連結，以及匯出中繼資料提醒，例如「本檔案可能含有受版權保護的材料」）。",
    },
  ],
  sections: [
    {
      id: "purpose",
      heading: { en: "1. Purpose and scope", zh: "目的及範圍" },
      summary: {
        en: "Separates Software IP from Platform Content IP; informs Users and rights holders.",
        zh: "區分軟件知識產權與平台內容知識產權；告知用戶及權利持有人。",
      },
      paragraphs: [
        {
          en: "**1.1 Purpose.** This Notice is informational and cautionary. It identifies the principal categories of intellectual property that arise when using the Software, states the Developer's position that Platform Content is not owned by the Developer, describes User obligations, and explains how rights holders may contact the Developer. It is not legal advice and is not a licence from any rights holder to use Content.",
          zh: "**目的。** 本聲明旨在提供資訊及警示。其指出使用本軟件時出現的主要知識產權類別，陳述開發者並不擁有平台內容的立場，說明用戶義務，並解釋權利持有人如何聯絡開發者。本聲明並非法律意見，亦非任何權利持有人就使用內容所授予的特許。",
        },
        {
          en: '**1.2 Scope.** This Notice covers: (a) intellectual property in the Software itself; (b) intellectual property in Platform Content retrieved, displayed, extracted, exported, or uploaded through the Software; (c) materials the User creates locally with the Software (for example extracted slide images and export packages); and (d) notice procedures for alleged infringement. It does not govern third-party sites you open outside the Service.',
          zh: "**範圍。** 本聲明涵蓋：(a) 軟件本身的知識產權；(b) 經本軟件獲取、顯示、提取、匯出或上傳的平台內容的知識產權；(c) 用戶以本軟件在本機建立的材料（例如已提取的幻燈片圖像及匯出封裝）；以及 (d) 涉嫌侵權的通知程序。本聲明不管轄閣下在本服務以外開啟的第三方網站。",
        },
        {
          en: '**1.3 Defined terms.** "Developer", "Software", "Service", "Platform", "Content", "User", and "BIT" have the meanings given in the Terms, unless the context requires otherwise.',
          zh: '**定義用語。** 除文意另有所指外，「開發者」、「軟件」、「本服務」、「平台」、「內容」、「用戶」及「BIT」具有《條款及細則》所賦予的涵義。',
        },
      ],
    },
    {
      id: "software-ip",
      heading: {
        en: "2. Intellectual property in the Software",
        zh: "軟件中的知識產權",
      },
      summary: {
        en: "AutoSlides code, branding, and documentation belong to the Developer and its licensors.",
        zh: "AutoSlides 的代碼、品牌及文檔屬開發者及其特許人所有。",
      },
      paragraphs: [
        {
          en: "**2.1 Ownership.** Subject to third-party open-source and proprietary components distributed under their own licences, all right, title, and interest in and to the Software — including its source and object code, user interface, design, documentation, and branding — remain with the Developer and its licensors. These Terms and this Notice do not sell the Software to the User.",
          zh: "**所有權。** 除按各自特許分發的第三方開源及專有組件外，本軟件的所有權利、所有權及權益——包括其源代碼及目標代碼、用戶介面、設計、文檔及品牌——均仍屬開發者及其特許人所有。本條款及本聲明並非向用戶出售本軟件。",
        },
        {
          en: "**2.2 Licence to use.** The User's right to run the Software is only the limited licence granted in the Terms (personal, non-exclusive, non-transferable, revocable, for lawful non-commercial study or research in connection with Content the User is otherwise entitled to access). No other licence is implied.",
          zh: "**使用特許。** 用戶運行本軟件的權利，僅限於《條款及細則》所授予的有限特許（個人、非獨家、不可轉讓、可撤銷，並僅供用戶就其有權存取的內容進行合法、非商業的學習或研究）。並不暗示任何其他特許。",
        },
        {
          en: "**2.3 Restrictions.** Except as mandatory law requires, the User shall not copy, modify, distribute, sell, lease, reverse-engineer (except where prohibited restrictions are void), or create derivative works of the Software, or remove proprietary notices from it.",
          zh: "**限制。** 除強制性法律另有要求外，用戶不得複製、修改、分發、出售、出租本軟件，不得對其進行逆向工程（禁止性限制依法無效者除外），不得創作其衍生作品，亦不得移除其上的專有權聲明。",
        },
        {
          en: "**2.4 Trademarks of others.** Names such as Yanhe Classroom, Yanhekt, and BIT are trademarks of their respective holders. Their appearance in the Software or in this Notice is solely for identification of third-party systems and does not imply endorsement or affiliation.",
          zh: "**他人商標。** 「延河課堂」、Yanhekt 及 BIT 等名稱為其各自持有人的商標。其出現於本軟件或本聲明中，僅為識別第三方系統，並不暗示認可或關聯。",
        },
      ],
    },
    {
      id: "content-ip",
      heading: {
        en: "3. Intellectual property in Platform Content",
        zh: "平台內容中的知識產權",
      },
      summary: {
        en: "Course materials remain with authors, BIT, or other rights holders — never claimed by AutoSlides.",
        zh: "課程資料仍屬作者、BIT 或其他權利持有人——AutoSlides 從不主張擁有。",
      },
      paragraphs: [
        {
          en: "**3.1 No Developer ownership of Content.** The User acknowledges that all right, title, and interest in and to Platform Content — including but not limited to live and recorded lecture video, presentation graphics, documents, audio, transcripts, and related teaching materials — remain the exclusive intellectual property of their original authors, BIT, or other respective rights holders. **The Developer claims no ownership, licence-to-sublicense, or rights whatsoever in that Content**, beyond the limited technical ability to retrieve or process it at the User's direction under the User's own Platform entitlements.",
          zh: "**開發者對內容無所有權。** 用戶確認，平台內容的所有權利、所有權及權益——包括但不限於直播及錄播課堂影片、演示圖形、文檔、音訊、逐字稿及相關教材——均仍屬其原創作者、BIT 或其他各自權利持有人之獨有知識產權。**開發者對該等內容不主張任何所有權、再授權特許或任何權利**，惟按用戶指示、在用戶自身平台權限下進行獲取或處理的有限技術能力除外。",
        },
        {
          en: "**3.2 Extraction does not create new ownership.** Capturing frames, extracting slides, assembling a PDF or ZIP, or inserting images into a note does **not** transfer copyright to the User or to the Developer. A file produced by the Software may still be (or contain) a reproduction or substantial portion of protected Content. Technical transformation alone is not a substitute for a licence from the rights holder.",
          zh: "**提取並不產生新的所有權。** 擷取畫面、提取幻燈片、組裝 PDF 或 ZIP，或將圖像插入筆記，**並不**把版權轉讓予用戶或開發者。本軟件產生的檔案仍可能是（或包含）受保護內容的複製品或實質部分。僅有技術轉換，並不能取代權利持有人的特許。",
        },
        {
          en: "**3.3 Platform and institutional rules.** Access to Content is governed by the Platform's terms, BIT or institutional policies, and applicable law. The Software does not enlarge the User's rights. If the User is not permitted to download, record, extract, or further reproduce a work under those rules, the User must not use the Software to do so.",
          zh: "**平台及機構規則。** 對內容的存取受平台條款、BIT 或機構政策及適用法律管轄。本軟件並不擴大用戶的權利。如按該等規則用戶不得下載、錄製、提取或進一步複製某作品，則用戶不得使用本軟件為之。",
        },
        {
          en: "**3.4 No endorsement.** The availability of Content through the Software does not mean the Developer endorses that Content or has verified that the User holds every permission that may be required for the User's intended use.",
          zh: "**不構成認可。** 內容可經本軟件取得，並不表示開發者認可該內容，或已核實用戶就其擬定用途持有一切所需許可。",
        },
      ],
    },
    {
      id: "user-materials",
      heading: {
        en: "4. Local extracts, exports, and User responsibility",
        zh: "本機提取物、匯出物及用戶責任",
      },
      summary: {
        en: "You are responsible for lawful use of every file the Software helps you create.",
        zh: "用戶須對本軟件協助其建立的每一個檔案的合法使用負責。",
      },
      paragraphs: [
        {
          en: "**4.1 Local processing.** By default, extracted slides are stored on the User's own device (for the web Service, in browser storage). Export to PDF or ZIP is performed locally. Those files are under the User's control and responsibility.",
          zh: "**本機處理。** 預設情況下，已提取的幻燈片儲存在用戶自己的裝置上（網頁服務則儲存在瀏覽器儲存空間）。匯出 PDF 或 ZIP 在本機完成。該等檔案由用戶控制並由其負責。",
        },
        {
          en: '**4.2 Presumption of protection.** The User should presume that lecture video, on-screen slides, handouts, and similar materials are protected by copyright and/or other rights unless the User has clear reason to know otherwise. A convenient filename or a local export does not mean the work is free to share.',
          zh: "**受保護的推定。** 除非用戶有明確理由知悉並非如此，否則應推定課堂影片、螢幕上的幻燈片、講義及類似材料受版權及／或其他權利保護。方便的檔名或本機匯出，並不表示該作品可自由分享。",
        },
        {
          en: "**4.3 Prohibited dealings with Content.** Without limiting the Terms, the User must not, in connection with the Software or materials obtained through it:",
          zh: "**禁止就內容進行的行為。** 在不限制《條款及細則》的前提下，用戶不得就本軟件或經其取得的材料：",
        },
        {
          en: "a. Redistribute, upload to public websites, post to social media, sell, or otherwise commercially exploit Platform Content or substantial extracts of it without authorisation from the rightful owner;",
          zh: "a. 未經權利擁有人授權，再分發、上傳至公開網站、發布至社交媒體、出售或以其他方式商業利用平台內容或其實質摘錄；",
        },
        {
          en: "b. Share examination materials, unpublished assessments, or other restricted institutional files in breach of institutional rules;",
          zh: "b. 違反機構規則而分享試卷、未公開評核或其他受限制的機構檔案；",
        },
        {
          en: "c. Remove or obscure copyright management information, watermarks, or rights notices that appear in the Content, except as mandatory law permits;",
          zh: "c. 移除或遮蓋內容中出現的版權管理資訊、浮水印或權利聲明，惟強制性法律允許者除外；",
        },
        {
          en: "d. Use the Software to circumvent access controls or to obtain Content the User is not entitled to access; or",
          zh: "d. 使用本軟件規避存取控制，或取得用戶無權存取的內容；或",
        },
        {
          en: "e. Upload private or sensitive images to Platform notes without reading the Public Storage Disclosure (Platform note-image storage may be anonymously listable and downloadable).",
          zh: "e. 在未閱讀《公共儲存空間披露》的情況下，將私人或敏感圖像上傳至平台筆記（平台筆記圖像儲存或可被匿名列出及下載）。",
        },
        {
          en: "**4.4 Sole responsibility.** The User bears sole responsibility for verifying that their retrieval, extraction, storage, export, upload, and any further use of Content is lawful and authorised. The Developer does not pre-clear Content for the User.",
          zh: "**全權負責。** 用戶須自行全權負責核實其對內容的獲取、提取、儲存、匯出、上傳及任何進一步使用均屬合法並已獲授權。開發者並不預先為用戶審批內容。",
        },
      ],
    },
    {
      id: "reasonable-efforts",
      heading: {
        en: "5. Reasonable efforts to remind Users of copyright",
        zh: "提醒用戶注意版權的合理努力",
      },
      summary: {
        en: "Standing legal docs, product links, and export reminders such as copyrighted-material notices.",
        zh: "常設法律文件、產品連結，以及匯出提醒（例如受版權保護材料的提示）。",
      },
      paragraphs: [
        {
          en: "**5.1 Principle.** Because the Software can produce local copies and exports that may reproduce protected teaching materials, the Developer has taken, and continues to take, **reasonable efforts** to remind Users that such files may contain copyrighted material and are intended for personal study under the User's own entitlements — not for unrestricted redistribution.",
          zh: "**原則。** 由於本軟件可產生可能重現受保護教材的本機副本及匯出物，開發者已採取並持續採取**合理努力**，提醒用戶該等檔案可能含有受版權保護的材料，並僅供用戶在其自身權限下作個人學習之用——而非不受限制的再分發。",
        },
        {
          en: '**5.2 Forms of reminder.** Those efforts include, without limitation: (a) publishing this Notice as a standing legal document of the Service; (b) stating corresponding IP rules in the Terms; (c) linking to this Notice from the Service\'s navigation or footer legal links, sign-in page, and first-run notice, alongside the Terms, Privacy Policy, and Public Storage Disclosure; (d) presenting a short standing disclaimer in the product chrome that the Software is a third-party tool for personal study and is not affiliated with BIT; and (e) embedding or attaching copyright-oriented reminders in connection with export and similar outputs where practicable — including metadata or notice text substantially to the effect that **"This file may contain copyrighted material"** and is for personal study only. The exact wording, placement, and technical mechanism of such reminders may evolve.',
          zh: '**提醒的形式。** 該等努力包括但不限於：(a) 將本聲明作為本服務的常設法律文件刊出；(b) 在《條款及細則》中載明相應的知識產權規則；(c) 於本服務的導航或頁腳法律連結、登入頁及首次使用提示中，連同《條款及細則》、《私隱政策》及《公共儲存空間披露》一併連至本聲明；(d) 在產品介面中展示簡短的常設聲明，表明本軟件為供個人學習使用的第三方工具，與 BIT 無關聯；以及 (e) 在可行情況下，於匯出及類似輸出中嵌入或附加以版權為導向的提醒——包括中繼資料或通知文字，其大意為**「本檔案可能含有受版權保護的材料」**，並僅供個人學習。該等提醒的確切措辭、位置及技術機制或會演變。',
        },
        {
          en: "**5.3 Effect of reminders.** The reminders described in this section 5 are transparency and education measures. They do not: (a) grant the User any licence from any rights holder; (b) mean the Developer has reviewed or cleared any particular file; (c) restore legality to an unauthorised redistribution; or (d) create a duty for the Developer to watermark every pixel or to police every export. A User who proceeds to extract, export, upload, or share materials after these reminders have been made available is deemed to do so with knowledge of the copyright risk described in this Notice.",
          zh: "**提醒的效力。** 本第 5 節所述提醒屬透明度及教育措施。該等提醒並不：(a) 授予用戶來自任何權利持有人的任何特許；(b) 表示開發者已審閱或批准任何特定檔案；(c) 使未經授權的再分發恢復合法性；或 (d) 使開發者負有為每一像素加浮水印或監察每一次匯出的義務。在該等提醒已可供閱覽的情況下，用戶仍提取、匯出、上傳或分享材料，即視為知悉本聲明所述版權風險而為之。",
        },
        {
          en: "**5.4 User must not strip notices in bad faith.** Where an export or file includes a copyright reminder, metadata field, or similar notice supplied by the Software, the User should not remove it for the purpose of concealing the copyrighted character of the material when redistributing that file. Removal of notices does not improve the User's legal position.",
          zh: "**用戶不得惡意去除聲明。** 如匯出物或檔案包含本軟件提供的版權提醒、中繼資料欄位或類似通知，用戶不應為在再分發該檔案時隱瞞材料受版權保護的性質而將其移除。移除聲明並不會改善用戶的法律地位。",
        },
      ],
    },
    {
      id: "cloud-notes",
      heading: {
        en: "6. Cloud Notes, uploads, and public storage",
        zh: "雲筆記、上傳及公開儲存",
      },
      summary: {
        en: "Uploading slides to Platform notes may publish them; see the Public Storage Disclosure.",
        zh: "將幻燈片上傳至平台筆記或等同公開；見《公共儲存空間披露》。",
      },
      paragraphs: [
        {
          en: "**6.1 Platform-hosted objects.** When the User enables Cloud Notes, watch-mode sync, or manual image insert into notes, images may be uploaded to the Platform's object storage and become part of the User's Platform notes. Hosting and access control for those objects are determined by the Platform, not by AutoSlides.",
          zh: "**平台託管的物件。** 當用戶啟用雲筆記、觀看模式同步，或於筆記中手動插入圖像時，圖像或會上傳至平台的物件儲存，並成為用戶平台筆記的一部分。該等物件的託管及存取控制由平台決定，而非由 AutoSlides 決定。",
        },
        {
          en: "**6.2 Public listability.** As detailed in the Public Storage Disclosure, Platform note-image storage has been observed to allow anonymous listing and download. Uploading copyrighted teaching materials to that storage may increase the risk of unauthorised third-party access. The User must not use note upload to circumvent redistribution rules.",
          zh: "**可被公開列出。** 如《公共儲存空間披露》詳述，平台筆記圖像儲存經觀察允許匿名列出及下載。將受版權保護的教材上傳至該儲存，或會增加未經授權的第三方存取風險。用戶不得以筆記上傳規避再分發規則。",
        },
        {
          en: "**6.3 Developer not the host of Platform buckets.** The Developer does not operate the Platform's MinIO / object-store buckets and cannot delete or lock objects stored only on the Platform. Rights holders seeking removal of material that exists solely on Platform infrastructure should contact the Platform or the relevant institution, and may also notify the Developer under section 7 if the Software is involved in ongoing abuse.",
          zh: "**開發者並非平台儲存桶的託管者。** 開發者並不營運平台的 MinIO／物件儲存桶，亦無法刪除或鎖定僅儲存於平台上的物件。權利持有人如要求移除僅存在於平台基礎設施上的材料，應聯絡平台或相關機構；如本軟件涉及持續濫用，亦可按第 7 節通知開發者。",
        },
      ],
    },
    {
      id: "rights-holders",
      heading: {
        en: "7. Notices from rights holders",
        zh: "權利持有人的通知",
      },
      summary: {
        en: "How to contact the Developer; what we can and cannot remove.",
        zh: "如何聯絡開發者；我們能及不能移除的範圍。",
      },
      paragraphs: [
        {
          en: "**7.1 Good-faith notices.** If you are a copyright owner or an authorised agent and believe that material made available **through the Software in a manner controlled by the Developer** infringes your rights, you may send a notice to info@ruc.edu.kg with, to the extent reasonably available:",
          zh: "**善意通知。** 如閣下為版權擁有人或獲授權代理人，並認為**透過本軟件、且由開發者所控制的方式**提供的材料侵犯閣下的權利，可將通知寄至 info@ruc.edu.kg，並在合理可得的範圍內提供：",
        },
        {
          en: "a. Identification of the copyrighted work claimed to have been infringed (or a representative list if multiple works are covered by one notice);",
          zh: "a. 指稱被侵權的受版權保護作品的識別資料（如一份通知涵蓋多件作品，則提供具代表性的清單）；",
        },
        {
          en: "b. Identification of the material that is claimed to be infringing, and information reasonably sufficient to permit the Developer to locate it (for example URLs on learn.ruc.edu.kg, description of a Software feature, or account identifiers if known);",
          zh: "b. 指稱構成侵權的材料的識別資料，以及足以合理使開發者定位該材料的資訊（例如 learn.ruc.edu.kg 上的 URL、軟件功能描述，或已知的帳戶識別碼）；",
        },
        {
          en: "c. Your contact information (name, organisation if any, email, and postal address if available);",
          zh: "c. 閣下的聯絡資料（姓名、機構（如有）、電郵，以及郵政地址（如有））；",
        },
        {
          en: "d. A statement that you have a good-faith belief that use of the material in the manner complained of is not authorised by the rights holder, its agent, or the law;",
          zh: "d. 一項聲明，表明閣下善意相信，以投訴所述方式使用該材料未獲權利持有人、其代理人或法律授權；",
        },
        {
          en: "e. A statement that the information in the notice is accurate, and that you are the owner or are authorised to act on the owner's behalf; and",
          zh: "e. 一項聲明，表明通知中的資訊準確，且閣下為擁有人或獲授權代擁有人行事；以及",
        },
        {
          en: "f. Your physical or electronic signature (typing your full name is sufficient for email).",
          zh: "f. 閣下的實體或電子簽名（電郵中打出全名即可）。",
        },
        {
          en: "**7.2 What the Developer can do.** Upon a complete notice, the Developer may, as appropriate and without admitting liability: investigate; disable or restrict Software features or access for particular Users; remove or disable material that the Developer itself hosts as part of the Service (if any); and/or terminate repeat abusers' access to the Software in accordance with the Terms.",
          zh: "**開發者可以採取的措施。** 在收到完整通知後，開發者可在適當情況下（且不承認任何責任）：進行調查；停用或限制特定用戶的軟件功能或存取；移除或停用開發者自身作為本服務一部分而託管的材料（如有）；及／或按《條款及細則》終止重複濫用者對本軟件的存取。",
        },
        {
          en: "**7.3 What the Developer cannot do.** The Developer **cannot** delete videos, objects, or notes that exist only on the Platform's servers or object store, cannot reconfigure Platform bucket policies, and cannot compel BIT or the Platform to alter their systems. For Content hosted solely by the Platform, the primary takedown channel is the Platform or the relevant institution.",
          zh: "**開發者不能採取的措施。** 開發者**無法**刪除僅存在於平台伺服器或物件儲存上的影片、物件或筆記，無法重新配置平台儲存桶政策，亦無法強制 BIT 或平台更改其系統。對於僅由平台託管的內容，主要的下架渠道為平台或相關機構。",
        },
        {
          en: "**7.4 Not a US DMCA agent registration.** This section 7 is a practical contact and response procedure for the Service. It is **not** a representation that the Developer is a United States online service provider with a designated DMCA agent under 17 U.S.C. § 512, or that any particular statutory safe harbour applies. Governing law is as stated in the Terms (Hong Kong SAR), without prejudice to mandatory protections that cannot be waived.",
          zh: "**並非美國 DMCA 代理人登記。** 本第 7 節為本服務的實際聯絡及回應程序。**並不**表示開發者為根據《美國法典》第 17 編第 512 條設有指定 DMCA 代理人的美國線上服務提供者，亦不表示任何特定法定安全港適用。管轄法律如《條款及細則》所述（香港特別行政區），惟不影響不可放棄的強制性保護。",
        },
        {
          en: "**7.5 Misrepresentation.** Knowingly materially misrepresenting that material is infringing may expose the notifying party to liability under applicable law. Submit notices only in good faith.",
          zh: "**失實陳述。** 明知而在要項上虛報材料構成侵權，可能使通知方在適用法律下承擔責任。請僅本著善意提交通知。",
        },
      ],
    },
    {
      id: "counter-notice",
      heading: {
        en: "8. Responses from Users",
        zh: "用戶的回應",
      },
      summary: {
        en: "If access was restricted, you may respond with a good-faith explanation.",
        zh: "如存取遭限制，用戶可以善意說明作出回應。",
      },
      paragraphs: [
        {
          en: "**8.1 User response.** If the Developer restricts the User's access to the Software or removes material the Developer hosts based on a rights-holder notice, the User may send a response to info@ruc.edu.kg identifying the material, explaining in good faith why the User believes the restriction was mistaken (for example a misidentification or authorised use), and providing contact details.",
          zh: "**用戶回應。** 如開發者基於權利持有人通知而限制用戶對本軟件的存取，或移除開發者所託管的材料，用戶可向 info@ruc.edu.kg 發送回應，指明該材料、善意解釋為何認為該限制有誤（例如誤認或屬獲授權使用），並提供聯絡資料。",
        },
        {
          en: "**8.2 No automatic reinstatement.** The Developer may consider the response in good faith but is not obliged to reinstate access or material, and may maintain restrictions where risk of ongoing infringement remains. Disputes about Platform-hosted Content must still be resolved with the Platform or the rights holder as appropriate.",
          zh: "**並無自動恢復。** 開發者可本著善意考慮該回應，但無義務恢復存取或材料；在持續侵權風險仍然存在時，可維持限制。有關平台託管內容的爭議，仍須視情況與平台或權利持有人解決。",
        },
      ],
    },
    {
      id: "liability",
      heading: {
        en: "9. Relationship to disclaimers and liability",
        zh: "與免責及責任條款的關係",
      },
      summary: {
        en: "This Notice does not expand Developer liability; Terms disclaimers still apply.",
        zh: "本聲明不擴大開發者責任；《條款及細則》的免責仍然適用。",
      },
      paragraphs: [
        {
          emphasis: true,
          en: "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, NOTHING IN THIS NOTICE CREATES ANY WARRANTY REGARDING CONTENT, ANY OBLIGATION TO MONITOR USER CONDUCT, OR ANY LIABILITY FOR USER INFRINGEMENT BEYOND WHAT THE TERMS ALREADY PROVIDE. THE DISCLAIMER OF WARRANTIES, LIMITATION OF LIABILITY, AND INDEMNIFICATION PROVISIONS IN THE TERMS APPLY FULLY TO MATTERS DESCRIBED IN THIS NOTICE, INCLUDING EXTRACTS, EXPORTS, AND UPLOADS PERFORMED AT THE USER'S DIRECTION.",
          zh: "**在適用法律允許的最大範圍內，本聲明的任何內容均不就內容創設任何保證、不創設監察用戶行為的任何義務，亦不使開發者就用戶侵權承擔超出《條款及細則》已規定範圍的任何責任。《條款及細則》中的保證免責、責任限制及彌償條款，完全適用於本聲明所述事宜，包括按用戶指示進行的提取、匯出及上傳。**",
        },
        {
          en: "**9.1 User indemnification reminder.** Under the Terms, the User agrees to indemnify the Developer against claims arising from the User's use of the Software and from Content the User retrieves, processes, uploads, or publishes. Unauthorised redistribution of course materials is a paradigmatic risk the User assumes.",
          zh: "**用戶彌償提醒。** 根據《條款及細則》，用戶同意就因其使用本軟件，以及因其獲取、處理、上傳或發布內容而引起的索賠，向開發者作出彌償。未經授權再分發課程材料，屬用戶所承擔的典型風險。",
        },
      ],
    },
    {
      id: "changes-contact",
      heading: {
        en: "10. Changes, language, and contact",
        zh: "變更、語言及聯絡",
      },
      summary: {
        en: "Material updates change the date above; English prevails; contact info@ruc.edu.kg.",
        zh: "重大更新會更改上方日期；以英文為準；聯絡 info@ruc.edu.kg。",
      },
      paragraphs: [
        {
          en: "**10.1 Changes.** If this Notice is updated materially, the date shown at the top of this page will be revised. Continued use of the Software after such a revision indicates that the User has had the opportunity to read the updated Notice.",
          zh: "**變更。** 如本聲明有重大更新，本頁頂部所示的日期將會修訂。在該等修訂後繼續使用本軟件，即表示用戶已有機會閱讀經更新的聲明。",
        },
        {
          en: "**10.2 Language.** In the event of any discrepancy between the English and Chinese versions of this Notice, the English version shall prevail.",
          zh: "**語言。** 本聲明的中英版本如有任何歧義，概以英文版本為準。",
        },
        {
          en: "**10.3 Contact.** For questions about this Notice, or to submit a rights-holder notice under section 7, contact info@ruc.edu.kg. For removal of material hosted only on the Platform, contact the Platform or the relevant institution.",
          zh: "**聯絡。** 如對本聲明有疑問，或須按第 7 節提交權利持有人通知，請聯絡 info@ruc.edu.kg。如要求移除僅託管於平台上的材料，請聯絡平台或相關機構。",
        },
      ],
    },
  ],
};
