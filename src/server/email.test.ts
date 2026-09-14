/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterEach, describe, expect, it } from "vitest";

import { emailDelivery, redirectEmail, redirectRecipient } from "./email";

describe("emailDelivery", () => {
    const original = { ...process.env };

    afterEach(() => {
        process.env.VERCEL_ENV = original.VERCEL_ENV;
        process.env.EMAIL_DELIVERY = original.EMAIL_DELIVERY;
        if (original.VERCEL_ENV === undefined) delete process.env.VERCEL_ENV;
        if (original.EMAIL_DELIVERY === undefined) delete process.env.EMAIL_DELIVERY;
    });

    it("redirects when nothing says otherwise — the local and CI case", () => {
        delete process.env.VERCEL_ENV;
        delete process.env.EMAIL_DELIVERY;

        expect(emailDelivery()).toBe("redirect");
    });

    it("redirects on a preview deployment", () => {
        process.env.VERCEL_ENV = "preview";

        expect(emailDelivery()).toBe("redirect");
    });

    it("delivers on the production deployment", () => {
        process.env.VERCEL_ENV = "production";

        expect(emailDelivery()).toBe("live");
    });

    it("lets EMAIL_DELIVERY force real mail out of a preview", () => {
        process.env.VERCEL_ENV = "preview";
        process.env.EMAIL_DELIVERY = "live";

        expect(emailDelivery()).toBe("live");
    });

    it("lets EMAIL_DELIVERY mute production", () => {
        process.env.VERCEL_ENV = "production";
        process.env.EMAIL_DELIVERY = "redirect";

        expect(emailDelivery()).toBe("redirect");
    });

    // A typo in the override must not silently open the gate.
    it("ignores an unrecognised EMAIL_DELIVERY value", () => {
        delete process.env.VERCEL_ENV;
        process.env.EMAIL_DELIVERY = "yes-please";

        expect(emailDelivery()).toBe("redirect");
    });
});

describe("redirectRecipient", () => {
    it("encodes the intended address into the sink's tag", () => {
        expect(redirectRecipient("alex@example.com")).toBe(
            "delivered+alex_at_example.com@resend.dev",
        );
    });

    it("strips a display name", () => {
        expect(redirectRecipient("Alex Westphal <alex@example.com>")).toBe(
            "delivered+alex_at_example.com@resend.dev",
        );
    });

    it("folds case, so one person is one sink address", () => {
        expect(redirectRecipient("Alex@Example.COM")).toBe(
            "delivered+alex_at_example.com@resend.dev",
        );
    });

    it("replaces characters a local part cannot carry", () => {
        expect(redirectRecipient("alex+tag@example.com")).toBe(
            "delivered+alex-tag_at_example.com@resend.dev",
        );
    });

    // The I3 notification is already addressed to the simulator; re-encoding it would only
    // make the dashboard harder to read.
    it("passes a resend.dev address through untouched", () => {
        expect(redirectRecipient("delivered+i3-notify@resend.dev")).toBe(
            "delivered+i3-notify@resend.dev",
        );
    });
});

describe("redirectEmail", () => {
    const payload = {
        from: "no-reply@mx.avut.nz",
        to: "alex@example.com",
        subject: "Invitation to join Acme on AVUT",
        text: "Come and join us.",
    } as const;

    it("sends to the sink instead of the person", () => {
        const redirected = redirectEmail({ ...payload });

        expect(redirected.to).toBe("delivered+alex_at_example.com@resend.dev");
    });

    it("says so in the subject", () => {
        const redirected = redirectEmail({ ...payload });

        expect(redirected.subject).toBe("[dev → alex@example.com] Invitation to join Acme on AVUT");
    });

    it("keeps the intended recipients in a header for the dashboard", () => {
        const redirected = redirectEmail({
            ...payload,
            cc: ["boss@example.com"],
            bcc: "audit@example.com",
        });

        expect(redirected.headers?.["X-AVUT-Intended-Recipients"]).toBe(
            "alex@example.com, boss@example.com, audit@example.com",
        );
    });

    it("redirects cc and bcc too — both of them deliver", () => {
        const redirected = redirectEmail({
            ...payload,
            cc: ["boss@example.com"],
            bcc: "audit@example.com",
        });

        expect(redirected.cc).toEqual(["delivered+boss_at_example.com@resend.dev"]);
        expect(redirected.bcc).toBe("delivered+audit_at_example.com@resend.dev");
    });

    it("leaves cc and bcc absent when the original had none", () => {
        const redirected = redirectEmail({ ...payload });

        expect(redirected).not.toHaveProperty("cc");
        expect(redirected).not.toHaveProperty("bcc");
    });

    it("collapses addresses that share a sink tag", () => {
        const redirected = redirectEmail({
            ...payload,
            to: ["alex@example.com", "Alex@EXAMPLE.com"],
        });

        expect(redirected.to).toEqual(["delivered+alex_at_example.com@resend.dev"]);
    });

    it("abbreviates the subject notice for a large recipient list", () => {
        const redirected = redirectEmail({
            ...payload,
            to: ["a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com"],
        });

        expect(redirected.subject).toBe(
            "[dev → a@x.com, b@x.com, c@x.com +2 more] Invitation to join Acme on AVUT",
        );
    });

    it("carries the body through unchanged", () => {
        const redirected = redirectEmail({ ...payload });

        expect(redirected).toMatchObject({ from: payload.from, text: payload.text });
    });

    it("preserves headers the caller set", () => {
        const redirected = redirectEmail({ ...payload, headers: { "X-Entity-Ref-ID": "abc" } });

        expect(redirected.headers?.["X-Entity-Ref-ID"]).toBe("abc");
    });
});
