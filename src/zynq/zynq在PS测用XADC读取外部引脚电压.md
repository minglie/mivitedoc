# BD
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/4c77d74cf2ae44c085d1ffc8550db58e.png)
# 目标
1. 读取外部引脚电压并打印
# 裸机测试
```c
#include "xparameters.h"
#include "xadcps.h"
#include "xil_printf.h"
#include "sleep.h"

// ========= 外部通道配置 =========
typedef struct {
    const char* name;   // 打印名
    u32 en_mask;        // 启用掩码 (XADCPS_SEQ_CH_*)
    u8  rd_chan;        // 读取通道 (XADCPS_CH_*)
    float scale;        // 外部分压比例 (无分压=1.0；分压3:1填3.0)
} ext_sensor_t;

static ext_sensor_t sensors[] = {
    { "VPVN",  XADCPS_SEQ_CH_VPVN,  XADCPS_CH_VPVN,  0.333333f }, // 例如外部分压 3:1
};
static const int NUM_SENSORS = sizeof(sensors)/sizeof(sensors[0]);

#define XADC_DEV_ID        XPAR_XADCPS_0_DEVICE_ID
#define XADC_AVG_SAMPLES   XADCPS_AVG_16_SAMPLES   // 1/16/64/256
#define PRINT_INTERVAL_MS  1000

static XAdcPs Xadc;

static void xadc_init_external(void)
{
    XAdcPs_Config *cfg = XAdcPs_LookupConfig(XADC_DEV_ID);
    XAdcPs_CfgInitialize(&Xadc, cfg, cfg->BaseAddress);

    // 先进安全模式再改配置
    XAdcPs_SetSequencerMode(&Xadc, XADCPS_SEQ_MODE_SAFE);

    // 只启用配置的外部通道
    u32 en = 0;
    for (int i = 0; i < NUM_SENSORS; ++i) en |= sensors[i].en_mask;
    XAdcPs_SetSeqChEnables(&Xadc, en);

    // 设置平均
    XAdcPs_SetAvg(&Xadc, XADC_AVG_SAMPLES);

    // 连续采样
    XAdcPs_SetSequencerMode(&Xadc, XADCPS_SEQ_MODE_CONTINPASS);
}

int main(void)
{
    xadc_init_external();

    xil_printf("XADC external channels ready:\r\n");
    for (int i = 0; i < NUM_SENSORS; ++i) {
        xil_printf("  - %s (chan=0x%02x, scale=%.2f)\r\n",
            sensors[i].name, sensors[i].rd_chan, sensors[i].scale);
    }

    while (1) {
        for (int i = 0; i < NUM_SENSORS; ++i) {
            u32 raw = XAdcPs_GetAdcData(&Xadc, sensors[i].rd_chan);
            float v  = XAdcPs_RawToVoltage(raw) * sensors[i].scale;
            printf("%-6s: raw=%5lu  voltage=%.3f V\r\n",
                       sensors[i].name, (unsigned long)raw, v);
        }
        xil_printf("\r\n");
        usleep(PRINT_INTERVAL_MS * 1000);
    }
    return 0;
}

```

# 测试结果
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/76395d12db6c479986acb21e696b4418.png)
