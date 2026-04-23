import React, { useMemo, useState } from "react";
import Head from "next/head";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { Loader } from "../components/Loader";
import { useAppContext } from "../context/AppContext";
import { api } from "../services/api";

type DayOption = "30" | "60" | "90";

type FormState = {
  smeAddress: string;
  smeName: string;
  smeCategory: string;
  days: DayOption;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

type ParsedProof = {
  smeName: string;
  smeAddress: string;
  category: string;
  days: number;
  netRevenue: number;
  txCount: number;
  verified: boolean;
};

const DEFAULT_FORM: FormState = {
  smeAddress: "0x0000000000000000000000000000000000000001",
  smeName: "BlueSME Business",
  smeCategory: "Blue Economy SME",
  days: "90",
};

function extractProof(raw: string): ParsedProof | null {
  const smeMatch = raw.match(/SME:\s*(.+)\s*\((0x[a-fA-F0-9]{40})\)/);
  const categoryMatch = raw.match(/Category:\s*(.+)/);
  const daysMatch = raw.match(/Days:\s*(\d+)/);
  const revenueMatch = raw.match(/Revenue:\s*[\w\s]*?([\d,]+)/i);
  const txMatch = raw.match(/Transactions?:\s*(\d+)/i);

  if (!smeMatch || !categoryMatch || !daysMatch) return null;

  return {
    smeName: smeMatch[1].trim(),
    smeAddress: smeMatch[2].trim(),
    category: categoryMatch[1].trim(),
    days: Number(daysMatch[1]),
    netRevenue: revenueMatch ? Number(revenueMatch[1].replace(/,/g, "")) : 0,
    txCount: txMatch ? Number(txMatch[1]) : 0,
    verified: raw.toLowerCase().includes("verified") || raw.toLowerCase().includes("blockchain"),
  };
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.smeAddress.trim()) errors.smeAddress = "SME address is required.";
  else if (!form.smeAddress.trim().startsWith("0x"))
    errors.smeAddress = "Address must start with 0x.";
  if (!form.smeName.trim()) errors.smeName = "SME name is required.";
  if (!form.smeCategory.trim()) errors.smeCategory = "Category is required.";
  if (!["30", "60", "90"].includes(form.days)) errors.days = "Select 30, 60, or 90 days.";
  return errors;
}

function ProofMetricCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      style={{
        background: `${accent}0f`,
        border: `1px solid ${accent}30`,
        borderRadius: 14,
        padding: "16px 20px",
        flex: "1 1 140px",
      }}
    >
      <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9", marginBottom: 2 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
        {label}
      </div>
    </motion.div>
  );
}

export default function ProofPage() {
  const { addToast, addActivity } = useAppContext();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const parsed = useMemo(() => extractProof(result), [result]);
  const isError = result.startsWith("[ERROR]");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const res = await api.generateProof({
        smeAddress: form.smeAddress,
        smeName: form.smeName,
        smeCategory: form.smeCategory,
        days: Number(form.days) as 30 | 60 | 90,
      });
      setResult(res.output);
      setLastRun(new Date());
      addActivity({
        actionType: "Generate Proof",
        status: "success",
        summary: `Proof for ${form.smeName} · ${form.days}-day window · ${res.testMode ? "Test" : "Live"}`,
      });
      addToast({ type: "success", title: "Proof Generated ✅", message: "Blockchain-verified proof is ready." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Proof generation failed.";
      setResult(`[ERROR] ${msg}`);
      setLastRun(new Date());
      addActivity({ actionType: "Generate Proof", status: "error", summary: `Failed: ${msg}` });
      addToast({ type: "error", title: "Proof Failed", message: msg });
    } finally {
      setLoading(false);
    }
  };

  const onReset = () => {
    setForm(DEFAULT_FORM);
    setErrors({});
    setResult("");
    setLastRun(null);
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bluesme-proof-${form.smeName.replace(/\s+/g, "-").toLowerCase()}-${form.days}d.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({ type: "info", title: "Downloading", message: "Proof report downloaded." });
  };

  const handleViewOnChain = () => {
    addToast({ type: "info", title: "On-Chain View", message: "Blockchain explorer integration coming soon." });
  };

  const inputStyle = (hasError?: boolean) => ({
    width: "100%",
    padding: "11px 14px",
    borderRadius: 10,
    border: `1px solid ${hasError ? "#ef4444" : "rgba(148,163,184,0.15)"}`,
    background: "rgba(15,23,42,0.6)",
    color: "#f1f5f9",
    fontSize: 13,
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
    fontFamily: "inherit",
  });

  return (
    <>
      <Head>
        <title>BlueSME — Generate Proof</title>
        <meta name="description" content="Generate blockchain-verified funding proof for your SME via BlueSME." />
      </Head>
      <Layout>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em", marginBottom: 4 }}
              >
                📋 Generate Proof
              </motion.h1>
              <p style={{ fontSize: 13, color: "#64748b" }}>
                Create lender-ready blockchain-verified funding proof
              </p>
            </div>
            <StatusBadge />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="proof-grid">
          {/* Left: Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{
              background: "rgba(30,41,59,0.6)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(148,163,184,0.1)",
              borderRadius: 16,
              padding: "24px",
            }}
          >
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 20 }}>
              SME Information
            </h2>
            <form onSubmit={onSubmit} noValidate>
              {/* SME Address */}
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="proof-sme-address" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  SME Address
                </label>
                <input
                  id="proof-sme-address"
                  value={form.smeAddress}
                  onChange={(e) => setForm((p) => ({ ...p, smeAddress: e.target.value }))}
                  placeholder="0x..."
                  style={inputStyle(!!errors.smeAddress)}
                  onFocus={(e) => { e.target.style.borderColor = "#10b981"; e.target.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.15)"; }}
                  onBlur={(e) => { e.target.style.borderColor = errors.smeAddress ? "#ef4444" : "rgba(148,163,184,0.15)"; e.target.style.boxShadow = "none"; }}
                  aria-invalid={!!errors.smeAddress}
                />
                {errors.smeAddress && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{errors.smeAddress}</p>}
              </div>

              {/* SME Name */}
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="proof-sme-name" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  SME Name
                </label>
                <input
                  id="proof-sme-name"
                  value={form.smeName}
                  onChange={(e) => setForm((p) => ({ ...p, smeName: e.target.value }))}
                  placeholder="BlueSME Business"
                  style={inputStyle(!!errors.smeName)}
                  onFocus={(e) => { e.target.style.borderColor = "#10b981"; e.target.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.15)"; }}
                  onBlur={(e) => { e.target.style.borderColor = errors.smeName ? "#ef4444" : "rgba(148,163,184,0.15)"; e.target.style.boxShadow = "none"; }}
                  aria-invalid={!!errors.smeName}
                />
                {errors.smeName && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{errors.smeName}</p>}
              </div>

              {/* Category + Days */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div>
                  <label htmlFor="proof-category" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Category
                  </label>
                  <select
                    id="proof-category"
                    value={form.smeCategory}
                    onChange={(e) => setForm((p) => ({ ...p, smeCategory: e.target.value }))}
                    style={{ ...inputStyle(), appearance: "none" as const }}
                    onFocus={(e) => { e.target.style.borderColor = "#10b981"; e.target.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.15)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "rgba(148,163,184,0.15)"; e.target.style.boxShadow = "none"; }}
                  >
                    <option>Blue Economy SME</option>
                    <option>fisheries</option>
                    <option>marine_tourism</option>
                    <option>boat_operations</option>
                    <option>aquaculture</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="proof-days" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Period (Days)
                  </label>
                  <select
                    id="proof-days"
                    value={form.days}
                    onChange={(e) => setForm((p) => ({ ...p, days: e.target.value as DayOption }))}
                    style={{ ...inputStyle(!!errors.days), appearance: "none" as const }}
                    aria-invalid={!!errors.days}
                    onFocus={(e) => { e.target.style.borderColor = "#10b981"; e.target.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.15)"; }}
                    onBlur={(e) => { e.target.style.borderColor = errors.days ? "#ef4444" : "rgba(148,163,184,0.15)"; e.target.style.boxShadow = "none"; }}
                  >
                    <option value="30">30 Days</option>
                    <option value="60">60 Days</option>
                    <option value="90">90 Days</option>
                  </select>
                  {errors.days && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{errors.days}</p>}
                </div>
              </div>

              <motion.button
                type="submit"
                id="btn-generate-proof"
                disabled={loading}
                whileHover={!loading ? { scale: 1.02 } : {}}
                whileTap={!loading ? { scale: 0.98 } : {}}
                style={{
                  width: "100%",
                  background: loading ? "rgba(16,185,129,0.15)" : "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.4)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  color: "#10b981",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.15s",
                }}
              >
                {loading && <Loader size={16} color="#10b981" />}
                {loading ? "Generating..." : "Generate Funding Proof"}
              </motion.button>

              {lastRun && (
                <p style={{ fontSize: 11, color: "#475569", marginTop: 12 }}>
                  Last run: {lastRun.toLocaleString("en-KE")}
                </p>
              )}
            </form>
          </motion.div>

          {/* Right: Results */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            {/* Proof metrics */}
            <AnimatePresence>
              {parsed && !isError ? (
                <motion.div
                  key="proof-result"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    background: "rgba(16,185,129,0.06)",
                    border: "1px solid rgba(16,185,129,0.2)",
                    borderRadius: 16,
                    padding: "20px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <span style={{ fontSize: 18 }}>✅</span>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#10b981" }}>
                      Blockchain Verified
                    </h3>
                    <span style={{ fontSize: 18, marginLeft: "auto" }}>🔒</span>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                    <ProofMetricCard icon="💰" label="Net Revenue" value={parsed.netRevenue > 0 ? `KES ${parsed.netRevenue.toLocaleString("en-KE")}` : "—"} accent="#10b981" />
                    <ProofMetricCard icon="📝" label="Transactions" value={parsed.txCount > 0 ? String(parsed.txCount) : "—"} accent="#0ea5e9" />
                    <ProofMetricCard icon="📅" label="Period" value={`${parsed.days} Days`} accent="#8b5cf6" />
                  </div>

                  <div
                    style={{
                      background: "rgba(15,23,42,0.4)",
                      border: "1px solid rgba(148,163,184,0.08)",
                      borderRadius: 10,
                      padding: "12px 14px",
                      fontSize: 12,
                      color: "#64748b",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span>SME</span><span style={{ color: "#94a3b8", fontWeight: 600 }}>{parsed.smeName}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span>Category</span><span style={{ color: "#94a3b8", fontWeight: 600 }}>{parsed.category}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Address</span>
                      <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: 10 }}>
                        {parsed.smeAddress.slice(0, 10)}…{parsed.smeAddress.slice(-6)}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    <button
                      id="btn-download-proof"
                      onClick={handleDownload}
                      style={{
                        flex: 1,
                        background: "rgba(14,165,233,0.12)",
                        border: "1px solid rgba(14,165,233,0.3)",
                        borderRadius: 8,
                        padding: "10px 14px",
                        color: "#0ea5e9",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      ⬇️ Download
                    </button>
                    <button
                      id="btn-view-onchain"
                      onClick={handleViewOnChain}
                      style={{
                        flex: 1,
                        background: "rgba(139,92,246,0.12)",
                        border: "1px solid rgba(139,92,246,0.3)",
                        borderRadius: 8,
                        padding: "10px 14px",
                        color: "#8b5cf6",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      ⛓️ View On-Chain
                    </button>
                  </div>
                </motion.div>
              ) : !result ? (
                /* Empty state */
                <div
                  style={{
                    background: "rgba(30,41,59,0.4)",
                    border: "1px solid rgba(148,163,184,0.08)",
                    borderRadius: 16,
                    padding: "48px 24px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 48 }}>📋</span>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#475569" }}>
                    No Proof Generated Yet
                  </h3>
                  <p style={{ fontSize: 12, color: "#334155", maxWidth: 240, lineHeight: 1.5 }}>
                    Fill in the SME details and click "Generate Funding Proof" to create a blockchain-verified report.
                  </p>
                </div>
              ) : null}
            </AnimatePresence>

            {/* Verification readiness */}
            <div
              style={{
                background: "rgba(30,41,59,0.6)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(148,163,184,0.1)",
                borderRadius: 16,
                padding: "18px 20px",
              }}
            >
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 12 }}>
                Verification Readiness
              </h3>
              {[
                { label: "SME Identified", ok: !!form.smeAddress && form.smeAddress.startsWith("0x") },
                { label: "Name Provided", ok: !!form.smeName.trim() },
                { label: "Category Set", ok: !!form.smeCategory.trim() },
                { label: "Period Selected", ok: ["30", "60", "90"].includes(form.days) },
                { label: "Proof Generated", ok: !!parsed && !isError },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 0",
                    borderBottom: "1px solid rgba(148,163,184,0.05)",
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{item.ok ? "✅" : "○"}</span>
                  <span style={{ color: item.ok ? "#94a3b8" : "#475569" }}>{item.label}</span>
                </div>
              ))}
            </div>

            {/* Raw response for error */}
            {isError && (
              <div
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: 16,
                  padding: "16px 20px",
                }}
              >
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", marginBottom: 8 }}>❌ Error</h4>
                <pre style={{ fontSize: 11, color: "#fca5a5", lineHeight: 1.6, fontFamily: "'SF Mono', monospace" }}>
                  {result}
                </pre>
                <button
                  id="btn-retry-proof"
                  onClick={() => document.getElementById("btn-generate-proof")?.click()}
                  style={{
                    marginTop: 10,
                    background: "rgba(239,68,68,0.12)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 8,
                    padding: "8px 14px",
                    color: "#ef4444",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  🔄 Retry
                </button>
              </div>
            )}
          </motion.div>
        </div>

        <style>{`
          @media (max-width: 900px) { .proof-grid { grid-template-columns: 1fr !important; } }
          input, select { color-scheme: dark; }
        `}</style>
      </Layout>
    </>
  );
}
