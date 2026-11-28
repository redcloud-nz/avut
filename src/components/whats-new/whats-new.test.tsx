/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import { useQueryState } from "nuqs";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { UpdateEntryData } from "@/lib/updates-shared";
import { trpc } from "@/trpc/client";
import { useMutationEffector } from "@/trpc/mutation-effector";

import { WhatsNew } from "./whats-new";
import { WhatsNewVersionButton } from "./whats-new-button";

// The MDX body needs compiled code; the dialog's behaviour doesn't depend on it.
vi.mock("./update-article", () => ({
    UpdateArticle: ({ entry }: { entry: UpdateEntryData }) => <article>{entry.title}</article>,
}));

function entry(version: string, title: string): UpdateEntryData {
    return { slug: `v${version}`, version, title, description: undefined, mdx: "" };
}

const newer = entry("0.11", "Newer update");
const older = entry("0.10", "Older update");

function trpcResponse(data: unknown) {
    return new Response(JSON.stringify([{ result: { data: { json: data } } }]), {
        headers: { "content-type": "application/json" },
    });
}

// The tRPC client batches over `fetch`. `getUnseen` answers with `fetchedUnseen` (only fetched
// when a test doesn't seed the cache); anything else, `markSeen` included, gets a void result.
let fetchedUnseen: UpdateEntryData[] = [];
const fetchMock = vi.fn(async (url: string | URL | Request, _init?: RequestInit) =>
    String(url).includes("whatsNew.getUnseen")
        ? trpcResponse({ entries: fetchedUnseen })
        : trpcResponse(null),
);

function markSeenCalls() {
    return fetchMock.mock.calls.filter(([url]) => String(url).includes("whatsNew.markSeen"));
}

/** Clears `?whats-new=` from outside the dialog, as Back does. */
function ClearParam() {
    const [, setParam] = useQueryState("whats-new");
    return (
        <button type="button" onClick={() => void setParam(null)}>
            Clear param
        </button>
    );
}

/** Applies `meta.effects`, as `Providers` does in the app. */
function Effector({ queryClient }: { queryClient: QueryClient }) {
    useMutationEffector(queryClient);
    return null;
}

function renderWhatsNew({
    unseen,
    recent = [],
    searchParams = "",
    withEffector = false,
    onUrlUpdate,
}: {
    /** Seeds `getUnseen`; leave it out to have the component fetch `fetchedUnseen`. */
    unseen?: UpdateEntryData[];
    recent?: UpdateEntryData[];
    searchParams?: string;
    withEffector?: boolean;
    onUrlUpdate?: (event: UrlUpdateEvent) => void;
}) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
            mutations: { retry: false },
        },
    });
    if (unseen) queryClient.setQueryData(trpc.whatsNew.getUnseen.queryKey(), { entries: unseen });
    queryClient.setQueryData(trpc.whatsNew.listRecent.queryKey(), { entries: recent });

    return render(
        <QueryClientProvider client={queryClient}>
            {withEffector && <Effector queryClient={queryClient} />}
            <NuqsTestingAdapter searchParams={searchParams} hasMemory onUrlUpdate={onUrlUpdate}>
                <WhatsNewVersionButton />
                <WhatsNew />
                <ClearParam />
            </NuqsTestingAdapter>
        </QueryClientProvider>,
    );
}

describe("WhatsNew", () => {
    beforeEach(() => {
        fetchedUnseen = [];
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

    it("opens once on its own when there are unseen entries, without a history entry", async () => {
        const user = userEvent.setup();
        const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
        renderWhatsNew({ unseen: [newer, older], onUrlUpdate });

        const dialog = await screen.findByRole("dialog");
        expect(dialog).toHaveTextContent("Newer update");
        expect(dialog).toHaveTextContent("Older update");
        expect(onUrlUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ queryString: "?whats-new=unseen" }),
        );
        expect(onUrlUpdate.mock.calls[0][0].options.history).toBe("replace");

        await user.click(screen.getByRole("button", { name: "Got it" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

        // `getUnseen` still has entries here (no effector in this harness to clear it), and the
        // dialog stays closed anyway.
        expect(screen.getByRole("button", { name: /what's new/i })).toHaveTextContent(
            "(unseen updates)",
        );
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("doesn't open on its own after a click or key press, and shows only the dot", async () => {
        fetchedUnseen = [newer];
        renderWhatsNew({});

        // `getUnseen` is still in flight: the user gets on with the page meanwhile.
        fireEvent.keyDown(window, { key: "a" });

        await waitFor(() =>
            expect(screen.getByRole("button", { name: /what's new/i })).toHaveTextContent(
                "(unseen updates)",
            ),
        );
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("opens on its own once a fetched getUnseen arrives, if the user hasn't interacted", async () => {
        fetchedUnseen = [newer];
        renderWhatsNew({});

        expect(await screen.findByRole("dialog")).toHaveTextContent("Newer update");
    });

    it("marks the newest shown version seen when closed", async () => {
        const user = userEvent.setup();
        renderWhatsNew({ unseen: [newer, older] });

        await screen.findByRole("dialog");
        await user.keyboard("{Escape}");

        await waitFor(() => expect(markSeenCalls()).toHaveLength(1));
        const [, init] = markSeenCalls()[0];
        expect(JSON.parse(String(init?.body))).toEqual({ 0: { json: { through: "0.11" } } });
    });

    it("marks seen when the param is cleared from outside the dialog, as Back does", async () => {
        renderWhatsNew({ unseen: [newer, older] });

        await screen.findByRole("dialog");
        // The open modal aria-hides (and blocks pointer events on) the page behind it.
        fireEvent.click(screen.getByRole("button", { name: "Clear param", hidden: true }));

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        await waitFor(() => expect(markSeenCalls()).toHaveLength(1));
        const [, init] = markSeenCalls()[0];
        expect(JSON.parse(String(init?.body))).toEqual({ 0: { json: { through: "0.11" } } });
    });

    it("clears the button's unseen dot once markSeen succeeds", async () => {
        const user = userEvent.setup();
        renderWhatsNew({ unseen: [newer, older], withEffector: true });

        const dialog = await screen.findByRole("dialog");
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
        // The snapshot keeps the entries through the close, rather than emptying.
        expect(dialog).toHaveTextContent("Newer update");
    });

    it("shows recent entries from the button, and marks nothing seen on close", async () => {
        const user = userEvent.setup();
        const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
        renderWhatsNew({ unseen: [], recent: [newer, older], onUrlUpdate });

        await user.click(screen.getByRole("button", { name: /what's new/i }));

        const dialog = await screen.findByRole("dialog");
        expect(dialog).toHaveTextContent("Recent releases of AVUT.");
        expect(dialog).toHaveTextContent("Newer update");
        expect(onUrlUpdate.mock.calls[0][0].options.history).toBe("push");

        await user.click(screen.getByRole("button", { name: "Got it" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

        expect(markSeenCalls()).toHaveLength(0);
    });

    it("opens on ?whats-new=recent, even with entries unseen", async () => {
        renderWhatsNew({
            unseen: [newer],
            recent: [newer, older],
            searchParams: "?whats-new=recent",
        });

        const dialog = await screen.findByRole("dialog");
        expect(dialog).toHaveTextContent("Recent releases of AVUT.");
        expect(dialog).toHaveTextContent("Older update");
    });
});
