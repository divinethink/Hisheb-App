// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PinPad from './PinPad';

afterEach(cleanup);

describe('PinPad', () => {
  it('৪ অঙ্কের পর ঠিক একবার onComplete(pin) ডাকে', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onComplete = vi.fn();
    render(<PinPad title="Enter" onComplete={onComplete} />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    for (const d of ['1', '2', '3', '4']) await user.click(screen.getByRole('button', { name: d }));
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('1234');
    vi.useRealTimers();
  });

  it('Delete শেষ অঙ্ক মোছে; error ফাঁকা-ইনপুটে দেখায়', async () => {
    const user = userEvent.setup();
    render(<PinPad title="Enter" error="Wrong passcode" onComplete={() => {}} />);
    expect(screen.getByRole('alert').textContent).toBe('Wrong passcode');
    await user.click(screen.getByRole('button', { name: '5' }));
    expect(screen.getByRole('alert').textContent).toBe('');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alert').textContent).toBe('Wrong passcode');
  });
});
