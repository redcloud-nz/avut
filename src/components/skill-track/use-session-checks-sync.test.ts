/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

import { skillCheckSessionsEffects } from "@/client/skill-check-sessions-effects";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import {
    SessionCheck,
    SkillCheck,
    SkillCheckId,
    SkillCheckResultValue,
} from "@/lib/schemas/skill-check";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import type { SessionChecksData } from "@/lib/session-checks-sync";
import { trpc } from "@/trpc/client";
import type { MutationEffect } from "@/trpc/mutation-effector";

import { sessionChecksQueryOptions, useSessionChecksSync } from "./use-session-checks-sync";

const { listSessionChecksQuery } = vi.hoisted(() => ({
    listSessionChecksQuery:
        vi.fn<
            (
                input: { organizationId: string; skillCheckSessionId: string; since?: string },
                opts: { signal: AbortSignal },
            ) => Promise<SessionChecksData>
        >(),
}));

const organizationRef = vi.hoisted(() => ({ id: "" }));

vi.mock("@/hooks/use-organization", () => ({ useOrganization: () => organizationRef }));

vi.mock("@/trpc/client", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/trpc/client")>()),
    trpcClient: {
        skillCheckSessions: { listSessionChecks: { query: listSessionChecksQuery } },
    },
}));

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
}

describe("sessionChecksQueryOptions (delta queryFn)", () => {
    const T = {
        org: OrganizationId.create(),
        session: SkillCheckSessionId.create(),
        self: PersonId.create(),
        other: PersonId.create(),
        alice: PersonId.create(),
        bob: PersonId.create(),
        skill: SkillId.create(),
    };

    const sessionChecksKey = trpc.skillCheckSessions.listSessionChecks.queryKey({
        organizationId: T.org,
        skillCheckSessionId: T.session,
    });
    const ownKey = trpc.skillChecks.listSkillChecks.queryKey({
        organizationId: T.org,
        sessionId: T.session,
        ownChecksOnly: true,
    });

    const iso = (ms: number) => new Date(ms).toISOString();

    function makeCheck(
        assessorId: PersonId,
        assesseeId: PersonId,
        result: SkillCheckResultValue,
        recordedAt: number,
        overrides: Partial<SkillCheck> = {},
    ): SkillCheck {
        return {
            id: SkillCheckId.create(),
            organizationId: T.org,
            sessionId: T.session,
            assesseeId,
            assessorId,
            assessorLabel: null,
            skillId: T.skill,
            result,
            notes: "",
            status: "Draft",
            checkedAt: iso(0),
            recordedAt: iso(recordedAt),
            ...overrides,
        };
    }

    function withNames(check: SkillCheck): SessionCheck {
        return { ...check, assesseeName: "Assessee", skillName: "Skill", assessorName: "Assessor" };
    }

    function response(checks: SessionCheck[], cursor: number): SessionChecksData {
        return { checks, cursor: iso(cursor), sessionStatus: "Draft" };
    }

    let queryClient: QueryClient;
    const options = sessionChecksQueryOptions({
        organizationId: T.org,
        sessionId: T.session,
        selfPersonId: T.self,
    });

    function poll() {
        return queryClient.fetchQuery({ queryKey: options.queryKey, queryFn: options.queryFn });
    }

    /** Applies a mutation's write effects to the cache, as the effector does on success. */
    function applyEffects(effects: MutationEffect[]) {
        for (const effect of effects) {
            if (effect.type === "write") queryClient.setQueryData(effect.queryKey, effect.data);
        }
    }

    function recordCheck(saved: SkillCheck) {
        applyEffects(
            skillCheckSessionsEffects.setSessionSkillCheck(
                {
                    organizationId: T.org,
                    skillCheckSessionId: T.session,
                    assesseeId: saved.assesseeId,
                    skillId: saved.skillId,
                    result: saved.result,
                    notes: saved.notes,
                },
                saved,
            ),
        );
    }

    function deleteCheck(tombstone: SkillCheck) {
        applyEffects(
            skillCheckSessionsEffects.deleteSessionSkillCheck(
                {
                    organizationId: T.org,
                    skillCheckSessionId: T.session,
                    assesseeId: tombstone.assesseeId,
                    skillId: tombstone.skillId,
                },
                { deleted: true, check: tombstone },
            ),
        );
    }

    const sessionData = () => queryClient.getQueryData<SessionChecksData>(sessionChecksKey);
    const ownData = () => queryClient.getQueryData<SkillCheck[]>(ownKey);

    beforeEach(() => {
        listSessionChecksQuery.mockReset();
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    });

    it("fetches without since first, then passes the cursor and keeps the later one", async () => {
        listSessionChecksQuery
            .mockResolvedValueOnce(response([], 1_000))
            .mockResolvedValueOnce(response([], 2_000))
            .mockResolvedValueOnce(response([], 1_500));

        await poll();
        await poll();
        await poll();

        const calls = listSessionChecksQuery.mock.calls;
        expect(calls[0][0]).toEqual({
            organizationId: T.org,
            skillCheckSessionId: T.session,
            since: undefined,
        });
        expect(calls[0][1].signal).toBeInstanceOf(AbortSignal);
        expect(calls[1][0].since).toBe(iso(1_000));
        expect(calls[2][0].since).toBe(iso(2_000));
        expect(sessionData()?.cursor).toBe(iso(2_000));
    });

    it("keeps a cache write made while the fetch was in flight", async () => {
        const bobByOther = withNames(makeCheck(T.other, T.bob, "Pass", 1_000));
        listSessionChecksQuery.mockResolvedValueOnce(response([bobByOther], 1_000));
        await poll();

        const inFlight = deferred<SessionChecksData>();
        listSessionChecksQuery.mockReturnValueOnce(inFlight.promise);
        const pending = poll();

        const saved = makeCheck(T.self, T.alice, "Pass", 3_000);
        recordCheck(saved);

        const bobUpdated = { ...bobByOther, result: "Fail" as const, recordedAt: iso(2_000) };
        inFlight.resolve(response([bobUpdated], 2_000));
        await pending;

        expect(sessionData()?.checks).toEqual([
            bobUpdated,
            { ...saved, assesseeName: "", skillName: "", assessorName: "" },
        ]);
    });

    it("patches the caller's rows from another device into the own list, and no one else's", async () => {
        queryClient.setQueryData(ownKey, []);
        listSessionChecksQuery.mockResolvedValueOnce(response([], 1_000));
        await poll();

        const ownFromElsewhere = makeCheck(T.self, T.alice, "Pass", 2_000);
        const others = makeCheck(T.other, T.bob, "Pass", 2_000);
        listSessionChecksQuery.mockResolvedValueOnce(
            response([withNames(ownFromElsewhere), withNames(others)], 2_000),
        );
        await poll();

        expect(ownData()).toEqual([ownFromElsewhere]);
    });

    it("keeps a check deleted while a poll was in flight gone from both caches", async () => {
        queryClient.setQueryData(ownKey, []);
        listSessionChecksQuery.mockResolvedValueOnce(response([], 1_000));
        await poll();

        const created = makeCheck(T.self, T.alice, "Pass", 2_000);
        recordCheck(created);

        const inFlight = deferred<SessionChecksData>();
        listSessionChecksQuery.mockReturnValueOnce(inFlight.promise);
        const pending = poll();

        const tombstone = { ...created, status: "Deleted" as const, recordedAt: iso(3_000) };
        deleteCheck(tombstone);

        // The poll read the row before the delete.
        inFlight.resolve(response([withNames(created)], 2_500));
        await pending;

        expect(ownData()).toEqual([]);
        const rows = sessionData()?.checks.filter((check) => check.id === created.id);
        expect(rows).toHaveLength(1);
        expect(rows?.[0].status).toBe("Deleted");
    });

    it("doesn't bring back an own check deleted during the first load", async () => {
        const existing = makeCheck(T.self, T.alice, "Pass", 1_000);
        queryClient.setQueryData(ownKey, [existing]);

        const inFlight = deferred<SessionChecksData>();
        listSessionChecksQuery.mockReturnValueOnce(inFlight.promise);
        const pending = poll();

        deleteCheck({ ...existing, status: "Deleted", recordedAt: iso(2_000) });
        expect(ownData()).toEqual([]);

        // The first load read the row before the delete.
        inFlight.resolve(response([withNames(existing)], 1_500));
        await pending;

        expect(ownData()).toEqual([]);
    });

    describe("useSessionChecksSync", () => {
        const getSessionKey = trpc.skillCheckSessions.getSession.queryKey({
            organizationId: T.org,
            skillCheckSessionId: T.session,
        });

        function renderSync() {
            organizationRef.id = T.org;
            const wrapper = ({ children }: { children: ReactNode }) =>
                createElement(QueryClientProvider, { client: queryClient }, children);
            return renderHook(
                () =>
                    useSessionChecksSync({
                        sessionId: T.session,
                        selfPersonId: T.self,
                        enabled: true,
                    }),
                { wrapper },
            );
        }

        /** How many times `getSession` for the session has been invalidated. */
        function getSessionInvalidations(spy: { mock: { calls: unknown[][] } }) {
            return spy.mock.calls.filter(
                ([filters]) =>
                    JSON.stringify((filters as { queryKey?: unknown }).queryKey) ===
                    JSON.stringify(getSessionKey),
            ).length;
        }

        it("refetches the session once when a poll reports a status changed elsewhere", async () => {
            // Only `status` is read from the cached session.
            queryClient.setQueryData(getSessionKey, { status: "Draft" } as never);
            const invalidate = vi.spyOn(queryClient, "invalidateQueries");

            listSessionChecksQuery.mockResolvedValue({
                ...response([], 1_000),
                sessionStatus: "Include",
            });

            const { result, unmount } = renderSync();
            await waitFor(() => expect(result.current?.sessionStatus).toBe("Include"));
            await waitFor(() => expect(getSessionInvalidations(invalidate)).toBe(1));

            // The refetched session now matches, and a second poll reports the same status.
            queryClient.setQueryData(getSessionKey, { status: "Include" } as never);
            await act(() => queryClient.refetchQueries({ queryKey: sessionChecksKey }));

            expect(listSessionChecksQuery).toHaveBeenCalledTimes(2);
            expect(getSessionInvalidations(invalidate)).toBe(1);
            unmount();
        });
    });
});
