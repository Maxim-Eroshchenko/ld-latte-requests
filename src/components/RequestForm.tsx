import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  categories,
  statuses,
  requestSchema,
  errorMessage,
  type RequestInput,
} from "../lib/model";
export function RequestForm({
  initial,
  onSave,
}: {
  initial?: RequestInput;
  onSave: (values: RequestInput) => Promise<void>;
}) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestInput>({
    resolver: zodResolver(requestSchema),
    defaultValues: initial ?? {
      title: "",
      description: "",
      category: undefined,
      status: "Новая",
    },
  });
  const submit = handleSubmit(async (values) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await onSave(values);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  });
  return (
    <form
      onSubmit={submit}
      noValidate
      className="request-form"
      aria-busy={busy}
    >
      <fieldset disabled={busy}>
        <label htmlFor="title">
          Название заявки <span>*</span>
        </label>
        <input
          id="title"
          placeholder="Например, бот для согласования отпусков"
          maxLength={160}
          {...register("title")}
          aria-invalid={!!errors.title}
          aria-describedby="title-error"
        />
        <small id="title-error" className="field-error">
          {errors.title?.message}
        </small>
        <label htmlFor="description">
          Описание задачи <span>*</span>
        </label>
        <textarea
          id="description"
          rows={7}
          placeholder="Какой процесс нужно автоматизировать? Как вы работаете сейчас и какой результат ожидаете?"
          maxLength={10000}
          {...register("description")}
          aria-invalid={!!errors.description}
          aria-describedby="description-error"
        />
        <small id="description-error" className="field-error">
          {errors.description?.message}
        </small>
        <div className="form-grid">
          <div>
            <label htmlFor="category">
              Категория <span>*</span>
            </label>
            <select
              id="category"
              {...register("category")}
              aria-invalid={!!errors.category}
              aria-describedby="category-error"
            >
              <option value="">Выберите категорию</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <small id="category-error" className="field-error">
              {errors.category?.message}
            </small>
          </div>
          <div>
            <label htmlFor="status">Статус</label>
            <select id="status" {...register("status")} disabled={!initial}>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            {!initial && <small>Новой заявке назначается автоматически</small>}
          </div>
        </div>
      </fieldset>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <div className="form-footer">
        <small>* Обязательные поля</small>
        <button className="primary" disabled={busy} type="submit">
          {busy
            ? "Сохраняем…"
            : initial
              ? "Сохранить изменения"
              : "Создать заявку"}
        </button>
      </div>
    </form>
  );
}
