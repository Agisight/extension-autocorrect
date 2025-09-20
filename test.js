// test.js
import fs from "fs";
import { createHunspellFromStrings } from "./libs/Hunspell.js";

const run = async () => {
    // читаем твои tatar.aff и tatar.dic
    const aff = fs.readFileSync("./tatar.aff", "utf-8");
    const dic = fs.readFileSync("./tatar.dic", "utf-8");

    // создаём Hunspell
    const hunspell = await createHunspellFromStrings(aff, dic);

    // тестовые слова
    const words = ["искереп", "искерепләр", "түгел", "түгпл", "уякк", "өчпочмактар"];

    for (const w of words) {
        console.log("------");
        if (!hunspell.testSpelling(w)) {
            const suggestions = hunspell.getSpellingSuggestions(w);
            console.log(`${w} → ${suggestions[0] ?? "(нет вариантов)"}`);
            console.log("Все варианты:", suggestions);
        } else {
            console.log(`${w} ✓ (правильно)`);
        }
    }
};

run();
