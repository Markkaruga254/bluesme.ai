import React, { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { ToastContainer } from "./Toast";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <>
      <Navbar />
      <div
        style={{
          display: "flex",
          paddingTop: 60,
          minHeight: "100vh",
        }}
      >
        <Sidebar />
        <main
          id="main-content"
          style={{
            flex: 1,
            marginLeft: 220,
            padding: "28px 28px 60px",
            maxWidth: "100%",
            minWidth: 0,
          }}
          className="main-content-responsive"
        >
          {children}
        </main>
      </div>
      <ToastContainer />
      <style>{`
        @media (max-width: 768px) {
          .main-content-responsive { margin-left: 0 !important; padding: 20px 16px 60px !important; }
        }
      `}</style>
    </>
  );
}
