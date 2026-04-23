import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext, ActivityEntry } from "../context/AppContext";

const actionMeta: Record<
  ActivityEntry["actionType"],
  { icon: string; color: string; label: string }
> = {
  "Log Sale": { icon: "🧾", color: "#0ea5e9", label: "Sale Logged" },
  "Run Insights": { icon: "🌙", color: "#8b5cf6", label: "Insights Run" },
  "Generate Proof": { icon: "📋", color: "#10b981", label: "Proof Generated" },
};

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString("en-KE");
}

interface TimelineProps {
  maxItems?: number;
}

export function Timeline({ maxItems = 8 }: TimelineProps) {
  const { activities, clearActivities } = useAppContext();
  const visible = activities.slice(0, maxItems);

  return (
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
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px 12px",
          borderBottom: "1px solid rgba(148,163,184,0.07)",
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>Activity Timeline</h3>
        {activities.length > 0 && (
          <button
            onClick={clearActivities}
            style={{
              background: "none",
              border: "1px solid rgba(148,163,184,0.15)",
              borderRadius: 8,
              padding: "4px 10px",
              fontSize: 11,
              color: "#64748b",
              cursor: "pointer",
              fontWeight: 500,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.borderColor = "rgba(239,68,68,0.4)";
              (e.target as HTMLElement).style.color = "#ef4444";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.borderColor = "rgba(148,163,184,0.15)";
              (e.target as HTMLElement).style.color = "#64748b";
            }}
          >
            Clear
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 20px",
            color: "#475569",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          <p style={{ fontSize: 13, fontWeight: 500 }}>No activity yet</p>
          <p style={{ fontSize: 12, color: "#334155", marginTop: 4 }}>
            Trigger an action to see it here
          </p>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          <ul style={{ listStyle: "none" }}>
            {visible.map((entry, idx) => {
              const meta = actionMeta[entry.actionType];
              return (
                <motion.li
                  key={entry.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    padding: "14px 20px",
                    borderBottom:
                      idx < visible.length - 1
                        ? "1px solid rgba(148,163,184,0.05)"
                        : "none",
                  }}
                >
                  {/* Timeline dot */}
                  <div style={{ position: "relative", flexShrink: 0, marginTop: 2 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: `${meta.color}1a`,
                        border: `1.5px solid ${meta.color}44`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                      }}
                    >
                      {meta.icon}
                    </div>
                    {idx < visible.length - 1 && (
                      <div
                        style={{
                          position: "absolute",
                          top: 34,
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: 1,
                          height: 12,
                          background: "rgba(148,163,184,0.1)",
                        }}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: meta.color,
                          background: `${meta.color}18`,
                          borderRadius: 99,
                          padding: "2px 8px",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {meta.label}
                      </span>
                      {entry.status === "error" && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#ef4444",
                            background: "rgba(239,68,68,0.12)",
                            borderRadius: 99,
                            padding: "2px 8px",
                          }}
                        >
                          FAILED
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: "#475569", marginLeft: "auto" }}>
                        {timeAgo(entry.timestamp)}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                      {entry.summary}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </AnimatePresence>
      )}
    </div>
  );
}
