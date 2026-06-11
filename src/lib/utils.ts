import { nanoid } from 'nanoid';
import type { MapFragment, Annotation, AssemblyScheme, Point, AnnotationType, SpliceRelation, SpliceRelationGroup } from '@/types';
import { SYSTEM_CONFIG } from '@/types';

export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

export function validateSchemeImport(data: unknown): ValidationResult {
  const result: ValidationResult = { success: true, errors: [], warnings: [] };

  if (!validateSchemeData(data)) {
    result.errors.push('方案格式无效：缺少必要字段或数据类型错误');
    result.success = false;
    return result;
  }

  const scheme = data as AssemblyScheme;

  const fragmentNames = new Map<string, number>();
  const fragmentIds = new Set<string>();

  for (let i = 0; i < scheme.fragments.length; i++) {
    const frag = scheme.fragments[i];

    if (fragmentNames.has(frag.name)) {
      const firstIndex = fragmentNames.get(frag.name)!;
      result.errors.push(`碎片名称不唯一："${frag.name}" 同时出现在第 ${firstIndex + 1} 和第 ${i + 1} 个碎片`);
    } else {
      fragmentNames.set(frag.name, i);
    }

    if (fragmentIds.has(frag.id)) {
      result.errors.push(`碎片 ID 不唯一："${frag.id}" 重复出现`);
    } else {
      fragmentIds.add(frag.id);
    }

    if (frag.rotation < SYSTEM_CONFIG.MIN_ROTATION || frag.rotation > SYSTEM_CONFIG.MAX_ROTATION) {
      result.errors.push(`碎片 "${frag.name}" 旋转角度超出范围：${frag.rotation}°（允许范围：${SYSTEM_CONFIG.MIN_ROTATION}° 到 ${SYSTEM_CONFIG.MAX_ROTATION}°）`);
    }

    if (frag.scaleX < SYSTEM_CONFIG.MIN_SCALE || frag.scaleX > SYSTEM_CONFIG.MAX_SCALE) {
      result.errors.push(`碎片 "${frag.name}" 水平缩放超出范围：${frag.scaleX}（允许范围：${SYSTEM_CONFIG.MIN_SCALE} 到 ${SYSTEM_CONFIG.MAX_SCALE}）`);
    }

    if (frag.scaleY < SYSTEM_CONFIG.MIN_SCALE || frag.scaleY > SYSTEM_CONFIG.MAX_SCALE) {
      result.errors.push(`碎片 "${frag.name}" 垂直缩放超出范围：${frag.scaleY}（允许范围：${SYSTEM_CONFIG.MIN_SCALE} 到 ${SYSTEM_CONFIG.MAX_SCALE}）`);
    }

    if (frag.name.trim().length === 0) {
      result.errors.push(`第 ${i + 1} 个碎片名称不能为空`);
    }

    for (const matchedId of frag.matchedWithIds) {
      if (!fragmentIds.has(matchedId)) {
        result.warnings.push(`碎片 "${frag.name}" 的 matchedWithIds 包含无效的 ID "${matchedId}"，导入后将自动清除`);
      }
    }
  }

  for (let i = 0; i < scheme.annotations.length; i++) {
    const ann = scheme.annotations[i];

    if (!fragmentIds.has(ann.fragmentId)) {
      result.errors.push(`批注 "${ann.label}" 引用的 fragmentId "${ann.fragmentId}" 无效，不存在对应的碎片`);
    }

    if (!ann.label || ann.label.trim().length === 0) {
      result.errors.push(`第 ${i + 1} 条批注的 label 字段不能为空`);
    }

    if (!ann.color || ann.color.trim().length === 0) {
      result.errors.push(`批注 "${ann.label}" 的 color 字段不能为空`);
    }

    if (ann.description === undefined || ann.description === null) {
      result.errors.push(`批注 "${ann.label}" 缺少 description 字段`);
    }

    if (ann.type === 'place' || ann.type === 'note') {
      if (!ann.position || typeof ann.position.x !== 'number' || typeof ann.position.y !== 'number') {
        result.errors.push(`批注 "${ann.label}" (${ann.type}) 缺少完整的 position 字段`);
      }
      if (ann.type === 'note') {
        if (typeof ann.fontSize !== 'number' || ann.fontSize <= 0) {
          result.errors.push(`批注 "${ann.label}" (note) 的 fontSize 字段无效`);
        }
      }
    }

    if (ann.type === 'river' || ann.type === 'boundary') {
      if (!Array.isArray(ann.points) || ann.points.length < 2) {
        result.errors.push(`批注 "${ann.label}" (${ann.type}) 的 points 字段至少需要 2 个点`);
      } else {
        for (let j = 0; j < ann.points.length; j++) {
          const pt = ann.points[j];
          if (typeof pt.x !== 'number' || typeof pt.y !== 'number') {
            result.errors.push(`批注 "${ann.label}" (${ann.type}) 的第 ${j + 1} 个点坐标不完整`);
          }
        }
      }
      if (typeof ann.strokeWidth !== 'number' || ann.strokeWidth <= 0) {
        result.errors.push(`批注 "${ann.label}" (${ann.type}) 的 strokeWidth 字段无效`);
      }
      if (ann.type === 'boundary' && typeof ann.closed !== 'boolean') {
        result.errors.push(`批注 "${ann.label}" (boundary) 的 closed 字段必须为布尔值`);
      }
    }
  }

  if (result.errors.length > 0) {
    result.success = false;
  }

  return result;
}
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
  if (typeof obj.id !== 'string' || obj.id.length === 0) return false;
  if (typeof obj.name !== 'string' || obj.name.length === 0) return false;
  if (typeof obj.createdAt !== 'number' || isNaN(obj.createdAt)) return false;
  if (typeof obj.updatedAt !== 'number' || isNaN(obj.updatedAt)) return false;
  if (!Array.isArray(obj.fragments)) return false;
  if (!Array.isArray(obj.annotations)) return false;
  if (obj.description !== undefined && typeof obj.description !== 'string') return false;

  if (typeof obj.viewport === 'object' && obj.viewport !== null) {
    const vp = obj.viewport as Record<string, unknown>;
    if (typeof vp.scale !== 'number' || isNaN(vp.scale)) return false;
    if (typeof vp.x !== 'number' || isNaN(vp.x)) return false;
    if (typeof vp.y !== 'number' || isNaN(vp.y)) return false;
  }

  for (const frag of obj.fragments) {
    if (typeof frag !== 'object' || frag === null) return false;
    const f = frag as Record<string, unknown>;
    if (typeof f.id !== 'string' || f.id.length === 0) return false;
    if (typeof f.name !== 'string' || f.name.length === 0) return false;
    if (typeof f.imageSrc !== 'string' || f.imageSrc.length === 0) return false;
    if (typeof f.originalWidth !== 'number' || isNaN(f.originalWidth) || f.originalWidth <= 0) return false;
    if (typeof f.originalHeight !== 'number' || isNaN(f.originalHeight) || f.originalHeight <= 0) return false;
    if (typeof f.x !== 'number' || isNaN(f.x)) return false;
    if (typeof f.y !== 'number' || isNaN(f.y)) return false;
    if (typeof f.rotation !== 'number' || isNaN(f.rotation)) return false;
    if (typeof f.scaleX !== 'number' || isNaN(f.scaleX)) return false;
    if (typeof f.scaleY !== 'number' || isNaN(f.scaleY)) return false;
    if (typeof f.visible !== 'boolean') return false;
    if (typeof f.opacity !== 'number' || isNaN(f.opacity)) return false;
    if (typeof f.zIndex !== 'number' || isNaN(f.zIndex)) return false;
    if (typeof f.isMatched !== 'boolean') return false;
    if (!Array.isArray(f.matchedWithIds)) return false;
    if (typeof f.createdAt !== 'number' || isNaN(f.createdAt)) return false;
    if (typeof f.updatedAt !== 'number' || isNaN(f.updatedAt)) return false;
  }

  for (const ann of obj.annotations) {
    if (typeof ann !== 'object' || ann === null) return false;
    const a = ann as Record<string, unknown>;
    if (typeof a.id !== 'string' || a.id.length === 0) return false;
    if (typeof a.fragmentId !== 'string' || a.fragmentId.length === 0) return false;
    if (typeof a.type !== 'string') return false;
    if (!['place', 'river', 'boundary', 'note'].includes(a.type as string)) return false;
    if (typeof a.label !== 'string') return false;
    if (typeof a.color !== 'string') return false;
    if (a.description !== undefined && typeof a.description !== 'string') return false;
    if (typeof a.createdAt !== 'number' || isNaN(a.createdAt)) return false;
    if (typeof a.updatedAt !== 'number' || isNaN(a.updatedAt)) return false;

    if (a.type === 'place' || a.type === 'note') {
      if (typeof a.position !== 'object' || a.position === null) return false;
      const pos = a.position as Record<string, unknown>;
      if (typeof pos.x !== 'number' || isNaN(pos.x)) return false;
      if (typeof pos.y !== 'number' || isNaN(pos.y)) return false;
      if (a.type === 'note') {
        if (typeof a.fontSize !== 'number' || isNaN(a.fontSize)) return false;
      }
    }
    if (a.type === 'river' || a.type === 'boundary') {
      if (!Array.isArray(a.points)) return false;
      for (const pt of a.points) {
        if (typeof pt !== 'object' || pt === null) return false;
        const p = pt as Record<string, unknown>;
        if (typeof p.x !== 'number' || isNaN(p.x)) return false;
        if (typeof p.y !== 'number' || isNaN(p.y)) return false;
      }
      if (typeof a.strokeWidth !== 'number' || isNaN(a.strokeWidth)) return false;
      if (a.type === 'boundary') {
        if (typeof a.closed !== 'boolean') return false;
      }
    }
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
  return !scheme.fragments.some((f) => f.name === name && f.id !== excludeId);
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
    viewport: { scale: 1, x: 0, y: 0 },
    createdAt: now(),
    updatedAt: now(),
  };
}

export function cleanupInvalidMatchedIds(scheme: AssemblyScheme): AssemblyScheme {
  const validIds = new Set(scheme.fragments.map((f) => f.id));
  return {
    ...scheme,
    fragments: scheme.fragments.map((f) => ({
      ...f,
      matchedWithIds: f.matchedWithIds.filter((id) => validIds.has(id)),
      isMatched: f.matchedWithIds.filter((id) => validIds.has(id)).length > 0,
    })),
  };
}

export function getFragmentCenter(fragment: MapFragment): Point {
  const w = fragment.originalWidth * Math.abs(fragment.scaleX);
  const h = fragment.originalHeight * Math.abs(fragment.scaleY);
  return {
    x: fragment.x + w / 2,
    y: fragment.y + h / 2,
  };
}

export function getSpliceRelations(scheme: AssemblyScheme): SpliceRelation[] {
  const relations: SpliceRelation[] = [];
  const processedPairs = new Set<string>();
  const fragmentMap = new Map(scheme.fragments.map((f) => [f.id, f]));

  for (const frag of scheme.fragments) {
    if (!frag.visible || !frag.isMatched) continue;

    for (const matchedId of frag.matchedWithIds) {
      const pairKey = [frag.id, matchedId].sort().join('-');
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const matchedFrag = fragmentMap.get(matchedId);
      if (!matchedFrag || !matchedFrag.visible) continue;

      relations.push({
        id: pairKey,
        fromFragmentId: frag.id,
        toFragmentId: matchedId,
        fromFragment: frag,
        toFragment: matchedFrag,
      });
    }
  }

  return relations;
}

export function getSpliceRelationGroups(scheme: AssemblyScheme): SpliceRelationGroup[] {
  const visibleMatchedFragments = scheme.fragments.filter((f) => f.visible && f.isMatched);
  const visited = new Set<string>();
  const groups: SpliceRelationGroup[] = [];

  function dfs(fragId: string, groupFragments: MapFragment[], groupRelations: SpliceRelation[]) {
    if (visited.has(fragId)) return;
    visited.add(fragId);

    const frag = scheme.fragments.find((f) => f.id === fragId);
    if (!frag || !frag.visible) return;

    groupFragments.push(frag);

    for (const matchedId of frag.matchedWithIds) {
      const matchedFrag = scheme.fragments.find((f) => f.id === matchedId);
      if (!matchedFrag || !matchedFrag.visible) continue;

      const relationId = [fragId, matchedId].sort().join('-');
      if (!groupRelations.some((r) => r.id === relationId)) {
        groupRelations.push({
          id: relationId,
          fromFragmentId: fragId,
          toFragmentId: matchedId,
          fromFragment: frag,
          toFragment: matchedFrag,
        });
      }

      if (!visited.has(matchedId)) {
        dfs(matchedId, groupFragments, groupRelations);
      }
    }
  }

  for (const frag of visibleMatchedFragments) {
    if (!visited.has(frag.id)) {
      const groupFragments: MapFragment[] = [];
      const groupRelations: SpliceRelation[] = [];
      dfs(frag.id, groupFragments, groupRelations);
      if (groupFragments.length > 0) {
        groups.push({
          groupId: `group-${groups.length}`,
          fragments: groupFragments,
          relations: groupRelations,
        });
      }
    }
  }

  return groups;
}
