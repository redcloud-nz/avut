/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import type {
    SelfAuditAnswerData,
    SelfAuditHeldItem,
    SelfAuditResponseData,
    SelfAuditTemplate,
} from "@/lib/schemas/self-audit";
import { NOT_NEEDED, OTHER_VARIANT } from "@/lib/self-audit-types";
import { ANY_VARIANT, EMPTY_ANSWER } from "@/lib/self-audit-validate";

import { buildNeedsReport, needsReportCsv, type SelfAuditNeedsSource } from "./self-audit-needs";

const helmet: SelfAuditTemplate = {
    id: "helmet",
    category: "PPE",
    name: "Helmet",
    variants: [
        { id: "vertex", label: "Petzl Vertex" },
        { id: "strato", label: "Petzl Strato" },
    ],
    requireSN: false,
    sized: false,
    sizeOptions: [],
};
const gloves: SelfAuditTemplate = {
    id: "gloves",
    category: "PPE",
    name: "Gloves",
    variants: [],
    requireSN: false,
    sized: true,
    sizeOptions: ["S", "M", "L"],
};
const boots: SelfAuditTemplate = {
    id: "boots",
    category: "PPE",
    name: "Boots",
    variants: [{ id: "haix", label: "Haix" }],
    requireSN: false,
    sized: true,
    sizeOptions: [],
};
const templates = [helmet, gloves, boots];

function held(id: string, templateId: string, variantId: string | null): SelfAuditHeldItem {
    return { id, templateId, description: id, serial: null, variantId, problems: [] };
}

function answer(fields: Partial<SelfAuditAnswerData>): SelfAuditAnswerData {
    return { ...EMPTY_ANSWER, has: null, ...fields };
}

function response(fields: Partial<SelfAuditResponseData>): SelfAuditResponseData {
    return { held: {}, missing: {}, extras: [], comments: "", ...fields };
}

function request(
    memberName: string,
    heldItems: SelfAuditHeldItem[],
    data: Partial<SelfAuditResponseData>,
): SelfAuditNeedsSource {
    return { memberName, heldItems, submittedData: response(data) };
}

/** The groups as `[template, variant, size, count, members]`. */
function groupsOf(requests: SelfAuditNeedsSource[]) {
    return buildNeedsReport({ templates, requests }).groups.map((group) => [
        group.templateName,
        group.variantLabel,
        group.size,
        group.count,
        group.members,
    ]);
}

describe("buildNeedsReport", () => {
    it("labels a replacement of the same by the held item's variant", () => {
        const requests = [
            request("Ana", [held("1", "helmet", "strato")], {
                held: { "1": answer({ has: "yes", replace: true, replaceWith: "same" }) },
            }),
        ];
        expect(groupsOf(requests)).toEqual([
            ["Helmet", "Petzl Strato", "No size given", 1, ["Ana"]],
        ]);
    });

    it("falls back to the answer's variant, then Unknown, for a replacement of the same", () => {
        const requests = [
            request("Ana", [held("1", "helmet", null)], {
                held: {
                    "1": answer({
                        has: "yes",
                        variantId: "vertex",
                        replace: true,
                        replaceWith: "same",
                    }),
                },
            }),
            request("Bo", [held("2", "helmet", null)], {
                held: {
                    "2": answer({
                        has: "yes",
                        variantId: OTHER_VARIANT,
                        replace: true,
                        replaceWith: "same",
                    }),
                },
            }),
            request("Cy", [held("3", "helmet", null)], {
                held: { "3": answer({ has: "yes", replace: true, replaceWith: "same" }) },
            }),
        ];
        expect(groupsOf(requests)).toEqual([
            ["Helmet", "Other", "No size given", 1, ["Bo"]],
            ["Helmet", "Petzl Vertex", "No size given", 1, ["Ana"]],
            ["Helmet", "Unknown", "No size given", 1, ["Cy"]],
        ]);
    });

    it("labels a replacement of a different one by the wanted variant, Other included", () => {
        const requests = [
            request("Ana", [held("1", "helmet", "vertex")], {
                held: {
                    "1": answer({
                        has: "yes",
                        replace: true,
                        replaceWith: "different",
                        wantVariantId: "strato",
                    }),
                },
            }),
            request("Bo", [held("2", "helmet", "vertex")], {
                held: {
                    "2": answer({
                        has: "yes",
                        replace: true,
                        replaceWith: "different",
                        wantVariantId: OTHER_VARIANT,
                    }),
                },
            }),
        ];
        expect(groupsOf(requests)).toEqual([
            ["Helmet", "Other", "No size given", 1, ["Bo"]],
            ["Helmet", "Petzl Strato", "No size given", 1, ["Ana"]],
        ]);
    });

    it("counts a member who has none, with and without a size, and Any", () => {
        const requests = [
            request("Ana", [], {
                missing: { gloves: answer({ has: "no", wantVariantId: ANY_VARIANT, size: " M " }) },
            }),
            request("Bo", [], {
                missing: { gloves: answer({ has: "no", wantVariantId: ANY_VARIANT, size: "" }) },
            }),
            request("Cy", [], {
                missing: { gloves: answer({ has: "no", wantVariantId: ANY_VARIANT, size: "M" }) },
            }),
        ];
        expect(groupsOf(requests)).toEqual([
            ["Gloves", "Any", "M", 2, ["Ana", "Cy"]],
            ["Gloves", "Any", "No size given", 1, ["Bo"]],
        ]);
    });

    it("labels a replacement of a template with no variants —", () => {
        const requests = [
            request("Ana", [held("1", "gloves", null)], {
                held: { "1": answer({ has: "yes", replace: true, size: "L" }) },
            }),
        ];
        expect(groupsOf(requests)).toEqual([["Gloves", "—", "L", 1, ["Ana"]]]);
    });

    it("leaves out not needed, unsure, unanswered and kept items", () => {
        const requests = [
            request("Ana", [held("1", "helmet", "vertex"), held("2", "helmet", "vertex")], {
                held: {
                    "1": answer({ has: "unsure", wantVariantId: "strato" }),
                    "2": answer({ has: "yes" }),
                },
                missing: {
                    gloves: answer({ has: "no", wantVariantId: NOT_NEEDED }),
                    boots: answer({ has: null }),
                },
            }),
        ];
        expect(groupsOf(requests)).toEqual([]);
    });

    it("ignores answers to items or templates not in the snapshot", () => {
        const requests = [
            request("Ana", [held("1", "radio", null)], {
                held: {
                    "1": answer({ has: "yes", replace: true }),
                    "9": answer({ has: "yes", replace: true }),
                },
                missing: { radio: answer({ has: "no", wantVariantId: ANY_VARIANT }) },
            }),
        ];
        expect(groupsOf(requests)).toEqual([]);
    });

    it("groups by template in stored order, then variant, then size, members sorted", () => {
        const requests = [
            request("Zoe", [], {
                missing: {
                    boots: answer({ has: "no", wantVariantId: "haix", size: "10" }),
                    helmet: answer({ has: "no", wantVariantId: "vertex" }),
                },
            }),
            request("Ana", [], {
                missing: {
                    boots: answer({ has: "no", wantVariantId: "haix", size: "9" }),
                    gloves: answer({ has: "no", wantVariantId: ANY_VARIANT, size: "S" }),
                    helmet: answer({ has: "no", wantVariantId: "vertex" }),
                },
            }),
        ];
        expect(groupsOf(requests)).toEqual([
            ["Helmet", "Petzl Vertex", "No size given", 2, ["Ana", "Zoe"]],
            ["Gloves", "Any", "S", 1, ["Ana"]],
            ["Boots", "Haix", "9", 1, ["Ana"]],
            ["Boots", "Haix", "10", 1, ["Zoe"]],
        ]);
        expect(buildNeedsReport({ templates, requests }).groups[0]).toMatchObject({
            templateId: "helmet",
            category: "PPE",
        });
    });

    it("lists extra needs separately, leaving out what they have", () => {
        const requests = [
            request("Zoe", [], {
                extras: [
                    { id: "e1", item: "Head torch ", kind: "need", size: "", notes: "Petzl" },
                    { id: "e2", item: "Knife", kind: "have", size: "", notes: "" },
                    { id: "e3", item: "Whistle", kind: null, size: "", notes: "" },
                ],
            }),
            request("Ana", [], {
                extras: [{ id: "e1", item: "Socks", kind: "need", size: "L", notes: "" }],
            }),
        ];
        expect(buildNeedsReport({ templates, requests })).toEqual({
            groups: [],
            extras: [
                { memberName: "Ana", item: "Socks", size: "L", notes: "" },
                { memberName: "Zoe", item: "Head torch", size: "", notes: "Petzl" },
            ],
        });
    });
});

describe("needsReportCsv", () => {
    it("writes a row per need, then the extra needs, escaping cells", () => {
        const requests = [
            request("Smith, John", [held("1", "helmet", "vertex")], {
                held: {
                    "1": answer({
                        has: "yes",
                        replace: true,
                        replaceWith: "same",
                        notes: 'Cracked "badly"',
                    }),
                },
                missing: { gloves: answer({ has: "no", wantVariantId: ANY_VARIANT, size: "M" }) },
                extras: [{ id: "e1", item: "=Torch", kind: "need", size: "", notes: "" }],
            }),
            request("Ana Lee", [], {
                missing: { gloves: answer({ has: "no", wantVariantId: ANY_VARIANT, size: "M" }) },
            }),
        ];
        expect(needsReportCsv({ templates, requests }).split("\r\n")).toEqual([
            "Template,Variant,Size,Member,Reason,Notes",
            `Helmet,Petzl Vertex,No size given,"Smith, John",Replacement,"Cracked ""badly"""`,
            "Gloves,Any,M,Ana Lee,Has none,",
            `Gloves,Any,M,"Smith, John",Has none,`,
            `(not on list),'=Torch,No size given,"Smith, John",,`,
            "",
        ]);
    });
});
