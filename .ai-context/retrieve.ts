import fs from "fs";
import path from "path";
import ollama from "ollama";
import {Config, IndexFile, Chunk} from "./types/index.js";

const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, ".ai-context", "index.json");
const CONFIG_PATH = path.join(ROOT, ".ai-context", "config.json");

/**
 * Loads configuration from config.json file
 * @returns {Config} The configuration object
 */
function loadConfig(): Config {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

/**
 * Loads index data from index.json file
 * @returns {IndexFile} The index object containing chunks data
 */
function loadIndex(): IndexFile {
    return JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
}

/**
 * Calculates the cosine similarity between two vectors
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} Cosine similarity value between -1 and 1
 */
function cosine(a: number[], b: number[]) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

/**
 * Retrieves the most relevant chunks for a given diff text
 * @param {string} diffText - The diff text to analyze
 * @returns {Promise<Chunk[]>} Array of the most relevant chunks sorted by similarity
 */
export async function retrieveForDiff(diffText: string) {
    const config = loadConfig();
    const index = loadIndex();

    const embeddingResult = await ollama.embeddings({ model: config.embedModel, prompt: diffText });
    const queryVector = embeddingResult.embedding as number[];

    const scoredChunks = index.chunks
        .map((chunk: Chunk) => ({ chunk, score: cosine(queryVector, chunk.vector) }))
        .sort((a: {chunk: Chunk, score: number}, b: {chunk: Chunk, score: number}) => b.score - a.score)
        .slice(0, config.topK);

    return scoredChunks.map((s: {chunk: Chunk, score: number}) => s.chunk);
}
