import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import Layout from './components/Layout'
import { useAppDispatch, useAppSelector } from './store/hooks'
import { signedIn, signedOut, selectIsAuthenticated, selectAuthLoading } from './features/authSlice'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Onboarding from './pages/Onboarding'
import Upload from './pages/Upload'

function RequireAuth() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const loading = useAppSelector(selectAuthLoading)
  if (loading) return null
  return isAuthenticated ? <Outlet /> : <Navigate to="/welcome" replace />
}

function RedirectIfAuthenticated({ children }: { children: JSX.Element }) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const loading = useAppSelector(selectAuthLoading)
  if (loading) return null
  return isAuthenticated ? <Navigate to="/" replace /> : children
}

export default function App() {
  const dispatch = useAppDispatch()

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        dispatch(signedIn({
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? '',
          displayName: firebaseUser.displayName ?? '',
          photoURL: firebaseUser.photoURL ?? undefined,
        }))
      } else {
        dispatch(signedOut())
      }
    })
  }, [dispatch])

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          path="welcome"
          element={
            <RedirectIfAuthenticated>
              <Onboarding />
            </RedirectIfAuthenticated>
          }
        />
        <Route element={<RequireAuth />}>
          <Route index element={<Dashboard />} />
          <Route path="invoices" element={<Documents />} />
          <Route path="upload" element={<Upload />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
