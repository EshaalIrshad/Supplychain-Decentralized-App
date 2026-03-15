import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../contract';
import './VerifyProduct.css';

function VerifyProduct() {
  const navigate = useNavigate();

  const [productId, setProductId] = useState('');
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);   // blockchain + metadata
  const [error, setError]         = useState('');

  const handleSearch = async () => {
    const id = productId.trim();
    if (!id || isNaN(Number(id))) {
      setError('Please enter a valid numeric Product ID.');
      return;
    }
    setError('');
    setResult(null);
    setLoading(true);

    try {
      const res  = await fetch(`${API_BASE}/products/${id}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Product not found on blockchain.');
        return;
      }
      setResult(data);
    } catch (err) {
      setError('Could not reach the backend. Is Flask running?');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleSearch(); };

  const goToDetails = () => {
    navigate('/details', { state: { productId: Number(productId), result } });
  };

  return (
    <div className="verify-wrapper">
      <h1 className="page-title">Verify Product</h1>

      {/* Search bar */}
      <div className="card verify-card">
        <p className="section-title">Look up a product by ID</p>
        <div className="verify-search-row">
          <input
            type="number"
            placeholder="Enter Product ID (e.g. 1001)"
            value={productId}
            onChange={e => setProductId(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="btn-primary" onClick={handleSearch} disabled={loading}>
            {loading ? <><span className="spinner" />Searching…</> : 'Search'}
          </button>
        </div>
        {error && <div className="status-box error" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {/* Results */}
      {result && (
        <div className="card verify-card verify-results">
          <p className="section-title">Product found</p>

          {/* Blockchain data — source of truth */}
          <div className="verify-section-label">Blockchain data (immutable)</div>
          <div className="verify-field-grid">
            <div className="vfield">
              <span className="vfield-label">Product ID</span>
              <span className="vfield-value">{result.blockchain_data.product_id}</span>
            </div>
            <div className="vfield">
              <span className="vfield-label">Name (on-chain)</span>
              <span className="vfield-value">{result.blockchain_data.name}</span>
            </div>
            <div className="vfield vfield-full">
              <span className="vfield-label">Current Owner</span>
              <span className="vfield-value mono">{result.blockchain_data.owner}</span>
            </div>
          </div>

          {/* Off-chain metadata */}
          {result.metadata && (
            <>
              <div className="verify-section-label" style={{ marginTop: 18 }}>Off-chain metadata</div>
              <div className="verify-field-grid">
                {result.metadata.description && (
                  <div className="vfield vfield-full">
                    <span className="vfield-label">Description</span>
                    <span className="vfield-value">{result.metadata.description}</span>
                  </div>
                )}
                {result.metadata.category && (
                  <div className="vfield">
                    <span className="vfield-label">Category</span>
                    <span className="vfield-value">{result.metadata.category}</span>
                  </div>
                )}
                {result.metadata.manufacturer_wallet && (
                  <div className="vfield vfield-full">
                    <span className="vfield-label">Manufacturer wallet</span>
                    <span className="vfield-value mono">{result.metadata.manufacturer_wallet}</span>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="verify-actions">
            <button className="btn-primary" onClick={goToDetails}>
              View Full Details &amp; History →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default VerifyProduct;
