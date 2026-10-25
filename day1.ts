import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from .env
const MODEL = "claude-sonnet-5-5";

// 1. Describe the tool to Claude
const tools: Anthropic.Tool[] = [
  {
    name: "get_weather",
    description:
      "Get the current weather for a city. Use this whenever the user asks about weather or temperature.",
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name, for example Islamabad" },
      },
      required: ["city"],
    },
  },
];

// 2. The real function (fake data for now)
function getWeather(input: { city: string }): string {
  const data: Record<string, string> = {
    Islamabad: "24°C, sunny",
    Lahore: "29°C, hazy",
  };
  return data[input.city] ?? `No weather data for ${input.city}`;
}

// 3. Start the conversation
const messages: Anthropic.MessageParam[] = [
  { role: "user", content: "What's the weather in Islamabad and Lahore?" },
];

const first = await client.messages.create({ model: MODEL, max_tokens: 1024, tools, messages });
console.log("stop_reason:", first.stop_reason); // expect "tool_use"

// 4. Keep Claude's turn in the history, then run each requested tool
messages.push({ role: "assistant", content: first.content });

const toolResults: Anthropic.ToolResultBlockParam[] = [];
for (const block of first.content) {
  if (block.type === "tool_use") {
    console.log("Claude asked for:", block.name, block.input);
    toolResults.push({
      type: "tool_result",
      tool_use_id: block.id,
      content: getWeather(block.input as { city: string }),
    });
  }
}
messages.push({ role: "user", content: toolResults });

// 5. Send results back and get the final answer
const second = await client.messages.create({ model: MODEL, max_tokens: 1024, tools, messages });
const text = second.content.find((b) => b.type === "text");
console.log("\nClaude:", text?.type === "text" ? text.text : "");