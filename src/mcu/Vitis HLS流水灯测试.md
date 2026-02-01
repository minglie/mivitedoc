# 源文件
## flowingLights.h
```c
#pragma once
#include <ap_int.h>
#define SPEED 100
void flowingLights(ap_uint<4>& leds);
```

## flowingLights.cpp
```c
#include "flowingLights.h"
void flowingLights(ap_uint<4>& leds){
#pragma HLS INTERFACE ap_none port=led
#pragma HLS INTERFACE ap_ctrl_none port=return
	 static ap_uint<32> count = 0;   // 延时计数
	 static ap_uint<4> led_state = 0b1110;
	count++;
	if(count >= SPEED){
		led_state = led_state<<1 | led_state>>3 ;
		count =0;
	}
	leds =led_state;
}

```
# C仿真
## flowingLights_tb.cpp
```c
#include "flowingLights.h"
int main() {
    ap_uint<4> leds;
    for (int i = 0; i < SPEED * 5; i++) {
        flowingLights(leds);
        if (i % SPEED == 0) {
            std::cout << "Cycle " << i << ", leds = "  << leds.to_string(2) << std::endl;
        }
    }
    return 0;
}
```
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/fec929cb78884d8b9eaf76f5a8a0a507.png)
```bash
D:/Xilinx/Vitis_HLS/2020.2/include/floating_point_v7_0_bitacc_cmodel.h:136:0: note: this is the location of the previous definition
 #define __GMP_LIBGMP_DLL 1
 
Cycle 0, leds = 0b1110
Cycle 100, leds = 0b1101
Cycle 200, leds = 0b1011
Cycle 300, leds = 0b0111
Cycle 400, leds = 0b1110
INFO: [SIM 211-1] CSim done with 0 errors.
INFO: [SIM 211-3] *************** CSIM finish ***************
```
## 编译生成flowingLights.v
```
module flowingLights (
        ap_clk,
        ap_rst,
        leds
);
xxxx
endmodule //flowingLights
```

# Vivado 仿真
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/a7eb79610e5445558a1ba07f3b51230a.png)

![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/35e4bae573fe4f0daed021ef24cd02e6.png)

# IP 封装
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/edae24ca7b654b01a32a3c808c3a58a7.png)
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/b4a0be1895ec4dc49c53bd549b34c4a0.png)
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/e404d39a9e484c24b034000603a7cb85.png)
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/e54bcabde4e241f5a2eb38eb8c480079.png)
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/d99b108d4d2645ba8f9d79c2982d24f4.png)
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/25dfce2f9d0d4afe95f5515fda8c872d.png)
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/c687c48711144776a065258341f46bab.png)

# Tang-Nano-1Ks上测试
## 导入脚本
```bash
set src_dir "D:/workspace/gitee/0/ming_tang_nano_1k/hls_led/src"
set rtl_dir "D:/workspace/gitee/0/ming_tang_nano_1k/hls_led/src/rtl"
add_file D:/fpga_progect/flowingLights/hls/flowingLights/solution1/impl/verilog/flowingLights.v
add_file D:/workspace/gitee/0/ming_tang_nano_1k/hls_led/src/rtl/TANG_FPGA_Demo_Top.v
add_file  $src_dir/vio_uart_prj.cst
add_file  $src_dir/vio_uart_prj.sdc
```

## hls_led.cst
```bash
IO_LOC "CLOCK_XTAL_27MHz" 47;
IO_PORT "CLOCK_XTAL_27MHz" IO_TYPE=LVCMOS33 PULL_MODE=UP;


IO_LOC "RESET" 13;
IO_PORT "RESET" IO_TYPE=LVCMOS33 PULL_MODE=UP;


IO_LOC "LED[3]" 40;
IO_PORT "LED[3]" IO_TYPE=LVCMOS33 PULL_MODE=UP DRIVE=8;
IO_LOC "LED[2]" 11;
IO_PORT "LED[2]" IO_TYPE=LVCMOS33 PULL_MODE=UP DRIVE=8;
IO_LOC "LED[1]" 10;
IO_PORT "LED[1]" IO_TYPE=LVCMOS33 PULL_MODE=UP DRIVE=8;
IO_LOC "LED[0]" 9;
IO_PORT "LED[0]" IO_TYPE=LVCMOS33 PULL_MODE=UP DRIVE=8;
```

## hls_led.sdc
```bash
create_clock -name CLOCK_XTAL_27MHz -period 37.037 -waveform {0 18.518} [get_ports {CLOCK_XTAL_27MHz}]
```

## TANG_FPGA_Demo_Top.v
```verilog
module TANG_FPGA_Demo_Top
(
    input CLOCK_XTAL_27MHz,
	input RESET,
    output  [3:0] LED // 110 R, 101 B, 011 G
);


flowingLights u_flowingLights (
    .ap_clk   (CLOCK_XTAL_27MHz),
    .ap_rst(RESET),
    .leds  (LED)
);

endmodule
```