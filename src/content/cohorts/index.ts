import type { VisitorArchetype, VisitorArchetypeId } from '../../simulation/visitors';
import buddhistMonks from './buddhist-monks.json';
import cityInspectors from './city-inspectors.json';
import civicDelegation from './civic-delegation.json';
import filmFestivalJury from './film-festival-jury.json';
import foreignPrince from './foreign-prince.json';
import laborDelegation from './labor-delegation.json';
import movieStar from './movie-star.json';
import politician from './politician.json';
import pressSwarm from './press-swarm.json';
import schoolTeachers from './school-teachers.json';
import stampCollectors from './stamp-collectors.json';
import techInvestors from './tech-investors.json';
import tradeBuyers from './trade-buyers.json';

type RawArchetype = Omit<VisitorArchetype, 'id' | 'goals'> & {
  id: string;
  goals: string[];
};

function narrow(data: RawArchetype, expectedId: VisitorArchetypeId): VisitorArchetype {
  if (data.id !== expectedId) {
    throw new Error(
      `authored archetype id mismatch: file declares "${data.id}" but was registered as "${expectedId}"`,
    );
  }
  return data as VisitorArchetype;
}

const AUTHORED_ARCHETYPES: readonly VisitorArchetype[] = [
  narrow(movieStar, 'movie-star'),
  narrow(politician, 'politician'),
  narrow(foreignPrince, 'foreign-prince'),
  narrow(buddhistMonks, 'buddhist-monks'),
  narrow(schoolTeachers, 'school-teachers'),
  narrow(stampCollectors, 'stamp-collectors'),
  narrow(laborDelegation, 'labor-delegation'),
  narrow(tradeBuyers, 'trade-buyers'),
  narrow(cityInspectors, 'city-inspectors'),
  narrow(pressSwarm, 'press-swarm'),
  narrow(filmFestivalJury, 'film-festival-jury'),
  narrow(techInvestors, 'tech-investors'),
  narrow(civicDelegation, 'civic-delegation'),
];

function buildAuthoredArchetypes(): Record<VisitorArchetypeId, VisitorArchetype> {
  const table = {} as Record<VisitorArchetypeId, VisitorArchetype>;
  for (const archetype of AUTHORED_ARCHETYPES) {
    if (table[archetype.id]) {
      throw new Error(
        `duplicate visitor archetype id "${archetype.id}" in src/content/cohorts/*.json`,
      );
    }
    table[archetype.id] = archetype;
  }
  return table;
}

export const AUTHORED_VISITOR_ARCHETYPES = buildAuthoredArchetypes();
