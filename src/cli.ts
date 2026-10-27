import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import Anthropic from "@anthropic-ai/sdk";
import { runTurn } from "./agent.ts";

const rl = readline.createInterface({ input, output });
const messages: Anthropic.MessageParam[] = []; // conversation memory

const confirm = async (summary: string) => {
  const answer = await rl.question(`\n⚠ Approve change? ${summary} (y/n) `);
  return answer.trim().toLowerCase() === "y";
};

console.log('Store assistant ready. Type "exit" to quit.\n');
while (true) {
  const question = await rl.question("You: ");
  if (question.trim().toLowerCase() === "exit") break;
  const answer = await runTurn(messages, question, confirm);
  console.log(`\nAssistant: ${answer}\n`);
}
rl.close();