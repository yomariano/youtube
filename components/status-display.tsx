interface StatusDisplayProps {
  status: { message: string; type: 'processing' | 'success' | 'error' } | null;
}

export function StatusDisplay({ status }: StatusDisplayProps) {
  if (!status) return null;

  const getStatusStyles = () => {
    switch (status.type) {
      case 'processing':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
      case 'success':
        return 'bg-green-500/10 border-green-500/30 text-green-400';
      case 'error':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      default:
        return '';
    }
  };

  return (
    <div className={`mt-8 p-4 rounded-xl border backdrop-blur-md text-sm font-medium text-center ${getStatusStyles()}`}>
      {status.message}
    </div>
  );
} 