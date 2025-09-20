// wasm/hunspell-worker.js
import { createHunspellFromStrings } from "../libs/Hunspell";

let hunspell = null;

async function loadText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    return res.text();
}

self.onmessage = async (e) => {
    const { type } = e.data || {};
    try {
        if (type === "init") {
            const { affUrl, dicUrl } = e.data;
            const [aff, dic] = await Promise.all([loadText(affUrl), loadText(dicUrl)]);
            hunspell = await createHunspellFromStrings(aff, dic);
            self.postMessage({ type: "ready" });
        } else if (type === "check") {
            const { word, reqId } = e.data;
            if (!hunspell) return self.postMessage({ type: "error", error: "not-ready", reqId });
            const ok = hunspell.testSpelling(word);
            const suggestions = ok ? [] : hunspell.getSpellingSuggestions(word);
            self.postMessage({ type: "result", ok, suggestions, word, reqId });
        }
    } catch (err) {
        self.postMessage({ type: "error", error: String(err) });
    }
};
