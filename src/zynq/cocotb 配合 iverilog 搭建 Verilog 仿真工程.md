# 参考
[cocotb文档](https://docs.cocotb.org/en/stable/index.html)

[iverilog 配合 Makefile 仿真Verilog ](https://blog.csdn.net/qq_26074053/article/details/156454926)


[ModelSim 配合 Makefile 仿真Verilog](https://blog.csdn.net/qq_26074053/article/details/149445944)

[Zynq AXI-Lite 总线原理与实现](https://blog.csdn.net/qq_26074053/article/details/149357754)
# 加法器
## 目录结构
```bash
tree  /f
D:.
├─rtl
│      adder.v
│      
└─sim
    │  Makefile
    │  test_adder.py

```
## 文件
###  rtl/adder.v
```verilog
module adder (
    input  wire       clk,
    input  wire       rst,
    input  wire [7:0] a,
    input  wire [7:0] b,
    output reg  [8:0] sum
);

always @(posedge clk) begin
    if (rst)
        sum <= 9'd0;
    else
        sum <= a + b;
end

endmodule
```

###  sim/Makefile
```bash
TOPLEVEL_LANG = verilog
SIM           = icarus

TOPLEVEL      = adder
MODULE        = test_adder
WAVES = 1
VERILOG_SOURCES = ../rtl/adder.v


include $(shell cocotb-config --makefiles)/Makefile.sim


.PHONY: wave
wave:
	gtkwave sim_build/adder.fst
```

###  sim/test_adder.py
```python
import cocotb
from cocotb.clock import Clock
from cocotb.triggers import RisingEdge, Timer, ReadOnly, First
from cocotb.utils import get_sim_time


@cocotb.test()
async def test_adder(dut):
    # =========================================================
    # 时钟
    # =========================================================
    cocotb.start_soon(Clock(dut.clk, 10, unit="ns").start())

    # =========================================================
    # 信号监视器（输入/输出变化即打印）
    # =========================================================
    async def watch():
        last = None
        while True:
            # 等待任一信号变化
            await First(
                dut.rst.value_change,
                dut.a.value_change,
                dut.b.value_change,
                dut.sum.value_change,
            )
            # 等下个上升沿
            await RisingEdge(dut.clk)
            # 进入 ReadOnly，保证值稳定
            await ReadOnly()

            now = (
                int(dut.rst.value),
                int(dut.a.value),
                int(dut.b.value),
                int(dut.sum.value),
            )

            if now != last:
                t = int(get_sim_time("ns"))   # cocotb 2.x 是 float，必须转 int
                dut._log.info(
                    f"[{t:6d} ns] "
                    f"rst={now[0]} "
                    f"a={now[1]:3d} "
                    f"b={now[2]:3d} "
                    f"sum={now[3]:3d}"
                )
                last = now

    cocotb.start_soon(watch())

    # =========================================================
    # 复位
    # =========================================================
    dut.rst.value = 1
    dut.a.value = 0
    dut.b.value = 0
    # 等20ns
    await Timer(20, "ns")
    await RisingEdge(dut.clk)
    dut.rst.value = 0

    # =========================================================
    # 测试向量
    # =========================================================
    tests = [
        (1, 2),
        (10, 20),
        (100, 23),
        (255, 1),
    ]

    for a, b in tests:
        dut.a.value = a
        dut.b.value = b

        # a/b 在这一拍被采样
        await RisingEdge(dut.clk)
        # sum 在下一拍稳定
        await RisingEdge(dut.clk)

        assert int(dut.sum.value) == a + b, \
            f"{a} + {b} != {int(dut.sum.value)}"

    # 再跑一点时间，方便看波形
    await Timer(20, "ns")

```

## 命令


### 安装 Python 依赖
```bash
pip install cocotb
pip install cocotbext-axi
```
### 编译
>如果在windows里,下面的命令应在git bash
```bash
PC@ming MINGW64 /d/workspace/gitee/0/ming-verilog_prj/ming-verilog/test/proj/sim (master)
$ make
rm -f results.xml
"D:/Program Files (x86)/Dev-Cpp/mingw32/bin/make" -f Makefile results.xml
make[1]: Entering directory 'D:/workspace/gitee/0/ming-verilog_prj/ming-verilog/test/proj/sim'
/d/soft/iverilog/bin/iverilog -o sim_build/sim.vvp -s adder -g2012 -f sim_build/cmds.f -s cocotb_iverilog_dump  ../rtl/adder.v sim_build/cocotb_iverilog_dump.v
D:/soft/Anaconda3/envs/platformio/Lib/site-packages/cocotb_tools/makefiles/simulators/Makefile.icarus:66: Using MODULE is deprecated, please use COCOTB_TEST_MODULES instead.
rm -f results.xml
COCOTB_TEST_MODULES=test_adder COCOTB_TESTCASE= COCOTB_TEST_FILTER= COCOTB_TOPLEVEL=adder TOPLEVEL_LANG=verilog \
         /d/soft/iverilog/bin/vvp -M D:/soft/Anaconda3/envs/platformio/Lib/site-packages/cocotb/libs -m cocotbvpi_icarus   sim_build/sim.vvp -fst
     -.--ns INFO     gpi                                ..mbed\gpi_embed.cpp:94   in _embed_init_python              Using Python 3.11.9 interpreter at D:/soft/Anaconda3/envs/platformio/python.exe
Could not find platform dependent libraries <exec_prefix>
     -.--ns ERROR    gpi                                ..mbed\gpi_embed.cpp:155  in _embed_init_python              Unexpected sys.executable value (expected 'D:/soft/Anaconda3/envs/platformio/python.exe', got 'D:\soft\iverilog\bin\vvp.exe')
     -.--ns INFO     gpi                                ..\gpi\GpiCommon.cpp:79   in gpi_print_registered_impl       VPI registered
     0.00ns INFO     cocotb                             Running on Icarus Verilog version 10.1 (stable)
     0.00ns WARNING  gpi                                vpi_iterate returned NULL for type vpiInstance for object NULL
     0.00ns INFO     cocotb                             Seeding Python random module with 1767492113
     0.00ns INFO     cocotb                             Initialized cocotb v2.0.1 from D:\soft\Anaconda3\envs\platformio\Lib\site-packages\cocotb
     0.00ns INFO     cocotb.regression                  pytest not found, install it to enable better AssertionError messages
     0.00ns INFO     cocotb                             Running tests
     0.00ns INFO     cocotb.regression                  running test_adder.test_adder (1/1)
FST info: dumpfile sim_build/adder.fst opened for output.
     0.00ns INFO     cocotb.adder                       [     0 ns] rst=1 a=  0 b=  0 sum=  0
    30.00ns INFO     cocotb.adder                       [    30 ns] rst=0 a=  1 b=  2 sum=  3
    50.00ns INFO     cocotb.adder                       [    50 ns] rst=0 a= 10 b= 20 sum= 30
    70.00ns INFO     cocotb.adder                       [    70 ns] rst=0 a=100 b= 23 sum=123
    90.00ns INFO     cocotb.adder                       [    90 ns] rst=0 a=255 b=  1 sum=256
   120.00ns INFO     cocotb.regression                  test_adder.test_adder passed
   120.00ns INFO     cocotb.regression                  **************************************************************************************
                                                        ** TEST                          STATUS  SIM TIME (ns)  REAL TIME (s)  RATIO (ns/s) **
                                                        **************************************************************************************
                                                        ** test_adder.test_adder          PASS         120.00           0.00      40012.44  **
                                                        **************************************************************************************
                                                        ** TESTS=1 PASS=1 FAIL=0 SKIP=0                120.00           0.01      20002.24  **
                                                        **************************************************************************************

```
 ### 看波形
 ```bash
 $ make wave
gtkwave sim_build/adder.fst
GTKWave Analyzer v3.3.71 (w)1999-2016 BSI
FSTLOAD | Processing 5 facs.
FSTLOAD | Built 5 signals and 0 aliases.
FSTLOAD | Building facility hierarchy tree.
FSTLOAD | Sorting facility hierarchy tree.
```
 ### 清空编译
 ```bash
 $ make clean
```

## http访问adder.v 
###  sim/test_adder.py
```python
import cocotb
from cocotb.clock import Clock
from cocotb.triggers import RisingEdge, Timer, ReadOnly
from cocotb.utils import get_sim_time

import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import queue
import time

# =========================================================
# 全局请求队列
# =========================================================
request_queue = queue.Queue()   # 保存 (a, b, response_queue)
# 每个请求附带一个 response_queue 线程安全队列来返回结果

# =========================================================
# HTTP 服务线程
# =========================================================
class AdderHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        try:
            a = int(qs.get("a", [0])[0])
            b = int(qs.get("b", [0])[0])
        except ValueError:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"Invalid integers")
            return

        # 为当前请求创建返回队列
        resp_q = queue.Queue()
        # 把请求加入全局队列
        request_queue.put((a, b, resp_q))

        # 等待 DUT 计算完成
        result = resp_q.get()  # 阻塞，等待 cocotb 主循环处理

        # 返回 HTTP 响应
        self.send_response(200)
        self.end_headers()
        self.wfile.write(str(result).encode())

def start_http_server():
    server = HTTPServer(("127.0.0.1", 8080), AdderHandler)
    print("HTTP server listening on http://127.0.0.1:8080")
    server.serve_forever()

# =========================================================
# cocotb 测试
# =========================================================
@cocotb.test()
async def test_adder(dut):
    # 启动时钟
    cocotb.start_soon(Clock(dut.clk, 10, unit="ns").start())

    # 启动 HTTP 服务线程（守护线程）
    threading.Thread(target=start_http_server, daemon=True).start()

    # 复位
    dut.rst.value = 1
    dut.a.value = 0
    dut.b.value = 0
    await Timer(20, "ns")
    await RisingEdge(dut.clk)
    dut.rst.value = 0

    # 信号监视器
    async def watch():
        last = None
        while True:
            await ReadOnly()
            now = (
                int(dut.rst.value),
                int(dut.a.value),
                int(dut.b.value),
                int(dut.sum.value),
            )
            if now != last:
                t = int(get_sim_time("ns"))
                dut._log.info(f"[{t:6d} ns] rst={now[0]} a={now[1]} b={now[2]} sum={now[3]}")
                last = now
            await RisingEdge(dut.clk)
    cocotb.start_soon(watch())

    # =========================================================
    # 主循环，处理 HTTP 请求
    # =========================================================
    while True:
        try:
            # 非阻塞获取请求
            a_val, b_val, resp_q = request_queue.get_nowait()
        except queue.Empty:
            await RisingEdge(dut.clk)
            continue

        # 给 DUT 赋值
        dut.a.value = a_val
        dut.b.value = b_val

        # a/b 在这一拍被采样
        await RisingEdge(dut.clk)
        # sum 在下一拍稳定
        await RisingEdge(dut.clk)

        result = int(dut.sum.value)
        resp_q.put(result)  # 返回结果给 HTTP 线程

```
### 浏览器访问
```bash
GET  http://127.0.0.1:8080/?a=11&b=2
13
```

# axi-lite读写测试
## 目录结构
```bash
PS tree /f
D:.
│  axi_lite_slave.v
│  test_axi_lite.py
│  Makefile  
```

## 文件
### axi_lite_slave.v
```verilog
module axi_lite_slave (
    input  wire        aclk,
    input  wire        aresetn,
    // 写地址通道
    input  wire [31:0] s_axi_awaddr,
    input  wire        s_axi_awvalid,
    output reg         s_axi_awready,
    // 写数据通道
    input  wire [31:0] s_axi_wdata,
    input  wire [3:0]  s_axi_wstrb,
    input  wire        s_axi_wvalid,
    output reg         s_axi_wready,
    // 写响应通道
    output reg  [1:0]  s_axi_bresp,
    output reg         s_axi_bvalid,
    input  wire        s_axi_bready,
    // 读地址通道
    input  wire [31:0] s_axi_araddr,
    input  wire        s_axi_arvalid,
    output reg         s_axi_arready,
    // 读数据通道
    output reg  [31:0] s_axi_rdata,
    output reg  [1:0]  s_axi_rresp,
    output reg         s_axi_rvalid,
    input  wire        s_axi_rready
);

    // 4个寄存器
    reg [31:0] regfile [0:3];
    integer i;

    // 初始化寄存器
    always @(negedge aresetn) begin
        for(i=0;i<4;i=i+1) regfile[i] <= 32'd0;
    end

    // 写通道
    always @(posedge aclk) begin
        if(!aresetn) begin
            s_axi_awready <= 0;
            s_axi_wready  <= 0;
            s_axi_bvalid  <= 0;
            s_axi_bresp   <= 2'b00;
        end else begin
            s_axi_awready <= !s_axi_awready && s_axi_awvalid;
            s_axi_wready  <= !s_axi_wready  && s_axi_wvalid;

            // 写入寄存器
            if(s_axi_awready && s_axi_awvalid && s_axi_wready && s_axi_wvalid) begin
                regfile[s_axi_awaddr[3:2]] <= s_axi_wdata;
                s_axi_bvalid <= 1;
            end

            if(s_axi_bvalid && s_axi_bready)
                s_axi_bvalid <= 0;
        end
    end

    // 读通道
    always @(posedge aclk) begin
        if(!aresetn) begin
            s_axi_arready <= 0;
            s_axi_rvalid  <= 0;
            s_axi_rresp   <= 2'b00;
            s_axi_rdata   <= 32'd0;
        end else begin
            s_axi_arready <= !s_axi_arready && s_axi_arvalid;

            if(s_axi_arready && s_axi_arvalid) begin
                s_axi_rdata  <= regfile[s_axi_araddr[3:2]];
                s_axi_rvalid <= 1;
            end

            if(s_axi_rvalid && s_axi_rready)
                s_axi_rvalid <= 0;
        end
    end
endmodule
```
### test_axi_lite.py
```python
# test_axi_lite.py
import cocotb
from cocotb.clock import Clock
from cocotb.triggers import RisingEdge, Timer



@cocotb.test()
async def axi_lite_rw_test(dut):
    """AXI-Lite 写读测试"""
    cocotb.start_soon(Clock(dut.aclk, 10, units="ns").start())

    # 复位
    dut.aresetn.value = 0
    dut.s_axi_awvalid.value = 0
    dut.s_axi_wvalid.value = 0
    dut.s_axi_bready.value = 0
    dut.s_axi_arvalid.value = 0
    dut.s_axi_rready.value = 0
    await Timer(20, units="ns")
    dut.aresetn.value = 1
    await RisingEdge(dut.aclk)

    # 写操作
    await axi_write(dut, 0x1, 0x12345678)

    # 读操作
    read_data = await axi_read(dut, 0x1)
    read_data_int = int(read_data)  # 安全转整数
    assert read_data_int == 0x12345678, f"Read {hex(read_data_int)} != 0x12345678"


async def axi_write(dut, addr, data):
    """AXI-Lite 写事务"""
    dut.s_axi_awaddr.value = addr
    dut.s_axi_awvalid.value = 1
    dut.s_axi_wdata.value = data
    dut.s_axi_wvalid.value = 1
    dut.s_axi_bready.value = 1

    while True:
        aw_ready = dut.s_axi_awready.value.is_resolvable and int(dut.s_axi_awready.value)
        w_ready = dut.s_axi_wready.value.is_resolvable and int(dut.s_axi_wready.value)
        if aw_ready and w_ready:
            break
        await RisingEdge(dut.aclk)

    dut.s_axi_awvalid.value = 0
    dut.s_axi_wvalid.value = 0

    while not (dut.s_axi_bvalid.value.is_resolvable and int(dut.s_axi_bvalid.value)):
        await RisingEdge(dut.aclk)

    dut.s_axi_bready.value = 0
    await RisingEdge(dut.aclk)


async def axi_read(dut, addr):
    """AXI-Lite 读事务"""
    dut.s_axi_araddr.value = addr
    dut.s_axi_arvalid.value = 1
    dut.s_axi_rready.value = 1

    while True:
        ar_ready = dut.s_axi_arready.value.is_resolvable and int(dut.s_axi_arready.value)
        if ar_ready:
            break
        await RisingEdge(dut.aclk)

    dut.s_axi_arvalid.value = 0

    while not (dut.s_axi_rvalid.value.is_resolvable and int(dut.s_axi_rvalid.value)):
        await RisingEdge(dut.aclk)

    data = dut.s_axi_rdata.value
    dut.s_axi_rready.value = 0
    await RisingEdge(dut.aclk)
    return data
```
### Makefile
```bash
TOPLEVEL_LANG = verilog
SIM = icarus

TOPLEVEL = axi_lite_slave
COCOTB_TEST_MODULES = test_axi_lite
WAVES = 1

VERILOG_SOURCES = axi_lite_slave.v

# 指定 FST 文件名，去掉空格
export COCOTB_FST_FILE = sim_build/axi_lite_slave.fst

# 使用 cocotb makefile
include $(shell cocotb-config --makefiles)/Makefile.sim

.PHONY: wave
wave:
	gtkwave sim_build/axi_lite_slave.fst
```