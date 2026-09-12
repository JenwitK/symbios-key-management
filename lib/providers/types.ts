export interface LinkProvider {
  id: string;
  /** Builds the URL to send the visitor to. */
  buildLink(token: string, destination: string): string;
  /** Server-to-server check with the provider. Never trust the client for this. */
  verify(hash: string, ip: string): Promise<{ ok: boolean; meta?: Record<string, unknown> }>;
}
