import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

type FormulaNavTab = 'formulas';

interface FormulaRule {
  id?: string;
  scope: string;
  field_key: string;
  logic_text: string;
  generated_code: string;
  explanation?: string;
  dependencies?: Record<string, unknown>;
  active: boolean;
  status?: 'draft' | 'saved' | 'saving' | 'error';
}

export function FormulaBuilderAdmin() {
  const [navTab, setNavTab] = useState<FormulaNavTab>('formulas');
  const [rules, setRules] = useState<FormulaRule[]>([]);
  const [activeRuleId, setActiveRuleId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [testOutput, setTestOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const activeRule = rules.find((r) => r.id === activeRuleId) || rules[0];

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    setIsLoading(true);
    try {
      const res = await apiFetch<any>('/admin/field-logic/list?scope=line_item', { method: 'GET' });
      if (res.success && Array.isArray(res.data)) {
        const mapped = res.data.map((r: any) => ({
          id: r.id,
          scope: r.scope,
          field_key: r.field_key,
          logic_text: r.logic_text,
          generated_code: r.generated_code,
          explanation: r.explanation,
          dependencies: r.dependencies,
          active: r.active,
          status: 'saved' as const
        }));
        setRules(mapped);
        if (mapped.length > 0 && !activeRuleId) {
          setActiveRuleId(mapped[0].id);
        }
      }
    } catch (err) {
      setMessage('Failed to load rules.');
    } finally {
      setIsLoading(false);
    }
  }

  function addNewRule() {
    const newRule: FormulaRule = {
      id: `draft_${Date.now()}`,
      scope: 'line_item',
      field_key: 'new_field',
      logic_text: 'Describe how this field is calculated...',
      generated_code: '',
      active: true,
      status: 'draft'
    };
    setRules((prev) => [newRule, ...prev]);
    setActiveRuleId(newRule.id!);
  }

  function updateActiveRule(updates: Partial<FormulaRule>) {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id === activeRule?.id) {
          return { ...r, ...updates, status: 'draft' };
        }
        return r;
      })
    );
  }

  async function generateAILogic() {
    if (!activeRule) return;
    setIsGenerating(true);
    setMessage('Generating AI logic...');
    try {
      const payload = {
        scope: activeRule.scope,
        field_key: activeRule.field_key,
        logic_text: activeRule.logic_text
      };
      const res = await apiFetch<any>('/admin/field-logic/validate', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.success) {
        updateActiveRule({
          generated_code: res.data.generated_code,
          dependencies: res.data.dependencies,
        });
        setMessage('AI Logic generated successfully! Please test before saving.');
      } else {
        setMessage(`Generation failed: ${res.error}`);
      }
    } catch (e) {
      setMessage('Error connecting to AI service.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveRule() {
    if (!activeRule) return;
    try {
      updateActiveRule({ status: 'saving' });
      const payload = {
        scope: activeRule.scope,
        field_key: activeRule.field_key,
        logic_text: activeRule.logic_text,
        generated_code: activeRule.generated_code,
        explanation: activeRule.explanation || "AI Generated",
        dependencies: activeRule.dependencies || {}
      };
      const res = await apiFetch<any>('/admin/field-logic/save', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.success) {
        setMessage('Rule saved successfully.');
        loadRules(); // reload to get proper DB IDs
      } else {
        setMessage(`Save failed: ${res.error}`);
        updateActiveRule({ status: 'error' });
      }
    } catch (e) {
      setMessage('Error saving rule.');
      updateActiveRule({ status: 'error' });
    }
  }

  function runTest() {
    if (!activeRule) return;
    try {
      const code = activeRule.generated_code;
      if (!code) throw new Error("No generated code to test.");

      const sampleInput = { sku: 'SKU-1001', cost: 780, list_price: 1200, quantity: 20, discount_percent: 0.11 };
      const argNames = Object.keys(sampleInput);
      const argValues = Object.values(sampleInput);

      // The AI generates Python math like `list_price * (1 - discount_percent)` which evaluates identically in JS
      const exec = new Function(...argNames, `return ${code};`);
      const output = exec(...argValues);

      setTestOutput(JSON.stringify({ input: sampleInput, 'Math Formula': code, output }, null, 2));
      setMessage('Test run successful.');
    } catch (err) {
      setTestOutput(JSON.stringify({ error: String(err), generatedCode: activeRule.generated_code }, null, 2));
      setMessage('Test run failed.');
    }
  }

  return (
    <section className="formula-admin panel-card">
      <div className="formula-admin-head">
        <div className="formula-admin-title-row">
          <h3>AI Pricing Rules Engine</h3>
        </div>
        <div className="formula-admin-tabs">
          <button className={navTab === 'formulas' ? 'active' : ''} onClick={() => setNavTab('formulas')} type="button">Rules</button>
        </div>
      </div>

      <div className="formula-admin-body">
        <aside className="formula-left-pane">
          <div className="formula-pane-head">
            <h4>Active Rules</h4>
            <div className="formula-add-wrap">
              <button className="btn formula-add-btn" type="button" onClick={addNewRule}>
                + New Rule
              </button>
            </div>
          </div>

          <div className="formula-list">
            {isLoading && <p>Loading rules...</p>}
            {rules.map((rule) => (
              <button
                key={rule.id}
                type="button"
                className={`formula-list-item ${activeRule?.id === rule.id ? 'active' : ''}`}
                onClick={() => setActiveRuleId(rule.id!)}
              >
                {rule.field_key} {rule.status === 'draft' ? '(Draft)' : ''}
              </button>
            ))}
          </div>
        </aside>

        <main className="formula-main-pane">
          <div className="formula-main-head">
            <div>
              <h3>Target Field: <input className="input" style={{ marginLeft: '10px' }} value={activeRule?.field_key || ''} onChange={(e) => updateActiveRule({ field_key: e.target.value })} /></h3>
              <div className="formula-status-row">
                <span className="status-dot" /> Status: {activeRule?.status || 'Unknown'}
              </div>
            </div>
            <div className="formula-head-actions">
              <button className="btn btn-primary" type="button" onClick={generateAILogic} disabled={isGenerating}>
                {isGenerating ? 'Generating...' : '✨ Generate with AI'}
              </button>
              <button className="btn" type="button" onClick={runTest}>Test Run</button>
              <button className="btn btn-success" type="button" onClick={saveRule}>Save Rule</button>
            </div>
          </div>

          {message && <div className="formula-banner">{message}</div>}

          <div className="formula-workbench" style={{ display: 'flex', gap: '2rem', padding: '1rem', flexDirection: 'column' }}>
            <div className="formula-nlp-area" style={{ flex: 1 }}>
              <h4>Natural Language Logic</h4>
              <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.5rem' }}>
                Describe how to calculate this field. Ensure any variables you mention match actual columns (e.g., list_price, discount_percent, cost, quantity).
              </p>
              <textarea
                value={activeRule?.logic_text || ''}
                onChange={(e) => updateActiveRule({ logic_text: e.target.value })}
                rows={5}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '1rem', fontFamily: 'inherit' }}
              />

              <h4 style={{ marginTop: '1.5rem' }}>Generated Formula</h4>
              <pre style={{ backgroundColor: '#f1f5f9', padding: '1rem', borderRadius: '4px', border: '1px solid #e2e8f0', minHeight: '60px' }}>
                {activeRule?.generated_code || "Formula will appear here after clicking Generate..."}
              </pre>
            </div>

            <aside className="formula-output-pane" style={{ flex: 1, backgroundColor: '#1e293b', color: '#f8fafc', padding: '1rem', borderRadius: '6px' }}>
              <h4 style={{ color: '#94a3b8', margin: 0, paddingBottom: '0.5rem', borderBottom: '1px solid #334155' }}>Test Simulator Output</h4>
              {!testOutput && <div className="empty" style={{ marginTop: '1rem', color: '#64748b' }}>Run a test to simulate calculations on a sample line item...</div>}
              {testOutput && (
                <pre style={{ marginTop: '1rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem' }}>{testOutput}</pre>
              )}
            </aside>
          </div>
        </main>
      </div>
    </section>
  );
}
