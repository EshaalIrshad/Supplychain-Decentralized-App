import React, { useState } from "react";
import { Contract } from "ethers";
import { useWallet } from "../context/WalletContext";
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  ROLE_NUMS,
  API_BASE,
} from "../contract";
import "./Dashboard.css";

// Roles a user can select when self-registering
const ASSIGNABLE_ROLES = [
  "Manufacturer",
  "Distributor",
  "Retailer",
  "Consumer",
];

function Dashboard() {
  const { account, role, connectWallet, refreshRole, getProvider } =
    useWallet();

  // ── Role assignment state ──────────────────────────────────
  const [selectedRole, setSelectedRole] = useState("Manufacturer");
  const [roleStatus, setRoleStatus] = useState("");
  const [roleLoading, setRoleLoading] = useState(false);

  // ── Register product state ─────────────────────────────────
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [regStatus, setRegStatus] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  // ── 1. Assign role on-chain via MetaMask ───────────────────
  const [targetAddress, setTargetAddress] = useState("");

  const handleAssignRole = async () => {
    if (!account) {
      setRoleStatus("error:Connect your wallet first.");
      return;
    }
    const addr = targetAddress.trim() || account;
    if (!addr || addr.length !== 42 || !addr.startsWith("0x")) {
      setRoleStatus("error:Enter a valid target wallet address.");
      return;
    }

    setRoleLoading(true);
    setRoleStatus(
      "info:Waiting for MetaMask… (your wallet must be the contract owner)",
    );

    try {
      const provider = getProvider();
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const roleNum = ROLE_NUMS[selectedRole];
      // assignRole is restricted to the contract owner (deployer wallet)
      const tx = await contract.assignRole(addr, roleNum);
      setRoleStatus("info:Transaction submitted, waiting for confirmation…");
      await tx.wait();

      // Tell the backend to create/update the off-chain profile
      // (backend will verify the role on-chain before saving)
      await fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: account }),
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await refreshRole(); // re-fetch role from chain via WalletContext
      setRoleStatus(`success:Role set to ${selectedRole} on blockchain.`);
    } catch (err) {
      console.error(err);
      setRoleStatus(
        "error:" + (err.reason || err.message || "Transaction failed."),
      );
    } finally {
      setRoleLoading(false);
    }
  };

  // ── 2. Register product: MetaMask signs → backend records ──
  const handleRegisterProduct = async () => {
    if (!account) {
      setRegStatus("error:Connect your wallet first.");
      return;
    }
    if (role !== "Manufacturer") {
      setRegStatus(
        "error:Only Manufacturers can register products. Assign the Manufacturer role first.",
      );
      return;
    }
    if (!productId || !productName) {
      setRegStatus("error:Product ID and Product Name are required.");
      return;
    }
    if (isNaN(Number(productId)) || Number(productId) <= 0) {
      setRegStatus("error:Product ID must be a positive number.");
      return;
    }

    setRegLoading(true);
    setRegStatus("info:Waiting for MetaMask…");

    try {
      const provider = getProvider();
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      // Step 1: Call RegisterProduct (capital R) on the blockchain
      const tx = await contract.RegisterProduct(Number(productId), productName);
      setRegStatus("info:Transaction submitted, waiting for confirmation…");
      const receipt = await tx.wait();

      setRegStatus("info:Confirmed on blockchain. Saving metadata to backend…");

      // Step 2: Send tx hash + off-chain metadata to backend
      const res = await fetch(`${API_BASE}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: Number(productId),
          name: productName,
          tx_hash: receipt.hash,
          manufacturer_wallet: account,
          description: description || undefined,
          category: category || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Blockchain tx succeeded — just metadata save failed
        setRegStatus(
          `warning:Product registered on blockchain (tx: ${receipt.hash.slice(0, 10)}…) but metadata save failed: ${data.error}`,
        );
      } else {
        setRegStatus(
          `success:Product #${productId} registered! TX: ${receipt.hash.slice(0, 10)}…`,
        );
        // Clear form
        setProductId("");
        setProductName("");
        setDescription("");
        setCategory("");
      }
    } catch (err) {
      console.error(err);
      const msg = err.reason || err.message || "Transaction failed.";
      setRegStatus("error:" + msg);
    } finally {
      setRegLoading(false);
    }
  };

  // ── Helper: split "type:message" status strings ────────────
  const parseStatus = (s) => {
    if (!s) return null;
    const [type, ...rest] = s.split(":");
    return { type, msg: rest.join(":") };
  };
  const regParsed = parseStatus(regStatus);
  const roleParsed = parseStatus(roleStatus);

  return (
    <div className="dashboard-wrapper">
      <h1 className="page-title">Supply Chain Dashboard</h1>

      {/* ── Wallet panel ─────────────────────────────────── */}
      {!account && (
        <div
          className="card dashboard-card"
          style={{ marginBottom: 24, maxWidth: 500 }}
        >
          <p className="section-title">Get started</p>
          <p
            style={{ marginBottom: 16, color: "#c5c8e0", fontSize: "0.92rem" }}
          >
            Connect your MetaMask wallet to register products or assign roles.
            Make sure MetaMask is set to <strong>Localhost 8545</strong>{" "}
            (Hardhat).
          </p>
          <button className="btn-primary" onClick={connectWallet}>
            Connect Wallet
          </button>
        </div>
      )}

      {/* ── Two-column layout once connected ─────────────── */}
      {account && (
        <div className="dashboard-grid">
          {/* Left: Assign role */}
          <div className="card dashboard-card">
            <p className="section-title">Assign your role</p>
            <p
              style={{
                fontSize: "0.85rem",
                color: "#c5c8e0",
                marginBottom: 12,
              }}
            >
              Your current on-chain role:{" "}
              <strong style={{ color: "#f0ad4e" }}>{role || "None"}</strong>
            </p>
            <div
              className="status-box info"
              style={{
                marginBottom: 14,
                fontSize: "0.82rem",
                textAlign: "left",
              }}
            >
              <strong>Note:</strong> Only the contract owner (deployer wallet)
              can assign roles. If you need a role assigned, ask the admin to
              call <code>assignRole(yourAddress, roleNumber)</code>— or if you
              are the deployer, use the admin panel below.
            </div>

            <div className="form-row" style={{ marginBottom: 16 }}>
              <label>Assign role to</label>
              <input
                type="text"
                placeholder="0x... wallet address"
                value={targetAddress}
                onChange={(e) => setTargetAddress(e.target.value)}
                style={{ fontFamily: "monospace", fontSize: "0.82rem" }}
              />
            </div>
            <div className="form-row" style={{ marginBottom: 16 }}>
              <label>Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>

            <button
              className="btn-primary"
              onClick={handleAssignRole}
              disabled={roleLoading}
            >
              {roleLoading && <span className="spinner" />}
              Assign Role (owner only)
            </button>

            {roleParsed && (
              <div
                className={`status-box ${roleParsed.type}`}
                style={{ marginTop: 14 }}
              >
                {roleParsed.msg}
              </div>
            )}
          </div>

          {/* Right: Register product */}
          <div className="card dashboard-card">
            <p className="section-title">Register product</p>
            <p
              style={{
                fontSize: "0.85rem",
                color: "#c5c8e0",
                marginBottom: 16,
              }}
            >
              Only wallets with the <strong>Manufacturer</strong> role can
              register products.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div className="form-row">
                <label>Product ID</label>
                <input
                  type="number"
                  placeholder="e.g. 1001"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label>Product Name</label>
                <input
                  type="text"
                  placeholder="e.g. Laptop X200"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label>Description</label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label>Category</label>
                <input
                  type="text"
                  placeholder="Optional (e.g. Electronics)"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
            </div>

            <button
              className="btn-primary"
              onClick={handleRegisterProduct}
              disabled={regLoading}
            >
              {regLoading && <span className="spinner" />}
              Register Product
            </button>

            {regParsed && (
              <div
                className={`status-box ${regParsed.type}`}
                style={{ marginTop: 14 }}
              >
                {regParsed.msg}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
