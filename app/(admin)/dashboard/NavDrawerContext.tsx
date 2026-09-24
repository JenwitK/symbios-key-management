"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

type NavDrawerContextValue = {
  open: boolean;
  toggle: () => void;
  close: () => void;
};

const NavDrawerContext = createContext<NavDrawerContextValue | null>(null);

export function useNavDrawer(): NavDrawerContextValue {
  const ctx = useContext(NavDrawerContext);
  if (!ctx) {
    throw new Error("useNavDrawer must be used within NavDrawerProvider");
  }
  return ctx;
}

export function NavDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change, adjusted during render (not an effect) per
  // React's "adjusting state when a prop changes" pattern.
  const [closedForPathname, setClosedForPathname] = useState(pathname);
  if (pathname !== closedForPathname) {
    setClosedForPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <NavDrawerContext.Provider
      value={{
        open,
        toggle: () => setOpen((current) => !current),
        close: () => setOpen(false),
      }}
    >
      {children}
    </NavDrawerContext.Provider>
  );
}
