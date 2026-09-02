/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { UserId } from "@/lib/schemas/user";

import { SystemAdmin_BanUser_Dialog } from "./ban-user-dialog";

vi.mock("@/client/auth-client", () => ({
    authClient: {
        admin: {
            banUser: vi.fn().mockResolvedValue({ error: null }),
            unbanUser: vi.fn().mockResolvedValue({ error: null }),
        },
    },
}));

const USER = { id: UserId.schema.parse("a1b2c3d4e5f6g7h8"), name: "Ada Lovelace" };

function Harness({ action, initialOpen }: { action: "ban" | "unban"; initialOpen: boolean }) {
    const [open, setOpen] = useState(initialOpen);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return (
        <QueryClientProvider client={queryClient}>
            <button onClick={() => setOpen(true)}>open</button>
            <SystemAdmin_BanUser_Dialog
                user={USER}
                action={action}
                open={open}
                onOpenChange={setOpen}
            />
        </QueryClientProvider>
    );
}

describe("SystemAdmin_BanUser_Dialog", () => {
    beforeEach(() => vi.clearAllMocks());

    it("is closed when open is false and opens on the ?action= transition", async () => {
        const user = userEvent.setup();
        render(<Harness action="ban" initialOpen={false} />);

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

        await user.click(screen.getByText("open"));

        expect(await screen.findByRole("dialog")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Ban user" })).toBeInTheDocument();
        expect(screen.getByLabelText("Reason")).toBeInTheDocument();
    });

    it("bans with the trimmed reason and closes on success", async () => {
        const user = userEvent.setup();
        render(<Harness action="ban" initialOpen={true} />);

        await user.type(screen.getByLabelText("Reason"), "  spam  ");
        await user.click(screen.getByRole("button", { name: "Ban user" }));

        expect(authClient.admin.banUser).toHaveBeenCalledWith({
            userId: USER.id,
            banReason: "spam",
        });
        await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("unban is a plain confirm with no reason field", async () => {
        const user = userEvent.setup();
        render(<Harness action="unban" initialOpen={true} />);

        expect(screen.getByRole("heading", { name: "Unban user" })).toBeInTheDocument();
        expect(screen.queryByLabelText("Reason")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Unban user" }));

        expect(authClient.admin.unbanUser).toHaveBeenCalledWith({ userId: USER.id });
    });
});
