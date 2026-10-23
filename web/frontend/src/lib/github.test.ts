import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLatestRelease } from "./github";

function stubRelease(assetNames: string[]) {
  const body = {
    tag_name: "v9.0.0",
    published_at: "2026-10-24T00:00:00Z",
    html_url: "https://github.com/example/app/releases/tag/v9.0.0",
    body_html: "",
    assets: assetNames.map((name) => ({
      name,
      size: 1024,
      browser_download_url: `https://github.com/example/app/releases/download/v9.0.0/${name}`,
    })),
  };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchLatestRelease assets", () => {
  it("lists the installers and hides the updater's own files", async () => {
    // A desktop release also carries each installer's .sig, the Windows
    // .blockmap and latest.yml for the in-app updater; none is a download.
    stubRelease([
      "AutoSlides-9.0.0-macOS-arm64.dmg",
      "AutoSlides-9.0.0-macOS-arm64.dmg.sig",
      "AutoSlides-Setup-9.0.0-Windows-x64.exe",
      "AutoSlides-Setup-9.0.0-Windows-x64.exe.sig",
      "AutoSlides-Setup-9.0.0-Windows-x64.exe.blockmap",
      "latest.yml",
      "AutoSlides-9.0.0-Linux-x86_64.AppImage",
      "AutoSlides-9.0.0-Linux-x86_64.AppImage.sig",
      "autoslides_9.0.0_amd64.deb",
      "autoslides_9.0.0_amd64.deb.sig",
    ]);

    const release = await fetchLatestRelease({ owner: "example", repo: "app" });

    expect(release.assets.map((a) => [a.name, a.platform])).toEqual([
      ["AutoSlides-9.0.0-macOS-arm64.dmg", "macos"],
      ["AutoSlides-Setup-9.0.0-Windows-x64.exe", "windows"],
      ["AutoSlides-9.0.0-Linux-x86_64.AppImage", "linux"],
      ["autoslides_9.0.0_amd64.deb", "linux"],
    ]);
  });
});
