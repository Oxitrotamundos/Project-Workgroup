import { vi } from 'vitest'

// Mock de Firebase Auth
export const mockAuth = {
  currentUser: {
    uid: 'test-uid',
    email: 'test@example.com',
    displayName: 'Test User'
  },
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((callback) => {
    callback(mockAuth.currentUser)
    return vi.fn() // unsubscribe function
  })
}

// Mock de Firestore
export const mockFirestore = {
  collection: vi.fn(() => ({
    doc: vi.fn(() => ({
      get: vi.fn(() => Promise.resolve({
        exists: true,
        data: () => ({ name: 'Test Project', description: 'Test Description' })
      })),
      set: vi.fn(() => Promise.resolve()),
      update: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve())
    })),
    add: vi.fn(() => Promise.resolve({ id: 'test-id' })),
    where: vi.fn(() => ({
      get: vi.fn(() => Promise.resolve({
        docs: [
          {
            id: 'test-id',
            data: () => ({ name: 'Test Project', description: 'Test Description' })
          }
        ]
      }))
    })),
    orderBy: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: vi.fn(() => Promise.resolve({
          docs: [
            {
              id: 'test-id',
              data: () => ({ name: 'Test Project', description: 'Test Description' })
            }
          ]
        }))
      }))
    })),
    get: vi.fn(() => Promise.resolve({
      docs: [
        {
          id: 'test-id',
          data: () => ({ name: 'Test Project', description: 'Test Description' })
        }
      ]
    }))
  }))
}

// Mock de Firebase config
vi.mock('../config/firebase', () => ({
  auth: mockAuth,
  db: mockFirestore,
  googleProvider: {}
}))

// Mock de Firebase SDK
vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
  GoogleAuthProvider: vi.fn()
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  addDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn()
}))