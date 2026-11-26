"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import type { NavGroup } from "@/lib/session";

export function AppFrame({
  nav,
  brandName,
  tagline,
  logoUrl,
  fullName,
  email,
  themeStyle,
  children,
}: {
  nav: NavGroup[];
  brandName: string;
  tagline: string | null;
  logoUrl: string | null;
  fullName: string;
  email: string;
  themeStyle: React.CSSProperties;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const close = useCallback(() => setMobileOpen(false), []);
  return (
    <div className="flex min-h-dvh" style={themeStyle}>
      <Sidebar nav={nav} brandName={brandName} tagline={tagline} logoUrl={logoUrl} mobileOpen={mobileOpen} onCloseMobile={close} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar fullName={fullName} email={email} onOpenMenu={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-7 md:px-8 md:py-9">{children}</main>
      </div>
    </div>
  );
}
