import { render } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import { StartScreen } from '@app/components/StartScreen';
import type { SaveSlotSummary } from '@/persistence/saveRepository';

function baseProps(overrides: Partial<Parameters<typeof StartScreen>[0]> = {}) {
  return {
    assetUrl: (path: string) => `/${path}`,
    formatSlotSummary: () => 'no save yet',
    onContinue: vi.fn(),
    onScenario: vi.fn(),
    onSelectSaveSlot: vi.fn(),
    onStart: vi.fn(),
    platformLabel: 'Web',
    saveSlots: [] as SaveSlotSummary[],
    scenarios: [
      { id: 'opening' as const, title: 'Working Tower', description: 'Queues and rent.', preview: 'assets/previews/opening-desktop.png', actFocus: 1 },
      { id: 'skyline' as const, title: 'Skyline Charter', description: 'A recognized landmark.', preview: 'assets/previews/skyline-victory-desktop.png', actFocus: 5 },
      { id: 'weather' as const, title: 'Weather Front', description: 'Height risk.', preview: 'assets/previews/weather-stress-desktop.png', actFocus: 4 },
      { id: 'recovery' as const, title: 'Public Recovery', description: 'Repair contracts.', preview: 'assets/previews/recovery-contract-desktop.png', actFocus: 3 },
    ],
    selectedSaveSlot: 'slot-a',
    slotLabel: (slotId: string) => slotId.toUpperCase(),
    startNotice: null,
    ...overrides,
  };
}

describe('StartScreen (browser)', () => {
  it('renders Break Ground and Continue Tower buttons', () => {
    const { getByText } = render(() => <StartScreen {...baseProps()} />);
    expect(getByText('Break Ground')).toBeDefined();
    expect(getByText('Continue Tower')).toBeDefined();
  });

  it('disables Continue Tower when no save slots exist', () => {
    const { getByText } = render(() => <StartScreen {...baseProps({ saveSlots: [] })} />);
    const continueBtn = getByText('Continue Tower') as HTMLButtonElement;
    expect(continueBtn.disabled).toBe(true);
    expect(continueBtn.title).toContain('Break Ground');
  });

  it('enables Continue Tower when at least one save exists', () => {
    const slot: SaveSlotSummary = {
      slotId: 'slot-a',
      savedAt: new Date().toISOString(),
      day: 3,
      funds: 100_000,
      population: 10,
    } as SaveSlotSummary;
    const { getByText } = render(() =>
      <StartScreen {...baseProps({ saveSlots: [slot] })} />,
    );
    const continueBtn = getByText('Continue Tower') as HTMLButtonElement;
    expect(continueBtn.disabled).toBe(false);
  });

  it('Break Ground click fires onStart', async () => {
    const onStart = vi.fn();
    const { getByText } = render(() => <StartScreen {...baseProps({ onStart })} />);
    (getByText('Break Ground') as HTMLButtonElement).click();
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('scenario cards render an image, title, and description per scenario', () => {
    const { container } = render(() => <StartScreen {...baseProps()} />);
    const cards = container.querySelectorAll('.start-scenario-card');
    expect(cards.length).toBe(4);
    for (const card of cards) {
      expect(card.querySelector('img')).not.toBeNull();
      expect(card.querySelector('strong')?.textContent?.length ?? 0).toBeGreaterThan(0);
      expect(card.querySelector('small')?.textContent?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('save-slot buttons use radiogroup semantics for mutual exclusion', () => {
    const slots: SaveSlotSummary[] = [
      { slotId: 'slot-a', savedAt: new Date().toISOString(), day: 3, funds: 100_000, population: 10 } as SaveSlotSummary,
      { slotId: 'slot-b', savedAt: new Date().toISOString(), day: 5, funds: 200_000, population: 20 } as SaveSlotSummary,
    ];
    const { container } = render(() =>
      <StartScreen {...baseProps({ saveSlots: slots, selectedSaveSlot: 'slot-a' })} />,
    );
    const group = container.querySelector('.start-save-row[role="radiogroup"]');
    expect(group).not.toBeNull();
    const radios = container.querySelectorAll('.start-save-row button[role="radio"]');
    expect(radios.length).toBe(2);
    expect((radios[0] as HTMLButtonElement).getAttribute('aria-checked')).toBe('true');
    expect((radios[1] as HTMLButtonElement).getAttribute('aria-checked')).toBe('false');
  });
});
