export async function hospitalBinAvailable(): Promise<boolean> {
  try {
    const response = await fetch("/xr/backgrounds/hospital/scene.bin", { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}
