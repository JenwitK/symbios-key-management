"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type CommandPaletteContextValue = {
  open: boolean;
  openPalette: () => void;
  closePalette: () => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  }
  return ctx;
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <CommandPaletteContext.Provider
      value={{
        open,
        openPalette: () => setOpen(true),
        closePalette: () => setOpen(false),
      }}
    >
      {children}
    </CommandPaletteContext.Provider>
  );
}
