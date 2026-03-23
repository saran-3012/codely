interface Props {
  output: string;
  error: string;
  exitCode: number | null;
  loading: boolean;
}

const OutputPanel = ({ output, error, exitCode, loading }: Props) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <span className="animate-pulse">Running...</span>
      </div>
    );
  }

  if (!output && !error && exitCode === null) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Click Run to execute your code
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 font-mono text-sm">
      {exitCode !== null && (
        <div className={`mb-3 text-xs font-medium ${exitCode === 0 ? 'text-green-400' : 'text-red-400'}`}>
          Process exited with code {exitCode}
        </div>
      )}
      {output && (
        <pre className="text-green-300 whitespace-pre-wrap break-words">{output}</pre>
      )}
      {error && (
        <pre className="text-red-400 whitespace-pre-wrap break-words">{error}</pre>
      )}
    </div>
  );
};

export default OutputPanel;
