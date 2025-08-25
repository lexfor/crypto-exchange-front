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

type ReviewResponse = {
    inline?: InlineComment[];
    general?: string[];
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

    for (const file of files) {
        if (!file.patch) continue;

        const prompt = `
Ты опытный code reviewer. Проанализируй diff и верни СТРОГО JSON.
Учитывай контекст всех изменений. (не только этого файла, а всех измененых)
Коротко и по делу. Также проверяй на опечатки и описки
Формат:
{
  "inline": [ { "line": <number>, "comment": "<text>" }, ... ],
  "general": [ "<text1>", "<text2>" ]
}

Файл: ${file.filename}
Изменения:
\`\`\`diff
${file.patch}
\`\`\`
    `.trim();

        let rawText: string;
        let data: ReviewResponse | any;
        try {
            const res = await model.generateContent(prompt);
            rawText = res.response.text().trim();
            data = tryParseJson(rawText);
        } catch (e) {
            generalPerFile.push(
                `### ${file.filename}\nНе удалось получить структурированный ответ.\n\n<details><summary>Сырая выдача</summary>\n\n${String(e)}\n\n</details>`
            );
            continue;
        }

        let inline: InlineComment[] = [];
        let general: string[] = [];

        if (Array.isArray(data)) {
            inline = data.filter(
                (x: any) => x && typeof x.line === "number" && x.comment
            );
            general = data
                .filter((x: any) => x && !x.line && x.comment)
                .map((x: any) => x.comment);
        } else if (data && typeof data === "object") {
            if (Array.isArray(data.inline)) {
                inline = data.inline.filter(
                    (x: any) => x && typeof x.line === "number" && x.comment
                );
            }
            if (Array.isArray(data.general)) {
                general = data.general.filter((x: any) => typeof x === "string" && x.trim());
            }
        } else {
            generalPerFile.push(`### ${file.filename}\n${rawText}`);
            continue;
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
                    `❌ Не удалось оставить inline-комментарий для ${file.filename}#L${specifiedComment.line}:`,
                    err?.response?.data || err.message
                );
            }
        }
    }

    if (generalPerFile.length) {
        const body = `🤖 Gemini Review — общие замечания:\n\n${generalPerFile.join("\n\n")}`;
        await octokit.issues.createComment({ owner, repo, issue_number: prNumber, body });
    }

    console.log(
        `✅ Готово. Inline: ${hasInlineComments ? "да" : "нет"}, Общие: ${
            generalPerFile.length ? "да" : "нет"
        }`
    );
}

run().catch((err) => {
    console.error("❌ Ошибка выполнения:", err);
    process.exit(1);
});
