"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/Toast/ToastProvider";
import { SyncProvider } from "@/components/Sync/SyncProvider";
import { CommandPaletteProvider } from "@/components/CommandPalette/CommandPaletteContext";
import { CommandPalette } from "@/components/CommandPalette/CommandPalette";
import { NavDrawerProvider, useNavDrawer } from "./NavDrawerContext";
import { BreadcrumbProvider } from "./BreadcrumbContext";
import { Sidebar, type SidebarProps } from "./Sidebar";
import { Topbar } from "./Topbar";
import styles from "./dashboard.module.css";

type DashboardChromeProps = SidebarProps & {
  children: ReactNode;
};

function NavBackdrop() {
  const { open, close } = useNavDrawer();
  return (
    <div
      className={open ? `${styles.backdrop} ${styles.backdropOpen}` : styles.backdrop}
      onClick={close}
      aria-hidden="true"
    />
  );
}

export function DashboardChrome({ children, ...sidebarProps }: DashboardChromeProps) {
  return (
    <ToastProvider>
      <SyncProvider>
        <CommandPaletteProvider>
          <BreadcrumbProvider>
            <NavDrawerProvider>
              <div className={styles.shell}>
                <Sidebar {...sidebarProps} />
                <NavBackdrop />
                <div className={styles.main}>
                  <Topbar />
                  <main className={styles.content}>{children}</main>
                </div>
              </div>
              <CommandPalette initialMaintenance={sidebarProps.initialMaintenance} />
            </NavDrawerProvider>
          </BreadcrumbProvider>
        </CommandPaletteProvider>
      </SyncProvider>
    </ToastProvider>
  );
}
