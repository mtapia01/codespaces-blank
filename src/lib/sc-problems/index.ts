const problemsAPI = "/api/sc-problems.json"

interface ProblemPage {
    identifier: string

    title: string
    tags: string[]
    topic: string
    description: string
    date: string
    difficulty: "easy" | "normal" | "hard" | "experimental" | "draft"
}

const DIFFICULTY_DISPLAY: { [key: string]: string } = {
    easy: "かんたん",
    normal: "ふつう",
    hard: "むずかしい",
    experimental: "実験的",
    draft: "ドラフト",
}

const formatDate = (date: string): string => {
    const dateObj = new Date(date)
    const year = dateObj.getFullYear()
    const month = dateObj.getMonth() + 1
    const day = dateObj.getDate()

    return `${year}/${month}/${day}`
}

const createProblemElementHTML = (problem: ProblemPage): string => {
    return `
    <div class="problem-info">
        <h3><span class="difficulty d-${problem.difficulty}">${DIFFICULTY_DISPLAY[problem.difficulty]}</span> 
            <a href="/sc-problems/${problem.identifier}">${problem.title}</a><span class="date"> - (${formatDate(problem.date)})</span></h3>
        <p>タグ：${problem.tags.join(", ")}</p>
        <p>${problem.description}</p>
   </div>
    `
}

const displayProblems = (domElement: Element) => {
    fetch(problemsAPI)
        .then(async (response) => response.json())
        .then((data) => {
            const problems = data as ProblemPage[]

            for (const html of problems.map((problem) => createProblemElementHTML(problem)))
                domElement.insertAdjacentHTML("beforeend", html)
        })
        .catch((error) => {
            console.error(error)
        })
}

const load = () => {
    const problemsElement = document.querySelector("#problems")

    if (problemsElement) {
        displayProblems(problemsElement)
    }
}

window.addEventListener("load", load)
