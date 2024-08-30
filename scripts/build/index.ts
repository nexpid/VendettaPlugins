import { cpus } from "node:os";
import { join } from "node:path";

import {
    bench,
    highlight,
    logCompleted,
    logDebug,
    logFinished,
    logHeader,
    runTask,
} from "../common/statistics/print.ts";
import { TsWorker } from "../common/worker/index.ts";
import { isDev } from "./lib/common.ts";
import rejuvenatePlugins from "./lib/rejuvenate.ts";
import { fixPluginLangs, makeLangDefs } from "./modules/lang.ts";
import {
    buildPlugin,
    listPlugins,
    workerResolves,
    workers,
} from "./modules/plugins.ts";
import { writePluginReadmes, writeRootReadme } from "./modules/readmes.ts";

logDebug("Booting up Workers");

await (() =>
    new Promise<void>(res => {
        let count = 0;
        for (let i = 0; i < cpus().length; i++)
            workers.push(
                new TsWorker(
                    join(import.meta.dirname, "modules/workers/plugins.ts"),
                    {
                        workerData: {
                            isDev: String(isDev),
                        },
                    },
                ).once("message", () => ++count >= workers.length && res()),
            );
    }))();

const offset = performance.now();

// Write lang files

const writePluginLangFiles = bench();
logHeader("Writing plugin lang files");

await Promise.all([
    runTask(`Wrote ${highlight("defs.d.ts")} types file`, makeLangDefs()),
    runTask(`Fixed ${highlight("plugin translation")} files`, fixPluginLangs()),
]);

logFinished("writing plugin lang files", writePluginLangFiles.stop());

// Build plugins

const rejuvenate =
    isDev && (await rejuvenatePlugins((await listPlugins()).map(x => x.name)));

const buildingPlugins = bench();
logHeader("Building plugins");

for (const plugin of await listPlugins()) buildPlugin(plugin);

await (() =>
    new Promise<void>((res, rej) => {
        workerResolves.res = res as any;
        workerResolves.rej = rej as any;
    }))();

workers.forEach(x => x.terminate());
logFinished("building plugins", buildingPlugins.stop());

// Write READMEs

const writeReadmeFiles = bench();
logHeader("Writing README files");

await Promise.all([
    runTask(`Wrote ${highlight("plugins")} READMEs`, writePluginReadmes()),
    runTask(`Wrote ${highlight("root")} README`, writeRootReadme()),
]);

logFinished("writing README files", writeReadmeFiles.stop());

logCompleted(Math.floor(performance.now() - offset));

if (rejuvenate) await rejuvenate();