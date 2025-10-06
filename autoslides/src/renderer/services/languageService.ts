import { setI18nLanguage, detectSystemLanguage } from '../i18n'
import type { LanguageMode } from '../../main/configService'

export class LanguageService {
  private currentLanguageMode: LanguageMode = 'system'

  async initialize(): Promise<void> {
    // Get saved language mode from config
    const savedLanguageMode = await window.electronAPI.config.getLanguageMode()
    this.currentLanguageMode = savedLanguageMode

    // Apply the language setting
    await this.applyLanguageMode(savedLanguageMode)
  }

  async setLanguageMode(mode: LanguageMode): Promise<void> {
    this.currentLanguageMode = mode

    // Save to config
    await window.electronAPI.config.setLanguageMode(mode)

    // Apply the language setting
    await this.applyLanguageMode(mode)
  }

  getCurrentLanguageMode(): LanguageMode {
    return this.currentLanguageMode
  }

  private async applyLanguageMode(mode: LanguageMode): Promise<void> {
    let actualLocale: 'en' | 'zh' | 'ja' | 'ko'

    switch (mode) {
      case 'system':
        actualLocale = detectSystemLanguage()
        break
      case 'en':
        actualLocale = 'en'
        break
      case 'zh':
        actualLocale = 'zh'
        break
      case 'ja':
        actualLocale = 'ja'
        break
      case 'ko':
        actualLocale = 'ko'
        break
      default:
        actualLocale = 'en'
    }

    // Set the i18n locale
    setI18nLanguage(actualLocale)
  }

  // Get the effective language (what's actually being used)
  getEffectiveLanguage(): 'en' | 'zh' | 'ja' | 'ko' {
    if (this.currentLanguageMode === 'system') {
      return detectSystemLanguage()
    }
    return this.currentLanguageMode === 'en' ? 'en' :
           this.currentLanguageMode === 'zh' ? 'zh' :
           this.currentLanguageMode === 'ja' ? 'ja' :
           this.currentLanguageMode === 'ko' ? 'ko' : 'en'
  }
}

// Export a singleton instance
export const languageService = new LanguageService()