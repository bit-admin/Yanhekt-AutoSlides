/**
 * SlideExtractionManager
 *
 * Owns the multi-instance registry for SlideExtractionPipelines. Each unique
 * key (mode + optional instanceId) maps to one long-lived pipeline that can be
 * started/stopped repeatedly via `run()`.
 *
 * Moved here from the bottom of the original slideExtractor.ts god-class.
 */

import { SlideExtractionPipeline } from './pipeline';
import type {
  SlideExtractionAdapter,
  SlideExtractionHandle,
  SlideExtractionInput,
  SlideExtractionMode,
} from './types';

export class SlideExtractionManager {
  private static instance: SlideExtractionManager | null = null;
  private pipelines = new Map<string, SlideExtractionPipeline>();

  private constructor() {
    // Singleton.
  }

  static getInstance(): SlideExtractionManager {
    if (!SlideExtractionManager.instance) {
      SlideExtractionManager.instance = new SlideExtractionManager();
    }
    return SlideExtractionManager.instance;
  }

  /**
   * Get or create a pipeline for the given mode/instanceId.
   * Use when you need a stable reference but are not ready to start a run yet.
   */
  getPipeline(mode: SlideExtractionMode, instanceId?: string): SlideExtractionPipeline {
    const key = instanceId ?? mode;
    let pipeline = this.pipelines.get(key);
    if (!pipeline) {
      pipeline = new SlideExtractionPipeline(mode, instanceId);
      this.pipelines.set(key, pipeline);
      console.log(`Created new SlideExtractionPipeline instance: ${key}`);
    }
    return pipeline;
  }

  /**
   * Resolve the pipeline for the given input and start a run on it.
   * Returns the started handle, or null if the run could not start.
   */
  async run(input: SlideExtractionInput, adapter: SlideExtractionAdapter = {}): Promise<SlideExtractionHandle | null> {
    const pipeline = this.getPipeline(input.mode, input.instanceId);
    const started = await pipeline.run(input, adapter);
    return started ? pipeline : null;
  }

  remove(instanceId: string): void {
    const pipeline = this.pipelines.get(instanceId);
    if (pipeline) {
      pipeline.destroy();
      this.pipelines.delete(instanceId);
      console.log(`Removed SlideExtractionPipeline instance: ${instanceId}`);
    }
  }

  getAll(): SlideExtractionPipeline[] {
    return Array.from(this.pipelines.values());
  }

  getByMode(mode: SlideExtractionMode): SlideExtractionPipeline[] {
    return Array.from(this.pipelines.values()).filter(p => p.mode === mode);
  }

  stopAll(): void {
    this.pipelines.forEach(p => p.stop());
  }

  destroyAll(): void {
    this.pipelines.forEach(p => p.destroy());
    this.pipelines.clear();
  }
}

export const slideExtractionManager = SlideExtractionManager.getInstance();
