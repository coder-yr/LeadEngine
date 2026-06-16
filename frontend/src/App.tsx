import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { MainLayout } from './components/templates/MainLayout';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import Leads from './pages/Leads';
import Settings from './pages/Settings';
import Activities from './pages/Activities';
import Campaigns from './pages/Campaigns';
import CompanyDetails from './pages/CompanyDetails';
import Pipeline from './pages/Pipeline';
import Tasks from './pages/Tasks';
import Discovery from './pages/Discovery';

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { path: '/', element: <Navigate to="/dashboard" replace /> },
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/companies', element: <Companies /> },
      { path: '/companies/:id', element: <CompanyDetails /> },
      { path: '/pipeline', element: <Pipeline /> },
      { path: '/tasks', element: <Tasks /> },
      { path: '/leads', element: <Leads /> },
      { path: '/activities', element: <Activities /> },
      { path: '/campaigns', element: <Campaigns /> },
      { path: '/discovery', element: <Discovery /> },
      { path: '/settings', element: <Settings /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}

export default App;
