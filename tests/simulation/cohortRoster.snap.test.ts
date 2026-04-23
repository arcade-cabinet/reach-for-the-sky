import { describe, expect, it } from 'vitest';
import { AUTHORED_VISITOR_ARCHETYPES } from '@/content/cohorts';

// Golden snapshot of the authored cohort roster. If this test fails, an
// archetype was added, removed, or silently mutated — confirm the change
// is intentional, update the snapshot, and document the roster change in
// docs/CONTENT.md. Prevents silent content loss (T06 PRD criterion).
describe('cohort roster snapshot (T06)', () => {
  it('authored roster matches the committed snapshot', () => {
    const roster = Object.values(AUTHORED_VISITOR_ARCHETYPES)
      .map((archetype) => ({
        id: archetype.id,
        label: archetype.label,
        minSize: archetype.minSize,
        maxSize: archetype.maxSize,
        goals: [...archetype.goals].sort(),
        volatility: archetype.volatility,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    expect(roster).toMatchInlineSnapshot(`
      [
        {
          "goals": [
            "food",
            "quiet",
          ],
          "id": "buddhist-monks",
          "label": "Buddhist monks",
          "maxSize": 18,
          "minSize": 4,
          "volatility": 0.14,
        },
        {
          "goals": [
            "meeting",
            "quiet",
          ],
          "id": "city-inspectors",
          "label": "City inspector tour",
          "maxSize": 10,
          "minSize": 3,
          "volatility": 0.52,
        },
        {
          "goals": [
            "meeting",
            "publicity",
          ],
          "id": "civic-delegation",
          "label": "Civic delegation",
          "maxSize": 24,
          "minSize": 6,
          "volatility": 0.32,
        },
        {
          "goals": [
            "food",
            "publicity",
            "quiet",
          ],
          "id": "film-festival-jury",
          "label": "Film festival jury",
          "maxSize": 14,
          "minSize": 4,
          "volatility": 0.64,
        },
        {
          "goals": [
            "food",
            "lodging",
            "shopping",
          ],
          "id": "foreign-prince",
          "label": "Foreign prince and retainers",
          "maxSize": 24,
          "minSize": 6,
          "volatility": 0.82,
        },
        {
          "goals": [
            "food",
            "meeting",
          ],
          "id": "labor-delegation",
          "label": "Labor delegation",
          "maxSize": 42,
          "minSize": 10,
          "volatility": 0.44,
        },
        {
          "goals": [
            "food",
            "lodging",
            "publicity",
          ],
          "id": "movie-star",
          "label": "Movie star entourage",
          "maxSize": 12,
          "minSize": 3,
          "volatility": 0.72,
        },
        {
          "goals": [
            "food",
            "meeting",
            "publicity",
          ],
          "id": "politician",
          "label": "Campaign delegation",
          "maxSize": 30,
          "minSize": 8,
          "volatility": 0.66,
        },
        {
          "goals": [
            "food",
            "meeting",
            "publicity",
          ],
          "id": "press-swarm",
          "label": "Press swarm",
          "maxSize": 26,
          "minSize": 6,
          "volatility": 0.78,
        },
        {
          "goals": [
            "food",
            "meeting",
            "shopping",
          ],
          "id": "school-teachers",
          "label": "School teacher convention",
          "maxSize": 90,
          "minSize": 24,
          "volatility": 0.28,
        },
        {
          "goals": [
            "meeting",
            "quiet",
            "shopping",
          ],
          "id": "stamp-collectors",
          "label": "Stamp collector convention",
          "maxSize": 48,
          "minSize": 12,
          "volatility": 0.36,
        },
        {
          "goals": [
            "food",
            "meeting",
            "shopping",
          ],
          "id": "tech-investors",
          "label": "Tech investor summit",
          "maxSize": 36,
          "minSize": 8,
          "volatility": 0.48,
        },
        {
          "goals": [
            "food",
            "meeting",
            "shopping",
          ],
          "id": "trade-buyers",
          "label": "Trade buyers",
          "maxSize": 64,
          "minSize": 16,
          "volatility": 0.5,
        },
      ]
    `);
  });

  it('every authored archetype has at least one goal and non-empty size range', () => {
    const archetypes = Object.values(AUTHORED_VISITOR_ARCHETYPES);
    expect(archetypes.length).toBeGreaterThanOrEqual(12);
    for (const archetype of archetypes) {
      expect(archetype.goals.length).toBeGreaterThan(0);
      expect(archetype.maxSize).toBeGreaterThanOrEqual(archetype.minSize);
      expect(archetype.minSize).toBeGreaterThan(0);
    }
  });
});
