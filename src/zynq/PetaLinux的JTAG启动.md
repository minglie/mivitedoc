 [csdn--PetaLinux 使用技巧与缓存配置](https://blog.csdn.net/qq_26074053/article/details/149570790)

[xilinx官网--PetaLinux 工具文档参考指南 (ug1144)](https://docs.amd.com/v/u/zh-CN/ug1144-petalinux-tools-reference-guide)

[xilinx官网--设备树配置文档](https://xilinx-wiki.atlassian.net/wiki/spaces/A/pages/18842398/Linux+GPIO+Driver#Zynq)

[内核官网--设备树文档](https://web.git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/Documentation/devicetree/bindings/leds/common.yaml)

# 常用路径 
```bash
# 设备树
/home/minglie/petalinux/antbase/project-spec/meta-user/recipes-bsp/device-tree/files/
```
# 软硬件准备

| 分类   | 项目              | 说明/用途                                  | 验证方法示例 |
|--------|-------------------|-------------------------------------------|--------------|
| 硬件   | JTAG 线           |  JTAG 下载、调试                       | — |
|        | UART 串口线       | 查看 zynq 启动日志   | — |
|        | 网口线            | 用于 TFTP 下载                 | — |
| 软件   | TFTP 服务器       | 用于下载各种启动文件   | `systemctl status tftpd-hpa` |
|        | Vivado (xsdb)     | 使用 `xsdb` 命令通过 JTAG 下载 ELF/bit     | `xsdb -version` |
|        | PetaLinux         | 构建和打包 Linux 镜像                      | `petalinux-create -h` |
|        | mkimage 工具      | 制作 `boot.scr` 文件，安装命令：`sudo apt install u-boot-tools`     | `mkimage -V` |

# ubuntu环境变量  ~/.bashrc
```bash
alias sptl='source /opt/pkg/petalinux/2020.2/settings.sh'
alias svivado='source /opt/pkg/tools/Xilinx/Vivado/2020.2/settings64.sh'
alias svitis='source /opt/pkg/tools/Xilinx/Vitis/2020.2/settings64.sh'
alias ssdk='source  /opt/petalinux/2020.2/environment-setup-cortexa9t2hf-neon-xilinx-linux-gnueabi'
alias sclion='/opt/soft/clion-2023.3.4/bin/clion.sh'
```

# vivado导出xsa文件给petalinux工程用
```shell
 scp system_wrapper.xsa minglie@192.168.1.104:~/petalinux/xsa_7010/
```
# 启动相关文件
| 文件名                   | 作用说明                                                                 | 生成方式 |
|---------------------------|--------------------------------------------------------------------------|----------|
| **system.bit**            | FPGA 配置比特流文件，配置 PL 逻辑电路（JTAG/FSBL 下载到 FPGA）。         | petalinux-build |
| **zynq_fsbl.elf**         | FSBL（First Stage Boot Loader），初始化 PS/PL，加载 bitstream 和 U-Boot。| petalinux-build |
| **uboot.elf**             | 二级引导程序 U-Boot，可通过 SD/TFTP/Flash 加载内核和设备树。             | petalinux-build |
| **uImage/zImage**                | Linux 内核镜像                                             | petalinux-build |
| **rootfs.cpio.gz.u-boot** | 根文件系统（cpio+gzip 格式，适用于 initramfs）。                          | petalinux-build |
| **system.dtb**            | 设备树文件（Device Tree Blob），描述硬件结构，供内核识别外设。            | petalinux-build |
| **boot.cmd.default**     | `boot.scr` 的源码                           | 手写 |
| **boot.scr**              | U-Boot 脚本文件（由 mkimage 生成），定义启动参数和加载流程。              | `mkimage -c none -A arm -T script -d boot.cmd.default boot.scr` |
| **text.txt (xsdb 脚本)**  | XSDB 命令脚本，定义通过 JTAG 下载 ELF/bitstream 的操作步骤。              |录制  `petalinux-boot --jtag --prebuilt 3 --tcl test.txt` |
| **BOOT.bin**  | zynq_fsbl.elf +u-boot.elf+(system.bit,image,system.dtb）  |`petalinux-package --boot --fsbl --fpga --u-boot --force` |

### PetaLinux `--prebuilt` 等级对比表

| 预设等级 | 加载 Bitstream | 加载 FSBL | 加载 U-Boot | 加载 Linux（内核 + rootfs） | 适用场景 |
|----------|----------------|-----------|-------------|------------------------------|----------|
| `--prebuilt 1` | ✅ 是 | ❌ 否 | ❌ 否 | ❌ 否 | 只配置 PL（FPGA 逻辑），测试 FPGA |
| `--prebuilt 2` | ✅ 是 | ✅ 是 | ✅ 是 | ❌ 否 | 启动 U-Boot，进行手动加载或调试 |
| `--prebuilt 3` | ✅ 是 | ✅ 是 | ✅ 是 | ✅ 是 | 一键启动 Linux 系统（推荐测试用） |



# 操作步骤

## 使用 petalinux-boot 制作预建镜像
就是把 images/linux 里的文件复制到pre-built目录下,用于录制
xsdb 脚本,  后续我们从 images/linux/ 目录下载文件, 所以只制作一次
```bash
petalinux-package --prebuilt --fpga images/linux/system.bit
或
petalinux-package --prebuilt --force
```
## 录制 xsdb 脚本
执行前需重新上电，若不加 --tcl test.txt 则是jtag启动
```bash
petalinux-boot --jtag --prebuilt 3 --tcl test.txt
```
## 录制的text.txt
删除下载uImage和rootfs.cpio.gz.u-boot的部分,因为 boot.scr 通过tftp下载了 
替换 /home/minglie/petalinux/antbase/pre-built/linux/images/  为  /home/minglie/petalinux/antbase/images/linux/
这样重新build后，直接用 images/linux/里的文件
```sh
connect
puts stderr "INFO: Configuring the FPGA..."
puts stderr "INFO: Downloading bitstream: /home/minglie/petalinux/antbase/pre-built/linux/images/system.bit to the target."
fpga "/home/minglie/petalinux/antbase/pre-built/linux/images/system.bit"
after 2000
targets -set -nocase -filter {name =~ "arm*#0"}

source /home/minglie/petalinux/antbase/project-spec/hw-description/ps7_init.tcl; ps7_post_config
catch {stop}
set mctrlval [string trim [lindex [split [mrd 0xF8007080] :] 1]]
puts "mctrlval=$mctrlval"
puts stderr "INFO: Downloading ELF file: /home/minglie/petalinux/antbase/pre-built/linux/images/zynq_fsbl.elf to the target."
dow  "/home/minglie/petalinux/antbase/pre-built/linux/images/zynq_fsbl.elf"
after 2000
con
after 3000; stop
targets -set -nocase -filter {name =~ "arm*#0"}
puts stderr "INFO: Downloading ELF file: /home/minglie/petalinux/antbase/pre-built/linux/images/u-boot.elf to the target."
dow  "/home/minglie/petalinux/antbase/pre-built/linux/images/u-boot.elf"
after 2000
con; after 1000; stop
targets -set -nocase -filter {name =~ "arm*#0"}
puts stderr "INFO: Loading image: /home/minglie/petalinux/antbase/pre-built/linux/images/system.dtb at 0x00100000"
dow -data  "/home/minglie/petalinux/antbase/pre-built/linux/images/system.dtb" 0x00100000
after 2000
targets -set -nocase -filter {name =~ "arm*#0"}
puts stderr "INFO: Loading image: /home/minglie/petalinux/antbase/pre-built/linux/images/uImage at 0x00200000"
dow -data  "/home/minglie/petalinux/antbase/pre-built/linux/images/uImage" 0x00200000
after 2000
targets -set -nocase -filter {name =~ "arm*#0"}
puts stderr "INFO: Loading image: /home/minglie/petalinux/antbase/pre-built/linux/images/rootfs.cpio.gz.u-boot at 0x04000000"
dow -data  "/home/minglie/petalinux/antbase/pre-built/linux/images/rootfs.cpio.gz.u-boot" 0x04000000
after 2000
targets -set -nocase -filter {name =~ "arm*#0"}
puts stderr "INFO: Loading image: /home/minglie/petalinux/antbase/pre-built/linux/images/boot.scr at 0x03000000"
dow -data  "/home/minglie/petalinux/antbase/pre-built/linux/images/boot.scr" 0x03000000
after 2000
con
exit
puts stderr "INFO: Saving XSDB commands to test.txt. You can run 'xsdb test.txt' to execute"
```
## 修改后的text.txt
```sh
connect
puts stderr "INFO: Configuring the FPGA..."
puts stderr "INFO: Downloading bitstream: /home/minglie/petalinux/antbase/images/linux/system.bit to the target."
fpga "/home/minglie/petalinux/antbase/images/linux/system.bit"
after 2000
targets -set -nocase -filter {name =~ "arm*#0"}

source /home/minglie/petalinux/antbase/project-spec/hw-description/ps7_init.tcl; ps7_post_config
catch {stop}
set mctrlval [string trim [lindex [split [mrd 0xF8007080] :] 1]]
puts "mctrlval=$mctrlval"
puts stderr "INFO: Downloading ELF file: /home/minglie/petalinux/antbase/images/linux/zynq_fsbl.elf to the target."
dow  "/home/minglie/petalinux/antbase/images/linux/zynq_fsbl.elf"
after 2000
con
after 3000; stop
targets -set -nocase -filter {name =~ "arm*#0"}
puts stderr "INFO: Downloading ELF file: /home/minglie/petalinux/antbase/images/linux/u-boot.elf to the target."
dow  "/home/minglie/petalinux/antbase/images/linux/u-boot.elf"
after 2000


con; after 1000; stop
targets -set -nocase -filter {name =~ "arm*#0"}
puts stderr "INFO: Loading image: /home/minglie/petalinux/antbase/images/linux/system.dtb at 0x00100000"
dow -data  "/home/minglie/petalinux/antbase/images/linux/system.dtb" 0x00100000
after 2000


targets -set -nocase -filter {name =~ "arm*#0"}
puts stderr "INFO: Loading image: /home/minglie/petalinux/antbase/boot.scr at 0x03000000"
dow -data  "/home/minglie/petalinux/antbase/boot.scr" 0x03000000
after 2000
con
exit
puts stderr "INFO: Saving XSDB commands to test.txt. You can run 'xsdb test.txt' to execute"
```

## 生成自定义的boot.scr
加个echo "AAA" 确认这个boot.scr 是生效的
##  boot.cmd.default
 ```bash
echo "AAA"
setenv ipaddr   192.168.1.89
setenv serverip 192.168.1.104
pxe get
pxe boot
 ```

## 生成并拷贝boot.scr
```bash
mkimage -c none -A arm -T script -d boot.cmd.default boot.scr
cp boot.scr  /home/minglie/petalinux/antbase/boot.scr
```
##  xsdb执行脚本启动
```bash
 xsdb  /home/minglie/petalinux/antbase/test.txt
```

---
***jtag 启动结束***

---
# qemu启动
## 启动 /images/linux/ 里的内核
```shell
petalinux-boot --qemu --kernel
```
## 退出
```shell
先按下 Ctrl + A（按下后立即松开这两个键），然后单独按下 X（小写字母）
```
# u-boot 纯手动启动
```shell
>ZYNQ
tftpboot 0x00200000 zImage
tftpboot 0x00100000 system.dtb
# 加载bit文件
tftpboot 0x00800000 system.bit 
fpga load 0 0x00800000 $filesize
bootz 0x00200000 - 0x00100000
```

# u-boot 手动执行boot.scr 启动
```shell
# 或制作ming_boot.scr
mkimage -A arm -T script -C none -n "Zynq Boot Script" -d boot.cmd ming_boot.scr
>ZYNQ
tftpboot 0x3000000 ming_boot.scr
source 0x3000000
```

#  u-boot 挂在nfs根文件系统启动
```shell
setenv ipaddr 192.168.1.89  
setenv serverip 192.168.1.104 
setenv gatewayip 192.168.1.1
setenv netmask 255.255.255.0

setenv bootargs 'console=ttyPS0,115200 root=/dev/nfs rw nfsroot=192.168.1.104:/home/minglie/minglie/workspace/rootfs,nfsvers=3 ip=192.168.1.89:192.168.1.104:192.168.1.1:255.255.255.0::eth0:off'
saveenv
boot
```
# u-boot手动SD卡启动
### 不加载bitstream启动
```shell
mmc dev 0
fatload mmc 0:1 0x02000000 zImage
fatload mmc 0:1 0x00100000 system.dtb
setenv bootargs 'console=ttyPS0,115200 earlycon root=/dev/mmcblk0p2 rw rootwait'
bootz 0x02000000 - 0x00100000
```

### 加载bitstream启动
```shell
setenv loadaddr 0x00800000
mmc dev 0
fatload mmc 0:1 ${loadaddr} system.bit   
fpga loadb 0 ${loadaddr} ${filesize}      
fatload mmc 0:1 ${kernel_addr_r} zImage
fatload mmc 0:1 ${fdt_addr_r}    system.dtb
setenv bootargs 'console=ttyPS0,115200 earlycon root=/dev/mmcblk0p2 rw rootwait'
bootz ${kernel_addr_r} - ${fdt_addr_r}
```
# petalinux 常用脚本
```shell
# 创建工程
petalinux-create -t project --template zynq -n antbase
cd antbase
# 导入硬件配置
petalinux-config --get-hw-description  ../xsa_7020/
petalinux-config --get-hw-description  ../xsa_7010/
# 配置 Linux 内核
petalinux-config -c kernel
# 配置 Linux 根文件系统
petalinux-config -c rootfs
# 编译
petalinux-build
petalinux-build -c device-tree -x clean
petalinux-build -c device-tree
# 制作BOOT.bin 启动文件并复制到 SD 卡
petalinux-package --boot --fsbl --fpga --u-boot --force
petalinux-package --boot  --u-boot --fsbl  --dtb no  --force
cd images/linux
cp BOOT.BIN image.ub boot.scr    /media/minglie/BOOT
# 修改xsa文件后,清理项目生成的中间文件,小改不用执行
petalinux-build -x mrproper -f
# 编译设备树
petalinux-build -c device-tree -x clean
petalinux-build -c device-tree
```

## PetaLinux 清理命令

| 命令                           | 作用说明                                                                 | 典型执行时机 |
|--------------------------------|--------------------------------------------------------------------------|--------------|
| `petalinux-build -x clean`     | 删除临时文件和部分编译产物，保留配置文件和大部分构建结果，重新编译速度快。 | - 小范围修改（应用代码 / device tree / 配置等）出问题时尝试<br>- 编译失败怀疑是临时文件冲突时 |
| `petalinux-build -x mrproper -f` | 删除项目生成的**所有中间文件**，包括内核、根文件系统的缓存和临时文件，但保留配置。相当于彻底重建。 | - **修改 XSA 硬件文件**（新增/删除外设、更改地址映射）后必须执行<br>- BSP 结构发生变化<br>- 大规模修改导致编译异常时 |
| `petalinux-build -x distclean` | 删除几乎所有构建产物，项目回到初始状态，仅保留工程配置文件。              | - 工程出现严重问题需要“重置”时<br>- 想把工程打包分享给别人，但不想带构建产物时 |

### u-boot下载命令
```shell
# 从 TFTP 服务器上下载 PXE 配置文件（比如 pxelinux.cfg/default 或 pxelinux.cfg/<MAC>）
zynq>pxe get
# 在 pxe get 成功获取到 PXE 配置文件后，执行其中定义的启动流程：
## 下载内核镜像（zImage / uImage）
## 下载设备树（system.dtb）
## 下载 initrd（rootfs）
## 按配置的 bootargs 启动 Linux
zynq>pxe boot
```
# 在u-boot 里替换boot.scr
## 编译生成boot.scr
```
mkimage -c none -A arm -T script -d boot.cmd.default  boot.scr &&  cp  ./boot.scr  /tftpboot/
```
## 开发板从tftp下载boot.scr
```shell
setenv ipaddr 192.168.1.89        # 开发板 IP
setenv serverip 192.168.1.104     # TFTP 服务器 IP
mmc dev 0                         # 选择 SD 卡
mmc rescan                        # 扫描 SD 卡
tftpboot 0x10000000 boot.scr      # 从 TFTP 下载 boot.scr
fatwrite mmc 0:1 0x10000000 boot.scr ${filesize}  # 写入 SD 卡第1分区
fatls mmc 0:1                     # 验证写入
reset                             # 重启
```
# 替换bit文件
## 在系统里
```shell
scp .\system_wrapper.bit  root@ming.local:/media/sd-mmcblk1p1/system.bit
```
## 在u-boot里
```shell
# 拷贝到tftp服务器里
 scp .\system_wrapper.bit  minglie@192.168.1.104:/tftpboot/system.bit
```
##
```shell
setenv ipaddr 192.168.1.89        # 开发板 IP
setenv serverip 192.168.1.104     # TFTP 服务器 IP
mmc dev 0                         # 选择 SD 卡
mmc rescan                        # 扫描 SD 卡
tftpboot 0x10000000 system.bit      # 从 TFTP 下载 boot.scr
fatwrite mmc 0:1 0x10000000 system.bit ${filesize}  # 写入 SD 卡第1分区
fatls mmc 0:1                     # 验证写入
reset                             # 重启
```

# 问题
## 无法SD启动
 u-boot的环境变量boot_targets问题,造成根文件系统加载的不是SD卡里的,去掉开头重复的qspi 
```bash
Zynq> printenv boot_targets
boot_targets=qspi jtag mmc0 mmc1 qspi nand nor usb0 usb1 pxe dhcp
Zynq> setenv boot_targets "mmc0 mmc1 qspi nand nor usb0 usb1 pxe dhcp jtag"
Zynq> saveenv
Saving Environment to SPI Flash... SF: Detected w25q256 with page size 256 Bytes, erase size 4 KiB, total 32 MiB
Erasing SPI flash...Writing to SPI flash...done
OK
Zynq>

```
## 配置了但没有的东西 
ERROR: Nothing RPROVIDES 'myapp' (but /home/minglie/petalinux/antbase/components/yocto/layers/meta-petalinux/recipes-core/images/petalinux-image-minimal.bb RDEPENDS on or otherwise requires it)

```bash
# 删除 myapp 相关
minglie@minglie:~/petalinux/antbase$ grep -r "myapp" project-spec
project-spec/meta-user/conf/user-rootfsconfig:CONFIG_myapp
```

