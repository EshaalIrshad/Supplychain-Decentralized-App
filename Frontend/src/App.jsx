import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { WalletProvider, useWallet } from './context/WalletContext';

import Dashboard     from './pages/Dashboard';
import VerifyProduct from './pages/VerifyProduct';
import ProductDetails from './pages/ProductDetails';
import ProductHistory from './pages/ProductHistory';

import './App.css';

function Navbar() {
  const { account, role, connectWallet, error } = useWallet();

  return (
    <nav className="navbar">
      <span className="navbar-brand">⛓ Supply Chain DApp</span>

      <div className="navbar-links">
        <NavLink to="/"        className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Dashboard</NavLink>
        <NavLink to="/verify"  className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Verify Product</NavLink>
      </div>

      <div className="navbar-wallet">
        {account ? (
          <div className="wallet-info">
            <span className="role-badge">{role || 'No role'}</span>
            <span className="address-pill">
              {account.slice(0, 6)}…{account.slice(-4)}
            </span>
          </div>
        ) : (
          <button className="btn-connect" onClick={connectWallet}>Connect Wallet</button>
        )}
      </div>

      {error && <div className="navbar-error">{error}</div>}
    </nav>
  );
}

function App() {
  return (
    <WalletProvider>
      <Router>
        <Navbar />
        <div className="page-content">
          <Routes>
            <Route path="/"        element={<Dashboard />} />
            <Route path="/verify"  element={<VerifyProduct />} />
            <Route path="/details" element={<ProductDetails />} />
            <Route path="/history" element={<ProductHistory />} />
          </Routes>
        </div>
      </Router>
    </WalletProvider>
  );
}

export default App;
