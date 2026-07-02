import { SummaryRecalculationService } from './summary-recalculation.service';

describe('SummaryRecalculationService', () => {
  it('exposes a recalculate method', () => {
    const svc = new SummaryRecalculationService({} as any);
    expect(typeof svc.recalculate).toBe('function');
  });
});
