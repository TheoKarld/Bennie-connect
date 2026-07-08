/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Low-stock view — products at/below their threshold, with an inline threshold /
 * restock edit (confirm modal). Gated by `marketplace:update` for the inline
 * edit. Brand tokens, full light/dark support.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PackageX } from "lucide-react";

import { Modal, Field, Input, Button, pushToast } from "../../../../components/ui";
import { useAdminAuth } from "../../../../hooks/useAdminAuth";
import { useAdminMarketplaceStore } from "../../../../store/adminMarketplaceStore";
import type { LowStockRow } from "../../../../types/adminMarketplace";
import { EmptyBlock, LoadingBlock, SourcePill } from "./shared";

function AdjustModal({
  row,
  onClose,
}: {
  row: LowStockRow | null;
  onClose: () => void;
}) {
  const patchInventory = useAdminMarketplaceStore((s) => s.patchInventory);
  const fetchLowStock = useAdminMarketplaceStore((s) => s.fetchLowStock);
  const [available, setAvailable] = useState("");
  const [threshold, setThreshold] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (row) {
      setAvailable(String(row.available));
      setThreshold(String(row.lowStockThreshold));
    }
  }, [row]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!row) return;
    setSubmitting(true);
    try {
      await patchInventory(row.id, {
        available: available ? Number(available) : undefined,
        lowStockThreshold: threshold ? Number(threshold) : undefined,
      });
      pushToast({ tone: "success", title: "Inventory updated" });
      void fetchLowStock({ silent: true });
      onClose();
    } catch (err) {
      pushToast({
        tone: "alert",
        title: "Update failed",
        message: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={!!row} onClose={onClose} title={`Adjust — ${row?.name ?? ""}`}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Available stock" htmlFor="ls-avail">
            <Input
              id="ls-avail"
              type="number"
              value={available}
              onChange={(e) => setAvailable(e.target.value)}
            />
          </Field>
          <Field label="Low-stock threshold" htmlFor="ls-thr">
            <Input
              id="ls-thr"
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function LowStockView() {
  const lowStock = useAdminMarketplaceStore((s) => s.lowStock);
  const status = useAdminMarketplaceStore((s) => s.lowStockStatus);
  const fetchLowStock = useAdminMarketplaceStore((s) => s.fetchLowStock);

  const { hasPermission } = useAdminAuth();
  const canUpdate = hasPermission("marketplace:update");
  const [editing, setEditing] = useState<LowStockRow | null>(null);

  useEffect(() => {
    void fetchLowStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "loading") return <LoadingBlock label="Loading low-stock" />;
  if (lowStock.length === 0) {
    return (
      <EmptyBlock
        icon={PackageX}
        title="Nothing low on stock"
        hint="Products at or below their threshold surface here."
      />
    );
  }

  return (
    <section className="space-y-3">
      <div className="overflow-hidden rounded-3xl border border-border bg-surface/70">
        <ul className="divide-y divide-border">
          {lowStock.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/bennie/market-place/products/${r.id}`}
                    className="truncate text-sm font-semibold text-ink hover:text-primary"
                  >
                    {r.name}
                  </Link>
                  <SourcePill source={r.source} />
                </div>
                <p className="text-[11px] text-muted">
                  {r.productId ?? r.id} · threshold {r.lowStockThreshold}
                </p>
              </div>
              <span
                className={`text-sm font-bold ${
                  r.available === 0 ? "text-danger" : "text-[#a6701c] dark:text-accent"
                }`}
              >
                {r.available} left
              </span>
              {canUpdate && (
                <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>
                  Adjust
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <AdjustModal row={editing} onClose={() => setEditing(null)} />
    </section>
  );
}
