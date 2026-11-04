import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { RequestForm } from "../components/RequestForm";
async function fill() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/Название заявки/), "Бот для HR");
  await user.type(
    screen.getByLabelText(/Описание задачи/),
    "Согласование отпусков",
  );
  await user.selectOptions(screen.getByLabelText(/Категория/), "Бот");
}
describe("Request form", () => {
  it("validates required fields before sending", async () => {
    const save = vi.fn();
    render(<RequestForm onSave={save} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Создать заявку" }),
    );
    expect(await screen.findByText("Введите название")).toBeVisible();
    expect(screen.getByText("Опишите задачу")).toBeVisible();
    expect(
      screen.getByText("Выберите категорию", { selector: ".field-error" }),
    ).toBeVisible();
    expect(save).not.toHaveBeenCalled();
  });
  it("prevents parallel handler submissions as well as disabling the button", async () => {
    let resolve!: () => void;
    const save = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    render(<RequestForm onSave={save} />);
    await fill();
    const form = screen
      .getByRole("button", { name: "Создать заявку" })
      .closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Сохраняем…" })).toBeDisabled();
    expect(save.mock.calls[0]).toBeDefined();
    resolve();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Создать заявку" }),
      ).toBeEnabled(),
    );
  });
  it("allows retry after a network failure", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(undefined);
    render(<RequestForm onSave={save} />);
    await fill();
    await userEvent.click(
      screen.getByRole("button", { name: "Создать заявку" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Проверьте интернет",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Создать заявку" }),
    );
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  });
  it("edits the status of an existing request", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <RequestForm
        initial={{
          title: "Отчёт",
          description: "Продажи",
          category: "Отчёт",
          status: "Новая",
        }}
        onSave={save}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText("Статус"), "Завершена");
    await userEvent.click(
      screen.getByRole("button", { name: "Сохранить изменения" }),
    );
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        title: "Отчёт",
        description: "Продажи",
        category: "Отчёт",
        status: "Завершена",
      }),
    );
  });
});
