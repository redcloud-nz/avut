/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { UpdateEntryData } from "@/lib/updates-shared";
import { trpc } from "@/trpc/client";
import { useMutationEffector } from "@/trpc/mutation-effector";

import { WhatsNewVersionButton } from "./whats-new-button";
import { WhatsNewBoundary, WhatsNewDialog, WhatsNewProvider } from "./whats-new-dialog";

// The MDX body needs compiled code; the dialog's behaviour doesn't depend on it.
vi.mock("./update-article", () => ({
    UpdateArticle: ({ entry }: { entry: UpdateEntryData }) => <article>{entry.title}</article>,
}));

function entry(slug: string, title: string, publishedAt: string): UpdateEntryData {
    return { slug, title, publishedAt, description: undefined, version: undefined, mdx: "" };
}

const newer = entry("2026-09-30-newer", "Newer update", "2026-09-30");
const older = entry("2026-09-20-older", "Older update", "2026-09-20");

// The tRPC client batches over `fetch`; stub it to capture the `markSeen` request and answer it
// with a successful (void) result.
const fetchMock = vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(JSON.stringify([{ result: { data: { json: null } } }]), {
            headers: { "content-type": "application/json" },
        }),
);

function markSeenCalls() {
    return fetchMock.mock.calls.filter(([url]) => String(url).includes("whatsNew.markSeen"));
}

/** Applies `meta.effects`, as `Providers` does in the app. */
function Effector({ queryClient }: { queryClient: QueryClient }) {
    useMutationEffector(queryClient);
    return null;
}

function renderWhatsNew({
    unseen,
    recent = [],
    withEffector = false,
}: {
    unseen: UpdateEntryData[];
    recent?: UpdateEntryData[];
    withEffector?: boolean;
}) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(trpc.whatsNew.getUnseen.queryKey(), { entries: unseen });
    queryClient.setQueryData(trpc.whatsNew.listRecent.queryKey(), { entries: recent });

    return render(
        <QueryClientProvider client={queryClient}>
            {withEffector && <Effector queryClient={queryClient} />}
            <WhatsNewProvider>
                <WhatsNewVersionButton />
                <WhatsNewBoundary>
                    <WhatsNewDialog />
                </WhatsNewBoundary>
            </WhatsNewProvider>
        </QueryClientProvider>,
    );
}

describe("WhatsNewDialog", () => {
    beforeEach(() => {
        fetchMock.mockClear();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("doesn't open on its own when nothing is unseen", () => {
        renderWhatsNew({ unseen: [] });

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("opens once on its own when there are unseen entries", async () => {
        const user = userEvent.setup();
        renderWhatsNew({ unseen: [newer, older] });

        const dialog = await screen.findByRole("dialog");
        expect(dialog).toHaveTextContent("Newer update");
        expect(dialog).toHaveTextContent("Older update");

        await user.click(screen.getByRole("button", { name: "Got it" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

        // `getUnseen` still has entries here (no effector in this harness to clear it), and the
        // dialog stays closed anyway.
        expect(screen.getByRole("button", { name: /what's new/i })).toHaveTextContent(
            "(unseen updates)",
        );
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("marks the newest shown entry seen when closed", async () => {
        const user = userEvent.setup();
        renderWhatsNew({ unseen: [newer, older] });

        await screen.findByRole("dialog");
        await user.keyboard("{Escape}");

        await waitFor(() => expect(markSeenCalls()).toHaveLength(1));
        const [, init] = markSeenCalls()[0];
        expect(JSON.parse(String(init?.body))).toEqual({ 0: { json: { through: "2026-09-30" } } });
    });

    it("clears the button's unseen dot once markSeen succeeds", async () => {
        const user = userEvent.setup();
        renderWhatsNew({ unseen: [newer, older], withEffector: true });

        await screen.findByRole("dialog");
        // The open modal aria-hides the page behind it, hence `hidden: true` here.
        expect(screen.getByRole("button", { name: /what's new/i, hidden: true })).toHaveTextContent(
            "(unseen updates)",
        );

        await user.click(screen.getByRole("button", { name: "Got it" }));

        await waitFor(() => expect(markSeenCalls()).toHaveLength(1));
        await waitFor(() =>
            expect(screen.getByRole("button", { name: /what's new/i })).not.toHaveTextContent(
                "(unseen updates)",
            ),
        );
    });

    it("shows recent entries from the button, and marks nothing seen on close", async () => {
        const user = userEvent.setup();
        renderWhatsNew({ unseen: [], recent: [newer, older] });

        await user.click(screen.getByRole("button", { name: /what's new/i }));

        const dialog = await screen.findByRole("dialog");
        expect(dialog).toHaveTextContent("Recent changes to AVUT.");
        expect(dialog).toHaveTextContent("Newer update");

        await user.click(screen.getByRole("button", { name: "Got it" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

        expect(markSeenCalls()).toHaveLength(0);
    });
});
