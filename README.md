<div align="center">

  <img src="docs/icon.png" width="120" />

  # AutoSlides
  
  **北京理工大学延河课堂第三方客户端｜自动提取幻灯片｜下载课程录像｜AI 过滤**

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
    <a href="#-功能特性">✨ 功能特性</a>
  </p>

</div>

---

## ✨ 功能特性

- 基于逆向工程处理延河课堂防盗链防护，提供视频播放及下载。
- 针对校园网优化，观看延河课堂视频再不卡顿；录播视频 0.5-16 倍速流畅播放；下载速率快至110MB/s<sup>1</sup> 。
- 在视频播放同时运行幻灯片提取；无须下载视频；145 分钟课程在 16 倍速下用时 10 分钟处理完成。
- 在幻灯片提取任务进行过程中阻止系统休眠，可长时间彻夜运行。
- 基于 vLLM 或 ML 分类器进行 AI 过滤，移除非全屏播放的幻灯片图像及其它干扰内容。
- 审查获取的幻灯片，对非放映模式的幻灯片图像进行自动裁剪。
- 将提取的幻灯片合并为 PDF；压缩图像以减小文件体积。

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
        从下载的屏幕录制中提取幻灯片；处理一节课的视频用时快至10秒<sup>4</sup>；支持 GPU 加速；使用 C++ 构建；使用与 <code>AutoSlides</code> 相同的图像处理算法及基于 <code>MobileNetV4</code> 的机器学习模型。
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

<sup>4</sup> **两个工具组合使用速度更快**：使用 `AutoSlides` 下载一节95分钟课程的屏幕录制视频在校园网内用时约10秒；使用 `AutoSlides Extractor` 处理该视频（I-frame 间隔2秒）在 M4 Mac mini 上用时约10秒。

## 🚀 快速开始

### 1. 下载

- 前往 [release 页面](https://github.com/bit-admin/Yanhekt-AutoSlides/releases) 👈 下载适用于您的平台的安装程序（macOS 用户请下载 `DMG` 文件；Windows 用户请下载 `EXE` 文件；Linux 用户请下载 `AppImage` 或 `deb` 文件）。

### 2. 安装
   - **macOS**：打开 `.dmg` 安装包，将应用图标拖动到 `Applications` 文件夹。
      - 双击安装包内的 `install.command` 文件，运行安装脚本，此时你会收到"Apple 无法验证安全性"的提示；先关闭这个提示。
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

   - **Windows**：运行 `.exe` 安装程序并按照安装向导操作。

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

1. 启动应用程序，使用北京理工大学统一身份认证账户密码进行登录。使用账户密码可能会不时需要短信验证码进行二次验证。如遇此种情况，请使用 `浏览器登录`。 [#1](https://github.com/bit-admin/Yanhekt-AutoSlides/issues/1)
2. 点击 `浏览器登录`，将会在内置浏览器中打开官方登录界面。登录并跳转到延河课堂页面后，将会自动获取延河课堂令牌。

<p align="center">
  <img src="docs/step1.png" width="90%" alt="step1" />
</p>

<br>

#### B. 基础设置

<img src="docs/step2.png" align="right" width="45%" alt="step2" />

1. 根据需要调整 `输出目录`，默认为 `~/Downloads/AutoSlides`（建议设置为独立的文件夹）。
2. 在校园网内时，切换 `连接模式` 到 `内网模式` 以获得更好的连接体验和更快的课程资源访问速度。
3. 根据需要调整 `音频模式`，可以将应用静音运行。
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
> 此设计的合理之处在于，翻动过快的幻灯片即使上课认真听讲也难以及时记录。如果你认为被跳过的幻灯片非常重要，你可以在观看课程视频时手动暂停。

<br clear="both">

<br>

#### C. AI 设置

1. 在 `高级设置 > AI` 中配置 AI 服务。可选择图像分类的运行方式：`LLM` 模式使用云端多模态大语言模型 API 服务，`ML` 模式在本机运行机器学习模型。`LLM` 模式的准确率更佳，但 `ML` 模式的运行速度更快且不依赖外部服务。
2. `LLM` 模式 `内置服务` 免费提供 `gpt-4.1` 模型；**共享服务的可用性视情况而定**；你也可以使用 GitHub 登录或使用自定义服务 `API Base URL`、`API Key` 及 `模型名称`；了解更多：[AI 配置及 GitHub 教育优惠文档](https://it.ruc.edu.kg/zh/docs)。

> [!TIP]
> AI 可能出错。核查 AI 的分类结果。

> [!IMPORTANT]
> The Built-in service is provided by the developer free of charge and on an "as is" basis. We make no warranties, express or implied, regarding the continuity or stability of the service, and we may modify or interrupt the service at any time without prior notice.
> <br> 开发者免费并按“原样”基础提供内置服务。我们不对服务的连续性或稳定性作出任何明示或隐含的保证，并可能随时修改或中断服务，恕不另行通知。

<p align="center">
  <img src="docs/step3.png" width="60%" alt="step3" />
</p>

<br>

#### D. 基础页面使用

1. `直播` 及 `录播` 两种模式可以同时运行，在切换模式时可以继续视频播放。
2. `获取个人课程列表`，找到你想要观看的课程；或者使用 `搜索` 功能在全校课程中进行搜索；你还可以观看任意正在直播的课程，即便你并未注册该课程。
3. 你还可以在 `课程收藏夹` 中保存你常观看的课程的关键词，快速进行搜索。

<p align="center">
  <img src="docs/step4.png" width="60%" alt="step4" />
</p>

<br>

#### E. 录播课程播放与下载

1. 选择进入录播课程页面，可将具体课程节次添加到 `幻灯片提取任务列表` ，下载 `课堂摄像头录像` 及 `屏幕录制` 视频。
2. 你也可以将课程的所有节次添加到 `任务列表` 或 `下载队列`。
3. 你还可以直接点击 `播放` 某一具体课程节次而不添加至幻灯片提取任务列表，适用于你希望认真观看课程录像的情况。
4. 在右侧栏中可管理 `任务列表` 及 `下载队列`；在 `任务列表` 中点击 `开始` 启动任务队列。

<p align="center">
  <img src="docs/step5.png" width="70%" alt="step5" />
</p>

<br>

---

当处于播放模式时，可以选择同时观看 `屏幕录制` 及 `课堂摄像头` 视频。

<p align="center">
  <img src="docs/step5.1.png" width="70%" alt="step5" />
</p>

<br>

#### F. 幻灯片提取

1. 启动录播课程 `幻灯片提取任务` 后，将会依次以 `任务速度` 播放课程屏幕录制并启动幻灯片提取功能。你会在列表中看到进行中的项目进度，以及已完成项目的 `后处理` 执行情况。
2. 在播放页面，你可以在控制栏中选择 `视频源`，调整 `播放速度`，以及选择进入 `画中画` 模式（控制栏仅在 `播放模式` 下可操作，录播课程 `任务模式` 下将被进入；直播课程始终处于 `播放模式`）。
3. 播放页面下方为 `幻灯片提取预览窗口`；在 `播放模式` 下可手动开启及停止 `幻灯片提取`。你也可以随时手动触发 `后处理` 或 `删除` 已提取的幻灯片。

<p align="center">
  <img src="docs/step6.png" width="70%" alt="step6" />
</p>

<br>

#### G. 审查幻灯片

1. 点击左下角的 `工具` 按钮. 
2. 进入 `幻灯片审查` 页面。
3. 要删除文件夹，点击 `编辑` 按钮，选择要删除的文件夹。这将同时删除所有与该文件夹相关的回收站项目及裁剪前的原始图像备份。

<p align="center">
  <img src="docs/step7.png" width="25%" alt="step7" />
  <img src="docs/step8.png" width="45%" alt="step8" />
</p>

<p align="center">
  <img src="docs/step8.1.png" width="70%" alt="step7" />
</p>

<br>

---

1. 要查看保存的幻灯片图像，可在 `保留上下文`、`仅看已提取` 和 `仅看已移除` 视图中进行切换。
2. 对于被移除的幻灯片，使用移除原因进行筛选，包括 `重复`、`已排除`、`AI 过滤 - 非幻灯片`、`AI 过滤 - 编辑模式` 及 `手动`。
3. 滑动右下角的滑块可调整 `缩略图` 的大小。
4. 点击缩略图右上角的按钮可 `放大` 查看图片。
5. 点击左下角的 `全选` 按钮可全选当前筛选下的全部图像。

<p align="center">
  <img src="docs/step9.png" width="70%" alt="step9" />
</p>

<br>

---

图像会因为被判定为非 `全屏播放的幻灯片` 或其他原因而被移除：
- `重复` 指类似 `A -> B -> A`，演讲者在演讲过程中重复播放某一幻灯片页面时，只保留第一次出现的页面，删除之后出现的页面图像。
- `已排除` 指与预先设置的排除项目一致的图像。
- `AI 过滤` 是 AI 判断应被移除的图像。
- 特别地，`AI 过滤 - 编辑模式` 为 AI 判定属于编辑模式的幻灯片图像。由于部分教师可能会在这一模式下放映幻灯片，此类幻灯片被单独标识并可在 `自动裁剪` 后恢复。


> [!TIP]
> `被移除的图像` 不会出现在常规输出文件夹中；`被移除的图像` 会被移动至 `输出目录` 下的 `.autoslidesTrash` 文件夹；`被裁剪的图像` 的原始图像会被备份至 `输出目录` 下的 `.autoslidesCrop` 文件夹。

<p align="center">
  <img src="docs/step10.png" width="70%" alt="step10" />
</p>

<br>

---

选择你需要操作的图像；可执行的操作包括 `删除`、`恢复`、`自动裁剪`、`去除重复` 及 `清空回收站`：
- `删除` 可将 `已提取` 的图像以 `手动` 删除的原因移入回收站；
- `恢复` 可将 `已移除` 的图像恢复为 `已提取` 的状态；`恢复` 下的额外选项包括 `还原已裁剪`，可将当前文件夹下所有被 `手动裁剪` 或 `自动裁剪` 的图像恢复为原始状态；
- `自动裁剪` 可对标注为 `已提取` 或 `AI 过滤 - 编辑模式` 的图像进行自动裁剪；`自动裁剪` 下的额外选项包括 `设置裁剪基准` 及 `应用裁剪基准`，可将一张 `已裁剪` 或 `已自动裁剪` 的图像设置为 `裁剪基准`，随后对标注为 `已提取` 或 `AI 过滤 - 编辑模式` 的图像按照基准图像的裁剪区域进行裁剪；
- `去除重复` 可对当前文件夹下的图像运行 `pHash 重复去除后处理`；`去除重复`下的额外选项可选择是否在裁剪后自动运行 `去重` 后处理，将裁剪后发现的 `重复项` 移除。


<p align="center">
  <img src="docs/step11.png" width="70%" alt="step11" />
</p>

<br>

#### H. 将幻灯片导出为 PDF

1. 转到 `PDF 导出` 页面，选择需要导出的文件夹（例如一学期的课程）；文件夹排序已按自然顺序排序，但你也可拖动以改变文件夹的顺序；文件夹名称及顺序决定了 PDF 中大纲的标题名称及章节顺序。
2. 根据需要调整 `压缩选项` 及 `宽高比`，点击 `生成 PDF 按钮`。

<p align="center">
  <img src="docs/step13.png" width="70%" alt="step13" />
</p>

<br>

#### I. 高级设置

##### 高级设置 > 一般

1. 点击进入高级设置界面。在 `高级设置 > 一般` 页面调整页面主题、语言，或直接使用 `令牌` 进行登录。
2. 应用在运行过程中可能会积累大量 `缓存`，不时进行清理；如应用运行过程中出现问题，尝试 `重置所有数据`。`重置所有数据` 不会删除 `输出目录` 下的任何文件。

<p align="center">
  <img src="docs/step14.png" width="70%" alt="step14" />
</p>

<br>

##### 高级设置 > 图像处理

1. 应用输出的图像格式为 PNG 格式，默认 `启用 PNG 色彩压缩`。
- 普通的 PNG 图像通常使用“真彩色”模式存储，即每个像素的颜色由红、绿、蓝和透明度四个通道直接定义。这种模式能呈现数百万种颜色，但文件体积较大。
- `压缩 PNG 图像调色盘大小` 通过将普通 PNG 文件颜色量化为 128 种或更少的颜色以显著减小文件体积。
- 对于幻灯片图像，由于幻灯片通常只有有限数量的颜色，压缩的效果较好，视觉损失相对较小，同时文字仍保持清晰锐利。
2. 不建议调整图像处理的核心参数 `SSIM 阈值`。更高的 `全局结构相似性阈值` 表示更严格的匹配。包含五个预设模式：`自适应/严格(0.999)/标准(0.9987)/宽松(0.998)/自定义(0.990-0.9999)`。
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

1. `后处理` 是在获取幻灯片后进行的过滤、排除处理。包含三个阶段：`重复去除`、`比对排除列表` 及 `AI 过滤`。默认全部启用，但你可以选择是否使用 `AI 过滤` 功能。
2. 如果想要统一排除某类图像，例如特殊的错误页面，你可以添加项目进入 `pHash 排除列表`，将会记录其哈希值以进行后续比对。`排除列表` 预置有常见排除项 `No Signal`、`No Input`、`Black Screen`及`Desktop` 的哈希值信息。

> [!TIP]
> 基于 pHash 的排除仅能有效排除几乎完全一致的图像。建议启用 AI 过滤功能进行智能过滤。
>
> 应用使用 256 位 pHash。不建议调整 256 位 pHash 的汉明距离阈值以更好地与应用整体协同工作。
 
<p align="center">
  <img src="docs/step16.png" width="50%" alt="step16" />
</p>

<br>

---

1. 自动裁剪功能采用 `Canny 边缘检测` 算法及 `YOLO` 机器学习模型。默认优先使用 `Canny 边缘检测` 算法；`Canny 边缘检测` 算法可精准识别幻灯片的边框，精准裁剪，但易受遮挡等问题的影响；`YOLO` 机器学习模型可靠性佳，适应大多数情况的裁剪需要，但裁剪范围可能较幻灯片边缘有轻微偏移。
2. 对于 `Canny 边缘检测` 算法，可调整 `宽高比容差`，即匹配检测到的幻灯片宽高比时，相对常见幻灯片比例 16:9 或 4:3 允许的最大偏差；其他自动裁剪参数不建议进行调整。
 
<p align="center">
  <img src="docs/step17.png" width="50%" alt="step17" />
</p>

<br>

##### 高级设置 > 播放和下载

1. `显示更多播放速度` 可控制是否在播放模式下显示 0.5 - 16 倍速的更多倍速选项。
2. `阻止系统休眠` 可在在视频播放期间阻止系统进入休眠状态，避免播放中断。
 
<p align="center">
  <img src="docs/step18.png" width="50%" alt="step18" />
</p>

<br>

##### 高级设置 > 网络

`内网网络接口` 可设置将内网模式流量绑定到指定的本地网络接口。此设置仅作用于经由内网模式的请求，其他流量仍然使用系统默认路由。
 
<p align="center">
  <img src="docs/step18.1.png" width="50%" alt="step18" />
</p>

<br>

##### 高级设置 > AI

1. `ML` 模式基于本地机器学习模型，面对未能在训练时覆盖的情境时准确率较低，适用较为保守的置信度阈值。
2. `ML` 模式及 `LLM` 模式下均可在 `AI 行为` 选择是否区分 `may_be_slide` 分类，即模型将单独判断图像是否处于幻灯片编辑模式。
 
<p align="center">
  <img src="docs/step19.png" width="50%" alt="step19" />
</p>

<br>

#### J. 其他工具

1. `离线处理` 为测试性质的工具。`离线后处理` 可输入图像文件夹，将其复制至 `输出目录` 并运行后处理；`自动裁剪` 可输入图像，运行自动裁剪，并查看运行结果。

<p align="center">
  <img src="docs/step20.png" width="70%" alt="step20" />
</p>

<br>

---

2. `讲座压缩` 可用于对下载的屏幕录制视频进行激进压缩以便于存档，压缩为极低帧率及分辨率，降低音频噪音的视频文件，以极小的文件体积保存一定的可读性和相对较好的音频质量。

<p align="center">
  <img src="docs/step21.png" width="70%" alt="step21" />
</p>

<br>

#### K. 扩展

1. `雨课堂` 扩展可用于解决该平台原生课件导出带有边框及水印的问题；若教师使用雨课堂播放幻灯片，将可在课程一开始便一次性获取当前幻灯片的所有页面。

<p align="center">
  <img src="docs/step22.png" width="70%" alt="step22" />
</p>

<br>

---

2. 你可能会希望对任意视频播放软件运行幻灯片提取，使用 `网页捕获` 扩展可自行输入网址，自动检测或手动选择页面的视频元素，同时支持绘制页面区域，持续监控并运行幻灯片提取。点击右上角的 `预设` 按钮可进入并自动登录延河的官方网页。

<p align="center">
  <img src="docs/step23.png" width="70%" alt="step23" />
</p>

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
