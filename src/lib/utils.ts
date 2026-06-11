import { nanoid } from 'nanoid';
import type { MapFragment, Annotation, AssemblyScheme, Point, AnnotationType } from '@/types';
export function generateId(): string {
  return nanoid(10);
}
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
export function now(): number {
  return Date.now();
}
export function normalizeRotation(rotation: number, min: number, max: number): number {
  let r = rotation;
  while (r < min) r += 360;
  while (r > max) r -= 360;
  return r;
}
export function calculateFragmentArea(fragment: MapFragment): number {
  const w = fragment.originalWidth * Math.abs(fragment.scaleX);
  const h = fragment.originalHeight * Math.abs(fragment.scaleY);
  return w * h;
}
export function isAnnotationOnFragment(fragment: MapFragment, annotation: Annotation): boolean {
  return annotation.fragmentId === fragment.id;
}
export function getAnnotationsByFragmentId(annotations: Annotation[], fragmentId: string): Annotation[] {
  return annotations.filter((a) => a.fragmentId === fragmentId);
}
export function hasAnnotations(fragmentId: string, annotations: Annotation[]): boolean {
  return annotations.some((a) => a.fragmentId === fragmentId);
}
export function countAnnotationsByType(annotations: Annotation[]): Record<AnnotationType, number> {
  return {
    place: 0,
    river: 0,
    boundary: 0,
    note: 0,
    ...annotations.reduce<Partial<Record<AnnotationType, number>>>((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1;
      return acc;
    }, {}),
  };
}
export function distance(a: Point, b: Point): number {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
}
export function getFragmentTransform(fragment: MapFragment) {
  return {
    x: fragment.x,
    y: fragment.y,
    rotation: fragment.rotation,
    scaleX: fragment.scaleX,
    scaleY: fragment.scaleY,
  };
}
export function cloneFragment(fragment: MapFragment): MapFragment {
  return JSON.parse(JSON.stringify(fragment));
}
export function cloneScheme(scheme: AssemblyScheme): AssemblyScheme {
  return JSON.parse(JSON.stringify(scheme));
}
export function validateSchemeData(data: unknown): data is AssemblyScheme {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.id !== 'string') return false;
  if (typeof obj.name !== 'string') return false;
  if (!Array.isArray(obj.fragments)) return false;
  if (!Array.isArray(obj.annotations)) return false;
  for (const frag of obj.fragments) {
    if (typeof frag !== 'object' || frag === null) return false;
    const f = frag as Record<string, unknown>;
    if (typeof f.id !== 'string') return false;
    if (typeof f.name !== 'string') return false;
  }
  return true;
}
export function findFragmentById(scheme: AssemblyScheme, id: string): MapFragment | undefined {
  return scheme.fragments.find((f) => f.id === id);
}
export function findAnnotationById(scheme: AssemblyScheme, id: string): Annotation | undefined {
  return scheme.annotations.find((a) => a.id === id);
}
export function isNameUniqueInScheme(scheme: AssemblyScheme, name: string, excludeId?: string): boolean {
  return !scheme.fragments.every((f) => f.name !== name || f.id === excludeId);
}
export function sortFragmentsByZIndex(fragments: MapFragment[]): MapFragment[] {
  return [...fragments].sort((a, b) => a.zIndex - b.zIndex);
}
export function getMaxZIndex(fragments: MapFragment[]): number {
  return fragments.reduce((max, f) => Math.max(max, f.zIndex), 0);
}
export function createDefaultScheme(name = '方案一'): AssemblyScheme {
  return {
    id: generateId(),
    name,
    description: '',
    fragments: [],
    annotations: [],
    createdAt: now(),
    updatedAt: now(),
  };
}
