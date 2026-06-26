import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjectService } from '../../services/projectService'
import type { CreateProjectData, UpdateProjectData } from '../../types/domain'

vi.mock('../../lib/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/apiClient')>()
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  }
})

import { apiClient, ApiError } from '../../lib/apiClient'
const mockApiClient = vi.mocked(apiClient)

const mockProjectData: CreateProjectData = {
  name: 'Test Project',
  description: 'A test project description',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  status: 'active',
  color: '#3B82F6',
  ownerId: 'user-1',
  members: ['user-1']
}

const mockProjectResponse = {
  id: 'project-1',
  name: 'Test Project',
  description: 'A test project description',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  status: 'active',
  color: '#3B82F6',
  ownerId: 'user-1',
  members: ['user-1'],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

describe('ProjectService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createProject', () => {
    it('debe crear un proyecto exitosamente', async () => {
      mockApiClient.post.mockResolvedValue({ ...mockProjectResponse, id: 'new-project-id' })

      const result = await ProjectService.createProject(mockProjectData)

      expect(mockApiClient.post).toHaveBeenCalledWith('/v1/projects', expect.objectContaining({
        name: mockProjectData.name,
        description: mockProjectData.description,
      }))
      expect(result).toBe('new-project-id')
    })

    it('debe manejar errores durante la creación', async () => {
      mockApiClient.post.mockRejectedValue(new Error('API error'))

      await expect(ProjectService.createProject(mockProjectData))
        .rejects.toThrow()
    })
  })

  describe('updateProject', () => {
    it('debe actualizar un proyecto exitosamente', async () => {
      mockApiClient.patch.mockResolvedValue(mockProjectResponse)

      const updates: UpdateProjectData = {
        name: 'Updated Project Name',
        description: 'Updated description'
      }

      await ProjectService.updateProject('project-1', updates)

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        '/v1/projects/project-1',
        updates
      )
    })

    it('debe manejar errores durante la actualización', async () => {
      mockApiClient.patch.mockRejectedValue(new Error('Update failed'))

      await expect(ProjectService.updateProject('project-1', { name: 'New Name' }))
        .rejects.toThrow('Update failed')
    })
  })

  describe('deleteProject', () => {
    it('debe eliminar un proyecto exitosamente', async () => {
      mockApiClient.delete.mockResolvedValue(undefined)

      await ProjectService.deleteProject('project-1')

      expect(mockApiClient.delete).toHaveBeenCalledWith('/v1/projects/project-1')
    })

    it('debe manejar errores durante la eliminación', async () => {
      mockApiClient.delete.mockRejectedValue(new Error('Delete failed'))

      await expect(ProjectService.deleteProject('project-1'))
        .rejects.toThrow('Delete failed')
    })
  })

  describe('getUserProjects', () => {
    it('debe obtener proyectos del usuario exitosamente', async () => {
      mockApiClient.get.mockResolvedValue({
        items: [mockProjectResponse, { ...mockProjectResponse, id: 'project-2', name: 'Project 2' }],
        nextCursor: null,
      })

      const result = await ProjectService.getUserProjects('user-1')

      expect(result.items).toHaveLength(2)
      expect(result.items[0].id).toBe('project-1')
      expect(result.hasMore).toBe(false)
    })

    it('debe manejar errores durante la consulta', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Query failed'))

      const result = await ProjectService.getUserProjects('user-1')

      expect(result).toEqual({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        hasMore: false
      })
    })
  })

  describe('getAllProjects', () => {
    it('debe obtener todos los proyectos para administradores', async () => {
      mockApiClient.get.mockResolvedValue({
        items: [mockProjectResponse, { ...mockProjectResponse, id: 'project-2' }],
        nextCursor: null,
      })

      const result = await ProjectService.getAllProjects()

      expect(result).toBeDefined()
      expect(result).toHaveProperty('items')
      expect(result.items).toHaveLength(2)
    })
  })

  describe('getProject', () => {
    it('debe obtener un proyecto por ID exitosamente', async () => {
      mockApiClient.get.mockResolvedValue(mockProjectResponse)

      const result = await ProjectService.getProject('project-1')

      expect(result).toEqual(expect.objectContaining({
        id: 'project-1',
        name: mockProjectResponse.name
      }))
    })

    it('debe retornar null si el proyecto no existe (404)', async () => {
      const err = new ApiError(404, 'NOT_FOUND', 'Not found')
      mockApiClient.get.mockRejectedValue(err)

      const result = await ProjectService.getProject('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('addMember', () => {
    it('debe agregar un miembro al proyecto exitosamente', async () => {
      mockApiClient.post.mockResolvedValue({})

      await ProjectService.addMember('project-1', 'user-2')

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/v1/projects/project-1/members',
        expect.objectContaining({ userId: 'user-2' })
      )
    })
  })

  describe('removeMember', () => {
    it('debe remover un miembro del proyecto exitosamente', async () => {
      mockApiClient.delete.mockResolvedValue(undefined)

      await ProjectService.removeMember('project-1', 'user-2')

      expect(mockApiClient.delete).toHaveBeenCalledWith('/v1/projects/project-1/members/user-2')
    })
  })

  describe('hasAccess', () => {
    it('debe verificar acceso correctamente', async () => {
      mockApiClient.get.mockResolvedValue(mockProjectResponse)

      const hasAccess = await ProjectService.hasAccess('project-1', 'user-2')

      expect(hasAccess).toBe(true)
    })

    it('debe denegar acceso cuando el API retorna error', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Not found'))

      const hasAccess = await ProjectService.hasAccess('non-existent', 'user-1')

      expect(hasAccess).toBe(false)
    })
  })
})
