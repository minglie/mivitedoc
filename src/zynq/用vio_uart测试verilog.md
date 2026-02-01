# 参考

[vio_uart的浏览器版上位机](https://blog.csdn.net/qq_26074053/article/details/156460508)

[基于串口实现可扩展的硬件函数 RPC 框架](https://blog.csdn.net/qq_26074053/article/details/149968390)

[串行通信的FIFO模型](https://blog.csdn.net/qq_26074053/article/details/156197306)

[常用串行通讯波形](https://blog.csdn.net/qq_26074053/article/details/156085974)

[IO模拟IIC和SPI接口](https://blog.csdn.net/qq_26074053/article/details/156420728)

[Tang-Nano-1K移植vio_uart](https://blog.csdn.net/qq_26074053/article/details/156298625)

[vio_uart.j2b.json](https://blog.csdn.net/qq_26074053/article/details/154620732)


[rtdef.h中的设备封装风格](https://blog.csdn.net/qq_26074053/article/details/151149825)

[iverilog仿真Verilog ](https://blog.csdn.net/qq_26074053/article/details/156454926)


# 传统真机测试
测试一个 Verilog 模块，通常需要四个部分：
| 模块          | 说明                                    |
| ----------- | ------------------------------------- |
| **被测模块**    | 待验证的核心逻辑模块           |
| **控制模块**    | 定制化控制被测模块的输入信号和测试流程    |
| **显示/监控模块** | 显示状态或测试结果，例如 LED、LCD、数码管 |
| **顶层连接文件**  | 将被测模块、控制模块和显示模块连接在一起形成完整 FPGA 设计      |


>特点：
>* 被测模块变化时，控制模块和顶层设计往往需要重新修改。
>* 调整测试流程不灵活，修改成本高。
>* 显示/监控模块受硬件资源限制，可视化能力有限。
>* 测试难以脚本化或自动化，重复性低。


# 用 vio_uart 测试 Verilog

>将 FPGA 内部专用的控制和显示逻辑搬到 PC 上，通过通用通信总线 vio_uart 直连被测模块，实现可脚本化、可复用的真机调试流程。
```bash
PC / 上位机 (JS脚本)
┌─────────────────────────────┐
│ 控制模块、测试流程、结果显示   │
│ (统一用 VioUart API 脚本)    │
└───────────────┬─────────────┘
                │串口(6字节定长的vio_uart协议)
                │
                │         
           ┌────▼─────┐
           │ vio_uart │  
           └────┬─────┘
                │←(寄存器/RPC接口连接)
          ┌─────▼────┐
          │ 被测模块  │   
          └──────────┘
```