/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * The one place AVUT hands a message to Resend. Everything that emails — invitations, OTPs,
 * the email-changed notice, the I3 issue notification — comes through `sendEmail`, which is
 * what makes the guard rail below possible to enforce rather than merely remember.
 */

import "server-only";

import { CreateEmailOptions, Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend {
    return (_resend ??= new Resend(process.env.RESEND_API_KEY!));
}

export const NoReplyEmailAddress = process.env.NOREPLY_EMAIL || "no-reply@mx.avut.nz";

/** `live` puts the message on the wire as addressed; `redirect` sends it to Resend's sink. */
export type EmailDelivery = "live" | "redirect";

/**
 * Whether real mail is allowed out of this process.
 *
 * Fails closed: only the production deployment delivers to the address on the message. Local
 * development, `vercel dev`, and preview deployments all redirect, because they run against the
 * shared dev database — which holds records for **real people, with their real addresses**. A
 * single "Resend invitation" click while testing would email a stranger, and there is no
 * recalling it.
 *
 * `EMAIL_DELIVERY` overrides in either direction: `live` to genuinely send from a preview
 * deployment, `redirect` to mute production.
 */
export function emailDelivery(): EmailDelivery {
    const override = process.env.EMAIL_DELIVERY?.trim().toLowerCase();
    if (override === "live" || override === "redirect") return override;

    return process.env.VERCEL_ENV === "production" ? "live" : "redirect";
}

/** `"Alex Westphal <alex@example.com>"` → `"alex@example.com"` */
function bareAddress(recipient: string): string {
    const angled = /<([^>]*)>/.exec(recipient);
    return (angled?.[1] ?? recipient).trim().toLowerCase();
}

function asList(recipients: string | string[] | undefined): string[] {
    if (recipients === undefined) return [];
    return (typeof recipients === "string" ? [recipients] : recipients).map(bareAddress);
}

/**
 * The sink address standing in for `recipient`.
 *
 * Resend accepts anything at `delivered@resend.dev`, records it in the dashboard, and hands it
 * to no mailbox. The `+tag` is free-form, so the intended address is encoded into it — the
 * dashboard row then says who the message was *for* without a real address ever being used.
 *
 * An address already at `resend.dev` is passed through: those are the simulator's own
 * (`delivered@`, `bounced@`, `complained@`) and are safe as they stand.
 */
export function redirectRecipient(recipient: string): string {
    const address = bareAddress(recipient);
    if (address.endsWith("@resend.dev")) return address;

    const tag = address
        .replace("@", "_at_")
        .replace(/[^a-z0-9._-]/g, "-")
        .slice(0, 48);

    return `delivered+${tag}@resend.dev`;
}

function redirectAll(recipients: string | string[]): string | string[] {
    if (typeof recipients === "string") return redirectRecipient(recipients);
    return [...new Set(recipients.map(redirectRecipient))];
}

/** Named in the subject line so a redirected message is never mistaken for a delivered one. */
function redirectNotice(intended: string[]): string {
    const shown = intended.slice(0, 3).join(", ");
    const rest = intended.length - 3;

    return `[dev → ${shown || "no recipients"}${rest > 0 ? ` +${rest} more` : ""}]`;
}

/**
 * Rewrite every delivering field — `to`, `cc`, `bcc` — onto the sink, and say so in the subject.
 *
 * `replyTo` is deliberately left alone: it addresses nothing and sends nothing, and keeping it
 * intact means a redirected message still renders exactly as the real one would.
 */
export function redirectEmail(payload: CreateEmailOptions): CreateEmailOptions {
    const intended = [...asList(payload.to), ...asList(payload.cc), ...asList(payload.bcc)];

    // The union of `CreateEmailOptions` (react | html | text | template) does not survive a
    // spread with overrides; none of the overridden keys take part in discriminating it.
    return {
        ...payload,
        to: redirectAll(payload.to),
        ...(payload.cc !== undefined && { cc: redirectAll(payload.cc) }),
        ...(payload.bcc !== undefined && { bcc: redirectAll(payload.bcc) }),
        subject: `${redirectNotice(intended)} ${payload.subject ?? ""}`.trim(),
        headers: {
            ...payload.headers,
            // Survives into the message itself, so a test can confirm the right person *would*
            // have been mailed by reading the headers in the Resend dashboard.
            "X-AVUT-Intended-Recipients": intended.join(", "),
        },
    } as CreateEmailOptions;
}

export async function sendEmail(payload: CreateEmailOptions): Promise<void> {
    const delivery = emailDelivery();
    const outgoing = delivery === "live" ? payload : redirectEmail(payload);

    if (delivery === "redirect") {
        console.log(
            `Email redirected to the Resend sink (${process.env.VERCEL_ENV ?? "local"}):`,
            `"${payload.subject}" intended for ${asList(payload.to).join(", ") || "nobody"}`,
        );
    }

    try {
        const { error } = await getResend().emails.send(outgoing);

        if (error) console.error("Error sending email:", error);
    } catch (error) {
        console.error("Error sending email:", error);
    }
}
