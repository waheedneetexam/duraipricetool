const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  '/api';

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
  user?: { user_id: string; email: string; full_name?: string };
  roles?: string[];
  permissions?: string[];
};

const AUTH_STORAGE_KEY = 'durai.auth.session.v1';
let currentAuthSession: AuthSession | null = null;
let refreshInFlight: Promise<AuthSession | null> | null = null;

function safeParseSession(raw: string | null): AuthSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.accessToken || !parsed?.tenantId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getAuthSession(): AuthSession | null {
  if (currentAuthSession) return currentAuthSession;
  currentAuthSession = safeParseSession(localStorage.getItem(AUTH_STORAGE_KEY));
  return currentAuthSession;
}

export function saveAuthSession(session: AuthSession): void {
  currentAuthSession = session;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  currentAuthSession = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function updateActiveTenant(tenantId: string): void {
  const session = getAuthSession();
  if (!session) return;
  saveAuthSession({ ...session, tenantId });
}

export function hasPermission(permissionKey: string): boolean {
  const session = getAuthSession();
  const permissions = session?.permissions ?? [];
  return permissions.includes('*') || permissions.includes(permissionKey);
}

type ApiFetchOptions = RequestInit & { skipAuth?: boolean };

export async function apiFetch<T>(path: string, init?: ApiFetchOptions): Promise<T> {
  const original = { ...init };
  let attemptedRefresh = false;

  while (true) {
    const session = original.skipAuth ? null : getAuthSession();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...original,
      headers: {
        'Content-Type': 'application/json',
        ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        ...(session?.tenantId ? { 'X-Tenant-ID': session.tenantId } : {}),
        ...(original.headers ?? {})
      }
    });

    if (response.status === 401 && !original.skipAuth && !attemptedRefresh) {
      attemptedRefresh = true;
      const refreshed = await refreshSessionToken();
      if (refreshed?.accessToken) {
        continue;
      }
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }
}

export async function uploadCsv(file: File, mapping: Record<string, string>): Promise<Record<string, unknown>> {
  let attemptedRefresh = false;

  while (true) {
    const session = getAuthSession();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping_json', JSON.stringify(mapping));

    const response = await fetch(`${API_BASE_URL}/admin/ingest/csv`, {
      method: 'POST',
      headers: {
        ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        ...(session?.tenantId ? { 'X-Tenant-ID': session.tenantId } : {})
      },
      body: formData
    });

    if (response.status === 401 && !attemptedRefresh) {
      attemptedRefresh = true;
      const refreshed = await refreshSessionToken();
      if (refreshed?.accessToken) {
        continue;
      }
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return response.json();
  }
}

async function refreshSessionToken(): Promise<AuthSession | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const session = getAuthSession();
    if (!session?.refreshToken) {
      clearAuthSession();
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refreshToken })
      });
      if (!response.ok) {
        clearAuthSession();
        return null;
      }

      const payload = (await response.json()) as {
        success: boolean;
        data: {
          access_token: string;
          refresh_token: string;
          tenant_id: string;
          roles?: string[];
        };
      };

      if (!payload.success || !payload.data?.access_token) {
        clearAuthSession();
        return null;
      }

      const refreshed: AuthSession = {
        ...session,
        accessToken: payload.data.access_token,
        refreshToken: payload.data.refresh_token,
        tenantId: payload.data.tenant_id || session.tenantId,
        roles: payload.data.roles ?? session.roles
      };

      saveAuthSession(refreshed);
      return refreshed;
    } catch {
      clearAuthSession();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}
