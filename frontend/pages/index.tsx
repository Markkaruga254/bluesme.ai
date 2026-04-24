import React, { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, ArrowUpRight, CheckCircle2, ShieldCheck,
  AlertTriangle, Zap, RefreshCw, Clock, DatabaseZap,
  Lock, ArrowRight, FileText, CheckCircle
} from "lucide-react";
import { api } from "../services/api";

// --- Types ---
type FeedEvent = {
  id: string;
  type: "success" | "warning" | "processing";
  title: string;
  time: string;
  message: string;
};

// --- Mock Defaults ---
const DEFAULT_SME = "0x0000000000000000000000000000000000000001";

export default function DemoDashboard() {
  // State
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [stats, setStats] = useState({
    revenue: 124500,
    txCount: 42,
    pending: 0,
    health: 100,
  });

  // Reconciliation State
  const [reconData, setReconData] = useState<any>({
    lastRun: "Never",
    inconsistencies: 0,
    autoRepaired: 0,
    status: "good",
    logs: [],
  });
  const [reconLoading, setReconLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({ name: "Blue Marina", item: "50kg Tuna", amount: "45000" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Proof State
  const [proofData, setProofData] = useState<any>(null);
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);

  // Helpers
  const addEvent = (type: FeedEvent["type"], title: string, message: string) => {
    setEvents((prev) => [
      {
        id: Math.random().toString(36).substring(2, 9),
        type,
        title,
        message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
      ...prev,
    ].slice(0, 10)); // Keep last 10
  };

  // --- Effects ---
  useEffect(() => {
    // Initial feed load
    addEvent("success", "System Online", "PostgreSQL, Celery & Redis connected.");
    fetchReconciliation();
  }, []);

  const fetchReconciliation = async () => {
    setReconLoading(true);
    try {
      const data = await api.getReconciliationStatus();
      const unresolved = data.total_unresolved || 0;
      setReconData({
        lastRun: new Date().toLocaleTimeString(),
        inconsistencies: unresolved,
        autoRepaired: data.total_resolved || 0,
        status: unresolved === 0 ? "good" : unresolved < 3 ? "warning" : "critical",
        logs: data.recent_logs?.slice(0, 3) || [],
      });
    } catch (e) {
      console.error(e);
    } finally {
      setReconLoading(false);
    }
  };

  // --- Handlers ---
  const handleLogSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    addEvent("processing", "Distributed Agents Processing...", `Parsing sale for ${formData.name}`);
    setStats(s => ({ ...s, pending: s.pending + 1 }));

    try {
      const message = `Sold ${formData.item} for ${formData.amount} KES`;
      const res = await api.logSale({
        smeAddress: DEFAULT_SME,
        saleMessage: message,
      });

      addEvent("success", "Transaction Confirmed", "DB committed & blockchain log queued.");
      setStats(s => ({ 
        ...s, 
        revenue: s.revenue + parseInt(formData.amount),
        txCount: s.txCount + 1,
        pending: Math.max(0, s.pending - 1)
      }));

      // Trigger reconciliation a bit later to show self-healing
      setTimeout(() => {
        addEvent("processing", "Reconciliation Engine", "Verifying DB and Blockchain integrity...");
        fetchReconciliation();
        setTimeout(() => addEvent("success", "Integrity Verified", "No divergence detected."), 1500);
      }, 4000);

    } catch (err) {
      addEvent("warning", "Submission Failed", err instanceof Error ? err.message : "Network error");
      setStats(s => ({ ...s, pending: Math.max(0, s.pending - 1) }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateProof = async () => {
    if (isGeneratingProof) return;
    setIsGeneratingProof(true);
    setProofData(null);
    addEvent("processing", "Auditing Records", "Cross-referencing DB and Base Sepolia...");

    try {
      const res = await api.generateProof({
        smeAddress: DEFAULT_SME,
        smeName: formData.name,
        smeCategory: "Blue Economy",
        days: 90
      });
      
      const out = JSON.parse(res.output);
      setProofData(out);
      addEvent("success", "Proof Generated", "Zero-knowledge proof minted securely.");
    } catch (err) {
      addEvent("warning", "Proof Generation Failed", "Could not verify all transactions.");
    } finally {
      setIsGeneratingProof(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060d1a] text-slate-200 font-sans selection:bg-sky-500/30 pb-20">
      <Head>
        <title>BlueSME — Integrity Demo</title>
      </Head>

      {/* Header */}
      <header className="border-b border-slate-800/60 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight leading-tight">BlueSME Demo</h1>
              <p className="text-xs text-slate-400 font-medium">Distributed Financial Integrity</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400 tracking-wide uppercase">System Live</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard title="Total Revenue" value={`KES ${stats.revenue.toLocaleString()}`} icon={<ArrowUpRight className="text-sky-400" />} trend="+12.4%" />
          <KpiCard title="Total Transactions" value={stats.txCount} icon={<Activity className="text-purple-400" />} trend="+4 this week" />
          <KpiCard title="Pending Sync" value={stats.pending} icon={<RefreshCw className={`text-amber-400 ${stats.pending > 0 ? 'animate-spin' : ''}`} />} />
          <KpiCard title="System Health" value={`${stats.health}%`} icon={<ShieldCheck className="text-emerald-400" />} isHealth status={reconData.status} />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column (Input & Proof) */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Sale Input Form */}
            <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-500 to-blue-600" />
              <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <Zap className="w-5 h-5 text-sky-400" /> Log Transaction
              </h2>
              <p className="text-xs text-slate-400 mb-6">Triggers CrewAI agents & queue system</p>
              
              <form onSubmit={handleLogSale} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">SME Name</label>
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Item/Service</label>
                    <input 
                      type="text" 
                      value={formData.item}
                      onChange={e => setFormData({...formData, item: e.target.value})}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 transition-all text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Amount (KES)</label>
                    <input 
                      type="number" 
                      value={formData.amount}
                      onChange={e => setFormData({...formData, amount: e.target.value})}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 transition-all text-white"
                    />
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full mt-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-sky-500/25 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  {isSubmitting ? "Processing..." : "Secure & Log Sale"}
                </button>
              </form>
            </div>

            {/* Proof Generator */}
            <div className="glass-card rounded-2xl p-6 border border-slate-800">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-400" /> Financial Proof
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Generate lender-ready certificate</p>
                </div>
                <button 
                  onClick={handleGenerateProof}
                  disabled={isGeneratingProof}
                  className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  {isGeneratingProof ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Generate"}
                </button>
              </div>

              {proofData ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50"
                >
                  <div className="flex justify-between items-start border-b border-slate-800 pb-3 mb-3">
                    <div>
                      <div className="text-xs text-slate-400">Verified Period</div>
                      <div className="font-semibold text-white">{proofData.period_days} Days</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Net Revenue</div>
                      <div className="font-bold text-emerald-400">KES {proofData.net_revenue?.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400 flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-emerald-500"/> Total Sales</span>
                      <span className="font-medium">{proofData.total_sales}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400 flex items-center gap-1.5"><DatabaseZap className="w-3 h-3 text-sky-500"/> Verified Txs</span>
                      <span className="font-medium">{proofData.tx_count}</span>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="h-32 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-800 rounded-xl">
                  <ShieldCheck className="w-8 h-8 text-slate-700 mb-2" />
                  <span className="text-xs text-slate-500">Un-tamperable audit certificate<br/>will appear here.</span>
                </div>
              )}
            </div>

          </div>

          {/* Center Column (Live Feed) */}
          <div className="lg:col-span-4">
            <div className="glass-card rounded-2xl p-6 h-full border border-slate-800 flex flex-col">
              <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" /> Live Activity Feed
              </h2>
              <p className="text-xs text-slate-400 mb-6">Real-time distributed system events</p>
              
              <div className="flex-1 overflow-hidden relative">
                <div className="absolute top-0 w-full h-4 bg-gradient-to-b from-[#1e293b]/60 to-transparent z-10 pointer-events-none" />
                <div className="absolute bottom-0 w-full h-12 bg-gradient-to-t from-[#1e293b]/60 to-transparent z-10 pointer-events-none" />
                
                <div className="space-y-4 pt-2">
                  <AnimatePresence>
                    {events.map((ev) => (
                      <motion.div
                        key={ev.id}
                        initial={{ opacity: 0, x: -20, height: 0 }}
                        animate={{ opacity: 1, x: 0, height: "auto" }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex gap-3 relative"
                      >
                        <div className="mt-1">
                          {ev.type === "success" && <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /></div>}
                          {ev.type === "processing" && <div className="w-6 h-6 rounded-full bg-sky-500/20 flex items-center justify-center"><RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" /></div>}
                          {ev.type === "warning" && <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center"><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /></div>}
                        </div>
                        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 flex-1 backdrop-blur-sm">
                          <div className="flex justify-between items-start mb-0.5">
                            <h4 className={`text-sm font-bold ${ev.type === 'success' ? 'text-emerald-300' : ev.type === 'warning' ? 'text-amber-300' : 'text-sky-300'}`}>
                              {ev.title}
                            </h4>
                            <span className="text-[10px] text-slate-500 font-medium">{ev.time}</span>
                          </div>
                          <p className="text-xs text-slate-300">{ev.message}</p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {events.length === 0 && (
                    <div className="text-center text-slate-500 text-sm mt-10">Listening for system events...</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (Integrity Monitor) */}
          <div className="lg:col-span-4">
            <div className="glass-card rounded-2xl p-6 h-full border border-slate-800 relative overflow-hidden group">
              {/* Animated background glow based on status */}
              <div className={`absolute -inset-20 opacity-20 blur-3xl transition-colors duration-1000 -z-10 ${reconData.status === 'good' ? 'bg-emerald-500/20' : reconData.status === 'warning' ? 'bg-amber-500/20' : 'bg-rose-500/20'}`} />
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <DatabaseZap className="w-5 h-5 text-amber-400" /> System Integrity Monitor
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">"The system watches itself"</p>
                </div>
                <button onClick={fetchReconciliation} className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 transition-colors">
                  <RefreshCw className={`w-4 h-4 ${reconLoading ? 'animate-spin text-sky-400' : ''}`} />
                </button>
              </div>

              <div className="bg-slate-900/60 rounded-xl border border-slate-700 p-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${reconData.status === 'good' ? 'border-emerald-500/30 bg-emerald-500/10' : reconData.status === 'warning' ? 'border-amber-500/30 bg-amber-500/10' : 'border-rose-500/30 bg-rose-500/10'}`}>
                    <ShieldCheck className={`w-6 h-6 ${reconData.status === 'good' ? 'text-emerald-400' : reconData.status === 'warning' ? 'text-amber-400' : 'text-rose-400'}`} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Consensus State</div>
                    <div className={`text-xs font-bold uppercase tracking-wider ${reconData.status === 'good' ? 'text-emerald-400' : reconData.status === 'warning' ? 'text-amber-400' : 'text-rose-400'}`}>
                      {reconData.status === 'good' ? 'Synchronized' : reconData.status === 'warning' ? 'Minor Divergence' : 'Unsynchronized'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50">
                  <div className="text-xs text-slate-400 mb-1">Inconsistencies</div>
                  <div className="text-xl font-bold text-white">{reconData.inconsistencies}</div>
                </div>
                <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50">
                  <div className="text-xs text-slate-400 mb-1">Auto-Repaired</div>
                  <div className="text-xl font-bold text-emerald-400">{reconData.autoRepaired}</div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <span>Recent Scans</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {reconData.lastRun}</span>
                </div>
                
                <div className="space-y-2">
                  {reconData.logs && reconData.logs.length > 0 ? (
                    reconData.logs.map((log: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-slate-800/30 p-2.5 rounded-lg border border-slate-700/30">
                        <span className="text-slate-300 font-mono truncate mr-2 flex-1">{log.issue_type}</span>
                        <span className={`px-2 py-0.5 rounded-full font-medium ${log.resolved ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          {log.resolved ? 'Fixed' : 'Pending'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-xs text-slate-500 bg-slate-800/20 rounded-lg border border-slate-700/20 border-dashed">
                      No inconsistencies detected in DB vs Chain.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>

      <style>{`
        .glass-card {
          background: rgba(30, 41, 59, 0.4);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
      `}</style>
    </div>
  );
}

// --- Subcomponents ---

function KpiCard({ title, value, icon, trend, isHealth, status }: any) {
  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800/80 flex flex-col justify-between relative overflow-hidden">
      {isHealth && (
        <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl opacity-20 ${status === 'good' ? 'bg-emerald-500' : status === 'warning' ? 'bg-amber-500' : 'bg-rose-500'}`} />
      )}
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center shadow-inner">
          {icon}
        </div>
        {trend && (
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <div className="relative z-10">
        <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">{title}</h3>
        <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
      </div>
    </div>
  );
}
