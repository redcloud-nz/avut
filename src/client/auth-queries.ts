/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

import { queryOptions, useQuery } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { authQueryKeys } from "@/lib/auth-query-keys";
import { trpc, type RouterOutput } from "@/trpc/client";

/** The shape `useSession()`/`useUser()` resolve to — `trpc.user.getSession`'s output. */
export type SessionData = NonNullable<RouterOutput["user"]["getSession"]>;

/**
 * The single definition of the session query.
 *
 * Goes through `trpc.user.getSession` rather than `authClient.getSession()` directly, so it
 * shares tRPC's prefetch/hydrate machinery with every other query instead of needing its own
 * hand-aligned server/client key pair — `AuthenticatedLayout` prefetches the same procedure,
 * and the shared queryKey `queryOptions()` derives is what lets that hydrate this entry
 * instead of this query re-fetching on mount.
 */
export function sessionQueryOptions() {
    return queryOptions({
        ...trpc.user.getSession.queryOptions(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Read the current session.
 *
 * Prefer this over Better Auth's own `authClient.useSession()`, which keeps its own
 * nanostore cache with no relationship to React Query — a second copy of the session that
 * goes stale independently, cannot be hydrated from the server, and survives sign-out.
 */
export function useSession() {
    return useQuery(sessionQueryOptions());
}

/** Read the current user, if any. */
export function useUser() {
    const { data, ...rest } = useSession();
    return { ...rest, data: data?.user };
}

/**
 * The single definition of the linked-accounts query.
 *
 * Both `UserProfile_ChangePassword_Dialog` (which only needs to know whether a credential
 * account exists) and `LinkedAccounts_Card` read through this, so the two share one cache
 * entry and one request rather than each fetching the list.
 *
 * The key sits inside the `["auth"]` subtree so it inherits `authQueryRetryOptions` — a
 * 403 from a stale session fails fast instead of burning three pointless retries — and is
 * evicted along with the rest of the auth cache on sign-out.
 */
export function linkedAccountsQueryOptions() {
    return queryOptions({
        queryKey: authQueryKeys.linkedAccounts,
        queryFn: ({ signal }) => listAccounts(signal),
    });
}

// Named separately so `LinkedAccount` below can be derived from it rather than hand-rolled.
function listAccounts(signal?: AbortSignal) {
    // `throw: true` rejects on error and resolves with the accounts themselves rather than
    // Better Auth's `{ data, error }` envelope.
    return authClient.listAccounts({}, { signal, throw: true });
}

/** One account linked to the current user, as returned by Better Auth's `/list-accounts`. */
export type LinkedAccount = Awaited<ReturnType<typeof listAccounts>>[number];

/**
 * The mutations below all destructure Better Auth's `{ data, error }` envelope and throw a
 * plain `Error` themselves, rather than passing `{ throw: true }` — a thrown `BetterFetchError`'s
 * own `.message` is the HTTP status text (empty on HTTP/2), not the API's own message, which
 * lives on `.error.message` instead (see `unlinkAccountMutationOptions` below, which already
 * had to work around this for `SESSION_NOT_FRESH`). Reading the envelope directly keeps the
 * real, user-facing message everywhere a mutation's error reaches the screen.
 *
 * Each factory returns `mutationFn` only, deliberately no `onSuccess`/`onError` — those stay
 * call-site concerns (different redirects, different toasts, different dialog steps).
 */

/** Sign in with email and password. */
export function signInMutationOptions() {
    return {
        async mutationFn(input: { email: string; password: string; rememberMe?: boolean }) {
            const { data, error } = await authClient.signIn.email(input);
            if (error) throw new Error(error.message ?? "Invalid email or password.");
            return data;
        },
    };
}

/** Create an account with a name, email, and password. */
export function signUpMutationOptions() {
    return {
        async mutationFn(input: { name: string; email: string; password: string }) {
            const { data, error } = await authClient.signUp.email(input);
            if (error) throw new Error(error.message ?? "Unable to create account.");
            return data;
        },
    };
}

/**
 * Request a password-reset code by email — the first step of both the forgot-password flow
 * and, for a social-only account with no `credential` account yet, the set-password flow
 * (`authClient.emailOtp.resetPassword` creates the `credential` account on first use, so the
 * two flows share this same request).
 */
export function requestPasswordResetMutationOptions() {
    return {
        async mutationFn(email: string) {
            const { data, error } = await authClient.forgetPassword.emailOtp({ email });
            if (error) throw new Error(error.message ?? "Unable to send reset code.");
            return data;
        },
    };
}

/** Reset (or, for an account with none yet, set) a password using the emailed code. */
export function resetPasswordMutationOptions() {
    return {
        async mutationFn(input: { email: string; otp: string; password: string }) {
            const { data, error } = await authClient.emailOtp.resetPassword(input);
            if (error) throw new Error(error.message ?? "Unable to reset password.");
            return data;
        },
    };
}

/** Change the current password, given the existing one. */
export function changePasswordMutationOptions() {
    return {
        async mutationFn(input: {
            currentPassword: string;
            newPassword: string;
            revokeOtherSessions: boolean;
        }) {
            const { error } = await authClient.changePassword(input);
            if (error) throw new Error(error.message ?? "Could not change your password.");
        },
    };
}

/** Verify the current user's email address with an emailed code. */
export function verifyEmailMutationOptions() {
    return {
        async mutationFn(input: { email: string; otp: string }) {
            const { data, error } = await authClient.emailOtp.verifyEmail(input);
            if (error) throw new Error(error.message ?? "Unable to verify email.");
            return data;
        },
    };
}

/**
 * Send (or resend) an email-verification code — sign-up, the invitation landing page's
 * sign-in-in-place, and the change-email dialog's first step all need this same call.
 */
export async function sendEmailVerificationOtp(email: string) {
    const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
    });
    if (error) throw new Error(error.message ?? "Unable to send verification code.");
}

/** `mutationFn`-only wrapper for call sites that want `useMutation`'s pending/error state. */
export function sendEmailVerificationOtpMutationOptions() {
    return { mutationFn: sendEmailVerificationOtp };
}

/**
 * Request an email change — sends a verification code to the *new* address once the current
 * one has already been confirmed (the change-email dialog's second step).
 */
export function requestEmailChangeMutationOptions() {
    return {
        async mutationFn(input: { newEmail: string; otp: string }) {
            const { error } = await authClient.emailOtp.requestEmailChange(input);
            if (error) throw new Error(error.message ?? "Unable to change email.");
        },
    };
}

/** Complete an email change with the code sent to the new address. */
export function changeEmailMutationOptions() {
    return {
        async mutationFn(input: { newEmail: string; otp: string }) {
            const { error } = await authClient.emailOtp.changeEmail(input);
            if (error) throw new Error(error.message ?? "Unable to verify new email.");
        },
    };
}

/** Update the current user's display name. */
export function updateUserMutationOptions() {
    return {
        async mutationFn(input: { name: string }) {
            const { error } = await authClient.updateUser(input);
            if (error) throw new Error(error.message ?? "Unable to update name.");
        },
    };
}

/**
 * Start linking a social provider. Resolves to Better Auth's own response, which the caller
 * redirects the browser to (`data.url`) when the client hasn't already navigated on its own.
 */
export function linkSocialMutationOptions() {
    return {
        async mutationFn(input: { provider: string; providerName: string; callbackURL: string }) {
            const { data, error } = await authClient.linkSocial({
                provider: input.provider,
                callbackURL: input.callbackURL,
            });
            if (error) throw new Error(error.message ?? `Could not link ${input.providerName}.`);
            return data;
        },
    };
}

/**
 * Better Auth guards `/unlink-account` with a session-freshness check and reports a stale
 * session as a 403 carrying this code. Match on the code, never on the message: the client's
 * `message` is the HTTP status text, which on HTTP/2 is the empty string.
 */
const SESSION_NOT_FRESH_CODE = "SESSION_NOT_FRESH";

/** Marks the one unlink failure callers explain inline rather than reporting as an error. */
export class SessionNotFreshError extends Error {
    constructor() {
        super("Session is not fresh");
        this.name = "SessionNotFreshError";
    }
}

/** Unlink a social provider account, identified by its own account row id (`account.id`). */
export function unlinkAccountMutationOptions() {
    return {
        async mutationFn(input: { accountId: string; providerName: string }) {
            const { error } = await authClient.unlinkAccount({ accountId: input.accountId });
            if (error) {
                if (error.code === SESSION_NOT_FRESH_CODE) throw new SessionNotFreshError();
                throw new Error(error.message ?? `Could not unlink ${input.providerName}.`);
            }
        },
    };
}

/** Sign out. Callers are responsible for tearing down caches and navigating afterwards. */
export function signOut() {
    return authClient.signOut();
}
