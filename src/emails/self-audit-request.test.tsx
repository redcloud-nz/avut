/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { render } from "@react-email/components";

import SelfAuditRequestEmail, {
    selfAuditRequestSubject,
    type SelfAuditRequestEmailProps,
} from "./self-audit-request";

const props: SelfAuditRequestEmailProps = {
    organization: { name: "Acme SAR" },
    member: { name: "John Smith" },
    team: { name: "Alpha Team" },
    bundle: { name: "Responder" },
    requestedBy: "Ana Lee",
    formUrl: "https://www.avut.nz/forms/kit-check/TOKEN123",
    // 11:00 on Wednesday 9 December in Auckland (NZDT, UTC+13): still the 9th there.
    expiresAt: new Date("2026-12-08T22:00:00Z"),
    timeZone: "Pacific/Auckland",
    recipientEmail: "john@example.com",
};

describe("selfAuditRequestSubject", () => {
    it("names the bundle", () => {
        expect(selfAuditRequestSubject(props.bundle)).toBe("Self-audit: Responder");
    });
});

describe("SelfAuditRequestEmail", () => {
    it("greets the member and names the sender, bundle, team and org", async () => {
        const text = await render(<SelfAuditRequestEmail {...props} />, { plainText: true });

        expect(text).toContain("Hi John Smith,");
        expect(text).toContain("Ana Lee has asked you to check your Responder kit");
        expect(text).toContain("Alpha Team (Acme SAR)");
        expect(text).toContain("john@example.com");
    });

    it("renders the link and its expiry in the org's time zone", async () => {
        const text = await render(<SelfAuditRequestEmail {...props} />, { plainText: true });
        expect(text).toContain("The link works until Wed 9 Dec 2026.");

        const html = await render(<SelfAuditRequestEmail {...props} />);
        expect(html).toContain('href="https://www.avut.nz/forms/kit-check/TOKEN123"');
    });
});
