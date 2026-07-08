import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import AdminEquipmentPage from "./src/pages/admin/equipment/AdminEquipmentPage";
// Force permissions so PermissionGate passes without a backend.
import { useAdminAuthStore } from "./src/store/adminAuthStore";
useAdminAuthStore.setState({ effectivePermissions: ["*"] } as never);
const el = document.getElementById("harness")!;
createRoot(el).render(
  <MemoryRouter initialEntries={["/bennie/equipment-booking"]}>
    <AdminEquipmentPage />
  </MemoryRouter>
);
