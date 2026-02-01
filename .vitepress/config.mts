import { defineConfig } from 'vitepress'

export default defineConfig({
    base: '/mivitedoc/',
  title: "minglie",
  description: "my doc",
    lastUpdated: true,
  // 明确指定源文件目录为 docs（和启动命令对应）
  srcDir: 'src',
  themeConfig: {
    editLink: {
      pattern: 'https://github.com/minglie/mivitedoc/edit/main/src/:path'
    },
    nav: [
      { text: '主页', link: '/' },         
      { text: 'zynq', link: '/zynq/' }, 
      { text: 'math', link: '/math/' },
      { text: 'mcu', link: '/mcu/' },
      { text: 'python', link: '/python/' }      
    ],
    sidebar: {
      // 根路径（/）：对应 src/index.md
      '/': [
        {
          text: '主页',
          link: '/',
          items: []
        }
      ],
      // /zynq/ 路径：匹配 src/zynq/ 下的文件
      '/zynq/': [
        {
          text: 'Zynq相关文档',
          items: [
            { text: 'Readme', link: '/zynq/Readme.md' },
            { text: '8位CPU设计m8_cpu', link: '/zynq/8位CPU设计m8_cpu.md' },
            { text: 'AXI_lite', link: '/zynq/AXI_lite.md' },
            { text: 'AtShell', link: '/zynq/AtShell.md' },
            { text: 'Avalon-MM协议', link: '/zynq/Avalon-MM协议.md' },
            { text: 'Avalon-MM总线', link: '/zynq/Avalon-MM总线.md' },
            { text: 'DDS原理与实现', link: '/zynq/DDS原理与实现.md' },
            { text: 'DDS风格脉冲数调制器', link: '/zynq/DDS风格脉冲数调制器.md' },
            { text: 'FPGA中的亚稳态与跨时钟域数据撕裂现象', link: '/zynq/FPGA中的亚稳态与跨时钟域数据撕裂现象.md' },
            { text: 'FPGA数码管驱动模块', link: '/zynq/FPGA数码管驱动模块.md' },
            { text: 'HC165并转串', link: '/zynq/HC165并转串.md' },
            { text: 'HC595串转并', link: '/zynq/HC595串转并.md' },
            { text: 'Makefile文件例子', link: '/zynq/Makefile文件例子.md' },
            { text: 'MingMsl', link: '/zynq/MingMsl.md' },
            { text: 'ModelSim 配合 Makefile 搭建 Verilog 仿真工程', link: '/zynq/ModelSim 配合 Makefile 搭建 Verilog 仿真工程.md' },
            { text: 'PL中断驱动', link: '/zynq/PL中断驱动.md' },
            { text: 'PS IIC读写AT24C64测试', link: '/zynq/PS IIC读写AT24C64测试.md' },
            { text: 'PetaLinux 使用技巧与缓存配置', link: '/zynq/PetaLinux 使用技巧与缓存配置.md' },
            { text: 'PetaLinux的JTAG启动', link: '/zynq/PetaLinux的JTAG启动.md' },
            { text: 'Protothread', link: '/zynq/Protothread.md' },
            { text: 'Tang-Nano-1K移植vio_uart', link: '/zynq/Tang-Nano-1K移植vio_uart.md' },
            { text: 'Verilog串口的寄存器访问模块--vio_uart', link: '/zynq/Verilog串口的寄存器访问模块--vio_uart.md' },
            { text: 'Verilog奇偶通用分频器设计与实现', link: '/zynq/Verilog奇偶通用分频器设计与实现.md' },
            { text: 'Verilog简易的按键消抖模块', link: '/zynq/Verilog简易的按键消抖模块.md' },
            { text: 'Verilog规则和常用模板', link: '/zynq/Verilog规则和常用模板.md' },
            { text: 'Vitis 裸机 JTAG 调试与常用命令', link: '/zynq/Vitis 裸机 JTAG 调试与常用命令.md' },
            { text: 'Vivado中多个ILA一起看的方案', link: '/zynq/Vivado中多个ILA一起看的方案.md' },
            { text: 'Vivado常用IP', link: '/zynq/Vivado常用IP.md' },
            { text: 'Vivado编译流程', link: '/zynq/Vivado编译流程.md' },
            { text: 'Zynq AXI-Lite 总线原理与实现', link: '/zynq/Zynq AXI-Lite 总线原理与实现.md' },
            { text: 'Zynq-7000与Zynq-MPSoC 的 AXI 接口对比', link: '/zynq/Zynq-7000与Zynq-MPSoC 的 AXI 接口对比.md' },
            { text: 'Zynq中级开发七项必修课-第一课：事件采集与FIFO队列', link: '/zynq/Zynq中级开发七项必修课-第一课：事件采集与FIFO队列.md' },
            { text: 'Zynq中级开发七项必修课-第七课-AXI_DMA(PL-PS)', link: '/zynq/Zynq中级开发七项必修课-第七课-AXI_DMA(PL-PS).md' },
            { text: 'Zynq中级开发七项必修课-第三课：S_AXI_GP0 主动访问 PS 地址空间', link: '/zynq/Zynq中级开发七项必修课-第三课：S_AXI_GP0 主动访问 PS 地址空间.md' },
            { text: 'Zynq中级开发七项必修课-第二课：M_AXI_GP0 驱动 AXI-Lite 外设', link: '/zynq/Zynq中级开发七项必修课-第二课：M_AXI_GP0 驱动 AXI-Lite 外设.md' },
            { text: 'Zynq中级开发七项必修课-第六课：AXI DMA (PS→PL) 数据下发', link: '/zynq/Zynq中级开发七项必修课-第六课：AXI DMA (PS→PL) 数据下发.md' },
            { text: 'Zynq中级开发七项必修课-第四课：S_AXI_HP0 高速端口访问 DDR', link: '/zynq/Zynq中级开发七项必修课-第四课：S_AXI_HP0 高速端口访问 DDR.md' },
            { text: 'Zynq中级开发七项必修课-第零课：目录', link: '/zynq/Zynq中级开发七项必修课-第零课：目录.md' },
            { text: 'Zynq中级开发七项必修课第五课：S_AXI_ACP 一致性接口实践', link: '/zynq/Zynq中级开发七项必修课第五课：S_AXI_ACP 一致性接口实践.md' },
            { text: 'Zynq高级开发七项必修课', link: '/zynq/Zynq高级开发七项必修课.md' },
            { text: 'axi_uartlite测试', link: '/zynq/axi_uartlite测试.md' },
            { text: 'cocotb 配合 iverilog 搭建 Verilog 仿真工程', link: '/zynq/cocotb 配合 iverilog 搭建 Verilog 仿真工程.md' },
            { text: 'iverilog 配合 Makefile 搭建 Verilog 仿真工程', link: '/zynq/iverilog 配合 Makefile 搭建 Verilog 仿真工程.md' },
            { text: 'linux常用脚本', link: '/zynq/linux常用脚本.md' },
            { text: 'ming_msl', link: '/zynq/ming_msl.md' },
            { text: 'rtt', link: '/zynq/rtt.md' },
            { text: 'verilog状态机', link: '/zynq/verilog状态机.md' },
            { text: 'verilog的SPI_AD驱动', link: '/zynq/verilog的SPI_AD驱动.md' },
            { text: 'vio_uart的浏览器版上位机', link: '/zynq/vio_uart的浏览器版上位机.md' },
            { text: 'vivado和quartus脚本', link: '/zynq/vivado和quartus脚本.md' },
            { text: 'wsl的安装和常用配置', link: '/zynq/wsl的安装和常用配置.md' },
            { text: 'zynq Linux子系统速查', link: '/zynq/zynq Linux子系统速查.md' },
            { text: 'zynq arm全局计时器和私有定时器', link: '/zynq/zynq arm全局计时器和私有定时器.md' },
            { text: 'zynq_apb总线', link: '/zynq/zynq_apb总线.md' },
            { text: 'zynq_axi_gpio例子', link: '/zynq/zynq_axi_gpio例子.md' },
            { text: 'zynq_iic例子', link: '/zynq/zynq_iic例子.md' },
            { text: 'zynq在PS测用XADC读取外部引脚电压', link: '/zynq/zynq在PS测用XADC读取外部引脚电压.md' },
            { text: 'zynq引脚分配表', link: '/zynq/zynq引脚分配表.md' },
            { text: 'zynq的PL中断', link: '/zynq/zynq的PL中断.md' },
            { text: 'zynq纯PL读取XADC', link: '/zynq/zynq纯PL读取XADC.md' },
            { text: 'zynq读取片内DNA', link: '/zynq/zynq读取片内DNA.md' },
            { text: 'zynq问题笔记', link: '/zynq/zynq问题笔记.md' },
            { text: '一种极简稳定的单线通讯协议---ming_msl', link: '/zynq/一种极简稳定的单线通讯协议---ming_msl.md' },
            { text: '从电子管到CPU', link: '/zynq/从电子管到CPU.md' },
            { text: '使用vio_uart_rpc测试IIC接口的AT24C64 ', link: '/zynq/使用vio_uart_rpc测试IIC接口的AT24C64 .md' },
            { text: '可配置的PWM外设模块', link: '/zynq/可配置的PWM外设模块.md' },
            { text: '基于 AXI-Lite 实现可扩展的硬件函数 RPC 框架（附完整源码）', link: '/zynq/基于 AXI-Lite 实现可扩展的硬件函数 RPC 框架（附完整源码）.md' },
            { text: '基于 rtdef.h 的轻量级设备管理、终端、协程与应用管理框架设计', link: '/zynq/基于 rtdef.h 的轻量级设备管理、终端、协程与应用管理框架设计.md' },
            { text: '基于串口实现可扩展的硬件函数 RPC 框架(附完整 Verilog 源码)', link: '/zynq/基于串口实现可扩展的硬件函数 RPC 框架(附完整 Verilog 源码).md' },
            { text: '增量编码器', link: '/zynq/增量编码器.md' },
            { text: '嵌入式开发', link: '/zynq/嵌入式开发.md' },
            { text: '嵌入式终端AtShell', link: '/zynq/嵌入式终端AtShell.md' },
            { text: '常用接口协议引脚定义', link: '/zynq/常用接口协议引脚定义.md' },
            { text: '按键消抖', link: '/zynq/按键消抖.md' },
            { text: '测试cpu主频', link: '/zynq/测试cpu主频.md' },
            { text: '状态机', link: '/zynq/状态机.md' },
            { text: '状态机的顺序化描述', link: '/zynq/状态机的顺序化描述.md' },
            { text: '状态机顺序化描述——串口与 AXI4 协议流程建模', link: '/zynq/状态机顺序化描述——串口与 AXI4 协议流程建模.md' },
            { text: '用vio_uart测试AT24c256', link: '/zynq/用vio_uart测试AT24c256.md' },
            { text: '用vio_uart测试verilog', link: '/zynq/用vio_uart测试verilog.md' },
            { text: '用网络代替SD卡更新zynq固件', link: '/zynq/用网络代替SD卡更新zynq固件.md' },
            { text: '蚂蚁S9矿板引脚定义', link: '/zynq/蚂蚁S9矿板引脚定义.md' },
            { text: '跨时钟域问题与解决方案', link: '/zynq/跨时钟域问题与解决方案.md' }
          ]
        }
      ],
      // /math/ 路径：匹配 src/math/ 下的文件
      '/math/': [
        {
          text: '数学相关文档',
          items: [
            { text: '首页', link: '/math/index.md' },
            { text: 'nim游戏原理', link: '/math/nim游戏原理.md' },
            { text: '一家人过桥问题', link: '/math/一家人过桥问题.md' },
            { text: '代数基本定理', link: '/math/代数基本定理.md' },
            { text: '代数基本定理最简短的证明', link: '/math/代数基本定理最简短的证明.md' },
            { text: '位姿线性变换与坐标变换', link: '/math/位姿线性变换与坐标变换.md' },
            { text: '倒立摆模型', link: '/math/倒立摆模型.md' },
            { text: '切比雪夫多项式', link: '/math/切比雪夫多项式.md' },
            { text: '初等数论简明教程', link: '/math/初等数论简明教程.md' },
            { text: '实数列上的运算变换定理', link: '/math/实数列上的运算变换定理.md' },
            { text: '容斥定理的非数学归纳证明', link: '/math/容斥定理的非数学归纳证明.md' },
            { text: '对偶原理与蕴含定理', link: '/math/对偶原理与蕴含定理.md' },
            { text: '尺规作图问题', link: '/math/尺规作图问题.md' },
            { text: '平面翻转群', link: '/math/平面翻转群.md' },
            { text: '数字华容道玩法', link: '/math/数字华容道玩法.md' },
            { text: '数学物理公式', link: '/math/数学物理公式.md' },
            { text: '有限状态机的九元组定义', link: '/math/有限状态机的九元组定义.md' },
            { text: '电枢公式--电枢绕线的规律', link: '/math/电枢公式--电枢绕线的规律.md' },
            { text: '离生活最近的数学--换酒定理', link: '/math/离生活最近的数学--换酒定理.md' },
            { text: '等价关系与不变量', link: '/math/等价关系与不变量.md' },
            { text: '简化符号--集合符', link: '/math/简化符号--集合符.md' },
            { text: '线或圆对空间的分割问题', link: '/math/线或圆对空间的分割问题.md' },
            { text: '逻辑对偶蕴含', link: '/math/逻辑对偶蕴含.md' },
            { text: '高斯代数基本定理的一种证明', link: '/math/高斯代数基本定理的一种证明.md' }
          ]
        }
      ],
      '/mcu/': [
        {
          text: 'MCU相关文档',
          items: [
            { text: 'ESP32波特律动oled', link: '/mcu/ESP32 波特律动oled.md' },
            { text: 'IO模拟IIC和SPI接口', link: '/mcu/IO模拟IIC和SPI接口.md' },
            { text: 'Vitis HLS', link: '/mcu/Vitis HLS.md' },
            { text: 'Vitis HLS流水灯测试', link: '/mcu/Vitis HLS流水灯测试.md' },
            { text: 'clion+RP2040-Zero的ws2812', link: '/mcu/clion+RP2040-Zero的ws2812.md' },
            { text: 'iic的SSD3306 OLED在各种平台的例子', link: '/mcu/iic的SSD3306 OLED在各种平台的例子.md' },
            { text: 'j2b描述ModbusRtu协议', link: '/mcu/j2b描述ModbusRtu协议.md' },
            { text: 'j2b描述彩屏字库的存储问题', link: '/mcu/j2b描述彩屏字库的存储问题.md' },
            { text: 'pico-setup-windows使用', link: '/mcu/pico-setup-windows使用.md' },
            { text: 'platformio的esp32版的websocketServer', link: '/mcu/platformio的esp32版的websocketServer.md' },
            { text: 'wsl的安装和常用配置', link: '/mcu/wsl的安装和常用配置.md' },
            { text: '树莓派Pico‌的pio外设输出4M方波', link: '/mcu/树莓派Pico‌的pio外设输出4M方波.md' },
            { text: '树莓派Pico‌的pio的iic的SSD3306', link: '/mcu/树莓派Pico‌的pio的iic的SSD3306.md' },
            { text: '树莓派Pico‌的pio的spi的flash', link: '/mcu/树莓派Pico‌的pio的spi的flash.md' },
            { text: '树莓派Pico‌的pio的uart_rx', link: '/mcu/树莓派Pico‌的pio的uart_rx.md' },
            { text: '树莓派Pico‌的pio的uart_tx', link: '/mcu/树莓派Pico‌的pio的uart_tx.md' },
            { text: '树莓派Pico‌硬件和软件iic的SSD3306', link: '/mcu/树莓派Pico‌硬件和软件iic的SSD3306.md' },
            { text: '一种极简稳定的单线通讯协议---ming_msl', link: '/mcu/一种极简稳定的单线通讯协议---ming_msl.md' },
            { text: '串行通信的FIFO模型', link: '/mcu/串行通信的FIFO模型.md' },
            { text: '基于 rtdef.h 的轻量级设备管理、终端、协程与应用管理框架设计', link: '/mcu/基于 rtdef.h 的轻量级设备管理、终端、协程与应用管理框架设计.md' },
            { text: '字节对齐测试', link: '/mcu/字节对齐测试.md' },
            { text: '嵌入式协程AlarmProtothread', link: '/mcu/嵌入式协程AlarmProtothread.md' },
            { text: '嵌入式协程Protothread', link: '/mcu/嵌入式协程Protothread.md' },
            { text: '嵌入式协程Timethread', link: '/mcu/嵌入式协程Timethread.md' },
            { text: '嵌入式终端AtShell', link: '/mcu/嵌入式终端AtShell.md' },
            { text: '无刷电机三相电流产生的磁场方向', link: '/mcu/无刷电机三相电流产生的磁场方向.md' },
            { text: '杂项', link: '/mcu/杂项.md' },
            { text: '树莓派Pico‌的fifo', link: '/mcu/树莓派Pico‌的fifo.md' },
            { text: '树莓派Pico‌的freeRtos', link: '/mcu/树莓派Pico‌的freeRtos.md' },
            { text: '树莓派Pico‌的pio的dma', link: '/mcu/树莓派Pico‌的pio的dma.md' },
            { text: '树莓派Pico‌的timer', link: '/mcu/树莓派Pico‌的timer.md' },
            { text: '树莓派Pico‌移植Atshell', link: '/mcu/树莓派Pico‌移植Atshell.md' },
            { text: '用JSON 定义二进制结构j2b', link: '/mcu/用JSON 定义二进制结构j2b.md' }
          ]
        }
      ],
      // /python/ 路径：匹配 src/python/ 下的文件
      '/python/': [
        {
          text: 'Python相关文档',
          items: [
            { text: 'python', link: '/python/index.md' },
            { text: 'emsdk安装', link: '/python/emsdk安装.md' },
            { text: 'makefile+wasm的例子', link: '/python/makefile+wasm的例子.md' },
            { text: 'micropython的74hc595数码管显示', link: '/python/micropython的74hc595数码管显示.md' },
            { text: 'micropython的属性式GPIO控制', link: '/python/micropython的属性式GPIO控制.md' },
            { text: 'mingw64 动态库的制作与使用', link: '/python/mingw64 动态库的制作与使用.md' },
            { text: 'pyscript测试', link: '/python/pyscript测试.md' },
            { text: 'rust借用核心', link: '/python/rust借用核心.md' },
            { text: 'rust的串口回环测试', link: '/python/rust的串口回环测试.md' }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://minglie.github.io/mivitedoc/' }
    ],
     search: {
      provider: 'local'
    },
    
  },
   markdown: {
        math: true
    }
})