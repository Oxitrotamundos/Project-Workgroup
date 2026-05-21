import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const CALENDAR_SCOPES = ['global', 'project'] as const;
export type CalendarScope = (typeof CALENDAR_SCOPES)[number];

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class WorkingDayPatternDto {
  @IsInt() @Min(0) @Max(6)
  weekday!: number;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional() @IsString() @Matches(TIME_REGEX, { message: 'dayStart must be HH:MM or HH:MM:SS' })
  dayStart?: string | null;

  @IsOptional() @IsString() @Matches(TIME_REGEX, { message: 'breakStart must be HH:MM or HH:MM:SS' })
  breakStart?: string | null;

  @IsOptional() @IsString() @Matches(TIME_REGEX, { message: 'breakEnd must be HH:MM or HH:MM:SS' })
  breakEnd?: string | null;

  @IsOptional() @IsString() @Matches(TIME_REGEX, { message: 'dayEnd must be HH:MM or HH:MM:SS' })
  dayEnd?: string | null;
}

export class HolidayDto {
  @IsDateString()
  date!: string;

  @IsString() @MinLength(1) @MaxLength(200)
  label!: string;

  @IsOptional() @IsBoolean()
  recurringYearly?: boolean;
}

export class UpsertCalendarDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  name?: string;

  @IsString() @MinLength(1) @MaxLength(80)
  timezone!: string;

  @IsArray() @ArrayMinSize(7) @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => WorkingDayPatternDto)
  patterns!: WorkingDayPatternDto[];

  @IsOptional() @IsArray() @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => HolidayDto)
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

export class ResolveCalendarQueryDto {
  @IsOptional() @IsIn(['inherited', 'override'])
  source?: 'inherited' | 'override';
}
