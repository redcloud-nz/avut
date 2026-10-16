/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { skillPackageSubscriptionsEffects } from "@/client/skill-package-subscriptions-effects";
import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { ObjectName } from "@/components/ui/typography";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

export function SkillTrack_UnsubscribeFromPackage_Dialog({
    skillPackage,
    ...props
}: DialogProps & {
    skillPackage: Pick<SkillPackage, "id" | "name" | "published" | "status">;
}) {
    const organization = useOrganization();
    const router = useRouter();

    // Once unsubscribed, a withdrawn package is no longer visible to this organisation
    // (`getPackage` returns NOT_FOUND), so leave its page for the catalogue list.
    const leavesPage = !SkillPackage.isAvailable(skillPackage);

    const mutation = useMutation(
        trpc.skillPackageSubscriptions.unsubscribeFromPackage.mutationOptions({
            meta: {
                effects: skillPackageSubscriptionsEffects.unsubscribeFromPackage,
                navigates: leavesPage,
            },
            onError(error) {
                console.error("Failed to unsubscribe from skill package:", error);
                toast.error(`Failed to unsubscribe from skill package: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Unsubscribed from <ObjectName>{skillPackage.name}</ObjectName>.
                    </>,
                );
                if (leavesPage) {
                    // The navigation is the whole close: don't also clear the dialog param.
                    router.push(
                        route("/orgs/[slug]/skill-track/catalogue", { slug: organization.slug }),
                    );
                } else {
                    props.onOpenChange?.(false);
                }
            },
        }),
    );

    useEffect(() => {
        if (props.open) {
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open]);

    return (
        <Dialog {...props}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Unsubscribe from Package</DialogTitle>
                    <DialogDescription>
                        You will be unsubscribed from <ObjectName>{skillPackage.name}</ObjectName>.
                        Skills from this package will no longer be available to your organisation.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        status={mutation.status}
                        text={{
                            idle: "Unsubscribe",
                            pending: "Unsubscribing...",
                            success: "Unsubscribed",
                        }}
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                skillPackageId: skillPackage.id,
                            })
                        }
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
