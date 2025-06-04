import fs from 'fs';
import path from 'path';
import axios from 'axios';

interface Proxy {
  url: string;
  protocol: string;
  lastUsed: number;
  failureCount: number;
  successCount: number;
}

export class ProxyService {
  private static instance: ProxyService;
  private proxies: Proxy[] = [];
  private currentIndex = 0;
  private proxyFilePath: string;
  private lastUpdate: number = 0;
  private readonly UPDATE_INTERVAL = 1000 * 60 * 60; // 1 hour

  private constructor() {
    this.proxyFilePath = path.join(process.cwd(), 'data', 'proxies.json');
    this.loadProxies();
  }

  public static getInstance(): ProxyService {
    if (!ProxyService.instance) {
      ProxyService.instance = new ProxyService();
    }
    return ProxyService.instance;
  }

  private async loadProxies(): Promise<void> {
    try {
      if (fs.existsSync(this.proxyFilePath)) {
        const data = fs.readFileSync(this.proxyFilePath, 'utf-8');
        this.proxies = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading proxies:', error);
      this.proxies = [];
    }

    // Update proxies if needed
    if (this.shouldUpdateProxies()) {
      await this.updateProxyList();
    }
  }

  private shouldUpdateProxies(): boolean {
    return (
      this.proxies.length === 0 ||
      Date.now() - this.lastUpdate > this.UPDATE_INTERVAL
    );
  }

  private async updateProxyList(): Promise<void> {
    try {
      // Fetch from multiple free proxy sources
      const sources = [
        'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
        'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
        'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt'
      ];

      for (const source of sources) {
        const response = await axios.get(source, { timeout: 5000 });
        const proxyList = response.data
          .toString()
          .split('\n')
          .filter(Boolean)
          .map((proxy: string) => ({
            url: proxy.trim(),
            protocol: 'http',
            lastUsed: 0,
            failureCount: 0,
            successCount: 0
          }));

        this.proxies.push(...proxyList);
      }

      // Remove duplicates
      this.proxies = Array.from(new Set(this.proxies.map(p => JSON.stringify(p))))
        .map(p => JSON.parse(p));

      // Save to file
      const dir = path.dirname(this.proxyFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.proxyFilePath, JSON.stringify(this.proxies, null, 2));
      this.lastUpdate = Date.now();
    } catch (error) {
      console.error('Error updating proxy list:', error);
    }
  }

  public getNextProxy(): string | null {
    if (this.proxies.length === 0) {
      return null;
    }

    // Sort proxies by failure count (ascending) and success count (descending)
    this.proxies.sort((a, b) => {
      if (a.failureCount !== b.failureCount) {
        return a.failureCount - b.failureCount;
      }
      return b.successCount - a.successCount;
    });

    // Get the next proxy
    const proxy = this.proxies[this.currentIndex];
    proxy.lastUsed = Date.now();
    
    // Update index for next time
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;

    return `${proxy.protocol}://${proxy.url}`;
  }

  public reportSuccess(proxyUrl: string): void {
    const proxy = this.proxies.find(p => `${p.protocol}://${p.url}` === proxyUrl);
    if (proxy) {
      proxy.successCount++;
      this.saveProxies();
    }
  }

  public reportFailure(proxyUrl: string): void {
    const proxy = this.proxies.find(p => `${p.protocol}://${p.url}` === proxyUrl);
    if (proxy) {
      proxy.failureCount++;
      this.saveProxies();
    }
  }

  private saveProxies(): void {
    try {
      fs.writeFileSync(this.proxyFilePath, JSON.stringify(this.proxies, null, 2));
    } catch (error) {
      console.error('Error saving proxies:', error);
    }
  }
} 