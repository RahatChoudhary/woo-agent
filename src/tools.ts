import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  getLowStockProducts, listOrders, searchProducts,
  getCustomerByEmail, updateProductPrice, updateStock,
} from "./wc.ts";

type AgentTool = {
  definition: Anthropic.Tool;
  schema: z.ZodTypeAny;
  isWrite: boolean;
  run: (input: any) => Promise<unknown>;
};

const price = z.string().regex(/^\d+(\.\d{1,2})?$/, "Price must look like 19.99");

export const agentTools: AgentTool[] = [
  {
    definition: {
      name: "get_low_stock_products",
      description: "List products with stock at or below a threshold. Use for low stock, restocking or running-out questions.",
      input_schema: { type: "object", properties: { threshold: { type: "number" } } },
    },
    schema: z.object({ threshold: z.number().int().min(0).max(1000).default(5) }),
    isWrite: false,
    run: ({ threshold }) => getLowStockProducts(threshold),
  },
  {
    definition: {
      name: "list_orders",
      description: "List recent orders, optionally by status: pending, processing, on-hold, completed, cancelled, refunded, failed.",
      input_schema: { type: "object", properties: { status: { type: "string" }, limit: { type: "number" } } },
    },
    schema: z.object({
      status: z.enum(["pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"]).optional(),
      limit: z.number().int().min(1).max(100).default(20),
    }),
    isWrite: false,
    run: ({ status, limit }) => listOrders(status, limit),
  },
  {
    definition: {
      name: "search_products",
      description: "Search products by name or keyword. Use this to find a product's id before updating it.",
      input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
    schema: z.object({ query: z.string().min(1) }),
    isWrite: false,
    run: ({ query }) => searchProducts(query),
  },
  {
    definition: {
      name: "get_customer",
      description: "Look up a customer by exact email address.",
      input_schema: { type: "object", properties: { email: { type: "string" } }, required: ["email"] },
    },
    schema: z.object({ email: z.string().email() }),
    isWrite: false,
    run: ({ email }) => getCustomerByEmail(email),
  },
  {
    definition: {
      name: "update_product_price",
      description: "Change a product's regular price and optionally its sale price. Requires the product id. The user must confirm.",
      input_schema: {
        type: "object",
        properties: { id: { type: "number" }, regular_price: { type: "string" }, sale_price: { type: "string" } },
        required: ["id", "regular_price"],
      },
    },
    schema: z.object({ id: z.number().int().positive(), regular_price: price, sale_price: price.optional() }),
    isWrite: true,
    run: ({ id, regular_price, sale_price }) => updateProductPrice(id, regular_price, sale_price),
  },
  {
    definition: {
      name: "update_stock",
      description: "Set a product's stock quantity. Requires the product id. The user must confirm.",
      input_schema: {
        type: "object",
        properties: { id: { type: "number" }, quantity: { type: "number" } },
        required: ["id", "quantity"],
      },
    },
    schema: z.object({ id: z.number().int().positive(), quantity: z.number().int().min(0).max(100000) }),
    isWrite: true,
    run: ({ id, quantity }) => updateStock(id, quantity),
  },
];

export const toolDefinitions = agentTools.map((t) => t.definition);
export const findTool = (name: string) => agentTools.find((t) => t.definition.name === name);