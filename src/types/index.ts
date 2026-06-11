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
