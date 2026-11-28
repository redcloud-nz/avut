/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import type {
    SelfAuditAnswerData,
    SelfAuditHeldItem,
    SelfAuditTemplate,
} from "@/lib/schemas/self-audit";
import {
    diffAnswers,
    type SelfAuditDiffInput,
    type SelfAuditLiveItem,
} from "@/lib/self-audit-differences";
import { OTHER_VARIANT } from "@/lib/self-audit-types";
import { EMPTY_ANSWER } from "@/lib/self-audit-validate";

const harness: SelfAuditTemplate = {
    id: "harness",
    category: "Rope",
    name: "Harness",
    variants: [
        { id: "avao", label: "Petzl Avao" },
        { id: "falcon", label: "Petzl Falcon" },
        { id: "nolink", label: "Unlinked variant" },
    ],
    requireSN: true,
    sized: false,
    sizeOptional: true,
    sizeOptions: [],
};

const helmet: SelfAuditTemplate = {
    id: "helmet",
    category: "PPE",
    name: "Helmet",
    variants: [],
    requireSN: false,
    sized: true,
    sizeOptional: true,
    sizeOptions: [],
};

function liveItem(id: number, overrides: Partial<SelfAuditLiveItem> = {}): SelfAuditLiveItem {
    return {
        id,
        ref: `R${id}`,
        serial: "SN1",
        kind: { resourceType: "EquipmentKind", id: 100, title: "Harness" },
        brand: { resourceType: "EquipmentBrand", id: 1, title: "Petzl" },
        model: { resourceType: "EquipmentModel", id: 11, title: "Avao" },
        ...overrides,
    };
}

function held(id: number, templateId = harness.id): SelfAuditHeldItem {
    return {
        id: String(id),
        templateId,
        description: "Petzl Avao",
        serial: "SN1",
        variantId: "avao",
        problems: [],
    };
}

const yes: SelfAuditAnswerData = { ...EMPTY_ANSWER, has: "yes" };
const no: SelfAuditAnswerData = { ...EMPTY_ANSWER, has: "no", wantVariantId: "not-needed" };

/** One held harness (item 1), live with the member, answered `heldAnswer`. */
function input(
    overrides: Partial<SelfAuditDiffInput> = {},
    heldAnswer: SelfAuditAnswerData = yes,
): SelfAuditDiffInput {
    return {
        templates: [harness, helmet],
        liveTemplateIds: [harness.id, helmet.id],
        snapshotHeld: [held(1)],
        live: { [harness.id]: [liveItem(1)], [helmet.id]: [] },
        answer: { held: { "1": heldAnswer }, missing: {}, extras: [], comments: "" },
        openTasks: [],
        permissions: { update: true, create: true },
        inTeam: true,
        variantD4H: {
            avao: { brandId: 1, brandTitle: "Petzl", modelId: 11, modelTitle: "Avao" },
            falcon: { brandId: 1, brandTitle: "Petzl", modelId: 12, modelTitle: "Falcon" },
        },
        templateD4H: {
            [harness.id]: { kindTitle: "Harness" },
            [helmet.id]: { kindTitle: "Helmet" },
        },
        ...overrides,
    };
}

describe("diffAnswers", () => {
    it("finds nothing when the answer agrees with D4H", () => {
        expect(diffAnswers(input())).toEqual([]);
        expect(diffAnswers(input({}, { ...yes, serial: " SN1 ", variantId: "avao" }))).toEqual([]);
    });

    describe("NotHeld", () => {
        it("is a PATCH to LOST with UPDATE", () => {
            expect(diffAnswers(input({}, no))).toEqual([
                expect.objectContaining({
                    key: "notheld:1:lost",
                    kind: "NotHeld",
                    itemId: 1,
                    label: "#R1 Harness",
                    fix: { type: "patch-lost" },
                    state: "selectable",
                }),
            ]);
        });

        it("falls back to a MarkLost task without UPDATE", () => {
            expect(
                diffAnswers(input({ permissions: { update: false, create: true } }, no)),
            ).toEqual([
                expect.objectContaining({
                    key: "notheld:1:task-lost",
                    kind: "NotHeld",
                    fix: { type: "task", taskKind: "MarkLost" },
                    state: "selectable",
                }),
            ]);
        });

        it("is Queued with an open MarkLost task, even with UPDATE", () => {
            const [difference] = diffAnswers(
                input({ openTasks: [{ resourceId: 1, kind: "MarkLost" }] }, no),
            );
            expect(difference).toMatchObject({
                fix: { type: "task", taskKind: "MarkLost" },
                state: "queued",
            });
        });

        it("is suppressed to info by an open Retire task", () => {
            const [difference] = diffAnswers(
                input({ openTasks: [{ resourceId: 1, kind: "Retire" }] }, no),
            );
            expect(difference).toMatchObject({
                kind: "NotHeld",
                fix: null,
                state: "info",
                reason: "Returned: retire task open",
            });
        });

        it("ignores an open task on another item or of another kind", () => {
            const [difference] = diffAnswers(
                input(
                    {
                        openTasks: [
                            { resourceId: 2, kind: "MarkLost" },
                            { resourceId: 1, kind: "SetSerial" },
                        ],
                    },
                    no,
                ),
            );
            expect(difference).toMatchObject({ fix: { type: "patch-lost" }, state: "selectable" });
        });

        it("finds nothing when the item already left the member", () => {
            expect(diffAnswers(input({ live: { [harness.id]: [] } }, no))).toEqual([]);
        });
    });

    describe("Serial", () => {
        it("queues a SetSerial task when the serial differs", () => {
            expect(diffAnswers(input({}, { ...yes, serial: " SN2 " }))).toEqual([
                expect.objectContaining({
                    key: "serial:1:task-serial=SN2",
                    kind: "Serial",
                    fix: { type: "task", taskKind: "SetSerial", serial: "SN2" },
                    state: "selectable",
                }),
            ]);
        });

        it("compares against a live item with no serial", () => {
            const [difference] = diffAnswers(
                input(
                    { live: { [harness.id]: [liveItem(1, { serial: null })] } },
                    {
                        ...yes,
                        serial: "SN2",
                    },
                ),
            );
            expect(difference).toMatchObject({
                kind: "Serial",
                detail: expect.stringContaining("no serial"),
            });
        });

        it("is Queued with an open SetSerial task", () => {
            const [difference] = diffAnswers(
                input(
                    { openTasks: [{ resourceId: 1, kind: "SetSerial" }] },
                    { ...yes, serial: "SN2" },
                ),
            );
            expect(difference).toMatchObject({ kind: "Serial", state: "queued" });
        });

        it("isn't Queued by an open SetVariant task", () => {
            const [difference] = diffAnswers(
                input(
                    { openTasks: [{ resourceId: 1, kind: "SetVariant" }] },
                    { ...yes, serial: "SN2" },
                ),
            );
            expect(difference).toMatchObject({ kind: "Serial", state: "selectable" });
        });

        it("names the serial in the key, encoded", () => {
            const [difference] = diffAnswers(input({}, { ...yes, serial: "A:1/2" }));
            expect(difference.key).toBe("serial:1:task-serial=A%3A1%2F2");
        });

        it("ignores a blank serial", () => {
            expect(diffAnswers(input({}, { ...yes, serial: "   " }))).toEqual([]);
        });
    });

    describe("Variant", () => {
        it("queues a SetVariant task with the variant's D4H titles", () => {
            expect(diffAnswers(input({}, { ...yes, variantId: "falcon" }))).toEqual([
                expect.objectContaining({
                    key: "variant:1:task-variant=Petzl/Falcon",
                    kind: "Variant",
                    fix: { type: "task", taskKind: "SetVariant", brand: "Petzl", model: "Falcon" },
                    state: "selectable",
                }),
            ]);
        });

        it("is Queued with an open SetVariant task", () => {
            const [difference] = diffAnswers(
                input(
                    { openTasks: [{ resourceId: 1, kind: "SetVariant" }] },
                    {
                        ...yes,
                        variantId: "falcon",
                    },
                ),
            );
            expect(difference).toMatchObject({ kind: "Variant", state: "queued" });
        });

        it("is unavailable when the variant has no D4H record", () => {
            const [difference] = diffAnswers(input({}, { ...yes, variantId: "nolink" }));
            expect(difference).toMatchObject({
                kind: "Variant",
                fix: null,
                state: "unavailable",
                reason: "Variant no longer linked to D4H",
            });
        });

        it("ignores OTHER_VARIANT", () => {
            expect(diffAnswers(input({}, { ...yes, variantId: OTHER_VARIANT }))).toEqual([]);
        });

        it("lists a serial and a variant difference on the same item", () => {
            const differences = diffAnswers(
                input({}, { ...yes, serial: "SN2", variantId: "falcon" }),
            );
            expect(differences.map((difference) => difference.key)).toEqual([
                "serial:1:task-serial=SN2",
                "variant:1:task-variant=Petzl/Falcon",
            ]);
        });
    });

    describe("Gone", () => {
        it("is info when a held item answered Yes is no longer live with the member", () => {
            expect(
                diffAnswers(input({ live: { [harness.id]: [] } }, { ...yes, serial: "SN2" })),
            ).toEqual([
                expect.objectContaining({
                    key: "gone:1",
                    kind: "Gone",
                    label: "Petzl Avao",
                    fix: null,
                    state: "info",
                }),
            ]);
        });
    });

    describe("Unrecorded", () => {
        const missingYes = (answer: Partial<SelfAuditAnswerData> = {}) => ({
            snapshotHeld: [],
            live: { [harness.id]: [], [helmet.id]: [] },
            answer: {
                held: {},
                missing: { [harness.id]: { ...yes, ...answer } },
                extras: [],
                comments: "",
            },
        });

        it("creates the item, with the picked variant and serial", () => {
            expect(
                diffAnswers(input(missingYes({ variantId: "falcon", serial: " SN9 " }))),
            ).toEqual([
                expect.objectContaining({
                    key: "unrecorded:harness:create=1/12/SN9",
                    kind: "Unrecorded",
                    templateId: harness.id,
                    itemId: null,
                    label: "Harness",
                    fix: {
                        type: "create",
                        variant: {
                            brandId: 1,
                            brandTitle: "Petzl",
                            modelId: 12,
                            modelTitle: "Falcon",
                        },
                        serial: "SN9",
                    },
                    state: "selectable",
                }),
            ]);
        });

        it("creates with no variant for OTHER_VARIANT or an unlinked one, and no blank serial", () => {
            for (const variantId of [OTHER_VARIANT, "nolink", ""]) {
                const [difference] = diffAnswers(input(missingYes({ variantId, serial: " " })));
                expect(difference.fix).toEqual({ type: "create", variant: null, serial: null });
                expect(difference.key).toBe("unrecorded:harness:create=-/-");
            }
        });

        it("is unavailable without CREATE", () => {
            const [difference] = diffAnswers(
                input({ ...missingYes(), permissions: { update: true, create: false } }),
            );
            expect(difference).toMatchObject({
                state: "unavailable",
                reason: "Needs D4H Equipment CREATE",
            });
        });

        it("is unavailable for a member no longer in the D4H team", () => {
            const [difference] = diffAnswers(input({ ...missingYes(), inTeam: false }));
            expect(difference).toMatchObject({
                state: "unavailable",
                reason: "No longer in the D4H team",
            });
        });

        it("drops out once the member live-holds an item of that kind", () => {
            expect(
                diffAnswers(
                    input({
                        ...missingYes(),
                        live: { [harness.id]: [liveItem(5)], [helmet.id]: [] },
                    }),
                ),
            ).toEqual([]);
        });

        it("ignores a missing template answered No or Not sure", () => {
            const base = missingYes();
            for (const has of ["no", "unsure", null] as const) {
                expect(
                    diffAnswers(
                        input({
                            ...base,
                            answer: {
                                ...base.answer,
                                missing: { [harness.id]: { ...EMPTY_ANSWER, has } },
                            },
                        }),
                    ),
                ).toEqual([]);
            }
        });
    });

    describe("a member no longer in the D4H team", () => {
        it("is still compared for held items", () => {
            const [difference] = diffAnswers(input({ inTeam: false }, no));
            expect(difference).toMatchObject({ kind: "NotHeld", state: "selectable" });
        });
    });

    describe("an unlinked template", () => {
        it("shows its answered lines as info only", () => {
            const differences = diffAnswers(
                input(
                    {
                        liveTemplateIds: [helmet.id],
                        live: { [helmet.id]: [] },
                        answer: {
                            held: { "1": no },
                            missing: { [harness.id]: yes },
                            extras: [],
                            comments: "",
                        },
                    },
                    no,
                ),
            );
            expect(differences).toEqual([
                {
                    key: "unlinked:harness",
                    kind: "Unlinked",
                    templateId: harness.id,
                    itemId: null,
                    label: "Harness",
                    detail: "Template no longer linked to D4H",
                    fix: null,
                    state: "info",
                },
            ]);
        });

        it("says nothing when none of its lines are answered", () => {
            expect(
                diffAnswers(
                    input(
                        { liveTemplateIds: [helmet.id], live: { [helmet.id]: [] } },
                        { ...EMPTY_ANSWER, has: null },
                    ),
                ),
            ).toEqual([]);
        });
    });

    it("ignores unsure, unanswered, and extra rows", () => {
        expect(diffAnswers(input({}, { ...EMPTY_ANSWER, has: "unsure" }))).toEqual([]);
        expect(diffAnswers(input({}, { ...EMPTY_ANSWER, has: null }))).toEqual([]);
        const base = input();
        expect(
            diffAnswers({
                ...base,
                answer: {
                    ...base.answer,
                    extras: [{ id: "x", item: "Knife", kind: "have", size: "", notes: "" }],
                },
            }),
        ).toEqual([]);
    });

    it("lists differences in the stored templates' order", () => {
        const differences = diffAnswers(
            input({
                templates: [helmet, harness],
                snapshotHeld: [held(1), held(2, helmet.id)],
                live: {
                    [harness.id]: [liveItem(1)],
                    [helmet.id]: [
                        liveItem(2, {
                            kind: { resourceType: "EquipmentKind", id: 50, title: "Helmet" },
                        }),
                    ],
                },
                answer: { held: { "1": no, "2": no }, missing: {}, extras: [], comments: "" },
            }),
        );
        expect(differences.map((difference) => difference.key)).toEqual([
            "notheld:2:lost",
            "notheld:1:lost",
        ]);
    });
});
