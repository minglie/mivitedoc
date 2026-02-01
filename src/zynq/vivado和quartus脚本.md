# Vivado
## vivado 编译配置
```shell
set_param general.maxThreads 20
set_param synth.maxThreads 8
set_property STEPS.PHYS_OPT_DESIGN.IS_ENABLED false [get_runs impl_1]


get_param general.maxThreads
get_param synth.maxThreads
get_property STEPS.PHYS_OPT_DESIGN.IS_ENABLED [get_runs impl_1]


# 设置全局线程数
set_param general.maxThreads 20
get_param general.maxThreads

# 设置综合阶段的线程数
set_param synth.maxThreads 8
get_param synth.maxThreads

# 关闭物理优化(开启物理优化,让实现更可能收敛（牺牲编译速度）)
set_property STEPS.PHYS_OPT_DESIGN.IS_ENABLED false [get_runs impl_1]
set_property STEPS.PHYS_OPT_DESIGN.IS_ENABLED true [get_runs impl_1]
get_property STEPS.PHYS_OPT_DESIGN.IS_ENABLED [get_runs impl_1]

# 列举所有参数
list_param
```
## Vivado清理与重跑
| 命令                                            | 粒度     | 作用                              | 何时使用                 |
| --------------------------------------------- | ------ | ------------------------------- | -------------------- |
| `reset_run synth_1 -clean`                    | 单个 Run | 清空 `synth_1` 的产物与缓存，保留工程与其它 run | 只想**重新综合**时          |
| `reset_run impl_1 -clean`                     | 单个 Run | 清空 `impl_1` 的产物与缓存              | 只想**重新实现/布线**时       |
| `reset_project`                               | 整个工程   | 清空所有 run 结果与缓存，工程回到“新建未编译”      | 工程脏了、版本升级后**全量干净重编** |
| `close_project`                               | 整个工程   | 关闭当前工程（不清理产物）                   | 退出/切换工程              |
| `remove_files …`                              | 文件级    | 从工程移除指定源/约束（不会删磁盘文件）            | 清理工程里不再需要的文件         |
| `remove_run impl_1`                           | 单个 Run | 从工程**移除**某个 run（连配置一起删）         | 重建 run 或防止误用         |
| `launch_runs synth_1`                         | 单个 Run | 启动综合（需先 clean 才算干净重跑）           | 正常编译                 |
| `launch_runs impl_1 -to_step write_bitstream` | 单个 Run | 启动实现直到生成 bit                    | 一次跑到出 bit            |
| `open_run impl_1`                             | 单个 Run | 打开已完成的 run                      | 查报告/时序/布线            |
| `report_compile_order -fileset sources_1`     | 文件集    | 查看综合编译顺序                        | 排查依赖/缺失文件            |


## vivado 导入文件
```shell
# 设置 RTL 文件目录
set rtl_dir "D:/workspace/gitee/0/ming-verilog/src/rtl"

# 单个加
add_files $rtl_dir/TOP.v
add_files $rtl_dir/rpc_processor.v
add_files $rtl_dir/uart_rx.v
add_files $rtl_dir/uart_tx.v
add_files $rtl_dir/vio_uart.v


# 添加所有 .v / .sv 文件
add_files [glob -nocomplain "$rtl_dir/*.v"]
add_files [glob -nocomplain "$rtl_dir/*.sv"]

# 添加头文件（.vh）
add_files -fileset sources_1 [glob -nocomplain "$rtl_dir/*.vh"]

# 添加约束文件（.xdc）到约束文件集
add_files -fileset constrs_1  "$rtl_dir/system.xdc"

# 添加仿真文件到仿真文件集
add_files -fileset sim_1 "$rtl_dir/tb_pl_top.v"

```
## vivado  删除BD器件或端口连线
```shell
# 断开一个端口连线
#bd_disconnect_between BEEP
# 断开一个器件的管脚连线
#bd_disconnect_between /power_on_reset_0/i_clk
# 精确断开两个对象之间的连线
#bd_disconnect_between /clk_wiz_0/clk_out1 /power_on_reset_0/i_clk

proc bd_disconnect_between {lhs {rhs ""}} {
  # 识别左端点
  set L [concat [get_bd_pins -quiet $lhs] [get_bd_ports -quiet $lhs]]
  if {![llength $L]} {
    puts "Left endpoint not found: $lhs"
    return
  }

  # 如果没有第二个参数：直接断开 L 与其所有 net
  if {$rhs eq ""} {
    set nets [get_bd_nets -of_objects $L]
    if {![llength $nets]} {
      puts "No net connected to '$lhs'."
      return
    }
    foreach n $nets {
      set nname [get_property NAME $n]
      disconnect_bd_net $n $L
      puts "Disconnected '$lhs' from net '$nname'."
    }
    return
  }

  # 有第二个参数 → 精确断一对
  set R [concat [get_bd_pins -quiet $rhs] [get_bd_ports -quiet $rhs]]
  if {![llength $R]} {
    puts "Right endpoint not found: $rhs"
    return
  }

  # 找共同网络
  set lnets [lsort -unique [get_bd_nets -of_objects $L]]
  set rnets [lsort -unique [get_bd_nets -of_objects $R]]
  set common [lsort -unique [lintersect $lnets $rnets]]

  if {![llength $common]} {
    puts "No common net between '$lhs' and '$rhs'."
    return
  }

  foreach n $common {
    set nname [get_property NAME $n]
    disconnect_bd_net $n $L
    disconnect_bd_net $n $R
    puts "Disconnected '$lhs' <-> '$rhs' on net '$nname'."
  }
}

```
## vivado映射引脚
```shell
#时序约束
create_clock -period 20.000 -name sys_clk [get_ports sys_clk] 
#IO引脚约束
#----------------------系统时钟---------------------------
set_property -dict {PACKAGE_PIN U18 IOSTANDARD LVCMOS33} [get_ports sys_clk]
#----------------------系统复位---------------------------
set_property -dict {PACKAGE_PIN N16 IOSTANDARD LVCMOS33} [get_ports sys_rst_n]
#----------------------PL_KEY---------------------------
set_property -dict {PACKAGE_PIN L14 IOSTANDARD LVCMOS33} [get_ports {key[0]}]
set_property -dict {PACKAGE_PIN K16 IOSTANDARD LVCMOS33} [get_ports {key[1]}]
#----------------------PL_LED---------------------------
#底板
set_property -dict {PACKAGE_PIN H15 IOSTANDARD LVCMOS33} [get_ports {led[0]}]
set_property -dict {PACKAGE_PIN L15 IOSTANDARD LVCMOS33} [get_ports {led[1]}]
#核心板
set_property -dict {PACKAGE_PIN J16 IOSTANDARD LVCMOS33} [get_ports led]
#----------------------蜂鸣器---------------------------
set_property -dict {PACKAGE_PIN M14 IOSTANDARD LVCMOS33} [get_ports beep]
#----------------------USB UART---------------------------
set_property -dict {PACKAGE_PIN T19 IOSTANDARD LVCMOS33} [get_ports uart_rxd]
set_property -dict {PACKAGE_PIN J15 IOSTANDARD LVCMOS33} [get_ports uart_txd]
```


# quartus 导入文件

## 单个导入
```shell
set rtl_dir "D:/workspace/gitee/0/ming-verilog_prj/ming-verilog/src/freq"
set_global_assignment -name VERILOG_FILE  $rtl_dir/smg.v
set_global_assignment -name VERILOG_FILE  $rtl_dir/HC_FPGA_Demo_Top.v
set_global_assignment -name VERILOG_FILE  $rtl_dir/freq_counter.v
set_global_assignment -name VERILOG_FILE  $rtl_dir/digital_tube.v
set_global_assignment -name VERILOG_FILE  $rtl_dir/binary2bcd.v
```

## 批量导入
```shell
set rtl_dir "D:/workspace/gitee/0/ming-verilog_prj/ming-verilog/src/freq"
# 指定导入
set verilog_files {
    smg.v
    HC_FPGA_Demo_Top.v
    freq_counter.v
    digital_tube.v
}

# 模糊匹配导入
# set verilog_files [glob -nocomplain -directory $rtl_dir *.v]

# 遍历每个文件并添加到工程中
foreach file $verilog_files {
    set_global_assignment -name VERILOG_FILE "$rtl_dir/$file"
}
```
## 映射引脚
```bash
#时钟引脚 50M
set_location_assignment PIN_E1 -to CLOCK_XTAL_50MHz
#复位引脚
set_location_assignment PIN_E15 -to RESET

#LED对应的引脚
set_location_assignment PIN_G15 -to LED0
set_location_assignment PIN_F16 -to LED1
set_location_assignment PIN_F15 -to LED2
set_location_assignment PIN_D16 -to LED3

#按键对应的引脚 KEY1已作为复位按键
#set_location_assignment PIN_E15 -to KEY1
set_location_assignment	PIN_E16	-to KEY2
set_location_assignment	PIN_M16 -to KEY3
set_location_assignment	PIN_M15 -to KEY4
set_location_assignment	PIN_F7 -to KEY5
set_location_assignment	PIN_E9 -to KEY6
#IIC
set_location_assignment	PIN_L2  -to SDA
set_location_assignment	PIN_L1  -to SCL

set_location_assignment	PIN_N14 -to SIG_IN
set_location_assignment	PIN_M12 -to SIG_OUT1
set_location_assignment	PIN_L12 -to SIG_OUT2
set_location_assignment	PIN_K12 -to SIG_OUT3
set_location_assignment	PIN_K11 -to SIG_OUT4
set_location_assignment	PIN_J13 -to SIG_OUT5

set_location_assignment	PIN_F10 -to SIG_IN1
set_location_assignment	PIN_F11 -to SIG_IN2

#串口对应的引脚
set_location_assignment	PIN_M2	-to RXD
set_location_assignment	PIN_G1	-to TXD


#数码管
set_location_assignment PIN_B7 -to DIG[0]
set_location_assignment PIN_A8 -to DIG[1]
set_location_assignment PIN_A6 -to DIG[2]
set_location_assignment PIN_B5 -to DIG[3]
set_location_assignment PIN_B6 -to DIG[4]
set_location_assignment PIN_A7 -to DIG[5]
set_location_assignment PIN_B8 -to DIG[6]
set_location_assignment PIN_A5 -to DIG[7]
set_location_assignment PIN_A4 -to SEL[0]
set_location_assignment PIN_B4 -to SEL[1]
set_location_assignment PIN_A3 -to SEL[2]
set_location_assignment PIN_B3 -to SEL[3]
set_location_assignment PIN_A2 -to SEL[4]
set_location_assignment PIN_B1 -to SEL[5]
```