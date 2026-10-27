import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { toolDefinitions, findTool } from "./tools.ts";

const client = new Anthropic();
const MODEL = "claude-sonnet-5-5";
const SYSTEM = `You are an operations assistant for a WooCommerce store.
- Always use tools to get real data. Never invent numbers, ids or prices.
- Before updating a product, find its id with search_products.
- For any change, state exactly what will change before calling the write tool.
- If a tool returns an error, explain it plainly and suggest a next step.
- Be concise. Use short lists for multiple items.`;

export type Confirm = (summary: string) => Promise<boolean>;

export async function runTurn(messages: Anthropic.MessageParam[], userText: string, confirm: Confirm) {
  messages.push({ role: "user", content: userText });

  for (let step = 0; step < 10; step++) {
    const res = await client.messages.create({
      model: MODEL, max_tokens: 2000, system: SYSTEM, tools: toolDefinitions, messages,
    });
    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") {
      const text = res.content.find((b) => b.type === "text");
      return text?.type === "text" ? text.text : "(no answer)";
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      results.push(await executeTool(block, confirm));
    }
    messages.push({ role: "user", content: results });
  }
  return "Stopped after 10 steps. Try a more specific question.";
}

async function executeTool(block: Anthropic.ToolUseBlock, confirm: Confirm): Promise<Anthropic.ToolResultBlockParam> {
  const fail = (message: string): Anthropic.ToolResultBlockParam =>
    ({ type: "tool_result", tool_use_id: block.id, content: message, is_error: true });

  const tool = findTool(block.name);
  if (!tool) return fail(`Unknown tool ${block.name}`);

  // 1. Validate input
  const parsed = tool.schema.safeParse(block.input);
  if (!parsed.success) return fail(`Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`);

  // 2. Human confirmation for writes
  if (tool.isWrite) {
    const ok = await confirm(`${block.name} ${JSON.stringify(parsed.data)}`);
    if (!ok) return fail("The user declined this change. Do not retry it unless they ask again.");
  }

  // 3. Execute with error handling and timing
  const started = Date.now();
  try {
    const output = await tool.run(parsed.data);
    console.error(`  ✓ ${block.name} (${Date.now() - started} ms)`);
    return { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(output) };
  } catch (err: any) {
    const status = err?.response?.status;
    const apiMessage = err?.response?.data?.message ?? err?.message ?? "Unknown error";
    console.error(`  ✗ ${block.name} failed: ${status ?? ""} ${apiMessage}`);
    return fail(`Store API error${status ? ` (${status})` : ""}: ${String(apiMessage).slice(0, 300)}`);
  }
}