import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "learning-server", version: "1.0.0" });

// Tool 1: fake weather (same as Day 1, now as MCP)
server.registerTool(
  "get_weather",
  {
    title: "Get weather",
    description: "Get the current weather for a city. Use when the user asks about weather.",
    inputSchema: { city: z.string().describe("City name, for example Islamabad") },
  },
  async ({ city }) => {
    const data: Record<string, string> = { Islamabad: "24°C, sunny", Lahore: "29°C, hazy" };
    return { content: [{ type: "text", text: data[city] ?? `No weather data for ${city}` }] };
  }
);

// Tool 2: a calculation, to see input validation
server.registerTool(
  "calculate_discount",
  {
    title: "Calculate discount",
    description: "Calculate a sale price from an original price and a discount percentage.",
    inputSchema: {
      price: z.number().positive().describe("Original price"),
      percent: z.number().min(0).max(90).describe("Discount percentage, 0 to 90"),
    },
  },
  async ({ price, percent }) => {
    const sale = (price * (100 - percent)) / 100;
    return { content: [{ type: "text", text: `Sale price: ${sale.toFixed(2)}` }] };
  }
);

// A resource: read-only data
server.registerResource(
  "store-policies",
  "store://policies",
  { title: "Store policies", description: "Return and shipping policies", mimeType: "text/plain" },
  async (uri) => ({
    contents: [{ uri: uri.href, text: "Returns accepted within 14 days. Free shipping over $50." }],
  })
);

// A prompt: a saved instruction the user picks from a menu
server.registerPrompt(
  "sale-planner",
  {
    title: "Sale planner",
    description: "Compare discount options for a product and recommend one",
    argsSchema: {
      product: z.string().describe("Product name"),
      price: z.string().describe("Original price, for example 2500"),
    },
  },
  ({ product, price }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `I want to put "${product}" (price ${price}) on sale. Use calculate_discount to show the sale price at 10%, 20% and 30% off, then recommend one in a single sentence.`,
      },
    }],
  })
);

await server.connect(new StdioServerTransport());
console.error("learning-server running on stdio"); // stderr, never stdout