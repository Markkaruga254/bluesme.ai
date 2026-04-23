import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import { StatusBadge } from "./StatusBadge";
import { useAppContext } from "../context/AppContext";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  id: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "⬡", id: "nav-dashboard" },
  { href: "/log", label: "Log Sale", icon: "🧾", id: "nav-log" },
  { href: "/proof", label: "Generate Proof", icon: "📋", id: "nav-proof" },
  { href: "/insights", label: "Insights", icon: "🌙", id: "nav-insights" },
];

export function Navbar() {
  const router = useRouter();
  const { theme, toggleTheme, systemMode, setSystemMode } = useAppContext();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav
        id="navbar"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: "rgba(6,13,26,0.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(148,163,184,0.08)",
          height: 60,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 16,
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          id="nav-logo"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 24 }}>🌊</span>
          <span
            style={{
              fontWeight: 800,
              fontSize: 17,
              background: "linear-gradient(135deg, #0ea5e9, #8b5cf6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.02em",
            }}
          >
            BlueSME
          </span>
        </Link>

        {/* Desktop nav */}
        <div
          style={{
            display: "flex",
            gap: 4,
            flex: 1,
            justifyContent: "center",
          }}
          className="desktop-nav"
        >
          {NAV_ITEMS.map((item) => {
            const active = router.pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                id={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? "#0ea5e9" : "#94a3b8",
                  background: active ? "rgba(14,165,233,0.12)" : "transparent",
                  border: active
                    ? "1px solid rgba(14,165,233,0.25)"
                    : "1px solid transparent",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Right controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <StatusBadge size="sm" />

          {/* Mode cycle button */}
          <button
            id="btn-cycle-mode"
            title="Cycle system mode"
            onClick={() => {
              setSystemMode(
                systemMode === "live" ? "test" : systemMode === "test" ? "offline" : "live"
              );
            }}
            style={{
              background: "rgba(148,163,184,0.08)",
              border: "1px solid rgba(148,163,184,0.12)",
              borderRadius: 8,
              padding: "5px 10px",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            Switch
          </button>

          {/* Theme toggle */}
          <button
            id="btn-toggle-theme"
            onClick={toggleTheme}
            title="Toggle theme"
            style={{
              background: "rgba(148,163,184,0.08)",
              border: "1px solid rgba(148,163,184,0.12)",
              borderRadius: 8,
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {/* Mobile hamburger */}
          <button
            id="btn-mobile-menu"
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              display: "none",
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: 20,
              padding: 4,
            }}
            className="mobile-hamburger"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              position: "fixed",
              top: 60,
              left: 0,
              right: 0,
              zIndex: 99,
              background: "rgba(6,13,26,0.97)",
              backdropFilter: "blur(16px)",
              borderBottom: "1px solid rgba(148,163,184,0.08)",
              padding: "12px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                id={`mobile-${item.id}`}
                onClick={() => setMobileOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 16px",
                  borderRadius: 10,
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 600,
                  color: router.pathname === item.href ? "#0ea5e9" : "#94a3b8",
                  background:
                    router.pathname === item.href ? "rgba(14,165,233,0.1)" : "transparent",
                }}
              >
                {item.icon} {item.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-hamburger { display: flex !important; }
        }
      `}</style>
    </>
  );
}
