import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { app, db, isFirebaseConfigured } from './firebase'

const auth = getAuth(app)

interface AuthState {
  user: User | null
  /** True only when the signed-in user has an `admins/{uid}` document. */
  isAdmin: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOutAdmin: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(isFirebaseConfigured)

  useEffect(() => {
    if (!isFirebaseConfigured) return
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser)
      if (!nextUser) {
        setIsAdmin(false)
        setLoading(false)
        return
      }
      try {
        const snap = await getDoc(doc(db, 'admins', nextUser.uid))
        setIsAdmin(snap.exists())
      } catch {
        // Rules deny the read for non-admins; treat that as "not an admin".
        setIsAdmin(false)
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      isAdmin,
      loading,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      },
      signOutAdmin: async () => {
        await signOut(auth)
      },
    }),
    [user, isAdmin, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}

/** Maps Firebase auth error codes to messages worth showing a human. */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address does not look right.'
    case 'auth/user-disabled':
      return 'This account has been disabled.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    default:
      return 'Could not sign in. Please try again.'
  }
}
