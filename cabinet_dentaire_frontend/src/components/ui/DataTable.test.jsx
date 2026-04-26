import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DataTable from "./DataTable";

const columns = [
  { key: "name", header: "Nom", render: (row) => row.name.toUpperCase() },
  { key: "age", header: "Âge" },
];

describe("DataTable", () => {
  it("shows loading state", () => {
    render(<DataTable columns={columns} rows={[]} loading />);
    expect(screen.getByText(/chargement/i)).toBeInTheDocument();
  });

  it("shows empty message when there are no rows", () => {
    render(
      <DataTable columns={columns} rows={[]} emptyText="Rien à afficher." />
    );
    expect(screen.getByText("Rien à afficher.")).toBeInTheDocument();
  });

  it("renders headers and cell values including custom render", () => {
    render(
      <DataTable
        columns={columns}
        rows={[
          { id: 1, name: "dupont", age: 40 },
          { id: 2, name: "martin", age: 22 },
        ]}
      />
    );
    expect(screen.getByText("Nom")).toBeInTheDocument();
    expect(screen.getByText("Âge")).toBeInTheDocument();
    expect(screen.getByText("DUPONT")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("MARTIN")).toBeInTheDocument();
  });
});
