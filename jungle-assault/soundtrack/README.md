# 内置原声输入

当前没有原声音频文件。此目录只提供清单模板，不能据此生成含原声的正式安装包。

取得可用于本项目的三段录音后，将文件放在本目录，复制 `manifest.json.example` 为 `manifest.json` 并填写文件名、曲名和 MIME 类型。支持 MP3、WAV、OGG、FLAC、M4A、AAC，每首不超过 20 MB。清单中必须包含 `jungle`、`base`、`baseBoss` 三首。

运行 `bash android/build.sh` 后，构建脚本会在编译前检查全部音频，将其编码为安装包内的 `bundled-music.js`。不重复打包原始录音，不访问网络，也不要求玩家导入文件。

如果缺少清单或任何录音，构建立刻失败并保留现有 v1.2 安装包。`web/bundled-music.js` 是空的开发占位清单，不能作为有音乐的发布版本。网页预览时可先运行：

```bash
python3 android/bundle_music.py --source-dir soundtrack --output web/bundled-music.js
```

网页默认只播放内置曲。旧版本已导入的自定义音乐不会覆盖原声；文件和存储兼容接口仅保留用于回归测试。
