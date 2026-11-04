import createPrismaMock from "prisma-mock/client";

import * as dmmf from "@/generated/dmmf";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

/**
 * A fresh in-memory `PrismaClient`, patched to behave like the real one in an array
 * `$transaction`: a write that throws rolls back the writes before it, and the ones after it
 * never run (issue #429).
 *
 * prisma-mock runs a model call as soon as it's made, so by the time `$transaction([...])` sees
 * the array, every operation in it has already run. Real Prisma calls return a lazy
 * `PrismaPromise` that runs only when awaited. Here each model call is deferred the same way, and
 * the array form snapshots the store first and restores it on a throw.
 */
export function createMockPrisma(): PrismaClient {
    const client = createPrismaMock(Prisma as never, {
        datamodel: dmmf as never,
    });

    for (const delegate of modelDelegates(client)) {
        for (const [name, fn] of Object.entries(delegate)) {
            if (typeof fn !== "function") continue;
            delegate[name] = (...args: unknown[]) => deferred(() => fn(...args));
        }
    }

    const interactiveTransaction = client.$transaction.bind(client) as (
        actions: unknown,
    ) => Promise<unknown>;
    client.$transaction = (async (actions: unknown) => {
        if (!Array.isArray(actions)) return interactiveTransaction(actions);

        const snapshot = client.$getInternalState();
        try {
            const results = [];
            for (const action of actions) results.push(await action);
            return results;
        } catch (error) {
            client.$setInternalState(snapshot);
            throw error;
        }
    }) as never;

    return client as unknown as PrismaClient;
}

/** The model delegates (`client.person`, `client.logEntry`, …): every non-`$` object property. */
function modelDelegates(client: object): Record<string, unknown>[] {
    return Object.entries(client)
        .filter(([key, value]) => !key.startsWith("$") && typeof value === "object" && value)
        .map(([, value]) => value as Record<string, unknown>);
}

/** A promise that calls `run` only once something awaits it, as a `PrismaPromise` does. */
function deferred<T>(run: () => Promise<T>): Promise<T> {
    let promise: Promise<T> | undefined;
    const started = () => (promise ??= run());
    return {
        then: (onFulfilled, onRejected) => started().then(onFulfilled, onRejected),
        catch: (onRejected) => started().catch(onRejected),
        finally: (onFinally) => started().finally(onFinally),
        [Symbol.toStringTag]: "PrismaPromise",
    };
}
