import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type SystemMode = "live" | "test" | "offline";
export type Theme = "dark" | "light";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message: string;
}

export interface ActivityEntry {
  id: string;
  timestamp: Date;
  actionType: "Log Sale" | "Run Insights" | "Generate Proof";
  status: "success" | "error";
  summary: string;
}

interface AppContextValue {
  systemMode: SystemMode;
  setSystemMode: (m: SystemMode) => void;
  theme: Theme;
  toggleTheme: () => void;
  toasts: ToastMessage[];
  addToast: (t: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;
  activities: ActivityEntry[];
  addActivity: (a: Omit<ActivityEntry, "id" | "timestamp">) => void;
  clearActivities: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

let toastCounter = 0;
let activityCounter = 0;

export function AppProvider({ children }: { children: ReactNode }) {
  const [systemMode, setSystemMode] = useState<SystemMode>("test");
  const [theme, setTheme] = useState<Theme>("dark");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([
    {
      id: "seed-1",
      timestamp: new Date(Date.now() - 1000 * 60 * 18),
      actionType: "Log Sale",
      status: "success",
      summary: "Fish sale logged · KES 4,500",
    },
    {
      id: "seed-2",
      timestamp: new Date(Date.now() - 1000 * 60 * 45),
      actionType: "Generate Proof",
      status: "success",
      summary: "Funding proof generated · 90-day window",
    },
    {
      id: "seed-3",
      timestamp: new Date(Date.now() - 1000 * 60 * 120),
      actionType: "Run Insights",
      status: "success",
      summary: "Evening insights completed · 3 recommendations",
    },
  ]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      if (typeof document !== "undefined") {
        if (next === "light") {
          document.body.classList.add("light-mode");
        } else {
          document.body.classList.remove("light-mode");
        }
      }
      return next;
    });
  }, []);

  const addToast = useCallback((t: Omit<ToastMessage, "id">) => {
    const id = `toast-${++toastCounter}`;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const addActivity = useCallback((a: Omit<ActivityEntry, "id" | "timestamp">) => {
    const id = `act-${++activityCounter}`;
    setActivities((prev) => [{ ...a, id, timestamp: new Date() }, ...prev]);
  }, []);

  const clearActivities = useCallback(() => setActivities([]), []);

  return (
    <AppContext.Provider
      value={{
        systemMode,
        setSystemMode,
        theme,
        toggleTheme,
        toasts,
        addToast,
        removeToast,
        activities,
        addActivity,
        clearActivities,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
