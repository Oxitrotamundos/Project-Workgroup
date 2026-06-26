export declare class SearchUsersQueryDto {
    search?: string;
    limit?: number;
    cursor?: string;
}
export interface UserResponse {
    id: string;
    email: string;
    displayName: string;
    role: 'admin' | 'pm' | 'member';
    avatarUrl: string | null;
}
export interface PagedResponse<T> {
    items: T[];
    nextCursor: string | null;
}
