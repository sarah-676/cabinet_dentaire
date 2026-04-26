import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EntityForm from "./EntityForm";

const fields = [
  { name: "email", label: "Email", type: "text", required: true },
  { name: "role", label: "Rôle", type: "select", options: [{ value: "a", label: "A" }] },
];

describe("EntityForm", () => {
  it("validates with the provided validate function and blocks submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(
      <EntityForm
        title="Test"
        fields={fields}
        initialValues={{ email: "", role: "a" }}
        onCancel={onCancel}
        onSubmit={onSubmit}
        validate={() => ({ email: "Requis." })}
      />
    );
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));
    expect(await screen.findByText("Requis.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits values when validation passes", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <EntityForm
        title="Test"
        fields={fields}
        initialValues={{ email: "x@y.fr", role: "a" }}
        onCancel={() => {}}
        onSubmit={onSubmit}
      />
    );
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ email: "x@y.fr", role: "a" });
    });
  });

  it("calls onCancel when Annuler is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <EntityForm
        title="Test"
        fields={fields}
        initialValues={{ email: "", role: "a" }}
        onCancel={onCancel}
        onSubmit={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /annuler/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
