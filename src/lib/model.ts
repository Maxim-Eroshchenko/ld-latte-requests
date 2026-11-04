import { z } from "zod";
export const categories = ["Бот", "Интеграция", "Отчёт", "Другое"] as const;
export const statuses = ["Новая", "В работе", "Завершена"] as const;
export const requestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Введите название")
    .max(160, "Не более 160 символов"),
  description: z
    .string()
    .trim()
    .min(1, "Опишите задачу")
    .max(10000, "Не более 10 000 символов"),
  category: z.enum(categories, { error: "Выберите категорию" }),
  status: z.enum(statuses),
});
export type RequestInput = z.infer<typeof requestSchema>;
export type RequestRow = RequestInput & {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};
export function filterRequests(
  rows: RequestRow[],
  search: string,
  status: string,
) {
  return rows.filter(
    (r) =>
      r.title
        .toLocaleLowerCase("ru")
        .includes(search.trim().toLocaleLowerCase("ru")) &&
      (!status || r.status === status),
  );
}
export function errorMessage(error: unknown): string {
  const e = error as { message?: string; code?: string };
  if (e?.code === "invalid_credentials") return "Неверный email или пароль.";
  if (e?.code === "email_not_confirmed")
    return "Подтвердите email по ссылке из письма.";
  if (e?.code === "user_already_exists")
    return "Этот email уже зарегистрирован. Войдите в аккаунт.";
  if (e?.code === "weak_password")
    return "Пароль слишком простой. Используйте более сложный пароль.";
  if (
    e?.code === "over_email_send_rate_limit" ||
    e?.code === "over_request_rate_limit"
  )
    return "Слишком много попыток. Подождите немного и повторите.";
  if (e?.message?.match(/fetch|network|connection|timeout/i))
    return "Не удалось связаться с сервером. Проверьте интернет и повторите попытку.";
  return "Не удалось выполнить действие. Повторите попытку. Если ошибка остаётся, обратитесь к ответственному за сервис.";
}
