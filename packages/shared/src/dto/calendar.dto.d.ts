export declare const CALENDAR_SCOPES: readonly ["global", "project"];
export type CalendarScope = (typeof CALENDAR_SCOPES)[number];
export declare class WorkingDayPatternDto {
    weekday: number;
    enabled: boolean;
    dayStart?: string | null;
    breakStart?: string | null;
    breakEnd?: string | null;
    dayEnd?: string | null;
}
export declare class HolidayDto {
    date: string;
    label: string;
    recurringYearly?: boolean;
}
export declare class UpsertCalendarDto {
    name?: string;
    timezone: string;
    patterns: WorkingDayPatternDto[];
    holidays?: HolidayDto[];
}
export interface WorkingDayPatternResponse {
    weekday: number;
    enabled: boolean;
    dayStart: string | null;
    breakStart: string | null;
    breakEnd: string | null;
    dayEnd: string | null;
}
export interface HolidayResponse {
    date: string;
    label: string;
    recurringYearly: boolean;
}
export interface WorkingCalendarResponse {
    id: string;
    scope: CalendarScope;
    projectId: string | null;
    name: string;
    timezone: string;
    patterns: WorkingDayPatternResponse[];
    holidays: HolidayResponse[];
    hoursPerDay: string;
    createdAt: string;
    updatedAt: string;
}
export declare class ResolveCalendarQueryDto {
    source?: 'inherited' | 'override';
}
