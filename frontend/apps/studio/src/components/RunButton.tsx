interface Props {
  onClick: () => void;
  loading: boolean;
}

const RunButton = ({ onClick, loading }: Props) => (
  <button
    onClick={onClick}
    disabled={loading}
    className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white font-medium px-5 py-1.5 rounded text-sm transition-colors"
  >
    {loading ? 'Running...' : '▶ Run'}
  </button>
);

export default RunButton;
