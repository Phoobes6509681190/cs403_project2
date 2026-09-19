import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import RoleRoute from './components/RoleRoute'
import AppLayout from './components/AppLayout'
import { ToastProvider } from './components/UI'

import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import AssetListPage from './pages/AssetListPage'
import AssetDetailPage from './pages/AssetDetailPage'
import AssetImportPage from './pages/AssetImportPage'
import CommitteePage from './pages/CommitteePage'
import InspectionPage from './pages/InspectionPage'
import ReportPage from './pages/ReportPage'
import ForbiddenPage from './pages/ForbiddenPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  // จำธีมที่ผู้ใช้เลือกไว้ล่าสุด
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aimslog.theme')
      if (saved) document.documentElement.setAttribute('data-theme', saved)
    } catch {
      /* ข้ามได้ถ้า storage ถูกปิด */
    }
  }, [])

  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/403" element={<ForbiddenPage />} />

        {/* ทุก route ข้างล่างนี้ต้องล็อกอินก่อนเท่านั้น (ดู ProtectedRoute.jsx) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="/assets" element={<AssetListPage />} />
            <Route path="/assets/:id" element={<AssetDetailPage />} />

            {/* เฉพาะ Admin เท่านั้น (ดู RoleRoute.jsx) */}
            <Route element={<RoleRoute allow={['admin']} />}>
              <Route path="/assets/import" element={<AssetImportPage />} />
              <Route path="/inspection/committee" element={<CommitteePage />} />
            </Route>

            <Route path="/inspection" element={<InspectionPage />} />
            <Route path="/inspection/:id" element={<InspectionPage />} />
            <Route path="/reports" element={<ReportPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ToastProvider>
  )
}
