# MingMsl.h
``` cpp
#ifndef MING_ESP32_TC_MINGMSL_H
#define MING_ESP32_TC_MINGMSL_H

#include "stdint.h"

#define MSL_DEBUG_ENABLE  1

// 通信模式枚举
typedef enum {
    MSL_MODE_MASTER = 0,        // 主机模式
    MSL_MODE_SLAVE,             // 从机模式
    MSL_MODE_MASTER_ONLY_SEND,         // 仅发送模式
    MSL_MODE_SLAVE_ONLY_RECEIVE       // 仅接收模式
} MslMode_TypeDef;

// 数据方向枚举
typedef enum {
    MSL_DIR_OUTPUT = 0,         // 输出方向
    MSL_DIR_INPUT              // 输入方向
} MSL_Direction_TypeDef;


//数据方向枚举
typedef enum {
    MSL_EVENT_SEND = 0,         // 发送完成事件
    MSL_EVENT_RECEIVE ,         // 接收完成事件
    MSL_EVENT_ERROR             // 错误事件
} MSL_Event_TypeDef;


typedef int(MslPinRead)(uint8_t id);
typedef void (MslPinWrite)(uint8_t id,uint8_t v);
typedef void (MslPinDir)(uint8_t id,uint8_t v);
//发出事件
typedef void (MslOutEvent)(uint8_t id,MSL_Event_TypeDef eventType, uint32_t data);

class MingMsl {
private:
    uint8_t  m_id;
    //msl的4种工作模式,0:主机,1:从机,2:单向外发 3:单向接收
    MslMode_TypeDef  m_mslMode;
    //配置通信有效位数，只能取2到32的偶数
    uint8_t  m_bitLength;
    //最大位的数值
    uint32_t  m_maxBitValue;
    uint8_t m_rdy;
    uint8_t m_enable;
    uint8_t m_delay;  //延时计数
    uint8_t m_state; //状态机步骤
    //当前位
    uint8_t m_datCur;
    //总线持续高计数
    uint8_t m_waitComHCount;
    //总线持续低计数
    uint8_t m_waitComLCount;
    //发送寄存器
    uint32_t m_txData;
    //发送寄存器暂存
    uint32_t m_txDataTemp;
    //接收寄存器
    uint32_t m_rxData;
    //接收寄存器暂存
    uint32_t m_rxDataTemp;
    //总线电平持续时间计数
    uint8_t m_levelCount;
    //从机不回复
    uint8_t  m_noBack;
    //总线电平高低状态
    uint8_t  m_bitLevelS;
    //通讯错误标志
    uint8_t  m_comErr;
    uint8_t m_debugPinVal;
    //延时函数
    void  MslDelay(uint8_t ticks);
    //主机周期函数
    void  MasterOnTick();
    //从机周期函数
    void  SlaveOnTick();
public:
    //读总线函数
    static MslPinRead   *   readFun;
    //写总线函数
    static MslPinWrite  *   writeFun;
    //调试用
    static MslPinWrite  *   writeDebugFun;
    //设置总线方向
    static MslPinDir    *   dirFun;
    //发出事件
    static MslOutEvent  *   emitEvent;
    //初始化
    void     Init(uint8_t id,MslMode_TypeDef mslMode,uint8_t bitLength);
    //使能
    void     SetEnable(uint8_t enable);
    //获取接收数据
    uint32_t GetReceiveData();
    //发送数据
    void     SendData(uint32_t sendData);
    //获取总线错误标志
    uint8_t  GetComErr();
    //数据交换
    bool  ExchangeData(uint32_t sendData,uint32_t * receiveData);
    //要保证主从调用周期一致,建议用1ms
    void   OnTick();
};


#endif

```

# MingMsl.cpp
``` c++
#include "MingMsl.h"

#define CON_TIMR_TICK_DEBUG 1

MslPinRead * MingMsl::readFun= nullptr;
MslPinWrite * MingMsl::writeFun= nullptr;
MslPinDir * MingMsl::dirFun= nullptr;
MslPinWrite * MingMsl::writeDebugFun= nullptr;
MslOutEvent * MingMsl::emitEvent= nullptr;

void MingMsl::Init(uint8_t id,MslMode_TypeDef mslMode,uint8_t bitLength) {
    m_id=id;
    if(bitLength%2==0){
        m_bitLength=bitLength;
    } else{
        m_bitLength=bitLength+1;
    }
    if(m_bitLength==0){
        m_bitLength=2;
    }
    if(m_bitLength>32){
        m_bitLength=32;
    }
    m_txData=0;
    m_rxData=0;
    m_maxBitValue=((uint32_t)1)<<(m_bitLength-1);
    m_mslMode=mslMode;
    m_state=0;
    m_delay=0;
    m_enable = 1;
    m_debugPinVal=0;
    dirFun(m_id,MSL_DIR_INPUT);
}

bool MingMsl::ExchangeData(uint32_t sendData,uint32_t * receiveData) {
    if(m_comErr||!m_enable){
        return false;
    }
    m_txData=sendData;
    *receiveData=m_rxData;
    return true;
}

void  MingMsl::MslDelay(uint8_t ticks){
    m_rdy =0;
    m_delay =ticks-1;
}

void MingMsl::MasterOnTick() {
    switch (m_state)
    {
        case 0: {
            //初始化发送
            dirFun(m_id,MSL_DIR_OUTPUT);
            writeFun(m_id,0);
            m_txDataTemp = m_txData;
            m_datCur = 0;
            //
            MslDelay(5);
            m_state = 1;
            break;
        }
        case 1: {//拉高延时5个tick准备发送数据
            dirFun(m_id,MSL_DIR_INPUT);
            MslDelay(5);
            m_state = 2;
            break;
        }
        case 2: {//发送第 偶数位(从左数)
            dirFun(m_id,MSL_DIR_OUTPUT);
            writeFun(m_id,0);
            if (m_txDataTemp & m_maxBitValue)
            {
                MslDelay(10);
            }
            else
            {
                MslDelay(5);
            }
            m_txDataTemp <<= 1;
            m_datCur++;
            m_state = 3;
            break;
        }
        case 3: {//发送第 奇数位(从左数)
            dirFun(m_id,MSL_DIR_INPUT);
            if (m_txDataTemp & m_maxBitValue)
            {
                MslDelay(10);
            }
            else
            {
                MslDelay(5);
            }
            m_txDataTemp <<= 1;
            m_datCur++;
            if (m_datCur>m_bitLength + 1) //m_datCur==10, bit[0:9]发送完
            {
                m_levelCount = 0;
                m_datCur = 0;
                if(emitEvent!= nullptr) {
                    emitEvent(m_id, MSL_EVENT_SEND, m_txData);
                }
                //仅发送模式则不接收
                if(m_mslMode==MSL_MODE_MASTER_ONLY_SEND){
                    MslDelay(25); //准备下一次通信
                    m_state = 0;
                    break;
                }
                m_state = 4;
            }
            else
            {
                m_state = 2;
            }
            break;
        }
        case 4: { //////////////////////////////////////
            //开始接收
            dirFun(m_id,MSL_DIR_INPUT);
            if (readFun(m_id))//等待对方发送,对齐
            {
                m_state = 4;
                m_levelCount++; //
                if (m_levelCount>20) //4ms
                {
                    m_levelCount = 0;
                    m_waitComHCount = 0;
                    m_waitComLCount = 0;
                    m_state = 255; //溢出,跳到异常分支
                }
            }
            else
            {
                m_bitLevelS = 0;
                m_rxDataTemp = 0;
                m_datCur = 0;
                m_state = 5;
                m_levelCount = 1; //当前分支也算采集一次
                #if CON_TIMR_TICK_DEBUG==1
                   writeDebugFun(m_id,m_debugPinVal=m_debugPinVal^1);
                #endif
            }
            break;
        }
        case 5: { //////////////////////////////////////
            dirFun(m_id,MSL_DIR_INPUT);
            if (m_bitLevelS == readFun(m_id))
            {
                m_levelCount++;
                if (m_levelCount>20) //4ms溢出
                {
                    m_levelCount = 0;
                    m_waitComHCount = 0;
                    m_waitComLCount = 0;
                    m_state = 255; //溢出,跳到异常分支
                }
            }
            else
            {
                if (m_datCur>0) m_rxDataTemp <<= 1; //如果已经收到一些数据，将得到的数据向左移动
                m_state = 6;
            }
            #if CON_TIMR_TICK_DEBUG==1
              writeDebugFun(m_id,m_debugPinVal=m_debugPinVal^1);
            #endif
            break;
        }
        case 6: { //////////////////////////////////////
            if (m_levelCount >= 8) m_rxDataTemp++; //超过7个tick认为是1
            m_bitLevelS ^= 1;
            m_datCur++;
            if (m_datCur >= m_bitLength) //m_datCur==8说明[0:7]数据已经接收完毕
            {
                m_levelCount = 0;
                m_state = 7;
                m_rxData = m_rxDataTemp;
                if(emitEvent!= nullptr){
                    emitEvent(m_id, MSL_EVENT_RECEIVE, m_rxData);
                }

            }
            else
            {
                m_levelCount = 0;
                m_state = 5; //接收下一位数据
                //这里可采集一次
                if (m_bitLevelS == readFun(m_id)){
                    m_levelCount=1;
                    #if CON_TIMR_TICK_DEBUG==1
                      writeDebugFun(m_id,m_debugPinVal=m_debugPinVal^1);
                    #endif
                }
            }
            break;
        }
        case 7: { //////////////////////////////////////
            dirFun(m_id,MSL_DIR_INPUT);
            if (readFun(m_id) == 0) //等待bit[8]
            {
                m_levelCount++;
                if (m_levelCount>20) //4ms
                {
                    m_levelCount = 0;
                    m_waitComHCount = 0;
                    m_waitComLCount = 0;
                    m_state = 255; //溢出,跳到异常分支
                }
            }
            else
            {
                dirFun(m_id,MSL_DIR_INPUT);
                MslDelay(25); //准备下一次通信
                m_state = 0;
                m_noBack = 0;
            }
            break;
        }
        case 255: { //////////////////////////////////////
            //异常分支
            dirFun(m_id,MSL_DIR_INPUT);
            m_noBack = 1;//主板不回复
            if (readFun(m_id) == 1)
            {
                m_waitComLCount = 0;
                m_waitComHCount++;
                m_state = 255;
                if (m_waitComHCount>20) //持续高4ms,重新发送
                {

                    m_state = 0;
                    m_waitComHCount = 0;
                }
            }
            else
            { //总线被拉低
                m_waitComHCount = 0;
                m_waitComLCount++;
                if (m_waitComLCount>80)//16ms
                {
                    m_comErr = 1; //总线被拉低
                    m_waitComLCount = 0;
                    if(emitEvent!= nullptr){
                        emitEvent(m_id, MSL_EVENT_ERROR, 0);
                    }
                }
            }
            break;
        }
    }
}

void MingMsl::SlaveOnTick() {
    switch (m_state)
    {
        case 0: {
            ////初始化分支
            dirFun(m_id,MSL_DIR_INPUT);
            m_levelCount = 0;
            m_waitComLCount = 0;
            m_waitComHCount = 0;
            m_state = 1;
            break;
        }
        case 1: { //等待起始位
            dirFun(m_id,MSL_DIR_INPUT);
            if (readFun(m_id))
            {
                m_state = 1;
                m_waitComHCount++;
                if (m_waitComHCount>100)//持续拉高100个tick
                {
                    m_state = 0; //重新开始接收
                }
                if (m_waitComLCount >= 2)//检测到大于2个tick以上低电平
                {
                    m_levelCount = 0;
                    m_state = 2;
                }
            }
            else
            {
                m_waitComLCount++;
                m_state = 1;
            }
            break;
        }
        case 2: {//开始接收
            dirFun(m_id,MSL_DIR_INPUT);
            if (readFun(m_id))//等待对方发送,对齐
            {
                m_state = 2;
                m_levelCount++; //
                if (m_levelCount>20) //4ms
                {

                    m_levelCount = 0;
                    m_waitComHCount = 0;
                    m_waitComLCount = 0;
                    m_state = 255; //溢出,跳到异常分支
                }
            }
            else
            {
                m_bitLevelS = 0;
                m_rxDataTemp = 0;
                m_datCur = 0;
                m_state = 3;
                m_levelCount = 1; //当前分支也算采集一次
                #if CON_TIMR_TICK_DEBUG==1
                    writeDebugFun(m_id,m_debugPinVal=m_debugPinVal^1);
                #endif
            }
            break;
        }

        case 3: {
            if (m_bitLevelS == readFun(m_id))
            {
                m_levelCount++;
                if (m_levelCount>20) //4ms溢出
                {
                    m_levelCount = 0;
                    m_waitComHCount = 0;
                    m_waitComLCount = 0;
                    m_state = 255; //溢出,跳到异常分支
                }
            }
            else
            { //m_datCur>0 ,说明已经得到至少1bit数据
                if (m_datCur>0) m_rxDataTemp <<= 1; //将得到的数据向左移动
                m_state = 4;
            }
            #if CON_TIMR_TICK_DEBUG==1
                writeDebugFun(m_id,m_debugPinVal=m_debugPinVal^1);
            #endif
            break;
        }
        case 4: {
            if (m_levelCount >= 8) m_rxDataTemp++; //超过8个tick认为是1
            m_bitLevelS ^= 1;
            m_datCur++;
            if (m_datCur >= m_bitLength) //数据已经接收完毕
            {
                m_levelCount = 0;
                m_state = 5;
                m_rxData = m_rxDataTemp;
                if(emitEvent!= nullptr){
                    emitEvent(m_id, MSL_EVENT_RECEIVE, m_rxData);
                }
            }
            else
            {
                m_levelCount = 0;
                m_state = 3; //接收下一位数据
                //这里可采集一次
                if (m_bitLevelS == readFun(m_id)){
                    m_levelCount=1;
                    #if CON_TIMR_TICK_DEBUG==1
                        writeDebugFun(m_id,m_debugPinVal=m_debugPinVal^1);
                    #endif
                }
            }
            break;
        }
        case 5: {
            dirFun(m_id,MSL_DIR_INPUT);
            if (readFun(m_id) == 0) //等待bit[8]
            {
                m_levelCount++;
                if (m_levelCount>20) //4ms
                {
                    m_levelCount = 0;
                    m_waitComHCount = 0;
                    m_waitComLCount = 0;
                    m_state = 255; //溢出,跳到异常分支
                }
            }
            else
            {
                //仅接收模式则不发送,准备下次接收
                if(m_mslMode==MSL_MODE_SLAVE_ONLY_RECEIVE){
                    m_state = 0;
                    break;
                }
                MslDelay(10); //延时2ms，准备发送
                //初始化发送
                m_txDataTemp = m_txData;
                m_datCur = 0;
                m_state = 6;
            }
            break;
        }

        case 6: {//发送第偶数位(从左数)
            dirFun(m_id,MSL_DIR_OUTPUT);
            writeFun(m_id,0);
            if (m_txDataTemp & m_maxBitValue)
            {
                MslDelay(10);
            }
            else
            {
                MslDelay(5);
            }
            m_txDataTemp <<= 1;
            m_datCur++;
            m_state = 7;
            break;
        }
        case 7: {//发送第奇数位(从左数)
            dirFun(m_id,MSL_DIR_INPUT);
            if (m_txDataTemp & m_maxBitValue)
            {
                MslDelay(10);
            }
            else
            {
                MslDelay(5);
            }
            m_txDataTemp <<= 1;
            m_datCur++;
            if (m_datCur>m_bitLength + 1) //m_datCur==10, bit[0:9]发送完
            {
                m_levelCount = 0;
                m_datCur = 0;
                dirFun(m_id,MSL_DIR_INPUT);
                MslDelay(5);//延时1ms，准备下一次接收
                if(emitEvent!= nullptr){
                    emitEvent(m_id, MSL_EVENT_SEND, m_txData);
                }
                m_state = 0;
            }
            else
            {
                m_state = 6;
            }
            break;

        }
        case 255: { //异常分支
            dirFun(m_id,MSL_DIR_INPUT);
            m_rxData = 0;
            if (readFun(m_id))
            {
                m_waitComLCount = 0;
                m_waitComHCount++;
                m_state = 255;
                if (m_waitComHCount>20) //持续高,重新接收
                {
                    m_state = 0;
                    m_waitComHCount = 0;
                }
            }
            else
            {
                m_waitComHCount = 0;
                m_waitComLCount++;
                if (m_waitComLCount>80)//16ms
                {
                    m_comErr = 1; //总线被拉低
                    m_waitComLCount = 0;
                }
            }
            break;
        }

    }
}

uint8_t MingMsl::GetComErr()
{
    return m_comErr;
}

void MingMsl::SetEnable(uint8_t m_enable){
    this->m_enable = m_enable;
}

uint32_t MingMsl::GetReceiveData(){
    return m_rxData;
}

void  MingMsl::SendData(uint32_t sendData){
    m_txData=sendData;
}

void MingMsl::OnTick() {
    if (m_delay == 0) m_rdy = 1;
    else m_delay--;
    if (!(m_rdy && m_enable))
    {
        return;
    }
    if(m_mslMode==MSL_MODE_MASTER||m_mslMode==MSL_MODE_MASTER_ONLY_SEND){
        MasterOnTick();
    } else{
        SlaveOnTick();
    }
}


```

# UInt32FIFO.h

``` c++
#ifndef UINT32FIFO_H
#define UINT32FIFO_H

#include <cstdint>
#include <cstddef>

class UInt32FIFO {
public:
    static constexpr size_t Capacity = 16;

    UInt32FIFO();

    bool push(uint32_t value);
    bool pop(uint32_t &value);
    bool isEmpty() const;
    bool isFull() const;
    size_t size() const;

    void debugPrint() const;

private:
    uint32_t buffer[Capacity];
    size_t head;
    size_t tail;
    size_t count;
};

#endif // UINT32FIFO_H

```

# UInt32FIFO.cpp

``` c++
#include "UInt32FIFO.h"
#include <iostream>

UInt32FIFO::UInt32FIFO()
        : head(0), tail(0), count(0) {}

bool UInt32FIFO::push(uint32_t value) {
    if (isFull()) return false;
    buffer[tail] = value;
    tail = (tail + 1) % Capacity;
    ++count;
    return true;
}

bool UInt32FIFO::pop(uint32_t &value) {
    if (isEmpty()) return false;
    value = buffer[head];
    head = (head + 1) % Capacity;
    --count;
    return true;
}

bool UInt32FIFO::isEmpty() const {
    return count == 0;
}

bool UInt32FIFO::isFull() const {
    return count == Capacity;
}

size_t UInt32FIFO::size() const {
    return count;
}

void UInt32FIFO::debugPrint() const {
    std::cout << "FIFO [ ";
    for (size_t i = 0, idx = head; i < count; ++i, idx = (idx + 1) % Capacity) {
        std::cout << buffer[idx] << ' ';
    }
    std::cout << "]" << std::endl;
}

```

# main.cpp
``` c++
#include <Arduino.h>
#include "MingMsl.h"
#include "UInt32FIFO.h"

UInt32FIFO s_fifo;

#define MASTER_PIN 15
#define SLAVE_PIN 23

#define MSL0_DEBUG_PIN  12
#define TIME0_TICK_DEBUG_PIN 13
#define TIME1_TICK_DEBUG_PIN 25
#define MSL1_DEBUG_PIN 26

void mslDigitalWriteDebug(uint8_t id, uint8_t v) {
    if(id==0){
        digitalWrite(MSL0_DEBUG_PIN,v);
    } else{
        digitalWrite(MSL1_DEBUG_PIN,v);
    }

}

int mslDigitalRead(uint8_t id) {
    int pin=MASTER_PIN;
    if(id==1){
        pin=SLAVE_PIN;
    }
    return digitalRead(pin);
}

// 实现MslPinWrite函数 - 写入引脚状态
void mslDigitalWrite(uint8_t id, uint8_t v) {
    int pin=MASTER_PIN;
    if(id==1){
        pin=SLAVE_PIN;
    }
    digitalWrite(pin, v);
}

// 实现MslPinDir函数 - 设置引脚方向
void mslPinMode(uint8_t id, uint8_t v) {
    int pin=MASTER_PIN;
    if(id==1){
        pin=SLAVE_PIN;
    }
    if(v==0){
        pinMode(pin, OUTPUT);
    } else{
        pinMode(pin, INPUT_PULLUP);
    }
}

static uint32_t master_sendData = 0;
static uint32_t slave_sendData = 0;
void onMslEvent(uint8_t id,MSL_Event_TypeDef eventType, uint32_t data) {
   if(id==1){
       //将从机接收的数据放入队列
       if(eventType==MSL_EVENT_RECEIVE){
           s_fifo.push(data);
           master_sendData++;
       }
   }
}


MingMsl masterMing_msl;
MingMsl slaveMing_msl;
void IRAM_ATTR onTimer0() {
    static uint8_t v=0;
    v=!v;
    digitalWrite(TIME0_TICK_DEBUG_PIN,v);
    masterMing_msl.OnTick();
}

void IRAM_ATTR onTimer1() {
    static uint8_t v=0;
    v=!v;
    digitalWrite(TIME1_TICK_DEBUG_PIN,v);
    slaveMing_msl.OnTick();
}


hw_timer_t *timer0 = NULL;
hw_timer_t *timer1 = NULL;
void setup() {
    Serial.begin(115200);
    pinMode(MASTER_PIN, INPUT_PULLUP);
    pinMode(SLAVE_PIN, INPUT_PULLUP);

    pinMode(MSL0_DEBUG_PIN, OUTPUT);
    pinMode(TIME0_TICK_DEBUG_PIN, OUTPUT);
    dacWrite(25, 0);
    dacWrite(26, 0);
    pinMode(25, OUTPUT);
    pinMode(26, OUTPUT);

    MingMsl::readFun=mslDigitalRead;
    MingMsl::writeFun=mslDigitalWrite;
    MingMsl::writeDebugFun=mslDigitalWriteDebug;
    MingMsl::dirFun=mslPinMode;
    MingMsl::emitEvent=onMslEvent;

    masterMing_msl.Init(0,MSL_MODE_MASTER_ONLY_SEND,32);
    slaveMing_msl.Init(1,MSL_MODE_SLAVE_ONLY_RECEIVE,32);




    // 初始化定时器：定时器编号 0，预分频器为 80，计数模式递增
    // ESP32 APB 时钟为 80 MHz，除以 80 则为 1 MHz（即 1 tick = 1 us）
    timer0 = timerBegin(0, 80, true);
    // 设定每 1000 us（即 1 ms）触发中断
    timerAttachInterrupt(timer0, &onTimer0, true);       // 绑定 ISR
    timerAlarmWrite(timer0, 1000, true);                // 每 1000us 自动重载
    timerAlarmEnable(timer0);


    timer1 = timerBegin(2, 80, true);
    // 设定每 1000 us（即 1 ms）触发中断
    timerAttachInterrupt(timer1, &onTimer1, true);       // 绑定 ISR
    timerAlarmWrite(timer1, 1000, true);                // 每 1000us 自动重载
    timerAlarmEnable(timer1);

}
void loop() {

    static uint32_t recveiveData = 0;
    masterMing_msl.ExchangeData(master_sendData,&recveiveData);
    slaveMing_msl.ExchangeData( slave_sendData,&recveiveData);
    while (s_fifo.pop(recveiveData)){
        Serial.printf("slaveMing_msl receiveData:%lx \r\n",recveiveData);
    }
}

```

# diagram.json
``` json
{
  "version": 1,
  "author": "Uri Shaked",
  "editor": "wokwi",
  "parts": [
    { "type": "wokwi-esp32-devkit-v1", "id": "esp", "top": 0, "left": 0, "attrs": {} },
    { "type": "wokwi-logic-analyzer", "id": "logic1", "top": 115.55, "left": 288, "attrs": {} }
  ],
  "connections": [
    [ "esp:TX0", "$serialMonitor:RX", "", [] ],
    [ "esp:RX0", "$serialMonitor:TX", "", [] ],
    [ "esp:D15", "logic1:D0", "green", [ "h138.7", "v-14.7" ] ],
    [ "esp:D23", "esp:D15", "green", [ "h61.9", "v91.2", "h-38.4", "v19.2" ] ],
    [ "esp:D12", "logic1:D2", "green", [ "h-43.4", "v109.6", "h297.6", "v-86.4" ] ],
    [ "logic1:D1", "esp:D13", "green", [ "h-38.4", "v86.4", "h-48", "v0", "h-220.8", "v-76.8" ] ],
    [ "esp:D25", "logic1:D3", "green", [ "h-62.6", "v206.3", "h326.4", "v-144" ] ],
    [ "esp:D26", "logic1:D4", "green", [ "h-53", "v158.2", "h326.4", "v-96" ] ]
  ],
  "dependencies": {}
}
```

# platformio.ini
``` shell
[platformio]
src_dir = ./

[env:pico32]
platform = espressif32
board = pico32
framework = arduino

monitor_speed = 115200
monitor_port =COM6
upload_port = COM6
upload_speed = 921600



build_flags =
    -Isrc
    -MMD -MP

build_src_filter = +<src/>
```

# wokwi.toml
``` toml
[wokwi]
version = 1
elf = ".pio/build/pico32/firmware.elf"
firmware = ".pio/build/pico32/firmware.bin"

# Forward http://localhost:8180 to port 80 on the simulated ESP32:
[[net.forward]]
from = "localhost:8180"
to = "target:80"

```