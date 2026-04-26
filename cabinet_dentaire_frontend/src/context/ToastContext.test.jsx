import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ToastProvider, useToast } from "./ToastContext";

function Probe() {
  const { showError, showSuccess, clearToast } = useToast();
  return (
    <div>
      <button type="button" data-testid="toast-err" onClick={() => showError("Erreur test")}>
        err
      </button>
      <button type="button" data-testid="toast-ok" onClick={() => showSuccess("OK test")}>
        ok
      </button>
      <button type="button" data-testid="toast-clear" onClick={() => clearToast()}>
        clear
      </button>
    </div>
  );
}

describe("ToastProvider / useToast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws when useToast is used outside the provider", () => {
    expect(() => render(<Probe />)).toThrow(/ToastProvider/i);
  });

  it("shows error toast and clears on close button", async () => {
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>
    );
    fireEvent.click(screen.getByTestId("toast-err"));
    expect(await screen.findByText("Erreur test")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /close error message/i }));
    await waitFor(() => {
      expect(screen.queryByText("Erreur test")).not.toBeInTheDocument();
    });
  });

  it("ignores empty messages", () => {
    function EmptyErr() {
      const { showError } = useToast();
      return (
        <button type="button" data-testid="toast-empty" onClick={() => showError("")}>
          empty
        </button>
      );
    }
    render(
      <ToastProvider>
        <EmptyErr />
      </ToastProvider>
    );
    fireEvent.click(screen.getByTestId("toast-empty"));
    expect(screen.queryByText("Erreur test")).not.toBeInTheDocument();
  });
});
