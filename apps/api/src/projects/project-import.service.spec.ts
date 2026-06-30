import { BadRequestException } from '@nestjs/common';
import { ProjectImportService } from './project-import.service';

describe('ProjectImportService topological ordering', () => {
  const svc = new ProjectImportService(
    {} as any, {} as any, {} as any, {} as any, {} as any,
  );

  it('orders parents before children', () => {
    const order = svc.topoSortTasks([
      { ref: 'child', parentRef: 'root' } as any,
      { ref: 'root' } as any,
      { ref: 'grandchild', parentRef: 'child' } as any,
    ]);
    const positions = order.map((t) => t.ref);
    expect(positions.indexOf('root')).toBeLessThan(positions.indexOf('child'));
    expect(positions.indexOf('child')).toBeLessThan(
      positions.indexOf('grandchild'),
    );
  });

  it('rejects a duplicate ref', () => {
    expect(() =>
      svc.topoSortTasks([
        { ref: 'dup' } as any,
        { ref: 'dup' } as any,
      ]),
    ).toThrow(BadRequestException);
  });

  it('rejects an unknown parentRef', () => {
    expect(() =>
      svc.topoSortTasks([{ ref: 'a', parentRef: 'ghost' } as any]),
    ).toThrow(BadRequestException);
  });

  it('rejects a parent cycle', () => {
    expect(() =>
      svc.topoSortTasks([
        { ref: 'a', parentRef: 'b' } as any,
        { ref: 'b', parentRef: 'a' } as any,
      ]),
    ).toThrow(BadRequestException);
  });
});

describe('ProjectImportService.expandProjectBounds', () => {
  const svc = new ProjectImportService(
    {} as any, {} as any, {} as any, {} as any, {} as any,
  );

  it('keeps bounds when all tasks fit inside', () => {
    const r = svc.expandProjectBounds(
      new Date('2026-05-01'),
      new Date('2026-08-01'),
      [{ startDate: new Date('2026-06-01'), endDate: new Date('2026-06-10') }],
    );
    expect(r.startDate).toEqual(new Date('2026-05-01'));
    expect(r.endDate).toEqual(new Date('2026-08-01'));
  });

  it('widens both ends to cover out-of-range tasks', () => {
    const r = svc.expandProjectBounds(
      new Date('2026-05-01'),
      new Date('2026-08-01'),
      [
        { startDate: new Date('2026-04-15'), endDate: new Date('2026-06-10') },
        { startDate: new Date('2026-07-01'), endDate: new Date('2026-08-20') },
      ],
    );
    expect(r.startDate).toEqual(new Date('2026-04-15'));
    expect(r.endDate).toEqual(new Date('2026-08-20'));
  });
});
