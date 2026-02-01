
# 一段式
```verilog
module fsm_one (
    input  wire i_clk,
    input  wire i_rst_n,
    input  wire i_start,
    output reg  o_done
);

    typedef enum logic [1:0] {
        S_IDLE = 2'b00,
        S_WORK = 2'b01,
        S_DONE = 2'b10
    } state_t;

    state_t r_state,r_pre_state;

    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            r_state <= S_IDLE;
            r_pre_state <= S_IDLE;
            o_done  <= 1'b0;
        end else begin
            r_pre_state<= r_state;
            case (r_state)
                S_IDLE: begin
                    o_done <= 1'b0;
                    if (i_start)
                        r_state <= S_WORK;
                end
                S_WORK: begin
                    r_state <= S_DONE;
                end
                S_DONE: begin
                    o_done  <= 1'b1;
                    r_state <= S_IDLE;
                end
                default: r_state <= S_IDLE;
            endcase
        end
    end

endmodule

```
# 二段式
```verilog
module fsm_two (
    input  wire i_clk,
    input  wire i_rst_n,
    input  wire i_start,
    output reg  o_done
);

    typedef enum logic [1:0] {
        S_IDLE = 2'b00,
        S_WORK = 2'b01,
        S_DONE = 2'b10
    } state_t;

    state_t r_state, r_next_state;

    // 状态寄存器（第1段）
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            r_state <= S_IDLE;
        else
            r_state <= r_next_state;
    end

    // 状态转移 + 输出逻辑（第2段）
    always @(*) begin
        // 默认值
        r_next_state = r_state;
        o_done       = 1'b0;

        case (r_state)
            S_IDLE: begin
                if (i_start)
                    r_next_state = S_WORK;
            end

            S_WORK: begin
                r_next_state = S_DONE;
            end

            S_DONE: begin
                o_done       = 1'b1;
                r_next_state = S_IDLE;
            end

            default: begin
                r_next_state = S_IDLE;
                o_done       = 1'b0;
            end
        endcase
    end

endmodule

```
# 三段式
```verilog
module fsm_three (
    input  wire i_clk,
    input  wire i_rst_n,
    input  wire i_start,
    output reg  o_done
);

    typedef enum logic [1:0] {
        S_IDLE = 2'b00,
        S_WORK = 2'b01,
        S_DONE = 2'b10
    } state_t;

    state_t r_state, r_next_state;

    // 第一段：状态寄存器
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            r_state <= S_IDLE;
        else
            r_state <= r_next_state;
    end

    // 第二段：状态转移逻辑
    always @(*) begin
        case (r_state)
            S_IDLE:  r_next_state = i_start ? S_WORK : S_IDLE;
            S_WORK:  r_next_state = S_DONE;
            S_DONE:  r_next_state = S_IDLE;
            default: r_next_state = S_IDLE;
        endcase
    end

    // 第三段：输出逻辑（时序逻辑）
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            o_done <= 1'b0;
        else begin
            case (r_state)
                S_DONE:    o_done <= 1'b1;
                default:   o_done <= 1'b0;
            endcase
        end
    end

endmodule

```

# 五段式
```verilog

module fsm_five (
    input  wire       i_clk,
    input  wire       i_rst_n,
    input  wire       i_start,
    input  wire [7:0] i_data,
    output reg        o_tx_en,
    output reg [7:0]  o_tx_data,
    output reg        o_done
);

    // -------------------------------
    // 状态定义
    typedef enum logic [2:0] {
        S_IDLE      = 3'd0,
        S_LOAD      = 3'd1,
        S_SEND      = 3'd2,
        S_WAIT_DONE = 3'd3
    } state_t;

    state_t r_state, r_next_state;

    // 临时线网信号（输入、输出中间值）
    logic w_start_valid;
    logic w_tx_en;
    logic [7:0] w_tx_data;
    logic w_done;

    // -------------------------------
    // [1] 输入解析段：防抖 / 一拍检测
    reg r_start_d;
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            r_start_d <= 1'b0;
        else
            r_start_d <= i_start;
    end
    assign w_start_valid = i_start & ~r_start_d; // 检测上升沿启动信号

    // -------------------------------
    // [2] 状态寄存器段
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            r_state <= S_IDLE;
        else
            r_state <= r_next_state;
    end

    // -------------------------------
    // [3] 状态转移逻辑段
    always @(*) begin
        case (r_state)
            S_IDLE:
                r_next_state = w_start_valid ? S_LOAD : S_IDLE;

            S_LOAD:
                r_next_state = S_SEND;

            S_SEND:
                r_next_state = S_WAIT_DONE;

            S_WAIT_DONE:
                r_next_state = S_IDLE;

            default:
                r_next_state = S_IDLE;
        endcase
    end

    // -------------------------------
    // [4] 输出控制逻辑段（组合逻辑）
    always @(*) begin
        // 默认值
        w_tx_en   = 1'b0;
        w_tx_data = 8'd0;
        w_done    = 1'b0;

        case (r_state)
            S_LOAD: begin
                w_tx_data = i_data;
            end
            S_SEND: begin
                w_tx_en = 1'b1;
            end
            S_WAIT_DONE: begin
                w_done = 1'b1;
            end
        endcase
    end

    // -------------------------------
    // [5] 输出寄存段（稳定、同步输出）
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            o_tx_en   <= 1'b0;
            o_tx_data <= 8'd0;
            o_done    <= 1'b0;
        end else begin
            o_tx_en   <= w_tx_en;
            o_tx_data <= w_tx_data;
            o_done    <= w_done;
        end
    end

endmodule

```