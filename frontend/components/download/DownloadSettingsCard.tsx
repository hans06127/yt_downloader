import FormatSelector from "@/components/download/FormatSelector";
import OutputDirInput from "@/components/download/OutputDirInput";
import type { DownloadSettings } from "@/components/home/types";
import ActionButton from "@/components/ui/ActionButton";
import type { MediaType } from "@/lib/types";

interface DownloadSettingsCardProps {
  defaultDir: string;
  settings: DownloadSettings;
  startLabel: string;
  onReset?: () => void;
  onStart: () => void;
  updateMediaType: (mediaType: MediaType) => void;
  updateSettings: (patch: Partial<DownloadSettings>) => void;
}

export default function DownloadSettingsCard({
  defaultDir,
  onReset,
  onStart,
  settings,
  startLabel,
  updateMediaType,
  updateSettings,
}: DownloadSettingsCardProps) {
  return (
    <section className="card">
      <div className="card-title">輸出設定</div>
      <FormatSelector
        extension={settings.extension}
        mediaType={settings.mediaType}
        onExtensionChange={(extension) => updateSettings({ extension })}
        onMediaTypeChange={updateMediaType}
      />
      <hr className="divider" />
      <div className="card-title">輸出資料夾</div>
      <OutputDirInput
        defaultDir={defaultDir}
        outputDir={settings.outputDir}
        onChange={(outputDir) => updateSettings({ outputDir })}
      />
      <div className="action-bar">
        <ActionButton variant="primary" onClick={onStart}>
          {startLabel}
        </ActionButton>
        {onReset ? <ActionButton onClick={onReset}>重置</ActionButton> : null}
      </div>
    </section>
  );
}
