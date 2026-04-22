import mitt, { type Emitter } from "mitt";

export type EventMap = object;
export type TypedEventBus<TEvents extends EventMap> = Emitter<
  Record<keyof TEvents, TEvents[keyof TEvents]>
>;

export function createEventBus<TEvents extends EventMap>() {
  return mitt() as TypedEventBus<TEvents>;
}
