import React from "react";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

globalThis.React = React;

configure({ reactStrictMode: false });

afterEach(() => {
  cleanup();
});
