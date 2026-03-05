import { useEffect, useMemo, useState } from 'react';
import { QuoteList } from './components/QuoteList';
import { PricingTableWithTabs } from './components/PricingTableWithTabs';
import { AdminScreen } from './components/AdminScreen';
import { LoginScreen } from './components/LoginScreen';
import { apiFetch, clearAuthSession, getAuthSession, saveAuthSession, updateActiveTenant, type AuthSession } from './api/client';
import type { AuthLoginResponse, AuthMeResponse, AuthTenantsResponse } from './api/types';

type View = 'quotes' | 'pricing' | 'admin';

export function App() {
  const [view, setView] = useState<View>('quotes');
  const [editingQuoteId, setEditingQuoteId] = useState<string | undefined>(undefined);

  const [authLoading, setAuthLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [tenants, setTenants] = useState<Array<{ tenant_id: string; tenant_name: string }>>([]);

  const canAdmin = useMemo(() => permissions.includes('*') || permissions.includes('admin.manage'), [permissions]);

  useEffect(() => {
    void restoreSession();
  }, []);

  async function restoreSession() {
    const stored = getAuthSession();
    if (!stored) {
      setAuthLoading(false);
      return;
    }

    try {
      const [meRes, tenantRes] = await Promise.all([
        apiFetch<AuthMeResponse>('/auth/me'),
        apiFetch<AuthTenantsResponse>('/auth/tenants')
      ]);

      setSession(stored);
      setPermissions(meRes.data.permissions || []);
      setTenants(tenantRes.data || []);
      setAuthError('');
    } catch {
      clearAuthSession();
      setSession(null);
      setPermissions([]);
      setTenants([]);
      setAuthError('Session expired. Please sign in again.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogin(payload: { email: string; password: string; tenantId: string }) {
    setLoginLoading(true);
    setAuthError('');
    try {
      const loginRes = await apiFetch<AuthLoginResponse>('/auth/login', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({
          email: payload.email,
          password: payload.password,
          tenant_id: payload.tenantId,
        }),
      });

      const baseSession: AuthSession = {
        accessToken: loginRes.data.access_token,
        refreshToken: loginRes.data.refresh_token,
        tenantId: loginRes.data.tenant_id,
        roles: loginRes.data.roles,
        user: loginRes.data.user,
      };
      saveAuthSession(baseSession);

      const [meRes, tenantRes] = await Promise.all([
        apiFetch<AuthMeResponse>('/auth/me'),
        apiFetch<AuthTenantsResponse>('/auth/tenants')
      ]);

      const enriched: AuthSession = {
        ...baseSession,
        permissions: meRes.data.permissions || [],
      };

      saveAuthSession(enriched);
      setSession(enriched);
      setPermissions(meRes.data.permissions || []);
      setTenants(tenantRes.data || []);
      setView('quotes');
      setAuthError('');
    } catch (err) {
      clearAuthSession();
      setSession(null);
      setPermissions([]);
      setTenants([]);
      setAuthError(String(err));
    } finally {
      setLoginLoading(false);
      setAuthLoading(false);
    }
  }

  function handleTenantSwitch(newTenantId: string) {
    if (!session) return;
    updateActiveTenant(newTenantId);
    setSession({ ...session, tenantId: newTenantId });
    setEditingQuoteId(undefined);
    setView('quotes');
  }

  function handleLogout() {
    clearAuthSession();
    setSession(null);
    setPermissions([]);
    setTenants([]);
    setEditingQuoteId(undefined);
    setView('quotes');
    setAuthError('');
  }

  function onCreateNew() {
    setEditingQuoteId(undefined);
    setView('pricing');
  }

  function onEditQuote(id: string) {
    setEditingQuoteId(id);
    setView('pricing');
  }

  if (authLoading) {
    return <div className="login-shell"><div className="login-card"><h2>Loading...</h2></div></div>;
  }

  if (!session) {
    return <LoginScreen loading={loginLoading} error={authError} onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="brand-block">
          <h1>Enterprise Pricing System</h1>
          <p>CPQ / Pricing Optimization</p>
        </div>

        {view !== 'pricing' && (
          <nav className="top-links">
            <button className={view === 'quotes' ? 'active' : ''} onClick={() => setView('quotes')}>Quotes</button>
            {canAdmin && <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>Admin</button>}
          </nav>
        )}

        <div className="auth-controls">
          <select
            value={session.tenantId}
            onChange={(e) => handleTenantSwitch(e.target.value)}
            title="Active Tenant"
          >
            {(tenants.length > 0 ? tenants : [{ tenant_id: session.tenantId, tenant_name: session.tenantId }]).map((t) => (
              <option key={t.tenant_id} value={t.tenant_id}>{t.tenant_name}</option>
            ))}
          </select>
          <span className="auth-user">{session.user?.email || 'user'}</span>
          <button className="btn" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main className="main-area">
        {view === 'quotes' && <QuoteList onCreateNew={onCreateNew} onEditQuote={onEditQuote} />}
        {view === 'pricing' && <PricingTableWithTabs quoteId={editingQuoteId} onBack={() => setView('quotes')} />}
        {view === 'admin' && canAdmin && <AdminScreen tenantId={session.tenantId} />}
      </main>
    </div>
  );
}
