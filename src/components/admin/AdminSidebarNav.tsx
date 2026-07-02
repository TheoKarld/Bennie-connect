/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { NavLink } from "react-router-dom";

import { ADMIN_NAV, type AdminNavItem, type NavGroup } from "./adminNav";
import { hasAnyPermission } from "../../lib/adminPermissions";
import { useAdminAuth } from "../../hooks/useAdminAuth";

/**
 * The permission-filtered primary nav. One component, two presentations
 * (desktop sidebar + mobile drawer) — the single source of nav + gating logic.
 * Dark forest palette so the ops console reads distinct from the user app.
 */

interface Props {
  /** Icon-only rail (desktop collapsed). Labels become title tooltips. */
  collapsed?: boolean;
  /** Fired after navigating (used to close the mobile drawer). */
  onNavigate?: () => void;
}

const GROUP_ORDER: NavGroup[] = ["Operations", "Administration"];

export default function AdminSidebarNav({ collapsed = false, onNavigate }: Props) {
  const { effectivePermissions } = useAdminAuth();

  const visible = useMemo(
    () =>
      ADMIN_NAV.filter(
        (item) =>
          item.permissions.length === 0 ||
          hasAnyPermission(effectivePermissions, item.permissions)
      ),
    [effectivePermissions]
  );

  const grouped = useMemo(() => {
    const map: Record<NavGroup, AdminNavItem[]> = {
      Operations: [],
      Administration: [],
    };
    visible.forEach((item) => map[item.group].push(item));
    return map;
  }, [visible]);

  return (
    <nav aria-label="Primary" className="flex flex-col gap-6">
      {GROUP_ORDER.map((group) => {
        const items = grouped[group];
        if (items.length === 0) return null;
        return (
          <div key={group} className="space-y-1.5">
            {!collapsed && (
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                {group}
              </p>
            )}
            {items.map(({ label, to, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onNavigate}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
                    collapsed ? "justify-center" : ""
                  } ${
                    isActive
                      ? "bg-white/12 text-white"
                      : "text-white/60 hover:bg-white/[0.06] hover:text-white"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[#E7A13C]"
                      />
                    )}
                    <Icon
                      className={`h-[18px] w-[18px] shrink-0 ${
                        isActive ? "text-[#E7A13C]" : ""
                      }`}
                    />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        );
      })}
    </nav>
  );
}
