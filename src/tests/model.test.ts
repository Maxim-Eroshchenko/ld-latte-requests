import { describe, it, expect } from "vitest";
import {
  requestSchema,
  filterRequests,
  errorMessage,
  type RequestRow,
} from "../lib/model";
const rows: RequestRow[] = [
  {
    id: "a",
    user_id: "a",
    title: "Бот для HR",
    description: "Описание",
    category: "Бот",
    status: "Новая",
    created_at: "",
    updated_at: "",
  },
  {
    id: "b",
    user_id: "a",
    title: "Бот для продаж",
    description: "Описание",
    category: "Бот",
    status: "В работе",
    created_at: "",
    updated_at: "",
  },
];
describe("Request data", () => {
  it("requires all fields and trims strings", () => {
    expect(
      requestSchema.safeParse({
        title: " ",
        description: " ",
        category: "",
        status: "Новая",
      }).success,
    ).toBe(false);
    expect(requestSchema.parse({ ...rows[0], title: " Тест " }).title).toBe(
      "Тест",
    );
  });
  it("rejects invalid status, category and excess lengths", () => {
    for (const data of [
      { ...rows[0], status: "Удалена" },
      { ...rows[0], category: "CRM" },
      { ...rows[0], title: "x".repeat(161) },
      { ...rows[0], description: "x".repeat(10001) },
    ])
      expect(requestSchema.safeParse(data).success).toBe(false);
  });
  it("combines case-insensitive search and status", () => {
    expect(filterRequests(rows, " БОТ ", "В работе").map((r) => r.id)).toEqual([
      "b",
    ]);
    expect(filterRequests(rows, "HR", "В работе")).toEqual([]);
    expect(filterRequests(rows, "", "")).toHaveLength(2);
  });
  it("shows useful auth and network errors without raw server output", () => {
    expect(errorMessage({ code: "invalid_credentials" })).toContain("email");
    expect(errorMessage(new TypeError("Failed to fetch"))).toContain(
      "интернет",
    );
    expect(errorMessage(new Error("sensitive details"))).not.toContain(
      "sensitive",
    );
  });
});
