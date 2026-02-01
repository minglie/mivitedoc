# 🧵 嵌入式协程 `Protothread`

`Protothread` 是一个极简、可移植的协程模拟框架，适用于资源受限的嵌入式系统（如 MCU、RTOS 环境），通过宏展开方式实现任务状态保存与切换，支持延迟调度、事件通知、子协程嵌套等功能。

---

## 🌐 在线演示

👉 [Wokwi 在线演示](https://wokwi.com/projects/402006915303326721)


## ✨ 特性一览

| 特性              | 描述 |
|-------------------|------|
| 无堆栈切换        | 不依赖线程堆栈，使用局部变量与状态号保存执行点 |
| 纯 C++ 实现       | 支持虚函数、继承、调度控制 |
| 支持延迟调度      | 提供 `PT_DELAY_MS` 等延迟机制 |
| 支持多协程管理    | 支持多个协程并行注册调度 |
| 支持消息传递      | 提供输入/输出数据通道和事件通知 |
| 单线程 tick 驱动 | 调度通过 `OnTickAll()` 完成 |

---

## 🧱 协程结构示例

```cpp
class LEDFlasher : public Protothread {
    void Init() override {
        AT_println("Init");
    }

    bool Run() override {
        WHILE(1) {
            AT_println("LED Toggle");
            PT_DELAY_MS(1000);
        }
        PT_END();
    }
};

LEDFlasher led;
led.Start();
```

或使用函数型协程：

```cpp
void blinkTask(Protothread *pt) {
    LED_TOGGLE();
    PT_OS_DELAY_MS(10);
}
Protothread::Create(blinkTask);
```

---

## 🧾 宏接口一览

| 宏名                  | 功能说明 |
|-----------------------|----------|
| `PT_BEGIN()`          | 协程开始，必须写在 `Run()` 内部 |
| `PT_END()`            | 协程结束，自动停止 |
| `PT_DELAY(tick)`      | 延迟若干调度 tick |
| `PT_DELAY_MS(ms)`     | 延迟指定毫秒数（需定义 `PT_THREAD_TICK_MS`） |
| `PT_YIELD()`          | 主动让出时间片 |
| `PT_WAIT_UNTIL(cond)` | 等待条件满足 |
| `PT_SPAWN(child)`     | 嵌套运行子线程 |
| `PT_RESTART()`        | 重启当前线程 |
| `PT_EXIT()`           | 主动退出当前线程 |

---

## 🔧 核心类接口说明（`Protothread.h`）

```cpp
class Protothread {
public:
    // 生命周期
    virtual void Init();             // 初始化函数
    virtual bool Run();              // 协程主函数
    virtual void OnTick();           // 定时调用

    // 启动与调度
    unsigned int Start();            // 启动线程
    static void AllStart();          // 启动全部线程
    static void OnTickAll();         // 所有线程 OnTick
    static int PollAndRun(uint32_t tsMs); // 根据系统时间调度

    // 延迟与唤醒
    void PtOsDelay(uint32_t tick);
    void PtOsDelayMs(uint32_t ms);
    void PtOsDelayResume();

    // 通讯机制
    void SetOutData(uint32_t val);
    uint32_t GetInData();
    static void SetInData(Protothread *pt, uint32_t val);
    static bool PushIndata(Protothread *pt, uint32_t val);
    static uint32_t PopOutData(Protothread *pt);

    // 事件通知
    virtual void OnRecvNotify(Protothread *source, ProtothreadNotifyEvent evt);
    void Notify(Protothread *target, ProtothreadNotifyEvent evt);
};
```

---

## 🛠 多线程调度流程

```cpp
// 初始化全部协程（如构造函数自动注册）
Protothread::AllStart();

// 在主循环或定时器中调用调度
while (1) {
    Protothread::PollAndRun(get_ms()); // tsMs 为毫秒计时
}
```

每个协程会根据其 `m_delay` 值进行定时调度，`Run()` 逻辑只在 `delay==0` 时执行。

---

## 🧪 示例：Blink LED 每 1 秒

```cpp
class BlinkTask : public Protothread {
public:
    bool Run() override {
        WHILE(1) {
            LED_TOGGLE();
            PT_DELAY_MS(1000);
        }
        PT_END();
    }
};

BlinkTask task;
task.Start();
```

---

## 📦 移植指南

| 条目          | 建议说明 |
|---------------|----------|
| 编译要求      | C++11 及以上 |
| 定时基准      | 需定期调用 `Protothread::OnTickAll();` |
| 内存占用      | 每协程一个对象，无需多线程堆栈 |
| 延迟粒度控制  | 宏 `PT_THREAD_TICK_MS` 控制 tick 间隔（单位 ms） |
| 最大协程数    | 宏 `PT_MAX_THREAD_NUM` 控制同时运行线程上限 |

---

## 📁 关键文件结构

- `Protothread.h`：线程类定义 + 状态宏
- `Protothread.cpp`：调度器、线程调度实现

---

## 🔄 与 RTOS 比较

| 项目            | Protothread         | FreeRTOS / RT-Thread |
|-----------------|---------------------|-----------------------|
| 内存占用        | 极低，无需线程栈    | 每线程需分配堆栈     |
| 上下文切换      | 无系统上下文切换    | 支持完整抢占切换     |
| 延迟机制        | 基于 tick 判断      | 多种定时器机制       |
| 适用场景        | 轻量任务调度        | 复杂并发系统         |

---

> Protothread 提供类线程风格的逻辑表达方式，适用于中小型嵌入式系统中的状态控制、延时任务、有限状态机替代等场景。
