# Подключение проекта LD LATTE через Supabase SQL Editor

Организация: **LD LATTE Development**. Проект: **ld-latte-requests**.

- Project ref: `rvfunzjedtcnrpvpsajj`.
- API URL: `https://rvfunzjedtcnrpvpsajj.supabase.co`.
- [SQL Editor именно этого проекта](https://supabase.com/dashboard/project/rvfunzjedtcnrpvpsajj/sql/new).

## Фактическое состояние

Пользователь настроил таблицу public.requests, три политики и публичный ключ. Миграция повторно не запускалась. Реальные UI-операции и npm run test:rls с A/B прошли: PASS, код 0. Инструменты Supabase MCP, включая execute_sql для флагов RLS, по-прежнему возвращают Unknown tool; каталог БД напрямую не прочитан. Защита фактически проверена Data API.

Приложение: https://ld-latte-requests-m-a-x-i-m.msk1.amvera.tech — доступ публичный без ChatGPT, работа без VPN подтверждена пользователем. На снимке URL Configuration указаны Site URL этого домена и Redirect URL с /requests; старый Sites и локальный Redirect URL сохранены. Новый signup с письмом пользователь подтвердил на прежнем публичном домене; именно на Amvera отдельно не повторялся.

Следующие шаги применения SQL предназначены для новой базы. В существующем проекте повторно таблицу не создавайте и миграцию не запускайте. Пароль БД, service_role и secret key для клиентского приложения не нужны; пароли тестовых пользователей вводятся локально, не в чат.

## 1. Проверить новую базу перед применением

Откройте ссылку SQL Editor выше, проверьте название проекта и роль `postgres`. Создайте новый запрос и выполните:

```sql
select to_regclass('public.requests') as requests_table,
       to_regprocedure('public.touch_request()') as timestamp_function;
```

В новой базе оба результата должны быть `NULL`. Если объекты уже существуют, **не удаляйте их и не запускайте миграцию повторно вслепую**. Откройте их схему и сравните с подготовленным SQL; сохраните сведения об ошибке, а не исправляйте её удалением таблицы с данными.

## 2. Применить миграцию один раз

1. Локально откройте `supabase/migrations/202611040001_requests.sql`.
2. Скопируйте **весь файл**, включая `begin;` и `commit;`, в новый запрос SQL Editor. Чтобы избежать ручного перепечатывания, в PowerShell можно использовать:

   ```powershell
   Get-Content -LiteralPath 'D:\Desktop\AutoCodex\supabase\migrations\202611040001_requests.sql' -Raw | Set-Clipboard
   ```

3. Нажмите **Run**. Ожидается успешное завершение без ошибок. Таблица, функция, триггер, индексы, политики и права создаются одной транзакцией.
4. Если возникла ошибка, миграция не считается применённой. Прочитайте сообщение. Если текущий редактор сообщает `current transaction is aborted`, выполните `rollback;` отдельным запросом, затем проверку из шага 1. Не выполняйте `DROP TABLE` для обхода ошибки.

Эта операция через SQL Editor создаёт схему, но не регистрирует версию в CLI migration history. Не запускайте позднее `supabase db push` поверх неё без сверки истории и схемы: CLI может попытаться повторно создать таблицу. Для дальнейшей работы выберите один управляемый процесс миграций и сначала согласуйте baseline.

## 3. Проверить RLS, политики и разрешённые колонки

Выполните отдельным запросом:

```sql
select relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
from pg_class where oid = 'public.requests'::regclass;

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'requests'
order by policyname;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'requests'
  and grantee in ('anon', 'authenticated');

select grantee, privilege_type, column_name
from information_schema.role_column_grants
where table_schema = 'public' and table_name = 'requests'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type, column_name;
```

Ожидается:

- `rls_enabled = true`, `rls_forced = true`.
- Три политики: `requests_select_own`, `requests_insert_own`, `requests_update_own`; роль `authenticated`; владение проверяется через `auth.uid()`. UPDATE содержит и `qual`, и `with_check`.
- У `authenticated` есть табличный SELECT. Нет табличных INSERT/UPDATE/DELETE и нет прав `anon`.
- Колонковый INSERT только для `title`, `description`, `category`. Колонковый UPDATE только для этих полей и `status`. Колонковый SELECT может выводиться для всех колонок вследствие табличного SELECT — это нормально.

Проверяйте именно набор прав. Дополнительная политика общего доступа или лишний табличный UPDATE могут ослабить защиту, даже если три ожидаемые политики существуют.

## 4. Подключить браузерный клиент

1. В Dashboard проекта откройте **Connect** или **Settings → API Keys** и найдите **publishable key** (`sb_publishable_…`). Если используется legacy-ключ, допустим только `anon`.
2. Создайте `.env.local` в корне проекта, если его ещё нет. Заполните локально:

   ```dotenv
   VITE_SUPABASE_URL=https://rvfunzjedtcnrpvpsajj.supabase.co
   VITE_SUPABASE_ANON_KEY=ВСТАВЬТЕ_СЮДА_PUBLISHABLE_KEY
   ```

3. Не используйте ключ `sb_secret_…`, legacy `service_role` или пароль БД. Не отправляйте их в чат. Имя переменной `ANON_KEY` сохранено для совместимости приложения; publishable key также подходит.
4. Убедитесь, что Data API проекта включён и схема `public` доступна ему. Нужные права таблицы уже создаёт миграция; политику общего доступа добавлять не нужно.
5. Выполните `npm run dev`, откройте `http://127.0.0.1:5173`. При изменении env перезапускайте dev-сервер. Для статического хостинга переменные задаются до сборки; на Amvera сервер читает их при запуске и отдаёт только публичную конфигурацию через `/runtime-config.js`.

Публичный ключ браузера действует вместе с RLS, секретный ключ обходит её: [официальная документация ключей](https://supabase.com/docs/guides/getting-started/api-keys).

## 5. Настроить Auth и два тестовых аккаунта

В **Authentication → Sign In / Providers** включите Email/password. Оставьте подтверждение email в выбранном вами режиме; приложение поддерживает оба варианта. В **URL Configuration** задайте:

- Site URL: `http://127.0.0.1:5173`.
- Redirect URL: `http://127.0.0.1:5173/requests`.

После публикации добавьте production-origin и `/requests`. Не подменяйте их адресом API Supabase.

Зарегистрируйте через приложение два различных тестовых аккаунта A и B с доступными вам почтовыми адресами. При включённом подтверждении подтвердите оба email. Проверьте вход и выход. Если встроенный почтовый сервис не отправляет письмо, проверьте Auth logs/ограничения почты и SMTP; не выдавайте неполученное письмо за успешную регистрацию. Пароли задайте самостоятельно и храните локально.

Для SQL-проверки получите UUID этих двух тестовых пользователей в **Authentication → Users**. UUID не является паролем. Пользователей напрямую через INSERT в `auth.users` создавать не нужно.

## 6. Проверить политики в SQL Editor

Откройте `supabase/tests/verify_requests.sql`. Замените `REPLACE_WITH_USER_A_UUID` и `REPLACE_WITH_USER_B_UUID` на UUID существующих двух тестовых аккаунтов. Запустите **весь файл** в SQL Editor от `postgres`.

Сценарий сам переключается на `authenticated`, задаёт JWT subject для A и B, проверяет начальные значения и права владельца, отсутствие чужих строк в списке и по UUID, запрет изменения чужой заявки, подмены владельца и первоначального статуса, ограничения обязательных полей и запрет анонимного SELECT. Любое нарушение вызывает исключение. Последний `rollback` откатывает обе тестовые записи и настройки сеанса.

Ожидается результат `PASS: PostgreSQL RLS and column permissions checked for A/B. API/Auth not tested by this SQL script.` без ошибок. Если выполнение прервано, завершите открытую тестовую транзакцию командой `rollback;`. Такой тест проверяет PostgreSQL под нужными ролями, **но не проверяет выдачу настоящих JWT, подтверждение email или доступ через PostgREST**.

## 7. Проверить настоящий API двумя пользователями

В корне проекта:

```powershell
Copy-Item .env.rls.example .env.rls
```

Откройте `.env.rls` локально и задайте:

```dotenv
SUPABASE_URL=https://rvfunzjedtcnrpvpsajj.supabase.co
SUPABASE_ANON_KEY=ВАШ_PUBLISHABLE_KEY
RLS_A_EMAIL=EMAIL_ТЕСТОВОГО_A
RLS_A_PASSWORD=ПАРОЛЬ_ТЕСТОВОГО_A
RLS_B_EMAIL=EMAIL_ТЕСТОВОГО_B
RLS_B_PASSWORD=ПАРОЛЬ_ТЕСТОВОГО_B
```

Ничего из этого файла в чат присылать не нужно. `.env.rls` исключён из Git. Выполните:

```powershell
npm run test:rls
```

Только успешный код завершения и итоговый `PASS` подтверждают выполнение этого API-прогона. Проверяются реальные сессии A/B, создание, чтение и редактирование, прямой чужой UUID, подмена владельца, обязательные поля, статус, анонимный доступ и повторный вход. Ответ `200 []` на чтение/изменение чужой строки означает, что строка скрыта RLS; это ожидаемый безопасный результат, а не обязательный HTTP 403.

Скрипт оставляет две помеченные тестовые заявки для осмотра (их UUID печатаются при успехе). При ошибке они тоже могут остаться. Удаляйте только эти записи вручную после проверки, через Table Editor/SQL Editor владельца проекта. Скрипт не требует повышенного ключа и не добавляет клиенту право DELETE.

## 8. Зафиксировать фактический результат

В `AI_USAGE.md` и `KNOWN_ISSUES.md` отмечайте облачную миграцию и проверки как выполненные только после успешного запуска в этом проекте. Облачный API-прогон для текущего проекта уже выполнен с PASS. Полный SQL-сценарий Editor в облаке не объявляется выполненным; регистрация с письмом подтверждена пользователем на прежней публикации, отдельно на Amvera не повторялась.

Источники: [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [email/password Auth](https://supabase.com/docs/guides/auth/passwords).
