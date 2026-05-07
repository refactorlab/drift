interface Props {
  onClick: () => void;
  disabled?: boolean;
}

export default function RunButton({ onClick, disabled }: Props) {
  return (
    <div className="btn-row">
      <button type="button" className="run-btn" onClick={onClick} disabled={disabled}>
        <span className="spark">✨</span>
        Run magic
      </button>
    </div>
  );
}
