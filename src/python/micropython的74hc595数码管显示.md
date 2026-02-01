# 原理图
![在这里插入图片描述](./img/b9044c59dd234035b408c1d70f493b60.png)
# main.py
```python
from machine import Pin
import time

# 定义引脚
latch_pin = Pin(21, Pin.OUT)
clock_pin = Pin(22, Pin.OUT)
data_pin = Pin(23, Pin.OUT)

# 数码管显示码 (共阳极)
dis_table = [0xC0, 0xF9, 0xA4, 0xB0, 0x99, 0x92, 0x82, 0xF8, 0x80, 0x90]
# 位选码 (控制哪一位数码管亮)
dis_buf = [0xF1, 0xF2, 0xF4, 0xF8]

# 初始化索引
inx = 0


def shift_out(data_pin, clock_pin, value):
    """模拟shiftOut函数，发送一个字节的数据"""
    for i in range(8):
        # 先发送高位
        data_pin.value((value >> (7 - i)) & 1)
        # 时钟脉冲
        clock_pin.value(1)
        clock_pin.value(0)


def display(data):
    """显示数据到4位数码管"""
    global inx
    disbuff = 0

    # 根据当前索引计算要显示的数字位
    if inx == 0:
        disbuff = data // 1000  # 千位
    elif inx == 1:
        disbuff = (data // 100) % 10  # 百位
    elif inx == 2:
        disbuff = (data // 10) % 10  # 十位
    else:
        disbuff = data % 10  # 个位

    # 确保数值在有效范围内
    if disbuff < 0 or disbuff > 9:
        disbuff = 0

    # 发送数据
    latch_pin.value(0)
    shift_out(data_pin, clock_pin, dis_table[disbuff])  # 发送段码
    shift_out(data_pin, clock_pin, dis_buf[inx])  # 发送位码
    latch_pin.value(1)

    # 更新索引
    inx = (inx + 1) % 4


# 主循环
while True:
    display(1567)
    time.sleep_ms(2)

```

# main.cpp
```c
#include <Arduino.h>

int latchPin = 21;
int clockPin =22;
int dataPin = 23; //这里定义了那三个脚




void setup ()
{

    pinMode(latchPin,OUTPUT);
    pinMode(clockPin,OUTPUT);
    pinMode(dataPin,OUTPUT); //让三个脚都是输出状态
}

void display(uint16_t data)
{
    static unsigned char  Dis_table[] = {0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0X80,0X90};	//LED状态显示的变量
    static unsigned char  Dis_buf[]   = {0xF1,0xF2,0xF4,0xF8};
    static  unsigned char disbuff  =0;
    static char i=0;
    switch (i) {
        case 0: disbuff = data / 1000; break;
        case 1: disbuff = (data % 1000) / 100; break;
        case 2: disbuff = (data % 100) / 10; break;
        case 3: disbuff = data % 10; break;
        default: disbuff=0;
    }
    digitalWrite(latchPin,LOW); //将ST_CP口上面加低电平让芯片准备好接收数据
    shiftOut(dataPin,clockPin,MSBFIRST,Dis_table[disbuff]); //发送显示码 0-3
    shiftOut(dataPin,clockPin,MSBFIRST,Dis_buf[i] );  //发送通值													//串行数据输入引脚为dataPin，时钟引脚为clockPin，执行MSB有限发送，发送数据table[i]
    digitalWrite(latchPin,HIGH); //将ST_CP这个针脚恢复到高电平
    i++;
    if(i==4){
        i=0;
    }
}
void loop()
{
    display(1567);
    delay(2);
}

```
