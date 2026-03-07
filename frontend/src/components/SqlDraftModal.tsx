import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

type WarningItem = {
  type?: string;
  message?: string;
  suggestion?: string;
};

type Props = {
  scope: string;
  fieldKey: string;
  logicText: string;
  onApplyFormula: (formula: string) => void;
  onClose: () => void;
};

export function SqlDraftModal({ scope, fieldKey, logicText, onApplyFormula, onClose }: Props) {
  const [promptText, setPromptText] = useState(logicText);
  const [sqlText, setSqlText] = useState('');
  const [tables, setTables] = useState<string[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [formula, setFormula] = useState('');
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<WarningItem[]>([]);
  const [notes, setNotes] = useState('');
  const [pseudoCode, setPseudoCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState<'openai' | 'vanna'>('vanna');

  useEffect(() => {
    if (logicText) {
      void generateDraft(logicText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateDraft(text: string, selectedProvider: 'openai' | 'vanna' = provider) {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<any>('/admin/field-logic/sql-draft', {
        method: 'POST',
        body: JSON.stringify({ scope, field_key: fieldKey, logic_text: text, provider: selectedProvider })
      });
      if (res?.success && res.data) {
        setSqlText(res.data.sql || '');
        setTables(Array.isArray(res.data.tables) ? res.data.tables : []);
        setColumns(Array.isArray(res.data.columns) ? res.data.columns : []);
        setFormula(res.data.formula || '');
        setMissingColumns(Array.isArray(res.data.missing_columns) ? res.data.missing_columns : []);
        setWarnings(Array.isArray(res.data.warnings) ? res.data.warnings : []);
        setNotes(res.data.notes || '');
        setPseudoCode(res.data.pseudo_code || '');
      } else {
        setError(res?.error || 'Failed to generate SQL draft.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate SQL draft.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ width: '960px', maxWidth: '95vw' }}>
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
              <span style={{ color: '#1e293b', fontWeight: 800, fontSize: '14px' }}>🧠</span>
            </div>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>SQL Draft Preview</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        <div className="modal-body" style={{ padding: '24px', display: 'flex', gap: '24px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>Prompt</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', color: '#64748b' }}>SQL Engine:</label>
              <select
                value={provider}
                onChange={(e) => {
                  const next = e.target.value as 'openai' | 'vanna';
                  setProvider(next);
                  void generateDraft(promptText, next);
                }}
                style={{ fontSize: '12px' }}
              >
                <option value="openai">OpenAI (Current)</option>
                <option value="vanna">Vanna (Self-hosted)</option>
              </select>
            </div>
            <textarea
              className="nl-input"
              style={{ minHeight: '110px' }}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
            />

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button className="btn btn-xs" type="button" onClick={() => generateDraft(promptText)} disabled={loading}>
                {loading ? 'Generating...' : 'Regenerate'}
              </button>
              {formula && (
                <button className="btn btn-primary btn-xs" type="button" onClick={() => onApplyFormula(formula)}>
                  Use Formula
                </button>
              )}
            </div>

            {error && (
              <div style={{ marginTop: '10px', background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                {error}
              </div>
            )}

            {warnings.length > 0 && (
              <div style={{ marginTop: '10px', background: '#fffbeb', color: '#92400e', padding: '10px 12px', borderRadius: '6px', fontSize: '12px' }}>
                <strong>Suggestions</strong>
                <ul style={{ margin: '6px 0 0 16px' }}>
                  {warnings.map((w, i) => (
                    <li key={i}>
                      {w.message}
                      {w.suggestion ? ` (${w.suggestion})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {missingColumns.length > 0 && (
              <div style={{ marginTop: '10px', background: '#fef2f2', color: '#991b1b', padding: '10px 12px', borderRadius: '6px', fontSize: '12px' }}>
                Missing columns: {missingColumns.join(', ')}
              </div>
            )}

            <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginTop: '16px', marginBottom: '6px' }}>SQL Draft</label>
            <textarea
              className="nl-input"
              style={{ minHeight: '180px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace' }}
              value={sqlText}
              onChange={(e) => setSqlText(e.target.value)}
            />

            {pseudoCode && (
              <>
                <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginTop: '16px', marginBottom: '6px' }}>Pseudo Code</label>
                <textarea
                  className="nl-input"
                  style={{ minHeight: '120px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace' }}
                  value={pseudoCode}
                  onChange={(e) => setPseudoCode(e.target.value)}
                />
              </>
            )}

            {notes && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#475569' }}>
                <strong>Notes:</strong> {notes}
              </div>
            )}
          </div>

          <div style={{ width: '320px' }}>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Detected Tables</div>
              {tables.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>None</div>
              ) : (
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.6 }}>{tables.join(', ')}</div>
              )}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Detected Columns</div>
              {columns.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>None</div>
              ) : (
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.6 }}>{columns.join(', ')}</div>
              )}
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Formula</div>
              {formula ? (
                <div style={{ fontSize: '12px', color: '#0f172a', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px', borderRadius: '6px' }}>
                  {formula}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>No formula generated</div>
              )}
            </div>
          </div>
        </div>

        <div
          className="modal-footer"
          style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#f8fafc' }}
        >
          <button className="btn" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
