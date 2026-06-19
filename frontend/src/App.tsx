import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';

// Pages
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

export function App() {
  return (
    <Router>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/discovery" element={<Discovery />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/companies/:id" element={<CompanyDetails />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/activities" element={<Activities />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </Router>
  );
}

export default App;
