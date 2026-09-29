import { useAuth } from './AuthProvider';

export default function LoginScreen({ restricted = false, error }: { restricted?: boolean; error?: string }) {
  const { signIn } = useAuth();
  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 bg-canvas px-6 text-center">
      <h1 className="text-2xl font-semibold text-fg">হিসাব-নিকাশ</h1>
      {restricted && (
        <p role="alert" className="max-w-xs text-sm text-fg">
          <strong>Access restricted.</strong> This account is not allowed to use this app. Sign in with the owner account.
        </p>
      )}
      {error && (
        <p role="alert" className="max-w-xs text-sm text-fg">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void signIn()}
        className="min-h-11 rounded-lg bg-primary px-6 text-base font-medium text-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Sign in with Google
      </button>
    </main>
  );
}
