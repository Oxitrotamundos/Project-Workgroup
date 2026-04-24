import { IsIn, IsString } from 'class-validator';

export const TASK_LINK_TYPES = ['e2s', 's2s', 'e2e', 's2e'] as const;
export type TaskLinkType = (typeof TASK_LINK_TYPES)[number];

export class CreateTaskLinkDto {
  @IsString()
  sourceTaskId!: string;

  @IsString()
  targetTaskId!: string;

  @IsIn(TASK_LINK_TYPES)
  type!: TaskLinkType;
}

export interface TaskLinkResponse {
  id: string;
  projectId: string;
  sourceTaskId: string;
  targetTaskId: string;
  type: TaskLinkType;
  createdAt: string;
}
