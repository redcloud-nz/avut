/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { J307_JACKET } from "@/lib/j307-jacket";

import demoBundle from "./kit-check-demo-bundle.json";
import type {
    KitCheckHeldItem,
    KitCheckProposal,
    KitCheckSubject,
    KitCheckTemplate,
} from "./kit-check-types";

/**
 * Data for the public kit-check demo. The bundle's items are real: `kit-check-demo-bundle.json`
 * is exported from the dev database by `npm run kit-check:export`. The member and what D4H
 * "records" for them are made up, so no real person's data is shown.
 */
export const demoSubject: KitCheckSubject = {
    memberName: "Sam Sample",
    teamName: "Sample Search and Rescue",
    bundleName: demoBundle.bundleName,
    requestedBy: "the team equipment officer",
};

/**
 * Templates a member may answer "Using my own" for, by name. Mocked: templates don't record this
 * yet, so the demo keeps the list here (by name, so it survives a re-export).
 */
const DEMO_ALLOW_OWN = new Set([
    "Ear Muffs",
    "First Aid Kit (Personal)",
    "Gloves",
    "Head lamp",
    "Knee Pads",
    "RT Boots",
    "Safety Goggle",
    "Sun Hat",
    "Whistle",
]);

/** Items the team is considering buying, to gauge interest. Mocked: not I3 templates yet. */
export const demoProposals: KitCheckProposal[] = [
    {
        id: "soft-shell-jacket",
        name: `${J307_JACKET.name} (${J307_JACKET.maker} ${J307_JACKET.model})`,
        description: J307_JACKET.summary,
        fits: J307_JACKET.fits.map(({ id, label, sizes }) => ({ id, label, sizes })),
    },
];

/** Variants already carry the size (e.g. "… Sz 07"), so picking one is picking the size. */
export const demoTemplates: KitCheckTemplate[] = demoBundle.templates.map((template) => ({
    ...template,
    allowOwn: DEMO_ALLOW_OWN.has(template.name),
    sized: false,
    sizeOptions: [],
}));

/**
 * The sample member's "D4H records": every other main-bundle template, plus any that needs a
 * serial, plus the first "might have" one, so every section has items and the serial question can
 * show. The first record with a serial requirement lacks its serial and the first with variants
 * lacks its brand/model, so the demo shows both kinds of follow-up question.
 */
export const demoHeldItems: KitCheckHeldItem[] = (() => {
    let serialGapUsed = false;
    let variantGapUsed = false;
    const required = demoTemplates.filter((template) => !template.optional);
    const firstOptional = demoTemplates.find((template) => template.optional);
    return [
        ...required.filter((template, index) => index % 2 === 0 || template.requireSN),
        ...(firstOptional ? [firstOptional] : []),
    ].map((template, index) => {
        const variant = template.variants[Math.floor(template.variants.length / 2)] ?? null;
        const serialGap = template.requireSN && !serialGapUsed;
        if (serialGap) serialGapUsed = true;
        const variantGap = !serialGap && variant !== null && !variantGapUsed;
        if (variantGap) variantGapUsed = true;
        return {
            id: `sample-${template.id}`,
            templateId: template.id,
            description: variantGap || !variant ? template.name : variant.label,
            serial: template.requireSN && !serialGap ? `SAMPLE-${1001 + index}` : null,
            variantId: variantGap ? null : (variant?.id ?? null),
            problems: [
                ...(serialGap ? ["serial" as const] : []),
                ...(variantGap ? ["variant" as const] : []),
            ],
        };
    });
})();
