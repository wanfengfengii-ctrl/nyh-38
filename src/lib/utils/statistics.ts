import type {
  AssemblyScheme,
  Statistics,
  AnnotationChange,
  EvolutionStatistics,
  ConfidenceLevel,
  MapVersion,
} from '@/types';
import { calculateFragmentArea, countAnnotationsByType } from '@/lib/utils';

export function calculateStatistics(scheme: AssemblyScheme | null): Statistics {
  if (!scheme) {
    return {
      totalFragments: 0,
      matchedFragments: 0,
      unmatchedFragments: 0,
      totalArea: 0,
      assembledArea: 0,
      assembledPercentage: 0,
      annotationCount: 0,
      annotationByType: { place: 0, river: 0, boundary: 0, note: 0 },
      visibleFragments: 0,
    };
  }

  const visibleFragments = scheme.fragments.filter((f) => f.visible);
  const matchedFragments = visibleFragments.filter((f) => f.isMatched);
  const unmatchedFragments = visibleFragments.filter((f) => !f.isMatched);

  const totalArea = visibleFragments.reduce((sum, f) => sum + calculateFragmentArea(f), 0);
  const assembledArea = visibleFragments
    .filter((f) => f.isMatched)
    .reduce((sum, f) => sum + calculateFragmentArea(f), 0);

  return {
    totalFragments: scheme.fragments.length,
    matchedFragments: matchedFragments.length,
    unmatchedFragments: unmatchedFragments.length,
    totalArea,
    assembledArea,
    assembledPercentage: totalArea > 0 ? (assembledArea / totalArea) * 100 : 0,
    annotationCount: scheme.annotations.length,
    annotationByType: countAnnotationsByType(scheme.annotations),
    visibleFragments: visibleFragments.length,
  };
}

interface EvolutionStatsAggregationInput {
  annotationChanges: AnnotationChange[];
  versions: MapVersion[];
  versionsCount: number;
  dateRange: { start: number; end: number };
}

export function aggregateEvolutionStats(
  input: EvolutionStatsAggregationInput
): EvolutionStatistics {
  const { annotationChanges, versions, versionsCount, dateRange } = input;

  const versionsByDynasty: Record<string, number> = {};
  const confidenceDistribution: Record<ConfidenceLevel, number> = {
    high: 0, medium: 0, low: 0, pending: 0,
  };
  let versionsWithoutEvidence = 0;

  for (const v of versions) {
    versionsByDynasty[v.dynasty] = (versionsByDynasty[v.dynasty] || 0) + 1;
    if (v.confidence) {
      confidenceDistribution[v.confidence]++;
    } else {
      confidenceDistribution.pending++;
    }
    if (!v.evidences || v.evidences.length === 0) {
      versionsWithoutEvidence++;
    }
  }

  let addedCount = 0, removedCount = 0, modifiedCount = 0, unchangedCount = 0;
  const byType = {
    place: { added: 0, removed: 0, modified: 0, unchanged: 0 },
    river: { added: 0, removed: 0, modified: 0, unchanged: 0 },
    boundary: { added: 0, removed: 0, modified: 0, unchanged: 0 },
    note: { added: 0, removed: 0, modified: 0, unchanged: 0 },
  };

  const changesConfidenceDistribution: Record<ConfidenceLevel, number> = {
    high: 0, medium: 0, low: 0, pending: 0,
  };
  let changesWithoutEvidence = 0;

  for (const c of annotationChanges) {
    switch (c.type) {
      case 'added': addedCount++; break;
      case 'removed': removedCount++; break;
      case 'modified': modifiedCount++; break;
      case 'unchanged': unchangedCount++; break;
    }
    if (byType[c.annotationType]) {
      byType[c.annotationType][c.type]++;
    }
    if (c.confidence) {
      changesConfidenceDistribution[c.confidence]++;
    } else {
      changesConfidenceDistribution.pending++;
    }
    if (!c.evidences || c.evidences.length === 0) {
      changesWithoutEvidence++;
    }
  }

  return {
    versionsCount,
    dateRange,
    totalAnnotationChanges: annotationChanges.length,
    addedCount,
    removedCount,
    modifiedCount,
    unchangedCount,
    byType,
    annotationChanges,
    versionsByDynasty,
    confidenceDistribution,
    versionsWithoutEvidence,
    changesWithoutEvidence,
    changesConfidenceDistribution,
  };
}

export function createEmptyEvolutionStats(
  versions: MapVersion[]
): EvolutionStatistics {
  const sorted = [...versions].sort((a, b) => a.yearNumeric - b.yearNumeric);
  const start = sorted.length > 0 ? sorted[0].yearNumeric : 0;
  const end = sorted.length > 0 ? sorted[sorted.length - 1].yearNumeric : 0;

  const versionsByDynasty: Record<string, number> = {};
  const confidenceDistribution: Record<ConfidenceLevel, number> = {
    high: 0, medium: 0, low: 0, pending: 0,
  };
  let versionsWithoutEvidence = 0;

  for (const v of sorted) {
    versionsByDynasty[v.dynasty] = (versionsByDynasty[v.dynasty] || 0) + 1;
    if (v.confidence) {
      confidenceDistribution[v.confidence]++;
    } else {
      confidenceDistribution.pending++;
    }
    if (!v.evidences || v.evidences.length === 0) {
      versionsWithoutEvidence++;
    }
  }

  return {
    versionsCount: sorted.length,
    dateRange: { start, end },
    totalAnnotationChanges: 0,
    addedCount: 0,
    removedCount: 0,
    modifiedCount: 0,
    unchangedCount: 0,
    byType: {
      place: { added: 0, removed: 0, modified: 0, unchanged: 0 },
      river: { added: 0, removed: 0, modified: 0, unchanged: 0 },
      boundary: { added: 0, removed: 0, modified: 0, unchanged: 0 },
      note: { added: 0, removed: 0, modified: 0, unchanged: 0 },
    },
    annotationChanges: [],
    versionsByDynasty,
    confidenceDistribution,
    versionsWithoutEvidence,
    changesWithoutEvidence: 0,
    changesConfidenceDistribution: { high: 0, medium: 0, low: 0, pending: 0 },
  };
}
