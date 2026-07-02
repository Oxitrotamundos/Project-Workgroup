// packages/mcp/src/smoke.spec.ts
import { describe, it, expect } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('mcp package scaffold', () => {
  it('exposes the package name', () => {
    expect(PACKAGE_NAME).toBe('@project-workgroup/mcp');
  });
});
