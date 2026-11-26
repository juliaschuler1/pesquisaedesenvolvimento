function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não configurada. Veja a seção "Configuração" do README.md.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () =>
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  /** Recursos de IA só são exibidos como ativos quando a chave existe no servidor. */
  aiConfigured: () => Boolean(process.env.ANTHROPIC_API_KEY),
};
