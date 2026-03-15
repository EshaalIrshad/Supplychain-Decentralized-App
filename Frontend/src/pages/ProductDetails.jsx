import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Contract } from 'ethers';
import { useWallet } from '../context/WalletContext';
import { CONTRACT_ADDRESS, CONTRACT_ABI, NEXT_STAGES, STAGE_NUMS, API_BASE } from '../contract';
import './ProductDetails.css';

function ProductDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const { account, getProvider } = useWallet();

  // productId and initial result come from VerifyProduct via navigation state
  const { productId, result: initialResult } = location.state || {};

  const [product, setProduct]         = useState(initialResult || null);
  const [loading, setLoading]         = useState(!initialResult && !!productId);
  const [error, setError]             = useState('');

  // Stage update
  const [stageStatus, setStageStatus] = useState('');
  const [stageLoading, setStageLoading] = useState(false);

  // Transfer ownership
  const [newOwner, setNewOwner]       = useState('');
  const [transferStatus, setTransferStatus] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  // Fetch product if we don't already have it
  useEffect(() => {
    if (!productId) return;
    if (initialResult) { setProduct(initialResult); return; }

    const load = async () => {
      setLoading(true);
      try {
        const res  = await fetch(`${API_BASE}/products/${productId}`);
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Product not found.'); return; }
        setProduct(data);
      } catch {
        setError('Could not reach the backend.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [productId]);

  // Refresh product data from backend after a tx
  const refresh = async () => {
    const res  = await fetch(`${API_BASE}/products/${productId}`);
    const data = await res.json();
    if (res.ok) setProduct(data);
  };

  // Is the connected wallet the current owner?
  const isOwner = account &&
    product?.blockchain_data?.owner?.toLowerCase() === account.toLowerCase();

  // current_stage is returned by the backend GET /products/:id endpoint
  // which reads it directly from getCurrentStage() on the contract
  const currentStage = product?.blockchain_data?.current_stage || null;

  const nextStages = currentStage ? (NEXT_STAGES[currentStage] || []) : [];

  // ── Update stage ────────────────────────────────────────────
  const handleUpdateStage = async (nextStage) => {
    if (!account || !isOwner) return;
    setStageLoading(true);
    setStageStatus('info:Waiting for MetaMask…');

    try {
      const provider = getProvider();
      const signer   = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const stageNum = STAGE_NUMS[nextStage];
      const tx = await contract.updateStage(productId, stageNum);
      setStageStatus('info:Transaction submitted, waiting for confirmation…');
      const receipt = await tx.wait();

      // Tell backend to log the tx
      await fetch(`${API_BASE}/products/${productId}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx_hash: receipt.hash }),
      });

      setStageStatus(`success:Stage updated to ${nextStage}. TX: ${receipt.hash.slice(0,10)}…`);
      await refresh();
    } catch (err) {
      setStageStatus('error:' + (err.reason || err.message || 'Transaction failed.'));
    } finally {
      setStageLoading(false);
    }
  };

  // ── Transfer ownership ──────────────────────────────────────
  const handleTransfer = async () => {
    if (!account || !isOwner) return;
    if (!newOwner || newOwner.length !== 42 || !newOwner.startsWith('0x')) {
      setTransferStatus('error:Please enter a valid wallet address (0x...).');
      return;
    }

    setTransferLoading(true);
    setTransferStatus('info:Waiting for MetaMask…');

    try {
      const provider = getProvider();
      const signer   = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const tx = await contract.transferOwnership(productId, newOwner);
      setTransferStatus('info:Transaction submitted, waiting for confirmation…');
      const receipt = await tx.wait();

      await fetch(`${API_BASE}/products/${productId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx_hash: receipt.hash }),
      });

      setTransferStatus(`success:Ownership transferred. TX: ${receipt.hash.slice(0,10)}…`);
      setNewOwner('');
      await refresh();
    } catch (err) {
      setTransferStatus('error:' + (err.reason || err.message || 'Transaction failed.'));
    } finally {
      setTransferLoading(false);
    }
  };

  const parseStatus = (s) => {
    if (!s) return null;
    const [type, ...rest] = s.split(':');
    return { type, msg: rest.join(':') };
  };

  // ── Render ──────────────────────────────────────────────────

  if (!productId) {
    return (
      <div className="details-wrapper">
        <h1 className="page-title">Product Details</h1>
        <div className="card" style={{ maxWidth: 480, textAlign: 'center' }}>
          <p style={{ color: '#c5c8e0', marginBottom: 16 }}>No product selected. Go to Verify Product to look one up.</p>
          <button className="btn-primary" onClick={() => navigate('/verify')}>Go to Verify Product</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="details-wrapper">
        <h1 className="page-title">Product Details</h1>
        <div className="status-box info"><span className="spinner" />Loading product data…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="details-wrapper">
        <h1 className="page-title">Product Details</h1>
        <div className="status-box error">{error}</div>
        <button className="btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/verify')}>← Back</button>
      </div>
    );
  }

  const bc = product?.blockchain_data;
  const md = product?.metadata;
  const stageParsed    = parseStatus(stageStatus);
  const transferParsed = parseStatus(transferStatus);

  return (
    <div className="details-wrapper">
      <h1 className="page-title">Product Details</h1>

      {/* ── Blockchain data ─────────────────────────────── */}
      <div className="card details-card">
        <p className="section-title">Blockchain data (source of truth)</p>
        <div className="details-grid">
          <div className="dfield">
            <span className="dfield-label">Product ID</span>
            <span className="dfield-value">{bc?.product_id}</span>
          </div>
          <div className="dfield">
            <span className="dfield-label">Name (on-chain)</span>
            <span className="dfield-value">{bc?.name}</span>
          </div>
          <div className="dfield dfield-full">
            <span className="dfield-label">Current Owner</span>
            <span className="dfield-value mono">{bc?.owner}</span>
          </div>
          <div className="dfield">
            <span className="dfield-label">Current Stage</span>
            <span className="dfield-value">
              <span className="stage-badge">{currentStage || '—'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Off-chain metadata ──────────────────────────── */}
      {md && (
        <div className="card details-card">
          <p className="section-title">Off-chain metadata</p>
          <div className="details-grid">
            {md.description && (
              <div className="dfield dfield-full">
                <span className="dfield-label">Description</span>
                <span className="dfield-value">{md.description}</span>
              </div>
            )}
            {md.category && (
              <div className="dfield">
                <span className="dfield-label">Category</span>
                <span className="dfield-value">{md.category}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Owner actions ───────────────────────────────── */}
      {isOwner && (
        <>
          {/* Update stage */}
          {nextStages.length > 0 && (
            <div className="card details-card">
              <p className="section-title">Update stage</p>
              <p style={{ fontSize: '0.85rem', color: '#c5c8e0', marginBottom: 14 }}>
                You are the current owner. Advance to the next stage:
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {nextStages.map(s => (
                  <button
                    key={s}
                    className="btn-primary"
                    onClick={() => handleUpdateStage(s)}
                    disabled={stageLoading}
                  >
                    {stageLoading && <span className="spinner" />}
                    → {s}
                  </button>
                ))}
              </div>
              {stageParsed && (
                <div className={`status-box ${stageParsed.type}`} style={{ marginTop: 14 }}>
                  {stageParsed.msg}
                </div>
              )}
            </div>
          )}

          {/* Transfer ownership */}
          <div className="card details-card">
            <p className="section-title">Transfer ownership</p>
            <div className="form-row" style={{ marginBottom: 14 }}>
              <label>New owner wallet</label>
              <input
                type="text"
                placeholder="0x..."
                value={newOwner}
                onChange={e => setNewOwner(e.target.value)}
              />
            </div>
            <button
              className="btn-primary"
              onClick={handleTransfer}
              disabled={transferLoading}
            >
              {transferLoading && <span className="spinner" />}
              Transfer Ownership
            </button>
            {transferParsed && (
              <div className={`status-box ${transferParsed.type}`} style={{ marginTop: 14 }}>
                {transferParsed.msg}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Navigation ─────────────────────────────────── */}
      <div className="details-nav">
        <button className="btn-secondary" onClick={() => navigate('/verify')}>← Back to Search</button>
        <button className="btn-primary"   onClick={() => navigate('/history', { state: { productId } })}>
          View Full History →
        </button>
      </div>
    </div>
  );
}

export default ProductDetails;
