"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type BreadcrumbOverride = { leading: string; trailing: string };

type BreadcrumbContextValue = {
  override: BreadcrumbOverride | null;
  setOverride: (value: BreadcrumbOverride | null) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<BreadcrumbOverride | null>(null);
  return (
    <BreadcrumbContext.Provider value={{ override, setOverride }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

function useBreadcrumbContext(): BreadcrumbContextValue {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) {
    throw new Error("useBreadcrumbContext must be used within BreadcrumbProvider");
  }
  return ctx;
}

export function useBreadcrumbOverride(): BreadcrumbOverride | null {
  return useBreadcrumbContext().override;
}

/** Call from a page to replace both topbar crumbs (e.g. "Keys / <key_value>" on the key detail page). */
export function useSetBreadcrumb(leading: string, trailing: string) {
  const { setOverride } = useBreadcrumbContext();

  useEffect(() => {
    setOverride({ leading, trailing });
    return () => setOverride(null);
  }, [leading, trailing, setOverride]);
}
