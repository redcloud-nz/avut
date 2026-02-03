/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Controller, useForm } from "react-hook-form";
import z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSeparator,
    FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ComponentProps, useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { nanoId16 } from "@/lib/id";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export function Pub_PPEIssue_Form() {
    const form = useForm({
        resolver: zodResolver(
            z.object({
                issuerName: z.string().min(1, "Issuer name is required"),
                issueeName: z.string().min(1, "Issuee name is required"),
                comments: z.string(),
            }),
        ),
        defaultValues: {
            issuerName: "",
            issueeName: "",
        },
    });

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>PPE Log Entry</CardTitle>
                </CardHeader>
                <CardContent>
                    <form>
                        <FieldGroup>
                            <Controller
                                name="issuerName"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field
                                        orientation="responsive"
                                        data-invalid={fieldState.invalid}
                                    >
                                        <FieldContent>
                                            <FieldLabel htmlFor="issuer-name">
                                                Issuer
                                            </FieldLabel>
                                            <FieldDescription>
                                                The person filling out this form
                                                and authorised to access the PPE
                                                shed.
                                            </FieldDescription>
                                            {fieldState.error && (
                                                <FieldError
                                                    errors={[fieldState.error]}
                                                />
                                            )}
                                        </FieldContent>

                                        <Input
                                            id="issuer-name"
                                            aria-invalid={fieldState.invalid}
                                            placeholder="Your Name"
                                            type="text"
                                            className="min-w-1/2"
                                            {...field}
                                        />
                                    </Field>
                                )}
                            />
                            <Controller
                                name="issueeName"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field
                                        orientation="responsive"
                                        data-invalid={fieldState.invalid}
                                    >
                                        <FieldContent>
                                            <FieldLabel htmlFor="issuee-name">
                                                Issuee
                                            </FieldLabel>
                                            <FieldDescription>
                                                The person receiving the PPE.
                                            </FieldDescription>
                                            {fieldState.error && (
                                                <FieldError
                                                    errors={[fieldState.error]}
                                                />
                                            )}
                                        </FieldContent>

                                        <Input
                                            id="issuee-name"
                                            aria-invalid={fieldState.invalid}
                                            placeholder="Their Name"
                                            type="text"
                                            className="min-w-1/2"
                                            {...field}
                                        />
                                    </Field>
                                )}
                            />

                            <FieldSeparator />

                            <UniformItemsControl />

                            <FieldSeparator />

                            <Controller
                                name="comments"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="comments">
                                            Comments
                                        </FieldLabel>

                                        <Textarea
                                            id="comments"
                                            aria-invalid={fieldState.invalid}
                                            className="min-w-1/2"
                                            {...field}
                                        />
                                    </Field>
                                )}
                            />

                            <Field orientation="horizontal">
                                <Button
                                    type="submit"
                                    form="ppe-issue-form"
                                    disabled
                                >
                                    Submit
                                </Button>
                                <Button
                                    type="reset"
                                    form="ppe-issue-form"
                                    variant="outline"
                                    onClick={() => form.reset()}
                                >
                                    Reset
                                </Button>
                            </Field>
                        </FieldGroup>
                    </form>
                </CardContent>
            </Card>
        </>
    );
}

const ItemDfn = [
    { id: "boots", name: "Boots", hasSize: true, hasSerialNumber: false },

    { id: "gloves", name: "Gloves", hasSize: true, hasSerialNumber: false },
    { id: "goggles", name: "Goggles", hasSize: false, hasSerialNumber: false },
    { id: "helmet", name: "Helmet", hasSize: false, hasSerialNumber: true },
    {
        id: "knee-pads",
        name: "Knee Pads",
        hasSize: false,
        hasSerialNumber: false,
    },
    {
        id: "uniform-jacket",
        name: "Jacket (Uniform)",
        hasSize: true,
        hasSerialNumber: false,
    },
    {
        id: "ww-jacket",
        name: "Jacket (Wet Weather)",
        hasSize: true,
        hasSerialNumber: false,
    },

    {
        id: "probationary-overalls",
        name: "Overalls (Probationary)",
        hasSize: true,
        hasSerialNumber: false,
    },
    {
        id: "uniform-overall",
        name: "Overalls (Standard)",
        hasSize: true,
        hasSerialNumber: false,
    },
    {
        id: "uniform-pants",
        name: "Pants (Uniform)",
        hasSize: true,
        hasSerialNumber: false,
    },
    {
        id: "ww-pants",
        name: "Pants (Wet Weather)",
        hasSize: true,
        hasSerialNumber: false,
    },
];

interface UniformItem {
    itemId: string;
    itemType: string;
    size: string;
    serialNumber: string;
}

function UniformItemsControl() {
    const [items, setItems] = useState<UniformItem[]>([]);
    const [showNewItemDialog, setShowNewItemDialog] = useState(false);

    return (
        <div>
            <div className="flex items-center justify-between">
                <FieldLegend>
                    <span>Items Issued</span>
                </FieldLegend>
                <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setShowNewItemDialog(true)}
                >
                    <PlusIcon />
                </Button>
            </div>
            <Table className="table-fixed">
                <TableHeader className="w-full bg-background">
                    <TableRow>
                        <TableHeadCell>Item</TableHeadCell>
                        <TableHeadCell className="text-center">
                            Size
                        </TableHeadCell>
                        <TableHeadCell className="text-center">
                            S/N
                        </TableHeadCell>
                        <TableHeadCell className="text-center w-10"></TableHeadCell>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item, index) => (
                        <UniformItemRow
                            key={item.itemId}
                            item={item}
                            onChange={(newItem) => {
                                const newItems = [...items];
                                newItems[index] = newItem;
                                setItems(newItems);
                            }}
                            onDelete={(itemId) => {
                                const newItems = items.filter(
                                    (it) => it.itemId !== itemId,
                                );
                                setItems(newItems);
                            }}
                        />
                    ))}
                    {items.length === 0 && (
                        <TableRow>
                            <TableCell
                                colSpan={4}
                                className="text-center text-muted-foreground"
                            >
                                No items added.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            <NewUniformItemDialog
                open={showNewItemDialog}
                onSave={(item) => {
                    setItems([...items, { ...item, itemType: nanoId16() }]);
                    setShowNewItemDialog(false);
                }}
                onCancel={() => {
                    setShowNewItemDialog(false);
                }}
            />
        </div>
    );
}

function UniformItemRow({
    item,
    onChange,
    onDelete,
}: {
    item: UniformItem;
    onChange: (item: UniformItem) => void;
    onDelete: (itemId: string) => void;
}) {
    const selectedItemDfn = ItemDfn.find((def) => def.id === item.itemId);

    return (
        <TableRow>
            <TableCell className="w-1/2">{selectedItemDfn?.name}</TableCell>
            <TableCell className="text-center">{item.size}</TableCell>
            <TableCell className="text-center">{item.serialNumber}</TableCell>
            <TableCell className="text-center w-10">
                <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                        onDelete(item.itemId);
                    }}
                >
                    <XIcon />
                </Button>
            </TableCell>
        </TableRow>
    );
}

function NewUniformItemDialog({
    open,
    onSave,
    onCancel,
}: {
    open: boolean;
    onSave: (item: UniformItem) => void;
    onCancel: () => void;
}) {
    const [item, setItem] = useState<UniformItem>({
        itemId: "",
        itemType: "",
        size: "",
        serialNumber: "",
    });

    const itemDfn = ItemDfn.find((def) => def.id === item.itemId);

    function handleCancel() {
        onCancel();
        setItem({
            itemId: "",
            itemType: "",
            size: "",
            serialNumber: "",
        });
    }

    return (
        <Dialog open={open} onOpenChange={handleCancel}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Item</DialogTitle>
                </DialogHeader>
                <FieldGroup>
                    <Field>
                        <FieldLabel>Item</FieldLabel>
                        <Select
                            onValueChange={(value) =>
                                setItem({ ...item, itemId: value })
                            }
                            value={item.itemId}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select item" />
                            </SelectTrigger>
                            <SelectContent>
                                {ItemDfn.map((def) => (
                                    <SelectItem key={def.id} value={def.id}>
                                        {def.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field>
                        <FieldLabel>Size</FieldLabel>
                        <Input
                            type="text"
                            value={item.size}
                            disabled={!itemDfn?.hasSize}
                            onChange={(e) =>
                                setItem({ ...item, size: e.target.value })
                            }
                            placeholder="Size"
                        />
                    </Field>

                    <Field>
                        <FieldLabel>Serial Number</FieldLabel>
                        <Input
                            type="text"
                            value={item.serialNumber}
                            disabled={!itemDfn?.hasSerialNumber}
                            onChange={(e) =>
                                setItem({
                                    ...item,
                                    serialNumber: e.target.value,
                                })
                            }
                            placeholder="Serial Number"
                        />
                    </Field>
                    <Field orientation="horizontal">
                        <Button
                            type="button"
                            onClick={() => {
                                onSave(item);
                                setItem({
                                    itemId: "",
                                    itemType: "",
                                    size: "",
                                    serialNumber: "",
                                });
                            }}
                        >
                            Add
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleCancel()}
                        >
                            Cancel
                        </Button>
                    </Field>
                </FieldGroup>
            </DialogContent>
        </Dialog>
    );
}
