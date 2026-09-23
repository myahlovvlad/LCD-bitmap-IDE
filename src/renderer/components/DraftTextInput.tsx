import type React from 'react';
import { useEffect, useRef, useState } from 'react';

/**
 * Text input that buffers edits in local state and only calls `onCommit` on
 * blur (or Enter), instead of on every keystroke. Typing into a plain
 * `<input onChange={...updateProject...}>` re-runs the full command-bus
 * mutation pipeline (including a full-project validateProject() pass) per
 * character, which is fine on a small project but becomes a visible stutter
 * once the FSM/screen count grows into the hundreds. Escape reverts to the
 * last committed value.
 */
export function DraftTextInput({
  value,
  disabled,
  onCommit
}: {
  value: string;
  disabled?: boolean;
  onCommit: (value: string) => void;
}): React.ReactElement {
  const [draft, setDraft] = useState(value);
  const cancelledRef = useRef(false);

  useEffect(() => setDraft(value), [value]);

  return (
    <input
      value={draft}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (cancelledRef.current) {
          cancelledRef.current = false;
          return;
        }
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          cancelledRef.current = true;
          setDraft(value);
          event.currentTarget.blur();
        } else if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
      }}
    />
  );
}
