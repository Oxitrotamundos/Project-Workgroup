import { BadRequestException } from '@nestjs/common';
import { ProjectImportService } from './project-import.service';

describe('ProjectImportService topological ordering', () => {
  const svc = new ProjectImportService(
    {} as any, {} as any, {} as any, {} as any,
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
