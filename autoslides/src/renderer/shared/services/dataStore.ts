import type { LiveStream, SessionData } from './apiClient'

export interface StreamData extends LiveStream {
  // Additional metadata for playback
  timestamp?: number;
  checksum?: string;
}

export interface SessionDataWithMeta extends SessionData {
  // Additional metadata for playback
  timestamp?: number;
  checksum?: string;
  // Course information for complete context
  courseInfo?: {
    id: string;
    title: string;
    instructor: string;
    time: string;
    classrooms?: { name: string }[];
    college_name?: string;
    participant_count?: number;
    professors?: string[];
    school_year?: string;
    semester?: string;
  };
}

export class DataStore {
  private static readonly STREAM_PREFIX = 'stream_';
  private static readonly SESSION_PREFIX = 'session_';

  // Store stream data for playback
  static setStreamData(streamId: string, data: StreamData): void {
    const key = this.STREAM_PREFIX + streamId;
    const dataWithTimestamp = {
      ...data,
      timestamp: Date.now(),
      checksum: this.generateChecksum(streamId)
    };
    localStorage.setItem(key, JSON.stringify(dataWithTimestamp));
  }

  // Retrieve stream data for playback
  static getStreamData(streamId: string): StreamData | null {
    const key = this.STREAM_PREFIX + streamId;
    const stored = localStorage.getItem(key);

    if (!stored) {
      return null;
    }

    try {
      const data = JSON.parse(stored) as StreamData;

      // Verify checksum for basic integrity
      if (data.checksum !== this.generateChecksum(streamId)) {
        console.warn('Stream data checksum mismatch, removing corrupted data');
        this.removeStreamData(streamId);
        return null;
      }

      // Check if data is not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      if (data.timestamp && (Date.now() - data.timestamp) > maxAge) {
        console.warn('Stream data expired, removing old data');
        this.removeStreamData(streamId);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to parse stream data:', error);
      this.removeStreamData(streamId);
      return null;
    }
  }

  // Remove stream data
  static removeStreamData(streamId: string): void {
    const key = this.STREAM_PREFIX + streamId;
    localStorage.removeItem(key);
  }

  // Store session data for playback
  static setSessionData(sessionId: string, data: SessionData): void {
    const key = this.SESSION_PREFIX + sessionId;
    const dataWithTimestamp: SessionDataWithMeta = {
      ...data,
      timestamp: Date.now(),
      checksum: this.generateChecksum(sessionId)
    };
    localStorage.setItem(key, JSON.stringify(dataWithTimestamp));
  }

  // Store session data with course information for complete context
  static setSessionDataWithCourse(sessionId: string, data: SessionData, courseInfo: {
    id: string;
    title: string;
    instructor: string;
    time: string;
    classrooms?: { name: string }[];
    college_name?: string;
    participant_count?: number;
    professors?: string[];
    school_year?: string;
    semester?: string;
  }): void {
    const key = this.SESSION_PREFIX + sessionId;
    const dataWithTimestamp: SessionDataWithMeta = {
      ...data,
      timestamp: Date.now(),
      checksum: this.generateChecksum(sessionId),
      courseInfo: courseInfo
    };
    localStorage.setItem(key, JSON.stringify(dataWithTimestamp));
  }

  // Retrieve session data for playback
  static getSessionData(sessionId: string): SessionDataWithMeta | null {
    const key = this.SESSION_PREFIX + sessionId;
    const stored = localStorage.getItem(key);

    if (!stored) {
      return null;
    }

    try {
      const data = JSON.parse(stored) as SessionDataWithMeta;

      // Verify checksum for basic integrity
      if (data.checksum !== this.generateChecksum(sessionId)) {
        console.warn('Session data checksum mismatch, removing corrupted data');
        this.removeSessionData(sessionId);
        return null;
      }

      // Check if data is not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      if (data.timestamp && (Date.now() - data.timestamp) > maxAge) {
        console.warn('Session data expired, removing old data');
        this.removeSessionData(sessionId);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to parse session data:', error);
      this.removeSessionData(sessionId);
      return null;
    }
  }

  // Remove session data
  static removeSessionData(sessionId: string): void {
    const key = this.SESSION_PREFIX + sessionId;
    localStorage.removeItem(key);
  }

  // Clean up old stream and session data
  static cleanupOldData(): void {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(this.STREAM_PREFIX) || key.startsWith(this.SESSION_PREFIX))) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const data = JSON.parse(stored);
            if (data.timestamp && (now - data.timestamp) > maxAge) {
              localStorage.removeItem(key);
              i--; // Adjust index since we removed an item
            }
          }
        } catch (_error) {
          // Remove corrupted data
          localStorage.removeItem(key);
          i--; // Adjust index since we removed an item
        }
      }
    }
  }

  // Generate simple checksum for data integrity
  private static generateChecksum(streamId: string): string {
    let hash = 0;
    const str = streamId + 'autoslides-secret';
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Generate URL parameters for navigation
  static generateStreamParams(streamId: string): URLSearchParams {
    const params = new URLSearchParams({
      streamId: streamId,
      timestamp: Date.now().toString(),
      checksum: this.generateChecksum(streamId)
    });
    return params;
  }

  // Validate URL parameters
  static validateStreamParams(params: URLSearchParams): boolean {
    const streamId = params.get('streamId');
    const checksum = params.get('checksum');

    if (!streamId || !checksum) {
      return false;
    }

    return checksum === this.generateChecksum(streamId);
  }
}

// Initialize cleanup on module load
DataStore.cleanupOldData();