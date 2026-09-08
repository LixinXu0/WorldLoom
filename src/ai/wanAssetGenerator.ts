import type {
  MissingAssetRequest,
} from "./qwenGenerationPlanner";


export type GeneratedAsset = {
  requestId: string;
  sourceElementId: string;
  assetId: string;
  name: string;
  category: string;
  imageUrl: string;

  size: {
    width: number;
    height: number;
  };

  layer: number;
  collision: boolean;
};


type WanAPIResponse = {
  requestId?: string;
  sourceElementId?: string;
  assetId?: string;
  name?: string;
  category?: string;
  imageUrl?: string;
  error?: string;
  details?: string;
};


export async function generateMissingAsset(
  request: MissingAssetRequest,
): Promise<GeneratedAsset> {
  const response = await fetch(
    "/api/wan/generate-asset",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        requestId: request.id,

        sourceElementId:
          request.sourceElementId,

        assetId:
          request.suggestedAssetId,

        name: request.name,
        category: request.category,

        prompt:
          request.imagePrompt,
      }),
    },
  );

  const data =
    (await response.json()) as
      WanAPIResponse;

  if (
    !response.ok ||
    !data.imageUrl
  ) {
    throw new Error(
      data.details
        ? `${data.error ?? "Asset generation failed"}: ${data.details}`
        : data.error ??
            "Wanxiang did not return an asset image.",
    );
  }

  return {
    requestId:
      data.requestId ??
      request.id,

    sourceElementId:
      data.sourceElementId ??
      request.sourceElementId,

    assetId:
      data.assetId ??
      request.suggestedAssetId,

    name:
      data.name ??
      request.name,

    category:
      data.category ??
      request.category,

    imageUrl: data.imageUrl,

    size: request.size,
    layer: request.layer,
    collision: request.collision,
  };
}


export async function generateMissingAssets(
  requests: MissingAssetRequest[],
): Promise<GeneratedAsset[]> {
  const results: GeneratedAsset[] = [];

  for (const request of requests) {
    const generatedAsset =
      await generateMissingAsset(request);

    results.push(generatedAsset);
  }

  return results;
}
