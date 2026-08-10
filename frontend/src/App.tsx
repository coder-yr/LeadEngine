import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';

// Public pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';

// Protected pages
import Dashboard from './pages/Dashboard';
import Discovery from './pages/Discovery';
import Companies from './pages/Companies';
import CompanyDetails from './pages/CompanyDetails';
import Leads from './pages/Leads';
import Pipeline from './pages/Pipeline';
import Campaigns from './pages/Campaigns';
import Tasks from './pages/Tasks';
import Settings from './pages/Settings';
import Activities from './pages/Activities';
import WebsiteAuditTester from './pages/WebsiteAuditTester';

export function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected routes — all wrapped in AppLayout */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/discovery" element={<Discovery />} />
                    <Route path="/companies" element={<Companies />} />
                    <Route path="/companies/:id" element={<CompanyDetails />} />
                    <Route path="/leads" element={<Leads />} />
                    <Route path="/pipeline" element={<Pipeline />} />
                    <Route path="/campaigns" element={<Campaigns />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/activities" element={<Activities />} />
                    <Route path="/tools/audit-tester" element={<WebsiteAuditTester />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </AppLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
