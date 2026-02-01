>  本文借鉴了  [Protothreads](https://dunkels.com/adam/pt/index.html)的设计理念，并在其基础上进行了简化与优化，使其在 MCU 编程中更加简洁易用。此外，[AlarmProtothread](https://blog.csdn.net/qq_26074053/article/details/156266600)改进了其调度机制，使其支持微秒级延时。值得一提的是，该 Protothread 设计可以移植到 HLS，实现直接综合为 Verilog 硬件模块。


# MCU编程的常见模式
在传统 MCU（裸机编程，不跑 RTOS）的设计中，程序通常采用 **中断 + 主循环** 的结构。常见模式如下：

- **时基中断（SysTick / Timer）**  
  提供精确的时间基准（如 1ms 一次），用于调度周期性、实时性较强但轻量的任务，例如：按键扫描、状态机更新、心跳信号等。

- **外设中断（Peripheral ISR）**  
  由外设事件触发，如串口接收、ADC 转换完成、外部引脚中断等，通常只做快速的数据搬运或置标志，避免在中断中执行耗时操作。

- **主循环（Main Loop）**  
  负责执行耗时、不严格要求实时性的任务，例如：通信协议解析、复杂运算、日志输出、UI 更新等。主循环通常通过“查询标志位”或“任务队列”来处理由中断触发的事件。
## 示意图（1ms 周期）
```text
|<---------------- 1 ms ---------------->|
|---- ISR (0~800µs) ----|-----主循环任务--|
```
我们必须要控制时基中断服务函数的最大耗时 小于 1ms，则需要用到状态机,计数器等技巧。[Protothread](https://wokwi.com/projects/402006915303326721) 是一种轻量协程实现，它本质上利用 **状态机 + 计数器 + 宏** 来实现 ***看起来像顺序写，实际上分步执行***。  
这让代码在 **表现形式上接近 Promise / async** ——  
你可以写出类似同步流程的逻辑，但在底层却是“分片执行”，保证了 ISR 的实时性。



# 🌐 在线演示
[ Wokwi 在线演示 ](https://wokwi.com/projects/402006915303326721)
#####  按下按键，灯取反的例子
```c
#include <Arduino.h>
#include "AtShell.h"
#include "Protothread.h"
#include "ManKey.h"

#define  KEY0   0
#define  LED1   26
#define  LED2   27

class LedPt;
class KeyPt;

extern KeyPt keyPt;
extern LedPt ledPt;


static int keyPinRead(uint8_t id) {
    return !digitalRead(KEY0);
}

static void onKeyEvent(uint32_t ms, ManKeyEventCode manKeyEventCode) {
    switch (manKeyEventCode.one.evtCode) {
        case MAN_KEY_EVT_DOWN:
            Serial.println("按下");
            Protothread::PushIndata((Protothread *) &ledPt, 1);
            break;
    }

}


class KeyPt : public Protothread {
    void Init() {
        AT_println("KeyPt init");
        pinMode(KEY0, INPUT_PULLUP);
        ManKey::Create(1);
        ManKey::pinRead = keyPinRead;
        ManKey::onEvent = onKeyEvent;
    }

    bool Run() {
        PtOsDelayMs(10);
        ManKey::OnTickAll(millis());
        return 0;
    }
};

class LedPt : public Protothread {
      void Init() {
          AT_println("LedPt init");
          pinMode(LED1, OUTPUT);
          pinMode(LED2, OUTPUT);
      }

      bool Run() {
        WHILE(1) {
                  //等待按键按下后灯取反
                  PT_WAIT_UNTIL(PopInData());
                  digitalWrite(LED2, !digitalRead(LED2)); 
        }
      PT_END();
  }
};
KeyPt keyPt;
LedPt ledPt;
```

# C++版本
## Protothread.h
```c
#ifndef __PROTOTHREAD_H__
#define __PROTOTHREAD_H__
#include "stdint.h"
#define  PT_MAX_THREAD_NUM      5
#define  PT_THREAD_TICK_MS      10
/**
class LEDFlasher : public Protothread
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

 void let_test(Protothread * pt) {
    LED_TOGGLE();
    PT_OS_DELAY_MS(10);
}

Protothread::Create(let_test);
LEDFlasher ledFlasher;
ledFlasher.Start();
**/


typedef struct {
    uint32_t	 code;
    uint32_t	 ms;
    void *       args;
} ProtothreadNotifyEvent;


class Protothread;
typedef  void (*PtRunFun)(Protothread * pt);
class Protothread
{
public:
    static Protothread* M_pts[PT_MAX_THREAD_NUM];
    //for start
    static int M_nspt;
    static int M_npt;
    //for cycle
    static uint32_t M_ms_tick;
    Protothread();
    virtual ~Protothread() { }
    virtual const char* Name(void) 	{ return("");}
    void Restart() { _ptLine = 0; }
    void Stop() { _ptLine = LineNumberInvalid; }
    bool IsRunning() { return _ptLine != LineNumberInvalid; }
    void PtOsDelay(uint32_t tick);
    void PtOsDelayMs(uint32_t ms);
    void PtOsDelayResume();
    virtual void OnTick();
    virtual void Init();
    virtual bool Run();
    virtual unsigned int Start();
    virtual void   Notify(Protothread * target,ProtothreadNotifyEvent evt);
    virtual void   OnRecvNotify(Protothread * source,ProtothreadNotifyEvent evt);
    static  void   OnRecvNotify(Protothread * source, Protothread * target,ProtothreadNotifyEvent evt);
    static void  AllStart();
    static void  OnTickAll();
    static int   PollAndRun(uint32_t tsMs);
    static Protothread* Create(PtRunFun run);
protected:
    PtRunFun m_run;
    unsigned int  m_id;
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
    static void SetInData(Protothread * pt,uint32_t indata);
    static bool PushIndata(Protothread * pt,uint32_t indata);
    static uint32_t GetOutData(Protothread * pt);
    static uint32_t  PopOutData(Protothread * pt);
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
    m_delay = v;			\
    PT_WAIT_UNTIL(m_delay == 0);		\
  } while(0)

#define PT_DELAY_MS(v)				\
  do {						\
    m_delay = v/PT_THREAD_TICK_MS;			\
    PT_WAIT_UNTIL(m_delay == 0);		\
  } while(0)

#define WHILE(a)   PT_BEGIN(); \
  while(1)

#define PT_OS_DELAY(tick)        pt->PtOsDelay(tick)
#define PT_OS_DELAY_MS(ms)       pt->PtOsDelayMs(ms)
//free time slice
#define PT_FREE_TIME_SLICE(tsMs)   PT_THREAD_TICK_MS-(tsMs-Protothread::M_ms_tick)
#endif

```

##  Protothread.cpp
```c
#include "Protothread.h"

int  Protothread::M_nspt = 0;
int  Protothread::M_npt = 0;


uint32_t  Protothread::M_ms_tick = 0;

Protothread * Protothread::M_pts[PT_MAX_THREAD_NUM];

Protothread::Protothread(): _ptLine(0){
    m_delay = 0;
    m_indata=0;
    m_outdata=0;
    m_state=0;
    m_run=0;
    M_pts[Protothread::M_nspt++]= this;
}

void Protothread::PtOsDelay(uint32_t tick) {
    m_delay=tick;
}

void Protothread::PtOsDelayMs(uint32_t ms) {
    m_delay=ms/PT_THREAD_TICK_MS;
}

void Protothread::PtOsDelayResume() {
    m_delay=0;
}

void Protothread::Init() {

}

void Protothread::OnTick(){
    if (m_delay > 0)
        m_delay--;
    if(m_delay==0){
        this->Run();
    }
}

uint32_t Protothread::GetDelay(){
    return m_delay;
}

uint32_t Protothread::GetInData(){
    return m_indata;
}
void Protothread::SetInData(Protothread * pt,uint32_t indata){
    pt->m_indata=indata;
}

uint32_t Protothread::PopInData(){
    uint32_t v = m_indata;
    m_indata = 0;
    return v;
}

bool Protothread::PushIndata(Protothread * pt,uint32_t indata){
    if (pt->m_indata == 0) {
        pt->m_indata = indata;
        return true;
    }
    return false;
}

uint32_t Protothread::GetOutData(Protothread * pt){
    return pt->m_outdata;
}

void Protothread::SetOutData(uint32_t outdata){
    m_outdata=outdata;
}

uint32_t  Protothread::PopOutData(Protothread * pt){
    uint32_t v=pt->m_outdata;
    pt->m_outdata=0;
    return v;
}

bool  Protothread::PushOutData(uint32_t outdata){
    if(m_outdata==0) {
        m_outdata=outdata;
        return true;
    }
    return false;
}

unsigned int Protothread::Start() {
    this->Init();
    m_id=Protothread::M_npt++;
    M_pts[m_id]= this;
    return m_id;
}

bool Protothread::Run() {
    if(m_run!=0){
        m_run(this);
    }
    return true;
}

Protothread* Protothread::Create(PtRunFun run) {
    Protothread* pt= new Protothread();
    pt->m_run=run;
    return pt;
}



void Protothread::AllStart() {
    for (int i=0;i<M_nspt;i++){
        M_pts[i]->Start();
    }
}


void Protothread::OnTickAll() {
    for (int i=0;i<M_npt;i++){
        M_pts[i]->OnTick();
    }
}


int Protothread::PollAndRun(uint32_t tsMs) {
    #if PT_THREAD_TICK_MS==1
        Protothread::OnTickAll();
        return 1;
    #else
        if(tsMs-Protothread::M_ms_tick>=PT_THREAD_TICK_MS){
            Protothread::M_ms_tick=tsMs;
            Protothread::OnTickAll();
            return 1;
        }
        return 0;
    #endif
}

void  Protothread::Notify(Protothread * target,ProtothreadNotifyEvent evt){
    Protothread::OnRecvNotify(this,target,evt);
    if(target== nullptr){
          for(int i=0;i<Protothread::M_npt;i++){
              Protothread::M_pts[i]->OnRecvNotify(target,evt);
          }
          return;
      } else{
          target->OnRecvNotify(target,evt);
      }
}


void  Protothread::OnRecvNotify(Protothread * source,ProtothreadNotifyEvent evt){
    // nothing
}

void  Protothread::OnRecvNotify(Protothread * source, Protothread * target,ProtothreadNotifyEvent evt){
   // nothing
}
```
# C++ 无宏的版本
无宏版本需要自己实现状态机
## Protothread.h
```c
#ifndef __PROTOTHREAD_H__
#define __PROTOTHREAD_H__
#include "stdint.h"
#define  PT_MAX_THREAD_NUM      5
#define  PT_THREAD_TICK_MS      10

typedef struct {
    uint32_t	 code;
    uint32_t	 ms;
    void *       args;
} ProtothreadNotifyEvent;


class Protothread;
typedef  void (*PtRunFun)(Protothread * pt);
class Protothread
{
public:
    static Protothread* M_pts[PT_MAX_THREAD_NUM];
    //for start
    static int M_nspt;
    static int M_npt;
    //for cycle
    static uint32_t M_ms_tick;
    Protothread();
    virtual ~Protothread() { }
    void PtOsDelay(uint32_t tick);
    void PtOsDelayMs(uint32_t ms);
    void PtOsDelayResume();
    virtual void OnTick();
    virtual void Init();
    virtual void Run();
    virtual unsigned int Start();
    virtual void   Notify(Protothread * target,ProtothreadNotifyEvent evt);
    virtual void   OnRecvNotify(Protothread * source,ProtothreadNotifyEvent evt);
    static  void   OnRecvNotify(Protothread * source, Protothread * target,ProtothreadNotifyEvent evt);
    static void  AllStart();
    static void  OnTickAll();
    static int   PollAndRun(uint32_t tsMs);
    static Protothread* Create(PtRunFun run);
protected:
    PtRunFun m_run;
    unsigned int  m_id;
    uint32_t m_delay;
public:
    uint32_t  m_state;
    uint32_t  m_indata;
    uint32_t  m_outdata;
    uint32_t GetDelay();
    uint32_t GetInData();
    void SetOutData(uint32_t outdata);
    uint32_t PopInData();
    bool  PushOutData(uint32_t outdata);
    static void SetInData(Protothread * pt,uint32_t indata);
    static bool PushIndata(Protothread * pt,uint32_t indata);
    static uint32_t GetOutData(Protothread * pt);
    static uint32_t  PopOutData(Protothread * pt);
};


#define PT_OS_DELAY(tick)        pt->PtOsDelay(tick)
#define PT_OS_DELAY_MS(ms)       pt->PtOsDelayMs(ms)

#endif
```
## Protothread.cpp
```c
#include "Protothread.h"

int  Protothread::M_nspt = 0;
int  Protothread::M_npt = 0;


uint32_t  Protothread::M_ms_tick = 0;

Protothread * Protothread::M_pts[PT_MAX_THREAD_NUM];

Protothread::Protothread(){
    m_delay = 0;
    m_indata=0;
    m_outdata=0;
    m_state=0;
    m_run=0;
    M_pts[Protothread::M_nspt++]= this;
}

void Protothread::PtOsDelay(uint32_t tick) {
    m_delay=tick;
}

void Protothread::PtOsDelayMs(uint32_t ms) {
    m_delay=ms/PT_THREAD_TICK_MS;
}

void Protothread::PtOsDelayResume() {
    m_delay=0;
}

void Protothread::Init() {

}

void Protothread::OnTick(){
    if (m_delay > 0)
        m_delay--;
    if(m_delay==0){
        this->Run();
    }
}

uint32_t Protothread::GetDelay(){
    return m_delay;
}

uint32_t Protothread::GetInData(){
    return m_indata;
}
void Protothread::SetInData(Protothread * pt,uint32_t indata){
    pt->m_indata=indata;
}

uint32_t Protothread::PopInData(){
    uint32_t v = m_indata;
    m_indata = 0;
    return v;
}

bool Protothread::PushIndata(Protothread * pt,uint32_t indata){
    if (pt->m_indata == 0) {
        pt->m_indata = indata;
        return true;
    }
    return false;
}

uint32_t Protothread::GetOutData(Protothread * pt){
    return pt->m_outdata;
}

void Protothread::SetOutData(uint32_t outdata){
    m_outdata=outdata;
}

uint32_t  Protothread::PopOutData(Protothread * pt){
    uint32_t v=pt->m_outdata;
    pt->m_outdata=0;
    return v;
}

bool  Protothread::PushOutData(uint32_t outdata){
    if(m_outdata==0) {
        m_outdata=outdata;
        return true;
    }
    return false;
}

unsigned int Protothread::Start() {
    this->Init();
    m_id=Protothread::M_npt++;
    M_pts[m_id]= this;
    return m_id;
}

void Protothread::Run() {
    if(m_run!=0){
        m_run(this);
    }
}

Protothread* Protothread::Create(PtRunFun run) {
    Protothread* pt= new Protothread();
    pt->m_run=run;
    return pt;
}



void Protothread::AllStart() {
    for (int i=0;i<M_nspt;i++){
        M_pts[i]->Start();
    }
}


void Protothread::OnTickAll() {
    for (int i=0;i<M_npt;i++){
        M_pts[i]->OnTick();
    }
}


int Protothread::PollAndRun(uint32_t tsMs) {
    #if PT_THREAD_TICK_MS==1
        Protothread::OnTickAll();
        return 1;
    #else
        if(tsMs-Protothread::M_ms_tick>=PT_THREAD_TICK_MS){
            Protothread::M_ms_tick=tsMs;
            Protothread::OnTickAll();
            return 1;
        }
        return 0;
    #endif
}

void  Protothread::Notify(Protothread * target,ProtothreadNotifyEvent evt){
    Protothread::OnRecvNotify(this,target,evt);
    if(target== nullptr){
          for(int i=0;i<Protothread::M_npt;i++){
              Protothread::M_pts[i]->OnRecvNotify(target,evt);
          }
          return;
      } else{
          target->OnRecvNotify(target,evt);
      }
}


void  Protothread::OnRecvNotify(Protothread * source,ProtothreadNotifyEvent evt){
    // nothing
}

void  Protothread::OnRecvNotify(Protothread * source, Protothread * target,ProtothreadNotifyEvent evt){
   // nothing
}
```

# C++ HLS 版
功能是 协程0产生不规则方波,   协程1 按键按下闪烁,松手熄灭,
一个协程对应一个 verilog里的aways块,协程的OnTick 函数以系统频率ap_clk 高速执行
其依赖的信号放到m_indata，
其输出的信号放到m_outdata , 两者默认宽度都是1,
其他额外的依赖,则在子类加成员变量,或成员函数
### Protothread.h
```c
#include <ap_int.h>
#include <stdint.h>
#ifndef __PROTOTHREAD_H__
#define __PROTOTHREAD_H__
//1ms的时钟周期数
#define  PT_THREAD_TICK_MS      27000
#define  PT_IN_DATA_W    1
#define  PT_OUT_DATA_W    1

class Protothread;
typedef  void (*PtRunFun)(Protothread * pt);
class Protothread
{
public:
    Protothread(){m_delay = 0; m_state=0;m_next_state=0;}
    void Restart() { _ptLine = 0; }
    void Stop() { _ptLine = LineNumberInvalid; }
    bool IsRunning() { return _ptLine != LineNumberInvalid; }
    void PtOsDelay(uint32_t tick){m_delay=tick;}
    void PtOsDelayMs(uint32_t ms){m_delay=ms*PT_THREAD_TICK_MS;}
    bool Run(){return true;}

protected:
    uint32_t m_delay;
    typedef unsigned short LineNumber;
    static const LineNumber LineNumberInvalid = (LineNumber)(-1);
    LineNumber _ptLine;
public:
    uint8_t     m_state;
    uint8_t     m_next_state;
    ap_uint<PT_IN_DATA_W>   m_indata;
    ap_uint<PT_OUT_DATA_W>   m_outdata;
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
    m_delay = v;			\
    PT_WAIT_UNTIL(m_delay == 0);		\
  } while(0)

#define PT_DELAY_MS(v)				\
  do {						\
    m_delay = v*PT_THREAD_TICK_MS;			\
    PT_WAIT_UNTIL(m_delay == 0);		\
  } while(0)

#define WHILE(a)   PT_BEGIN(); \
  while(1)
#define __ON_TICK__  void OnTick(){ if(m_delay==0){Run();}else{m_delay--;}}
#endif
```
### my_led_key.cpp
```c
#include "Protothread.h"


class LedPt0 : public Protothread {
public: __ON_TICK__
    bool Run() {
         WHILE(1) {
        	    PT_DELAY_MS(10);
        	    m_outdata=1^m_outdata;
        	    PT_DELAY_MS(15);
        	    m_outdata=1^m_outdata;
        	    PT_DELAY_MS(20);
        	    m_outdata=1^m_outdata;
        	    PT_DELAY_MS(25);
				m_outdata=1^m_outdata;
				PT_DELAY_MS(30);
				m_outdata=1^m_outdata;
				PT_DELAY_MS(35);
				m_outdata=1^m_outdata;
         }
         PT_END();
    }

};

class LedPt1 : public Protothread {
public: __ON_TICK__
    bool Run() {
         // 延时1s
       	PtOsDelayMs(1000);
       	//按下闪,松开灭
       	if(m_indata==0){
       		m_outdata=1^m_outdata;
       	}else{
       		m_outdata=1;
       	}
           return 0;
       }

};



void my_led_key(
    ap_uint<1> key,      // 按键输入（低有效）
    ap_uint<2>  *led,     // LED 输出
){
#pragma HLS INTERFACE ap_none port=key
#pragma HLS INTERFACE ap_none port=led
#pragma HLS INTERFACE ap_ctrl_none port=return
     static LedPt0 ledPt0;
     static LedPt1 ledPt1;
     ledPt0.m_indata=key;
     ledPt1.m_indata=key;
     ledPt0.OnTick();
     ledPt1.OnTick();
     *led = ledPt1.m_outdata *2 + ledPt0.m_outdata;
}


```
# C版本
## pt_os.h
```c
#ifndef __PT_OS_H__
#define __PT_OS_H__
#define config_max_tasks 3
typedef unsigned short lc_t;
#define LC_INIT(s) s = 0;
#define LC_RESUME(s) switch(s) { case 0:
#define LC_SET(s) s = __LINE__; case __LINE__:
#define LC_END(s) }
#define PT_WAITING 0
#define PT_EXITED  1
#define PT_ENDED   2
#define PT_YIELDED 3
#define PT_INIT(pt)   LC_INIT((pt)->lc)
#define PT_THREAD(name_args) char name_args
#define PT_BEGIN(pt) { char PT_YIELD_FLAG = 1; LC_RESUME((pt)->lc)
#define PT_END(pt) LC_END((pt)->lc); PT_YIELD_FLAG = 0; \
                   PT_INIT(pt); return PT_ENDED; }
#define PT_WAIT_UNTIL(pt, condition)	        \
  do {						\
    LC_SET((pt)->lc);				\
    if(!(condition)) {				\
      return PT_WAITING;			\
    }						\
  } while(0)
#define PT_WAIT_WHILE(pt, cond)  PT_WAIT_UNTIL((pt), !(cond))
#define PT_WAIT_THREAD(pt, thread) PT_WAIT_WHILE((pt), PT_SCHEDULE(thread))
#define PT_SPAWN(pt, child, thread)		\
  do {						\
    PT_INIT((child));				\
    PT_WAIT_THREAD((pt), (thread));		\
  } while(0)

#define PT_RESTART(pt)				\
  do {						\
    PT_INIT(pt);				\
    return PT_WAITING;			\
  } while(0)

#define PT_EXIT(pt)				\
  do {						\
    PT_INIT(pt);				\
    pt->callFunState=0;        \
    return PT_EXITED;			\
  } while(0)
#define PT_SCHEDULE(f) ((f) == PT_WAITING)
#define PT_YIELD(pt)				\
  do {						\
    PT_YIELD_FLAG = 0;				\
    LC_SET((pt)->lc);				\
    if(PT_YIELD_FLAG == 0) {			\
      return PT_YIELDED;			\
    }						\
  } while(0)
#define PT_YIELD_UNTIL(pt, cond)		\
  do {						\
    PT_YIELD_FLAG = 0;				\
    LC_SET((pt)->lc);				\
    if((PT_YIELD_FLAG == 0) || !(cond)) {	\
      return PT_YIELDED;			\
    }						\
  } while(0)

//等待被调用
#define PT_YIELD_UNTIL_CALLED(pt, childId, params) PT_YIELD_UNTIL(pt, pt->callFunState== 1)
//调用其他协程
#define PT_CALL_TASK(pt, childId, params)		\
  do {						\
     pt_os_task[1].callFunState = 1;				\
     pt_os_task[childId].indata=params;			\
     PT_YIELD_UNTIL(pt, pt_os_task[childId].callFunState==0);		\
  } while(0)


struct pt_sem {
    unsigned int count;
};
#define PT_SEM_INIT(s, c) (s)->count = c
#define PT_SEM_WAIT(pt, s)	\
  do {						\
    PT_WAIT_UNTIL(pt, (s)->count > 0);		\
    --(s)->count;				\
  } while(0)
#define PT_SEM_SIGNAL(pt, s) ++(s)->count

/*
 * pt任务中的延时
 */
#define PT_DELAY(v)				\
  do {						\
    pt->delay = v;			\
    PT_WAIT_UNTIL(pt, pt->delay == 0);		\
  } while(0)

#define  WHILE(a) 
typedef struct {
    struct struct_tcb
    {
        unsigned rdy : 1;     //就绪
        unsigned enable : 1;  //启用禁用任务
    }one;
    lc_t lc;  //保存上次执行到的行号
    lc_t delay;//延时计数
    unsigned char step; //状态机步骤
    unsigned long indata;//输入
    unsigned long outdata;//输出
    unsigned char callFunState;//函数运行状态0 未开始 1开始运行
    void  (*task)();
}PT_OS_TCB_TypeDef;

#ifdef __cplusplus 
extern "C"
{
#endif

    void  PtOsTimeTick();
    
    /*
     *   创建协程任务
     */
    int   PtOsTaskCreate(void (*task)(PT_OS_TCB_TypeDef* pt));
    
    /*
     *  非pt任务中的延时
     */
    void  PtOsDelay(unsigned short timeTick);



    unsigned long PtGetIndata();
    void PtSetInData(int taskHandle,unsigned long indata);
    unsigned long PtPopInData();
    int PtPushIndata(int taskHandle, unsigned long indata);


    unsigned long PtGetOutdata(int taskHandle);
    void PtSetOutData(unsigned long outdata);
    unsigned long PtPopOutData(int taskHandle);
    int PtPushOutdata(unsigned long outdata);
    /*
     *   任务列表
     */
    extern  PT_OS_TCB_TypeDef  pt_os_task[config_max_tasks];
    extern unsigned char OSTCBCur;
#ifdef __cplusplus 
}
#endif

#endif


```

## pt_os.c
```c
#include "pt_os.h"

 
unsigned char OSTCBCur;
unsigned char  os_task_index = 0;
PT_OS_TCB_TypeDef pt_os_task[config_max_tasks];
int PtOsTaskCreate(void (*task)(PT_OS_TCB_TypeDef*))
{
	int taskinx = os_task_index++;
	pt_os_task[taskinx].delay = 0;
	pt_os_task[taskinx].one.enable = 1;
	pt_os_task[taskinx].indata = 0;
	pt_os_task[taskinx].outdata = 0;
	pt_os_task[taskinx].task = task;
	pt_os_task[taskinx].callFunState = 0;
	PT_INIT(&pt_os_task[taskinx]);
	return taskinx;
}

void PtOsTimeTick()
{
	for (int i = 0; i < os_task_index; i++) {
		OSTCBCur = i;
		PT_OS_TCB_TypeDef* pt = &pt_os_task[i];
		if (pt->delay == 0) {
			pt->one.rdy = 1;
		}
		else {
			pt->delay = pt->delay - 1;
		}
		if (pt->one.rdy && pt->one.enable) {
			pt->task(pt);
		}
	}
}

void PtOsDelay(unsigned short timeTick) {
	pt_os_task[OSTCBCur].one.rdy = 0;
	pt_os_task[OSTCBCur].delay = timeTick - 1;
}


unsigned long PtGetIndata() {
	return pt_os_task[OSTCBCur].indata;
}

void PtSetInData(int taskHandle, unsigned long indata) {
	pt_os_task[taskHandle].indata = indata;
}

unsigned long PtPopInData() {
	unsigned long v = pt_os_task[OSTCBCur].indata;
	pt_os_task[OSTCBCur].indata = 0;
	return v;
}
int PtPushIndata(int taskHandle, unsigned long indata) {
	if (pt_os_task[taskHandle].indata == 0) {
		pt_os_task[taskHandle].indata = indata;
		return 0;
	}
	return 1;
}

unsigned long PtGetOutdata(int taskHandle) {
	return pt_os_task[taskHandle].outdata;
}

void PtSetOutData(unsigned long outdata) {
	pt_os_task[OSTCBCur].outdata = outdata;
}

unsigned long PtPopOutData(int taskHandle) {
	unsigned long v = pt_os_task[taskHandle].outdata;
	pt_os_task[taskHandle].outdata = 0;
	return v;
}

int PtPushOutdata(unsigned long outdata) {
	if (pt_os_task[OSTCBCur].outdata == 0) {
		pt_os_task[OSTCBCur].outdata = outdata;
		return 0;
	}
	return 1;
}
```