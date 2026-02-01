# Zynq中级开发七项必修课第五课：S_AXI_ACP 一致性接口实践
[目录](https://blog.csdn.net/qq_26074053/article/details/150427199)
和第四课的内容基本一致，只是把axi_full_master 接到 PS的 S_AXI_ACP接口上。
PS不用再手动调用 
Xil_DCacheDisable();
或
Xil_SetTlbAttributes(SHARE_MEM_BASE, NORM_NONCACHE | SHAREABLE);
每按下一次按键，就把按键按下的次数m,m+1,...m+1023
写入ddr中,中断里读取0号寄存器和1023号寄存器,
1023号寄存器的值减去0号寄存器的值是1023，则测试成功

# GP,HP,ACP 接口对比

| 接口                                   | 总线宽度                    | 协议                         | 突发支持              | **典型带宽范围**                            | **延迟特性**                                    | 典型用途                        |
| ------------------------------------ | ----------------------- | -------------------------- | ----------------- | ------------------------------------- | ------------------------------------------- | --------------------------- |
| **GP (General Purpose)**             | 32-bit                  | AXI4-Full（常用 AXI4-Lite 风格） | 协议支持，但多数外设只实现单拍   | **几十 MB/s**（吞吐差）                      | **单次延迟最低**（几十 ns），但缺乏突发，连续访问平均延迟高           | 控制寄存器、状态寄存器、小缓冲区            |
| **HP (High Performance)**            | 64-bit ×4 通道（最高 256bit） | AXI4-Full                  | 支持突发（最多 256 beat） | **800 MB/s \~ 3.2 GB/s**（单口），多口并行可更高  | **单次访问延迟较高**（DDR 仲裁，上百 ns），**突发平均延迟低**，适合流式 | DMA、大数据流（视频帧、ADC 波形、FFT 缓存） |
| **ACP (Accelerator Coherency Port)** | 128-bit                 | AXI4-Full + Cache一致性       | 支持突发              | **400 MB/s \~ 1 GB/s**（低于 HP，因经过 SCU） | **中等延迟**（比 HP 多 SCU snoop 开销）               | 协处理器、CPU/PL 共享内存、频繁小数据交互    |


# HP 与 ACP 接口 使用场景对比
| 维度               | **HP 接口 (High Performance Ports)**                                                                       | **ACP 接口 (Accelerator Coherency Port)**                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **接口宽度/带宽**      | 4×64bit 通道，直连 DDR 控制器，**带宽最高**，适合 GB/s 级数据流                                                              | 单一 128bit 通道，经过 SCU，带宽中等，低于 HP                                                                      |
| **延迟**           | 低延迟，PL 发起访问直通 DDR                                                                                        | 延迟略高，因需 SCU 参与 cache 一致性维护                                                                          |
| **Cache 一致性**    | **无自动一致性**。CPU 若开 Cache，必须软件 `Xil_DCacheFlush/Invalidate` 管理                                             | **硬件自动一致性**，CPU/PL 读写共享数据时自动同步，无需手动 flush                                                           |
| **CPU Cache 状态** | 常需禁用 Cache 或手动管理 → CPU 性能受损                                                                              | Cache 可全开，CPU 仍可高速运行                                                                                |
| **优势**           | 极高带宽，适合连续大数据流；直通 DDR，简单可靠                                                                                | CPU/PL 共享数据简单，无需 Cache 操作；低延迟同步；编程方便                                                                |
| **劣势**           | 缺乏一致性，需软件干预；CPU 开销大                                                                                      | 带宽不如 HP；经过 SCU 有额外延迟；不可并行多口                                                                         |
| **典型应用场景**       | - **视频流采集/显示**（HDMI, Camera）<br>- **高速 ADC/DAC 数据采集**<br>- **DMA 批量搬运**（波形、文件缓冲）<br>- **FFT/图像处理输入输出缓存** | - **硬件协处理器**（矩阵乘法、加解密、滤波）<br>- **CPU 与 PL 共享环形缓冲区**<br>- **任务队列/链表结构共享**<br>- **小数据频繁交互（RPC、消息传递）** |
| **一句话总结**        | **大流量、批量搬运**，比如一帧图像、连续波形数据                                                                               | **小数据、频繁交互**，比如协处理计算、共享数据结构                                                                         |

# M_AXI_GP+BRAM 和 PS直接访问DDR对比

| 场景     | M_AXI_GP → BRAM      | PS 直接访问 DDR                    |
| ------ | ------------------- | ------------------------------ |
| 单次小访问  | **快**（几拍返回）         | 慢（DDR 数十 ns 延迟，除非命中 Cache）     |
| 大量数据传输 | 慢（32bit，一般非突发，握手开销大）  | **快**（突发 + Cache + 预取，GB/s 级别） |
| CPU 负担 | 高（每次都要握手） | 低（Cache 加速，突发读写）               |
| 典型用途   | 控制寄存器、状态标志、小缓冲      | 大规模数据存储/搬运、程序运行、数据流缓存          |


# 目标

> - 1.0 编写 AXI-FULL Master：按键计数 → 写入 PS 内存  
>  - 1.1 PL 触发中断 → PS 响应并串口打印按键计数值  



# BD图
axi_full_master 引入了手动复位
因为 AXI_Full_MASTER 接口可以与 GP、HP、ACP 接口连接
这个BD 无论用哪个接口都可以,只是它们在  带宽, 突发支持,缓存一致性有差异
- 简单外设连 GP，不浪费高带宽资源；
- 高速数据传输用 HP，匹配其高吞吐量特性；
- 需要缓存一致性时才用 ACP，避免不必要的复杂性。
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/c9f99c00e1f949b0942366f185d4db11.png)
# axi_full_master.v
在INIT_AXI_TXN的上升沿
把 i_key_pulse_cnt
i_key_pulse_cnt+1,
i_key_pulse_cnt+2,
...
i_key_pulse_cnt+1023
写入地址DDR中0x10000000 开始的 1024个32位寄存器中，
并读取校验后产生一个中断TXN_DONE

## 状态机流程
1. 系统复位后，状态机处于IDLE 初始状态，等待外部输入的启动传输脉冲 init_txn_pulse。
2. IDLE 状态下检测到 init_txn_pulse 为高电平，状态机跳转到 INIT_WRITE 状态。
3. INIT_WRITE 状态下，状态机拉高 start_single_burst_write 信号，来不断地启动 AXI4 Master 接口对 Slave 端大小为 4KB 的存储空间进行突发写操作。写操作完成后，write_done 信号会拉高，状态机进入 INIT_READ 状态。
4. INIT_READ 状态下，状态机拉高 start_single_burst_read 信号，不断地启动 AXI4 Master 接口对 Slave 端同一存储空间进行突发读操作，同时将读出的数据与写入的数据进行对比。读操作完成后，read_done 信号拉高，状态机进入 INIT_COMPARE 状态。
5. INIT_COMPARE 状态下，判断 AXI4 接口在读写过程中的是否发生错误，并将错误状态赋值给 ERROR 信号，然后将 compare_done 信号拉高，表示一次读写测试完成。最后跳转到 IDLE 状态，等待下一次读写操作的启动信号。
```verilog
`timescale 1 ns / 1 ps
module axi_full_master #
(
    // 用户自定义参数在此添加

    // 用户参数结束
    // 请勿修改此行以下的参数

    // 目标从设备的基地址
    parameter  C_M_TARGET_SLAVE_BASE_ADDR	= 32'h40000000,
    // 突发长度。支持 1, 2, 4, 8, 16, 32, 64, 128, 256
    parameter integer C_M_AXI_BURST_LEN	= 16,
    // 线程 ID 宽度
    parameter integer C_M_AXI_ID_WIDTH	= 1,
    // 地址总线宽度
    parameter integer C_M_AXI_ADDR_WIDTH	= 32,
    // 数据总线宽度
    parameter integer C_M_AXI_DATA_WIDTH	= 32,
    // 写地址通道的用户位宽
    parameter integer C_M_AXI_AWUSER_WIDTH	= 0,
    // 读地址通道的用户位宽
    parameter integer C_M_AXI_ARUSER_WIDTH	= 0,
    // 写数据通道的用户位宽
    parameter integer C_M_AXI_WUSER_WIDTH	= 0,
    // 读数据通道的用户位宽
    parameter integer C_M_AXI_RUSER_WIDTH	= 0,
    // 写响应通道的用户位宽
    parameter integer C_M_AXI_BUSER_WIDTH	= 0
)
(
    // 用户自定义端口在此添加
    //按键按下次数
    input[31:0] i_key_pulse_cnt,
    // 用户端口结束
    // 请勿修改此行以下的端口

    // 触发 AXI 事务
    input wire  INIT_AXI_TXN,
    // 事务完成指示
    output wire  TXN_DONE,
    // 检测到错误时拉高
    output reg[2:0]  ERROR,
    // 全局时钟
    input wire  M_AXI_ACLK,
    // 全局复位，低有效
    input wire  M_AXI_ARESETN,
    // 写地址通道：ID
    output wire [C_M_AXI_ID_WIDTH-1 : 0] M_AXI_AWID,
    // 写地址通道：地址
    output wire [C_M_AXI_ADDR_WIDTH-1 : 0] M_AXI_AWADDR,
    // 写地址通道：突发长度（实际拍数 = LEN+1）
    output wire [7 : 0] M_AXI_AWLEN,
    // 写地址通道：每拍传输字节大小（以 2^SIZE 表示）
    output wire [2 : 0] M_AXI_AWSIZE,
    // 写地址通道：突发类型
    // 决定突发内部每拍地址的计算方式
    output wire [1 : 0] M_AXI_AWBURST,
    // 写地址通道：锁类型
    // 提供传输的原子性信息
    output wire  M_AXI_AWLOCK,
    // 写地址通道：缓存属性
    // 指示事务在系统中的缓存/缓冲语义
    output wire [3 : 0] M_AXI_AWCACHE,
    // 写地址通道：保护属性
    // 指示权限、安全等级、指令/数据访问
    output wire [2 : 0] M_AXI_AWPROT,
    // 写地址通道：服务质量 QoS
    output wire [3 : 0] M_AXI_AWQOS,
    // 写地址通道：可选用户自定义信号
    output wire [C_M_AXI_AWUSER_WIDTH-1 : 0] M_AXI_AWUSER,
    // 写地址通道：地址有效
    // 表示通道上提供了有效的写地址和控制信息
    output wire  M_AXI_AWVALID,
    // 写地址通道：从设备准备好
    // 表示从设备准备好接收地址与控制
    input wire  M_AXI_AWREADY,
    // 写数据通道：数据
    output wire [C_M_AXI_DATA_WIDTH-1 : 0] M_AXI_WDATA,
    // 写数据通道：字节选通
    // 指明哪些字节有效，每 8bit 一位
    output wire [C_M_AXI_DATA_WIDTH/8-1 : 0] M_AXI_WSTRB,
    // 写数据通道：突发最后一拍指示
    output wire  M_AXI_WLAST,
    // 写数据通道：可选用户自定义信号
    output wire [C_M_AXI_WUSER_WIDTH-1 : 0] M_AXI_WUSER,
    // 写数据通道：数据有效
    // 表示有有效写数据与字节选通
    output wire  M_AXI_WVALID,
    // 写数据通道：从设备可接收
    input wire  M_AXI_WREADY,
    // 写响应通道：ID
    input wire [C_M_AXI_ID_WIDTH-1 : 0] M_AXI_BID,
    // 写响应通道：响应码
    input wire [1 : 0] M_AXI_BRESP,
    // 写响应通道：可选用户自定义信号
    input wire [C_M_AXI_BUSER_WIDTH-1 : 0] M_AXI_BUSER,
    // 写响应通道：响应有效
    // 表示通道上有有效的写响应
    input wire  M_AXI_BVALID,
    // 写响应通道：主设备准备好接收响应
    output wire  M_AXI_BREADY,
    // 读地址通道：ID
    output wire [C_M_AXI_ID_WIDTH-1 : 0] M_AXI_ARID,
    // 读地址通道：起始地址
    output wire [C_M_AXI_ADDR_WIDTH-1 : 0] M_AXI_ARADDR,
    // 读地址通道：突发长度
    output wire [7 : 0] M_AXI_ARLEN,
    // 读地址通道：每拍传输大小（以 2^SIZE 表示）
    output wire [2 : 0] M_AXI_ARSIZE,
    // 读地址通道：突发类型
    // 决定突发内部每拍地址的计算方式
    output wire [1 : 0] M_AXI_ARBURST,
    // 读地址通道：锁类型
    // 提供传输的原子性信息
    output wire  M_AXI_ARLOCK,
    // 读地址通道：缓存属性
    // 指示事务在系统中的缓存/缓冲语义
    output wire [3 : 0] M_AXI_ARCACHE,
    // 读地址通道：保护属性
    // 指示权限、安全等级、指令/数据访问
    output wire [2 : 0] M_AXI_ARPROT,
    // 读地址通道：服务质量 QoS
    output wire [3 : 0] M_AXI_ARQOS,
    // 读地址通道：可选用户自定义信号
    output wire [C_M_AXI_ARUSER_WIDTH-1 : 0] M_AXI_ARUSER,
    // 读地址通道：地址有效
    // 表示通道上提供了有效的读地址和控制信息
    output wire  M_AXI_ARVALID,
    // 读地址通道：从设备准备好接收地址与控制
    input wire  M_AXI_ARREADY,
    // 读数据通道：ID 标签
    // 由从设备返回，用于标识该组读数据
    input wire [C_M_AXI_ID_WIDTH-1 : 0] M_AXI_RID,
    // 读数据通道：数据
    input wire [C_M_AXI_DATA_WIDTH-1 : 0] M_AXI_RDATA,
    // 读数据通道：读响应码
    input wire [1 : 0] M_AXI_RRESP,
    // 读数据通道：突发最后一拍
    input wire  M_AXI_RLAST,
    // 读数据通道：可选用户信号
    input wire [C_M_AXI_RUSER_WIDTH-1 : 0] M_AXI_RUSER,
    // 读数据通道：数据有效
    // 表示通道上有有效的读数据
    input wire  M_AXI_RVALID,
    // 读数据通道：主设备准备好接收数据与响应
    output wire  M_AXI_RREADY
);


// 名为 clogb2 的函数，返回不小于 log2(bit_depth) 的整数
//（向上取整）

  // 名为 clogb2 的函数，返回不小于 log2(bit_depth) 的整数（向上取整）
  function integer clogb2 (input integer bit_depth);
  begin
    for(clogb2=0; bit_depth>0; clogb2=clogb2+1)
      bit_depth = bit_depth >> 1;
    end
  endfunction

// C_TRANSACTIONS_NUM 是写/读事务拍计数器的位宽
 localparam integer C_TRANSACTIONS_NUM = clogb2(C_M_AXI_BURST_LEN-1);

// 以 C_M_AXI_DATA_WIDTH 为单位的突发长度。
// 非 2^n 的长度最终可能跨越 4K 地址边界。
 localparam integer C_MASTER_LENGTH	= 12;
// 总的突发次数 = 2^C_MASTER_LENGTH 字节 / (每突发长度 * 每拍字节数) 的对数换算
 localparam integer C_NO_BURSTS_REQ = C_MASTER_LENGTH-clogb2((C_M_AXI_BURST_LEN*C_M_AXI_DATA_WIDTH/8)-1);
// 示例状态机：初始化计数器、写事务、读事务以及
// 用读回数据与写入数据进行比较。
parameter [1:0] IDLE = 2'b00, // 空闲状态，等待 INIT_AXI_TXN 由 0->1 触发
    INIT_WRITE   = 2'b01, // 初始化写事务，完成后进入 INIT_READ
    INIT_READ = 2'b10, // 初始化读事务，完成后进入 INIT_COMPARE
    INIT_COMPARE = 2'b11; // 比较已写与读回数据，并给出结果

 reg [1:0] mst_exec_state;

// AXI4-Lite 信号（注：本例为 AXI4，以下为内部临时信号）
reg [C_M_AXI_ADDR_WIDTH-1 : 0] 	axi_awaddr;
reg  	axi_awvalid;
reg [C_M_AXI_DATA_WIDTH-1 : 0] 	axi_wdata;
reg  	axi_wlast;
reg  	axi_wvalid;
reg  	axi_bready;
reg [C_M_AXI_ADDR_WIDTH-1 : 0] 	axi_araddr;
reg  	axi_arvalid;
reg  	axi_rready;
// 写突发中的拍计数
reg [C_TRANSACTIONS_NUM : 0] 	write_index;
// 读突发中的拍计数
reg [C_TRANSACTIONS_NUM : 0] 	read_index;
// C_M_AXI_BURST_LEN 突发的一次传输对应的字节数
wire [C_TRANSACTIONS_NUM+2 : 0] 	burst_size_bytes;
// 突发计数器：记录完成 2^C_MASTER_LENGTH 字节传输所需的 C_M_AXI_BURST_LEN 次突发数量
reg [C_NO_BURSTS_REQ : 0] 	write_burst_counter;
reg [C_NO_BURSTS_REQ : 0] 	read_burst_counter;
reg  	start_single_burst_write;
reg  	start_single_burst_read;
reg  	writes_done;
reg  	reads_done;
reg  	error_reg;
reg  	compare_done;
reg  	read_mismatch;
reg  	burst_write_active;
reg  	burst_read_active;
reg [C_M_AXI_DATA_WIDTH-1 : 0] 	expected_rdata;
// 接口响应错误标志
wire  	write_resp_error;
wire  	read_resp_error;
wire  	wnext;
wire  	rnext;
reg  	init_txn_ff;
reg  	init_txn_ff2;
reg  	init_txn_edge;
wire  	init_txn_pulse;


// I/O 连接赋值

// 写地址（AW）通道
assign M_AXI_AWID	= 'b0;
// AXI 地址 = 目标基地址 + 活动偏移地址
assign M_AXI_AWADDR	= C_M_TARGET_SLAVE_BASE_ADDR + axi_awaddr;
// 突发长度（拍数-1）
assign M_AXI_AWLEN	= C_M_AXI_BURST_LEN - 1;
// 传输大小应与数据宽匹配（否则会出现窄突发）
assign M_AXI_AWSIZE	= clogb2((C_M_AXI_DATA_WIDTH/8)-1);
// 一般使用 INCR 类型突发（除非使用 keyhole）
assign M_AXI_AWBURST	= 2'b01;
assign M_AXI_AWLOCK	= 1'b0;
// 若经 Zynq ACP 进行一致性访问可设为 4'b0011。
// 此处设置为 4'b0010：不分配、可修改、不可缓冲（用于内存测试而非缓存）
assign M_AXI_AWCACHE	= 4'b0010;
assign M_AXI_AWPROT	= 3'h0;
assign M_AXI_AWQOS	= 4'h0;
assign M_AXI_AWUSER	= 'b1;
assign M_AXI_AWVALID	= axi_awvalid;
// 写数据（W）通道
assign M_AXI_WDATA	= axi_wdata;
// 本例所有突发按对齐、全字节写
assign M_AXI_WSTRB	= {(C_M_AXI_DATA_WIDTH/8){1'b1}};
assign M_AXI_WLAST	= axi_wlast;
assign M_AXI_WUSER	= 'b0;
assign M_AXI_WVALID	= axi_wvalid;
// 写响应（B）通道
assign M_AXI_BREADY	= axi_bready;
// 读地址（AR）通道
assign M_AXI_ARID	= 'b0;
assign M_AXI_ARADDR	= C_M_TARGET_SLAVE_BASE_ADDR + axi_araddr;
// 读突发长度（拍数-1）
assign M_AXI_ARLEN	= C_M_AXI_BURST_LEN - 1;
// 传输大小应与数据宽匹配（否则会出现窄突发）
assign M_AXI_ARSIZE	= clogb2((C_M_AXI_DATA_WIDTH/8)-1);
// 一般使用 INCR 类型突发
assign M_AXI_ARBURST	= 2'b01;
assign M_AXI_ARLOCK	= 1'b0;
// 同 AW 通道的缓存语义设置
assign M_AXI_ARCACHE	= 4'b0010;
assign M_AXI_ARPROT	= 3'h0;
assign M_AXI_ARQOS	= 4'h0;
assign M_AXI_ARUSER	= 'b1;
assign M_AXI_ARVALID	= axi_arvalid;
// 读数据（R）通道
assign M_AXI_RREADY	= axi_rready;
// 示例设计的 I/O
assign TXN_DONE	= compare_done;
// 突发字节数
assign burst_size_bytes	= C_M_AXI_BURST_LEN * C_M_AXI_DATA_WIDTH/8;
assign init_txn_pulse	= (!init_txn_ff2) && init_txn_ff;


// 产生一个脉冲以启动 AXI 事务
always @(posedge M_AXI_ACLK)
  begin
    // 复位时清零
    if (M_AXI_ARESETN == 0 )
      begin
        init_txn_ff <= 1'b0;
        init_txn_ff2 <= 1'b0;
      end
    else
      begin
        init_txn_ff <= INIT_AXI_TXN;
        init_txn_ff2 <= init_txn_ff;
      end
  end


//--------------------
// 写地址通道
//--------------------

// 写地址通道用于为整个事务提供地址和命令信息，仅 1 拍信息。

// 本例会在从设备/互连允许的情况下尽可能快地发起写地址。
// 每次地址被接受后，地址按 burst_size_bytes 递增。

  always @(posedge M_AXI_ACLK)
  begin

    if (M_AXI_ARESETN == 0 || init_txn_pulse == 1'b1 )
      begin
        axi_awvalid <= 1'b0;
      end
    // 若之前未拉高，则在需要时启动下一次事务
    else if (~axi_awvalid && start_single_burst_write)
      begin
        axi_awvalid <= 1'b1;
      end
    /* 一旦拉高 VALID，不可提前拉低，因此需等待从端接受 */
    else if (M_AXI_AWREADY && axi_awvalid)
      begin
        axi_awvalid <= 1'b0;
      end
    else
      axi_awvalid <= axi_awvalid;
    end


// 在 AWREADY 接受后更新下一个地址
  always @(posedge M_AXI_ACLK)
  begin
    if (M_AXI_ARESETN == 0 || init_txn_pulse == 1'b1)
      begin
        axi_awaddr <= 'b0;
      end
    else if (M_AXI_AWREADY && axi_awvalid)
      begin
        axi_awaddr <= axi_awaddr + burst_size_bytes;
      end
    else
      axi_awaddr <= axi_awaddr;
    end


//--------------------
// 写数据通道
//--------------------

// 写数据通道会持续尝试推送写数据。

// 可被接收的数据量取决于从设备和互连（例如互连中是否启用 FIFO）。

// 写数据通道与写地址通道时序无显式关系，
// 它有自身的节流标志，与 AW 通道独立。

// 通道间的同步需由用户逻辑保证。

// 最简单但最低性能的方式是一次只发一个 AW 和一个 W 突发。

// 在本例中，通过相同的地址增量与突发大小保持同步；
// 同时在用户逻辑中用计数阈值防止某一通道跑得过快。

// 当前进在 WVALID 且 WREADY 同时为 1 时发生
  assign wnext = M_AXI_WREADY & axi_wvalid;

// WVALID 逻辑，类似于上面的 axi_awvalid
  always @(posedge M_AXI_ACLK)
  begin
    if (M_AXI_ARESETN == 0 || init_txn_pulse == 1'b1 )
      begin
        axi_wvalid <= 1'b0;
      end
    // 若之前未有效，在需要时启动
    else if (~axi_wvalid && start_single_burst_write)
      begin
        axi_wvalid <= 1'b1;
      end
    /* 若 WREADY 且达到最后一拍，则拉低 WVALID。
       一旦拉高，必须等到突发完成（WLAST）才能拉低。 */
    else if (wnext && axi_wlast)
      axi_wvalid <= 1'b0;
    else
      axi_wvalid <= axi_wvalid;
  end


// WLAST 生成：基于计数器在倒数第二拍置位
// 逻辑类似于上面的 axi_awvalid
  always @(posedge M_AXI_ACLK)
  begin
    if (M_AXI_ARESETN == 0 || init_txn_pulse == 1'b1 )
      begin
        axi_wlast <= 1'b0;
      end
    // 当写拍计数到倒数第二拍时置位 WLAST，以与最后一拍数据对齐
    // else if (&(write_index[C_TRANSACTIONS_NUM-1:1])&& ~write_index[0] && wnext)
    else if (((write_index == C_M_AXI_BURST_LEN-2 && C_M_AXI_BURST_LEN >= 2) && wnext) || (C_M_AXI_BURST_LEN == 1 ))
      begin
        axi_wlast <= 1'b1;
      end
    // 在最后一拍被从设备接受后，拉低 WLAST
    else if (wnext)
      axi_wlast <= 1'b0;
    else if (axi_wlast && C_M_AXI_BURST_LEN == 1)
      axi_wlast <= 1'b0;
    else
      axi_wlast <= axi_wlast;
  end


/* 突发拍计数器。使用额外最高位指示终止态以简化译码逻辑 */
  always @(posedge M_AXI_ACLK)
  begin
    if (M_AXI_ARESETN == 0 || init_txn_pulse == 1'b1 || start_single_burst_write == 1'b1)
      begin
        write_index <= 0;
      end
    else if (wnext && (write_index != C_M_AXI_BURST_LEN-1))
      begin
        write_index <= write_index + 1;
      end
    else
      write_index <= write_index;
  end


/* 写数据生成器
   数据模式：每个突发从 1 开始自增（示例模式） */
  always @(posedge M_AXI_ACLK)
  begin
    if (M_AXI_ARESETN == 0 || init_txn_pulse == 1'b1)
      axi_wdata <= i_key_pulse_cnt;
    //else if (wnext && axi_wlast)
    //  axi_wdata <= 'b0;
    else if (wnext)
      axi_wdata <= axi_wdata + 1;
    else
      axi_wdata <= axi_wdata;
    end


//----------------------------
// 写响应（B）通道
//----------------------------

// 写响应通道用于反馈写入已提交到存储。
// 当所有写数据与写地址到达并被接受后，会出现 BREADY/BVALID 握手。

// 写事务的“签发”（未完成的写地址数）由 AW 触发，
// 以 BREADY/BRESP 完成闭环。

// 虽然拉低 BREADY 最终会反压 AWREADY，
// 但不建议用这种方式去节流整个写通道。

// BRESP[1] 用于指示互连或从设备对整个写突发的错误。
// 本例将把该错误记录到 ERROR 输出。

  always @(posedge M_AXI_ACLK)
  begin
    if (M_AXI_ARESETN == 0 || init_txn_pulse == 1'b1 )
      begin
        axi_bready <= 1'b0;
      end
    // 当从端拉高 BVALID 且主端尚未拉高 BREADY 时，接受该响应
    else if (M_AXI_BVALID && ~axi_bready)
      begin
        axi_bready <= 1'b1;
      end
    // 一个时钟后拉低
    else if (axi_bready)
      begin
        axi_bready <= 1'b0;
      end
    // 保持
    else
      axi_bready <= axi_bready;
  end


// 标记写响应错误
  assign write_resp_error = axi_bready & M_AXI_BVALID & M_AXI_BRESP[1];


//----------------------------
// 读地址通道
//----------------------------

// 读地址通道与写地址通道功能类似：提供突发的限定信息。

// 本例读地址按与写地址相同的方式递增。

  always @(posedge M_AXI_ACLK)
  begin

    if (M_AXI_ARESETN == 0 || init_txn_pulse == 1'b1 )
      begin
        axi_arvalid <= 1'b0;
      end
    // 若之前未拉高，则在需要时启动下一次事务
    else if (~axi_arvalid && start_single_burst_read)
      begin
        axi_arvalid <= 1'b1;
      end
    else if (M_AXI_ARREADY && axi_arvalid)
      begin
        axi_arvalid <= 1'b0;
      end
    else
      axi_arvalid <= axi_arvalid;
  end


// 在 ARREADY 接受后更新下一个读地址
  always @(posedge M_AXI_ACLK)
  begin
    if (M_AXI_ARESETN == 0 || init_txn_pulse == 1'b1)
      begin
        axi_araddr <= 'b0;
      end
    else if (M_AXI_ARREADY && axi_arvalid)
      begin
        axi_araddr <= axi_araddr + burst_size_bytes;
      end
    else
      axi_araddr <= axi_araddr;
  end


//--------------------------------
// 读数据（及响应）通道
//--------------------------------

 // 通道前进在 RVALID 与 RREADY 同时为 1 时发生
  assign rnext = M_AXI_RVALID && axi_rready;


// 读突发拍计数器。使用额外最高位指示终止态以简化译码
  always @(posedge M_AXI_ACLK)
  begin
    if (M_AXI_ARESETN == 0 || init_txn_pulse == 1'b1 || start_single_burst_read)
      begin
        read_index <= 0;
      end
    else if (rnext && (read_index != C_M_AXI_BURST_LEN-1))
      begin
        read_index <= read_index + 1;
      end
    else
      read_index <= read_index;
  end


/*
 读数据通道返回读请求的结果。

 在本例中，数据校验器始终可以接收更多数据，
 因此无需节流 RREADY。
 */
  always @(posedge M_AXI_ACLK)
  begin
    if (M_AXI_ARESETN == 0 || init_txn_pulse == 1'b1 )
      begin
        axi_rready <= 1'b0;
      end
    // 当从端拉高 RVALID 时，用 axi_rready 接受 rdata/rresp
    else if (M_AXI_RVALID)
      begin
         if (M_AXI_RLAST && axi_rready)
          begin
            axi_rready <= 1'b0;
          end
         else
           begin
             axi_rready <= 1'b1;
           end
      end
    // 保持上一值
  end

// 对读回数据进行校验
  always @(posedge M_AXI_ACLK)
  begin
    if (M_AXI_ARESETN == 0 || init_txn_pulse == 1'b1)
      begin
        read_mismatch <= 1'b0;
      end
    // 仅在 RVALID 有效时进行比较
    else if (rnext && (M_AXI_RDATA != expected_rdata))
      begin
        read_mismatch <= 1'b1;
      end
    else
      read_mismatch <= 1'b0;
  end

// 标记读响应错误
  assign read_resp_error = axi_rready & M_AXI_RVALID & M_AXI_RRESP[1];


//----------------------------------------
// 示例设计：读校验数据生成器
//-----------------------------------------

// 生成期望的读数据，用于与实际读回数据比较
  always @(posedge M_AXI_ACLK)
  begin
    if (M_AXI_ARESETN == 0 || init_txn_pulse == 1'b1)// || M_AXI_RLAST)
        expected_rdata <= i_key_pulse_cnt;
    else if (M_AXI_RVALID && axi_rready)
        expected_rdata <= expected_rdata + 1;
    else
        expected_rdata <= expected_rdata;
  end


//----------------------------------
// 示例设计：错误寄存器
//----------------------------------

// 记录并保持任意数据不匹配或读/写接口错误
  always @(posedge M_AXI_ACLK)
  begin
    if (M_AXI_ARESETN == 0 || init_txn_pulse == 1'b1)
      begin
        error_reg <= 3'b0;
      end
    else if (read_mismatch || write_resp_error || read_resp_error)
      begin
        error_reg <= {read_mismatch,write_resp_error,read_resp_error};
      end
    else
      error_reg <= error_reg;
  end


//--------------------------------
// 示例设计：通道节流
//--------------------------------

// 为了最大吞吐量，本示例尽量让各通道独立且尽快地运行。

// 但在某些情况下，用户需要对数据流进行节流：
// - 要求先写后读（读在写完全完成后再开始）
// - 当未读完 + 已签发事务数超过阈值时，暂停地址写
// - 当未读完 + 正在进行的数据突发超过阈值时，暂停写

// AXI4 规范 13.13.1：若主设备需要读写顺序性，
// 必须在发起下一事务前，确保已收到上一个事务的响应。

 // write_burst_counter 记录已发起写突发的个数，
 // 与需要发起的总突发数进行对比
  always @(posedge M_AXI_ACLK)
  begin
    if (M_AXI_ARESETN == 0 || init_txn_pulse == 1'b1 )
      begin
        write_burst_counter <= 'b0;
      end
    else if (M_AXI_AWREADY && axi_awvalid)
      begin
        if (write_burst_counter[C_NO_BURSTS_REQ] == 1'b0)
          begin
            write_burst_counter <= write_burst_counter + 1'b1;
            //write_burst_counter[C_NO_BURSTS_REQ] <= 1'b1;
          end
      end
    else
      write_burst_counter <= write_burst_counter;
  end

 // read_burst_counter 记录已发起读突发的个数，
 // 与需要发起的总突发数进行对比
  always @(posedge M_AXI_ACLK)
  begin
    if (M_AXI_ARESETN == 0 || init_txn_pulse == 1'b1)
      begin
        read_burst_counter <= 'b0;
      end
    else if (M_AXI_ARREADY && axi_arvalid)
      begin
        if (read_burst_counter[C_NO_BURSTS_REQ] == 1'b0)
          begin
            read_burst_counter <= read_burst_counter + 1'b1;
            //read_burst_counter[C_NO_BURSTS_REQ] <= 1'b1;
          end
      end
    else
      read_burst_counter <= read_burst_counter;
  end


  // 主控制状态机
  always @ ( posedge M_AXI_ACLK)
  begin
    if (M_AXI_ARESETN == 1'b0 )
      begin
        // 复位条件下的默认值
        mst_exec_state      <= IDLE;
        start_single_burst_write <= 1'b0;
        start_single_burst_read  <= 1'b0;
        compare_done      <= 1'b0;
        ERROR <= 1'b0;
      end
    else
      begin

        // 状态转换
        case (mst_exec_state)

          IDLE:
            // 等待 INIT_AXI_TXN 的上升沿触发
            if ( init_txn_pulse == 1'b1)
              begin
                mst_exec_state  <= INIT_WRITE;
                ERROR <= 1'b0;
                compare_done <= 1'b0;
              end
            else
              begin
                mst_exec_state  <= IDLE;
              end

          INIT_WRITE:
            // 发出 start_single_burst_write 脉冲以启动写事务。
            // 当 writes_done 拉高后，转入 INIT_READ。
            if (writes_done)
              begin
                mst_exec_state <= INIT_READ;
              end
            else
              begin
                mst_exec_state  <= INIT_WRITE;

                if (~axi_awvalid && ~start_single_burst_write && ~burst_write_active)
                  begin
                    start_single_burst_write <= 1'b1;
                  end
                else
                  begin
                    start_single_burst_write <= 1'b0; // 脉冲信号
                  end
              end

          INIT_READ:
            // 发出 start_single_burst_read 脉冲以启动读事务。
            // 当 reads_done 拉高后，转入 INIT_COMPARE。
            if (reads_done)
              begin
                mst_exec_state <= INIT_COMPARE;
              end
            else
              begin
                mst_exec_state  <= INIT_READ;

                if (~axi_arvalid && ~burst_read_active && ~start_single_burst_read)
                  begin
                    start_single_burst_read <= 1'b1;
                  end
               else
                 begin
                   start_single_burst_read <= 1'b0; // 脉冲信号
                 end
              end

          INIT_COMPARE:
            // 比较已写数据与读回数据。
            // 若没有错误标志，则 compare_done 拉高表示成功。
            //if (~error_reg)
            begin
              ERROR <= error_reg;
              mst_exec_state <= IDLE;
              compare_done <= 1'b1;
            end
          default :
            begin
              mst_exec_state  <= IDLE;
            end
        endcase
      end
  end // MASTER_EXECUTION_PROC


  // burst_write_active 在启动一次写突发后拉高，
  // 直到该突发被从端接受（收到 BVALID 且主端 BREADY）
  always @(posedge M_AXI_ACLK)
  begin
    if (M_AXI_ARESETN == 0 || init_txn_pulse == 1'b1)
      burst_write_active <= 1'b0;

    // 启动写突发时置位
    else if (start_single_burst_write)
      burst_write_active <= 1'b1;
    else if (M_AXI_BVALID && axi_bready)
      burst_write_active <= 0;
  end

 // 检测最后一次写完成
 // 用最终的写响应与计数配合，确认写已提交
  always @(posedge M_AXI_ACLK)
  begin
    if (M_AXI_ARESETN == 0 || init_txn_pulse == 1'b1)
      writes_done <= 1'b0;

    // writes_done 应与一次有效的 bready 响应关联
    //else if (M_AXI_BVALID && axi_bready && (write_burst_counter == {(C_NO_BURSTS_REQ-1){1}}) && axi_wlast)
    else if (M_AXI_BVALID && (write_burst_counter[C_NO_BURSTS_REQ]) && axi_bready)
      writes_done <= 1'b1;
    else
      writes_done <= writes_done;
    end

  // burst_read_active 在启动一次读突发后拉高，
  // 直到该突发被主端接受（收到 RLAST 且主端 RREADY）
  always @(posedge M_AXI_ACLK)
  begin
    if (M_AXI_ARESETN == 0 || init_txn_pulse == 1'b1)
      burst_read_active <= 1'b0;

    // 启动读突发时置位
    else if (start_single_burst_read)
      burst_read_active <= 1'b1;
    else if (M_AXI_RVALID && axi_rready && M_AXI_RLAST)
      burst_read_active <= 0;
    end


 // 检测最后一次读完成
 // 用最终的读响应与计数配合，确认读已提交
  always @(posedge M_AXI_ACLK)
  begin
    if (M_AXI_ARESETN == 0 || init_txn_pulse == 1'b1)
      reads_done <= 1'b0;

    // reads_done 应与一次有效的 rready 响应关联
    //else if (M_AXI_BVALID && axi_bready && (write_burst_counter == {(C_NO_BURSTS_REQ-1){1}}) && axi_wlast)
    else if (M_AXI_RVALID && axi_rready && (read_index == C_M_AXI_BURST_LEN-1) && (read_burst_counter[C_NO_BURSTS_REQ]))
      reads_done <= 1'b1;
    else
      reads_done <= reads_done;
    end

// 在此添加用户逻辑

// 用户逻辑结束

endmodule

```

# key_debounce.v
```verilog
// ============================================================================
// Module name : key_debounce
// Author      : ming
// Description : 按键消抖模块
//               - 按键持续按下超过设定时间后，输出一个时钟周期脉冲
//               - 累计按键按下次数
// Parameters  : P_CLK_FREQ_MHZ - 输入时钟频率 (MHz)
//               P_DEBOUNCE_MS  - 消抖时间 (ms)
//               L_CNT_WIDTH    - 计数器位宽
// ============================================================================

module key_debounce
#(
    parameter P_CLK_FREQ_MHZ = 50,  // 时钟频率 MHz
    parameter P_DEBOUNCE_MS  = 20,  // 消抖时间 ms
    parameter L_CNT_WIDTH    = 32   // 计数器位宽
)
(
    input   wire        i_clk,           // 系统时钟
    input   wire        i_rst_n,         // 全局复位，低有效
    input   wire        i_key,           // 按键输入（低有效）
    output  reg         o_key_pulse,     // 消抖脉冲
    output  reg [31:0]  o_key_pulse_cnt  // 按键次数
);

    // 根据时钟频率和消抖时间计算最大计数值
    localparam L_MAX_CNT = P_CLK_FREQ_MHZ * 1000 * P_DEBOUNCE_MS;
    reg [L_CNT_WIDTH-1:0] r_cnt;

    // 计数器：按键按下计时
    always@(posedge i_clk or negedge i_rst_n)
        if(!i_rst_n)
            r_cnt <= {(L_CNT_WIDTH+1){1'b0}};
        else if(i_key == 1)
            r_cnt <= {(L_CNT_WIDTH+1){1'b0}};
        else if(i_key == 0 && r_cnt < L_MAX_CNT-1)
            r_cnt <= r_cnt + 1'b1;
        else
            r_cnt <= r_cnt;

    // 输出脉冲：稳定按下超过设定时间，输出 1 个时钟周期脉冲
    always@(posedge i_clk or negedge i_rst_n)
        if(!i_rst_n) begin 
            o_key_pulse     <= 1'b0;
            o_key_pulse_cnt <= 32'd0;
        end else if(r_cnt == L_MAX_CNT-2) begin 
            o_key_pulse     <= 1'b1;
            o_key_pulse_cnt <= o_key_pulse_cnt + 1;
        end else
            o_key_pulse <= 1'b0;

endmodule

```

# system.xdc
```shell
#开发板约束文件

#时序约束
create_clock -period 20.000 -name PL_GCLK [get_ports PL_GCLK]

#IO引脚约束
#----------------------系统时钟---------------------------
set_property -dict {PACKAGE_PIN U18 IOSTANDARD LVCMOS33} [get_ports PL_GCLK]

#----------------------系统复位---------------------------
set_property -dict {PACKAGE_PIN N16 IOSTANDARD LVCMOS33} [get_ports PL_RESET]

#----------------------PL_KEY---------------------------
set_property -dict {PACKAGE_PIN L14 IOSTANDARD LVCMOS33} [get_ports KEY0]
set_property -dict {PACKAGE_PIN K16 IOSTANDARD LVCMOS33} [get_ports KEY1]

#----------------------PL_LED---------------------------
#底板
set_property -dict {PACKAGE_PIN H15 IOSTANDARD LVCMOS33} [get_ports LED0]
set_property -dict {PACKAGE_PIN L15 IOSTANDARD LVCMOS33} [get_ports LED1]

#----------------------PL_UART(RS232)/RS485---------------------------
set_property -dict {PACKAGE_PIN K14 IOSTANDARD LVCMOS33} [get_ports PL_UART_RXD]
set_property -dict {PACKAGE_PIN M15 IOSTANDARD LVCMOS33} [get_ports PL_UART_TXD]

```


# PS 裸机测试
```c
#include "xil_io.h"
#include "xil_mmu.h"
#include "xil_printf.h"


#include "xparameters.h"
#include "xscugic.h"
#include <stdio.h>
//共享内存基地址
#define SHARE_MEM_BASE  0x10000000U
//S_AXI_GP0 接口写入的集地址
#define BASE_ADDR       0x10000000U
#define MAX_INDEX       1023


// ======= PL中断号 =======
#define PL_IRQ_ID61       61
#define GIC_DEVICE_ID 				XPAR_PS7_SCUGIC_0_DEVICE_ID
// GIC 控制器实例
XScuGic intc;
// =============================
// PL 中断服务函数
// 对应 PL 触发的 IRQ 信号 (IRQ_F2P)
// =============================
static void PL_IRQHandler(void *ctx) {
	uintptr_t irq_src = (uintptr_t)ctx;
	static int  irq_cnt=0;
	irq_cnt++;
	xil_printf("PL%d triggered %d!\r\n",irq_src,irq_cnt);

	//起始地址
	int regInx_start=0;
	u32 read_val_start = Xil_In32(BASE_ADDR + 4 * regInx_start);
	xil_printf("[r %d] = 0x%08X / %u\r\n", regInx_start, read_val_start, read_val_start);
	//终止地址
	int regInx_end=1023;
	u32 read_val_end = Xil_In32(BASE_ADDR + 4 * regInx_end);
	xil_printf("dif [r %d] = 0x%08X / %u\r\n", regInx_end, read_val_end-read_val_start, read_val_end-read_val_start);

}

// =============================
// 中断控制器初始化函数
// 配置 GIC，用于使能 PL 触发的中断
// =============================
static int IRQ_Init(void)
{
    int status;
    XScuGic_Config *cfg = XScuGic_LookupConfig(GIC_DEVICE_ID);
    if (!cfg) return XST_FAILURE;
    // 1) 初始化 GIC（只此一次）
    status = XScuGic_CfgInitialize(&intc, cfg, cfg->CpuBaseAddress);
    if (status != XST_SUCCESS) return status;
    // 2) 顶层异常框架（只此一次）
    Xil_ExceptionInit();
    Xil_ExceptionRegisterHandler(XIL_EXCEPTION_ID_INT,
                                 (Xil_ExceptionHandler)XScuGic_InterruptHandler,
                                 &intc);
    // 3) 触发方式 & 优先级（可选但推荐；数值越小优先级越高）
    // PL 直连 IRQ_F2P 通常上升沿(0x3)，示例优先级 0x80（高于 UART）
    XScuGic_SetPriorityTriggerType(&intc, PL_IRQ_ID61,     0x80, 0x3);
    // 4) 连接中断源
    status = XScuGic_Connect(&intc, PL_IRQ_ID61,
                             (Xil_ExceptionHandler)PL_IRQHandler, (void*)0);
    if (status != XST_SUCCESS) return status;
    // 5) 使能
    XScuGic_Enable(&intc, PL_IRQ_ID61);
    // 6) 全局开中断（只此一次）
    Xil_ExceptionEnable();
    return XST_SUCCESS;
}




int main() {
    xil_printf("S_AXI_ACP  test.\n");
    //直接把 Cortex-A9 的数据缓存（D-Cache）全局关闭。
   // Xil_DCacheDisable();
   //把指定的地址段（通常 1MB 对齐）标记为 “非缓存、可共享” 内存
    //Xil_SetTlbAttributes(SHARE_MEM_BASE, NORM_NONCACHE | SHAREABLE);
    IRQ_Init();
    char cmd;
    int index;
    u32 value;
    while (1) {
        xil_printf("> ");
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
                    case 'l':{

                    	break;
                    }
                    default:
                        xil_printf("Unknown command '%c'. Use 'r' or 'w'.\r\n", cmd);
                        while (getchar() != '\n');
                        break;
                }
    }
    return 0;
}


```
## 测试结果
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/9d02cb5ac76244d9a149f1b86815e5df.png)
