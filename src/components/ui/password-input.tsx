/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { ComponentProps, useState } from "react";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "./input-group";

export function PasswordInput(
    props: Omit<ComponentProps<"input">, "type"> & {
        slotProps?: {
            inputGroup?: ComponentProps<typeof InputGroup>;
            inputGroupAddon?: ComponentProps<typeof InputGroupAddon>;
            inputGroupButton?: ComponentProps<typeof InputGroupButton>;
        };
    },
) {
    const [passwordShown, setShowPassword] = useState(false);

    return (
        <InputGroup {...props.slotProps?.inputGroup}>
            <InputGroupInput {...props} type={passwordShown ? "text" : "password"} />
            <InputGroupAddon align="inline-end" {...props.slotProps?.inputGroupAddon}>
                <InputGroupButton
                    aria-label={passwordShown ? "Hide password" : "Show password"}
                    title={passwordShown ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((prev) => !prev)}
                    type="button"
                    size="icon-xs"
                    {...props.slotProps?.inputGroupButton}
                >
                    {passwordShown ? <EyeOffIcon /> : <EyeIcon />}
                </InputGroupButton>
            </InputGroupAddon>
        </InputGroup>
    );
}
