/**
 * Generates the token-grabbing bookmarklet (ported from
 * REFERENCE/bookmark-generator.js): dragged to the bookmarks bar and clicked
 * while on yanhekt.cn, it reads the login token from the site's localStorage
 * 'auth' entry and either jumps back here with ?token=<token> (auto-filled
 * into the login paste field — user still hits Verify) or copies the token
 * to the clipboard.
 */

export function generateBookmarklet(language: "en" | "zh"): string {
  const returnUrl = window.location.origin + window.location.pathname;

  const zh = `
(function() {
    const hostname = window.location.hostname;
    const isYanhekt = hostname.includes('yanhekt.cn');
    const returnUrl = '${returnUrl}';

    if (!isYanhekt) {
        const confirmed = confirm(
            '检测到当前不在延河课堂网站，是否跳转到延河课堂进行登录？\\n\\n' +
            '跳转后请再次点击书签工具获取 Token！'
        );
        if (confirmed) {
            window.open('https://www.yanhekt.cn', '_blank');
        }
        return;
    }

    try {
        const authData = localStorage.getItem('auth');
        if (!authData) {
            alert('未找到登录信息，请先登录延河课堂！');
            return;
        }

        const token = JSON.parse(authData).token;
        if (!token) {
            alert('Token为空，请重新登录延河课堂！');
            return;
        }

        const confirmed = confirm(
            'Token获取成功！\\n\\n' +
            '是否返回 AutoSlides 并自动填入Token？\\n\\n' +
            '点击确定将跳转并自动填入，点击取消手动复制Token。'
        );

        if (confirmed) {
            window.open(returnUrl + '?token=' + encodeURIComponent(token), '_blank');
        } else {
            const copyToClipboard = async (text) => {
                try {
                    if (navigator.clipboard && window.isSecureContext) {
                        await navigator.clipboard.writeText(text);
                        return true;
                    } else {
                        const textArea = document.createElement('textarea');
                        textArea.value = text;
                        textArea.style.position = 'fixed';
                        textArea.style.left = '-999999px';
                        textArea.style.top = '-999999px';
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();
                        const result = document.execCommand('copy');
                        document.body.removeChild(textArea);
                        return result;
                    }
                } catch (err) {
                    return false;
                }
            };

            copyToClipboard(token).then(success => {
                if (success) {
                    alert('Token已成功复制到剪贴板！\\n\\n' + token);
                } else {
                    prompt('自动复制失败，请手动复制Token:', token);
                }
            }).catch(() => {
                prompt('自动复制失败，请手动复制Token:', token);
            });
        }
    } catch (e) {
        alert('获取Token失败: ' + e.message + '\\n请确保已正确登录延河课堂！');
    }
})();
  `.trim();

  const en = `
(function() {
    const hostname = window.location.hostname;
    const isYanhekt = hostname.includes('yanhekt.cn');
    const returnUrl = '${returnUrl}';

    if (!isYanhekt) {
        const confirmed = confirm(
            'Not on Yanhekt website detected. Would you like to go to Yanhekt for login?\\n\\n' +
            'Please click the bookmark tool again after jumping to get the token!'
        );
        if (confirmed) {
            window.open('https://www.yanhekt.cn', '_blank');
        }
        return;
    }

    try {
        const authData = localStorage.getItem('auth');
        if (!authData) {
            alert('No login information found, please login to Yanhekt first!');
            return;
        }

        const token = JSON.parse(authData).token;
        if (!token) {
            alert('Token is empty, please re-login to Yanhekt!');
            return;
        }

        const confirmed = confirm(
            'Token obtained successfully!\\n\\n' +
            'Would you like to return to AutoSlides and auto-fill the token?\\n\\n' +
            'Click OK to jump and auto-fill, click Cancel to manually copy the token.'
        );

        if (confirmed) {
            window.open(returnUrl + '?token=' + encodeURIComponent(token), '_blank');
        } else {
            const copyToClipboard = async (text) => {
                try {
                    if (navigator.clipboard && window.isSecureContext) {
                        await navigator.clipboard.writeText(text);
                        return true;
                    } else {
                        const textArea = document.createElement('textarea');
                        textArea.value = text;
                        textArea.style.position = 'fixed';
                        textArea.style.left = '-999999px';
                        textArea.style.top = '-999999px';
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();
                        const result = document.execCommand('copy');
                        document.body.removeChild(textArea);
                        return result;
                    }
                } catch (err) {
                    return false;
                }
            };

            copyToClipboard(token).then(success => {
                if (success) {
                    alert('Token copied to clipboard successfully!\\n\\n' + token);
                } else {
                    prompt('Auto-copy failed, please manually copy the token:', token);
                }
            }).catch(() => {
                prompt('Auto-copy failed, please manually copy the token:', token);
            });
        }
    } catch (e) {
        alert('Failed to get token: ' + e.message + '\\nPlease make sure you are logged in to Yanhekt!');
    }
})();
  `.trim();

  const selected = language === "zh" ? zh : en;

  // Same minification as the original generator.
  return "javascript:" + selected.replace(/\s+/g, " ").replace(/;\s*}/g, ";}");
}
