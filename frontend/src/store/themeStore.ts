import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ThemeState = {
  theme: 'dark' | 'light' | 'system'
  sidebarOpen: boolean
  setTheme: (theme: 'dark' | 'light' | 'system') => void
  toggleSidebar: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      sidebarOpen: true,
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'theme-storage',
    }
  )
)
