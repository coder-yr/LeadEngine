import { BrowserRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "./components/ThemeProvider"
import { MainLayout } from "./components/templates/MainLayout"

// Pages
import Dashboard from "./pages/Dashboard"
import Leads from "./pages/Leads"
import Companies from "./pages/Companies"
import Campaigns from "./pages/Campaigns"
import Activities from "./pages/Activities"
import Settings from "./pages/Settings"

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="leads" element={<Leads />} />
              <Route path="companies" element={<Companies />} />
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="activities" element={<Activities />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
