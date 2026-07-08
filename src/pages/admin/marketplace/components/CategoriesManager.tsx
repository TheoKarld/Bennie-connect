/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Categories manager — list (with in-use product counts), create/edit modal,
 * active toggle, and delete guarded by the in-use check (server returns
 * MKT_ADM_010). Gated by `marketplace:configure` (caller passes `canConfigure`).
 * Brand tokens, full light/dark support.
 */

import React, { useEffect, useState } from "react";
import { Plus, Tag, Trash2, Pencil } from "lucide-react";

import { Modal, Field, Input, Button, pushToast } from "../../../../components/ui";
import { useAdminMarketplaceStore } from "../../../../store/adminMarketplaceStore";
import type { AdminCategory } from "../../../../types/adminMarketplace";
import { EmptyBlock, LoadingBlock } from "./shared";

function CategoryModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: AdminCategory | null;
}) {
  const createCategory = useAdminMarketplaceStore((s) => s.createCategory);
  const updateCategory = useAdminMarketplaceStore((s) => s.updateCategory);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setIcon(editing?.icon ?? "");
    setIsActive(editing?.isActive ?? true);
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        icon: icon.trim() || undefined,
        isActive,
      };
      if (editing) await updateCategory(editing.id, payload);
      else await createCategory(payload);
      pushToast({ tone: "success", title: editing ? "Category updated" : "Category created" });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the category.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit category" : "New category"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" htmlFor="cat-name">
          <Input
            id="cat-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seeds"
            invalid={!!error}
          />
        </Field>
        <Field label="Description (optional)" htmlFor="cat-desc">
          <Input
            id="cat-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Certified planting seeds"
          />
        </Field>
        <Field label="Icon key (optional)" htmlFor="cat-icon">
          <Input
            id="cat-icon"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="sprout"
          />
        </Field>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3">
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
              isActive ? "bg-primary" : "bg-border"
            }`}
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
              style={{ left: isActive ? 22 : 2 }}
            />
          </button>
          <span className="text-sm font-medium text-ink">
            Active {isActive ? "" : "— hidden from browse, blocks new listings"}
          </span>
        </label>

        {error && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {editing ? "Save changes" : "Create category"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function CategoriesManager({
  canConfigure,
}: {
  canConfigure: boolean;
}) {
  const categories = useAdminMarketplaceStore((s) => s.categories);
  const status = useAdminMarketplaceStore((s) => s.categoriesStatus);
  const fetchCategories = useAdminMarketplaceStore((s) => s.fetchCategories);
  const deleteCategory = useAdminMarketplaceStore((s) => s.deleteCategory);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);

  useEffect(() => {
    void fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDelete = async (c: AdminCategory) => {
    if (c.productCount > 0) {
      pushToast({
        tone: "alert",
        title: "Category in use",
        message: `${c.productCount} product(s) reference "${c.name}". Reassign them first.`,
      });
      return;
    }
    try {
      await deleteCategory(c.id);
      pushToast({ tone: "success", title: "Category deleted" });
    } catch (err) {
      pushToast({
        tone: "alert",
        title: "Delete failed",
        message: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">Categories</h2>
          <p className="text-[11px] text-muted">
            Seeded with 8 defaults. Inactive categories hide from browse and block new
            listings.
          </p>
        </div>
        {canConfigure && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New category
          </Button>
        )}
      </div>

      {status === "loading" && <LoadingBlock label="Loading categories" />}
      {status !== "loading" && categories.length === 0 && (
        <EmptyBlock
          icon={Tag}
          title="No categories yet"
          hint="Create the first category to organise the catalogue."
        />
      )}
      {categories.length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-border bg-surface/70">
          <ul className="divide-y divide-border">
            {categories.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                  <Tag className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                        c.isActive
                          ? "bg-primary/10 text-primary"
                          : "bg-muted/10 text-muted"
                      }`}
                    >
                      {c.isActive ? "Active" : "Off"}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-muted">
                    {c.productCount} product(s)
                    {c.description ? ` · ${c.description}` : ""}
                  </p>
                </div>
                {canConfigure && (
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(c);
                        setModalOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="!text-danger hover:!bg-danger/5"
                      onClick={() => void onDelete(c)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <CategoryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
      />
    </section>
  );
}
