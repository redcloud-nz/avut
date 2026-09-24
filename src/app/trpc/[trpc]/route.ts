/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { withArtificialLatency } from "@/lib/artificial-latency";
import { env } from "@/lib/env";
import { createTrpcContext } from "@/server/trpc-context";
import { appRouter } from "@/trpc/routers/_app";

const actualHandler = (req: Request) =>
    fetchRequestHandler({
        endpoint: "/trpc",
        req,
        router: appRouter,
        createContext: createTrpcContext,
        onError({ error, type, path }) {
            console.error(`[trpc] Error on ${type} procedure at ${path}:`, error);
        },
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
