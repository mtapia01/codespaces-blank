// MD 変換対象のファイルパス
import * as fs from "node:fs"
import * as path from "node:path"

import matter from "gray-matter"
import hljs from "highlight.js"
import { Marked } from "marked"
import { markedHighlight } from "marked-highlight"

const EXTENSION = ".md"
const SRC_PATH = "src"
const OUT_BASE_PATH = "pages"
const PAGES_PATHS = ["sc-problems"]
const API_JSON_PATH = "public/api/sc-problems.json"

const marked = new Marked(
    {
        gfm: true,
    },
    markedHighlight({
        langPrefix: "hljs language-",
        highlight(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : "plaintext"

            return hljs.highlight(code, { language }).value
        },
    }),
)

const lookupPages = (): { [basePath: string]: { [pageName: string]: string } } => {
    console.log("Lookup pages...")

    const pages: { [basePath: string]: { [pageName: string]: string } } = {}

    for (const categoryBasePath of PAGES_PATHS) {
        const fullPath = `${SRC_PATH}/${categoryBasePath}`
        const files = fs.readdirSync(fullPath)

        for (const file of files) {
            const filePath = `${fullPath}/${file}`
            const fileStat = fs.statSync(filePath)

            if (fileStat.isFile() && file.endsWith(EXTENSION)) {
                const pageName = file.replace(EXTENSION, "")
                const pageContent = fs.readFileSync(filePath, "utf8")

                // まだページがない場合は初期化
                if (!Object.prototype.hasOwnProperty.call(pages, categoryBasePath)) {
                    pages[categoryBasePath] = {}
                }

                pages[categoryBasePath][pageName] = pageContent
            }
        }
    }

    return pages
}

interface ProblemAnswer {
    type: "text" | "select"
    answer: string
    explanation: string

    choices?: string[]
    maxLength?: number
}

interface Problem {
    id: string
    answer?: ProblemAnswer
    nest?: Problem[]
}

interface ProblemPage {
    identifier: string
    category: string

    title: string
    tags: string[]
    topic: string
    description: string
    date: string
    difficulty: "easy" | "normal" | "hard" | "experimental" | "draft"
    problems: Problem[]

    rawContent: string
    renderedContent: string
}

const getAnswerBox = (answer: ProblemAnswer) => {
    const random = Math.floor(Math.random() * 1_000_000)

    const openAnswerBox = `
<div class="answer">
    <button class="btn-open-answer" onclick="document.getElementById('answer-${random}').classList.toggle('answer-hidden')">解答・解説を表示</button>
    <div id="answer-${random}" class="answer-hidden">
        <h5>回答例</h5>
        <blockquote>
        ${answer.answer}
        </blockquote>
        <h5>解説</h5>
        <blockquote>
        ${marked.parse(answer.explanation) as string}
        </blockquote>
    </div>
</div>
`

    if (answer.type === "text") {
        return `
<div class="answer-box answer-text" data-answer-id="${random}">
    <div class="answer-input">
        <h3>回答（長文, ${answer.maxLength!}文字以内）</h3>
        <textarea rows="5" data-max-length="${answer.maxLength}" oninput="this.nextElementSibling.innerText = this.value.length + ' / ' + this.getAttribute('data-max-length')"></textarea>
        <span class="answer-text-length">0 / ${answer.maxLength}</span>
    </div>
    ${openAnswerBox}
</div>
`
    } else {
        return `
<div class="answer-box answer-select" data-answer-id="${random}">
    <div class="answer-input">
        <h3>回答（選択肢）</h3>
        <select>
            ${answer.choices!.map((choice) => `<option>${choice}</option>`).join("")}
        </select>
    </div>
    ${openAnswerBox}
</div>
`
    }
}

const convertOnePage = (category: string, identifier: string, pageContent: string): ProblemPage => {
    // grayMatter で front matter を取り出す。
    const grayMatter = matter(pageContent)
    const rawContent = grayMatter.content
    const metaData = grayMatter.data
    // メタデータの取り出し
    const title = (metaData.title ?? "No title") as string
    const tags = (metaData.tags ?? []) as string[]
    const topic = (metaData.topic ?? "No topic") as string
    const problems = (metaData.problems ?? []) as Problem[]
    const description = (metaData.description ?? cropDescription(rawContent)) as string
    const date = (metaData.date ?? "Unknown date") as string
    const difficulty = (metaData.difficulty ?? "normal") as "easy" | "normal" | "hard" | "experimental" | "draft"
    // Markdown をパースして HTML に変換
    const renderedContent = marked.parse(rawContent)

    return <ProblemPage>{
        identifier,
        category,
        title,
        tags,
        topic,
        description,
        date,
        difficulty,
        problems,
        rawContent,
        renderedContent,
    }
}

const cropDescription = (content: string, defaultLines: number = 30) => {
    const DESCRIPTION_CROP_LIMIT = "<!--more-->"
    const lines = content.split("\n")
    const hasCropLimit = lines.includes(DESCRIPTION_CROP_LIMIT)

    let description = ""

    for (const [i, line_] of lines.entries()) {
        const line = line_.replaceAll(/\s/g, "")
        // クロップ制限がある場合はそれを超えたら終了。ない場合は, defaultLines で終了
        const shouldStop = (hasCropLimit && line === DESCRIPTION_CROP_LIMIT) || i === defaultLines

        if (shouldStop) {
            break
        }

        description += `${line_}\n`
    }

    return description
}

const loadTemplates = (basePaths: string[]): { [basePath: string]: string } => {
    // basePath/template.html を読み込む
    const templates: { [basePath: string]: string } = {}

    for (const basePath of basePaths) {
        const templatePath = `${SRC_PATH}/${basePath}/template.html`

        templates[basePath] = fs.readFileSync(templatePath, "utf8")
    }

    return templates
}

const renderPage = (page: ProblemPage, templateContent: string): string => {
    console.log(`Rendering ${page.identifier}...`)

    const { body, problems } = splitSectionsBetweenProblem(page.renderedContent)

    const wellReplaced = templateContent
        .replaceAll("{{title}}", page.title)
        .replaceAll("{{tags}}", page.tags.join(" "))
        .replaceAll("{{topic}}", page.topic)
        .replaceAll("{{description}}", page.description)
        .replaceAll("{{date}}", page.date)
        .replaceAll("{{content}}", body)
        .replaceAll("{{problems}}", problems)

    return renderAnswerBoxes(page, wellReplaced)
}

const renderAnswerBoxes = (problems: ProblemPage, target: string) => {
    // <!--problem-answer <id>--> で囲まれた部分を answer box に変換する
    const answerPattern = /<!--problem-answer\s(.+)-->/g
    const answerMatches = target.matchAll(answerPattern)

    let replaced = target

    for (const match of answerMatches) {
        const problem = problems.problems.find((p) => String(p.id) === match[1])

        if (!problem || !problem.answer) {
            console.error(`Problem ${match[1]} not found.`)

            continue
        }

        const answerBox = getAnswerBox(problem.answer)

        replaced = replaced.replace(match[0], answerBox)
    }

    return replaced
}

const splitSectionsBetweenProblem = (content: string): { body: string; problems: string } => {
    const sections = content.split("<!--problems-->")

    if (sections.length < 2) {
        return { body: content, problems: "" }
    }

    return { body: sections[0], problems: sections[1] }
}

const writeApiJson = (pages: ProblemPage[]) => {
    const apiJson = pages.map((page) => {
        return {
            identifier: page.identifier,
            title: page.title,
            tags: page.tags,
            topic: page.topic,
            description: page.description,
            date: page.date,
            difficulty: page.difficulty,
        }
    })

    const apiJsonPath = path.join(SRC_PATH, API_JSON_PATH)

    console.log(`Writing ${apiJsonPath}...`)
    fs.writeFileSync(apiJsonPath, JSON.stringify(apiJson, undefined, 2))
}

const main = () => {
    console.log("Loading markdown pages...")

    const pages = lookupPages()
    const templates = loadTemplates(PAGES_PATHS)

    console.log(`Found ${Object.keys(pages).length} pages.`)
    console.log("Rendering markdown pages...")

    const renderedMarkdowns: ProblemPage[] = []

    for (const basePath in pages) {
        for (const pageName in pages[basePath]) {
            const pageContent = pages[basePath][pageName]
            const page = convertOnePage(basePath, pageName, pageContent)

            renderedMarkdowns.push(page)
        }
    }

    console.log("Rendering HTML pages...")

    for (const page of renderedMarkdowns) {
        const template = templates[page.category]
        const renderedPage = renderPage(page, template)
        const outPath = path.join(SRC_PATH, OUT_BASE_PATH, page.category, `${page.identifier}.html`)

        console.log(`Writing ${outPath}...`)
        // 親ディレクトリがない場合は作成
        fs.mkdirSync(path.dirname(outPath), { recursive: true })
        fs.writeFileSync(outPath, renderedPage)
    }

    writeApiJson(renderedMarkdowns)

    console.log("Done.")
}

main()
