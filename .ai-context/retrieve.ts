import fs from "fs";
import path from "path";
import ollama from "ollama";
import {Config, IndexFile, Chunk} from "./types/index.js";
import {
    AI_CONTEXT_DIR,
    CONFIG_FILENAME,
    INDEX_FILENAME,
    FILE_ENCODING,
    VECTOR_EPSILON
} from "./constants.js";

const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, AI_CONTEXT_DIR, INDEX_FILENAME);
const CONFIG_PATH = path.join(ROOT, AI_CONTEXT_DIR, CONFIG_FILENAME);

/**
 * Custom error class for configuration related errors
 */
class ConfigurationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConfigurationError';
    }
}

/**
 * Loads configuration from config.json file
 * @returns {Config} The configuration object
 * @throws {ConfigurationError} If config file is missing or invalid
 */
function loadConfig(): Config {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            throw new ConfigurationError(`Configuration file not found at ${CONFIG_PATH}`);
        }
        return JSON.parse(fs.readFileSync(CONFIG_PATH, FILE_ENCODING));
    } catch (error) {
        if (error instanceof ConfigurationError) throw error;
        throw new ConfigurationError(`Failed to parse configuration: ${error.message}`);
    }
}

/**
 * Loads index data from index.json file
 * @returns {IndexFile} The index object containing chunks data
 * @throws {ConfigurationError} If index file is missing or invalid
 */
function loadIndex(): IndexFile {
    try {
        if (!fs.existsSync(INDEX_PATH)) {
            throw new ConfigurationError(`Index file not found at ${INDEX_PATH}`);
        }
        return JSON.parse(fs.readFileSync(INDEX_PATH, FILE_ENCODING));
    } catch (error) {
        if (error instanceof ConfigurationError) throw error;
        throw new ConfigurationError(`Failed to parse index file: ${error.message}`);
    }
}

/**
 * Calculates the cosine similarity between two vectors
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} Cosine similarity value between -1 and 1
 * @throws {Error} If vectors have different lengths
 */
function cosine(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
    }

    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) + VECTOR_EPSILON);
}

/**
 * Retrieves the most relevant chunks for a given diff text
 * @param {string} diffText - The diff text to analyze
 * @returns {Promise<Chunk[]>} Array of the most relevant chunks sorted by similarity
 * @throws {Error} If embedding generation fails or if configuration is invalid
 */
export async function retrieveForDiff(diffText: string): Promise<Chunk[]> {
    try {
        const config = loadConfig();
        const index = loadIndex();

        if (!diffText.trim()) {
            throw new Error('Empty diff text provided');
        }

        const embeddingResult = await ollama.embeddings({
            model: config.embedModel,
            prompt: diffText
        }).catch(error => {
            throw new Error(`Failed to generate embeddings: ${error.message}`);
        });

        const queryVector = embeddingResult.embedding;

        if (!Array.isArray(queryVector) || queryVector.length === 0) {
            throw new Error('Invalid embedding vector received from model');
        }

        const scoredChunks = index.chunks
            .map((chunk: Chunk) => ({
                chunk,
                score: cosine(queryVector, chunk.vector)
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, config.topK);

        return scoredChunks.map(s => s.chunk);
    } catch (error) {
        if (error instanceof ConfigurationError) {
            throw error;
        }
        throw new Error(`Failed to retrieve relevant chunks: ${error.message}`);
    }
}
