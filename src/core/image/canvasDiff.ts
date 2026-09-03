import type { RawStroke } from "../sketch/types";

export type DiffBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasDiffResult = {
  dataUrl: string;
  base64: string;
  mimeType: "image/png";
  changedPixelCount: number;
  boundingBox: DiffBoundingBox | null;
};

export function captureStrokeSnapshot(
  strokes: RawStroke[],
  width: number,
  height: number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Cannot create canvas context.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "#171717";
  context.lineWidth = 3;
  context.lineCap = "round";
  context.lineJoin = "round";

  for (const stroke of strokes) {
    if (stroke.deleted || stroke.points.length < 2) continue;

    context.beginPath();
    context.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (const point of stroke.points.slice(1)) {
      context.lineTo(point.x, point.y);
    }

    context.stroke();
  }

  return canvas.toDataURL("image/png");
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Cannot load canvas snapshot."));
    image.src = dataUrl;
  });
}

function getBase64FromDataUrl(dataUrl: string): string {
  return dataUrl.split(",")[1] ?? "";
}

export async function createCanvasDiff(
  previousDataUrl: string,
  currentDataUrl: string,
  width: number,
  height: number,
  threshold = 30,
  padding = 20,
): Promise<CanvasDiffResult> {
  const [previousImage, currentImage] = await Promise.all([
    loadImage(previousDataUrl),
    loadImage(currentDataUrl),
  ]);

  const previousCanvas = document.createElement("canvas");
  const currentCanvas = document.createElement("canvas");
  const fullDiffCanvas = document.createElement("canvas");

  for (const canvas of [
    previousCanvas,
    currentCanvas,
    fullDiffCanvas,
  ]) {
    canvas.width = width;
    canvas.height = height;
  }

  const previousContext = previousCanvas.getContext("2d");
  const currentContext = currentCanvas.getContext("2d");
  const fullDiffContext = fullDiffCanvas.getContext("2d");

  if (
    !previousContext ||
    !currentContext ||
    !fullDiffContext
  ) {
    throw new Error("Cannot create image comparison context.");
  }

  previousContext.drawImage(previousImage, 0, 0, width, height);
  currentContext.drawImage(currentImage, 0, 0, width, height);

  const previousPixels = previousContext.getImageData(
    0,
    0,
    width,
    height,
  );

  const currentPixels = currentContext.getImageData(
    0,
    0,
    width,
    height,
  );

  const diffPixels = fullDiffContext.createImageData(
    width,
    height,
  );

  let changedPixelCount = 0;
  let minimumX = width;
  let minimumY = height;
  let maximumX = -1;
  let maximumY = -1;

  for (
    let index = 0;
    index < previousPixels.data.length;
    index += 4
  ) {
    const redDifference = Math.abs(
      currentPixels.data[index] -
        previousPixels.data[index],
    );

    const greenDifference = Math.abs(
      currentPixels.data[index + 1] -
        previousPixels.data[index + 1],
    );

    const blueDifference = Math.abs(
      currentPixels.data[index + 2] -
        previousPixels.data[index + 2],
    );

    const hasChanged =
      redDifference +
        greenDifference +
        blueDifference >
      threshold;

    const pixelNumber = index / 4;
    const x = pixelNumber % width;
    const y = Math.floor(pixelNumber / width);

    if (hasChanged) {
      diffPixels.data[index] =
        currentPixels.data[index];
      diffPixels.data[index + 1] =
        currentPixels.data[index + 1];
      diffPixels.data[index + 2] =
        currentPixels.data[index + 2];
      diffPixels.data[index + 3] = 255;

      minimumX = Math.min(minimumX, x);
      minimumY = Math.min(minimumY, y);
      maximumX = Math.max(maximumX, x);
      maximumY = Math.max(maximumY, y);

      changedPixelCount += 1;
    } else {
      diffPixels.data[index] = 255;
      diffPixels.data[index + 1] = 255;
      diffPixels.data[index + 2] = 255;
      diffPixels.data[index + 3] = 255;
    }
  }

  fullDiffContext.putImageData(diffPixels, 0, 0);

  if (changedPixelCount === 0) {
    const emptyDataUrl =
      fullDiffCanvas.toDataURL("image/png");

    return {
      dataUrl: emptyDataUrl,
      base64: getBase64FromDataUrl(emptyDataUrl),
      mimeType: "image/png",
      changedPixelCount: 0,
      boundingBox: null,
    };
  }

  const cropX = Math.max(0, minimumX - padding);
  const cropY = Math.max(0, minimumY - padding);

  const cropRight = Math.min(
    width,
    maximumX + padding + 1,
  );

  const cropBottom = Math.min(
    height,
    maximumY + padding + 1,
  );

  const cropWidth = cropRight - cropX;
  const cropHeight = cropBottom - cropY;

  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;

  const croppedContext = croppedCanvas.getContext("2d");

  if (!croppedContext) {
    throw new Error("Cannot create cropped image context.");
  }

  croppedContext.fillStyle = "#ffffff";
  croppedContext.fillRect(0, 0, cropWidth, cropHeight);

  croppedContext.drawImage(
    fullDiffCanvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  );

  const croppedDataUrl =
    croppedCanvas.toDataURL("image/png");

  return {
    dataUrl: croppedDataUrl,
    base64: getBase64FromDataUrl(croppedDataUrl),
    mimeType: "image/png",
    changedPixelCount,
    boundingBox: {
      x: cropX,
      y: cropY,
      width: cropWidth,
      height: cropHeight,
    },
  };
}