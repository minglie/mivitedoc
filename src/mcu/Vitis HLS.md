# 参考
[Vitis HLS流水灯测试](https://blog.csdn.net/qq_26074053/article/details/156329662)

[嵌入式协程Protothread](https://blog.csdn.net/qq_26074053/article/details/152075556)

[常用串行通讯的vcd波形](https://blog.csdn.net/qq_26074053/article/details/156085974)
# 按下亮,松开灭
## 单函数实现
```c
#include <ap_int.h>
void my_led_key(
    ap_uint<1> key,      // 按键输入
    ap_uint<1> *led      // LED 输出
){
	#pragma HLS INTERFACE ap_none port=key
	#pragma HLS INTERFACE ap_none port=led
	#pragma HLS INTERFACE ap_ctrl_none port=return
	if(key == 1){
		*led = 1;
	}
	else{
		*led = 0;
	}
}
```
## class 实现
```c
#include <ap_int.h>

class LEDController {
public:
    ap_uint<1> led_state;

    LEDController() : led_state(0) {}  // 构造函数初始化 LED

    // 更新 LED，根据按键状态
    void update(ap_uint<1> key) {
        if(key == 1){
            led_state = 1;
        }
        else{
            led_state = 0;
        }
    }

    ap_uint<1> get_state() const {
        return led_state;
    }

};

// 顶层 HLS 函数
void my_led_key(ap_uint<1> key, ap_uint<1> *led) {
#pragma HLS INTERFACE ap_none port=key
#pragma HLS INTERFACE ap_none port=led
#pragma HLS INTERFACE ap_ctrl_none port=return
     static LEDController led_ctrl;  // 静态对象保存状态
     led_ctrl.update(key);           // 根据按键更新状态
    *led = led_ctrl.get_state(); // 输出到物理 LED
}

```
## 输出
```verilog
`timescale 1 ns / 1 ps 
module my_led_key (
        key,
        led
);
input  [0:0] key;
output  [0:0] led;
assign led = key;
endmodule //my_led_key
```
# 按下闪,松开灭
## 单函数实现
```c
#include <ap_int.h>

#define DELAY 5000000  // 延时计数，可根据 FPGA 时钟和闪烁速度调整

void my_led_key(
    ap_uint<1> key,      // 按键输入（低有效）
    ap_uint<1> *led,     // LED 输出
){
#pragma HLS INTERFACE ap_none port=key
#pragma HLS INTERFACE ap_none port=led
#pragma HLS INTERFACE ap_ctrl_none port=return
    static ap_uint<32> cnt = 0;   // 延时计数
    static ap_uint<1> led_state = 0;
    if(key == 0){ // 按键按下
        if(cnt < DELAY){
            cnt++;
        } else {
            cnt = 0;
            led_state = ~led_state; // 翻转 LED
        }
    } else {
        cnt = 0;
        led_state = 0; // LED 熄灭
    }
    *led = led_state;
}
```

## Protothread实现
 协程0产生不规则方波, 协程1 按键按下闪烁,松手熄灭
 ![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/50b4634525b644b4b2e273321caf2840.png)
### Protothread.h
不要用虚函数、动态指针、break/continue 等不可综合或时序不确定的写法，循环、数据类型和结构都要可静态展开、可预测。
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

### 串口发送
```c

#include <ap_int.h>
#include "Protothread.h"

#define CLK_FREQ   27000000   // 27MHz
#define BAUD_RATE  115200
#define BAUD_CNT   5
class UartTxPt : public Protothread {
public:
	ap_uint<8> txData;
	bool done;
public:
	__ON_TICK__
	bool Run() {
         WHILE(1) {
        	m_outdata=0;
			PT_DELAY(BAUD_CNT);
			m_outdata=txData>>0;
			PT_DELAY(BAUD_CNT);
			m_outdata=txData>>1;
			PT_DELAY(BAUD_CNT);
			m_outdata=txData>>2;
			PT_DELAY(BAUD_CNT);
			m_outdata=txData>>3;
			PT_DELAY(BAUD_CNT);
			m_outdata=txData>>4;
			PT_DELAY(BAUD_CNT);
			m_outdata=txData>>5;
			PT_DELAY(BAUD_CNT);
			m_outdata=txData>>6;
			PT_DELAY(BAUD_CNT);
			m_outdata=txData>>7;
			PT_DELAY(BAUD_CNT);
			m_outdata=1;
			PT_DELAY(BAUD_CNT);
		    done=true;
         }
         PT_END();
    }

};




void my_led_key(
    ap_uint<8>  data,
	ap_uint<1>   *txd
) {

#pragma HLS INTERFACE ap_none port=data
#pragma HLS INTERFACE ap_none port=txd
#pragma HLS INTERFACE ap_ctrl_hs port=return
	   static UartTxPt uartTxPt;
	   *txd = 1;
	   uartTxPt.txData=data;
	   uartTxPt.done=false;
	   while(uartTxPt.done==false){

		   uartTxPt.OnTick();
		   *txd = uartTxPt.m_outdata;
	   }
}
```
### 串口发送测试
```verilog
`timescale 1ns/1ps

module tb;

    // ===== 时钟参数 =====
    localparam CLK_PERIOD = 37; // 27MHz ≈ 37ns

    // ===== 信号 =====
    reg         ap_clk;
    reg         ap_rst;
    reg         ap_start;
    reg  [7:0]  data;

    wire        ap_done;
    wire        ap_idle;
    wire        ap_ready;
    wire        txd;

    // ===== DUT 实例 =====
    my_led_key dut (
        .ap_clk   (ap_clk),
        .ap_rst   (ap_rst),
        .ap_start (ap_start),
        .ap_done  (ap_done),
        .ap_idle  (ap_idle),
        .ap_ready (ap_ready),
        .data     (data),
        .txd      (txd)
    );

    // ===== 27MHz 时钟 =====
    initial ap_clk = 0;
    always #(CLK_PERIOD/2) ap_clk = ~ap_clk;

    // ===== 主测试流程 =====
    initial begin
        // 初值
        ap_rst   = 1;
        ap_start = 0;
        data     = 8'h00;

        // 复位保持几个周期
        repeat (5) @(posedge ap_clk);
        ap_rst = 0;

        // 等待模块空闲
        wait (ap_idle == 1);

        // 设置发送数据
        data =8'h13;  // 发送字符 A

        // 发起一次执行请求
        @(posedge ap_clk);
        ap_start = 1;

        @(posedge ap_clk);
        ap_start = 0; // ap_start 只拉 1 拍

        // 等待执行完成
        wait (ap_done == 1);
        $display("[%0t] TX done", $time);

        // 再来一次
        @(posedge ap_clk);
        data =8'h15;
        ap_start = 1;

        @(posedge ap_clk);
        ap_start = 0;

        wait (ap_done == 1);
        $display("[%0t] TX done again", $time);

        // 结束仿真
        repeat (10) @(posedge ap_clk);
        $finish;
    end

endmodule

```
### my_led_key.cst
```bash
IO_LOC "led[1]" 10;
IO_PORT "led[1]" IO_TYPE=LVCMOS33 PULL_MODE=UP DRIVE=8;
IO_LOC "led[0]" 9;
IO_PORT "led[0]" IO_TYPE=LVCMOS33 PULL_MODE=UP DRIVE=8;
IO_LOC "ap_rst" 13;
IO_PORT "ap_rst" IO_TYPE=LVCMOS33 PULL_MODE=UP;
IO_LOC "ap_clk" 47;
IO_PORT "ap_clk" IO_TYPE=LVCMOS33 PULL_MODE=UP;
IO_LOC "key[0]" 44;
IO_PORT "key[0]" IO_TYPE=LVCMOS33 PULL_MODE=UP;
```
## 输出
```verilog
`timescale 1 ns / 1 ps 
module my_led_key (
        ap_clk,
        ap_rst,
        key,
        led
);

parameter    ap_ST_fsm_state1 = 1'd1;

input   ap_clk;
input   ap_rst;
input  [0:0] key;
output  [0:0] led;

reg   [0:0] led_state_V;
reg   [22:0] cnt_V;
reg   [0:0] ap_phi_mux_led_state_V_loc_0_phi_fu_54_p6;
(* fsm_encoding = "none" *) reg   [0:0] ap_CS_fsm;
wire    ap_CS_fsm_state1;
wire   [0:0] key_read_read_fu_38_p2;
wire   [0:0] icmp_ln878_fu_79_p2;
wire   [0:0] r_fu_85_p2;
wire   [22:0] add_ln691_fu_98_p2;
reg   [0:0] ap_NS_fsm;
wire    ap_ce_reg;

// power-on initialization
initial begin
#0 led_state_V = 1'd0;
#0 cnt_V = 23'd0;
#0 ap_CS_fsm = 1'd1;
end

always @ (posedge ap_clk) begin
    if (ap_rst == 1'b1) begin
        ap_CS_fsm <= ap_ST_fsm_state1;
    end else begin
        ap_CS_fsm <= ap_NS_fsm;
    end
end

always @ (posedge ap_clk) begin
    if (((icmp_ln878_fu_79_p2 == 1'd1) & (key_read_read_fu_38_p2 == 1'd0) & (1'b1 == ap_CS_fsm_state1))) begin
        cnt_V <= add_ln691_fu_98_p2;
    end else if ((((icmp_ln878_fu_79_p2 == 1'd0) & (key_read_read_fu_38_p2 == 1'd0) & (1'b1 == ap_CS_fsm_state1)) | ((key_read_read_fu_38_p2 == 1'd1) & (1'b1 == ap_CS_fsm_state1)))) begin
        cnt_V <= 23'd0;
    end
end

always @ (posedge ap_clk) begin
    if ((1'b1 == ap_CS_fsm_state1)) begin
        if ((key_read_read_fu_38_p2 == 1'd1)) begin
            led_state_V <= 1'd0;
        end else if (((icmp_ln878_fu_79_p2 == 1'd0) & (key_read_read_fu_38_p2 == 1'd0))) begin
            led_state_V <= r_fu_85_p2;
        end
    end
end

always @ (*) begin
    if ((1'b1 == ap_CS_fsm_state1)) begin
        if (((icmp_ln878_fu_79_p2 == 1'd0) & (key_read_read_fu_38_p2 == 1'd0))) begin
            ap_phi_mux_led_state_V_loc_0_phi_fu_54_p6 = r_fu_85_p2;
        end else if (((icmp_ln878_fu_79_p2 == 1'd1) & (key_read_read_fu_38_p2 == 1'd0))) begin
            ap_phi_mux_led_state_V_loc_0_phi_fu_54_p6 = led_state_V;
        end else if ((key_read_read_fu_38_p2 == 1'd1)) begin
            ap_phi_mux_led_state_V_loc_0_phi_fu_54_p6 = 1'd0;
        end else begin
            ap_phi_mux_led_state_V_loc_0_phi_fu_54_p6 = 'bx;
        end
    end else begin
        ap_phi_mux_led_state_V_loc_0_phi_fu_54_p6 = 'bx;
    end
end

always @ (*) begin
    case (ap_CS_fsm)
        ap_ST_fsm_state1 : begin
            ap_NS_fsm = ap_ST_fsm_state1;
        end
        default : begin
            ap_NS_fsm = 'bx;
        end
    endcase
end

assign add_ln691_fu_98_p2 = (cnt_V + 23'd1);

assign ap_CS_fsm_state1 = ap_CS_fsm[32'd0];

assign icmp_ln878_fu_79_p2 = ((cnt_V < 23'd5000000) ? 1'b1 : 1'b0);

assign key_read_read_fu_38_p2 = key;

assign led = ap_phi_mux_led_state_V_loc_0_phi_fu_54_p6;

assign r_fu_85_p2 = (led_state_V ^ 1'd1);
endmodule //my_led_key
```

# 点击,灯翻转
## 单个函数实现
```c
#include <ap_int.h>
#define DEBOUNCE_DOWN  270000       //10ms 按下消抖计数，可根据 FPGA 时钟调整
#define DEBOUNCE_UP    270000       // 松开消抖计数
void my_led_key(
    ap_uint<1> key,      // 按键输入（低有效）
    ap_uint<1> *led      // LED 输出
){
#pragma HLS INTERFACE ap_none port=key
#pragma HLS INTERFACE ap_none port=led
#pragma HLS INTERFACE ap_ctrl_none port=return

    static ap_uint<1> led_state = 0;
    static ap_uint<1> key_d_f = 0;      // 按下标志
    static ap_uint<32> key_d_delay = 0;  // 按下消抖计数
    static ap_uint<32> key_u_delay = 0;  // 松开消抖计数

    // 按下逻辑（低有效）
    if(key == 0){
        key_d_delay++;
        key_u_delay = 0;
        if(key_d_delay >= DEBOUNCE_DOWN && key_d_f == 0){
            key_d_f = 1;          // 按下确认
            led_state = ~led_state;  // LED 翻转
        }
    } else { // 松开逻辑
        key_d_delay = 0;
        if(key_d_f == 1){
            key_u_delay++;
            if(key_u_delay >= DEBOUNCE_UP){
                key_d_f = 0;      // 按键释放确认
                key_u_delay = 0;
            }
        }
    }

    *led = led_state;
}
```
## 函数调用实现
```c
#include <ap_int.h>

#define DEBOUNCE_DOWN  270000
#define DEBOUNCE_UP    270000

struct KeyState {
    ap_uint<1> key_d_f;
    ap_uint<32> key_d_delay;
    ap_uint<32> key_u_delay;
};

ap_uint<1> key_should_toggle(ap_uint<1> key, KeyState &ks) {
#pragma HLS INLINE
    ap_uint<1> toggle = 0;
    if(key == 0){
        ks.key_d_delay++;
        ks.key_u_delay = 0;
        if(ks.key_d_delay >= DEBOUNCE_DOWN && ks.key_d_f == 0){
            ks.key_d_f = 1;
            toggle = 1;
        }
    } else {
        ks.key_d_delay = 0;
        if(ks.key_d_f == 1){
            ks.key_u_delay++;
            if(ks.key_u_delay >= DEBOUNCE_UP){
                ks.key_d_f = 0;
                ks.key_u_delay = 0;
            }
        }
    }
    return toggle;
}

void my_led_key(ap_uint<1> key, ap_uint<1> *led) {
		#pragma HLS INTERFACE ap_none port=key
		#pragma HLS INTERFACE ap_none port=led
		#pragma HLS INTERFACE ap_ctrl_none port=return
    // 静态变量保存状态
    static ap_uint<1> led_state = 0;
    static KeyState ks = {0,0,0};
    // 按键消抖判断是否翻转 LED
    if(key_should_toggle(key, ks)){
        led_state = ~led_state;
    }
    *led = led_state;
}
```
## 输出
```verilog
`timescale 1 ns / 1 ps 
module my_led_key (
        ap_clk,
        ap_rst,
        key,
        led
);

parameter    ap_ST_fsm_state1 = 2'd1;
parameter    ap_ST_fsm_state2 = 2'd2;

input   ap_clk;
input   ap_rst;
input  [0:0] key;
output  [0:0] led;

reg   [31:0] key_u_delay_V;
reg   [0:0] key_d_f_V;
reg   [0:0] led_state_V;
reg   [31:0] key_d_delay_V;
wire   [0:0] key_read_read_fu_44_p2;
(* fsm_encoding = "none" *) reg   [1:0] ap_CS_fsm;
wire    ap_CS_fsm_state1;
wire   [0:0] or_ln23_fu_150_p2;
reg   [0:0] or_ln23_reg_214;
wire   [31:0] add_ln691_1_fu_162_p2;
wire   [0:0] key_d_f_V_load_load_fu_120_p1;
reg   [0:0] ap_phi_mux_key_u_delay_V_flag_0_phi_fu_62_p10;
reg   [0:0] key_u_delay_V_flag_0_reg_57;
wire   [0:0] icmp_ln882_fu_168_p2;
wire    ap_CS_fsm_state2;
reg   [31:0] ap_phi_mux_key_u_delay_V_new_0_phi_fu_84_p10;
reg   [31:0] key_u_delay_V_new_0_reg_79;
reg   [0:0] ap_phi_mux_led_state_V_loc_0_phi_fu_103_p10;
reg   [0:0] led_state_V_loc_0_reg_100;
wire   [0:0] r_fu_186_p2;
wire   [31:0] add_ln691_fu_132_p2;
wire   [0:0] icmp_ln23_fu_144_p2;
reg   [1:0] ap_NS_fsm;
wire    ap_ce_reg;

// power-on initialization
initial begin
#0 key_u_delay_V = 32'd0;
#0 key_d_f_V = 1'd0;
#0 led_state_V = 1'd0;
#0 key_d_delay_V = 32'd0;
#0 ap_CS_fsm = 2'd1;
end

always @ (posedge ap_clk) begin
    if (ap_rst == 1'b1) begin
        ap_CS_fsm <= ap_ST_fsm_state1;
    end else begin
        ap_CS_fsm <= ap_NS_fsm;
    end
end

always @ (posedge ap_clk) begin
    if ((1'b1 == ap_CS_fsm_state1)) begin
        if ((key_read_read_fu_44_p2 == 1'd1)) begin
            key_d_delay_V <= 32'd0;
        end else if ((key_read_read_fu_44_p2 == 1'd0)) begin
            key_d_delay_V <= add_ln691_fu_132_p2;
        end
    end
end

always @ (posedge ap_clk) begin
    if (((icmp_ln882_fu_168_p2 == 1'd1) & (key_d_f_V_load_load_fu_120_p1 == 1'd1) & (1'b1 == ap_CS_fsm_state1) & (key_read_read_fu_44_p2 == 1'd1))) begin
        key_d_f_V <= 1'd0;
    end else if (((or_ln23_reg_214 == 1'd0) & (1'b1 == ap_CS_fsm_state2) & (key_read_read_fu_44_p2 == 1'd0))) begin
        key_d_f_V <= 1'd1;
    end
end

always @ (posedge ap_clk) begin
    if (((key_d_f_V_load_load_fu_120_p1 == 1'd0) & (1'b1 == ap_CS_fsm_state1) & (key_read_read_fu_44_p2 == 1'd1))) begin
        key_u_delay_V_flag_0_reg_57 <= 1'd0;
    end else if ((((or_ln23_reg_214 == 1'd1) & (1'b1 == ap_CS_fsm_state2) & (key_read_read_fu_44_p2 == 1'd0)) | ((or_ln23_reg_214 == 1'd0) & (1'b1 == ap_CS_fsm_state2) & (key_read_read_fu_44_p2 == 1'd0)) | ((icmp_ln882_fu_168_p2 == 1'd0) & (key_d_f_V_load_load_fu_120_p1 == 1'd1) & (1'b1 == ap_CS_fsm_state1) & (key_read_read_fu_44_p2 == 1'd1)) | ((icmp_ln882_fu_168_p2 == 1'd1) & (key_d_f_V_load_load_fu_120_p1 == 1'd1) & (1'b1 == ap_CS_fsm_state1) & (key_read_read_fu_44_p2 == 1'd1)))) begin
        key_u_delay_V_flag_0_reg_57 <= 1'd1;
    end
end

always @ (posedge ap_clk) begin
    if (((icmp_ln882_fu_168_p2 == 1'd0) & (key_d_f_V_load_load_fu_120_p1 == 1'd1) & (1'b1 == ap_CS_fsm_state1) & (key_read_read_fu_44_p2 == 1'd1))) begin
        key_u_delay_V_new_0_reg_79 <= add_ln691_1_fu_162_p2;
    end else if ((((or_ln23_reg_214 == 1'd1) & (1'b1 == ap_CS_fsm_state2) & (key_read_read_fu_44_p2 == 1'd0)) | ((or_ln23_reg_214 == 1'd0) & (1'b1 == ap_CS_fsm_state2) & (key_read_read_fu_44_p2 == 1'd0)) | ((icmp_ln882_fu_168_p2 == 1'd1) & (key_d_f_V_load_load_fu_120_p1 == 1'd1) & (1'b1 == ap_CS_fsm_state1) & (key_read_read_fu_44_p2 == 1'd1)))) begin
        key_u_delay_V_new_0_reg_79 <= 32'd0;
    end
end

always @ (posedge ap_clk) begin
    if (((or_ln23_reg_214 == 1'd0) & (1'b1 == ap_CS_fsm_state2) & (key_read_read_fu_44_p2 == 1'd0))) begin
        led_state_V_loc_0_reg_100 <= r_fu_186_p2;
    end else if ((((or_ln23_reg_214 == 1'd1) & (1'b1 == ap_CS_fsm_state2) & (key_read_read_fu_44_p2 == 1'd0)) | ((key_d_f_V_load_load_fu_120_p1 == 1'd0) & (1'b1 == ap_CS_fsm_state1) & (key_read_read_fu_44_p2 == 1'd1)) | ((icmp_ln882_fu_168_p2 == 1'd0) & (key_d_f_V_load_load_fu_120_p1 == 1'd1) & (1'b1 == ap_CS_fsm_state1) & (key_read_read_fu_44_p2 == 1'd1)) | ((icmp_ln882_fu_168_p2 == 1'd1) & (key_d_f_V_load_load_fu_120_p1 == 1'd1) & (1'b1 == ap_CS_fsm_state1) & (key_read_read_fu_44_p2 == 1'd1)))) begin
        led_state_V_loc_0_reg_100 <= led_state_V;
    end
end

always @ (posedge ap_clk) begin
    if (((ap_phi_mux_key_u_delay_V_flag_0_phi_fu_62_p10 == 1'd1) & (1'b1 == ap_CS_fsm_state2))) begin
        key_u_delay_V <= ap_phi_mux_key_u_delay_V_new_0_phi_fu_84_p10;
    end
end

always @ (posedge ap_clk) begin
    if (((or_ln23_reg_214 == 1'd0) & (1'b1 == ap_CS_fsm_state2) & (key_read_read_fu_44_p2 == 1'd0))) begin
        led_state_V <= r_fu_186_p2;
    end
end

always @ (posedge ap_clk) begin
    if (((1'b1 == ap_CS_fsm_state1) & (key_read_read_fu_44_p2 == 1'd0))) begin
        or_ln23_reg_214 <= or_ln23_fu_150_p2;
    end
end

always @ (*) begin
    if ((((or_ln23_reg_214 == 1'd1) & (1'b1 == ap_CS_fsm_state2) & (key_read_read_fu_44_p2 == 1'd0)) | ((or_ln23_reg_214 == 1'd0) & (1'b1 == ap_CS_fsm_state2) & (key_read_read_fu_44_p2 == 1'd0)))) begin
        ap_phi_mux_key_u_delay_V_flag_0_phi_fu_62_p10 = 1'd1;
    end else begin
        ap_phi_mux_key_u_delay_V_flag_0_phi_fu_62_p10 = key_u_delay_V_flag_0_reg_57;
    end
end

always @ (*) begin
    if ((((or_ln23_reg_214 == 1'd1) & (1'b1 == ap_CS_fsm_state2) & (key_read_read_fu_44_p2 == 1'd0)) | ((or_ln23_reg_214 == 1'd0) & (1'b1 == ap_CS_fsm_state2) & (key_read_read_fu_44_p2 == 1'd0)))) begin
        ap_phi_mux_key_u_delay_V_new_0_phi_fu_84_p10 = 32'd0;
    end else begin
        ap_phi_mux_key_u_delay_V_new_0_phi_fu_84_p10 = key_u_delay_V_new_0_reg_79;
    end
end

always @ (*) begin
    if (((1'b1 == ap_CS_fsm_state2) & (key_read_read_fu_44_p2 == 1'd0))) begin
        if ((or_ln23_reg_214 == 1'd1)) begin
            ap_phi_mux_led_state_V_loc_0_phi_fu_103_p10 = led_state_V;
        end else if ((or_ln23_reg_214 == 1'd0)) begin
            ap_phi_mux_led_state_V_loc_0_phi_fu_103_p10 = r_fu_186_p2;
        end else begin
            ap_phi_mux_led_state_V_loc_0_phi_fu_103_p10 = led_state_V_loc_0_reg_100;
        end
    end else begin
        ap_phi_mux_led_state_V_loc_0_phi_fu_103_p10 = led_state_V_loc_0_reg_100;
    end
end

always @ (*) begin
    case (ap_CS_fsm)
        ap_ST_fsm_state1 : begin
            ap_NS_fsm = ap_ST_fsm_state2;
        end
        ap_ST_fsm_state2 : begin
            ap_NS_fsm = ap_ST_fsm_state1;
        end
        default : begin
            ap_NS_fsm = 'bx;
        end
    endcase
end

assign add_ln691_1_fu_162_p2 = (key_u_delay_V + 32'd1);

assign add_ln691_fu_132_p2 = (key_d_delay_V + 32'd1);

assign ap_CS_fsm_state1 = ap_CS_fsm[32'd0];

assign ap_CS_fsm_state2 = ap_CS_fsm[32'd1];

assign icmp_ln23_fu_144_p2 = ((add_ln691_fu_132_p2 < 32'd270000) ? 1'b1 : 1'b0);

assign icmp_ln882_fu_168_p2 = ((add_ln691_1_fu_162_p2 > 32'd269999) ? 1'b1 : 1'b0);

assign key_d_f_V_load_load_fu_120_p1 = key_d_f_V;

assign key_read_read_fu_44_p2 = key;

assign led = ap_phi_mux_led_state_V_loc_0_phi_fu_103_p10;

assign or_ln23_fu_150_p2 = (key_d_f_V | icmp_ln23_fu_144_p2);

assign r_fu_186_p2 = (led_state_V ^ 1'd1);

endmodule //my_led_key

```

# axi_lite寄存器0控制灯,寄存器1读按键
## 输入
```c
#include <ap_int.h>

void my_led_key(
    ap_uint<1> key_in,       // FPGA 按键输入，低有效
    ap_uint<1> &led_reg,     // AXI4-Lite 寄存器 0：写1点亮，写0灭
    ap_uint<1> &key_status,  // AXI4-Lite 寄存器 1：读按键状态
    ap_uint<1> &led_out      // 物理 LED 端口
){
#pragma HLS INTERFACE ap_none port=key_in       // 物理端口，顶层会暴露
#pragma HLS INTERFACE s_axilite port=led_reg    bundle=CTRL_BUS
#pragma HLS INTERFACE s_axilite port=key_status bundle=CTRL_BUS
#pragma HLS INTERFACE ap_none  port=led_out
#pragma HLS INTERFACE s_axilite port=return    bundle=CTRL_BUS
    static ap_uint<1> led_state = 0;
    // LED 控制
    led_state = led_reg;
    led_out = led_state;
    led_reg = led_state;
    // 按键状态
    key_status = key_in;
}
```
## 输出
```verolog
`timescale 1 ns / 1 ps 
module my_led_key (
        key_in,
        led_out,
        s_axi_CTRL_BUS_AWVALID,
        s_axi_CTRL_BUS_AWREADY,
        s_axi_CTRL_BUS_AWADDR,
        s_axi_CTRL_BUS_WVALID,
        s_axi_CTRL_BUS_WREADY,
        s_axi_CTRL_BUS_WDATA,
        s_axi_CTRL_BUS_WSTRB,
        s_axi_CTRL_BUS_ARVALID,
        s_axi_CTRL_BUS_ARREADY,
        s_axi_CTRL_BUS_ARADDR,
        s_axi_CTRL_BUS_RVALID,
        s_axi_CTRL_BUS_RREADY,
        s_axi_CTRL_BUS_RDATA,
        s_axi_CTRL_BUS_RRESP,
        s_axi_CTRL_BUS_BVALID,
        s_axi_CTRL_BUS_BREADY,
        s_axi_CTRL_BUS_BRESP,
        ap_clk,
        ap_rst_n,
        interrupt
);

parameter    C_S_AXI_CTRL_BUS_DATA_WIDTH = 32;
parameter    C_S_AXI_CTRL_BUS_ADDR_WIDTH = 6;
parameter    C_S_AXI_DATA_WIDTH = 32;

parameter C_S_AXI_CTRL_BUS_WSTRB_WIDTH = (32 / 8);
parameter C_S_AXI_WSTRB_WIDTH = (32 / 8);

input  [0:0] key_in;
output  [0:0] led_out;
input   s_axi_CTRL_BUS_AWVALID;
output   s_axi_CTRL_BUS_AWREADY;
input  [C_S_AXI_CTRL_BUS_ADDR_WIDTH - 1:0] s_axi_CTRL_BUS_AWADDR;
input   s_axi_CTRL_BUS_WVALID;
output   s_axi_CTRL_BUS_WREADY;
input  [C_S_AXI_CTRL_BUS_DATA_WIDTH - 1:0] s_axi_CTRL_BUS_WDATA;
input  [C_S_AXI_CTRL_BUS_WSTRB_WIDTH - 1:0] s_axi_CTRL_BUS_WSTRB;
input   s_axi_CTRL_BUS_ARVALID;
output   s_axi_CTRL_BUS_ARREADY;
input  [C_S_AXI_CTRL_BUS_ADDR_WIDTH - 1:0] s_axi_CTRL_BUS_ARADDR;
output   s_axi_CTRL_BUS_RVALID;
input   s_axi_CTRL_BUS_RREADY;
output  [C_S_AXI_CTRL_BUS_DATA_WIDTH - 1:0] s_axi_CTRL_BUS_RDATA;
output  [1:0] s_axi_CTRL_BUS_RRESP;
output   s_axi_CTRL_BUS_BVALID;
input   s_axi_CTRL_BUS_BREADY;
output  [1:0] s_axi_CTRL_BUS_BRESP;
input   ap_clk;
input   ap_rst_n;
output   interrupt;

wire    ap_start;
wire    ap_done;
wire    ap_idle;
wire    ap_ready;
wire   [0:0] led_reg;
reg    key_status_ap_vld;
 reg    ap_rst_n_inv;
wire    ap_ce_reg;
my_led_key_CTRL_BUS_s_axi #(
    .C_S_AXI_ADDR_WIDTH( C_S_AXI_CTRL_BUS_ADDR_WIDTH ),
    .C_S_AXI_DATA_WIDTH( C_S_AXI_CTRL_BUS_DATA_WIDTH ))
CTRL_BUS_s_axi_U(
    .AWVALID(s_axi_CTRL_BUS_AWVALID),
    .AWREADY(s_axi_CTRL_BUS_AWREADY),
    .AWADDR(s_axi_CTRL_BUS_AWADDR),
    .WVALID(s_axi_CTRL_BUS_WVALID),
    .WREADY(s_axi_CTRL_BUS_WREADY),
    .WDATA(s_axi_CTRL_BUS_WDATA),
    .WSTRB(s_axi_CTRL_BUS_WSTRB),
    .ARVALID(s_axi_CTRL_BUS_ARVALID),
    .ARREADY(s_axi_CTRL_BUS_ARREADY),
    .ARADDR(s_axi_CTRL_BUS_ARADDR),
    .RVALID(s_axi_CTRL_BUS_RVALID),
    .RREADY(s_axi_CTRL_BUS_RREADY),
    .RDATA(s_axi_CTRL_BUS_RDATA),
    .RRESP(s_axi_CTRL_BUS_RRESP),
    .BVALID(s_axi_CTRL_BUS_BVALID),
    .BREADY(s_axi_CTRL_BUS_BREADY),
    .BRESP(s_axi_CTRL_BUS_BRESP),
    .ACLK(ap_clk),
    .ARESET(ap_rst_n_inv),
    .ACLK_EN(1'b1),
    .led_reg(led_reg),
    .key_status(key_in),
    .key_status_ap_vld(key_status_ap_vld),
    .ap_start(ap_start),
    .interrupt(interrupt),
    .ap_ready(ap_ready),
    .ap_done(ap_done),
    .ap_idle(ap_idle)
);
always @ (*) begin
    if ((ap_start == 1'b1)) begin
        key_status_ap_vld = 1'b1;
    end else begin
        key_status_ap_vld = 1'b0;
    end
end
assign ap_done = ap_start;
assign ap_idle = 1'b1;
assign ap_ready = ap_start;

always @ (*) begin
    ap_rst_n_inv = ~ap_rst_n;
end
assign led_out = led_reg;
endmodule //my_led_key

#################################################################
`timescale 1ns/1ps
module my_led_key_CTRL_BUS_s_axi
#(parameter
    C_S_AXI_ADDR_WIDTH = 6,
    C_S_AXI_DATA_WIDTH = 32
)(
    input  wire                          ACLK,
    input  wire                          ARESET,
    input  wire                          ACLK_EN,
    input  wire [C_S_AXI_ADDR_WIDTH-1:0] AWADDR,
    input  wire                          AWVALID,
    output wire                          AWREADY,
    input  wire [C_S_AXI_DATA_WIDTH-1:0] WDATA,
    input  wire [C_S_AXI_DATA_WIDTH/8-1:0] WSTRB,
    input  wire                          WVALID,
    output wire                          WREADY,
    output wire [1:0]                    BRESP,
    output wire                          BVALID,
    input  wire                          BREADY,
    input  wire [C_S_AXI_ADDR_WIDTH-1:0] ARADDR,
    input  wire                          ARVALID,
    output wire                          ARREADY,
    output wire [C_S_AXI_DATA_WIDTH-1:0] RDATA,
    output wire [1:0]                    RRESP,
    output wire                          RVALID,
    input  wire                          RREADY,
    output wire                          interrupt,
    output wire [0:0]                    led_reg,
    input  wire [0:0]                    key_status,
    input  wire                          key_status_ap_vld,
    output wire                          ap_start,
    input  wire                          ap_done,
    input  wire                          ap_ready,
    input  wire                          ap_idle
);
//------------------------Address Info-------------------
// 0x00 : Control signals
//        bit 0  - ap_start (Read/Write/SC)
//        bit 1  - ap_done (Read/COR)
//        bit 2  - ap_idle (Read)
//        bit 3  - ap_ready (Read)
//        bit 7  - auto_restart (Read/Write)
//        others - reserved
// 0x04 : Global Interrupt Enable Register
//        bit 0  - Global Interrupt Enable (Read/Write)
//        others - reserved
// 0x08 : IP Interrupt Enable Register (Read/Write)
//        bit 0  - enable ap_done interrupt (Read/Write)
//        others - reserved
// 0x0c : IP Interrupt Status Register (Read/TOW)
//        bit 0  - ap_done (COR/TOW)
//        others - reserved
// 0x10 : Data signal of led_reg
//        bit 0  - led_reg[0] (Read/Write)
//        others - reserved
// 0x14 : reserved
// 0x20 : Data signal of key_status
//        bit 0  - key_status[0] (Read)
//        others - reserved
// 0x24 : Control signal of key_status
//        bit 0  - key_status_ap_vld (Read/COR)
//        others - reserved
// (SC = Self Clear, COR = Clear on Read, TOW = Toggle on Write, COH = Clear on Handshake)
xxxxxxxxxxxxxxxxxx
endmodule
```