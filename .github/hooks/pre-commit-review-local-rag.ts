import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import ollama from "ollama";
import { retrieveForDiff } from "../../.ai-context/retrieve.js";
import {ReviewConfig} from "../../.ai-context/types/index.js";

const CONFIG_PATH = path.join(process.cwd(), ".ai-context", "config.json");

function loadConfig(): ReviewConfig {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    return {
        llmModel: raw.llmModel,
        blockOnSeverities: raw.blockOnSeverities,
        maxPromptChars: raw.maxPromptChars
    };
}

function strictPrompt(context: string, diff: string) {
    return `
You are a strict code reviewer. Use the provided CONTEXT (read-only) to understand the project.
Review ONLY the DIFF and produce ONLY valid JSON. No text outside JSON. No markdown. No comments.
Pay attention to typos, bugs, security, performance, architecture, best practices, and style.
Add summary about all changed code at the end.

Schema (strict):
{
  "inlineComments": [
    { "file": string, "line": number, "comment": string, "severity": "blocker" | "warning" | "nit", code: string }
  ],
  "generalComments": [string]
}

Guidelines:
- "line" must be the line number on the NEW file (the "+++" side) when possible.
- Keep comments concise and actionable.
- Use "blocker" only for correctness/security/build issues; "warning" for risky patterns; "nit" for style.
- In quotes provide which exactly code you refer to.

CONTEXT:
${context}

DIFF:
${diff}

Return JSON now:
`.trim();
}

function extractJSON(input: string): any | null {
    const match = input.match(/\{[\s\S]*\}$/m);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
}

async function callLLM(model: string, prompt: string, retries = 2): Promise<any | null> {
    for (let i = 0; i <= retries; i++) {
        const res = await ollama.generate({ model, prompt });
        const txt = res.response.trim();
        const parsed = extractJSON(txt);
        if (parsed) return parsed;
    }
    return null;
}

function formatContexts(chunks: {file: string; startLine: number; endLine: number; text: string;}[], maxChars: number) {
    let out = "";
    for (const ch of chunks) {
        const header = `FILE: ${ch.file} [${ch.startLine}-${ch.endLine}]`;
        const body = ch.text;
        const block = `${header}\n${body}\n---\n`;
        if (out.length + block.length > maxChars) break;
        out += block;
    }
    return out;
}

async function main() {
    const config = loadConfig();

    const diffRaw = execSync("git diff --cached", { encoding: "utf-8" });
    if (!diffRaw) {
        console.log("✅ No staged changes.");
        process.exit(0);
    }

    const contexts = await retrieveForDiff(diffRaw);
    const contextText = formatContexts(contexts, Math.floor(config.maxPromptChars * 0.7));

    if (!contextText) {
        console.warn("⚠️ No RAG context found. Did you build the index? (npm run ai:index)");
    }

    const diffText = diffRaw.slice(0, Math.floor(config.maxPromptChars));

    const prompt = strictPrompt(contextText, diffText);
    const json = await callLLM(config.llmModel, prompt, 2);

    if (!json) {
        console.error("❌ Local model did not return valid JSON. Aborting commit.");
        process.exit(1);
    }

    const inline = Array.isArray(json.inlineComments) ? json.inlineComments : [];
    const general = Array.isArray(json.generalComments) ? json.generalComments : [];

    if (general.length) {
        console.log("\n📋 General comments:");
        for (const g of general) console.log(` - ${g}`);
    }

    if (inline.length) {
        console.log("\n📌 Inline comments:");
        for (const r of inline) {
            console.log(` - ${r.file}:${r.line} [${r.severity}] → ${r.comment} (${r.code})`);
        }
    }

    const hasBlocker = inline.some((r: any) => config.blockOnSeverities.includes(r.severity));
    if (hasBlocker) {
        console.log("\n⛔ Blockers found. Commit aborted.");
        process.exit(1);
    }

    console.log("\n✅ AI review passed. Proceeding with commit.");
    process.exit(0);
}

main().catch((e) => {
    console.error("Unexpected error:", e);
    process.exit(1);
});
