import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE } from '../contract';
import './ProductHistory.css';

// Stage order for the progress bar
const STAGE_ORDER = ['Registered', 'Manufactured', 'Shipped', 'Delivered', 'Sold'];

function ProductHistory() {
  const location = useLocation();
  const navigate = useNavigate();

  // productId passed from ProductDetails or VerifyProduct
  const { productId } = location.state || {};

  const [searchId, setSearchId]   = useState(productId ? String(productId) : '');
  const [history, setHistory]     = useState(null);   // array from blockchain
  const [owner, setOwner]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  // Auto-load if we arrived with a productId
  useEffect(() => {
    if (productId) fetchHistory(productId);
  }, [productId]);

  const fetchHistory = async (id) => {
    setLoading(true);
    setError('');
    setHistory(null);
    setOwner('');

    try {
      const res  = await fetch(`${API_BASE}/products/${id}/history`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Product not found.');
        return;
      }
      setHistory(data.history);
      setOwner(data.owner);
    } catch {
      setError('Could not reach the backend. Is Flask running?');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const id = searchId.trim();
    if (!id || isNaN(Number(id))) {
      setError('Please enter a valid numeric Product ID.');
      return;
    }
    fetchHistory(Number(id));
  };

  // Derive latest stage from history array
  const latestStage = history && history.length > 0
    ? history[history.length - 1].stage
    : null;

  const latestStageIndex = latestStage ? STAGE_ORDER.indexOf(latestStage) : -1;

  return (
    <div className="history-wrapper">
      <h1 className="page-title">Product History</h1>

      {/* Search bar */}
      <div className="card history-card">
        <p className="section-title">Search by product ID</p>
        <div className="history-search-row">
          <input
            type="number"
            placeholder="Enter Product ID"
            value={searchId}
            onChange={e => setSearchId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn-primary" onClick={handleSearch} disabled={loading}>
            {loading ? <><span className="spinner" />Loading…</> : 'Load History'}
          </button>
        </div>
        {error && <div className="status-box error" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {/* Progress bar */}
      {history && latestStage && (
        <div className="card history-card">
          <p className="section-title">Stage progress</p>
          <div className="progress-track">
            {STAGE_ORDER.map((stage, i) => {
              const done    = i <= latestStageIndex;
              const current = i === latestStageIndex;
              return (
                <React.Fragment key={stage}>
                  <div className={`progress-node ${done ? 'done' : ''} ${current ? 'current' : ''}`}>
                    <div className="progress-dot">{done ? '✓' : ''}</div>
                    <div className="progress-label">{stage}</div>
                  </div>
                  {i < STAGE_ORDER.length - 1 && (
                    <div className={`progress-line ${i < latestStageIndex ? 'done' : ''}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Current owner */}
      {owner && (
        <div className="card history-card">
          <p className="section-title">Current owner</p>
          <span className="mono-address">{owner}</span>
        </div>
      )}

      {/* Timeline */}
      {history && history.length > 0 && (
        <div className="card history-card">
          <p className="section-title">Full event timeline (from blockchain)</p>
          <div className="timeline">
            {history.map((entry, i) => (
              <div className="timeline-item" key={i}>
                <div className="timeline-left">
                  <div className="tl-dot" />
                  {i < history.length - 1 && <div className="tl-line" />}
                </div>
                <div className="timeline-body">
                  <div className="tl-stage">{entry.stage}</div>
                  <div className="tl-time">{formatTimestamp(entry.timestamp)}</div>
                  <div className="tl-address">
                    <span className="tl-addr-label">By:</span>
                    <span className="mono-address small">{entry.updater_address}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {history && history.length === 0 && (
        <div className="status-box warning">No history entries found for this product.</div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 680 }}>
        <button className="btn-secondary"
          onClick={() => navigate('/details', { state: { productId: Number(searchId) } })}>
          ← Back to Details
        </button>
        <button className="btn-secondary" onClick={() => navigate('/verify')}>
          Search Another Product
        </button>
      </div>
    </div>
  );
}

function formatTimestamp(ts) {
  if (!ts) return '—';
  // Blockchain timestamps are Unix seconds
  const date = new Date(Number(ts) * 1000);
  return date.toLocaleString();
}

export default ProductHistory;
