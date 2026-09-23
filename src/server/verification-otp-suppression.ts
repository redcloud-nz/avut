/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * Deliberately free of any Better Auth import: `@/server/auth` reads
 * this from its `sendVerificationOTP`, and the invitations router (exercised from the jsdom test
 * environment) writes to it.
 */

import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

const suppression = new AsyncLocalStorage<true>();

/**
 * Run `fn` with the sign-up verification code email switched off.
 *
 * Better Auth sends that email from inside `signUpEmail`, with no option to decline it per call.
 * The one legitimate reason to is an account created from an invitation link: the address has
 * just proved itself by receiving the link, so the code would be a redundant second email that
 * the person can never use (their account is marked verified straight after).
 *
 * Scoped with `AsyncLocalStorage` rather than a flag so it cannot leak into a concurrent request,
 * and it follows the work Better Auth defers with `runInBackgroundOrAwait`.
 */
export function withoutVerificationOtpEmail<T>(fn: () => Promise<T>): Promise<T> {
    return suppression.run(true, fn);
}

/** Whether the surrounding call is inside `withoutVerificationOtpEmail`. */
export function isVerificationOtpEmailSuppressed(): boolean {
    return suppression.getStore() === true;
}
