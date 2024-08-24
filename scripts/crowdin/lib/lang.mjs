import { join } from "node:path";

import { readdir, readFile, writeFile } from "fs/promises";

import { listPlugins } from "../../build/modules/plugins.mjs";

/**
 * @param {string} source
 */
export async function writeNewLangFiles(source) {
    /** @type {Record<string, Record<string, any>>} */
    const data = {};

    // gather all translations from crowdin
    for (const lang of await readdir(source)) {
        if (lang === "base" || lang.endsWith(".json")) continue;

        for (const file of await readdir(join(source, lang))) {
            const key = file.split(".")[0];
            data[key] ??= {};
            data[key][lang] = JSON.parse(
                await readFile(join(source, lang, file), "utf8"),
            );
        }
    }

    // go through all plugins
    for (const { lang: plugin } of await listPlugins()) {
        if (!plugin) continue;

        // if translations aren't on crowdin yet, make a placeholder
        if (!data[plugin])
            data[plugin] = {
                en: JSON.parse(
                    await readFile(
                        join("lang/values/base", plugin + ".json"),
                        "utf8",
                    ),
                ),
            };

        // minify but also not really
        await writeFile(
            join("lang/values", plugin + ".json"),
            `{\n${Object.entries(data[plugin])
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(
                    ([lang, entries]) =>
                        `  ${JSON.stringify(lang)}: ${JSON.stringify(entries)}`,
                )
                .join(",\n")}\n}`,
        );
    }
}