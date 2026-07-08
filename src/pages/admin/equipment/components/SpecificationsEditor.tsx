/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Add/remove key-value editor for `Equipment.specifications`.
 *
 * Renders the current spec map as editable rows (key + value) with an add-row
 * button and per-row remove. Reports the assembled `Record<string, string>` up
 * on every change (blank-key rows are dropped when assembling).
 */

import React from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button, Input } from "../../../../components/ui";

interface Row {
  key: string;
  value: string;
}

interface Props {
  value: Record<string, string | number>;
  onChange: (specs: Record<string, string>) => void;
}

export default function SpecificationsEditor({ value, onChange }: Props) {
  // Keep local ordered rows so blank/duplicate keys can be edited freely.
  const [rows, setRows] = React.useState<Row[]>(() => {
    const entries = Object.entries(value ?? {});
    return entries.length
      ? entries.map(([k, v]) => ({ key: k, value: String(v) }))
      : [{ key: "", value: "" }];
  });

  const emit = (next: Row[]) => {
    const specs: Record<string, string> = {};
    next.forEach((r) => {
      const k = r.key.trim();
      if (k) specs[k] = r.value;
    });
    onChange(specs);
  };

  const update = (idx: number, patch: Partial<Row>) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    setRows(next);
    emit(next);
  };

  const addRow = () => setRows((r) => [...r, { key: "", value: "" }]);

  const removeRow = (idx: number) => {
    const next = rows.filter((_, i) => i !== idx);
    const finalRows = next.length ? next : [{ key: "", value: "" }];
    setRows(finalRows);
    emit(finalRows);
  };

  return (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            value={row.key}
            onChange={(e) => update(idx, { key: e.target.value })}
            placeholder="Spec (e.g. enginePowerHp)"
            className="!py-2.5"
          />
          <Input
            value={row.value}
            onChange={(e) => update(idx, { value: e.target.value })}
            placeholder="Value (e.g. 75)"
            className="!py-2.5"
          />
          <button
            type="button"
            onClick={() => removeRow(idx)}
            className="shrink-0 rounded-xl p-2 text-muted transition hover:bg-danger/10 hover:text-danger"
            title="Remove spec"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Button type="button" size="sm" variant="ghost" onClick={addRow}>
        <Plus className="h-4 w-4" /> Add specification
      </Button>
    </div>
  );
}
