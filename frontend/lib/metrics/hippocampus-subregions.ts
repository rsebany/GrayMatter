export type HippocampusSubregionDistribution = {
  left: { anteriorFraction: number; posteriorFraction: number };
  right: { anteriorFraction: number; posteriorFraction: number };
};

type MaskShape = [depth: number, height: number, width: number];

function sideDistribution(rows: Uint32Array) {
  let first = -1;
  let last = -1;
  let total = 0;

  for (let y = 0; y < rows.length; y += 1) {
    const count = rows[y];
    if (count === 0) continue;
    if (first < 0) first = y;
    last = y;
    total += count;
  }

  if (first < 0 || total === 0) {
    return { anteriorFraction: 0, posteriorFraction: 0 };
  }

  // The stored MRI masks use the RAS+ convention: increasing Y is anterior.
  // Split each hippocampus at the midpoint of its own occupied Y extent.
  const midpoint = (first + last) / 2;
  let anterior = 0;
  let posterior = 0;
  for (let y = first; y <= last; y += 1) {
    if (y > midpoint) anterior += rows[y];
    else posterior += rows[y];
  }

  return {
    anteriorFraction: anterior / total,
    posteriorFraction: posterior / total,
  };
}

export function calculateHippocampusSubregions(
  mask: Uint8Array,
  [depth, height, width]: MaskShape,
): HippocampusSubregionDistribution {
  if (mask.length !== depth * height * width) {
    throw new Error("Segmentation mask dimensions do not match its data.");
  }

  const leftRows = new Uint32Array(height);
  const rightRows = new Uint32Array(height);
  const sliceSize = height * width;

  for (let z = 0; z < depth; z += 1) {
    const sliceOffset = z * sliceSize;
    for (let y = 0; y < height; y += 1) {
      const rowOffset = sliceOffset + y * width;
      let leftCount = 0;
      let rightCount = 0;
      for (let x = 0; x < width; x += 1) {
        const label = mask[rowOffset + x];
        if (label === 1) leftCount += 1;
        else if (label === 2) rightCount += 1;
      }
      leftRows[y] += leftCount;
      rightRows[y] += rightCount;
    }
  }

  return {
    left: sideDistribution(leftRows),
    right: sideDistribution(rightRows),
  };
}
