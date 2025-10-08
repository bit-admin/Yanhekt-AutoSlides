import { ConfigService } from './configService';

export interface IntranetMapping {
  type: 'single' | 'loadbalance';
  ip?: string;
  ips?: string[];
  strategy?: 'round_robin' | 'random' | 'first_available';
  currentIndex?: number;
}

export interface IntranetMappings {
  [domain: string]: IntranetMapping;
}

export class IntranetMappingService {
  private mappings: IntranetMappings;
  private enabled = false;
  private failedIPs: Map<string, { failedAt: number; domain: string; ip: string }> = new Map();
  private configService: ConfigService;

  constructor(configService: ConfigService) {
    this.configService = configService;

    // Default mappings
    this.mappings = {
      'cbiz.yanhekt.cn': {
        type: 'loadbalance',
        ips: ['10.0.34.22', '10.0.34.21'],
        strategy: 'round_robin',
        currentIndex: 0
      },
      // Live streaming servers with load balancing
      'clive8.yanhekt.cn': {
        type: 'loadbalance',
        ips: ['10.1.233.208', '10.1.233.201', '10.1.233.210', '10.1.233.207', '10.1.233.209', '10.1.233.206'],
        strategy: 'round_robin',
        currentIndex: 0
      },
      'clive9.yanhekt.cn': {
        type: 'loadbalance',
        ips: ['10.1.233.206', '10.1.233.207', '10.1.233.210', '10.1.233.208', '10.1.233.209', '10.1.233.201'],
        strategy: 'round_robin',
        currentIndex: 0
      },
      'clive10.yanhekt.cn': {
        type: 'loadbalance',
        ips: ['10.1.233.209', '10.1.233.208', '10.1.233.210', '10.1.233.207', '10.1.233.201', '10.1.233.206'],
        strategy: 'round_robin',
        currentIndex: 0
      },
      'clive11.yanhekt.cn': {
        type: 'loadbalance',
        ips: ['10.1.233.210', '10.1.233.207', '10.1.233.208', '10.1.233.209', '10.1.233.201', '10.1.233.206'],
        strategy: 'round_robin',
        currentIndex: 0
      },
      'clive12.yanhekt.cn': {
        type: 'loadbalance',
        ips: ['10.1.233.208', '10.1.233.209', '10.1.233.201', '10.1.233.206', '10.1.233.210', '10.1.233.207'],
        strategy: 'round_robin',
        currentIndex: 0
      },
      'clive13.yanhekt.cn': {
        type: 'loadbalance',
        ips: ['10.1.233.210', '10.1.233.207', '10.1.233.209', '10.1.233.206', '10.1.233.208', '10.1.233.201'],
        strategy: 'round_robin',
        currentIndex: 0
      },
      'clive14.yanhekt.cn': {
        type: 'single',
        ip: '10.0.34.207'
      },
      'clive15.yanhekt.cn': {
        type: 'single',
        ip: '10.0.34.208'
      },
      // Recorded video server
      'cvideo.yanhekt.cn': {
        type: 'single',
        ip: '10.0.34.24'
      }
    };

    this.init();
  }

  private init(): void {
    // Load settings from config
    this.enabled = this.configService.get('intranetMode', false) || false;
    const savedMappings = this.configService.get('intranetMappings', {}) || {};

    // Merge with defaults to ensure all default mappings are present
    this.mappings = { ...this.mappings, ...savedMappings };
  }

  /**
   * Enable or disable intranet mode
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.configService.set('intranetMode', enabled);
  }

  /**
   * Check if intranet mode is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get IP mapping for a specific domain (handles load balancing)
   */
  getMapping(domain: string): string | null {
    const mapping = this.mappings[domain];
    if (!mapping) return null;

    if (mapping.type === 'single') {
      return mapping.ip || null;
    } else if (mapping.type === 'loadbalance') {
      return this.getLoadBalancedIP(domain, mapping);
    }

    return null;
  }

  /**
   * Get load balanced IP using the specified strategy
   */
  private getLoadBalancedIP(domain: string, mapping: IntranetMapping): string | null {
    const { ips = [], strategy = 'round_robin' } = mapping;

    if (ips.length === 0) {
      console.warn(`No IPs available for load balancing domain: ${domain}`);
      return null;
    }

    // Filter out failed IPs
    const availableIPs = ips.filter(ip => !this.isIPFailed(ip));
    if (availableIPs.length === 0) {
      console.warn(`All IPs failed for domain: ${domain}, using original list`);
      // Reset failed IPs and use original list
      this.clearFailedIPs(domain);
      return this.selectIPByStrategy(ips, strategy, mapping);
    }

    return this.selectIPByStrategy(availableIPs, strategy, mapping);
  }

  /**
   * Select IP based on load balancing strategy
   */
  private selectIPByStrategy(ips: string[], strategy: string, mapping: IntranetMapping): string {
    switch (strategy) {
      case 'round_robin': {
        const currentIndex = mapping.currentIndex || 0;
        const ip = ips[currentIndex % ips.length];
        mapping.currentIndex = (currentIndex + 1) % ips.length;
        return ip;
      }

      case 'random':
        return ips[Math.floor(Math.random() * ips.length)];

      case 'first_available':
        return ips[0];

      default:
        console.warn(`Unknown load balancing strategy: ${strategy}, using round_robin`);
        return this.selectIPByStrategy(ips, 'round_robin', mapping);
    }
  }

  /**
   * Rewrite URL for intranet mode if enabled
   */
  rewriteUrl(url: string): string {
    if (!this.enabled) {
      return url;
    }

    try {
      const urlObj = new URL(url);
      const mappedIP = this.getMapping(urlObj.hostname);

      if (mappedIP) {
        urlObj.hostname = mappedIP;
        return urlObj.toString();
      }
    } catch (error) {
      console.error('Error rewriting URL:', error);
    }

    return url;
  }

  /**
   * Get the original host header for a URL
   */
  getOriginalHost(originalUrl: string): string | null {
    try {
      const urlObj = new URL(originalUrl);
      return urlObj.hostname;
    } catch (error) {
      console.error('Error parsing original URL:', error);
      return null;
    }
  }

  /**
   * Mark an IP as failed for health checking
   */
  markIPFailed(ip: string, domain: string): void {
    const key = `${domain}:${ip}`;
    this.failedIPs.set(key, {
      failedAt: Date.now(),
      domain: domain,
      ip: ip
    });
    console.warn(`Marked IP as failed: ${ip} for domain: ${domain}`);
  }

  /**
   * Check if an IP is marked as failed
   */
  private isIPFailed(ip: string): boolean {
    for (const [key, failInfo] of this.failedIPs.entries()) {
      if (failInfo.ip === ip) {
        // Auto-recover after 5 minutes
        if (Date.now() - failInfo.failedAt > 5 * 60 * 1000) {
          this.failedIPs.delete(key);
          console.log(`Auto-recovered failed IP: ${ip}`);
          return false;
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Clear failed IPs for a specific domain
   */
  private clearFailedIPs(domain: string): void {
    for (const [key, failInfo] of this.failedIPs.entries()) {
      if (failInfo.domain === domain) {
        this.failedIPs.delete(key);
      }
    }
    console.log(`Cleared failed IPs for domain: ${domain}`);
  }

  /**
   * Get network status information
   */
  getNetworkStatus(): { mode: string; enabled: boolean; mappingCount: number } {
    return {
      mode: this.enabled ? 'intranet' : 'internet',
      enabled: this.enabled,
      mappingCount: Object.keys(this.mappings).length
    };
  }

  /**
   * Get all intranet mappings for display purposes
   */
  getMappings(): IntranetMappings {
    return { ...this.mappings };
  }

  /**
   * Validate IP address format
   */
  private isValidIP(ip: string): boolean {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }
}