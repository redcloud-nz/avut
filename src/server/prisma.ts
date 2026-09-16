/*
 *  Copyright (c) 2025 A.V.U.T. Project
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Artificial per-query delay in development, simulating the network round trip between the
 * server and the database. Distinct from — and complementary to — the per-procedure delay in
 * `trpc/init.ts`, which represents the client-to-server round trip. That one fires once per
 * tRPC call no matter how many queries it issues, so it can't show the difference between a
 * procedure doing one query and one doing five sequential ones. This one is per query, so it's
 * additive across sequential queries and largely free across `Promise.all`'d ones — the same
 * shape of cost as the real thing, which is the point.
 */
const DEVELOPMENT_QUERY_DELAY = { min: 5, max: 20 }; // ms

/**
 * Adds the artificial delay above, plus a debug log of each query's real duration, via a
 * client extension. Skips both outside development (a plain env check per query, not a
 * conditional wrapper) so the *type* of the returned client never changes with the
 * environment — only its behaviour.
 *
 * Cast back to `PrismaClient` deliberately: `$extends` return types are typically fine as
 * drop-in replacements, but its `$transaction` result type is not — it stops matching
 * `Prisma.TransactionClient`, which `ctx.logEvent`'s `tx` parameter (see `trpc/init.ts`) is
 * typed against everywhere. Rather than let that ripple through every router, keep the
 * exported type stable; the extension still runs, it's just invisible to the type checker.
 */
function withDevelopmentLatency(client: PrismaClient): PrismaClient {
    return client.$extends({
        name: "development-query-latency",
        query: {
            async $allOperations({ model, operation, args, query }) {
                if (process.env.NODE_ENV !== "development") return query(args);

                const delay =
                    Math.floor(
                        Math.random() *
                            (DEVELOPMENT_QUERY_DELAY.max - DEVELOPMENT_QUERY_DELAY.min + 1),
                    ) + DEVELOPMENT_QUERY_DELAY.min;

                await new Promise((resolve) => setTimeout(resolve, delay));

                const start = performance.now();
                const result = await query(args);
                const durationMs = Math.round(performance.now() - start);

                console.debug(
                    `[prisma] ${model ?? "raw"}.${operation} — ${durationMs}ms (+${delay}ms artificial)`,
                );

                return result;
            },
        },
    }) as unknown as PrismaClient;
}

const prismaClientSingleton = () => {
    const adapter = new PrismaPg({
        connectionString: process.env.POSTGRES_PRISMA_URL,
    });
    return withDevelopmentLatency(new PrismaClient({ adapter }));
};

declare const globalThis: {
    prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;
