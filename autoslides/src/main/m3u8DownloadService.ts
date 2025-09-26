import fs from 'fs';
import path from 'path';
import axios from 'axios';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { FFmpegService } from './ffmpegService';
import { ConfigService } from './configService';
import { IntranetMappingService } from './intranetMappingService';
import { ApiClient } from './apiClient';

const magic = "1138b69dfef641d9d7ba49137d2d4875";

export interface DownloadProgress {
  current: number;
  total: number;
  phase: number; // 0: downloading, 1: processing, 2: completed
}

export class M3u8DownloadService {
  private ffmpegService: FFmpegService;
  private configService: ConfigService;
  private intranetMapping: IntranetMappingService;
  private apiClient: ApiClient;
  private activeDownloads = new Map<string, M3u8Downloader>();

  constructor(ffmpegService: FFmpegService, configService: ConfigService, intranetMapping: IntranetMappingService, apiClient: ApiClient) {
    this.ffmpegService = ffmpegService;
    this.configService = configService;
    this.intranetMapping = intranetMapping;
    this.apiClient = apiClient;
  }

  async startDownload(
    downloadId: string,
    m3u8Url: string,
    outputName: string,
    progressCallback: (progress: DownloadProgress) => void,
    loginToken: string
  ): Promise<void> {
    if (this.activeDownloads.has(downloadId)) {
      throw new Error('Download already in progress');
    }

    const outputDir = this.configService.getConfig().outputDirectory;
    const isIntranetMode = this.configService.getConfig().connectionMode === 'internal';

    const downloader = new M3u8Downloader(
      m3u8Url,
      outputDir,
      outputName,
      progressCallback,
      isIntranetMode,
      this.ffmpegService,
      this.intranetMapping,
      this.apiClient,
      loginToken
    );

    this.activeDownloads.set(downloadId, downloader);

    try {
      await downloader.start();
    } finally {
      this.activeDownloads.delete(downloadId);
    }
  }

  cancelDownload(downloadId: string): void {
    const downloader = this.activeDownloads.get(downloadId);
    if (downloader) {
      downloader.stop();
      this.activeDownloads.delete(downloadId);
    }
  }

  isDownloadActive(downloadId: string): boolean {
    return this.activeDownloads.has(downloadId);
  }
}

class M3u8Downloader {
  private url: string;
  private outputDir: string;
  private name: string;
  private progressCallback: (progress: DownloadProgress) => void;
  private isIntranetMode: boolean;
  private ffmpegService: FFmpegService;
  private intranetMapping: IntranetMappingService;
  private apiClient: ApiClient;
  private loginToken: string;

  private workDir: string;
  private filePath: string;
  private frontUrl: string | null = null;
  private tsUrlList: string[] = [];
  private successSum = 0;
  private tsSum = 0;
  private isRunning = false;
  private shouldStop = false;
  private maxWorkers = 32;
  private numRetries = 99;

  private headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    "Origin": "https://www.yanhekt.cn",
    "referer": "https://www.yanhekt.cn/",
    "xdomain-client": "web_user",
    "Xdomain-Client": "web_user",
    "Xclient-Version": "v1",
    "Authorization": ""
  };

  private token: string | null = null;
  private signature: string | null = null;
  private timestamp: string | null = null;
  private signatureInterval: NodeJS.Timeout | null = null;

  constructor(
    url: string,
    outputDir: string,
    name: string,
    progressCallback: (progress: DownloadProgress) => void,
    isIntranetMode: boolean,
    ffmpegService: FFmpegService,
    intranetMapping: IntranetMappingService,
    apiClient: ApiClient,
    loginToken: string
  ) {
    this.url = url;
    this.outputDir = outputDir;
    this.name = name;
    this.progressCallback = progressCallback;
    this.isIntranetMode = isIntranetMode;
    this.ffmpegService = ffmpegService;
    this.intranetMapping = intranetMapping;
    this.apiClient = apiClient;
    this.loginToken = loginToken;

    this.workDir = path.join(outputDir, name);
    this.filePath = path.join(outputDir, name);

    // Check if file already exists
    if (fs.existsSync(`${this.filePath}.mp4`)) {
      console.log(`File '${this.filePath}.mp4' already exists, skip download`);
      this.progressCallback({ current: 100, total: 100, phase: 2 });
      return;
    }

    // Create directory if it doesn't exist
    if (!fs.existsSync(path.dirname(this.filePath))) {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.shouldStop = false;

    // Encrypt the URL
    this.url = this.encryptURL(this.url);

    try {
      await this.getM3u8Info(this.url, this.numRetries);

      // Start the signature update loop
      this.startUpdateSignatureLoop();

      console.log(`Downloading: ${this.name}`);
      console.log(`Save path: ${this.filePath}`);

      // Create directory for TS files
      if (!fs.existsSync(this.workDir)) {
        fs.mkdirSync(this.workDir, { recursive: true });
      }

      // Download all TS files
      await this.downloadAllTsFiles();

      if (this.successSum === this.tsSum && !this.shouldStop) {
        this.progressCallback({ current: this.successSum, total: this.tsSum, phase: 1 });
        await this.outputMp4();
        await this.deleteFiles();
        console.log(`Download successfully --> ${this.name}`);
        this.progressCallback({ current: this.successSum, total: this.tsSum, phase: 2 });
      }
    } catch (error) {
      console.error("Download failed:", error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  stop(): void {
    this.shouldStop = true;
    this.isRunning = false;

    // Clear the signature update interval immediately
    if (this.signatureInterval) {
      clearInterval(this.signatureInterval);
      this.signatureInterval = null;
    }
  }

  private encryptURL(url: string): string {
    const urlList = url.split("/");
    // Insert MD5 hash before the last segment
    urlList.splice(-1, 0, crypto.createHash('md5').update(magic + "_100").digest('hex'));
    return urlList.join("/");
  }

  private getSignature(): { timestamp: string; signature: string } {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto.createHash('md5').update(magic + "_v1_" + timestamp).digest('hex');
    return { timestamp, signature };
  }

  private async getToken(): Promise<string> {
    if (!this.token) {
      try {
        // Use the existing API client to get video token
        this.token = await this.apiClient.getVideoToken(this.loginToken);
        this.headers["Authorization"] = "Bearer " + this.loginToken;
      } catch (error) {
        console.error("Error getting token:", error);
        throw new Error("获取 Token 失败");
      }
    }
    return this.token!; // Should never be null at this point due to the check above
  }


  private addSignatureForUrl(url: string, token: string, timestamp: string, signature: string): string {
    return `${url}?Xvideo_Token=${token}&Xclient_Timestamp=${timestamp}&Xclient_Signature=${signature}&Xclient_Version=v1&Platform=yhkt_user`;
  }

  private startUpdateSignatureLoop(): void {
    this.signatureInterval = setInterval(() => {
      if (this.shouldStop || this.successSum === this.tsSum) {
        if (this.signatureInterval) {
          clearInterval(this.signatureInterval);
          this.signatureInterval = null;
        }
        return;
      }

      const sigData = this.getSignature();
      this.timestamp = sigData.timestamp;
      this.signature = sigData.signature;
    }, 10000); // Update every 10 seconds
  }

  private createAxiosInstance() {
    const instance = axios.create({
      timeout: 30000
    });

    if (this.isIntranetMode) {
      // Apply intranet mapping
      instance.interceptors.request.use((config) => {
        if (config.url) {
          const mappedUrl = this.intranetMapping.rewriteUrl(config.url);
          if (mappedUrl !== config.url) {
            const originalHost = new URL(config.url).hostname;
            config.url = mappedUrl;
            config.headers = config.headers || {};
            config.headers['Host'] = originalHost;
          }
        }
        return config;
      });
    }

    return instance;
  }

  private async getM3u8Info(m3u8Url: string, numRetries: number): Promise<void> {
    try {
      if (!this.token) {
        this.token = await this.getToken();
      }

      const sigData = this.getSignature();
      this.timestamp = sigData.timestamp;
      this.signature = sigData.signature;

      const url = this.addSignatureForUrl(
        m3u8Url,
        this.token,
        this.timestamp,
        this.signature
      );

      const axiosInstance = this.createAxiosInstance();
      const response = await axiosInstance.get(url, {
        timeout: 30000,
        validateStatus: null,
        headers: this.headers
      });

      if (response.status !== 200) {
        throw new Error(`Failed to get m3u8 info: ${response.status}`);
      }

      this.frontUrl = response.request.res?.responseUrl?.split(response.request.path)[0] ||
                     m3u8Url.substring(0, m3u8Url.lastIndexOf('/'));

      const responseText = response.data;

      // Check if this is a master playlist
      if (responseText.includes("EXT-X-STREAM-INF")) {
        // Extract the variant stream URL and recursively call this method
        const lines = responseText.split('\n');
        for (const line of lines) {
          if (line.startsWith('#')) continue;

          let variantUrl;
          if (line.startsWith('http')) {
            variantUrl = line;
          } else if (line.startsWith('/')) {
            variantUrl = this.frontUrl + line;
          } else {
            variantUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1) + line;
          }

          await this.getM3u8Info(variantUrl, this.numRetries);
          break;
        }
      } else {
        // Process the media playlist
        await this.getTsUrls(responseText);
      }
    } catch (error) {
      console.error("Error getting M3U8 info:", error);
      if (numRetries > 0 && !this.shouldStop) {
        await this.getM3u8Info(m3u8Url, numRetries - 1);
      } else {
        throw error;
      }
    }
  }

  private async getTsUrls(m3u8TextStr: string): Promise<void> {
    let newM3u8Str = "";
    let tsCount = 0;

    const lines = m3u8TextStr.split('\n');
    for (const line of lines) {
      if (line.includes('#')) {
        if (line.includes('EXT-X-KEY') && line.includes('URI=')) {
          if (fs.existsSync(path.join(this.workDir, 'key'))) {
            continue;
          }

          const key = await this.downloadKey(line, 5);
          if (key) {
            newM3u8Str += `${key}\n`;
            continue;
          }
        }

        newM3u8Str += `${line}\n`;

        if (line.includes('EXT-X-ENDLIST')) {
          break;
        }
      } else if (line.trim() !== '') {
        let tsUrl;
        if (line.startsWith('http')) {
          tsUrl = line;
        } else if (line.startsWith('/')) {
          tsUrl = this.frontUrl + line;
        } else {
          tsUrl = this.url.substring(0, this.url.lastIndexOf('/') + 1) + line;
        }

        this.tsUrlList.push(tsUrl);
        newM3u8Str += `${tsCount}.ts\n`;
        tsCount++;
      }
    }

    this.tsSum = tsCount;

    console.log(`Generated m3u8 file: ${this.filePath}.m3u8`);
    console.log(`Total ${tsCount} TS file segments`);

    // Save m3u8 file
    fs.writeFileSync(`${this.filePath}.m3u8`, newM3u8Str);

    // Generate ffmpeg concat format file
    let concatContent = '';
    for (let i = 0; i < tsCount; i++) {
      concatContent += `file '${path.join(this.workDir, `${i}.ts`).replace(/'/g, "'\\''").replace(/\\/g, "/")}'\n`;
    }
    fs.writeFileSync(`${this.filePath}.concat`, concatContent);
  }

  private async downloadAllTsFiles(): Promise<void> {
    const downloadPromises: Promise<void>[] = [];
    let index = 0;

    const downloadNext = async (): Promise<void> => {
      if (index >= this.tsUrlList.length || this.shouldStop) return;

      const currentIndex = index++;
      const tsUrl = this.tsUrlList[currentIndex];
      const outputPath = path.join(this.workDir, `${currentIndex}.ts`);

      try {
        await this.downloadTs(tsUrl, outputPath, this.numRetries);
      } catch (error) {
        console.error(`Failed to download TS file ${currentIndex}:`, error);
      }

      await downloadNext();
    };

    // Start multiple download workers
    for (let i = 0; i < this.maxWorkers && i < this.tsUrlList.length; i++) {
      downloadPromises.push(downloadNext());
    }

    await Promise.all(downloadPromises);
  }

  private async downloadTs(tsUrlOriginal: string, outputPath: string, numRetries: number): Promise<void> {
    if (this.shouldStop) return;

    try {
      if (!this.token) {
        this.token = await this.getToken();
      }

      const tsUrl = this.addSignatureForUrl(
        tsUrlOriginal.split('\n')[0],
        this.token,
        this.timestamp || this.getSignature().timestamp,
        this.signature || this.getSignature().signature
      );

      // Check if file already exists (for resume functionality)
      if (fs.existsSync(outputPath)) {
        this.successSum++;
        this.progressCallback({ current: this.successSum, total: this.tsSum, phase: 0 });
        return;
      }

      const axiosInstance = this.createAxiosInstance();
      const response = await axiosInstance.get(tsUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: this.headers
      });

      if (response.status === 200) {
        fs.writeFileSync(outputPath, response.data);
        this.successSum++;
        this.progressCallback({ current: this.successSum, total: this.tsSum, phase: 0 });
      } else if (numRetries > 0 && !this.shouldStop) {
        await this.downloadTs(tsUrlOriginal, outputPath, numRetries - 1);
      }
    } catch (error) {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      if (numRetries > 0 && !this.shouldStop) {
        await this.downloadTs(tsUrlOriginal, outputPath, numRetries - 1);
      } else {
        throw error;
      }
    }
  }

  private async downloadKey(keyLine: string, numRetries: number): Promise<string | null> {
    try {
      const match = keyLine.match(/URI=['"].*?['"]/);
      if (!match) return null;

      const midPart = match[0];
      const mayKeyUrl = midPart.substring(5, midPart.length - 1);

      let trueKeyUrl;
      if (mayKeyUrl.startsWith('http')) {
        trueKeyUrl = mayKeyUrl;
      } else if (mayKeyUrl.startsWith('/')) {
        trueKeyUrl = this.frontUrl + mayKeyUrl;
      } else {
        trueKeyUrl = this.url.substring(0, this.url.lastIndexOf('/') + 1) + mayKeyUrl;
      }

      if (!this.token) {
        this.token = await this.getToken();
      }

      const signedUrl = this.addSignatureForUrl(
        trueKeyUrl,
        this.token,
        this.timestamp || this.getSignature().timestamp,
        this.signature || this.getSignature().signature
      );

      const axiosInstance = this.createAxiosInstance();
      const response = await axiosInstance.get(signedUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: this.headers
      });

      const keyPath = path.join(this.workDir, 'key');
      fs.writeFileSync(keyPath, response.data);

      return `${keyLine.split(midPart)[0]}URI="./${this.name}/key"${keyLine.split(midPart)[1] || ''}`;
    } catch (error) {
      console.error("Error downloading key:", error);

      const keyPath = path.join(this.workDir, 'key');
      if (fs.existsSync(keyPath)) {
        fs.unlinkSync(keyPath);
      }

      if (numRetries > 0 && !this.shouldStop) {
        return await this.downloadKey(keyLine, numRetries - 1);
      }

      return null;
    }
  }

  private async outputMp4(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log("Starting MP4 conversion...");

      const ffmpegPath = this.ffmpegService.getFfmpegPath();
      if (!ffmpegPath) {
        reject(new Error('FFmpeg not available'));
        return;
      }

      const mp4FilePath = path.resolve(`${this.filePath}.mp4`);
      const concatFilePath = path.resolve(`${this.filePath}.concat`);

      console.log("Concat file path:", concatFilePath);
      console.log("Output MP4 path:", mp4FilePath);

      // Use spawn to execute ffmpeg
      const ffmpegProcess = spawn(ffmpegPath, [
        '-f', 'concat',
        '-safe', '0',
        '-i', concatFilePath,
        '-c', 'copy',
        '-bsf:a', 'aac_adtstoasc',
        '-movflags', '+faststart',
        mp4FilePath
      ]);

      let progressPercent = 0;

      ffmpegProcess.stdout?.on('data', (data: Buffer) => {
        console.log(`FFmpeg stdout: ${data}`);
      });

      ffmpegProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();

        // Parse progress from stderr output
        if (output.includes('time=')) {
          const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
          if (timeMatch) {
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const seconds = parseFloat(timeMatch[3]);
            const currentTime = hours * 3600 + minutes * 60 + seconds;

            // Estimate progress (this is rough since we don't know total duration)
            progressPercent = Math.min(Math.floor((currentTime / 3600) * 100), 99);
            this.progressCallback({ current: progressPercent, total: 100, phase: 1 });
          }
        }
      });

      ffmpegProcess.on('close', (code: number) => {
        if (code === 0) {
          console.log("MP4 conversion completed successfully");
          this.progressCallback({ current: 100, total: 100, phase: 1 });
          resolve();
        } else {
          console.error(`FFmpeg process exited with code ${code}`);

          // Check if output file exists despite error
          if (fs.existsSync(mp4FilePath)) {
            console.log("MP4 file generated despite FFmpeg error");
            this.progressCallback({ current: 100, total: 100, phase: 1 });
            resolve();
          } else {
            // Try fallback method
            this.fallbackOutputMp4(resolve, reject);
          }
        }
      });

      ffmpegProcess.on('error', (error: Error) => {
        console.error(`FFmpeg error: ${error.message}`);
        this.fallbackOutputMp4(resolve, reject);
      });
    });
  }

  private fallbackOutputMp4(resolve: () => void, reject: (error: Error) => void): void {
    console.log("Using fallback conversion method...");

    const ffmpegPath = this.ffmpegService.getFfmpegPath();
    if (!ffmpegPath) {
      reject(new Error('FFmpeg not available'));
      return;
    }

    const mp4FilePath = path.resolve(`${this.filePath}.mp4`);
    const m3u8FilePath = path.resolve(`${this.filePath}.m3u8`);

    const ffmpegProcess = spawn(ffmpegPath, [
      '-allowed_extensions', 'ALL',
      '-i', m3u8FilePath,
      '-c', 'copy',
      '-movflags', '+faststart',
      mp4FilePath
    ]);

    let progressPercent = 0;

    ffmpegProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();

      if (output.includes('time=')) {
        const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const seconds = parseFloat(timeMatch[3]);
          const currentTime = hours * 3600 + minutes * 60 + seconds;

          progressPercent = Math.min(Math.floor((currentTime / 3600) * 100), 99);
          this.progressCallback({ current: progressPercent, total: 100, phase: 1 });
        }
      }
    });

    ffmpegProcess.on('close', (code: number) => {
      if (code === 0 || fs.existsSync(mp4FilePath)) {
        console.log("Fallback MP4 conversion completed");
        this.progressCallback({ current: 100, total: 100, phase: 1 });
        resolve();
      } else {
        reject(new Error(`FFmpeg conversion failed with code ${code}`));
      }
    });

    ffmpegProcess.on('error', (error: Error) => {
      reject(new Error(`Fallback FFmpeg error: ${error.message}`));
    });
  }

  private async deleteFiles(): Promise<void> {
    try {
      // Delete all TS files
      if (fs.existsSync(this.workDir)) {
        const files = fs.readdirSync(this.workDir);
        for (const file of files) {
          fs.unlinkSync(path.join(this.workDir, file));
        }
        fs.rmdirSync(this.workDir);
      }

      // Delete the m3u8 and concat files
      if (fs.existsSync(`${this.filePath}.m3u8`)) {
        fs.unlinkSync(`${this.filePath}.m3u8`);
      }
      if (fs.existsSync(`${this.filePath}.concat`)) {
        fs.unlinkSync(`${this.filePath}.concat`);
      }
    } catch (error) {
      console.error("Error deleting temporary files:", error);
    }
  }
}