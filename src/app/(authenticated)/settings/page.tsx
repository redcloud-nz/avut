/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /settings
 */

import { Argus } from "@/components/blocks/argus";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserProfile_Card } from "./user-profile";

export default async function Settings_Page(props: PageProps<"/settings">) {
    return (
        <Argus.Root className="justify-start">
            <Argus.Column width="lg">
                <h1 className="scroll-m-20 text-xl font-semibold tracking-tight">Settings</h1>
                <Tabs defaultValue="account" className="w-full">
                    <TabsList variant="line" className="w-full border-b mb-4">
                        <TabsTrigger value="account">Account</TabsTrigger>
                        <TabsTrigger value="security">Security</TabsTrigger>
                    </TabsList>
                    <TabsContent value="account" className="space-y-4">
                        <UserProfile_Card />
                        <Card>
                            <CardHeader>
                                <CardTitle>Change email</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <FieldGroup>
                                    <Field>
                                        <FieldLabel>New email</FieldLabel>
                                        <Input type="email" />
                                    </Field>
                                    <Field orientation="horizontal">
                                        <Button>Save changes</Button>
                                    </Field>
                                </FieldGroup>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="security" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Change password</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <FieldGroup>
                                    <Field>
                                        <FieldLabel>Current password</FieldLabel>
                                        <Input type="password" />
                                    </Field>
                                    <Field>
                                        <FieldLabel>New password</FieldLabel>
                                        <Input type="password" />
                                    </Field>
                                    <Field orientation="horizontal">
                                        <Button>Save changes</Button>
                                    </Field>
                                </FieldGroup>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </Argus.Column>
        </Argus.Root>
    );
}
