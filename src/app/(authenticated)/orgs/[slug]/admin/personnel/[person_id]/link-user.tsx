/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useOrganization } from "@/hooks/use-organization";
import { PersonData } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

export function AdminModule_LinkUser_Dialog({ ...props }: DialogProps & { person: PersonData }) {
    const organization = useOrganization();

    const [tabValue, setTabValue] = useState("search");

    function handleOpenChange(open: boolean) {
        props.onOpenChange?.(open);
    }

    return (
        <Dialog {...props} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Link User Account</DialogTitle>
                    <DialogDescription>
                        Link a user account to the <strong>{props.person.name}</strong> personnel
                        record.
                    </DialogDescription>
                </DialogHeader>
                <Tabs value={tabValue} onValueChange={setTabValue}>
                    <TabsList variant="line">
                        <TabsTrigger value="existing">Existing</TabsTrigger>
                        <TabsTrigger value="new">New</TabsTrigger>
                    </TabsList>
                </Tabs>
                <FieldGroup>
                    <Field>
                        <FieldLabel>User</FieldLabel>
                        <Select>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a user to link" />
                            </SelectTrigger>
                            <SelectContent>
                                {/* {unlinkedUsers.map((user) => (
                                    <SelectItem key={user.id} value={user.id}>
                                        {user.name} ({user.email})
                                    </SelectItem>
                                ))} */}
                            </SelectContent>
                        </Select>
                    </Field>
                </FieldGroup>
            </DialogContent>
        </Dialog>
    );
}
