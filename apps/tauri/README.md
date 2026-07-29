# LCD-bitmap IDE — Tauri/Rust

Это независимая desktop-оболочка Tauri 2. Node-зависимости Tauri находятся только
в этом каталоге, Rust-зависимости — в `src-tauri/Cargo.toml`. Существующая
Electron-версия остаётся в корне репозитория и продолжает собираться прежними
командами.

Frontend временно общий для двух оболочек (`../../src`). Это позволяет развивать
один редактор без копирования кода, сохраняя изоляцию desktop-зависимостей.

## Локальный запуск

Из корня репозитория:

```powershell
npm install
npm --prefix apps/tauri install
npm run tauri:dev
```

Проверка Rust:

```powershell
npm run tauri:check
```

Сборка установочного пакета текущей ОС:

```powershell
npm run tauri:build
```

Без явного `--target` артефакты создаются в
`apps/tauri/src-tauri/target/release/bundle`. При сборке с
`--target x86_64-pc-windows-msvc` используйте
`apps/tauri/src-tauri/target/x86_64-pc-windows-msvc/release/bundle`.

На Windows перед первой нативной сборкой установите Visual Studio Build Tools с
workload `Desktop development with C++` и Windows SDK. WebView2 уже присутствует
в актуальных Windows 10/11. GitHub Actions устанавливает полноценное окружение
автоматически.

## Границы двух приложений

- Electron: корневой `package.json`, `src/main`, `src/preload`.
- Tauri/Rust: `apps/tauri`.
- Общий GUI и предметная модель: `src/renderer`, `src/features`, `src/domain`,
  `src/services`, `src/compiler`.

Следующий этап разделения — вынести общий GUI в `packages/editor-core`, когда
Tauri-сборка пройдёт проверку на трёх ОС. До этого физическое перемещение сотен
файлов создаёт ненужный риск для рабочей Electron-версии.
