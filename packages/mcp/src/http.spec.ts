import { describe, it, expect, vi } from 'vitest';

const handleRequest = vi.fn().mockResolvedValue(undefined);
const connect = vi.fn().mockResolvedValue(undefined);
vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: vi.fn().mockImplementation(() => ({
    handleRequest,
    close: vi.fn(),
  })),
}));
vi.mock('./server', () => ({ buildServer: vi.fn(() => ({ connect, close: vi.fn() })) }));
vi.mock('./apiClient', () => ({ createApiClient: vi.fn((cfg) => ({ __cfg: cfg })) }));

import { handleMcpRequest } from './http';
import { createApiClient } from './apiClient';

describe('handleMcpRequest', () => {
  it('builds the client with the request token and delegates to the transport', async () => {
    const req: any = { on: vi.fn() };
    const res: any = { on: vi.fn() };
    await handleMcpRequest(req, res, { jsonrpc: '2.0' }, { baseUrl: 'http://x', token: 'jwt-abc' });
    expect(createApiClient).toHaveBeenCalledWith({ baseUrl: 'http://x', apiKey: 'jwt-abc' });
    expect(connect).toHaveBeenCalled();
    expect(handleRequest).toHaveBeenCalledWith(req, res, { jsonrpc: '2.0' });
  });
});
