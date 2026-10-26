# Android 离线安装包（前两关）

- 包名：`com.arcade.jungleassault`
- 最低系统：Android 8.0（API 26）；目标 SDK：35。
- 横屏，硬件加速，无联网权限、无广告、无额外数据下载。
- 游戏文件来自 `../web/`，全部打包进 APK 的 `assets/game/`。
- 使用系统 Android WebView；建议保持 Android System WebView 为系统可用版本。
- 本地测试签名用于直接安装验证，不代表应用商店生产签名。

## 重建

从游戏目录运行 `bash android/bootstrap-toolchain.sh` 下载编译工具，再运行 `bash android/build.sh`。构建依赖为 Java 21、keytool、Python 3、curl、unzip、Android Build Tools 35.0.0、Android SDK Platform 35 和 Eclipse ECJ 3.39.0。默认工具目录为游戏目录下的 `.toolchain/`；可用 `JUNGLE_TOOLCHAIN` 更改。工具下载保留系统 HTTPS 代理与证书配置。

目录布局：

```
.toolchain/
  android-15/       # build-tools_r35_linux.zip 解压目录
  android-35/       # platform-35_r02.zip 解压目录
  ecj.jar
```

输出主包 `dist/JungleAssault.apk` 及同字节兼容副本 `dist/JungleAssault-Level1.apk`，两份均包含前两关，并各自生成 SHA-256 摘要。`build.sh` 自动执行 APK v2/v3 签名验证与 zipalign 验证。

首次安装时，Android 可能要求为下载 APK 所用的浏览器或文件管理器启用“允许安装未知应用”。
