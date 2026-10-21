# 丛林突击 · 第一关 v1.0

一款基于经典《魂斗罗》玩法制作的 Android 单人横屏跑跳射击游戏。画面、关卡布局与合成音乐均为原创；没有使用原版 ROM、精灵或音频。仅包含第一关，通关后可重玩。

## 安装

安装 `dist/JungleAssault-Level1.apk`，支持 Android 8.0（API 26）及以上。将 APK 传至手机后打开，按照系统提示允许当前文件管理器或浏览器安装应用即可。

应用包名：`com.arcade.jungleassault`。全程离线，不申请联网、存储或其他权限，无广告。安装包体积小是因为全部画面使用程序绘制、音效实时合成，游戏资源全部内置。使用本地测试证书签名，适合直接安装体验。

## 操作

| 操作 | 触屏 | 键盘（浏览器预览） |
| --- | --- | --- |
| 移动、八方向瞄准 | 左侧方向盘 | 方向键 / WASD |
| 跳跃 | A | K / X / 空格 |
| 连续射击 | 长按 B | 长按 J / Z |
| 俯卧 | 地面按下 | 下键 / S |
| 向下穿过薄平台 | 下 + A | 下 + 跳跃 |
| 暂停 | 右上角暂停 / 安卓返回键 | Esc / P |

移动、跳跃、射击支持同时操作。水中可缓慢前进，按跳跃可跃回岸边。

## 已实现的机制

- 横向卷轴丛林、分层平台、踩踏后爆破的木桥、可进入的河流、四处检查点、关底基地。
- 跑动、跳跃、空中翻滚、俯卧缩小受击框、八方向射击、薄平台下穿。
- 步枪 R、高速机枪 M、五路散弹 S、穿透激光 L；可击破的飞行补给舱，B 无敌屏障。
- 跑兵、高台枪手、固定炮台、投弹兵、瞄准弹和榴弹爆炸。
- 双炮口关底，摧毁炮口后核心周期性开启；核心被摧毁后进入通关结算。
- 一击失命，死亡恢复基础武器，复活 3 秒无敌；经典 3 命、练习 8 命。每 20,000 分奖励生命。
- 生命耗尽后可从最近检查点继续并扣 2,000 分。后台自动暂停，需手动继续；最高分与静音选择保存在本机。
- 原创像素风画面、8bit 风格循环配乐与音效。

## 工程

`web/` 为 Canvas 游戏与界面，`android/` 为 Java WebView 离线壳。无需 Gradle 或 Node 依赖即可生成 APK。构建需要 Linux x86_64、Java 21、keytool、curl、unzip、Python 3；首次执行脚本下载 Android SDK Platform 35、Build Tools 35 与 ECJ 编译器。在本游戏目录中执行：

```bash
bash android/bootstrap-toolchain.sh
bash android/build.sh
```

默认工具目录为 `.toolchain/`，可通过 `JUNGLE_TOOLCHAIN` 环境变量更改。仓库不包含 SDK 下载缓存、构建中间文件或签名密钥。Android 壳内置资源，不依赖外部网站。首次构建会自动生成 `android/local-test.keystore`，密码为 `android`；它是本地测试密钥。请在本机保留该密钥以签署后续更新。新生成的密钥与仓库中 APK 的签名不同，安装替换时可能需要先卸载原版本。

本地预览：`python3 -m http.server 8080 --directory web`，浏览器打开 `http://localhost:8080`。

## 验证记录

- `node tests/engine.test.cjs`：12 项玩法测试通过，覆盖跑跳落地、平台可达、台阶碰撞、薄台下穿、八方向射击、俯卧碰撞、塌桥涉水与上岸、补给及散弹、死亡和无敌、关底战、检查点继续。
- `node tests/browser-smoke.cjs`：使用 Playwright + Chromium 验证菜单、指南、三指操作、抬指释放、暂停、原生生命周期钩子、不同屏幕比例、关底 HUD、通关重玩、生命耗尽后继续，未出现 JavaScript 运行错误。先运行 `npm install --no-save playwright`，并提供本机 Chromium；默认路径为 `/usr/bin/chromium`，其他路径可用 `CHROMIUM_PATH=/path/to/chromium node tests/browser-smoke.cjs` 指定。测试需要 Node.js、可用的浏览器及本地 8765 端口。
- 已完成完整地形通路模拟；Android 编译、DEX、APK v2/v3 签名、zipalign、manifest 与内置资源一致性验证通过。
- 当前环境未提供 Android 真机或模拟器，尚未进行 Android 设备实测。

预览截图位于 `dist/title.png`、`dist/gameplay.png`、`dist/boss.png` 与 `dist/victory.png`。
