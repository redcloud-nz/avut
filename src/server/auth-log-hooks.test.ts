/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { UserId } from "@/lib/schemas/user";

import {
    mapAccountLink,
    mapImpersonation,
    mapPasswordChange,
    mapUserUpdate,
    type HookActor,
    type HookUserRow,
} from "./auth-log-hooks";

const subjectId = UserId.create();
const adminId = UserId.create();

const subject: HookUserRow = {
    id: subjectId,
    name: "Kim Park",
    email: "kim@example.com",
};

const admin: HookActor = {
    userId: adminId,
    name: "Dana Okafor",
    email: "dana@example.com",
};

describe("mapUserUpdate — email", () => {
    it("records the old and new address when the payload touched email", () => {
        const [entry] = mapUserUpdate(
            { ...subject, email: "kim.park@example.com" },
            { touched: ["email"], previousEmail: "kim@example.com" },
            null,
        );

        expect(entry).toMatchObject({
            scope: "user",
            ownerId: subjectId,
            action: "Update",
            objectType: "User",
            objectId: subjectId,
            description: "Email address changed",
        });
        expect(entry.changes).toEqual([
            {
                type: "obj_mod",
                path: ["email"],
                prev: "kim@example.com",
                curr: "kim.park@example.com",
            },
        ]);
    });

    it("attributes a self-service email change to the user themselves", () => {
        const [entry] = mapUserUpdate(
            { ...subject, email: "kim.park@example.com" },
            { touched: ["email"], previousEmail: "kim@example.com" },
            null,
        );
        expect(entry.actor).toEqual({ userId: subjectId });
        expect(entry.actorLabel).toBe("Kim Park <kim@example.com>");
    });

    it("records nothing when the payload touched email but the address is unchanged", () => {
        expect(
            mapUserUpdate(subject, { touched: ["email"], previousEmail: "kim@example.com" }, null),
        ).toEqual([]);
    });

    it("records nothing when the payload never touched email", () => {
        expect(mapUserUpdate(subject, { touched: ["name"] }, null)).toEqual([]);
    });

    it("records nothing when there is no snapshot at all", () => {
        expect(mapUserUpdate(subject, undefined, null)).toEqual([]);
    });
});

describe("mapUserUpdate — ban", () => {
    it("records a Ban owned by the subject and acted by the admin", () => {
        const [entry] = mapUserUpdate(
            { ...subject, banned: true, banReason: "Spam", banExpires: null },
            { touched: ["banned", "banReason"] },
            admin,
        );

        expect(entry).toMatchObject({
            scope: "user",
            ownerId: subjectId,
            action: "Ban",
            objectType: "User",
            objectId: subjectId,
        });
        expect(entry.actor).toEqual({ userId: adminId });
        expect(entry.actorLabel).toBe("Dana Okafor <dana@example.com>");
        expect(entry.changes).toContainEqual({
            type: "obj_add",
            path: ["banReason"],
            curr: "Spam",
        });
    });

    it("records an Unban when the new value is false", () => {
        const [entry] = mapUserUpdate(
            { ...subject, banned: false },
            { touched: ["banned"] },
            admin,
        );
        expect(entry.action).toBe("Unban");
    });

    it("falls back to the affected user when no actor could be resolved", () => {
        const [entry] = mapUserUpdate({ ...subject, banned: true }, { touched: ["banned"] }, null);
        expect(entry.actor).toEqual({ userId: subjectId });
    });

    it("records both an email change and a ban when one update touched both", () => {
        const entries = mapUserUpdate(
            { ...subject, email: "new@example.com", banned: true },
            { touched: ["email", "banned"], previousEmail: "kim@example.com" },
            admin,
        );
        expect(entries.map((e) => e.action)).toEqual(["Update", "Ban"]);
    });
});

describe("mapPasswordChange", () => {
    it("records a masked marker carrying no password value", () => {
        const entry = mapPasswordChange(
            { id: "acc_1", userId: subjectId, providerId: "credential" },
            true,
        );

        expect(entry).toMatchObject({
            scope: "user",
            ownerId: subjectId,
            action: "Update",
            objectType: "User",
            objectId: subjectId,
            description: "Password changed",
        });
        expect(entry!.changes).toEqual([{ type: "obj_mask", path: ["password"] }]);
        expect(JSON.stringify(entry)).not.toContain("hunter2");
    });

    it("records nothing when the payload did not touch the password", () => {
        expect(
            mapPasswordChange({ id: "acc_1", userId: subjectId, providerId: "credential" }, false),
        ).toBeNull();
    });

    it("records nothing for a non-credential provider", () => {
        expect(
            mapPasswordChange({ id: "acc_1", userId: subjectId, providerId: "github" }, true),
        ).toBeNull();
    });
});

describe("mapAccountLink", () => {
    it("records a social account link against the account, with the user as context", () => {
        const entry = mapAccountLink(
            { id: "acc_1", userId: subjectId, providerId: "github" },
            "Create",
            null,
        );

        expect(entry).toMatchObject({
            scope: "user",
            ownerId: subjectId,
            action: "Create",
            objectType: "Account",
            objectId: "acc_1",
        });
        expect(entry!.changes).toContainEqual({
            type: "obj_add",
            path: ["providerId"],
            curr: "github",
        });
        expect(entry!.refs).toEqual([{ objectType: "User", objectId: subjectId, role: "context" }]);
    });

    it("records an unlink as a Delete", () => {
        const entry = mapAccountLink(
            { id: "acc_1", userId: subjectId, providerId: "google" },
            "Delete",
            null,
        );
        expect(entry!.action).toBe("Delete");
    });

    it("ignores the credential provider — that is a password, not a linked account", () => {
        expect(
            mapAccountLink(
                { id: "acc_1", userId: subjectId, providerId: "credential" },
                "Create",
                null,
            ),
        ).toBeNull();
    });
});

describe("mapImpersonation", () => {
    it("attributes the start to the impersonating admin, owned by the subject", () => {
        const entry = mapImpersonation(
            { id: "sess_1", userId: subjectId, impersonatedBy: adminId },
            "start",
        );

        expect(entry).toMatchObject({
            scope: "user",
            ownerId: subjectId,
            action: "Impersonate",
            objectType: "User",
            objectId: subjectId,
        });
        expect(entry!.actor).toEqual({ userId: adminId });
        expect(entry!.refs).toEqual([
            { objectType: "Session", objectId: "sess_1", role: "context" },
        ]);
        expect(entry!.description).toContain("Started");
    });

    it("records the end when the impersonated session is deleted", () => {
        const entry = mapImpersonation(
            { id: "sess_1", userId: subjectId, impersonatedBy: adminId },
            "end",
        );
        expect(entry!.action).toBe("Impersonate");
        expect(entry!.description).toContain("Stopped");
    });

    it("ignores an ordinary session with no impersonator", () => {
        expect(mapImpersonation({ id: "sess_1", userId: subjectId }, "start")).toBeNull();
    });
});
