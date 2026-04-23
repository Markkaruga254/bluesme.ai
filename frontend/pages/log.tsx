import React, { useMemo, useState } from "react";
import Head from "next/head";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { Loader } from "../components/Loader";
import { useAppContext } from "../context/AppContext";
import { api } from "../services/api";

type FormState = {
  smeAddress: string;
  saleMessage: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

type ParsedSalePayload = {
  event?: string;
  activity_type?: string;
  amount?: number;
  description?: string;
  category?: string;
  sme_address?: string;
};

const DEFAULT_SME = "0x0000000000000000000000000000000000000001";
const DEFAULT_MESSAGE = "nimeuza samaki 10kg kwa kes 4500";

const MOCK_PREVIEW: ParsedSalePayload = {
  event: "sale_logged",
  activity_type: "fisheries_sale",
  amount: 4500,
  description: "Fish sale – 10kg",
  category: "Blue Economy",
  sme_address: DEFAULT_SME,
};

function extractPayload(output: string): ParsedSalePayload | null {
  const trimmed = output.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      return JSON.parse(trimmed) as ParsedSalePayload;
    } catch {
      // fall through
    }
  }
  const match = output.match(/Payload:\s*(\{[\s\S]*\})/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as ParsedSalePayload;
  } catch {
    return null;
  }
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.smeAddress.trim()) errors.smeAddress = "SME address is required.";
  else if (!form.smeAddress.trim().startsWith("0x"))
    errors.smeAddress = "SME address must start with 0x.";
  if (!form.saleMessage.trim()) errors.saleMessage = "Sale message is required.";
  else if (form.saleMessage.trim().length < 5)
    errors.saleMessage = "Sale message is too short (min 5 chars).";
  return errors;
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px solid rgba(148,163,184,0.06)",
        alignItems: "flex-start",
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: "#64748b",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          flexShrink: 0,
          width: 120,
          paddingTop: 1,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, color: "#f1f5f9", fontWeight: 500, wordBreak: "break-all" }}>
        {value}
      </span>
    </div>
  );
}

export default function LogPage() {
  const { addToast, addActivity } = useAppContext();
  const [form, setForm] = useState<FormState>({
    smeAddress: DEFAULT_SME,
    saleMessage: DEFAULT_MESSAGE,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const parsed = useMemo(() => extractPayload(result), [result]);
  const preview = parsed ?? MOCK_PREVIEW;
  const isError = result.startsWith("[ERROR]");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const res = await api.logSale({
        smeAddress: form.smeAddress,
        saleMessage: form.saleMessage,
      });
      setResult(res.output);
      setLastRun(new Date());
      addActivity({
        actionType: "Log Sale",
        status: "success",
        summary: `Sale logged · ${res.testMode ? "Test Mode" : "Live"} · ${form.saleMessage.slice(0, 40)}`,
      });
      addToast({ type: "success", title: "Sale Logged ✅", message: "Transaction recorded successfully." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sale logging failed.";
      setResult(`[ERROR] ${msg}`);
      setLastRun(new Date());
      addActivity({ actionType: "Log Sale", status: "error", summary: `Failed: ${msg}` });
      addToast({ type: "error", title: "Log Sale Failed", message: msg });
    } finally {
      setLoading(false);
    }
  };

  const onReset = () => {
    setForm({ smeAddress: DEFAULT_SME, saleMessage: DEFAULT_MESSAGE });
    setErrors({});
    setResult("");
    setLastRun(null);
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
        <title>BlueSME — Log Sale</title>
        <meta name="description" content="Log a sale transaction on-chain for your SME via BlueSME." />
      </Head>
      <Layout>
        {/* Page header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em", marginBottom: 4 }}
              >
                🧾 Log Sale
              </motion.h1>
              <p style={{ fontSize: 13, color: "#64748b" }}>
                Capture a sale message and record it on-chain
              </p>
            </div>
            <StatusBadge />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="log-grid">
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
              Sale Details
            </h2>
            <form onSubmit={onSubmit} noValidate>
              <div style={{ marginBottom: 16 }}>
                <label
                  htmlFor="log-sme-address"
                  style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}
                >
                  SME Address
                </label>
                <input
                  id="log-sme-address"
                  value={form.smeAddress}
                  onChange={(e) => setForm((prev) => ({ ...prev, smeAddress: e.target.value }))}
                  placeholder="0x..."
                  style={inputStyle(!!errors.smeAddress)}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#0ea5e9";
                    e.target.style.boxShadow = "0 0 0 3px rgba(14,165,233,0.15)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = errors.smeAddress ? "#ef4444" : "rgba(148,163,184,0.15)";
                    e.target.style.boxShadow = "none";
                  }}
                  aria-invalid={!!errors.smeAddress}
                />
                {errors.smeAddress && (
                  <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{errors.smeAddress}</p>
                )}
              </div>

              <div style={{ marginBottom: 20 }}>
                <label
                  htmlFor="log-sale-message"
                  style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}
                >
                  Sale Message
                </label>
                <textarea
                  id="log-sale-message"
                  value={form.saleMessage}
                  onChange={(e) => setForm((prev) => ({ ...prev, saleMessage: e.target.value }))}
                  placeholder="nimeuza samaki 10kg kwa kes 4500"
                  rows={4}
                  style={{ ...inputStyle(!!errors.saleMessage), resize: "vertical" }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#0ea5e9";
                    e.target.style.boxShadow = "0 0 0 3px rgba(14,165,233,0.15)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = errors.saleMessage ? "#ef4444" : "rgba(148,163,184,0.15)";
                    e.target.style.boxShadow = "none";
                  }}
                  aria-invalid={!!errors.saleMessage}
                />
                {errors.saleMessage && (
                  <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{errors.saleMessage}</p>
                )}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <motion.button
                  type="submit"
                  id="btn-submit-sale"
                  disabled={loading}
                  whileHover={!loading ? { scale: 1.02 } : {}}
                  whileTap={!loading ? { scale: 0.98 } : {}}
                  style={{
                    flex: 1,
                    background: loading ? "rgba(14,165,233,0.3)" : "rgba(14,165,233,0.15)",
                    border: "1px solid rgba(14,165,233,0.4)",
                    borderRadius: 10,
                    padding: "11px 16px",
                    color: "#0ea5e9",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: loading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "all 0.15s",
                  }}
                >
                  {loading && <Loader size={16} color="#0ea5e9" />}
                  {loading ? "Processing..." : "Submit Sale Log"}
                </motion.button>

                <button
                  type="button"
                  id="btn-reset-sale"
                  onClick={onReset}
                  disabled={loading}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(148,163,184,0.15)",
                    borderRadius: 10,
                    padding: "11px 16px",
                    color: "#64748b",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  Reset
                </button>
              </div>
            </form>

            {lastRun && (
              <p style={{ fontSize: 11, color: "#475569", marginTop: 14 }}>
                Last run: {lastRun.toLocaleString("en-KE")}
              </p>
            )}
          </motion.div>

          {/* Right: Live Preview + Result */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            {/* Parsed Preview */}
            <div
              style={{
                background: "rgba(30,41,59,0.6)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(148,163,184,0.1)",
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid rgba(148,163,184,0.07)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", flex: 1 }}>
                  Live Parsed Preview
                </h3>
                {result && !isError && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#10b981",
                      background: "rgba(16,185,129,0.12)",
                      borderRadius: 99,
                      padding: "2px 8px",
                    }}
                  >
                    ✅ CONFIRMED
                  </span>
                )}
                {!result && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#f59e0b",
                      background: "rgba(245,158,11,0.12)",
                      borderRadius: 99,
                      padding: "2px 8px",
                    }}
                  >
                    PREVIEW
                  </span>
                )}
              </div>
              <div style={{ padding: "16px 20px" }}>
                {preview.event && <PreviewRow label="Event" value={preview.event} />}
                {preview.activity_type && <PreviewRow label="Type" value={preview.activity_type} />}
                {preview.amount !== undefined && (
                  <PreviewRow label="Amount" value={`KES ${Number(preview.amount).toLocaleString("en-KE")}`} />
                )}
                {preview.category && <PreviewRow label="Category" value={preview.category} />}
                {preview.description && <PreviewRow label="Description" value={preview.description} />}
                {preview.sme_address && (
                  <PreviewRow label="SME Address" value={preview.sme_address} />
                )}
              </div>
            </div>

            {/* Raw response toggle */}
            {result && (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: isError ? "rgba(239,68,68,0.08)" : "rgba(30,41,59,0.6)",
                    border: `1px solid ${isError ? "rgba(239,68,68,0.25)" : "rgba(148,163,184,0.1)"}`,
                    borderRadius: 16,
                    overflow: "hidden",
                  }}
                >
                  <button
                    id="btn-toggle-raw"
                    onClick={() => setShowRaw(!showRaw)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 20px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: isError ? "#ef4444" : "#94a3b8",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    <span>{isError ? "❌ Error Response" : "📄 Raw Response"}</span>
                    <span style={{ fontSize: 16 }}>{showRaw ? "▲" : "▼"}</span>
                  </button>
                  {showRaw && (
                    <pre
                      style={{
                        fontSize: 11,
                        color: isError ? "#fca5a5" : "#64748b",
                        padding: "0 20px 16px",
                        lineHeight: 1.7,
                        fontFamily: "'SF Mono', 'Fira Code', monospace",
                      }}
                    >
                      {result}
                    </pre>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </motion.div>
        </div>

        <style>{`
          @media (max-width: 900px) { .log-grid { grid-template-columns: 1fr !important; } }
          input, textarea { color-scheme: dark; }
        `}</style>
      </Layout>
    </>
  );
}
