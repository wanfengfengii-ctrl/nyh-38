import type { MapFragment, AssemblyScheme, Evidence, ConfidenceLevel } from '@/types';
import { SYSTEM_CONFIG } from '@/types';

function validateSchemeData(data: unknown): data is AssemblyScheme {
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
import type { ValidationResult } from '@/lib/utils/errors';
import { validationSuccess, validationFailure } from '@/lib/utils/errors';

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

export interface MapVersionFormData {
  schemeId: string;
  dynasty: string;
  year: string;
  yearNumeric: number;
  source: string;
  mapType: string;
  scribe?: string;
  provenance?: string;
  notes?: string;
  confidence?: ConfidenceLevel;
  evidences?: Evidence[];
}

export function validateMapVersionForm(data: MapVersionFormData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data.schemeId) {
    errors.push('请选择关联的地图方案');
  }
  if (!data.year.trim()) {
    errors.push('请输入年份显示文本');
  }
  if (!data.source.trim()) {
    errors.push('请输入来源信息');
  }
  if (isNaN(data.yearNumeric)) {
    errors.push('公元纪年必须是有效数字');
  }

  if (data.evidences && data.evidences.length > 0) {
    const invalidEvidences = data.evidences.filter(
      (e) => !e.source.trim() && !e.pageOrCallNumber.trim() && !e.description.trim()
    );
    if (invalidEvidences.length > 0) {
      warnings.push(`${invalidEvidences.length} 条证据为空，提交时将自动过滤`);
    }
  }

  if (errors.length > 0) {
    return validationFailure(errors, warnings);
  }

  return validationSuccess();
}

export interface TimelineFormData {
  name: string;
  region: string;
  description?: string;
}

export function validateTimelineForm(data: TimelineFormData): ValidationResult {
  const errors: string[] = [];

  if (!data.name.trim()) {
    errors.push('请输入时间轴名称');
  }
  if (!data.region.trim()) {
    errors.push('请输入研究区域');
  }

  if (errors.length > 0) {
    return validationFailure(errors);
  }

  return validationSuccess();
}

export interface FragmentFormData {
  name: string;
  imageSrc: string;
  originalWidth: number;
  originalHeight: number;
}

export function validateFragmentForm(
  data: FragmentFormData,
  scheme: AssemblyScheme | null,
  excludeId?: string
): ValidationResult {
  const errors: string[] = [];

  if (!data.name.trim()) {
    errors.push('碎片名称不能为空');
  }
  if (!data.imageSrc) {
    errors.push('请选择图片文件');
  }
  if (data.originalWidth <= 0 || data.originalHeight <= 0) {
    errors.push('图片尺寸无效');
  }

  if (scheme && data.name.trim()) {
    const existing = scheme.fragments.find(
      (f) => f.name === data.name.trim() && f.id !== excludeId
    );
    if (existing) {
      errors.push(`碎片名称 "${data.name.trim()}" 已存在`);
    }
  }

  if (errors.length > 0) {
    return validationFailure(errors);
  }

  return validationSuccess();
}

export function validateFragmentUpdate(
  updates: Partial<MapFragment>,
  scheme: AssemblyScheme | null,
  fragmentId: string
): ValidationResult {
  const errors: string[] = [];

  if (updates.name !== undefined) {
    if (!updates.name.trim()) {
      errors.push('碎片名称不能为空');
    } else if (scheme) {
      const existing = scheme.fragments.find(
        (f) => f.name === updates.name!.trim() && f.id !== fragmentId
      );
      if (existing) {
        errors.push(`碎片名称 "${updates.name.trim()}" 已存在`);
      }
    }
  }

  if (updates.rotation !== undefined) {
    if (updates.rotation < SYSTEM_CONFIG.MIN_ROTATION || updates.rotation > SYSTEM_CONFIG.MAX_ROTATION) {
      errors.push(`旋转角度超出允许范围（${SYSTEM_CONFIG.MIN_ROTATION}° 到 ${SYSTEM_CONFIG.MAX_ROTATION}°）`);
    }
  }

  if (updates.scaleX !== undefined) {
    if (updates.scaleX < SYSTEM_CONFIG.MIN_SCALE || updates.scaleX > SYSTEM_CONFIG.MAX_SCALE) {
      errors.push(`水平缩放超出允许范围（${SYSTEM_CONFIG.MIN_SCALE} 到 ${SYSTEM_CONFIG.MAX_SCALE}）`);
    }
  }

  if (updates.scaleY !== undefined) {
    if (updates.scaleY < SYSTEM_CONFIG.MIN_SCALE || updates.scaleY > SYSTEM_CONFIG.MAX_SCALE) {
      errors.push(`垂直缩放超出允许范围（${SYSTEM_CONFIG.MIN_SCALE} 到 ${SYSTEM_CONFIG.MAX_SCALE}）`);
    }
  }

  if (errors.length > 0) {
    return validationFailure(errors);
  }

  return validationSuccess();
}

export function cleanupEvidences(evidences: Evidence[]): Evidence[] {
  return evidences
    .filter((e) => e.source.trim() || e.pageOrCallNumber.trim() || e.description.trim())
    .map((e) => ({
      id: e.id,
      source: e.source.trim(),
      pageOrCallNumber: e.pageOrCallNumber.trim(),
      description: e.description.trim(),
    }));
}
