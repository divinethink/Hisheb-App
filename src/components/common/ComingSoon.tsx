export default function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="text-lg font-semibold text-fg">{title}</h1>
      <p className="max-w-xs text-sm text-muted">{note}</p>
    </div>
  );
}
