import type { SessionState } from './types'

export const SESSION_STORAGE_KEY = 'eecs4441_hci_study_session_v1'

interface StoredEnvelope {
  savedAtIso: string
  session: SessionState
}

export function saveSession(session: SessionState): void {
  const payload: StoredEnvelope = {
    savedAtIso: new Date().toISOString(),
    session,
  }
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload))
}

export function loadSession(): SessionState | undefined {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY)
  if (!raw) return undefined

  try {
    const parsed = JSON.parse(raw) as StoredEnvelope
    if (!parsed.session || typeof parsed.session !== 'object') return undefined
    return parsed.session
  } catch {
    return undefined
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY)
}
