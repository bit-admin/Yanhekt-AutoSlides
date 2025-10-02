/**
 * Slide Extractor Service
 * Main service for extracting slides from video streams
 */

import { slideProcessorService } from './slideProcessorService';

export interface SlideExtractionConfig {
  checkInterval: number;           // Detection interval in milliseconds
  enableDoubleVerification: boolean; // Enable dual verification
  verificationCount: number;       // Number of verification attempts
  hammingThresholdLow: number;     // Hamming distance lower bound
  hammingThresholdUp: number;      // Hamming distance upper bound
  ssimThreshold: number;           // SSIM similarity threshold
}

export interface ExtractedSlide {
  id: string;
  title: string;
  timestamp: string;
  imageData: ImageData;
  dataUrl: string;
}

export class SlideExtractor {
  private isRunning = false;
  private captureInterval: NodeJS.Timeout | null = null;
  private lastImageData: ImageData | null = null;
  private extractedSlides: ExtractedSlide[] = [];

  // Configuration with default values
  private config: SlideExtractionConfig = {
    checkInterval: 2000,              // 2 seconds
    enableDoubleVerification: true,   // Enable dual verification
    verificationCount: 2,             // 2 verification attempts
    hammingThresholdLow: 0,          // Hamming distance lower bound
    hammingThresholdUp: 5,           // Hamming distance upper bound
    ssimThreshold: 0.999             // SSIM similarity threshold
  };

  // Playback rate tracking for dynamic interval adjustment
  private currentPlaybackRate = 1;
  private baseCheckInterval = 2000;  // Store original config value
  private intervalTable = new Map<number, number>(); // Pre-calculated interval lookup table

  // Dual verification state
  private verificationState: 'none' | 'verifying' = 'none';
  private currentVerification = 0;
  private potentialNewImageData: ImageData | null = null;

  constructor() {
    // Build initial interval table with default base interval
    this.buildIntervalTable();
    // Initialize with default config and load from config service
    this.loadConfigFromService();
  }

  /**
   * Load configuration from config service
   */
  private async loadConfigFromService(): Promise<void> {
    try {
      const slideConfig = await window.electronAPI.config.getSlideExtractionConfig();
      const newBaseInterval = slideConfig.checkInterval || 2000;

      // Rebuild interval table only if base interval changed
      if (this.baseCheckInterval !== newBaseInterval) {
        this.baseCheckInterval = newBaseInterval;
        this.buildIntervalTable(); // Rebuild entire table once
        console.log(`Base interval changed to ${newBaseInterval}ms, interval table rebuilt`);
      }

      this.config = {
        checkInterval: this.getIntervalForRate(this.currentPlaybackRate), // Direct table lookup
        enableDoubleVerification: slideConfig.enableDoubleVerification !== false,
        verificationCount: slideConfig.verificationCount || 2,
        hammingThresholdLow: slideConfig.hammingThresholdLow || 0,
        hammingThresholdUp: slideConfig.hammingThresholdUp || 5,
        ssimThreshold: slideConfig.ssimThreshold || 0.999
      };

      // Update worker configuration
      await slideProcessorService.updateConfig({
        hammingThresholdLow: this.config.hammingThresholdLow,
        hammingThresholdUp: this.config.hammingThresholdUp,
        ssimThreshold: this.config.ssimThreshold
      });

      console.log('Slide extraction config loaded:', this.config);
    } catch (error) {
      console.error('Failed to load slide extraction config:', error);
    }
  }

  /**
   * Build interval lookup table for all playback rates
   * Only called when base interval changes - much more efficient than per-call calculation
   */
  private buildIntervalTable(): void {
    this.intervalTable.clear();

    // Dynamic scaling factors for different playback rates
    // Higher rates get progressively smaller divisors to avoid excessive computation
    const scalingMap: { [key: number]: number } = {
      1: 1.0,    // 1x -> base interval
      2: 1.5,    // 2x -> base / 1.5
      3: 2.0,    // 3x -> base / 2.0
      4: 2.5,    // 4x -> base / 2.5
      5: 3.0,    // 5x -> base / 3.0
      6: 3.5,    // 6x -> base / 3.5
      7: 4.0,    // 7x -> base / 4.0
      8: 4.5,    // 8x -> base / 4.5
      9: 5.0,    // 9x -> base / 5.0
      10: 5.5    // 10x -> base / 5.5
    };

    // Pre-calculate intervals for all supported playback rates
    Object.keys(scalingMap).forEach(rateStr => {
      const rate = parseInt(rateStr);
      const scalingFactor = scalingMap[rate];
      const adjustedInterval = Math.round(this.baseCheckInterval / scalingFactor);

      // Ensure minimum interval of 200ms to prevent excessive computation
      const minInterval = 200;
      const finalInterval = Math.max(minInterval, adjustedInterval);

      this.intervalTable.set(rate, finalInterval);
    });

    console.log(`Interval table built for base=${this.baseCheckInterval}ms:`,
      Array.from(this.intervalTable.entries()).map(([rate, interval]) => `${rate}x=${interval}ms`).join(', '));
  }

  /**
   * Get interval for playback rate from pre-built table
   * Extremely fast O(1) lookup - no calculation needed
   */
  private getIntervalForRate(playbackRate: number): number {
    // Direct table lookup - no calculation
    const interval = this.intervalTable.get(playbackRate);

    if (interval !== undefined) {
      return interval;
    }

    // Fallback for unsupported rates (shouldn't happen in normal usage)
    console.warn(`Unsupported playback rate: ${playbackRate}x, using base interval`);
    return this.baseCheckInterval;
  }

  /**
   * Update playback rate and adjust check interval accordingly
   * Ultra-fast O(1) table lookup - no calculations needed
   */
  updatePlaybackRate(playbackRate: number): void {
    if (this.currentPlaybackRate === playbackRate) {
      return; // No change needed
    }

    const oldRate = this.currentPlaybackRate;
    const oldInterval = this.config.checkInterval;

    // Direct table lookup - no calculation needed!
    const newInterval = this.getIntervalForRate(playbackRate);

    // Only proceed if the interval actually changed
    if (newInterval === oldInterval) {
      // Update playback rate but no need to restart extraction
      this.currentPlaybackRate = playbackRate;
      console.log(`Playback rate changed: ${oldRate}x -> ${playbackRate}x, interval unchanged: ${newInterval}ms (no restart needed)`);
      return;
    }

    // Update both playback rate and interval
    this.currentPlaybackRate = playbackRate;
    this.config.checkInterval = newInterval;

    console.log(`Playback rate changed: ${oldRate}x -> ${playbackRate}x, interval: ${oldInterval}ms -> ${newInterval}ms (table lookup)`);

    // Only restart extraction if it's currently running and interval changed
    if (this.isRunning) {
      this.restartExtractionWithNewInterval();
    }
  }

  /**
   * Efficiently restart extraction with new interval
   * Minimizes downtime by quickly stopping and restarting
   */
  private restartExtractionWithNewInterval(): void {
    // Clear the current interval immediately
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }

    // Start new interval immediately without full stop/start cycle
    this.captureInterval = setInterval(() => {
      this.captureAndCompare();
    }, this.config.checkInterval);

    console.log(`Extraction interval updated to ${this.config.checkInterval}ms without full restart`);
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<SlideExtractionConfig>): Promise<void> {
    // Update base interval if checkInterval is provided
    if (newConfig.checkInterval !== undefined) {
      // Rebuild interval table only if base interval changed
      if (this.baseCheckInterval !== newConfig.checkInterval) {
        this.baseCheckInterval = newConfig.checkInterval;
        this.buildIntervalTable(); // Rebuild entire table once
        console.log(`Base interval updated to ${newConfig.checkInterval}ms, interval table rebuilt`);
      }
      // Get current interval from table lookup
      newConfig.checkInterval = this.getIntervalForRate(this.currentPlaybackRate);
    }

    this.config = { ...this.config, ...newConfig };

    // Update worker configuration if image processing params changed
    if (newConfig.hammingThresholdLow !== undefined ||
        newConfig.hammingThresholdUp !== undefined ||
        newConfig.ssimThreshold !== undefined) {
      try {
        await slideProcessorService.updateConfig({
          hammingThresholdLow: this.config.hammingThresholdLow,
          hammingThresholdUp: this.config.hammingThresholdUp,
          ssimThreshold: this.config.ssimThreshold
        });
      } catch (error) {
        console.error('Failed to update worker config:', error);
      }
    }

    // If running, restart with new configuration
    if (this.isRunning) {
      this.stopExtraction();
      setTimeout(() => {
        this.startExtraction();
      }, 100);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): SlideExtractionConfig {
    return { ...this.config };
  }

  /**
   * Start slide extraction
   */
  startExtraction(): boolean {
    if (this.isRunning) {
      console.warn('Slide extraction is already running');
      return false;
    }

    const video = this.getVideoElement();
    if (!video) {
      console.error('Video element not found');
      return false;
    }

    this.isRunning = true;
    this.resetVerificationState();

    console.log('Starting slide extraction with config:', this.config);

    // Start periodic capture
    this.captureInterval = setInterval(() => {
      this.captureAndCompare();
    }, this.config.checkInterval);

    return true;
  }

  /**
   * Stop slide extraction
   */
  stopExtraction(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }

    this.resetVerificationState();
    console.log('Slide extraction stopped');
  }

  /**
   * Get video element from the page
   */
  private getVideoElement(): HTMLVideoElement | null {
    // Try different selectors to find the video element
    const selectors = [
      'video',
      '#videoPlayer video',
      '.video-container video',
      '[data-video] video'
    ];

    for (const selector of selectors) {
      const video = document.querySelector(selector) as HTMLVideoElement;
      if (video && this.isVideoAccessible(video)) {
        return video;
      }
    }

    return null;
  }

  /**
   * Check if video element is accessible and ready
   */
  private isVideoAccessible(video: HTMLVideoElement): boolean {
    try {
      if (!video) return false;
      if (video.readyState < 2) return false; // HAVE_CURRENT_DATA
      if (video.videoWidth < 100) return false;
      if (video.videoHeight < 100) return false;
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Capture current frame and compare with previous
   */
  private async captureAndCompare(): Promise<void> {
    try {
      const video = this.getVideoElement();
      if (!video) {
        console.warn('Video element not available during capture');
        return;
      }

      // Capture current frame
      const imageData = this.captureFrame(video);
      if (!imageData) {
        console.warn('Failed to capture frame');
        return;
      }

      // First capture, save directly
      if (!this.lastImageData) {
        await this.saveSlide(imageData, `Slide 1`);
        this.lastImageData = imageData;
        return;
      }

      // Handle dual verification logic
      if (this.config.enableDoubleVerification && this.verificationState !== 'none') {
        await this.handleVerification(imageData);
      } else {
        await this.handleNewImage(imageData);
      }

    } catch (error) {
      console.error('Error in captureAndCompare:', error);
      if (this.verificationState === 'verifying') {
        this.resetVerificationState();
      }
    }
  }

  /**
   * Handle verification state
   */
  private async handleVerification(imageData: ImageData): Promise<void> {
    if (!this.potentialNewImageData) {
      console.error('potentialNewImageData is null during verification');
      this.resetVerificationState();
      return;
    }

    // Compare current image with potential new image
    const isStable = await slideProcessorService.compareImages(this.potentialNewImageData, imageData);

    if (isStable) {
      // Verification failed: new slide is not stable
      console.log('Verification failed, slide not stable');
      this.resetVerificationState();
    } else {
      // Verification passed
      this.currentVerification++;

      if (this.currentVerification < this.config.verificationCount) {
        console.log(`Verification ${this.currentVerification}/${this.config.verificationCount} passed`);
      } else {
        // All verifications passed, save slide
        const slideNumber = this.extractedSlides.length + 1;
        await this.saveSlide(this.potentialNewImageData, `Slide ${slideNumber}`);
        this.lastImageData = this.potentialNewImageData;
        this.resetVerificationState();
        console.log('All verifications passed, slide saved');
      }
    }
  }

  /**
   * Handle new image detection
   */
  private async handleNewImage(imageData: ImageData): Promise<void> {
    const hasChanged = await slideProcessorService.compareImages(this.lastImageData!, imageData);

    if (hasChanged) {
      if (this.config.enableDoubleVerification) {
        // Start dual verification
        this.verificationState = 'verifying';
        this.currentVerification = 0;
        this.potentialNewImageData = imageData;
        console.log('Change detected, starting verification...');
      } else {
        // Save directly
        const slideNumber = this.extractedSlides.length + 1;
        await this.saveSlide(imageData, `Slide ${slideNumber}`);
        this.lastImageData = imageData;
        console.log('Change detected, slide saved directly');
      }
    }
  }

  /**
   * Reset verification state
   */
  private resetVerificationState(): void {
    this.verificationState = 'none';
    this.currentVerification = 0;
    this.potentialNewImageData = null;
  }

  /**
   * Capture frame from video element
   */
  private captureFrame(video: HTMLVideoElement): ImageData | null {
    try {
      if (!video || video.readyState < 1) {
        return null;
      }

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        return null;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (!this.validateImageData(imageData)) {
        return null;
      }

      return imageData;
    } catch (error) {
      console.error('Error capturing frame:', error);
      return null;
    }
  }

  /**
   * Validate image data
   */
  private validateImageData(imageData: ImageData): boolean {
    if (!imageData || !imageData.data || imageData.data.length === 0) {
      return false;
    }

    if (imageData.width === 0 || imageData.height === 0) {
      return false;
    }

    // Check if image is completely black (sample center region)
    let nonZeroPixels = 0;
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    const sampleRadius = Math.min(50, Math.floor(Math.min(imageData.width, imageData.height) / 4));

    let sampleCount = 0;
    const maxSamples = 100;

    // Sample center region pixels
    for (let dy = -sampleRadius; dy <= sampleRadius && sampleCount < maxSamples; dy += 10) {
      for (let dx = -sampleRadius; dx <= sampleRadius && sampleCount < maxSamples; dx += 10) {
        const x = centerX + dx;
        const y = centerY + dy;

        if (x >= 0 && x < imageData.width && y >= 0 && y < imageData.height) {
          const index = (y * imageData.width + x) * 4;
          const r = imageData.data[index];
          const g = imageData.data[index + 1];
          const b = imageData.data[index + 2];

          sampleCount++;

          if (r > 0 || g > 0 || b > 0) {
            nonZeroPixels++;
            if (nonZeroPixels > 5) break; // Early exit with enough non-zero pixels
          }
        }
      }
    }

    return nonZeroPixels > 0;
  }

  /**
   * Save extracted slide
   */
  private async saveSlide(imageData: ImageData, title: string): Promise<void> {
    try {
      // Convert ImageData to canvas and generate data URL
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = imageData.width;
      canvas.height = imageData.height;
      ctx.putImageData(imageData, 0, 0);

      const dataUrl = canvas.toDataURL('image/png');
      const slide: ExtractedSlide = {
        id: `slide_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        title,
        timestamp: new Date().toISOString(),
        imageData,
        dataUrl
      };

      this.extractedSlides.push(slide);
      console.log(`Slide saved: ${title} (Total: ${this.extractedSlides.length})`);

      // Emit event for UI updates
      this.emitSlideExtracted(slide);

    } catch (error) {
      console.error('Error saving slide:', error);
    }
  }

  /**
   * Emit slide extracted event
   */
  private emitSlideExtracted(slide: ExtractedSlide): void {
    // Dispatch custom event for UI components to listen
    const event = new CustomEvent('slideExtracted', {
      detail: { slide, totalCount: this.extractedSlides.length }
    });
    window.dispatchEvent(event);
  }

  /**
   * Get all extracted slides
   */
  getExtractedSlides(): ExtractedSlide[] {
    return [...this.extractedSlides];
  }

  /**
   * Clear all extracted slides
   */
  clearSlides(): void {
    this.extractedSlides = [];
    console.log('All slides cleared');

    // Emit clear event
    const event = new CustomEvent('slidesCleared');
    window.dispatchEvent(event);
  }

  /**
   * Get extraction status
   */
  getStatus(): {
    isRunning: boolean;
    slideCount: number;
    verificationState: string;
    currentVerification: number;
    playbackRate: number;
    currentCheckInterval: number;
    baseCheckInterval: number;
  } {
    return {
      isRunning: this.isRunning,
      slideCount: this.extractedSlides.length,
      verificationState: this.verificationState,
      currentVerification: this.currentVerification,
      playbackRate: this.currentPlaybackRate,
      currentCheckInterval: this.config.checkInterval,
      baseCheckInterval: this.baseCheckInterval
    };
  }

  /**
   * Reload configuration from config service
   */
  async reloadConfig(): Promise<void> {
    await this.loadConfigFromService();
  }

  /**
   * Rebuild interval table manually
   * Useful for debugging or when base configuration changes
   */
  rebuildIntervalTable(): void {
    this.buildIntervalTable();
    console.log('Interval table manually rebuilt');
  }

  /**
   * Get interval table statistics for debugging
   */
  getIntervalTableStats(): {
    baseInterval: number;
    tableSize: number;
    entries: Array<{ rate: number; interval: number }>
  } {
    const entries: Array<{ rate: number; interval: number }> = [];
    this.intervalTable.forEach((interval, rate) => {
      entries.push({ rate, interval });
    });
    entries.sort((a, b) => a.rate - b.rate); // Sort by rate for readability

    return {
      baseInterval: this.baseCheckInterval,
      tableSize: this.intervalTable.size,
      entries
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopExtraction();
    this.extractedSlides = [];
    this.lastImageData = null;
    this.potentialNewImageData = null;
    this.intervalTable.clear();
  }
}

// Create singleton instance
export const slideExtractor = new SlideExtractor();