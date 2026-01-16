/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /
 */

import Link from "next/link";

export default function HomePage() {
    return (
        <div className="min-h-screen bg-lnear-to-br from-blue-50 to-indigo-100">
            {/* Header */}
            <header className="bg-white shadow">
                <nav className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center">
                        <h1 className="text-2xl font-bold text-indigo-600">
                            AVUT
                        </h1>
                        <div className="space-x-4">
                            <Link
                                href="#about"
                                className="text-gray-600 hover:text-indigo-600"
                            >
                                About
                            </Link>
                            <Link
                                href="#features"
                                className="text-gray-600 hover:text-indigo-600"
                            >
                                Features
                            </Link>
                        </div>
                    </div>
                </nav>
            </header>

            {/* Hero Section */}
            <section className="max-w-6xl mx-auto px-4 py-20 sm:px-6 lg:px-8">
                <div className="text-center">
                    <h2 className="text-4xl font-bold text-gray-900 mb-6">
                        Welcome to AVUT
                    </h2>
                    <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                        The assembled vaguely useful tools.
                    </p>
                    <button className="bg-indigo-600 text-white px-8 py-3 rounded-lg hover:bg-indigo-700 font-semibold">
                        Get Started
                    </button>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="bg-white py-20">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h3 className="text-3xl font-bold text-center mb-12">
                        Features
                    </h3>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[1, 2, 3].map((item) => (
                            <div
                                key={item}
                                className="text-center p-6 border rounded-lg hover:shadow-lg transition"
                            >
                                <div className="text-3xl mb-4">✨</div>
                                <h4 className="text-lg font-semibold mb-2">
                                    Feature {item}
                                </h4>
                                <p className="text-gray-600">
                                    Discover what makes AVUT the best choice for
                                    your needs
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-white py-8">
                <div className="max-w-6xl mx-auto px-4 text-center">
                    <p>&copy; {new Date().getFullYear()} A.V.U.T. Project.</p>
                </div>
            </footer>
        </div>
    );
}
