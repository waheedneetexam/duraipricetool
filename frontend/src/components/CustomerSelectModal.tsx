import { useMemo, useState } from 'react';
import type { MasterCustomer } from '../api/types';

type Props = {
  customers: MasterCustomer[];
  onSelect: (customer: MasterCustomer) => void;
  onClose: () => void;
};

const PAGE_SIZE = 10;

export function CustomerSelectModal({ customers, onSelect, onClose }: Props) {
  const [page, setPage] = useState(1);

  const activeCustomers = useMemo(
    () => customers.filter((customer) => customer.active ?? true),
    [customers]
  );

  const totalPages = Math.max(1, Math.ceil(activeCustomers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageItems = activeCustomers.slice(startIndex, startIndex + PAGE_SIZE);

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ width: '860px', maxWidth: '95vw' }}>
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
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Select Customer</div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px' }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
            Showing {pageItems.length} of {activeCustomers.length} customers
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            <table className="simulator-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Name</th>
                  <th style={{ textAlign: 'left' }}>Customer ID</th>
                  <th style={{ textAlign: 'left' }}>Segment</th>
                  <th style={{ textAlign: 'left' }}>Region</th>
                  <th style={{ width: '120px' }}></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8' }}>
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((customer) => (
                    <tr key={customer.customer_id}>
                      <td>{customer.name}</td>
                      <td>{customer.customer_id}</td>
                      <td>{customer.segment || '-'}</td>
                      <td>{customer.region || '-'}</td>
                      <td>
                        <button
                          className="btn btn-xs"
                          type="button"
                          onClick={() => onSelect(customer)}
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
