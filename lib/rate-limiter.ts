// Simple in-memory rate limiter to prevent YouTube bot detection
export class RateLimiter {
  private static requests: Map<string, number[]> = new Map();
  private static readonly WINDOW_SIZE_MS = 60000; // 1 minute
  private static readonly MAX_REQUESTS = 10; // Max 10 requests per minute per IP

  static isAllowed(clientId: string): boolean {
    const now = Date.now();
    const windowStart = now - this.WINDOW_SIZE_MS;

    // Get existing requests for this client
    const clientRequests = this.requests.get(clientId) || [];
    
    // Remove old requests outside the window
    const recentRequests = clientRequests.filter((timestamp: number) => timestamp > windowStart);
    
    // Check if under the limit
    if (recentRequests.length >= this.MAX_REQUESTS) {
      return false;
    }

    // Add current request and update the map
    recentRequests.push(now);
    this.requests.set(clientId, recentRequests);

    // Cleanup old entries periodically (every 100 requests)
    if (Math.random() < 0.01) {
      this.cleanup();
    }

    return true;
  }

  static getRemainingRequests(clientId: string): number {
    const now = Date.now();
    const windowStart = now - this.WINDOW_SIZE_MS;
    const clientRequests = this.requests.get(clientId) || [];
    const recentRequests = clientRequests.filter((timestamp: number) => timestamp > windowStart);
    return Math.max(0, this.MAX_REQUESTS - recentRequests.length);
  }

  static getResetTime(clientId: string): number {
    const clientRequests = this.requests.get(clientId) || [];
    if (clientRequests.length === 0) return 0;
    
    const oldestRequest = Math.min(...clientRequests);
    return oldestRequest + this.WINDOW_SIZE_MS;
  }

  private static cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.WINDOW_SIZE_MS;

    for (const [clientId, requests] of Array.from(this.requests.entries())) {
      const recentRequests = requests.filter((timestamp: number) => timestamp > windowStart);
      
      if (recentRequests.length === 0) {
        this.requests.delete(clientId);
      } else {
        this.requests.set(clientId, recentRequests);
      }
    }
  }
}

// Helper function to get client identifier from request
export function getClientId(request: Request): string {
  // Try to get real IP from headers (for reverse proxies)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  return forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown';
} 