# build/

electron-builder 的应用资源目录（`directories.buildResources`，默认约定为 `build/`）。

放这两个文件即可让打包产物使用正式图标，无需改动 `electron-builder.yml`：

- `icon.icns` — Mac 应用图标（建议至少 512x512，最佳 1024x1024）
- `icon.ico` — Windows 应用图标（建议包含 256x256 尺寸）

在图标文件到位之前，`npm run dist`/`dist:mac`/`dist:win` 会自动回退到 electron-builder 的默认图标，不会因为图标缺失而打包失败。
