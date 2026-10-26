import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { getLowStockProducts, listOrders } from "./wc.ts";

const client = new Anthropic();
const MODEL = "claude-sonnet-5-5";

const tools: Anthropic.Tool[] = [
  {
    name: "get_low_stock_products",
    description:
      "List products whose stock quantity is at or below a threshold. Use for questions about low stock, restocking or running out.",
    input_schema: {
      type: "object",
      properties: { threshold: { type: "number", description: "Stock level to compare against. Default 5." } },
    },
  },
  {
    name: "list_orders",
    description:
      "List recent orders, optionally filtered by status. Statuses: pending, processing, on-hold, completed, cancelled, refunded, failed.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Order status filter, optional" },
        limit: { type: "number", description: "How many orders, default 20, max 100" },
      },
    },
  },
];

async function runTool(name: string, input: any): Promise<string> {
  switch (name) {
    case "get_low_stock_products":
      return JSON.stringify(await getLowStockProducts(input.threshold ?? 5));
    case "list_orders":
      return JSON.stringify(await listOrders(input.status, input.limit ?? 20));
    default:
      return `Unknown tool: ${name}`;
  }
}

export async function ask(question: string) {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];
  const system =
    "You are an operations assistant for a WooCommerce store. Use the tools to get real data. Never guess numbers. Be concise.";

  for (let step = 0; step < 10; step++) { // safety limit on loop count
    const res = await client.messages.create({ model: MODEL, max_tokens: 1500, system, tools, messages });
    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") {
      const text = res.content.find((b) => b.type === "text");
      return text?.type === "text" ? text.text : "(no answer)";
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type === "tool_use") {
        console.error(`→ ${block.name}`, JSON.stringify(block.input));
        results.push({ type: "tool_result", tool_use_id: block.id, content: await runTool(block.name, block.input) });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return "Stopped: too many steps.";
}

console.log(await ask(process.argv[2] ?? "Which products are low on stock?"));