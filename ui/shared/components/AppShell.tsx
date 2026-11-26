import type { ComponentChildren } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";
import { App } from "@modelcontextprotocol/ext-apps";

export interface ShellContext {
  /**
   * Re-run the same query with some arguments changed, e.g. { page: 2 } or
   * { cursor: "..." }. Undefined when the host does not let the app call tools.
   */
  navigate?: (changes: Record<string, unknown>) => void;
  /** True while another page is being fetched. */
  busy: boolean;
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

  if (!data) {
    if (error) return <div class="error">{error}</div>;
    return (
      <div class="loading">
        <div class="spinner" />
        <p>Loading...</p>
      </div>
    );
  }
  return (
    <div class="app-shell">
      {error && <div class="error">{error}</div>}
      {children(data, { navigate: canCallTools ? navigate : undefined, busy })}
    </div>
  );
}
