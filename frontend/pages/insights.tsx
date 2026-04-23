import React, { useState } from "react";
import Head from "next/head";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { Loader, SkeletonLine } from "../components/Loader";
import { useAppContext } from "../context/AppContext";
import { api } from "../services/api";

const DEFAULT_SME = "0x0000000000000000000000000000000000000001";

interface InsightSection {
  title: string;
  content: string;
  icon: string;
  accent: string;
}

function parseInsightsIntoSections(raw: string): InsightSection[] {
  if (!raw || raw.startsWith("[ERROR]")) return [];

  const sections: InsightSection[] = [];
  const lines = raw.split("\n").filter((l) => l.trim());

  // Group by detecting headers or numbered lists
  const sectionPatterns = [
    { key: /revenue|sales|income|kwa|earning/i, icon: "💰", accent: "#0ea5e9", title: "Revenue Summary" },
    { key: /insight|recommend|suggest|trend|analysis/i, icon: "🧠", accent: "#8b5cf6", title: "AI Recommendations" },
    { key: /blockchain|chain|hash|verified|on-chain/i, icon: "⛓️", accent: "#10b981", title: "Blockchain Activity" },
    { key: /next|future|plan|action|improve/i, icon: "🚀", accent: "#f59e0b", title: "Next Steps" },
  ];

  // Simple: group lines into buckets
  const buckets: Record<string, string[]> = {};
  let currentBucket = "general";
  for (const line of lines) {
    let matched = false;
    for (const p of sectionPatterns) {
      if (p.key.test(line)) {
        currentBucket = p.title;
        if (!buckets[currentBucket]) buckets[currentBucket] = [];
        buckets[currentBucket].push(line);
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (!buckets[currentBucket]) buckets[currentBucket] = [];
      buckets[currentBucket].push(line);
    }
  }

  // If no semantic grouping worked, just show the whole thing as one block
  if (Object.keys(buckets).length <= 1) {
    return [
      {
        title: "AI Analysis",
        content: raw,
        icon: "🧠",
        accent: "#8b5cf6",
      },
    ];
  }

  for (const p of sectionPatterns) {
    if (buckets[p.title] && buckets[p.title].length > 0) {
      sections.push({
        title: p.title,
        content: buckets[p.title].join("\n"),
        icon: p.icon,
        accent: p.accent,
      });
    }
  }

  if (buckets["general"] && buckets["general"].length > 0) {
    sections.push({
      title: "General Insights",
      content: buckets["general"].join("\n"),
      icon: "📊",
      accent: "#0ea5e9",
    });
  }

  return sections;
}

export default function InsightsPage() {
  const { addToast, addActivity, systemMode } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [rawOutput, setRawOutput] = useState<string | null>(null);
  const [isWeekEnd, setIsWeekEnd] = useState(false);
  const [testMode, setTestMode] = useState<boolean | null>(null);
  const [runCount, setRunCount] = useState(0);

  const sections = rawOutput ? parseInsightsIntoSections(rawOutput) : [];
  const isError = rawOutput?.startsWith("[ERROR]") ?? false;

  const handleRunInsights = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.runInsights({ smeAddress: DEFAULT_SME, isWeekEnd });
      setRawOutput(res.output);
      setTestMode(res.testMode);
      setRunCount((c) => c + 1);
      addActivity({
        actionType: "Run Insights",
        status: "success",
        summary: `Evening insights · ${res.testMode ? "Test Mode" : "Live"} · ${isWeekEnd ? "Weekend" : "Weekday"}`,
      });
      addToast({ type: "success", title: "Insights Ready 🧠", message: "AI analysis completed successfully." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Insights failed.";
      setRawOutput(`[ERROR] ${msg}`);
      addActivity({ actionType: "Run Insights", status: "error", summary: `Failed: ${msg}` });
      addToast({ type: "error", title: "Insights Failed", message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>BlueSME — AI Insights</title>
        <meta name="description" content="Run AI-powered evening business insights for your SME via BlueSME." />
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
                🌙 AI Insights
              </motion.h1>
              <p style={{ fontSize: 13, color: "#64748b" }}>
                Evening business analysis powered by CrewAI
              </p>
            </div>
            <StatusBadge />
          </div>
        </div>

        {/* Controls panel */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: "rgba(30,41,59,0.6)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(148,163,184,0.1)",
            borderRadius: 16,
            padding: "20px 24px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>
              Run Evening Insights
            </h3>
            <p style={{ fontSize: 12, color: "#64748b" }}>
              AI agents will analyze your SME's activity and generate business recommendations.
            </p>
          </div>

          {/* Weekend toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "rgba(148,163,184,0.06)",
              border: "1px solid rgba(148,163,184,0.1)",
              borderRadius: 10,
              padding: "8px 14px",
              cursor: "pointer",
            }}
            onClick={() => setIsWeekEnd(!isWeekEnd)}
            role="button"
            id="toggle-weekend"
            tabIndex={0}
          >
            <span style={{ fontSize: 16 }}>{isWeekEnd ? "🗓️" : "📅"}</span>
            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>
              {isWeekEnd ? "Weekend Mode" : "Weekday Mode"}
            </span>
            <div
              style={{
                width: 32,
                height: 18,
                borderRadius: 9,
                background: isWeekEnd ? "#8b5cf6" : "rgba(148,163,184,0.2)",
                position: "relative",
                transition: "background 0.2s",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 2,
                  left: isWeekEnd ? 16 : 2,
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  background: "#fff",
                  transition: "left 0.2s",
                }}
              />
            </div>
          </div>

          {/* System mode badge */}
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "6px 12px",
              borderRadius: 8,
              background: systemMode === "test" ? "rgba(245,158,11,0.12)" : systemMode === "live" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
              color: systemMode === "test" ? "#f59e0b" : systemMode === "live" ? "#10b981" : "#ef4444",
              border: `1px solid ${systemMode === "test" ? "rgba(245,158,11,0.3)" : systemMode === "live" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
            }}
          >
            {systemMode === "test" ? "⚙️ TEST MODE" : systemMode === "live" ? "✅ LIVE MODE" : "❌ OFFLINE"}
          </div>

          {/* Run button */}
          <motion.button
            id="btn-run-insights"
            onClick={handleRunInsights}
            disabled={loading}
            whileHover={!loading ? { scale: 1.03 } : {}}
            whileTap={!loading ? { scale: 0.97 } : {}}
            style={{
              background: loading ? "rgba(139,92,246,0.15)" : "linear-gradient(135deg, #7c3aed, #6d28d9)",
              border: "none",
              borderRadius: 10,
              padding: "11px 22px",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: loading ? "none" : "0 4px 16px rgba(124,58,237,0.35)",
              transition: "all 0.15s",
              flexShrink: 0,
            }}
          >
            {loading ? <Loader size={16} color="#fff" /> : <span>🌙</span>}
            {loading ? "Analyzing..." : runCount > 0 ? "Re-run Insights" : "Run Insights"}
          </motion.button>
        </motion.div>

        {/* Results */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                background: "rgba(30,41,59,0.6)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(148,163,184,0.1)",
                borderRadius: 16,
                padding: "28px 24px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <Loader size={20} color="#8b5cf6" />
                <span style={{ fontSize: 14, fontWeight: 600, color: "#8b5cf6" }}>
                  AI agents are analyzing your data...
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <SkeletonLine width="85%" />
                <SkeletonLine width="70%" />
                <SkeletonLine width="90%" />
                <SkeletonLine width="60%" />
                <SkeletonLine width="75%" />
              </div>
            </motion.div>
          )}

          {!loading && rawOutput && !isError && sections.length > 0 && (
            <motion.div
              key="insights-result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              {/* Meta bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>
                  Run #{runCount} ·{" "}
                  {testMode !== null ? (testMode ? "⚙️ Test Mode" : "✅ Live Mode") : ""} ·{" "}
                  {isWeekEnd ? "Weekend" : "Weekday"}
                </span>
              </div>

              {sections.map((section, i) => (
                <motion.div
                  key={section.title}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  style={{
                    background: "rgba(30,41,59,0.6)",
                    backdropFilter: "blur(12px)",
                    border: `1px solid ${section.accent}22`,
                    borderLeft: `3px solid ${section.accent}`,
                    borderRadius: 16,
                    padding: "18px 20px",
                  }}
                >
                  <h3
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: section.accent,
                      marginBottom: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {section.icon} {section.title}
                  </h3>
                  <pre
                    style={{
                      fontSize: 12.5,
                      color: "#94a3b8",
                      lineHeight: 1.8,
                      fontFamily: "inherit",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {section.content}
                  </pre>
                </motion.div>
              ))}
            </motion.div>
          )}

          {!loading && rawOutput && isError && (
            <motion.div
              key="error-state"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 16,
                padding: "24px",
              }}
            >
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#ef4444", marginBottom: 10 }}>
                ❌ Insights Failed
              </h3>
              <pre style={{ fontSize: 12, color: "#fca5a5", lineHeight: 1.6, fontFamily: "'SF Mono', monospace" }}>
                {rawOutput}
              </pre>
              <button
                id="btn-retry-insights"
                onClick={handleRunInsights}
                style={{
                  marginTop: 14,
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 8,
                  padding: "9px 16px",
                  color: "#ef4444",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                🔄 Retry
              </button>
            </motion.div>
          )}

          {!loading && !rawOutput && (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                background: "rgba(30,41,59,0.4)",
                border: "1px solid rgba(148,163,184,0.08)",
                borderRadius: 16,
                padding: "64px 24px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: 14,
              }}
            >
              <div style={{ fontSize: 56 }}>🌙</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#475569" }}>
                No Insights Yet
              </h3>
              <p style={{ fontSize: 13, color: "#334155", maxWidth: 320, lineHeight: 1.6 }}>
                Click <strong style={{ color: "#8b5cf6" }}>Run Insights</strong> to trigger AI agents that
                analyze your SME's sales activity and generate business recommendations.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  flexWrap: "wrap",
                  justifyContent: "center",
                  marginTop: 8,
                }}
              >
                {[
                  { icon: "📊", label: "Revenue Analysis" },
                  { icon: "🧠", label: "AI Recommendations" },
                  { icon: "⛓️", label: "Blockchain Activity" },
                  { icon: "🚀", label: "Next Steps" },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: "#475569",
                      background: "rgba(148,163,184,0.06)",
                      borderRadius: 8,
                      padding: "6px 12px",
                    }}
                  >
                    {item.icon} {item.label}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Layout>
    </>
  );
}
