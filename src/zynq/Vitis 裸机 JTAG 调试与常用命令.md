运行完PS，FCLK_CLK0, M_AXI_GP 才能正常工作。
PL和PS测有交互时,更新bit流后,PS需要先复位,从而让各种AXI相关的IP复位, 在vitis命令行执行,这个命令,触发PS复位,速度快一些。JTAG启动指的是启动PS，单纯改PL， 下载elf到QSPI或刷下u-boot,按下复位键,是最快的。

```sh
dow  D:/vitis/axi_dma/Debug/test.elf;con;
```
# 注意下载顺序
如果PL用了PS提供的时钟,复位,要先让PS运行起来，再下载bit才行
## 先在vitis里下载elf
```sh
connect
targets -set -filter {name =~ "APU*"}
rst -system
after 1000
ps7_init
ps7_post_config
# fpga -f   ./system_wrapper.bit
dow  D:/vitis/axi_dma/Debug/test.elf
con
```
## 后在vivado里下载bit，.ltx


# elf bit ltx 三种文件的关系
| 文件       | 作用对象                              | 谁来加载 / 何时用                                                                         | 是否写入 FPGA(PL)          | 对其它文件的影响                                                                                                         | 关键注意事项                                                                                        | 常用命令/入口                                                                                                         |
| -------- | --------------------------------- | ---------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **.bit** | **PL（FPGA 可编程逻辑）**                | Vivado *Program Device* / XSCT `fpga -f` / Vitis 勾选 *Program FPGA* 时               | **是**（重配/复位 PL）        | 不直接改 `.elf`/`.ltx`，但：1) **重配后 ILA 状态清空**，需用匹配的 `.ltx` 重新关联；2) **MicroBlaze 在 PL** 时会被清空，需**重下 `.elf`**           | `.ltx` 必须与生成它的 **同版 `.bit`** 匹配；Zynq/ZynqMP 上重配 PL 期间可能影响依赖 PL 的 PS 程序                        | Vivado GUI / `program_hw_devices`；XSCT：`fpga -f design.bit`                                                     |
| **.ltx** | **ILA/VIO 调试映射（主机侧）**             | **Vivado Hardware Manager** 关联（非编程）：`set_property PROBES.FILE`+`refresh_hw_device` | **否**（不写入 FPGA，仅主机侧映射） | 不改 `.bit`/`.elf`；但 **换了 `.bit` 要用匹配的 `.ltx` 重新 `refresh`** 才能看到探针                                                | 只是“探针→网名/位宽”的映射；加载与否不改变 PL 行为                                                                 | Vivado：*Program Device* 对话框选 *Debug probes file*；或 Tcl：`set_property PROBES.FILE design.ltx; refresh_hw_device` |
| **.elf** | **PS(A9/A53) 或 PL 内的 MicroBlaze** | Vitis/XSCT 经 **JTAG** 下载并运行（`dow`/`con`），或由 FSBL/Boot 介质装载                         | **否**（写入内存/OCM，不配置 PL） | **不会覆盖 `.bit`/`.ltx`**；但若 **重配 `.bit`**：1) Zynq/ZynqMP 上 PS 程序仍在内存，但依赖 PL 的外设需重建；2) **MicroBlaze 场景必须重下 `.elf`** | 冷上电需先 `ps7_init/psu_init`；调试时常用 `rst -processor; dow app.elf; con`；避免勾 *Program FPGA* 以免重配 PL | XSCT：`dow app.elf`、`con`、`rst -processor`；Vitis *System Debugger*                                               |

## 一、典型工作流
1. Vivado 一次性下 PL（bit + ltx）
```shell
open_hw
connect_hw_server
open_hw_target
current_hw_device [lindex [get_hw_devices] 0]

# 下载 bit
set_property PROGRAM.FILE {./design.bit} [current_hw_device]
program_hw_devices [current_hw_device]

# 加载 ILA 映射（.ltx）
set_property PROBES.FILE {./design.ltx} [current_hw_device]
refresh_hw_device [current_hw_device]

```

2. XSCT/JTAG 调 PS
```shell
connect
targets -set -filter {name =~ "Cortex-A9*#0" || name =~ "ARM*#0"}

# （冷上电第一次）初始化 PS：仅首次或需要时执行
# source ./ps7_init.tcl
# ps7_init
# ps7_post_config

rst -processor          ;# 仅复位处理器，不影响 PL(bit/ltx)
dow ./app.elf           ;# 下载 ELF（加载符号、设置入口）
con                     ;# 运行

```
>不要在 XSCT 里执行 fpga -f *.bit，也不要在 Vitis 勾选 Program FPGA，否则会重配 PL、清掉 ILA 映射。

## 二、XSCT 常用命令速查

### 连接 / 目标选择
- `connect` / `disconnect`
- `targets`：列出调试目标
- `targets -set -filter {name =~ "Cortex-A9*#0"}`：选择目标
- `state`：查看运行状态
- `version`：XSCT 版本

### 复位（不动 PL）
- `rst -processor`：仅复位所选 CPU 核（推荐）
- `rst -system`：系统级复位（更重，但也不会重新配置 PL）

### 下载 / 运行 / 单步
- `dow ./app.elf`：下载 ELF（含符号）
- `con`：继续运行
- `stop`：暂停
- `stp` / `nxt` / `stpout`：单步进入 / 越过 / 跳出
- `dis <addr> <len>`：反汇编
- `locals` / `backtrace`：查看局部变量 / 调用栈

### 断点
- `bpadd -addr &main`：在符号 `main` 入口处断点
  - 也可：`bpadd -file foo.c -line 123` 或 `bpadd -addr 0x00100000`
- `bplist`：查看断点
- `bpremove <id> | -all`：删断点
- `bpenable <id>` / `bpdisable <id>`：使能 / 禁用
- `bpstatus`：断点命中状态

### 寄存器 / 内存 / 符号
- `rrd <reg>` / `rwr <reg> <val>`：读 / 写寄存器（如 `pc`、`sp`）
- `mrd <addr> [count]` / `mwr <addr> <val> [count]`：读 / 写内存
- `memmap -file ./app.elf`：仅加载符号（不下载代码）
- `print &main`：查看符号解析地址

### （一般不需）配置 PL / 校验
- `fpga -f ./design.bit`：通过 XSCT 配置 PL（慎用）
- `verify <file>`：校验映像

### JTAG / 终端
- `jtag targets`：查看 JTAG 链
- `jtag frequency <Hz>`：设置 JTAG 频率
- `jtagterminal` / `readjtaguart`：JTAG UART（若平台支持）

### Vitis 项目相关（命令行工程）
- `setws <dir>` / `getws`：工作区
- `platform create|generate|list|report`
- `domain create|config|list`
- `app create|build|clean|report`

## 三、脚本模板
### 下载elf
```sh
# run_zynq_a9.tcl
connect
targets -set -filter {name =~ "Cortex-A9*#0" || name =~ "ARM*#0"}

# 冷上电时取消注释以下三行：
# source ./ps7_init.tcl
# ps7_init
# ps7_post_config

rst -processor
dow ./app.elf
# 可选：断在 main
# bpadd -addr &main
con
```

### 热替换 ELF（不复位，快速迭代）
```sh
# hot_swap_elf.tcl
connect
targets -set -filter {name =~ "<Your-Core-Name-Filter>"}
stop
dow ./app.elf
con
```