import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export interface KpiCardData {
  id: string;
  label: string;
  value: string;
  subtext?: string;
  icon: string;
  accent: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

function TrendArrow({ trend, value }: { trend?: "up" | "down" | "neutral"; value?: string }) {
  if (!trend || trend === "neutral" || !value) return null;
  const color = trend === "up" ? "#10b981" : "#ef4444";
  const arrow = trend === "up" ? "↑" : "↓";
  return (
    <span style={{ fontSize: 11, color, fontWeight: 600, marginLeft: 4 }}>
      {arrow} {value}
    </span>
  );
}

export function KPICard({ card }: { card: KpiCardData }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.2 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={visible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
      style={{
        background: "rgba(30,41,59,0.6)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(148,163,184,0.1)",
        borderRadius: 16,
        padding: "20px 22px",
        position: "relative",
        overflow: "hidden",
        flex: "1 1 160px",
        minWidth: 140,
        cursor: "default",
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
      whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
    >
      {/* Accent top bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: card.accent,
          borderRadius: "16px 16px 0 0",
        }}
      />
      {/* Glow blob */}
      <div
        style={{
          position: "absolute",
          top: -20,
          right: -20,
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: card.accent,
          opacity: 0.07,
          filter: "blur(20px)",
        }}
      />
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>{card.icon}</div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.15, duration: 0.4 }}
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: "#f1f5f9",
            lineHeight: 1.1,
            marginBottom: 4,
            letterSpacing: "-0.02em",
          }}
        >
          {card.value}
          <TrendArrow trend={card.trend} value={card.trendValue} />
        </motion.div>
        <div
          style={{
            fontSize: 11,
            color: "#64748b",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {card.label}
        </div>
        {card.subtext && (
          <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{card.subtext}</div>
        )}
      </div>
    </motion.div>
  );
}
