import { cn } from "@/lib/utils";
import type { TabConfig, TabId } from "./settings-tab-types";

type SettingsTabsHeaderProps = {
  tabs: TabConfig[];
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
};

export function SettingsTabsHeader({
  tabs,
  activeTab,
  onTabChange,
}: SettingsTabsHeaderProps) {
  return (
    <div className="flex border-b border-graymatter-border">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-graymatter-accent text-graymatter-accent bg-graymatter-card-hover"
                : "border-transparent text-muted-foreground hover:bg-graymatter-card-hover hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
