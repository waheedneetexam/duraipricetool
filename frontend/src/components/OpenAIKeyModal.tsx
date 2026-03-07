import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

type Props = {
  tenantId?: string;
  onClose: () => void;
};

export function OpenAIKeyModal({ tenantId, onClose }: Props) {
  const [openAiKey, setOpenAiKey] = useState('');
  const [openAiKeyConfigured, setOpenAiKeyConfigured] = useState(false);
  const [openAiKeyUpdatedAt, setOpenAiKeyUpdatedAt] = useState<string>('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [message, setMessage] = useState('');

  const formatError = (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback;

  useEffect(() => {
    void fetchOpenAiKeyStatus();
  }, []);

  async function fetchOpenAiKeyStatus() {
    try {
      const res = await apiFetch<any>('/admin/ai-provider/openai-key', { method: 'GET' });
      if (res?.success && res.data) {
        setOpenAiKeyConfigured(Boolean(res.data.configured));
        setOpenAiKeyUpdatedAt(res.data.updated_at || '');
        return;
      }
      setOpenAiKeyConfigured(false);
      setOpenAiKeyUpdatedAt('');
    } catch {
      setOpenAiKeyConfigured(false);
      setOpenAiKeyUpdatedAt('');
    }
  }

  async function saveOpenAiKey() {
    const trimmed = openAiKey.trim();
    if (!trimmed) {
      setMessage('Enter a valid OpenAI API key before saving.');
      return;
    }
    setIsSavingKey(true);
    try {
      const res = await apiFetch<any>('/admin/ai-provider/openai-key', {
        method: 'PUT',
        body: JSON.stringify({ api_key: trimmed })
      });
      if (res?.success) {
        setOpenAiKey('');
        await fetchOpenAiKeyStatus();
        setMessage('OpenAI API key saved for this tenant.');
      } else {
        setMessage(`Failed to save OpenAI key: ${res?.error || 'Unknown error'}`);
      }
    } catch (err) {
      setMessage(formatError(err, 'Failed to save OpenAI key. Check connectivity and permissions.'));
    } finally {
      setIsSavingKey(false);
    }
  }

  async function validateOpenAiKey() {
    const trimmed = openAiKey.trim();
    if (!trimmed) {
      setMessage('Enter a key to validate.');
      return;
    }
    setIsValidatingKey(true);
    try {
      const res = await apiFetch<any>('/admin/ai-provider/openai-key/validate', {
        method: 'POST',
        body: JSON.stringify({ api_key: trimmed })
      });
      if (res?.success) {
        const valid = Boolean(res.data?.valid);
        const msg = res.data?.message || (valid ? 'Key validated.' : 'Key validation failed.');
        setMessage(valid ? msg : `Validation failed: ${msg}`);
      } else {
        setMessage(`Validation failed: ${res?.error || 'Unknown error'}`);
      }
    } catch (err) {
      setMessage(formatError(err, 'Validation failed. Check connectivity and permissions.'));
    } finally {
      setIsValidatingKey(false);
    }
  }

  async function clearOpenAiKey() {
    setIsSavingKey(true);
    try {
      const res = await apiFetch<any>('/admin/ai-provider/openai-key', {
        method: 'DELETE'
      });
      if (res?.success) {
        setOpenAiKey('');
        await fetchOpenAiKeyStatus();
        setMessage('OpenAI API key cleared for this tenant.');
      } else {
        setMessage(`Failed to clear OpenAI key: ${res?.error || 'Unknown error'}`);
      }
    } catch (err) {
      setMessage(formatError(err, 'Failed to clear OpenAI key. Check connectivity and permissions.'));
    } finally {
      setIsSavingKey(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ width: '720px', maxWidth: '95vw' }}>
        <div
          className="modal-header"
          style={{
            background: '#1e293b',
            color: '#fff',
            padding: '12px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: '#fff', padding: '4px', borderRadius: '4px' }}>
              <span style={{ color: '#1e293b', fontWeight: 800, fontSize: '14px' }}>🔑</span>
            </div>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Manage OpenAI API Key</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        <div className="modal-body" style={{ padding: '24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              marginBottom: '16px'
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>OpenAI API Key</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Stored per tenant in Postgres and used for formula generation.</div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Tenant: {tenantId || 'unknown'}</div>
            </div>
            <div style={{ fontSize: '12px', color: openAiKeyConfigured ? '#16a34a' : '#b91c1c', fontWeight: 600 }}>
              {openAiKeyConfigured ? 'Configured' : 'Not Configured'}
            </div>
          </div>

          {message && (
            <div
              style={{
                background: '#eff6ff',
                color: '#1d4ed8',
                padding: '10px 14px',
                borderRadius: '6px',
                marginBottom: '12px',
                fontSize: '13px',
                border: '1px solid #bfdbfe'
              }}
            >
              {message}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
            <input
              className="input"
              type="password"
              placeholder="sk-********************************"
              value={openAiKey}
              onChange={(e) => setOpenAiKey(e.target.value)}
              style={{ flex: 1 }}
              autoComplete="off"
            />
            <button className="btn btn-primary btn-xs" type="button" onClick={saveOpenAiKey} disabled={isSavingKey}>
              {isSavingKey ? 'Saving...' : 'Save Key'}
            </button>
            <button className="btn btn-xs" type="button" onClick={validateOpenAiKey} disabled={isValidatingKey}>
              {isValidatingKey ? 'Validating...' : 'Validate'}
            </button>
            <button className="btn btn-xs" type="button" onClick={clearOpenAiKey} disabled={isSavingKey}>
              Clear
            </button>
          </div>

          {openAiKeyUpdatedAt && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8' }}>
              Last updated: {openAiKeyUpdatedAt}
            </div>
          )}
        </div>

        <div
          className="modal-footer"
          style={{
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            background: '#f8fafc'
          }}
        >
          <button className="btn" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
