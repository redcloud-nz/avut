/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { withArtificialLatency } from "@/lib/artificial-latency";
import { env } from "@/lib/env";
import { createTrpcContext } from "@/server/trpc-context";
import { logTrpcError } from "@/trpc/log-error";
import { appRouter } from "@/trpc/routers/_app";

/**
 * Covers work a procedure schedules with `after()`, which counts against this route's duration:
 * a d4h-nag Run now sends its reminders there, at least 500 ms apart (about two minutes for a
 * large team). The same budget as the d4h-nag cron route.
 */
export const maxDuration = 300;

const actualHandler = (req: Request) =>
    fetchRequestHandler({
        endpoint: "/trpc",
        req,
        router: appRouter,
        createContext: createTrpcContext,
        onError: logTrpcError,
    });

const handler = env.isDevelopment()
    ? async (req: Request) => {
          const {
              result,
              inbound: inboundLatency,
              outbound: outboundLatency,
          } = await withArtificialLatency(
              () => actualHandler(req),
              env.AVUT_TRPC_ARTIFICIAL_LATENCY,
          );

          if (inboundLatency > 0 || outboundLatency > 0) {
              console.debug(
                  `[trpc] Artificial latency applied: inbound=${inboundLatency}ms, outbound=${outboundLatency}ms`,
              );
          }
          return result;
      }
    : actualHandler;

export { handler as GET, handler as POST };
