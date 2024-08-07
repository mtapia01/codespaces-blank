const passwords: { [key: string]: string } = {
    えきむっごきへで: "最強な私の名前。",
    げどぴんやせぎく: "広告を消したとき、どのページに移動する？",
    がびてちぶけぢん: "ようこそページの対話。",
    うぅぢはれぉぜぉ: "HTML を見ても何もありませんよ。",
    やわごぇるでぉほ: "右クリックは禁止です！",
    ゐかいぅゎっげし: "楽譜置き場にパスワードがある気がします！",
}

const generateRange = (startChar: string, endChar: string) => {
    let startCharIndex = startChar.codePointAt(0)!
    let endCharIndex = endChar.codePointAt(0)!

    if (startCharIndex > endCharIndex) {
        const temp = startCharIndex

        startCharIndex = endCharIndex
        endCharIndex = temp
    }

    let range = ""

    for (let i = startCharIndex; i <= endCharIndex; i++) range += String.fromCodePoint(i)

    return range
}

const chars = generateRange("あ", "ん")
const hashLength = 8

export const bakePassword = (rawPassword: string) => {
    let inputPassword = rawPassword

    if (inputPassword.length > 100) return "?"

    if (inputPassword.length < hashLength) {
        const insufficiency = hashLength - inputPassword.length

        let extendedPassword = inputPassword
        let current = 0

        for (let i = 0; i < insufficiency; i++) {
            if (current >= inputPassword.length) current = 0

            const charCode = inputPassword.codePointAt(current)!
            const selectChar = charCode % 2 === 0 ? charCode + insufficiency : charCode - insufficiency

            extendedPassword += chars[selectChar / chars.length]
        }

        inputPassword = extendedPassword
    }

    let hash = 0
    let hashChar = "-".repeat(hashLength)

    for (let i = 0, j = inputPassword.length - 1; i < inputPassword.length; i++, j--) {
        const h1 = (hash << 2) - hash + inputPassword.codePointAt(i)!
        const h2 = (hash << 4) - hash + inputPassword.codePointAt(j)!
        const h3 = (hash << 6) - hash + chars.indexOf(inputPassword.charAt(i))

        hash = h1 ^ h2 ^ h3
        hash &= 0x7f_ff_ff_ff

        const calculatedHashChar = chars[Math.abs(hash) % chars.length]

        let putPos = hash % hashLength

        if (hashChar.charAt(putPos) !== "-") putPos = hashChar.indexOf("-")
        if (putPos === -1) putPos = hash % hashLength
        hashChar = hashChar.slice(0, Math.max(0, putPos)) + calculatedHashChar + hashChar.slice(Math.max(0, putPos + 1))
    }

    return hashChar
}

export const submitPassword = (inputPassword: string) => {
    if (inputPassword.length === 0) {
        alert("パスワードを入力してください！")

        return
    }

    const bakedPassword = bakePassword(inputPassword)

    if (!(bakedPassword in passwords)) {
        alert("パスワードが間違っています！")

        return
    }

    markPasswordAsResolved(bakedPassword)
    window.open(`frame.html?dist=${bakedPassword}&password=${inputPassword}`, "_self")
}

const RESOLVED_PASSWORDS_LS = "passed_passwords"

const getResolvedPasswords = (): string[] => {
    const resolvedPasswords = localStorage.getItem(RESOLVED_PASSWORDS_LS)

    if (resolvedPasswords === null) return []

    return JSON.parse(resolvedPasswords) as string[]
}

const markPasswordAsResolved = (password: string) => {
    const passedPasswords = getResolvedPasswords()

    passedPasswords.push(password)
    localStorage.setItem(RESOLVED_PASSWORDS_LS, JSON.stringify(passedPasswords))
}

const getUnresolvedPasswordEntries = (): { [key: string]: string } => {
    const passedPasswords = new Set(getResolvedPasswords())
    const unresolvedEntries: { [key: string]: string } = {}

    for (const [key, value] of Object.entries(passwords)) {
        if (!passedPasswords.has(key)) {
            unresolvedEntries[key] = value
        }
    }

    return unresolvedEntries
}

export const getRandomHint = () => {
    let entries = getUnresolvedPasswordEntries()

    if (Object.keys(entries).length === 0) {
        entries = passwords
    }

    const keys = Object.keys(entries)
    const index = Math.floor(Math.random() * keys.length)
    const randomKey = keys[index]
    const hint = entries[randomKey]

    return `${index + 1}ページ目のヒント：${hint}`
}

const createResolveStatusIndicator = () => {
    const elm = document.querySelector("#resolve-status-indicator")!
    const resolvedPasswords = getResolvedPasswords()
    const allPasswords = Object.keys(passwords)
    const resolveStatus: boolean[] = []

    for (const password of allPasswords) {
        resolveStatus.push(resolvedPasswords.includes(password))
    }

    // すべて解決済みなら, おめでとうメッセージを表示
    if (resolveStatus.every(Boolean)) {
        elm.classList.add("congratulations")
        elm.textContent = "全隠しページを制覇しました！おめでとうございます！"

        return
    }

    // そうでなかったら, インジケータを表示
    for (const element of resolveStatus) {
        const span = document.createElement("span")

        span.textContent = element ? "●" : "○"
        elm.append(span)
    }
}

window.getRandomHint = getRandomHint
window.submitPassword = submitPassword
window.bakePassword = bakePassword
window.addEventListener("load", () => {
    createResolveStatusIndicator()
})
