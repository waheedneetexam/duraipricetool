import { MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type NodeCategory = 'MATH' | 'LOGIC' | 'DATA' | 'CONTROL' | 'IO';
type DeployScope = 'global' | 'local';
type DeployStatus = 'draft' | 'qa' | 'production';
type StrategyTemplateKey = 'blank' | 'cost_plus' | 'competitive' | 'approval_gate';

type NodeTemplate = {
  type: string;
  label: string;
  icon: string;
  inputs: number;
  outputs: number;
};

type StrategyNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    icon: string;
    config: Record<string, string>;
  };
  inputs: string[];
  outputs: string[];
};

type Connection = {
  id: string;
  from: string;
  to: string;
  fromOutput: number;
  toInput: number;
};

type StrategyDocument = {
  id: string;
  name: string;
  description: string;
  templateKey: StrategyTemplateKey;
  deployment: {
    scope: DeployScope;
    target: string;
    priority: number;
    status: DeployStatus;
  };
  nodes: StrategyNode[];
  connections: Connection[];
  updatedAt: string;
};

const STORAGE_KEY = 'formula_builder_strategy_documents_v4';

const NODE_TEMPLATES: Record<NodeCategory, NodeTemplate[]> = {
  MATH: [
    { type: 'add', label: 'Add (+)', icon: '+', inputs: 2, outputs: 1 },
    { type: 'subtract', label: 'Subtract (-)', icon: '-', inputs: 2, outputs: 1 },
    { type: 'multiply', label: 'Multiply (*)', icon: '*', inputs: 2, outputs: 1 },
    { type: 'divide', label: 'Divide (/)', icon: '/', inputs: 2, outputs: 1 },
    { type: 'power', label: 'Power (^)', icon: '^', inputs: 2, outputs: 1 },
    { type: 'round', label: 'Round', icon: '~', inputs: 1, outputs: 1 },
    { type: 'min', label: 'Minimum', icon: 'min', inputs: 2, outputs: 1 },
    { type: 'max', label: 'Maximum', icon: 'max', inputs: 2, outputs: 1 }
  ],
  LOGIC: [
    { type: 'if', label: 'IF Condition', icon: '?', inputs: 3, outputs: 1 },
    { type: 'equals', label: 'Equals (==)', icon: '==', inputs: 2, outputs: 1 },
    { type: 'greater', label: 'Greater (>)', icon: '>', inputs: 2, outputs: 1 },
    { type: 'less', label: 'Less (<)', icon: '<', inputs: 2, outputs: 1 },
    { type: 'and', label: 'AND', icon: 'AND', inputs: 2, outputs: 1 },
    { type: 'or', label: 'OR', icon: 'OR', inputs: 2, outputs: 1 }
  ],
  DATA: [
    { type: 'query', label: 'Query Table', icon: 'Q', inputs: 0, outputs: 1 },
    { type: 'filter', label: 'Filter Data', icon: 'F', inputs: 2, outputs: 1 },
    { type: 'lookup', label: 'Table Lookup', icon: 'L', inputs: 2, outputs: 1 },
    { type: 'aggregate', label: 'Aggregate', icon: 'SUM', inputs: 1, outputs: 1 },
    { type: 'getField', label: 'Get Field', icon: 'GET', inputs: 1, outputs: 1 }
  ],
  CONTROL: [
    { type: 'forEach', label: 'For Each Loop', icon: 'FOR', inputs: 2, outputs: 1 },
    { type: 'while', label: 'While Loop', icon: 'WH', inputs: 2, outputs: 1 },
    { type: 'map', label: 'Map Array', icon: 'MAP', inputs: 2, outputs: 1 },
    { type: 'reduce', label: 'Reduce', icon: 'RED', inputs: 3, outputs: 1 }
  ],
  IO: [
    { type: 'input', label: 'Input Value', icon: 'IN', inputs: 0, outputs: 1 },
    { type: 'constant', label: 'Constant', icon: 'C', inputs: 0, outputs: 1 },
    { type: 'variable', label: 'Variable', icon: 'VAR', inputs: 1, outputs: 1 },
    { type: 'setLineItem', label: 'Set Line Item Field', icon: 'LI', inputs: 2, outputs: 0 },
    { type: 'setHeader', label: 'Set Quote Header', icon: 'QH', inputs: 2, outputs: 0 }
  ]
};

const TEMPLATE_OPTIONS: Array<{ key: StrategyTemplateKey; label: string }> = [
  { key: 'blank', label: 'Blank Strategy' },
  { key: 'cost_plus', label: 'Cost Plus Template' },
  { key: 'competitive', label: 'Competitive Match Template' },
  { key: 'approval_gate', label: 'Approval Gate Template' }
];

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function cloneNode(node: StrategyNode): StrategyNode {
  return {
    ...node,
    data: { ...node.data, config: { ...node.data.config } },
    inputs: [...node.inputs],
    outputs: [...node.outputs]
  };
}

function createBlankStrategy(name = 'New Strategy'): StrategyDocument {
  return {
    id: makeId('strategy'),
    name,
    description: '',
    templateKey: 'blank',
    deployment: {
      scope: 'local',
      target: 'default',
      priority: 100,
      status: 'draft'
    },
    nodes: [],
    connections: [],
    updatedAt: new Date().toISOString()
  };
}

function createNodeFromTemplate(type: string, x: number, y: number, config: Record<string, string> = {}): StrategyNode {
  const all = Object.values(NODE_TEMPLATES).flat();
  const base = all.find((item) => item.type === type);
  if (!base) {
    return {
      id: makeId('node'),
      type,
      position: { x, y },
      data: { label: type, icon: '?', config },
      inputs: [],
      outputs: []
    };
  }

  return {
    id: makeId('node'),
    type: base.type,
    position: { x, y },
    data: { label: base.label, icon: base.icon, config },
    inputs: Array(base.inputs).fill(''),
    outputs: Array(base.outputs).fill('')
  };
}

function createTemplateStrategy(templateKey: StrategyTemplateKey, index: number): StrategyDocument {
  const base = createBlankStrategy(`Strategy ${index + 1}`);
  base.templateKey = templateKey;

  if (templateKey === 'blank') return base;

  if (templateKey === 'cost_plus') {
    const cost = createNodeFromTemplate('input', 220, 120, { value: 'line.cost' });
    const margin = createNodeFromTemplate('constant', 220, 250, { value: '0.2' });
    const one = createNodeFromTemplate('constant', 220, 380, { value: '1' });
    const add = createNodeFromTemplate('add', 500, 320);
    const multiply = createNodeFromTemplate('multiply', 780, 230);
    const output = createNodeFromTemplate('setLineItem', 1050, 230, { value: 'line.target_price' });
    const nodes = [cost, margin, one, add, multiply, output];
    const connections: Connection[] = [
      { id: makeId('conn'), from: one.id, to: add.id, fromOutput: 0, toInput: 0 },
      { id: makeId('conn'), from: margin.id, to: add.id, fromOutput: 0, toInput: 1 },
      { id: makeId('conn'), from: cost.id, to: multiply.id, fromOutput: 0, toInput: 0 },
      { id: makeId('conn'), from: add.id, to: multiply.id, fromOutput: 0, toInput: 1 },
      { id: makeId('conn'), from: multiply.id, to: output.id, fromOutput: 0, toInput: 1 }
    ];
    return {
      ...base,
      name: 'Cost Plus Strategy',
      description: 'Target price = cost * (1 + margin).',
      nodes,
      connections
    };
  }

  if (templateKey === 'competitive') {
    const query = createNodeFromTemplate('query', 220, 170, { value: 'competitor_prices' });
    const lookup = createNodeFromTemplate('lookup', 490, 170, { value: 'sku' });
    const constant = createNodeFromTemplate('constant', 490, 310, { value: '0.98' });
    const multiply = createNodeFromTemplate('multiply', 760, 220);
    const min = createNodeFromTemplate('min', 1020, 220);
    const listPrice = createNodeFromTemplate('input', 760, 360, { value: 'line.list_price' });
    const output = createNodeFromTemplate('setLineItem', 1280, 220, { value: 'line.target_price' });
    const nodes = [query, lookup, constant, multiply, min, listPrice, output];
    const connections: Connection[] = [
      { id: makeId('conn'), from: query.id, to: lookup.id, fromOutput: 0, toInput: 0 },
      { id: makeId('conn'), from: lookup.id, to: multiply.id, fromOutput: 0, toInput: 0 },
      { id: makeId('conn'), from: constant.id, to: multiply.id, fromOutput: 0, toInput: 1 },
      { id: makeId('conn'), from: multiply.id, to: min.id, fromOutput: 0, toInput: 0 },
      { id: makeId('conn'), from: listPrice.id, to: min.id, fromOutput: 0, toInput: 1 },
      { id: makeId('conn'), from: min.id, to: output.id, fromOutput: 0, toInput: 1 }
    ];
    return {
      ...base,
      name: 'Competitive Match Strategy',
      description: 'Price to min(list price, competitor * 0.98).',
      nodes,
      connections
    };
  }

  const discount = createNodeFromTemplate('input', 260, 180, { value: 'line.discount_percent' });
  const threshold = createNodeFromTemplate('constant', 260, 320, { value: '0.15' });
  const greater = createNodeFromTemplate('greater', 570, 245);
  const output = createNodeFromTemplate('setHeader', 860, 245, { value: 'quote.requires_approval' });
  const nodes = [discount, threshold, greater, output];
  const connections: Connection[] = [
    { id: makeId('conn'), from: discount.id, to: greater.id, fromOutput: 0, toInput: 0 },
    { id: makeId('conn'), from: threshold.id, to: greater.id, fromOutput: 0, toInput: 1 },
    { id: makeId('conn'), from: greater.id, to: output.id, fromOutput: 0, toInput: 1 }
  ];
  return {
    ...base,
    name: 'Approval Gate Strategy',
    description: 'Set quote approval flag when discount is above threshold.',
    nodes,
    connections
  };
}

function getNodeColorClass(type: string): string {
  if (['add', 'subtract', 'multiply', 'divide', 'power', 'round', 'min', 'max'].includes(type)) return 'node-math';
  if (['if', 'equals', 'greater', 'less', 'and', 'or'].includes(type)) return 'node-logic';
  if (['query', 'filter', 'lookup', 'aggregate', 'getField'].includes(type)) return 'node-data';
  if (['forEach', 'while', 'map', 'reduce'].includes(type)) return 'node-control';
  return 'node-io';
}

function wouldCreateCycle(from: string, to: string, connections: Connection[]): boolean {
  const graph = new Map<string, string[]>();
  for (const conn of connections) {
    if (!graph.has(conn.from)) graph.set(conn.from, []);
    graph.get(conn.from)?.push(conn.to);
  }
  if (!graph.has(from)) graph.set(from, []);
  graph.get(from)?.push(to);

  const seen = new Set<string>();
  const stack = [to];
  while (stack.length) {
    const current = stack.pop() as string;
    if (current === from) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    const next = graph.get(current) ?? [];
    for (const target of next) stack.push(target);
  }
  return false;
}

export function FormulaStrategyBuilder() {
  const [strategyDocs, setStrategyDocs] = useState<StrategyDocument[]>([]);
  const [activeStrategyId, setActiveStrategyId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<StrategyTemplateKey>('blank');

  const [nodes, setNodes] = useState<StrategyNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [strategyName, setStrategyName] = useState('New Strategy');
  const [strategyDescription, setStrategyDescription] = useState('');
  const [deployScope, setDeployScope] = useState<DeployScope>('local');
  const [deployTarget, setDeployTarget] = useState('default');
  const [deployPriority, setDeployPriority] = useState(100);
  const [deployStatus, setDeployStatus] = useState<DeployStatus>('draft');

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<NodeCategory[]>(['MATH', 'LOGIC', 'DATA', 'CONTROL', 'IO']);
  const [connecting, setConnecting] = useState<{ nodeId: string; outputIndex: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [designerMessage, setDesignerMessage] = useState('');
  const [testOutput, setTestOutput] = useState('');

  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createBlankStrategy();
      setStrategyDocs([initial]);
      setActiveStrategyId(initial.id);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as StrategyDocument[];
      if (Array.isArray(parsed) && parsed.length) {
        setStrategyDocs(parsed);
        setActiveStrategyId(parsed[0].id);
      } else {
        const initial = createBlankStrategy();
        setStrategyDocs([initial]);
        setActiveStrategyId(initial.id);
      }
    } catch {
      const initial = createBlankStrategy();
      setStrategyDocs([initial]);
      setActiveStrategyId(initial.id);
    }
  }, []);

  const activeDoc = useMemo(
    () => strategyDocs.find((doc) => doc.id === activeStrategyId) ?? null,
    [strategyDocs, activeStrategyId]
  );

  useEffect(() => {
    if (!activeDoc) return;
    setStrategyName(activeDoc.name);
    setStrategyDescription(activeDoc.description);
    setSelectedTemplate(activeDoc.templateKey);
    setDeployScope(activeDoc.deployment.scope);
    setDeployTarget(activeDoc.deployment.target);
    setDeployPriority(activeDoc.deployment.priority);
    setDeployStatus(activeDoc.deployment.status);
    setNodes(activeDoc.nodes.map(cloneNode));
    setConnections(activeDoc.connections.map((conn) => ({ ...conn })));
    setSelectedNodeId(null);
    setConnecting(null);
    setDesignerMessage('');
    setTestOutput('');
  }, [activeDoc]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const incomingByNode = useMemo(() => {
    const map = new Map<string, Set<number>>();
    for (const conn of connections) {
      if (!map.has(conn.to)) map.set(conn.to, new Set());
      map.get(conn.to)?.add(conn.toInput);
    }
    return map;
  }, [connections]);

  const validationWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!nodes.some((node) => node.type === 'setLineItem' || node.type === 'setHeader')) {
      warnings.push('No output assignment block found (Set Line Item Field / Set Quote Header).');
    }

    const disconnected = nodes.filter((node) => !connections.some((c) => c.from === node.id || c.to === node.id));
    if (disconnected.length) warnings.push(`${disconnected.length} node(s) are disconnected from flow.`);

    const configRequiredTypes = new Set(['constant', 'input', 'query', 'filter', 'lookup', 'setLineItem', 'setHeader']);
    const missingConfig = nodes.filter((node) => configRequiredTypes.has(node.type) && !(node.data.config.value ?? '').trim()).length;
    if (missingConfig) warnings.push(`${missingConfig} node(s) have missing configuration value.`);

    const missingInputs = nodes.filter((node) => {
      if (!node.inputs.length) return false;
      const mapped = incomingByNode.get(node.id);
      return node.inputs.some((_, idx) => !mapped?.has(idx));
    }).length;
    if (missingInputs) warnings.push(`${missingInputs} node(s) have unconnected required input ports.`);

    return warnings;
  }, [connections, incomingByNode, nodes]);

  function setAndPersist(nextDocs: StrategyDocument[]) {
    setStrategyDocs(nextDocs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDocs));
  }

  function persistCurrentToList(partial?: Partial<StrategyDocument>) {
    if (!activeStrategyId) return;
    const next = strategyDocs.map((doc) =>
      doc.id === activeStrategyId
        ? {
            ...doc,
            name: strategyName,
            description: strategyDescription,
            templateKey: selectedTemplate,
            deployment: {
              scope: deployScope,
              target: deployTarget,
              priority: deployPriority,
              status: deployStatus
            },
            nodes,
            connections,
            updatedAt: new Date().toISOString(),
            ...partial
          }
        : doc
    );
    setAndPersist(next);
  }

  const addNode = (nodeTemplate: NodeTemplate) => {
    const node: StrategyNode = {
      id: makeId('node'),
      type: nodeTemplate.type,
      position: { x: 280, y: 150 + nodes.length * 18 },
      data: {
        label: nodeTemplate.label,
        icon: nodeTemplate.icon,
        config: {}
      },
      inputs: Array(nodeTemplate.inputs).fill(''),
      outputs: Array(nodeTemplate.outputs).fill('')
    };
    setNodes((prev) => [...prev, node]);
    setSelectedNodeId(node.id);
  };

  const duplicateNode = (nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) return;
    const clone: StrategyNode = {
      ...cloneNode(node),
      id: makeId('node'),
      position: { x: node.position.x + 30, y: node.position.y + 30 }
    };
    setNodes((prev) => [...prev, clone]);
  };

  const removeNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((node) => node.id !== nodeId));
    setConnections((prev) => prev.filter((conn) => conn.from !== nodeId && conn.to !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  const handleNodeMouseDown = (ev: ReactMouseEvent<HTMLElement>, nodeId: string) => {
    ev.stopPropagation();
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) return;
    setSelectedNodeId(nodeId);
    setDraggingNodeId(nodeId);
    dragOffset.current = {
      x: ev.clientX - node.position.x * zoom,
      y: ev.clientY - node.position.y * zoom
    };
  };

  const handleMouseMove = useCallback(
    (ev: MouseEvent) => {
      if (!draggingNodeId) return;
      setNodes((prev) =>
        prev.map((node) =>
          node.id === draggingNodeId
            ? {
                ...node,
                position: {
                  x: (ev.clientX - dragOffset.current.x) / zoom,
                  y: (ev.clientY - dragOffset.current.y) / zoom
                }
              }
            : node
        )
      );
    },
    [draggingNodeId, zoom]
  );

  const stopDrag = useCallback(() => {
    setDraggingNodeId(null);
  }, []);

  useEffect(() => {
    if (!draggingNodeId) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDrag);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDrag);
    };
  }, [draggingNodeId, handleMouseMove, stopDrag]);

  const startConnection = (nodeId: string, outputIndex: number) => {
    const source = nodes.find((node) => node.id === nodeId);
    if (!source || outputIndex >= source.outputs.length) return;
    setConnecting({ nodeId, outputIndex });
  };

  const completeConnection = (nodeId: string, inputIndex: number) => {
    if (!connecting || connecting.nodeId === nodeId) {
      setConnecting(null);
      return;
    }

    const source = nodes.find((node) => node.id === connecting.nodeId);
    const target = nodes.find((node) => node.id === nodeId);
    if (!source || !target) {
      setDesignerMessage('Source or target node does not exist.');
      setConnecting(null);
      return;
    }

    if (inputIndex >= target.inputs.length) {
      setDesignerMessage('Target input index is invalid.');
      setConnecting(null);
      return;
    }

    if (connections.some((conn) => conn.to === nodeId && conn.toInput === inputIndex)) {
      setDesignerMessage('That input port is already connected. Remove existing connection first.');
      setConnecting(null);
      return;
    }

    if (connections.some((conn) => conn.from === connecting.nodeId && conn.to === nodeId && conn.fromOutput === connecting.outputIndex && conn.toInput === inputIndex)) {
      setDesignerMessage('Duplicate connection not allowed.');
      setConnecting(null);
      return;
    }

    if (wouldCreateCycle(connecting.nodeId, nodeId, connections)) {
      setDesignerMessage('Connection rejected: cyclic graph is not allowed.');
      setConnecting(null);
      return;
    }

    const conn: Connection = {
      id: makeId('conn'),
      from: connecting.nodeId,
      to: nodeId,
      fromOutput: connecting.outputIndex,
      toInput: inputIndex
    };
    setConnections((prev) => [...prev, conn]);
    setDesignerMessage('Connection added.');
    setConnecting(null);
  };

  const deleteConnection = (connectionId: string) => {
    setConnections((prev) => prev.filter((conn) => conn.id !== connectionId));
  };

  const updateSelectedNodeConfigText = (text: string) => {
    if (!selectedNodeId) return;
    try {
      const parsed = JSON.parse(text) as Record<string, string>;
      setNodes((prev) =>
        prev.map((node) => (node.id === selectedNodeId ? { ...node, data: { ...node.data, config: parsed } } : node))
      );
    } catch {
      // Ignore invalid JSON edits.
    }
  };

  const createNewStrategyFromTemplate = () => {
    const next = createTemplateStrategy(selectedTemplate, strategyDocs.length);
    const updated = [...strategyDocs, next];
    setAndPersist(updated);
    setActiveStrategyId(next.id);
    setDesignerMessage(`Created strategy from template: ${TEMPLATE_OPTIONS.find((t) => t.key === selectedTemplate)?.label ?? 'Template'}.`);
  };

  const duplicateActiveStrategy = () => {
    if (!activeDoc) return;
    const clone: StrategyDocument = {
      ...activeDoc,
      id: makeId('strategy'),
      name: `${activeDoc.name} Copy`,
      nodes: activeDoc.nodes.map((node) => ({ ...cloneNode(node), id: makeId('node') })),
      connections: [],
      updatedAt: new Date().toISOString(),
      deployment: { ...activeDoc.deployment, status: 'draft' }
    };

    const oldToNew = new Map<string, string>();
    activeDoc.nodes.forEach((node, idx) => oldToNew.set(node.id, clone.nodes[idx].id));
    clone.connections = activeDoc.connections
      .map((conn) => {
        const from = oldToNew.get(conn.from);
        const to = oldToNew.get(conn.to);
        if (!from || !to) return null;
        return { ...conn, id: makeId('conn'), from, to };
      })
      .filter((value): value is Connection => Boolean(value));

    const updated = [...strategyDocs, clone];
    setAndPersist(updated);
    setActiveStrategyId(clone.id);
    setDesignerMessage('Strategy duplicated.');
  };

  const deleteActiveStrategy = () => {
    if (!activeDoc) return;
    const next = strategyDocs.filter((doc) => doc.id !== activeDoc.id);
    if (!next.length) {
      const fallback = createBlankStrategy();
      setAndPersist([fallback]);
      setActiveStrategyId(fallback.id);
      setDesignerMessage('Deleted strategy. Created a new blank strategy.');
      return;
    }
    setAndPersist(next);
    setActiveStrategyId(next[0].id);
    setDesignerMessage('Strategy deleted.');
  };

  const saveStrategy = () => {
    if (deployStatus === 'production' && validationWarnings.length) {
      setDesignerMessage('Cannot set to production while validation warnings exist.');
      return;
    }
    persistCurrentToList();
    setDesignerMessage('Strategy saved.');
  };

  const runTest = () => {
    const constants = nodes
      .filter((node) => node.type === 'constant')
      .map((node) => Number(node.data.config.value ?? ''))
      .filter((value) => Number.isFinite(value));

    const margin = constants.find((value) => value > 0 && value < 1) ?? 0.12;
    const hasLookup = nodes.some((node) => node.type === 'lookup');
    const hasMin = nodes.some((node) => node.type === 'min');
    const hasMultiply = nodes.some((node) => node.type === 'multiply');
    const hasOutput = nodes.some((node) => node.type === 'setLineItem' || node.type === 'setHeader');

    const sample = [
      { sku: 'SKU-1001', listPrice: 1200, cost: 780, competitorPrice: 1130, quantity: 20, discountPercent: 0.11 },
      { sku: 'SKU-2040', listPrice: 440, cost: 280, competitorPrice: 418, quantity: 65, discountPercent: 0.08 },
      { sku: 'SKU-7782', listPrice: 980, cost: 620, competitorPrice: 1025, quantity: 12, discountPercent: 0.17 }
    ];

    const resultRows = sample.map((line) => {
      let target = line.listPrice;
      if (hasMultiply) target = line.cost * (1 + margin);
      if (hasLookup) target = Math.min(target, line.competitorPrice * 0.98);
      if (hasMin) target = Math.min(target, line.listPrice);
      const rounded = Math.round(target * 100) / 100;
      return {
        sku: line.sku,
        listPrice: line.listPrice,
        cost: line.cost,
        competitorPrice: line.competitorPrice,
        targetPrice: rounded,
        marginPercent: Math.round(((rounded - line.cost) / rounded) * 10000) / 100
      };
    });

    const header = {
      approvalRequired: resultRows.some((row) => row.marginPercent < 20),
      outputMapped: hasOutput,
      warningCount: validationWarnings.length
    };

    setTestOutput(JSON.stringify({ sampleSize: sample.length, header, rows: resultRows }, null, 2));
    setDesignerMessage('Test run completed on sample data.');
  };

  const exportStrategy = () => {
    const strategy: StrategyDocument = {
      id: activeStrategyId || makeId('strategy'),
      name: strategyName,
      description: strategyDescription,
      templateKey: selectedTemplate,
      deployment: {
        scope: deployScope,
        target: deployTarget,
        priority: deployPriority,
        status: deployStatus
      },
      nodes,
      connections,
      updatedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(strategy, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${strategyName.replace(/\s+/g, '_').toLowerCase() || 'strategy'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importStrategy = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? '')) as StrategyDocument;
        const imported: StrategyDocument = {
          ...createBlankStrategy(parsed.name || `Imported ${strategyDocs.length + 1}`),
          ...parsed,
          id: makeId('strategy'),
          updatedAt: new Date().toISOString(),
          deployment: {
            scope: parsed.deployment?.scope ?? 'local',
            target: parsed.deployment?.target ?? 'default',
            priority: parsed.deployment?.priority ?? 100,
            status: 'draft'
          }
        };
        const next = [...strategyDocs, imported];
        setAndPersist(next);
        setActiveStrategyId(imported.id);
        setDesignerMessage('Strategy imported.');
      } catch {
        setDesignerMessage('Invalid strategy JSON. Import failed.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <section className="formula-builder-shell panel-card">
      <header className="formula-builder-header">
        <div className="formula-builder-title-row">
          <label>
            Strategy
            <select
              value={activeStrategyId}
              onChange={(e) => {
                persistCurrentToList();
                setActiveStrategyId(e.target.value);
              }}
            >
              {strategyDocs.map((doc) => (
                <option key={doc.id} value={doc.id}>{doc.name}</option>
              ))}
            </select>
          </label>

          <label>
            Template
            <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value as StrategyTemplateKey)}>
              {TEMPLATE_OPTIONS.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </label>

          <button className="btn" type="button" onClick={createNewStrategyFromTemplate}>New Strategy</button>
          <button className="btn" type="button" onClick={duplicateActiveStrategy}>Duplicate</button>
          <button className="btn btn-danger" type="button" onClick={deleteActiveStrategy}>Delete</button>
          <button className="btn" type="button" onClick={saveStrategy}>Save Strategy</button>
          <button className="btn" type="button" onClick={runTest}>Test Run</button>
          <button className="btn" type="button" onClick={exportStrategy}>Export</button>
          <label className="btn file-btn">
            Import
            <input type="file" accept="application/json,.json" onChange={(e) => importStrategy(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        <div className="formula-builder-title">
          <input value={strategyName} onChange={(e) => setStrategyName(e.target.value)} onBlur={() => persistCurrentToList()} />
          <input
            value={strategyDescription}
            onChange={(e) => setStrategyDescription(e.target.value)}
            onBlur={() => persistCurrentToList()}
            placeholder="Description"
          />
        </div>

        <div className="deployment-row">
          <label>
            Scope
            <select value={deployScope} onChange={(e) => setDeployScope(e.target.value as DeployScope)}>
              <option value="local">Local</option>
              <option value="global">Global</option>
            </select>
          </label>
          <label>
            Target
            <input value={deployTarget} onChange={(e) => setDeployTarget(e.target.value)} placeholder="tenant / region / BU" />
          </label>
          <label>
            Priority
            <input
              type="number"
              value={deployPriority}
              onChange={(e) => setDeployPriority(Number(e.target.value || 0))}
              min={1}
              step={1}
            />
          </label>
          <label>
            Status
            <select value={deployStatus} onChange={(e) => setDeployStatus(e.target.value as DeployStatus)}>
              <option value="draft">Draft</option>
              <option value="qa">QA</option>
              <option value="production">Production</option>
            </select>
          </label>
        </div>

        {designerMessage && <div className="designer-banner">{designerMessage}</div>}
        {validationWarnings.length > 0 && (
          <div className="designer-warning-list">
            {validationWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}
      </header>

      <div className="formula-builder-layout">
        <aside className="formula-builder-left">
          <h3>Function Library</h3>
          {Object.entries(NODE_TEMPLATES).map(([categoryKey, templates]) => {
            const category = categoryKey as NodeCategory;
            const expanded = expandedCategories.includes(category);
            return (
              <div key={category} className="node-group">
                <button
                  className="node-group-header"
                  type="button"
                  onClick={() =>
                    setExpandedCategories((prev) => (expanded ? prev.filter((item) => item !== category) : [...prev, category]))
                  }
                >
                  <span>{category}</span>
                  <span>{expanded ? '-' : '+'}</span>
                </button>
                {expanded && (
                  <div className="node-group-body">
                    {templates.map((template) => (
                      <button key={template.type} className="node-template" type="button" onClick={() => addNode(template)}>
                        <span>{template.icon}</span>
                        <span>{template.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </aside>

        <main className="formula-builder-canvas" onMouseDown={() => setSelectedNodeId(null)}>
          <div className="canvas-grid" />
          <svg className="connection-layer" viewBox="0 0 1600 900" preserveAspectRatio="none">
            {connections.map((conn) => {
              const fromNode = nodes.find((item) => item.id === conn.from);
              const toNode = nodes.find((item) => item.id === conn.to);
              if (!fromNode || !toNode) return null;

              const startX = (fromNode.position.x + 190) * zoom;
              const startY = (fromNode.position.y + 60 + conn.fromOutput * 18) * zoom;
              const endX = toNode.position.x * zoom;
              const endY = (toNode.position.y + 45 + conn.toInput * 18) * zoom;
              const midX = (startX + endX) / 2;

              return (
                <g key={conn.id}>
                  <path
                    d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                    className="connection-path"
                    onClick={() => deleteConnection(conn.id)}
                  />
                  <circle cx={startX} cy={startY} r="4" className="connection-dot source" />
                  <circle cx={endX} cy={endY} r="4" className="connection-dot target" />
                </g>
              );
            })}
          </svg>

          {nodes.map((node) => (
            <article
              key={node.id}
              className={`strategy-node ${getNodeColorClass(node.type)} ${selectedNodeId === node.id ? 'selected' : ''}`}
              style={{
                left: `${node.position.x * zoom}px`,
                top: `${node.position.y * zoom}px`,
                transform: `scale(${zoom})`,
                transformOrigin: 'top left'
              }}
              onMouseDown={(ev) => handleNodeMouseDown(ev, node.id)}
            >
              <div className="strategy-node-head">
                <strong>{node.data.icon} {node.data.label}</strong>
                <div>
                  <button className="btn btn-xs" type="button" onClick={(ev) => { ev.stopPropagation(); duplicateNode(node.id); }}>Clone</button>
                  <button className="btn btn-danger btn-xs" type="button" onClick={(ev) => { ev.stopPropagation(); removeNode(node.id); }}>Delete</button>
                </div>
              </div>

              {node.inputs.length > 0 && (
                <div className="port-list">
                  {node.inputs.map((_, idx) => (
                    <button
                      key={`in-${node.id}-${idx}`}
                      type="button"
                      className="node-port input"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        completeConnection(node.id, idx);
                      }}
                    >
                      IN {idx + 1}
                    </button>
                  ))}
                </div>
              )}

              {node.outputs.length > 0 && (
                <div className="port-list align-right">
                  {node.outputs.map((_, idx) => (
                    <button
                      key={`out-${node.id}-${idx}`}
                      type="button"
                      className={`node-port output ${connecting?.nodeId === node.id && connecting.outputIndex === idx ? 'active' : ''}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        startConnection(node.id, idx);
                      }}
                    >
                      OUT {idx + 1}
                    </button>
                  ))}
                </div>
              )}

              {['constant', 'input', 'variable', 'query', 'filter', 'lookup', 'setLineItem', 'setHeader'].includes(node.type) && (
                <input
                  value={node.data.config.value ?? ''}
                  placeholder="value / expression"
                  onClick={(ev) => ev.stopPropagation()}
                  onChange={(ev) =>
                    setNodes((prev) =>
                      prev.map((item) =>
                        item.id === node.id
                          ? { ...item, data: { ...item.data, config: { ...item.data.config, value: ev.target.value } } }
                          : item
                      )
                    )
                  }
                />
              )}
            </article>
          ))}

          {!nodes.length && (
            <div className="canvas-empty">
              <p>Formula Designer</p>
              <p className="muted">Create logic graph by adding functions from the left panel.</p>
            </div>
          )}

          <div className="canvas-zoom-controls">
            <button className="btn btn-xs" type="button" onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.1).toFixed(2))))}>-</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button className="btn btn-xs" type="button" onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.1).toFixed(2))))}>+</button>
          </div>
        </main>

        <aside className="formula-builder-right">
          <h3>Properties</h3>
          {selectedNode ? (
            <div className="property-stack">
              <label>
                Node Type
                <input value={selectedNode.data.label} readOnly />
              </label>
              <label>
                Node ID
                <input value={selectedNode.id} readOnly />
              </label>
              <label>
                Configuration JSON
                <textarea
                  rows={8}
                  value={JSON.stringify(selectedNode.data.config, null, 2)}
                  onChange={(e) => updateSelectedNodeConfigText(e.target.value)}
                />
              </label>
            </div>
          ) : (
            <div className="empty">Select a node to configure.</div>
          )}

          <div className="property-summary">
            <h4>Strategy Info</h4>
            <p>Nodes: <strong>{nodes.length}</strong></p>
            <p>Connections: <strong>{connections.length}</strong></p>
            <p>Status: <strong>{connecting ? 'Connecting...' : 'Ready'}</strong></p>
            <p>Deploy: <strong>{deployStatus.toUpperCase()}</strong></p>
          </div>

          {testOutput && (
            <div className="property-output">
              <h4>Test Output</h4>
              <pre>{testOutput}</pre>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
