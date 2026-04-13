import { App } from "@modelcontextprotocol/ext-apps";

export async function callTool(
  app: App,
  name: string,
  args: Record<string, any>
): Promise<any> {
  const result = await app.callServerTool({ name, arguments: args });
  const text = (result as any).content?.find(
    (c: any) => c.type === "text"
  )?.text;
  return text ? JSON.parse(text) : null;
}
