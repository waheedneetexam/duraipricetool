import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client';

type FieldDefinition = { name: string; label: string; type?: 'text' | 'number' | 'checkbox' };

type EntityConfig = {
  key: 'products' | 'customers' | 'sellers';
  label: string;
  endpoint: string;
  idField: string;
  fields: FieldDefinition[];
};

const ENTITIES: EntityConfig[] = [
  {
    key: 'products',
    label: 'Products',
    endpoint: '/master/products',
    idField: 'product_id',
    fields: [
      { name: 'product_id', label: 'Product ID' },
      { name: 'sku', label: 'SKU' },
      { name: 'name', label: 'Name' },
      { name: 'family', label: 'Family' },
      { name: 'category', label: 'Category' },
      { name: 'price', label: 'Price', type: 'number' },
      { name: 'active', label: 'Active', type: 'checkbox' },
    ],
  },
  {
    key: 'customers',
    label: 'Customers',
    endpoint: '/master/customers',
    idField: 'customer_id',
    fields: [
      { name: 'customer_id', label: 'Customer ID' },
      { name: 'name', label: 'Name' },
      { name: 'account_number', label: 'Account #' },
      { name: 'segment', label: 'Segment' },
      { name: 'region', label: 'Region' },
      { name: 'industry', label: 'Industry' },
      { name: 'active', label: 'Active', type: 'checkbox' },
    ],
  },
  {
    key: 'sellers',
    label: 'Sellers',
    endpoint: '/master/sellers',
    idField: 'seller_id',
    fields: [
      { name: 'seller_id', label: 'Seller ID' },
      { name: 'name', label: 'Name' },
      { name: 'territory', label: 'Territory' },
      { name: 'manager', label: 'Manager' },
      { name: 'active', label: 'Active', type: 'checkbox' },
    ],
  },
];

const blankForm = (fields: FieldDefinition[]) =>
  fields.reduce<Record<string, string | boolean>>((acc, field) => {
    acc[field.name] = field.type === 'checkbox' ? true : '';
    return acc;
  }, {});

export function MasterDataManager() {
  const [activeEntityKey, setActiveEntityKey] = useState<EntityConfig['key']>('products');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const entity = useMemo(() => ENTITIES.find((e) => e.key === activeEntityKey) ?? ENTITIES[0], [activeEntityKey]);
  const [form, setForm] = useState<Record<string, string | boolean>>(blankForm(entity.fields));

  const loadItems = async () => {
    setLoading(true);
    try {
      const response = await apiFetch<{ success: boolean; data: any[] }>(entity.endpoint);
      if (response.success) {
        setItems(response.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setForm(blankForm(entity.fields));
    setSelectedId(null);
    void loadItems();
  }, [entity.endpoint]);

  function handleFieldChange(name: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = entity.fields.reduce<Record<string, any>>((acc, field) => {
        acc[field.name] = form[field.name];
        return acc;
      }, {});

      const method = selectedId ? 'PUT' : 'POST';
      const endpoint = selectedId ? `${entity.endpoint}/${selectedId}` : entity.endpoint;
      const response = await apiFetch<{ success: boolean; data: any }>(endpoint, {
        method,
        body: JSON.stringify(payload),
      });
      if (response.success) {
        await loadItems();
        setForm(blankForm(entity.fields));
        setSelectedId(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this record?')) return;
    await apiFetch<{ success: boolean }>(`${entity.endpoint}/${id}`, { method: 'DELETE' });
    await loadItems();
    if (selectedId === id) {
      setSelectedId(null);
      setForm(blankForm(entity.fields));
    }
  }

  function startEdit(item: any) {
    setSelectedId(item[entity.idField]);
    const nextForm = entity.fields.reduce<Record<string, string | boolean>>((acc, field) => {
      acc[field.name] = field.type === 'checkbox' ? !!item[field.name] : item[field.name] ?? '';
      return acc;
    }, {});
    setForm(nextForm);
  }

  return (
    <section className="panel-card master-data-panel">
      <h3>Master Data (Pricefx-style)</h3>
      <div className="entity-tabs">
        {ENTITIES.map((entityConfig) => (
          <button
            key={entityConfig.key}
            className={`btn ${entityConfig.key === activeEntityKey ? 'btn-primary' : ''}`}
            onClick={() => setActiveEntityKey(entityConfig.key)}
          >
            {entityConfig.label}
          </button>
        ))}
      </div>
      <div className="master-table">
        <table>
          <thead>
            <tr>
              {entity.fields.map((field) => (
                <th key={field.name}>{field.label}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row[entity.idField]}>
                {entity.fields.map((field) => (
                  <td key={`${row[entity.idField]}-${field.name}`}>
                    {field.type === 'checkbox' ? (row[field.name] ? 'Yes' : 'No') : row[field.name]}
                  </td>
                ))}
                <td>
                  <button className="btn btn-xs" type="button" onClick={() => startEdit(row)}>
                    Edit
                  </button>
                  <button className="btn btn-danger btn-xs" type="button" onClick={() => handleDelete(row[entity.idField])}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={entity.fields.length + 1} className="empty">
                  {loading ? 'Loading…' : 'No records yet'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="form-grid">
        {entity.fields.map((field) => {
          const value = form[field.name];
          return (
            <label key={field.name}>
              {field.label}
              {field.type === 'checkbox' ? (
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                />
              ) : (
                <input
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={String(value ?? '')}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                />
              )}
            </label>
          );
        })}
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : selectedId ? 'Update' : 'Create'}
        </button>
        {selectedId && (
          <button
            className="btn"
            type="button"
            onClick={() => {
              setSelectedId(null);
              setForm(blankForm(entity.fields));
            }}
          >
            Clear
          </button>
        )}
      </div>
    </section>
  );
}
