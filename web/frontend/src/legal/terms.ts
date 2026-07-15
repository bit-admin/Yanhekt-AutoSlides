import type { LegalDoc } from "./types";

// Ported from docs/terms.md, which covers the desktop app. The substance is
// unchanged; the wording is widened from "download or install" to also cover
// accessing the Service in a browser, and "Service" is defined alongside
// "Software" so the same terms bind both.

export const termsDoc: LegalDoc = {
  id: "terms",
  title: { en: "Terms and Conditions", zh: "條款及細則" },
  updated: "2026-07-15",
  intro: [
    {
      en: 'By accessing, downloading, installing, or using this software or the AutoSlides web service ("Software"), you ("User") signify your agreement to be legally bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, you are not permitted to access or use the Software.',
      zh: "存取、下載、安裝或使用本軟件或 AutoSlides 網頁服務（下稱「軟件」），即表示閣下（下稱「用戶」）同意受本條款及細則（下稱「條款」）的法律約束。如閣下不同意本條款，則不得存取或使用本軟件。",
    },
  ],
  sections: [
    {
      id: "definitions",
      heading: { en: "1. Definitions", zh: "定義" },
      summary: {
        en: "Defines the Software, the Platform, the Content, and the Developer.",
        zh: "界定「軟件」、「平台」、「內容」及「開發者」。",
      },
      paragraphs: [
        {
          en: '**"Software"** refers to the software application and web service provided by the Developer designed to interact with the Platform.',
          zh: "**「軟件」** 指由開發者提供，旨在與平台進行交互的軟件應用程式及網頁服務。",
        },
        {
          en: '**"Platform"** refers to the "Yanhe Classroom" platform of the Beijing Institute of Technology ("BIT").',
          zh: "**「平台」** 指北京理工大學（「BIT」）的「延河課堂」平台。",
        },
        {
          en: '**"Content"** refers to all course resources available on the Platform, including but not limited to videos, documents, images, and audio files.',
          zh: "**「內容」** 指平台上提供的所有課程資源，包括但不限於影片、文檔、圖像及音訊檔案。",
        },
        {
          en: '**"Developer"** refers to the creator and owner of the Software.',
          zh: "**「開發者」** 指本軟件的創作者及擁有人。",
        },
      ],
    },
    {
      id: "affiliation",
      heading: { en: "2. Disclaimer of Affiliation", zh: "關聯關係聲明" },
      summary: {
        en: "The Software is an independent third-party tool with no connection to BIT.",
        zh: "本軟件為獨立的第三方工具，與 BIT 並無任何關聯。",
      },
      paragraphs: [
        {
          en: "**2.1 Independent Development.** The Software is an independent project developed and maintained solely by the Developer. It acts as a third-party utility tool.",
          zh: "**獨立開發。** 本軟件為一項獨立項目，由開發者自行開發及維護。本軟件僅作為第三方實用工具。",
        },
        {
          en: "**2.2 No Affiliation.** **This tool is NOT an official application of, and is NOT affiliated with, associated with, endorsed by, or in any way connected to Beijing Institute of Technology (BIT), or any of their subsidiaries or affiliates.** The Developer has no official relationship, partnership, or joint venture with BIT.",
          zh: "**無關聯關係。** **本工具並非北京理工大學（BIT）的官方應用程式，亦與其或其任何附屬機構或關聯方無任何關聯、聯繫、獲其認可或以任何方式相關。** 開發者與 BIT 並無任何官方關係、合夥關係或合資關係。",
        },
        {
          en: '**2.3 Trademarks.** All product and company names mentioned herein (including but not limited to "Yanhe Classroom" and "BIT") are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them.',
          zh: "**商標。** 此處提及的所有產品及公司名稱（包括但不限於「延河課堂」及「BIT」）均為其各自持有人的商標™或註冊®商標。使用該等名稱並不暗示與其有任何關聯或獲其認可。",
        },
      ],
    },
    {
      id: "nature",
      heading: { en: "3. Nature of the Software", zh: "軟件性質" },
      summary: {
        en: "The Software is a neutral tool acting at your direction; it hosts no Content and endorses none.",
        zh: "本軟件為按用戶指示運作的中立工具，既不託管內容，亦不認可內容。",
      },
      paragraphs: [
        {
          en: "**3.1 Technical Intermediary Only.** The Software acts solely as a neutral technical tool designed exclusively to facilitate the retrieval of Content from the Platform at the User's explicit direction. It functions as a specialized browser or download manager.",
          zh: "**僅為技術中介。** 本軟件僅作為一項中立的技術工具，專為協助用戶按其明確指示從平台獲取內容而設計。其功能僅限於作為專用瀏覽器或下載管理器。",
        },
        {
          en: "**3.2 No Content Ownership or Control.** The Software does not create, select, edit, modify, host, or distribute any Content. All retrieved materials originate directly from the Platform's servers. The Developer exercises no editorial control over the Content and assumes no responsibility for the nature, accuracy, legality, or quality of such Content.",
          zh: "**無內容所有權或控制權。** 本軟件不會創作、揀選、編輯、修改、託管或分發任何內容。所有獲取的資料均直接源自平台的伺服器。開發者對內容不行使任何編輯控制權，亦不對該等內容的性質、準確性、合法性或質量承擔任何責任。",
        },
        {
          en: "**3.3 No Endorsement of Content.** The availability of the Software to retrieve specific Content does not constitute an endorsement, approval, or representation of any opinion by the Developer regarding such Content. The Content reflects solely the views and opinions of its original authors or BIT, and explicitly **does not represent the views, opinions, or positions of the Developer.**",
          zh: "**不構成對內容的認可。** 本軟件可用於獲取特定內容，並不構成開發者對該等內容的認可、批准或對其發表任何意見。內容僅反映其原創作者或 BIT 的觀點及意見，**明確不代表開發者的觀點、意見或立場。**",
        },
      ],
    },
    {
      id: "ip",
      heading: { en: "4. Intellectual Property Rights", zh: "知識產權聲明" },
      summary: {
        en: "Content belongs to its rights holders; you are responsible for having permission to use it.",
        zh: "內容屬其權利持有人所有；用戶須自行確保已獲使用授權。",
      },
      paragraphs: [
        {
          en: "**4.1 Ownership.** The User acknowledges and agrees that all right, title, and interest in and to the Content (including but not limited to copyrights, trademarks, and trade secrets) remain the exclusive intellectual property of their original authors, BIT, or respective rights holders. **The Developer claims no ownership, license, or rights whatsoever to the Content.**",
          zh: "**所有權。** 用戶確認並同意，內容的所有權利、所有權及權益（包括但不限於版權、商標及商業秘密）均仍屬其原創作者、BIT 或各自的權利持有人之獨有知識產權。**開發者對內容不主張任何所有權、特許權或權利。**",
        },
        {
          en: "**4.2 User Responsibility.** The User's right to use the Software is strictly contingent upon the User having valid legal access to the Platform and necessary permissions from BIT or relevant rights holders to retrieve the Content. The User bears sole liability for verifying the copyright status of any Content processed by the Software.",
          zh: "**用戶責任。** 用戶使用本軟件的權利，嚴格取決於用戶是否擁有存取平台的合法權限，以及是否已從 BIT 或相關權利持有人處獲得獲取內容所需的許可。用戶須自行全權負責核實經本軟件處理的任何內容之版權狀況。",
        },
      ],
    },
    {
      id: "obligations",
      heading: { en: "5. User Obligations and Prohibited Conduct", zh: "用戶義務及禁止行為" },
      summary: {
        en: "Personal study only — no redistribution, no commercial use, no infringement.",
        zh: "僅限個人學習用途——不得再分發、作商業用途或侵權。",
      },
      paragraphs: [
        {
          en: "The User agrees not to use the Software for any purpose that is unlawful or prohibited by these Terms. The User is solely responsible for their conduct and any Content they retrieve. Prohibited activities include, but are not limited to:",
          zh: "用戶同意不將本軟件用於任何非法或本條款禁止的用途。用戶須對其行為及所獲取的任何內容自行承擔全部責任。禁止的活動包括但不限於：",
        },
        {
          en: "a. Reproducing, distributing, publicly performing, modifying, or creating derivative works from any Content without explicit authorization from the rightful owner;",
          zh: "a. 未經權利擁有人明確授權，複製、分發、公開展示、修改任何內容或創作其衍生作品；",
        },
        {
          en: "b. Using the Content for any commercial purpose;",
          zh: "b. 將內容用於任何商業用途；",
        },
        {
          en: "c. Reverse-engineering, decompiling, or attempting to discover the source code of the Software or the Platform;",
          zh: "c. 對本軟件或平台進行逆向工程、反編譯，或試圖發現其源代碼；",
        },
        {
          en: "d. Using the Software to infringe upon the intellectual property rights or other legal rights of any third party, including BIT, content creators, or other rights holders.",
          zh: "d. 使用本軟件侵犯任何第三方（包括 BIT、內容創作者或其他權利持有人）的知識產權或其他合法權利。",
        },
        {
          en: "Any breach of these obligations may result in the immediate termination of the User's right to use the Software and may expose the User to civil and/or criminal liability.",
          zh: "任何違反上述義務的行為可能導致用戶使用本軟件的權利被立即終止，並可能導致用戶承擔民事及／或刑事責任。",
        },
      ],
    },
    {
      id: "warranties",
      heading: { en: "6. Disclaimer of Warranties", zh: "免責聲明" },
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
          en: "THE DEVELOPER DOES NOT WARRANT THAT THE SOFTWARE WILL MEET THE USER'S REQUIREMENTS, BE UNINTERRUPTED, OR BE ERROR-FREE, NOR DOES THE DEVELOPER MAKE ANY WARRANTY AS TO THE LEGALITY, ACCURACY, OR AVAILABILITY OF THE PLATFORM OR ITS CONTENT.",
          zh: "**開發者不保證本軟件將滿足用戶的要求、不會中斷或沒有錯誤，亦不對平台或其內容的合法性、準確性或可用性作出任何保證。**",
        },
      ],
    },
    {
      id: "liability",
      heading: { en: "7. Limitation of Liability", zh: "責任限制" },
      summary: {
        en: "The Developer is not liable for damages arising from use of the Software.",
        zh: "開發者對因使用本軟件而引起的損害概不負責。",
      },
      paragraphs: [
        {
          emphasis: true,
          en: "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE DEVELOPER BE LIABLE FOR ANY DIRECT, INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES, INCLUDING WITHOUT LIMITATION, DAMAGES FOR LOSS OF DATA, LOSS OF PROFITS, BUSINESS INTERRUPTION, INTELLECTUAL PROPERTY DISPUTES, OR ANY OTHER COMMERCIAL DAMAGES OR LOSSES, ARISING OUT OF OR IN ANY WAY RELATED TO THE USE OR INABILITY TO USE THE SOFTWARE, HOWEVER CAUSED, REGARDLESS OF THE THEORY OF LIABILITY (CONTRACT, TORT, OR OTHERWISE) AND EVEN IF THE DEVELOPER HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.",
          zh: "**在適用法律允許的最大範圍內，在任何情況下，對於因使用或無法使用本軟件而引起或與之相關的任何直接、間接、懲罰性、附帶、特殊或後果性損害（包括但不限於數據丟失、利潤損失、業務中斷、知識產權爭議或其他商業損害或損失），無論是基於合約、侵權或其他法律理論，即使開發者已被告知發生此類損害的可能性，開發者概不負責。**",
        },
      ],
    },
    {
      id: "indemnification",
      heading: { en: "8. Indemnification", zh: "彌償" },
      summary: {
        en: "You cover the Developer against claims arising from your use of the Software.",
        zh: "用戶須就其使用本軟件所引起的索賠向開發者作出彌償。",
      },
      paragraphs: [
        {
          en: "The User agrees to indemnify, defend, and hold harmless the Developer and its affiliates from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or in any way connected with: (a) the User's access to or use of the Software; (b) the User's violation of these Terms; or (c) the User's infringement of any third-party right, including without limitation any intellectual property right or privacy right.",
          zh: "用戶同意彌償、抗辯並使開發者及其關聯方免受因以下原因引起或與之相關的任何及所有索賠、責任、損害、損失、成本及費用（包括合理的律師費）的損害：(a) 用戶存取或使用本軟件；(b) 用戶違反本條款；或 (c) 用戶侵犯任何第三方權利，包括但不限於任何知識產權或私隱權。",
        },
      ],
    },
    {
      id: "general",
      heading: { en: "9. General Provisions", zh: "一般條款" },
      summary: {
        en: "Governing law, language, severability, and how to contact the Developer.",
        zh: "管轄法律、語言、可分割性及聯絡開發者的方法。",
      },
      paragraphs: [
        {
          en: "**Governing Law:** These Terms shall be governed by and construed in accordance with the laws of Hong Kong SAR, without regard to its conflict of law principles.",
          zh: "**管轄法律：** 本條款應受香港特別行政區法律管轄並據其解釋，而不考慮其法律衝突原則。",
        },
        {
          en: "**Language:** In the event of any discrepancy or inconsistency between the English and Chinese versions of these Terms, the English version shall prevail.",
          zh: "**語言：** 本條款及細則的中英版本如有任何歧義或不一致，概以英文版本為準。",
        },
        {
          en: "**Severability:** If any provision of these Terms is held to be unenforceable or invalid, such provision will be changed and interpreted to accomplish the objectives of such provision to the greatest extent possible under applicable law, and the remaining provisions will continue in full force and effect.",
          zh: "**可分割性：** 如本條款的任何規定被裁定為不可執行或無效，則該規定將在適用法律允許的最大範圍內進行修改及解釋，以實現該規定的目標，而其餘規定將繼續完全有效。",
        },
        {
          en: "**Entire Agreement:** These Terms constitute the entire agreement between the User and the Developer regarding the use of the Software and supersede all prior agreements and understandings.",
          zh: "**完整協議：** 本條款構成用戶與開發者之間關於使用本軟件的完整協議，並取代所有先前的協議及諒解。",
        },
        {
          en: "**Contact Information:** For technical or legal inquiries, please contact info@ruc.edu.kg.",
          zh: "**聯絡資料：** 如有技術或法律查詢，請聯絡 info@ruc.edu.kg。",
        },
      ],
    },
  ],
};
