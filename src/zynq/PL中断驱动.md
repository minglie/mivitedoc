# Linux 中断号 = 32 + SPI Index
| 你连接的 IRQ\_F2P\[x] | Vivado 中 GIC ID | Linux 设备树要写 |
| ----------------- | --------------- | ----------- |
| IRQ\_F2P\[0]      | GIC ID 61       | `<0 29 4>`  |
| IRQ\_F2P\[1]      | GIC ID 62       | `<0 30 4>`  |


# 更新中断驱动
```shell
# /opt/data/A/4_Source_Code/3_Embedded_Linux/z8_driver/z8/irq
scp  pl_irq_test.ko   root@192.168.1.211:/lib/modules/5.4.0-xilinx-v2020.2
```

# 安装驱动
```shell
# /lib/modules/5.4.0-xilinx-v2020.2
insmod pl_irq_test.ko
insmod pl_data.ko

hexdump -v -e '4/4 "%11u "' -e '"\n"' /dev/pl_data
```

# 查看中断触发次数
```shell
cat /proc/interrupts | grep pl_irq
```

# 查看中断触发次数
```shell
 watch "cat /proc/interrupts"
```
