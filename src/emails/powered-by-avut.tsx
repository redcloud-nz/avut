/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Text } from "@react-email/components";

/**
 * The last line of an email AVUT sends on an organization's behalf, to people who may never have
 * used AVUT. Those emails carry no AVUT logo; this line is the only AVUT branding.
 */
export function PoweredByAvut() {
    return (
        <Text className="my-0 text-center text-[#999999] text-[11px] leading-5">
            Powered by AVUT
        </Text>
    );
}
