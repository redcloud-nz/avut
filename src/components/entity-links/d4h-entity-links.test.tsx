/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@testing-library/react";

import { D4HEquipmentItemLink } from "./d4h-equipment-item-link";
import { D4HEquipmentModelLink } from "./d4h-equipment-model-link";
import { D4HIssuedTypeLink } from "./d4h-issued-type-link";
import { D4HMemberLink } from "./d4h-member-link";

vi.mock("@/hooks/use-organization", () => ({ useOrganization: () => ({ slug: "acme" }) }));

describe("D4HMemberLink", () => {
    it("links a named member to its page under the member's team", () => {
        render(<D4HMemberLink member={{ id: 42, name: "Jo Bloggs", owner: { id: 7 } }} />);

        expect(screen.getByRole("link", { name: "Jo Bloggs" })).toHaveAttribute(
            "href",
            "/orgs/acme/d4h/teams/7/members/42",
        );
    });

    it("renders plain Member #<id> with no link when the name is null", () => {
        const { container } = render(
            <D4HMemberLink member={{ id: 42, name: null, owner: { id: 7 } }} />,
        );

        expect(container).toHaveTextContent("Member #42");
        expect(screen.queryByRole("link")).toBeNull();
    });
});

describe("D4HEquipmentModelLink", () => {
    it("links to the model's own page", () => {
        render(<D4HEquipmentModelLink model={{ id: 9, title: "Vector" }} />);

        expect(screen.getByRole("link", { name: "Vector" })).toHaveAttribute(
            "href",
            "/orgs/acme/d4h/models/9",
        );
    });
});

describe("D4HIssuedTypeLink", () => {
    it("links to the type's issued items under the given team", () => {
        render(<D4HIssuedTypeLink teamId={7} type={{ id: 12, title: "Helmet" }} />);

        expect(screen.getByRole("link", { name: "Helmet" })).toHaveAttribute(
            "href",
            "/orgs/acme/d4h-i3/teams/7/issued-types/12",
        );
    });
});

describe("D4HEquipmentItemLink", () => {
    it("renders # + the ref by default, linking under the item's own team", () => {
        render(<D4HEquipmentItemLink item={{ id: 100, ref: "P5-1234", owner: { id: 7 } }} />);

        expect(screen.getByRole("link", { name: /^#\s?P5-1234$/ })).toHaveAttribute(
            "href",
            "/orgs/acme/d4h/teams/7/items/100",
        );
    });

    it("links to the member-scoped page when given a member of the item's team", () => {
        render(
            <D4HEquipmentItemLink
                item={{ id: 100, ref: "P5-1234", owner: { id: 7 } }}
                member={{ id: 42, owner: { id: 7 } }}
            />,
        );

        expect(screen.getByRole("link")).toHaveAttribute(
            "href",
            "/orgs/acme/d4h/teams/7/members/42/items/100",
        );
    });

    it("keeps the team-level page when the member is in another team", () => {
        render(
            <D4HEquipmentItemLink
                item={{ id: 100, ref: "P5-1234", owner: { id: 8 } }}
                member={{ id: 42, owner: { id: 7 } }}
            />,
        );

        expect(screen.getByRole("link")).toHaveAttribute(
            "href",
            "/orgs/acme/d4h/teams/8/items/100",
        );
    });

    it("renders the label when given", () => {
        render(
            <D4HEquipmentItemLink
                item={{ id: 100, ref: "", owner: { id: 7 } }}
                label="#1234 Helmet"
            />,
        );

        expect(screen.getByRole("link", { name: "#1234 Helmet" })).toHaveAttribute(
            "href",
            "/orgs/acme/d4h/teams/7/items/100",
        );
    });
});
