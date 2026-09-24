/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

interface ArtificialLatencyResult<R> {
    result: R;
    inbound: number;
    outbound: number;
    duration: number;
}

/**
 * Runs `fn`, padded with simulated network latency on both sides — `inbound` before it starts,
 * `outbound` after it resolves — so the caller sees the same shape of delay a real network hop
 * would add. `latency` is either a fixed `ms` value (used for both directions) or a `[min, max]`
 * range (each direction draws its own random value from it independently, so inbound and
 * outbound differ run to run, same as real jitter would).
 *
 * The two delays are sequential, not raced against `fn` — unlike a `Promise.all`, they add to
 * the total time rather than being absorbed by slow work. That's deliberate: it's what makes
 * this usable for both a single tRPC call (one delay in, one out) and a per-query Prisma
 * extension, where delays from sequential queries in the same request are meant to stack.
 */
export async function withArtificialLatency<R>(
    fn: () => Promise<R>,
    latency: number | [number, number] | undefined,
): Promise<ArtificialLatencyResult<R>> {
    let inbound = 0;
    let outbound = 0;

    if (Array.isArray(latency) && latency.length === 2) {
        const [min, max] = latency;
        inbound = Math.floor(Math.random() * (max - min + 1)) + min;
        outbound = Math.floor(Math.random() * (max - min + 1)) + min;
    } else if (typeof latency === "number") {
        inbound = outbound = latency;
    }

    if (inbound > 0) {
        await new Promise((resolve) => setTimeout(resolve, inbound));
    }
    const start = performance.now();
    const result = await fn();
    const duration = Math.round(performance.now() - start);

    if (outbound > 0) {
        await new Promise((resolve) => setTimeout(resolve, outbound));
    }
    return { result, inbound, outbound, duration };
}
