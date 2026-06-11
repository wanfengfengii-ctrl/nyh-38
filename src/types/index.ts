export interface Point {
  x: number;
  y: number;
}

export interface Transform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface MapFragment extends Transform {
  id: string;
  name: string;
  imageSrc: string;
  originalWidth: number;
  originalHeight: number;
  visible: boolean;
  opacity: number;
  zIndex: number;
  isMatched: boolean;
  matchedWithIds: string[];
  createdAt: number;
  updatedAt: number;
}

export type AnnotationType = 'place' | 'river' | 'boundary' | 'note';

export interface BaseAnnotation {
  id: string;
  fragmentId: string;
  type: AnnotationType;
  label: string;
  description?: string;
  color: string;
  createdAt: number;
  updatedAt: number;
}

export interface PlaceAnnotation extends BaseAnnotation {
  type: 'place';
  position: Point;
}

export interface RiverAnnotation extends BaseAnnotation {
  type: 'river';
  points: Point[];
  strokeWidth: number;
}

export interface BoundaryAnnotation extends BaseAnnotation {
  type: 'boundary';
  points: Point[];
  strokeWidth: number;
  closed: boolean;
}

export interface NoteAnnotation extends BaseAnnotation {
  type: 'note';
  position: Point;
  fontSize: number;
}

export type Annotation = PlaceAnnotation | RiverAnnotation | BoundaryAnnotation | NoteAnnotation;

export interface AssemblyScheme {
  id: string;
  name: string;
  description?: string;
  fragments: MapFragment[];
  annotations: Annotation[];
  viewport: {
    scale: number;
    x: number;
    y: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface Statistics {
  totalFragments: number;
  matchedFragments: number;
  unmatchedFragments: number;
  totalArea: number;
  assembledArea: number;
  assembledPercentage: number;
  annotationCount: number;
  annotationByType: Record<AnnotationType, number>;
  visibleFragments: number;
}

export interface AppState {
  schemes: AssemblyScheme[];
  currentSchemeId: string | null;
  selectedFragmentId: string | null;
  selectedAnnotationId: string | null;
  activeTool: ToolType;
  isCompareMode: boolean;
  leftCompareSchemeId: string | null;
  rightCompareSchemeId: string | null;
  viewportScale: number;
  viewportX: number;
  viewportY: number;
  timelines: Timeline[];
  mapVersions: MapVersion[];
  currentTimelineId: string | null;
  isTimelineMode: boolean;
  timelineSelectedVersionId: string | null;
  timelineCompareFromId: string | null;
  timelineCompareToId: string | null;
}

export type ToolType = 'select' | 'pan' | 'annotate-place' | 'annotate-river' | 'annotate-boundary' | 'annotate-note';

export const SYSTEM_CONFIG = {
  MIN_ROTATION: -180,
  MAX_ROTATION: 180,
  MIN_SCALE: 0.1,
  MAX_SCALE: 5,
  ANNOTATION_COLORS: [
    '#dc2626',
    '#2563eb',
    '#16a34a',
    '#9333ea',
    '#ea580c',
    '#0891b2',
    '#4f46e5',
    '#ca8a04',
  ],
  STORAGE_KEY: 'ancient-map-assembly-data',
} as const;

export const ANNOTATION_TYPE_LABELS: Record<AnnotationType, string> = {
  place: '地名',
  river: '河道',
  boundary: '边界',
  note: '注释',
};

export interface SpliceRelation {
  id: string;
  fromFragmentId: string;
  toFragmentId: string;
  fromFragment: MapFragment;
  toFragment: MapFragment;
}

export interface SpliceRelationGroup {
  groupId: string;
  fragments: MapFragment[];
  relations: SpliceRelation[];
}

export interface MapVersion {
  id: string;
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
  createdAt: number;
  updatedAt: number;
}

export interface Timeline {
  id: string;
  name: string;
  region: string;
  description?: string;
  versionIds: string[];
  createdAt: number;
  updatedAt: number;
}

export type AnnotationChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

export interface AnnotationChange {
  type: AnnotationChangeType;
  annotationId: string;
  annotationLabel: string;
  annotationType: AnnotationType;
  fromVersionId?: string;
  toVersionId: string;
  fromLabel?: string;
  toLabel?: string;
  fromDescription?: string;
  toDescription?: string;
  fromColor?: string;
  toColor?: string;
  positionChanged?: boolean;
  pointsChanged?: boolean;
}

export interface EvolutionStatistics {
  versionsCount: number;
  dateRange: { start: number; end: number };
  totalAnnotationChanges: number;
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  unchangedCount: number;
  byType: {
    place: { added: number; removed: number; modified: number; unchanged: number };
    river: { added: number; removed: number; modified: number; unchanged: number };
    boundary: { added: number; removed: number; modified: number; unchanged: number };
    note: { added: number; removed: number; modified: number; unchanged: number };
  };
  annotationChanges: AnnotationChange[];
}

export const DYNASTY_OPTIONS = [
  '先秦', '秦', '西汉', '东汉', '三国', '西晋', '东晋',
  '南北朝', '隋', '唐', '五代', '北宋', '南宋', '元',
  '明', '清', '民国', '现代', '不详'
] as const;

export const MAP_TYPE_OPTIONS = [
  '疆域图', '行政区划图', '山川形势图', '交通图',
  '水利图', '海防图', '边防图', '都会图', '风景名胜图',
  '舆地图', '方志附图', '其他'
] as const;
