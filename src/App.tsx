import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './layouts/Layout'
import Login from './pages/Login'
import StudentAccounts from './pages/StudentAccounts'
import QuestionManagement from './pages/QuestionManagement'
import PracticeOverview from './pages/PracticeOverview'
import ExamGrading from './pages/ExamGrading'
import Settings from './pages/Settings'
import { ROUTES, STORAGE_KEYS } from './constants'
import { ToastProvider } from './components/Toast'

function RequireAuth({ children }: { children: React.ReactElement }) {
  const isAuthed = !!localStorage.getItem(STORAGE_KEYS.TOKEN)
  if (!isAuthed) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }
  return children
}

function App() {
  return (
    <ToastProvider>
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
            <Route path="exam-grading" element={<ExamGrading />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}

export default App

