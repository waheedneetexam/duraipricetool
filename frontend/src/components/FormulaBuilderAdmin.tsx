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
  const [simulationResults, setSimulationResults] = useState<{ cost: number; result: number }[]>([]);

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
          logic_text: r.natural_language_logic || r.logic_text || '',
          generated_code: r.generated_code || '',
          explanation: r.explanation || '',
          dependencies: r.dependencies_json || r.dependencies || {},
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
        if (res.data.status === 'invalid' || (res.data.errors && res.data.errors.length > 0)) {
          const errMsgs = res.data.errors.map((e: any) => typeof e === 'string' ? e : (e.message || 'Unknown error')).join('. ');
          setMessage(`Validation Error: ${errMsgs}`);
          return;
        }

        console.log('AI Logic Result:', res.data);
        const code = res.data.generated_code || res.data.generatedCode || '';
        updateActiveRule({
          generated_code: code,
          dependencies: res.data.dependencies || {},
        });
        setMessage('AI Logic generated successfully! Please test before saving.');
      } else {
        setMessage(`Generation failed: ${res.error || 'Check connectivity or API keys'}`);
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

      const samples = [
        { cost: 5.00, list_price: 1500, discount_percent: 0.15, quantity: 1 },
        { cost: 10.00, list_price: 1500, discount_percent: 0.15, quantity: 1 },
        { cost: 25.00, list_price: 1500, discount_percent: 0.15, quantity: 1 },
        { cost: 31.00, list_price: 1500, discount_percent: 0.15, quantity: 1 }
      ];

      const results = samples.map(sample => {
        const argNames = Object.keys(sample);
        const argValues = Object.values(sample);
        const exec = new Function(...argNames, `return ${code};`);
        return {
          cost: sample.cost,
          result: Number(exec(...argValues).toFixed(2))
        };
      });

      setSimulationResults(results);

      const logsObj = {
        system: {
          error: null,
          generated_code: code,
          logs: results.map(r => ({ cost: r.cost, [activeRule.field_key]: r.result })),
          success: true
        }
      };
      setTestOutput(JSON.stringify(logsObj, null, 2));
      setMessage('Test run successful.');
    } catch (err) {
      setSimulationResults([]);
      const errObj = {
        system: {
          error: String(err),
          generated_code: activeRule.generated_code || "",
          success: false
        }
      };
      setTestOutput(JSON.stringify(errObj, null, 2));
      setMessage('Test run failed.');
    }
  }

  return (
    <div className="formula-layout-v3">
      {/* COLUMN 1: Rule Explorer */}
      <section className="fb-panel">
        <div className="fb-panel-header">
          <h3>Rule Explorer</h3>
          <button className="btn btn-primary btn-xs" type="button" onClick={addNewRule} style={{ padding: '6px 12px', fontSize: '13px' }}>+ New Rule</button>
        </div>
        <div className="fb-panel-content">
          <div className="rule-explorer-list">
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px', paddingLeft: '8px', cursor: 'pointer' }}>
              ⌄ Active rules
            </div>
            {isLoading && <p style={{ paddingLeft: '8px', fontSize: '13px' }}>Loading rules...</p>}
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`rule-tree-item ${activeRule?.id === rule.id ? 'active' : ''}`}
                onClick={() => setActiveRuleId(rule.id!)}
              >
                <span style={{ fontSize: '16px' }}>📄</span>
                <span style={{ flex: 1 }}>{rule.field_key} {rule.status === 'draft' ? '(Draft)' : ''}</span>
                <span style={{ fontSize: '14px', color: '#94a3b8' }}>⚙</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COLUMN 2: Logic Workspace */}
      <section className="fb-panel">
        <div className="fb-panel-header">
          <h3>Logic Workspace</h3>
        </div>
        <div className="fb-panel-content">
          <div className="workspace-top-bar">
            <div className="target-field-wrap" style={{ flex: 1, paddingRight: '20px' }}>
              <label>Target Field: Dropdown with Search)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  className="input"
                  value={activeRule?.field_key || ''}
                  onChange={(e) => updateActiveRule({ field_key: e.target.value })}
                  style={{ maxWidth: '240px' }}
                />
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', background: '#fffbeb', color: '#b45309', padding: '4px 10px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                  <span className="status-dot" style={{ background: '#f59e0b', width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' }} />
                  Status: {activeRule?.status ? activeRule.status.charAt(0).toUpperCase() + activeRule.status.slice(1) : 'Draft'}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{activeRule?.field_key} [Decimal]</div>
            </div>
            <div className="workspace-actions">
              <button className="btn-test" type="button" onClick={runTest}>Test Run</button>
              <button className="btn-deploy" type="button" onClick={saveRule}>Deploy Rule</button>
              <button className="btn-ai-gen" type="button" onClick={generateAILogic} disabled={isGenerating}>
                {isGenerating ? 'Generating...' : '✨ Generate with AI'}
              </button>
            </div>
          </div>

          {message && <div style={{ background: '#eff6ff', color: '#1d4ed8', padding: '10px 14px', borderRadius: '6px', marginBottom: '20px', fontSize: '13px', border: '1px solid #bfdbfe' }}>{message}</div>}

          <div className="logic-section">
            <h4>Natural Language Logic</h4>
            <p>Describe how to calculate this field. Ensure any variables you mention match actual columns (e.g., list_price, discount_percent, cost, quantity).</p>
            <textarea
              className="nl-input"
              value={activeRule?.logic_text || ''}
              onChange={(e) => updateActiveRule({ logic_text: e.target.value })}
            />
          </div>

          <div className="logic-section" style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4>Formula</h4>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-xs" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', color: '#334155' }}>📋 Copy to Clipboard</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', background: '#f1f5f9', padding: '4px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <input type="checkbox" id="manualEdit" /> <label htmlFor="manualEdit" style={{ margin: 0, cursor: 'pointer' }}>Manual Edit</label>
                </div>
              </div>
            </div>

            <div className="formula-block">
              <div className="formula-block-body">
                <div style={{ display: 'flex' }}>
                  <div style={{ width: '30px', color: '#94a3b8', userSelect: 'none', textAlign: 'right', paddingRight: '12px', borderRight: '1px solid #e2e8f0', marginRight: '16px' }}>1<br />2<br />3</div>
                  <div>
                    <div style={{ color: '#22c55e', marginBottom: '4px' }}>// Auto-generated Formula</div>
                    <div style={{ color: '#c026d3' }}>
                      return <span style={{ color: '#334155' }}>({activeRule?.generated_code || '...'})</span>;
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COLUMN 3: Live Preview / Simulator */}
      <section className="fb-panel">
        <div className="fb-panel-header">
          <h3>Live Preview / Simulator</h3>
        </div>
        <div className="fb-panel-content" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>

          <div style={{ padding: '16px 16px 0' }}>
            <h4 style={{ fontSize: '13px', color: '#334155', marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>Result Preview</h4>

            <table className="simulator-table">
              <thead>
                <tr>
                  <th>cost</th>
                  <th>{activeRule?.field_key || 'target'} (Draft)</th>
                </tr>
              </thead>
              <tbody>
                {simulationResults.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'center', color: '#94a3b8' }}>No data. Run test.</td>
                  </tr>
                ) : (
                  simulationResults.map((res, i) => (
                    <tr key={i}>
                      <td>{res.cost.toFixed(2)}</td>
                      <td>{res.result.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '0 16px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ fontSize: '13px', color: '#334155', marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>Logs</h4>

            <details className="simulator-logs" open style={{ flex: 1, margin: 0 }}>
              <summary>Collapsible debug</summary>
              {!testOutput && <div style={{ color: '#64748b' }}>Run a test to simulate calculations...</div>}
              {testOutput && (
                <div>
                  {testOutput}
                </div>
              )}
            </details>
          </div>
        </div>
      </section>
    </div>
  );
}
