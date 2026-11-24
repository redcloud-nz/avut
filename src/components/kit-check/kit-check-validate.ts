/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import {
    NOT_NEEDED,
    type KitCheckAnswer,
    type KitCheckHeldItem,
    type KitCheckProposal,
    type KitCheckProposalAnswer,
    type KitCheckTemplate,
} from "./kit-check-types";

/** The variant id a member picks for a template with no variants: any one of it. */
export const ANY_VARIANT = "any";

export const EMPTY_ANSWER: KitCheckAnswer = {
    has: null,
    serial: "",
    variantId: "",
    replace: false,
    replaceWith: null,
    wantVariantId: "",
    size: "",
    notes: "",
};

/** The answer fields a check can ask for, beyond the free notes. */
export type KitCheckField = Exclude<keyof KitCheckAnswer, "notes">;

/** Which follow-up fields an answer shows, given what it says so far. */
export function visibleFields(
    answer: KitCheckAnswer,
    template: KitCheckTemplate,
    held: KitCheckHeldItem | null,
): Set<KitCheckField> {
    const fields = new Set<KitCheckField>(["has"]);
    const hasVariants = template.variants.length > 0;
    if (answer.has === "yes") {
        if (held ? held.problems.includes("serial") : template.requireSN) fields.add("serial");
        // Only with variants to pick from: otherwise the only choice would be "Other".
        if (hasVariants && (held ? held.problems.includes("variant") : true))
            fields.add("variantId");
        fields.add("replace");
        if (answer.replace) {
            // Same-or-different only means something when there are variants to differ by.
            if (hasVariants) fields.add("replaceWith");
            if (answer.replaceWith === "different" && hasVariants) fields.add("wantVariantId");
            if ((answer.replaceWith !== null || !hasVariants) && template.sized) fields.add("size");
        }
    } else if (answer.has === "no" && !template.optional) {
        // An optional item (only some members hold one) asks nothing more of a No.
        fields.add("wantVariantId");
        if (answer.wantVariantId !== "" && answer.wantVariantId !== NOT_NEEDED && template.sized)
            fields.add("size");
    }
    return fields;
}

/** The visible fields still to fill in, each with what to tell the member. */
export function answerErrors(
    answer: KitCheckAnswer,
    template: KitCheckTemplate,
    held: KitCheckHeldItem | null,
): Partial<Record<KitCheckField, string>> {
    const visible = visibleFields(answer, template, held);
    const errors: Partial<Record<KitCheckField, string>> = {};
    if (answer.has === null) errors.has = "Please answer this one.";
    if (visible.has("serial") && answer.serial.trim() === "")
        errors.serial = "Please add the serial number.";
    if (visible.has("variantId") && answer.variantId === "")
        errors.variantId = "Please pick which one you have.";
    if (visible.has("replaceWith") && answer.replaceWith === null)
        errors.replaceWith = "Same as you have, or a different one?";
    if (visible.has("wantVariantId") && answer.wantVariantId === "")
        errors.wantVariantId =
            answer.has === "no"
                ? "Please pick one, or say you don't need one."
                : "Please pick one.";
    if (visible.has("size") && !template.sizeOptional && answer.size.trim() === "")
        errors.size = "Please give your size.";
    return errors;
}

export const EMPTY_PROPOSAL_ANSWER: KitCheckProposalAnswer = {
    interest: null,
    fit: "",
    size: "",
    notes: "",
};

/** The fit an answer is sizing against: the one picked, or the only one there is. */
export function proposalFit(
    answer: KitCheckProposalAnswer,
    proposal: KitCheckProposal,
): KitCheckProposal["fits"][number] | null {
    if (proposal.fits.length === 1) return proposal.fits[0];
    return proposal.fits.find((fit) => fit.id === answer.fit) ?? null;
}

/**
 * What a proposal answer still needs: whether they'd use one, then (if they would) the fit when
 * there's a choice, then a size from that fit.
 */
export function proposalErrors(
    answer: KitCheckProposalAnswer,
    proposal: KitCheckProposal,
): { interest?: string; fit?: string; size?: string } {
    if (answer.interest === null) return { interest: "Please answer this one." };
    if (answer.interest !== "yes" || proposal.fits.length === 0) return {};
    const fit = proposalFit(answer, proposal);
    if (!fit) return { fit: "Please pick a fit." };
    if (fit.sizes.length > 0 && answer.size === "") return { size: "Please give your size." };
    return {};
}

/** Whether an answer asks for a new item. */
export function wantsOne(answer: KitCheckAnswer): boolean {
    if (answer.has === "yes") return answer.replace;
    if (answer.has === "no")
        return answer.wantVariantId !== "" && answer.wantVariantId !== NOT_NEEDED;
    return false;
}
