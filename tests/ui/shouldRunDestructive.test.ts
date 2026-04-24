import { describe, expect, it, vi } from 'vitest';
import { shouldRunDestructive } from '../../app/App';

describe('shouldRunDestructive (reset/delete safety guard)', () => {
  const message = 'Destroy the thing?';

  it('bypasses confirm() under webdriver/automation', () => {
    const confirmFn = vi.fn(() => false);
    const result = shouldRunDestructive({ automated: true, confirmFn, message });
    expect(result).toBe(true);
    expect(confirmFn).not.toHaveBeenCalled();
  });

  it('returns true when confirm() resolves true (user clicks OK)', () => {
    const confirmFn = vi.fn(() => true);
    const result = shouldRunDestructive({ automated: false, confirmFn, message });
    expect(result).toBe(true);
    expect(confirmFn).toHaveBeenCalledOnce();
    expect(confirmFn).toHaveBeenCalledWith(message);
  });

  it('returns false when confirm() resolves false (user cancels)', () => {
    const confirmFn = vi.fn(() => false);
    const result = shouldRunDestructive({ automated: false, confirmFn, message });
    expect(result).toBe(false);
    expect(confirmFn).toHaveBeenCalledOnce();
    expect(confirmFn).toHaveBeenCalledWith(message);
  });
});
