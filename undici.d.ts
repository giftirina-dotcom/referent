declare module "undici" {
  export function fetch(
    input: RequestInfo | URL,
    init?: RequestInit & { dispatcher?: unknown },
  ): Promise<Response>;

  export class Agent {
    constructor(options?: {
      connectTimeout?: number;
      headersTimeout?: number;
      bodyTimeout?: number;
    });
  }
}
