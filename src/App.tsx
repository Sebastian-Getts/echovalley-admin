import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './layouts/Layout'
import Login from './pages/Login'
import StudentAccounts from './pages/StudentAccounts'
import QuestionManagement from './pages/QuestionManagement'
import PracticeOverview from './pages/PracticeOverview'
import Settings from './pages/Settings'
import { ROUTES, STORAGE_KEYS } from './constants'

function RequireAuth({ children }: { children: React.ReactElement }) {
  const isAuthed = !!localStorage.getItem(STORAGE_KEYS.TOKEN)
  if (!isAuthed) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.LOGIN} element={<Login />} />
        <Route
          path={ROUTES.HOME}
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<PracticeOverview />} />
          <Route path="students" element={<StudentAccounts />} />
          <Route path="questions" element={<QuestionManagement />} />
          <Route path="practice" element={<PracticeOverview />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App

