import { AuthProvider, useAuth } from './auth/AuthProvider';
import LoginScreen from './auth/LoginScreen';
import AppShell from './components/AppShell';

function Gate() {
  const { state } = useAuth();
  if (state.status === 'loading') return <main className="h-full bg-canvas" aria-busy="true" aria-label="Loading" />;
  if (state.status === 'signedOut') return <LoginScreen error={state.error} />;
  if (state.status === 'restricted') return <LoginScreen restricted />;
  return <AppShell user={state.user} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
