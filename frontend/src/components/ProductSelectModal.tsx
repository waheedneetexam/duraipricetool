import { useMemo, useState } from 'react';
import type { MasterProduct } from '../api/types';

type Props = {
  products: MasterProduct[];
  onSelect: (product: MasterProduct) => void;
  onClose: () => void;
};

const PAGE_SIZE = 10;

export function ProductSelectModal({ products, onSelect, onClose }: Props) {
  const [page, setPage] = useState(1);

  const activeProducts = useMemo(
    () => products.filter((product) => product.active ?? true),
    [products]
  );

  const totalPages = Math.max(1, Math.ceil(activeProducts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageItems = activeProducts.slice(startIndex, startIndex + PAGE_SIZE);

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ width: '900px', maxWidth: '95vw' }}>
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
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Select Product</div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px' }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
            Showing {pageItems.length} of {activeProducts.length} products
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            <table className="simulator-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Name</th>
                  <th style={{ textAlign: 'left' }}>SKU</th>
                  <th style={{ textAlign: 'left' }}>Category</th>
                  <th style={{ textAlign: 'left' }}>List Price</th>
                  <th style={{ width: '120px' }}></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>
                      No products found.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((product) => (
                    <tr key={product.product_id}>
                      <td>{product.name}</td>
                      <td>{product.sku}</td>
                      <td>{product.category || '-'}</td>
                      <td>{typeof product.price === 'number' ? `$${product.price.toFixed(2)}` : '-'}</td>
                      <td>
                        <button
                          className="btn btn-xs"
                          type="button"
                          onClick={() => onSelect(product)}
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div
          className="modal-footer"
          style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', background: '#f8fafc' }}
        >
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Page {safePage} of {totalPages}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-xs" type="button" onClick={goPrev} disabled={safePage <= 1}>
              Prev
            </button>
            <button className="btn btn-xs" type="button" onClick={goNext} disabled={safePage >= totalPages}>
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
