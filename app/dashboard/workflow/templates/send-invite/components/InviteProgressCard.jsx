import { getStageDescription } from "../constants/stageDescriptions";

export default function InviteProgressCard({ progress, isProcessing }) {
  const showProgress = isProcessing && progress.total > 0;

  if (!showProgress) {
    return null;
  }

  const label = progress.stage
    ? getStageDescription(progress.stage)
    : progress.current === 0 && progress.total === 1
      ? "Connecting..."
      : "Processing...";

  const percentage =
    progress.current === 0 && progress.total === 1
      ? "..."
      : `${Math.ceil(progress.current)}/${progress.total} (${Math.round((progress.current / progress.total) * 100)}%)`;

  const width =
    progress.current === 0 && progress.total === 1
      ? "0%"
      : `${(progress.current / progress.total) * 100}%`;

  return (
    <div className="absolute top-4 right-4 z-[100] w-80">
      <div className="bg-base-100 rounded-lg shadow-xl border border-base-300 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-base-content flex items-center gap-1.5">
            <span className="loading loading-spinner loading-xs text-primary"></span>
            {label}
          </span>
          <span className="text-xs font-mono font-semibold text-primary">{percentage}</span>
        </div>

        <div className="w-full bg-base-300 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-primary to-secondary h-full rounded-full transition-all duration-300 ease-out"
            style={{ width }}
          />
        </div>
      </div>
    </div>
  );
}

