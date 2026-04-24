import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Mock data
const mockUsers = [
  {
    id: 'user-1',
    email: 'john@example.com',
    displayName: 'John Doe',
    role: 'member'
  },
  {
    id: 'user-2',
    email: 'jane@example.com',
    displayName: 'Jane Smith',
    role: 'pm'
  },
  {
    id: 'admin-1',
    email: 'admin@example.com',
    displayName: 'Admin User',
    role: 'admin'
  }
]

const mockProjects = [
  {
    id: 'project-1',
    name: 'Test Project 1',
    description: 'A test project for development',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    status: 'active',
    ownerId: 'user-1',
    members: ['user-1', 'user-2'],
    color: '#3B82F6',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'project-2',
    name: 'Test Project 2',
    description: 'Another test project',
    startDate: '2024-02-01',
    endDate: '2024-11-30',
    status: 'planning',
    ownerId: 'user-2',
    members: ['user-2'],
    color: '#10B981',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z'
  }
]

// Request handlers
export const handlers = [
  // Búsqueda de usuarios
  http.get('/api/users/search', ({ request }) => {
    const url = new URL(request.url)
    const query = url.searchParams.get('q')
    
    if (!query) {
      return HttpResponse.json({ users: [] })
    }
    
    const filteredUsers = mockUsers.filter(
      user => 
        user.email.toLowerCase().includes(query.toLowerCase()) ||
        user.displayName.toLowerCase().includes(query.toLowerCase())
    )
    
    return HttpResponse.json({ users: filteredUsers })
  }),
  
  // Obtener proyectos
  http.get('/api/projects', ({ request }) => {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const role = url.searchParams.get('role')
    
    let filteredProjects = mockProjects
    
    if (role !== 'admin' && userId) {
      filteredProjects = mockProjects.filter(
        project => project.ownerId === userId || project.members.includes(userId)
      )
    }
    
    return HttpResponse.json({ projects: filteredProjects })
  }),
  
  // Crear proyecto
  http.post('/api/projects', async ({ request }) => {
    const newProject = await request.json() as any
    const project = {
      id: `project-${Date.now()}`,
      ...newProject,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    return HttpResponse.json({ project }, { status: 201 })
  }),
  
  // Actualizar proyecto
  http.put('/api/projects/:id', async ({ params, request }) => {
    const { id } = params
    const updates = await request.json() as any
    
    const project = {
      id,
      ...updates,
      updatedAt: new Date().toISOString()
    }
    
    return HttpResponse.json({ project })
  }),
  
  // Eliminar proyecto
  http.delete('/api/projects/:id', ({ params }) => {
    const { id } = params
    return HttpResponse.json({ success: true, id })
  }),
  
  // Obtener miembros del proyecto
  http.get('/api/projects/:id/members', ({ params }) => {
    const { id } = params
    const project = mockProjects.find(p => p.id === id)
    
    if (!project) {
      return HttpResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    
    const members = mockUsers.filter(user => project.members.includes(user.id))
    return HttpResponse.json({ members })
  }),
  
  // Agregar miembro al proyecto
  http.post('/api/projects/:id/members', async ({ params, request }) => {
    const { id } = params
    const { userId } = await request.json() as any
    
    return HttpResponse.json({ success: true, projectId: id, userId })
  }),
  
  // Remover miembro del proyecto
  http.delete('/api/projects/:id/members/:userId', ({ params }) => {
    const { id, userId } = params
    return HttpResponse.json({ success: true, projectId: id, userId })
  }),
  
  // Error handlers para testing
  http.get('/api/error/network', () => {
    return HttpResponse.error()
  }),
  
  http.get('/api/error/server', () => {
    return HttpResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }),
  
  http.get('/api/error/unauthorized', () => {
    return HttpResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  })
]

// Configurar el servidor
export const server = setupServer(...handlers)