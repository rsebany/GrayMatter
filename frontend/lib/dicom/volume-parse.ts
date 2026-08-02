export type Orientation = "axial" | "coronal" | "sagittal";

export type ParsedDicom = {
  rows: number;
  columns: number;
  numSlices: number;
  pixelData: Int16Array | Uint16Array | Uint8Array;
  bitsAllocated: number;
  rescaleSlope: number;
  rescaleIntercept: number;
  sliceLengthPx: number;
  sliceLengthBytes: number;
  pixelOffset: number;
  buf: ArrayBufferLike;
  minMax: { min: number; max: number };
};

export type DataSet = {
  elements: Record<string, { dataOffset: number; length: number }>;
  byteArray: Uint8Array;
  string: (tag: string) => string;
  uint16: (tag: string) => number;
  int16: (tag: string) => number;
  float: (tag: string) => number;
};

export const MASK_OVERLAY_COLOR = { r: 16, g: 185, b: 129 };

export function applyWindowLevel(
  pixelData: Int16Array | Uint16Array | Uint8Array,
  width: number,
  height: number,
  center: number,
  widthW: number,
  rescaleSlope: number,
  rescaleIntercept: number,
  bitsAllocated: number,
): Uint8ClampedArray {
  const len = width * height;
  const out = new Uint8ClampedArray(len);
  const wMin = center - widthW / 2;
  const wMax = center + widthW / 2;
  const range = wMax - wMin || 1;

  for (let i = 0; i < len; i++) {
    let v = pixelData[i] as number;
    if (bitsAllocated === 16 && rescaleSlope !== 0) {
      v = v * rescaleSlope + rescaleIntercept;
    }
    const normalized = (v - wMin) / range;
    const clamped = Math.max(0, Math.min(1, normalized));
    out[i] = Math.round(clamped * 255);
  }
  return out;
}

export async function parseDicomFile(file: File): Promise<ParsedDicom | null> {
  const m = await import("dicom-parser");
  const parseDicom =
    "parseDicom" in m &&
    typeof (m as { parseDicom: (arr: Uint8Array) => DataSet }).parseDicom ===
      "function"
      ? (m as { parseDicom: (arr: Uint8Array) => DataSet }).parseDicom
      : (m.default as unknown as (arr: Uint8Array) => DataSet);
  const buffer = await file.arrayBuffer();
  const byteArray = new Uint8Array(buffer);
  let dataSet: DataSet;
  try {
    dataSet = parseDicom(byteArray) as DataSet;
  } catch {
    return null;
  }

  const tag = "x7fe00010";
  const elem = dataSet.elements[tag];
  if (!elem) return null;

  const rows = dataSet.uint16("x00280010") || 512;
  const columns = dataSet.uint16("x00280011") || 512;
  const bitsAllocated = dataSet.uint16("x00280100") || 16;
  const numFrames = parseInt(dataSet.string("x00280008") || "1", 10) || 1;

  const rescaleSlope =
    dataSet.float("x00281053") ??
    dataSet.int16("x00281053") ??
    (parseFloat(dataSet.string("x00281053") ?? "") || 1);
  const rescaleIntercept =
    dataSet.float("x00281052") ??
    dataSet.int16("x00281052") ??
    (parseFloat(dataSet.string("x00281052") ?? "") || 0);

  const bytesPerPixel = bitsAllocated / 8;
  const sliceLengthPx = rows * columns;
  const sliceLengthBytes = sliceLengthPx * bytesPerPixel;
  const numSlices = Math.min(
    numFrames,
    Math.floor(elem.length / sliceLengthBytes) || 1,
  );

  const buf = dataSet.byteArray.buffer;
  const bufOffset = dataSet.byteArray.byteOffset;
  const pixelOffset = bufOffset + elem.dataOffset;

  let pixelData: Int16Array | Uint16Array | Uint8Array;
  if (bitsAllocated === 16) {
    pixelData = new Int16Array(buf, pixelOffset, elem.length / 2);
  } else {
    pixelData = new Uint8Array(buf, pixelOffset, elem.length);
  }

  let min = Infinity;
  let max = -Infinity;
  const sampleStep = Math.max(1, Math.floor(pixelData.length / 100_000));
  for (let i = 0; i < pixelData.length; i += sampleStep) {
    const v = (pixelData[i] as number) * rescaleSlope + rescaleIntercept;
    if (v < min) min = v;
    if (v > max) max = v;
  }

  return {
    rows,
    columns,
    numSlices,
    pixelData,
    bitsAllocated,
    rescaleSlope,
    rescaleIntercept,
    sliceLengthPx,
    sliceLengthBytes,
    pixelOffset,
    buf,
    minMax: {
      min: Number.isFinite(min) ? min : -1024,
      max: Number.isFinite(max) ? max : 3071,
    },
  };
}

export function getSortKey(dataSet: DataSet): {
  instanceNumber: number;
  sliceLocation: number;
} {
  const instanceNumber =
    (dataSet.uint16("x00200013") ??
      parseInt(dataSet.string("x00200013") || "0", 10)) || 0;
  const sliceLocation = parseFloat(dataSet.string("x00201041") || "0") || 0;
  return { instanceNumber, sliceLocation };
}

export async function parseVolume(files: File[]): Promise<{
  slices: ParsedDicom[];
  sortKeys: { instanceNumber: number; sliceLocation: number }[];
} | null> {
  const m = await import("dicom-parser");
  const parseDicom =
    "parseDicom" in m &&
    typeof (m as { parseDicom: (arr: Uint8Array) => DataSet }).parseDicom ===
      "function"
      ? (m as { parseDicom: (arr: Uint8Array) => DataSet }).parseDicom
      : (m.default as unknown as (arr: Uint8Array) => DataSet);

  const results: {
    parsed: ParsedDicom;
    key: { instanceNumber: number; sliceLocation: number };
  }[] = [];
  for (let i = 0; i < files.length; i++) {
    const p = await parseDicomFile(files[i]);
    if (!p) continue;
    const buffer = await files[i].arrayBuffer();
    const byteArray = new Uint8Array(buffer);
    let dataSet: DataSet;
    try {
      dataSet = parseDicom(byteArray) as DataSet;
    } catch {
      results.push({
        parsed: p,
        key: { instanceNumber: i, sliceLocation: i },
      });
      continue;
    }
    const key = getSortKey(dataSet);
    results.push({ parsed: p, key });
  }
  if (results.length === 0) return null;
  results.sort((a, b) => {
    if (a.key.instanceNumber !== b.key.instanceNumber)
      return a.key.instanceNumber - b.key.instanceNumber;
    return a.key.sliceLocation - b.key.sliceLocation;
  });
  return {
    slices: results.map((r) => r.parsed),
    sortKeys: results.map((r) => r.key),
  };
}
