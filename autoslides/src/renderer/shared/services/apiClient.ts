import { overrides } from '../overrideRegistry'
import { createLogger } from '@shared/utils/logger';
const log = createLogger('ServicesApiClient');

import type { TokenVerificationResult, LiveListResponse, CourseListResponse, SubscriptionListResponse, CourseInfoResponse, SemesterOption } from '@common/apiTypes';
export type { UserData, TokenVerificationResult, LiveStream, LiveListResponse, CourseData, CourseListResponse, SubscriptionCourseRow, SubscriptionListResponse, SessionData, CourseInfoResponse, SemesterOption } from '@common/apiTypes';

// The data source ApiClient delegates to. Default = the real preload bridge;
// a registered `overrides.apiTransport` (demo mode) returns fabricated data of
// the same shape. ApiClient keeps the error handling around these calls.
export interface ApiTransport {
  verifyToken(token: string): Promise<TokenVerificationResult>;
  getPersonalLiveList(token: string, page?: number, pageSize?: number): Promise<LiveListResponse>;
  searchLiveList(token: string, keyword: string, page?: number, pageSize?: number): Promise<LiveListResponse>;
  getCourseList(token: string, options?: { semesters?: number[]; page?: number; pageSize?: number; keyword?: string }): Promise<CourseListResponse>;
  getPersonalCourseList(token: string, options?: { page?: number; pageSize?: number }): Promise<CourseListResponse>;
  getSubscriptionList(token: string, options?: { page?: number; pageSize?: number }): Promise<SubscriptionListResponse>;
  subscribeCourse(token: string, courseId: string): Promise<void>;
  unsubscribeCourse(token: string, courseId: string): Promise<void>;
  getCourseInfo(courseId: string, token: string): Promise<CourseInfoResponse>;
  getAvailableSemesters(): Promise<SemesterOption[]>;
}

const realApiTransport: ApiTransport = {
  verifyToken: (token) => window.electronAPI.auth.verifyToken(token),
  getPersonalLiveList: (token, page = 1, pageSize = 16) => window.electronAPI.api.getPersonalLiveList(token, page, pageSize),
  searchLiveList: (token, keyword, page = 1, pageSize = 16) => window.electronAPI.api.searchLiveList(token, keyword, page, pageSize),
  getCourseList: (token, options = {}) => window.electronAPI.api.getCourseList(token, options),
  getPersonalCourseList: (token, options = {}) => window.electronAPI.api.getPersonalCourseList(token, options),
  getSubscriptionList: (token, options = {}) => window.electronAPI.api.getSubscriptionList(token, options),
  subscribeCourse: (token, courseId) => window.electronAPI.api.subscribeCourse(token, courseId),
  unsubscribeCourse: (token, courseId) => window.electronAPI.api.unsubscribeCourse(token, courseId),
  getCourseInfo: (courseId, token) => window.electronAPI.api.getCourseInfo(courseId, token),
  getAvailableSemesters: () => window.electronAPI.api.getAvailableSemesters(),
};

export class ApiClient {
  // Resolved lazily per call so an override registered after construction (and
  // after this module is first imported) is still honored.
  private get transport(): ApiTransport {
    return overrides.apiTransport ?? realApiTransport;
  }

  async verifyToken(token: string): Promise<TokenVerificationResult> {
    try {
      return await this.transport.verifyToken(token);
    } catch (error) {
      log.error('Token verification error:', error);
      return { valid: false, userData: null, networkError: false };
    }
  }

  async getPersonalLiveList(token: string, page = 1, pageSize = 16): Promise<LiveListResponse> {
    try {
      return await this.transport.getPersonalLiveList(token, page, pageSize);
    } catch (error) {
      log.error('Failed to get personal live list:', error);
      throw error;
    }
  }

  async searchLiveList(token: string, keyword: string, page = 1, pageSize = 16): Promise<LiveListResponse> {
    try {
      return await this.transport.searchLiveList(token, keyword, page, pageSize);
    } catch (error) {
      log.error('Failed to search live list:', error);
      throw error;
    }
  }

  // Record mode API functions
  async getCourseList(token: string, options: {
    semesters?: number[];
    page?: number;
    pageSize?: number;
    keyword?: string;
  } = {}): Promise<CourseListResponse> {
    try {
      return await this.transport.getCourseList(token, options);
    } catch (error) {
      log.error('Failed to get course list:', error);
      throw error;
    }
  }

  async getPersonalCourseList(token: string, options: {
    page?: number;
    pageSize?: number;
  } = {}): Promise<CourseListResponse> {
    try {
      return await this.transport.getPersonalCourseList(token, options);
    } catch (error) {
      log.error('Failed to get personal course list:', error);
      throw error;
    }
  }

  async getSubscriptionList(token: string, options: {
    page?: number;
    pageSize?: number;
  } = {}): Promise<SubscriptionListResponse> {
    try {
      return await this.transport.getSubscriptionList(token, options);
    } catch (error) {
      log.error('Failed to get subscription list:', error);
      throw error;
    }
  }

  async subscribeCourse(token: string, courseId: string): Promise<void> {
    try {
      await this.transport.subscribeCourse(token, courseId);
    } catch (error) {
      log.error('Failed to subscribe course:', error);
      throw error;
    }
  }

  async unsubscribeCourse(token: string, courseId: string): Promise<void> {
    try {
      await this.transport.unsubscribeCourse(token, courseId);
    } catch (error) {
      log.error('Failed to unsubscribe course:', error);
      throw error;
    }
  }

  async getCourseInfo(courseId: string, token: string): Promise<CourseInfoResponse> {
    try {
      return await this.transport.getCourseInfo(courseId, token);
    } catch (error) {
      log.error('Failed to get course info:', error);
      throw error;
    }
  }

  async getAvailableSemesters(): Promise<SemesterOption[]> {
    try {
      return await this.transport.getAvailableSemesters();
    } catch (error) {
      log.error('Failed to get available semesters:', error);
      throw error;
    }
  }
}