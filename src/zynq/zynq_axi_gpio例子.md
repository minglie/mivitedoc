# BD
![请添加图片描述](./img/7f04a78ecbc44e99a196b2592b906e92.png)
# 目标
1. 按下按键灯灭
2. 松开按键灯亮

# pin.xdc
```markdown
set_property IOSTANDARD LVCMOS33 [get_ports {GPIO_0_tri_io[1]}]
set_property IOSTANDARD LVCMOS33 [get_ports {GPIO_0_tri_io[0]}]
set_property PACKAGE_PIN L14 [get_ports {GPIO_0_tri_io[0]}]
set_property PACKAGE_PIN H15 [get_ports {GPIO_0_tri_io[1]}]
```

# 裸机测试
```c
#include "xparameters.h"
#include "xgpio.h"
#include "sleep.h"

#define GPIO_CH   1           // 通道
#define BTN_MASK  0x1         // bit0 接按键
#define LED_MASK  0x2         // bit1 接 LED

int main(void)
{
    XGpio Gpio;
    int status;
    u32 btn_value;

    // 初始化 GPIO
    status = XGpio_Initialize(&Gpio, XPAR_AXI_GPIO_0_DEVICE_ID);
    if (status != XST_SUCCESS) {
        return XST_FAILURE;
    }

    // 设置方向：bit0 输入，bit1 输出
    XGpio_SetDataDirection(&Gpio, GPIO_CH, 0b01);

    while (1) {
        // 读取按键状态
        btn_value = XGpio_DiscreteRead(&Gpio, GPIO_CH) & BTN_MASK;

        if (btn_value) {
            // 按下时点亮 LED
            XGpio_DiscreteWrite(&Gpio, GPIO_CH, LED_MASK);
        } else {
            // 松开时熄灭 LED
            XGpio_DiscreteWrite(&Gpio, GPIO_CH, 0);
        }
    }
}

```