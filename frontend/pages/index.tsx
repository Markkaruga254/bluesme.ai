import React, { useState, useCallback } from "react";
import Head from "next/head";
import { motion } from "framer-motion";
import { Layout } from "../components/Layout";
import { KPICard, KpiCardData } from "../components/KPI_Card";
import { RevenueChart } from "../components/Chart";
import { Timeline } from "../components/Timeline";
import { StatusBadge } from "../components/StatusBadge";
import { Loader, SkeletonCard } from "../components/Loader";
import { useAppContext } from "../context/AppContext";
import { api } from "../services/api";

const KPI_DATA: KpiCardData[] = [
  {
    id: "kpi-revenue",
    label: "Revenue Today",
    value: "KES 67,200",
    subtext: "Updated live",
    icon: "💰",
    accent: "#0ea5e9",
    trend: "up",
    trendValue: "12.4%",
  },
  {
    id: "kpi-sales",
    label: "Sales Logged",
    value: "24",
    subtext: "Today's transactions",
    icon: "🧾",
    accent: "#8b5cf6",
    trend: "up",
    trendValue: "8%",
  },
  {
    id: "kpi-onchain",
    label: "On-Chain Logs",
    value: "18",
    subtext: "Blockchain verified",
    icon: "⛓️",
    accent: "#10b981",
    trend: "neutral",
  },
  {
    id: "kpi-netflow",
    label: "Net Flow",
    value: "KES 52,100",
    subtext: "Net after costs",
    icon: "📈",
    accent: "#f59e0b",
    trend: "up",
    trendValue: "5.2%",
  },
];

const DEFAULT_SME = "0x0000000000000000000000000000000000000001";
const DEFAULT_SALE_MESSAGE = "nimeuza samaki 10kg kwa kes 4500";

export default function DashboardPage() {
  const { addToast, addActivity, systemMode } = useAppContext();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [insightsOutput, setInsightsOutput] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const runAction = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      if (loadingAction) return;
      setLoadingAction(label);
      try {
        await fn();
      } finally {
        setLoadingAction(null);
      }
    },
    [loadingAction]
  );

  const handleLogSale = () =>
    runAction("Log Sale", async () => {
      try {
        const result = await api.logSale({
          smeAddress: DEFAULT_SME,
          saleMessage: DEFAULT_SALE_MESSAGE,
        });
        addActivity({
          actionType: "Log Sale",
          status: "success",
          summary: `Fish sale logged · ${result.testMode ? "Test Mode" : "Live"}`,
        });
        addToast({
          type: "success",
          title: "Sale Logged",
          message: "Transaction recorded on-chain successfully.",
        });
      } catch (err) {
        addActivity({
          actionType: "Log Sale",
          status: "error",
          summary: "Log sale failed",
        });
        addToast({
          type: "error",
          title: "Log Sale Failed",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });

  const handleRunInsights = async () => {
    setInsightsLoading(true);
    try {
      const result = await api.runInsights({
        smeAddress: DEFAULT_SME,
        isWeekEnd: false,
      });
      setInsightsOutput(result.output);
      addActivity({
        actionType: "Run Insights",
        status: "success",
        summary: `Evening insights completed · ${result.testMode ? "Test Mode" : "Live"}`,
      });
      addToast({
        type: "success",
        title: "Insights Ready",
        message: "AI analysis completed successfully.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setInsightsOutput(`[ERROR] ${msg}`);
      addActivity({
        actionType: "Run Insights",
        status: "error",
        summary: "Insights run failed",
      });
      addToast({
        type: "error",
        title: "Insights Failed",
        message: msg,
      });
    } finally {
      setInsightsLoading(false);
    }
  };

  const handleGenerateProof = () =>
    runAction("Generate Proof", async () => {
      try {
        const result = await api.generateProof({
          smeAddress: DEFAULT_SME,
          smeName: "BlueSME Business",
          smeCategory: "Blue Economy SME",
          days: 90,
        });
        addActivity({
          actionType: "Generate Proof",
          status: "success",
          summary: `Funding proof generated · 90-day window · ${result.testMode ? "Test" : "Live"}`,
        });
        addToast({
          type: "success",
          title: "Proof Generated",
          message: "Blockchain-verified funding proof is ready.",
        });
      } catch (err) {
        addActivity({
          actionType: "Generate Proof",
          status: "error",
          summary: "Proof generation failed",
        });
        addToast({
          type: "error",
          title: "Proof Failed",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });

  const quickActions = [
    {
      id: "qa-log-sale",
      label: "Log Sale",
      icon: "🧾",
      description: "Record a confirmed sale on-chain",
      accent: "#0ea5e9",
      onClick: handleLogSale,
    },
    {
      id: "qa-run-insights",
      label: "Run Insights",
      icon: "🌙",
      description: "AI summary of today's activity",
      accent: "#8b5cf6",
      onClick: handleRunInsights,
    },
    {
      id: "qa-generate-proof",
      label: "Generate Proof",
      icon: "📋",
      description: "Create verifiable lender proof",
      accent: "#10b981",
      onClick: handleGenerateProof,
    },
  ];

  return (
    <>
      <Head>
        <title>BlueSME — Dashboard</title>
        <meta name="description" content="BlueSME AI-blockchain dashboard for SME revenue tracking, insights, and funding proof generation." />
      </Head>
      <Layout>
        {/* Header row */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  fontSize: "clamp(20px, 3vw, 28px)",
                  fontWeight: 800,
                  color: "#f1f5f9",
                  letterSpacing: "-0.02em",
                  marginBottom: 4,
                }}
              >
                Agent Dashboard
              </motion.h1>
              <p style={{ fontSize: 13, color: "#64748b" }}>
                AI-assisted sales, insights & funding proof · Mombasa Blue Economy
              </p>
            </div>
            <StatusBadge />
          </div>
        </div>

        {/* KPI Cards */}
        <section aria-label="Key Performance Indicators" style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#475569",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 12,
            }}
          >
            Today's Overview
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {KPI_DATA.map((card) => (
              <KPICard key={card.id} card={card} />
            ))}
          </div>
        </section>

        {/* Chart + AI Panel */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 340px",
            gap: 18,
            marginBottom: 24,
          }}
          className="dashboard-grid"
        >
          <RevenueChart />

          {/* AI Insights Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              background: "rgba(30,41,59,0.6)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(148,163,184,0.1)",
              borderRadius: 16,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "16px 20px 12px",
                borderBottom: "1px solid rgba(148,163,184,0.07)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>
                  🌙 AI Insights
                </h3>
                <p style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  Evening business analysis
                </p>
              </div>
              <button
                id="btn-run-insights-panel"
                onClick={handleRunInsights}
                disabled={insightsLoading}
                style={{
                  background: insightsLoading ? "rgba(139,92,246,0.1)" : "rgba(139,92,246,0.15)",
                  border: "1px solid rgba(139,92,246,0.3)",
                  borderRadius: 8,
                  padding: "6px 12px",
                  color: "#8b5cf6",
                  cursor: insightsLoading ? "not-allowed" : "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s",
                }}
              >
                {insightsLoading ? <Loader size={14} color="#8b5cf6" /> : null}
                {insightsLoading ? "Running..." : "Run Insights"}
              </button>
            </div>

            <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto" }}>
              {insightsLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="skeleton" style={{ height: 13, width: "90%", borderRadius: 6 }} />
                  <div className="skeleton" style={{ height: 13, width: "75%", borderRadius: 6 }} />
                  <div className="skeleton" style={{ height: 13, width: "85%", borderRadius: 6 }} />
                  <div className="skeleton" style={{ height: 13, width: "60%", borderRadius: 6 }} />
                </div>
              ) : insightsOutput ? (
                <pre
                  style={{
                    fontSize: 12,
                    color: insightsOutput.startsWith("[ERROR]") ? "#ef4444" : "#94a3b8",
                    lineHeight: 1.7,
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {insightsOutput}
                </pre>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    minHeight: 140,
                    color: "#334155",
                    textAlign: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 32 }}>🧠</span>
                  <p style={{ fontSize: 12, color: "#475569" }}>
                    Click "Run Insights" to get<br />AI analysis of today's activity
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <section aria-label="Quick Actions" style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#475569",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 12,
            }}
          >
            Quick Actions
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {quickActions.map((action) => {
              const isLoading = loadingAction === action.label || (action.label === "Run Insights" && insightsLoading);
              return (
                <motion.button
                  key={action.id}
                  id={action.id}
                  onClick={action.onClick}
                  disabled={!!loadingAction || insightsLoading}
                  whileHover={!loadingAction && !insightsLoading ? { scale: 1.02 } : {}}
                  whileTap={!loadingAction && !insightsLoading ? { scale: 0.98 } : {}}
                  style={{
                    flex: "1 1 180px",
                    minWidth: 160,
                    background: isLoading
                      ? "rgba(148,163,184,0.05)"
                      : `${action.accent}0d`,
                    border: `1px solid ${isLoading ? "rgba(148,163,184,0.1)" : action.accent + "33"}`,
                    borderRadius: 14,
                    padding: "18px 16px",
                    cursor: loadingAction || insightsLoading ? "not-allowed" : "pointer",
                    textAlign: "left",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 10 }}>
                    {isLoading ? <Loader size={28} color={action.accent} /> : action.icon}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: isLoading ? "#475569" : "#f1f5f9",
                      marginBottom: 4,
                    }}
                  >
                    {action.label}
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.4 }}>
                    {action.description}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Activity Timeline */}
        <section aria-label="Activity Timeline">
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#475569",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 12,
            }}
          >
            Activity Timeline
          </div>
          <Timeline maxItems={6} />
        </section>

        <style>{`
          @media (max-width: 1024px) {
            .dashboard-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </Layout>
    </>
  );
}
