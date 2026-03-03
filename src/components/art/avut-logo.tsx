import Image from "next/image";

export function AVUTLogo() {
    return (
        <div className="w-[150px] self-center">
            <Image
                src="/avut-logo.svg"
                alt="A.V.U.T. Logo"
                width={150}
                height={50}
                className="dark:invert"
            />
        </div>
    );
}
