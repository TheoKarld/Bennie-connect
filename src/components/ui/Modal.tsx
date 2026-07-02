/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  className = "",
}: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1A2421]/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg rounded-3xl border border-[#E6E5DF] bg-[#FAF8F5] p-6 shadow-2xl ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || onClose) && (
          <div className="mb-4 flex items-center justify-between">
            {title && (
              <h3 className="font-display text-lg font-semibold text-[#1A2421]">
                {title}
              </h3>
            )}
            <button
              onClick={onClose}
              className="ml-auto rounded-xl p-1.5 text-[#5C6460] transition hover:bg-[#135D39]/5 hover:text-[#1A2421]"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
