/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useSession } from "@/client/auth-queries";

import { ImpersonationBanner } from "./impersonation-banner";

vi.mock("@/client/auth-queries", () => ({ useSession: vi.fn() }));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/client/auth-client", () => ({
    authClient: { admin: { stopImpersonating: vi.fn().mockResolvedValue({}) } },
}));

const mockUseSession = vi.mocked(useSession);

function renderBanner() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={queryClient}>
            <ImpersonationBanner />
        </QueryClientProvider>,
    );
}

describe("ImpersonationBanner", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders nothing when the session is not impersonated", () => {
        mockUseSession.mockReturnValue({
            data: { user: { name: "Ada Lovelace", email: "ada@example.com" }, session: {} },
        } as unknown as ReturnType<typeof useSession>);

        const { container } = renderBanner();
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing when there is no session", () => {
        mockUseSession.mockReturnValue({ data: undefined } as unknown as ReturnType<
            typeof useSession
        >);

        const { container } = renderBanner();
        expect(container).toBeEmptyDOMElement();
    });

    it("names the impersonated user and offers a stop button when impersonated", () => {
        mockUseSession.mockReturnValue({
            data: {
                user: { name: "Ada Lovelace", email: "ada@example.com" },
                session: { impersonatedBy: "admin-id" },
            },
        } as unknown as ReturnType<typeof useSession>);

        renderBanner();

        expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();
        expect(screen.getByText(/ada@example.com/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /stop impersonating/i })).toBeInTheDocument();

        // Smoke check that the bar is pinned (not in normal flow).
        expect(screen.getByRole("alert")).toHaveClass("fixed");
    });

    it("resets the stop button for a fresh impersonation session", async () => {
        const user = userEvent.setup();
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const session = (impersonatedBy: string, name: string) =>
            ({
                data: { user: { name, email: `${name}@x.test` }, session: { impersonatedBy } },
            }) as unknown as ReturnType<typeof useSession>;
        const tree = () => (
            <QueryClientProvider client={queryClient}>
                <ImpersonationBanner />
            </QueryClientProvider>
        );

        mockUseSession.mockReturnValue(session("admin-id", "Ada"));
        const { rerender } = render(tree());

        await user.click(screen.getByRole("button", { name: /stop impersonating/i }));
        await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("Stopped"));

        // Stop lands back on the admin's own session (banner hidden)...
        mockUseSession.mockReturnValue({
            data: { user: { name: "Ada", email: "ada@x.test" }, session: {} },
        } as unknown as ReturnType<typeof useSession>);
        rerender(tree());
        expect(screen.queryByRole("button")).not.toBeInTheDocument();

        // ...then a fresh impersonation re-shows it, against the same query client.
        mockUseSession.mockReturnValue(session("admin-id", "Grace"));
        rerender(tree());

        await waitFor(() =>
            expect(screen.getByRole("button", { name: /stop impersonating/i })).toBeEnabled(),
        );
    });

    it("falls back to the email when the impersonated user has no name", () => {
        mockUseSession.mockReturnValue({
            data: {
                user: { name: "", email: "ada@example.com" },
                session: { impersonatedBy: "admin-id" },
            },
        } as unknown as ReturnType<typeof useSession>);

        renderBanner();

        expect(screen.getByText(/The app is shown exactly as they see it/i)).toHaveTextContent(
            "You are impersonating ada@example.com (ada@example.com).",
        );
    });
});
