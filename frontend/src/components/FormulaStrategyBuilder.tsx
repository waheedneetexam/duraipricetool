import { MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type NodeCategory = 'MATH' | 'LOGIC' | 'DATA' | 'CONTROL' | 'IO';

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
  nodes: StrategyNode[];
  connections: Connection[];
  updatedAt: string;
};

const STORAGE_KEY = 'formula_builder_strategy_documents_v3';

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

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function createBlankStrategy(name = 'New Strategy'): StrategyDocument {
  return {
    id: makeId('strategy'),
    name,
    description: '',
    nodes: [],
    connections: [],
    updatedAt: new Date().toISOString()
  };
}

function getNodeColorClass(type: string): string {
  if (['add', 'subtract', 'multiply', 'divide', 'power', 'round', 'min', 'max'].includes(type)) return 'node-math';
  if (['if', 'equals', 'greater', 'less', 'and', 'or'].includes(type)) return 'node-logic';
  if (['query', 'filter', 'lookup', 'aggregate', 'getField'].includes(type)) return 'node-data';
  if (['forEach', 'while', 'map', 'reduce'].includes(type)) return 'node-control';
  return 'node-io';
}

export function FormulaStrategyBuilder() {
  const [strategyDocs, setStrategyDocs] = useState<StrategyDocument[]>([]);
  const [activeStrategyId, setActiveStrategyId] = useState('');

  const [nodes, setNodes] = useState<StrategyNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [strategyName, setStrategyName] = useState('New Strategy');
  const [strategyDescription, setStrategyDescription] = useState('');

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<NodeCategory[]>(['MATH', 'LOGIC', 'DATA', 'CONTROL', 'IO']);
  const [connecting, setConnecting] = useState<{ nodeId: string; outputIndex: number } | null>(null);
  const [zoom, setZoom] = useState(1);
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
    setNodes(activeDoc.nodes);
    setConnections(activeDoc.connections);
    setSelectedNodeId(null);
    setConnecting(null);
  }, [activeDoc]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  function persistCurrentToList(partial?: Partial<StrategyDocument>) {
    if (!activeStrategyId) return;
    setStrategyDocs((prev) => {
      const next = prev.map((doc) =>
        doc.id === activeStrategyId
          ? {
              ...doc,
              name: strategyName,
              description: strategyDescription,
              nodes,
              connections,
              updatedAt: new Date().toISOString(),
              ...partial
            }
          : doc
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
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
      ...node,
      id: makeId('node'),
      position: { x: node.position.x + 30, y: node.position.y + 30 },
      data: { ...node.data, config: { ...node.data.config } },
      inputs: [...node.inputs],
      outputs: [...node.outputs]
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
    setConnecting({ nodeId, outputIndex });
  };

  const completeConnection = (nodeId: string, inputIndex: number) => {
    if (!connecting || connecting.nodeId === nodeId) {
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

  const newStrategy = () => {
    const next = createBlankStrategy(`Strategy ${strategyDocs.length + 1}`);
    setStrategyDocs((prev) => {
      const updated = [...prev, next];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    setActiveStrategyId(next.id);
    setTestOutput('Created new strategy.');
  };

  const saveStrategy = () => {
    persistCurrentToList();
    setTestOutput('Strategy saved.');
  };

  const runTest = () => {
    const summary = {
      strategy: strategyName,
      nodeCount: nodes.length,
      connectionCount: connections.length,
      outputNodes: nodes.filter((node) => node.type === 'setLineItem' || node.type === 'setHeader').length,
      timestamp: new Date().toISOString()
    };
    setTestOutput(JSON.stringify(summary, null, 2));
  };

  const exportStrategy = () => {
    const strategy: StrategyDocument = {
      id: activeStrategyId || makeId('strategy'),
      name: strategyName,
      description: strategyDescription,
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
          updatedAt: new Date().toISOString()
        };
        setStrategyDocs((prev) => {
          const next = [...prev, imported];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });
        setActiveStrategyId(imported.id);
        setTestOutput('Strategy imported.');
      } catch {
        setTestOutput('Invalid strategy JSON. Import failed.');
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
          <button className="btn" type="button" onClick={newStrategy}>New Strategy</button>
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

              {['constant', 'input', 'variable', 'query', 'filter', 'lookup'].includes(node.type) && (
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
