import { useState } from 'react';
import { QuoteList } from './components/QuoteList';
import { PricingTableWithTabs } from './components/PricingTableWithTabs';
import { AdminScreen } from './components/AdminScreen';

type View = 'quotes' | 'pricing' | 'admin';

export function App() {
  const [view, setView] = useState<View>('quotes');
  const [editingQuoteId, setEditingQuoteId] = useState<string | undefined>(undefined);

  function onCreateNew() {
    setEditingQuoteId(undefined);
    setView('pricing');
  }

  function onEditQuote(id: string) {
    setEditingQuoteId(id);
    setView('pricing');
  }

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="brand-block">
          <h1>Enterprise Pricing System</h1>
          <p>CPQ / Pricing Optimization</p>
        </div>
        {view !== 'pricing' && (
          <nav className="top-links">
            <button className={view === 'quotes' ? 'active' : ''} onClick={() => setView('quotes')}>Quotes</button>
            <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>Admin</button>
          </nav>
        )}
      </header>

      <main className="main-area">
        {view === 'quotes' && <QuoteList onCreateNew={onCreateNew} onEditQuote={onEditQuote} />}
        {view === 'pricing' && <PricingTableWithTabs quoteId={editingQuoteId} onBack={() => setView('quotes')} />}
        {view === 'admin' && <AdminScreen />}
      </main>
    </div>
  );
}
