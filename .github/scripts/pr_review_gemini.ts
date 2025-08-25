import { Octokit } from "@octokit/rest";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

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

function tryParseJson(text: string): any | null {
    try {
        return JSON.parse(text);
    } catch {
        const comment = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (comment) {
            try {
                return JSON.parse(comment[1]);
            } catch {}
        }
    }
    return null;
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
    const generalPerFile: string[] = [];
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Filter files with patches
    const filesWithPatches = files.filter((file: GitHubFile) => file.patch);
    
    if (filesWithPatches.length === 0) {
        console.log("No files with patches to review.");
        return;
    }

    // Create a single prompt with all files
    const filesContent = filesWithPatches.map((file: GitHubFile) => 
        `### ${file.filename}\n\`\`\`diff\n${file.patch}\n\`\`\``
    ).join('\n\n');

    const prompt = `
You are an experienced code reviewer. Analyze all the diffs below and return STRICTLY JSON.
Consider the context of all changes across all files to provide comprehensive feedback.
Be concise and to the point. Also check for typos and errors.

IMPORTANT: For inline comments, line numbers must refer to the lines in the MODIFIED file (new version), not the original file. Look at the diff context to determine the correct line numbers in the new file.

Return format:
{
  "files": [
    {
      "filename": "file1.js",
      "inline": [ { "line": <number>, "comment": "<text>" }, ... ],
      "general": [ "<text1>", "<text2>" ]
    },
    {
      "filename": "file2.js", 
      "inline": [ { "line": <number>, "comment": "<text>" }, ... ],
      "general": [ "<text1>", "<text2>" ]
    }
  ]
}

Files to review:
${filesContent}
    `.trim();

    let rawText: string;
    let data: ReviewResponse | any;
    try {
        const res = await model.generateContent(prompt);
        rawText = res.response.text().trim();
        data = tryParseJson(rawText);
    } catch (e) {
        generalPerFile.push(
            `### All Files\nFailed to get structured response.\n\n<details><summary>Raw output</summary>\n\n${String(e)}\n\n</details>`
        );
        console.log(
            `✅ Done. Inline: no, General: ${generalPerFile.length ? "yes" : "no"}`
        );
        return;
    }

    // Process the response
    if (data && data.files && Array.isArray(data.files)) {
        for (const fileReview of data.files) {
            if (!fileReview.filename) continue;
            
            const file = filesWithPatches.find((f: GitHubFile) => f.filename === fileReview.filename);
            if (!file) continue;

            let inline: InlineComment[] = [];
            let general: string[] = [];

            if (Array.isArray(fileReview.inline)) {
                inline = fileReview.inline.filter(
                    (x: any) => x && typeof x.line === "number" && x.comment
                );
            }
            if (Array.isArray(fileReview.general)) {
                general = fileReview.general.filter((x: any) => typeof x === "string" && x.trim());
            }

            if (general.length) {
                const bullets = general.map((t) => `- ${t}`).join("\n");
                generalPerFile.push(`### ${file.filename}\n${bullets}`);
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
                    console.error(`   Full error:`, err);
                }
            }
        }
    } else {
        // Fallback: treat response as general comment for all files
        generalPerFile.push(`### All Files\n${rawText}`);
    }

    if (generalPerFile.length) {
        const body = `🤖 Gemini Review — general remarks:\n\n${generalPerFile.join("\n\n")}`;
        await octokit.issues.createComment({ owner, repo, issue_number: prNumber, body });
    }

    console.log(
        `✅ Done. Inline: ${hasInlineComments ? "yes" : "no"}, General: ${
            generalPerFile.length ? "yes" : "no"
        }`
    );
}

run().catch((err) => {
    console.error("❌ Execution error:", err);
    process.exit(1);
});
