import type { ComponentChildren } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";
import { App } from "@modelcontextprotocol/ext-apps";
import { BrandBar, categoryOf } from "./BrandBar";
import { CopyButton } from "./CopyButton";

export interface ShellContext {
  /**
   * Re-run the same query with some arguments changed, e.g. { page: 2 } or
   * { cursor: "..." }. Undefined when the host does not let the app call tools.
   */
  navigate?: (changes: Record<string, unknown>) => void;
  /** True while another page is being fetched. */
  busy: boolean;
  /**
   * Hands a text file to the host to save. Resolves false when the host
   * refuses, the user cancels, or the host has no download support.
   */
  download: (file: { filename: string; mimeType: string; text: string }) => Promise<boolean>;
}

interface AppShellProps<T> {
  /** The tool this view renders; used to re-run it when paging. */
  toolName: string;
  children: (data: T, ctx: ShellContext) => ComponentChildren;
}

interface ToolResultLike {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  content?: { type: string; text?: string }[];
}

function resultText(result: ToolResultLike): string | undefined {
  return result.content?.find((c) => c.type === "text")?.text;
}

export function AppShell<T>({ toolName, children }: AppShellProps<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canCallTools, setCanCallTools] = useState(false);
  const [blockedLink, setBlockedLink] = useState<string | null>(null);
  const [app] = useState(() => new App({ name: "OpenAlex", version: "1.0.0" }));
  const args = useRef<Record<string, unknown>>({});

  const applyResult = (result: ToolResultLike) => {
    if (result.isError) {
      setError(resultText(result) ?? "The request failed.");
    } else if (result.structuredContent) {
      setError(null);
      setData(result.structuredContent as T);
    } else {
      setError("The server returned no data to display.");
    }
  };

  useEffect(() => {
    // Handlers are registered before connecting so no notification is missed
    app.ontoolinput = (params) => {
      args.current = params.arguments ?? {};
    };
    app.ontoolresult = (result) => applyResult(result);
    app.connect()
      .then(() => setCanCallTools(Boolean(app.getHostCapabilities()?.serverTools)))
      .catch(() => setError("Could not connect to the host."));
  }, []);

  // Views run in a sandboxed frame that may not open links itself, so every
  // outside link is handed to the host. If the host refuses, the address is
  // shown so it can still be copied.
  const openLink = async (event: MouseEvent) => {
    const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    const url = anchor?.getAttribute("href") ?? "";
    if (!anchor || !/^https?:\/\//i.test(url)) return;
    event.preventDefault();
    try {
      const result = await app.openLink({ url });
      setBlockedLink(result.isError ? url : null);
    } catch {
      setBlockedLink(url);
    }
  };

  const download = async (file: { filename: string; mimeType: string; text: string }): Promise<boolean> => {
    try {
      const result = await app.downloadFile({
        contents: [{ type: "resource", resource: { uri: `file:///${file.filename}`, mimeType: file.mimeType, text: file.text } }],
      });
      return !result.isError;
    } catch {
      return false;
    }
  };

  const navigate = async (changes: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      const nextArgs = { ...args.current, ...changes };
      const result = await app.callServerTool({ name: toolName, arguments: nextArgs });
      args.current = nextArgs;
      applyResult(result);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load that page.");
    } finally {
      setBusy(false);
    }
  };

  const shellClass = `app-shell cat-${categoryOf(toolName).category}`;

  if (!data) {
    return (
      <div class={shellClass} onClick={openLink}>
        <BrandBar toolName={toolName} />
        {error ? (
          <div class="error">{error}</div>
        ) : (
          <div class="loading">
            <div class="spinner" />
            <p>Loading...</p>
          </div>
        )}
      </div>
    );
  }
  return (
    <div class={shellClass} onClick={openLink}>
      <BrandBar toolName={toolName} />
      {error && <div class="error">{error}</div>}
      {blockedLink && (
        <div class="notice" role="status">
          The link could not be opened from here. Copy it instead: <code>{blockedLink}</code>{" "}
          <CopyButton text={blockedLink} />
        </div>
      )}
      {children(data, { navigate: canCallTools ? navigate : undefined, busy, download })}
    </div>
  );
}
