/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { authClient } from "@/client/auth-client";
import { InvitationId } from "@/lib/schemas/organization-invitation";
import { trpc } from "@/trpc/client";

import { InvitationSignIn_Form } from "./invitation-sign-in";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("@/client/auth-client", () => ({
    authClient: {
        signIn: { email: vi.fn(), social: vi.fn() },
        emailOtp: { sendVerificationOtp: vi.fn().mockResolvedValue({ error: null }) },
    },
}));

const INVITATION_ID = InvitationId.create();
const EMAIL = "ada+invite@example.com";

function renderForm() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    render(
        <QueryClientProvider client={queryClient}>
            <InvitationSignIn_Form invitationId={INVITATION_ID} email={EMAIL} />
        </QueryClientProvider>,
    );
    return { invalidate };
}

async function submitPassword(password = "hunter2hunter2") {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Password"), password);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("InvitationSignIn_Form", () => {
    beforeEach(() => vi.clearAllMocks());

    it("shows the invited address as a read-only username the password manager can see", () => {
        renderForm();

        const email = screen.getByLabelText("Email Address");
        expect(email).toHaveValue(EMAIL);
        expect(email).toHaveAttribute("readonly");
        expect(email).toHaveAttribute("autocomplete", "username");
    });

    it("refreshes the page and drops the stale session and landing caches on success", async () => {
        vi.mocked(authClient.signIn.email).mockResolvedValue({ data: {}, error: null } as never);
        const { invalidate } = renderForm();

        await submitPassword();

        await vi.waitFor(() => expect(router.refresh).toHaveBeenCalled());
        expect(authClient.signIn.email).toHaveBeenCalledWith({
            email: EMAIL,
            password: "hunter2hunter2",
        });
        expect(invalidate).toHaveBeenCalledWith(trpc.user.getSession.queryFilter());
        expect(invalidate).toHaveBeenCalledTimes(2);
        expect(router.push).not.toHaveBeenCalled();
    });

    it("sends a verification code and continues at verify-email when the email was never verified", async () => {
        vi.mocked(authClient.signIn.email).mockResolvedValue({
            data: null,
            error: { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" },
        } as never);
        renderForm();

        await submitPassword();

        await vi.waitFor(() => expect(router.push).toHaveBeenCalled());
        expect(authClient.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
            email: EMAIL,
            type: "email-verification",
        });
        const target = String(router.push.mock.calls[0][0]);
        expect(target).toContain(`/auth/verify-email/${encodeURIComponent(EMAIL)}`);
        expect(target).toContain(
            `redirectTo=${encodeURIComponent(`/invitations/${INVITATION_ID}`)}`,
        );
        expect(router.refresh).not.toHaveBeenCalled();
    });

    it("shows the error and sends no code when the password is wrong", async () => {
        vi.mocked(authClient.signIn.email).mockResolvedValue({
            data: null,
            error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" },
        } as never);
        renderForm();

        await submitPassword();

        expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
        expect(authClient.emailOtp.sendVerificationOtp).not.toHaveBeenCalled();
        expect(router.push).not.toHaveBeenCalled();
        expect(router.refresh).not.toHaveBeenCalled();
    });
});
