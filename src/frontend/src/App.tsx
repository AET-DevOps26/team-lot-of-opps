import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useAppDispatch, useAppSelector } from './store/hooks'
import { signedIn, selectIsAuthenticated } from './features/authSlice'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Onboarding from './pages/Onboarding'
import Upload from './pages/Upload'

const IS_DEV = import.meta.env.VITE_DEV_AUTO_LOGIN === 'true'
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

function RequireAuth() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  return isAuthenticated ? <Outlet /> : <Navigate to="/welcome" replace />
}

function RedirectIfAuthenticated({ children }: { children: JSX.Element }) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  return isAuthenticated ? <Navigate to="/" replace /> : children
}

export default function App() {
  const dispatch = useAppDispatch()
  useEffect(() => {
    if (!IS_DEV) return
    fetch(`${API_BASE}/api/auth/dev-login`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { token: string; sub: string; email: string; name: string; picture?: string } | null) => {
        if (data) dispatch(signedIn({ user: { sub: data.sub, email: data.email, name: data.name, picture: data.picture }, token: data.token }))
      })
      .catch(() => {})
  }, [])

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
