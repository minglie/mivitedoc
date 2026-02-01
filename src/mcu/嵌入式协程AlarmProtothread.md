>AlarmProtothread 在完整保留 [Protothread](https://blog.csdn.net/qq_26074053/article/details/152075556)
 原有 API 语义的前提下，对其时间模型进行了修改。
 [Protothread](https://blog.csdn.net/qq_26074053/article/details/152075556) 采用固定 1 ms tick 的协作式调度机制，本质上是一种低时间分辨率的时间片模型，难以准确描述或调度 µs 级事件。
AlarmProtothread 引入基于硬件 Alarm的精确定时机制，使协程调度不再依赖统一的毫秒节拍，而是由事件触发驱动，从而在保持轻量协程模型的同时，支持更高时间精度的异步控制逻辑。
# 例子
##  例1:   产生us精度的pwm
>  如果AlarmProtothread的Run函数不能一次执行完,则它不允许有栈变量
```c
/**
 * LedPt0的Run完整执行周期是80us
 * 大多数情况,遇到PT_开头的函数Run函数会直接返回
 * LedPt0执行流程
 * 20us
 * 翻转
 * 60us
 * 翻转
 */
class LedPt0 : public AlarmProtothread {
    void Init() {
        AT_println("LedPt0 init");
        ledp0cnt=0;
    }

    bool Run() {
        static uint32_t last_us=mi_hw_alarm_get_tick_us();
        static uint32_t now = mi_hw_alarm_get_tick_us();
        WHILE(1){
                PT_DELAY(20);
                gpio_xor_mask(1u << LED_PIN);
                PT_DELAY(60);
                gpio_xor_mask(1u << LED_PIN);
                now = mi_hw_alarm_get_tick_us();
                dif_led0_us=now-last_us;
                last_us=now;
            }
        PT_END();
    }
};
```
##   例2:  协程间通讯  
>在通信机制上，AlarmProtothread 同时提供了 两种相互独立的通信路径：
一是协程内部的 m_indata / m_outdata 数据通道，二是基于外部 EventBus 的事件通信机制。
m_indata / m_outdata 属于 协程本体的最小通信接口，用于描述单个协程在一次调度周期内的输入与输出状态，其生命周期与协程实例严格绑定。
EventBus 则是 完全独立于协程实现之外的事件分发系统，用于在不同协程或外部模块之间建立松耦合的消息传递关系。两者在语义、作用域与生命周期上彼此独立,可单独使用。
###  外部EventBus通讯
订阅发布---1ms发布一条消息
```c
#include "pico/stdlib.h"
#include "./lib/AtShell.h"
#include "./user/user_atshell.h"
#include "AlarmProtothread.h"
#include "./common/EventBus.h"

using namespace Common;

class LedPt0 : public AlarmProtothread {
    void Init() {
        AT_println("LedPt0 init");
    }
    bool Run() {
        static uint32_t cnt = 0;
        WHILE(1){
        			//延时1000us
                PT_DELAY(1000);
                cnt++;
                //发布消息
                EventPublish(EventType::PUSH_DATA, &cnt);
            }
        PT_END();
    }
};

class LedPt1 : public AlarmProtothread {
    void Init() {
        AT_println("LedPt1 init");
        //订阅
        EventSubscribe(EventType::PUSH_DATA, this, &LedPt1::OnRecvEvent);
    }

    void OnRecvEvent(EventType eventType, void* data){
        if(eventType==EventType::PUSH_DATA){
            uint32_t cnt = *(uint32_t*)data;
            //实际应是写队列,在主循环中处理
            AT_println("LedPt0 OnRecvEvent cnt=%d,%d",cnt, to_ms_since_boot(get_absolute_time()));
            return;
        }
    }

    bool Run() {
        PtOsDelay(20000);
        return true;
    }

};

LedPt0 ledPt0;
LedPt1 ledPt1;


static int ptTest(int argc, char** argv) {
    //下次进定时器中断的时间(us)
    AT_println("M_next_tick=%u", AlarmProtothread::M_next_tick);
    return 0;
}


/* ================= main ================= */
int main() {
    stdio_init_all();
    AT_SHELL_EXPORT(test02, "ptTest", ptTest);
    user_atShell_init();
    AlarmProtothread::PtInit();
    AlarmProtothread::AllStart();
    /* 主循环：统一发送 Shell 输出 */
    while (true) {
        user_atShell_loop();
        tight_loop_contents();
    }
}
```
###  m_indata/m_outdata 通讯
ledPt0 每隔1s发送一条消息给 ledPt1
```c
#include "pico/stdlib.h"
#include "./lib/AtShell.h"
#include "./user/user_atshell.h"
#include "AlarmProtothread.h"

class LedPt0 : public AlarmProtothread {
    void Init() {
        AT_println("LedPt0 init");
    }
    bool Run() {
        static uint32_t cnt = 0;
        WHILE(1){
                PT_DELAY(1000000);
                cnt++;
                //1s 给LedPt1发一条消息
                //协程索引的顺序就是协程变量声明的顺序
                AlarmProtothread::PushIndata(AlarmProtothread::M_pts[1], cnt);
            }
        PT_END();
    }
};

class LedPt1 : public AlarmProtothread {
    void Init() {
        AT_println("LedPt1 init");
    }
    bool Run() {
        WHILE(1) {
                //等待LedPt0发消息,m_indata为0,则直接返回
                PT_WAIT_UNTIL(GetInData());
                //PopInData()会清零m_indata
                AT_println("ledPt1 get data %d\n",PopInData());
                PT_DELAY(100);
            }
        PT_END();
    }


};

LedPt0 ledPt0;
LedPt1 ledPt1;


static int ptTest(int argc, char** argv) {
    //下次进定时器中断的时间(us)
    AT_println("M_next_tick=%u", AlarmProtothread::M_next_tick);
    return 0;
}


/* ================= main ================= */
int main() {
    stdio_init_all();
    AT_SHELL_EXPORT(test02, "ptTest", ptTest);
    user_atShell_init();
    AlarmProtothread::PtInit();
    AlarmProtothread::AllStart();
    /* 主循环：统一发送 Shell 输出 */
    while (true) {
        user_atShell_loop();
        tight_loop_contents();
    }
}
```
# 目录结构
```bash
PS D:\workspace\gitee\2\ming_picoman> tree /F
卷 新加卷 的文件夹 PATH 列表
卷序列号为 1E8A-2CFF
D:.
│  .gitignore
│  CMakeLists.txt
│  copy_uf2.bat
│  diagram.json
│  pico_sdk_import.cmake
│  README.md
│  wokwi.toml
│
└─src
    │  AlarmProtothread.cpp
    │  AlarmProtothread.h
    │  main.cpp
    │  mi_hw_alarm.cpp
    │  mi_hw_alarm.h
    │
    ├─common
    │      LogUtils.cpp
    │      LogUtils.h
    │      EventBus.h
    |      EventBus.cpp
    │
    ├─lib
    │      AtShell.cpp
    │      AtShell.h
    │
    └─user
            user_atshell.cpp
            user_atshell.h

```
# 源文件
## main.cpp
```c
#include "pico/stdlib.h"
#include "./lib/AtShell.h"
#include "./user/user_atshell.h"
#include "AlarmProtothread.h"
#include "mi_hw_alarm.h"

static uint32_t ledp0cnt=0;
static uint32_t dif_led0_us=0;
static uint32_t ledp1cnt=0;

const uint LED_PIN = 21;

/**
 * LedPt0 20us执行一次
 * LedPt1 2ms执行一次
 */
class LedPt0 : public AlarmProtothread {
    void Init() {
        AT_println("LedPt0 init");
        ledp0cnt=0;
    }
    bool Run() {
        static uint32_t last_us=mi_hw_alarm_get_tick_us();
        uint32_t now = mi_hw_alarm_get_tick_us();
       // PtOsDelayMs(1);
        //每隔20us执行一次
        PtOsDelay(20);
        ledp0cnt++;
        // 翻转 LED 电平
        gpio_xor_mask(1u << LED_PIN);
        dif_led0_us=now-last_us;
        last_us=now;
        return true;
    }
};

class LedPt1 : public AlarmProtothread {
    void Init() {
        AT_println("LedPt1 init");
        ledp1cnt=0;
    }
    bool Run() {
        //每隔2ms执行一次
        PtOsDelay(2000);
        ledp1cnt=ledp1cnt+1;
        return true;
    }
};

LedPt0 ledPt0;
LedPt1 ledPt1;


static int ptTest(int argc, char** argv) {
    AT_println("ptTest");
    //协程数量
    AT_println("M_nspt=%u",AlarmProtothread::M_nspt);
    //定时器us计时器
    AT_println("tick_us=%u",mi_hw_alarm_get_tick_us());
    //协程任务执行次数
    AT_println("ledp0cnt=%u",ledp0cnt);
    AT_println("dif_led0_us=%u",dif_led0_us);

    AT_println("ledp1cnt=%u",ledp1cnt);
    //进中断次数
    AT_println("M_int_count=%u",AlarmProtothread::M_int_count);
    //下次进定时器中断的时间(us)
    AT_println("M_next_tick=%u", AlarmProtothread::M_next_tick);
    AT_println("M_run_count=%u", AlarmProtothread::M_run_count);
    AT_println("M_unrun_count=%u", AlarmProtothread::M_unrun_count);
    return 0;
}


/* ================= main ================= */
int main() {
    stdio_init_all();
    gpio_init(LED_PIN);
    gpio_set_dir(LED_PIN, GPIO_OUT);
    gpio_put(LED_PIN, 0);   // 初始为低电平
    AT_SHELL_EXPORT(test02, "ptTest", ptTest);
    user_atShell_init();
    AlarmProtothread::PtInit();
    AlarmProtothread::AllStart();
    /* 主循环：统一发送 Shell 输出 */
    while (true) {
        user_atShell_loop();
        tight_loop_contents();
    }
}
```
## AlarmProtothread.h
```c
#ifndef __AlarmProtothread_H__
#define __AlarmProtothread_H__
#include "stdint.h"
#define  PT_MAX_THREAD_NUM      5
#define  PT_THREAD_TICK_MS      10
/**
class LEDFlasher : public AlarmProtothread
{
    void Init(){
        AT_println("dd");
    }
    bool Run() {
        WHILE(1){
            AT_println("dd");
            PT_DELAY_MS(1000);
        }
        PT_END();
    }

    bool _Run() {
        AT_println("d33d");
        PtOsDelayMs(1000);
        return true;
    }
};

 void let_test(AlarmProtothread * pt) {
    LED_TOGGLE();
    PT_OS_DELAY_MS(10);
}

AlarmProtothread::Create(let_test);
LEDFlasher ledFlasher;
ledFlasher.Start();
**/


typedef struct {
    uint32_t	 code;
    uint32_t	 ms;
    void *       args;
} AlarmProtothreadNotifyEvent;


class AlarmProtothread;
typedef  void (*PtRunFun)(AlarmProtothread * pt);
class AlarmProtothread
{
public:
    static AlarmProtothread* M_pts[PT_MAX_THREAD_NUM];
    //for start
    static int M_nspt;
    static int M_npt;
    //for cycle
    static uint32_t M_now_tick;
    static uint32_t M_next_tick;
    //中断次数
    static uint32_t M_int_count;
    static uint32_t M_run_count;
    static uint32_t M_unrun_count;
    AlarmProtothread();
    virtual ~AlarmProtothread() { }
    virtual const char* Name(void) 	{ return("");}
    void Restart() { _ptLine = 0; }
    void Stop() { _ptLine = LineNumberInvalid; }
    bool IsRunning() { return _ptLine != LineNumberInvalid; }
    void PtOsDelay(uint32_t tick);
    void PtOsDelayMs(uint32_t ms);
    void PtOsDelayResume();
    virtual void Init();
    virtual bool Run();
    virtual bool IsContinueRun();
    virtual unsigned int Start();
    virtual void   Notify(AlarmProtothread * target,AlarmProtothreadNotifyEvent evt);
    virtual void   OnRecvNotify(AlarmProtothread * source,AlarmProtothreadNotifyEvent evt);
    static  void   OnRecvNotify(AlarmProtothread * source, AlarmProtothread * target,AlarmProtothreadNotifyEvent evt);
    static void  AllStart();
    static void  PtInit();
    static AlarmProtothread* Create(PtRunFun run);
protected:
    PtRunFun m_run;
    unsigned int  m_id;
    //下次运行时刻
    uint32_t m_delay;
    typedef unsigned short LineNumber;
    static const LineNumber LineNumberInvalid = (LineNumber)(-1);
    LineNumber _ptLine;
public:
    uint32_t  m_state;
    uint32_t  m_indata;
    uint32_t  m_outdata;
    uint32_t GetDelay();
    uint32_t GetInData();
    void SetOutData(uint32_t outdata);
    uint32_t PopInData();
    bool  PushOutData(uint32_t outdata);
    static void SetInData(AlarmProtothread * pt,uint32_t indata);
    static bool PushIndata(AlarmProtothread * pt,uint32_t indata);
    static uint32_t GetOutData(AlarmProtothread * pt);
    static uint32_t  PopOutData(AlarmProtothread * pt);
};

#define PT_BEGIN() bool ptYielded = true; (void) ptYielded; switch (_ptLine) { case 0:
#define PT_END() default: ; } Stop(); return false;
#define PT_WAIT_UNTIL(condition) \
    do { _ptLine = __LINE__; case __LINE__: \
    if (!(condition)) return true; } while (0)
#define PT_WAIT_WHILE(condition) PT_WAIT_UNTIL(!(condition))
#define PT_WAIT_THREAD(child) PT_WAIT_WHILE((child).Run())
#define PT_SPAWN(child) \
    do { (child).Restart(); PT_WAIT_THREAD(child); } while (0)

#define PT_RESTART() do { Restart(); return true; } while (0)

#define PT_EXIT() do { Stop(); return false; } while (0)

#define PT_YIELD() \
    do { ptYielded = false; _ptLine = __LINE__; case __LINE__: \
    if (!ptYielded) return true; } while (0)

#define PT_YIELD_UNTIL(condition) \
    do { ptYielded = false; _ptLine = __LINE__; case __LINE__: \
    if (!ptYielded || !(condition)) return true; } while (0)

#define PT_DELAY(v)				\
  do {						\
    PtOsDelay(v);			\
    PT_WAIT_UNTIL(IsContinueRun());		\
  } while(0)

#define PT_DELAY_MS(v)				\
  do {						\
    PtOsDelayMs(v);       \
    PT_WAIT_UNTIL(IsContinueRun());	\
  } while(0)

#define WHILE(a)   PT_BEGIN(); \
  while(1)

#define PT_OS_DELAY(tick)        pt->PtOsDelay(tick)
#define PT_OS_DELAY_MS(ms)       pt->PtOsDelayMs(ms)
//free time slice
#define PT_FREE_TIME_SLICE(tsMs)   PT_THREAD_TICK_MS-(tsMs-AlarmProtothread::M_ms_tick)
#endif
```
## AlarmProtothread.cpp
```c
#include "AlarmProtothread.h"
#include "mi_hw_alarm.h"

int  AlarmProtothread::M_nspt = 0;
int  AlarmProtothread::M_npt = 0;
//中断执行次数
uint32_t  AlarmProtothread::M_int_count=0;
uint32_t  AlarmProtothread::M_now_tick = 0;
uint32_t  AlarmProtothread::M_next_tick =0;
uint32_t AlarmProtothread::M_run_count=0;
uint32_t AlarmProtothread::M_unrun_count=0;

AlarmProtothread * AlarmProtothread::M_pts[PT_MAX_THREAD_NUM];

static mi_hw_alarm_t g_alarm;

void alarm_cb(void *arg)
{
    uint32_t now = mi_hw_alarm_get_tick_us();
    uint32_t minDelay = UINT32_MAX;
    AlarmProtothread::M_now_tick = now;
    for (int i = 0; i < AlarmProtothread::M_npt; i++) {
        AlarmProtothread *pt = AlarmProtothread::M_pts[i];
        /* 到期就运行
         * Run()重新设置自己的m_delay
         */
        AlarmProtothread::M_run_count=0;
        if ((int32_t)(now - pt->GetDelay()) >= 0) {
            pt->Run();
        }
        /* 使用 Run() 之后的 delay 参与下一次调度 */
        uint32_t d = pt->GetDelay();
        if (d < minDelay) {
            minDelay = d;
        }
    }
    constexpr uint32_t MIN_IRQ_GAP_US=1;// 安全最小间隔
    uint32_t next;
    if (minDelay == UINT32_MAX) {
        /* 没有任何线程在等待 */
        next = now + MIN_IRQ_GAP_US;
    }
    else if (minDelay <= now + MIN_IRQ_GAP_US) {
        /* 防止 schedule 到 now 或极近未来 */
        next = now + MIN_IRQ_GAP_US;
    }
    else {
        next = minDelay;
    }
    AlarmProtothread::M_int_count++;
    AlarmProtothread::M_next_tick=next;
    mi_hw_alarm_schedule_at(next);
}

AlarmProtothread::AlarmProtothread(): _ptLine(0){
    m_delay = 0;
    m_indata=0;
    m_outdata=0;
    m_state=0;
    m_run=0;
    M_pts[AlarmProtothread::M_nspt++]= this;
}

void AlarmProtothread::PtOsDelay(uint32_t tick) {
    m_delay=mi_hw_alarm_get_tick_us()+ tick;
}

void AlarmProtothread::PtOsDelayMs(uint32_t ms) {
    m_delay = mi_hw_alarm_get_tick_us() + ms * 1000;
}

bool AlarmProtothread::IsContinueRun(){
   if( (int32_t)(AlarmProtothread::M_now_tick  - m_delay) >= 0) {
       return true;
   }
   return false;
}
void AlarmProtothread::PtOsDelayResume() {
    m_delay=0;
}
void AlarmProtothread::PtInit(){
    mi_hw_alarm_init(&g_alarm);
}
void AlarmProtothread::Init() {

}

uint32_t AlarmProtothread::GetDelay(){
    return m_delay;
}

uint32_t AlarmProtothread::GetInData(){
    return m_indata;
}
void AlarmProtothread::SetInData(AlarmProtothread * pt,uint32_t indata){
    pt->m_indata=indata;
}

uint32_t AlarmProtothread::PopInData(){
    uint32_t v = m_indata;
    m_indata = 0;
    return v;
}

bool AlarmProtothread::PushIndata(AlarmProtothread * pt,uint32_t indata){
    if (pt->m_indata == 0) {
        pt->m_indata = indata;
        return true;
    }
    return false;
}

uint32_t AlarmProtothread::GetOutData(AlarmProtothread * pt){
    return pt->m_outdata;
}

void AlarmProtothread::SetOutData(uint32_t outdata){
    m_outdata=outdata;
}

uint32_t  AlarmProtothread::PopOutData(AlarmProtothread * pt){
    uint32_t v=pt->m_outdata;
    pt->m_outdata=0;
    return v;
}

bool  AlarmProtothread::PushOutData(uint32_t outdata){
    if(m_outdata==0) {
        m_outdata=outdata;
        return true;
    }
    return false;
}

unsigned int AlarmProtothread::Start() {
    this->Init();
    m_id=AlarmProtothread::M_npt++;
    M_pts[m_id]= this;
    return m_id;
}

bool AlarmProtothread::Run() {
    if(m_run!=0){
        m_run(this);
    }
    return true;
}

AlarmProtothread* AlarmProtothread::Create(PtRunFun run) {
    AlarmProtothread* pt= new AlarmProtothread();
    pt->m_run=run;
    return pt;
}



void AlarmProtothread::AllStart() {
    for (int i=0;i<M_nspt;i++){
        M_pts[i]->Start();
    }
    /* 第一次触发 */
    mi_hw_alarm_attach(&g_alarm, alarm_cb, 0);
    mi_hw_alarm_enable(&g_alarm);
    mi_hw_alarm_schedule_after_us(1000);
}




void  AlarmProtothread::Notify(AlarmProtothread * target,AlarmProtothreadNotifyEvent evt){
    AlarmProtothread::OnRecvNotify(this,target,evt);
    if(target== nullptr){
        for(int i=0;i<AlarmProtothread::M_npt;i++){
            AlarmProtothread::M_pts[i]->OnRecvNotify(target,evt);
        }
        return;
    } else{
        target->OnRecvNotify(target,evt);
    }
}


void  AlarmProtothread::OnRecvNotify(AlarmProtothread * source,AlarmProtothreadNotifyEvent evt){
    // nothing
}

void  AlarmProtothread::OnRecvNotify(AlarmProtothread * source, AlarmProtothread * target,AlarmProtothreadNotifyEvent evt){
    // nothing
}
```

## mi_hw_alarm.h
```c
#pragma once
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef void (*mi_hw_alarm_cb_t)(void *user);

typedef struct {
    mi_hw_alarm_cb_t cb;
    void *user_data;
} mi_hw_alarm_t;

void mi_hw_alarm_init(mi_hw_alarm_t *alarm);
void mi_hw_alarm_attach(mi_hw_alarm_t *alarm,
                        mi_hw_alarm_cb_t cb,
                        void *user_data);
void mi_hw_alarm_enable(mi_hw_alarm_t *alarm);
void mi_hw_alarm_disable(void);

void mi_hw_alarm_schedule_at(uint32_t abs_us);
void mi_hw_alarm_schedule_after_us(uint32_t delta_us);

uint32_t mi_hw_alarm_get_tick_us(void);

#ifdef __cplusplus
}
#endif

```

## mi_hw_alarm.cpp
```c
#include "mi_hw_alarm.h"
#include "hardware/timer.h"
#include "hardware/irq.h"
#define ALARM_NUM   0
#define ALARM_MASK  (1u << ALARM_NUM)

/* 只维护一个 alarm 实例 */
static mi_hw_alarm_t *s_alarm = NULL;

/* ============================================================
 * IRQ Handler
 * ============================================================ */
static void __isr timer_irq_handler(void)
{
    /* 清 pending */
    hw_clear_bits(&timer_hw->intr, ALARM_MASK);

    /* 调用用户回调 */
    if (s_alarm && s_alarm->cb) {
        s_alarm->cb(s_alarm->user_data);
    }
}

/* ============================================================
 * 初始化
 * ============================================================ */
void mi_hw_alarm_init(mi_hw_alarm_t *alarm)
{
    if (!alarm) return;

    s_alarm = alarm;
    alarm->cb        = NULL;
    alarm->user_data = NULL;
}

/* ============================================================
 * 绑定回调
 * ============================================================ */
void mi_hw_alarm_attach(mi_hw_alarm_t *alarm,
                        mi_hw_alarm_cb_t cb,
                        void *user_data)
{
    if (!alarm) return;

    alarm->cb        = cb;
    alarm->user_data = user_data;
}

/* ============================================================
 * 启用 alarm
 * ============================================================ */
void mi_hw_alarm_enable(mi_hw_alarm_t *alarm)
{
    (void)alarm;

    /* 先关 IRQ，防止配置过程触发 */
    irq_set_enabled(TIMER_IRQ_0, false);

    /* 清 pending，避免“立刻进中断” */
    hw_clear_bits(&timer_hw->intr, ALARM_MASK);

    /* 独占 IRQ */
    irq_set_exclusive_handler(TIMER_IRQ_0, timer_irq_handler);

    /* 只使能指定 alarm */
    timer_hw->inte |= ALARM_MASK;

    irq_set_enabled(TIMER_IRQ_0, true);
}

/* ============================================================
 * 关闭 alarm
 * ============================================================ */
void mi_hw_alarm_disable(void)
{
    irq_set_enabled(TIMER_IRQ_0, false);

    timer_hw->inte &= ~ALARM_MASK;

    /* 可选：清一次 pending，确保干净 */
    hw_clear_bits(&timer_hw->intr, ALARM_MASK);
}


static inline bool time_after_eq_u32(uint32_t a, uint32_t b)
{
    return (int32_t)(a - b) >= 0;
}

/* ============================================================
 * 设置绝对时间（μs since boot）
 * RP2040 alarm 只有 32bit
 * ============================================================ */
void mi_hw_alarm_schedule_at(uint32_t abs_us)
{
    uint32_t now = timer_hw->timerawl;
    if (time_after_eq_u32(now + 1, abs_us)) {
        abs_us = now + 1;
    }
    timer_hw->alarm[ALARM_NUM] = abs_us;
}

/* ============================================================
 * 相对延时
 * ============================================================ */
void mi_hw_alarm_schedule_after_us(uint32_t delta_us)
{
    uint32_t now = timer_hw->timerawl;
    /* 防止 0 或极小延迟造成 IRQ 风暴 */
    if (delta_us < 10)
        delta_us = 10;

    timer_hw->alarm[ALARM_NUM] = now + delta_us;
}

/* ============================================================
 * 获取当前 tick（μs）
 * ============================================================ */
uint32_t mi_hw_alarm_get_tick_us(void)
{
    return timer_hw->timerawl;
}


```
## user_atshell.h
```c
//
// Created by PC on 2025/12/25.
//

#ifndef PIPO_PROJECT_USER_ATSHELL_H
#define PIPO_PROJECT_USER_ATSHELL_H


void user_atShell_init();
void user_atShell_loop();

#endif //PIPO_PROJECT_USER_ATSHELL_H

```
## user_atshell.cpp
```c
#include "pico/stdlib.h"
#include "hardware/uart.h"
#include "hardware/irq.h"
#include "../lib/AtShell.h"
#include <cstdint>

/* ================= UART 配置 ================= */
#define UART_ID        uart0
#define UART_BAUDRATE  115200
#define UART_TX_PIN    0
#define UART_RX_PIN    1

/* ================= TX 缓冲区类 ================= */
class UartTxBuffer {
public:
    explicit UartTxBuffer(size_t size)
            : size_(size), head_(0), tail_(0)
    {
        buf_ = new uint8_t[size_];
    }

    ~UartTxBuffer() {
        delete[] buf_;
    }

    // 写入缓冲区（返回写入字节数）
    size_t write(const uint8_t* data, size_t len) {
        size_t written = 0;
        for (size_t i = 0; i < len; i++) {
            if (isFull()) break;
            buf_[head_] = data[i];
            head_ = (head_ + 1) % size_;
            written++;
        }
        return written;
    }

    // 从缓冲区读取一个字节
    bool read(uint8_t& data) {
        if (isEmpty()) return false;
        data = buf_[tail_];
        tail_ = (tail_ + 1) % size_;
        return true;
    }

    bool isEmpty() const { return head_ == tail_; }
    bool isFull()  const { return (head_ + 1) % size_ == tail_; }

private:
    uint8_t* buf_;
    size_t size_;
    volatile size_t head_;
    volatile size_t tail_;
};

/* ================= 全局对象 ================= */
UartTxBuffer shellTxBuffer(512);

/* ================= BSP 写接口(这个方法是正常是在中断里用的) ================= */
int Bsp_shell_write(uint8_t* buf, uint32_t len, uint32_t timeout) {
    (void)timeout;
    return shellTxBuffer.write(buf, len);
}



/* ================= UART RX 中断 ================= */
void on_uart_rx() {
    while (uart_is_readable(UART_ID)) {
        uint8_t ch = uart_getc(UART_ID);
        at_import(&ch, 1, 0);
    }
}

void user_atShell_init(){
    /* UART 初始化 */
    uart_init(UART_ID, UART_BAUDRATE);
    gpio_set_function(UART_TX_PIN, GPIO_FUNC_UART);
    gpio_set_function(UART_RX_PIN, GPIO_FUNC_UART);
    uart_set_hw_flow(UART_ID, false, false);
    uart_set_format(UART_ID, 8, 1, UART_PARITY_NONE);
    uart_set_fifo_enabled(UART_ID, true);

    /* UART RX 中断 */
    irq_set_exclusive_handler(UART0_IRQ, on_uart_rx);
    irq_set_enabled(UART0_IRQ, true);
    uart_set_irq_enables(UART_ID, true, false);
    /* AtShell 初始化 */
    at_init(Bsp_shell_write);
    at_show_version();
}

/* ================= main ================= */
void user_atShell_loop() {
    uint8_t ch;
    while (!shellTxBuffer.isEmpty() && uart_is_writable(UART_ID)) {
        if (shellTxBuffer.read(ch))
            uart_putc_raw(UART_ID, ch);
    }
    tight_loop_contents();
}
```
## AtShell.h
```c
/*
 CON_AT_MSH=0: AT模式: 配合 Xmodem1K 更新固件
=>: AT+fun(a,b,c)\r\n
CON_AT_MSH=1: MSH模式: 调试
=>: fun a b \n
**/

#ifndef _AT_SHELL_H
#define _AT_SHELL_H

#include "stdint.h"
#include "string.h"
#include "stdbool.h"

//模式  0:AT    1:MSH
#define  CON_AT_MSH 1
//机器Hex通讯 AT+c(55,01 02)
#define  CON_AT_USE_CALLBACK 1
//数据监控
#define  CON_AT_USE_CycleMonitorData 1
//监控总数量
#define CON_CYCLE_MONITOR_DATA_PACK_NUM  10

//方法数
#define  CON_AT_METHOD_NUM     10//  10
#define  FINSH_CMD_SIZE       20  //20             //最长命令尺寸
#define  RT_FINSH_ARG_MAX      3// 6        //参数个数
#define  FINSH_HISTORY_LINES    3       //历史命令条数
#define  CON_AT_R_SUCCESS   0    // 成功
#define  CON_AT_R_ERR_ARG   1    // 参数错误
#define  CON_AT_R_ERR_NO_CMD   2  //无此命令
#define  CON_AT_R_ERR_EXEC_FAIL 3  //执行失败
#define  CON_AT_WRITE_TIMEOUT   100
//一种异步发送的实现
#define  CON_AT_USE_EXPORT    0
#define  CON_AT_OUT_BUF_SIZE     200
#define CON_METHOD_NAME_SIZE 8
#define CON_HELP_INFO_SIZE  20


typedef int (*ATServerFun)(int argc, char **argv);
typedef int (*ATWriteFun)(uint8_t *buf, uint32_t len,uint32_t timeout);

#if CON_AT_USE_CALLBACK == 1
typedef void (*ATCallBackFun)(uint32_t code, uint8_t *buf, uint32_t len);
#endif

typedef struct {
    char methodName[CON_METHOD_NAME_SIZE];
    char helpInfo[CON_HELP_INFO_SIZE];
    ATServerFun atFun;
    void *userData;
} AT_CMD_ENTRY_TypeDef;


typedef struct {
    char     tag[CON_CYCLE_MONITOR_DATA_PACK_NUM][10];
    uint8_t  buffer[CON_CYCLE_MONITOR_DATA_PACK_NUM][100];
    uint8_t  bufferLen[CON_CYCLE_MONITOR_DATA_PACK_NUM];
    uint8_t  curInx;
} AT_CycleMonitorDataTypeDef;
#ifdef __cplusplus


class AtShell {
private:
    AT_CMD_ENTRY_TypeDef *m_cmdList;
    uint32_t m_cmdSize;
    int m_cmdNum;
    char m_buf[FINSH_CMD_SIZE];
    uint32_t m_bufLen;
    uint32_t m_importMs;
    uint32_t m_lock;
    int m_argc;
    char m_method[CON_METHOD_NAME_SIZE];
    char *m_argv[RT_FINSH_ARG_MAX];
    ATWriteFun m_initWriteFun;
    ATWriteFun m_writeFun;
    virtual bool Parse(char *str);

public:
    AtShell();
    virtual ~AtShell();
    AT_CMD_ENTRY_TypeDef *ctx;
#if CON_AT_USE_CALLBACK == 1
    ATCallBackFun m_atCallBackFun;
#endif
#if CON_AT_USE_EXPORT == 1
    char m_out_buf[CON_AT_OUT_BUF_SIZE];
    uint32_t m_out_bufLen;
    virtual void Export();
#endif

    virtual void Init(ATWriteFun writeFun);
    virtual void SetWriteFun(ATWriteFun writeFun);
    virtual void ResetWriteFun();
    virtual char *GetBuf() { return m_buf; };
    virtual int GetCmdNum() { return m_cmdNum; };
    virtual bool Regist(AT_CMD_ENTRY_TypeDef cmd);
    virtual bool Regist(AT_CMD_ENTRY_TypeDef *cmdList, int cmdLen);
    virtual bool Exec(char *str);
    virtual int Import(uint8_t *buf, uint32_t len, uint32_t ms = 0);
    virtual int ImportForAt(uint8_t *buf, uint32_t len, uint32_t ms = 0);
    virtual int  AsyncPrintf(const char *format, ...);
    virtual int  Printf(const char *format, ...);
    virtual int Output(long nLevel, const char *pszFileName, int nLineNo, const char *pszFmt, ...);
    virtual int PrintfBs(uint8_t *buf, uint32_t len);
    virtual int Write(uint8_t *buf, uint32_t len,uint32_t timeout);
    virtual int Write(uint8_t data);
    virtual void AtCall(uint32_t code, uint8_t *buf, uint32_t len);
    virtual int Reply(uint8_t errCode);
    virtual void ShowVersion();
#if CON_AT_USE_CycleMonitorData==1
    AT_CycleMonitorDataTypeDef m_monitorData;
    virtual int MonitorDataPush(const char *tag, uint8_t * buffer, int len);
    virtual int MonitorDataViewInfo();
#endif

#if CON_AT_MSH == 1
    uint16_t m_currentHistory;
    uint16_t m_historyCount;
    char m_cmdHistory[FINSH_HISTORY_LINES][FINSH_CMD_SIZE];
    int m_stat;
    char m_line[FINSH_CMD_SIZE];
    uint8_t m_linePosition;
    uint8_t m_lineCurpos;

    virtual int ImportForMsh(uint8_t *buf, uint32_t len, uint32_t ms = 0);
    virtual void MshAddChar(char ch);
    virtual void ShellPushHistory();
    virtual void ShellAutoComplete(char *prefix);
    virtual void MshAutoComplete(char *prefix);
    virtual bool ShellHandleHistory();
#endif
};

extern AtShell g_atShell;

enum AT_LOG_LEVEL {
    AT_LOG_LEVEL_TRACE,
    AT_LOG_LEVEL_DEBUG,
    AT_LOG_LEVEL_INFO,
    AT_LOG_LEVEL_WARNING,
    AT_LOG_LEVEL_ERROR
};

extern AtShell g_atShell;

#define AT_m_buf  g_atShell.GetBuf()

#if CON_AT_MSH == 1
#define AT_FUN(fun)    #fun
#else
#define AT_FUN(fun)    "AT+"#fun
#endif
#define CONCAT(a, b) a ## b
#define AT_FILE_NAME(x)   strrchr(x,'\\')?strrchr(x,'\\')+1:x
#define AT_info(...)      g_atShell.Output(AT_LOG_LEVEL_INFO,__func__, __LINE__,__VA_ARGS__)
#define AT_debug(...)     g_atShell.Output(AT_LOG_LEVEL_DEBUG,AT_FILE_NAME(__FILE__), __LINE__,__VA_ARGS__)
#define AT_debug1(...)    g_atShell.Output(AT_LOG_LEVEL_DEBUG,__func__,__LINE__,__VA_ARGS__)
#define AT_error(...)     g_atShell.Output(AT_LOG_LEVEL_ERROR,__PRETTY_FUNCTION__,__LINE__,__VA_ARGS__)
#define AT_printf(format, ...)  g_atShell.Printf(format,##__VA_ARGS__)
#define AT_println(format, ...)  g_atShell.Printf(format,##__VA_ARGS__);AT_printf("\r\n")
#define AT_aprintf(format, ...)    g_atShell.AsyncPrintf(format,##__VA_ARGS__)
#define AT_aprintln(format, ...)  g_atShell.AsyncPrintf(format,##__VA_ARGS__);AT_aprintf("\r\n")

#define AT_printfBs(buf, len)  g_atShell.PrintfBs(buf,len)
#define rt_kprintf                  AT_printf
#define ATX_info(w, ...)             g_atShell.SetWriteFun(w);AT_info(__VA_ARGS__);g_atShell.ResetWriteFun();
#define ATX_debug(w, ...)            g_atShell.SetWriteFun(w);AT_debug(__VA_ARGS__);g_atShell.ResetWriteFun();
#define ATX_error(w, ...)            g_atShell.SetWriteFun(w);AT_error(__VA_ARGS__);g_atShell.ResetWriteFun();
#define ATX_printf(w, ...)           g_atShell.SetWriteFun(w);AT_printf(__VA_ARGS__);g_atShell.ResetWriteFun();
#define ATX_printfBs(w, buf, len)     g_atShell.SetWriteFun(w);g_atShell.PrintfBs(buf,len);g_atShell.ResetWriteFun();
#endif

#if CON_AT_USE_CALLBACK == 1
#define AT_SET_CALL_BACK(fun)          g_atShell.m_atCallBackFun=fun
#endif


#define AT_SHELL_EXPORT(cmdName, desc, fun, ...)  AT_CMD_ENTRY_TypeDef fun##entrycmd={AT_FUN(cmdName),#desc,fun,__VA_ARGS__}; at_register(fun##entrycmd)
#define AT_EXEC(cmd)    g_atShell.Exec(cmd)


#ifdef __cplusplus
extern "C" {
#endif
void at_init(ATWriteFun writeFun);
int  at_import(uint8_t *buf, uint32_t len, uint32_t ms);
#if CON_AT_USE_EXPORT == 1
void  at_export();
#endif
#if CON_AT_USE_CycleMonitorData == 1
void  at_monitor_init();
void  at_monitor_push(const char *tag, uint8_t * buffer, int len);
void  at_monitor_viewInfo();
#endif
bool at_try_import(uint8_t *buf, uint32_t len, uint32_t ms);
bool at_register(AT_CMD_ENTRY_TypeDef cmd);
bool at_register_many(AT_CMD_ENTRY_TypeDef *cmdList, int cmdLen);
int  at_write(uint8_t *buf, uint32_t len,uint32_t timeout);
int  at_awrite(uint8_t *buf, uint32_t len);
int  at_printf(const char *format, ...);
int  at_aprintf(const char *format, ...);
int  at_reply(uint8_t errCode);
int  at_hexStringToByteArray(const char *hexStr, unsigned char *bs);
long at_str_to_int(char* str);
void at_show_version();
#ifdef __cplusplus
}
#endif

#endif





/*
*
#include <iostream>
#include "AtShell.h"
#include "stdio.h"
int shell_write(uint8_t* buf, uint32_t len,uint32_t timeout) {
	return  printf("%s", buf);
}
static int test01(int argc, char** argv) {
	AT_printf("argc %d:\r\n", argc);
	return 0;
}
int main() {
	at_init(shell_write);
	AT_SHELL_EXPORT(test01, "", test01);
	while (1) {
		char a = getchar();
		uint8_t bs[1] = { a };
		at_import(bs, 1, 0);
	}
	return 0;
}
**/
```
## AtShell.cpp
```c
#include "AtShell.h"
#include "stdio.h"
#include "stdlib.h"
#include "stdarg.h"
#include "string.h"
#include <ctype.h>
#include <limits.h>

#define CON_AT_DELIMITER   "(,)"
#define CON_AT_DELIMITER_BANK   " "
#define FINSH_PROMPT        "$:"

static int __help(int argc, char **argv);


AtShell g_atShell;


#if CON_AT_MSH == 1

static int __clean(int argc, char **argv) {
    AT_printf("\033c");
    return 0;
}

#else
static int __at(int argc, char** argv) {
    at_reply(CON_AT_R_SUCCESS);
    return 0;
}
#endif


#if CON_AT_USE_CALLBACK == 1
static int __call(int argc, char **argv) {
    if (argc <= 2) {
        return 0;
    }
    char *hexStr = argv[2];
    uint32_t code = strtol(argv[1], NULL, 16);
    char *bs = g_atShell.GetBuf();
    int len = at_hexStringToByteArray(hexStr, (unsigned char *) bs);
    if (g_atShell.m_atCallBackFun != NULL) {
        g_atShell.m_atCallBackFun(code, (uint8_t *) bs, len);
    }
    return 0;
}

#endif

static AT_CMD_ENTRY_TypeDef s_ap_cmd_entry[CON_AT_METHOD_NUM] = {
        {AT_FUN(help), "list cmd", __help, 0},
#if CON_AT_USE_CALLBACK == 1
        {AT_FUN(c), "(55,01 02)", __call, 0},
#endif
#if CON_AT_MSH == 1
        {"clean", "clean screen", __clean, 0},
#else
        { "AT","",__at, 0 },
#endif
};

static int __help(int argc, char **argv) {
    int cmdInx = g_atShell.GetCmdNum();
    AT_printf("AtShell commands:\r\n");
    for (int i = 0; i < cmdInx; i++) {
        AT_printf("%2d.%-20s - %s \r\n", i, s_ap_cmd_entry[i].methodName, s_ap_cmd_entry[i].helpInfo);
    }
    return 0;
}


AtShell::AtShell() {
    m_cmdList = s_ap_cmd_entry;
    m_cmdSize = CON_AT_METHOD_NUM;
    m_cmdNum = 0;
    m_writeFun = NULL;
    m_bufLen = 0;
    m_importMs = 0;
#if CON_AT_USE_EXPORT == 1
    m_out_bufLen=0;
#endif
    for (size_t i = 0; i < m_cmdSize; i++) {
        if (m_cmdList[i].atFun == NULL) {
            m_cmdNum = i;
            break;
        }
    }
}


AtShell::~AtShell() {

}


bool AtShell::Regist(AT_CMD_ENTRY_TypeDef cmd) {
    if (m_cmdNum >= CON_AT_METHOD_NUM) {
        return false;
    }
    m_cmdList[m_cmdNum] = cmd;
    m_cmdNum++;
    return true;
}

bool AtShell::Regist(AT_CMD_ENTRY_TypeDef *cmdList, int cmdLen) {
    if (m_cmdNum + cmdLen > CON_AT_METHOD_NUM) {
        return false;
    }
    for (int i = 0; i < cmdLen; i++) {
        AtShell::Regist(cmdList[i]);
    }
    return true;
}

void AtShell::Init(ATWriteFun writeFun) {
    m_writeFun = writeFun;
    m_initWriteFun = writeFun;
}


void AtShell::SetWriteFun(ATWriteFun writeFun) {
    m_writeFun = writeFun;
}

void AtShell::ResetWriteFun() {
    m_writeFun = m_initWriteFun;
}

bool AtShell::Parse(char *str) {
    if (m_buf != str) {
        strcpy(m_buf, str);
    }
    m_argv[0] = m_buf;
    char *token;
    char delimiter[16] = CON_AT_DELIMITER;
    if (strstr((char *) str, "AT") != (char *) str) {
        sprintf(delimiter, CON_AT_DELIMITER_BANK);
    }
    token = strtok(m_buf, delimiter);
    int i = 0;
    while (token != NULL) {
        if (i == 0) {
            snprintf(m_method, sizeof(m_method), "%s", token);
            snprintf(m_argv[0], sizeof(m_method), "%s", token);
            m_argv[1] = &m_buf[strlen(m_argv[0]) + 1];
        } else if (i < RT_FINSH_ARG_MAX) {
            sprintf(m_argv[i], "%s", token);
            m_argv[i + 1] = m_argv[i] + strlen(m_argv[i]) + 1;
        }
        token = strtok(NULL, delimiter);
        i++;
        m_argc = i;
    }
    return true;
}


bool AtShell::Exec(char *str) {
    m_lock = 1;
    bool r = Parse(str);
    if (r == false) {
        m_lock = 0;
        return r;
    }
    bool cmd_ret = false;
    //methodName match
    for (int i = 0; i < m_cmdNum; i++) {
        if (strcmp(m_cmdList[i].methodName, m_method) == 0) {
            this->ctx = &m_cmdList[i];
            m_cmdList[i].atFun(m_argc, m_argv);
            cmd_ret = true;
            break;
        }
    }
    //inx match
    if (!cmd_ret) {
        int inx = strtol(m_method, NULL, 10);
        if ('0' <= m_method[0] && m_method[0] <= '9' && inx < m_cmdNum) {
            this->ctx = &m_cmdList[inx];
            m_cmdList[inx].atFun(m_argc, m_argv);
            cmd_ret = true;
        }
    }
    if (!cmd_ret) {
        char *tcmd;
        tcmd = str;
        while (*tcmd != ' ' && *tcmd != '\0') {
            tcmd++;
        }
        *tcmd = '\0';
        this->Printf("%s: command not found.\n", str);
    }
    m_bufLen = 0;
    m_lock = 0;
    return cmd_ret;
}

int AtShell::Import(uint8_t *buf, uint32_t len, uint32_t ms) {
#if CON_AT_MSH == 1
    return this->ImportForMsh(buf, len, ms);
#else
    return  this->ImportForAt(buf, len, ms);
#endif
}



int AtShell::ImportForAt(uint8_t *buf, uint32_t len, uint32_t ms) {
    if (m_lock == 1 || len == 0 || len > sizeof(m_buf)) {
        return 0;
    }
    if (buf == NULL || ms - m_importMs > 10 || m_bufLen + len >= sizeof(m_buf)) {
        m_bufLen = 0;
    }
    if (buf != NULL) {
        memcpy(m_buf + m_bufLen, buf, len);
    }
    m_bufLen = m_bufLen + len;
    m_importMs = ms;
    if (m_bufLen < 3) {
        return 0;
    }
    if (m_buf[m_bufLen - 2] == 0x0d && m_buf[m_bufLen - 1] == 0x0a) {
        if (strstr((char *) m_buf, "AT") == (char *) m_buf) {
            m_buf[m_bufLen - 1] = 0;
            m_buf[m_bufLen - 2] = 0;
        } else {
            m_buf[m_bufLen - 1] = 0;
            m_buf[m_bufLen - 2] = 0;
        }
        this->Exec(m_buf);
        return m_bufLen;
    }
    return 0;
}


int AtShell::Printf(const char *format, ...) {
    char log_buf[256];
    va_list args;
    va_start(args, format);
    vsprintf(log_buf, format, args);
    uint32_t len = strlen(log_buf);
    m_writeFun((uint8_t *) log_buf, len,CON_AT_WRITE_TIMEOUT);
    va_end(args);
    return len;
}


int AtShell::Output(long nLevel, const char *pszFileName, int nLineNo, const char *format, ...) {
    char log_buf[256];
    snprintf(log_buf, sizeof(log_buf), "[%s:%d]", pszFileName, nLineNo);
    uint32_t len = strlen(log_buf);
    m_writeFun((uint8_t *) log_buf, len,CON_AT_WRITE_TIMEOUT);
    va_list args;
    va_start(args, format);
    vsprintf(log_buf, format, args);
    len = strlen(log_buf);
    m_writeFun((uint8_t *) log_buf, len,CON_AT_WRITE_TIMEOUT);
    va_end(args);
    return len;
}

int AtShell::PrintfBs(uint8_t *buf, uint32_t len) {
    char log_buf[256];
    if (len == 0 || len > 80) {
        return 0;
    }
    for (size_t i = 0; i < len; i++) {
        sprintf(&log_buf[3 * i], "%02X ", buf[i]);
    }
    log_buf[3 * len - 1] = '\n';
    this->Write((uint8_t *) log_buf, 3 * len,CON_AT_WRITE_TIMEOUT);
    return 3 * len;
}


int AtShell::Write(uint8_t *buf, uint32_t len,uint32_t timeout) {
    return m_writeFun(buf, len,timeout);
}

int AtShell::Write(uint8_t data) {
    uint8_t temp[1] = {data};
    return m_writeFun(temp, 1,CON_AT_WRITE_TIMEOUT);
}


void AtShell::AtCall(uint32_t code, uint8_t *buf, uint32_t len) {
    char log_buf[256];
    if (len == 0 || len > 80) {
        return;
    }
    for (size_t i = 0; i < len; i++) {
        sprintf(&log_buf[3 * i], "%02X ", buf[i]);
    }
    log_buf[3 * len - 1] = 0;
    this->Printf("AT+c(%d,%s)\r\n", code, log_buf);
}


int AtShell::Reply(uint8_t errCode) {
    if (errCode) {
        this->Printf("NG:%d\r\n", errCode);
        return errCode;
    }
    this->Printf("OK\r\n");
    return errCode;
}


void AtShell::ShowVersion() {
    this->Printf(" \\ | /\r\n");
    this->Printf("- AT_SHELL - %s  msh:%d \r\n", __DATE__, CON_AT_MSH);
    this->Printf(" / | \\\r\n");
#if CON_AT_MSH == 1
    char s[1] = {""};
    ShellAutoComplete(s);
#endif
}


#if CON_AT_MSH == 1
#if 0
/*
void msh_split_test(){
    char* argv[RT_FINSH_ARG_MAX];
    char test_cmd[100] = { "funcname arg0 \"arg1 arg1\"" };
    msh_split(test_cmd, sizeof(test_cmd), argv);
}
*/
static int msh_split(char* cmd, uint32_t length, char* argv[RT_FINSH_ARG_MAX])
{
    char* ptr;
    uint32_t position;
    uint32_t argc;
    uint32_t i;
    /* strim the beginning of command */
    while (*cmd == ' ' || *cmd == '\t')
    {
        cmd++;
        length--;
    }
    if (length == 0)
        return 0;
    ptr = cmd;
    position = 0; argc = 0;
    while (position < length)
    {
        /* strip bank and tab */
        while ((*ptr == ' ' || *ptr == '\t') && position < length)
        {
            *ptr = '\0';
            ptr++; position++;
        }

        if (argc >= RT_FINSH_ARG_MAX)
        {
            rt_kprintf("Too many args ! We only Use:\n");
            for (i = 0; i < argc; i++)
            {
                rt_kprintf("%s ", argv[i]);
            }
            rt_kprintf("\n");
            break;
        }

        if (position >= length) break;

        /* handle string */
        if (*ptr == '"')
        {
            ptr++; position++;
            argv[argc] = ptr; argc++;

            /* skip this string */
            while (*ptr != '"' && position < length)
            {
                if (*ptr == '\\')
                {
                    if (*(ptr + 1) == '"')
                    {
                        ptr++; position++;
                    }
                }
                ptr++; position++;
            }
            if (position >= length) break;

            /* skip '"' */
            *ptr = '\0'; ptr++; position++;
        }
        else
        {
            argv[argc] = ptr;
            argc++;
            while ((*ptr != ' ' && *ptr != '\t') && position < length)
            {
                ptr++; position++;
            }
            if (position >= length) break;
        }
    }
    return argc;
}
#endif


static void *rt_memmove(void *dest, const void *src, uint32_t n) {
    char *tmp = (char *) dest, *s = (char *) src;

    if (s < tmp && tmp < s + n) {
        tmp += n;
        s += n;

        while (n--)
            *(--tmp) = *(--s);
    } else {
        while (n--)
            *tmp++ = *s++;
    }

    return dest;
}

static char *rt_strncpy(char *dst, const char *src, uint32_t n) {
    if (n != 0) {
        char *d = dst;
        const char *s = src;

        do {
            if ((*d++ = *s++) == 0) {
                /* NUL pad the remaining n-1 bytes */
                while (--n != 0)
                    *d++ = 0;
                break;
            }
        } while (--n != 0);
    }

    return (dst);
}

static int str_common(const char *str1, const char *str2) {
    const char *str = str1;
    while ((*str != 0) && (*str2 != 0) && (*str == *str2)) {
        str++;
        str2++;
    }
    return (str - str1);
}


int AtShell::ImportForMsh(uint8_t *buf, uint32_t len, uint32_t ms) {
    for (size_t i = 0; i < len; i++) {
        MshAddChar(buf[i]);
    }
    return len;
}


void AtShell::ShellAutoComplete(char *prefix) {
    this->Printf("\r\n");
    MshAutoComplete(prefix);
    this->Printf("%s%s", FINSH_PROMPT, prefix);
}


void AtShell::MshAutoComplete(char *prefix) {
    int length, min_length;
    const char *name_ptr, *cmd_name;
    int index;
    min_length = 0;
    name_ptr = 0;
    if (*prefix == '\0') {
        return;
    }
    for (index = 0; index < g_atShell.GetCmdNum(); index++) {
        /* skip finsh shell function */
        cmd_name = s_ap_cmd_entry[index].methodName;
        if (strncmp(prefix, cmd_name, strlen(prefix)) == 0) {
            if (min_length == 0) {
                /* set name_ptr */
                name_ptr = cmd_name;
                /* set initial length */
                min_length = strlen(name_ptr);
            }
            length = str_common(name_ptr, cmd_name);
            if (length < min_length)
                min_length = length;

            this->Printf("%s\r\n", cmd_name);
        }
    }


    /* auto complete string */
    if (name_ptr != NULL) {
        rt_strncpy(prefix, name_ptr, min_length);
    }
    return;
}

void AtShell::MshAddChar(char ch) {
    enum input_stat {
        WAIT_NORMAL = 0,
        WAIT_SPEC_KEY,
        WAIT_FUNC_KEY,
    };
    /*
     * handle control key
     * up key  : 0x1b 0x5b 0x41
     * down key: 0x1b 0x5b 0x42
     * right key:0x1b 0x5b 0x43
     * left key: 0x1b 0x5b 0x44
     */
    if (ch == 0x1b) {
        m_stat = WAIT_SPEC_KEY;
        return;
    } else if (m_stat == WAIT_SPEC_KEY) {
        if (ch == 0x5b) {
            m_stat = WAIT_FUNC_KEY;
            return;
        }
        m_stat = WAIT_NORMAL;
    } else if (m_stat == WAIT_FUNC_KEY) {
        m_stat = WAIT_NORMAL;
        if (ch == 0x41) /* up key */
        {
            /* prev history */
            if (m_currentHistory > 0)
                m_currentHistory--;
            else {
                m_currentHistory = 0;
                return;
            }

            /* copy the history command */
            memcpy(m_line, &m_cmdHistory[m_currentHistory][0], FINSH_CMD_SIZE);
            m_lineCurpos = m_linePosition = strlen(m_line);
            ShellHandleHistory();
            return;
        } else if (ch == 0x42) {
            /* next history */
            if (m_currentHistory < m_historyCount - 1)
                m_currentHistory++;
            else {
                /* set to the end of history */
                if (m_historyCount != 0)
                    m_currentHistory = m_historyCount - 1;
                else
                    return;
            }

            memcpy(m_line, &m_cmdHistory[m_currentHistory][0],
                   FINSH_CMD_SIZE);
            m_lineCurpos = m_linePosition = strlen(m_line);
            ShellHandleHistory();
            return;
        } else if (ch == 0x44) /* left key */
        {
            if (m_lineCurpos) {
                this->Printf("\b");
                m_lineCurpos--;
            }

            return;
        } else if (ch == 0x43) /* right key */
        {
            if (m_lineCurpos < m_linePosition) {
                this->Printf("%c", m_line[m_lineCurpos]);
                m_lineCurpos++;
            }

            return;
        }
    }
    /* received null or error */
    if (ch == '\0' || ch == 0xFF) return;
        /* handle tab key */
    else if (ch == '\t') {
        int i;
        /* move the cursor to the beginning of line */
        for (i = 0; i < m_lineCurpos; i++)
            this->Printf("\b");

        /* auto complete */
        ShellAutoComplete(&m_line[0]);
        /* re-calculate position */
        m_lineCurpos = m_linePosition = strlen(m_line);
        return;
    }
        /* handle backspace key */
    else if (ch == 0x7f || ch == 0x08) {
        /* note that line_curpos >= 0 */
        if (m_lineCurpos == 0)
            return;

        m_linePosition--;
        m_lineCurpos--;
        if (m_linePosition > m_lineCurpos) {
            int i;
            rt_memmove(&m_line[m_lineCurpos],
                       &m_line[m_lineCurpos + 1],
                       m_linePosition - m_lineCurpos);
            m_line[m_linePosition] = 0;
            this->Printf("\b%s  \b", &m_line[m_lineCurpos]);

            /* move the cursor to the origin position */
            for (i = m_lineCurpos; i <= m_linePosition; i++)
                this->Printf("\b");
        } else {
            this->Printf("\b \b");
            m_line[m_linePosition] = 0;
        }

        return;
    }

    /* handle end of line, break */
    if (ch == '\r' || ch == '\n') {
        ShellPushHistory();

        this->Printf("\r\n");
        // printf("%s", line);
        m_line[m_linePosition] = '\0';
        g_atShell.Exec(m_line);
        this->Printf("\r\n%s", FINSH_PROMPT);
        memset(m_line, 0, sizeof(m_line));
        m_lineCurpos = m_linePosition = 0;
        return;
    }

    /* it's a large line, discard it */
    if (m_linePosition >= FINSH_CMD_SIZE)
        m_linePosition = 0;

    /* normal character */
    if (m_lineCurpos < m_linePosition) {
        int i;
        rt_memmove(&m_line[m_lineCurpos + 1], &m_line[m_lineCurpos], m_linePosition - m_lineCurpos);
        m_line[m_lineCurpos] = ch;
        this->Printf("%s", &m_line[m_lineCurpos]);
        /* move the cursor to new position */
        for (i = m_lineCurpos; i < m_linePosition; i++)
            this->Printf("\b");
    } else {
        m_line[m_linePosition] = ch;
        this->Printf("%c", ch);
    }

    ch = 0;
    m_linePosition++;
    m_lineCurpos++;
    if (m_linePosition >= FINSH_CMD_SIZE) {
        /* clear command line */
        m_linePosition = 0;
        m_lineCurpos = 0;
    }
}


void AtShell::ShellPushHistory() {
    if (m_linePosition != 0) {
        /* push history */
        if (m_historyCount >= FINSH_HISTORY_LINES) {
            /* if current cmd is same as last cmd, don't push */
            if (memcmp(&m_cmdHistory[FINSH_HISTORY_LINES - 1], m_line, FINSH_CMD_SIZE)) {
                /* move history */
                int index;
                for (index = 0; index < FINSH_HISTORY_LINES - 1; index++) {
                    memcpy(&m_cmdHistory[index][0],
                           &m_cmdHistory[index + 1][0], FINSH_CMD_SIZE);
                }
                memset(&m_cmdHistory[index][0], 0, FINSH_CMD_SIZE);
                memcpy(&m_cmdHistory[index][0], m_line, m_linePosition);
                m_historyCount = FINSH_HISTORY_LINES;
            }
        } else {
            /* if current cmd is same as last cmd, don't push */
            if (m_historyCount == 0 || memcmp(&m_cmdHistory[m_historyCount - 1], m_line, FINSH_CMD_SIZE)) {
                m_currentHistory = m_historyCount;
                memset(&m_cmdHistory[m_historyCount][0], 0, FINSH_CMD_SIZE);
                memcpy(&m_cmdHistory[m_historyCount][0], m_line, m_linePosition);
                m_historyCount++;
            }
        }
    }
    m_currentHistory = m_historyCount;
}


bool AtShell::ShellHandleHistory() {
#if defined(_WIN32)
    int i;
    this->Printf("\r");

    for (i = 0; i <= 60; i++)
      this->Write(' ');
      this->Printf("\r");

#else
    rt_kprintf("\033[2K\r");
#endif
    this->Printf("%s%s", FINSH_PROMPT, m_line);
    return 0;
}

#endif


#if CON_AT_USE_EXPORT == 1
void AtShell::Export(){
    if(m_out_bufLen>0){
        m_writeFun((uint8_t *) m_out_buf, m_out_bufLen,CON_AT_WRITE_TIMEOUT);
    }
    m_out_bufLen=0;
}

#endif

#if CON_AT_USE_EXPORT == 1
int AtShell::AsyncPrintf(const char *format, ...){
    char log_buf[256];
    va_list args;
    va_start(args, format);
    vsprintf(log_buf, format, args);
    uint32_t len = strlen(log_buf);
    if(m_out_bufLen+len < CON_AT_OUT_BUF_SIZE){
        memcpy(m_out_buf + m_out_bufLen, log_buf, len);
        m_out_bufLen=m_out_bufLen+len;
    } else{
        AT_error("error \r\n");
    }
    va_end(args);
    return len;
}
#else
int AtShell::AsyncPrintf(const char *format, ...){
    char log_buf[256];
    va_list args;
    va_start(args, format);
    vsprintf(log_buf, format, args);
    uint32_t len = strlen(log_buf);
    m_writeFun((uint8_t *) log_buf, len,0);
    va_end(args);
    return len;
}
#endif

#if CON_AT_USE_CycleMonitorData==1
static uint8_t _sum(uint8_t * buffer, int len){
    uint8_t sum = 0;
    for (int i = 0; i < len; i++) {
        sum += buffer[i];
    }
    return(sum);
}
int AtShell::MonitorDataPush(const char *tag, uint8_t * buffer, int len){
    if(m_monitorData.curInx==CON_CYCLE_MONITOR_DATA_PACK_NUM){
        m_monitorData.curInx=0;
    }
    sprintf(m_monitorData.tag[m_monitorData.curInx], "%s", tag);
    memcpy(m_monitorData.buffer[m_monitorData.curInx],buffer,len);
    m_monitorData.bufferLen[m_monitorData.curInx]=len;
    m_monitorData.curInx++;
    return 0;
}

int AtShell::MonitorDataViewInfo(){
    int inx=m_monitorData.curInx-1;
    for(int i=0;i<CON_CYCLE_MONITOR_DATA_PACK_NUM;i++){
        if(inx==-1){
            inx=9;
        }
        this->Printf("%s:%3d.%3d@",m_monitorData.tag[inx],m_monitorData.bufferLen[inx],_sum(m_monitorData.buffer[inx],m_monitorData.bufferLen[inx]));
        AT_printfBs( m_monitorData.buffer[inx],m_monitorData.bufferLen[inx]);
        this->Printf("\r\n");
        inx--;
    }
    return 0;
}
#endif



void at_init(ATWriteFun writeFun) {
    g_atShell.Init(writeFun);
}


int at_import(uint8_t *buf, uint32_t len, uint32_t ms) {
    return g_atShell.Import(buf, len, ms);
}
bool at_try_import(uint8_t *buf, uint32_t len, uint32_t ms) {
    if (CON_AT_MSH || strstr((char*)buf, "AT") == (char*)buf || strstr((char*)buf, "\r\n") == (char*)buf) {
        g_atShell.Import(buf, len, ms);
        return true;
    }
    return false;
}

#if CON_AT_USE_EXPORT == 1
void at_export() {
    g_atShell.Export();
}
#endif

bool at_register(AT_CMD_ENTRY_TypeDef cmd) {
    return g_atShell.Regist(cmd);
}

bool at_register_many(AT_CMD_ENTRY_TypeDef *cmdList, int cmdLen) {
    return g_atShell.Regist(cmdList, cmdLen);
}



int at_write(uint8_t *buf, uint32_t len,uint32_t timeout){
    return  g_atShell.Write(buf,len,timeout);
}

int at_printf(const char *format, ...) {
    char log_buf[256];
    va_list args;
    va_start(args, format);
    vsprintf(log_buf, format, args);
    uint32_t len = strlen(log_buf);
    g_atShell.Write((uint8_t *) log_buf, len,CON_AT_WRITE_TIMEOUT);
    va_end(args);
    return len;
}



int at_awrite(uint8_t *buf, uint32_t len){
#if CON_AT_USE_EXPORT == 1
    if(g_atShell.m_out_bufLen+len < CON_AT_OUT_BUF_SIZE){
            memcpy(g_atShell.m_out_buf + g_atShell.m_out_bufLen, buf, len);
            g_atShell.m_out_bufLen=g_atShell.m_out_bufLen+len;
            return len;
        }
        return 0;
#else
    return g_atShell.Write(buf,len,0);;
#endif
}


int at_aprintf(const char *format, ...) {
    char log_buf[256];
    va_list args;
    va_start(args, format);
    vsprintf(log_buf, format, args);
    uint32_t len = strlen(log_buf);
    at_awrite((uint8_t *) log_buf, len);
    va_end(args);
    return len;
}





int at_reply(uint8_t errCode) {
    return g_atShell.Reply(errCode);
}


void at_show_version() {
    g_atShell.ShowVersion();
}


int at_hexStringToByteArray(const char *hexStr, unsigned char *bs) {
    char token[3];
    int i = 0;
    long int byteValue;
    const int byteArrayLen = (strlen(hexStr) + 1) / 3;
    while (*hexStr && i < byteArrayLen) {
        if (isspace(*hexStr)) {
            hexStr++;
            continue;
        }

        if (!isxdigit(*hexStr)) {
            return i;
        }
        token[0] = *hexStr++;
        token[1] = *hexStr++;
        token[2] = '\0';
        byteValue = strtol(token, NULL, 16);
        bs[i] = (unsigned char) byteValue;
        i++;
    }
    return i;
}

long at_str_to_int(char* str) {
    char* endptr;
    int base = 10;
    if (str == 0) {
        return 0;
    }
    if (str[0] == '0') {
        if (str[1] == 'x' || str[1] == 'X') {
            base = 16;
            str += 2;
        }
        else {
            base = 8;
        }
    }
    long result = strtol(str, &endptr, base);
    if (*endptr != '\0') {

        return 0;
    }
    return result;
}

#if CON_AT_USE_CycleMonitorData == 1

void  at_monitor_init(){
    g_atShell.m_monitorData.curInx=0;
}
void  at_monitor_push(const char *tag, uint8_t * buffer, int len){
    g_atShell.MonitorDataPush(tag, buffer, len);
}
void  at_monitor_viewInfo(){
    g_atShell.MonitorDataViewInfo();
}

#endif
```
## LogUtils.h
```c
#ifndef _LogUtils_HPP
#define _LogUtils_HPP

#include <string>
#include <stdint.h>
using namespace std;

#define LOG_ERROR(...) LogUtils::LogError(__FILE__, __LINE__, __VA_ARGS__)
#define LOG_INFO(...)  LogUtils::LogInfo(__FILE__, __LINE__, __VA_ARGS__)
#define LOG_DEBUG(...) LogUtils::LogDebug(__FILE__, __LINE__, __VA_ARGS__)
#define LOG_DEBUG_DT(...) LogUtils::LogDebugDifTime(__FILE__, __LINE__, __VA_ARGS__)

namespace Common {
    class LogUtils {
    public:
        static int Printf(const char *format, ...) ;
        static int Println(const char *format, ...) ;
        static void PrintBuf(const string tag, uint8_t *buf, uint16_t bufLen) ;
        static void LogInfo(const char *fmt, ...) ;
        static void LogInfo(const char* file, int line, const char* format, ...);
        static void LogDebug(const char *fmt, ...) ;
        static void LogDebugDifTime(const char* file, int line, const char* format, ...);
        static void LogDebug(const char* file, int line, const char* format, ...);
        static void LogError(const char *fmt, ...) ;
        static void LogError(const char* file, int line, const char* format, ...);
    };
}
#endif
```
## LogUtils.cpp
```c
#include "LogUtils.h"
#include "stdarg.h"
#include "string.h"
#include "stdio.h"
#include <string>


#define CON_ENABLE_LOG 1


using namespace std;
using namespace Common;


int LogUtils::Printf(const char *format, ...) {
    if (CON_ENABLE_LOG) {
        char log_buf[256];
        va_list args;
        va_start(args, format);
        vsprintf(log_buf, format, args);
        va_end(args);
        uint32_t len = strlen(log_buf);
        printf("%s", log_buf);
        return len;
    }
    return 0;
}

int LogUtils::Println(const char *format, ...) {
    if (CON_ENABLE_LOG) {
        char log_buf[256];
        va_list args;
        va_start(args, format);
        vsprintf(log_buf, format, args);
        va_end(args);
        uint32_t len = strlen(log_buf);
        printf("%s\n\r", log_buf);
        return len;
    }
    return 0;
}

void LogUtils::PrintBuf(const string tag, uint8_t *buf, uint16_t bufLen) {
    if (CON_ENABLE_LOG) {
        LogUtils::Printf(tag.c_str());
        for (int i = 0; i < bufLen; i++) {
            LogUtils::Printf("%02x ", buf[i]);
        }
        LogUtils::Printf("\n");
    }
}

void LogUtils::LogInfo(const char *fmt, ...) {
    va_list args;
    va_start(args, fmt);
    fprintf(stdout, "[INFO] ");
    vfprintf(stdout, fmt, args);
    fprintf(stdout, "\n");
    va_end(args);
}


void LogUtils::LogInfo(const char* file, int line, const char* format, ...) {
    char buffer[1024];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    const char* filename = strrchr(file, '/');
    if (!filename) {
        filename = strrchr(file, '\\');
    }
    filename = filename ? filename + 1 : file;
    fprintf(stdout, "[INFO] %s:%d - %s\n", filename, line, buffer);
}

void LogUtils::LogDebug(const char *fmt, ...) {
    va_list args;
    va_start(args, fmt);
    fprintf(stdout, "[Debug] ");
    vfprintf(stdout, fmt, args);
    fprintf(stdout, "\n");
    va_end(args);
}


void LogUtils::LogDebug(const char* file, int line, const char* format, ...) {
    char buffer[1024];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    const char* filename = strrchr(file, '/');
    if (!filename) {
        filename = strrchr(file, '\\');
    }
    filename = filename ? filename + 1 : file;
    fprintf(stdout, "[Debug] %s:%d - %s\n", filename, line, buffer);
}

void LogUtils::LogDebugDifTime(const char* file, int line, const char* format, ...) {
    if(format== nullptr){
        return;
    }
    static uint32_t lastTime=0;
    char buffer[1024];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    const char* filename = strrchr(file, '/');
    if (!filename) {
        filename = strrchr(file, '\\');
    }
    filename = filename ? filename + 1 : file;
    uint32_t nowTime=1;
    fprintf(stdout, "[Debug] %s:%d@t:%d - %s\n", filename, line,nowTime-lastTime, buffer);
    lastTime=nowTime;
}


void LogUtils::LogError(const char *fmt, ...) {
    va_list args;
    va_start(args, fmt);
    fprintf(stderr, "[ERROR] ");
    vfprintf(stderr, fmt, args);
    fprintf(stderr, "\n");
    fflush(stderr);
    va_end(args);
}

void LogUtils::LogError(const char* file, int line, const char* format, ...) {
    char buffer[1024];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    const char* filename = strrchr(file, '/');
    if (!filename) {
        filename = strrchr(file, '\\');
    }
    filename = filename ? filename + 1 : file;
    fprintf(stderr, "[ERROR] %s:%d - %s\n", filename, line, buffer);
    fflush(stderr);
}
```
## EventBus.h
```c
#ifndef COMMON_EVENT_BUS_H
#define COMMON_EVENT_BUS_H

#include <string>
#include <functional>
#include <map>
#include <vector>
#include <mutex>


#define  EventSubscribe(type,instance,handler) EventBus::GetInstance().Subscribe(type,instance,handler)
#define  EventPublish(type,data) EventBus::GetInstance().Publish(type,data)

namespace Common {

enum class EventType : uint32_t {
        None = 0,
        PUSH_DATA=1
    };

class EventBus {
public:
    // 事件处理函数类型
    template<typename T>
    using MemberHandler = void (T::*)(EventType event, void* data);

    // 获取单例实例
    static EventBus& GetInstance();

    // 订阅事件（使用成员函数）
    template<typename T>
    void Subscribe(EventType eventType, T* instance, MemberHandler<T> handler) {
        auto callback = [instance, handler](EventType evt, void* data) {
            (instance->*handler)(evt, data);
        };
        Subscribe(eventType, callback);
    }
    // 订阅事件（使用普通函数或 lambda）
    void Subscribe(EventType eventType, std::function<void(EventType, void*)> handler);
    // 取消订阅
    void Unsubscribe(EventType eventType);
    // 发布事件
    void Publish(EventType event, void* data);
    // 检查是否有订阅者
    bool HasSubscribers(EventType event) const;
    // 获取订阅者数量
    size_t GetSubscriberCount(EventType event) const;

private:
    EventBus();
    ~EventBus();
    struct Storage;
    Storage* storage_;
};

} // namespace Common

#endif // COMMON_EVENT_BUS_H 
```
## EventBus.cpp
```c
#include "EventBus.h"
#include "LogUtils.h"
#include "pico/sync.h"

namespace Common {

    struct EventBus::Storage {
        critical_section_t cs;
        std::map<EventType,
                std::vector<std::function<void(EventType, void*)>>> subs;
    };

    EventBus& EventBus::GetInstance() {
        static EventBus instance;
        return instance;
    }

    EventBus::EventBus() {
        storage_ = new Storage;
        critical_section_init(&storage_->cs);
    }
    EventBus::~EventBus() {
        critical_section_deinit(&storage_->cs);
        delete storage_;
    }

    void EventBus::Subscribe(EventType eventType, std::function<void(EventType, void*)> handler) {
        critical_section_enter_blocking(&storage_->cs);
        storage_->subs[eventType].push_back(handler);
        critical_section_exit(&storage_->cs);
    }

    void EventBus::Unsubscribe(EventType eventType) {
        critical_section_enter_blocking(&storage_->cs);
        storage_->subs.erase(eventType);
        critical_section_exit(&storage_->cs);
    }

    void EventBus::Publish(EventType eventType, void* data) {
        std::vector<std::function<void(EventType, void*)>> handlers;
        critical_section_enter_blocking(&storage_->cs);
        auto it = storage_->subs.find(eventType);
        if (it != storage_->subs.end())
            handlers = it->second;
        critical_section_exit(&storage_->cs);
        for (auto& h : handlers){
            h(eventType, data);
        }

    }

    bool EventBus::HasSubscribers(EventType eventType) const {
        auto it = storage_->subs.find(eventType);
        return it != storage_->subs.end() && !it->second.empty();
    }

    size_t EventBus::GetSubscriberCount(EventType eventType) const {
        auto it = storage_->subs.find(eventType);
        return it != storage_->subs.end() ? it->second.size() : 0;
    }
}
```
# 配置文件
## .gitignore
```bash
cmake-build-debug
# 第一步：忽略 .idea 目录下的所有文件/子目录
.idea/*
!.idea/encodings.xml
!.idea/
```
## wokwi.toml
```bash
[wokwi]
version = 1
firmware = "cmake-build-debug/pipo_project.uf2"
elf = "cmake-build-debug/pipo_project.elf"
rfc2217ServerPort = 4000
```
## pico_sdk_import.cmake
```bash
# This is a copy of the pico_sdk_import.cmake file from the Pico SDK
# It's needed to properly import the Pico SDK in CMake projects

if (DEFINED ENV{PICO_SDK_PATH} AND (NOT PICO_SDK_PATH))
    set(PICO_SDK_PATH $ENV{PICO_SDK_PATH})
    message("Using PICO_SDK_PATH from environment: ${PICO_SDK_PATH}")
endif ()

if (NOT PICO_SDK_PATH)
    message(FATAL_ERROR "PICO_SDK_PATH is not defined. Either set it in the environment, or pass -DPICO_SDK_PATH=xxx to cmake")
endif ()

set(PICO_SDK_INIT_CMAKE_FILE "${PICO_SDK_PATH}/pico_sdk_init.cmake")
if (NOT EXISTS ${PICO_SDK_INIT_CMAKE_FILE})
    message(FATAL_ERROR "Could not find pico_sdk_init.cmake in ${PICO_SDK_PATH}")
endif ()

include( ${PICO_SDK_INIT_CMAKE_FILE})

message(AAAAAAAAAAAAA ${PICO_SDK_INIT_CMAKE_FILE})
```
## diagram.json
```json
{
  "version": 1,
  "author": "wang minglie",
  "editor": "wokwi",
  "parts": [
    {
      "type": "wokwi-pi-pico",
      "id": "pico",
      "top": -3.15,
      "left": 3.6,
      "attrs": { "builder": "pico-sdk" }
    },
    { "type": "wokwi-logic-analyzer", "id": "logic1", "top": -143.65, "left": 326.4, "attrs": {} }
  ],
  "connections": [
    [ "pico:GP0", "$serialMonitor:RX", "", [] ],
    [ "pico:GP1", "$serialMonitor:TX", "", [] ],
    [ "pico:GP21", "logic1:D0", "green", [ "h116.4", "v-230.4", "h19.2", "v-38.4" ] ]
  ],
  "dependencies": {}
}

```
## CMakeLists.txt
```bash
cmake_minimum_required(VERSION 3.13)

# Set Pico SDK path

# Include the Pico SDK CMake configuration
include(pico_sdk_import.cmake)

project(pipo_project C CXX ASM)
pico_sdk_init()
add_executable(pipo_project
        src/main.cpp
        src/mi_hw_alarm.cpp
        src/user/user_atshell.cpp
        src/lib/AtShell.cpp
        src/common/LogUtils.cpp
        src/AlarmProtothread.cpp
)


target_link_libraries(
        pipo_project
        pico_stdlib
        hardware_exception
)


# Enable USB output, disable UART output
pico_enable_stdio_usb(pipo_project 0)
pico_enable_stdio_uart(pipo_project 1)

pico_add_extra_outputs(pipo_project)

```
## copy_uf2.bat
```bash
@echo off
set "src=D:\workspace\gitee\2\ming_picoman\cmake-build-debug\pipo_project.uf2"
set "dst=F:"

if not exist "%src%" (
    echo Error: UF2 file not found!
    pause
    exit 1
)
if not exist "%dst%" (
    echo Error: USB drive %dst% not found!
    pause
    exit 1
)

copy /Y "%src%" %dst%
if %errorlevel% equ 0 (
    echo Success! Pico is rebooting...
) else (
    echo Failed! Reconnect Pico and try again.
)
pause

```

![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/e57a5f92a25f4d1c83e3cab0fdce1ad5.png)
