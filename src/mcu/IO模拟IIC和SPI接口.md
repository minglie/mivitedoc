# 相关参考
[常用串行通讯波形](https://blog.csdn.net/qq_26074053/article/details/156085974)

[rtdef.h中的设备封装风格](https://blog.csdn.net/qq_26074053/article/details/151149825)

[iverilog仿真Verilog ](https://blog.csdn.net/qq_26074053/article/details/156454926)

[树莓派Pico‌移植Atshell](https://blog.csdn.net/qq_26074053/article/details/155988710)
# 各种平台操作GPIO的接口对比
>模拟 I²C 不应耦合到任何具体平台的 GPIO API，而应上升到 I²C 语义层进行抽象；
更不应再人为设计一套所谓的“通用 GPIO API”。
通用逻辑集中于 SoftI2C，平台差异封装在 SoftI2cIo 的具体实现中，从而实现通用与差异的解耦、常变与不常变的分离。
人只能约束自己不变，却无法要求外部迁就。

| 体系 / 标准                            | 设置方向                                                          | 设置输出电平                   |
| ---------------------------------- | ------------------------------------------------------------- | ------------------------ |
| **Linux GPIO（libgpiod，用户态）**       | `gpiod_line_request_output()`                                 | `gpiod_line_set_value()` |
| **Linux GPIO（sysfs，废弃）**           | `write("direction")`                                          | `write("value")`         |
| **Linux GPIO（内核 legacy）**          | `gpio_direction_output()`                                     | `gpio_set_value()`       |
| **Linux GPIO（内核 gpiod）**           | `gpiod_direction_output()`                                    | `gpiod_set_value()`      |
| **Zephyr GPIO**                    | `gpio_pin_configure()`                                        | `gpio_pin_set()`         |
| **RT-Thread Pin**                  | `rt_pin_mode()`                                               | `rt_pin_write()`         |
| **STM32 HAL**                      | `HAL_GPIO_Init()`                                             | `HAL_GPIO_WritePin()`    |
| **ESP-IDF**                        | `gpio_set_direction()`                                        | `gpio_set_level()`       |
| **Xilinx Zynq (PS GPIO)**          | `XGpioPs_SetDirectionPin()`<br>`XGpioPs_SetOutputEnablePin()` | `XGpioPs_WritePin()`     |
| **Arduino / Wiring**               | `pinMode()`                                                   | `digitalWrite()`         |
| **Raspberry Pi Pico SDK (RP2040)** | `gpio_init()`<br>`gpio_set_dir()`                             | `gpio_put()`             |
| **ARM CMSIS-Driver（裸机/规范层）**       | `ARM_GPIO_SetDirection()`                                     | `ARM_GPIO_WritePin()`    |
| **MicroPython（machine.Pin）**       | `Pin.init()`                                                  | `Pin.value()`            |
| **NXP MCUXpresso SDK**             | `GPIO_PinInit()`                                              | `GPIO_PinWrite()`        |
| **TI DriverLib**                   | `GPIO_setDirectionMode()`                                     | `GPIO_writePin()`        |


# 通用部分
## IIC
### soft_i2c_io.h 
定义了 I²C GPIO 操作的抽象接口，平台相关的差异全部集中在它的子类实现中，从而保持 SoftI2C 核心逻辑的复用。
```c
#pragma once
#include <cstdint>
class SoftI2cIo
{
public:
    virtual ~SoftI2cIo() = default;
    virtual void init() = 0;   // GPIO初始化
    /* ===== SCL ===== */
    virtual void scl_low() = 0;        // 拉低
    virtual void scl_release() = 0;    // 释放（输入/高阻）
    virtual bool scl_read() const = 0; // 读电平
    /* ===== SDA ===== */
    virtual void sda_low() = 0;
    virtual void sda_release() = 0;
    virtual bool sda_read() const = 0;
    /* ===== 延时 ===== */
    virtual void delay_us(uint32_t us) = 0;
};
```
### SoftI2C.h
```c
#pragma once
#include "soft_i2c_io.h"
/*
 * SoftI2C
 * 物理假设：
 *  - SDA / SCL 为开漏或三态输出
 *  - 总线通过外部或 IOB 上拉电阻拉高
 */
class SoftI2C
{
public:
    /*
     * 构造函数
     * @param io             GPIO 操作抽象（拉低 / 释放 / 读电平）
     * @param halfPeriodUs   I²C 半周期时间（us）
     *
     * 说明：
     *  - 一个完整时钟周期 = 2 * halfPeriodUs
     *  - I²C 速率 ≈ 1 / (2 * halfPeriodUs)
     */
    SoftI2C(SoftI2cIo& io, uint32_t halfPeriodUs);

    /*
     * 初始化 I²C 总线
     * 通常行为：
     *  - SDA、SCL 释放为高电平
     *  - 保证总线处于 idle 状态
     */
    void init();

    /*
     * 判断 I²C 总线是否空闲
     * @return true  : SDA=1 且 SCL=1
     *         false : 总线被占用或异常
     */
    bool busIdle() const;

    /*
     * 产生 I²C START 条件
     *
     * 时序：
     *   SDA: 1 -> 0
     *   SCL: 保持为 1
     */
    void start();

    /*
     * 产生 I²C STOP 条件
     *
     * 时序：
     *   SDA: 0 -> 1
     *   SCL: 保持为 1
     */
    void stop();

    /*
     * 向总线写入 1 bit
     * @param bit  要写入的 bit 值
     *
     * 说明：
     *  - bit=0：SDA 拉低
     *  - bit=1：SDA 释放（由上拉拉高）
     *  - 数据在 SCL 上升沿被从机采样
     */
    void writeBit(bool bit);

    /*
     * 从总线读取 1 bit
     * @return 读取到的 SDA 电平
     *
     * 说明：
     *  - 主机释放 SDA
     *  - 在 SCL 高电平期间采样 SDA
     */
    bool readBit();

    /*
     * 写一个字节（8 bit）到 I²C 总线
     * @param data  要写入的数据
     * @return true  : 从机返回 ACK
     *         false : 从机返回 NACK
     *
     * 时序：
     *  - MSB first
     *  - 第 9 个时钟周期读取 ACK 位
     */
    bool writeByte(uint8_t data);

    /*
     * 从 I²C 总线读取一个字节
     * @param ack  true  : 读完后发送 ACK
     *             false : 读完后发送 NACK
     * @return 读取到的数据
     */
    uint8_t readByte(bool ack);

    /*
     * 连续写操作
     * @param addr7  7 位 I²C 从机地址
     * @param buf    写入数据缓冲区
     * @param len    写入字节数
     * @return true  : 写成功（全部 ACK）
     *         false : 中途 NACK
     */
    bool write(uint8_t addr7, const uint8_t* buf, uint32_t len);

    /*
     * 连续读操作
     * @param addr7  7 位 I²C 从机地址
     * @param buf    读取数据缓冲区
     * @param len    读取字节数
     * @return true  : 读成功
     *         false : 地址阶段 NACK
     */
    bool read(uint8_t addr7, uint8_t* buf, uint32_t len);

    /* ===== 设备探测 ===== */
    /*
     * 探测 I²C 设备是否存在
     * @param addr7  7 位从机地址
     * @return true  : 从机 ACK（设备存在）
     *         false : NACK（设备不存在）
     *
     * 实现原理：
     *  START
     *  → 发送 addr7 + W
     *  → 检查 ACK
     *  → STOP
     */
    bool probe(uint8_t addr7);

private:
    /*
     * 半周期延时
     * 用于构造 SCL 高 / 低时间
     */
    inline void delay() const;

private:
    SoftI2cIo& m_io;            // GPIO 操作抽象（SDA / SCL）
    uint32_t   m_halfPeriodUs;  // I²C 半周期时间（微秒）
};
```
### SoftI2C.cpp
```c
#include "SoftI2C.h"

SoftI2C::SoftI2C(SoftI2cIo& io, uint32_t halfPeriodUs)
        : m_io(io), m_halfPeriodUs(halfPeriodUs)
{

}

void SoftI2C::init() {
    m_io.init();
}

inline void SoftI2C::delay() const
{
    m_io.delay_us(m_halfPeriodUs);
}


bool SoftI2C::busIdle() const
{
    return m_io.scl_read() && m_io.sda_read();
}

/* ===== START / STOP ===== */

void SoftI2C::start()
{
    m_io.sda_release();
    m_io.scl_release();
    delay();

    // SDA: 1 -> 0 while SCL = 1
    m_io.sda_low();
    delay();

    m_io.scl_low();
    delay();
}

void SoftI2C::stop()
{
    m_io.sda_low();
    delay();

    m_io.scl_release();
    delay();

    // SDA: 0 -> 1 while SCL = 1
    m_io.sda_release();
    delay();
}

/* ===== BIT ===== */

void SoftI2C::writeBit(bool bit)
{
    bit ? m_io.sda_release() : m_io.sda_low();

    delay();
    m_io.scl_release();
    delay();

    m_io.scl_low();
    delay();
}

bool SoftI2C::readBit()
{
    m_io.sda_release();
    delay();

    m_io.scl_release();
    delay();

    bool bit = m_io.sda_read();

    m_io.scl_low();
    delay();
    return bit;
}

bool SoftI2C::writeByte(uint8_t data)
{
    for (int i = 7; i >= 0; --i)
        writeBit(data & (1 << i));

    // ACK = 0
    return !readBit();
}

uint8_t SoftI2C::readByte(bool ack)
{
    uint8_t data = 0;

    for (int i = 7; i >= 0; --i)
        if (readBit())
            data |= (1 << i);

    writeBit(!ack); // ACK=0, NACK=1
    return data;
}

bool SoftI2C::write(uint8_t addr7, const uint8_t* buf, uint32_t len)
{
    start();
    if (!writeByte((addr7 << 1) | 0)) {
        stop();
        return false;
    }
    for (uint32_t i = 0; i < len; ++i) {
        if (!writeByte(buf[i])) {
            stop();
            return false;
        }
    }
    stop();
    return true;
}

bool SoftI2C::read(uint8_t addr7, uint8_t* buf, uint32_t len)
{
    start();
    if (!writeByte((addr7 << 1) | 1)) {
        stop();
        return false;
    }
    for (uint32_t i = 0; i < len; ++i) {
        buf[i] = readByte(i + 1 < len); // 最后一个 NACK
    }
    stop();
    return true;
}

bool SoftI2C::probe(uint8_t addr7)
{
    start();
    // 只发地址 + Write 位
    bool ack = writeByte((addr7 << 1) | 0);
    stop();
    return ack;
}

```

## SPI
### soft_spi_io.h
```c
#pragma once
#include <cstdint>


class SoftSpiIo
{
public:
    virtual ~SoftSpiIo() = default;

    virtual void init() = 0;       // GPIO 初始化

    /* ===== SPI 时钟 ===== */
    virtual void sck_low() = 0;
    virtual void sck_high() = 0;
    virtual bool sck_read() const = 0;

    /* ===== SPI 数据 ===== */
    virtual void mosi_low() = 0;
    virtual void mosi_high() = 0;
    virtual bool mosi_read() const = 0; // 可选，用于双向 SPI
    virtual bool miso_read() const = 0;

    /* ===== 片选 ===== */
    virtual void cs_low() = 0;
    virtual void cs_high() = 0;

    /* ===== 延时 ===== */
    virtual void delay_us(uint32_t us) = 0;
};

```
### SoftSPI.h
```c
#pragma once
#include "soft_spi_io.h"
#include <cstdint>

/*
 * SoftSPI
 * 模拟 SPI 总线（软件 SPI / bit-banging SPI）
 * 支持四种 SPI 模式（Mode 0 ~ Mode 3），由 CPOL 和 CPHA 决定
 *
 * SPI 模式说明：
 *  Mode | CPOL | CPHA | 时序说明
 *  -----|------|------|------------------------------
 *   0   |  0   |  0   | 时钟空闲低电平，数据在上升沿采样
 *   1   |  0   |  1   | 时钟空闲低电平，数据在下降沿采样
 *   2   |  1   |  0   | 时钟空闲高电平，数据在下降沿采样
 *   3   |  1   |  1   | 时钟空闲高电平，数据在上升沿采样
 *
 * CPOL (Clock Polarity) : 时钟空闲状态的电平
 *   0 -> 空闲时低电平
 *   1 -> 空闲时高电平
 *
 * CPHA (Clock Phase) : 数据采样沿
 *   0 -> 在第一个时钟沿采样数据
 *   1 -> 在第二个时钟沿采样数据
 *
 * 注意：
 *  - MOSI / MISO 数据的采样时机取决于 SPI 模式
 *  - 片选 CS 需要在每次传输前拉低，传输结束后拉高
 */

class SoftSPI
{
public:
    enum SpiMode {
        MODE0 = 0, // CPOL=0, CPHA=0
        MODE1 = 1, // CPOL=0, CPHA=1
        MODE2 = 2, // CPOL=1, CPHA=0
        MODE3 = 3  // CPOL=1, CPHA=1
    };

    SoftSPI(SoftSpiIo& io, uint32_t halfPeriodUs, SpiMode mode = MODE0);

    void init();

    /* 写一个字节，MSB first */
    void writeByte(uint8_t data);

    /* 读一个字节，MSB first */
    uint8_t readByte();

    /* 写多个字节 */
    void write(const uint8_t* buf, uint32_t len);

    /* 读多个字节 */
    void read(uint8_t* buf, uint32_t len);

    /* 同时写入并读取（全双工 SPI） */
    void transfer(const uint8_t* tx_buf, uint8_t* rx_buf, uint32_t len);

private:
    inline void delay() const;
    inline void clockTick();
    /**
     * 时钟极性
     * @return
     */
    inline bool m_cpol() const { return (m_mode == SpiMode::MODE2 || m_mode == SpiMode::MODE3); }
    /**
     * 时钟相位
     * @return
     */
    inline bool m_cpha() const { return (m_mode == SpiMode::MODE1 || m_mode == SpiMode::MODE3); }

private:
    SoftSpiIo& m_io;
    uint32_t   m_halfPeriodUs;
    SpiMode    m_mode;
};

```
### SoftSPI.cpp
```c
#include "SoftSPI.h"

/* ================= 构造 & 初始化 ================= */

SoftSPI::SoftSPI(SoftSpiIo& io, uint32_t halfPeriodUs, SpiMode mode)
        : m_io(io)
        , m_halfPeriodUs(halfPeriodUs)
        , m_mode(mode)
{
}

void SoftSPI::init()
{
    m_io.init();
    m_io.cs_high();

    // CPOL 决定空闲电平
    if (m_cpol())
        m_io.sck_high();
    else
        m_io.sck_low();
}

/* ================= 基础时序 ================= */

inline void SoftSPI::delay() const
{
    m_io.delay_us(m_halfPeriodUs);
}

/*
 * 产生一个完整 SPI bit 周期：
 *   idle -> active -> idle
 * 不做采样，只管翻转
 */
inline void SoftSPI::clockTick()
{
    if (!m_cpol()) {
        // CPOL = 0 : idle low
        m_io.sck_high();   // active edge
        delay();
        m_io.sck_low();    // back to idle
        delay();
    } else {
        // CPOL = 1 : idle high
        m_io.sck_low();    // active edge
        delay();
        m_io.sck_high();   // back to idle
        delay();
    }
}

/* ================= 写 ================= */

void SoftSPI::writeByte(uint8_t data)
{
    for (int i = 7; i >= 0; --i) {

        // CPHA=0：在时钟前准备数据
        if (!m_cpha()) {
            (data & (1u << i)) ? m_io.mosi_high()
                               : m_io.mosi_low();
        }

        // 一个完整 bit 时钟
        clockTick();

        // CPHA=1：在第一个边沿后准备数据
        if (m_cpha()) {
            (data & (1u << i)) ? m_io.mosi_high()
                               : m_io.mosi_low();
        }
    }
}

/* ================= 读 ================= */

uint8_t SoftSPI::readByte()
{
    uint8_t data = 0;

    for (int i = 7; i >= 0; --i) {

        if (!m_cpha()) {
            /* CPHA = 0
             * 在“第一个有效边沿”采样
             */

            // active edge
            if (!m_cpol())
                m_io.sck_high();
            else
                m_io.sck_low();

            delay();

            if (m_io.miso_read())
                data |= (1u << i);

            // 回到 idle
            if (!m_cpol())
                m_io.sck_low();
            else
                m_io.sck_high();

            delay();
        }
        else {
            /* CPHA = 1
             * 在“第二个有效边沿”采样
             */

            // 第一个边沿（不采样）
            clockTick();

            // 第二个边沿采样
            if (m_io.miso_read())
                data |= (1u << i);
        }
    }

    return data;
}

/* ================= 多字节 ================= */

void SoftSPI::write(const uint8_t* buf, uint32_t len)
{
    for (uint32_t i = 0; i < len; ++i)
        writeByte(buf[i]);
}

void SoftSPI::read(uint8_t* buf, uint32_t len)
{
    for (uint32_t i = 0; i < len; ++i)
        buf[i] = readByte();
}

/* ================= 全双工 ================= */

void SoftSPI::transfer(const uint8_t* tx_buf, uint8_t* rx_buf, uint32_t len)
{
    for (uint32_t i = 0; i < len; ++i) {
        uint8_t tx = tx_buf ? tx_buf[i] : 0;
        uint8_t rx = 0;

        for (int j = 7; j >= 0; --j) {

            // CPHA=0：先放数据
            if (!m_cpha()) {
                (tx & (1u << j)) ? m_io.mosi_high()
                                 : m_io.mosi_low();
            }

            // active edge
            if (!m_cpol())
                m_io.sck_high();
            else
                m_io.sck_low();

            delay();

            // 采样
            if (rx_buf && m_io.miso_read())
                rx |= (1u << j);

            // 回到 idle
            if (!m_cpol())
                m_io.sck_low();
            else
                m_io.sck_high();

            delay();

            // CPHA=1：边沿后放数据
            if (m_cpha()) {
                (tx & (1u << j)) ? m_io.mosi_high()
                                 : m_io.mosi_low();
            }
        }

        if (rx_buf)
            rx_buf[i] = rx;
    }
}

```
# 差异部分

## picoSdk
###  pico_soft_i2c_io.h
```c
#pragma once

#include "soft_i2c_io.h"
#include "hardware/gpio.h"
#include "hardware/timer.h"

/*
 * PicoSoftI2cIo
 * RP2040 GPIO 模拟 I2C 的 IO 实现
 */
class PicoSoftI2cIo : public SoftI2cIo
{
public:
    PicoSoftI2cIo(uint scl_pin, uint sda_pin);
    /* ===== SCL ===== */
    void init() override;
    void scl_low() override;
    void scl_release() override;
    bool scl_read() const override;

    /* ===== SDA ===== */
    void sda_low() override;
    void sda_release() override;
    bool sda_read() const override;

    /* ===== Delay ===== */
    void delay_us(uint32_t us) override;

private:
    uint m_scl;
    uint m_sda;
};
```
###  pico_soft_i2c_io.cpp
```c
#include "pico_soft_i2c_io.h"
#include "hardware/gpio.h"
#include "hardware/timer.h"
PicoSoftI2cIo::PicoSoftI2cIo(uint scl_pin, uint sda_pin)
        : m_scl(scl_pin), m_sda(sda_pin)
{

}


void PicoSoftI2cIo::init() {
    /* GPIO 初始化 */
    gpio_init(m_scl);
    gpio_init(m_sda);
    /*
     * 初始状态：释放总线
     * I2C = 开漏 + 上拉
     */
    gpio_set_dir(m_scl, GPIO_IN);
    gpio_set_dir(m_sda, GPIO_IN);
}


/* ========= SCL ========= */

void PicoSoftI2cIo::scl_low()
{
    gpio_put(m_scl, 0);
    gpio_set_dir(m_scl, GPIO_OUT);
}

void PicoSoftI2cIo::scl_release()
{
    gpio_set_dir(m_scl, GPIO_IN);
}

bool PicoSoftI2cIo::scl_read() const
{
    return gpio_get(m_scl);
}

/* ========= SDA ========= */

void PicoSoftI2cIo::sda_low()
{
    gpio_put(m_sda, 0);
    gpio_set_dir(m_sda, GPIO_OUT);
}

void PicoSoftI2cIo::sda_release()
{
    gpio_set_dir(m_sda, GPIO_IN);
}

bool PicoSoftI2cIo::sda_read() const
{
    return gpio_get(m_sda);
}

/* ========= Delay ========= */

void PicoSoftI2cIo::delay_us(uint32_t us)
{
    busy_wait_us_32(us);
}

```

###  pico_soft_spi_io.h
```c
#pragma once

#include "soft_spi_io.h"
#include "hardware/gpio.h"
#include "hardware/timer.h"

/*
 * PicoSoftSpiIo
 * RP2040 GPIO 软件 SPI 实现
 */
class PicoSoftSpiIo : public SoftSpiIo
{
public:
    PicoSoftSpiIo(uint sck_pin, uint mosi_pin, uint miso_pin, uint cs_pin);

    /* ===== 初始化 ===== */
    void init() override;

    /* ===== SCK ===== */
    void sck_low() override;
    void sck_high() override;
    bool sck_read() const override;

    /* ===== MOSI ===== */
    void mosi_low() override;
    void mosi_high() override;
    bool mosi_read() const override;

    /* ===== MISO ===== */
    bool miso_read() const override;

    /* ===== CS ===== */
    void cs_low() override;
    void cs_high() override;

    /* ===== 延时 ===== */
    void delay_us(uint32_t us) override;

private:
    uint m_sck;
    uint m_mosi;
    uint m_miso;
    uint m_cs;
};

```
###  pico_soft_spi_io.cpp
```c
#include "pico_soft_spi_io.h"

PicoSoftSpiIo::PicoSoftSpiIo(uint sck_pin, uint mosi_pin, uint miso_pin, uint cs_pin)
        : m_sck(sck_pin), m_mosi(mosi_pin), m_miso(miso_pin), m_cs(cs_pin)
{
}

void PicoSoftSpiIo::init() {
    // 初始化 GPIO
    gpio_init(m_sck);
    gpio_init(m_mosi);
    gpio_init(m_miso);
    gpio_init(m_cs);

    // 默认状态：SCK=0, MOSI=0, CS=1, MISO 输入
    gpio_set_dir(m_sck, GPIO_OUT);
    gpio_put(m_sck, 0);

    gpio_set_dir(m_mosi, GPIO_OUT);
    gpio_put(m_mosi, 0);

    gpio_set_dir(m_miso, GPIO_IN);

    gpio_set_dir(m_cs, GPIO_OUT);
    gpio_put(m_cs, 1); // CS 高表示未选中
}

/* ===== SCK ===== */
void PicoSoftSpiIo::sck_low()  { gpio_put(m_sck, 0); }
void PicoSoftSpiIo::sck_high() { gpio_put(m_sck, 1); }
bool PicoSoftSpiIo::sck_read() const { return gpio_get(m_sck); }

/* ===== MOSI ===== */
void PicoSoftSpiIo::mosi_low()  { gpio_put(m_mosi, 0); }
void PicoSoftSpiIo::mosi_high() { gpio_put(m_mosi, 1); }
bool PicoSoftSpiIo::mosi_read() const { return gpio_get(m_mosi); }

/* ===== MISO ===== */
bool PicoSoftSpiIo::miso_read() const { return gpio_get(m_miso); }

/* ===== CS ===== */
void PicoSoftSpiIo::cs_low()  { gpio_put(m_cs, 0); }
void PicoSoftSpiIo::cs_high() { gpio_put(m_cs, 1); }

/* ===== 延时 ===== */
void PicoSoftSpiIo::delay_us(uint32_t us) {
    busy_wait_us_32(us);
}

```

### user/user_atshell.h
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

### user/user_atshell.cpp (硬件串口)
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
//int Bsp_shell_write(uint8_t* buf, uint32_t len, uint32_t timeout) {
//    (void)timeout;
//    return shellTxBuffer.write(buf, len);
//}

int Bsp_shell_write(uint8_t* buf, uint32_t len, uint32_t timeout)
{
    for (uint32_t i = 0; i < len; i++) {
        putchar_raw(buf[i]);
    }
    return len;
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
### user/user_atshell.cpp (usb串口)
```c
#include <stdio.h>
#include "pico/stdlib.h"
#include "hardware/irq.h"
#include "../lib/AtShell.h"


int Bsp_shell_write(uint8_t* buf, uint32_t len, uint32_t timeout)
{
    return printf("%.*s", len, buf);
}


void user_atShell_init(){
    at_init(Bsp_shell_write);
    at_show_version();
}

/* ================= main ================= */
void user_atShell_loop() {
    int ch = getchar_timeout_us(0);
    if (ch != PICO_ERROR_TIMEOUT) {
        uint8_t c = (uint8_t)ch;
        at_import(&c, 1, 0);
    }
    tight_loop_contents();
}
```
### atshell_test_main.cpp
```c
#include "pico/stdlib.h"
#include "lib/AtShell.h"
#include "./user/user_atshell.h"

static int test01(int argc, char** argv)
{
    AT_printf("argc %d:\r\n", argc);
    return 0;
}

int main(void)
{
    stdio_init_all();
    user_atShell_init();
    AT_SHELL_EXPORT(test01, "", test01);
    while (true) {
        user_atShell_loop();
    }
}


```
###   main.cpp
```c
#include "pico/stdlib.h"
#include "SoftI2C.h"
#include "pico_soft_i2c_io.h"
#include "stdio.h"
#define SSD1306_I2C_ADDR            _u(0x3C)

PicoSoftI2cIo i2c_io(5, 4);
SoftI2C i2c(i2c_io,2);

int main() {
    stdio_init_all();
    i2c.init();
    while (true) {
        printf("probe: %d\n", i2c.probe(SSD1306_I2C_ADDR));
        sleep_ms(1000);
    }
}
```

###   diagram.json
```json

{
  "version": 1,
  "author": "wang minglie",
  "editor": "wokwi",
  "parts": [
    {
      "type": "wokwi-pi-pico",
      "id": "pico",
      "top": -137.55,
      "left": 22.8,
      "attrs": { "builder": "pico-sdk" }
    },
    {
      "type": "board-ssd1306",
      "id": "oled1",
      "top": -102.46,
      "left": 221.03,
      "attrs": { "i2cAddress": "0x3c" }
    },
    { "type": "wokwi-vcc", "id": "vcc1", "top": -220.04, "left": 220.8, "attrs": {} },
    { "type": "wokwi-gnd", "id": "gnd1", "top": -201.6, "left": 345, "attrs": {} }
  ],
  "connections": [
    [ "pico:GP0", "$serialMonitor:RX", "", [] ],
    [ "pico:GP1", "$serialMonitor:TX", "", [] ],
    [ "oled1:VCC", "vcc1:VCC", "red", [ "v-28.8", "h-19.05" ] ],
    [ "gnd1:GND", "oled1:GND", "black", [ "v-9.6", "h-86.4" ] ],
    [ "pico:GP4", "oled1:SDA", "green", [ "h-38.4", "v-86.4", "h297.6", "v9.6" ] ],
    [ "pico:GP5", "oled1:SCL", "green", [ "h-67.2", "v-115.2", "h307.2" ] ]
  ],
  "dependencies": {}
}

```

## Arduino
###  arduino_soft_i2c_io.h
```c
#pragma once
#include <cstdint>
#include "soft_i2c_io.h"

class ArduinoSoftI2cIo : public SoftI2cIo {
public:
    ArduinoSoftI2cIo(uint8_t scl_pin = 22, uint8_t sda_pin = 21);

    void init() override;

    /* ===== SCL ===== */
    void scl_low() override;
    void scl_release() override;
    bool scl_read() const override;

    /* ===== SDA ===== */
    void sda_low() override;
    void sda_release() override;
    bool sda_read() const override;

    /* ===== Delay ===== */
    void delay_us(uint32_t us) override;

private:
    uint8_t m_scl;
    uint8_t m_sda;
};

```
###  arduino_soft_i2c_io.cpp
```c
#include "arduino_soft_i2c_io.h"
#include <Arduino.h>

ArduinoSoftI2cIo::ArduinoSoftI2cIo(uint8_t scl_pin, uint8_t sda_pin)
        : m_scl(scl_pin), m_sda(sda_pin) {}

void ArduinoSoftI2cIo::init() {
    // 默认释放（高阻输入 + 内部上拉）
    pinMode(m_scl, INPUT_PULLUP);
    pinMode(m_sda, INPUT_PULLUP);
}

/* ===== SCL ===== */
void ArduinoSoftI2cIo::scl_low() {
    pinMode(m_scl, OUTPUT);
    digitalWrite(m_scl, LOW);
}

void ArduinoSoftI2cIo::scl_release() {
    pinMode(m_scl, INPUT_PULLUP); // 高阻输入 + 上拉
}

bool ArduinoSoftI2cIo::scl_read() const {
    return digitalRead(m_scl);
}

/* ===== SDA ===== */
void ArduinoSoftI2cIo::sda_low() {
    pinMode(m_sda, OUTPUT);
    digitalWrite(m_sda, LOW);
}

void ArduinoSoftI2cIo::sda_release() {
    pinMode(m_sda, INPUT_PULLUP); // 高阻输入 + 上拉
}

bool ArduinoSoftI2cIo::sda_read() const {
    return digitalRead(m_sda);
}

/* ===== Delay ===== */
void ArduinoSoftI2cIo::delay_us(uint32_t us) {
    delayMicroseconds(us);
}

```
### main.cpp
```c
#include <Arduino.h>
#include <stdio.h>
#include "SoftI2c.h"
#include "arduino_soft_i2c_io.h"
#define SSD1306_I2C_ADDR  0x3C

ArduinoSoftI2cIo i2c_io(22, 21);
SoftI2C i2c(i2c_io,2);
void setup() {
    Serial.begin(115200);   // 初始化串口速率
}

void loop() {
    printf("probe: %d\n", i2c.probe(SSD1306_I2C_ADDR));
    delay(100);
}
```

### platformio.ini
```bash
[platformio]
src_dir = ./

[env:pico32]
platform = espressif32
board = pico32
framework = arduino

monitor_speed = 115200
monitor_port =COM35
upload_port = COM35
upload_speed = 921600

; 库依赖，添加 WebSockets 库
; 库依赖，这里我们需要使用 ESPAsyncWebServer 库
lib_deps =
    me-no-dev/ESPAsyncWebServer@^1.2.3


build_flags =
    -Isrc
    -MMD -MP

build_src_filter = +<src/> +<lib/oled>


```
### diagram.json
```json
{
  "version": 1,
  "author": "Uri Shaked",
  "editor": "wokwi",
  "parts": [
    { "type": "wokwi-esp32-devkit-v1", "id": "esp", "top": 0, "left": 0, "attrs": {} },
    {
      "type": "board-ssd1306",
      "id": "oled1",
      "top": 60.74,
      "left": 221.03,
      "attrs": { "i2cAddress": "0x3c" }
    },
    { "type": "wokwi-gnd", "id": "gnd1", "top": 182.4, "left": 220.2, "attrs": {} },
    { "type": "wokwi-vcc", "id": "vcc1", "top": 0.76, "left": 249.6, "attrs": {} }
  ],
  "connections": [
    [ "esp:TX0", "$serialMonitor:RX", "", [] ],
    [ "esp:RX0", "$serialMonitor:TX", "", [] ],
    [ "oled1:GND", "gnd1:GND", "black", [ "v0", "h-86.4", "v76.8" ] ],
    [ "vcc1:VCC", "oled1:VCC", "red", [ "v19.2", "h9.6" ] ],
    [ "oled1:SDA", "esp:D21", "green", [ "v-28.8", "h-143.93", "v28.8" ] ],
    [ "oled1:SCL", "esp:D22", "green", [ "v0" ] ]
  ],
  "dependencies": {}
}
```
### wokwi.toml
```bash
[wokwi]
version = 1
elf = ".pio/build/pico32/firmware.elf"
firmware = ".pio/build/pico32/firmware.bin"

# Forward http://localhost:8180 to port 80 on the simulated ESP32:
[[net.forward]]
from = "localhost:8180"
to = "target:80"

```


## Zynq EMIO GPIO
### zynq_gpio_emio_soft_i2c_io.h
```c
#pragma once
#include <cstdint>
#include "xgpiops.h"
#include "soft_i2c_io.h"
class ZynqGpioEmioSoftI2cIo : public SoftI2cIo
{
public:
    ZynqGpioEmioSoftI2cIo(XGpioPs& gpio,
                      uint32_t scl_pin = 54,
                      uint32_t sda_pin = 55);

    void init() override;

    /* ===== SCL ===== */
    void scl_low() override;
    void scl_release() override;
    bool scl_read() const override;

    /* ===== SDA ===== */
    void sda_low() override;
    void sda_release() override;
    bool sda_read() const override;

    /* ===== Delay ===== */
    void delay_us(uint32_t us) override;


    void gpio_loop_test();

private:
    XGpioPs& m_gpio;
    uint32_t m_scl;
    uint32_t m_sda;
};

```
### zynq_gpio_emio_soft_i2c_io.cpp
```c
#include "xil_types.h"
#include "sleep.h"   // usleep()
#include "zynq_gpio_emio_soft_i2c_io.h"

ZynqGpioEmioSoftI2cIo::ZynqGpioEmioSoftI2cIo(
        XGpioPs& gpio,
        uint32_t scl_pin,
        uint32_t sda_pin)
    : m_gpio(gpio),
      m_scl(scl_pin),
      m_sda(sda_pin)
{
}

void ZynqGpioEmioSoftI2cIo::init()
{

    XGpioPs_SetDirectionPin(&m_gpio, m_scl, 0);
    XGpioPs_SetDirectionPin(&m_gpio, m_sda, 0);
    XGpioPs_SetOutputEnablePin(&m_gpio, m_scl, 0);
    XGpioPs_SetOutputEnablePin(&m_gpio, m_sda, 0);
    XGpioPs_WritePin(&m_gpio, m_scl, 0);
    XGpioPs_WritePin(&m_gpio, m_sda, 0);
}

/* ========= SCL ========= */

void ZynqGpioEmioSoftI2cIo::scl_low()
{
    XGpioPs_SetDirectionPin(&m_gpio, m_scl, 1);
    XGpioPs_SetOutputEnablePin(&m_gpio, m_scl, 1);
    XGpioPs_WritePin(&m_gpio, m_scl, 0);
}

void ZynqGpioEmioSoftI2cIo::scl_release()
{
    XGpioPs_SetOutputEnablePin(&m_gpio, m_scl, 0);
    XGpioPs_SetDirectionPin(&m_gpio, m_scl, 0);
}

bool ZynqGpioEmioSoftI2cIo::scl_read() const
{
    return XGpioPs_ReadPin(&m_gpio, m_scl);
}

/* ========= SDA ========= */

void ZynqGpioEmioSoftI2cIo::sda_low()
{
    XGpioPs_SetDirectionPin(&m_gpio, m_sda, 1);
    XGpioPs_SetOutputEnablePin(&m_gpio, m_sda, 1);
    XGpioPs_WritePin(&m_gpio, m_sda, 0);
}

void ZynqGpioEmioSoftI2cIo::sda_release()
{
    XGpioPs_SetOutputEnablePin(&m_gpio, m_sda, 0);
    XGpioPs_SetDirectionPin(&m_gpio, m_sda, 0);
}

bool ZynqGpioEmioSoftI2cIo::sda_read() const
{
    return XGpioPs_ReadPin(&m_gpio, m_sda);
}

/* ========= Delay ========= */

void ZynqGpioEmioSoftI2cIo::delay_us(uint32_t us)
{
    usleep(us);
}


/**
 *  gpio_测试
 */
void ZynqGpioEmioSoftI2cIo::gpio_loop_test(){
    while (1) {
        /* ===== 输出 0 ===== */
        XGpioPs_SetDirectionPin(&gpiops_inst, m_scl, 1); // 输出
        XGpioPs_SetOutputEnablePin(&gpiops_inst, m_scl, 1);
        XGpioPs_WritePin(&gpiops_inst, m_scl, 0);
        XGpioPs_SetDirectionPin(&gpiops_inst, m_sda, 1);
        XGpioPs_SetOutputEnablePin(&gpiops_inst, m_sda, 1);
        XGpioPs_WritePin(&gpiops_inst, m_sda, 0);

        usleep(10); // 方波低电平持续时间

        /* ===== 输入模式，总线靠上拉 ===== */
        XGpioPs_SetDirectionPin(&gpiops_inst, m_scl, 0); // 输入 = Hi-Z
        XGpioPs_SetOutputEnablePin(&gpiops_inst, m_scl, 0);

        XGpioPs_SetDirectionPin(&gpiops_inst, m_sda, 0);
        XGpioPs_SetOutputEnablePin(&gpiops_inst, m_sda, 0);
        usleep(10); // 方波高电平持续时间（由上拉拉起）
    }
}
```
### main.cpp
```c
#include "stdio.h"
#include "xparameters.h"
#include "xgpiops.h"
#include "SoftI2c.h"
#include "sleep.h"
#include "zynq_gpio_emio_soft_i2c_io.h"

#define GPIOPS_ID XPAR_XGPIOPS_0_DEVICE_ID

#define EMIO_SCL 54
#define EMIO_SDA 55
#define SSD1306_I2C_ADDR  0x3C


XGpioPs gpiops_inst;


int main()
{
    XGpioPs_Config *gpiops_cfg_ptr;
    /* ========= 初始化 PS GPIO ========= */
    gpiops_cfg_ptr = XGpioPs_LookupConfig(GPIOPS_ID);
    XGpioPs_CfgInitialize(&gpiops_inst, gpiops_cfg_ptr,gpiops_cfg_ptr->BaseAddr);
    /* ========= 初始化 SoftI2C ========= */
    ZynqGpioEmioSoftI2cIo i2c_io(gpiops_inst, EMIO_SCL, EMIO_SDA);
    SoftI2C i2c(i2c_io, 10);
    i2c.init();
    while (1) {
        printf("probe: %d\n", i2c.probe(SSD1306_I2C_ADDR));
        usleep(10000);
    }
}
```

### pin.xdc
```bash
set_property PACKAGE_PIN L14 [get_ports {GPIO_EMIO_tri_io[0]}]
set_property IOSTANDARD LVCMOS33 [get_ports {GPIO_EMIO_tri_io[0]}]
set_property PACKAGE_PIN K16 [get_ports {GPIO_EMIO_tri_io[1]}]
set_property IOSTANDARD LVCMOS33 [get_ports {GPIO_EMIO_tri_io[1]}]
```



## Zynq AXI_GPIO
### zynq_axi_gpio_soft_i2c_io.h
```c
#pragma once
#include <cstdint>
#include "xgpio.h"
#include "soft_i2c_io.h"

class ZynqAxiGpioSoftI2cIo : public SoftI2cIo {
public:

    ZynqAxiGpioSoftI2cIo(XGpio& gpio, uint32_t scl_bit = 1, uint32_t sda_bit = 0);

    void init() override;

    /* ===== SCL ===== */
    void scl_low() override;
    void scl_release() override;
    bool scl_read() const override;

    /* ===== SDA ===== */
    void sda_low() override;
    void sda_release() override;
    bool sda_read() const override;

    void delay_us(uint32_t us) override;

private:
    XGpio& m_gpio;
    uint32_t m_scl;
    uint32_t m_sda;

    void set_bit_low(uint32_t bit);
    void set_bit_high_z(uint32_t bit);
    bool read_bit(uint32_t bit) const;
};

```
### zynq_axi_gpio_soft_i2c_io.cpp
```c
#include "zynq_axi_gpio_sodt_i2c_io.h"
#include "sleep.h"

ZynqAxiGpioSoftI2cIo::ZynqAxiGpioSoftI2cIo(XGpio& gpio, uint32_t scl_bit, uint32_t sda_bit)
    : m_gpio(gpio), m_scl(scl_bit), m_sda(sda_bit) {}

void ZynqAxiGpioSoftI2cIo::init() {
    // SCL/SDA 默认高阻（输入=释放）
    u32 dir = XGpio_GetDataDirection(&m_gpio, 1);
    dir |= (1 << m_scl) | (1 << m_sda);
    XGpio_SetDataDirection(&m_gpio, 1, dir);

    // 输出初始值为高
    u32 val = XGpio_DiscreteRead(&m_gpio, 1);
    val |= (1 << m_scl) | (1 << m_sda);
    XGpio_DiscreteWrite(&m_gpio, 1, val);
}

/* ===== SCL ===== */
void ZynqAxiGpioSoftI2cIo::scl_low() { set_bit_low(m_scl); }
void ZynqAxiGpioSoftI2cIo::scl_release() { set_bit_high_z(m_scl); }
bool ZynqAxiGpioSoftI2cIo::scl_read() const { return read_bit(m_scl); }

/* ===== SDA ===== */
void ZynqAxiGpioSoftI2cIo::sda_low() { set_bit_low(m_sda); }
void ZynqAxiGpioSoftI2cIo::sda_release() { set_bit_high_z(m_sda); }
bool ZynqAxiGpioSoftI2cIo::sda_read() const { return read_bit(m_sda); }

/* ===== Delay ===== */
void ZynqAxiGpioSoftI2cIo::delay_us(uint32_t us) { usleep(us); }

/* ===== 私有方法 ===== */
void ZynqAxiGpioSoftI2cIo::set_bit_low(uint32_t bit) {
    u32 val = XGpio_DiscreteRead(&m_gpio, 1);
    val &= ~(1 << bit);
    XGpio_DiscreteWrite(&m_gpio, 1, val);

    // 设置为输出
    u32 dir = XGpio_GetDataDirection(&m_gpio, 1);
    dir &= ~(1 << bit);
    XGpio_SetDataDirection(&m_gpio, 1, dir);
}

void ZynqAxiGpioSoftI2cIo::set_bit_high_z(uint32_t bit) {
    u32 dir = XGpio_GetDataDirection(&m_gpio, 1);
    dir |= (1 << bit);
    XGpio_SetDataDirection(&m_gpio, 1, dir);
}

bool ZynqAxiGpioSoftI2cIo::read_bit(uint32_t bit) const {
    u32 val = XGpio_DiscreteRead(const_cast<XGpio*>(&m_gpio), 1);
    return (val & (1 << bit)) != 0;
}

```
### main.cpp
```c
#include "stdio.h"
#include "xparameters.h"
#include "xgpio.h"
#include "sleep.h"
#include "SoftI2c.h"
#include <xil_printf.h>
#include "zynq_axi_gpio_sodt_i2c_io.h"

#define AXO_GPIO_SCL 1
#define AXO_GPIO_SDA 0
#define SSD1306_I2C_ADDR  0x3C

#define AXI_GPIO_DEVICE_ID XPAR_AXI_GPIO_0_DEVICE_ID

int main() {
    int status;
    XGpio Gpio;
    xil_printf("AXI GPIO SoftI2C Test Start\r\n");
    // 初始化 AXI GPIO
    status = XGpio_Initialize(&Gpio, AXI_GPIO_DEVICE_ID);
    if (status != XST_SUCCESS) {
        xil_printf("GPIO Init Failed\r\n");
        return XST_FAILURE;
    }

    // 创建 SoftI2C 实例
    ZynqAxiGpioSoftI2cIo i2c_io(Gpio, AXO_GPIO_SCL, AXO_GPIO_SDA); // SCL=1, SDA=0
    SoftI2C i2c(i2c_io, 10);
    i2c.init();

    xil_printf("Start toggling SCL/SDA...\r\n");

    while (1) {
    	  printf("probe: %d\n", i2c.probe(SSD1306_I2C_ADDR));
         usleep(10000);
    }

    return 0;
}

```

### pin.xdc
```bash
set_property IOSTANDARD LVCMOS33 [get_ports {AXI_GPIO_tri_io[0]}]
set_property PACKAGE_PIN L14 [get_ports {AXI_GPIO_tri_io[0]}]

set_property IOSTANDARD LVCMOS33 [get_ports {AXI_GPIO_tri_io[1]}]
set_property PACKAGE_PIN K16 [get_ports {AXI_GPIO_tri_io[1]}]


set_property IOSTANDARD LVCMOS33 [get_ports {AXI_GPIO_tri_io[2]}]
set_property PACKAGE_PIN H15 [get_ports {AXI_GPIO_tri_io[2]}]

set_property IOSTANDARD LVCMOS33 [get_ports {AXI_GPIO_tri_io[3]}]
set_property PACKAGE_PIN L15 [get_ports {AXI_GPIO_tri_io[3]}]

```

# 测试

参考  [树莓派Pico‌移植Atshell](https://blog.csdn.net/qq_26074053/article/details/155988710)
## IIC_EEROM 读写测试(AT24C256 )
### main.cpp
```c
#include "pico/stdlib.h"
#include "SoftI2C.h"
#include "pico_soft_i2c_io.h"
#include "./user/user_atshell.h"
#include "./lib/AtShell.h"
#define AT24C256_ADDR 0x50
#define PAGE_SIZE 64
#define EEPROM_SIZE 32768

// GPIO 配置
PicoSoftI2cIo i2c_io(5, 4);
SoftI2C i2c(i2c_io, 2);   // 延时参数 2，可调

// ---------- 单字节操作 ----------
bool eeprom_write_byte(uint16_t addr, uint8_t data) {
    uint8_t buf[3];
    buf[0] = addr >> 8;
    buf[1] = addr & 0xFF;
    buf[2] = data;
    if (!i2c.write(AT24C256_ADDR, buf, 3)) return false;
    sleep_ms(10); // EEPROM 内部写延时
    return true;
}

bool eeprom_read_byte(uint16_t addr, uint8_t *data) {
    uint8_t buf[2];
    buf[0] = addr >> 8;
    buf[1] = addr & 0xFF;
    if (!i2c.write(AT24C256_ADDR, buf, 2)) return false;
    return i2c.read(AT24C256_ADDR, data, 1);
}

// ---------- 多字节操作（跨页自动处理） ----------
bool eeprom_write_page(uint16_t addr, uint8_t *data, uint16_t len) {
    uint16_t offset = 0;
    while (offset < len) {
        uint16_t page_offset = addr % PAGE_SIZE;
        uint16_t bytes_in_page = PAGE_SIZE - page_offset;
        uint16_t write_len = (len - offset < bytes_in_page) ? len - offset : bytes_in_page;

        uint8_t buf[2 + PAGE_SIZE]; // 高低地址 + 数据
        buf[0] = addr >> 8;
        buf[1] = addr & 0xFF;
        for (uint16_t i = 0; i < write_len; i++) buf[2 + i] = data[offset + i];

        if (!i2c.write(AT24C256_ADDR, buf, 2 + write_len)) return false;
        sleep_ms(10); // EEPROM 内部写延时

        offset += write_len;
        addr += write_len;
    }
    return true;
}

bool eeprom_read_bytes(uint16_t addr, uint8_t *data, uint16_t len) {
    uint8_t buf[2];
    buf[0] = addr >> 8;
    buf[1] = addr & 0xFF;
    if (!i2c.write(AT24C256_ADDR, buf, 2)) return false;
    return i2c.read(AT24C256_ADDR, data, len);
}


void testAT24C256(){
    i2c.init();
    sleep_ms(1000);
    AT_printf("AT24C256 SoftI2C Demo: Single-byte & Multi-byte Test\n");
    // 探测 EEPROM
    if (!i2c.probe(AT24C256_ADDR)) {
        AT_printf("EEPROM not found!\n");
        while (1) sleep_ms(1000);
    }

    // ---------------- 单字节测试 ----------------
    uint16_t test_addr = 0x0010;
    uint8_t test_data = 0x5A;
    uint8_t read_back;

    AT_printf("\n== Single-byte Test ==\n");
    AT_printf("Writing 0x%02X to 0x%04X...\n", test_data, test_addr);
    if (eeprom_write_byte(test_addr, test_data)) {
        AT_printf("Write OK\n");
    } else {
        AT_printf("Write Failed!\n");
    }

    if (eeprom_read_byte(test_addr, &read_back)) {
        AT_printf("Read back: 0x%02X\n", read_back);
    } else {
        AT_printf("Read Failed!\n");
    }

    // ---------------- 多字节测试 ----------------
    AT_printf("\n== Multi-byte Test ==\n");
    uint16_t page_addr = 0x0100;
    uint8_t write_buf[PAGE_SIZE];
    for (int i = 0; i < PAGE_SIZE; i++) write_buf[i] = i + 1; // 写入数据 1~64

    AT_printf("Writing %d bytes starting at 0x%04X...\n", PAGE_SIZE, page_addr);
    if (eeprom_write_page(page_addr, write_buf, PAGE_SIZE)) {
        AT_printf("Page write OK\n");
    } else {
        AT_printf("Page write Failed!\n");
    }
    uint8_t read_buf[PAGE_SIZE];
    if (eeprom_read_bytes(page_addr, read_buf, PAGE_SIZE)) {
        AT_printf("Read back page:\n");
        for (int i = 0; i < PAGE_SIZE; i++) {
            AT_printf("%02X ", read_buf[i]);
            if ((i+1)%16 == 0) AT_printf("\n");
        }
    } else {
        AT_printf("Page read Failed!\n");
    }
}


// ---------- ATShell 命令 ----------
static int do_test_at24c256 = 0;
static int test01(int argc, char** argv)
{
    do_test_at24c256=1;
    return 0;
}


// ---------- 主函数 ----------
int main() {
    stdio_init_all();
    user_atShell_init();
    AT_SHELL_EXPORT(test01, "", test01);
    while (1) {
        if(do_test_at24c256){
            do_test_at24c256=0;
            testAT24C256();
        }
    }
}

```
### 输出
```bash
[23:15:03.638]发→◇3
□
[23:15:03.641]收←◆3
$:
[23:15:04.641]收←◆AT24C256 SoftI2C Demo: Single-byte & Multi-byte Test
== Single-byte Test ==
Writing 0x5A to 0x0010...
Write OK
Read back: 0x5A

== Multi-byte Test ==
Writing 64 bytes starting at 0x0100...
Page write OK
Read back page:
01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F 10 
11 12 13 14 15 16 17 18 19 1A 1B 1C 1D 1E 1F 20 
21 22 23 24 25 26 27 28 29 2A 2B 2C 2D 2E 2F 30 
31 32 33 34 35 36 37 38 39 3A 3B 3C 3D 3E 3F 40 
```
## SPI_FLASH 读写测试(W25Q16)
### main.cpp
```c
#include "pico/stdlib.h"
#include "SoftSPI.h"
#include "pico_soft_spi_io.h"
#include "./user/user_atshell.h"
#include "./lib/AtShell.h"

// ---------- SPI Flash 配置 ----------
PicoSoftSpiIo spi_io(5, 4, 6, 7); // CS, SCLK, MOSI, MISO
SoftSPI spi(spi_io, 10, SoftSPI::MODE0); // 半周期 100 tick，保证稳定

#define W25Q_PAGE_SIZE   256
#define W25Q_SECTOR_SIZE 4096

// ---------- SPI Flash 基础操作 ----------
bool w25q_write_enable() {
    spi_io.cs_low();
    spi.writeByte(0x06); // Write Enable
    spi_io.cs_high();
    sleep_us(50);        // 延迟确保生效
    return true;
}

uint8_t w25q_read_status() {
    spi_io.cs_low();
    spi.writeByte(0x05); // Read Status1
    uint8_t status = spi.readByte();
    spi_io.cs_high();
    return status;
}

void w25q_wait_busy() {
    uint32_t timeout = 1000000;
    while((w25q_read_status() & 0x01) && timeout--) {
        sleep_us(50);
    }
    if(timeout == 0) AT_printf("Warning: W25Q busy timeout!\n");
}

// ---------- 擦除扇区 ----------
bool w25q_sector_erase(uint32_t addr) {
    addr &= ~(W25Q_SECTOR_SIZE-1); // 扇区地址对齐
    w25q_write_enable();
    spi_io.cs_low();
    spi.writeByte(0x20); // Sector Erase
    spi.writeByte((addr >> 16) & 0xFF);
    spi.writeByte((addr >> 8) & 0xFF);
    spi.writeByte(addr & 0xFF);
    spi_io.cs_high();
    sleep_us(50);
    w25q_wait_busy();
    return true;
}

// ---------- 页写（支持 SoftSPI） ----------
bool w25q_page_program(uint32_t addr, const uint8_t* buf, uint32_t len) {
    if(len > W25Q_PAGE_SIZE) len = W25Q_PAGE_SIZE;

    w25q_write_enable();
    spi_io.cs_low();
    spi.writeByte(0x02); // Page Program
    spi.writeByte((addr >> 16) & 0xFF);
    spi.writeByte((addr >> 8) & 0xFF);
    spi.writeByte(addr & 0xFF);

    // SoftSPI 写入每个字节
    for(uint32_t i=0; i<len; i++) {
        spi.writeByte(buf[i]);
        sleep_us(1); // 确保 Flash 接收
    }

    spi_io.cs_high();
    sleep_us(50);
    w25q_wait_busy();
    return true;
}

bool w25q_read_data(uint32_t addr, uint8_t* buf, uint32_t len) {
    spi_io.cs_low();

    spi.writeByte(0x03);               // Read Data
    spi.writeByte(addr >> 16);
    spi.writeByte(addr >> 8);
    spi.writeByte(addr);
    for (uint32_t i = 0; i < len; i++) {
        buf[i] = spi.readByte();
    }
    spi_io.cs_high();
    return true;
}

// ---------- 读芯片 ID ----------
uint32_t w25q_read_id() {
    spi_io.cs_low();
    spi.writeByte(0x9F);
    uint8_t m = spi.readByte();
    uint8_t t = spi.readByte();
    uint8_t c = spi.readByte();
    spi_io.cs_high();
    return (m << 16) | (t << 8) | c;
}

// ---------- 测试函数 ----------
void testW25Q() {
    spi.init();
    sleep_ms(500);
    AT_printf("W25Q SoftSPI Demo: Read/Write Test\n");

    // 读 ID
    uint32_t id = w25q_read_id();
    AT_printf("Chip ID: 0x%06X\n", id);

    // ---------------- 单字节测试 ----------------
    uint32_t test_addr = 0x000010;
    uint8_t test_data = 0x5A;
    uint8_t read_back;

    AT_printf("\n== Single-byte Test ==\n");
    w25q_sector_erase(test_addr);
    w25q_page_program(test_addr, &test_data, 1);
    w25q_read_data(test_addr, &read_back, 1);
    AT_printf("Written: 0x%02X, Read back: 0x%02X\n", test_data, read_back);

    // ---------------- 多字节测试 ----------------
    AT_printf("\n== Multi-byte Test ==\n");
    uint32_t page_addr = 0x001000;
    uint8_t write_buf[W25Q_PAGE_SIZE];
    for(int i=0; i<W25Q_PAGE_SIZE; i++) write_buf[i] = i+1;

    w25q_sector_erase(page_addr);
    w25q_page_program(page_addr, write_buf, W25Q_PAGE_SIZE);

    uint8_t read_buf[W25Q_PAGE_SIZE];
    w25q_read_data(page_addr, read_buf, W25Q_PAGE_SIZE);

    AT_printf("Read back page:\n");
    for(int i=0; i<W25Q_PAGE_SIZE; i++) {
        AT_printf("%02X ", read_buf[i]);
        if((i+1)%16 == 0) AT_printf("\n");
    }
}

// ---------- ATShell 命令 ----------
static int do_test_w25q = 0;
static int test01(int argc, char** argv) {
    do_test_w25q = 1;
    return 0;
}

// ---------- 主函数 ----------
int main() {
    stdio_init_all();
    user_atShell_init();
    AT_SHELL_EXPORT(test01, "", test01);

    while(1) {
        if(do_test_w25q) {
            do_test_w25q = 0;
            testW25Q();
        }
    }
}
```
### 输出
```bash
\ \ | /
- AT_SHELL - Jan  8 2026  msh:1 
 / | \

$:3
$:W25Q SoftSPI Demo: Read/Write Test
Chip ID: 0xEF4015

== Single-byte Test ==
Written: 0x5A, Read back: 0x5A

== Multi-byte Test ==
Read back page:
01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F 10 
11 12 13 14 15 16 17 18 19 1A 1B 1C 1D 1E 1F 20 
21 22 23 24 25 26 27 28 29 2A 2B 2C 2D 2E 2F 30 
31 32 33 34 35 36 37 38 39 3A 3B 3C 3D 3E 3F 40 
41 42 43 44 45 46 47 48 49 4A 4B 4C 4D 4E 4F 50 
51 52 53 54 55 56 57 58 59 5A 5B 5C 5D 5E 5F 60 
61 62 63 64 65 66 67 68 69 6A 6B 6C 6D 6E 6F 70 
71 72 73 74 75 76 77 78 79 7A 7B 7C 7D 7E 7F 80 
81 82 83 84 85 86 87 88 89 8A 8B 8C 8D 8E 8F 90 
91 92 93 94 95 96 97 98 99 9A 9B 9C 9D 9E 9F A0 
A1 A2 A3 A4 A5 A6 A7 A8 A9 AA AB AC AD AE AF B0 
B1 B2 B3 B4 B5 B6 B7 B8 B9 BA BB BC BD BE BF C0 
C1 C2 C3 C4 C5 C6 C7 C8 C9 CA CB CC CD CE CF D0 
D1 D2 D3 D4 D5 D6 D7 D8 D9 DA DB DC DD DE DF E0 
E1 E2 E3 E4 E5 E6 E7 E8 E9 EA EB EC ED EE EF F0 
F1 F2 F3 F4 F5 F6 F7 F8 F9 FA FB FC FD FE FF 00 
```