/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { UserId } from "@/lib/schemas/user";
import { trpc, type RouterOutput } from "@/trpc/client";

import { ImpersonationBanner } from "./impersonation-banner";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/client/auth-client", () => ({
    authClient: { admin: { stopImpersonating: vi.fn().mockResolvedValue({}) } },
}));

type SessionData = NonNullable<RouterOutput["users"]["getSession"]>;

function makeQueryClient() {
    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function seedSession(queryClient: QueryClient, data: SessionData | null) {
    queryClient.setQueryData(trpc.users.getSession.queryKey(), data);
}

function renderBanner(queryClient: QueryClient) {
    return render(
        <QueryClientProvider client={queryClient}>
            <ImpersonationBanner />
        </QueryClientProvider>,
    );
}

const session = (
    impersonatedBy: string | undefined,
    name: string,
    email = `${name.toLowerCase().replace(/\s+/g, ".")}@x.test`,
): SessionData => ({
    user: { id: UserId.create(), name, email, emailVerified: true, image: null, role: null },
    session: { impersonatedBy: impersonatedBy ?? null },
});

describe("ImpersonationBanner", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders nothing when the session is not impersonated", () => {
        const queryClient = makeQueryClient();
        seedSession(queryClient, session(undefined, "Ada Lovelace"));

        const { container } = renderBanner(queryClient);
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing when there is no session", () => {
        const queryClient = makeQueryClient();
        seedSession(queryClient, null);

        const { container } = renderBanner(queryClient);
        expect(container).toBeEmptyDOMElement();
    });

    it("names the impersonated user and offers a stop button when impersonated", () => {
        const queryClient = makeQueryClient();
        seedSession(queryClient, session("admin-id", "Ada Lovelace"));

        renderBanner(queryClient);

        expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
        expect(screen.getByText(/ada\.lovelace@x\.test/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /stop impersonating/i })).toBeInTheDocument();

        // Smoke check that the bar is pinned (not in normal flow).
        expect(screen.getByRole("alert")).toHaveClass("fixed");
    });

    it("resets the stop button for a fresh impersonation session", async () => {
        const user = userEvent.setup();
        const queryClient = makeQueryClient();
        seedSession(queryClient, session("admin-id", "Ada"));

        render(
            <QueryClientProvider client={queryClient}>
                <ImpersonationBanner />
            </QueryClientProvider>,
        );

        await user.click(screen.getByRole("button", { name: /stop impersonating/i }));
        await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("Stopped"));

        // Stop lands back on the admin's own session (banner hidden)...
        seedSession(queryClient, session(undefined, "Ada"));
        await waitFor(() => expect(screen.queryByRole("button")).not.toBeInTheDocument());

        // ...then a fresh impersonation re-shows it, against the same query client.
        seedSession(queryClient, session("admin-id", "Grace"));

        await waitFor(() =>
            expect(screen.getByRole("button", { name: /stop impersonating/i })).toBeEnabled(),
        );
    });

    it("falls back to the email when the impersonated user has no name", () => {
        const queryClient = makeQueryClient();
        queryClient.setQueryData(trpc.users.getSession.queryKey(), {
            user: {
                id: UserId.create(),
                name: "",
                email: "ada@example.com",
                emailVerified: true,
                image: null,
                role: null,
            },
            session: { impersonatedBy: "admin-id" },
        } satisfies SessionData);

        renderBanner(queryClient);

        expect(screen.getByText(/The app is shown exactly as they see it/i)).toHaveTextContent(
            "You are impersonating ada@example.com (ada@example.com).",
        );
    });
});
