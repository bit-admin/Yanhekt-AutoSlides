import { powerSaveBlocker } from 'electron';
import { createLogger } from '@main/infra/logger';
const log = createLogger('PowerManagement');

/**
 * Refcounted wrapper over Electron's single power-save blocker.
 *
 * Several independent consumers ask to keep the machine awake at once — every
 * playback tab, Web Capture, and the Settings "prevent system sleep" preference
 * — and each releases on its own schedule. The blocker therefore tracks the
 * *set of holders* and only stops when the last one releases; a single global
 * flag used to let tab A's pause put the machine to sleep under tab B.
 */
export class PowerManagementService {
  private blockerId: number | null = null;
  private readonly holders = new Set<string>();

  /**
   * Register `holderId` as needing the system awake and start the blocker if it
   * is not already running. Idempotent per holder.
   * @returns true when the blocker is active after the call
   */
  async preventSleep(holderId: string): Promise<boolean> {
    this.holders.add(holderId);
    if (this.blockerActive()) {
      log.debug(`Power save blocker already active; holder added: ${holderId} (${this.holders.size})`);
      return true;
    }

    try {
      // 'prevent-display-sleep' prevents both display and system sleep
      this.blockerId = powerSaveBlocker.start('prevent-display-sleep');
      log.debug(`Power save blocker started (id ${this.blockerId}) for holder: ${holderId}`);
      return true;
    } catch (error) {
      log.error('Failed to prevent system sleep:', error);
      this.blockerId = null;
      this.holders.delete(holderId);
      return false;
    }
  }

  /**
   * Release `holderId`; the blocker stops only when no holders remain.
   * Releasing an unknown holder is a no-op.
   * @returns true when the call completed without an Electron error
   */
  async allowSleep(holderId: string): Promise<boolean> {
    this.holders.delete(holderId);
    if (this.holders.size > 0) {
      log.debug(`Holder released: ${holderId}; ${this.holders.size} still preventing sleep`);
      return true;
    }
    return this.stopBlocker();
  }

  /** Whether sleep is currently being prevented (verified against Electron). */
  isPreventingSleep(): boolean {
    return this.blockerActive();
  }

  /** Snapshot of the holders currently keeping the system awake. */
  getHolders(): string[] {
    return [...this.holders];
  }

  /** Stop the blocker and forget every holder (service shutdown). */
  cleanup(): void {
    this.holders.clear();
    if (this.blockerId !== null) {
      this.stopBlocker();
      log.debug('Power save blocker cleaned up on service destruction');
    }
  }

  private blockerActive(): boolean {
    if (this.blockerId === null) return false;
    if (powerSaveBlocker.isStarted(this.blockerId)) return true;
    // Stopped externally — forget the stale id.
    this.blockerId = null;
    return false;
  }

  private stopBlocker(): boolean {
    if (this.blockerId === null) {
      log.debug('No active power save blocker to stop');
      return true;
    }
    try {
      powerSaveBlocker.stop(this.blockerId);
      log.debug(`Power save blocker stopped (id ${this.blockerId})`);
      this.blockerId = null;
      return true;
    } catch (error) {
      log.error('Failed to allow system sleep:', error);
      return false;
    }
  }
}
