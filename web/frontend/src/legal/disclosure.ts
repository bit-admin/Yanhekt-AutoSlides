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
  updated: "2026-08-01",
  intro: [
    {
      en: 'This document explains a property of the Yanhekt ("Platform") object store that affects images you attach to notes — including images uploaded through AutoSlides Cloud Notes and watch-mode sync. It is published so you can decide what is safe to put in a note. It is not a substitute for the Terms or the Privacy Policy.',
      zh: "本文件說明延河課堂（「平台」）物件儲存空間的一項特性，該特性影響閣下附加於筆記的圖像——包括經 AutoSlides 雲筆記及觀看模式同步所上傳的圖像。刊出本文件旨在讓閣下自行判斷何種內容適宜放進筆記。本文件不能取代《條款及細則》或《私隱政策》。",
    },
    {
      en: "In short: note images on the Platform are stored in public object storage that can be listed and downloaded without signing in. Treat every note image as world-readable. AutoSlides only talks to the Platform's note APIs; it does not host those image files on AutoSlides servers.",
      zh: "簡而言之：平台上的筆記圖像存放於可在未登入情況下列出及下載的公開物件儲存空間。請將每一張筆記圖像視為可被任何人讀取。AutoSlides 僅與平台的筆記 API 通訊；不會在 AutoSlides 伺服器上託管該等圖像檔案。",
    },
  ],
  sections: [
    {
      id: "public-exposure",
      heading: {
        en: "1. Public accessibility of note images",
        zh: "筆記圖像之公開存取",
      },
      summary: {
        en: "The Platform's images store can be listed and read anonymously.",
        zh: "平台的圖像儲存空間可被匿名列出及讀取。",
      },
      paragraphs: [
        {
          en: 'The Platform serves user-uploaded media from an S3-compatible object store at **coss.yanhekt.cn** (MinIO behind a reverse proxy). Among its buckets is **images**, which holds note-feature uploads (for example the files created when you insert a picture into a note or when AutoSlides appends a captured slide to a Cloud Note).',
          zh: "平台透過 **coss.yanhekt.cn** 上的 S3 相容物件儲存（反向代理後的 MinIO）提供用戶上傳的媒體。其中 **images** 儲存桶存放筆記功能相關上傳（例如在筆記中插入圖片，或 AutoSlides 將擷取的幻燈片追加至雲筆記時所產生的檔案）。",
        },
        {
          en: "That **images** bucket (and several sibling media buckets) accepts anonymous list and read requests: anyone on the public internet can enumerate object keys, sizes, and upload times, and download the file bytes, without a Platform account or a signed URL. Date- or hash-based object names do not provide meaningful privacy once the bucket itself is listable.",
          zh: "該 **images** 儲存桶（以及若干同類媒體儲存桶）接受匿名的列出及讀取請求：任何人均可在無需平台帳戶或簽署 URL 的情況下，枚舉物件鍵名、大小及上傳時間，並下載檔案內容。一旦儲存桶本身可被列出，以日期或雜湊命名的物件名並不能提供實質私隱保護。",
        },
        {
          en: "An interactive, read-only browser for the same public store is published at [coss.ruc.edu.kg](https://coss.ruc.edu.kg). It demonstrates listing and preview from a normal web browser; it does not require AutoSlides credentials.",
          zh: "同一公開儲存空間的唯讀互動瀏覽器刊於 [coss.ruc.edu.kg](https://coss.ruc.edu.kg)。該工具可在一般網頁瀏覽器中示範列出及預覽，無需 AutoSlides 憑證。",
        },
      ],
    },
    {
      id: "autoslides-role",
      heading: {
        en: "2. Role of AutoSlides",
        zh: "AutoSlides 之角色",
      },
      summary: {
        en: "AutoSlides proxies Platform note APIs; it does not host note images.",
        zh: "AutoSlides 代理平台筆記 API，並不託管筆記圖像。",
      },
      paragraphs: [
        {
          en: "AutoSlides is a client application (and, for the web service, a thin API proxy to the Platform). When you upload or sync a note image, the bytes are sent to the Platform's own note and storage APIs. The resulting object lives under the Platform's object store and under the Platform's policies.",
          zh: "AutoSlides 是客戶端應用程式（網頁服務則另提供通往平台的精簡 API 代理）。閣下上傳或同步筆記圖像時，檔案位元組會傳送至平台自身的筆記及儲存 API。所產生的物件存放於平台的物件儲存空間，並受平台政策約束。",
        },
        {
          en: "The AutoSlides service does not keep a server-side copy of those note images for its own storage, and it does not operate the MinIO buckets described above. Whether a note image is publicly listable or downloadable is determined by the Platform's configuration, not by a setting inside AutoSlides.",
          zh: "AutoSlides 服務不會為自身儲存而在伺服器端保留該等筆記圖像的副本，亦不營運上文所述的 MinIO 儲存桶。筆記圖像是否可被公開列出或下載，取決於平台的設定，而非 AutoSlides 內的選項。",
        },
      ],
    },
    {
      id: "user-guidelines",
      heading: {
        en: "3. What you should not put in notes",
        zh: "不應放入筆記的內容",
      },
      summary: {
        en: "Assume every note image is world-readable.",
        zh: "請假定每一張筆記圖像均可被任何人讀取。",
      },
      paragraphs: [
        {
          en: "**Warning.** Because the Platform's note-image storage is anonymously listable and readable, you should assume that any image attached to a Platform note — whether uploaded by hand in the Notes editor, synced from watch mode, or imported by another AutoSlides feature — can be discovered and viewed by strangers on the internet.",
          zh: "**警告。** 由於平台的筆記圖像儲存可被匿名列出及讀取，閣下應假定附加於平台筆記的任何圖像——無論是在筆記編輯器中手動上傳、經觀看模式同步，或由 AutoSlides 其他功能匯入——均可能被互聯網上的陌生人發現及查看。",
          emphasis: true,
        },
        {
          en: "Do not include private or sensitive material in note images. That includes identity documents, credentials, confidential coursework or institutional files you are not allowed to redistribute, medical or financial records, and personal photographs you would not post on a public website.",
          zh: "請勿在筆記圖像中包含私人或敏感資料。這包括身份證明文件、登入憑證、閣下無權再分發的機密課業或機構檔案、醫療或財務紀錄，以及閣下不會公開張貼於網站上的個人照片。",
        },
      ],
    },
    {
      id: "research-remediation",
      heading: {
        en: "4. Research scope and operator note",
        zh: "研究範圍及營運者備註",
      },
      summary: {
        en: "Findings came from anonymous read-only requests; operators should lock down listing.",
        zh: "發現來自匿名唯讀請求；營運者應限制公開列出。",
      },
      paragraphs: [
        {
          en: "The behaviour described here was observed with anonymous, **read-only** HTTP and S3 listing requests (`GET`, `HEAD`, `ListObjects`) against endpoints reachable without authentication. Nothing was written, modified, or deleted; no Platform accounts or tokens were used; object bodies were not bulk-downloaded for this disclosure.",
          zh: "本文所述行為，乃透過對無需認證即可到達的端點發出匿名、**唯讀** 的 HTTP 及 S3 列出請求（`GET`、`HEAD`、`ListObjects`）而觀察所得。過程中並無寫入、修改或刪除任何內容；並未使用平台帳戶或權杖；亦未為本披露而大量下載物件內容。",
        },
        {
          en: "**For Platform operators.** Anonymous `ListBucket` (and open object read) on buckets that hold user content should be removed. Private objects should require authentication or short-lived signed URLs; protection should apply to the data class consistently, not only to selected path prefixes. Restricting CORS to application origins and scrubbing accidental uploads (for example `.DS_Store`) are further hardening steps. AutoSlides cannot apply those fixes on your behalf.",
          zh: "**致平台營運者。** 承載用戶內容的儲存桶上的匿名 `ListBucket`（以及開放的物件讀取）應予移除。私人物件應要求認證或短效簽署 URL；保護措施應一致適用於整類資料，而非僅限於個別路徑前綴。將 CORS 限制於應用程式來源，並清理誤上傳檔案（例如 `.DS_Store`），亦屬進一步加固步驟。AutoSlides 無法代為套用該等修復。",
        },
      ],
    },
  ],
};
