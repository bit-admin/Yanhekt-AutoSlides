// How the main process reaches the Yanhekt API host (cbiz.yanhekt.cn): through
// the campus intranet when it is reachable, with the public host as fallback
// in every connection mode. Nothing in the app works without the API, so it
// never depends on the intranet being up.
//
// Shared by ApiClient and NotesService so the two cannot route differently.
import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { IntranetAgentPool, intranetRequest, isConnectionFailure, isUnsentFailure } from '@main/infra/intranetTransport';
import type { IntranetMappingService } from './intranetMappingService';

/** How long a read may wait on the intranet address before the public host is tried. */
const INTRANET_READ_TIMEOUT_MS = 4000;

export class CbizTransport {
  private agentPool: IntranetAgentPool | null = null;

  /** Without a mapping (tests, tools that never route) every request goes to the public host. */
  constructor(private intranetMapping?: IntranetMappingService) {
    if (intranetMapping) {
      this.agentPool = new IntranetAgentPool(intranetMapping);
      intranetMapping.on('interfaceIpChanged', () => this.agentPool?.reset());
    }
  }

  /**
   * Send one request. `config.url` is always the public URL.
   *
   * A read is retried on the public host after any connection failure, and is
   * given only a few seconds on the intranet first. A write is different: once
   * it may have reached the server, sending it again could apply it twice
   * (a second note, a second upload). So a write gets the full timeout, is
   * retried only when the connection was never made, and waits for the route
   * to be current before it starts.
   */
  async send<T = unknown>(config: AxiosRequestConfig & { url: string }): Promise<AxiosResponse<T>> {
    const mapping = this.intranetMapping;
    if (!mapping || !this.agentPool) return axios.request<T>(config);

    const isRead = (config.method ?? 'GET').toUpperCase() === 'GET';
    if (isRead) {
      void mapping.ensureFresh();
    } else {
      await mapping.ensureFresh();
    }
    if (!mapping.isApiViaIntranet()) return axios.request<T>(config);

    return intranetRequest<T>(config, {
      mapper: mapping,
      agents: this.agentPool.resolve(),
      publicFallback: true,
      fallbackWhen: isRead ? isConnectionFailure : isUnsentFailure,
      intranetTimeout: isRead ? INTRANET_READ_TIMEOUT_MS : undefined,
    });
  }
}
