import { useEffect, useMemo, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';

type BuilderModule = 'formula' | 'strategy';
type BuilderStatus = 'draft' | 'saved' | 'valid' | 'invalid' | 'active';
type FormulaTab = 'types' | 'details' | 'workflow';
type DeployScope = 'local' | 'global';
type DeployStage = 'draft' | 'qa' | 'production';
type StrategyTemplateKey = 'blank' | 'cost_plus' | 'competitive' | 'approval_gate';

type BuilderDoc = {
  id: string;
  module: BuilderModule;
  name: string;
  description: string;
  status: BuilderStatus;
  workspace: Record<string, unknown> | null;
  formulaTab: FormulaTab;
  formulaTypeName: string;
  activeTypes: string[];
  strategyTemplate: StrategyTemplateKey;
  deployScope: DeployScope;
  deployTarget: string;
  deployPriority: number;
  deployStage: DeployStage;
  updatedAt: string;
};

type TestLine = {
  sku: string;
  cost: number;
  list_price: number;
  quantity: number;
  discount_percent: number;
  product_family: string;
};

const STORAGE_KEY = 'admin_formula_strategy_blockly_v1';
const TOOLBOX_LABEL_COLOURS = {
  product: 350,
  parameters: 320,
  lookup: 35,
  constants: 85,
  math: 195,
  logic: 205,
  functions: 255,
  outputs: 15
};

const STRATEGY_TEMPLATES: Array<{ key: StrategyTemplateKey; label: string }> = [
  { key: 'blank', label: 'Blank' },
  { key: 'cost_plus', label: 'Cost Plus' },
  { key: 'competitive', label: 'Competitive Match' },
  { key: 'approval_gate', label: 'Approval Gate' }
];

const FORMULA_TYPES = ['IntegerInputCostData', 'CostPlusNoInput', 'InputWithLabel', 'TramCostPlus'];

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function createDefaultDoc(module: BuilderModule, name: string): BuilderDoc {
  return {
    id: makeId(module),
    module,
    name,
    description: '',
    status: 'draft',
    workspace: null,
    formulaTab: 'types',
    formulaTypeName: module === 'formula' ? 'IntegerInputCostData' : 'StrategyType',
    activeTypes: module === 'formula' ? ['IntegerInputCostData'] : [],
    strategyTemplate: 'blank',
    deployScope: 'local',
    deployTarget: 'default',
    deployPriority: 100,
    deployStage: 'draft',
    updatedAt: new Date().toISOString()
  };
}

let customBlocksRegistered = false;

function registerCustomBlocks() {
  if (customBlocksRegistered) return;
  customBlocksRegistered = true;

  Blockly.defineBlocksWithJsonArray([
    {
      type: 'pricing_product_attribute',
      message0: 'Product attribute %1',
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
      colour: TOOLBOX_LABEL_COLOURS.product
    },
    {
      type: 'pricing_parameter_number',
      message0: 'Parameter %1',
      args0: [{ type: 'field_input', name: 'NAME', text: 'margin' }],
      output: 'Number',
      colour: TOOLBOX_LABEL_COLOURS.parameters
    },
    {
      type: 'pricing_lookup_take',
      message0: 'Take %1 %2 from %3',
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
        { type: 'field_input', name: 'FIELD', text: 'cost' },
        { type: 'field_input', name: 'LOOKUP', text: 'ProductCosts' }
      ],
      output: 'Number',
      colour: TOOLBOX_LABEL_COLOURS.lookup
    },
    {
      type: 'pricing_constant_number',
      message0: 'Number %1',
      args0: [{ type: 'field_number', name: 'VALUE', value: 0 }],
      output: 'Number',
      colour: TOOLBOX_LABEL_COLOURS.constants
    },
    {
      type: 'pricing_formula_result',
      message0: 'set formula result to %1',
      args0: [{ type: 'input_value', name: 'VALUE', check: ['Number', 'String', 'Boolean'] }],
      previousStatement: null,
      nextStatement: null,
      colour: TOOLBOX_LABEL_COLOURS.outputs
    },
    {
      type: 'pricing_set_line_item',
      message0: 'set line item %1 to %2',
      args0: [
        { type: 'field_input', name: 'TARGET', text: 'target_price' },
        { type: 'input_value', name: 'VALUE', check: ['Number', 'String', 'Boolean'] }
      ],
      previousStatement: null,
      nextStatement: null,
      colour: TOOLBOX_LABEL_COLOURS.outputs
    },
    {
      type: 'pricing_set_quote_header',
      message0: 'set quote header %1 to %2',
      args0: [
        { type: 'field_input', name: 'TARGET', text: 'approval_required' },
        { type: 'input_value', name: 'VALUE', check: ['Number', 'String', 'Boolean'] }
      ],
      previousStatement: null,
      nextStatement: null,
      colour: TOOLBOX_LABEL_COLOURS.outputs
    },
    {
      type: 'pricing_formula_detail',
      message0: 'formula detail %1',
      args0: [{ type: 'field_multilinetext', name: 'TEXT', text: 'Integer input with cost data' }],
      previousStatement: null,
      nextStatement: null,
      colour: 95
    }
  ]);

  javascriptGenerator.forBlock['pricing_product_attribute'] = (block) => {
    const attr = block.getFieldValue('ATTR');
    return [`line.${attr}`, Order.ATOMIC];
  };

  javascriptGenerator.forBlock['pricing_parameter_number'] = (block) => {
    const key = block.getFieldValue('NAME').replace(/"/g, '');
    return [`Number(params["${key}"] ?? 0)`, Order.ATOMIC];
  };

  javascriptGenerator.forBlock['pricing_lookup_take'] = (block) => {
    const agg = block.getFieldValue('AGG');
    const field = block.getFieldValue('FIELD').replace(/"/g, '');
    const lookup = block.getFieldValue('LOOKUP').replace(/"/g, '');
    return [`lookupFn("${lookup}", "${field}", "${agg}", line)`, Order.FUNCTION_CALL];
  };

  javascriptGenerator.forBlock['pricing_constant_number'] = (block) => {
    return [String(block.getFieldValue('VALUE')), Order.ATOMIC];
  };

  javascriptGenerator.forBlock['pricing_formula_result'] = (block) => {
    const value = javascriptGenerator.valueToCode(block, 'VALUE', Order.NONE) || 'null';
    return `result.formula = ${value};\n`;
  };

  javascriptGenerator.forBlock['pricing_set_line_item'] = (block) => {
    const target = block.getFieldValue('TARGET').replace(/"/g, '');
    const value = javascriptGenerator.valueToCode(block, 'VALUE', Order.NONE) || 'null';
    return `result.lineItem["${target}"] = ${value};\n`;
  };

  javascriptGenerator.forBlock['pricing_set_quote_header'] = (block) => {
    const target = block.getFieldValue('TARGET').replace(/"/g, '');
    const value = javascriptGenerator.valueToCode(block, 'VALUE', Order.NONE) || 'null';
    return `result.quoteHeader["${target}"] = ${value};\n`;
  };

  javascriptGenerator.forBlock['pricing_formula_detail'] = (block) => {
    const text = JSON.stringify(block.getFieldValue('TEXT'));
    return `result.formulaDetail = ${text};\n`;
  };
}

function getFormulaToolbox() {
  return {
    kind: 'categoryToolbox',
    contents: [
      {
        kind: 'category',
        name: 'Product Attributes',
        colour: String(TOOLBOX_LABEL_COLOURS.product),
        contents: [{ kind: 'block', type: 'pricing_product_attribute' }]
      },
      {
        kind: 'category',
        name: 'Parameters',
        colour: String(TOOLBOX_LABEL_COLOURS.parameters),
        contents: [{ kind: 'block', type: 'pricing_parameter_number' }]
      },
      {
        kind: 'category',
        name: 'Data Lookups',
        colour: String(TOOLBOX_LABEL_COLOURS.lookup),
        contents: [{ kind: 'block', type: 'pricing_lookup_take' }]
      },
      {
        kind: 'category',
        name: 'Constants',
        colour: String(TOOLBOX_LABEL_COLOURS.constants),
        contents: [
          { kind: 'block', type: 'pricing_constant_number' },
          { kind: 'block', type: 'math_number' },
          { kind: 'block', type: 'text' },
          { kind: 'block', type: 'logic_boolean' }
        ]
      },
      {
        kind: 'category',
        name: 'Math',
        colour: String(TOOLBOX_LABEL_COLOURS.math),
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
        colour: String(TOOLBOX_LABEL_COLOURS.logic),
        contents: [
          { kind: 'block', type: 'logic_compare' },
          { kind: 'block', type: 'logic_operation' },
          { kind: 'block', type: 'logic_ternary' }
        ]
      },
      {
        kind: 'category',
        name: 'Functions',
        colour: String(TOOLBOX_LABEL_COLOURS.functions),
        custom: 'PROCEDURE'
      },
      {
        kind: 'category',
        name: 'Outputs',
        colour: String(TOOLBOX_LABEL_COLOURS.outputs),
        contents: [
          { kind: 'block', type: 'pricing_formula_result' },
          { kind: 'block', type: 'pricing_formula_detail' }
        ]
      }
    ]
  };
}

function getStrategyToolbox() {
  return {
    kind: 'categoryToolbox',
    contents: [
      {
        kind: 'category',
        name: 'Product Attributes',
        colour: String(TOOLBOX_LABEL_COLOURS.product),
        contents: [{ kind: 'block', type: 'pricing_product_attribute' }]
      },
      {
        kind: 'category',
        name: 'Parameters',
        colour: String(TOOLBOX_LABEL_COLOURS.parameters),
        contents: [{ kind: 'block', type: 'pricing_parameter_number' }]
      },
      {
        kind: 'category',
        name: 'Data Lookups',
        colour: String(TOOLBOX_LABEL_COLOURS.lookup),
        contents: [{ kind: 'block', type: 'pricing_lookup_take' }]
      },
      {
        kind: 'category',
        name: 'Constants',
        colour: String(TOOLBOX_LABEL_COLOURS.constants),
        contents: [
          { kind: 'block', type: 'pricing_constant_number' },
          { kind: 'block', type: 'math_number' },
          { kind: 'block', type: 'logic_boolean' }
        ]
      },
      {
        kind: 'category',
        name: 'Math',
        colour: String(TOOLBOX_LABEL_COLOURS.math),
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
        colour: String(TOOLBOX_LABEL_COLOURS.logic),
        contents: [
          { kind: 'block', type: 'logic_compare' },
          { kind: 'block', type: 'logic_operation' },
          { kind: 'block', type: 'logic_ternary' },
          { kind: 'block', type: 'controls_if' }
        ]
      },
      {
        kind: 'category',
        name: 'Functions',
        colour: String(TOOLBOX_LABEL_COLOURS.functions),
        contents: [
          { kind: 'block', type: 'controls_repeat_ext' },
          { kind: 'block', type: 'controls_whileUntil' },
          { kind: 'block', type: 'variables_set' },
          { kind: 'block', type: 'variables_get' }
        ]
      },
      {
        kind: 'category',
        name: 'Outputs',
        colour: String(TOOLBOX_LABEL_COLOURS.outputs),
        contents: [
          { kind: 'block', type: 'pricing_set_line_item' },
          { kind: 'block', type: 'pricing_set_quote_header' }
        ]
      }
    ]
  };
}

function createLineDataSamples(): TestLine[] {
  return [
    { sku: 'SKU-1001', cost: 780, list_price: 1200, quantity: 20, discount_percent: 0.11, product_family: 'Compute' },
    { sku: 'SKU-2040', cost: 280, list_price: 440, quantity: 65, discount_percent: 0.08, product_family: 'Storage' },
    { sku: 'SKU-7782', cost: 620, list_price: 980, quantity: 12, discount_percent: 0.17, product_family: 'Software' }
  ];
}

function lookupFn(table: string, field: string, agg: string, line: TestLine): number {
  const data: Record<string, Array<Record<string, number | string>>> = {
    ProductCosts: [
      { sku: 'SKU-1001', cost: 800, list_price: 1190 },
      { sku: 'SKU-2040', cost: 275, list_price: 435 },
      { sku: 'SKU-7782', cost: 635, list_price: 990 }
    ],
    competitor_prices: [
      { sku: 'SKU-1001', price: 1130 },
      { sku: 'SKU-2040', price: 418 },
      { sku: 'SKU-7782', price: 1025 }
    ]
  };

  const rows = data[table] ?? [];
  const candidates = rows
    .filter((r) => String(r.sku ?? '') === String(line.sku))
    .map((r) => Number(r[field] ?? r.price ?? 0))
    .filter((v) => Number.isFinite(v));

  if (!candidates.length) return 0;
  if (agg === 'first') return candidates[0];
  if (agg === 'avg') return candidates.reduce((a, b) => a + b, 0) / candidates.length;
  if (agg === 'min') return Math.min(...candidates);
  if (agg === 'max') return Math.max(...candidates);
  return candidates[0];
}

function collectWarnings(workspace: Blockly.WorkspaceSvg, module: BuilderModule): string[] {
  const blocks = workspace.getAllBlocks(false);
  const warnings: string[] = [];

  if (blocks.length === 0) {
    warnings.push('Workspace is empty.');
    return warnings;
  }

  const hasOutput = blocks.some((block) =>
    module === 'formula'
      ? block.type === 'pricing_formula_result'
      : block.type === 'pricing_set_line_item' || block.type === 'pricing_set_quote_header'
  );
  if (!hasOutput) {
    warnings.push(module === 'formula' ? 'Formula result block is required.' : 'At least one strategy output block is required.');
  }

  const unconnectedValues = blocks.filter(
    (block) => Boolean(block.outputConnection) && !block.outputConnection?.isConnected()
  );
  if (unconnectedValues.length) {
    warnings.push(`${unconnectedValues.length} value block(s) are not connected.`);
  }

  const lookupBlocks = blocks.filter((block) => block.type === 'pricing_lookup_take');
  if (lookupBlocks.some((block) => !(block.getFieldValue('LOOKUP') ?? '').trim())) {
    warnings.push('Lookup block has empty lookup source.');
  }

  return warnings;
}

function seedTemplate(workspace: Blockly.WorkspaceSvg, key: StrategyTemplateKey) {
  if (key === 'blank') return;
  workspace.clear();

  const create = (type: string, x: number, y: number, fields?: Record<string, string | number>) => {
    const block = workspace.newBlock(type);
    Object.entries(fields ?? {}).forEach(([name, value]) => block.setFieldValue(String(value), name));
    block.initSvg();
    block.render();
    block.moveBy(x, y);
    return block;
  };

  if (key === 'cost_plus') {
    const cost = create('pricing_product_attribute', 70, 80, { ATTR: 'cost' });
    const one = create('pricing_constant_number', 70, 200, { VALUE: 1 });
    const margin = create('pricing_parameter_number', 70, 320, { NAME: 'margin' });
    const add = create('math_arithmetic', 380, 220, { OP: 'ADD' });
    const multiply = create('math_arithmetic', 680, 160, { OP: 'MULTIPLY' });
    const output = create('pricing_set_line_item', 980, 180, { TARGET: 'target_price' });

    add.getInput('A')?.connection?.connect(one.outputConnection);
    add.getInput('B')?.connection?.connect(margin.outputConnection);
    multiply.getInput('A')?.connection?.connect(cost.outputConnection);
    multiply.getInput('B')?.connection?.connect(add.outputConnection);
    output.getInput('VALUE')?.connection?.connect(multiply.outputConnection);
  }

  if (key === 'competitive') {
    const lookup = create('pricing_lookup_take', 80, 90, { LOOKUP: 'competitor_prices', FIELD: 'price', AGG: 'first' });
    const factor = create('pricing_constant_number', 80, 240, { VALUE: 0.98 });
    const multiply = create('math_arithmetic', 380, 160, { OP: 'MULTIPLY' });
    const listPrice = create('pricing_product_attribute', 80, 370, { ATTR: 'list_price' });
    const min = create('math_minmax', 700, 180, { OP: 'MIN' });
    const output = create('pricing_set_line_item', 1020, 210, { TARGET: 'target_price' });

    multiply.getInput('A')?.connection?.connect(lookup.outputConnection);
    multiply.getInput('B')?.connection?.connect(factor.outputConnection);
    min.getInput('A')?.connection?.connect(multiply.outputConnection);
    min.getInput('B')?.connection?.connect(listPrice.outputConnection);
    output.getInput('VALUE')?.connection?.connect(min.outputConnection);
  }

  if (key === 'approval_gate') {
    const disc = create('pricing_product_attribute', 100, 120, { ATTR: 'discount_percent' });
    const threshold = create('pricing_constant_number', 100, 260, { VALUE: 0.15 });
    const compare = create('logic_compare', 380, 180, { OP: 'GT' });
    const output = create('pricing_set_quote_header', 720, 200, { TARGET: 'approval_required' });

    compare.getInput('A')?.connection?.connect(disc.outputConnection);
    compare.getInput('B')?.connection?.connect(threshold.outputConnection);
    output.getInput('VALUE')?.connection?.connect(compare.outputConnection);
  }
}

export function FormulaStrategyBuilder() {
  const [moduleTab, setModuleTab] = useState<BuilderModule>('formula');
  const [docs, setDocs] = useState<BuilderDoc[]>([]);
  const [activeId, setActiveId] = useState('');
  const [message, setMessage] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [testOutput, setTestOutput] = useState('');

  const blocklyHostRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const isLoadingWorkspaceRef = useRef(false);

  const moduleDocs = useMemo(() => docs.filter((d) => d.module === moduleTab), [docs, moduleTab]);
  const activeDoc = useMemo(() => moduleDocs.find((d) => d.id === activeId) ?? null, [moduleDocs, activeId]);

  useEffect(() => {
    registerCustomBlocks();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as BuilderDoc[];
        if (Array.isArray(parsed) && parsed.length) {
          setDocs(parsed);
          const firstFormula = parsed.find((d) => d.module === 'formula');
          setActiveId(firstFormula?.id ?? parsed[0].id);
          return;
        }
      } catch {
        // ignore corrupted cache
      }
    }

    const seeded = [createDefaultDoc('formula', 'Formula01'), createDefaultDoc('strategy', 'Strategy01')];
    setDocs(seeded);
    setActiveId(seeded[0].id);
  }, []);

  useEffect(() => {
    if (!docs.length) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  }, [docs]);

  useEffect(() => {
    if (!moduleDocs.length) {
      const fallback = createDefaultDoc(moduleTab, moduleTab === 'formula' ? 'Formula01' : 'Strategy01');
      setDocs((prev) => [...prev, fallback]);
      setActiveId(fallback.id);
      return;
    }

    if (!moduleDocs.some((d) => d.id === activeId)) {
      setActiveId(moduleDocs[0].id);
    }
  }, [moduleDocs, moduleTab, activeId]);

  function persistDocPatch(id: string, patch: Partial<BuilderDoc>) {
    setDocs((prev) => prev.map((doc) => (doc.id === id ? { ...doc, ...patch, updatedAt: new Date().toISOString() } : doc)));
  }

  function saveWorkspaceToActiveDoc(statusOverride?: BuilderStatus) {
    const workspace = workspaceRef.current;
    if (!workspace || !activeDoc) return;
    const nextWarnings = collectWarnings(workspace, moduleTab);
    setWarnings(nextWarnings);
    const status = statusOverride ?? (nextWarnings.length ? 'invalid' : 'valid');

    persistDocPatch(activeDoc.id, {
      workspace: Blockly.serialization.workspaces.save(workspace),
      status
    });
  }

  useEffect(() => {
    if (!blocklyHostRef.current || workspaceRef.current) return;

    const workspace = Blockly.inject(blocklyHostRef.current, {
      toolbox: moduleTab === 'formula' ? getFormulaToolbox() : getStrategyToolbox(),
      trashcan: true,
      scrollbars: true,
      move: { wheel: true, drag: true, scrollbars: true },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 0.9,
        maxScale: 2,
        minScale: 0.4,
        scaleSpeed: 1.1,
        pinch: true
      },
      grid: { spacing: 20, length: 3, colour: '#e2e8f0', snap: true }
    });

    workspace.addChangeListener(() => {
      if (isLoadingWorkspaceRef.current || !activeDoc) return;
      const snapshot = Blockly.serialization.workspaces.save(workspace);
      setDocs((prev) =>
        prev.map((doc) => (doc.id === activeDoc.id ? { ...doc, workspace: snapshot, status: 'saved', updatedAt: new Date().toISOString() } : doc))
      );
      setWarnings(collectWarnings(workspace, moduleTab));
    });

    workspaceRef.current = workspace;
    return () => {
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [activeDoc, moduleTab]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace || !activeDoc) return;

    workspace.updateToolbox(moduleTab === 'formula' ? getFormulaToolbox() : getStrategyToolbox());

    isLoadingWorkspaceRef.current = true;
    workspace.clear();
    if (activeDoc.workspace) {
      Blockly.serialization.workspaces.load(activeDoc.workspace, workspace);
    }
    setWarnings(collectWarnings(workspace, moduleTab));
    isLoadingWorkspaceRef.current = false;
  }, [activeDoc, moduleTab]);

  function createNewFromTemplate() {
    const template = activeDoc?.strategyTemplate ?? 'blank';
    const doc = createDefaultDoc(moduleTab, moduleTab === 'formula' ? `Formula${moduleDocs.length + 1}` : `Strategy${moduleDocs.length + 1}`);
    doc.strategyTemplate = template;
    if (moduleTab === 'formula') {
      doc.formulaTypeName = FORMULA_TYPES[0];
      doc.activeTypes = [FORMULA_TYPES[0]];
    }
    setDocs((prev) => [...prev, doc]);
    setActiveId(doc.id);
    setMessage(`Created ${moduleTab} ${doc.name}.`);

    setTimeout(() => {
      const workspace = workspaceRef.current;
      if (!workspace) return;
      if (moduleTab === 'strategy' && template !== 'blank') {
        isLoadingWorkspaceRef.current = true;
        seedTemplate(workspace, template);
        isLoadingWorkspaceRef.current = false;
        saveWorkspaceToActiveDoc('draft');
      }
    }, 50);
  }

  function duplicateActive() {
    if (!activeDoc) return;
    const clone: BuilderDoc = {
      ...activeDoc,
      id: makeId(activeDoc.module),
      name: `${activeDoc.name} Copy`,
      status: 'draft',
      updatedAt: new Date().toISOString()
    };
    setDocs((prev) => [...prev, clone]);
    setActiveId(clone.id);
    setMessage(`${activeDoc.module} duplicated.`);
  }

  function deleteActive() {
    if (!activeDoc) return;
    const remaining = docs.filter((d) => d.id !== activeDoc.id);
    setDocs(remaining);
    const next = remaining.find((d) => d.module === moduleTab) ?? remaining[0];
    setActiveId(next?.id ?? '');
    setMessage(`${activeDoc.name} deleted.`);
  }

  function saveActive() {
    saveWorkspaceToActiveDoc();
    setMessage('Saved successfully.');
  }

  function activateActive() {
    const workspace = workspaceRef.current;
    if (!workspace || !activeDoc) return;
    const nextWarnings = collectWarnings(workspace, moduleTab);
    if (nextWarnings.length) {
      setWarnings(nextWarnings);
      setMessage('Activation blocked: fix validation warnings first.');
      return;
    }
    if (moduleTab === 'strategy' && activeDoc.deployStage === 'production' && nextWarnings.length) {
      setMessage('Production activation blocked due to warnings.');
      return;
    }
    saveWorkspaceToActiveDoc('active');
    setMessage(`${activeDoc.name} activated.`);
  }

  function exportActive() {
    if (!activeDoc) return;
    saveWorkspaceToActiveDoc(activeDoc.status);
    const current = docs.find((d) => d.id === activeDoc.id);
    const blob = new Blob([JSON.stringify(current ?? activeDoc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDoc.name.replace(/\s+/g, '_').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importDoc(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? '')) as BuilderDoc;
        const imported: BuilderDoc = {
          ...createDefaultDoc(moduleTab, parsed.name || `${moduleTab} imported`),
          ...parsed,
          id: makeId(moduleTab),
          module: moduleTab,
          status: 'draft',
          updatedAt: new Date().toISOString()
        };
        setDocs((prev) => [...prev, imported]);
        setActiveId(imported.id);
        setMessage('Imported successfully.');
      } catch {
        setMessage('Import failed: invalid JSON format.');
      }
    };
    reader.readAsText(file);
  }

  function runTest() {
    const workspace = workspaceRef.current;
    if (!workspace || !activeDoc) return;

    const code = javascriptGenerator.workspaceToCode(workspace);
    const sampleLines = createLineDataSamples();
    const params = { margin: 0.2, approvalThreshold: 0.15 };

    try {
      const runner = new Function(
        'line',
        'params',
        'lookupFn',
        'result',
        `${code}\nreturn result;`
      ) as (line: TestLine, params: Record<string, number>, lookup: typeof lookupFn, result: Record<string, unknown>) => Record<string, unknown>;

      if (moduleTab === 'formula') {
        const result = runner(sampleLines[0], params, lookupFn, { formula: null, formulaDetail: '', lineItem: {}, quoteHeader: {} });
        setTestOutput(JSON.stringify({ sample: sampleLines[0], output: result, generatedCode: code }, null, 2));
      } else {
        const rows = sampleLines.map((line) =>
          runner(line, params, lookupFn, { formula: null, formulaDetail: '', lineItem: {}, quoteHeader: {} })
        );
        setTestOutput(JSON.stringify({ lines: sampleLines.length, outputs: rows, generatedCode: code }, null, 2));
      }
      setMessage('Test run completed.');
    } catch (err) {
      setTestOutput(JSON.stringify({ generatedCode: code, error: String(err) }, null, 2));
      setMessage('Test run failed. Check output panel.');
    }
  }

  return (
    <section className="formula-builder-shell panel-card">
      <header className="formula-builder-header">
        <div className="builder-module-tabs">
          <button className={`btn ${moduleTab === 'formula' ? 'btn-primary' : ''}`} onClick={() => setModuleTab('formula')}>Formula</button>
          <button className={`btn ${moduleTab === 'strategy' ? 'btn-primary' : ''}`} onClick={() => setModuleTab('strategy')}>Strategy</button>
        </div>

        <div className="formula-builder-title-row">
          <label>
            {moduleTab === 'formula' ? 'Formula' : 'Strategy'}
            <select value={activeId} onChange={(e) => setActiveId(e.target.value)}>
              {moduleDocs.map((doc) => (
                <option key={doc.id} value={doc.id}>{doc.name}</option>
              ))}
            </select>
          </label>

          {moduleTab === 'strategy' && (
            <label>
              Template
              <select
                value={activeDoc?.strategyTemplate ?? 'blank'}
                onChange={(e) => activeDoc && persistDocPatch(activeDoc.id, { strategyTemplate: e.target.value as StrategyTemplateKey })}
              >
                {STRATEGY_TEMPLATES.map((template) => (
                  <option key={template.key} value={template.key}>{template.label}</option>
                ))}
              </select>
            </label>
          )}

          <button className="btn" type="button" onClick={createNewFromTemplate}>New Strategy</button>
          <button className="btn" type="button" onClick={duplicateActive} disabled={!activeDoc}>Duplicate</button>
          <button className="btn btn-danger" type="button" onClick={deleteActive} disabled={!activeDoc}>Delete</button>
          <button className="btn" type="button" onClick={saveActive} disabled={!activeDoc}>Save Strategy</button>
          <button className="btn" type="button" onClick={runTest} disabled={!activeDoc}>Test Run</button>
          <button className="btn" type="button" onClick={exportActive} disabled={!activeDoc}>Export</button>
          <label className="btn file-btn">
            Import
            <input type="file" accept="application/json,.json" onChange={(e) => importDoc(e.target.files?.[0] ?? null)} />
          </label>
          <button className="btn btn-primary" type="button" onClick={activateActive} disabled={!activeDoc}>Activate</button>
        </div>

        {activeDoc && (
          <>
            <div className="formula-builder-title">
              <input
                value={activeDoc.name}
                onChange={(e) => persistDocPatch(activeDoc.id, { name: e.target.value })}
                placeholder={`${moduleTab} name`}
              />
              <input
                value={activeDoc.description}
                onChange={(e) => persistDocPatch(activeDoc.id, { description: e.target.value })}
                placeholder="Description"
              />
            </div>

            {moduleTab === 'formula' && (
              <div className="formula-meta-row">
                <label>
                  Formula Tab
                  <select
                    value={activeDoc.formulaTab}
                    onChange={(e) => persistDocPatch(activeDoc.id, { formulaTab: e.target.value as FormulaTab })}
                  >
                    <option value="types">Types</option>
                    <option value="details">Details</option>
                    <option value="workflow">Workflow</option>
                  </select>
                </label>

                <label>
                  Type
                  <select
                    value={activeDoc.formulaTypeName}
                    onChange={(e) => persistDocPatch(activeDoc.id, { formulaTypeName: e.target.value })}
                  >
                    {FORMULA_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>

                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    if (!activeDoc.activeTypes.includes(activeDoc.formulaTypeName)) {
                      persistDocPatch(activeDoc.id, { activeTypes: [...activeDoc.activeTypes, activeDoc.formulaTypeName] });
                    }
                  }}
                >
                  Add Type
                </button>

                <div className="active-types-pill-wrap">
                  {activeDoc.activeTypes.map((type) => <span key={type} className="active-type-pill">{type}</span>)}
                </div>
              </div>
            )}

            {moduleTab === 'strategy' && (
              <div className="deployment-row">
                <label>
                  Scope
                  <select value={activeDoc.deployScope} onChange={(e) => persistDocPatch(activeDoc.id, { deployScope: e.target.value as DeployScope })}>
                    <option value="local">Local</option>
                    <option value="global">Global</option>
                  </select>
                </label>
                <label>
                  Target
                  <input value={activeDoc.deployTarget} onChange={(e) => persistDocPatch(activeDoc.id, { deployTarget: e.target.value })} />
                </label>
                <label>
                  Priority
                  <input
                    type="number"
                    value={activeDoc.deployPriority}
                    onChange={(e) => persistDocPatch(activeDoc.id, { deployPriority: Number(e.target.value || 0) })}
                  />
                </label>
                <label>
                  Stage
                  <select value={activeDoc.deployStage} onChange={(e) => persistDocPatch(activeDoc.id, { deployStage: e.target.value as DeployStage })}>
                    <option value="draft">Draft</option>
                    <option value="qa">QA</option>
                    <option value="production">Production</option>
                  </select>
                </label>
              </div>
            )}
          </>
        )}

        <div className="builder-status-row">
          {activeDoc && <span className="active-type-pill">Status: {activeDoc.status.toUpperCase()}</span>}
          {message && <span className="muted">{message}</span>}
        </div>

        {warnings.length > 0 && (
          <div className="designer-warning-list">
            {warnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        )}
      </header>

      <div className="formula-builder-layout blockly-layout">
        <div className="blockly-workspace-host" ref={blocklyHostRef} />

        <aside className="formula-builder-right">
          <h3>Execution Output</h3>
          {!testOutput && <div className="empty">Run Test to preview formula/strategy output.</div>}
          {testOutput && (
            <div className="property-output">
              <pre>{testOutput}</pre>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
