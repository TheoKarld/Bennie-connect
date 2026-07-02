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
        className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm text-[#1A2421] placeholder:text-[#9AA29D] transition focus:outline-none focus:ring-2 ${
          invalid
            ? "border-red-400 focus:ring-red-200"
            : "border-[#E6E5DF] focus:border-[#135D39] focus:ring-[#135D39]/15"
        } ${className}`}
        {...rest}
      />
    );
  }
);

Input.displayName = "Input";

export default Input;
