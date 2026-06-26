export interface Edge {
    sourceTaskId: string;
    targetTaskId: string;
}
export declare function wouldCreateCycle(edges: Edge[], from: string, to: string): boolean;
