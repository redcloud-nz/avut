/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

export default function Organizations_Base_Layout({
    modal,
    children,
}: {
    modal: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <>
            {modal}
            {children}
        </>
    );
}
