import type { VisitorArchetype, VisitorArchetypeId } from '../../simulation/visitors';
import buddhistMonks from './buddhist-monks.json';
import cityInspectors from './city-inspectors.json';
import foreignPrince from './foreign-prince.json';
import laborDelegation from './labor-delegation.json';
import movieStar from './movie-star.json';
import politician from './politician.json';
import pressSwarm from './press-swarm.json';
import schoolTeachers from './school-teachers.json';
import stampCollectors from './stamp-collectors.json';
import tradeBuyers from './trade-buyers.json';

const AUTHORED_ARCHETYPES: VisitorArchetype[] = [
  movieStar,
  politician,
  foreignPrince,
  buddhistMonks,
  schoolTeachers,
  stampCollectors,
  laborDelegation,
  tradeBuyers,
  cityInspectors,
  pressSwarm,
] as VisitorArchetype[];

export const AUTHORED_VISITOR_ARCHETYPES: Record<VisitorArchetypeId, VisitorArchetype> =
  AUTHORED_ARCHETYPES.reduce(
    (acc, archetype) => {
      acc[archetype.id] = archetype;
      return acc;
    },
    {} as Record<VisitorArchetypeId, VisitorArchetype>,
  );
