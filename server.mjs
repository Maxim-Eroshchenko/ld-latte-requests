import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";

export function publicConfig(env) {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
  let url;
  try {
    url = new URL(supabaseUrl);
  } catch {
    throw new Error("Задайте корректный VITE_SUPABASE_URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "VITE_SUPABASE_URL должен содержать только HTTPS-адрес проекта.",
    );
  }
  let allowed = /^sb_publishable_[A-Za-z0-9_-]+$/.test(supabaseAnonKey ?? "");
  if (!allowed && typeof supabaseAnonKey === "string") {
    const parts = supabaseAnonKey.split(".");
    try {
      allowed =
        parts.length === 3 &&
        JSON.parse(Buffer.from(parts[1], "base64url").toString()).role ===
          "anon";
    } catch {
      /* Неподходящий ключ отклоняется ниже. */
    }
  }
  if (!allowed)
    throw new Error(
      "Задайте публичный publishable/anon ключ. Secret и service_role запрещены.",
    );
  return { supabaseUrl: url.origin, supabaseAnonKey };
}

export function createStaticServer({
  directory = new URL("./dist/", import.meta.url),
  env = process.env,
} = {}) {
  const root = resolve(
    directory instanceof URL ? fileURLToPath(directory) : directory,
  );
  const config =
    "window.__LD_LATTE_CONFIG__ = " + JSON.stringify(publicConfig(env)) + ";\n";
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
  };
  return createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
    } catch {
      response.writeHead(400);
      response.end();
      return;
    }
    if (pathname === "/runtime-config.js") {
      response.writeHead(200, {
        "Content-Type": mime[".js"],
        "Cache-Control": "no-store",
        "Content-Length": Buffer.byteLength(config),
      });
      response.end(request.method === "HEAD" ? undefined : config);
      return;
    }
    const filePath = resolve(root, "." + pathname);
    if (
      pathname.includes("\\") ||
      pathname.includes("\0") ||
      pathname.split("/").some((part) => part.startsWith(".")) ||
      (filePath !== root && !filePath.startsWith(root + sep))
    ) {
      response.writeHead(404);
      response.end();
      return;
    }
    let target = filePath;
    try {
      let info = await stat(target).catch(() => null);
      if (!info?.isFile()) {
        if (pathname.startsWith("/assets/") || extname(pathname)) {
          response.writeHead(404);
          response.end();
          return;
        }
        target = resolve(root, "index.html");
        info = await stat(target);
      }
      response.writeHead(200, {
        "Content-Type": mime[extname(target)] ?? "application/octet-stream",
        "Content-Length": info.size,
        "Cache-Control": pathname.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
      });
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      createReadStream(target)
        .on("error", () => response.destroy())
        .pipe(response);
    } catch {
      if (!response.headersSent) response.writeHead(500);
      response.end("Не удалось загрузить приложение.");
    }
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const server = createStaticServer();
    server.on("error", () => {
      console.error(
        "Не удалось запустить HTTP-сервер. Проверьте порт и права доступа.",
      );
      process.exitCode = 1;
    });
    const port = Number(process.env.PORT ?? 80);
    server.listen(port, process.env.HOST ?? "0.0.0.0", () =>
      console.log("LD LATTE: сервер запущен на порту " + port),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
