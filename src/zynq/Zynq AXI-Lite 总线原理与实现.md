
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/3d2a570f9ff94e2382f4909a062aca48.jpeg)


推荐仓库 [axi4-interface](https://github.com/mmxsrup/axi4-interface)  有各种 AXI总线协议的SystemVerilog的例子,并有配套直接能跑的Testbench。

# 手写 AXI 和 Vivado IP Generator 的对比
| 对比维度                 | 🧠 **手写 AXI 接口** | 🧱 **使用 Vivado IP Generator**             |
| -------------------- | -------------------------------- | ----------------------------------------- |
| 🧩 **开发自由度**         | ✅ **极高**：时序、握手、功能完全自控            | ⚠️ 受限于 IP 提供的参数和封装形式                      |
| 🛠 **可定制性**          | ✅ 灵活裁剪（只读/只写/自定义寄存器结构）           | ❌ 模板固定，裁剪/修改困难                            |
| 🕹 **调试难度**          | 🟢 全信号自控，便于 ILA 插点与仿真追踪          | 🔴 黑盒结构多，调试依赖 wrapper 外部行为                |
| 📦 **集成复杂度**         | 🟡 须手动封装为 slave/master，接入 top.v  | ✅ 拖入 BD 自动连接 PS/Zynq 外设                   |
| ⚙️ **自动工程支持**        | ❌ 无法参与 IP Integrator，需手动构建 XSA   | ✅ 完全兼容 block design，支持一键导出 XSA            |
| 📁 **工程整洁度**         | ✅ 精简：1\~2 个 .v 文件，Git 管理简洁       | ❌ 生成大量 `.xci`, `.bd`, `.xml`, `.hwdef` 文件 |
| 📈 **编译速度**          | ✅ 修改即综合，几乎无平台级重编时间               | ❌ 改 BD/IP 后常需重新综合实现，耗时大                   |
| 🧪 **测试验证便利**        | ✅ 状态机可控，方便 testbench、仿真脚本        | ⚠️ 行为不可见，仿真验证偏黑盒                          |
| 🧠 **协议学习价值**        | ✅ 强制理解 AXI4 协议结构，成长飞快            | ❌ AXI 一行不懂也能用，不利深入                        |
| 🧩 **跨项目可移植性**       | ✅ 纯 RTL 可复用，跨平台/版本完全无依赖          | ❌ `.xci` 路径强依赖，换路径/切分支易出错                 |
| 💥 **引起 Vitis 编译错误** | ✅ 极少：接口固定、路径清晰，依赖少               | 🔴 常见：路径错误、xsa 不匹配、BSP 无法识别 IP            |




# 纯pl的bd
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/47edcf350355492994b40b1924cec5fb.png#pic_center)
# 带ps的bd
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/18dd0e1135914347b11aba7b42194b83.png)

# 时序图
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/7c0fb0557a934dbca9db65eb242e3a71.png#pic_center)


# AXI_lite 五个通道功能表
在 AXI 协议 中，读响应（RRESP） 和 读数据（RDATA） 是通过同一个通道（即读数据通道）一起返回的。因此，AXI 协议 中不需要单独的读响应通道。

| 通道缩写 | 全称             | 中文名称  | 功能描述                                                                                    | 方向    |
| ---- | -------------- | ----- | --------------------------------------------------------------------------------------- | ----- |
| AW   | Write Address  | 写地址通道 | **主设备**发起写操作时，传输的地址信息，指示要写入的数据存储位置。主设备通过 `AWADDR` 信号传送目标地址。                             | 主设备发送 |
| W    | Write Data     | 写数据通道 | **主设备**将数据通过该通道发送给**从设备**，紧随写地址传输。主设备通过 `WDATA` 信号将要写入的实际数据传输给从设备。                      | 主设备发送 |
| B    | Write Response | 写响应通道 | **从设备**返回给**主设备**的响应信号，表示写操作是否成功。`BRESP` 信号告诉主设备写操作是否完成，以及是否有错误发生（例如，`OKAY` 或 `ERROR`）。 | 从设备发送 |
| AR   | Read Address   | 读地址通道 | **主设备**发起读操作时，通过该通道传输的读地址，指示从设备读取的数据的位置。主设备通过 `ARADDR` 信号发送目标地址。                        | 主设备发送 |
| R    | Read Data      | 读数据通道 | **从设备**根据主设备提供的读地址，通过该通道返回实际的数据。主设备通过 `RDATA` 接收从设备传回的数据，同时也会接收到 `RRESP` 信号，表示读操作的响应。   | 从设备发送 |


# AXI_lite 接口定义
当 xVALID = 1 和 xREADY = 1 时，表示x已成功传输。
AXI Lite 和 AXI Full 最主要的区别为是否支持突发传输 和 是否有读写响应通道。
而 突发传输 就是连续发多个数据。
| 通道分组     | 信号名 s_axi 或 m_axi      | 位宽            | **Master方向** | **Slave方向** | 描述说明                     |
| -------- | ----------- | ------------- | ------------ | ----------- | ------------------------ |
| 🔄 全局信号  | `*_aclk`    | 1             | input        | input       | 全局时钟                     |
|          | `*_aresetn` | 1             | input        | input       | 异步复位（低有效）                |
| 📝 写地址通道 | `*_awaddr`  | ADDR\_WIDTH   | output       | input       | 写操作地址                    |
|          | `*_awvalid` | 1             | output       | input       | 写地址有效                    |
|          | `*_awready` | 1             | input        | output      | 从设备已成功接收到地址              |
| 🧾 写数据通道 | `*_wdata`   | DATA\_WIDTH   | output       | input       | 写入的数据                    |
|          | `*_wstrb`   | DATA\_WIDTH/8 | output       | input       | 写字节使能（每 bit 控制一个字节）      |
|          | `*_wvalid`  | 1             | output       | input       | 写数据有效                    |
|          | `*_wready`  | 1             | input        | output      | 从设备已成功接收到数据              |
| 📬 写响应通道 | `*_bresp`   | 2             | input        | output      | 写响应（00=OKAY，01/10=ERROR） |
|          | `*_bvalid`  | 1             | input        | output      | 写响应有效                    |
|          | `*_bready`  | 1             | output       | input       | 主设备准备接收写响应               |
| 📮 读地址通道 | `*_araddr`  | ADDR\_WIDTH   | output       | input       | 读请求地址                    |
|          | `*_arvalid` | 1             | output       | input       | 读地址有效                    |
|          | `*_arready` | 1             | input        | output      | 从设备准备好接收读地址              |
| 📤 读数据通道 | `*_rdata`   | DATA\_WIDTH   | input        | output      | 读返回的数据                   |
|          | `*_rresp`   | 2             | input        | output      | 读响应（00=OKAY）             |
|          | `*_rvalid`  | 1             | input        | output      | 读数据有效                    |
|          | `*_rready`  | 1             | output       | input       | 主设备准备接收读数据               |

# AXI-Lite 总体通信流程

```markdown
┌──────────────┐
│              │
│   Master     │
│（主设备发起）│
└────┬─────────┘
     │
     │
     ▼
┌──────────────┐
│ ① 写地址通道  │───► `awaddr`, `awvalid`
└────┬─────────┘        ▲ `awready`（Slave 准备好）
     │
     ▼
┌──────────────┐
│ ② 写数据通道  │───► `wdata`, `wvalid`
└────┬─────────┘        ▲ `wready`（Slave 准备好）
     │
     ▼
┌──────────────┐
│ ③ 写响应通道  │◄─── `bvalid`, `bresp`
└────┬─────────┘        │ `bready`（Master 准备接收）
     │
     ▼
┌──────────────┐
│ ④ 读地址通道  │───► `araddr`, `arvalid`
└────┬─────────┘        ▲ `arready`（Slave 准备好）
     │
     ▼
┌──────────────┐
│ ⑤ 读数据通道  │◄─── `rvalid`, `rdata`, `rresp`
└──────────────┘        │ `rready`（Master 准备接收）

```
# axi_lite_master.v
```verilog
module axi_lite_master #(
    parameter ADDR_WIDTH = 32,
    parameter DATA_WIDTH = 32
)(
    input  wire                     clk,
    input  wire                     rst_n,
    
    // Write address channel
    output reg  [ADDR_WIDTH-1:0]    m_axi_awaddr,
    output reg                      m_axi_awvalid,
    input  wire                     m_axi_awready,
    
    // Write data channel
    output reg  [DATA_WIDTH-1:0]    m_axi_wdata,
    output reg  [(DATA_WIDTH/8)-1:0] m_axi_wstrb,
    output reg                      m_axi_wvalid,
    input  wire                     m_axi_wready,
    
    // Write response channel
    input  wire [1:0]               m_axi_bresp,
    input  wire                     m_axi_bvalid,
    output reg                      m_axi_bready,
    
    // Read address channel
    output reg  [ADDR_WIDTH-1:0]    m_axi_araddr,
    output reg                      m_axi_arvalid,
    input  wire                     m_axi_arready,
    
    // Read data channel
    input  wire [DATA_WIDTH-1:0]    m_axi_rdata,
    input  wire [1:0]               m_axi_rresp,
    input  wire                     m_axi_rvalid,
    output reg                      m_axi_rready,
    
    // User interface
    input  wire                     write_req,
    input  wire [ADDR_WIDTH-1:0]    write_addr,
    input  wire [DATA_WIDTH-1:0]    write_data,
    output reg                      write_done,
    
    input  wire                     read_req,
    input  wire [ADDR_WIDTH-1:0]    read_addr,
    output reg  [DATA_WIDTH-1:0]    read_data,
    output reg                      read_done
);

    // State definitions
    localparam IDLE        = 3'd0;
    localparam WRITE_ADDR  = 3'd1;
    localparam WRITE_DATA  = 3'd2;
    localparam WRITE_RESP  = 3'd3;
    localparam READ_ADDR   = 3'd4;
    localparam READ_DATA   = 3'd5;

    reg [2:0] state, next_state;
    
    // State machine
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            state <= IDLE;
        else
            state <= next_state;
    end

    // Next state logic
    always @(*) begin
        next_state = state;
        case (state)
            IDLE: begin
                if (write_req)
                    next_state = WRITE_ADDR;
                else if (read_req)
                    next_state = READ_ADDR;
            end
            
            WRITE_ADDR: begin
                if (m_axi_awready)
                    next_state = WRITE_DATA;
            end
            
            WRITE_DATA: begin
                if (m_axi_wready)
                    next_state = WRITE_RESP;
            end
            
            WRITE_RESP: begin
                if (m_axi_bvalid)
                    next_state = IDLE;
            end
            
            READ_ADDR: begin
                if (m_axi_arready)
                    next_state = READ_DATA;
            end
            
            READ_DATA: begin
                if (m_axi_rvalid)
                    next_state = IDLE;
            end
            
            default: next_state = IDLE;
        endcase
    end

    // Output logic
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            m_axi_awaddr  <= 0;
            m_axi_awvalid <= 0;
            m_axi_wdata   <= 0;
            m_axi_wstrb   <= 0;
            m_axi_wvalid  <= 0;
            m_axi_bready  <= 0;
            m_axi_araddr  <= 0;
            m_axi_arvalid <= 0;
            m_axi_rready  <= 0;
            write_done    <= 0;
            read_done     <= 0;
            read_data     <= 0;
        end else begin
            case (state)
                IDLE: begin
                    m_axi_awvalid <= 0;
                    m_axi_wvalid  <= 0;
                    m_axi_bready  <= 0;
                    m_axi_arvalid <= 0;
                    m_axi_rready  <= 0;
                    write_done    <= 0;
                    read_done     <= 0;
                    
                    if (write_req) begin
                        m_axi_awaddr  <= write_addr;
                        m_axi_awvalid <= 1;
                        m_axi_wdata   <= write_data;
                        m_axi_wstrb   <= {(DATA_WIDTH/8){1'b1}};
                    end
                    else if (read_req) begin
                        m_axi_araddr  <= read_addr;
                        m_axi_arvalid <= 1;
                    end
                end
                
                WRITE_ADDR: begin
                    if (m_axi_awready) begin
                        m_axi_awvalid <= 0;
                        m_axi_wvalid  <= 1;
                    end
                end
                
                WRITE_DATA: begin
                    if (m_axi_wready) begin
                        m_axi_wvalid  <= 0;
                        m_axi_bready  <= 1;
                    end
                end
                
                WRITE_RESP: begin
                    if (m_axi_bvalid) begin
                        m_axi_bready  <= 0;
                        write_done    <= 1;
                    end
                end
                
                READ_ADDR: begin
                    if (m_axi_arready) begin
                        m_axi_arvalid <= 0;
                        m_axi_rready  <= 1;
                    end
                end
                
                READ_DATA: begin
                    if (m_axi_rvalid) begin
                        m_axi_rready  <= 0;
                        read_data     <= m_axi_rdata;
                        read_done     <= 1;
                    end
                end
            endcase
        end
    end

endmodule 

```

# axi_lite_slave.v

```verilog 

//0x000 ~ 0x3FF
module axi_lite_slave #(
    parameter ADDR_WIDTH = 32,
    parameter DATA_WIDTH = 32,
    parameter MEM_SIZE = 1024  // Size of memory in bytes
)(
    input  wire                     clk,
    input  wire                     rst_n,
    
    // Write address channel
    input  wire [ADDR_WIDTH-1:0]    s_axi_awaddr,
    input  wire                     s_axi_awvalid,
    output reg                      s_axi_awready,
    
    // Write data channel
    input  wire [DATA_WIDTH-1:0]    s_axi_wdata,
    input  wire [(DATA_WIDTH/8)-1:0] s_axi_wstrb,
    input  wire                     s_axi_wvalid,
    output reg                      s_axi_wready,
    
    // Write response channel
    output reg  [1:0]               s_axi_bresp,
    output reg                      s_axi_bvalid,
    input  wire                     s_axi_bready,
    
    // Read address channel
    input  wire [ADDR_WIDTH-1:0]    s_axi_araddr,
    input  wire                     s_axi_arvalid,
    output reg                      s_axi_arready,
    
    // Read data channel
    output reg  [DATA_WIDTH-1:0]    s_axi_rdata,
    output reg  [1:0]               s_axi_rresp,
    output reg                      s_axi_rvalid,
    input  wire                     s_axi_rready
);

    // Memory array
    reg [DATA_WIDTH-1:0] mem [0:(MEM_SIZE/DATA_WIDTH)-1];
    
    // State definitions
    localparam IDLE        = 3'd0;
    localparam WRITE_ADDR  = 3'd1;
    localparam WRITE_DATA  = 3'd2;
    localparam WRITE_RESP  = 3'd3;
    localparam READ_ADDR   = 3'd4;
    localparam READ_DATA   = 3'd5;

    reg [2:0] state, next_state;
    reg [ADDR_WIDTH-1:0] write_addr;
    reg [ADDR_WIDTH-1:0] read_addr;
    
    // State machine
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            state <= IDLE;
        else
            state <= next_state;
    end

    // Next state logic
    always @(*) begin
        next_state = state;
        case (state)
            IDLE: begin
                if (s_axi_awvalid)
                    next_state = WRITE_ADDR;
                else if (s_axi_arvalid)
                    next_state = READ_ADDR;
            end
            
            WRITE_ADDR: begin
                next_state = WRITE_DATA;
            end
            
            WRITE_DATA: begin
                if (s_axi_wvalid)
                    next_state = WRITE_RESP;
            end
            
            WRITE_RESP: begin
                if (s_axi_bready)
                    next_state = IDLE;
            end
            
            READ_ADDR: begin
                next_state = READ_DATA;
            end
            
            READ_DATA: begin
                if (s_axi_rready)
                    next_state = IDLE;
            end
            
            default: next_state = IDLE;
        endcase
    end

    // Output logic
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            s_axi_awready <= 0;
            s_axi_wready  <= 0;
            s_axi_bresp   <= 0;
            s_axi_bvalid  <= 0;
            s_axi_arready <= 0;
            s_axi_rdata   <= 0;
            s_axi_rresp   <= 0;
            s_axi_rvalid  <= 0;
            write_addr    <= 0;
            read_addr     <= 0;
        end else begin
            case (state)
                IDLE: begin
                    s_axi_awready <= 0;
                    s_axi_wready  <= 0;
                    s_axi_bvalid  <= 0;
                    s_axi_arready <= 0;
                    s_axi_rvalid  <= 0;
                    
                    if (s_axi_awvalid) begin
                        s_axi_awready <= 1;
                        write_addr    <= s_axi_awaddr;
                    end
                    else if (s_axi_arvalid) begin
                        s_axi_arready <= 1;
                        read_addr     <= s_axi_araddr;
                    end
                end
                
                WRITE_ADDR: begin
                    s_axi_awready <= 0;
                    s_axi_wready  <= 1;
                end
                
                WRITE_DATA: begin
                    if (s_axi_wvalid) begin
                        s_axi_wready <= 0;
                        // Write data to memory
                        mem[write_addr[DATA_WIDTH/8-1:0]] <= s_axi_wdata;
                        s_axi_bresp  <= 2'b00;  // OKAY response
                        s_axi_bvalid <= 1;
                    end
                end
                
                WRITE_RESP: begin
                    if (s_axi_bready) begin
                        s_axi_bvalid <= 0;
                    end
                end
                
                READ_ADDR: begin
                    s_axi_arready <= 0;
                    s_axi_rdata   <= mem[read_addr[DATA_WIDTH/8-1:0]];
                    s_axi_rresp   <= 2'b00;  // OKAY response
                    s_axi_rvalid  <= 1;
                end
                
                READ_DATA: begin
                    if (s_axi_rready) begin
                        s_axi_rvalid <= 0;
                    end
                end
            endcase
        end
    end

endmodule 
```

# axi_lite_slave 测试
```verilog
`timescale 1ns/1ps

module tb;
    // 参数定义
    parameter ADDR_WIDTH = 32;
    parameter DATA_WIDTH = 32;
    parameter MEM_SIZE = 1024;  // 总内存大小：1024字节
    parameter MAX_INDEX = (MEM_SIZE / 4) - 1;  // 最大索引（255）

    // 时钟和复位信号
    reg clk;
    reg rst_n;

    // AXI-Lite接口定义
    interface axi_lite_if #(
        parameter ADDR_WIDTH = 32,
        parameter DATA_WIDTH = 32
    );
        logic clk;
        logic [ADDR_WIDTH-1:0] awaddr;
        logic                  awvalid;
        logic                  awready;
        logic [DATA_WIDTH-1:0] wdata;
        logic [(DATA_WIDTH/8)-1:0] wstrb;
        logic                  wvalid;
        logic                  wready;
        logic [1:0]            bresp;
        logic                  bvalid;
        logic                  bready;
        logic [ADDR_WIDTH-1:0] araddr;
        logic                  arvalid;
        logic                  arready;
        logic [DATA_WIDTH-1:0] rdata;
        logic [1:0]            rresp;
        logic                  rvalid;
        logic                  rready;
    endinterface

    // 实例化接口并连接时钟
    axi_lite_if #(ADDR_WIDTH, DATA_WIDTH) axi_if ();
    assign axi_if.clk = clk;

    // 实例化DUT
    axi_lite_slave #(
        .ADDR_WIDTH(ADDR_WIDTH),
        .DATA_WIDTH(DATA_WIDTH),
        .MEM_SIZE(MEM_SIZE)
    ) u_axi_lite_slave (
        .clk(clk),
        .rst_n(rst_n),
        .s_axi_awaddr(axi_if.awaddr),
        .s_axi_awvalid(axi_if.awvalid),
        .s_axi_awready(axi_if.awready),
        .s_axi_wdata(axi_if.wdata),
        .s_axi_wstrb(axi_if.wstrb),
        .s_axi_wvalid(axi_if.wvalid),
        .s_axi_wready(axi_if.wready),
        .s_axi_bresp(axi_if.bresp),
        .s_axi_bvalid(axi_if.bvalid),
        .s_axi_bready(axi_if.bready),
        .s_axi_araddr(axi_if.araddr),
        .s_axi_arvalid(axi_if.arvalid),
        .s_axi_arready(axi_if.arready),
        .s_axi_rdata(axi_if.rdata),
        .s_axi_rresp(axi_if.rresp),
        .s_axi_rvalid(axi_if.rvalid),
        .s_axi_rready(axi_if.rready)
    );

    // 时钟生成
    initial begin
        clk = 0;
        forever #5 clk = ~clk;
    end

    // AXI-Lite主机类（write/read第一个参数为地址索引）
    class axi_lite_master;
        virtual axi_lite_if #(ADDR_WIDTH, DATA_WIDTH) vif;
        int index;  // 地址索引（成员变量）
        logic [ADDR_WIDTH-1:0] addr;  // 实际地址（成员变量）
        logic [DATA_WIDTH-1:0] data;  // 数据（成员变量）
        int error_code;  // 错误码
        
        // 错误码定义
        parameter int NO_ERROR       = 0;
        parameter int INDEX_ERROR    = 1;  // 索引越界错误
        parameter int RESPONSE_ERROR = 2;  // 响应错误
        
        // 构造函数
        function new(virtual axi_lite_if #(ADDR_WIDTH, DATA_WIDTH) iface);
            this.vif = iface;
            this.error_code = NO_ERROR;
        endfunction
        
        // 写操作（第一个参数为地址索引）
        task write(int index, logic [DATA_WIDTH-1:0] data);
            logic [ADDR_WIDTH-1:0] addr;  // 实际地址
            
            error_code = NO_ERROR;
            
            // 检查索引是否越界
            if (index < 0 || index > MAX_INDEX) begin
                error_code = INDEX_ERROR;
                $display("Write error: Index %0d out of range (0~%0d)", index, MAX_INDEX);
                return;
            end
            
            this.index = index;
            this.data = data;
            addr = index * 4;  // 索引转地址
            this.addr = addr;
            
            // AXI-Lite写时序
            @(posedge vif.clk);
            vif.awaddr  = addr;
            vif.awvalid = 1'b1;
            @(posedge vif.clk);
            while (!vif.awready) @(posedge vif.clk);
            vif.awvalid = 1'b0;
            
            vif.wdata  = data;
            vif.wstrb  = 4'b1111;
            vif.wvalid = 1'b1;
            @(posedge vif.clk);
            while (!vif.wready) @(posedge vif.clk);
            vif.wvalid = 1'b0;
            
            vif.bready = 1'b1;
            @(posedge vif.clk);
            while (!vif.bvalid) @(posedge vif.clk);
            if (vif.bresp != 2'b00) error_code = RESPONSE_ERROR;
            vif.bready = 1'b0;
            @(posedge vif.clk);
        endtask
        
        // 读操作（第一个参数为地址索引）
        task read(int index, output logic [DATA_WIDTH-1:0] data);
            logic [ADDR_WIDTH-1:0] addr;  // 实际地址
            
            error_code = NO_ERROR;
            
            // 检查索引是否越界
            if (index < 0 || index > MAX_INDEX) begin
                error_code = INDEX_ERROR;
                $display("Read error: Index %0d out of range (0~%0d)", index, MAX_INDEX);
                return;
            end
            
            this.index = index;
            addr = index * 4;  // 索引转地址
            this.addr = addr;
            
            // AXI-Lite读时序
            @(posedge vif.clk);
            vif.araddr  = addr;
            vif.arvalid = 1'b1;
            @(posedge vif.clk);
            while (!vif.arready) @(posedge vif.clk);
            vif.arvalid = 1'b0;
            
            vif.rready = 1'b1;
            @(posedge vif.clk);
            while (!vif.rvalid) @(posedge vif.clk);
            data = vif.rdata;
            this.data = data;
            if (vif.rresp != 2'b00) error_code = RESPONSE_ERROR;
            vif.rready = 1'b0;
            @(posedge vif.clk);
        endtask
    endclass

    // 主测试序列（所有调用均使用变量传递索引）
    initial begin
        axi_lite_master axi_master;
        logic [DATA_WIDTH-1:0] read_data;  // 读取数据变量
        int idx;  // 地址索引变量（核心：所有调用均使用此变量）
        logic [DATA_WIDTH-1:0] data_var;  // 数据变量
        
        // 初始化信号
        axi_if.awaddr  = 0;
        axi_if.awvalid = 0;
        axi_if.wdata   = 0;
        axi_if.wstrb   = 0;
        axi_if.wvalid  = 0;
        axi_if.bready  = 0;
        axi_if.araddr  = 0;
        axi_if.arvalid = 0;
        axi_if.rready  = 0;
        rst_n          = 0;
        
        // 创建AXI主机实例
        axi_master = new(axi_if);
        
        // 复位
        #100;
        rst_n = 1;
        $display("=== Reset released, starting tests (variable index) ===");
        
        // 测试1：基础变量索引读写
        $display("\n=== Test 1: Basic variable index read-write ===");
        idx = 0;  // 索引变量赋值
        data_var = 32'h1234_5678;  // 数据变量赋值
        axi_master.write(idx, data_var);  // 变量传参
        axi_master.read(idx, read_data);   // 变量传参
        $display("Index: %0d, Address: 0x%08X, Read: 0x%08X %s",
                 idx, axi_master.addr, read_data,
                 (read_data == data_var) ? "PASS" : "FAIL");
        
        // 测试2：多变量索引读写
        $display("\n=== Test 2: Multi-variable index read-write ===");
        idx = 1;  // 修改变量值
        data_var = 32'hDEAD_BEEF;
        axi_master.write(idx, data_var);
        
        idx = 2;  // 修改变量值
        data_var = 32'hCAFE_BABE;
        axi_master.write(idx, data_var);
        
        idx = 3;  // 修改变量值
        data_var = 32'hF00D_F00D;
        axi_master.write(idx, data_var);
        
        // 验证索引1
        idx = 1;
        axi_master.read(idx, read_data);
        $display("Index: %0d, Read: 0x%08X %s",
                 idx, read_data,
                 (read_data == 32'hDEAD_BEEF) ? "PASS" : "FAIL");
        
        // 验证索引2
        idx = 2;
        axi_master.read(idx, read_data);
        $display("Index: %0d, Read: 0x%08X %s",
                 idx, read_data,
                 (read_data == 32'hCAFE_BABE) ? "PASS" : "FAIL");
        
        // 测试3：变量索引覆盖写入
        $display("\n=== Test 3: Variable index overwrite ===");
        idx = 4;
        data_var = 32'h0000_0000;
        axi_master.write(idx, data_var);  // 第一次写入
        
        data_var = 32'hAABB_CCDD;  // 修改数据变量
        axi_master.write(idx, data_var);  // 同一索引覆盖写入
        
        axi_master.read(idx, read_data);
        $display("Index: %0d, Read: 0x%08X %s",
                 idx, read_data,
                 (read_data == data_var) ? "PASS" : "FAIL");
        
        // 测试4：边界变量索引
        $display("\n=== Test 4: Boundary variable index ===");
        idx = MAX_INDEX;  // 使用最大索引变量
        data_var = 32'hBEEF_DEAD;
        axi_master.write(idx, data_var);
        axi_master.read(idx, read_data);
        $display("Index: %0d, Read: 0x%08X %s",
                 idx, read_data,
                 (read_data == data_var) ? "PASS" : "FAIL");
        
        // 测试5：循环变量索引批量操作
        $display("\n=== Test 5: Loop with variable index ===");
        for (idx = 5; idx <= 8; idx++) begin  // 循环修改变量
            data_var = 32'h2222_0000 + (idx * 32'h0000_1111);  // 数据随索引变化
            axi_master.write(idx, data_var);  // 变量传参
            axi_master.read(idx, read_data);   // 变量传参
            $display("Index: %0d, Read: 0x%08X %s",
                     idx, read_data,
                     (read_data == data_var) ? "PASS" : "FAIL");
        end
        
        // 测试6：动态变量索引
        $display("\n=== Test 6: Dynamic variable index ===");
        idx = 9;
        repeat (3) begin  // 连续修改3次索引
            data_var = 32'h5555_5555 + (idx * 32'h0000_2222);
            axi_master.write(idx, data_var);
            axi_master.read(idx, read_data);
            $display("Index: %0d, Read: 0x%08X %s",
                     idx, read_data,
                     (read_data == data_var) ? "PASS" : "FAIL");
            idx++;  // 索引自增
        end
        
        $display("\n=== All tests completed ===");
        $finish;
    end

endmodule
```
# axi_lite_slave的伪代码
```verilog
// ==============================================
// AXI-LITE 写事务 - 从机响应流程
// ==============================================

// 1️⃣ 等待地址有效
wait (s_axi_awvalid);             // 🔁 等待主机发来写地址
s_axi_awready <= 1;               // ✅ 表示准备接收地址
write_awaddr  = s_axi_awaddr;     // 💾 缓存写地址（注意必须在握手后使用）
s_axi_awready <= 0;               // 📴 完成地址握手

// 2️⃣ 等待写数据
wait (s_axi_wvalid);              // 🔁 等待主机发来数据
s_axi_wready <= 1;             //✅ 表示从机已准备好接收数据
write_mem[write_awaddr] <= s_axi_wdata;  // 📝 写入内部存储器
s_axi_wready <= 0;               // 📴 完成数据握手,表示数据接收完毕

// 3️⃣ 发送写响应
s_axi_bresp  <= 2'b00;            // ✅ OKAY 响应
s_axi_bvalid <= 1;                // 📢 写事务完成
wait (s_axi_bready);              // 🔁 等待主机接收响应
s_axi_bvalid <= 0;                // 📴 完成握手，返回空闲


######################################################################################
#################################分割线###############################################
######################################################################################
// ==============================================
// AXI 读事务 - 从机响应流程（适用于 AXI4-Lite）
// ==============================================

// 1️⃣ 等待主机发送读地址
wait (s_axi_arvalid);                 // 🔁 等待地址有效
s_axi_arready <= 1;                   // ✅ 表示从机已准备好接收地址
read_araddr   <= s_axi_araddr;       // 💾 保存地址
s_axi_arready <= 0;                   // 📴 拉低 ready，表示地址接收完毕

// 2️⃣ 准备并返回读数据
s_axi_rdata  <= mem[read_araddr];    // 📖 从内部 RAM 或寄存器读取数据
s_axi_rresp  <= 2'b00;               // ✅ OKAY 响应
s_axi_rvalid <= 1;                   // 📢 表示读数据有效

wait (s_axi_rready);                 // 🔁 等待主机接收
s_axi_rvalid <= 0;                   // 📴 传输完成，释放 rvalid

```
#  tb.v
```verilog
module tb;
    parameter ADDR_WIDTH = 32;
    parameter DATA_WIDTH = 32;
    parameter MEM_SIZE = 1024;
    
    // Clock and reset
    reg clk;
    reg rst_n;
    
    // Master interface
    wire [ADDR_WIDTH-1:0]    m_axi_awaddr;
    wire                     m_axi_awvalid;
    wire                     m_axi_awready;
    wire [DATA_WIDTH-1:0]    m_axi_wdata;
    wire [(DATA_WIDTH/8)-1:0] m_axi_wstrb;
    wire                     m_axi_wvalid;
    wire                     m_axi_wready;
    wire [1:0]               m_axi_bresp;
    wire                     m_axi_bvalid;
    wire                     m_axi_bready;
    wire [ADDR_WIDTH-1:0]    m_axi_araddr;
    wire                     m_axi_arvalid;
    wire                     m_axi_arready;
    wire [DATA_WIDTH-1:0]    m_axi_rdata;
    wire [1:0]               m_axi_rresp;
    wire                     m_axi_rvalid;
    wire                     m_axi_rready;
    
    // Master user interface
    reg                      write_req;
    reg  [ADDR_WIDTH-1:0]    write_addr;
    reg  [DATA_WIDTH-1:0]    write_data;
    wire                     write_done;
    reg                      read_req;
    reg  [ADDR_WIDTH-1:0]    read_addr;
    wire [DATA_WIDTH-1:0]    read_data;
    wire                     read_done;
    
    // Instantiate master
    axi_lite_master #(
        .ADDR_WIDTH(ADDR_WIDTH),
        .DATA_WIDTH(DATA_WIDTH)
    ) master (
        .clk(clk),
        .rst_n(rst_n),
        .m_axi_awaddr(m_axi_awaddr),
        .m_axi_awvalid(m_axi_awvalid),
        .m_axi_awready(m_axi_awready),
        .m_axi_wdata(m_axi_wdata),
        .m_axi_wstrb(m_axi_wstrb),
        .m_axi_wvalid(m_axi_wvalid),
        .m_axi_wready(m_axi_wready),
        .m_axi_bresp(m_axi_bresp),
        .m_axi_bvalid(m_axi_bvalid),
        .m_axi_bready(m_axi_bready),
        .m_axi_araddr(m_axi_araddr),
        .m_axi_arvalid(m_axi_arvalid),
        .m_axi_arready(m_axi_arready),
        .m_axi_rdata(m_axi_rdata),
        .m_axi_rresp(m_axi_rresp),
        .m_axi_rvalid(m_axi_rvalid),
        .m_axi_rready(m_axi_rready),
        .write_req(write_req),
        .write_addr(write_addr),
        .write_data(write_data),
        .write_done(write_done),
        .read_req(read_req),
        .read_addr(read_addr),
        .read_data(read_data),
        .read_done(read_done)
    );
    
    // Instantiate slave
    axi_lite_slave #(
        .ADDR_WIDTH(ADDR_WIDTH),
        .DATA_WIDTH(DATA_WIDTH),
        .MEM_SIZE(MEM_SIZE)
    ) slave (
        .clk(clk),
        .rst_n(rst_n),
        .s_axi_awaddr(m_axi_awaddr),
        .s_axi_awvalid(m_axi_awvalid),
        .s_axi_awready(m_axi_awready),
        .s_axi_wdata(m_axi_wdata),
        .s_axi_wstrb(m_axi_wstrb),
        .s_axi_wvalid(m_axi_wvalid),
        .s_axi_wready(m_axi_wready),
        .s_axi_bresp(m_axi_bresp),
        .s_axi_bvalid(m_axi_bvalid),
        .s_axi_bready(m_axi_bready),
        .s_axi_araddr(m_axi_araddr),
        .s_axi_arvalid(m_axi_arvalid),
        .s_axi_arready(m_axi_arready),
        .s_axi_rdata(m_axi_rdata),
        .s_axi_rresp(m_axi_rresp),
        .s_axi_rvalid(m_axi_rvalid),
        .s_axi_rready(m_axi_rready)
    );
    
    // Clock generation
    initial begin
        clk = 0;
        forever #5 clk = ~clk;
    end
    
    // Test stimulus
    initial begin
        // Initialize signals
        rst_n = 0;
        write_req = 0;
        read_req = 0;
        write_addr = 0;
        write_data = 0;
        read_addr = 0;
        
        // Reset
        #20;
        rst_n = 1;
        #20;
        
        // Test write operation
        write_addr = 32'h000;
        write_data = 32'h12345678;
        write_req = 1;
        #10;
        write_req = 0;
        
        // Wait for write to complete
        wait(write_done);
        #20;
        
        // Test read operation
        read_addr = 32'h000;
        read_req = 1;
        #10;
        read_req = 0;
        
        // Wait for read to complete
        wait(read_done);
        #20;
        
        // Verify read data
        if (read_data === 32'h12345678)
            $display("Test passed: Read data matches written data");
        else
            $display("Test failed: Read data = %h, Expected = %h", read_data, 32'h12345678);
        
        // Test write operation
        write_addr = 32'h008;
        write_data = 32'h15067374;
        write_req = 1;
        #10;
        write_req = 0;
        
        // Wait for write to complete
        wait(write_done);
        #20;
        
        // Test read operation
        read_addr = 32'h008;
        read_req = 1;
        #10;
        read_req = 0;
        
        // Wait for read to complete
        wait(read_done);
        #20;
        
        // Verify read data
        if (read_data === 32'h15067374)
            $display("Test passed: Read data matches written data");
        else
            $display("Test failed: Read data = %h, Expected = %h", read_data, 32'h15067374);









        // End simulation
        #100;
        $finish;
    end
    
    // Monitor
    initial begin
        $monitor("Time=%0t rst_n=%b write_req=%b write_data=%h read_req=%b write_done=%b read_done=%b read_data=%h",
                 $time, rst_n, write_req, write_data, read_req, write_done, read_done, read_data);
    end
    
endmodule 
```


# system_wrapper.v 是自动生成的
```verilog
//Copyright 1986-2020 Xilinx, Inc. All Rights Reserved.
//--------------------------------------------------------------------------------
//Tool Version: Vivado v.2020.2 (win64) Build 3064766 Wed Nov 18 09:12:45 MST 2020
//Date        : Wed Jul 16 11:13:45 2025
//Host        : DESKTOP-FMC24FS running 64-bit major release  (build 9200)
//Command     : generate_target system_wrapper.bd
//Design      : system_wrapper
//Purpose     : IP block netlist
//--------------------------------------------------------------------------------
`timescale 1 ps / 1 ps

module system_wrapper
   (clk,
    read_addr,
    read_data,
    read_done,
    read_req,
    rst_n,
    write_addr,
    write_data,
    write_done,
    write_req);
  input clk;
  input [31:0]read_addr;
  output [31:0]read_data;
  output read_done;
  input read_req;
  input rst_n;
  input [31:0]write_addr;
  input [31:0]write_data;
  output write_done;
  input write_req;

  wire clk;
  wire [31:0]read_addr;
  wire [31:0]read_data;
  wire read_done;
  wire read_req;
  wire rst_n;
  wire [31:0]write_addr;
  wire [31:0]write_data;
  wire write_done;
  wire write_req;

  system system_i
       (.clk(clk),
        .read_addr(read_addr),
        .read_data(read_data),
        .read_done(read_done),
        .read_req(read_req),
        .rst_n(rst_n),
        .write_addr(write_addr),
        .write_data(write_data),
        .write_done(write_done),
        .write_req(write_req));
endmodule

```



# vivado_tb.v
```verilog
`timescale 1 ps / 1 ps

module vivado_tb;
    parameter ADDR_WIDTH = 32;
    parameter DATA_WIDTH = 32;
    parameter MEM_SIZE = 1024;
    // Clock and reset
    reg clk;
    reg rst_n;
    // Master user interface
    reg                      write_req;
    reg  [ADDR_WIDTH-1:0]    write_addr;
    reg  [DATA_WIDTH-1:0]    write_data;
    wire                     write_done;
    reg                      read_req;
    reg  [ADDR_WIDTH-1:0]    read_addr;
    wire [DATA_WIDTH-1:0]    read_data;
    wire                     read_done;
    
    // Instantiate master
    system_wrapper  u_system_wrapper(
        .clk(clk),
        .rst_n(rst_n),
        .write_req(write_req),
        .write_addr(write_addr),
        .write_data(write_data),
        .write_done(write_done),
        .read_req(read_req),
        .read_addr(read_addr),
        .read_data(read_data),
        .read_done(read_done)
    );
    
  
    
    // Clock generation
    initial begin
        clk = 0;
        forever #5 clk = ~clk;
    end
    
    // Test stimulus
    initial begin
        // Initialize signals
        rst_n = 0;
        write_req = 0;
        read_req = 0;
        write_addr = 0;
        write_data = 0;
        read_addr = 0;
        
        // Reset
        #20;
        rst_n = 1;
        #20;
        
        // Test write operation
        write_addr = 32'h000;
        write_data = 32'h12345678;
        write_req = 1;
        #10;
        write_req = 0;
        
        // Wait for write to complete
        wait(write_done);
        #20;
        
        // Test read operation
        read_addr = 32'h000;
        read_req = 1;
        #10;
        read_req = 0;
        
        // Wait for read to complete
        wait(read_done);
        #20;
        
        // Verify read data
        if (read_data === 32'h12345678)
            $display("Test passed: Read data matches written data");
        else
            $display("Test failed: Read data = %h, Expected = %h", read_data, 32'h12345678);
        
        // Test write operation
        write_addr = 32'h008;
        write_data = 32'h15067374;
        write_req = 1;
        #10;
        write_req = 0;
        
        // Wait for write to complete
        wait(write_done);
        #20;
        
        // Test read operation
        read_addr = 32'h008;
        read_req = 1;
        #10;
        read_req = 0;
        
        // Wait for read to complete
        wait(read_done);
        #20;
        
        // Verify read data
        if (read_data === 32'h15067374)
            $display("Test passed: Read data matches written data");
        else
            $display("Test failed: Read data = %h, Expected = %h", read_data, 32'h15067374);



        // End simulation
        #100;
        $finish;
    end
    
    // Monitor
    initial begin
        $monitor("Time=%0t rst_n=%b write_req=%b write_data=%h read_req=%b write_done=%b read_done=%b read_data=%h",
                 $time, rst_n, write_req, write_data, read_req, write_done, read_done, read_data);
    end
    
endmodule 
```

# AxiLiteDriver
## 裸机AxiLiteDriver
### axi_lite_driver.h
```c
#ifndef AXI_LITE_DRIVER_H_INC
#define AXI_LITE_DRIVER_H_INC
#include "stdio.h"
#include "stdint.h"
class AxiLiteDriver  {
public:
    AxiLiteDriver(uint32_t baseAddr = 0x43C00000, uint32_t dataLen = 44);
    virtual ~AxiLiteDriver();
    virtual bool Open(void);
    virtual void Close(void);
    virtual uint32_t ReadReg(uint32_t regInx);
    virtual void WriteReg(uint32_t regInx, uint32_t data);
    static  AxiLiteDriver* Create(void);
    static inline void MemoryBarrier() {
    
    }
private:
    uint32_t m_baseAddr;
    uint32_t m_dataLen;
    int m_fd;
    uint32_t *m_mapBase;
    static bool	M_initOk;
    static AxiLiteDriver* M_axiLiteDriver;
    AxiLiteDriver(const AxiLiteDriver &) = delete;
    AxiLiteDriver &operator=(const AxiLiteDriver &) = delete;
};
#endif
```
### axi_lite_driver.cpp
```c
#include "axi_lite_driver.h"
#include "xil_io.h"
#include <unistd.h>
#include <cstdio>
#include <cstring>

bool AxiLiteDriver::M_initOk = false;
AxiLiteDriver *AxiLiteDriver::M_axiLiteDriver = nullptr;

AxiLiteDriver::AxiLiteDriver(uint32_t baseAddr, uint32_t dataLen)
        : m_baseAddr(baseAddr), m_dataLen(dataLen), m_fd(-1), m_mapBase(nullptr) {
}


AxiLiteDriver * AxiLiteDriver::Create(void) {
    if (AxiLiteDriver::M_initOk) {
        return AxiLiteDriver::M_axiLiteDriver;
    }
    if (AxiLiteDriver::M_axiLiteDriver == nullptr) {
        AxiLiteDriver::M_axiLiteDriver = new AxiLiteDriver();
        bool ret= AxiLiteDriver::M_axiLiteDriver->Open();
        if( !ret){
            return nullptr;
        }
    }
    return AxiLiteDriver::M_axiLiteDriver;
}


AxiLiteDriver::~AxiLiteDriver() {

}


bool AxiLiteDriver::Open(void) {
    if (AxiLiteDriver::M_initOk) {
        return true;
    }
    return true;
}


void AxiLiteDriver::Close(void) {


}





uint32_t AxiLiteDriver::ReadReg(uint32_t regInx) {
    return Xil_In32(m_baseAddr+4*regInx);
}


void AxiLiteDriver::WriteReg(uint32_t regInx, uint32_t data) {
	Xil_Out32(m_baseAddr+4*regInx,data);
}

```
## linux中AxiLiteDriver
### axi_lite_driver.h

```c
#ifndef AXI_LITE_DRIVER_H_INC
#define AXI_LITE_DRIVER_H_INC
#include "stdio.h"
#include "stdint.h"
class AxiLiteDriver  {
public:
    AxiLiteDriver(uint32_t baseAddr = 0x43C00000, uint32_t dataLen = 128);
    virtual ~AxiLiteDriver();
    virtual bool Open(void);
    virtual void Close(void);
    virtual uint32_t ReadReg(uint32_t regInx);
    virtual void WriteReg(uint32_t regInx, uint32_t data);
    static  AxiLiteDriver* Create(void);
    static inline void MemoryBarrier() {
        #if defined(__arm__)
            asm volatile("dmb ish" ::: "memory");
        #endif
    }
private:
    uint32_t m_baseAddr;
    uint32_t m_dataLen;
    int m_fd;
    volatile uint32_t *m_mapBase;
    static bool	M_initOk;
    static AxiLiteDriver* M_axiLiteDriver;
    AxiLiteDriver(const AxiLiteDriver &) = delete;
    AxiLiteDriver &operator=(const AxiLiteDriver &) = delete;
};
#endif 
```

### axi_lite_driver.cpp
```c
#include "axi_lite_driver.h"
#include <fcntl.h>
#include <unistd.h>

#if defined(__arm__)
#include <sys/mman.h>
#endif

#include <cstdio>
#include <cstring>

bool AxiLiteDriver::M_initOk = false;
AxiLiteDriver *AxiLiteDriver::M_axiLiteDriver = nullptr;

AxiLiteDriver::AxiLiteDriver(uint32_t baseAddr, uint32_t dataLen)
        : m_baseAddr(baseAddr), m_dataLen(dataLen), m_fd(-1), m_mapBase(nullptr) {
}

AxiLiteDriver * AxiLiteDriver::Create(void) {
    if (AxiLiteDriver::M_initOk) {
        return AxiLiteDriver::M_axiLiteDriver;
    }
    if (AxiLiteDriver::M_axiLiteDriver == nullptr) {
        AxiLiteDriver::M_axiLiteDriver = new AxiLiteDriver();
        bool ret= AxiLiteDriver::M_axiLiteDriver->Open();
        if( !ret){
            return nullptr;
        }
    }
    return AxiLiteDriver::M_axiLiteDriver;
}

AxiLiteDriver::~AxiLiteDriver() {
    Close();
}

bool AxiLiteDriver::Open(void) {
    if (AxiLiteDriver::M_initOk) {
        return true;
    }
#if defined(__arm__)
    m_fd = open("/dev/mem", O_RDWR | O_SYNC);
    if (m_fd < 0) {
        perror("Cannot open /dev/mem");
        return false;
    }
    m_mapBase = (volatile uint32_t *)mmap(NULL, m_dataLen * 4, PROT_READ | PROT_WRITE, MAP_SHARED, m_fd, m_baseAddr);
    if (m_mapBase == MAP_FAILED) {
        perror("mmap failed");
        close(m_fd);
        m_fd = -1;
        return false;
    }
#else
    m_mapBase = new uint32_t[m_dataLen];
    memset(m_mapBase, 0, m_dataLen * 4);
#endif
    AxiLiteDriver::M_initOk = true;
    return true;
}

void AxiLiteDriver::Close(void) {
    if (M_initOk) {
            #if defined(__arm__)
                    if (m_mapBase != nullptr && m_mapBase != MAP_FAILED) {
                        munmap((void *) m_mapBase, m_dataLen * 4);
                        m_mapBase = nullptr;
                    }
                    if (m_fd >= 0) {
                        close(m_fd);
                        m_fd = -1;
                    }
            #else
                    delete[] m_mapBase;
                    m_mapBase = nullptr;
            #endif
        M_initOk = false;
    }
}

uint32_t AxiLiteDriver::ReadReg(uint32_t regInx) {
    return *(m_mapBase + regInx);
}

void AxiLiteDriver::WriteReg(uint32_t regInx, uint32_t data) {
    *(m_mapBase + regInx) = data;
} 
```




# vitis 裸机测试axi外设
```c
#include "xil_io.h"
#include "xil_printf.h"
#include "stdio.h"

#define BASE_ADDR   0x43C00000     // AXI base address
#define MAX_INDEX   15             // Max allowed register index (0~15)

int main()
{
    char cmd;
    int index;
    u32 value;

    xil_printf("==== AXI Read/Write (Index Mode, Range 0~%d) ====\r\n", MAX_INDEX);
    xil_printf("Usage:\r\n");
    xil_printf("  w <index> <value>   --> Write value to BASE_ADDR + 4*index\r\n");
    xil_printf("  r <index>           --> Read value from BASE_ADDR + 4*index\r\n");

    while (1)
    {
        xil_printf("\r\n> ");

        if (scanf(" %c", &cmd) != 1)
            continue;

        switch (cmd)
        {
            case 'r':
                if (scanf("%d", &index) == 1)
                {
                    if (index < 0 || index > MAX_INDEX)
                    {
                        xil_printf("Error: index out of range [0 ~ %d]\r\n", MAX_INDEX);
                        while (getchar() != '\n');
                        continue;
                    }

                    u32 read_val = Xil_In32(BASE_ADDR + 4 * index);
                    xil_printf("[r %d] = 0x%08X / %u\r\n", index, read_val, read_val);
                }
                else
                {
                    xil_printf("Invalid input. Use: r <index>\r\n");
                    while (getchar() != '\n');
                }
                break;

            case 'w':
                if (scanf("%d %u", &index, &value) == 2)
                {
                    if (index < 0 || index > MAX_INDEX)
                    {
                        xil_printf("Error: index out of range [0 ~ %d]\r\n", MAX_INDEX);
                        while (getchar() != '\n');
                        continue;
                    }

                    Xil_Out32(BASE_ADDR + 4 * index, value);
                    xil_printf("[w %d] = 0x%08X / %u\r\n", index, value, value);
                }
                else
                {
                    xil_printf("Invalid input. Use: w <index> <value>\r\n");
                    while (getchar() != '\n');
                }
                break;

            default:
                xil_printf("Unknown command '%c'. Use 'r' or 'w'.\r\n", cmd);
                while (getchar() != '\n');
                break;
        }
    }

    return 0;
}

```