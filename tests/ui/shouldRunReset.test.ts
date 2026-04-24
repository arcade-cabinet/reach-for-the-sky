import { describe, expect, it, vi } from 'vitest';
import { shouldRunReset } from '../../app/App';

describe('shouldRunReset (Reset safety guard)', () => {
  it('bypasses confirm() under webdriver/automation', () => {
    const confirmFn = vi.fn(() => false);
    const result = shouldRunReset({ automated: true, confirmFn });
    expect(result).toBe(true);
    expect(confirmFn).not.toHaveBeenCalled();
  });

  it('returns true when confirm() resolves true (user clicks OK)', () => {
    const confirmFn = vi.fn(() => true);
    const result = shouldRunReset({ automated: false, confirmFn });
    expect(result).toBe(true);
    expect(confirmFn).toHaveBeenCalledOnce();
  });

  it('returns false when confirm() resolves false (user cancels)', () => {
    const confirmFn = vi.fn(() => false);
    const result = shouldRunReset({ automated: false, confirmFn });
    expect(result).toBe(false);
    expect(confirmFn).toHaveBeenCalledOnce();
  });
});
