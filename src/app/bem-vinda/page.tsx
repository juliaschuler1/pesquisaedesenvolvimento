import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { Card } from "@/components/ui/primitives";
import { BrandMark } from "@/components/shell/sidebar";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Boas-vindas" };

export default async function Welcome() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("memberships").select("org_id").eq("user_id", user.id).limit(1);
  if (data && data.length > 0) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg p-8">
        <BrandMark size={48} />
        <h1 className="mt-6 font-serif text-[30px] leading-tight text-ink">Vamos montar o seu estúdio</h1>
        <p className="mt-2 text-[14px] text-ink-soft">
          Dê um nome à sua consultoria. Nome, logo e cores podem ser alterados depois em Configurações.
        </p>
        <OnboardingForm />
      </Card>
    </div>
  );
}
