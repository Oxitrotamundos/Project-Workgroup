import { describe, it, expect } from 'vitest';
import { formatProjectLine, formatTaskDetail } from './format';

describe('formatProjectLine', () => {
  it('appends a truncated description when present', () => {
    const line = formatProjectLine({
      id: '7', name: 'KTP', description: 'Roadmap Q2 con backlog inicial', status: 'active',
      startDate: '2026-04-01', endDate: '2026-08-01', ownerId: '1', color: '#fff',
      createdAt: '', updatedAt: '',
    } as any);
    expect(line).toContain('[7] KTP');
    expect(line).toContain('Roadmap Q2');
  });
  it('omits the description segment when null/empty', () => {
    const line = formatProjectLine({ id: '7', name: 'KTP', description: null, status: 'active', startDate: '2026-04-01', endDate: '2026-08-01', ownerId: '1', color: '#fff', createdAt: '', updatedAt: '' } as any);
    expect(line.endsWith('2026-08-01')).toBe(true);
  });
});

describe('formatTaskDetail', () => {
  it('renders dates as YYYY-MM-DD, not full ISO', () => {
    const text = formatTaskDetail({
      id: '12', name: 'App Check', type: 'task', status: 'completed', priority: 'high',
      startDate: '2026-05-26T03:00:00.000Z', endDate: '2026-05-28T09:00:00.000Z',
      progress: 100, assigneeId: null, tags: [],
    } as any);
    expect(text).toContain('2026-05-26→2026-05-28');
    expect(text).not.toContain('T03:00');
  });
});
