// packages/shared/src/dto/project-import.dto.spec.ts
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ImportProjectDto } from './project-import.dto';

function makeValid() {
  return {
    project: {
      name: 'KTP Q2',
      startDate: '2026-05-14',
      endDate: '2026-08-01',
      status: 'active',
      color: '#3b82f6',
    },
    tasks: [
      {
        ref: 'sec',
        name: 'Seguridad',
        type: 'summary',
        startDate: '2026-05-26',
        endDate: '2026-05-30',
        priority: 'high',
        status: 'completed',
        color: '#10b981',
      },
    ],
    dependencies: [],
  };
}

describe('ImportProjectDto', () => {
  it('accepts a well-formed plan', () => {
    const dto = plainToInstance(ImportProjectDto, makeValid());
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects an empty tasks array', () => {
    const bad = { ...makeValid(), tasks: [] };
    const dto = plainToInstance(ImportProjectDto, bad);
    expect(validateSync(dto).length).toBeGreaterThan(0);
  });

  it('rejects an invalid dependency type', () => {
    const bad = {
      ...makeValid(),
      dependencies: [{ fromRef: 'a', toRef: 'b', type: 'x2y' }],
    };
    const dto = plainToInstance(ImportProjectDto, bad);
    expect(validateSync(dto).length).toBeGreaterThan(0);
  });
});
