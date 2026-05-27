import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export type AIPromptType = 'live' | 'recorded';
export type AIPromptVariant = 'simple' | 'distinguish';

export interface AIPrompts {
  live: string;
  recorded: string;
}

export interface AIPromptVariants {
  simple: AIPrompts;       // classes: slide / not_slide
  distinguish: AIPrompts;  // classes: slide / not_slide / may_be_slide_edit
}

interface VariantCustomized {
  live: boolean;
  recorded: boolean;
}

interface AIPromptsFile {
  version: number;
  customized: {
    simple: VariantCustomized;
    distinguish: VariantCustomized;
  };
  prompts: AIPromptVariants;
}

// Increment this when default prompts are updated
const CURRENT_VERSION = 2;

// Shared description of "PowerPoint/Keynote/Google Slides in edit mode" used in
// both variants so the boundary between "slide" and "edit mode" is identical.
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

// ============ SIMPLE VARIANT (two classes: slide / not_slide) ============

const SIMPLE_LIVE_PROMPT = `You are a presentation slide classifier. Your task is to determine whether an image shows a full-screen presentation slide or not.

${SLIDE_CRITERIA}

"not_slide" includes:

**Office applications (not in presentation mode):**
${EDIT_MODE_BULLETS}

${COMMON_NOT_SLIDE_TAIL}

**Output format:**
Respond with ONLY valid JSON in this exact format:
{"classification": "slide"}
OR
{"classification": "not_slide"}

Do not include explanations, additional text, or formatting outside the JSON object.`;

const SIMPLE_RECORDED_PROMPT = `You are a presentation slide classifier. Your task is to determine whether an image shows a full-screen presentation slide or not.

${SLIDE_CRITERIA}

"not_slide" includes:

**Office applications (not in presentation mode):**
${EDIT_MODE_BULLETS}

${COMMON_NOT_SLIDE_TAIL}

**Output format:**
Respond with ONLY valid JSON containing classifications for each image.
Format: {"image_0": "slide", "image_1": "not_slide", "image_2": "slide", ...}

Use zero-based indexing (image_0, image_1, image_2, etc.) matching the order of input images.
Do not include explanations, additional text, or formatting outside the JSON object.`;

// ============ DISTINGUISH VARIANT (three classes, adds may_be_slide_edit) ============
// Same rules as simple, but edit-mode frames become their own class so downstream
// code can restore+auto-crop them instead of permanently deleting.

const DISTINGUISH_LIVE_PROMPT = `You are a presentation slide classifier. Your task is to assign one of three classes to an image: "slide", "not_slide", or "may_be_slide_edit".

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

const DISTINGUISH_RECORDED_PROMPT = `You are a presentation slide classifier. Your task is to assign one of three classes to each image: "slide", "not_slide", or "may_be_slide_edit".

${SLIDE_CRITERIA}

"may_be_slide_edit" is:

${EDIT_MODE_BULLETS}

These images contain real slide content but are shown inside the authoring application's UI. They are candidates for recovery: a user may crop the slide area out of the surrounding chrome. Only use this class when the presentation authoring UI is clearly visible — if the image is a full-screen slide (even with presentation controls), classify it as "slide".

"not_slide" includes everything else that is not a slide and not an authoring edit view:

${COMMON_NOT_SLIDE_TAIL}

**Output format:**
Respond with ONLY valid JSON containing classifications for each image.
Format: {"image_0": "slide", "image_1": "not_slide", "image_2": "may_be_slide_edit", ...}

Use zero-based indexing (image_0, image_1, image_2, etc.) matching the order of input images.
Each value must be exactly one of: "slide", "not_slide", "may_be_slide_edit".
Do not include explanations, additional text, or formatting outside the JSON object.`;

const DEFAULT_PROMPTS: AIPromptVariants = {
  simple: {
    live: SIMPLE_LIVE_PROMPT,
    recorded: SIMPLE_RECORDED_PROMPT
  },
  distinguish: {
    live: DISTINGUISH_LIVE_PROMPT,
    recorded: DISTINGUISH_RECORDED_PROMPT
  }
};

function createDefaultFileData(): AIPromptsFile {
  return {
    version: CURRENT_VERSION,
    customized: {
      simple: { live: false, recorded: false },
      distinguish: { live: false, recorded: false }
    },
    prompts: {
      simple: { ...DEFAULT_PROMPTS.simple },
      distinguish: { ...DEFAULT_PROMPTS.distinguish }
    }
  };
}

export class AIPromptsService {
  private promptsFilePath: string;
  private fileData: AIPromptsFile;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.promptsFilePath = path.join(userDataPath, 'ai-prompts.json');
    this.fileData = this.loadPrompts();
  }

  private loadPrompts(): AIPromptsFile {
    try {
      if (fs.existsSync(this.promptsFilePath)) {
        const content = fs.readFileSync(this.promptsFilePath, 'utf-8');
        const parsed = JSON.parse(content);

        // Legacy format (no version field). Prompts stored flat as {live, recorded}.
        if (parsed.version === undefined) {
          console.log('Migrating AI prompts from legacy format...');
          const legacy = parsed as Partial<AIPrompts>;
          const migrated: AIPromptsFile = {
            version: CURRENT_VERSION,
            customized: {
              // The legacy file's existence strongly implies customization.
              simple: { live: true, recorded: true },
              distinguish: { live: false, recorded: false }
            },
            prompts: {
              simple: {
                live: legacy.live || SIMPLE_LIVE_PROMPT,
                recorded: legacy.recorded || SIMPLE_RECORDED_PROMPT
              },
              distinguish: { ...DEFAULT_PROMPTS.distinguish }
            }
          };
          this.saveFileData(migrated);
          return migrated;
        }

        // v1 → v2 migration: flat prompts become the `simple` variant,
        // `distinguish` starts from fresh defaults.
        if (parsed.version === 1) {
          console.log('Upgrading AI prompts from version 1 to 2...');
          const v1 = parsed as {
            version: number;
            customized: { live: boolean; recorded: boolean };
            prompts: AIPrompts;
          };
          const migrated: AIPromptsFile = {
            version: CURRENT_VERSION,
            customized: {
              simple: {
                live: v1.customized?.live ?? false,
                recorded: v1.customized?.recorded ?? false
              },
              distinguish: { live: false, recorded: false }
            },
            prompts: {
              simple: {
                live: v1.customized?.live ? (v1.prompts?.live || SIMPLE_LIVE_PROMPT) : SIMPLE_LIVE_PROMPT,
                recorded: v1.customized?.recorded ? (v1.prompts?.recorded || SIMPLE_RECORDED_PROMPT) : SIMPLE_RECORDED_PROMPT
              },
              distinguish: { ...DEFAULT_PROMPTS.distinguish }
            }
          };
          this.saveFileData(migrated);
          return migrated;
        }

        // v2+: refresh non-customized prompts with latest defaults.
        const fileData = parsed as AIPromptsFile;
        const refreshed = this.hydrateV2(fileData);
        if (fileData.version < CURRENT_VERSION) {
          console.log(`Upgrading AI prompts from version ${fileData.version} to ${CURRENT_VERSION}...`);
        }
        refreshed.version = CURRENT_VERSION;
        this.saveFileData(refreshed);
        return refreshed;
      }
    } catch (error) {
      console.error('Failed to load AI prompts:', error);
    }

    const defaults = createDefaultFileData();
    this.saveFileData(defaults);
    return defaults;
  }

  private hydrateV2(fileData: AIPromptsFile): AIPromptsFile {
    const customized = {
      simple: {
        live: fileData.customized?.simple?.live ?? false,
        recorded: fileData.customized?.simple?.recorded ?? false
      },
      distinguish: {
        live: fileData.customized?.distinguish?.live ?? false,
        recorded: fileData.customized?.distinguish?.recorded ?? false
      }
    };

    const prompts: AIPromptVariants = {
      simple: {
        live: customized.simple.live
          ? (fileData.prompts?.simple?.live || SIMPLE_LIVE_PROMPT)
          : SIMPLE_LIVE_PROMPT,
        recorded: customized.simple.recorded
          ? (fileData.prompts?.simple?.recorded || SIMPLE_RECORDED_PROMPT)
          : SIMPLE_RECORDED_PROMPT
      },
      distinguish: {
        live: customized.distinguish.live
          ? (fileData.prompts?.distinguish?.live || DISTINGUISH_LIVE_PROMPT)
          : DISTINGUISH_LIVE_PROMPT,
        recorded: customized.distinguish.recorded
          ? (fileData.prompts?.distinguish?.recorded || DISTINGUISH_RECORDED_PROMPT)
          : DISTINGUISH_RECORDED_PROMPT
      }
    };

    return {
      version: fileData.version || CURRENT_VERSION,
      customized,
      prompts
    };
  }

  private saveFileData(data: AIPromptsFile): void {
    try {
      const dirPath = path.dirname(this.promptsFilePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      fs.writeFileSync(this.promptsFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save AI prompts:', error);
    }
  }

  private resolveVariant(variant?: AIPromptVariant): AIPromptVariant {
    return variant ?? 'simple';
  }

  getPrompts(variant?: AIPromptVariant): AIPrompts {
    const v = this.resolveVariant(variant);
    return { ...this.fileData.prompts[v] };
  }

  getPrompt(type: AIPromptType, variant?: AIPromptVariant): string {
    const v = this.resolveVariant(variant);
    return this.fileData.prompts[v][type];
  }

  setPrompt(type: AIPromptType, prompt: string, variant?: AIPromptVariant): void {
    const v = this.resolveVariant(variant);
    this.fileData.prompts[v][type] = prompt;
    this.fileData.customized[v][type] = true;
    this.saveFileData(this.fileData);
  }

  resetPrompt(type: AIPromptType, variant?: AIPromptVariant): string {
    const v = this.resolveVariant(variant);
    this.fileData.prompts[v][type] = DEFAULT_PROMPTS[v][type];
    this.fileData.customized[v][type] = false;
    this.saveFileData(this.fileData);
    return this.fileData.prompts[v][type];
  }

  resetAllPrompts(): AIPromptVariants {
    this.fileData = createDefaultFileData();
    this.saveFileData(this.fileData);
    return {
      simple: { ...this.fileData.prompts.simple },
      distinguish: { ...this.fileData.prompts.distinguish }
    };
  }

  getDefaultPrompt(type: AIPromptType, variant?: AIPromptVariant): string {
    const v = this.resolveVariant(variant);
    return DEFAULT_PROMPTS[v][type];
  }

  isCustomized(type: AIPromptType, variant?: AIPromptVariant): boolean {
    const v = this.resolveVariant(variant);
    return this.fileData.customized[v][type];
  }

  getVersion(): number {
    return this.fileData.version;
  }
}
