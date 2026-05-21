export interface CycleEdge {
  sourceTaskId: string;
  targetTaskId: string;
}

export function wouldCreateCycle(edges: CycleEdge[], from: string, to: string): boolean {
  const adj = new Map<string, Set<string>>();

  const addEdge = (src: string, dst: string) => {
    if (!adj.has(src)) adj.set(src, new Set());
    adj.get(src)!.add(dst);
  };

  for (const e of edges) {
    addEdge(e.sourceTaskId, e.targetTaskId);
  }
  addEdge(from, to);

  const visited = new Set<string>();
  const stack = [to];

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === from) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    const neighbors = adj.get(node);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }
  }

  return false;
}
