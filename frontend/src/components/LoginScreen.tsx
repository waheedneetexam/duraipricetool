import { FormEvent, useState } from 'react';

type Props = {
  defaultTenantId?: string;
  loading?: boolean;
  error?: string;
  onLogin: (payload: { email: string; password: string; tenantId: string }) => Promise<void>;
};

export function LoginScreen({ defaultTenantId = 'default', loading = false, error = '', onLogin }: Props) {
  const [email, setEmail] = useState('admin@durai.local');
  const [password, setPassword] = useState('Admin@123');
  const [tenantId, setTenantId] = useState(defaultTenantId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onLogin({ email: email.trim(), password, tenantId: tenantId.trim() || 'default' });
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <h2>Sign In</h2>
        <p>DuraiPricingTool access with tenant-scoped roles</p>

        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

        <label>
          Tenant ID
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="default" required />
        </label>

        {error && <div className="error-box">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
      </form>
    </div>
  );
}
