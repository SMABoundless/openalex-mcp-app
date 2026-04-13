import { h, ComponentChildren } from "preact";
import { useState, useEffect } from "preact/hooks";
import { App } from "@modelcontextprotocol/ext-apps";

interface AppShellProps {
  title: string;
  children: (data: any) => ComponentChildren;
}

export function AppShell({ title, children }: AppShellProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [app] = useState(() => new App({ name: "OpenAlex", version: "1.0.0" }));

  useEffect(() => {
    app.ontoolresult = (result: any) => {
      try {
        const text = result.content?.find((c: any) => c.type === "text")?.text;
        if (text) setData(JSON.parse(text));
      } catch (e) {
        setError("Failed to parse tool result");
      }
    };
    app.connect();
  }, []);

  if (error) return <div class="error">{error}</div>;
  if (!data) {
    return (
      <div class="loading">
        <div class="spinner" />
        <p>Loading...</p>
      </div>
    );
  }
  return <div class="app-shell">{children(data)}</div>;
}
