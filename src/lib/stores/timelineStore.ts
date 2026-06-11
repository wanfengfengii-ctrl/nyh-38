import { writable, derived, get } from 'svelte/store';
import type {
  Timeline, MapVersion, AssemblyScheme, EvolutionStatistics, ChangeEvidenceEntry } from '@/types';
import {
  generateId,
  now,
} from '@/lib/utils';
import { calculateFullEvolutionStats, calculatePairEvolutionStats } from '@/lib/utils/evolution';
import type { Result } from '@/lib/utils/errors';
import { success, failure } from '@/lib/utils/errors';

interface TimelineState {
  timelines: Timeline[];
  mapVersions: MapVersion[];
  currentTimelineId: string | null;
  selectedVersionId: string | null;
  compareFromId: string | null;
  compareToId: string | null;
  changeEvidences: Record<string, ChangeEvidenceEntry>;
}

function createInitialTimeline(): Timeline {
  return {
    id: generateId(),
    name: '默认时间轴',
    region: '',
    description: '',
    versionIds: [],
    createdAt: now(),
    updatedAt: now(),
  };
}

function createInitialState(): TimelineState {
  const timeline = createInitialTimeline();
  return {
    timelines: [timeline],
    mapVersions: [],
    currentTimelineId: timeline.id,
    selectedVersionId: null,
    compareFromId: null,
    compareToId: null,
    changeEvidences: {},
  };
}

function createTimelineStore() {
  const { subscribe, set, update } = writable<TimelineState>(createInitialState());

  function getCurrentTimeline(state: TimelineState): Timeline | null {
    if (!state.currentTimelineId) return null;
    return state.timelines.find((t) => t.id === state.currentTimelineId) || null;
  }

  function getCurrentVersions(state: TimelineState): MapVersion[] {
    const timeline = getCurrentTimeline(state);
    if (!timeline) return [];
    return state.mapVersions
      .filter((v) => timeline.versionIds.includes(v.id))
      .sort((a, b) => a.yearNumeric - b.yearNumeric);
  }

  return {
    subscribe,

    getTimelines(): Timeline[] {
      return get({ subscribe }).timelines;
    },

    getMapVersions(): MapVersion[] {
      return get({ subscribe }).mapVersions;
    },

    getCurrentTimeline(): Timeline | null {
      return getCurrentTimeline(get({ subscribe }));
    },

    getCurrentVersions(): MapVersion[] {
      return getCurrentVersions(get({ subscribe }));
    },

    getSelectedVersion(): MapVersion | null {
      const state = get({ subscribe });
      if (!state.selectedVersionId) return null;
      return state.mapVersions.find((v) => v.id === state.selectedVersionId) || null;
    },

    setCurrentTimeline(id: string) {
      update((state) => {
        const timeline = state.timelines.find((t) => t.id === id);
        if (!timeline) return state;
        const versions = getCurrentVersions({ ...state, currentTimelineId: id });
        return {
          ...state,
          currentTimelineId: id,
          selectedVersionId: versions.length > 0 ? versions[0].id : null,
          compareFromId: null,
          compareToId: null,
        };
      });
    },

    addTimeline(data: { name: string; region: string; description?: string }): Result<Timeline> {
      if (!data.name.trim()) {
        return failure('时间轴名称不能为空');
      }

      const timeline: Timeline = {
        id: generateId(),
        name: data.name,
        region: data.region,
        description: data.description || '',
        versionIds: [],
        createdAt: now(),
        updatedAt: now(),
      };

      update((state) => ({
        ...state,
        timelines: [...state.timelines, timeline],
        currentTimelineId: timeline.id,
      }));

      return success(timeline);
    },

    updateTimeline(id: string, updates: Partial<Timeline>): Result {
      update((state) => {
        const newTimelines = state.timelines.map((t) =>
          t.id === id ? { ...t, ...updates, updatedAt: now() } : t
        );
        return { ...state, timelines: newTimelines };
      });
      return success(undefined);
    },

    deleteTimeline(id: string): Result {
      const state = get({ subscribe });
      if (state.timelines.length <= 1) {
        return failure('至少需要保留一个时间轴');
      }

      update((st) => {
        const remainingTimelines = st.timelines.filter((t) => t.id !== id);
        const remainingVersionIds = new Set(
          remainingTimelines.flatMap((t) => t.versionIds)
        );
        const remainingMapVersions = st.mapVersions.filter((v) =>
          remainingVersionIds.has(v.id)
        );
        const newChangeEvidences = { ...st.changeEvidences };
        for (const key of Object.keys(newChangeEvidences)) {
          if (key.includes(id)) {
            delete newChangeEvidences[key];
          }
        }
        const newCurrentId = remainingTimelines.length > 0 ? remainingTimelines[0].id : null;
        const newVersions = remainingTimelines.length > 0
          ? remainingMapVersions.filter((v) => remainingTimelines[0].versionIds.includes(v.id))
          : [];
        return {
          ...st,
          timelines: remainingTimelines,
          mapVersions: remainingMapVersions,
          changeEvidences: newChangeEvidences,
          currentTimelineId: newCurrentId,
          selectedVersionId: newVersions.length > 0 ? newVersions[0].id : null,
          compareFromId: null,
          compareToId: null,
        };
      });
      return success(undefined);
    },

    addVersion(data: {
      timelineId: string;
      schemeId: string;
      dynasty: string;
      year: string;
      yearNumeric: number;
      source: string;
      mapType: string;
      scribe?: string;
      provenance?: string;
      notes?: string;
      confidence?: 'high' | 'medium' | 'low' | 'pending';
    }): Result<MapVersion> {
      if (!data.dynasty.trim()) return failure('朝代不能为空');
      if (!data.year.trim()) return failure('年份不能为空');
      if (!data.source.trim()) return failure('来源不能为空');

      const version: MapVersion = {
        id: generateId(),
        timelineId: data.timelineId,
        schemeId: data.schemeId,
        dynasty: data.dynasty,
        year: data.year,
        yearNumeric: data.yearNumeric,
        source: data.source,
        mapType: data.mapType,
        scribe: data.scribe,
        provenance: data.provenance,
        notes: data.notes,
        confidence: data.confidence,
        evidences: [],
        createdAt: now(),
        updatedAt: now(),
      };

      update((state) => {
        const newTimelines = state.timelines.map((t) =>
          t.id === data.timelineId
            ? { ...t, versionIds: [...t.versionIds, version.id], updatedAt: now() }
            : t
        );
        const newMapVersions = [...state.mapVersions, version];
        return {
          ...state,
          timelines: newTimelines,
          mapVersions: newMapVersions,
          selectedVersionId: state.currentTimelineId === data.timelineId ? version.id : state.selectedVersionId,
        };
      });

      return success(version);
    },

    updateVersion(id: string, updates: Partial<MapVersion>): Result {
      update((state) => {
        const newMapVersions = state.mapVersions.map((v) =>
          v.id === id ? { ...v, ...updates, updatedAt: now() } : v
        );
        return { ...state, mapVersions: newMapVersions };
      });
      return success(undefined);
    },

    deleteVersion(id: string): Result {
      update((state) => {
        const newMapVersions = state.mapVersions.filter((v) => v.id !== id);
        const newTimelines = state.timelines.map((t) => ({
          ...t,
          versionIds: t.versionIds.filter((vid) => vid !== id),
        }));
        const newChangeEvidences = { ...state.changeEvidences };
        for (const key of Object.keys(newChangeEvidences)) {
          if (key.includes(id)) {
            delete newChangeEvidences[key];
          }
        }
        const timeline = newTimelines.find((t) => t.id === state.currentTimelineId);
        const versions = timeline
          ? newMapVersions.filter((v) => timeline.versionIds.includes(v.id)).sort((a, b) => a.yearNumeric - b.yearNumeric)
          : [];
        return {
          ...state,
          timelines: newTimelines,
          mapVersions: newMapVersions,
          changeEvidences: newChangeEvidences,
          selectedVersionId: versions.length > 0 ? versions[0].id : null,
          compareFromId: state.compareFromId === id ? null : state.compareFromId,
          compareToId: state.compareToId === id ? null : state.compareToId,
        };
      });
      return success(undefined);
    },

    selectVersion(id: string | null) {
      update((state) => ({
        ...state,
        selectedVersionId: id,
      }));
    },

    setCompareFrom(id: string | null) {
      update((state) => ({
        ...state,
        compareFromId: id,
      }));
    },

    setCompareTo(id: string | null) {
      update((state) => ({
        ...state,
        compareToId: id,
      }));
    },

    moveVersion(id: string, direction: 'up' | 'down'): Result {
      update((state) => {
        const timeline = getCurrentTimeline(state);
        if (!timeline) return state;
        const versions = getCurrentVersions(state);
        const idx = versions.findIndex((v) => v.id === id);
        if (idx === -1) return state;

        const newVersionIds = [...timeline.versionIds];
        const sortedIdx = timeline.versionIds.findIndex((vid) => vid === id);

        if (direction === 'up' && idx > 0) {
          const prevId = versions[idx - 1].id;
          const prevSortedIdx = timeline.versionIds.findIndex((vid) => vid === prevId);
          [newVersionIds[sortedIdx], newVersionIds[prevSortedIdx]] = [newVersionIds[prevSortedIdx], newVersionIds[sortedIdx]];
        } else if (direction === 'down' && idx < versions.length - 1) {
          const nextId = versions[idx + 1].id;
          const nextSortedIdx = timeline.versionIds.findIndex((vid) => vid === nextId);
          [newVersionIds[sortedIdx], newVersionIds[nextSortedIdx]] = [newVersionIds[nextSortedIdx], newVersionIds[sortedIdx]];
        } else {
          return state;
        }

        const newTimelines = state.timelines.map((t) =>
          t.id === timeline.id ? { ...t, versionIds: newVersionIds, updatedAt: now() } : t
        );
        return { ...state, timelines: newTimelines };
      });
      return success(undefined);
    },

    saveEvidenceForChange(changeKey: string, evidences: ChangeEvidenceEntry['evidences']) {
      update((state) => {
        const existingEntry = state.changeEvidences[changeKey];
        const newEntry: ChangeEvidenceEntry = {
          ...existingEntry,
          evidences,
          updatedAt: now(),
        };
        return {
          ...state,
          changeEvidences: {
            ...state.changeEvidences,
            [changeKey]: newEntry,
          },
        };
      });
    },

    saveAnnotationForChange(changeKey: string, description: string) {
      update((state) => {
        const existingEntry = state.changeEvidences[changeKey];
        const newEntry: ChangeEvidenceEntry = {
          ...existingEntry,
          description,
          updatedAt: now(),
        };
        return {
          ...state,
          changeEvidences: {
            ...state.changeEvidences,
            [changeKey]: newEntry,
          },
        };
      });
    },

    loadFromStorage(data: {
      timelines: Timeline[];
      mapVersions: MapVersion[];
      changeEvidences: Record<string, ChangeEvidenceEntry>;
    }) {
      const timelines = data.timelines.length > 0 ? data.timelines : [createInitialTimeline()];
      const firstTimeline = timelines[0];
      const firstVersions = data.mapVersions
        .filter((v) => firstTimeline.versionIds.includes(v.id))
        .sort((a, b) => a.yearNumeric - b.yearNumeric);
      set({
        timelines,
        mapVersions: data.mapVersions,
        changeEvidences: data.changeEvidences,
        currentTimelineId: firstTimeline.id,
        selectedVersionId: firstVersions.length > 0 ? firstVersions[0].id : null,
        compareFromId: null,
        compareToId: null,
      });
    },

    reset() {
      set(createInitialState());
    },
  };
}

export const timelineStore = createTimelineStore();

export const currentTimeline = derived(timelineStore, ($s) => {
  if (!$s.currentTimelineId) return null;
  return $s.timelines.find((t) => t.id === $s.currentTimelineId) || null;
});

export const currentTimelineVersions = derived(
  [timelineStore, currentTimeline],
  ([$s, $timeline]): MapVersion[] => {
    if (!$timeline) return [];
    return $s.mapVersions
      .filter((v) => $timeline.versionIds.includes(v.id))
      .sort((a, b) => a.yearNumeric - b.yearNumeric);
  }
);

export const selectedTimelineVersion = derived(
  [timelineStore, currentTimelineVersions],
  ([$s, $versions]) => {
    if (!$s.selectedVersionId) return null;
    return $versions.find((v) => v.id === $s.selectedVersionId) || null;
  }
);

export const timelineCompareFromVersion = derived(timelineStore, ($s) => {
  if (!$s.compareFromId) return null;
  return $s.mapVersions.find((v) => v.id === $s.compareFromId) || null;
});

export const timelineCompareToVersion = derived(timelineStore, ($s) => {
  if (!$s.compareToId) return null;
  return $s.mapVersions.find((v) => v.id === $s.compareToId) || null;
});

export const changeEvidences = derived(
  timelineStore,
  ($s) => $s.changeEvidences || {}
);

export const allMapVersions = derived(timelineStore, ($s) => $s.mapVersions);

export const allTimelines = derived(timelineStore, ($s) => $s.timelines);

export function createEvolutionStatsDerived(
  schemesStore: { subscribe: (fn: (v: { schemes: AssemblyScheme[]; currentSchemeId: string | null }) => void) => () => void }
) {
  return derived(
    [currentTimelineVersions, schemesStore, changeEvidences],
    ([$versions, $schemeStore, $changeEvidences]): EvolutionStatistics | null => {
      if ($versions.length < 2) return null;
      return calculateFullEvolutionStats($versions, $schemeStore.schemes, $changeEvidences);
    }
  );
}

export function createPairEvolutionStatsDerived(
  schemesStore: { subscribe: (fn: (v: { schemes: AssemblyScheme[]; currentSchemeId: string | null }) => void) => () => void }
) {
  return derived(
    [timelineCompareFromVersion, timelineCompareToVersion, schemesStore, changeEvidences, currentTimelineVersions],
    ([$from, $to, $schemeStore, $changeEvidences, $allVersions]): EvolutionStatistics | null => {
      if (!$from || !$to) return null;
      return calculatePairEvolutionStats($from, $to, $schemeStore.schemes, $changeEvidences, $allVersions);
    }
  );
}
