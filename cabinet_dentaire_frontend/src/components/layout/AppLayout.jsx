/**
 * src/components/layout/AppLayout.jsx
 */
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar  from "./Navbar";

export default function AppLayout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Navbar />
        <main style={{ flex: 1, padding: "1.5rem 2rem", overflowY: "auto" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}