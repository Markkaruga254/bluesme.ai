import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useAppContext } from "../context/AppContext";

interface SidebarItem {
  href: string;
  label: string;
  icon: string;
  description: string;
  id: string;
}

const ITEMS: SidebarItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: "⬡",
    description: "Overview & KPIs",
    id: "sidebar-dashboard",
  },
  {
    href: "/log",
    label: "Log Sale",
    icon: "🧾",
    description: "Record on-chain sale",
    id: "sidebar-log",
  },
  {
    href: "/proof",
    label: "Generate Proof",
    icon: "📋",
    description: "Funding verification",
    id: "sidebar-proof",
  },
  {
    href: "/insights",
    label: "AI Insights",
    icon: "🌙",
    description: "Evening analysis",
    id: "sidebar-insights",
  },
];

export function Sidebar() {
  const router = useRouter();
  const { systemMode, activities } = useAppContext();

  return (
    <aside
      id="sidebar"
      style={{
        width: 220,
        flexShrink: 0,
        background: "rgba(15,23,42,0.6)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRight: "1px solid rgba(148,163,184,0.08)",
        display: "flex",
        flexDirection: "column",
        padding: "24px 12px",
        position: "fixed",
        top: 60,
        left: 0,
        bottom: 0,
        overflowY: "auto",
        zIndex: 50,
      }}
      className="sidebar-responsive"
    >
      {/* Section label */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#475569",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: 10,
          padding: "0 8px",
        }}
      >
        Navigation
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {ITEMS.map((item) => {
          const active = router.pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              id={item.id}
              style={{ textDecoration: "none" }}
            >
              <motion.div
                whileHover={{ x: 2 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 10px",
                  borderRadius: 10,
                  background: active ? "rgba(14,165,233,0.12)" : "transparent",
                  border: active
                    ? "1px solid rgba(14,165,233,0.2)"
                    : "1px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: active ? "rgba(14,165,233,0.2)" : "rgba(148,163,184,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: active ? 700 : 500,
                      color: active ? "#0ea5e9" : "#94a3b8",
                      lineHeight: 1.2,
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#475569",
                      lineHeight: 1.3,
                      marginTop: 1,
                    }}
                  >
                    {item.description}
                  </div>
                </div>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom system info */}
      <div style={{ marginTop: "auto", paddingTop: 20 }}>
        <div
          style={{
            background: "rgba(148,163,184,0.04)",
            border: "1px solid rgba(148,163,184,0.08)",
            borderRadius: 12,
            padding: "12px 12px",
          }}
        >
          <div style={{ fontSize: 10, color: "#475569", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            System Status
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#64748b" }}>Mode</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color:
                    systemMode === "live"
                      ? "#10b981"
                      : systemMode === "test"
                      ? "#f59e0b"
                      : "#ef4444",
                  textTransform: "uppercase",
                }}
              >
                {systemMode === "live" ? "🟢" : systemMode === "test" ? "🟡" : "🔴"}{" "}
                {systemMode}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#64748b" }}>Activity</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#0ea5e9" }}>
                {activities.length} events
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .sidebar-responsive { display: none !important; }
        }
      `}</style>
    </aside>
  );
}
