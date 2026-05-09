import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useAppSelector } from './store/hooks'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Onboarding from './pages/Onboarding'
import Upload from './pages/Upload'

function RequireAuth() {
  const isAuthenticated = useAppSelector((state) => state.auth.user !== null)
  return isAuthenticated ? <Outlet /> : <Navigate to="/welcome" replace />
}

function RedirectIfAuthenticated({ children }: { children: JSX.Element }) {
  const isAuthenticated = useAppSelector((state) => state.auth.user !== null)
  return isAuthenticated ? <Navigate to="/" replace /> : children
}

export default function App() {
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
          <Route path="documents" element={<Documents />} />
          <Route path="upload" element={<Upload />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
