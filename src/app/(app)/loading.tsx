export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando">
      <div className="skeleton h-10 w-72 rounded-xl" />
      <div className="skeleton h-28 w-full rounded-[var(--radius-card)]" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="skeleton h-56 rounded-[var(--radius-card)] lg:col-span-2" />
        <div className="skeleton h-56 rounded-[var(--radius-card)]" />
      </div>
    </div>
  );
}
