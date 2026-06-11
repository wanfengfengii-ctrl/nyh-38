import type {
  Point,
  AssemblyScheme,
  AnnotationChange,
  ChangeEvidenceEntry,
  PlaceAnnotation,
  RiverAnnotation,
  BoundaryAnnotation,
  MapVersion,
  EvolutionStatistics,
} from '@/types';
import { aggregateEvolutionStats, createEmptyEvolutionStats } from '@/lib/utils/statistics';

export function arePointsEqual(a: Point[], b: Point[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i].x - b[i].x) > 0.001 || Math.abs(a[i].y - b[i].y) > 0.001) return false;
  }
  return true;
}

export function getChangeKey(change: { annotationId: string; toVersionId: string; fromVersionId?: string }): string {
  return `${change.fromVersionId || 'none'}:${change.toVersionId}:${change.annotationId}`;
}

export function injectEvidence(
  change: AnnotationChange,
  changeEvidences: Record<string, ChangeEvidenceEntry>
): AnnotationChange {
  const key = getChangeKey(change);
  const entry = changeEvidences[key];
  if (!entry) return change;
  return { ...change, confidence: entry.confidence, evidences: entry.evidences };
}

export function computeAnnotationChanges(
  fromScheme: AssemblyScheme | null,
  toScheme: AssemblyScheme | null,
  fromVersionId: string | undefined,
  toVersionId: string,
  changeEvidences: Record<string, ChangeEvidenceEntry> = {}
): AnnotationChange[] {
  const changes: AnnotationChange[] = [];
  if (!fromScheme || !toScheme) return changes;

  const fromAnns = new Map(fromScheme.annotations.map((a) => [a.id, a]));
  const toAnns = new Map(toScheme.annotations.map((a) => [a.id, a]));

  for (const ann of toScheme.annotations) {
    const fromAnn = fromAnns.get(ann.id);
    if (!fromAnn) {
      changes.push(injectEvidence({
        type: 'added',
        annotationId: ann.id,
        annotationLabel: ann.label,
        annotationType: ann.type,
        toVersionId,
        toLabel: ann.label,
        toDescription: ann.description,
        toColor: ann.color,
      }, changeEvidences));
      continue;
    }

    let modified = false;
    let positionChanged = false;
    let pointsChanged = false;

    if (fromAnn.label !== ann.label) modified = true;
    if (fromAnn.description !== ann.description) modified = true;
    if (fromAnn.color !== ann.color) modified = true;

    if (fromAnn.type === 'place' && ann.type === 'place') {
      const f = fromAnn as PlaceAnnotation;
      const t = ann as PlaceAnnotation;
      if (Math.abs(f.position.x - t.position.x) > 0.001 || Math.abs(f.position.y - t.position.y) > 0.001) {
        modified = true;
        positionChanged = true;
      }
    }
    if (fromAnn.type === 'river' && ann.type === 'river') {
      const f = fromAnn as RiverAnnotation;
      const t = ann as RiverAnnotation;
      if (!arePointsEqual(f.points, t.points) || f.strokeWidth !== t.strokeWidth) {
        modified = true;
        pointsChanged = true;
      }
    }
    if (fromAnn.type === 'boundary' && ann.type === 'boundary') {
      const f = fromAnn as BoundaryAnnotation;
      const t = ann as BoundaryAnnotation;
      if (!arePointsEqual(f.points, t.points) || f.strokeWidth !== t.strokeWidth || f.closed !== t.closed) {
        modified = true;
        pointsChanged = true;
      }
    }
    if (fromAnn.type === 'note' && ann.type === 'note') {
      const f = fromAnn as { fontSize: number; position: Point };
      const t = ann as { fontSize: number; position: Point };
      if (f.fontSize !== t.fontSize) modified = true;
      if (Math.abs(f.position.x - t.position.x) > 0.001 || Math.abs(f.position.y - t.position.y) > 0.001) {
        modified = true;
        positionChanged = true;
      }
    }

    if (modified) {
      changes.push(injectEvidence({
        type: 'modified',
        annotationId: ann.id,
        annotationLabel: ann.label,
        annotationType: ann.type,
        fromVersionId,
        toVersionId,
        fromLabel: fromAnn.label,
        toLabel: ann.label,
        fromDescription: fromAnn.description,
        toDescription: ann.description,
        fromColor: fromAnn.color,
        toColor: ann.color,
        positionChanged,
        pointsChanged,
      }, changeEvidences));
    } else {
      changes.push(injectEvidence({
        type: 'unchanged',
        annotationId: ann.id,
        annotationLabel: ann.label,
        annotationType: ann.type,
        toVersionId,
      }, changeEvidences));
    }
  }

  for (const ann of fromScheme.annotations) {
    if (!toAnns.has(ann.id)) {
      changes.push(injectEvidence({
        type: 'removed',
        annotationId: ann.id,
        annotationLabel: ann.label,
        annotationType: ann.type,
        fromVersionId,
        toVersionId,
        fromLabel: ann.label,
        fromDescription: ann.description,
        fromColor: ann.color,
      }, changeEvidences));
    }
  }

  return changes;
}

export function calculateFullEvolutionStats(
  versions: MapVersion[],
  schemes: AssemblyScheme[],
  changeEvidences: Record<string, ChangeEvidenceEntry>
): EvolutionStatistics | null {
  if (versions.length < 1) return null;

  const sorted = [...versions].sort((a, b) => a.yearNumeric - b.yearNumeric);

  if (sorted.length < 2) {
    return createEmptyEvolutionStats(versions);
  }

  const allChanges: AnnotationChange[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const from = sorted[i - 1];
    const to = sorted[i];
    const fromScheme = schemes.find((s) => s.id === from.schemeId) || null;
    const toScheme = schemes.find((s) => s.id === to.schemeId) || null;
    const pairChanges = computeAnnotationChanges(fromScheme, toScheme, from.id, to.id, changeEvidences);
    allChanges.push(...pairChanges);
  }

  return aggregateEvolutionStats({
    annotationChanges: allChanges,
    versions: sorted,
    versionsCount: sorted.length,
    dateRange: { start: sorted[0].yearNumeric, end: sorted[sorted.length - 1].yearNumeric },
  });
}

export function calculatePairEvolutionStats(
  fromVersion: MapVersion,
  toVersion: MapVersion,
  schemes: AssemblyScheme[],
  changeEvidences: Record<string, ChangeEvidenceEntry>,
  allVersions: MapVersion[]
): EvolutionStatistics | null {
  const fromScheme = schemes.find((s) => s.id === fromVersion.schemeId) || null;
  const toScheme = schemes.find((s) => s.id === toVersion.schemeId) || null;

  const changes = computeAnnotationChanges(fromScheme, toScheme, fromVersion.id, toVersion.id, changeEvidences);

  return aggregateEvolutionStats({
    annotationChanges: changes,
    versions: allVersions,
    versionsCount: 2,
    dateRange: { start: fromVersion.yearNumeric, end: toVersion.yearNumeric },
  });
}
