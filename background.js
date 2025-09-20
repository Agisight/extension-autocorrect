// background.js (MV3, type: "module")
import { createHunspellFromStrings } from "./libs/Hunspell.js";

let hunspell = null;
let boot;

/** Lazy init Hunspell once */
async function initHunspell() {
    if (boot) return boot;
    boot = (async () => {
        const [aff, dic] = await Promise.all([
            fetch(chrome.runtime.getURL("tatar.aff")).then(r => r.text()),
            fetch(chrome.runtime.getURL("tatar.dic")).then(r => r.text())
        ]);
        hunspell = await createHunspellFromStrings(aff, dic);
        console.log("[BG] Hunspell ready");
    })();
    return boot;
}
initHunspell().catch(console.error);

// -------- Context menu --------
const PARENT_ID = "ta_parent";
const ITEM_IDS = ["ta_sug_0", "ta_sug_1", "ta_sug_2"];
// tabId -> { reqId, word, suggestions }
const tabState = new Map();

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: PARENT_ID,
            title: "Подсказки (татарский)",
            contexts: ["editable", "selection"]
        });
        ITEM_IDS.forEach((id, i) => {
            chrome.contextMenus.create({
                id,
                parentId: PARENT_ID,
                title: `(нет варианта ${i + 1})`,
                contexts: ["editable", "selection"],
                enabled: false
            });
        });
    });
});

function updateMenuItems(titles) {
    for (let i = 0; i < ITEM_IDS.length; i++) {
        const t = titles[i];
        chrome.contextMenus.update(ITEM_IDS[i], {
            title: t ? `Заменить на “${t}”` : "(нет варианта)",
            enabled: !!t
        });
    }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
    const idx = ITEM_IDS.indexOf(info.menuItemId);
    if (idx === -1 || !tab?.id) return;
    const state = tabState.get(tab.id);
    const replacement = state?.suggestions?.[idx];
    if (!replacement) return;

    chrome.tabs.sendMessage(tab.id, {
        type: "applySuggestion",
        reqId: state.reqId,
        replacement
    });
});

// -------- Messages from content --------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
        if (msg?.type === "ping") {
            sendResponse({ pong: true });
            return;
        }

        if (msg?.type === "prepareMenu") {
            await initHunspell();
            const word = msg.word || "";
            const ok = hunspell.testSpelling(word);
            const suggestions = ok ? [] : hunspell.getSpellingSuggestions(word);
            const top3 = suggestions.slice(0, 3);

            if (sender.tab?.id != null) {
                tabState.set(sender.tab.id, { reqId: msg.reqId, word, suggestions: top3 });
            }
            updateMenuItems(top3);

            sendResponse({ ok, suggestions: top3 });
            return;
        }

        if (msg?.type === "checkWord") {
            await initHunspell();
            const word = msg.word || "";
            const ok = hunspell.testSpelling(word);
            const suggestions = ok ? [] : hunspell.getSpellingSuggestions(word);
            sendResponse({ ok, suggestions });
            return;
        }
    })();
    return true; // keep port open for async
});
