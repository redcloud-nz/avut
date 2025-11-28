/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Loader2Icon } from "lucide-react";
import {
    ComponentProps,
    createContext,
    ReactNode,
    useContext,
    useId,
} from "react";
import {
    Controller,
    ControllerProps,
    FieldPath,
    FieldValues,
    useFormContext,
    useFormState,
} from "react-hook-form";
import { pick } from "remeda";

import { Label as LabelPrimitive, Slot as SlotPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

import { Button, ButtonProps, buttonVariants } from "./button";
import { Label } from "./label";
import { Link } from "./link";

export function Form({ className, ...props }: ComponentProps<"form">) {
    return <form className={cn("space-y-4", className)} {...props} />;
}

type FormFieldContextValue<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
    name: TName;
};

export const FormFieldContext = createContext<FormFieldContextValue>(
    {} as FormFieldContextValue,
);

export function FormField<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
    return (
        <FormFieldContext.Provider value={{ name: props.name }}>
            <Controller {...props} />
        </FormFieldContext.Provider>
    );
}

export const useFormField = () => {
    const fieldContext = useContext(FormFieldContext);
    const itemContext = useContext(FormItemContext);
    const { getFieldState } = useFormContext();
    const formState = useFormState();
    const fieldState = getFieldState(fieldContext.name, formState);

    if (!fieldContext) {
        throw new Error("useFormField should be used within <FormField>");
    }

    const { id } = itemContext;

    return {
        id,
        name: fieldContext.name,
        formItemId: `${id}-form-item`,
        formDescriptionId: `${id}-form-item-description`,
        formMessageId: `${id}-form-item-message`,
        ...fieldState,
    };
};

type FormItemContextValue = {
    id: string;
};

const FormItemContext = createContext<FormItemContextValue>(
    {} as FormItemContextValue,
);

export function FormItem({ className, ...props }: ComponentProps<"div">) {
    const id = useId();

    return (
        <FormItemContext.Provider value={{ id }}>
            <div className={cn("flex flex-col gap-2", className)} {...props} />
        </FormItemContext.Provider>
    );
}

export function FormLabel({
    className,
    ...props
}: React.ComponentPropsWithRef<typeof LabelPrimitive.Root>) {
    const { error, formItemId } = useFormField();

    return (
        <Label
            className={cn("data-[error]:text-destructive", className)}
            htmlFor={formItemId}
            data-error={!!error || undefined}
            {...props}
        />
    );
}

export function FormControl({
    ...props
}: React.ComponentPropsWithoutRef<typeof SlotPrimitive.Slot>) {
    const { error, formItemId, formDescriptionId, formMessageId } =
        useFormField();

    return (
        <SlotPrimitive.Slot
            id={formItemId}
            aria-describedby={
                !error
                    ? `${formDescriptionId}`
                    : `${formDescriptionId} ${formMessageId}`
            }
            aria-invalid={!!error}
            data-slot="control"
            {...props}
        />
    );
}

export function FormDescription({
    className,
    ...props
}: React.ComponentPropsWithRef<"p">) {
    const { formDescriptionId } = useFormField();

    return (
        <p
            id={formDescriptionId}
            className={cn("text-sm text-muted-foreground", className)}
            data-slot="description"
            {...props}
        />
    );
}

export function FormMessage({
    className,
    children,
    ...props
}: React.ComponentPropsWithRef<"p">) {
    const { error, formMessageId } = useFormField();
    const body = error ? String(error?.message) : children;

    if (!body) return null;

    return (
        <p
            id={formMessageId}
            className={cn("text-sm font-medium text-destructive", className)}
            data-slot="message"
            {...props}
        >
            {body}
        </p>
    );
}

export type FormSubmitButtonProps = ButtonProps & {
    labels?: {
        ready?: React.ReactNode;
        validating?: React.ReactNode;
        submitting?: React.ReactNode;
        submitted?: React.ReactNode;
    };
    requireDirty?: boolean;
};

const defaultLabels = {
    ready: "Submit",
    validating: "Validating...",
    submitting: "Submitting...",
    submitted: "Submitted",
};

export function FormSubmitButton({
    children,
    className,
    disabled,
    variant,
    color,
    size,
    labels = {},
    requireDirty = false,
    ...props
}: FormSubmitButtonProps) {
    labels = { ...defaultLabels, ...labels };

    const {
        formState: {
            isDirty,
            isSubmitted,
            isSubmitSuccessful,
            isSubmitting,
            isValidating,
        },
    } = useFormContext();

    const state = isValidating
        ? "validating"
        : isSubmitting
          ? "submitting"
          : isSubmitted && isSubmitSuccessful
            ? "submitted"
            : "ready";

    const inProgressOrDone =
        isValidating || isSubmitting || (isSubmitted && isSubmitSuccessful);
    const nothingToSubmit = requireDirty && !isDirty;

    return (
        <button
            className={cn(
                "group",
                buttonVariants({ variant, color, size, className }),
            )}
            disabled={disabled || nothingToSubmit || inProgressOrDone}
            data-state={state}
            type="submit"
            {...props}
        >
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin hidden group-data-[state=validating]:inline group-data-[state=submitting]:inline" />
            {labels.ready ? (
                <FormSubmitButtonLabel activeState="ready">
                    {labels.ready}
                </FormSubmitButtonLabel>
            ) : null}
            {labels.validating ? (
                <FormSubmitButtonLabel activeState="validating">
                    {labels.validating}
                </FormSubmitButtonLabel>
            ) : null}
            {labels.submitting ? (
                <FormSubmitButtonLabel activeState="submitting">
                    {labels.submitting}
                </FormSubmitButtonLabel>
            ) : null}
            {labels.submitted ? (
                <FormSubmitButtonLabel activeState="submitted">
                    {labels.submitted}
                </FormSubmitButtonLabel>
            ) : null}
            {children}
        </button>
    );
}

export type FormSubmitButtonLabelProps = React.ComponentPropsWithRef<"span"> & {
    activeState: "ready" | "validating" | "submitting" | "submitted";
};

export function FormSubmitButtonLabel({
    children,
    className,
    activeState,
    ...props
}: FormSubmitButtonLabelProps) {
    return (
        <span
            className={cn(
                "hidden",
                activeState == "ready" && "group-data-[state=ready]:inline",
                activeState == "validating" &&
                    "group-data-[state=validating]:inline",
                activeState == "submitting" &&
                    "group-data-[state=submitting]:inline",
                activeState == "submitted" &&
                    "group-data-[state=submitted]:inline",
                className,
            )}
            {...props}
        >
            {children}
        </span>
    );
}

export const SubmitVerbs = {
    add: {
        ready: "Add",
        validating: "Validating...",
        submitting: "Adding...",
        submitted: "Added",
    },
    create: {
        ready: "Create",
        validating: "Validating...",
        submitting: "Creating...",
        submitted: "Created",
    },
    update: {
        ready: "Update",
        validating: "Validating...",
        submitting: "Updating...",
        submitted: "Updated",
    },
    delete: {
        ready: "Delete",
        validating: "Validating...",
        submitting: "Deleting...",
        submitted: "Deleted",
    },
    save: {
        ready: "Save",
        validating: "Validating...",
        submitting: "Saving...",
        submitted: "Saved",
    },
} as const;

export type FormCancelButtonProps = Omit<
    ComponentProps<typeof Button>,
    "onClick"
> &
    (
        | {
              onClick: React.MouseEventHandler<HTMLButtonElement>;
              redirectTo?: never;
          }
        | { onClick?: never; redirectTo: { href: string } }
    );

/**
 * A customizable cancel button component for forms. It supports either an `onClick` handler
 * or a navigation `href` link, but not both simultaneously.
 *
 * @param {object} props - The properties for the FormCancelButton component.
 * @param {React.ReactNode} [props.children="Cancel"] - The content to display inside the button. Defaults to "Cancel".
 * @param {string} [props.redirectTo] - The path to navigate to when the button is clicked. If provided, `onClick` will be ignored.
 * @param {React.MouseEventHandler<HTMLButtonElement>} [props.onClick] - The click event handler for the button. If provided, it takes precedence over `href`.
 * @param {string} [props.variant="ghost"] - The visual style variant of the button. Defaults to "ghost".
 * @param {object} [props.props] - Additional props to pass to the underlying button component.
 *
 * @returns {JSX.Element} A button element that either triggers an `onClick` handler or navigates to a specified `href`.
 *
 * @remarks
 * - If both `onClick` and `href` are provided, a warning will be logged, and `onClick` will take precedence.
 * - If neither `onClick` nor `href` is provided, a warning will be logged indicating that `onClick` is required.
 */
export function FormCancelButton({
    children = "Cancel",
    redirectTo: path,
    onClick,
    variant = "ghost",
    ...props
}: FormCancelButtonProps) {
    if (onClick) {
        if (path)
            console.warn(
                "FormCancelButton: onClick and redirectTo props are mutually exclusive. onClick will be used.",
            );

        const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            onClick(event);
        };

        return (
            <Button
                variant={variant}
                type="button"
                onClick={handleClick}
                {...props}
            >
                {children}
            </Button>
        );
    } else {
        if (!path)
            console.warn(
                "FormCancelButton: onClick prop is required when redirectTo is not provided.",
            );

        return (
            <Button variant={variant} type="button" {...props}>
                <Link to={path}>{children}</Link>
            </Button>
        );
    }
}

export function FormActions({
    children,
    className,
    right,
    ...props
}: ComponentProps<"div"> & { right?: ReactNode }) {
    return (
        <div
            className={cn("flex justify-between pt-2", className)}
            data-slot="actions"
            {...props}
        >
            <div className="flex gap-2">{children}</div>
            {right ? <div className="flex gap-2">{right}</div> : null}
        </div>
    );
}

export function DebugFormState() {
    const { formState } = useFormContext();

    return (
        <div className="border-2 border-orange-500 p-2 text-sm font-mono">
            <pre>
                {JSON.stringify(
                    pick(formState, [
                        "defaultValues",
                        "dirtyFields",
                        "disabled",
                        "errors",
                        "isDirty",
                        "isLoading",
                        "isSubmitSuccessful",
                        "isSubmitted",
                        "isSubmitting",
                        "isValid",
                        "isValidating",
                        "submitCount",
                        "touchedFields",
                        "validatingFields",
                    ]),
                    null,
                    2,
                )}
            </pre>
        </div>
    );
}
