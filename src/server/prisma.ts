/*
 *  Copyright (c) 2025 A.V.U.T. Project
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import { env } from "@/lib/env";

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { withArtificialLatency } from "@/lib/artificial-latency";

/**
 * Wraps a `PrismaClient` instance to introduce artificial query latency in development mode.
 * The latency is determined by the `AVUT_DB_ARTIFICIAL_LATENCY` environment variable, and
 * debug logs are printed if `AVUT_DEBUG_DB_QUERIES` is enabled.
 *
 * This ensures that the type of the returned client remains consistent across environments,
 * while only its behavior changes in development.
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
                const { result, inbound, outbound, duration } = await withArtificialLatency(
                    () => query(args),
                    env.AVUT_DB_ARTIFICIAL_LATENCY,
                );

                if (env.AVUT_DEBUG_DB_QUERIES) {
                    console.debug(
                        `[prisma] ${model ?? "raw"}.${operation} — ${duration}ms (+${inbound + outbound}ms artificial)`,
                    );
                }

                return result;
            },
        },
    }) as unknown as PrismaClient;
}

const prismaClientSingleton = () => {
    const adapter = new PrismaPg({
        // eslint-disable-next-line avut/no-process-env -- this module also runs under tsx (prisma/seed-demo.ts), where the server-only marker in @/server/env would throw
        connectionString: process.env.POSTGRES_PRISMA_URL,
    });

    const prisma = new PrismaClient({ adapter });

    if (env.isDevelopment()) {
        console.debug("[prisma] Development mode enabled.");
        return withDevelopmentLatency(prisma);
    }

    return prisma;
};

declare const globalThis: {
    prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (!env.isProduction()) globalThis.prismaGlobal = prisma;
