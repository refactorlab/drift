import { KeyboardEvent } from "react";

import { FolderIcon } from "./icons";

interface Props {
  value: string;
  onChange: (next: string) => void;
  onPick: () => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export default function SearchBox({ value, onChange, onPick, onSubmit, disabled }: Props) {
  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onSubmit();
  };

  return (
    <div className="search-wrap">
      <div className="search-box">
        <span className="search-icon">
          <FolderIcon />
        </span>
        <input
          type="text"
          className="search-input"
          placeholder="/path/to/your/project"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled}
          autoFocus
          spellCheck={false}
        />
        <button type="button" className="search-pick" onClick={onPick} disabled={disabled}>
          Browse
        </button>
      </div>
    </div>
  );
}
