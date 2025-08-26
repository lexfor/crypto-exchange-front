import { Octokit } from "@octokit/rest";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string || "");
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN as string});

const [owner, repo] = (process.env.GITHUB_REPOSITORY || "").split("/");
const prNumber = Number(process.env.PR_NUMBER);

type InlineComment = {
    line: number;
    comment: string;
}

type FileReviewResponse = {
    filename: string;
    inline?: InlineComment[];
    general?: string[];
}

type ReviewResponse = {
    files?: FileReviewResponse[];
}

type GitHubFile = {
    filename: string;
    patch?: string;
    [key: string]: any;
}

type DiffLineInfo = {
    newLineNumber: number;
    isAddedLine: boolean;
    content: string;
}

function tryParseJson(text: string): any | null {
    try {
        return JSON.parse(text);
    } catch {
        const comment = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (comment && comment[1]) {
            try {
                return JSON.parse(comment[1]);
            } catch {}
        }
    }
    return null;
}

function parseDiffLines(patch: string): DiffLineInfo[] {
    const lines = patch.split('\n');
    const diffLines: DiffLineInfo[] = [];
    let newLineNumber = 0;

    for (const line of lines) {
        // Parse diff header to get starting line number
        if (line.startsWith('@@')) {
            const match = line.match(/@@ -\d+,?\d* \+(\d+),?\d* @@/);
            if (match) {
                newLineNumber = parseInt(match[1], 10) - 1; // -1 because we'll increment before adding
            }
            continue;
        }

        // Skip file headers
        if (line.startsWith('diff --git') || line.startsWith('index ') ||
            line.startsWith('---') || line.startsWith('+++')) {
            continue;
        }

        // Process content lines
        if (line.startsWith('+')) {
            // Added line
            newLineNumber++;
            diffLines.push({
                newLineNumber,
                isAddedLine: true,
                content: line.substring(1)
            });
        } else if (line.startsWith('-')) {
            // Deleted line - don't increment new line number
            // These lines don't exist in the new file, so we can't comment on them
        } else if (line.startsWith(' ')) {
            // Context line
            newLineNumber++;
            diffLines.push({
                newLineNumber,
                isAddedLine: false,
                content: line.substring(1)
            });
        }
    }

    return diffLines;
}

function validateLineNumber(lineNumber: number, diffLines: DiffLineInfo[]): boolean {
    return diffLines.some(diffLine => diffLine.newLineNumber === lineNumber);
}

function getValidLineNumbers(diffLines: DiffLineInfo[]): number[] {
    return diffLines.map(line => line.newLineNumber);
}

async function run() {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("❌ GEMINI_API_KEY is not set");
    }
    if (!process.env.GITHUB_TOKEN) {
        throw new Error("❌ GITHUB_TOKEN is not set");
    }

    const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number: prNumber });
    const headSha = pr.head.sha;

    const { data: files } = await octokit.pulls.listFiles({ owner, repo, pull_number: prNumber });

    let hasInlineComments = false;
    const fileGeneralComments: string[] = [];
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Filter files with patches
    const filesWithPatches = files.filter((file: GitHubFile) => file.patch);
    
    if (filesWithPatches.length === 0) {
        console.log("No files with patches to review.");
        return;
    }

    // Create a single prompt with all files and valid line numbers
    const filesContentWithLineNumbers = filesWithPatches.map((file: GitHubFile) => {
        if (!file.patch) return `### ${file.filename}\nNo changes to review.`;
        
        const diffLines = parseDiffLines(file.patch);
        const validLines = getValidLineNumbers(diffLines);
        
        return `### ${file.filename}
Valid line numbers for comments: ${validLines.join(', ')}
\`\`\`diff
${file.patch}
\`\`\``;
    }).join('\n\n');

    const prompt = `
You are an experienced code reviewer. Analyze all the diffs below and return STRICTLY JSON.
Consider the context of all changes across all files to provide comprehensive feedback.
Be concise and to the point. Also check for typos and errors.

CRITICAL: For inline comments, you MUST ONLY use line numbers from the "Valid line numbers for comments" list provided for each file. 
These numbers correspond to lines that actually exist in the modified file and can receive comments.
DO NOT use any line numbers not in this list - they will cause errors.

If you want to comment on a specific change but the exact line isn't commentable, either:
1. Use the nearest valid line number, or 
2. Add it as a general comment instead

Return format:
{
  "files": [
    {
      "filename": "file1.extension",
      "inline": [ { "line": <valid_line_number>, "comment": "<text>" }, ... ],
      "general": [ "<text1>", "<text2>" ]
    },
    {
      "filename": "file2.extension", 
      "inline": [ { "line": <valid_line_number>, "comment": "<text>" }, ... ],
      "general": [ "<text1>", "<text2>" ]
    }
  ]
}

Files to review:
${filesContentWithLineNumbers}
    `.trim();

    let rawText: string;
    let data: ReviewResponse | any;
    try {
        const res = await model.generateContent(prompt);
        rawText = res.response.text().trim();
        data = tryParseJson(rawText);
    } catch (e) {
        fileGeneralComments.push(
            `### All Files\nFailed to get structured response.\n\n<details><summary>Raw output</summary>\n\n${String(e)}\n\n</details>`
        );
        console.log(
            `✅ Done. Inline: no, General: ${fileGeneralComments.length ? "yes" : "no"}`
        );
        return;
    }

    // Process the response
    if (data && data.files && Array.isArray(data.files)) {
        for (const fileReview of data.files) {
            if (!fileReview.filename) continue;
            
            const file = filesWithPatches.find((f: GitHubFile) =>
                f.filename === fileReview.filename );
            if (!file || !file.patch) continue;

            // Parse diff to get valid line numbers for this file
            const diffLines = parseDiffLines(file.patch);
            const validLineNumbers = getValidLineNumbers(diffLines);

            let inline: InlineComment[] = [];
            let general: string[] = [];
            const invalidComments: InlineComment[] = [];

            if (Array.isArray(fileReview.inline)) {
                const candidateInline = fileReview.inline.filter(
                    (x: any) => x && typeof x.line === "number" && x.comment
                );

                // Validate line numbers and separate valid from invalid
                for (const comment of candidateInline) {
                    if (validateLineNumber(comment.line, diffLines)) {
                        inline.push(comment);
                    } else {
                        console.warn(
                            `⚠️ Invalid line number ${comment.line} for ${file.filename}. Valid lines: ${validLineNumbers.join(', ')}`
                        );
                        invalidComments.push(comment);
                    }
                }
            }

            if (Array.isArray(fileReview.general)) {
                general = fileReview.general.filter((x: any) => typeof x === "string" && x.trim());
            }

            // Convert invalid inline comments to general comments
            if (invalidComments.length > 0) {
                const invalidCommentsText = invalidComments.map(
                    (c) => `Line ${c.line}: ${c.comment}`
                ).join('\n- ');
                general.push(`Comments for invalid line numbers:\n- ${invalidCommentsText}`);
            }

            if (general.length) {
                const bullets = general.map((t) => `- ${t}`).join("\n");
                fileGeneralComments.push(`### ${file.filename}\n${bullets}`);
            }

            for (const specifiedComment of inline) {
                try {
                    await octokit.pulls.createReviewComment({
                        owner,
                        repo,
                        pull_number: prNumber,
                        commit_id: headSha,
                        path: file.filename,
                        line: specifiedComment.line,
                        side: "RIGHT",
                        body: `🤖 Gemini: ${specifiedComment.comment}`,
                    });
                    hasInlineComments = true;
                } catch (err: any) {
                    console.error(
                        `❌ Failed to leave inline comment for ${file.filename}#L${specifiedComment.line}:`
                    );
                    console.error(`   Comment object:`, JSON.stringify(specifiedComment, null, 2));
                    console.error(`   Error details:`, err?.response?.data || err.message);
                    console.error(`   Valid line numbers for this file:`, validLineNumbers);
                    
                    // Fallback: convert failed inline comment to general comment
                    const fallbackComment = `Failed inline comment for line ${specifiedComment.line}: ${specifiedComment.comment}`;
                    fileGeneralComments.push(`### ${file.filename}\n- ${fallbackComment}`);
                }
            }
        }
    } else {
        // Fallback: treat response as general comment for all files
        fileGeneralComments.push(`### All Files\n${rawText}`);
    }

    if (fileGeneralComments.length) {
        const body = `🤖 Gemini Review — general remarks:\n\n${fileGeneralComments.join("\n\n")}`;
        await octokit.issues.createComment({ owner, repo, issue_number: prNumber, body });
    }

    console.log(
        `✅ Done. Inline: ${hasInlineComments ? "yes" : "no"}, General: ${
            fileGeneralComments.length ? "yes" : "no"
        }`
    );
}

run().catch((err) => {
    console.error("❌ Execution error:", err);
    process.exit(1);
});
