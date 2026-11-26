import { AppFrame } from "@/components/shell/app-frame";
import { getSession } from "@/lib/session";
import { themeToStyle } from "@/lib/theme";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  return (
    <AppFrame
      nav={s.nav}
      brandName={s.settings.brand_name}
      tagline={s.settings.tagline}
      logoUrl={s.logoUrl}
      fullName={s.fullName}
      email={s.email}
      themeStyle={themeToStyle(s.settings.theme) as React.CSSProperties}
    >
      {children}
    </AppFrame>
  );
}
