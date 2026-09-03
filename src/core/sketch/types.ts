import type { AuthoringIntent } from "../intent/types";
import type { Point, StrokeType } from "../types";

export type Bounds = { x: number; y: number; width: number; height: number };

export type RawStrokePoint = { x: number; y: number; t: number; pressure?: number };

export type RawStroke = {
  id: string;
  points: RawStrokePoint[];
  createdAt: number;
  pointerType?: string;
  deleted?: boolean;
};

export type GeometricGestureCandidate = {
  id: string;
  strokeIds: string[];
  kind: "open_path" | "closed_loop" | "arrow_like" | "connector_like" | "symbol_like" | "unknown";
  confidence: number;
  features: {
    closure?: number;
    directionality?: number;
    boundingBox?: Bounds;
    length?: number;
    intersections?: number;
  };
};

export type SketchEpisode = {
  id: string;
  strokeIds: string[];
  nearbyAssetIds: string[];
  startedAt: number;
  endedAt?: number;
};

export type AssetCategory = "structure" | "traversal" | "cover" | "encounter" | "reward" | "gating" | "recovery" | "generic";

export type AssetDefinition = {
  id: string;
  name: string;
  thumbnail?: string;
  sourceRef?: string;
  category: AssetCategory;
  candidateRoles: string[];
  capabilities: string[];
  defaultConstraints?: {
    movable?: boolean;
    duplicable?: boolean;
    replaceable?: boolean;
    rotatable?: boolean;
  };
  metadata?: Record<string, unknown>;
};

export type AssetInstance = {
  id: string;
  assetDefinitionId: string;
  position: Point;
  rotation: number;
  scale?: number;
  locked?: boolean;
  preserve?: boolean;
  doNotDuplicate?: boolean;
  doNotReplace?: boolean;
  roleAssignments: string[];
  sourceAssetRef?: string;
  createdAt: number;
};

export type SketchMarkKind = "freehand" | "path" | "loop" | "region" | "arrow" | "symbol" | "boundary" | `legacy-${StrokeType}`;

export type SketchMark = {
  id: string;
  kind: SketchMarkKind;
  points: Point[];
  width?: number;
  intensity?: number;
  symbolLabel?: string;
  createdAt: number;
  sourceStrokeId?: string;
};

export type SketchObjectType = "entrance" | "exit" | "enemy" | "resource" | "landmark" | "door" | "key" | "custom";

export type SketchObject = {
  id: string;
  objectType: SketchObjectType | string;
  position: Point;
  label?: string;
  assetRef?: string;
};

export type SketchRelationType = "connects" | "leads_to" | "contains" | "guards" | "gates" | "supports" | "overlooks" | "related_to" | "relates_to";

export type SketchRelation = {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: SketchRelationType;
  directed: boolean;
};

export type SketchAnnotation = {
  id: string;
  targetId: string | null;
  text: string;
  createdAt: number;
};

export type SketchGroup = {
  id: string;
  memberIds: string[];
  label?: string;
};

export type AssetAwareVisualUtterance = {
  id: string;
  assetInstanceIds: string[];
  rawStrokeIds: string[];
  gestureCandidateIds: string[];
  markIds: string[];
  relationIds: string[];
  annotationIds: string[];
  bounds: Bounds;
  status: "uninterpreted" | "candidate" | "clarifying" | "committed";
  createdAt: number;
};

export type SketchState = {
  assetInstances: AssetInstance[];
  rawStrokes: RawStroke[];
  gestureCandidates: GeometricGestureCandidate[];
  episodes: SketchEpisode[];
  marks: SketchMark[];
  objects: SketchObject[];
  relations: SketchRelation[];
  annotations: SketchAnnotation[];
  groups: SketchGroup[];
  utterances: AssetAwareVisualUtterance[];
};

export type SketchPatternSignature = {
  markKinds: SketchMarkKind[];
  objectTypes: string[];
  relationTypes: SketchRelationType[];
  markCount: number;
  objectCount: number;
  relationCount: number;
  hasClosedRegion: boolean;
  hasArrow: boolean;
  boundingAspectRatio: number;
  topology: string;
};

export type AuthoringIntentFragment = Pick<AuthoringIntent, "kind" | "sourceStrokeIds"> & Partial<AuthoringIntent>;

export type SketchSelection = {
  ids: string[];
};
