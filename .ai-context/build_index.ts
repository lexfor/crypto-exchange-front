import fs from "fs";
import path from "path";
import fg from "fast-glob";
import ollama from "ollama";
import crypto from "crypto";
import {Chunk, Config, IndexFile} from "./types/index.js";

const ROOT = process.cwd();
const INDEX_DIR = path.join(ROOT, ".ai-context");
const INDEX_PATH = path.join(INDEX_DIR, "index.json");
const CONFIG_PATH = path.join(INDEX_DIR, "config.json");

function loadConfig(): Config {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

function sha1(s: string) {
    return crypto.createHash("sha1").update(s).digest("hex");
}

function splitToChunks(text: string, maxChars: number, overlap: number): { text: string; startLine: number; endLine: number }[] {
    const lines = text.split(/\r?\n/);
    const chunks: { text: string; startLine: number; endLine: number }[] = [];

    let i = 0;
    while (i < lines.length) {
        let cur: string[] = [];
        let len = 0;
        const startLine = i + 1;

        while (i < lines.length && len + lines[i].length < maxChars) {
            cur.push(lines[i]);
            len += lines[i].length + 1;
            i++;
        }
        let endLine = i;

        if (overlap > 0 && i < lines.length) {
            const back = Math.floor(overlap / 80);
            i = Math.max(i - back, 0);
        }

        if (cur.length) {
            chunks.push({ text: cur.join("\n"), startLine, endLine });
        } else {
            chunks.push({ text: lines[i], startLine, endLine: i + 1 });
            i++;
        }
    }
    return chunks;
}

async function embedText(model: string, text: string): Promise<number[]> {
    const res = await ollama.embeddings({ model, prompt: text });
    return res.embedding;
}

async function main() {
    if (!fs.existsSync(INDEX_DIR)) {
        fs.mkdirSync(INDEX_DIR, { recursive: true })
    }
    const config = loadConfig();

    const files = await fg(config.includeGlobs, { ignore: config.ignoreGlobs, dot: true });
    if (!files.length) {
        console.log("No files to index.");
        process.exit(0);
    }

    const chunks: Chunk[] = [];
    let dim = -1;

    for (const file of files) {
        const filePath = path.join(ROOT, file);
        if (!fs.existsSync(filePath) || fs.lstatSync(filePath).isDirectory()) {
            continue;
        }

        const raw = fs.readFileSync(filePath, "utf-8");
        const fileChunks = splitToChunks(raw, config.chunkMaxChars, config.chunkOverlapChars);

        for (const chunk of fileChunks) {
            const id = sha1(`${file}:${chunk.startLine}-${chunk.endLine}:${sha1(chunk.text)}`);
            const vector = await embedText(config.embedModel, chunk.text);
            if (dim < 0) dim = vector.length;

            chunks.push({
                id,
                file,
                startLine: chunk.startLine,
                endLine: chunk.endLine,
                text: chunk.text,
                hash: sha1(chunk.text),
                vector
            });
        }
    }

    const indexData: IndexFile = {
        version: 1,
        embedModel: config.embedModel,
        dim,
        createdAt: new Date().toISOString(),
        chunks
    };

    fs.writeFileSync(INDEX_PATH, JSON.stringify(indexData, null, 2), "utf-8");
    console.log(`Indexed ${chunks.length} chunks → ${INDEX_PATH}`);
}

main().catch((e) => {
    console.error("Indexing failed:", e);
    process.exit(1);
});
