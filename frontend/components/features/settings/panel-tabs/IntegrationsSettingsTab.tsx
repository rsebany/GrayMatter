import { Input } from "@/components/ui/input";
import type { IntegrationSettingsState } from "./settings-tab-types";

type IntegrationsSettingsTabProps = IntegrationSettingsState;

export function IntegrationsSettingsTab({
  pacsApiKey,
  pacsEndpoint,
  setPacsApiKey,
  setPacsEndpoint,
}: IntegrationsSettingsTabProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-foreground">
        Hospital PACS Integration
      </h3>
      <p className="text-sm text-muted-foreground">
        Connect GrayMatter to your hospital PACS for automated study retrieval.
      </p>
      <div>
        <label
          htmlFor="pacs-endpoint"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          PACS Endpoint URL
        </label>
        <Input
          id="pacs-endpoint"
          type="url"
          placeholder="https://pacs.hospital.example/dicom"
          value={pacsEndpoint}
          onChange={(e) => setPacsEndpoint(e.target.value)}
          className="border-graymatter-border bg-muted/30"
        />
      </div>
      <div>
        <label
          htmlFor="pacs-api-key"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          API Key
        </label>
        <Input
          id="pacs-api-key"
          type="password"
          placeholder="Enter your PACS API key"
          value={pacsApiKey}
          onChange={(e) => setPacsApiKey(e.target.value)}
          className="border-graymatter-border bg-muted/30"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Keys are stored securely and never displayed in full.
        </p>
      </div>
    </div>
  );
}
