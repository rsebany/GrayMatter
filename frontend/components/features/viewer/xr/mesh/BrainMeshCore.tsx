import type { BrainMeshProps } from "./brain-mesh.types";
import { BrainMeshGltf } from "./brain-mesh-gltf";
import { BrainMeshPlaceholder } from "./brain-mesh-placeholder";

export function BrainMeshCore(props: BrainMeshProps) {
  if (props.usePlaceholder) {
    return (
      <BrainMeshPlaceholder
        onWorldDragDelta={props.onWorldDragDelta}
        autoRotate={props.autoRotate}
        allowDrag={props.allowDrag}
        layoutGroupPosition={props.layoutGroupPosition}
      />
    );
  }
  return (
    <BrainMeshGltf
      meshUrl={props.meshUrl}
      solidBrainEnabled={props.solidBrainEnabled}
      classVisibility={props.classVisibility}
      onWorldDragDelta={props.onWorldDragDelta}
      autoRotate={props.autoRotate}
      allowDrag={props.allowDrag}
      layoutGroupPosition={props.layoutGroupPosition}
      surfacePickMode={props.surfacePickMode}
      onSurfacePick={props.onSurfacePick}
    />
  );
}
