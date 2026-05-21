import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskLinkService } from '../taskLinkService';
import type { CreateTaskLinkData } from '../../types/domain';

vi.mock('../../lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { apiClient } from '../../lib/apiClient';
const mockApiClient = vi.mocked(apiClient);

describe('TaskLinkService', () => {
  const mockProjectId = 'test-project-123';
  const mockSourceTaskId = 'source-task-123';
  const mockTargetTaskId = 'target-task-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateLinkCreation', () => {
    it('should return invalid for self-referencing link', async () => {
      const result = await TaskLinkService.validateLinkCreation(
        mockSourceTaskId,
        mockSourceTaskId,
        mockProjectId
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('enlace de una tarea a sí misma');
    });

    it('should return valid for different tasks', async () => {
      const result = await TaskLinkService.validateLinkCreation(
        mockSourceTaskId,
        mockTargetTaskId,
        mockProjectId
      );

      expect(result.valid).toBe(true);
    });
  });

  describe('createLink', () => {
    it('should validate data before creating', async () => {
      const invalidData: CreateTaskLinkData = {
        projectId: mockProjectId,
        sourceTaskId: mockSourceTaskId,
        targetTaskId: mockSourceTaskId, // Same as source - invalid
        type: 'e2s'
      };

      await expect(TaskLinkService.createLink(invalidData))
        .rejects
        .toThrow('enlace de una tarea a sí misma');
    });

    it('should create a valid link via API', async () => {
      mockApiClient.post.mockResolvedValue({ id: 'link-123', projectId: mockProjectId, sourceTaskId: mockSourceTaskId, targetTaskId: mockTargetTaskId, type: 'e2s', createdAt: '', updatedAt: '' });

      const validData: CreateTaskLinkData = {
        projectId: mockProjectId,
        sourceTaskId: mockSourceTaskId,
        targetTaskId: mockTargetTaskId,
        type: 'e2s'
      };

      const result = await TaskLinkService.createLink(validData);
      expect(result).toBe('link-123');
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const validData: CreateTaskLinkData = {
        projectId: mockProjectId,
        sourceTaskId: mockSourceTaskId,
        targetTaskId: mockTargetTaskId,
        type: 'e2s'
      };

      mockApiClient.post.mockRejectedValue(new Error('API connection error'));

      await expect(TaskLinkService.createLink(validData))
        .rejects
        .toThrow();
    });
  });

  describe('detectCircularDependency', () => {
    it('should always return false (server-side enforcement)', async () => {
      const result = await TaskLinkService.detectCircularDependency(
        mockProjectId,
        mockSourceTaskId,
        mockTargetTaskId
      );

      expect(result).toBe(false);
    });
  });
});
