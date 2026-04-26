/**
 * src/components/layout/AppLayout.jsx
 * ✅ Logique 100% conservée
 * 🎨 UI redesignée avec Tailwind CSS
 */
import { memo } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar  from "./Navbar";

function AppLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default memo(AppLayout);