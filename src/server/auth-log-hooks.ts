/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * Pure mapping functions for the better-auth `databaseHooks`.
 *
 * All the logic lives here, with no database access and no better-auth imports, so it is
 * unit-testable from jsdom. The shell in `auth.ts` — which cannot be tested there — stays
 * a thin wire: snapshot in `before`, map and record in `after`.
 *
 * Constraints these functions are shaped by, verified against better-auth 1.7.3:
 *
 * - `update.after` receives only the RESULTING row, and `update.before` only the update
 *   PAYLOAD. Neither carries the previous value. So "which fields did this write touch"
 *   comes from the payload's keys, passed in as `UserUpdateSnapshot.touched`, and the one
 *   previous value we need (the old email) is read in `before` and passed as
 *   `previousEmail`.
 * - Ban direction needs no previous value: it is a function of the new `banned` value.
 * - These functions never throw. The shell swallows errors regardless, and a function
 *   that returns nothing is easier to reason about than one throwing into a swallowed
 *   catch.
 */

import type { DiffChange } from "@/lib/diff";
import { UserId } from "@/lib/schemas/user";

import { formatActorLabel, type RecordLogEntryInput } from "./log-entry";

/** better-auth's credential provider id. Anything else is a social provider. */
const CREDENTIAL_PROVIDER = "credential";

export interface HookUserRow {
    id: string;
    name: string;
    email: string;
    banned?: boolean | null;
    banReason?: string | null;
    banExpires?: Date | null;
}

export interface HookAccountRow {
    id: string;
    userId: string;
    providerId: string;
}

export interface HookSessionRow {
    id: string;
    userId: string;
    impersonatedBy?: string | null;
}

/** The user driving the request, resolved from better-auth's endpoint context. */
export interface HookActor {
    userId: string;
    name: string;
    email: string;
}

/**
 * What the `before` hook observed: which keys the update payload carried, plus the one
 * previous value the `after` hook cannot recover on its own.
 */
export interface UserUpdateSnapshot {
    touched: string[];
    previousEmail?: string;
}

/**
 * Entries for a `user.update`.
 *
 * Returns zero, one, or two entries — a single update can touch both the email and the
 * ban state, and those are two independently meaningful events.
 */
export function mapUserUpdate(
    user: HookUserRow,
    snapshot: UserUpdateSnapshot | undefined,
    actor: HookActor | null,
): RecordLogEntryInput[] {
    const touched = snapshot?.touched ?? [];
    const entries: RecordLogEntryInput[] = [];
    const ownerId = UserId.schema.parse(user.id);

    if (
        touched.includes("email") &&
        snapshot?.previousEmail !== undefined &&
        snapshot.previousEmail !== user.email
    ) {
        // A self-service change: the subject is the actor.
        entries.push({
            scope: "user",
            ownerId,
            actor: { userId: ownerId },
            // Labelled with the address they had when they acted, not the new one.
            actorLabel: formatActorLabel(user.name, snapshot.previousEmail),
            action: "Update",
            objectType: "User",
            objectId: user.id,
            changes: [
                {
                    type: "obj_mod",
                    path: ["email"],
                    prev: snapshot.previousEmail,
                    curr: user.email,
                },
            ],
            description: "Email address changed",
        });
    }

    if (touched.includes("banned")) {
        const banned = user.banned === true;
        // An admin ban has a resolvable actor; a self-service path may not. Falling back
        // to the affected user keeps the entry attributable — the shell warns separately,
        // because an unresolved actor is a diagnostic about our code, not a fact about
        // the event.
        const resolved = actor ?? { userId: user.id, name: user.name, email: user.email };

        const changes: DiffChange[] = [];
        if (banned && user.banReason != null) {
            changes.push({ type: "obj_add", path: ["banReason"], curr: user.banReason });
        }
        if (banned && user.banExpires != null) {
            changes.push({
                type: "obj_add",
                path: ["banExpires"],
                curr: user.banExpires.toISOString(),
            });
        }

        entries.push({
            scope: "user",
            ownerId,
            actor: { userId: UserId.schema.parse(resolved.userId) },
            actorLabel: formatActorLabel(resolved.name, resolved.email),
            action: banned ? "Ban" : "Unban",
            objectType: "User",
            objectId: user.id,
            changes,
        });
    }

    return entries;
}

/**
 * A password change.
 *
 * The values are never stored: the change is a bare `obj_mask` marker naming the field,
 * with no old or new value. `obj_mask` is the same variant the D4H access-token redaction
 * uses.
 */
export function mapPasswordChange(
    account: HookAccountRow,
    passwordTouched: boolean,
): RecordLogEntryInput | null {
    if (!passwordTouched) return null;
    if (account.providerId !== CREDENTIAL_PROVIDER) return null;

    const ownerId = UserId.schema.parse(account.userId);

    return {
        scope: "user",
        ownerId,
        actor: { userId: ownerId },
        action: "Update",
        objectType: "User",
        objectId: account.userId,
        changes: [{ type: "obj_mask", path: ["password"] }],
        description: "Password changed",
    };
}

/** A social account being linked or unlinked. The credential row is a password, not a link. */
export function mapAccountLink(
    account: HookAccountRow,
    action: "Create" | "Delete",
    actor: HookActor | null,
): RecordLogEntryInput | null {
    if (account.providerId === CREDENTIAL_PROVIDER) return null;

    const ownerId = UserId.schema.parse(account.userId);
    const resolved = actor?.userId ? UserId.schema.parse(actor.userId) : ownerId;

    return {
        scope: "user",
        ownerId,
        actor: { userId: resolved },
        actorLabel: actor ? formatActorLabel(actor.name, actor.email) : undefined,
        action,
        objectType: "Account",
        objectId: account.id,
        changes: [{ type: "obj_add", path: ["providerId"], curr: account.providerId }],
        description:
            action === "Create"
                ? `Linked ${account.providerId} account`
                : `Unlinked ${account.providerId} account`,
        refs: [{ objectType: "User", objectId: account.userId, role: "context" }],
    };
}

/**
 * The start or end of an impersonated session.
 *
 * Both ends are observable: better-auth's `stopImpersonating` deletes the session through
 * the hooked path, so `session.delete.after` carries `impersonatedBy`. Sign-out and
 * session revocation of an impersonated session fire the same hook, and those are genuine
 * ends too.
 *
 * The entry is owned by the impersonated user and acted by the admin — the inverse of the
 * usual arrangement, and the point of logging it.
 */
export function mapImpersonation(
    session: HookSessionRow,
    phase: "start" | "end",
): RecordLogEntryInput | null {
    if (!session.impersonatedBy) return null;

    return {
        scope: "user",
        ownerId: UserId.schema.parse(session.userId),
        actor: { userId: UserId.schema.parse(session.impersonatedBy) },
        action: "Impersonate",
        objectType: "User",
        objectId: session.userId,
        changes: [],
        description:
            phase === "start"
                ? `Started impersonating user ${session.userId}`
                : `Stopped impersonating user ${session.userId}`,
        refs: [{ objectType: "Session", objectId: session.id, role: "context" }],
    };
}
