/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/i3/teams/[team_id]/members/[member_id]
 */
"use client";

import { useTranslations } from "next-intl";
import { Fragment, use, useState } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { DropdownMenuTriggerIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { useOrganization } from "@/hooks/use-organization";
import { formatDate } from "@/lib/datetime";
import { trpc } from "@/trpc/client";

export default function I3Module_Member_Page(
    props: PageProps<"/main/[slug]/i3/teams/[team_id]/members/[member_id]">,
) {
    const { member_id, team_id } = use(props.params);
    const memberId = parseInt(member_id);
    const teamId = parseInt(team_id);

    const organization = useOrganization();

    const t = useTranslations("I3Module");

    const [{ data: categories }, { data: members }, { data: memberEquipment }] = useSuspenseQueries(
        {
            queries: [
                trpc.d4hApi.listEquipmentCategories.queryOptions({
                    organizationId: organization.id,
                    module: "i3",
                }),
                trpc.d4hApi.listMembers.queryOptions({
                    organizationId: organization.id,
                    module: "i3",
                }),
                trpc.d4hApi.listMemberEquipment.queryOptions({
                    organizationId: organization.id,
                    module: "i3",
                    memberId,
                    teamId,
                }),
            ],
        },
    );

    const member = members.find((m) => m.id === memberId);
    if (!member) throw new Error(`Member with id ${memberId} not found`);

    const itemsByCategory = categories
        .map((category) => {
            return {
                category,
                items: memberEquipment
                    .filter((item) => item.category.id === category.id)
                    .sort((a, b) => a.kind.title.localeCompare(b.kind.title)),
            };
        })
        .filter((category) => category.items.length > 0);

    const [showColumns, setShowColumns] = useState({
        brand: true,
        expiry: false,
        model: true,
        serial: false,
        status: true,
    });

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: t("title"), href: `/main/${organization.slug}/i3` },
                    { label: t("members"), href: `/main/${organization.slug}/i3/members` },
                    {
                        label: member.name,
                        href: `/main/${organization.slug}/i3/members/${member.id}`,
                    },
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="full">
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={{ href: `/main/${organization.slug}/i3/members` }}
                            tooltip="Back to members list"
                        />
                        <Hermes.Title>Issued to: {member.name}</Hermes.Title>
                        <Hermes.Action>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <DropdownMenuTriggerIcon />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuGroup>
                                        <DropdownMenuLabel>Show Columns</DropdownMenuLabel>
                                        <DropdownMenuCheckboxItem
                                            checked={showColumns.brand}
                                            onCheckedChange={(checked) =>
                                                setShowColumns((prev) => ({
                                                    ...prev,
                                                    brand: checked,
                                                }))
                                            }
                                        >
                                            Brand
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem
                                            checked={showColumns.expiry}
                                            onCheckedChange={(checked) =>
                                                setShowColumns((prev) => ({
                                                    ...prev,
                                                    expiry: checked,
                                                }))
                                            }
                                        >
                                            Expiry
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem
                                            checked={showColumns.model}
                                            onCheckedChange={(checked) =>
                                                setShowColumns((prev) => ({
                                                    ...prev,
                                                    model: checked,
                                                }))
                                            }
                                        >
                                            Model
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem
                                            checked={showColumns.serial}
                                            onCheckedChange={(checked) =>
                                                setShowColumns((prev) => ({
                                                    ...prev,
                                                    serial: checked,
                                                }))
                                            }
                                        >
                                            Serial
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem
                                            checked={showColumns.status}
                                            onCheckedChange={(checked) =>
                                                setShowColumns((prev) => ({
                                                    ...prev,
                                                    status: checked,
                                                }))
                                            }
                                        >
                                            Status
                                        </DropdownMenuCheckboxItem>
                                    </DropdownMenuGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </Hermes.Action>
                    </Hermes.Header>
                    <div className="hidden lg:flex items-center"></div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHeadCell></TableHeadCell>
                                <TableHeadCell>Kind</TableHeadCell>
                                <TableHeadCell>Ref</TableHeadCell>
                                {showColumns.brand && (
                                    <TableHeadCell className="hidden lg:table-cell">
                                        Brand
                                    </TableHeadCell>
                                )}
                                {showColumns.model && (
                                    <TableHeadCell className="hidden lg:table-cell">
                                        Model
                                    </TableHeadCell>
                                )}
                                {showColumns.serial && (
                                    <TableHeadCell className="hidden lg:table-cell">
                                        Serial
                                    </TableHeadCell>
                                )}
                                {showColumns.expiry && (
                                    <TableHeadCell className="hidden lg:table-cell">
                                        Expiry
                                    </TableHeadCell>
                                )}
                                {showColumns.status && (
                                    <TableHeadCell className="hidden lg:table-cell">
                                        Status
                                    </TableHeadCell>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {itemsByCategory.map(({ category, items }) => (
                                <Fragment key={category.id}>
                                    <TableRow>
                                        <TableCell colSpan={2} className="font-semibold">
                                            {category.title}
                                        </TableCell>
                                    </TableRow>
                                    {items.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell></TableCell>
                                            <TableCell>{item.kind.title}</TableCell>
                                            <TableCell>#{item.ref}</TableCell>
                                            {showColumns.brand && (
                                                <TableCell className="hidden lg:table-cell">
                                                    {item.brand?.title}
                                                </TableCell>
                                            )}
                                            {showColumns.model && (
                                                <TableCell className="hidden lg:table-cell">
                                                    {item.model?.title}
                                                </TableCell>
                                            )}
                                            {showColumns.serial && (
                                                <TableCell className="hidden lg:table-cell">
                                                    {item.serial}
                                                </TableCell>
                                            )}
                                            {showColumns.expiry && (
                                                <TableCell className="hidden lg:table-cell">
                                                    {item.dateExpires
                                                        ? formatDate(item.dateExpires)
                                                        : ""}
                                                </TableCell>
                                            )}
                                            {showColumns.status && (
                                                <TableCell className="hidden lg:table-cell">
                                                    {item.status}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
