/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Forms anyone with the page's address can answer without an account, under `/forms/<key>`, whose
 * organisation comes from a slug. Each answer is stored as a Submitted `FormInstance` with this
 * `formKey`, no user, in the owning organisation, and read back by that organisation's admins.
 * To add a form: an entry here, a schema for its answers, a submit procedure in `publicForms`,
 * and its page.
 *
 * Forms reached through a per-person emailed link, like the kit check (`/forms/kit-check/<token>`),
 * aren't listed here: the token finds the organisation and the record.
 */
export const PUBLIC_FORMS = {
    "chch-soft-shell-jacket": {
        label: "Christchurch soft shell jacket",
        /** The production slug. `PUBLIC_FORMS_ORGANIZATION_SLUG` overrides it (e.g. in dev). */
        organizationSlug: "chch-cdem",
    },
} as const;

export type PublicFormKey = keyof typeof PUBLIC_FORMS;

/**
 * The submit endpoints BotID guards: every `publicForms` tRPC call is a POST to
 * `/trpc/publicForms.<procedure>`. Shared by `src/instrumentation-client.ts` (which tags the
 * requests) and the procedures (which check them).
 *
 * The match is on the request path, so a submit must go out on its own: tRPC's batch link sends
 * mutations fired in the same tick as one request to `/trpc/a,b`, which matches nothing here, so
 * it goes untagged and `checkBotId()` turns a real person away. Fire one submit at a time.
 */
export const PUBLIC_FORM_BOT_PROTECTED_PATHS = [
    { path: "/trpc/publicForms.submitJacketInterest", method: "POST" },
] as const;
