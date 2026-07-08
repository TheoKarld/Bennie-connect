/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ invalid = false, className = "", ...rest }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full rounded-2xl border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted/70 transition focus:outline-none focus:ring-2 ${
          invalid
            ? "border-danger/60 focus:ring-danger/25"
            : "border-border focus:border-primary focus:ring-primary/15"
        } ${className}`}
        {...rest}
      />
    );
  }
);

Input.displayName = "Input";

export default Input;
