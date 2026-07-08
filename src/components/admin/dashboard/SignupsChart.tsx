/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";

import type { SignupTrendPoint } from "../../../types/admin";

/**
 * Lightweight inline-SVG area chart for the signups trend. No chart library.
 * Includes an accessible data-table fallback (visually hidden).
 */
export default function SignupsChart({
  data,
}: {
  data: SignupTrendPoint[];
}) {
  const W = 640;
  const H = 200;
  const P = 8;

  const { areaPath, linePath, max, hasData } = useMemo(() => {
    const points = data ?? [];
    if (points.length === 0) {
      return { areaPath: "", linePath: "", max: 0, hasData: false };
    }
    const maxV = Math.max(1, ...points.map((p) => p.count));
    const n = points.length;
    const x = (i: number) =>
      n === 1 ? W / 2 : P + (i * (W - 2 * P)) / (n - 1);
    const y = (v: number) => H - P - (v / maxV) * (H - 2 * P);

    const line = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.count).toFixed(1)}`)
      .join(" ");
    const area =
      `${line} L ${x(n - 1).toFixed(1)} ${H - P} L ${x(0).toFixed(1)} ${H - P} Z`;

    return { areaPath: area, linePath: line, max: maxV, hasData: true };
  }, [data]);

  if (!hasData) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted">
        No signups in this window yet.
      </div>
    );
  }

  const total = data.reduce((s, p) => s + p.count, 0);

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-[200px] w-full"
        role="img"
        aria-label={`Signups trend: ${total} new users, peak ${max} in a day.`}
      >
        <defs>
          <linearGradient id="signupsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#135D39" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#135D39" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#signupsFill)" />
        <path
          d={linePath}
          fill="none"
          stroke="#135D39"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      {/* Accessible fallback table */}
      <figcaption className="sr-only">
        <table>
          <caption>New signups per day</caption>
          <thead>
            <tr>
              <th>Date</th>
              <th>Signups</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.date}>
                <td>{p.date}</td>
                <td>{p.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
