import { wouldCreateCycle, Edge } from './cycle-detector';

describe('cycle-detector', () => {
  it('returns false for a simple non-cyclic edge', () => {
    const edges: Edge[] = [];
    expect(wouldCreateCycle(edges, 'A', 'B')).toBe(false);
  });

  it('returns false for a chain A→B→C with new edge A→C', () => {
    const edges: Edge[] = [
      { sourceTaskId: 'A', targetTaskId: 'B' },
      { sourceTaskId: 'B', targetTaskId: 'C' },
    ];
    expect(wouldCreateCycle(edges, 'A', 'C')).toBe(false);
  });

  it('detects direct cycle A→B then B→A', () => {
    const edges: Edge[] = [{ sourceTaskId: 'A', targetTaskId: 'B' }];
    expect(wouldCreateCycle(edges, 'B', 'A')).toBe(true);
  });

  it('detects indirect cycle A→B→C then C→A', () => {
    const edges: Edge[] = [
      { sourceTaskId: 'A', targetTaskId: 'B' },
      { sourceTaskId: 'B', targetTaskId: 'C' },
    ];
    expect(wouldCreateCycle(edges, 'C', 'A')).toBe(true);
  });

  it('detects self-loop A→A', () => {
    const edges: Edge[] = [];
    expect(wouldCreateCycle(edges, 'A', 'A')).toBe(true);
  });

  it('does not flag a new edge in a separate component', () => {
    const edges: Edge[] = [
      { sourceTaskId: 'A', targetTaskId: 'B' },
      { sourceTaskId: 'C', targetTaskId: 'D' },
    ];
    expect(wouldCreateCycle(edges, 'D', 'A')).toBe(false);
  });

  it('detects cycle in longer chain', () => {
    const edges: Edge[] = [
      { sourceTaskId: '1', targetTaskId: '2' },
      { sourceTaskId: '2', targetTaskId: '3' },
      { sourceTaskId: '3', targetTaskId: '4' },
    ];
    expect(wouldCreateCycle(edges, '4', '1')).toBe(true);
  });
});
