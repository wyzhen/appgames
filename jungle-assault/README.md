# 丛林突击 · 第一关 v1.1

一款基于经典《魂斗罗》玩法制作的 Android 单人横屏跑跳射击游戏。画面、关卡布局与合成音效均为原创。仅包含第一关，通关后可重玩。v1.1 增加敌弹击落机制，并按反馈降低弹幕密度、重做基地 Boss 和弱点位置。

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

移动、跳跃、射击支持同时操作。水中可缓慢前进，按跳跃可跃回岸边。射击可以击落敌方子弹和手榴弹；激光能连续抵消敌弹。关底瞄准基地底部的红色核心，站在地面水平射击即可命中。

## FC／NES 第一关音乐

原曲为 **密林の戦い（メインBGM） / Jungle Battle**，Konami Kukeiha Club，收录于《魂斗羅 サウンドトラック（FC版）》第 3 首，官方发行版约 1:51。

- [Spotify 官方发行曲目](https://open.spotify.com/track/1Zwv8Sn4WUr7EMqIXLVqfk)
- [B站原声合集第 3 首](https://www.bilibili.com/video/BV1934y1g7GP/?p=3)（社区试听来源）

v1.1 已移除旧合成背景音乐。APK 不内置原版音频文件，未导入时只播放游戏音效。在标题或暂停菜单选择「音乐 → 选择本地音频」，可导入本机音频并循环播放。支持设备可解码的 MP3、WAV、OGG、M4A 等格式，单文件不超过 20 MB；音乐保存在本机，下次打开会恢复。静音和暂停会停止配乐发声，继续后从暂停位置播放。导入无效文件会保留上一次音乐，可用「清除音乐」恢复仅音效。

## 已实现的机制

- 横向卷轴丛林、分层平台、踩踏后爆破的木桥、可进入的河流、四处检查点、关底基地。
- 跑动、跳跃、空中翻滚、俯卧缩小受击框、八方向射击、薄平台下穿。
- 步枪 R、高速机枪 M、五路散弹 S、穿透激光 L；可击破的飞行补给舱，B 无敌屏障。
- 跑兵、高台枪手、固定炮台、投弹兵、瞄准弹和榴弹爆炸；敌弹可击落，普通场景最多同时存在 5 发敌弹。
- 双炮口基地关底：入场 3 秒安全时间，炮口在开火前蓄力亮起，每隔约 1.3 秒交替发射单发炮弹，最多同时存在 3 发；下方红色核心始终可以直接攻击，击毁即可通关。
- 一击失命，死亡恢复基础武器，复活 3 秒无敌；经典 3 命、练习 8 命。每 20,000 分奖励生命。
- 生命耗尽后可从最近检查点继续并扣 2,000 分。后台自动暂停，需手动继续；最高分与静音选择保存在本机。
- 原创像素风画面与合成音效，可导入本地原声背景音乐。

## 工程

`web/` 为 Canvas 游戏与界面，`android/` 为 Java WebView 离线壳。无需 Gradle 或 Node 依赖即可生成 APK。构建需要 Linux x86_64、Java 21、keytool、curl、unzip、Python 3；首次执行脚本下载 Android SDK Platform 35、Build Tools 35 与 ECJ 编译器。在本游戏目录中执行：

```bash
bash android/bootstrap-toolchain.sh
bash android/build.sh
```

默认工具目录为 `.toolchain/`，可通过 `JUNGLE_TOOLCHAIN` 环境变量更改。仓库不包含 SDK 下载缓存、构建中间文件或签名密钥。Android 壳内置资源，不依赖外部网站。首次构建会自动生成 `android/local-test.keystore`，密码为 `android`；它是本地测试密钥。请在本机保留该密钥以签署后续更新。新生成的密钥与仓库中 APK 的签名不同，安装替换时可能需要先卸载原版本。

本地预览：`python3 -m http.server 8080 --directory web`，浏览器打开 `http://localhost:8080`。

## 验证记录

- `node tests/engine.test.cjs`：20 项测试通过，验证跑跳落地、平台可达、台阶碰撞、薄台下穿、八方向射击、俯卧碰撞、塌桥涉水与上岸、补给及散弹、死亡和无敌、弹对弹碰撞、敌弹数量限制、关底弱点/开火节奏与检查点继续。
- `node tests/audio.test.cjs`：8 项测试通过，验证导入、格式和大小限制、循环播放、重复解锁、暂停/静音恢复、错误回滚与保存恢复。
- `node tests/browser-smoke.cjs`：使用 Playwright + Chromium 验证菜单、指南、音频真实解码导入/错误保留/保存恢复/清除、三指操作、抬指释放、暂停、原生生命周期钩子、不同屏幕比例、关底 HUD、站立射击弱点、通关重玩、生命耗尽后继续。先运行 `npm install --no-save playwright`，并提供本机 Chromium；默认路径为 `/usr/bin/chromium`，其他路径可用 `CHROMIUM_PATH=/path/to/chromium node tests/browser-smoke.cjs` 指定。测试需要 Node.js、可用的浏览器及本地 8765 端口。
- 已完成完整地形通路模拟；Android 编译、DEX、APK v2/v3 签名、zipalign、manifest 与内置资源一致性验证通过。
- 当前环境未提供 Android 真机或模拟器，尚未进行 Android 设备实测。

预览截图位于 `dist/title.png`、`dist/gameplay.png`、`dist/boss.png` 与 `dist/victory.png`。
