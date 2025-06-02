import { DownloadResult } from '@/types';
import { formatFileSize } from '@/lib/utils';

interface DownloadLinksProps {
  result: DownloadResult | null;
}

export function DownloadLinks({ result }: DownloadLinksProps) {
  if (!result || !result.success) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold mb-4 text-white/80 text-center">
        Ready to download
      </h3>
      <div className="space-y-2">
        {result.files.map((file, index) => (
          <a
            key={index}
            href={file.downloadUrl}
            download={file.filename}
            className="block p-3.5 bg-white/5 border border-white/10 text-white no-underline rounded-xl text-sm font-medium text-center transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:-translate-y-0.5"
          >
            {file.format.toUpperCase()} • {file.quality} {file.translated && ` • Translated`}
            <span className="block text-xs text-white/50 mt-1">
              {formatFileSize(file.size)}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
} 