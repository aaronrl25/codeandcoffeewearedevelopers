import { initializeApp, type FirebaseOptions } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** True when the .env file has actually been filled in. */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
)

// Exported rather than wrapped in getAuth() here: keeping the `firebase/auth`
// import inside lib/auth.tsx confines that SDK to the organizer bundle.
export const app = initializeApp(
  isFirebaseConfigured
    ? firebaseConfig
    : // Placeholder values keep the SDK from throwing at import time so the UI can
      // render a helpful "not configured" message instead of a blank screen.
      { apiKey: 'unconfigured', projectId: 'unconfigured', appId: 'unconfigured' },
)

export const db = getFirestore(app)
