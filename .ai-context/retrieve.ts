import fs from "fs";
import path from "path";
import ollama from "ollama";
import {Config, IndexFile} from "./types/index.js";

const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, ".ai-context", "index.json");
const CONFIG_PATH = path.join(ROOT, ".ai-context", "config.json");

function loadConfig(): Config {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

function loadIndex(): IndexFile {
    return JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
}

function cosine(a: number[], b: number[]) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

export async function retrieveForDiff(diffText: string) {
    const config = loadConfig();
    const idx = loadIndex();

    const q = await ollama.embeddings({ model: config.embedModel, prompt: diffText });
    const qv = q.embedding as number[];

    const scored = idx.chunks
        .map(ch => ({ ch, score: cosine(qv, ch.vector) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, config.topK);

    return scored.map(s => s.ch);
}
