import { readdir } from "node:fs/promises";

import {
    bench,
    highlight,
    logScopeFailed,
    logScopeFinished,
} from "../lib/print.mjs";

export async function listPlugins() {
    const plugins = await readdir("src/plugins");
    const lang = await readdir("lang/values");

    return plugins.map(plugin => {
        const langName = plugin.replaceAll("-", "_");
        return {
            name: plugin,
            lang: lang.includes(`${langName}.json`) ? langName : null,
        };
    });
}

/** @type {import("../types").Worker.PluginWorkerRequest[]} */
const pendingWorkers = [];
let usedWorkers = 0;

export const workerResolves = {
    res: () => void 0,
    rej: () => void 0,
    rejected: false,
};

/** @type {Worker[]} */
export const workers = [];
let workerInd = 0;

/** @param {import("../types").Worker.PluginWorkerRequest} plugin */
export function buildPlugin(plugin) {
    usedWorkers++;
    if (usedWorkers > workers.length) {
        pendingWorkers.push(plugin);
    } else {
        const started = bench();

        const worker = workers[workerInd++];
        worker.postMessage(plugin);
        worker.addListener("message", data => {
            /** @type {import("../types").Worker.PluginWorkerResponse} */
            const status = data.data ?? data;
            if (workerResolves.rejected) return;

            const label = `Built plugin ${highlight(status.result === "yay" ? status.plugin : plugin.name)}`;

            if (status.result === "yay") {
                logScopeFinished(label, started.stop());

                plugin = pendingWorkers.splice(0, 1)[0];
                usedWorkers--;

                if (plugin) worker.postMessage(plugin);
                else if (usedWorkers <= 0) workerResolves.res();
            } else if (status.result === "nay") {
                logScopeFailed(label);

                workers.forEach(x => x.terminate());
                workerResolves.rejected = true;
                workerResolves.rej(status.err);
            }
        });
    }
}