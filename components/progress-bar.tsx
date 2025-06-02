interface ProgressBarProps {
  progress: number;
  show: boolean;
}

export function ProgressBar({ progress, show }: ProgressBarProps) {
  if (!show) return null;

  return (
    <div className="mt-4 w-full h-0.5 bg-white/10 rounded-full overflow-hidden">
      <div 
        className="h-full bg-gradient-to-r from-white to-white/80 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
} 