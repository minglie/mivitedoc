
[5.4内核源码](https://elixir.bootlin.com/linux/v5.4/source/arch/arm/boot/dts/zynq-zybo-z7.dts)

[Xilinx的5.4内核源码](https://github.com/Xilinx/linux-xlnx/tree/xlnx_rebase_v5.4/arch)

[linux子系统操作表](https://elixir.bootlin.com/linux/v5.4/source/include/linux/rtc.h#L75)

[xilinx设备树文档](https://xilinx-wiki.atlassian.net/wiki/spaces/A/pages/18842398/Linux+GPIO+Driver#Zynq)

| 序号 | 子系统/框架 | 全称 | 主要用途 | Zynq 常见应用 | 用户空间接口 |
|------|--------|------|----------|---------------|--------------|
| 1 | [gpio](https://web.git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/Documentation/devicetree/bindings/gpio/gpio-zynq.yaml) | General Purpose I/O | 通用输入输出，控制电平 | 按键、继电器 | `libgpiod`, `/sys/class/gpio/` |
| 2 |[leds](https://web.git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/Documentation/devicetree/bindings/leds/common.yaml)  | LED Subsystem | 封装 LED 控制，支持触发器 | 板载心跳灯、状态灯 | `/sys/class/leds/` |
| 3 | [iic](https://web.git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/Documentation/devicetree/bindings/i2c/xlnx,xps-iic-2.00.a.yaml)| Inter-Integrated Circuit | 串行总线外设控制 | EEPROM、RTC、Codec | `/dev/i2c-*`, `i2cdetect` |
| 4 |  [spi](https://web.git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/Documentation/devicetree/bindings/spi/xlnx,zynq-qspi.yaml) | Serial Peripheral Interface | 串行高速接口 | SPI Flash、ADC、DAC | `/dev/spidev*` |
| 5 |  [uart](https://web.git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/Documentation/devicetree/bindings/serial/xlnx,opb-uartlite.yaml) | TTY Subsystem | 串口通信 | PS UART、AXI UARTLite | `/dev/ttyPS*` |
| 6 |  [iio](https://web.git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/Documentation/devicetree/bindings/iio/common.yaml) | Industrial I/O | 传感器/ADC/DAC 框架 | XADC、AD7175、温度传感器 | `/sys/bus/iio/…`, `iio_readdev` |
| 7 |  [pwm](https://web.git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/Documentation/devicetree/bindings/pwm/pwm.yaml)| Pulse Width Modulation | 占空比控制 | 电机、舵机、LCD 背光 | `/sys/class/pwm/` |
| 8 | **ALSA** | Advanced Linux Sound Architecture | 音频框架 | I²S Codec (WM8960)、HDMI Audio | `/dev/snd/*`, `aplay` |
| 9 | **V4L2** | Video4Linux2 | 视频采集与输出 | OV5640 摄像头、HDMI In | `/dev/video*`, `v4l2-ctl` |
| 10 | [Watchdog](https://web.git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/Documentation/devicetree/bindings/watchdog/xlnx,xps-timebase-wdt.yaml)  | Watchdog Subsystem | 看门狗定时器 | 板载 PMU WDT、外部 WDT | `/dev/watchdog` |
| 11 | [mtd](https://web.git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/Documentation/devicetree/bindings/mtd/mtd.yaml) | Memory Technology Device | 原始闪存存储抽象 | QSPI Flash、NAND Flash | `/dev/mtd*`, `/dev/mtdblock*` |
| 12 |[mmc/sd](https://web.git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/Documentation/devicetree/bindings/mmc/mmc-controller.yaml)  | MultiMediaCard / SecureDigital | 块存储设备管理 | SD 卡、eMMC 启动 rootfs | `/dev/mmcblk*` |
| 13 |  [usb](https://web.git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/Documentation/devicetree/bindings/usb/usb-device.yaml)| Universal Serial Bus | USB 主机/设备/OTG | U 盘、USB 网卡、USB 摄像头 | `/dev/bus/usb/*` |
| 14 | **NET** | Network Device | 网络接口抽象 | PS GEM 千兆网口、PL Ethernet、WiFi 模块 | `/sys/class/net/eth0`, `ip link` |
| 15 | [thermal](https://web.git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/Documentation/devicetree/bindings/thermal/thermal-sensor.yaml) | Thermal Framework | 温度监控与散热管理 | PS 芯片温度、过热保护 | `/sys/class/thermal/thermal_zone0/temp` |
| 16 | **HWMON** | Hardware Monitoring | 硬件健康监控 | 电压、电流、风扇速度传感器 | `/sys/class/hwmon/` |
| 17 | **Regulator** | Regulator Framework | 电源管理与启停控制 | PMIC（电源芯片）管理 VCCINT/VCCAUX | `/sys/class/regulator/` |
| 18 |  [clock](https://web.git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/Documentation/devicetree/bindings/clock/zynq-7000.txt) | Common Clock Framework | 时钟树与频率管理 | ARM PLL、DDR PLL、PL 时钟 | `/sys/kernel/debug/clk/` |
| 19 | [dma](https://web.git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/Documentation/devicetree/bindings/dma/xilinx/xlnx,zynqmp-dma-1.0.yaml) | DMA Engine Framework | 抽象 DMA 控制器，给上层子系统提供数据搬运 | AXI DMA、CDMA 与 IIO/ALSA/V4L2 配合 | 作为后端，通常不直接出现在 `/dev/` |
| 20 | [mfd](https://web.git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/Documentation/devicetree/bindings/mfd/mfd.txt)  | Multi-Function Device | 多功能复合设备 | PMIC（带 RTC、Regulator、GPIO 等功能） | 自动拆分为子设备（无独立接口） |
| 21 |  [input](https://web.git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/Documentation/devicetree/bindings/input/gpio-keys.yaml) | Input Subsystem | 输入事件抽象 | 按键、触摸屏、旋钮 | `/dev/input/event*` |
| 22 | [rtc](https://web.git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/Documentation/devicetree/bindings/rtc/xlnx,zynqmp-rtc.yaml) | Real-Time Clock | 实时时钟管理 | DS3231、内置 RTC | `/dev/rtc*`, `hwclock` |
| 23 | **Power Supply** | Power Supply Class | 电池/电源状态 | PMIC、UPS、电池 | `/sys/class/power_supply/` |
| 24 | **Regmap** | Register Map Framework | 统一寄存器访问 | I²C/SPI 外设驱动 | 内核框架（无直接接口） |
| 25 | **RFkill** | Radio Frequency Kill | 无线开关管理 | WiFi/BT 开关控制 | `/dev/rfkill` |
| 26 | **Remoteproc** | Remote Processor Framework | 管理协处理器 | ZynqMP Cortex-R5、PL Softcore | `/sys/class/remoteproc/` |
| 27 | **RPMsg** | Remote Processor Messaging | 处理器间消息通信 | PS ↔ PL ↔ RPU 通信 | `/dev/rpmsg*` |
| 28 | **Crypto** | Crypto Framework | 硬件加解密加速 | Zynq AES、SHA 引擎 | `/dev/crypto` |
| 29 | **CAN** | Controller Area Network | 工业总线通信 | CAN 收发器 | `ip link set can0 up` |
| 30 | **SPI-NOR** | SPI NOR Flash Subsystem | 专门管理 SPI NOR | QSPI Boot Flash | 通过 `/dev/mtd*` |
| 31 | **PHY** | PHY Subsystem | 通用 PHY 管理 | USB PHY、Ethernet PHY | `/sys/class/phy/` |
| 32 | **SerDes** | Serializer/Deserializer | 高速串并接口 | PCIe/高速收发器 | 内核框架 |
| 33 | **PCI/PCIe** | Peripheral Component Interconnect | 高速总线 | Zynq PCIe Root/EP | `/sys/bus/pci/` |
| 34 | **SDIO** | SD I/O Subsystem | SDIO 外设 | WiFi 模块 (SDIO 接口) | `/sys/bus/sdio/` |
| 35 | **NVMEM** | Non-Volatile Memory | 小型存储器抽象 | EFUSE、EEPROM | `/sys/bus/nvmem/` |
| 36 | **Industrial Fieldbus** | 工业现场总线 | EtherCAT、Profinet | 工控场景 | 内核外扩展驱动 |
| 37 | **VirtIO** | Virtual I/O | 虚拟化 I/O 框架 | QEMU/ZynqMP 虚拟机 | `/dev/vhost-*` |
| 38 | **Mailbox** | Mailbox Subsystem | 处理器间信号传递 | PS ↔ PL 通信 | `/sys/class/mailbox/` |
| 39 | **FPGA Manager** | FPGA Manager | 动态加载比特流 | 部分重配置 | `/sys/class/fpga_manager/` |
| 40 | **ConfigFS** | Configuration Filesystem | 动态配置框架 | USB Gadget 配置 | `/sys/kernel/config/` |
| 41 | **Block** | Block Layer | 块设备抽象 | `/dev/sd*`, `/dev/mmcblk*` |
| 42 | **Ext4** | Extended Filesystem v4 | 主流文件系统 | `/` rootfs |
| 43 | **XFS** | XFS Filesystem | 高性能文件系统 | `/mnt/xfs` |
| 44 | **Btrfs** | B-tree FS | 新一代快照/子卷文件系统 | `btrfs subvolume` |
| 45 | **F2FS** | Flash-Friendly FS | 闪存优化文件系统 | eMMC/SD rootfs |
| 46 | **NFS** | Network FS | 网络挂载 | `mount -t nfs` |
| 47 | **CIFS/SMB** | SMB FS | Windows 文件共享 | `mount -t cifs` |
| 48 | **FUSE** | Filesystem in Userspace | 用户态文件系统接口 | `sshfs` |
| 49 | **Tmpfs** | Temporary FS | 内存文件系统 | `/dev/shm` |
| 50 | **OverlayFS** | Overlay Filesystem | 容器镜像文件层 | Docker/Podman |
| 51 | **SquashFS** | Squash FS | 压缩只读文件系统 | 固件 rootfs |
| 52 | **JFFS2** | Journaling Flash FS v2 | NOR/NAND 文件系统 | MTD 上挂载 |
| 53 | **UBIFS** | UBI FS | NAND 专用文件系统 | `/dev/ubi0_0` |
| 54 | **ZFS** | Zettabyte FS | 高可靠 FS | 大存储系统 |
| 55 | **DRM/KMS** | Direct Rendering Manager | 显示/显卡管理 | `/dev/dri/card0` |
| 56 | **HDMI CEC** | HDMI Consumer Electronics Control | HDMI 遥控协议 | `/dev/cec0` |
| 57 | **DisplayPort** | DP Subsystem | 显示接口 | 显示器输出 |
| 58 | **Backlight** | Backlight Subsystem | 屏幕背光调节 | `/sys/class/backlight/` |
| 59 | **Framebuffer** | FB Subsystem | 传统显示接口 | `/dev/fb0` |
| 60 | **GPU Accel** | GPU Acceleration | GPU 计算接口 | OpenCL/CUDA |
| 61 | **Bluetooth** | Bluetooth Stack | 蓝牙通信 | `bluetoothctl` |
| 62 | **802.15.4** | IEEE 802.15.4 | ZigBee/Thread | IoT 通信 |
| 63 | **LoRaWAN** | Long Range Wide Area Network | LoRa 通信 | LoRa 模块 |
| 64 | **WiFi mac80211** | mac80211 | WiFi 协议栈 | `iw` |
| 65 | **CFG80211** | Config 802.11 | WiFi 配置接口 | `iw list` |
| 66 | **NFC** | Near Field Communication | 近场通信 | `/dev/nfc*` |
| 67 | **IR Remote** | Infrared Remote Subsystem | 红外遥控 | `/dev/lirc0` |
| 68 | **SoundWire** | SoundWire | 音频总线 | 音频 Codec |
| 69 | **HD-Audio** | High Definition Audio | PC/SoC 音频 | `/proc/asound/` |
| 70 | **Sound Open Firmware** | SOF | 开源音频固件 | Intel/ARM SoC |
| 71 | **SCSI** | Small Computer System Interface | 存储协议 | `/dev/sd*` |
| 72 | **SATA/AHCI** | Serial ATA | 硬盘接口 | `/dev/sda` |
| 73 | **NVMe** | Non-Volatile Memory Express | PCIe SSD | `/dev/nvme0n1` |
| 74 | **VirtIO Block** | VirtIO Block | 虚拟化磁盘 | QEMU/KVM |
| 75 | **VirtIO Net** | VirtIO Net | 虚拟化网卡 | `/dev/vhost-net` |
| 76 | **vDPA** | vDataPath Accel | 虚拟化加速 | DPDK/KVM |
| 77 | **KVM** | Kernel-based VM | 虚拟机管理 | `/dev/kvm` |
| 78 | **vhost** | vhost Subsystem | 内核加速 virtio | `/dev/vhost-*` |
| 79 | **TPM** | Trusted Platform Module | 安全加密芯片 | `/dev/tpm0` |
| 80 | **IMA/EVM** | Integrity Measurement / Extended Verification | 文件完整性与签名 | 签名校验 |
| 81 | **SELinux** | Security-Enhanced Linux | 强制访问控制 | `getenforce` |
| 82 | **AppArmor** | Application Armor | 进程安全框架 | `aa-status` |
| 83 | **Smack** | Simplified MAC | 简化版安全模块 | 安全域隔离 |
| 84 | **eBPF** | Extended Berkeley Packet Filter | 内核态程序/监控 | `bpftool` |
| 85 | **Perf** | Performance Events | 性能分析 | `perf stat` |
| 86 | **Ftrace** | Function Tracer | 内核函数追踪 | `/sys/kernel/debug/tracing/` |
| 87 | **KGDB** | Kernel Debugger | 内核调试器 | gdbstub |
| 88 | **OProfile** | OProfile Profiler | 采样性能分析 | `opcontrol` |
| 89 | **SysRQ** | Magic SysRq Key | 紧急内核调试 | `echo b > /proc/sysrq-trigger` |
| 90 | **UEVENT** | Uevent Subsystem | 设备热插拔事件 | udev |
| 91 | **DeviceTree** | Device Tree | 硬件抽象描述 | `.dts/.dtb` |
| 92 | **ACPI** | Advanced Config & Power Interface | 电源管理 | x86 常见 |
| 93 | **PM QoS** | Power Mgmt QoS | 电源管理质量 | `/dev/cpu_dma_latency` |
| 94 | **Cpufreq** | CPU Frequency Scaling | 动态调频 | `/sys/devices/system/cpu/cpu0/cpufreq/` |
| 95 | **Cpuidle** | CPU Idle Subsystem | 动态休眠 | `/sys/devices/system/cpu/cpuidle/` |
| 96 | **Suspend/Resume** | Suspend Framework | 系统挂起恢复 | `echo mem > /sys/power/state` |
| 97 | **Thermal Cooling** | Cooling Devices | 风扇/PWM 控制 | `/sys/class/thermal/cooling_device*` |
| 98 | **LED Triggers** | LED Trigger Framework | 事件驱动 LED | `heartbeat` |
| 99 | **Notifier Chains** | Notifier Chains | 内核事件通知机制 | 驱动内部使用 |
| 100 | **SysFS** | SysFS Virtual FS | 内核对象抽象 | `/sys/` 目录 |


### 1. GPIO 子系统
**用途**：最通用的 I/O 接口，控制引脚高低电平，用于按键输入、继电器控制等。  

**设备树示例**：
```dts
gpio_keys {
    compatible = "gpio-keys";
    button0 {
        label = "key0";
        gpios = <&gpio0 10 GPIO_ACTIVE_LOW>;
        linux,code = <KEY_ENTER>;
    };
};
```

**用户空间**：
```bash
gpiodetect
gpioget gpiochip0 10
gpioset gpiochip0 10=1
```

---

### 2. LED 子系统
**用途**：在 GPIO 基础上抽象出 LED 的语义（亮/灭/触发闪烁）。  

**设备树示例**：
```dts
leds {
    compatible = "gpio-leds";
    led0 {
        label = "status-led";
        gpios = <&gpio0 11 GPIO_ACTIVE_HIGH>;
        linux,default-trigger = "heartbeat";  // 心跳灯
    };
};
```

**用户空间**：
```bash
echo 1 > /sys/class/leds/status-led/brightness
echo heartbeat > /sys/class/leds/status-led/trigger
```

---

### 3. I²C 子系统
**用途**：挂载低速外设，如 EEPROM、RTC、音频 Codec、传感器。  

**设备树示例**：
```dts
&i2c0 {
    status = "okay";
    rtc@68 {
        compatible = "maxim,ds3231";
        reg = <0x68>;
    };
};
```

**用户空间**：
```bash
i2cdetect -y 0
i2cget -y 0 0x68 0x00
i2cset -y 0 0x68 0x00 0x12
```

---

### 4. SPI 子系统
**用途**：用于高速外设（Flash、ADC、DAC、LCD）。  

**设备树示例**：
```dts
&spi0 {
    status = "okay";
    spidev@0 {
        compatible = "spidev";
        reg = <0>;   // CS0
        spi-max-frequency = <10000000>;
    };
};
```

**用户空间**：
```bash
ls /dev/spidev*
spidev_test -D /dev/spidev0.0 -v
```

---

### 5. UART / TTY 子系统
**用途**：串口通信，常用于调试口、外设通讯。  

**设备树示例**：
```dts
&uart1 {
    status = "okay";
};
```

**用户空间**：
```bash
ls /dev/ttyPS*
screen /dev/ttyPS1 115200
```

---

### 6. IIO 子系统
**用途**：传感器/ADC/DAC 的统一框架，支持采样、buffer、触发器。  
Zynq 典型应用：**XADC**（片上 ADC），以及外部 ADC/DAC（ADI 系列）。  

**设备树示例（XADC）**：
```dts
xadc: xadc@f8007100 {
    compatible = "xlnx,zynq-xadc-1.00.a";
    reg = <0xf8007100 0x20>;
};
```

**用户空间**：
```bash
ls /sys/bus/iio/devices/iio:device0/
cat in_temp0_raw
iio_readdev iio:device0
```

---

### 7. PWM 子系统
**用途**：输出可调脉宽信号，常用于舵机、电机、LCD 背光。  

**设备树示例**：
```dts
pwm0: pwm@0 {
    compatible = "xlnx,pwm-chip";
    #pwm-cells = <3>;
};
```

**用户空间**：
```bash
echo 0 > /sys/class/pwm/pwmchip0/export
echo 20000000 > /sys/class/pwm/pwmchip0/pwm0/period
echo 10000000 > /sys/class/pwm/pwmchip0/pwm0/duty_cycle
echo 1 > /sys/class/pwm/pwmchip0/pwm0/enable
```

---

### 8. ALSA (声音子系统)
**用途**：音频框架，支持 I²S Codec、HDMI Audio。  

**设备树示例（WM8960）**：
```dts
sound {
    compatible = "simple-audio-card";
    simple-audio-card,cpu {
        sound-dai = <&i2s0>;
    };
    simple-audio-card,codec {
        sound-dai = <&wm8960>;
    };
};
```

**用户空间**：
```bash
aplay -l
aplay test.wav
arecord -f cd test.wav
```

---

### 9. V4L2 (视频子系统)
**用途**：视频采集与输出（摄像头、HDMI In）。  

**设备树示例（OV5640）**：
```dts
&i2c0 {
    ov5640: camera@3c {
        compatible = "ovti,ov5640";
        reg = <0x3c>;
    };
};
```

**用户空间**：
```bash
ls /dev/video*
v4l2-ctl --list-formats-ext
```

---

### 10. Watchdog 子系统
**用途**：看门狗定时器，系统卡死时自动复位。  

**设备树示例**：
```dts
wdt0: watchdog@f8005000 {
    compatible = "xlnx,ps7-wdt-1.00.a";
    reg = <0xf8005000 0x1000>;
};
```

**用户空间**：
```bash
ls /dev/watchdog
echo 1 > /dev/watchdog   # 喂狗
```

### 11. MTD 子系统
**用途**：管理原始 Flash 存储器（NOR/NAND/QSPI），用于存放 **FSBL、U-Boot、内核、设备树、bitstream、rootfs** 等。支持 JFFS2、UBIFS 等文件系统。  

**设备树示例（QSPI Flash 分区）**：
```dts
&qspi {
    status = "okay";
    flash@0 {
        compatible = "n25q256a";
        reg = <0x0>;
        spi-max-frequency = <50000000>;
        #address-cells = <1>;
        #size-cells = <1>;

        partition@0 {
            label = "boot";
            reg = <0x00000000 0x00100000>;
        };
        partition@1 {
            label = "uboot-env";
            reg = <0x00100000 0x00020000>;
        };
        partition@2 {
            label = "bitstream";
            reg = <0x00120000 0x00400000>;
        };
        partition@3 {
            label = "kernel";
            reg = <0x00520000 0x00500000>;
        };
        partition@4 {
            label = "rootfs";
            reg = <0x00a20000 0x015e0000>;
        };
    };
};
```

**用户空间**：
```bash
# 查看 MTD 分区
cat /proc/mtd

# 擦除 / 写入 / 读取
flash_erase /dev/mtd0 0 0
nandwrite /dev/mtd0 u-boot.bin
nanddump /dev/mtd0 > dump.bin

# 挂载 rootfs (如 jffs2)
mount -t jffs2 /dev/mtdblock4 /mnt
```


### 12. MMC/SD 子系统
**用途**：管理 SD/eMMC 等块设备，常用于存放 rootfs、日志、数据分区。  

**设备树示例（PS SD 卡/eMMC）**：
```dts
&sdhci0 {              /* mmc0：通常连 eMMC 或 SD 卡槽 */
    status = "okay";
    bus-width = <4>;
    disable-wp;        /* 如无写保护引脚 */
    xlnx,has-cd = <1>; /* 有无卡检测 */
};
```

**用户空间**：
```bash
lsblk
ls /dev/mmcblk*
mount /dev/mmcblk0p2 /mnt
dmesg | grep mmc
```

---

### 13. USB 子系统
**用途**：USB Host/Device/OTG，连接 U 盘、USB 网卡、摄像头，或作为 USB Gadget 设备。  

**设备树示例（PS USB OTG）**：
```dts
&usb0 {
    status = "okay";
    dr_mode = "host";   /* host/device/otg 三选一 */
    phy_type = "ulpi";
};
```

**用户空间**：
```bash
lsusb
ls /dev/bus/usb/*/*
dmesg | grep -i usb
# U 盘挂载
blkid
mount /dev/sda1 /mnt
```

---

### 14. NET（网络设备）子系统
**用途**：网卡抽象与管理，支持以太网、WiFi、虚拟网卡等。  

**设备树示例（PS GEM 千兆网口）**：
```dts
&gem0 {
    status = "okay";
    phy-mode = "rgmii-id";
    phy-handle = <&phy0>;
    mdio {
        #address-cells = <1>;
        #size-cells = <0>;
        phy0: ethernet-phy@1 {
            reg = <1>;
        };
    };
};
```

**用户空间**：
```bash
ip link
ip addr add 192.168.1.50/24 dev eth0
ip link set eth0 up
ethtool eth0
```

---

### 15. THERMAL 子系统
**用途**：温度监控与散热管理，联动风扇/限频/关机策略。  

**设备树示例（热区与冷却设备）**：
```dts
thermal-zones {
    cpu_thermal: cpu-thermal {
        polling-delay-passive = <1000>;
        polling-delay = <2000>;
        trips {
            cpu_alert: cpu-alert {
                temperature = <80000>; /* 80°C */
                hysteresis = <2000>;
                type = "passive";
            };
            cpu_crit: cpu-crit {
                temperature = <95000>; /* 95°C */
                hysteresis = <2000>;
                type = "critical";
            };
        };
        cooling-maps { /* 可绑定风扇/PWM 作为 cooling device */
            /* 依硬件具体实现填写 */
        };
    };
};
```

**用户空间**：
```bash
cat /sys/class/thermal/thermal_zone0/temp   # 单位毫度C
watch -n1 'cat /sys/class/thermal/thermal_zone*/temp'
```

---

### 16. HWMON 子系统
**用途**：硬件健康监控（电压/电流/温度/风扇），常见与 PMIC/电源监测芯片配合。  

**设备树示例（示例传感器）**：
```dts
&i2c0 {
    ina219@40 {
        compatible = "ti,ina219";
        reg = <0x40>;
    };
};
```

**用户空间**：
```bash
ls /sys/class/hwmon/
sensors
cat /sys/class/hwmon/hwmon0/name
cat /sys/class/hwmon/hwmon0/in1_input
```

---

### 17. Regulator 子系统
**用途**：电源轨（LDO/BUCK）控制与状态管理，供电依赖建模。  

**设备树示例（固定电源/可控电源）**：
```dts
vcc_3v3: regulator-3v3 {
    compatible = "regulator-fixed";
    regulator-name = "vcc_3v3";
    regulator-min-microvolt = <3300000>;
    regulator-max-microvolt = <3300000>;
    gpio = <&gpio0 12 GPIO_ACTIVE_HIGH>; /* 通过 GPIO 控制使能（如有） */
    enable-active-high;
};

&some_device {
    vcc-supply = <&vcc_3v3>;
};
```

**用户空间**：
```bash
ls /sys/class/regulator/
cat /sys/class/regulator/regulator.*/name
cat /sys/class/regulator/regulator.*/microvolts
```

---

### 18. Clock 子系统
**用途**：统一管理时钟树（PLL/分频/门控），为外设提供时钟。  

**设备树示例（时钟引用）**：
```dts
&uart1 {
    clocks = <&clkc 23>;            /* 具体索引因平台而异 */
    clock-names = "uart_clk";
    status = "okay";
};
```

**用户空间**（调试接口，多在 debugfs）：
```bash
mount -t debugfs none /sys/kernel/debug
ls /sys/kernel/debug/clk/
cat /sys/kernel/debug/clk/clk_summary
```

---

### 19. DMAengine 子系统
**用途**：通用 DMA 控制器抽象，作为 IIO/ALSA/V4L2 等上层的后端搬运数据（AXI DMA、CDMA）。  

**设备树示例（AXI DMA）**：
```dts
axi_dma_0: dma@40400000 {
    compatible = "xlnx,axi-dma-1.00.a";
    reg = <0x40400000 0x10000>;
    dma-channels = <2>;                /* MM2S + S2MM */
    #dma-cells = <1>;
    xlnx,include-sg = <1>;             /* 支持 SG 模式 */
    interrupt-parent = <&intc>;
    interrupts = <0 61 4>, <0 62 4>;   /* 依具体连接而定 */
};
```

**用户空间**：作为后台组件通常无直接 `/dev` 接口。结合上层子系统使用：  
```bash
# 例如 IIO 采样通过 DMA 到内存，再 iio_readdev 抓取
iio_readdev iio:device0 > dump.bin
```

---

### 20. MFD 子系统
**用途**：多功能芯片（PMIC、Codec+GPIO+Regulator 等），把一颗 IC 拆成多个子设备（子系统分别接管）。  

**设备树示例（PMIC 作为 MFD，内含 regulator/rtc/gpio 等）**：
```dts
&i2c0 {
    pmic@34 {
        compatible = "maxim,max77620";
        reg = <0x34>;
        regulators {
            buck1: buck1 {
                regulator-name = "vdd_cpu";
                regulator-min-microvolt = <800000>;
                regulator-max-microvolt = <1100000>;
            };
            /* 其他 LDO/BUCK ... */
        };
        /* 若带 RTC/GPIO，会在此节点下继续派生子节点 */
    };
};
```

**用户空间**：MFD 本身没有独立接口，拆分后的子设备走各自子系统（如 `/sys/class/regulator/`、`/dev/rtc*`、`/sys/class/gpio/`）。



### 21. Input 子系统
**用途**：统一管理输入设备（按键、触摸屏、旋钮等），提供事件接口。  

**设备树示例（GPIO 按键）**：
```dts
gpio_keys {
    compatible = "gpio-keys";
    button@0 {
        label = "btn0";
        gpios = <&gpio0 20 GPIO_ACTIVE_LOW>;
        linux,code = <KEY_ENTER>;
    };
};
```

**用户空间**：
```bash
ls /dev/input/event*
evtest /dev/input/event0
```

---

### 22. RTC 子系统
**用途**：实时时钟，管理系统时间与掉电保持时间。  

**设备树示例（DS3231）**：
```dts
&i2c0 {
    rtc@68 {
        compatible = "maxim,ds3231";
        reg = <0x68>;
    };
};
```

**用户空间**：
```bash
ls /dev/rtc*
hwclock -r
hwclock -w
```

---

### 23. Power Supply 子系统
**用途**：电池、电源、充电器状态管理。  

**设备树示例**：
```dts
battery: battery {
    compatible = "simple-battery";
    voltage-min-design-microvolt = <3300000>;
    voltage-max-design-microvolt = <4200000>;
};
```

**用户空间**：
```bash
ls /sys/class/power_supply/
cat /sys/class/power_supply/BAT0/status
```

---

### 24. Regmap 框架
**用途**：简化寄存器映射，常用于 I²C/SPI 外设驱动内部，不直接暴露给用户。  

**设备树示例**：无特定节点，驱动内部使用。  

**用户空间**：无直接接口，功能嵌入在其他驱动中。  

---

### 25. RFkill 子系统
**用途**：无线设备开关控制（WiFi、蓝牙）。  

**设备树示例**：  
通常不单独定义，由 WiFi/BT 芯片驱动注册。  

**用户空间**：
```bash
rfkill list
rfkill block wifi
rfkill unblock wifi
```

---

### 26. Remoteproc 子系统
**用途**：管理协处理器的启动/停止/固件加载。  

**设备树示例（ZynqMP RPU）**：
```dts
r5@0 {
    compatible = "xlnx,zynqmp-r5-remoteproc";
    reg = <0x0 0x0>;  /* 示例 */
    firmware-name = "r5-firmware.elf";
};
```

**用户空间**：
```bash
ls /sys/class/remoteproc/
echo start > /sys/class/remoteproc/remoteproc0/state
```

---

### 27. RPMsg 子系统
**用途**：基于 virtio 的处理器间通信（PS ↔ PL/RPU）。  

**设备树示例**：挂在 remoteproc 下自动生成。  

**用户空间**：
```bash
ls /dev/rpmsg*
echo hello > /dev/rpmsg0
cat /dev/rpmsg0
```

---

### 28. Crypto 子系统
**用途**：统一管理硬件/软件加解密引擎。  

**设备树示例（Zynq AES 引擎）**：
```dts
aes: aes@f800d000 {
    compatible = "xlnx,zynq-aes";
    reg = <0xf800d000 0x1000>;
};
```

**用户空间**：
```bash
ls /dev/crypto
openssl speed -engine cryptodev aes-128-cbc
```

---

### 29. CAN 子系统
**用途**：工业总线 CAN 通信。  

**设备树示例（PL CAN 控制器）**：
```dts
can0: can@e0008000 {
    compatible = "xlnx,zynq-can-1.0";
    reg = <0xe0008000 0x1000>;
    interrupts = <0 28 4>;
    status = "okay";
};
```

**用户空间**：
```bash
ip link set can0 up type can bitrate 500000
candump can0
cansend can0 123#deadbeef
```

---

### 30. SPI-NOR 子系统
**用途**：专门管理 SPI NOR Flash（常用于 Boot）。  

**设备树示例**：
```dts
&spi0 {
    flash@0 {
        compatible = "jedec,spi-nor";
        reg = <0>;
        spi-max-frequency = <50000000>;
    };
};
```

**用户空间**：
```bash
cat /proc/mtd
flash_erase /dev/mtd0 0 0
```

---

### 31. PHY 子系统
**用途**：统一抽象 USB/Ethernet/SerDes PHY 层。  

**设备树示例（USB ULPI PHY）**：
```dts
usb_phy0: phy@0 {
    compatible = "usb-nop-xceiv";
    #phy-cells = <0>;
};
```

**用户空间**：无直接接口，由 USB/Ethernet 子系统使用。  

---

### 32. SerDes 子系统
**用途**：高速串行收发器配置与管理。  

**设备树示例（ZynqMP GTY）**：  
厂商专用节点，一般不直接手写。  

**用户空间**：多通过 PCIe/DisplayPort 驱动间接使用。  

---

### 33. PCI/PCIe 子系统
**用途**：高速外设总线（Root Complex / Endpoint）。  

**设备树示例（Zynq PCIe）**：
```dts
pcie0: pcie@50000000 {
    compatible = "xlnx,axi-pcie-host-1.00.a";
    reg = <0x50000000 0x100000>;
    bus-range = <0x00 0xff>;
};
```

**用户空间**：
```bash
lspci
setpci -s 00:00.0
```

---

### 34. SDIO 子系统
**用途**：SD 卡接口扩展出的 IO 设备（WiFi、BT）。  

**设备树示例**：
```dts
&sdhci1 {
    status = "okay";
    #address-cells = <1>;
    #size-cells = <0>;
    wlcore: wlcore@2 {
        reg = <2>;  /* SDIO function 2 */
        compatible = "ti,wl1271";
    };
};
```

**用户空间**：设备会以 netdev/tty 等形式出现。  

---

### 35. NVMEM 子系统
**用途**：抽象小型非易失存储（eFuse、OTP、EEPROM）。  

**设备树示例（eFuse）**：
```dts
nvmem0: efuse@f800d000 {
    compatible = "xlnx,zynq-efuse";
    reg = <0xf800d000 0x1000>;
};
```

**用户空间**：
```bash
hexdump -C /sys/bus/nvmem/devices/nvmem0/nvmem
```

---

### 36. Industrial Fieldbus
**用途**：工业现场总线协议（EtherCAT、Profinet、CANopen）。  

**设备树示例**：依具体 IP 芯片定义，通常非主线。  

**用户空间**：由专用工具/驱动提供接口，例如 `ethercat` 命令。  

---

### 37. VirtIO 子系统
**用途**：虚拟化 I/O 框架（QEMU/KVM 下常用）。  

**设备树示例**：虚拟机场景下由 QEMU 注入，无需手写。  

**用户空间**：
```bash
ls /dev/vhost-*
```

---

### 38. Mailbox 子系统
**用途**：处理器间消息/信号通道（PS ↔ PL）。  

**设备树示例**：
```dts
mailbox0: mailbox@f8007000 {
    compatible = "xlnx,zynq-mailbox";
    reg = <0xf8007000 0x1000>;
    #mbox-cells = <1>;
};
```

**用户空间**：
```bash
ls /sys/class/mailbox/
```

---

### 39. FPGA Manager 子系统
**用途**：在 Linux 下动态配置/重配置 FPGA bitstream。  

**设备树示例**：
```dts
fpga_mgr0: fpga-manager {
    compatible = "xlnx,fpga-mgr";
    /* bitstream 加载相关配置 */
};
```

**用户空间**：
```bash
ls /sys/class/fpga_manager/
echo bitstream.bit > /sys/class/fpga_manager/fpga0/firmware
```

---

### 40. ConfigFS 子系统
**用途**：配置文件系统，用于动态配置内核功能（USB Gadget、密钥管理等）。  

**设备树示例**：不需要。  

**用户空间**：
```bash
mount -t configfs none /sys/kernel/config
ls /sys/kernel/config/usb_gadget/
```


### 41. Block（块层）
**用途**：统一抽象块设备（磁盘/SSD/SD），供文件系统使用。  
**设备树示例**：块层无专用 DT，依控制器（MMC、SATA、NVMe 等）生成块设备。  
**用户空间**：
```bash
lsblk
fdisk -l
```

---

### 42. Ext4
**用途**：主流通用文件系统。  
**设备树示例**：无（文件系统与 DT 无关）。  
**用户空间**：
```bash
mkfs.ext4 /dev/mmcblk0p2
mount -t ext4 /dev/mmcblk0p2 /mnt
```

---

### 43. XFS
**用途**：高性能日志文件系统，适合大文件/并发。  
**设备树示例**：无。  
**用户空间**：
```bash
mkfs.xfs /dev/sda1
mount -t xfs /dev/sda1 /mnt
```

---

### 44. Btrfs
**用途**：支持快照/子卷/校验的新一代文件系统。  
**设备树示例**：无。  
**用户空间**：
```bash
mkfs.btrfs /dev/sda1
btrfs subvolume create /mnt/@root
```

---

### 45. F2FS
**用途**：为 NAND/eMMC/SD 优化的闪存友好文件系统。  
**设备树示例**：无。  
**用户空间**：
```bash
mkfs.f2fs /dev/mmcblk0p3
mount -t f2fs /dev/mmcblk0p3 /data
```

---

### 46. NFS
**用途**：网络文件系统（客户端/服务器）。  
**设备树示例**：无。  
**用户空间**：
```bash
mount -t nfs 192.168.1.10:/export/rootfs /mnt -o vers=3
```

---

### 47. CIFS/SMB
**用途**：Windows/SMB 共享。  
**设备树示例**：无。  
**用户空间**：
```bash
mount -t cifs //192.168.1.20/share /mnt -o username=user,password=pass
```

---

### 48. FUSE
**用途**：用户态文件系统框架（如 sshfs）。  
**设备树示例**：无。  
**用户空间**：
```bash
sshfs user@host:/ /mnt
```

---

### 49. Tmpfs
**用途**：内存文件系统（/dev/shm 等）。  
**设备树示例**：无。  
**用户空间**：
```bash
mount -t tmpfs tmpfs /mnt -o size=256M
```

---

### 50. OverlayFS
**用途**：联合挂载（容器分层、只读根叠加可写层）。  
**设备树示例**：无。  
**用户空间**：
```bash
mount -t overlay overlay -o lowerdir=/ro,upperdir=/rw/upper,workdir=/rw/work /mnt
```

---

### 51. SquashFS
**用途**：高压缩只读文件系统（固件常用）。  
**设备树示例**：无。  
**用户空间**：
```bash
mount -t squashfs /path/rootfs.sqsh /mnt -o loop
```

---

### 52. JFFS2
**用途**：基于 MTD 的日志型 FS（NOR/NAND）。  
**设备树示例**：见 MTD 分区；FS 无专用 DT。  
**用户空间**：
```bash
mount -t jffs2 /dev/mtdblock4 /mnt
```

---

### 53. UBIFS
**用途**：基于 UBI 的 NAND 文件系统。  
**设备树示例**：在 MTD/UBI 上层使用。  
**用户空间**：
```bash
ubiattach /dev/ubi_ctrl -m 4
mount -t ubifs ubi0:rootfs /mnt
```

---

### 54. ZFS
**用途**：高可靠存储（校验/快照/压缩）。  
**设备树示例**：无。  
**用户空间**：
```bash
zpool create tank /dev/sdb
zfs create tank/data
```

---

### 55. DRM/KMS（显示）
**用途**：现代显示栈（模式设置、缓冲管理）。  
**设备树示例**：
```dts
display@fd4a0000 {
    compatible = "xlnx,zynqmp-dpsub";
    reg = <0x0 0xfd4a0000 0x0 0x1000>;
    status = "okay";
};
```
**用户空间**：
```bash
ls /dev/dri/
modetest -M xlnx -c
```

---

### 56. HDMI CEC
**用途**：HDMI 遥控协议控制。  
**设备树示例**：
```dts
cec@0 {
    compatible = "dw-hdmi-cec";
    status = "okay";
};
```
**用户空间**：
```bash
cec-ctl --list-devices
cec-ctl --osd-name Zynq
```

---

### 57. DisplayPort
**用途**：DP 显示输出（常与 DRM 结合）。  
**设备树示例**：
```dts
dp@fd4a0000 {
    compatible = "xlnx,zynqmp-dp";
    status = "okay";
};
```
**用户空间**：通过 DRM/KMS 使用（`/dev/dri/*`）。

---

### 58. Backlight（背光）
**用途**：LCD 背光亮度控制。  
**设备树示例**：
```dts
backlight: backlight {
    compatible = "pwm-backlight";
    pwms = <&pwm0 0 20000 0>;
    brightness-levels = <0 32 64 128 255>;
    default-brightness-level = <3>;
};
```
**用户空间**：
```bash
echo 200 > /sys/class/backlight/*/brightness
```

---

### 59. Framebuffer（fbdev）
**用途**：传统帧缓冲接口（逐步被 DRM 取代）。  
**设备树示例**：由显示控制器/面板驱动提供；无专用条目。  
**用户空间**：
```bash
ls /dev/fb0
fbset -i
```

---

### 60. GPU Accel（GPU 计算）
**用途**：GPU/图形加速（OpenGL ES/Vulkan/OpenCL）。  
**设备树示例**：GPU 节点依厂商；ZynqMP 为 `arm,mali-*` 等。  
**用户空间**：
```bash
glxinfo -B    # 或 eglinfo / clinfo
```

---

### 61. Bluetooth
**用途**：蓝牙通信（蓝牙栈/控制器）。  
**设备树示例**：UART/SDIO/USB 枚举，无通用 DT。  
**用户空间**：
```bash
bluetoothctl
scan on
pair XX:XX:XX:XX:XX:XX
```

---

### 62. IEEE 802.15.4
**用途**：ZigBee/Thread 等低功耗无线基础。  
**设备树示例**：
```dts
&i2c0 {
    at86rf@4a { compatible = "atmel,at86rf230"; reg = <0x4a>; };
};
```
**用户空间**：
```bash
iwpan phy
iwpan dev add wpan0 type node
```

---

### 63. LoRaWAN
**用途**：远距离低速率物联网通信。  
**设备树示例**：
```dts
&spi0 {
    sx1276@0 { compatible = "semtech,sx1276"; reg = <0>; };
};
```
**用户空间**：通过 lora 栈/daemon，或专用工具（因发行版而异）。

---

### 64. mac80211（WiFi 子系统）
**用途**：WiFi 软 MAC 协议栈。  
**设备树示例**：由 SDIO/PCIe/USB WiFi 芯片驱动注册。  
**用户空间**：
```bash
iw dev
iw dev wlan0 link
```

---

### 65. cfg80211
**用途**：WiFi 配置 API（与 mac80211 配合）。  
**设备树示例**：同上。  
**用户空间**：
```bash
iw list
```

---

### 66. NFC
**用途**：近场通信（读卡器/卡模拟）。  
**设备树示例**：
```dts
&i2c0 {
    pn7150@28 { compatible = "nxp,pn7150"; reg = <0x28>; };
};
```
**用户空间**：
```bash
nfc-list
nfc-poll
```

---

### 67. IR Remote（红外）
**用途**：红外接收/发射，遥控器输入。  
**设备树示例**：
```dts
ir@0 {
    compatible = "gpio-ir-receiver";
    gpios = <&gpio0 25 GPIO_ACTIVE_LOW>;
};
```
**用户空间**：
```bash
ir-keytable -t
```

---

### 68. SoundWire
**用途**：新型音频总线（低功耗/多地址）。  
**设备树示例**：依 SoC/Codec；Zynq 上少见。  
**用户空间**：通过 ALSA 设备呈现（`/proc/asound/cards`）。

---

### 69. HD-Audio
**用途**：HDA 控制器（PC/某些 SoC）。  
**设备树示例**：ACPI 场景为主；Zynq 少见。  
**用户空间**：
```bash
aplay -l
alsamixer
```

---

### 70. SOF（Sound Open Firmware）
**用途**：可编程音频 DSP 固件框架。  
**设备树示例**：ACPI/PCI 平台为主；Zynq 罕见。  
**用户空间**：
```bash
sof-ctl -l
```

---

### 71. SCSI
**用途**：通用存储协议（SATA/SAS/USB Mass 底层）。  
**设备树示例**：由控制器（SATA、USB）生成。  
**用户空间**：
```bash
lsscsi
sg_inq /dev/sda
```

---

### 72. SATA/AHCI
**用途**：SATA 硬盘接口。  
**设备树示例**：
```dts
sata@fd0c0000 {
    compatible = "generic-ahci";
    reg = <0x0 0xfd0c0000 0x0 0x1000>;
    status = "okay";
};
```
**用户空间**：
```bash
ls /dev/sd*
hdparm -I /dev/sda
```

---

### 73. NVMe
**用途**：PCIe SSD 协议。  
**设备树示例**：通过 PCIe 总线枚举。  
**用户空间**：
```bash
ls /dev/nvme*
nvme list
```

---

### 74. VirtIO Block
**用途**：虚拟块设备（QEMU/KVM）。  
**设备树示例**：虚拟机注入（无需手写）。  
**用户空间**：
```bash
lsblk
```

---

### 75. VirtIO Net
**用途**：虚拟网卡。  
**设备树示例**：虚拟机注入。  
**用户空间**：
```bash
ip link show
```

---

### 76. vDPA
**用途**：为 VirtIO 提供数据面加速（DPDK/KVM）。  
**设备树示例**：多为 PCIe/平台设备，依厂商。  
**用户空间**：
```bash
ls /dev/vhost-vdpa*
```

---

### 77. KVM
**用途**：内核虚拟机（硬件虚拟化）。  
**设备树示例**：无。  
**用户空间**：
```bash
ls /dev/kvm
qemu-system-aarch64 -accel kvm ...
```

---

### 78. vhost
**用途**：在内核中加速 virtio 数据通道。  
**设备树示例**：无。  
**用户空间**：
```bash
ls /dev/vhost-*
```

---

### 79. TPM
**用途**：可信平台模块（安全/密钥/测量）。  
**设备树示例**：
```dts
&i2c0 {
    tpm@29 { compatible = "atmel,at97sc3204"; reg = <0x29>; };
};
```
**用户空间**：
```bash
ls /dev/tpm*
tpm2_getrandom 16
```

---

### 80. IMA/EVM
**用途**：完整性度量与扩展验证（文件签名/度量）。  
**设备树示例**：无。  
**用户空间**：
```bash
cat /sys/kernel/security/ima/ascii_runtime_measurements
```

---

### 81. SELinux
**用途**：强制访问控制（MAC）。  
**设备树示例**：无。  
**用户空间**：
```bash
getenforce
setenforce 0
```

---

### 82. AppArmor
**用途**：基于配置档的进程隔离。  
**设备树示例**：无。  
**用户空间**：
```bash
aa-status
aa-enforce /etc/apparmor.d/usr.bin.foo
```

---

### 83. Smack
**用途**：简化版 MAC 安全框架。  
**设备树示例**：无。  
**用户空间**：配置/标签工具依据发行版。

---

### 84. eBPF
**用途**：在内核中安全运行小程序（网络/观测/安全）。  
**设备树示例**：无。  
**用户空间**：
```bash
bpftool prog show
```

---

### 85. Perf
**用途**：性能事件与采样分析。  
**设备树示例**：无。  
**用户空间**：
```bash
perf stat -a sleep 1
perf record -g ./app
perf report
```

---

### 86. Ftrace
**用途**：内核函数级追踪。  
**设备树示例**：无。  
**用户空间**：
```bash
mount -t debugfs none /sys/kernel/debug
cd /sys/kernel/debug/tracing
echo function > current_tracer
```

---

### 87. KGDB
**用途**：内核级 GDB 调试。  
**设备树示例**：无。  
**用户空间**：通过串口/netpoll 连接 gdbstub 调试。

---

### 88. OProfile
**用途**：旧版系统级性能采样器。  
**设备树示例**：无。  
**用户空间**：
```bash
opcontrol --start
```

---

### 89. SysRq
**用途**：内核紧急控制接口。  
**设备树示例**：无。  
**用户空间**：
```bash
echo b > /proc/sysrq-trigger   # 立刻重启
```

---

### 90. Uevent（Hotplug）
**用途**：设备热插拔事件，udev 处理。  
**设备树示例**：无。  
**用户空间**：
```bash
udevadm monitor
```

---

### 91. DeviceTree（DT）
**用途**：硬件描述（.dts → .dtb）。  
**设备树示例**：DT 本身即示例。  
**用户空间**：
```bash
fdtdump /boot/devicetree.dtb
```

---

### 92. ACPI
**用途**：电源/硬件描述（x86/服务器）。  
**设备树示例**：无（与 DT 互斥）。  
**用户空间**：
```bash
dmesg | grep ACPI
```

---

### 93. PM QoS
**用途**：电源管理服务质量（时延/带宽约束）。  
**设备树示例**：无。  
**用户空间**：
```bash
cat /dev/cpu_dma_latency
```

---

### 94. Cpufreq
**用途**：CPU 动态调频。  
**设备树示例**：CPU/OPP 表：
```dts
cpu0_opp_table: opp-table {
    compatible = "operating-points-v2";
    opp-600000000 { opp-hz = /bits/ 64 <600000000>; };
    opp-1200000000 { opp-hz = /bits/ 64 <1200000000>; };
};
&cpu0 { operating-points-v2 = <&cpu0_opp_table>; };
```
**用户空间**：
```bash
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq
```

---

### 95. Cpuidle
**用途**：CPU 空闲状态管理（C-states）。  
**设备树示例**：常由平台提供，无通用示例。  
**用户空间**：
```bash
cat /sys/devices/system/cpu/cpuidle/*/name
```

---

### 96. Suspend/Resume
**用途**：系统挂起/恢复（待机省电）。  
**设备树示例**：无。  
**用户空间**：
```bash
echo mem > /sys/power/state
```

---

### 97. Thermal Cooling（冷却设备）
**用途**：与 Thermal 框架联动的散热执行器（风扇/PWM/限频）。  
**设备树示例**：
```dts
cooling_fan: pwm-fan {
    compatible = "pwm-fan";
    pwms = <&pwm0 0 50000 0>;
    #cooling-cells = <2>;
};
```
**用户空间**：
```bash
ls /sys/class/thermal/cooling_device*
```

---

### 98. LED Triggers
**用途**：事件驱动 LED（心跳/磁盘 IO/网络）。  
**设备树示例**：在 LED 节点设置默认触发器：
```dts
linux,default-trigger = "heartbeat";
```
**用户空间**：
```bash
cat /sys/class/leds/led0/trigger
echo netdev > /sys/class/leds/led0/trigger
```

---

### 99. Notifier Chains
**用途**：内核事件通知机制（驱动/子系统间解耦）。  
**设备树示例**：无。  
**用户空间**：无直接接口（驱动内部使用）。

---

### 100. SysFS
**用途**：内核对象模型的虚拟文件系统（配置/状态暴露）。  
**设备树示例**：无。  
**用户空间**：
```bash
ls /sys/
```



