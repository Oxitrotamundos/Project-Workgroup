import { apiClient } from '../lib/apiClient';
import type { UpsertCalendarDto, WorkingCalendarResponse } from '@project-workgroup/shared';

const DEFAULT_HOURS_PER_DAY = 8;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 32;
const GLOBAL_KEY = '__GLOBAL__';

type CacheEntry = {
  calendar: WorkingCalendarResponse;
  hoursPerDay: number;
  expiresAt: number;
};

class CalendarServiceImpl {
  private cache = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<WorkingCalendarResponse | null>>();

  async getForProject(projectId: string): Promise<WorkingCalendarResponse | null> {
    return this.fetchCached(projectId, () => apiClient.get<WorkingCalendarResponse>(`/v1/projects/${projectId}/calendar`));
  }

  async getGlobal(): Promise<WorkingCalendarResponse | null> {
    return this.fetchCached(GLOBAL_KEY, () => apiClient.get<WorkingCalendarResponse>('/v1/calendar/global'));
  }

  private async fetchCached(
    key: string,
    fetcher: () => Promise<WorkingCalendarResponse>,
  ): Promise<WorkingCalendarResponse | null> {
    const cached = this.peek(key);
    if (cached) return cached.calendar;

    const pending = this.inflight.get(key);
    if (pending) return pending;

    const promise = (async () => {
      try {
        const r = await fetcher();
        this.store(key, r);
        return r;
      } catch (e) {
        console.error('calendarService: error fetching calendar', key, e);
        return null;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, promise);
    return promise;
  }

  async getHoursPerDay(projectId: string): Promise<number> {
    const cal = await this.getForProject(projectId);
    return this.extractHoursPerDay(cal);
  }

  getHoursPerDaySync(projectId: string): number | null {
    const cached = this.peek(projectId);
    return cached ? cached.hoursPerDay : null;
  }

  async upsertForProject(projectId: string, dto: UpsertCalendarDto): Promise<WorkingCalendarResponse> {
    const r = await apiClient.patch<WorkingCalendarResponse>(`/v1/projects/${projectId}/calendar`, dto);
    this.store(projectId, r);
    return r;
  }

  async deleteProjectOverride(projectId: string): Promise<void> {
    await apiClient.delete(`/v1/projects/${projectId}/calendar`);
    this.cache.delete(projectId);
  }

  async upsertGlobal(dto: UpsertCalendarDto): Promise<WorkingCalendarResponse> {
    const r = await apiClient.patch<WorkingCalendarResponse>('/v1/calendar/global', dto);
    this.cache.clear();
    this.store(GLOBAL_KEY, r);
    return r;
  }

  invalidate(projectId?: string): void {
    if (projectId === undefined) {
      this.cache.clear();
    } else {
      this.cache.delete(projectId);
    }
  }

  private extractHoursPerDay(cal: WorkingCalendarResponse | null): number {
    if (!cal) return DEFAULT_HOURS_PER_DAY;
    const n = Number(cal.hoursPerDay);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_HOURS_PER_DAY;
  }

  private peek(projectId: string): CacheEntry | null {
    const e = this.cache.get(projectId);
    if (!e) return null;
    if (e.expiresAt < Date.now()) {
      this.cache.delete(projectId);
      return null;
    }
    return e;
  }

  private store(projectId: string, calendar: WorkingCalendarResponse): void {
    if (!this.cache.has(projectId) && this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(projectId, {
      calendar,
      hoursPerDay: this.extractHoursPerDay(calendar),
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }
}

export const calendarService = new CalendarServiceImpl();
export default calendarService;
