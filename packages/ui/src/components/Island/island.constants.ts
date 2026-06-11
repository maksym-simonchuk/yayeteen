import type { IslandVariant } from './island.types';

export const DIMENSIONS: Record<IslandVariant, { maxW: number; viewBox: string }> = {
  hero: { maxW: 480, viewBox: '0 0 480 600' },
  mini: { maxW: 240, viewBox: '0 0 480 600' },
  explainer: { maxW: 360, viewBox: '0 0 480 600' },
};

export const STARS: ReadonlyArray<readonly [number, number, number, number]> = [
  [60, 50, 1.2, 0.9],
  [140, 30, 0.8, 0.7],
  [210, 75, 1.0, 0.85],
  [290, 45, 1.4, 0.95],
  [360, 65, 0.9, 0.7],
  [420, 35, 1.1, 0.8],
  [105, 110, 0.7, 0.55],
  [195, 130, 0.9, 0.65],
  [370, 145, 1.0, 0.7],
  [435, 95, 0.8, 0.6],
  [25, 95, 0.9, 0.5],
  [320, 110, 0.7, 0.5],
  [85, 175, 0.8, 0.55],
  [255, 185, 1.0, 0.7],
  [410, 200, 0.9, 0.6],
];
