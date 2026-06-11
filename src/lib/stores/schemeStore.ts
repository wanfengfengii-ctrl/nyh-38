import { writable, derived, get } from 'svelte/store';
import type {
  AssemblyScheme,
  MapFragment,
  Annotation,
  AnnotationType,
  SpliceRelation,
  SpliceRelationGroup,
  Statistics,
  Point,
} from '@/types';
import { SYSTEM_CONFIG, ANNOTATION_TYPE_LABELS } from '@/types';
import {
  generateId,
  now,
  clamp,
  normalizeRotation,
  hasAnnotations,
  cleanupInvalidMatchedIds,
  getSpliceRelations,
  getSpliceRelationGroups,
  cloneScheme,
  getMaxZIndex,
  isNameUniqueInScheme,
  createDefaultScheme,
} from '@/lib/utils';
import { validateSchemeImport, validateFragmentUpdate } from '@/lib/utils/validation';
import { calculateStatistics } from '@/lib/utils/statistics';
import type { Result } from '@/lib/utils/errors';
import { success, failure } from '@/lib/utils/errors';

interface SchemeState {
  schemes: AssemblyScheme[];
  currentSchemeId: string | null;
}

function createInitialState(): SchemeState {
  const defaultScheme = createDefaultScheme();
  return {
    schemes: [defaultScheme],
    currentSchemeId: defaultScheme.id,
  };
}

function createSchemeStore() {
  const { subscribe, set, update } = writable<SchemeState>(createInitialState());

  function getCurrentScheme(state: SchemeState): AssemblyScheme | null {
    if (!state.currentSchemeId) return null;
    return state.schemes.find((s) => s.id === state.currentSchemeId) || null;
  }

  return {
    subscribe,

    getCurrentScheme(): AssemblyScheme | null {
      return getCurrentScheme(get({ subscribe }));
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
        };
      });
    },

    addFragment(data: {
      name: string;
      imageSrc: string;
      originalWidth: number;
      originalHeight: number;
    }): Result<MapFragment> {
      let result: Result<MapFragment> = failure('操作失败');

      update((state) => {
        const scheme = getCurrentScheme(state);
        if (!scheme) {
          result = failure('当前没有激活的方案');
          return state;
        }

        if (isNameUniqueInScheme(scheme, data.name)) {
          result = failure(`碎片名称 "${data.name}" 已存在`);
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

        result = success(fragment);
        return { ...state, schemes: newSchemes };
      });

      return result;
    },

    updateFragment(id: string, updates: Partial<MapFragment>): Result {
      const state = get({ subscribe });
      const scheme = getCurrentScheme(state);
      if (!scheme) return failure('当前没有激活的方案');

      const validation = validateFragmentUpdate(updates, scheme, id);
      if (!validation.success) {
        return failure(validation.errors.join('；'));
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

      return success(undefined);
    },

    deleteFragment(id: string): Result {
      const state = get({ subscribe });
      const scheme = getCurrentScheme(state);
      if (!scheme) return failure('当前没有激活的方案');

      if (hasAnnotations(id, scheme.annotations)) {
        return failure('该碎片包含批注，需要二次确认才能删除');
      }

      update((st) => {
        const s = getCurrentScheme(st);
        if (!s) return st;
        const newSchemes = st.schemes.map((sc) =>
          sc.id === s.id
            ? { ...sc, fragments: sc.fragments.filter((f) => f.id !== id), updatedAt: now() }
            : sc
        );
        return { ...st, schemes: newSchemes };
      });

      return success(undefined);
    },

    forceDeleteFragment(id: string): Result {
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
        return { ...st, schemes: newSchemes };
      });
      return success(undefined);
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

    removeSpliceRelation(fragmentId1: string, fragmentId2: string): Result {
      const state = get({ subscribe });
      const scheme = getCurrentScheme(state);
      if (!scheme) return failure('当前没有激活的方案');

      const frag1 = scheme.fragments.find((f) => f.id === fragmentId1);
      const frag2 = scheme.fragments.find((f) => f.id === fragmentId2);
      if (!frag1 || !frag2) return failure('未找到指定的碎片');

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

      return success(undefined);
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

        return { ...state, schemes: newSchemes };
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
        return { ...state, schemes: newSchemes };
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

    switchScheme(id: string, currentViewport: { scale: number; x: number; y: number }) {
      update((state) => {
        if (!state.schemes.find((s) => s.id === id)) return state;
        const updatedSchemes = state.schemes.map((s) => {
          if (s.id === state.currentSchemeId) {
            return {
              ...s,
              viewport: currentViewport,
              updatedAt: now(),
            };
          }
          return s;
        });
        const targetScheme = updatedSchemes.find((s) => s.id === id)!;
        return {
          ...state,
          schemes: updatedSchemes,
          currentSchemeId: id,
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
          };
        }
        return {
          ...state,
          schemes: remaining,
          currentSchemeId: state.currentSchemeId === id ? remaining[0].id : state.currentSchemeId,
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

    importScheme(json: string): Result & { warnings?: string[] } {
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

    loadFromStorage(schemes: AssemblyScheme[]) {
      if (schemes.length === 0) {
        schemes = [createDefaultScheme()];
      }
      const firstScheme = schemes[0];
      set({
        schemes,
        currentSchemeId: firstScheme.id,
      });
    },

    reset() {
      set(createInitialState());
    },
  };
}

export const schemeStore = createSchemeStore();

export const currentScheme = derived(schemeStore, ($s) => {
  if (!$s.currentSchemeId) return null;
  return $s.schemes.find((s) => s.id === $s.currentSchemeId) || null;
});

export const currentFragments = derived(currentScheme, ($s) =>
  $s ? [...$s.fragments].sort((a, b) => a.zIndex - b.zIndex) : []
);

export const currentAnnotations = derived(currentScheme, ($s) => ($s ? $s.annotations : []));

export const statistics = derived(currentScheme, ($scheme): Statistics => {
  return calculateStatistics($scheme);
});

export const spliceRelations = derived(currentScheme, ($scheme): SpliceRelation[] => {
  if (!$scheme) return [];
  return getSpliceRelations($scheme);
});

export const spliceRelationGroups = derived(currentScheme, ($scheme): SpliceRelationGroup[] => {
  if (!$scheme) return [];
  return getSpliceRelationGroups($scheme);
});
