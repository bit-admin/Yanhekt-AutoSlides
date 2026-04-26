<div align="center">

  <img src="docs/icon.png" width="120" />

  # AutoSlides
  
  **北京理工大学延河课堂第三方客户端｜自动提取幻灯片｜下载课程录像｜AI 过滤与审查**

  <p>
    <img src="https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/YDX-2147483647/best-of-bits/main/config/badge/v1.json" alt="best of BITs">
    <img src="https://img.shields.io/github/downloads/bit-admin/Yanhekt-AutoSlides/total?color=orange&logo=docusign" alt="Downloads">
    <img src="https://img.shields.io/github/v/release/bit-admin/Yanhekt-AutoSlides?color=blue" alt="Version">
    <img src="https://img.shields.io/badge/platform-win%20%7C%20mac%20%7C%20linux-lightgrey?color=green" alt="Platform">
  </p>

  <p>
    <img src="https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white" alt="Electron">
    <img src="https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vue.js&logoColor=4FC08D" alt="Vue.js">
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  </p>

  <p>
    <a href="#-快速开始">🚀 快速开始</a> • 
    <a href="#-功能特性">✨ 功能特性</a> •
    <a href="#-架构设计">🏗️ 架构设计</a>
  </p>

</div>

---

## ✨ 功能特性

- 通过本地代理和防盗链适配支持延河课堂直播、录播播放与课程录像下载。
- 针对校园网访问链路优化，录播支持 0.5-16 倍速流畅播放；有线校园网下载峰值快至 110MB/s<sup>1</sup>。
- 播放视频的同时自动提取幻灯片，无需预先下载视频；145 分钟课程可在 16 倍速下约 10 分钟处理完成。
- 任务队列运行期间可阻止系统休眠，适合批量、长时间处理课程录像。
- 结合 SSIM、pHash、LLM 或本地 ML 分类器过滤重复页面、非幻灯片画面和编辑模式截图。
- 在 `幻灯片审查页面` 中按文件夹审查提取结果，支持恢复、删除、自动裁剪、基准裁剪和裁剪状态回滚。
- 将提取后的幻灯片合并导出为 PDF，并可通过 PNG 色彩压缩减小文件体积。

<p align="center">
  <img src="docs/cover.png" alt="AutoSlides 封面" width="60%">
</p>


> [!CAUTION]
> **Disclaimer**: This tool is intended strictly for personal study; users assume full legal responsibility for ensuring their usage complies with all applicable copyright laws and platform regulations. Terms and Conditions apply.
> <br> **免责声明**：本工具严格仅供个人学习之用；用户须自行承担全部法律责任，确保其使用符合所有适用的版权法及平台规例。受条款及细则约束。
>
> <p align="center"><a href="docs/terms.md">Read full Terms and Conditions / 按此查阅完整条款及细则</a></p>
> 
> This tool is NOT an official application of, and is NOT affiliated with, associated with, endorsed by, or in any way connected to Beijing Institute of Technology (BIT), or any of their subsidiaries or affiliates. All product and company names are trademarks™ or registered® trademarks of their respective holders.
> <br> 本工具**并非**北京理工大学（BIT）的官方应用程式，亦与其或其任何附属机构或关联方无任何关联、联系、获其认可或以任何方式相关。所有产品及公司名称均为其各自持有人的商标™或注册®商标。


### 相关项目

<table>
  <thead>
    <tr>
      <th width="155">项目 / 类别</th>
      <th width="190">GitHub 仓库</th>
      <th>描述</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <a href="https://learn.ruc.edu.kg">网页版</a> 👈
      </td>
      <td>
        <a href="https://github.com/bit-admin/Yanhe-Web">bit&#8209;admin/Yanhe-Web</a>
      </td>
      <td>
        观看全校直播课程，在移动设备上运行幻灯片提取<sup>2</sup>；记录笔记并导出为文档<sup>3</sup>。
      </td>
    </tr>
    <tr>
      <td>提取器工具</td>
      <td>
        <a href="https://github.com/bit-admin/AutoSlides-Extractor">bit&#8209;admin/AutoSlides-Extractor</a>
      </td>
      <td>
        从下载的屏幕录制中提取幻灯片；处理一节课的视频用时快至 10 秒<sup>4</sup>；支持 GPU 加速；使用 C++ 构建；使用与 <code>AutoSlides</code> 相同的图像处理算法及基于 <code>MobileNetV4</code> 的机器学习模型。
      </td>
    </tr>
    <tr>
      <td>延河课堂下载器</td>
      <td>
        <a href="https://github.com/bit-admin/Yanhekt-downloader-electron">bit&#8209;admin/Yanhekt-downloader-electron</a>
      </td>
      <td>
        视频下载功能基于该项目重写；特别感谢 <a href="https://github.com/AuYang261/BIT_yanhe_download">AuYang261/BIT_yanhe_download</a> 项目提供的思路和参考。
      </td>
    </tr>
  </tbody>
</table>

---

<sup>1</sup> 以有线方式连接到校园网时，下载峰值速率可达120MB/s；在 Wi-Fi 下速率较慢。

<sup>2</sup> 网页版使用简化的图像处理算法，同时适用于桌面及移动设备。

<sup>3</sup> 网页版提供笔记记录及导出 Word 及 Markdown 文档功能。

<sup>4</sup> **两个工具组合使用速度更快**：使用 `AutoSlides` 下载一节 95 分钟课程的屏幕录制视频在校园网内用时约 10 秒；使用 `AutoSlides Extractor` 处理该视频（I-frame 间隔 2 秒）在 M4 Mac mini 上用时约 10 秒。

## 🚀 快速开始

### 1. 下载

- 前往 [release 页面](https://github.com/bit-admin/Yanhekt-AutoSlides/releases) 👈 下载适用于你平台的安装程序（macOS 用户下载 `DMG` 文件；Windows 用户下载 `EXE` 文件；Linux 用户下载 `AppImage` 或 `deb` 文件）。

### 2. 安装
   - **macOS**：打开 `.dmg` 安装包，将应用图标拖动到 `Applications` 文件夹。
      - 双击安装包内的 `install.command` 文件运行安装脚本。若看到“Apple 无法验证安全性”的提示，先关闭该提示。
      - 打开 `系统设置 > 隐私与安全性`，如图所示，点击 `仍要打开`。
      - 在终端中输入你的 Mac 密码（注意密码输入时不会显示）。

<p align="center">
  <img src="docs/dmg.png" alt="AutoSlides DMG 安装包" width="90%">
</p>

> [!IMPORTANT]
> - macOS 将下载的应用程序标记为"隔离"以确保安全。
> - AutoSlides 未使用 Apple 开发者证书签名。
> - 除了双击 `install.command` ，你也可以手动在终端运行以下命令删除隔离属性允许应用程序正常运行：
>   ```shell
>   sudo xattr -d com.apple.quarantine /Applications/AutoSlides.app
>   ```

   - **Windows**：运行 `.exe` 安装程序，并按照安装向导操作。

   - **Linux**：
     - **AppImage**：下载 `.AppImage` 文件，添加执行权限后直接运行：
       ```bash
       chmod +x AutoSlides-*.AppImage
       ./AutoSlides-*.AppImage
       ```
     - **Deb 包**（Debian/Ubuntu）：
       ```bash
       sudo apt install ./autoslides-*.deb
       ```

### 3. 使用与设置

#### A. 登录

1. 启动应用程序，使用北京理工大学统一身份认证账户密码登录。账户密码登录有时会触发短信验证码二次验证，遇到这种情况请改用 `浏览器登录`。 [#1](https://github.com/bit-admin/Yanhekt-AutoSlides/issues/1)
2. 点击 `浏览器登录` 后，应用会在内置浏览器中打开官方登录界面。登录并跳转到延河课堂页面后，应用会自动获取延河课堂令牌。

<p align="center">
  <img src="docs/step1.png" width="90%" alt="step1" />
</p>

<br>

#### B. 基础设置

<img src="docs/step2.png" align="right" width="45%" alt="step2" />

1. 根据需要调整 `输出目录`，默认路径为 `~/Downloads/AutoSlides`（建议设置为独立文件夹）。
2. 在校园网内使用时，将 `连接模式` 切换为 `内网模式`，通常可获得更稳定的连接体验和更快的课程资源访问速度。
3. 根据需要调整 `音频模式`，也可以让应用全程静音运行。
4. 幻灯片提取功能的基础设置包括 `幻灯片检测间隔`、`幻灯片稳定性复核`、`任务速度` 及 `自动后处理`。
- `幻灯片检测间隔` 为视频以 1 倍速播放时检测新幻灯片的时间间隔。实际检测间隔会随播放速度自动调整。
- `幻灯片稳定性复核` 启用后需多次检测确认幻灯片稳定，排除动画、视频、轻微移动等内容。此设计基于“演讲者通常将停留在同一幻灯片一段时间进行讲解”的假设。
- `任务速度` 为任务队列中录播视频的播放速度。
- `自动后处理` 控制是否在幻灯片提取后自动执行排除、过滤等后处理步骤：
  - 直播模式下将会在每保存一张幻灯片时进行后处理。
  - 录播模式下将在当前任务完成时进行后处理（需要将课程添加到任务列表）。

> [!TIP]
> 在 `幻灯片稳定性复核` 启用，`检查次数` 为 `2` 且 `幻灯片检测间隔` 为 `2000` 毫秒的情况下，一张幻灯片只有“稳定”显示至少 `6` 秒才会被保存。如果演讲者快速翻动幻灯片，部分显示时长过短的幻灯片在 `幻灯片稳定性复核` 启用时将不会被保存。
>
> 这样设计是因为翻动过快的幻灯片即使在课堂上认真听讲也很难及时记录。如果你认为被跳过的幻灯片非常重要，可以在观看课程视频时手动暂停。

<br clear="both">

<br>

#### C. AI 设置

1. 在 `高级设置 > AI` 中配置 AI 服务。图像分类可选择两种运行方式：`LLM` 模式调用云端多模态大语言模型 API，`ML` 模式在本机运行机器学习模型。`LLM` 模式通常更准确，`ML` 模式则更快，并且不依赖外部服务。
2. `LLM` 模式的 `内置服务` 免费提供 `gpt-4.1` 模型；**共享服务的可用性视实际负载而定**。你也可以使用 GitHub 登录，或填写自定义服务的 `API Base URL`、`API Key` 和 `模型名称`。了解更多：[AI 配置及 GitHub 教育优惠文档](https://it.ruc.edu.kg/zh/docs)。

<p align="center">
  <img src="docs/step3.png" width="60%" alt="step3" />
</p>

> [!TIP]
> AI 可能出错。核查 AI 的分类结果。

> [!IMPORTANT]
> The Built-in service is provided by the developer free of charge and on an "as is" basis. We make no warranties, express or implied, regarding the continuity or stability of the service, and we may modify or interrupt the service at any time without prior notice.
> <br> 开发者免费并按“原样”基础提供内置服务。我们不对服务的连续性或稳定性作出任何明示或隐含的保证，并可能随时修改或中断服务，恕不另行通知。

<br>

#### D. 基础页面使用

1. `直播` 和 `录播` 两种模式可以同时运行；切换页面时，正在播放的视频不会被中断。
2. `获取个人课程列表`，找到你想要观看的课程；或者使用 `搜索` 功能在全校课程中进行搜索；你还可以观看任意正在直播的课程，即便你并未注册该课程。
3. 你还可以在 `课程收藏夹` 中保存你常观看的课程的关键词，快速进行搜索。

<p align="center">
  <img src="docs/step4.png" width="60%" alt="step4" />
</p>

<br>

#### E. 录播课程播放与下载

1. 进入录播课程页面后，可将具体节次添加到 `幻灯片提取任务列表`，也可下载 `课堂摄像头录像` 和 `屏幕录制` 视频。
2. 你也可以一次性将课程的所有节次添加到 `任务列表` 或 `下载队列`。
3. 如果只是想认真观看课程录像，可以直接点击某一节次的 `播放`，无需加入幻灯片提取任务列表。
4. 在右侧栏中可管理 `任务列表` 及 `下载队列`；在 `任务列表` 中点击 `开始` 启动任务队列。

<p align="center">
  <img src="docs/step5.png" width="70%" alt="step5" />
</p>

<br>

---

处于播放模式时，可以同时观看 `屏幕录制` 和 `课堂摄像头` 视频。

<p align="center">
  <img src="docs/step5.1.png" width="70%" alt="step5.1" />
</p>

<br>

#### F. 幻灯片提取

1. 启动录播课程的 `幻灯片提取任务` 后，应用会依次按 `任务速度` 播放课程屏幕录制，并自动启动幻灯片提取。列表中会显示任务进度，以及已完成项目的 `后处理` 状态。
2. 在播放页面，可以通过控制栏选择 `视频源`、调整 `播放速度`，或进入 `画中画` 模式（控制栏仅在 `播放模式` 下可操作；录播课程处于 `任务模式` 时会被禁用，直播课程始终处于 `播放模式`）。
3. 播放页面下方是 `幻灯片提取预览窗口`；在 `播放模式` 下可以手动开启或停止 `幻灯片提取`。你也可以随时手动触发 `后处理`，或 `删除` 已提取的幻灯片。

<p align="center">
  <img src="docs/step6.png" width="70%" alt="step6" />
</p>

<br>

#### G. 审查幻灯片

1. 点击左下角的 `工具` 按钮。
2. 进入 `幻灯片审查` 页面。
3. 如需删除文件夹，点击 `编辑` 按钮并选择目标文件夹。删除文件夹时，与该文件夹关联的回收站项目和裁剪前原始图像备份也会一并删除。

<p align="center">
  <img src="docs/step7.png" width="25%" alt="step7" />
  <img src="docs/step8.png" width="45%" alt="step8" />
</p>

<p align="center">
  <img src="docs/step8.1.png" width="70%" alt="step8.1" />
</p>

<br>

---

1. 查看已保存的幻灯片图像时，可在 `保留上下文`、`仅看已提取` 和 `仅看已移除` 视图之间切换。
2. 对于被移除的幻灯片，使用移除原因进行筛选，包括 `重复`、`已排除`、`AI 过滤 - 非幻灯片`、`AI 过滤 - 编辑模式` 及 `手动`。
3. 滑动右下角的滑块可调整 `缩略图` 的大小。
4. 点击缩略图右上角的按钮可 `放大` 查看图片。
5. 点击左下角的 `全选` 按钮可全选当前筛选下的全部图像。

<p align="center">
  <img src="docs/step9.png" width="70%" alt="step9" />
</p>

<br>

---

图像可能会因为被判定为非 `全屏播放的幻灯片` 或其他原因而被移除：
- `重复` 指类似 `A -> B -> A`，演讲者在演讲过程中重复播放某一幻灯片页面时，只保留第一次出现的页面，删除之后出现的页面图像。
- `已排除` 指与预先设置的排除项目一致的图像。
- `AI 过滤` 指 AI 判断应被移除的图像。
- `AI 过滤 - 编辑模式` 指 AI 判断为演示软件编辑模式的幻灯片图像。由于部分教师会在这一模式下放映幻灯片，此类图像会被单独标记，并可在 `自动裁剪` 后恢复。


> [!TIP]
> `被移除的图像` 不会出现在常规输出文件夹中；`被移除的图像` 会被移动至 `输出目录` 下的 `.autoslidesTrash` 文件夹；`被裁剪的图像` 的原始图像会被备份至 `输出目录` 下的 `.autoslidesCrop` 文件夹。

<p align="center">
  <img src="docs/step10.png" width="70%" alt="step10" />
</p>

<br>

---

选择需要操作的图像后，可执行 `删除`、`恢复`、`自动裁剪`、`去除重复` 和 `清空回收站`：
- `删除` 可将 `已提取` 的图像以 `手动` 删除的原因移入回收站；
- `恢复` 可将 `已移除` 的图像恢复为 `已提取` 状态；`恢复` 下的额外选项 `还原已裁剪` 可将当前文件夹中所有被 `手动裁剪` 或 `自动裁剪` 的图像恢复为原始状态；
- `自动裁剪` 可对标记为 `已提取` 或 `AI 过滤 - 编辑模式` 的图像进行裁剪；额外选项 `设置裁剪基准` 和 `应用裁剪基准` 可将一张 `已裁剪` 或 `已自动裁剪` 的图像设为基准，并把同一裁剪区域应用到其他图像；
- `去除重复` 可对当前文件夹运行 `pHash 重复去除后处理`；其额外选项可选择是否在裁剪后自动运行 `去重`，移除裁剪后新出现的 `重复项`。


<p align="center">
  <img src="docs/step11.png" width="70%" alt="step11" />
</p>

<br>

#### H. 将幻灯片导出为 PDF

1. 转到 `PDF 导出` 页面，选择需要导出的文件夹（例如一学期的课程）。文件夹默认按自然顺序排列，也可以拖动调整；文件夹名称和顺序将决定 PDF 大纲标题与章节顺序。
2. 根据需要调整 `压缩选项` 和 `宽高比`，然后点击 `生成 PDF`。

<p align="center">
  <img src="docs/step13.png" width="70%" alt="step13" />
</p>

<br>

#### I. 高级设置

##### 高级设置 > 一般

1. 进入高级设置界面后，可在 `高级设置 > 一般` 中调整主题、语言，或直接使用 `令牌` 登录。
2. 应用运行过程中可能积累较多 `缓存`，建议不定期清理；如果运行异常，可以尝试 `重置所有数据`。`重置所有数据` 不会删除 `输出目录` 下的任何文件。

<p align="center">
  <img src="docs/step14.png" width="70%" alt="step14" />
</p>

<br>

##### 高级设置 > 图像处理

1. 应用输出图像使用 PNG 格式，默认 `启用 PNG 色彩压缩`。
- 普通 PNG 图像通常使用“真彩色”模式存储，即每个像素的颜色由红、绿、蓝和透明度四个通道直接定义。这种模式能呈现数百万种颜色，但文件体积较大。
- `压缩 PNG 图像调色盘大小` 通过将普通 PNG 文件颜色量化为 128 种或更少的颜色以显著减小文件体积。
- 对于幻灯片图像，由于幻灯片通常只有有限数量的颜色，压缩的效果较好，视觉损失相对较小，同时文字仍保持清晰锐利。
2. 不建议随意调整图像处理的核心参数 `SSIM 阈值`。更高的 `全局结构相似性阈值` 表示更严格的匹配。可选预设包括：`自适应/严格(0.999)/标准(0.9987)/宽松(0.998)/自定义(0.990-0.9999)`。
- `自适应` 模式针对不同教学楼进行特殊优化，部分教学楼由于设备老旧，视频质量不佳，适用更宽松的阈值。
- `教室位置规则`："综教/理教/研楼" → 宽松；其他位置 → 正常。
- `严格` 模式下，检测的敏感度极高。
- `标准` 模式下，该值相对平衡，能有效检出少量文字增减的情境。

> [!NOTE]
> 建议仅在必要时调整 SSIM 阈值。即便 0.001 的微小变化也可能显著影响性能。使用 [在线测试](https://learn.ruc.edu.kg/test) 👈 或在浏览器中打开 `test-image-comparison.html` 测试和校准 SSIM 算法。

<p align="center">
  <img src="docs/step15.png" width="50%" alt="step15" />
</p>

<br>

---

1. `后处理` 是在获取幻灯片后执行的过滤和排除流程，包含三个阶段：`重复去除`、`比对排除列表` 和 `AI 过滤`。这些阶段默认全部启用，你也可以单独关闭 `AI 过滤`。
2. 如果想统一排除某类图像，例如特殊错误页面，可以将其添加到 `pHash 排除列表`，应用会记录其哈希值用于后续比对。`排除列表` 预置了 `No Signal`、`No Input`、`Black Screen` 和 `Desktop` 等常见排除项的哈希值。

> [!TIP]
> 基于 pHash 的排除仅能有效排除几乎完全一致的图像。建议启用 AI 过滤功能进行智能过滤。
>
> 应用使用 256 位 pHash。不建议调整 256 位 pHash 的汉明距离阈值以更好地与应用整体协同工作。
 
<p align="center">
  <img src="docs/step16.png" width="50%" alt="step16" />
</p>

<br>

---

1. 自动裁剪功能同时使用 `Canny 边缘检测` 算法和 `YOLO` 机器学习模型。默认优先使用 `Canny 边缘检测`；它能精准识别幻灯片边框，但容易受遮挡影响。`YOLO` 模型可靠性更好，能覆盖多数裁剪场景，但裁剪范围可能与幻灯片边缘有轻微偏移。
2. 对于 `Canny 边缘检测` 算法，可调整 `宽高比容差`，即匹配检测到的幻灯片宽高比时，相对常见幻灯片比例 16:9 或 4:3 允许的最大偏差；其他自动裁剪参数不建议进行调整。
 
<p align="center">
  <img src="docs/step17.png" width="50%" alt="step17" />
</p>

<br>

##### 高级设置 > 播放和下载

1. `显示更多播放速度` 控制播放模式下是否显示 0.5-16 倍速选项。
2. `阻止系统休眠` 可在视频播放期间阻止系统进入休眠状态，避免播放中断。
 
<p align="center">
  <img src="docs/step18.png" width="50%" alt="step18" />
</p>

<br>

##### 高级设置 > 网络

`内网网络接口` 可设置将内网模式流量绑定到指定的本地网络接口。此设置仅作用于经由内网模式的请求，其他流量仍然使用系统默认路由。
 
<p align="center">
  <img src="docs/step18.1.png" width="50%" alt="step18.1" />
</p>

<br>

##### 高级设置 > AI

1. `ML` 模式基于本地机器学习模型。面对训练数据覆盖不足的场景时，它的准确率可能下降，因此适合使用更保守的置信度阈值。
2. `ML` 和 `LLM` 模式都可以在 `AI 行为` 中选择是否区分 `may_be_slide` 分类，即让模型单独判断图像是否处于幻灯片编辑模式。
 
<p align="center">
  <img src="docs/step19.png" width="50%" alt="step19" />
</p>

<br>

#### J. 其他工具

1. `离线处理` 是实验性工具。`离线后处理` 可输入图像文件夹，将其复制到 `输出目录` 并运行后处理；`自动裁剪` 可输入图像文件，运行自动裁剪并查看结果。

<p align="center">
  <img src="docs/step20.png" width="70%" alt="step20" />
</p>

<br>

---

2. `讲座压缩` 可对下载的屏幕录制视频进行激进压缩，便于长期存档。它会降低帧率和分辨率，并可降低音频噪声，以较小文件体积保留基本可读性和相对清晰的音频。

<p align="center">
  <img src="docs/step21.png" width="70%" alt="step21" />
</p>

<br>

#### K. 扩展

1. `雨课堂` 扩展可解决该平台原生课件导出带边框和水印的问题；如果教师使用雨课堂播放幻灯片，通常可在课程开始时一次性获取当前课件的所有页面。

<p align="center">
  <img src="docs/step22.png" width="70%" alt="step22" />
</p>

<br>

---

2. 如果希望对任意网页视频运行幻灯片提取，可以使用 `网页捕获` 扩展。它支持手动输入网址、自动检测或手动选择页面视频元素，也支持绘制页面区域并持续监控画面变化。点击右上角的 `预设` 按钮可进入并自动登录延河官方网页。

<p align="center">
  <img src="docs/step23.png" width="70%" alt="step23" />
</p>

## 🏗️ 架构设计

AutoSlides 使用 Electron + Vue 3 + TypeScript 构建，核心思路是把系统能力、网络代理、文件操作和图像处理拆到不同进程与 Worker 中，避免主界面在长时间任务中卡顿。

```mermaid
flowchart LR
  A["Renderer / Vue UI"] --> B["Preload IPC Bridge"]
  B --> C["Main Process Services"]
  A --> D["Web Workers"]
  C --> E["Yanhe API / Video Proxy / FFmpeg"]
  C --> F["File System / Manifests / Models"]
  D --> G["SSIM / pHash / Auto Crop / ML"]
  A --> H["Tools Window"]
  H --> F
```

### 进程分工

- `src/main.ts` 启动 Electron 主进程，注册 IPC，并组合认证、配置、视频代理、下载、AI、PDF、裁剪和文件服务。
- `src/preload.ts` 通过 `contextBridge` 暴露 `window.electronAPI`，Renderer 只能通过结构化 IPC 调用主进程能力。
- `src/renderer/` 是 Vue 应用层，负责课程浏览、播放控制、任务队列、设置面板和工具窗口。
- `src/renderer/workers/` 承载计算密集任务：`slideProcessor.worker.ts` 做 SSIM 比较，`postProcessor.worker.ts` 做 pHash，`autoCrop.worker.ts` 做 Canny/YOLO 裁剪检测，`slideClassifier.worker.ts` 运行本地 ML 分类器。
- `src/main/configService.ts` 统一管理持久化配置，默认写入 `electron-store`；滑块、模型路径、提示词、语言和主题最终都从这里进入各服务。
- `resources/models/` 存放内置 ONNX 模型；用户导入的自定义模型会复制到 `userData/models/`，并由主进程模型服务做路径解析和缺失回退。

### 数据流

1. Renderer 通过 `apiClient` 和主进程 IPC 获取课程、直播和录播元数据。
2. 主进程 `videoProxyService` 解析播放地址并启动本地代理，处理内外网映射、录播防护和签名刷新。
3. 播放页面按检测间隔抽取视频帧，把 `ImageData` 交给 Web Worker 比较，判定为新幻灯片后通过 IPC 写入输出目录。
4. 后处理流程按 `重复去除 -> 排除列表 -> AI 过滤` 顺序运行。被移除的图像不会直接丢失，而是写入 `.autoslidesTrash` 及 JSONL manifest，`幻灯片审查页面` 会把已提取和已移除图像合并显示。
5. 裁剪操作会先把原图备份到 `.autoslidesCrop`，再覆盖工作图像；PDF 导出和预览都使用当前工作图像，因此裁剪结果会自然进入后续导出流程。

### 图像分析设计

For technical details and mathematical formulation, see the [AutoSlides Image Analysis Technical Report](docs/image-analysis-technical-report.pdf).

#### 1. 在线幻灯片检测

在线提取只使用 SSIM 判断画面是否发生结构性变化。每一帧先按配置缩放到较小尺寸（默认 `480 x 270`），再转为灰度图：

$$
Y = 0.299R + 0.587G + 0.114B
$$

对两帧灰度图 $x,y$ 计算全局结构相似度：

$$
\mathrm{SSIM}(x,y)=
\frac{(2\mu_x\mu_y+C_1)(2\sigma_{xy}+C_2)}
{(\mu_x^2+\mu_y^2+C_1)(\sigma_x^2+\sigma_y^2+C_2)}
$$

其中：

$$
C_1=(0.01\cdot255)^2,\qquad C_2=(0.03\cdot255)^2
$$

当：

$$
\mathrm{SSIM}(x,y) < \tau
$$

即可认为当前帧与上一张已保存幻灯片存在显著变化。默认阈值使用 `自适应` 模式：常规情况下为 `0.9987`，当教室名称包含 `综教`、`理教` 或 `研楼` 时自动切换到更宽松的 `0.998`，以适应老旧设备或较差录制质量。

为了减少动画、鼠标移动、视频片段造成的误检，提取器还会运行稳定性复核。检测到候选帧 $c$ 后，后续连续帧 $f_i$ 必须满足：

$$
\mathrm{SSIM}(c,f_i) \ge \tau
$$

达到配置的复核次数后才保存。默认检测间隔为 `2000 ms`，播放倍速变化时会按倍速重新计算实际检查间隔；13 倍速以上使用上限因子，避免浏览器定时器和视频渲染在极高倍速下出现不稳定。

#### 2. pHash 去重与排除

后处理的前两阶段使用感知哈希。图像会先转灰度并缩放到 `64 x 64`，随后计算二维 DCT：

$$
D_{u,v}=
\frac{2}{N}\alpha(u)\alpha(v)
\sum_{x=0}^{N-1}\sum_{y=0}^{N-1}
I_{x,y}
\cos\frac{(2x+1)u\pi}{2N}
\cos\frac{(2y+1)v\pi}{2N}
$$

其中 $\alpha(0)=1/\sqrt{2}$，其余 $\alpha(k)=1$。实现取左上角 `16 x 16` 低频块，跳过 DC 项后，用 AC 系数中位数生成固定位宽哈希：

$$
h_i=
\begin{cases}
1, & D_i \ge \mathrm{median}(D) \\
0, & D_i < \mathrm{median}(D)
\end{cases}
$$

两张图像的相似度用汉明距离衡量：

$$
d_H(h_a,h_b)=\sum_i (h_{a,i}\oplus h_{b,i})
$$

当 $d_H \le 10$（默认阈值）时，后出现的图像会被视为重复项并移入回收站。排除列表使用同一套 pHash 机制，因此可以稳定过滤 `No Signal`、黑屏、桌面背景或用户自定义错误页。

#### 3. AI / ML 语义过滤

SSIM 和 pHash 只判断像素变化与视觉相似度，无法可靠区分“完整幻灯片”和“非幻灯片页面”。因此第三阶段引入语义分类：

- `LLM` 模式把图像缩放到默认 `768 x 432` 后发送给多模态模型，要求返回结构化 JSON。
- `ML` 模式在本机运行 MobileNetV4 ONNX 分类器，类别为 `may_be_slide`、`not_slide`、`slide`。
- 当开启 `Distinguish may_be_slide` 时，编辑模式截图会进入 `AI 过滤 - 编辑模式`，用户可以在 `幻灯片审查页面` 中恢复并自动裁剪。

本地 ML 的输出 logits $z_i$ 会先转为概率：

$$
p_i=\frac{e^{z_i}}{\sum_j e^{z_j}}
$$

随后按置信度区间做保守决策：若预测为 `slide`，直接保留；若预测为非幻灯片但置信度低于 `trustLow`，也保留；若置信度高于 `trustHigh`，按预测类别移除；中间区间则检查 `slide` 概率，只有当 $p_\text{slide}$ 低于 `slideCheckLow` 时才移除。默认阈值为：

| 参数 | 默认值 | 含义 |
| --- | --- | --- |
| `trustLow` | `0.75` | 低于该值时不信任非幻灯片判断 |
| `trustHigh` | `0.90` | 高于该值时信任非幻灯片判断 |
| `slideCheckLow` | `0.25` | 中间区间内用于兜底保留幻灯片的概率阈值 |

#### 4. 自动裁剪

自动裁剪默认使用 `canny_then_yolo`：先运行传统 CV 管线，检测失败时再回退到 YOLOv8 ONNX 模型。

传统管线步骤如下：

1. 扫描图像四边，移除灰度均值低于 `blackThreshold` 的黑边，最多扫描宽高的 `maxBorderFrac`。
2. 对内部区域运行 Canny 边缘检测和一次膨胀。
3. 查找轮廓并要求近似多边形为四边形。
4. 使用面积占比、边缘填充率和宽高比评分筛选候选框。

宽高比评分以 `16:9` 和 `4:3` 为目标：

$$
s_\text{aspect}=\max\left(0,1-\frac{\min_{a\in\{16/9,4/3\}}\left|\frac{w/h-a}{a}\right|}{\epsilon}\right)
$$

候选框最终分数为：

$$
s = s_\text{aspect}\cdot \frac{w h}{W H}
$$

其中 $W,H$ 是去黑边后的内部区域尺寸。若 Canny 未找到可靠候选框，YOLO 分支会把图像 letterbox 到固定输入尺寸，解码 `(cx, cy, w, h, confidence)` 输出，并用 NMS 去除重叠框：

$$
\mathrm{IoU}(A,B)=\frac{|A\cap B|}{|A\cup B|}
$$

YOLO 的默认置信度阈值为 `0.25`，NMS IoU 阈值为 `0.45`，输入尺寸为 `640`。`onnxruntime-web` 在 Worker 内使用 WASM 后端，并设置单线程运行，避免依赖 `SharedArrayBuffer` 相关浏览器隔离策略。

### 开发者指南

所有开发命令都在 `autoslides/` 子目录中运行：

```bash
cd autoslides
npm install
npm start
npm run lint
npm run package
npm run make:mac
npm run make:win
npm run make:linux
```

开发时建议关注以下约定：

- 新增主进程能力时，在 `src/main.ts` 注册 IPC，并在 `src/preload.ts` 暴露最小必要 API；Renderer 不应直接访问 Node.js 能力。
- 新增持久化设置时，先扩展 `ConfigService` 的类型、默认值和迁移逻辑，再同步到对应 Vue composable。
- 耗时图像处理应优先放入 Web Worker；需要访问文件系统、Sharp、FFmpeg 或模型文件时，通过主进程 IPC 处理。
- 新增界面文案时同步更新 `src/renderer/i18n/locales/` 下的多语言文件。
- ONNX Runtime 的 WASM 文件由 Vite 配置复制到 `/ort-wasm/`；打包时模型文件通过 Forge `extraResource` 放入 `resources/models`。
- 修改图像分析参数后，建议同时覆盖直播提取、录播任务、`幻灯片审查页面`、PDF 导出和离线处理这几条路径，避免工具窗口与主播放流程行为不一致。

## Star History

<div align="center">
  <a href="https://www.star-history.com/?repos=bit-admin%2FYanhekt-AutoSlides&type=date&legend=top-left">
   <picture>
     <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=bit-admin/Yanhekt-AutoSlides&type=date&theme=dark&legend=top-left" />
     <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=bit-admin/Yanhekt-AutoSlides&type=date&legend=top-left" />
     <img alt="Star History Chart" src="https://api.star-history.com/image?repos=bit-admin/Yanhekt-AutoSlides&type=date&legend=top-left" />
   </picture>
  </a>
</div>

---

<div align="center">
<p>Copyright © 2025 bit-admin.</p>
<p>
<a href="https://learn.ruc.edu.kg">Website</a> •
<a href="mailto:info@ruc.edu.kg">Email</a> •
<a href="https://it.ruc.edu.kg/docs">Docs</a>
</p>
</div>
