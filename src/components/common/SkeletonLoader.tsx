export default function SkeletonLoader({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="h-12 rounded-lg bg-surface bg-[length:200%_100%] motion-reduce:animate-none motion-safe:animate-[hn-shimmer_1.6s_ease-in-out_infinite]"
          style={{ backgroundImage: 'linear-gradient(90deg, transparent 0%, rgb(var(--color-muted) / 0.18) 50%, transparent 100%)' }}
        />
      ))}
    </div>
  );
}
