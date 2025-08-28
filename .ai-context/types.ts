export type Config = {
    llmModel: string;
    embedModel: string;
    ignoreGlobs: string[];
    includeGlobs: string[];
    chunkMaxChars: number;
    chunkOverlapChars: number;
    topK: number;
    maxContextChunksPerFile: number;
    blockOnSeverities: string[];
    maxPromptChars: number;
};

export type ReviewConfig = Pick<Config, 'llmModel'|'blockOnSeverities'|'maxPromptChars'>

export type Chunk = {
    id: string;
    file: string;
    startLine: number;
    endLine: number;
    text: string;
    hash: string;
    vector: number[];
};

export type IndexFile = {
    version: 1;
    embedModel: string;
    dim: number;
    createdAt: string;
    chunks: Chunk[];
};