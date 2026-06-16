# Результаты тестирования

**Дата:** 2026-06-16  
**План:** [TEST-PLAN.md](./TEST-PLAN.md)  
**Итого:** 20 / 20 пройдено  
**Статья для AI-тестов:** [Wikipedia — Artificial intelligence](https://en.wikipedia.org/wiki/Artificial_intelligence)

---

| ID | Проверка | Статус | Детали |
|----|----------|--------|--------|
| T-01 | `pnpm run build` | ✅ PASS | Сборка без ошибок |
| T-02 | GET `/` | ✅ PASS | HTTP 200 (после перезапуска dev) |
| T-03 | CSS `layout.css` | ✅ PASS | HTTP 200, Tailwind (`bg-red-500`) |
| T-10 | Parse: пустой URL | ✅ PASS | HTTP 400 |
| T-11 | Parse: некорректный URL | ✅ PASS | HTTP 400 |
| T-12 | Parse: ftp отклонён | ✅ PASS | HTTP 400 |
| T-13 | Parse: Wikipedia | ✅ PASS | title=35, content=211449 |
| T-14 | Parse: HTTP 403 | ✅ PASS | HTTP 422, `code: unavailable` |
| T-20 | Translate: нет статьи | ✅ PASS | HTTP 400 |
| T-21 | Translate: неверный action | ✅ PASS | HTTP 400 |
| T-22 | Translate: `translate` | ✅ PASS | HTTP 200, ~20 тыс. симв. |
| T-23 | Translate: `summary` | ✅ PASS | HTTP 200, ~1 тыс. симв. |
| T-24 | Translate: `theses` | ✅ PASS | HTTP 200, 10 тезисов |
| T-25 | Translate: `telegram` | ✅ PASS | HTTP 200, ссылка на источник |
| T-30 | Summary короче translate | ✅ PASS | 1016 vs 20179 симв. |
| T-31 | Тезисы: список | ✅ PASS | H2 + 10 пунктов |
| T-32 | Telegram: формат поста | ✅ PASS | **жирный** заголовок, URL источника |
| T-33 | Translate: Markdown | ✅ PASS | заголовок `#` |
| T-50 | `/api/process` legacy | ✅ PASS | HTTP 501 |
| T-51 | `.env.local` в gitignore | ✅ PASS | не отслеживается |

---

## Не автоматизировано

| ID | Проверка | Примечание |
|----|----------|------------|
| T-26 | Ошибка ИИ (`ai_error`) | Проверено в коде; для автотеста нужен mock |
| T-40–T-43 | UI в браузере | Подтверждено пользователем («всё работает») |

---

## Замечание

T-02/T-03 при первом прогоне упали (HTTP 500): `build` шёл параллельно с dev-сервером и сломал `.next`. После очистки кэша и перезапуска dev — **PASS**.

---

## Повторный прогон

```powershell
cd c:\Work\referent
# Остановите dev (Ctrl+C) перед build внутри скрипта, или запускайте API-тесты отдельно
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-tests.ps1
```

Образцы ответов ИИ: [.test-samples.md](./.test-samples.md)
