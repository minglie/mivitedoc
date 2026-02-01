
   >这是一个简单的 Verilog 按键消抖模块，通过计时判断按键是否稳定按下，并输出一个时钟周期的脉冲作为响应。

# 时序图
i_key 按下一段时间,o_key_pulse 输出一个单周期脉冲
![在这里插入图片描述](./img/4a262d5a745c499ab6c682525ada40bb.png)
# 仿真图
![在这里插入图片描述](./img/01fe7d04fb0544daa4a276fd465345d2.png)

# key_debounce.v
```verilog
module  key_debounce
#(
    parameter P_CLK_FREQ_MHZ = 50,  // 时钟频率，单位MHz，默认50MHz
    parameter P_DEBOUNCE_MS  = 20,   // 消抖时间，单位ms，默认20ms
    parameter L_CNT_WIDTH    = 32  // 需要外部计算后传入
)
(
    input   wire    i_clk     ,    //系统时钟50Mhz
    input   wire    i_rst_n   ,    //全局复位
    input   wire    i_key      ,   //按键输入信号
    output  reg     o_key_pulse    //消抖后的脉冲信号
);

// 根据时钟频率和消抖时间计算需要计数的最大值
localparam L_MAX_CNT = P_CLK_FREQ_MHZ * 1000 * P_DEBOUNCE_MS;
reg     [L_CNT_WIDTH-1:0]  r_cnt  ;

// ==================================================
//  r_cnt ：记录按键按键的时间
// ==================================================
always@(posedge i_clk or negedge i_rst_n)
    if(i_rst_n == 1'b0)
        r_cnt <= {(L_CNT_WIDTH+1){1'b0}};
     //按键松开,计数器清零
    else if(i_key == 1)
        r_cnt <= {(L_CNT_WIDTH+1){1'b0}};
     //按键按下时，计数器计数
    else if(i_key == 1'b0 && r_cnt < L_MAX_CNT-1)
        r_cnt <= r_cnt + 1'b1;
    else
    //如果按键一直不释放,则r_cnt维持最大值,防止多次触发
        r_cnt <= r_cnt;
        
// ==================================================
//  o_key_pulse ：输出脉冲信号，当按键稳定按下超过设定时间，输出一个时钟周期的脉冲
// ==================================================
always@(posedge i_clk or negedge i_rst_n)
    if(i_rst_n == 1'b0)
        o_key_pulse <= 1'b0;
     //计数快满时,产生一个时钟周期的脉冲,因为按住不松手时,计数器会维持在L_MAX_CNT-1
    else if(r_cnt ==  L_MAX_CNT-3)
        o_key_pulse <= 1'b1;
    else
        o_key_pulse <= 1'b0;
endmodule
```
# tb.v

```verilog
`timescale 1ns / 1ps

module tb();
    //为了快速测试,消抖1ms
    parameter P_MAX_CNT = 20'd1000; //1m

    // 信号声明
    reg i_clk;
    reg i_rst_n;
    reg i_din;
    wire o_dout;

    // 实例化被测模块
    key_debounce #(
        .P_CLK_FREQ_MHZ(1),
        .P_DEBOUNCE_MS(1)
    ) uut (
        .i_clk(i_clk),
        .i_rst_n(i_rst_n),
        .i_key(i_din),
        .o_key_pulse(o_dout)
    );

    // 生成50MHz时钟（周期20ns）
    initial begin
        i_clk = 0;
        forever #10 i_clk = ~i_clk; // 50MHz时钟
    end

    // 测试序列
    initial begin
        // 初始化信号
        i_rst_n = 0;
        i_din = 1;
        #20;

        // 释放复位
        i_rst_n = 1;
        #20;

        // 测试用例1：短按抖动（<20ms），应被过滤
        $display("Test Case 1: Short press with jitter (<20ms), should be filtered");
        generate_key_press(500); // 500个时钟周期（10us）的短按
        #1000;

        // 测试用例2：长按稳定（>20ms），应产生脉冲
        $display("Test Case 2: Long stable press (>20ms), should generate a pulse");
        generate_key_press(P_MAX_CNT + 100); // 长按超过20ms
        #1000;

        // 测试用例3：带抖动的长按，应忽略抖动并在稳定20ms后触发
        $display("Test Case 3: Long press with jitter, should ignore jitter and trigger after stable 20ms");
        generate_key_press_with_chatter(P_MAX_CNT + 100, 10); // 带抖动的长按
        #1000;

        // 测试用例4：多次按下释放
        $display("Test Case 4: Multiple press and release");
        repeat(3) begin
            generate_key_press(P_MAX_CNT + 100);
            #1000;
        end

        // 测试用例5：边界条件 - 刚好20ms
        $display("Test Case 5: Edge case - exactly 20ms");
        generate_key_press(P_MAX_CNT);
        #1000;

        // 新增测试用例6：按键一直按下，验证是否重复触发
        $display("Test Case 6: Key held down, check for repeated triggers");
        i_din = 0;  // 按下按键
        #(P_MAX_CNT * 20 * 5);  // 保持按下状态60ms（3个20ms周期）
        #1000;

        // 结束仿真
        $display("All test cases completed");
        $finish;
    end

    // 任务：生成按键按下（无抖动）
    task generate_key_press;
        input [31:0] press_cycles;
    begin
        // 按下按键
        i_din = 0;
        #(press_cycles * 20); // 保持低电平

        // 释放按键
        i_din = 1;
        #1000; // 释放后等待一段时间
    end
    endtask

    // 任务：生成带抖动的按键按下
    task generate_key_press_with_chatter;
        input [31:0] press_cycles;
        input [31:0] chatter_times; // 抖动次数
    begin
        integer i;

        // 初始按下（带抖动）
        for (i = 0; i < chatter_times; i = i + 1) begin
            i_din = 0;
            #(20 * ({$random} % 41 + 10)); // 随机低电平时间 (10-50 cycles)
            i_din = 1;
            #(20 * ({$random} % 41 + 10)); // 随机高电平时间 (10-50 cycles)
        end

        // 稳定按下
        i_din = 0;
        #(press_cycles * 20); // 保持低电平

        // 释放按键（带抖动）
        for (i = 0; i < chatter_times; i = i + 1) begin
            i_din = 1;
            #(20 * ({$random} % 41 + 10)); // 随机高电平时间 (10-50 cycles)
            i_din = 0;
            #(20 * ({$random} % 41 + 10)); // 随机低电平时间 (10-50 cycles)
        end

        // 稳定释放
        i_din = 1;
        #1000; // 释放后等待一段时间
    end
    endtask

    // 监测输出并验证结果
    reg [19:0] pulse_cnt;
    reg [19:0] trigger_count; // 记录触发次数
    initial begin
        pulse_cnt = 0;
        trigger_count = 0;

        // 监测o_dout信号，验证脉冲宽度
        forever @(posedge i_clk) begin
            if (o_dout) begin
                pulse_cnt = pulse_cnt + 1;
                if (pulse_cnt == 0) begin // 新脉冲开始
                    trigger_count = trigger_count + 1;
                    $display("Time %0t: Detected trigger #%0d", $time, trigger_count);
                end
            end else if (pulse_cnt > 0) begin
                $display("Time %0t: o_dout goes low, pulse width = %0d clock cycles", $time, pulse_cnt);

                // 验证脉冲宽度是否符合预期
                if (pulse_cnt == 4) begin
                    $display("PASS: Pulse width correct (4 cycles)");
                end else begin
                    $display("FAIL: Pulse width should be 4, actual = %0d", pulse_cnt);
                end

                pulse_cnt = 0;
            end
        end
    end

    // 自动验证按键消抖功能
    reg [63:0] key_press_time;
    initial begin
        key_press_time = 0;
        wait(i_rst_n == 1);
        #100; // 等待复位完成

        // 监测i_din和o_dout信号，验证消抖功能
        forever begin
            // 等待按键按下（下降沿）
            @(negedge i_din);
            key_press_time = $time;
            $display("Time %0t: Key press detected", $time);

            // 等待可能的o_dout脉冲
            @(posedge o_dout);
            $display("Time %0t: o_dout pulse detected", $time);

            // 验证i_din是否稳定低电平至少20ms
            if ($time - key_press_time < (P_MAX_CNT * 20)) begin
                $display("FAIL: Key press duration less than 20ms but pulse generated");
            end else begin
                $display("PASS: Key held low for more than 20ms before pulse");
            end
        end
    end

    // 新增：验证持续按下时的触发次数
    initial begin
        // 等待测试用例6开始
        #5000;
        wait(i_din == 0);

        // 等待3个20ms周期
        #(P_MAX_CNT * 20 * 3);

        // 验证触发次数
        if (trigger_count >= 3) begin
            $display("FAIL: Key held down triggered %0d times", trigger_count);
        end else begin
            $display("PASS: Key held down only triggered once");
        end
    end

endmodule
```

# 时钟测试,启动调试
```verilog
`timescale 1ns/1ps

module key_debounce #
(
    parameter P_CLK_FREQ_MHZ = 100,  // 时钟频率 MHz
    parameter P_DEBOUNCE_MS  = 20,   // 消抖时间 ms
    parameter L_CNT_WIDTH    = 32    // 计数器宽度
)
(
    input   wire    i_clk,           // 系统时钟
    input   wire    i_rst_n,         // 全局复位
    input   wire    i_key,           // 按键输入信号

    output  reg     o_key_pulse,     // 消抖后的单周期脉冲
    output  reg     o_key_toggle,    // 按键触发翻转信号
    output  reg [7:0] o_key_count,   // 按键次数计数器
    output  reg     o_sec_pulse,      // 每秒产生一个脉冲（1个时钟周期）
    output  reg [7:0] o_sec_count,   // 秒计数器
    output  reg     o_sec_toggle     // 每秒翻转一次
);

    // ==================================================
    // 消抖逻辑
    // ==================================================
    localparam L_MAX_CNT = P_CLK_FREQ_MHZ * 1000 * P_DEBOUNCE_MS;
    reg [L_CNT_WIDTH-1:0] r_cnt;

    always @(posedge i_clk or negedge i_rst_n)
        if (!i_rst_n)
            r_cnt <= 0;
        else if (i_key == 1)  // 松开清零
            r_cnt <= 0;
        else if (i_key == 0 && r_cnt < L_MAX_CNT-1)
            r_cnt <= r_cnt + 1'b1;
        else
            r_cnt <= r_cnt;

    // 输出消抖脉冲
    always @(posedge i_clk or negedge i_rst_n)
        if (!i_rst_n)
            o_key_pulse <= 1'b0;
        else if (r_cnt == L_MAX_CNT-3)
            o_key_pulse <= 1'b1;
        else
            o_key_pulse <= 1'b0;

    // ==================================================
    // 按键次数计数器 & 翻转信号
    // ==================================================
    always @(posedge i_clk or negedge i_rst_n)
        if (!i_rst_n) begin
            o_key_count  <= 0;
            o_key_toggle <= 0;
        end else if (o_key_pulse) begin
            o_key_count  <= o_key_count + 1'b1;
            o_key_toggle <= ~o_key_toggle;  // 每次按键翻转
        end

    // ==================================================
    // 1 秒计数器（基于时钟频率）
    // ==================================================
    localparam L_ONE_SEC = P_CLK_FREQ_MHZ * 1_000_000; // 1秒对应的时钟数
    reg [31:0] r_1s_cnt;  // 需要足够位宽

    always @(posedge i_clk or negedge i_rst_n)
        if (!i_rst_n) begin
            r_1s_cnt    <= 0;
            o_sec_pulse  <= 0;
        end else if (r_1s_cnt == L_ONE_SEC-1) begin
            r_1s_cnt    <= 0;
            o_sec_pulse  <= 1'b1; // 1秒脉冲
        end else begin
            r_1s_cnt    <= r_1s_cnt + 1'b1;
            o_sec_pulse  <= 1'b0;
        end

    // ==================================================
    // 秒计数器 & 翻转信号
    // ==================================================
    always @(posedge i_clk or negedge i_rst_n)
        if (!i_rst_n) begin
            o_sec_count  <= 0;
            o_sec_toggle <= 0;
        end else if (o_sec_pulse) begin
            o_sec_count  <= o_sec_count + 1'b1;
            o_sec_toggle <= ~o_sec_toggle; // 每秒翻转
        end

endmodule

```