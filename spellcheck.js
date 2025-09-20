// spellcheck.js (для расширения)
import { createHunspellFromStrings } from "./libs/Hunspell.js";

export async function initHunspell() {
    const affUrl = chrome.runtime.getURL("tatar.aff");
    const dicUrl = chrome.runtime.getURL("tatar.dic");

    const aff = await (await fetch(affUrl)).text();
    const dic = await (await fetch(dicUrl)).text();

    const hunspell = await createHunspellFromStrings(aff, dic);
    console.log("✅ Hunspell словарь загружен в расширении");
    return hunspell;
}