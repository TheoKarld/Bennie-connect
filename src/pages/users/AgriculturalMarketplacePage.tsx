/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

import AgriculturalMarketplaceView from "./AgriculturalMarketplaceView";
import { useAppState } from "../../hooks/useAppState";

export default function AgriculturalMarketplacePage() {
  const store = useAppState();

  return (
    <AgriculturalMarketplaceView
      state={store}
      onAddToCart={store.handleAddToCart}
      onUpdateCartQty={store.handleUpdateCartQty}
      onRemoveFromCart={store.handleRemoveFromCart}
      onCheckout={store.handleCheckoutMarketplace}
      onAddProduct={store.handleMerchantAddProduct}
      onUpdateProductStock={store.handleMerchantUpdateStock}
      onUpdateOrderStatus={store.handleMerchantUpdateOrderStatus}
    />
  );
}
