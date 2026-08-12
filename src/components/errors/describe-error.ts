/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { TRPCClientError } from "@trpc/client";

import type { ArtiePose } from "@/components/art/artie";

export interface ErrorDescription {
    title: string;
    description: string;
    pose: ArtiePose;
}

/**
 * The fixed descriptions, shared by the client mapper below and the server-side
 * `forbidden()` boundary, so both paths read identically to the user.
 */
export const ErrorDescriptions = {
    Forbidden: {
        title: "Not permitted",
        description:
            "You do not have permission to view this. Ask an organization administrator if you think that's wrong.",
        pose: "NotAllowed",
    },
    NotFound: {
        title: "Not found",
        description:
            "The resource you requested was not found. Have you tried looking under the couch?",
        pose: "NotFound",
    },
    Unauthorized: {
        title: "Signed out",
        description: "Your session has expired. Sign in again to continue.",
        pose: "Login",
    },
} as const satisfies Record<string, ErrorDescription>;

/** Read tRPC's string error code off a client error, if this is one. */
function trpcErrorCode(error: unknown): string | undefined {
    if (!(error instanceof TRPCClientError)) return undefined;

    const data: unknown = error.data;
    if (typeof data !== "object" || data === null) return undefined;

    const code = (data as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
}

/**
 * Describe a *client-side* error for display.
 *
 * Deliberately does not test for server error classes: Next serialises errors thrown in
 * server components across the RSC boundary with the class dropped and, in production, the
 * message replaced. Server-side permission failures use `forbidden()` instead, which
 * reaches its own boundary with the description intact.
 */
export function describeError(error: unknown): ErrorDescription {
    switch (trpcErrorCode(error)) {
        case "FORBIDDEN":
            return ErrorDescriptions.Forbidden;
        case "NOT_FOUND":
            return ErrorDescriptions.NotFound;
        case "UNAUTHORIZED":
            return ErrorDescriptions.Unauthorized;
    }

    return {
        title: error instanceof Error ? error.name : "Error",
        description:
            (error instanceof Error ? error.message : "") || "An unexpected error occurred.",
        pose: "Error",
    };
}
