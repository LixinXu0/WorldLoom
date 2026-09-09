import type {
  AssetManifest,
  AssetManifestItem,
} from "../ai/qwenGenerationPlanner";


const BRIDGE_MANIFEST_URL =
  "http://127.0.0.1:4318/asset-manifest";

const STATIC_MANIFEST_URL =
  "/worldloom_assets/asset_manifest.json";


type PreviewableAssetManifestItem =
  AssetManifestItem & {
    previewUrl?: string;
    origin?: string;
  };


let cachedManifest:
  AssetManifest | null = null;


async function loadBridgeManifest():
Promise<AssetManifest | null> {
  try {
    const response = await fetch(
      BRIDGE_MANIFEST_URL,
      {
        signal:
          AbortSignal.timeout(2000),
      },
    );

    if (!response.ok) {
      return null;
    }

    return (
      await response.json()
    ) as AssetManifest;

  } catch {
    return null;
  }
}


async function loadStaticManifest():
Promise<AssetManifest> {
  const response = await fetch(
    STATIC_MANIFEST_URL,
  );

  if (!response.ok) {
    throw new Error(
      "无法读取网页端素材清单。",
    );
  }

  return (
    await response.json()
  ) as AssetManifest;
}


export async function getAssetManifest(
  forceRefresh = false,
): Promise<AssetManifest> {
  if (
    cachedManifest &&
    !forceRefresh
  ) {
    return cachedManifest;
  }

  const bridgeManifest =
    await loadBridgeManifest();

  if (bridgeManifest) {
    cachedManifest =
      bridgeManifest;

    return bridgeManifest;
  }

  cachedManifest =
    await loadStaticManifest();

  return cachedManifest;
}


export function clearAssetManifestCache():
void {
  cachedManifest = null;
}


export async function refreshAssetManifest():
Promise<AssetManifest> {
  return getAssetManifest(true);
}


export async function getAssetById(
  assetId: string,
): Promise<AssetManifestItem | null> {
  const manifest =
    await getAssetManifest();

  return (
    manifest.assets.find(
      (asset) =>
        asset.id === assetId,
    ) ?? null
  );
}


export function getWebTextureUrl(
  asset: AssetManifestItem,
): string | null {
  const previewableAsset =
    asset as PreviewableAssetManifestItem;

  if (
    previewableAsset.previewUrl
  ) {
    return previewableAsset.previewUrl;
  }

  if (
    asset.resource.type !== "texture" ||
    !asset.resource.path
  ) {
    return null;
  }

  if (
    asset.resource.path.startsWith(
      "res://worldloom_assets/",
    )
  ) {
    return asset.resource.path.replace(
      "res://worldloom_assets/",
      "/worldloom_assets/",
    );
  }

  if (
    asset.resource.path.startsWith("/")
  ) {
    return asset.resource.path;
  }

  return null;
}