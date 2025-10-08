import { powerSaveBlocker } from 'electron';

export class PowerManagementService {
  private blockerId: number | null = null;
  private isBlocking: boolean = false;

  /**
   * Prevent the system from going to sleep
   * @returns Promise<boolean> - true if successfully prevented sleep, false otherwise
   */
  async preventSleep(): Promise<boolean> {
    try {
      // If already blocking, don't create another blocker
      if (this.isBlocking && this.blockerId !== null) {
        console.log('System sleep is already being prevented');
        return true;
      }

      // Create a power save blocker to prevent system sleep
      // 'prevent-display-sleep' prevents both display and system sleep
      this.blockerId = powerSaveBlocker.start('prevent-display-sleep');
      this.isBlocking = true;

      console.log(`Power save blocker started with ID: ${this.blockerId}`);
      return true;
    } catch (error) {
      console.error('Failed to prevent system sleep:', error);
      this.blockerId = null;
      this.isBlocking = false;
      return false;
    }
  }

  /**
   * Allow the system to go to sleep again
   * @returns Promise<boolean> - true if successfully allowed sleep, false otherwise
   */
  async allowSleep(): Promise<boolean> {
    try {
      if (this.blockerId !== null && this.isBlocking) {
        // Stop the power save blocker
        powerSaveBlocker.stop(this.blockerId);
        console.log(`Power save blocker stopped with ID: ${this.blockerId}`);

        this.blockerId = null;
        this.isBlocking = false;
        return true;
      } else {
        console.log('No active power save blocker to stop');
        return true;
      }
    } catch (error) {
      console.error('Failed to allow system sleep:', error);
      return false;
    }
  }

  /**
   * Check if system sleep is currently being prevented
   * @returns boolean - true if sleep is being prevented, false otherwise
   */
  isPreventingSleep(): boolean {
    // Double-check with Electron's API if we have a blocker ID
    if (this.blockerId !== null) {
      const isActive = powerSaveBlocker.isStarted(this.blockerId);
      if (!isActive && this.isBlocking) {
        // Blocker was stopped externally, update our state
        this.isBlocking = false;
        this.blockerId = null;
      }
      return isActive;
    }
    return false;
  }

  /**
   * Get the current power save blocker ID
   * @returns number | null - the blocker ID if active, null otherwise
   */
  getBlockerId(): number | null {
    return this.blockerId;
  }

  /**
   * Cleanup method to ensure power save blocker is stopped when service is destroyed
   */
  cleanup(): void {
    if (this.blockerId !== null && this.isBlocking) {
      try {
        powerSaveBlocker.stop(this.blockerId);
        console.log('Power save blocker cleaned up on service destruction');
      } catch (error) {
        console.error('Error during power management service cleanup:', error);
      }
      this.blockerId = null;
      this.isBlocking = false;
    }
  }
}