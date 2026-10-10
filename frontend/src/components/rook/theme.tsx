"use client";

import { createContext, useContext, type ReactNode } from "react";

import { ROOK_COLORS, ROOK_ICON_SIZE, ROOK_LAYOUT } from "./tokens";

const theme = { colors: ROOK_COLORS, iconSize: ROOK_ICON_SIZE, layout: ROOK_LAYOUT } as const;
const RookTheme = createContext(theme);

/** Root of the design system: exposes tokens to components and marks the tree as themed by ROOK. */
export function RookThemeProvider({ children }: { children: ReactNode }) {
  return (
    <RookTheme.Provider value={theme}>
      <div data-rook-theme="v2" className="contents">
        {children}
      </div>
    </RookTheme.Provider>
  );
}

export function useRookTheme() {
  return useContext(RookTheme);
}
