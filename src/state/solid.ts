import type { Entity, QueryResult, Trait, World } from 'koota';
import { createSignal, onCleanup } from 'solid-js';
import { gameWorld } from './world';

type AnyTrait = Trait<any>;
type UnwrapFactory<T> = T extends (...args: any[]) => infer R ? R : T;
type ResolveSchema<S> = S extends object
  ? { [K in keyof S]: UnwrapFactory<S[K]> }
  : UnwrapFactory<S>;
type TraitInstance<T> = T extends Trait<infer S> ? ResolveSchema<S> : never;

export function useQuery(...traits: AnyTrait[]): () => QueryResult<AnyTrait[]> {
  const [entities, setEntities] = createSignal<QueryResult<AnyTrait[]>>(gameWorld.query(...traits));
  const refresh = () => queueMicrotask(() => setEntities(gameWorld.query(...traits)));
  const unsubAdd = gameWorld.onQueryAdd(traits, refresh);
  const unsubRemove = gameWorld.onQueryRemove(traits, refresh);
  onCleanup(() => {
    unsubAdd();
    unsubRemove();
  });
  return entities;
}

function readTrait<T extends AnyTrait>(
  target: Entity | World | undefined | null,
  trait: T,
): TraitInstance<T> | undefined {
  if (!target) return undefined;
  if (target === gameWorld)
    return gameWorld.has(trait) ? (gameWorld.get(trait) as TraitInstance<T>) : undefined;
  return target.has(trait) ? ((target as any).get(trait) as TraitInstance<T>) : undefined;
}

export function useTrait<T extends AnyTrait>(
  target: Entity | World | undefined | null,
  trait: T,
): () => TraitInstance<T> | undefined {
  const [value, setValue] = createSignal<TraitInstance<T> | undefined>(readTrait(target, trait), {
    equals: false,
  });
  const refresh = () => queueMicrotask(() => setValue(() => readTrait(target, trait)));
  const unsubChange = gameWorld.onChange(trait, (entity) => {
    if (target === gameWorld || entity === target) refresh();
  });
  const unsubAdd = gameWorld.onAdd(trait, (entity) => {
    if (target === gameWorld || entity === target) refresh();
  });
  const unsubRemove = gameWorld.onRemove(trait, (entity) => {
    if (target === gameWorld || entity === target) refresh();
  });
  onCleanup(() => {
    unsubChange();
    unsubAdd();
    unsubRemove();
  });
  return value;
}
