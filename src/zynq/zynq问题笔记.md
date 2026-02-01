1. processing_system7_0 的 FCLK_CLK0 不输出时钟

> 问题出在没跑fsbl
- 跑 FSBL：Vitis/SDK 下 “Program FPGA” 后，Run → Launch on Hardware (FSBL/ELF)。
- Linux：正常启动 PetaLinux/内核，PS 会配置好 FCLK。
- 手动初始化：XSCT 里执行 ps7_init.tcl / ps7_post_config（由 Vivado/SDK 导出）

**linux里配置**
```shell
# 解锁 SLCR
devmem 0xF8000008 32 0x0000DF0D
# 配置并开启 FCLK0：FPGA0_CLK_CTRL @ 0xF8000170
# 位定义：bit[0]=CLKACT0 使能；DIVISOR/ DIVISOR1 设分频
# 例如：源=IO PLL，经 DIV=5 得 100MHz（举例，请按你的 PLL 频率计算）
devmem 0xF8000170 32 0x00100501   # 示例：开时钟 + 分频设置
# 也可设源/分频：
# 0xF8000168 FPGA0_THRU 选择时钟源
# 0xF8000170 FPGA0_CLK_CTRL 设置分频/使能
# 上锁 SLCR（可选）
devmem 0xF8000004 32 0x0000767B
```