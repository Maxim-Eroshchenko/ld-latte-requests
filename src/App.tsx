import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  CirclePlus,
  Coffee,
  FileText,
  LayoutGrid,
  LogOut,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { client, supabase } from "./lib/supabase";
import {
  errorMessage,
  filterRequests,
  statuses,
  type RequestRow,
} from "./lib/model";
import { loadRequest, loadRequests, saveRequest } from "./lib/requests";
import { RequestForm } from "./components/RequestForm";

function Brand() {
  return (
    <Link to="/" className="brand" aria-label="LD LATTE — главная">
      <span className="brand-icon">
        <Coffee size={23} />
      </span>
      <span>
        LD LATTE<small>WORKSPACE</small>
      </span>
    </Link>
  );
}
function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      Загружаем…
    </div>
  );
}
function Setup() {
  return (
    <div className="setup">
      <Brand />
      <div className="panel">
        <ShieldCheck size={36} />
        <h1>Подключим рабочее пространство</h1>
        <p>
          Приложение готово к настройке Supabase. Для работы нужны авторизация и
          база заявок.
        </p>
        <ol>
          <li>
            Выполните SQL из <code>supabase/migrations</code>.
          </li>
          <li>
            Скопируйте <code>.env.example</code> в <code>.env.local</code> и
            задайте URL и публичный ключ проекта.
          </li>
          <li>
            Перезапустите <code>npm run dev</code>.
          </li>
        </ol>
        <p>Подробная инструкция находится в README.md проекта.</p>
      </div>
    </div>
  );
}
function AuthPage() {
  const { session, loading, error: sessionError } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  if (loading) return <Loading />;
  if (session) return <Navigate to="/requests" replace />;
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div>
          <div className="eyebrow">МЕНЬШЕ РУТИНЫ. БОЛЬШЕ ВОЗМОЖНОСТЕЙ.</div>
          <h1>
            Хорошие идеи
            <br />
            становятся
            <br />
            <em>простыми решениями.</em>
          </h1>
          <p>
            Предложите, что можно автоматизировать.
            <br />
            Соберём все ваши задачи в одном месте.
          </p>
          <div className="story-line">
            <Sparkles size={20} /> От идеи — к удобному рабочему процессу
          </div>
        </div>
        <small>LD LATTE · Внутренний сервис автоматизации</small>
      </section>
      <section className="auth-main">
        <div className="auth-card">
          <span className="eyebrow">ВАШЕ РАБОЧЕЕ ПРОСТРАНСТВО</span>
          <h2>
            {mode === "login" ? "Рады видеть вас" : "Давайте познакомимся"}
          </h2>
          <p>
            {mode === "login"
              ? "Войдите, чтобы управлять своими заявками."
              : "Создайте аккаунт и отправьте первую идею."}
          </p>
          <div className="tabs">
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setError("");
                setMessage("");
              }}
              disabled={busy}
            >
              Вход
            </button>
            <button
              className={mode === "signup" ? "active" : ""}
              onClick={() => {
                setMode("signup");
                setError("");
                setMessage("");
              }}
              disabled={busy}
            >
              Регистрация
            </button>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (lock.current) return;
              lock.current = true;
              setBusy(true);
              setError("");
              setMessage("");
              const form = new FormData(e.currentTarget);
              const email = String(form.get("email")).trim();
              const password = String(form.get("password"));
              try {
                const { data, error } =
                  mode === "signup"
                    ? await client().auth.signUp({
                        email,
                        password,
                        options: {
                          emailRedirectTo: window.location.origin + "/requests",
                        },
                      })
                    : await client().auth.signInWithPassword({
                        email,
                        password,
                      });
                if (error) throw error;
                if (mode === "signup" && !data.session)
                  setMessage(
                    "Проверьте почту: если регистрация доступна, вы получите письмо со ссылкой для подтверждения email. После подтверждения войдите в аккаунт.",
                  );
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={busy}>
              <label htmlFor="email">Рабочий email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@company.ru"
                required
                maxLength={254}
              />
              <label htmlFor="password">Пароль</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={mode === "signup" ? 8 : 1}
                maxLength={128}
                placeholder={
                  mode === "signup" ? "Не менее 8 символов" : "Введите пароль"
                }
                required
              />
              {mode === "signup" && (
                <small>
                  Не менее 8 символов. Используйте буквы, цифры и символы.
                </small>
              )}
            </fieldset>
            {(error || sessionError) && (
              <div role="alert" className="alert error">
                {error || sessionError}
              </div>
            )}
            {message && (
              <div role="status" className="alert success">
                {message}
              </div>
            )}
            <button className="primary full" disabled={busy}>
              {busy
                ? "Подождите…"
                : mode === "login"
                  ? "Войти в аккаунт"
                  : "Создать аккаунт"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="privacy">
            <ShieldCheck size={16} /> Ваши заявки доступны только вам
          </div>
        </div>
      </section>
    </div>
  );
}
function Protected() {
  const { session, loading, error } = useAuth();
  if (loading) return <Loading />;
  if (error)
    return (
      <div role="alert" className="alert error">
        {error}
        <button onClick={() => window.location.reload()}>Повторить</button>
      </div>
    );
  return session ? (
    <Outlet key={session.user.id} />
  ) : (
    <Navigate to="/login" replace />
  );
}
function Shell() {
  const { session } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <nav aria-label="Основная навигация">
          <NavLink to="/requests" end>
            <LayoutGrid size={19} />
            Мои заявки
          </NavLink>
          <NavLink to="/requests/new">
            <CirclePlus size={19} />
            Создать заявку
          </NavLink>
        </nav>
        <div className="sidebar-note">
          <span className="note-icon">
            <Sparkles size={21} />
          </span>
          <strong>
            Освободите время
            <br />
            для важного
          </strong>
          <p>Рутина подсказывает, с чего начать автоматизацию.</p>
        </div>
        <div className="account">
          <span className="avatar">
            {session?.user.email?.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>Мой аккаунт</strong>
            <small title={session?.user.email}>{session?.user.email}</small>
          </div>
          <button
            className="icon-button"
            aria-label="Выйти из аккаунта"
            disabled={busy}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              setError("");
              try {
                const { error } = await client().auth.signOut({
                  scope: "local",
                });
                if (error) throw error;
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span>Автоматизация процессов</span>
          <span className="internal">
            <span /> Внутренний сервис
          </span>
        </header>
        {error && (
          <div role="alert" className="alert error">
            {error}
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
function Badge({ status }: { status: string }) {
  return (
    <span
      className={
        "badge " +
        (status === "Новая"
          ? "new"
          : status === "В работе"
            ? "progress"
            : "done")
      }
    >
      <i />
      {status}
    </span>
  );
}
function RequestsPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [retry, setRetry] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    loadRequests()
      .then((r) => {
        if (active) setRows(r);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  const filtered = filterRequests(rows, search, status);
  const notice = (location.state as { notice?: string } | null)?.notice;
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ОТ ИДЕИ К РЕЗУЛЬТАТУ</div>
          <h1>
            Мои заявки<span className="count">{rows.length}</span>
          </h1>
          <p>Ваши идеи для автоматизации — и всё, что с ними происходит.</p>
        </div>
        <Link className="primary" to="/requests/new">
          <CirclePlus size={18} />
          Новая заявка
        </Link>
      </div>
      {notice && (
        <div className="alert success" role="status">
          {notice}
          <button
            className="icon-button"
            aria-label="Скрыть уведомление"
            onClick={() =>
              navigate("/requests", { replace: true, state: null })
            }
          >
            <X size={16} />
          </button>
        </div>
      )}
      <section className="stats" aria-label="Статистика заявок">
        {statuses.map((s, i) => (
          <div className="stat" key={s}>
            <span className={"stat-icon icon-" + i}>
              {i === 0 ? (
                <FileText size={21} />
              ) : i === 1 ? (
                <Sparkles size={21} />
              ) : (
                <CheckCheck size={21} />
              )}
            </span>
            <div>
              <small>
                {s === "Новая"
                  ? "Новые"
                  : s === "В работе"
                    ? "В работе"
                    : "Завершённые"}
              </small>
              <strong>
                {loading ? "—" : rows.filter((r) => r.status === s).length}
              </strong>
            </div>
            <span className="stat-mark">0{i + 1}</span>
          </div>
        ))}
      </section>
      <section className="requests-panel">
        <div className="list-header">
          <h2>Все заявки</h2>
          <span>Всё начинается с вашей идеи</span>
        </div>
        <div className="filters">
          <div className="search-box">
            <Search size={18} />
            <input
              aria-label="Поиск по названию"
              placeholder="Найти заявку по названию…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Фильтр по статусу"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Все статусы</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {(search || status) && (
            <button
              className="text-button"
              onClick={() => {
                setSearch("");
                setStatus("");
              }}
            >
              Сбросить
            </button>
          )}
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="empty">
            <p role="alert">{error}</p>
            <button onClick={() => setRetry((r) => r + 1)}>
              Повторить загрузку
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">
              <FileText size={30} />
            </span>
            <h3>
              {rows.length ? "Ничего не найдено" : "Здесь появятся ваши идеи"}
            </h3>
            <p>
              {rows.length
                ? "Попробуйте изменить запрос или сбросить фильтры."
                : "Создайте первую заявку — начните с процесса, который отнимает время каждый день."}
            </p>
            {!rows.length && (
              <Link className="primary" to="/requests/new">
                <CirclePlus size={17} />
                Создать первую заявку
              </Link>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Заявка</th>
                  <th>Категория</th>
                  <th>Дата создания</th>
                  <th>Статус</th>
                  <th>
                    <span className="sr-only">Открыть</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link className="request-link" to={"/requests/" + row.id}>
                        {row.title}
                      </Link>
                      <small className="request-number">
                        #{row.id.slice(0, 8).toUpperCase()}
                      </small>
                    </td>
                    <td>
                      <span className="category">{row.category}</span>
                    </td>
                    <td className="date">
                      {new Date(row.created_at).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <Badge status={row.status} />
                    </td>
                    <td>
                      <Link
                        className="open-link"
                        to={"/requests/" + row.id}
                        aria-label={"Открыть: " + row.title}
                      >
                        <ArrowUpRight size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="list-footer">
          <span>
            {!loading && !error
              ? `Показано ${filtered.length} из ${rows.length}`
              : "Ваши заявки"}
          </span>
          <span>
            <ShieldCheck size={14} /> Видны только вам
          </span>
        </footer>
      </section>
      <div className="page-bottom">
        <span>Маленькие улучшения. Большие перемены.</span>
        <span>LD LATTE / AUTOMATION</span>
      </div>
    </div>
  );
}
function EditorPage() {
  const { id } = useParams();
  const [row, setRow] = useState<RequestRow>();
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const navigate = useNavigate();
  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError("");
    loadRequest(id)
      .then((r) => {
        if (active) setRow(r);
      })
      .catch((e) => {
        if (active)
          setError(
            (e as { code?: string })?.code === "PGRST116"
              ? "Заявка не найдена или недоступна вашему аккаунту."
              : errorMessage(e),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, retry]);
  return (
    <div className="page editor">
      <Link className="back" to="/requests">
        <ArrowLeft size={16} />
        Все заявки
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">АВТОМАТИЗАЦИЯ НАЧИНАЕТСЯ ЗДЕСЬ</div>
          <h1>{id ? "Редактирование заявки" : "Новая заявка"}</h1>
          <p>
            {id
              ? "Уточните детали или обновите статус."
              : "Расскажите, какую задачу вы хотите упростить."}
          </p>
        </div>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <div className="alert error" role="alert">
          {error}
          <button onClick={() => setRetry((r) => r + 1)}>Повторить</button>
        </div>
      ) : (
        <section className="panel">
          <div className="panel-intro">
            <FileText size={21} />
            <h2>Детали заявки</h2>
            {row && <Badge status={row.status} />}
          </div>
          <RequestForm
            key={id ?? "new"}
            initial={row}
            onSave={async (values) => {
              await saveRequest(values, id);
              navigate("/requests", {
                state: {
                  notice: id
                    ? "Изменения сохранены."
                    : "Заявка создана. Статус — «Новая».",
                },
              });
            }}
          />
        </section>
      )}
    </div>
  );
}
export default function App() {
  if (!supabase) return <Setup />;
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route element={<Protected />}>
          <Route element={<Shell />}>
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/requests/new" element={<EditorPage key="new" />} />
            <Route path="/requests/:id" element={<EditorPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/requests" replace />} />
      </Routes>
    </AuthProvider>
  );
}
