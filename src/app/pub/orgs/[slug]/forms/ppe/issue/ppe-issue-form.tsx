/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { ComponentProps, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { nanoId16 } from "@/lib/id";
import { IssuedPPEItem, IssuePPEFormData } from "@/lib/schemas/ppe";

import { PPEItemCatalogue } from "../catalogue";
import { submitPPEIssueForm } from "./action";

export function Pub_PPEIssue_Form() {
    const form = useForm({
        resolver: zodResolver(IssuePPEFormData.schema),
        defaultValues: {
            issuer: { id: "NONE", name: "" },
            recipient: { id: "NONE", name: "" },
            issuedItems: [] as IssuedPPEItem[],
            email: "",
            comments: "",
        },
    });

    const handleSubmit = form.handleSubmit(async (formData) => {
        toast.promise(
            async () => {
                // Call server action to submit the form
                console.log("Submitting PPE Issue Form:", formData);
                await submitPPEIssueForm(formData);
                form.reset();
            },
            {
                loading: "Submitting PPE Issue Form...",
                success: "PPE Issue Form submitted successfully!",
                error: (error) =>
                    `Failed to submit PPE Issue Form: ${error.message}`,
            },
        );
    });

    return (
        <form id="ppe-issue-form" onSubmit={handleSubmit}>
            <FieldGroup>
                <Controller
                    name="issuer.name"
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
                                    The person filling out this form and
                                    authorised to access the PPE shed.
                                </FieldDescription>
                                {fieldState.error && (
                                    <FieldError errors={[fieldState.error]} />
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
                    name="recipient.name"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field
                            orientation="responsive"
                            data-invalid={fieldState.invalid}
                        >
                            <FieldContent>
                                <FieldLabel htmlFor="recipient-name">
                                    Recipient
                                </FieldLabel>
                                <FieldDescription>
                                    The person receiving the PPE.
                                </FieldDescription>
                                {fieldState.error && (
                                    <FieldError errors={[fieldState.error]} />
                                )}
                            </FieldContent>

                            <Input
                                id="recipient-name"
                                aria-invalid={fieldState.invalid}
                                placeholder="Their Name"
                                type="text"
                                className="min-w-1/2"
                                {...field}
                            />
                        </Field>
                    )}
                />

                <Controller
                    name="issuedItems"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <PPEItemTable
                                value={field.value}
                                onChange={field.onChange}
                                aria-invalid={fieldState.invalid}
                            />
                            {fieldState.error && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                <Controller
                    name="comments"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="comments">Comments</FieldLabel>

                            <Textarea
                                id="comments"
                                aria-invalid={fieldState.invalid}
                                className="min-w-1/2"
                                {...field}
                            />
                        </Field>
                    )}
                />

                <FieldSeparator />

                <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="email">
                                Notification Email
                            </FieldLabel>
                            <FieldDescription>
                                For initial testing only. An email address to
                                recieve the PPE issue notification (rather than
                                the PPE coordinator).
                            </FieldDescription>
                            {fieldState.error && (
                                <FieldError errors={[fieldState.error]} />
                            )}

                            <Input
                                id="email"
                                aria-invalid={fieldState.invalid}
                                type="email"
                                className="min-w-1/2"
                                {...field}
                            />
                        </Field>
                    )}
                />

                <Field orientation="horizontal">
                    <Button type="submit" form="ppe-issue-form">
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
    );
}

function PPEItemTable({
    value: items,
    onChange,
    ...props
}: {
    value: IssuedPPEItem[];
    onChange: (items: IssuedPPEItem[]) => void;
} & ComponentProps<typeof Table>) {
    const [showNewItemDialog, setShowNewItemDialog] = useState(false);

    function handleDeleteRow(itemId: string) {
        onChange(items.filter((item) => item.id !== itemId));
    }

    function handleAddItem(item: IssuedPPEItem) {
        onChange([...items, { ...item, id: nanoId16() }]);
        setShowNewItemDialog(false);
    }

    return (
        <>
            <div className="flex items-center justify-between">
                <FieldLabel>
                    <span>Items Issued</span>
                </FieldLabel>
                <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setShowNewItemDialog(true)}
                >
                    <PlusIcon />
                </Button>
            </div>
            <Table
                className="table-fixed aria-invalid:ring-destructive/20 aria-invalid:ring"
                {...props}
            >
                <TableHeader className="w-full bg-background">
                    <TableRow>
                        <TableHeadCell className="w-1/2">Item</TableHeadCell>
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
                    {items.map((item) => (
                        <UniformItemRow
                            key={item.id}
                            item={item}
                            onDelete={handleDeleteRow}
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
                onSave={handleAddItem}
                onCancel={() => {
                    setShowNewItemDialog(false);
                }}
            />
        </>
    );
}

function UniformItemRow({
    item,
    onDelete,
}: {
    item: IssuedPPEItem;
    onDelete: (itemId: string) => void;
}) {
    const itemTemplate = PPEItemCatalogue.find(
        (def) => def.id === item.templateId,
    );

    return (
        <TableRow>
            <TableCell className="overflow-clip">
                {itemTemplate?.name}
            </TableCell>
            <TableCell className="text-center overflow-clip">
                {item.size}
            </TableCell>
            <TableCell className="text-center overflow-clip">
                {item.serialNumber}
            </TableCell>
            <TableCell className="text-center w-10 p-0">
                <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                        onDelete(item.id);
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
    onSave: (item: IssuedPPEItem) => void;
    onCancel: () => void;
}) {
    const [item, setItem] = useState<
        Pick<IssuedPPEItem, "templateId" | "size" | "serialNumber">
    >({
        templateId: "",
        size: "",
        serialNumber: "",
    });

    const itemDfn = PPEItemCatalogue.find((def) => def.id === item.templateId);

    function handleAdd() {
        onSave({ ...item, id: "", itemName: itemDfn ? itemDfn.name : "" });
        setItem({
            templateId: "",
            size: "",
            serialNumber: "",
        });
    }

    function handleCancel() {
        onCancel();
        setItem({
            templateId: "",
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
                                setItem({ ...item, templateId: value })
                            }
                            value={item.templateId}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select item" />
                            </SelectTrigger>
                            <SelectContent>
                                {PPEItemCatalogue.map((def) => (
                                    <SelectItem key={def.id} value={def.id}>
                                        {def.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    {itemDfn?.hasSize && (
                        <Field>
                            <FieldLabel>Size</FieldLabel>
                            {itemDfn.sizeOptions ? (
                                <Select
                                    onValueChange={(value) =>
                                        setItem({ ...item, size: value })
                                    }
                                    value={item.size}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select size" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {itemDfn.sizeOptions.map(
                                            (sizeOption) => (
                                                <SelectItem
                                                    key={sizeOption}
                                                    value={sizeOption}
                                                >
                                                    {sizeOption}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    type="text"
                                    value={item.size}
                                    disabled={!itemDfn?.hasSize}
                                    onChange={(e) =>
                                        setItem({
                                            ...item,
                                            size: e.target.value,
                                        })
                                    }
                                    placeholder="Size"
                                />
                            )}
                        </Field>
                    )}

                    {itemDfn?.hasSerialNumber && (
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
                    )}
                    {itemDfn && (
                        <Field orientation="horizontal">
                            <Button type="button" onClick={handleAdd}>
                                Add
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCancel}
                            >
                                Cancel
                            </Button>
                        </Field>
                    )}
                </FieldGroup>
            </DialogContent>
        </Dialog>
    );
}
