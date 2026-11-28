/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useUser } from "@/client/auth-queries";

import { SystemAdmin_User_ActionsCard, SystemAdmin_UserActions_Menu } from "./user-actions-menu";

vi.mock("@/client/auth-queries", () => ({ useUser: vi.fn() }));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/client/auth-client", () => ({
    authClient: {
        admin: {
            impersonateUser: vi.fn().mockResolvedValue({ error: null }),
        },
    },
}));

const mockUseUser = vi.mocked(useUser);

const OTHER_ID = "0000000000000001";
const SELF_ID = "0000000000000002";

type MenuUser = Parameters<typeof SystemAdmin_UserActions_Menu>[0]["user"];

function makeUser(overrides: Record<string, unknown> = {}): MenuUser {
    return {
        id: OTHER_ID,
        name: "Ada Lovelace",
        email: "ada@example.com",
        emailVerified: true,
        role: "user",
        banned: false,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        organizations: [],
        ...overrides,
    } as unknown as MenuUser;
}

function renderMenu(user: MenuUser, search = "") {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={queryClient}>
            <NuqsTestingAdapter searchParams={search}>
                <SystemAdmin_UserActions_Menu user={user} />
            </NuqsTestingAdapter>
        </QueryClientProvider>,
    );
}

/** The page's two halves together: the User card's ⋮ (which mounts the dialogs) and the card. */
function renderPage(user: MenuUser) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={queryClient}>
            <NuqsTestingAdapter>
                <SystemAdmin_User_ActionsCard user={user} />
                <SystemAdmin_UserActions_Menu user={user} />
            </NuqsTestingAdapter>
        </QueryClientProvider>,
    );
}

describe("SystemAdmin_UserActions_Menu", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseUser.mockReturnValue({ data: { id: SELF_ID } } as unknown as ReturnType<
            typeof useUser
        >);
    });

    it("renders no ⋮ and no action card for the signed-in operator", () => {
        renderPage(makeUser({ id: SELF_ID }));

        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("renders no action card until the signed-in operator is known", () => {
        mockUseUser.mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useUser>);
        renderPage(makeUser());

        expect(screen.queryByRole("button", { name: /Impersonate/ })).not.toBeInTheDocument();
    });

    it("does not mount the action dialogs for the operator even with ?action= set", () => {
        renderMenu(makeUser({ id: SELF_ID }), "?action=impersonate");

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("offers promote / ban / delete in the ⋮ for a plain user", async () => {
        const user = userEvent.setup();
        renderMenu(makeUser({ role: "user", banned: false }));

        await user.click(screen.getByRole("button", { name: "Actions" }));

        expect(screen.queryByText("Impersonate")).not.toBeInTheDocument();
        expect(screen.getByText("Promote to admin")).toBeInTheDocument();
        expect(screen.getByText("Ban user")).toBeInTheDocument();
        expect(screen.getByText("Delete user")).toBeInTheDocument();
        expect(screen.queryByText("Demote to user")).not.toBeInTheDocument();
        expect(screen.queryByText("Unban user")).not.toBeInTheDocument();
    });

    it("offers demote (not promote) for an admin user", async () => {
        const user = userEvent.setup();
        renderMenu(makeUser({ role: "admin" }));

        await user.click(screen.getByRole("button", { name: "Actions" }));

        expect(screen.getByText("Demote to user")).toBeInTheDocument();
        expect(screen.queryByText("Promote to admin")).not.toBeInTheDocument();
    });

    it("offers unban (not ban) for a banned user", async () => {
        const user = userEvent.setup();
        renderMenu(makeUser({ banned: true }));

        await user.click(screen.getByRole("button", { name: "Actions" }));

        expect(screen.getByText("Unban user")).toBeInTheDocument();
        expect(screen.queryByText("Ban user")).not.toBeInTheDocument();
    });

    it("opens Impersonate from the action card", async () => {
        const user = userEvent.setup();
        renderPage(makeUser());

        await user.click(screen.getByRole("button", { name: "Impersonate" }));

        expect(
            await screen.findByRole("heading", { name: "Impersonate user" }),
        ).toBeInTheDocument();
    });

    const cases: Array<[string, Record<string, unknown>, string]> = [
        ["ban", { banned: false }, "Ban user"],
        ["unban", { banned: true }, "Unban user"],
        ["promote", { role: "user" }, "Promote to admin"],
        ["demote", { role: "user" }, "Demote to user"],
        ["delete", {}, "Delete user"],
        ["impersonate", {}, "Impersonate user"],
    ];

    it.each(cases)("?action=%s mounts exactly one dialog", (action, overrides, heading) => {
        renderMenu(makeUser(overrides), `?action=${action}`);

        const dialogs = [
            ...screen.queryAllByRole("dialog"),
            ...screen.queryAllByRole("alertdialog"),
        ];
        expect(dialogs).toHaveLength(1);
        expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    });

    it("registers the primary card's keys: Mod+. opens the menu, Alt+Backspace Delete", async () => {
        const user = userEvent.setup();
        renderMenu(makeUser());

        await user.keyboard("{Control>}.{/Control}");
        expect(await screen.findByRole("menu")).toBeInTheDocument();
        await user.keyboard("{Escape}");

        await user.keyboard("{Alt>}{Backspace}{/Alt}");
        expect(await screen.findByRole("heading", { name: "Delete user" })).toBeInTheDocument();
    });
});
