export type ThemeMode = 'dark' | 'light'

export type AccentColor =
  | 'indigo'
  | 'green'
  | 'amber'
  | 'red'
  | 'purple'
  | 'blue'
  | 'pink'
  | 'teal'

export interface AppSettings {
  theme: ThemeMode
  accent: AccentColor
}

export const ACCENT_COLORS: { label: string; value: AccentColor; hex: string }[] = [
  { label: 'Indigo', value: 'indigo', hex: '#6366f1' },
  { label: 'Green', value: 'green', hex: '#22c55e' },
  { label: 'Amber', value: 'amber', hex: '#f59e0b' },
  { label: 'Red', value: 'red', hex: '#ef4444' },
  { label: 'Purple', value: 'purple', hex: '#a855f7' },
  { label: 'Blue', value: 'blue', hex: '#3b82f6' },
  { label: 'Pink', value: 'pink', hex: '#ec4899' },
  { label: 'Teal', value: 'teal', hex: '#14b8a6' },
]

export const SETTINGS_KEY = 'calander-settings'

export function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return { theme: 'dark', accent: 'indigo' }
}

export function applySettings(settings: AppSettings) {
  document.documentElement.setAttribute('data-theme', settings.theme)
  document.documentElement.setAttribute('data-accent', settings.accent)
}
