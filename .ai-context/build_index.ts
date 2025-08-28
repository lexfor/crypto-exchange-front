import fs from "fs";
import path from "path";
import fg from "fast-glob";
import ollama from "ollama";
import crypto from "crypto";
import { Chunk, Config, IndexFile } from "./types/index.js";
import {
    AI_CONTEXT_DIR,
    CONFIG_FILENAME,
    INDEX_FILENAME,
    FILE_ENCODING,
    JSON_INDENT,
    LINE_SPLIT_PATTERN,
    INDEX_VERSION,
    MESSAGES
} from "./constants.js";

const ROOT_DIR = process.cwd();
const INDEX_DIR = path.join(ROOT_DIR, AI_CONTEXT_DIR);
const INDEX_PATH = path.join(INDEX_DIR, INDEX_FILENAME);
const CONFIG_PATH = path.join(INDEX_DIR, CONFIG_FILENAME);

/**
 * Custom error class for indexing related errors
 */
class IndexingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'IndexingError';
    }
}

/**
 * Loads indexing configuration from JSON file
 * @returns {Config} Configuration object with indexing settings
 * @throws {IndexingError} If config file is missing or invalid
 */
function loadConfig(): Config {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            throw new IndexingError(`Configuration file not found at ${CONFIG_PATH}`);
        }
        return JSON.parse(fs.readFileSync(CONFIG_PATH, FILE_ENCODING));
    } catch (error) {
        if (error instanceof IndexingError) throw error;
        throw new IndexingError(`Failed to parse configuration: ${error.message}`);
    }
}

/**
 * Creates a SHA-1 hash from a string
 * @param {string} input - Input string to hash
 * @returns {string} SHA-1 hash as hex string
 */
function sha1(input: string): string {
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
    const lines = sourceText.split(LINE_SPLIT_PATTERN);
    const chunks: { text: string; startLine: number; endLine: number }[] = [];

    let currentLine = 0;
    while (currentLine < lines.length) {
        let currentChunk: string[] = [];
        let chunkLength = 0;
        const startLine = currentLine + 1;

        while (currentLine < lines.length && chunkLength + lines[currentLine].length < maxChars) {
            currentChunk.push(lines[currentLine]);
            chunkLength += lines[currentLine].length + 1;
            currentLine++;
        }
        let endLine = currentLine;

        if (overlap > 0 && currentLine < lines.length) {
            const overlapLines = Math.floor(overlap / 80);
            currentLine = Math.max(currentLine - overlapLines, 0);
        }

        if (currentChunk.length) {
            chunks.push({ text: currentChunk.join("\n"), startLine, endLine });
        } else if (currentLine < lines.length) {
            chunks.push({ text: lines[currentLine], startLine: currentLine + 1, endLine: currentLine + 1 });
            currentLine++;
        }
    }
    return chunks;
}

/**
 * Gets embeddings for text using the model
 * @param {string} modelName - Model name for creating embeddings
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Embedding vector
 * @throws {Error} If embedding generation fails
 */
async function embedText(modelName: string, text: string): Promise<number[]> {
    try {
        const response = await ollama.embeddings({ model: modelName, prompt: text });

        if (!response || !Array.isArray(response.embedding)) {
            throw new Error('Invalid embedding response from model');
        }

        return response.embedding;
    } catch (error) {
        throw new Error(`Failed to generate embeddings: ${error.message}`);
    }
}

/**
 * Main function that creates the index for RAG system
 */
async function main() {
    try {
        if (!fs.existsSync(INDEX_DIR)) {
            fs.mkdirSync(INDEX_DIR, { recursive: true });
        }

        const config = loadConfig();
        const files = await fg(config.includeGlobs, { ignore: config.ignoreGlobs, dot: true });

        if (!files.length) {
            console.log(MESSAGES.NO_FILES_TO_INDEX);
            process.exit(0);
        }

        const chunks: Chunk[] = [];
        let embeddingDimension = -1;

        for (const file of files) {
            const filePath = path.join(ROOT_DIR, file);

            try {
                const stats = fs.lstatSync(filePath);
                if (!stats.isFile()) continue;

                const fileContent = fs.readFileSync(filePath, FILE_ENCODING);
                const fileChunks = splitToChunks(fileContent, config.chunkMaxChars, config.chunkOverlapChars);

                for (const chunk of fileChunks) {
                    const chunkId = sha1(`${file}:${chunk.startLine}-${chunk.endLine}:${sha1(chunk.text)}`);
                    const vector = await embedText(config.embedModel, chunk.text);

                    if (embeddingDimension === -1) {
                        embeddingDimension = vector.length;
                    } else if (vector.length !== embeddingDimension) {
                        throw new IndexingError(`Inconsistent embedding dimensions: ${vector.length} vs ${embeddingDimension}`);
                    }

                    chunks.push({
                        id: chunkId,
                        file,
                        startLine: chunk.startLine,
                        endLine: chunk.endLine,
                        text: chunk.text,
                        hash: sha1(chunk.text),
                        vector
                    });
                }
            } catch (error) {
                console.warn(`Failed to process file ${file}: ${error.message}`);
            }
        }

        const indexData: IndexFile = {
            version: INDEX_VERSION,
            embedModel: config.embedModel,
            dim: embeddingDimension,
            createdAt: new Date().toISOString(),
            chunks
        };

        fs.writeFileSync(INDEX_PATH, JSON.stringify(indexData, null, JSON_INDENT), FILE_ENCODING);
        console.log(`Indexed ${chunks.length} chunks → ${INDEX_PATH}`);
    } catch (error) {
        console.error(MESSAGES.INDEXING_FAILED, error.message);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error(MESSAGES.INDEXING_FAILED, error.message);
    process.exit(1);
});
