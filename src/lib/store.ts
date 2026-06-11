import { writable, derived, get } from 'svelte/store';
import type {
  AssemblyScheme,
  MapFragment,
  Annotation,
  AppState,
  Statistics,
  ToolType,
  Point,
  AnnotationType,
  SpliceRelation,
  SpliceRelationGroup,
  Timeline,
  MapVersion,
  EvolutionStatistics,
  AnnotationChange,
  PlaceAnnotation,
  RiverAnnotation,
  BoundaryAnnotation,
} from '@/types';
import { SYSTEM_CONFIG, ANNOTATION_TYPE_LABELS } from '@/types';
import {
  generateId,
  now,
  clamp,
  normalizeRotation,
  calculateFragmentArea,
  countAnnotationsByType,
  hasAnnotations,
  validateSchemeData,
  validateSchemeImport,
  cleanupInvalidMatchedIds,
  getSpliceRelations,
  getSpliceRelationGroups,
  cloneScheme,
  getMaxZIndex,
  isNameUniqueInScheme,
  createDefaultScheme,
} from '@/lib/utils';

function createInitialState(): AppState {
  const defaultScheme = createDefaultScheme();
  return {
    schemes: [defaultScheme],
    currentSchemeId: defaultScheme.id,
    selectedFragmentId: null,
    selectedAnnotationId: null,
    activeTool: 'select',
    isCompareMode: false,
    leftCompareSchemeId: null,
    rightCompareSchemeId: null,
    viewportScale: 1,
    viewportX: 0,
    viewportY: 0,
    timelines: [],
    mapVersions: [],
    currentTimelineId: null,
    isTimelineMode: false,
    timelineSelectedVersionId: null,
    timelineCompareFromId: null,
    timelineCompareToId: null,
  };
}

function createAppStore() {
  const { subscribe, set, update } = writable<AppState>(createInitialState());

  function getCurrentScheme(state: AppState): AssemblyScheme | null {
    if (!state.currentSchemeId) return null;
    return state.schemes.find((s) => s.id === state.currentSchemeId) || null;
  }

  return {
    subscribe,

    setActiveTool(tool: ToolType) {
      update((state) => ({ ...state, activeTool: tool, selectedAnnotationId: null }));
    },

    setSelectedFragment(id: string | null) {
      update((state) => ({ ...state, selectedFragmentId: id, selectedAnnotationId: null }));
    },

    setSelectedAnnotation(id: string | null) {
      update((state) => ({ ...state, selectedAnnotationId: id, selectedFragmentId: null }));
    },

    setViewport(scale: number, x: number, y: number) {
      update((state) => {
        const newScale = clamp(scale, 0.1, 10);
        const newSchemes = state.schemes.map((s) => {
          if (s.id === state.currentSchemeId) {
            return {
              ...s,
              viewport: { scale: newScale, x, y },
              updatedAt: now(),
            };
          }
          return s;
        });
        return {
          ...state,
          schemes: newSchemes,
          viewportScale: newScale,
          viewportX: x,
          viewportY: y,
        };
      });
    },

    addFragment(data: {
      name: string;
      imageSrc: string;
      originalWidth: number;
      originalHeight: number;
    }): { success: boolean; error?: string; fragment?: MapFragment } {
      let result: { success: boolean; error?: string; fragment?: MapFragment } = { success: false };

      update((state) => {
        const scheme = getCurrentScheme(state);
        if (!scheme) {
          result = { success: false, error: '当前没有激活的方案' };
          return state;
        }

        if (isNameUniqueInScheme(scheme, data.name)) {
          result = { success: false, error: `碎片名称 "${data.name}" 已存在` };
          return state;
        }

        const maxZ = getMaxZIndex(scheme.fragments);
        const fragment: MapFragment = {
          id: generateId(),
          name: data.name,
          imageSrc: data.imageSrc,
          originalWidth: data.originalWidth,
          originalHeight: data.originalHeight,
          x: 100 + Math.random() * 200,
          y: 100 + Math.random() * 200,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          visible: true,
          opacity: 1,
          zIndex: maxZ + 1,
          isMatched: false,
          matchedWithIds: [],
          createdAt: now(),
          updatedAt: now(),
        };

        const newSchemes = state.schemes.map((s) =>
          s.id === scheme.id
            ? { ...s, fragments: [...s.fragments, fragment], updatedAt: now() }
            : s
        );

        result = { success: true, fragment };
        return { ...state, schemes: newSchemes, selectedFragmentId: fragment.id };
      });

      return result;
    },

    updateFragment(id: string, updates: Partial<MapFragment>): { success: boolean; error?: string } {
      const state = get({ subscribe });
      const scheme = getCurrentScheme(state);
      if (!scheme) return { success: false, error: '当前没有激活的方案' };

      if (updates.name !== undefined) {
        if (!isNameUniqueInScheme(scheme, updates.name, id)) {
          return { success: false, error: `碎片名称 "${updates.name}" 已存在` };
        }
      }

      update((st) => {
        const s = getCurrentScheme(st);
        if (!s) return st;
        const newSchemes = st.schemes.map((sc) => {
          if (sc.id !== s.id) return sc;
          const newFragments = sc.fragments.map((f) => {
            if (f.id !== id) return f;
            let rotation = updates.rotation !== undefined ? updates.rotation : f.rotation;
            rotation = normalizeRotation(rotation, SYSTEM_CONFIG.MIN_ROTATION, SYSTEM_CONFIG.MAX_ROTATION);
            let scaleX = updates.scaleX !== undefined ? updates.scaleX : f.scaleX;
            let scaleY = updates.scaleY !== undefined ? updates.scaleY : f.scaleY;
            scaleX = clamp(scaleX, SYSTEM_CONFIG.MIN_SCALE, SYSTEM_CONFIG.MAX_SCALE);
            scaleY = clamp(scaleY, SYSTEM_CONFIG.MIN_SCALE, SYSTEM_CONFIG.MAX_SCALE);
            return {
              ...f,
              ...updates,
              rotation,
              scaleX,
              scaleY,
              updatedAt: now(),
            };
          });
          return { ...sc, fragments: newFragments, updatedAt: now() };
        });
        return { ...st, schemes: newSchemes };
      });

      return { success: true };
    },

    deleteFragment(id: string): { success: boolean; error?: string } {
      const state = get({ subscribe });
      const scheme = getCurrentScheme(state);
      if (!scheme) return { success: false, error: '当前没有激活的方案' };

      if (hasAnnotations(id, scheme.annotations)) {
        return { success: false, error: '该碎片包含批注，需要二次确认才能删除' };
      }

      update((st) => {
        const s = getCurrentScheme(st);
        if (!s) return st;
        const newSchemes = st.schemes.map((sc) =>
          sc.id === s.id
            ? { ...sc, fragments: sc.fragments.filter((f) => f.id !== id), updatedAt: now() }
            : sc
        );
        return {
          ...st,
          schemes: newSchemes,
          selectedFragmentId: st.selectedFragmentId === id ? null : st.selectedFragmentId,
        };
      });

      return { success: true };
    },

    forceDeleteFragment(id: string): { success: boolean } {
      update((st) => {
        const s = getCurrentScheme(st);
        if (!s) return st;
        const newSchemes = st.schemes.map((sc) => {
          if (sc.id !== s.id) return sc;
          return {
            ...sc,
            fragments: sc.fragments.filter((f) => f.id !== id),
            annotations: sc.annotations.filter((a) => a.fragmentId !== id),
            updatedAt: now(),
          };
        });
        const selectedAnn = s.annotations.find((a: Annotation) => a.id === st.selectedAnnotationId);
        return {
          ...st,
          schemes: newSchemes,
          selectedFragmentId: st.selectedFragmentId === id ? null : st.selectedFragmentId,
          selectedAnnotationId: selectedAnn?.fragmentId === id ? null : st.selectedAnnotationId,
        };
      });
      return { success: true };
    },

    toggleFragmentVisibility(id: string) {
      update((state) => {
        const scheme = getCurrentScheme(state);
        if (!scheme) return state;
        const newSchemes = state.schemes.map((s) => {
          if (s.id !== scheme.id) return s;
          const newFragments = s.fragments.map((f) =>
            f.id === id ? { ...f, visible: !f.visible, updatedAt: now() } : f
          );
          return { ...s, fragments: newFragments, updatedAt: now() };
        });
        return { ...state, schemes: newSchemes };
      });
    },

    bringFragmentToFront(id: string) {
      update((state) => {
        const scheme = getCurrentScheme(state);
        if (!scheme) return state;
        const maxZ = getMaxZIndex(scheme.fragments);
        const newSchemes = state.schemes.map((s) => {
          if (s.id !== scheme.id) return s;
          const newFragments = s.fragments.map((f) =>
            f.id === id ? { ...f, zIndex: maxZ + 1, updatedAt: now() } : f
          );
          return { ...s, fragments: newFragments, updatedAt: now() };
        });
        return { ...state, schemes: newSchemes };
      });
    },

    sendFragmentToBack(id: string) {
      update((state) => {
        const scheme = getCurrentScheme(state);
        if (!scheme) return state;
        const minZ = scheme.fragments.reduce((min, f) => Math.min(min, f.zIndex), 0);
        const newSchemes = state.schemes.map((s) => {
          if (s.id !== scheme.id) return s;
          const newFragments = s.fragments.map((f) =>
            f.id === id ? { ...f, zIndex: minZ - 1, updatedAt: now() } : f
          );
          return { ...s, fragments: newFragments, updatedAt: now() };
        });
        return { ...state, schemes: newSchemes };
      });
    },

    setFragmentMatched(fragmentId: string, matchedIds: string[], isMatched: boolean) {
      update((state) => {
        const scheme = getCurrentScheme(state);
        if (!scheme) return state;
        const newSchemes = state.schemes.map((s) => {
          if (s.id !== scheme.id) return s;
          const newFragments = s.fragments.map((f) => {
            if (f.id === fragmentId) {
              return {
                ...f,
                isMatched,
                matchedWithIds: isMatched ? matchedIds : [],
                updatedAt: now(),
              };
            }
            if (matchedIds.includes(f.id)) {
              const newMatched = isMatched
                ? Array.from(new Set([...f.matchedWithIds, fragmentId]))
                : f.matchedWithIds.filter((id) => id !== fragmentId);
              return {
                ...f,
                isMatched: newMatched.length > 0,
                matchedWithIds: newMatched,
                updatedAt: now(),
              };
            }
            return f;
          });
          return { ...s, fragments: newFragments, updatedAt: now() };
        });
        return { ...state, schemes: newSchemes };
      });
    },

    removeSpliceRelation(fragmentId1: string, fragmentId2: string): { success: boolean; error?: string } {
      const state = get({ subscribe });
      const scheme = getCurrentScheme(state);
      if (!scheme) return { success: false, error: '当前没有激活的方案' };

      const frag1 = scheme.fragments.find((f) => f.id === fragmentId1);
      const frag2 = scheme.fragments.find((f) => f.id === fragmentId2);
      if (!frag1 || !frag2) return { success: false, error: '未找到指定的碎片' };

      update((st) => {
        const s = getCurrentScheme(st);
        if (!s) return st;
        const newSchemes = st.schemes.map((sc) => {
          if (sc.id !== s.id) return sc;
          const newFragments = sc.fragments.map((f) => {
            if (f.id === fragmentId1) {
              const newMatched = f.matchedWithIds.filter((id) => id !== fragmentId2);
              return {
                ...f,
                matchedWithIds: newMatched,
                isMatched: newMatched.length > 0,
                updatedAt: now(),
              };
            }
            if (f.id === fragmentId2) {
              const newMatched = f.matchedWithIds.filter((id) => id !== fragmentId1);
              return {
                ...f,
                matchedWithIds: newMatched,
                isMatched: newMatched.length > 0,
                updatedAt: now(),
              };
            }
            return f;
          });
          return { ...sc, fragments: newFragments, updatedAt: now() };
        });
        return { ...st, schemes: newSchemes };
      });

      return { success: true };
    },

    addAnnotation(type: AnnotationType, data: Partial<Annotation>): Annotation | null {
      let created: Annotation | null = null;

      update((state) => {
        const scheme = getCurrentScheme(state);
        if (!scheme) return state;
        if (!data.fragmentId) return state;

        const base = {
          id: generateId(),
          fragmentId: data.fragmentId,
          label: data.label || `${ANNOTATION_TYPE_LABELS[type]} ${scheme.annotations.filter(a => a.type === type).length + 1}`,
          description: data.description || '',
          color: data.color || SYSTEM_CONFIG.ANNOTATION_COLORS[scheme.annotations.length % SYSTEM_CONFIG.ANNOTATION_COLORS.length],
          createdAt: now(),
          updatedAt: now(),
        };

        let annotation: Annotation;
        if (type === 'place') {
          annotation = {
            ...base,
            type: 'place',
            position: (data as { position?: Point }).position || { x: 0, y: 0 },
          };
        } else if (type === 'river') {
          annotation = {
            ...base,
            type: 'river',
            points: (data as { points?: Point[] }).points || [],
            strokeWidth: (data as { strokeWidth?: number }).strokeWidth || 3,
          };
        } else if (type === 'boundary') {
          annotation = {
            ...base,
            type: 'boundary',
            points: (data as { points?: Point[] }).points || [],
            strokeWidth: (data as { strokeWidth?: number }).strokeWidth || 2,
            closed: (data as { closed?: boolean }).closed !== false,
          };
        } else {
          annotation = {
            ...base,
            type: 'note',
            position: (data as { position?: Point }).position || { x: 0, y: 0 },
            fontSize: (data as { fontSize?: number }).fontSize || 14,
          };
        }

        created = annotation;
        const newSchemes = state.schemes.map((s) =>
          s.id === scheme.id
            ? { ...s, annotations: [...s.annotations, annotation], updatedAt: now() }
            : s
        );

        return { ...state, schemes: newSchemes, selectedAnnotationId: annotation.id };
      });

      return created;
    },

    updateAnnotation(id: string, updates: Partial<Annotation>) {
      update((state) => {
        const scheme = getCurrentScheme(state);
        if (!scheme) return state;
        const newSchemes = state.schemes.map((s) => {
          if (s.id !== scheme.id) return s;
          const newAnnotations: Annotation[] = s.annotations.map((a) =>
            a.id === id ? ({ ...a, ...updates, updatedAt: now() } as Annotation) : a
          );
          return { ...s, annotations: newAnnotations, updatedAt: now() };
        });
        return { ...state, schemes: newSchemes };
      });
    },

    deleteAnnotation(id: string) {
      update((state) => {
        const scheme = getCurrentScheme(state);
        if (!scheme) return state;
        const newSchemes = state.schemes.map((s) =>
          s.id === scheme.id
            ? { ...s, annotations: s.annotations.filter((a) => a.id !== id), updatedAt: now() }
            : s
        );
        return {
          ...state,
          schemes: newSchemes,
          selectedAnnotationId: state.selectedAnnotationId === id ? null : state.selectedAnnotationId,
        };
      });
    },

    createScheme(name: string, description?: string): string {
      let newId = '';
      update((state) => {
        const scheme: AssemblyScheme = {
          id: generateId(),
          name,
          description: description || '',
          fragments: [],
          annotations: [],
          viewport: { scale: 1, x: 0, y: 0 },
          createdAt: now(),
          updatedAt: now(),
        };
        newId = scheme.id;
        return { ...state, schemes: [...state.schemes, scheme], currentSchemeId: scheme.id };
      });
      return newId;
    },

    switchScheme(id: string) {
      update((state) => {
        if (!state.schemes.find((s) => s.id === id)) return state;
        const updatedSchemes = state.schemes.map((s) => {
          if (s.id === state.currentSchemeId) {
            return {
              ...s,
              viewport: { scale: state.viewportScale, x: state.viewportX, y: state.viewportY },
              updatedAt: now(),
            };
          }
          return s;
        });
        const targetScheme = updatedSchemes.find((s) => s.id === id)!;
        const targetViewport = targetScheme.viewport || { scale: 1, x: 0, y: 0 };
        return {
          ...state,
          schemes: updatedSchemes,
          currentSchemeId: id,
          selectedFragmentId: null,
          selectedAnnotationId: null,
          isCompareMode: false,
          viewportScale: targetViewport.scale,
          viewportX: targetViewport.x,
          viewportY: targetViewport.y,
        };
      });
    },

    renameScheme(id: string, name: string) {
      update((state) => ({
        ...state,
        schemes: state.schemes.map((s) =>
          s.id === id ? { ...s, name, updatedAt: now() } : s
        ),
      }));
    },

    deleteScheme(id: string) {
      update((state) => {
        const remaining = state.schemes.filter((s) => s.id !== id);
        if (remaining.length === 0) {
          const newScheme = createDefaultScheme();
          return {
            ...state,
            schemes: [newScheme],
            currentSchemeId: newScheme.id,
            selectedFragmentId: null,
            selectedAnnotationId: null,
            isCompareMode: false,
          };
        }
        return {
          ...state,
          schemes: remaining,
          currentSchemeId: state.currentSchemeId === id ? remaining[0].id : state.currentSchemeId,
          selectedFragmentId: null,
          selectedAnnotationId: null,
          isCompareMode: false,
        };
      });
    },

    duplicateScheme(id: string): string {
      let newId = '';
      update((state) => {
        const original = state.schemes.find((s) => s.id === id);
        if (!original) return state;
        const cloned = cloneScheme(original);
        cloned.id = generateId();
        cloned.name = `${original.name} (副本)`;
        cloned.createdAt = now();
        cloned.updatedAt = now();
        cloned.fragments = cloned.fragments.map((f) => ({ ...f, id: generateId() }));
        const idMap = new Map(original.fragments.map((f, i) => [f.id, cloned.fragments[i].id]));
        cloned.annotations = cloned.annotations.map((a) => ({
          ...a,
          id: generateId(),
          fragmentId: idMap.get(a.fragmentId) || a.fragmentId,
        }));
        newId = cloned.id;
        return { ...state, schemes: [...state.schemes, cloned] };
      });
      return newId;
    },

    importScheme(json: string): { success: boolean; error?: string; warnings?: string[] } {
      try {
        const parsed = JSON.parse(json);

        const validationResult = validateSchemeImport(parsed);
        if (!validationResult.success) {
          return {
            success: false,
            error: validationResult.errors.join('；'),
            warnings: validationResult.warnings,
          };
        }

        const cleanedScheme = cleanupInvalidMatchedIds(parsed);

        update((state) => {
          const scheme: AssemblyScheme = {
            ...cleanedScheme,
            id: generateId(),
            name: `${parsed.name} (导入)`,
            viewport: cleanedScheme.viewport || { scale: 1, x: 0, y: 0 },
            createdAt: now(),
            updatedAt: now(),
          };
          return { ...state, schemes: [...state.schemes, scheme] };
        });

        return {
          success: true,
          warnings: validationResult.warnings.length > 0 ? validationResult.warnings : undefined,
        };
      } catch (e) {
        return { success: false, error: `解析失败：${(e as Error).message}` };
      }
    },

    exportScheme(id: string): string | null {
      const state = get({ subscribe });
      const scheme = state.schemes.find((s) => s.id === id);
      if (!scheme) return null;
      return JSON.stringify(scheme, null, 2);
    },

    setCompareMode(enabled: boolean) {
      update((state) => {
        if (!enabled) {
          return { ...state, isCompareMode: false };
        }
        return {
          ...state,
          isCompareMode: true,
          leftCompareSchemeId: state.leftCompareSchemeId || state.currentSchemeId,
          rightCompareSchemeId: state.rightCompareSchemeId || state.schemes[1]?.id || state.currentSchemeId,
        };
      });
    },

    setCompareSchemes(leftId: string, rightId: string) {
      update((state) => ({ ...state, leftCompareSchemeId: leftId, rightCompareSchemeId: rightId }));
    },

    createTimeline(name: string, region: string, description?: string): string {
      let newId = '';
      update((state) => {
        const timeline: Timeline = {
          id: generateId(),
          name,
          region,
          description: description || '',
          versionIds: [],
          createdAt: now(),
          updatedAt: now(),
        };
        newId = timeline.id;
        return {
          ...state,
          timelines: [...state.timelines, timeline],
          currentTimelineId: timeline.id,
        };
      });
      return newId;
    },

    updateTimeline(id: string, updates: Partial<Timeline>) {
      update((state) => ({
        ...state,
        timelines: state.timelines.map((t) =>
          t.id === id ? { ...t, ...updates, updatedAt: now() } : t
        ),
      }));
    },

    deleteTimeline(id: string) {
      update((state) => {
        const versionIdsToRemove = new Set(
          state.mapVersions.filter((v) => v.timelineId === id).map((v) => v.id)
        );
        return {
          ...state,
          timelines: state.timelines.filter((t) => t.id !== id),
          mapVersions: state.mapVersions.filter((v) => v.timelineId !== id),
          currentTimelineId: state.currentTimelineId === id ? null : state.currentTimelineId,
          timelineSelectedVersionId: versionIdsToRemove.has(state.timelineSelectedVersionId || '') ? null : state.timelineSelectedVersionId,
          timelineCompareFromId: versionIdsToRemove.has(state.timelineCompareFromId || '') ? null : state.timelineCompareFromId,
          timelineCompareToId: versionIdsToRemove.has(state.timelineCompareToId || '') ? null : state.timelineCompareToId,
        };
      });
    },

    switchTimeline(id: string | null) {
      update((state) => {
        if (id === null) {
          return { ...state, currentTimelineId: null, timelineSelectedVersionId: null };
        }
        const timeline = state.timelines.find((t) => t.id === id);
        if (!timeline) return state;
        const versions = state.mapVersions.filter((v) => timeline.versionIds.includes(v.id));
        const firstVersion = versions.length > 0 ? versions[0].id : null;
        return {
          ...state,
          currentTimelineId: id,
          timelineSelectedVersionId: firstVersion,
        };
      });
    },

    setTimelineMode(enabled: boolean) {
      update((state) => ({
        ...state,
        isTimelineMode: enabled,
        isCompareMode: enabled ? false : state.isCompareMode,
      }));
    },

    selectTimelineVersion(versionId: string | null) {
      update((state) => ({ ...state, timelineSelectedVersionId: versionId }));
    },

    setTimelineCompare(fromId: string | null, toId: string | null) {
      update((state) => ({
        ...state,
        timelineCompareFromId: fromId,
        timelineCompareToId: toId,
      }));
    },

    addMapVersion(timelineId: string, data: {
      schemeId: string;
      dynasty: string;
      year: string;
      yearNumeric: number;
      source: string;
      mapType: string;
      scribe?: string;
      provenance?: string;
      notes?: string;
    }): string | null {
      let newId: string | null = null;
      update((state) => {
        const timeline = state.timelines.find((t) => t.id === timelineId);
        if (!timeline) return state;

        const version: MapVersion = {
          id: generateId(),
          timelineId,
          schemeId: data.schemeId,
          dynasty: data.dynasty,
          year: data.year,
          yearNumeric: data.yearNumeric,
          source: data.source,
          mapType: data.mapType,
          scribe: data.scribe,
          provenance: data.provenance,
          notes: data.notes,
          createdAt: now(),
          updatedAt: now(),
        };
        newId = version.id;

        const newVersionIds = [...timeline.versionIds, version.id];
        const allVersions = [...state.mapVersions, version];
        const sortedVersions = allVersions
          .filter((v) => newVersionIds.includes(v.id))
          .sort((a, b) => a.yearNumeric - b.yearNumeric)
          .map((v) => v.id);

        return {
          ...state,
          mapVersions: allVersions,
          timelines: state.timelines.map((t) =>
            t.id === timelineId
              ? { ...t, versionIds: sortedVersions, updatedAt: now() }
              : t
          ),
        };
      });
      return newId;
    },

    updateMapVersion(id: string, updates: Partial<MapVersion>) {
      update((state) => {
        const newVersions = state.mapVersions.map((v) =>
          v.id === id ? { ...v, ...updates, updatedAt: now() } : v
        );

        let newTimelines = state.timelines;
        if (updates.yearNumeric !== undefined) {
          const version = state.mapVersions.find((v) => v.id === id);
          if (version) {
            newTimelines = state.timelines.map((t) => {
              if (t.id !== version.timelineId) return t;
              const versions = newVersions.filter((v) => t.versionIds.includes(v.id));
              versions.sort((a, b) => a.yearNumeric - b.yearNumeric);
              return { ...t, versionIds: versions.map((v) => v.id), updatedAt: now() };
            });
          }
        }

        return { ...state, mapVersions: newVersions, timelines: newTimelines };
      });
    },

    removeMapVersion(id: string) {
      update((state) => {
        const version = state.mapVersions.find((v) => v.id === id);
        if (!version) return state;
        return {
          ...state,
          mapVersions: state.mapVersions.filter((v) => v.id !== id),
          timelines: state.timelines.map((t) =>
            t.id === version.timelineId
              ? { ...t, versionIds: t.versionIds.filter((vid) => vid !== id), updatedAt: now() }
              : t
          ),
          timelineSelectedVersionId: state.timelineSelectedVersionId === id ? null : state.timelineSelectedVersionId,
          timelineCompareFromId: state.timelineCompareFromId === id ? null : state.timelineCompareFromId,
          timelineCompareToId: state.timelineCompareToId === id ? null : state.timelineCompareToId,
        };
      });
    },

    saveToLocalStorage() {
      const state = get({ subscribe });
      try {
        const schemesWithViewport = state.schemes.map((s) => {
          if (s.id === state.currentSchemeId) {
            return {
              ...s,
              viewport: {
                scale: state.viewportScale,
                x: state.viewportX,
                y: state.viewportY,
              },
              updatedAt: now(),
            };
          }
          return s;
        });
        const payload = {
          schemes: schemesWithViewport,
          timelines: state.timelines,
          mapVersions: state.mapVersions,
        };
        localStorage.setItem(SYSTEM_CONFIG.STORAGE_KEY, JSON.stringify(payload));
      } catch (e) {
        console.error('保存失败', e);
      }
    },

    loadFromLocalStorage() {
      try {
        const data = localStorage.getItem(SYSTEM_CONFIG.STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data);
          let schemes: AssemblyScheme[] = [];
          let timelines: Timeline[] = [];
          let mapVersions: MapVersion[] = [];

          if (Array.isArray(parsed)) {
            schemes = parsed.filter(validateSchemeData);
          } else if (typeof parsed === 'object' && parsed !== null) {
            const obj = parsed as { schemes?: unknown; timelines?: unknown; mapVersions?: unknown };
            if (Array.isArray(obj.schemes)) {
              schemes = obj.schemes.filter(validateSchemeData);
            }
            if (Array.isArray(obj.timelines)) {
              timelines = obj.timelines as Timeline[];
            }
            if (Array.isArray(obj.mapVersions)) {
              mapVersions = obj.mapVersions as MapVersion[];
            }
          }

          if (schemes.length === 0) {
            schemes = [createDefaultScheme()];
          }

          const firstScheme = schemes[0];
          const viewport = firstScheme.viewport || { scale: 1, x: 0, y: 0 };
          update((state) => ({
            ...state,
            schemes,
            timelines,
            mapVersions,
            currentSchemeId: firstScheme.id,
            currentTimelineId: timelines.length > 0 ? timelines[0].id : null,
            viewportScale: viewport.scale,
            viewportX: viewport.x,
            viewportY: viewport.y,
          }));
        }
      } catch (e) {
        console.error('加载失败', e);
      }
    },

    reset() {
      set(createInitialState());
    },
  };
}

export const appStore = createAppStore();

export const currentScheme = derived(appStore, ($app) => {
  if (!$app.currentSchemeId) return null;
  return $app.schemes.find((s) => s.id === $app.currentSchemeId) || null;
});

export const currentFragments = derived(currentScheme, ($s) =>
  $s ? [...$s.fragments].sort((a, b) => a.zIndex - b.zIndex) : []
);

export const currentAnnotations = derived(currentScheme, ($s) => ($s ? $s.annotations : []));

export const selectedFragment = derived(
  [appStore, currentScheme],
  ([$app, $scheme]) => {
    if (!$app.selectedFragmentId || !$scheme) return null;
    return $scheme.fragments.find((f) => f.id === $app.selectedFragmentId) || null;
  }
);

export const selectedAnnotation = derived(
  [appStore, currentScheme],
  ([$app, $scheme]) => {
    if (!$app.selectedAnnotationId || !$scheme) return null;
    return $scheme.annotations.find((a) => a.id === $app.selectedAnnotationId) || null;
  }
);

export const statistics = derived(currentScheme, ($scheme): Statistics => {
  if (!$scheme) {
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

  const visibleFragments = $scheme.fragments.filter((f) => f.visible);
  const matchedFragments = visibleFragments.filter((f) => f.isMatched);
  const unmatchedFragments = visibleFragments.filter((f) => !f.isMatched);

  const totalArea = visibleFragments.reduce((sum, f) => sum + calculateFragmentArea(f), 0);
  const assembledArea = visibleFragments
    .filter((f) => f.isMatched)
    .reduce((sum, f) => sum + calculateFragmentArea(f), 0);

  return {
    totalFragments: $scheme.fragments.length,
    matchedFragments: matchedFragments.length,
    unmatchedFragments: unmatchedFragments.length,
    totalArea,
    assembledArea,
    assembledPercentage: totalArea > 0 ? (assembledArea / totalArea) * 100 : 0,
    annotationCount: $scheme.annotations.length,
    annotationByType: countAnnotationsByType($scheme.annotations),
    visibleFragments: visibleFragments.length,
  };
});

export const spliceRelations = derived(currentScheme, ($scheme): SpliceRelation[] => {
  if (!$scheme) return [];
  return getSpliceRelations($scheme);
});

export const spliceRelationGroups = derived(currentScheme, ($scheme): SpliceRelationGroup[] => {
  if (!$scheme) return [];
  return getSpliceRelationGroups($scheme);
});

export const leftCompareScheme = derived(appStore, ($app) =>
  $app.leftCompareSchemeId ? $app.schemes.find((s) => s.id === $app.leftCompareSchemeId) || null : null
);

export const rightCompareScheme = derived(appStore, ($app) =>
  $app.rightCompareSchemeId ? $app.schemes.find((s) => s.id === $app.rightCompareSchemeId) || null : null
);

export const currentTimeline = derived(appStore, ($app) => {
  if (!$app.currentTimelineId) return null;
  return $app.timelines.find((t) => t.id === $app.currentTimelineId) || null;
});

export const currentTimelineVersions = derived(
  [appStore, currentTimeline],
  ([$app, $timeline]): MapVersion[] => {
    if (!$timeline) return [];
    return $app.mapVersions
      .filter((v) => $timeline.versionIds.includes(v.id))
      .sort((a, b) => a.yearNumeric - b.yearNumeric);
  }
);

export const selectedTimelineVersion = derived(
  [appStore, currentTimelineVersions],
  ([$app, $versions]) => {
    if (!$app.timelineSelectedVersionId) return null;
    return $versions.find((v) => v.id === $app.timelineSelectedVersionId) || null;
  }
);

export const selectedTimelineScheme = derived(
  [appStore, selectedTimelineVersion],
  ([$app, $version]) => {
    if (!$version) return null;
    return $app.schemes.find((s) => s.id === $version.schemeId) || null;
  }
);

export const timelineCompareFromVersion = derived(appStore, ($app) => {
  if (!$app.timelineCompareFromId) return null;
  return $app.mapVersions.find((v) => v.id === $app.timelineCompareFromId) || null;
});

export const timelineCompareToVersion = derived(appStore, ($app) => {
  if (!$app.timelineCompareToId) return null;
  return $app.mapVersions.find((v) => v.id === $app.timelineCompareToId) || null;
});

export const timelineCompareFromScheme = derived(
  [appStore, timelineCompareFromVersion],
  ([$app, $version]) => {
    if (!$version) return null;
    return $app.schemes.find((s) => s.id === $version.schemeId) || null;
  }
);

export const timelineCompareToScheme = derived(
  [appStore, timelineCompareToVersion],
  ([$app, $version]) => {
    if (!$version) return null;
    return $app.schemes.find((s) => s.id === $version.schemeId) || null;
  }
);

function arePointsEqual(a: Point[], b: Point[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i].x - b[i].x) > 0.001 || Math.abs(a[i].y - b[i].y) > 0.001) return false;
  }
  return true;
}

function computeAnnotationChanges(
  fromScheme: AssemblyScheme | null,
  toScheme: AssemblyScheme | null,
  fromVersionId: string | undefined,
  toVersionId: string
): AnnotationChange[] {
  const changes: AnnotationChange[] = [];
  if (!fromScheme || !toScheme) return changes;

  const fromAnns = new Map(fromScheme.annotations.map((a) => [a.id, a]));
  const toAnns = new Map(toScheme.annotations.map((a) => [a.id, a]));

  for (const ann of toScheme.annotations) {
    const fromAnn = fromAnns.get(ann.id);
    if (!fromAnn) {
      changes.push({
        type: 'added',
        annotationId: ann.id,
        annotationLabel: ann.label,
        annotationType: ann.type,
        toVersionId,
        toLabel: ann.label,
        toDescription: ann.description,
        toColor: ann.color,
      });
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
      changes.push({
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
      });
    } else {
      changes.push({
        type: 'unchanged',
        annotationId: ann.id,
        annotationLabel: ann.label,
        annotationType: ann.type,
        toVersionId,
      });
    }
  }

  for (const ann of fromScheme.annotations) {
    if (!toAnns.has(ann.id)) {
      changes.push({
        type: 'removed',
        annotationId: ann.id,
        annotationLabel: ann.label,
        annotationType: ann.type,
        fromVersionId,
        toVersionId,
        fromLabel: ann.label,
        fromDescription: ann.description,
        fromColor: ann.color,
      });
    }
  }

  return changes;
}

export const evolutionStatistics = derived(
  [currentTimelineVersions, appStore],
  ([$versions, $app]): EvolutionStatistics | null => {
    if ($versions.length < 1) return null;

    const sorted = [...$versions].sort((a, b) => a.yearNumeric - b.yearNumeric);
    const start = sorted[0].yearNumeric;
    const end = sorted[sorted.length - 1].yearNumeric;

    if (sorted.length < 2) {
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
      };
    }

    const allChanges: AnnotationChange[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const from = sorted[i - 1];
      const to = sorted[i];
      const fromScheme = $app.schemes.find((s) => s.id === from.schemeId) || null;
      const toScheme = $app.schemes.find((s) => s.id === to.schemeId) || null;
      const pairChanges = computeAnnotationChanges(fromScheme, toScheme, from.id, to.id);
      allChanges.push(...pairChanges);
    }

    let addedCount = 0, removedCount = 0, modifiedCount = 0, unchangedCount = 0;
    const byType = {
      place: { added: 0, removed: 0, modified: 0, unchanged: 0 },
      river: { added: 0, removed: 0, modified: 0, unchanged: 0 },
      boundary: { added: 0, removed: 0, modified: 0, unchanged: 0 },
      note: { added: 0, removed: 0, modified: 0, unchanged: 0 },
    };

    for (const c of allChanges) {
      switch (c.type) {
        case 'added': addedCount++; break;
        case 'removed': removedCount++; break;
        case 'modified': modifiedCount++; break;
        case 'unchanged': unchangedCount++; break;
      }
      if (byType[c.annotationType]) {
        byType[c.annotationType][c.type]++;
      }
    }

    return {
      versionsCount: sorted.length,
      dateRange: { start, end },
      totalAnnotationChanges: allChanges.length,
      addedCount,
      removedCount,
      modifiedCount,
      unchangedCount,
      byType,
      annotationChanges: allChanges,
    };
  }
);

export const pairEvolutionStats = derived(
  [timelineCompareFromVersion, timelineCompareToVersion, appStore],
  ([$from, $to, $app]): EvolutionStatistics | null => {
    if (!$from || !$to) return null;

    const fromScheme = $app.schemes.find((s) => s.id === $from.schemeId) || null;
    const toScheme = $app.schemes.find((s) => s.id === $to.schemeId) || null;

    const changes = computeAnnotationChanges(fromScheme, toScheme, $from.id, $to.id);

    let addedCount = 0, removedCount = 0, modifiedCount = 0, unchangedCount = 0;
    const byType = {
      place: { added: 0, removed: 0, modified: 0, unchanged: 0 },
      river: { added: 0, removed: 0, modified: 0, unchanged: 0 },
      boundary: { added: 0, removed: 0, modified: 0, unchanged: 0 },
      note: { added: 0, removed: 0, modified: 0, unchanged: 0 },
    };

    for (const c of changes) {
      switch (c.type) {
        case 'added': addedCount++; break;
        case 'removed': removedCount++; break;
        case 'modified': modifiedCount++; break;
        case 'unchanged': unchangedCount++; break;
      }
      if (byType[c.annotationType]) {
        byType[c.annotationType][c.type]++;
      }
    }

    return {
      versionsCount: 2,
      dateRange: { start: $from.yearNumeric, end: $to.yearNumeric },
      totalAnnotationChanges: changes.length,
      addedCount,
      removedCount,
      modifiedCount,
      unchangedCount,
      byType,
      annotationChanges: changes,
    };
  }
);
