import { nativeTheme } from 'electron';

export type ThemeMode = 'system' | 'light' | 'dark';

export class ThemeService {
  private currentTheme: ThemeMode = 'system';

  constructor() {
    // Initialize with system theme by default
    this.setTheme('system');
  }

  /**
   * Set the application theme
   * @param theme - The theme mode to set ('system', 'light', or 'dark')
   */
  setTheme(theme: ThemeMode): void {
    this.currentTheme = theme;

    switch (theme) {
      case 'system':
        nativeTheme.themeSource = 'system';
        break;
      case 'light':
        nativeTheme.themeSource = 'light';
        break;
      case 'dark':
        nativeTheme.themeSource = 'dark';
        break;
      default:
        nativeTheme.themeSource = 'system';
        this.currentTheme = 'system';
    }
  }

  /**
   * Get the current theme mode
   * @returns The current theme mode
   */
  getCurrentTheme(): ThemeMode {
    return this.currentTheme;
  }

  /**
   * Get whether the system is currently using dark mode
   * @returns True if dark mode is active, false otherwise
   */
  isDarkMode(): boolean {
    return nativeTheme.shouldUseDarkColors;
  }

  /**
   * Get the effective theme (what's actually being displayed)
   * @returns 'light' or 'dark' based on what's currently active
   */
  getEffectiveTheme(): 'light' | 'dark' {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  }

  /**
   * Listen for system theme changes
   * @param callback - Function to call when theme changes
   */
  onThemeChange(callback: (isDark: boolean) => void): void {
    nativeTheme.on('updated', () => {
      callback(nativeTheme.shouldUseDarkColors);
    });
  }
}