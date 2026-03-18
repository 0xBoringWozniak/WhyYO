export type HttpClientOptions = {
  baseUrl: string;
  headers?: Record<string, string>;
  timeoutMs: number;
  retries: number;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class HttpClient {
  constructor(private readonly options: HttpClientOptions) {}

  async get<T>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: "GET" });
  }

  async post<T>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: "POST" });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.options.retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
      try {
        const response = await fetch(`${this.options.baseUrl}${path}`, {
          ...init,
          headers: {
            "content-type": "application/json",
            ...(this.options.headers ?? {}),
            ...(init.headers ?? {}),
          },
          signal: controller.signal,
        });
        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          throw new Error(`HTTP ${response.status} for ${path}${errorBody ? ` :: ${errorBody}` : ""}`);
        }
        return (await response.json()) as T;
      } catch (error) {
        lastError = error;
        if (attempt < this.options.retries) {
          await sleep(250 * (attempt + 1));
        }
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Unknown HTTP error");
  }
}
