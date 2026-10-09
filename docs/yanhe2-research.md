# 新版延河课堂接口与播放器研究

研究日期：2026-10-09。上游基线：`c3a23cd`（5.1.0，已加入新版 JWT 设置及账号状态）。

对应需求：[issue #29：延河课堂新版本逆向研究](https://github.com/bit-admin/Yanhekt-AutoSlides/issues/29)。维护者明确关注新版的幻灯片时间轴、识别字幕，也欢迎继续探索其他功能。

本次结合 [Fangwenky/yanhekt-downloader](https://github.com/Fangwenky/yanhekt-downloader) 的新版认证、课程分页、课时解析和官网播放器鉴权研究，在有权限的个人账号上进行了只读接口验证及短片段下载实验。本文仅记录协议、实验状态和计数，不包含登录会话或课堂内容。

## 结论与交付范围

新版的个人课程、回放列表和视频下载链路已查明；播放签名可以在 Electron 主进程生成，无需为每次下载启动 Playwright。已经下载并合并两个真实 HLS 分片，得到可播放的 40.469 秒 MP4，另验证了 MP4 的 HTTP Range 请求。

字幕接口已取得真实的相对时间文本，可以转换成 SRT。幻灯片时间轴接口及两种数据来源已从官网前端定位，但本次六个回放样本都没有官方幻灯片，不能声称已验证真实幻灯片导入。

本文贡献的是 **接口和播放器协议的研究记录**，没有修改应用代码，也没有加入探针或下载产物。短片段实验不等于整节回放下载验收；新版课程切换、下载队列、字幕用户入口和官方幻灯片导入仍待接入。这些结果可以推进 #29，但尚不足以关闭它。

## 已验证的接口

所有路径相对于 `https://aita.yanhekt.cn`，接口使用 `Authorization: Bearer <新版 JWT>`。旧版 cbiz token 不能代替新版 JWT。JWT 来自 Yii 签名的 `_token` Cookie；上游现有 `yanhe2Token.ts` 已能提取它，现有 `Yanhe2Service` 已负责认证及按账号保存会话。

| 用途 | GET 路径与参数 | 成功结构 | 验证结果 |
| --- | --- | --- | --- |
| 校验会话、播放签名资料 | `/userapi/v1/infosimple` | `code=200, params` | 取 `id / tenant_id / phone`，不要以 JWT 内字段代替 |
| 个人课程 | `/personal/courseapi/vlabpassportapi/v1/account-profile/course?nowpage=1&per-page=50` | `code=1000, params.result.{data,total}` | 跨两页取得课程列表；字段 `Id / Title / Teacher / TermName / KkxyName` |
| 课程课时 | `/courseapi/v3/multi-search/get-course-detail?course_id=…` | `code=0, data.sub_list` | 分组结构需要递归展开，不能假设是平面数组 |
| 课时及媒体 | `/courseapi/v3/portal-home-setting/get-sub-info?course_id=…&sub_id=…` | `code=0, data` | `video_list` 实测是以数字为键的对象，兼容数组 |
| 官方 PPT 快照 | `/pptnote/v1/schedule/search-ppt?course_id=…&sub_id=…&page=1&per_page=100` | `code=0, list, total` | 六个回放均返回空列表；结构由官方调用代码确认 |
| 识别字幕 | `/courseapi/v3/web-socket/search-trans-result?sub_id=…&format=json` | `code=0, list[0].all_content` | 三个样本有 62 / 1 / 1 条；其余无语音数据 |

`code` 含义因服务不同而不同，不能使用统一的 `code===0` 判定。没有语音数据时，实测是 **HTTP 200 + `{code:10002,total:0,list:[]}`**；后续客户端应将这一明确状态视为无字幕，其他拒绝访问不应当作空结果吞掉。

课时过滤参考已有下载器：跳过 `sub_delete != 0` 或 `show == "no"`；`playback_status == 1` 表示回放可用。字符串与数字状态都需要兼容。回放元数据存在不保证媒体文件仍存在，旧源可能返回 404。

## 媒体鉴权与下载

六个回放均验证了教师 / PPT 的 HLS；其中一个还有学生 MP4。流类型为 `2=PPT、3=教师、4=学生`，`status=2` 表示可用，源地址取 `preview_url`。本次源都位于 `https://aita.yanhekt.cn/play/…`。

官网签名模块 `1P4N` 的核心公式：

```text
ts = floor(Date.now() / 1000)
digest = md5(pathname + userId + tenantId + reverse(infosimple.phone) + ts)
t = userId + "-" + ts + "-" + digest
```

各字段先按 JavaScript 字符串拼接；`pathname` 不包括查询参数。`phone` 是 `infosimple` 返回的播放签名字段，可能是占位值，不能替换成旧版用户手机号。新请求应替换旧 `t`，同时保留其他查询参数。

| 实验 | 结果 |
| --- | --- |
| 独立签名 HLS 清单 | HTTP 200，297 或 447 个分片，均为单码率清单 |
| 同一个 TS 分片不带 `t` | HTTP 403 |
| 将清单的 `t` 原样用于 TS | HTTP 403 |
| 按 TS 自己的 pathname 重新签名 | HTTP 200，首字节为 MPEG-TS 同步字节 `0x47` |
| MP4 带签名及 `Range: bytes=0-4095` | HTTP 206 |
| 两个 PPT 分片合并 | H.264 1920×1080 + AAC，40.469 秒，725,523 字节 |

官网通过包装 `XMLHttpRequest.open` 对每个 `.ts` 单独签名。已有 Python 下载器通过官网播放器截获地址，再触发官网 XHR 为分片签名；本地实验另用 Node 内置 `crypto` 直接生成签名，两条路径实测均能工作；此文档贡献不包含该实验实现。

后续下载器应在每次发送请求及重试前刷新签名，不能一次签出整节课的地址后永久缓存。接口 Bearer 不应作为全局媒体请求头或传给任意 CDN。本次仅验证了 aita `/play/` 源；其他域名、HLS AES 密钥、fMP4、主清单的鉴权尚待实际样本验证。

旧 `M3u8DownloadService` 包含 cbiz token、旧路径加密、旧签名、内网映射及 TS 合并假设；不能只换域名或把新版 URL 交给现有 `download:start`。

## 幻灯片与字幕

官网有两条幻灯片读取路径：

1. `search-ppt`：每条记录的 `created_sec` 是视频相对秒数，`content` 是 JSON 字符串，内含 `pptimgurl / pptthumb / content`（图片、缩略图、OCR 文本）。先按原始记录分页，再过滤负时间或无效内容，避免过滤后数量不足导致分页循环。
2. `/spidermaterial/spider-material/web/aitask/async/getPPTData?id=<resource_id>`：官网处理 AI 资源时使用，字段 `timestamp` 是毫秒，`imgurl` 是图片地址、`describe` 是描述。本次普通课堂样本返回 `state=400`，没有成功资源样本，因此尚未验证该路径的成功结果。

功能是否显示受 `/courseapi/v2/play-template/get-config?tenant_id=…&course_id=…&sub_id=…` 的模块配置影响。实测返回嵌套的 `{success:true,data:{code:200,data:{modules:…}}}`。普通课堂模板启用了 `voice_live_gn / captions_live_gn / ppt_videos_live_liu`，但没有 `ppt_live_liu` 快照模块。**PPT 视频流不等于已有官方幻灯片图片**，应保留 SSIM 提取作为回退。

字幕实测 `trans_type="ainew"`，每条使用 `BeginSec / EndSec / Text / TransText`。时间单位是秒，直接用于播放跳转或 SRT；不能乘以 1000 后仍按秒传给播放器。

有字幕不代表识别完整：62 条的样本起止范围是第 3438–6834 秒，但累计文本时长只有 238 秒；另两个样本分别只有 23 秒和 4 秒文本。应提示覆盖情况，不能把它当作整节课完整转写。官网另一种 `trans_type="ai"` 使用墙上时间减 `start_at` 再加 `VIDEO_DELAY`；缺少真实样本及对齐验证，尚不能确认其时间对齐，接入时不应猜测时区与偏移。

## 其他功能：已定位，未完整验证

| 功能 | 公开前端中定位的接口 | 当前证据 |
| --- | --- | --- |
| 课件 / 原文 / 翻译导出 | `/courseapi/v2/export/get-courseware-status`、`export-async`、`download-courseware-async` | 官网先查状态，再生成文件并轮询；未触发服务器生成任务 |
| 智能摘要 | `/courseapi/v2/intelligent-summary/detail?sub_id=…` | 六个样本均为 `{success:true,result:{code:200,data:[]}}`，没有摘要 |
| 共享课程资源 | `/courseapi/v3/sub-resource/get-sub-resource?sub_id=…&page=…&per_page=…` | 已定位；实际资源及下载权限待验证 |
| 语音合成 / 翻译音轨、知识点、热词云、AI 问答 | 播放模板及前端调用中存在 | 未进行会产生学习记录、AI 任务或费用的调用 |

以上是“发现了官网功能 / 调用路径”，不是“已完成适配”的承诺。

## 验证记录与复测步骤

下列结果来自本地实验，实验实现及原始响应未随本文提交。复测需要本人有权限的新版课程/课时、有效新版会话及 FFmpeg。不要将会话、完整响应、签名媒体 URL、图片或课堂文本提交为测试夹具。

1. 使用现有新版登录取得 JWT，调用 `infosimple` 确认会话有效，读取播放签名所需的三个字段。
2. 分页读取个人课程，选择本人可访问且 `playback_status=1` 的课时；读取 `get-sub-info` 并按 `type/status` 选取可用媒体。确认返回的课程/课时身份与请求一致。
3. 按上文公式对 HLS 清单自己的 pathname 签名，取得清单。若为主清单或未知格式，不能用本次单码率 TS 实验推断其已受支持。
4. 从单码率清单解析两个 TS 的地址。比较同一分片不带 `t`、复用清单 `t`、使用分片自身 pathname 签名三种请求，实测状态依次为 403、403、200。
5. 保存两个成功分片为 `sample-0.ts`、`sample-1.ts`，用 FFmpeg 合并并完整解码该短片段，检查格式和时长。本次一个样本得到 40.469 秒、725,523 字节的 H.264/AAC MP4。
6. 对可用 MP4 源独立签名，用 `Range: bytes=0-4095` 读取短段，实测 HTTP 206；这不等于整文件或断点续传验收。
7. 分别读取 PPT 和字幕接口，记录返回结构、条数、时间单位。PPT 空列表只验证空结果，不能据此验证图片权限或时间对齐；字幕非空也不能据此确认整节课识别完整或与画面准确对齐。

第 5 步的本地验证命令（在保存分片的目录运行）：

```sh
ffmpeg -hide_banner -loglevel error \
  -i 'concat:sample-0.ts|sample-1.ts' -c copy sample.mp4
ffprobe -v error -show_entries format=duration,size \
  -show_entries stream=codec_name,width,height -of json sample.mp4
ffmpeg -hide_banner -loglevel error -i sample.mp4 -f null -
```

本次验证了两个课时的独立分片签名及短片段合并，其中一个课时另有学生 MP4 和明确的无字幕状态。其他接口样本和限制见前文；没有触发服务器课件生成任务。

## 后续贡献顺序

1. 分享并审查本研究结果，关联 #29；不将该研究贡献标记为整个 issue 完成。
2. 复用现有新版认证，接个人课程 / 回放选择、字幕显示及 SRT 导出，补齐真实时间对齐验证和无字幕提示。
3. 接新版 MP4/HLS 下载，包括取消、重试、请求时刷新分片签名和完整文件提交，复用现有队列、进度事件及 FFmpeg 能力，再接已有提取器。
4. 旧版 `courseId/sessionId` 与新版 `course_id/sub_id` 属于不同 ID 空间；接入前明确来源标识，贯穿任务去重、`DataStore`、文件命名、metadata 和公共索引，避免错误匹配。两套接口分别使用自己的会话。
5. 获得有官方 PPT 的课时样本后验证图片权限、时间对齐及 `timeline.json` 导入，记录官网来源，保留本地提取回退。此项可在取得样本后独立推进；其余导出、摘要、AI 资源功能按实际样本逐项验证。

## 原始证据

仅使用仓库源码、已有下载器研究、官网公开前端和有权限的接口。本次没有把 Cookie、JWT、个人资料或课堂文本复制进仓库。

- [issue #29](https://github.com/bit-admin/Yanhekt-AutoSlides/issues/29)
- [已有新版下载器与研究](https://github.com/Fangwenky/yanhekt-downloader)
- [官网 app bundle](https://aita.yanhekt.cn/static/js/app.5baf818d08892b33319c.1790762805764.js)：资源导出、智能摘要及路由
- [官网 common chunk](https://aita.yanhekt.cn/static/js/0.710b9534067cf37d2b8d.1790762805764.js)：`1P4N` 播放签名及逐 TS 的 XHR 包装
- [官网播放页 chunk](https://aita.yanhekt.cn/static/js/1.5ff4349e45c46feeed98.1790762805764.js)：`searchPPTList`、`getPPTData`、`getVideoTransResult`、课件导出状态机

前端文件名随网站部署变化；这是截至研究日期的证据，不是稳定公开 API 合同。
