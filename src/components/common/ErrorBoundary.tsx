import { Component, type ReactNode } from 'react';

// কোনো কম্পোনেন্ট render-এ ভেঙে পড়লে পুরো স্ক্রিন সাদা না হয়ে এই পাতা দেখায়। ডেটা অক্ষত থাকে (Firestore-এ কিছু লেখা হয় না)।
// ইচ্ছাকৃতভাবে ত্রুটির বিস্তারিত log/analytics-এ পাঠানো হয় না (আর্থিক ডেটা থাকতে পারে)।
interface Props {
  children: ReactNode;
}
interface State {
  failed: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main role="alert" className="flex h-full flex-col items-center justify-center gap-3 bg-canvas px-6 text-center text-fg">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="max-w-xs text-sm text-muted">Your data is safe. Try again, or reload the app.</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => this.setState({ failed: false })}
            className="min-h-11 rounded-lg border border-muted/40 px-4 text-sm"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas"
          >
            Reload
          </button>
        </div>
      </main>
    );
  }
}
