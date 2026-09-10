import type { AssetDefinition, AssetInstance, MovementBehavior } from "./sketch/types";
import type { BaseMapPoint, BaseMapState, SurfaceMaterialId } from "./types";

export const surfaceMaterials: Array<{
  id: SurfaceMaterialId;
  name: string;
  textureReference: string;
  colors: [string, string, string];
}> = [
  { id: "grass", name: "Grass", textureReference: "procedural://grass", colors: ["#526b45", "#667e54", "#3f5838"] },
  { id: "dirt", name: "Dirt", textureReference: "procedural://dirt", colors: ["#725744", "#886a50", "#584233"] },
  { id: "stone", name: "Stone", textureReference: "procedural://stone", colors: ["#707475", "#85898a", "#555b5d"] },
  { id: "sand", name: "Sand", textureReference: "procedural://sand", colors: ["#a99265", "#c0aa7b", "#88754f"] },
  { id: "water", name: "Water", textureReference: "procedural://water", colors: ["#3e6670", "#527b84", "#31545e"] },
];

export const emptyBaseMapState = (): BaseMapState => ({
  surfaces: [],
  accessibilityZones: [],
  collisions: [],
});

export function surfaceMaterial(id: SurfaceMaterialId) {
  return surfaceMaterials.find((material) => material.id === id) ?? surfaceMaterials[0];
}

export function defaultMovementBehavior(definition: AssetDefinition): MovementBehavior {
  if (definition.defaultMovementBehavior) return definition.defaultMovementBehavior;
  if (definition.category === "structure" || definition.category === "cover") return "blocking";
  if (definition.category === "traversal" || definition.category === "reward" || definition.category === "recovery") return "passable";
  return definition.capabilities.some((capability) => /blocks movement/i.test(capability)) ? "blocking" : "passable";
}

function footprintSize(asset: AssetInstance, definition: AssetDefinition) {
  const metadata = definition.metadata?.collisionFootprint as { width?: number; height?: number } | undefined;
  const categorySize = definition.category === "structure" ? { width: 110, height: 90 } : definition.category === "cover" ? { width: 110, height: 38 } : { width: 76, height: 56 };
  const scale = (asset.scale ?? 1) * (asset.collisionFootprintScale ?? 1);
  return { width: (metadata?.width ?? categorySize.width) * scale, height: (metadata?.height ?? categorySize.height) * scale };
}

export function assetCollisionGeometry(asset: AssetInstance, definition: AssetDefinition): BaseMapPoint[] {
  const size = footprintSize(asset, definition);
  const radians = (asset.rotation * Math.PI) / 180;
  const cosine = Math.cos(radians); const sine = Math.sin(radians);
  return [[-size.width / 2, -size.height / 2], [size.width / 2, -size.height / 2], [size.width / 2, size.height / 2], [-size.width / 2, size.height / 2]].map(([x, y]) => ({ x: asset.position.x + x * cosine - y * sine, y: asset.position.y + x * sine + y * cosine }));
}

export function synchronizeAssetMovement(baseMap: BaseMapState, asset: AssetInstance, definition: AssetDefinition): BaseMapState {
  const collisions = baseMap.collisions.filter((shape) => shape.sourceAssetId !== asset.id);
  const accessibilityZones = baseMap.accessibilityZones.filter((zone) => zone.sourceAssetId !== asset.id);
  const behavior = asset.movementBehavior ?? defaultMovementBehavior(definition);
  if (behavior === "passable") return { ...baseMap, collisions, accessibilityZones };
  const geometry = assetCollisionGeometry(asset, definition);
  return {
    ...baseMap,
    collisions: [...collisions, { id: `derived-collision-${asset.id}`, geometry, type: "polygon", blocksMovement: true, source: "asset-derived", sourceAssetId: asset.id }],
    accessibilityZones: [...accessibilityZones, { id: `derived-access-${asset.id}`, geometry: "polygon", points: geometry, state: "blocked", brushSize: 0, source: "asset-derived", sourceAssetId: asset.id }],
  };
}

export function removeAssetMovement(baseMap: BaseMapState, assetId: string): BaseMapState {
  return { ...baseMap, collisions: baseMap.collisions.filter((shape) => shape.sourceAssetId !== assetId), accessibilityZones: baseMap.accessibilityZones.filter((zone) => zone.sourceAssetId !== assetId) };
}
