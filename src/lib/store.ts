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
      update((state) => ({
        ...state,
        viewportScale: clamp(scale, 0.1, 10),
        viewportX: x,
        viewportY: y,
      }));
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

    updateFragment(id: string, updates: Partial<MapFragment>) {
      update((state) => {
        const scheme = getCurrentScheme(state);
        if (!scheme) return state;

        if (updates.name !== undefined) {
          if (isNameUniqueInScheme(scheme, updates.name, id)) {
            console.warn(`碎片名称 "${updates.name}" 已存在`);
            return state;
          }
        }

        const newSchemes = state.schemes.map((s) => {
          if (s.id !== scheme.id) return s;
          const newFragments = s.fragments.map((f) => {
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
          return { ...s, fragments: newFragments, updatedAt: now() };
        });

        return { ...state, schemes: newSchemes };
      });
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
        return {
          ...state,
          currentSchemeId: id,
          selectedFragmentId: null,
          selectedAnnotationId: null,
          isCompareMode: false,
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

    importScheme(json: string): { success: boolean; error?: string } {
      try {
        const parsed = JSON.parse(json);
        if (!validateSchemeData(parsed)) {
          return { success: false, error: '无效的方案格式，数据不完整或类型错误' };
        }
        update((state) => {
          const scheme: AssemblyScheme = {
            ...parsed,
            id: generateId(),
            name: `${parsed.name} (导入)`,
            createdAt: now(),
            updatedAt: now(),
          };
          return { ...state, schemes: [...state.schemes, scheme] };
        });
        return { success: true };
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

    saveToLocalStorage() {
      const state = get({ subscribe });
      try {
        localStorage.setItem(SYSTEM_CONFIG.STORAGE_KEY, JSON.stringify(state.schemes));
      } catch (e) {
        console.error('保存失败', e);
      }
    },

    loadFromLocalStorage() {
      try {
        const data = localStorage.getItem(SYSTEM_CONFIG.STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(validateSchemeData)) {
            update((state) => ({
              ...state,
              schemes: parsed,
              currentSchemeId: parsed[0].id,
            }));
          }
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
  const matchedFragments = $scheme.fragments.filter((f) => f.isMatched);
  const unmatchedFragments = $scheme.fragments.filter((f) => !f.isMatched);

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

export const leftCompareScheme = derived(appStore, ($app) =>
  $app.leftCompareSchemeId ? $app.schemes.find((s) => s.id === $app.leftCompareSchemeId) || null : null
);

export const rightCompareScheme = derived(appStore, ($app) =>
  $app.rightCompareSchemeId ? $app.schemes.find((s) => s.id === $app.rightCompareSchemeId) || null : null
);
