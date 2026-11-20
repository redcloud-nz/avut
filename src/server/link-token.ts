/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * Bearer tokens carried in links inside emails (the D4H attendance reminder's opt-out link).
 * The token itself appears only in the email; the database stores just its hash, so a leaked
 * table can't be turned back into working links.
 */

import { createHash, randomBytes } from "node:crypto";

import "server-only";

/**
 * A fresh link token and the hash to store for it. The token is 32 random bytes, base64url
 * encoded, so it's safe in a URL path segment as-is.
 */
export function createLinkToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString("base64url");
    return { token, hash: hashLinkToken(token) };
}

/** The stored form of a link token: its sha256 as lowercase hex. */
export function hashLinkToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}
