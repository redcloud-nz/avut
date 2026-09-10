/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { Operations } from "@/lib/operations";

import {
    LogAction,
    LogObjectType,
    LogRefRole,
    LogScope,
    moduleIdForObjectType,
    objectTypesForModule,
} from "./log-entry";

describe("log-entry vocabularies", () => {
    it("accepts every scope and rejects anything else", () => {
        for (const scope of ["organization", "user", "system"]) {
            expect(LogScope.schema.parse(scope)).toBe(scope);
        }
        expect(LogScope.schema.safeParse("global").success).toBe(false);
    });

    it("includes the actions added for the audit log", () => {
        for (const action of ["Ban", "Unban", "Impersonate", "Move"]) {
            expect(LogAction.schema.parse(action)).toBe(action);
        }
        expect(LogAction.schema.safeParse("Frobnicate").success).toBe(false);
    });

    it("includes the object types added for the audit log", () => {
        for (const objectType of ["User", "Account", "Session"]) {
            expect(LogObjectType.schema.parse(objectType)).toBe(objectType);
        }
        expect(LogObjectType.schema.safeParse("Widget").success).toBe(false);
    });

    it("accepts every ref role and rejects anything else", () => {
        for (const role of ["primary", "context", "from", "to"]) {
            expect(LogRefRole.schema.parse(role)).toBe(role);
        }
        expect(LogRefRole.schema.safeParse("related").success).toBe(false);
    });
});

describe("moduleIdForObjectType", () => {
    it("attributes org-admin entities to the admin module", () => {
        expect(moduleIdForObjectType("Person")).toBe("admin");
        expect(moduleIdForObjectType("Team")).toBe("admin");
        expect(moduleIdForObjectType("D4HAccessToken")).toBe("admin");
    });

    it("attributes skill authoring entities to skill-package-builder", () => {
        expect(moduleIdForObjectType("Skill")).toBe("skill-package-builder");
        expect(moduleIdForObjectType("SkillGroup")).toBe("skill-package-builder");
        expect(moduleIdForObjectType("SkillPackage")).toBe("skill-package-builder");
    });

    it("attributes skill check sessions to skill-track", () => {
        expect(moduleIdForObjectType("SkillCheckSession")).toBe("skill-track");
    });

    it("attributes i3 templates to i3", () => {
        expect(moduleIdForObjectType("I3Template")).toBe("i3");
        expect(moduleIdForObjectType("I3TemplateVariant")).toBe("i3");
    });

    it("returns null for account entities, which belong to no module", () => {
        expect(moduleIdForObjectType("User")).toBeNull();
        expect(moduleIdForObjectType("Account")).toBeNull();
        expect(moduleIdForObjectType("Session")).toBeNull();
    });
});

describe("objectTypesForModule", () => {
    it("generates the WHERE-IN list for a module feed", () => {
        expect(objectTypesForModule("i3").sort()).toEqual(["I3Template", "I3TemplateVariant"]);
    });

    it("returns an empty list for a module with no logged entities", () => {
        expect(objectTypesForModule("notes")).toEqual([]);
    });
});

describe("Operations", () => {
    it("names the two multi-entry operations that exist today", () => {
        expect(Object.keys(Operations).sort()).toEqual(["d4h-team-import", "d4h-team-sync"]);
    });

    it("gives every operation a human label", () => {
        for (const operation of Object.values(Operations)) {
            expect(operation.label.length).toBeGreaterThan(0);
        }
    });
});
