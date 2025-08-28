import fs from "fs";
import path from "path";
import fg from "fast-glob";
import ollama from "ollama";
import crypto from "crypto";
import {Chunk, Config, IndexFile} from "./types/index.js";

const ROOT_DIR = process.cwd();
const INDEX_DIR = path.join(ROOT_DIR, ".ai-context");
const INDEX_PATH = path.join(INDEX_DIR, "index.json");
const CONFIG_PATH = path.join(INDEX_DIR, "config.json");

/**
 * Loads indexing configuration from JSON file
 * @returns {Config} Configuration object with indexing settings
 */
function loadConfig(): Config {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

/**
 * Creates a SHA-1 hash from a string
 * @param {string} input - Input string to hash
 * @returns {string} SHA-1 hash as hex string
 */
function sha1(input: string) {
    return crypto.createHash("sha1").update(input).digest("hex");
}

/**
 * Splits text into overlapping chunks considering maximum size
 * @param {string} sourceText - Source text to split
 * @param {number} maxChars - Maximum characters per chunk
 * @param {number} overlap - Number of characters to overlap between chunks
 * @returns {Array<{text: string, startLine: number, endLine: number}>} Array of chunks with their positions
 */
function splitToChunks(sourceText: string, maxChars: number, overlap: number): { text: string; startLine: number; endLine: number }[] {
    const lines = sourceText.split(/\r?\n/);
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

/**
 * Gets embeddings for text using the model
 * @param {string} modelName - Model name for creating embeddings
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Embedding vector
 */
async function embedText(modelName: string, text: string): Promise<number[]> {
    const res = await ollama.embeddings({ model: modelName, prompt: text });
    return res.embedding;
}

/**
 * Main function that creates the index for RAG system
 */
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
        const filePath = path.join(ROOT_DIR, file);
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
