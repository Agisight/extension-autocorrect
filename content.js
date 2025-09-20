// content.js

// --- безопасная отправка сообщений в SW (не падает при перезапуске воркера) ---
function safeSendMessage(msg) {
    return new Promise((resolve) => {
        try {
            if (!chrome.runtime?.id) return resolve(null);
            chrome.runtime.sendMessage(msg, (resp) => {
                if (chrome.runtime.lastError) return resolve(null);
                resolve(resp ?? null);
            });
        } catch {
            resolve(null);
        }
    });
}

// — держим SW «тёплым», плюс полезно для диагностики
setInterval(() => { void safeSendMessage({ type: "ping" }); }, 30000);
void safeSendMessage({ type: "ping" });

// --- утилиты ---
const WORD_CLEAN_RE = /[.,/#!$%^&*;:{}=\-_`~()"'«»[\]<>…?]/g;

function getTextFromTarget(t) {
    if (!t) return "";
    if (t.matches('input[type="text"], input[type="search"], textarea')) return t.value || "";
    if (t.isContentEditable) return t.textContent || "";
    return "";
}

function getLastWord(rawText) {
    const words = rawText.split(/\s+/).filter(Boolean);
    if (!words.length) return "";
    const last = words[words.length - 1];
    return last.replace(WORD_CLEAN_RE, "");
}

function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// --- подсветка (минимальная): добавим/снимем CSS класс у поля ---
(function ensureStyle() {
    const css = `
  .ta-miss { outline: 2px dashed rgba(255,0,0,.6); outline-offset: 2px; }
  `;
    const style = document.createElement("style");
    style.textContent = css;
    document.documentElement.appendChild(style);
})();

function markField(el, bad) {
    if (!el) return;
    if (bad) el.classList.add("ta-miss");
    else el.classList.remove("ta-miss");
}

// --- основная проверка на вводе ---
const onEdit = debounce(async (e) => {
    const t = e.target;
    if (!t.matches('input[type="text"], input[type="search"], textarea, [contenteditable="true"]')) return;

    const text = getTextFromTarget(t);
    const word = getLastWord(text);
    if (!word || word.length < 2) { markField(t, false); return; }

    const resp = await safeSendMessage({ type: "checkWord", word });
    if (!resp) return; // SW недоступен — просто пропускаем тик
    markField(t, !resp.ok);
}, 120);

document.addEventListener("input", onEdit, { capture: true });
document.addEventListener("keyup", onEdit, { capture: true });

// --- подготовка контекстного меню прямо перед его открытием ---
document.addEventListener("contextmenu", async (e) => {
    const t = e.target;
    if (!t.matches('input[type="text"], input[type="search"], textarea, [contenteditable="true"]')) return;

    const text = getTextFromTarget(t);
    const word = getLastWord(text);
    if (!word || word.length < 2) return;

    // reqId нужен чтобы при «Заменить на…» вернуть правильную замену
    const reqId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    await safeSendMessage({ type: "prepareMenu", word, reqId });
}, { capture: true });

// --- замена по клику на пункт меню (сообщение из background.js) ---
chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== "applySuggestion") return;
    const active = document.activeElement;
    if (!active) return;

    // простая замена «последнего слова» в поле
    if (active.matches('input[type="text"], input[type="search"], textarea')) {
        const text = active.value || "";
        const parts = text.split(/\s+/);
        if (!parts.length) return;
        parts[parts.length - 1] = msg.replacement;
        active.value = parts.join(" ");
        active.dispatchEvent(new Event("input", { bubbles: true })); // чтобы сайт увидел изменение
        return;
    }

    if (active.isContentEditable) {
        // контент-editable: грубая замена последнего слова в textContent
        const text = active.textContent || "";
        const parts = text.split(/\s+/);
        if (!parts.length) return;
        parts[parts.length - 1] = msg.replacement;
        active.textContent = parts.join(" ");
        active.dispatchEvent(new Event("input", { bubbles: true }));
    }
});
