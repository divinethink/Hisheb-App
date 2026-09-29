import { useEffect, useRef, useState } from 'react';

export type LiveState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string };

/** subscribe-ভিত্তিক ডেটার generic hook: loading → ready | error, retry() সহ। key বদলালে আবার subscribe। */
export function useLiveQuery<T>(
  key: string,
  subscribe: (onData: (d: T) => void, onError: (e: Error) => void) => () => void,
): { state: LiveState<T>; retry: () => void } {
  const [state, setState] = useState<LiveState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const subRef = useRef(subscribe);
  useEffect(() => {
    subRef.current = subscribe;
  });

  useEffect(() => {
    setState({ status: 'loading' });
    return subRef.current(
      (data) => setState({ status: 'ready', data }),
      (e) => setState({ status: 'error', message: e.message }),
    );
  }, [key, attempt]);

  return { state, retry: () => setAttempt((n) => n + 1) };
}
