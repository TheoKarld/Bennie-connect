/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Route wrapper for every `/app/marketplace/*` page: renders the child route
 * plus the cart drawer overlay, and hydrates the server cart + categories once
 * so the cart badge / drawer are live on every marketplace surface.
 */

import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";

import { useMarketplaceStore } from "../../../store/marketplaceStore";
import CartDrawer from "./components/CartDrawer";

export default function MarketplaceLayout() {
  const fetchCart = useMarketplaceStore((s) => s.fetchCart);
  const fetchCategories = useMarketplaceStore((s) => s.fetchCategories);

  useEffect(() => {
    void fetchCart({ silent: true });
    void fetchCategories();
  }, [fetchCart, fetchCategories]);

  return (
    <>
      <Outlet />
      <CartDrawer />
    </>
  );
}
