import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import ollama from "ollama";
import { retrieveForDiff } from "../../.ai-context/retrieve.js";
import { ReviewConfig } from "../../.ai-context/types/index.js";
import {
    AI_CONTEXT_DIR,
    CONFIG_FILENAME,
    FILE_ENCODING,
    JSON_PATTERN,
    MESSAGES,
    GIT_COMMANDS,
    CONTEXT_SIZE_RATIO
} from "../../.ai-context/constants.js";

const CONFIG_PATH = path.join(process.cwd(), AI_CONTEXT_DIR, CONFIG_FILENAME);

/**
 * Custom error class for review related errors
 */
class ReviewError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ReviewError';
    }
}

/**
 * Loads configuration for AI reviewer from JSON file
 * @returns {ReviewConfig} Configuration object with model settings and check parameters
 * @throws {ReviewError} If config file is missing or invalid
 */
function loadConfig(): ReviewConfig {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            throw new ReviewError(`Configuration file not found at ${CONFIG_PATH}`);
        }
        const configData = JSON.parse(fs.readFileSync(CONFIG_PATH, FILE_ENCODING));
        return {
            llmModel: configData.llmModel,
            blockOnSeverities: configData.blockOnSeverities,
            maxPromptChars: configData.maxPromptChars
        };
    } catch (error) {
        if (error instanceof ReviewError) throw error;
        throw new ReviewError(`Failed to parse configuration: ${error.message}`);
    }
}

/**
 * Creates a prompt for AI reviewer with project context and changes
 * @param {string} projectContext - Project context from index
 * @param {string} codeChanges - Git diff changes
 * @returns {string} Formatted prompt for the model
 */
function createReviewPrompt(projectContext: string, codeChanges: string): string {
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
${projectContext}

DIFF:
${codeChanges}

Return JSON now:
`.trim();
}

/**
 * Extracts JSON from model response
 * @param {string} modelResponse - Response from LLM model
 * @returns {object|null} Parsed JSON or null if error
 */
function extractJSON(modelResponse: string): any | null {
    const jsonMatch = modelResponse.match(JSON_PATTERN);
    if (!jsonMatch) return null;
    try {
        return JSON.parse(jsonMatch[0]);
    } catch {
        return null;
    }
}

/**
 * Makes a request to LLM model with retry capability
 * @param {string} modelName - Model name to use
 * @param {string} prompt - Prompt for the model
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<object|null>} Result in JSON format or null
 * @throws {Error} If all retry attempts fail
 */
async function callLLM(modelName: string, prompt: string, retries: number = 2): Promise<any | null> {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await ollama.generate({ model: modelName, prompt });
            const responseText = response.response.trim();
            const parsedResponse = extractJSON(responseText);
            if (parsedResponse) return parsedResponse;
        } catch (error) {
            if (attempt === retries) {
                throw new Error(`Failed to get response from LLM after ${retries} attempts: ${error.message}`);
            }
            // Wait before retry with exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
    return null;
}

/**
 * Formats found contexts into a single text with size limit
 * @param {Array<{file: string, startLine: number, endLine: number, text: string}>} contextChunks - Context chunks
 * @param {number} maxChars - Maximum number of characters
 * @returns {string} Formatted context text
 */
function formatContexts(contextChunks: {file: string; startLine: number; endLine: number; text: string;}[], maxChars: number): string {
    let formattedContext = "";
    for (const chunk of contextChunks) {
        const chunkHeader = `FILE: ${chunk.file} [${chunk.startLine}-${chunk.endLine}]`;
        const chunkContent = chunk.text;
        const chunkBlock = `${chunkHeader}\n${chunkContent}\n---\n`;
        if (formattedContext.length + chunkBlock.length > maxChars) break;
        formattedContext += chunkBlock;
    }
    return formattedContext;
}

/**
 * Main function that performs AI review of changes
 */
async function main() {
    try {
        const reviewConfig = loadConfig();

        const stagedChanges = execSync(GIT_COMMANDS.STAGED_CHANGES, { encoding: FILE_ENCODING });
        if (!stagedChanges) {
            console.log(MESSAGES.NO_STAGED_CHANGES);
            process.exit(0);
        }

        const relevantContexts = await retrieveForDiff(stagedChanges);
        const formattedContext = formatContexts(relevantContexts, Math.floor(reviewConfig.maxPromptChars * CONTEXT_SIZE_RATIO));

        if (!formattedContext) {
            console.warn(MESSAGES.NO_RAG_CONTEXT);
        }

        const truncatedDiff = stagedChanges.slice(0, Math.floor(reviewConfig.maxPromptChars));
        const reviewPrompt = createReviewPrompt(formattedContext, truncatedDiff);
        const reviewResult = await callLLM(reviewConfig.llmModel, reviewPrompt, 2);

        if (!reviewResult) {
            console.error(MESSAGES.INVALID_JSON);
            process.exit(1);
        }

        const inlineComments = Array.isArray(reviewResult.inlineComments) ? reviewResult.inlineComments : [];
        const generalComments = Array.isArray(reviewResult.generalComments) ? reviewResult.generalComments : [];

        if (generalComments.length) {
            console.log("\n📋 General comments:");
            for (const comment of generalComments) {
                console.log(` - ${comment}`);
            }
        }

        if (inlineComments.length) {
            console.log("\n📌 Inline comments:");
            for (const comment of inlineComments) {
                console.log(` - ${comment.file}:${comment.line} [${comment.severity}] → ${comment.comment} (${comment.code})`);
            }
        }

        const hasBlockingIssues = inlineComments.some((comment: any) =>
            reviewConfig.blockOnSeverities.includes(comment.severity));

        if (hasBlockingIssues) {
            console.log(MESSAGES.BLOCKERS_FOUND);
            process.exit(1);
        }

        console.log(MESSAGES.REVIEW_PASSED);
        process.exit(0);
    } catch (error) {
        console.error(MESSAGES.UNEXPECTED_ERROR, error.message);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error(MESSAGES.UNEXPECTED_ERROR, error.message);
    process.exit(1);
});
