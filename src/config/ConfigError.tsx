export default function ConfigError({ missing }: { missing: string[] }) {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
      <h1 className="text-xl font-semibold text-fg">Configuration missing</h1>
      <p className="max-w-xs text-sm text-muted">Add these values to your .env file and restart:</p>
      <ul className="text-sm text-fg">
        {missing.map((k) => (
          <li key={k}><code>{k}</code></li>
        ))}
      </ul>
    </main>
  );
}
