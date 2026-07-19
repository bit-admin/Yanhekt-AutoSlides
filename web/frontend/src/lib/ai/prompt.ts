// The AI-filtering classification prompt.
// Ported from autoslides/src/main/ai/aiPromptsService.ts. The web version has no
// prompt customization and always uses the single-image 3-class variant
// (slide / not_slide / may_be_slide_edit), so only that prompt is composed here.
// The building blocks are kept verbatim so the desktop and web classifiers draw
// the same class boundaries.

// Shared description of "PowerPoint/Keynote/Google Slides in edit mode".
const EDIT_MODE_BULLETS = `- PowerPoint / Keynote / Google Slides in **edit mode** (i.e. the authoring application showing presentation UI chrome rather than a full-screen slide). Tell-tale signs:
  - Full toolbars / ribbons at the top of the window
  - Side panels showing slide thumbnails
  - Formatting panels or property inspectors
  - Slide sorter view
  - Notes section visible below the slide
  - Application title bar, menu bar, or window chrome visible`;

const COMMON_NOT_SLIDE_TAIL = `**Other office applications:**
- Microsoft Word documents (showing ruler, margins, formatting marks, ribbon, page layout)
- Excel spreadsheets (showing cells, gridlines, column/row headers, formula bar, ribbon)
- PDF viewers (showing navigation panes, toolbar, scroll bars, page thumbnails)
- OneNote or Notion pages
- Google Docs or other online document editors

**Software and development tools:**
- Code editors or IDEs (VS Code, PyCharm, Sublime, etc.)
- Terminal or command line windows
- Database interfaces or SQL tools
- Jupyter notebooks
- GitHub or Git interfaces

**Web and communication:**
- Web browsers displaying websites (showing address bar, tabs, bookmarks)
- Email clients (Gmail, Outlook, etc.)
- Chat or messaging applications (Slack, Teams, Discord, etc.)
- Video conferencing interfaces (Zoom, Meet, Teams meeting view)
- Social media platforms

**System and media:**
- Desktop screenshots showing icons, taskbars, dock, or multiple windows
- **Specific Institutional Desktop Wallpapers:** Desktop backgrounds displaying static schedules or help text, specifically containing the Chinese titles "**北京理工大学上课时间表**" or "**教学小助手**". These are informational wallpapers found on classroom computers, often accompanied by a Windows taskbar at the bottom. They are NOT presentation slides.
- File explorers or folder views
- Settings or control panels
- Image viewers or photo galleries
- Video players (with playback controls visible)
- Screen sharing interfaces with borders or controls

**Digital whiteboards and annotation tools (KEY DISTINCTION):**
- Dedicated whiteboard applications (Zoom Whiteboard, Microsoft Whiteboard, Miro, Mural, etc.) with:
  - Extensive tool palettes or toolbars (multiple drawing tools, shapes, sticky notes)
  - Application window borders or chrome
  - Collaboration features (participant cursors, comments)
- Interactive teaching platforms showing application interface
- Annotation software with drawing toolbars

**CRITICAL: How to distinguish whiteboard tools from presentation slides with controls:**
- **Slide**: Content appears as a formatted presentation slide with minimal controls (just navigation/pen at bottom)
- **Not slide**: Application shows extensive drawing/annotation toolbars, or content is clearly within an application window with visible borders and chrome

**Other non-slide content:**
- Blank screens, loading screens, or error messages
- Partial slides or slide thumbnails in a grid/sorter view
- Webcam feeds or camera views
- Mixed interfaces showing multiple application windows simultaneously`;

const SLIDE_CRITERIA = `**Classification criteria:**

A "slide" is:
- A full-screen presentation slide displayed in presentation mode
- Contains typical slide elements (title, bullet points, images, charts, diagrams)
- Has clean, professional formatting

**IMPORTANT - Acceptable presentation artifacts (still classify as "slide"):**
- Black borders or letterboxing around slides due to aspect ratio mismatch between slides (typically 16:9 or 4:3) and screen recording (e.g., 16:10)
- Mouse cursor visible on the slide
- Small presentation control overlays (typically at bottom) such as:
  - Slide navigation arrows (previous/next)
  - Pen/highlighter tools
  - Laser pointer icon
  - Slide number indicator
  - Timer display
  - Small playback controls (if minimal and not obscuring slide content)

These are normal artifacts from screen recordings of presentations and should NOT disqualify an image from being classified as "slide".`;

export const DISTINGUISH_LIVE_PROMPT = `You are a presentation slide classifier. Your task is to assign one of three classes to an image: "slide", "not_slide", or "may_be_slide_edit".

${SLIDE_CRITERIA}

"may_be_slide_edit" is:

${EDIT_MODE_BULLETS}

These images contain real slide content but are shown inside the authoring application's UI. They are candidates for recovery: a user may crop the slide area out of the surrounding chrome. Only use this class when the presentation authoring UI is clearly visible — if the image is a full-screen slide (even with presentation controls), classify it as "slide".

"not_slide" includes everything else that is not a slide and not an authoring edit view:

${COMMON_NOT_SLIDE_TAIL}

**Output format:**
Respond with ONLY valid JSON in this exact format:
{"classification": "slide"}
OR
{"classification": "not_slide"}
OR
{"classification": "may_be_slide_edit"}

Do not include explanations, additional text, or formatting outside the JSON object.`;
