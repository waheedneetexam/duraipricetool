import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client';
import type { QuoteListItem } from '../api/types';

type QuoteListResponse = { success: boolean; data: QuoteListItem[] };

type Props = {
  onCreateNew: () => void;
  onEditQuote: (quoteId: string) => void;
};

export function QuoteList({ onCreateNew, onEditQuote }: Props) {
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  async function loadQuotes() {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch<QuoteListResponse>('/quotes/list');
      setQuotes(response.data ?? []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function deleteQuote(id: string) {
    if (!window.confirm('Delete this quote?')) return;
    try {
      await apiFetch<{ success: boolean }>(`/quotes/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await loadQuotes();
    } catch (err) {
      setError(String(err));
    }
  }

  useEffect(() => {
    void loadQuotes();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter((item) => {
      return (
        item.id.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.customerName || '').toLowerCase().includes(q)
      );
    });
  }, [quotes, search]);

  return (
    <section className="screen">
      <div className="screen-head">
        <div>
          <h2>All Quotes</h2>
          <p>{quotes.length} total quotes</p>
        </div>
        <button className="btn btn-primary" onClick={onCreateNew}>Create New Quote</button>
      </div>

      <div className="toolbar">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by quote id, description or customer"
        />
        <button className="btn" onClick={loadQuotes}>Refresh</button>
      </div>

      {loading && <div className="empty">Loading quotes...</div>}
      {!loading && error && <div className="error-box">{error}</div>}

      {!loading && !error && filtered.length === 0 && <div className="empty">No quotes found.</div>}

      {!loading && !error && filtered.length > 0 && (
        <div className="quote-grid">
          {filtered.map((quote) => (
            <article key={quote.id} className="quote-card" onClick={() => onEditQuote(quote.id)}>
              <div className="quote-card-head">
                <h3>{quote.id}</h3>
                <span className="badge">{quote.lineItemCount} items</span>
              </div>
              <p className="muted two-line">{quote.description || 'No description'}</p>
              <div className="kv"><span>Customer</span><strong>{quote.customerName || '-'}</strong></div>
              <div className="kv"><span>Total</span><strong>${quote.totalValue.toFixed(2)}</strong></div>
              <div className="kv"><span>Updated</span><strong>{new Date(quote.dateModified).toLocaleDateString()}</strong></div>
              <div className="card-actions">
                <button className="btn" onClick={(e) => { e.stopPropagation(); onEditQuote(quote.id); }}>Edit</button>
                <button className="btn btn-danger" onClick={(e) => { e.stopPropagation(); void deleteQuote(quote.id); }}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
