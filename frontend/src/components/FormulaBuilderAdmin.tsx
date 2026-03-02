import { useEffect, useMemo, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';

type FormulaNavTab = 'types' | 'lookups';
type FormulaStatus = 'draft' | 'saved' | 'invalid' | 'valid';

type FormulaItem = {
  id: string;
  name: string;
  status: FormulaStatus;
  workspace: Record<string, unknown> | null;
};

const STORAGE_KEY = 'admin_formula_builder_v1';

const INITIAL_FORMULAS: FormulaItem[] = [
  { id: 'withoutBroadcastInput', name: 'withoutBroadcastInput', status: 'valid', workspace: null },
  { id: 'newFormula18', name: 'NewFormula18', status: 'saved', workspace: null },
  { id: 'JohansAverageCostPlusConditional', name: 'JohansAverageCostPlusConditional', status: 'saved', workspace: null },
  { id: 'newFormula16', name: 'NewFormula16', status: 'saved', workspace: null },
  { id: 'TramCostPlus', name: 'TramCostPlus', status: 'saved', workspace: null },
  { id: 'copyOfcopyOfKRY_Test1', name: 'copyOfcopyOfKRY_Test1', status: 'saved', workspace: null },
  { id: 'copyOfKRY_Test1', name: 'copyOfKRY_Test1', status: 'saved', workspace: null },
  { id: 'InputWithLabel', name: 'InputWithLabel', status: 'saved', workspace: null },
  { id: 'CostPlusNoInput', name: 'CostPlusNoInput', status: 'saved', workspace: null },
  { id: 'NewFormula13', name: 'NewFormula13', status: 'saved', workspace: null },
  { id: 'KRY_Test', name: 'KRY_Test', status: 'saved', workspace: null },
  { id: 'MK_Test', name: 'MK_Test', status: 'saved', workspace: null }
];

let customBlocksRegistered = false;

const BLOCKLY_THEME = Blockly.Theme.defineTheme('formula_admin_theme', {
  name: 'formula_admin_theme',
  base: Blockly.Themes.Zelos,
  componentStyles: {
    workspaceBackgroundColour: '#f3f4f6',
    toolboxBackgroundColour: '#f8fafc',
    toolboxForegroundColour: '#1e293b',
    flyoutBackgroundColour: '#f3f4f6',
    flyoutForegroundColour: '#0f172a',
    flyoutOpacity: 1,
    scrollbarColour: '#94a3b8',
    scrollbarOpacity: 0.4,
    insertionMarkerColour: '#2563eb',
    insertionMarkerOpacity: 0.25,
    markerColour: '#2563eb',
    cursorColour: '#2563eb'
  },
  fontStyle: {
    family: 'IBM Plex Sans, sans-serif',
    weight: '500',
    size: 13
  },
  startHats: false
});

function registerCustomBlocks() {
  if (customBlocksRegistered) return;
  customBlocksRegistered = true;

  Blockly.defineBlocksWithJsonArray([
    {
      type: 'formula_result_set',
      message0: 'set %1 to %2',
      args0: [
        {
          type: 'field_dropdown',
          name: 'TARGET',
          options: [
            ['Result', 'formula_result'],
            ['Formula Detail', 'formula_detail']
          ]
        },
        {
          type: 'input_value',
          name: 'VALUE',
          check: ['Number', 'String', 'Boolean']
        }
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 330
    },
    {
      type: 'formula_lookup_take',
      message0: 'take %1 %2 from %3',
      args0: [
        {
          type: 'field_dropdown',
          name: 'AGG',
          options: [
            ['first', 'first'],
            ['average', 'avg'],
            ['min', 'min'],
            ['max', 'max']
          ]
        },
        { type: 'field_dropdown', name: 'FIELD', options: [['Cost (Number)', 'cost'], ['List Price (Number)', 'list_price']] },
        { type: 'field_input', name: 'LOOKUP', text: 'ProductCosts' }
      ],
      output: 'Number',
      colour: 35
    },
    {
      type: 'formula_parameter',
      message0: 'parameter %1',
      args0: [{ type: 'field_input', name: 'NAME', text: 'margin' }],
      output: 'Number',
      colour: 315
    },
    {
      type: 'formula_input_attr',
      message0: 'input %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'ATTR',
          options: [
            ['Cost', 'cost'],
            ['List Price', 'list_price'],
            ['Quantity', 'quantity'],
            ['Discount %', 'discount_percent']
          ]
        }
      ],
      output: 'Number',
      colour: 200
    }
  ]);

  javascriptGenerator.forBlock['formula_result_set'] = (block) => {
    const target = block.getFieldValue('TARGET');
    const value = javascriptGenerator.valueToCode(block, 'VALUE', Order.NONE) || 'null';
    return `result["${target}"] = ${value};\n`;
  };

  javascriptGenerator.forBlock['formula_lookup_take'] = (block) => {
    const agg = block.getFieldValue('AGG');
    const field = block.getFieldValue('FIELD');
    const lookup = block.getFieldValue('LOOKUP').replace(/"/g, '');
    return [`lookupFn("${lookup}", "${field}", "${agg}", input)`, Order.FUNCTION_CALL];
  };

  javascriptGenerator.forBlock['formula_parameter'] = (block) => {
    const key = block.getFieldValue('NAME').replace(/"/g, '');
    return [`Number(params["${key}"] ?? 0)`, Order.ATOMIC];
  };

  javascriptGenerator.forBlock['formula_input_attr'] = (block) => {
    const attr = block.getFieldValue('ATTR');
    return [`input.${attr}`, Order.ATOMIC];
  };
}

function getToolbox() {
  return {
    kind: 'categoryToolbox',
    contents: [
      {
        kind: 'category',
        name: 'Parameters',
        colour: '315',
        contents: [{ kind: 'block', type: 'formula_parameter' }]
      },
      {
        kind: 'category',
        name: 'Data Lookups',
        colour: '35',
        contents: [{ kind: 'block', type: 'formula_lookup_take' }]
      },
      {
        kind: 'category',
        name: 'Constants',
        colour: '95',
        contents: [
          { kind: 'block', type: 'math_number' },
          { kind: 'block', type: 'text' },
          { kind: 'block', type: 'logic_boolean' }
        ]
      },
      {
        kind: 'category',
        name: 'Math',
        colour: '200',
        contents: [
          { kind: 'block', type: 'math_arithmetic' },
          { kind: 'block', type: 'math_round' },
          { kind: 'block', type: 'math_single' },
          { kind: 'block', type: 'math_minmax' }
        ]
      },
      {
        kind: 'category',
        name: 'Logic',
        colour: '205',
        contents: [
          { kind: 'block', type: 'logic_compare' },
          { kind: 'block', type: 'logic_operation' },
          { kind: 'block', type: 'logic_ternary' }
        ]
      },
      {
        kind: 'category',
        name: 'Inputs',
        colour: '280',
        contents: [{ kind: 'block', type: 'formula_input_attr' }]
      },
      {
        kind: 'category',
        name: 'Functions',
        colour: '260',
        custom: 'PROCEDURE'
      },
      {
        kind: 'category',
        name: 'Formula',
        colour: '330',
        contents: [{ kind: 'block', type: 'formula_result_set' }]
      }
    ]
  };
}

function collectWarnings(workspace: Blockly.WorkspaceSvg): string[] {
  const warnings: string[] = [];
  const blocks = workspace.getAllBlocks(false);

  if (!blocks.length) {
    warnings.push('Workspace is empty.');
    return warnings;
  }

  const hasResult = blocks.some((b) => b.type === 'formula_result_set');
  if (!hasResult) warnings.push('At least one result assignment block is required.');

  const dangling = blocks.filter((b) => Boolean(b.outputConnection) && !b.outputConnection?.isConnected()).length;
  if (dangling) warnings.push(`${dangling} value block(s) are not connected.`);

  return warnings;
}

function lookupFn(table: string, field: string, agg: string, input: Record<string, number>): number {
  const data: Record<string, Array<Record<string, number | string>>> = {
    ProductCosts: [
      { sku: 'SKU-1001', cost: 800, list_price: 1190 },
      { sku: 'SKU-2040', cost: 275, list_price: 435 }
    ]
  };
  const rows = data[table] ?? [];
  const candidates = rows
    .filter((r) => String(r.sku ?? '') === String(input.sku ?? ''))
    .map((r) => Number(r[field] ?? 0))
    .filter((v) => Number.isFinite(v));

  if (!candidates.length) return 0;
  if (agg === 'first') return candidates[0];
  if (agg === 'avg') return candidates.reduce((a, b) => a + b, 0) / candidates.length;
  if (agg === 'min') return Math.min(...candidates);
  if (agg === 'max') return Math.max(...candidates);
  return candidates[0];
}

export function FormulaBuilderAdmin() {
  const [navTab, setNavTab] = useState<FormulaNavTab>('types');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [formulas, setFormulas] = useState<FormulaItem[]>(INITIAL_FORMULAS);
  const [activeFormulaId, setActiveFormulaId] = useState(INITIAL_FORMULAS[1].id);
  const [message, setMessage] = useState('');
  const [testOutput, setTestOutput] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);

  const blocklyHostRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const isLoadingRef = useRef(false);

  const activeFormula = useMemo(
    () => formulas.find((f) => f.id === activeFormulaId) ?? formulas[0],
    [formulas, activeFormulaId]
  );

  useEffect(() => {
    registerCustomBlocks();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as FormulaItem[];
        if (Array.isArray(parsed) && parsed.length) {
          setFormulas(parsed);
          setActiveFormulaId(parsed[0].id);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formulas));
  }, [formulas]);

  useEffect(() => {
    if (!blocklyHostRef.current || workspaceRef.current) return;

    const ws = Blockly.inject(blocklyHostRef.current, {
      toolbox: getToolbox(),
      renderer: 'zelos',
      theme: BLOCKLY_THEME,
      trashcan: true,
      sounds: false,
      zoom: {
        controls: true,
        wheel: true,
        startScale: 0.88,
        maxScale: 2,
        minScale: 0.45,
        scaleSpeed: 1.12,
        pinch: true
      },
      move: { drag: true, wheel: true, scrollbars: true },
      grid: { spacing: 20, length: 3, colour: '#d5dbe5', snap: true }
    });

    ws.addChangeListener(() => {
      if (isLoadingRef.current || !activeFormula) return;
      const snapshot = Blockly.serialization.workspaces.save(ws);
      const wsWarnings = collectWarnings(ws);
      setWarnings(wsWarnings);
      setFormulas((prev) =>
        prev.map((f) =>
          f.id === activeFormula.id
            ? { ...f, workspace: snapshot, status: wsWarnings.length ? 'invalid' : 'saved' }
            : f
        )
      );
    });

    workspaceRef.current = ws;
    return () => {
      ws.dispose();
      workspaceRef.current = null;
    };
  }, [activeFormula]);

  useEffect(() => {
    const ws = workspaceRef.current;
    if (!ws || !activeFormula) return;

    isLoadingRef.current = true;
    ws.clear();
    if (activeFormula.workspace) Blockly.serialization.workspaces.load(activeFormula.workspace, ws);
    setWarnings(collectWarnings(ws));
    isLoadingRef.current = false;
  }, [activeFormula]);

  function addType() {
    const nextIndex = formulas.length + 1;
    const next: FormulaItem = {
      id: `newFormula${nextIndex}`,
      name: `NewFormula${nextIndex}`,
      status: 'draft',
      workspace: null
    };
    setFormulas((prev) => [next, ...prev]);
    setActiveFormulaId(next.id);
    setShowAddMenu(false);
    setMessage('New type added.');
  }

  function importFormula(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? '')) as FormulaItem;
        const imported: FormulaItem = {
          id: `imported_${Date.now()}`,
          name: parsed.name || `Imported_${formulas.length + 1}`,
          status: 'draft',
          workspace: parsed.workspace ?? null
        };
        setFormulas((prev) => [imported, ...prev]);
        setActiveFormulaId(imported.id);
        setMessage('Formula imported.');
      } catch {
        setMessage('Import failed: invalid JSON.');
      }
    };
    reader.readAsText(file);
  }

  function exportFormula() {
    if (!activeFormula) return;
    const ws = workspaceRef.current;
    const payload: FormulaItem = {
      ...activeFormula,
      workspace: ws ? Blockly.serialization.workspaces.save(ws) : activeFormula.workspace,
      status: warnings.length ? 'invalid' : 'saved'
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${payload.name}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage('Formula exported.');
  }

  function validateFormula() {
    const ws = workspaceRef.current;
    if (!ws || !activeFormula) return;
    const wsWarnings = collectWarnings(ws);
    setWarnings(wsWarnings);
    setFormulas((prev) =>
      prev.map((f) => (f.id === activeFormula.id ? { ...f, status: wsWarnings.length ? 'invalid' : 'valid' } : f))
    );
    setMessage(wsWarnings.length ? 'Validation found issues.' : 'Formula is valid.');
  }

  function runTest() {
    const ws = workspaceRef.current;
    if (!ws || !activeFormula) return;
    const code = javascriptGenerator.workspaceToCode(ws);
    try {
      const exec = new Function(
        'input',
        'params',
        'lookupFn',
        'result',
        `${code}\nreturn result;`
      ) as (
        input: Record<string, number | string>,
        params: Record<string, number>,
        lookupFnImpl: typeof lookupFn,
        result: Record<string, unknown>
      ) => Record<string, unknown>;

      const sampleInput = { sku: 'SKU-1001', cost: 780, list_price: 1200, quantity: 20, discount_percent: 0.11 };
      const output = exec(sampleInput, { margin: 0.2 }, lookupFn, {});
      setTestOutput(JSON.stringify({ input: sampleInput, output, generatedCode: code }, null, 2));
      setMessage('Test run completed.');
    } catch (err) {
      setTestOutput(JSON.stringify({ error: String(err), generatedCode: code }, null, 2));
      setMessage('Test run failed.');
    }
  }

  return (
    <section className="formula-admin panel-card">
      <div className="formula-admin-head">
        <div className="formula-admin-title-row">
          <button className="formula-link-btn" type="button" aria-label="Back">&larr;</button>
          <h3>Edit Types</h3>
        </div>
        <div className="formula-admin-tabs">
          <button className={navTab === 'types' ? 'active' : ''} onClick={() => setNavTab('types')} type="button">Types</button>
          <button className={navTab === 'lookups' ? 'active' : ''} onClick={() => setNavTab('lookups')} type="button">Data Lookups</button>
        </div>
      </div>

      <div className="formula-admin-body">
        <aside className="formula-left-pane">
          <div className="formula-pane-head">
            <h4>Types</h4>
            <div className="formula-add-wrap">
              <button className="btn formula-add-btn" type="button" onClick={() => setShowAddMenu((v) => !v)}>
                Add <span className="caret">▾</span>
              </button>
              {showAddMenu && (
                <div className="formula-add-menu">
                  <button type="button" onClick={addType}>Add Type</button>
                  <label>
                    Import
                    <input type="file" accept="application/json,.json" onChange={(e) => importFormula(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="formula-list">
            {formulas.map((formula) => (
              <button
                key={formula.id}
                type="button"
                className={`formula-list-item ${activeFormulaId === formula.id ? 'active' : ''}`}
                onClick={() => setActiveFormulaId(formula.id)}
              >
                {formula.name}
              </button>
            ))}
          </div>

          <div className="formula-drafts">
            <h5>Drafts</h5>
            <button type="button" className="formula-list-item active">{activeFormula?.name ?? 'NewFormula'}</button>
          </div>
        </aside>

        <main className="formula-main-pane">
          <div className="formula-main-head">
            <div>
              <h3>{activeFormula?.name ?? 'NewFormula'}</h3>
              <div className="formula-status-row">
                <span className="status-dot" /> {activeFormula?.status === 'draft' ? 'Draft' : 'Saved'}
                <span>|</span>
                <span>Saved</span>
                <span>|</span>
                <span className={activeFormula?.status === 'invalid' ? 'status-invalid' : ''}>{activeFormula?.status === 'valid' ? 'Valid' : 'Invalid'}</span>
              </div>
            </div>
            <div className="formula-head-actions">
              <button className="btn" type="button" onClick={validateFormula}>Validate</button>
              <button className="btn" type="button" onClick={runTest}>Test Run</button>
              <button className="btn" type="button" onClick={exportFormula}>Export</button>
            </div>
          </div>

          {message && <div className="formula-banner">{message}</div>}
          {warnings.length > 0 && (
            <div className="formula-warning-list">
              {warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          )}

          <div className="formula-workbench">
            <div className="formula-canvas-area blockly-theme-wrap">
              <div className="formula-blockly-host" ref={blocklyHostRef} />
            </div>

            <aside className="formula-output-pane">
              <h4>Sample Export/Test Output</h4>
              {!testOutput && <div className="empty">Run test to generate sample export data.</div>}
              {testOutput && (
                <pre>{testOutput}</pre>
              )}
            </aside>
          </div>
        </main>
      </div>
    </section>
  );
}
