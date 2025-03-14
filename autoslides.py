from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
import cv2
import numpy as np
import os
from datetime import datetime
import configparser
import subprocess
import sys
import json

def get_resource_path(relative_path):
    exe_dir = os.path.dirname(sys.executable)
    external_path = os.path.join(exe_dir, relative_path)
    if os.path.exists(external_path):
        return external_path

    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    else:
        return os.path.join(os.path.dirname(__file__), relative_path)

def load_config():
    config = configparser.ConfigParser()
    config_file = get_resource_path("config.ini")
    if not os.path.exists(config_file):
        config['Settings'] = {
            'output_dir': '~/Downloads/slides',
            'top_crop_percent': '5',
            'bottom_crop_percent': '5',
            'change_threshold': '0.001',
            'check_interval': '2',
            'chrome_path': '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            'debug_port': '9222'
        }
        with open(config_file, 'w') as f:
            config.write(f)
    config.read(config_file)
    settings = {
        'output_dir': os.path.expanduser(config['Settings']['output_dir']),
        'top_crop_percent': float(config['Settings']['top_crop_percent']) / 100,
        'bottom_crop_percent': float(config['Settings']['bottom_crop_percent']) / 100,
        'change_threshold': float(config['Settings']['change_threshold']),
        'check_interval': float(config['Settings']['check_interval']),
        'chrome_path': config['Settings']['chrome_path'],
        'debug_port': config['Settings']['debug_port']
    }
    return settings

def ensure_directory_exists(directory):
    if not os.path.exists(directory):
        os.makedirs(directory)

def setup_chromedriver():
    print("检测依赖项...")
    cache_dir = os.path.expanduser("~/.wdm/drivers/chromedriver")
    drivers_json = os.path.expanduser("~/.wdm/drivers.json")
    
    if os.path.exists(drivers_json):
        try:
            with open(drivers_json, 'r') as f:
                drivers_data = json.load(f)
            for key, value in drivers_data.items():
                if 'chromedriver' in key and 'binary_path' in value:
                    driver_path = value['binary_path']
                    if os.path.exists(driver_path) and os.access(driver_path, os.X_OK):
                        print("ChromeDriver已准备就绪")
                        return Service(driver_path)
        except Exception as e:
            print(f"读取缓存的ChromeDriver信息失败: {e}")
    
    if not os.path.exists(cache_dir):
        print("检查ChromeDriver更新，这可能需要一点时间...")
        
    try:
        manager = ChromeDriverManager()
        service = Service(manager.install())
        print("ChromeDriver已准备就绪")
        return service
    except Exception as e:
        print(f"安装ChromeDriver失败，请检查国际互联网连接: {e}")
        sys.exit(1)

def check_chrome_running():
    try:
        result = subprocess.run(['ps', 'aux'], capture_output=True, text=True)
        chrome_processes = [line for line in result.stdout.splitlines() if 'Google Chrome' in line and 'slide_capture_existing.py' not in line]
        return len(chrome_processes) > 0
    except Exception:
        return False

def ensure_chrome_closed():
    if check_chrome_running():
        print("检测到残留的Chrome进程，请彻底退出所有Chrome窗口（注意保存未完成的工作）。")
        input("退出Chrome后按回车键继续...")
        while check_chrome_running():
            print("仍有Chrome进程运行，请确保彻底退出。")
            input("退出Chrome后按回车键继续...")

def start_chrome(chrome_path, debug_port):
    chrome_cmd = [chrome_path, f"--remote-debugging-port={debug_port}"]
    try:
        process = subprocess.Popen(chrome_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print("已启动Chrome调试模式，请在浏览器中设置好播放。默认监控第一个Chrome标签页，建议只保留需要监控的标签页。建议只保留Slides播放画面，并进入网页全屏模式。")
        return process
    except Exception as e:
        print(f"启动Chrome失败: {e}")
        sys.exit(1)

def connect_to_chrome(service, debug_port):
    chrome_options = Options()
    chrome_options.add_experimental_option("debuggerAddress", f"127.0.0.1:{debug_port}")
    try:
        driver = webdriver.Chrome(service=service, options=chrome_options)
        return driver
    except Exception as e:
        print(f"连接Chrome失败: {e}")
        raise

def apply_block_rules(driver, rules_file):
    rules_file = get_resource_path("block_rules.txt")
    block_rules = []
    if os.path.exists(rules_file):
        with open(rules_file, 'r') as f:
            block_rules = [line.strip() for line in f if line.strip() and not line.startswith('#')]
    
    current_domain = driver.current_url.split('/')[2]
    for rule in block_rules:
        rule_domain = rule.split('##')[0]
        if current_domain.endswith(rule_domain) or current_domain == f"www.{rule_domain}":
            selector = rule.split('##', 1)[1]
            script = f"""
            var elements = document.querySelectorAll('{selector}');
            elements.forEach(function(el) {{
                el.style.display = 'none';
            }});
            """
            try:
                driver.execute_script(script)
                print(f"已隐藏元素: {selector}")
            except Exception as e:
                print(f"隐藏元素失败: {selector}, 错误: {e}")

def monitor_slides(driver, chrome_process, output_dir, top_crop_percent, bottom_crop_percent, change_threshold, check_interval):
    last_frame = None
    slide_count = 0
    print("已连接到浏览器，开始监控，不要再移动和调整Chrome窗口大小，在终端按Ctrl+C停止...")

    try:
        while True:
            screenshot = driver.get_screenshot_as_png()
            current_frame = cv2.imdecode(np.frombuffer(screenshot, np.uint8), cv2.IMREAD_COLOR)

            height, width = current_frame.shape[:2]
            top_crop = int(height * top_crop_percent)
            bottom_crop = int(height * (1 - bottom_crop_percent))
            current_frame = current_frame[top_crop:bottom_crop, 0:width]

            timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

            if last_frame is None:
                filename = f"{output_dir}/slide_{timestamp}.png"
                cv2.imwrite(filename, current_frame)
                print(f"保存初始slide: {filename}")
                slide_count += 1
                last_frame = current_frame
                continue

            diff = cv2.absdiff(current_frame, last_frame)
            diff_gray = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(diff_gray, 30, 255, cv2.THRESH_BINARY)
            change_area = np.sum(thresh) / 255
            total_area = diff_gray.size
            change_ratio = change_area / total_area

            if change_ratio > change_threshold:
                filename = f"{output_dir}/slide_{timestamp}.png"
                cv2.imwrite(filename, current_frame)
                print(f"保存新slide: {filename}")
                slide_count += 1
                last_frame = current_frame

            time.sleep(check_interval)

    except KeyboardInterrupt:
        print("停止监控")
        try:
            import threading
            import signal
            
            def quit_driver():
                try:
                    driver.quit()
                except Exception:
                    pass
            
            quit_thread = threading.Thread(target=quit_driver)
            quit_thread.daemon = True
            quit_thread.start()
            quit_thread.join(timeout=3)
        except Exception as e:
            print(f"关闭浏览器时发生错误: {e}")
        finally:
            try:
                chrome_process.terminate()
                print("已终止Chrome进程")
            except Exception:
                try:
                    chrome_process.kill()
                    print("已强制终止Chrome进程")
                except Exception:
                    pass
            print("已清理所有相关进程")

def main():
    driver = None
    chrome_process = None
    try:
        settings = load_config()
        ensure_directory_exists(settings['output_dir'])
        service = setup_chromedriver()
        ensure_chrome_closed()
        chrome_process = start_chrome(settings['chrome_path'], settings['debug_port'])
        input("按回车键开始监控...")
        driver = connect_to_chrome(service, settings['debug_port'])
        apply_block_rules(driver, None)
        monitor_slides(driver, chrome_process, settings['output_dir'], settings['top_crop_percent'], 
                       settings['bottom_crop_percent'], settings['change_threshold'], settings['check_interval'])
    except Exception as e:
        print(f"程序异常退出: {e}")
    finally:
        if 'driver' in locals() and driver:
            try:
                driver.quit()
            except Exception:
                pass
        
        if 'chrome_process' in locals() and chrome_process:
            try:
                chrome_process.terminate()
            except Exception:
                try:
                    chrome_process.kill()
                except Exception:
                    pass
        sys.exit(0)

if __name__ == "__main__":
    main()