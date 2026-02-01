# 参考
[https://pyscript.net/latest/pyscript.js](https://pyscript.net/latest/pyscript.js)

[codesandbox](https://codesandbox.io/p/github/minglie/ming_click/master?embed=1&import=true)

# 目录结构
```markdown
index.html
pyscript.toml
index.py
main.py
utils.py
```

# index.html
```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script
      type="module"
      src="https://pyscript.net/releases/2024.1.1/core.js"
    ></script>
    <script type="py" src="./index.py" config="./pyscript.toml"></script>

    <title>两个按钮 + 一个灯泡（HTML5 示例）</title>
    <style>
      /* ====== 基础样式 ====== */
      :root {
        --bg: #0f1220;
        --card: #171a2b;
        --text: #e8ebff;
        --muted: #9aa2c7;
        --brand: #5b8cff;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100svh;
        display: grid;
        place-items: center;
        background: radial-gradient(
            1200px 700px at 50% -20%,
            #1b2142 0,
            var(--bg) 45%
          ),
          var(--bg);
        color: var(--text);
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC",
          "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
      }
      .card {
        width: min(540px, 92vw);
        background: color-mix(in oklab, var(--card), white 2%);
        border: 1px solid color-mix(in oklab, var(--card), white 8%);
        border-radius: 18px;
        padding: 22px 20px 26px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
      }
      h1 {
        font-size: 18px;
        margin: 0 0 14px;
        font-weight: 600;
        letter-spacing: 0.2px;
      }
      p.tip {
        margin: 10px 0 18px;
        color: var(--muted);
        font-size: 13px;
      }

      /* ====== 灯泡区域 ====== */
      .stage {
        display: grid;
        place-items: center;
        padding: 12px;
        border-radius: 14px;
        background: linear-gradient(180deg, #0e1021, #0b0d1a);
        border: 1px solid rgba(255, 255, 255, 0.06);
        position: relative;
        overflow: hidden;
      }
      .stage::after {
        content: "";
        position: absolute;
        inset: auto -30% -60% -30%;
        height: 70%;
        background: radial-gradient(
          closest-side,
          rgba(91, 140, 255, 0.15),
          transparent 60%
        );
        transform: translateY(0);
        pointer-events: none;
      }
      svg {
        width: 220px;
        height: 220px;
        display: block;
      }
      .bulb .glass {
        fill: #3d3f52;
        transition: all 0.35s ease;
      }
      .bulb .filament {
        stroke: #777a93;
        transition: stroke 0.35s ease;
      }
      .bulb .cap {
        fill: #222536;
      }
      .bulb .screw {
        fill: #2b2f45;
      }
      .glow {
        position: absolute;
        width: 380px;
        height: 380px;
        border-radius: 50%;
        filter: blur(40px);
        opacity: 0;
        transition: opacity 0.35s ease;
        background: radial-gradient(
          circle,
          #ffd669 0,
          rgba(255, 214, 105, 0.75) 25%,
          rgba(255, 214, 105, 0) 60%
        );
        pointer-events: none;
      }
      .on .glass {
        fill: #ffe07a;
        filter: drop-shadow(0 0 20px rgba(255, 210, 90, 0.55))
          drop-shadow(0 0 50px rgba(255, 220, 120, 0.35));
      }
      .on .filament {
        stroke: #ffb400;
      }
      .on + .glow {
        opacity: 1;
      }

      /* ====== 逻辑运算选择区（仅替换为radio） ====== */
      .logic-checkboxes {
        margin: 16px 0;
        padding: 12px;
        border-radius: 12px;
        background: color-mix(in oklab, var(--card), black 5%);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
      .logic-checkboxes h3 {
        margin: 0 0 10px;
        font-size: 14px;
        color: var(--muted);
        font-weight: 500;
      }
      .checkbox-group {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      .checkbox-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        cursor: pointer;
      }
      .checkbox-item input[type="radio"] {
        accent-color: var(--brand);
        width: 14px;
        height: 14px;
        cursor: pointer;
      }

      /* ====== 控制按钮 ====== */
      .controls {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 16px;
      }
      button {
        appearance: none;
        border: 1px solid color-mix(in oklab, var(--card), white 12%);
        background: linear-gradient(
          180deg,
          color-mix(in oklab, var(--card), white 10%),
          var(--card)
        );
        color: var(--text);
        border-radius: 12px;
        padding: 12px 14px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.08s ease, box-shadow 0.2s ease,
          border-color 0.2s ease;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
      }
      button:hover {
        border-color: color-mix(in oklab, var(--brand), white 25%);
      }
      button:active {
        transform: translateY(1px);
      }
      button.primary {
        background: linear-gradient(
          180deg,
          color-mix(in oklab, var(--brand), white 15%),
          var(--brand)
        );
        border-color: color-mix(in oklab, var(--brand), black 15%);
        box-shadow: 0 10px 26px color-mix(in oklab, var(--brand), black 10%);
      }
      button:focus-visible {
        outline: 2px solid color-mix(in oklab, var(--brand), white 25%);
        outline-offset: 2px;
      }

      /* 辅助说明行 */
      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-top: 14px;
      }
      .state {
        font-size: 13px;
        color: var(--muted);
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.07) inset;
        background: #5b607a;
        transition: background 0.25s ease, box-shadow 0.25s ease;
      }
      .dot.on {
        background: #ffc23a;
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1) inset,
          0 0 10px 2px rgba(255, 194, 58, 0.5);
      }

      @media (max-width: 420px) {
        svg {
          width: 180px;
          height: 180px;
        }
        .checkbox-group {
          gap: 8px;
        }
      }

      button.active {
        background: linear-gradient(180deg, #ffd966, #ffb300);
        color: #222;
        box-shadow: 0 0 12px 4px rgba(255, 214, 102, 0.6);
      }
    </style>
  </head>

  <body>
    <div class="card" id="app">
      <h1>🔆 两个按钮 + 一个灯泡</h1>
      <p class="tip">
        按下 <strong>A</strong> 和 <strong>B</strong> 决定灯泡是否亮
      </p>

      <!-- ====== 灯泡舞台 ====== -->
      <div class="stage" aria-live="polite">
        <svg
          id="lamp"
          role="img"
          tabindex="0"
          aria-label="灯泡已关闭"
          viewBox="0 0 256 256"
        >
          <title>灯泡</title>
          <g class="bulb" id="bulb">
            <ellipse class="glass" cx="128" cy="104" rx="68" ry="80" />
            <g
              fill="none"
              stroke-width="6"
              stroke-linecap="round"
              class="filament"
            >
              <path d="M92 100 C 110 92, 146 92, 164 100" />
              <path d="M104 110 C 120 106, 136 106, 152 110" />
            </g>
            <rect class="cap" x="98" y="158" width="60" height="20" rx="6" />
            <g class="screw">
              <rect x="96" y="178" width="64" height="14" rx="4" />
              <rect x="96" y="192" width="64" height="14" rx="4" />
              <rect x="96" y="206" width="64" height="14" rx="4" />
            </g>
          </g>
        </svg>
        <div class="glow" id="glow"></div>
      </div>

      <!-- ====== 逻辑运算选择区（仅将checkbox改为radio，无其他新增） ====== -->
      <div class="logic-checkboxes">
        <h3>选择逻辑运算：</h3>
        <div class="checkbox-group">
          <label class="checkbox-item">
            <input type="radio" name="logic" value="and" /> 与
          </label>
          <label class="checkbox-item">
            <input type="radio" name="logic" value="or" /> 或
          </label>
          <label class="checkbox-item">
            <input type="radio" name="logic" value="not" /> 非
          </label>
          <label class="checkbox-item">
            <input type="radio" name="logic" value="nand" /> 与非
          </label>
          <label class="checkbox-item">
            <input type="radio" name="logic" value="xor" /> 异或
          </label>
          <label class="checkbox-item">
            <input type="radio" name="logic" value="xnor" /> 同或
          </label>
        </div>
      </div>

      <!-- ====== 控制按钮 ====== -->
      <div class="controls">
        <button id="btnA" type="button" aria-pressed="false">按键 A</button>
        <button id="btnB" type="button" aria-pressed="false">按键 B</button>
      </div>

      <div class="row" style="margin-top: 16px; justify-content: center">
        <button id="btnStart" type="button" class="primary">加载中...</button>
      </div>

      <div class="row">
        <div class="state" id="stateText">当前状态：关</div>
        <div class="dot" id="stateDot" title="状态指示"></div>
      </div>
    </div>

    <script>
      // ====== 原有逻辑保留，仅适配radio选中获取 ======
      const bulb = document.getElementById("bulb");
      const lamp = document.getElementById("lamp");
      const glow = document.getElementById("glow");
      const btnA = document.getElementById("btnA");
      const btnB = document.getElementById("btnB");
      const stateText = document.getElementById("stateText");
      const stateDot = document.getElementById("stateDot");
      const btnStart = document.getElementById("btnStart");
      const logicRadios = document.querySelectorAll('input[name="logic"]');

      let keyA = false;
      let keyB = false;
      let selectedLogic = null; // 适配radio：存储单个选中值

      // 适配radio：获取选中的逻辑运算（单个值）
      function getSelectedLogic() {
        const checkedRadio = document.querySelector(
          'input[name="logic"]:checked'
        );
        return checkedRadio ? checkedRadio.value : null;
      }

      function onLogicChange() {
        checkKeys(); // 重新计算灯泡状态（利用当前A/B按键状态和新选中的逻辑）
      }

      function setBulb(on) {
        bulb.classList.toggle("on", on);
        const rect = lamp.getBoundingClientRect();
        const stageRect = lamp.parentElement.getBoundingClientRect();
        glow.style.left = `${stageRect.width / 2 - 190}px`;
        glow.style.top = `${stageRect.height / 2 - 190}px`;
        lamp.setAttribute("aria-label", `灯泡已${on ? "开启" : "关闭"}`);
        stateText.textContent = `当前状态：${on ? "开" : "关"}`;
        stateDot.classList.toggle("on", on);
      }

      async function checkKeys() {
        try {
          selectedLogic = getSelectedLogic(); // 调用适配radio的获取方法
          const bothPressed = await PyMain(selectedLogic, keyA, keyB);
          setBulb(bothPressed);
          btnA.setAttribute("aria-pressed", keyA ? "true" : "false");
          btnB.setAttribute("aria-pressed", keyB ? "true" : "false");
          btnA.classList.toggle("active", keyA);
          btnB.classList.toggle("active", keyB);
        } catch (e) {
          console.error(e);
        }
      }
      document.querySelectorAll('input[name="logic"]').forEach((radio) => {
        radio.addEventListener("change", onLogicChange);
      });
      document.addEventListener("keydown", (e) => {
        if (e.code === "KeyA") {
          e.preventDefault();
          keyA = true;
          checkKeys();
        } else if (e.code === "KeyB") {
          e.preventDefault();
          keyB = true;
          checkKeys();
        }
      });

      document.addEventListener("keyup", (e) => {
        if (e.code === "KeyA") {
          e.preventDefault();
          keyA = false;
          checkKeys();
        } else if (e.code === "KeyB") {
          e.preventDefault();
          keyB = false;
          checkKeys();
        }
      });

      btnA.addEventListener("mousedown", () => {
        keyA = true;
        checkKeys();
      });
      btnA.addEventListener("mouseup", () => {
        keyA = false;
        checkKeys();
      });
      btnA.addEventListener("mouseleave", () => {
        keyA = false;
        checkKeys();
      });

      btnB.addEventListener("mousedown", () => {
        keyB = true;
        checkKeys();
      });
      btnB.addEventListener("mouseup", () => {
        keyB = false;
        checkKeys();
      });
      btnB.addEventListener("mouseleave", () => {
        keyB = false;
        checkKeys();
      });

      btnStart.addEventListener("click", () => {
        checkKeys();
        window.PyStart();
      });

      setBulb(false);
      window.addEventListener(
        "resize",
        () => {
          setBulb(bulb.classList.contains("on"));
        },
        { passive: true }
      );
    </script>
  </body>
</html>
<script>
  window.addEventListener("py:ready", () => {
    btnStart.innerHTML = "开始";
  });
</script>


```
# pyscript.toml
```toml
name = "Antigravity"
description = "A simple application to display an image and animate it based on the famous XKCD comic."

[files]
"./main.py" = ""
"./utils.py" = ""

```
# index.py
```py
from js import window
from pyodide.ffi import create_proxy 
import os
import sys
import main

# 简单加法函数
def py_main(selectedLogic,A, B):
    if(selectedLogic==None):
       return False
    match selectedLogic:
        case "and":
            return main.jing_and(A,B)
        case "or":
            return main.jing_or(A,B)
        case "not":
            return main.jing_not(A)
        case "nand":
            return main.jing_nand(A,B)
        case "xor":
            return main.jing_xor(A,B)
        case "xnor":
            return main.jing_xnor(A,B)
        case _:
            return  False
    C=main.main(A, B)
    return C

def py_start():
    main.start();
    return


window.PyMain = create_proxy(py_main);
window.PyStart = create_proxy(py_start);

print("根目录:", os.listdir("/"))
print("home:", os.listdir("/home"))
print("当前目录:", os.listdir("."))
```
# main.py
```py
from utils import window


# https://blog.csdn.net/qq_26074053/article/details/101909847
# 与运算（二输入）：A、B均为True（按下）时返回True，否则False
def jing_and(A, B):
    return A and B


# 或运算（二输入）：A、B任一为True（按下）时返回True，否则False
def jing_or(A, B):
    return A or B


# 非运算（单输入）：返回A的相反值（按下↔未按下）
def jing_not(A):
    return not A


# 与非运算（二输入）：先算A、B与运算，再取反
def jing_nand(A, B):
    return not (A and B)


# 异或运算（二输入）：A、B状态不同（一按一未按）时返回True，否则False
def jing_xor(A, B):
    return A^B


# 同或运算（二输入）：A、B状态相同（一按一按或一未按一按）时返回True，否则False
def jing_xnor(A, B):
    return A==B

# 主函数：接收按键A/B状态，默认返回或运算结果（控制灯泡亮灭：True=亮）
def main(A, B):
    return jing_or(A, B)



def start():
    print("AAAAAAAAAA")
    c= jing_and(1,1)
    window.alert(c)
    return

# 测试（可选）：验证函数逻辑
if __name__ == "__main__":
    # 测试输入：A按下（True），B未按下（False）
    A, B = True, False
    print(f"A={A}, B={B}")
    print(f"与：{jing_and(A,B)} | 或：{jing_or(A,B)} | 异或：{jing_xor(A,B)}")
```

# utils.py
```py
from js import window

window=window;
```