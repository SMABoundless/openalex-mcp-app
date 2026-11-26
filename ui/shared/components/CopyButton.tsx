import { useState } from "preact/hooks";

interface CopyButtonProps {
  /** The text placed on the clipboard */
  text: string;
  /** What the button copies, for its label: "Copy" alone when omitted */
  label?: string;
}

/**
 * Copies text to the clipboard. Inside a sandboxed frame this needs the
 * clipboardWrite permission the server declares on each view; when the host
 * withholds it, the button says the copy failed instead of pretending.
 */
export function CopyButton({ text, label }: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = async (event: MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  };
  const idle = label ? `Copy ${label}` : "Copy";
  return (
    <button type="button" class={`copy-button copy-${state}`} onClick={copy} aria-live="polite">
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : idle}
    </button>
  );
}
