import { DAY_TICKS } from './types';

export function getHour(tick: number): number {
  return Math.floor((tick / DAY_TICKS) * 24);
}

export function formatHour(tick: number): string {
  const hour = getHour(tick);
  const minute = Math.floor((((tick / DAY_TICKS) * 24) % 1) * 60);
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

export function getSkyColor(tick: number): string {
  const hour = getHour(tick);
  if (hour < 5) return '#020024';
  if (hour < 7) return '#B97961';
  if (hour < 16) return '#4F97AC';
  if (hour < 19) return '#A85F56';
  return '#020024';
}
