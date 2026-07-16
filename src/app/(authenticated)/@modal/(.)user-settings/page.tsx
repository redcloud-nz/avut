/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user-settings
 */

"use client";

import { useRouter } from "next/navigation";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { UserSettings_PageContent } from "@/components/user-settings/settings-page";

export default function Settings_DialogLayout() {
    const router = useRouter();

    return (
        <Dialog
            open={true}
            onOpenChange={(open) => {
                if (!open) router.back();
            }}
        >
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>User Settings</DialogTitle>
                    <DialogDescription>
                        Manage your account, security, and organizations settings.
                    </DialogDescription>
                </DialogHeader>
                <UserSettings_PageContent />;
            </DialogContent>
        </Dialog>
    );
}
