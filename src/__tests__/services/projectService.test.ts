import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjectService } from '../../services/projectService'
import type { CreateProjectData, UpdateProjectData } from '../../types/firestore'

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn(),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
    fromDate: vi.fn((date: Date) => ({ toDate: () => date }))
  }
}))

vi.mock('../../config/firebase', () => ({
  db: {}
}))

import * as firebase from 'firebase/firestore'

const mockFirestore = vi.mocked(firebase)

// Mock data
const mockProjectData: CreateProjectData = {
  name: 'Test Project',
  description: 'A test project description',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  status: 'active',
  color: '#3B82F6',
  ownerId: 'user-1',
  members: ['user-1']
}

const mockProject = {
  id: 'project-1',
  ...mockProjectData,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
}

// Mock respuestas Firestore
const createMockDocRef = (id: string) => ({
  id,
  path: `projects/${id}`,
  converter: null,
  type: 'document',
  firestore: {},
  parent: {},
  withConverter: vi.fn(),
  isEqual: vi.fn(() => false)
} as any)

const createMockQuerySnapshot = (docs: any[]) => ({
  docs: docs.map(doc => ({
    id: doc.id,
    data: () => ({
      ...doc.data,
      createdAt: { toDate: () => doc.data?.createdAt || new Date() },
      updatedAt: { toDate: () => doc.data?.updatedAt || new Date() },
      startDate: { toDate: () => doc.data?.startDate || new Date() },
      endDate: { toDate: () => doc.data?.endDate || new Date() }
    }),
    exists: () => true
  })),
  empty: docs.length === 0,
  size: docs.length,
  metadata: { hasPendingWrites: false, fromCache: false },
  query: {},
  forEach: vi.fn(),
  docChanges: vi.fn(() => []),
  toJSON: vi.fn()
} as any)

const createMockDocSnapshot = (data: any, exists = true) => ({
  id: data?.id || 'test-id',
  data: () => ({
    ...data,
    createdAt: { toDate: () => data?.createdAt || new Date() },
    updatedAt: { toDate: () => data?.updatedAt || new Date() },
    startDate: { toDate: () => data?.startDate || new Date() },
    endDate: { toDate: () => data?.endDate || new Date() }
  }),
  exists: () => exists,
  metadata: { hasPendingWrites: false, fromCache: false },
  get: vi.fn(),
  toJSON: vi.fn(),
  ref: {}
} as any)

describe('ProjectService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Configurar mocks por defecto
    mockFirestore.getFirestore.mockReturnValue({} as any)
    mockFirestore.collection.mockReturnValue({} as any)
    mockFirestore.doc.mockReturnValue({} as any)
    mockFirestore.query.mockReturnValue({} as any)
    mockFirestore.where.mockReturnValue({} as any)
    mockFirestore.orderBy.mockReturnValue({} as any)
    mockFirestore.limit.mockReturnValue({} as any)
    mockFirestore.arrayUnion.mockImplementation((...items) => ({ 
      arrayUnion: items,
      isEqual: vi.fn(() => false)
    }))
    mockFirestore.arrayRemove.mockImplementation((...items) => ({ 
      arrayRemove: items,
      isEqual: vi.fn(() => false)
    }))
  })

  describe('createProject', () => {
    it('debe crear un proyecto exitosamente', async () => {
      const mockDocRef = createMockDocRef('new-project-id')
      mockFirestore.addDoc.mockResolvedValue(mockDocRef)
      
      const result = await ProjectService.createProject(mockProjectData)
      
      expect(mockFirestore.addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: mockProjectData.name,
          description: mockProjectData.description,
          ownerId: mockProjectData.ownerId,
          members: mockProjectData.members,
          status: mockProjectData.status,
          color: mockProjectData.color
        })
      )
      
      expect(result).toBe('new-project-id')
    })

    it('debe manejar errores durante la creación', async () => {
      const error = new Error('Firestore error')
      mockFirestore.addDoc.mockRejectedValue(error)
      
      await expect(ProjectService.createProject(mockProjectData))
        .rejects.toThrow('Error al crear el proyecto')
    })

    it('debe incluir timestamps en el proyecto creado', async () => {
      const mockDocRef = createMockDocRef('new-project-id')
      mockFirestore.addDoc.mockResolvedValue(mockDocRef)
      
      await ProjectService.createProject(mockProjectData)
      
      expect(mockFirestore.addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          createdAt: expect.anything(),
          updatedAt: expect.anything()
        })
      )
    })
  })

  describe('updateProject', () => {
    it('debe actualizar un proyecto exitosamente', async () => {
      mockFirestore.updateDoc.mockResolvedValue(undefined)
      
      const updates: UpdateProjectData = {
        name: 'Updated Project Name',
        description: 'Updated description'
      }
      
      await ProjectService.updateProject('project-1', updates)
      
      expect(mockFirestore.updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          ...updates,
          updatedAt: expect.anything()
        })
      )
    })

    it('debe manejar errores durante la actualización', async () => {
      const error = new Error('Update failed')
      mockFirestore.updateDoc.mockRejectedValue(error)
      
      await expect(ProjectService.updateProject('project-1', { name: 'New Name' }))
        .rejects.toThrow('Error al actualizar el proyecto')
    })
  })

  describe('deleteProject', () => {
    it('debe eliminar un proyecto exitosamente', async () => {
      mockFirestore.deleteDoc.mockResolvedValue(undefined)
      
      await ProjectService.deleteProject('project-1')
      
      expect(mockFirestore.deleteDoc).toHaveBeenCalledWith(expect.anything())
    })

    it('debe manejar errores durante la eliminación', async () => {
      const error = new Error('Delete failed')
      mockFirestore.deleteDoc.mockRejectedValue(error)
      
      await expect(ProjectService.deleteProject('project-1'))
        .rejects.toThrow('Error al eliminar el proyecto')
    })
  })

  describe('getUserProjects', () => {
    it('debe obtener proyectos del usuario exitosamente', async () => {
      const mockQuerySnapshot = createMockQuerySnapshot([
        { id: 'project-1', data: mockProject },
        { id: 'project-2', data: { ...mockProject, id: 'project-2', name: 'Project 2' } }
      ])
      
      mockFirestore.getDocs.mockResolvedValue(mockQuerySnapshot)
      
      const result = await ProjectService.getUserProjects('user-1')
      
      expect(result.items).toHaveLength(2)
      expect(result.items[0].id).toBe('project-1')
      expect(result.hasMore).toBe(false)
      expect(mockFirestore.where).toHaveBeenCalledWith('members', 'array-contains', 'user-1')
    })

    it('debe manejar paginación correctamente', async () => {
      const mockQuerySnapshot = createMockQuerySnapshot(
        Array.from({ length: 10 }, (_, i) => ({
          id: `project-${i}`,
          data: { ...mockProject, id: `project-${i}`, name: `Project ${i}` }
        }))
      )
      
      mockFirestore.getDocs.mockResolvedValue(mockQuerySnapshot)
      
      const result = await ProjectService.getUserProjects('user-1', undefined, 10)
      
      expect(result.items).toHaveLength(10)
      expect(result.hasMore).toBe(false)
    })

    it('debe manejar errores durante la consulta', async () => {
      const error = new Error('Query failed')
      mockFirestore.getDocs.mockRejectedValue(error)
      
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
      const mockQuerySnapshot = createMockQuerySnapshot([
        { id: 'project-1', data: mockProject },
        { id: 'project-2', data: { ...mockProject, id: 'project-2' } }
      ])
      
      mockFirestore.getDocs.mockResolvedValue(mockQuerySnapshot)
      
      const result = await ProjectService.getAllProjects()
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('items')
      expect(result.items).toHaveLength(2)
      expect(mockFirestore.orderBy).toHaveBeenCalledWith('createdAt', 'desc')
    })
  })

  describe('getProject', () => {
    it('debe obtener un proyecto por ID exitosamente', async () => {
      const mockDocSnapshot = createMockDocSnapshot(mockProject)
      mockFirestore.doc.mockReturnValue({} as any)
      mockFirestore.getDoc.mockResolvedValue(mockDocSnapshot)
      
      const result = await ProjectService.getProject('project-1')
      
      expect(result).toEqual(expect.objectContaining({
        id: 'project-1',
        name: mockProject.name
      }))
    })

    it('debe retornar null si el proyecto no existe', async () => {
      const mockDocSnapshot = createMockDocSnapshot(null, false)
      mockFirestore.doc.mockReturnValue({} as any)
      mockFirestore.getDoc.mockResolvedValue(mockDocSnapshot)
      
      const result = await ProjectService.getProject('non-existent')
      
      expect(result).toBeNull()
    })

    it('debe manejar errores durante la consulta', async () => {
      const error = new Error('Document not found')
      mockFirestore.doc.mockReturnValue({} as any)
      mockFirestore.getDoc.mockRejectedValue(error)
      
      await expect(ProjectService.getProject('project-1'))
        .rejects.toThrow('Error al obtener el proyecto')
    })
  })

  describe('addMember', () => {
    it('debe agregar un miembro al proyecto exitosamente', async () => {
      const projectWithMembers = {
        ...mockProject,
        members: ['user-1']
      }
      
      // Metodos mock de getProject yupdateProject
      vi.spyOn(ProjectService, 'getProject').mockResolvedValue(projectWithMembers)
      vi.spyOn(ProjectService, 'updateProject').mockResolvedValue(undefined)
      
      await ProjectService.addMember('project-1', 'user-2')
      
      expect(ProjectService.updateProject).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          members: ['user-1', 'user-2']
        })
      )
    })

    it('debe manejar errores al agregar miembro', async () => {
      // Mock de getProject para retornar null (proyecto no encontrado)
      vi.spyOn(ProjectService, 'getProject').mockResolvedValue(null)
      
      await expect(ProjectService.addMember('project-1', 'user-2'))
        .rejects.toThrow('Error al agregar miembro al proyecto')
    })

    it('no debe agregar un miembro que ya existe', async () => {
      const projectWithMembers = {
        ...mockProject,
        members: ['user-1', 'user-2']
      }
      
      // Mock de getProject para retornar proyecto con miembros
      vi.spyOn(ProjectService, 'getProject').mockResolvedValue(projectWithMembers)
      vi.spyOn(ProjectService, 'updateProject').mockResolvedValue(undefined)
      
      await ProjectService.addMember('project-1', 'user-2')
      
      // updateProject no debe ser llamado ya que el usuario ya es miembro
      expect(ProjectService.updateProject).not.toHaveBeenCalled()
    })
  })

  describe('removeMember', () => {
    it('debe remover un miembro del proyecto exitosamente', async () => {
      const projectWithMembers = {
        ...mockProject,
        members: ['user-1', 'user-2', 'user-3']
      }
      
      // Mock de getProject para retornar proyecto con miembros
      vi.spyOn(ProjectService, 'getProject').mockResolvedValue(projectWithMembers)
      vi.spyOn(ProjectService, 'updateProject').mockResolvedValue(undefined)
      
      await ProjectService.removeMember('project-1', 'user-2')
      
      expect(ProjectService.updateProject).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          members: ['user-1', 'user-3']
        })
      )
    })

    it('debe manejar errores al remover miembro', async () => {
      // Mock de getProject para retornar null (proyecto no encontrado)
      vi.spyOn(ProjectService, 'getProject').mockResolvedValue(null)
      
      await expect(ProjectService.removeMember('project-1', 'user-2'))
        .rejects.toThrow('Error al remover miembro del proyecto')
    })
  })

  describe('hasAccess', () => {
    it('debe verificar acceso correctamente', async () => {
      const projectWithMembers = {
        ...mockProject,
        members: ['user-1', 'user-2']
      }
      
      // Mock de getProject para retornar proyecto con miembros
      vi.spyOn(ProjectService, 'getProject').mockResolvedValue(projectWithMembers)
      
      const hasAccess = await ProjectService.hasAccess('project-1', 'user-2')
      
      expect(hasAccess).toBe(true)
    })

    it('debe denegar acceso a usuarios no miembros', async () => {
      const projectWithLimitedMembers = {
        ...mockProject,
        members: ['user-1']
      }
      
      // Mock de getProject para retornar proyecto con miembros limitados
      vi.spyOn(ProjectService, 'getProject').mockResolvedValue(projectWithLimitedMembers)
      
      const hasAccess = await ProjectService.hasAccess('project-1', 'user-3')
      
      expect(hasAccess).toBe(false)
    })

    it('debe denegar acceso si el proyecto no existe', async () => {
      // Mock de getProject para retornar null (proyecto no encontrado)
      vi.spyOn(ProjectService, 'getProject').mockResolvedValue(null)
      
      const hasAccess = await ProjectService.hasAccess('non-existent', 'user-1')
      
      expect(hasAccess).toBe(false)
    })
  })

  describe('Casos edge y validaciones', () => {
    it('debe manejar IDs de proyecto inválidos', async () => {
      const error = new Error('Invalid project ID')
      mockFirestore.getDoc.mockRejectedValue(error)
      
      const result = await ProjectService.getProject('')
      
      expect(result).toBeNull()
    })

    it('debe manejar operaciones concurrentes', async () => {
      const projectWithMembers = {
        ...mockProject,
        members: ['user-1']
      }
      
      // Mock de getProject para retornar proyecto con miembros
      vi.spyOn(ProjectService, 'getProject').mockResolvedValue(projectWithMembers)
      vi.spyOn(ProjectService, 'updateProject').mockResolvedValue(undefined)
      
      // Simulación de múltiples operaciones simultáneas
      const promises = [
        ProjectService.addMember('project-1', 'user-2'),
        ProjectService.addMember('project-1', 'user-3'),
        ProjectService.updateProject('project-1', { name: 'Updated Name' })
      ]
      
      await expect(Promise.all(promises)).resolves.toBeDefined()
      
      //  updateProject debe ser llamado 3 veces (2 desde add member y 1 directamente)
      expect(ProjectService.updateProject).toHaveBeenCalledTimes(3)
    })
  })
})