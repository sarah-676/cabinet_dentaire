import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PageState from "./PageState";

describe("PageState", () => {
  it("renders loading copy", () => {
    render(<PageState type="loading" />);
    expect(screen.getByText(/chargement/i)).toBeInTheDocument();
  });

  it("renders empty state with custom message", () => {
    render(<PageState type="empty" message="Liste vide." />);
    expect(screen.getByText("Liste vide.")).toBeInTheDocument();
  });

  it("renders error state with InlineError", () => {
    render(<PageState type="error" message="Échec réseau." />);
    expect(screen.getByText("Échec réseau.")).toBeInTheDocument();
  });

  it("renders nothing for unknown type", () => {
    const { container } = render(<PageState type="other" />);
    expect(container.firstChild).toBeNull();
  });
});
