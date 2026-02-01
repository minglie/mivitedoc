
# 🚀 PetaLinux 使用技巧与缓存配置

> **适用场景：**
> - Ubuntu 主机
> - Zynq 开发板  
> - 可选 Windows 辅助（用 RDP、CLion Remote 插件协作）  
> 本指南主要聚焦于 Ubuntu 与开发板端的高效协作与缓存配置和启动。

---

# 🧠 开发建议

  P1: 配置 PetaLinux 缓存，加速编译、防止因网络造成编译慢或失败

通过使用本地 `downloads` 与 `sstate` 缓存，避免 Yocto 网络下载导致失败。

P2: 三机连同一网络（Ubuntu / Windows / 开发板）

将 **三者连接到同一个路由器**，别在网络上浪费时间。

 P3: 使用 RDP + CLion 进行远程交叉编译

- Windows 中使用 [remote-file-systems 插件](https://plugins.jetbrains.com/plugin/21706-remote-file-systems) 访问 Ubuntu。
- 可直接在 CLion 中浏览与编辑 PetaLinux 工程目录结构。

 P4: 启动文件拆分管理

将启动文件拆开
```text
BOOT.BIN, system.dtb, zImage, system.bit, rootfs
```

# 📦 PetaLinux 缓存目录结构
```sh
$ ls /opt/mycache
downloads  sstate_arm_2020.2
```

🛠️ 缓存配置脚本 fix_complie.sh

脚本位置示例, z7是petalinux工程目录
```sh
$ cd ~/petalinux
$ ls
fix_complie.sh  xsa_7010  xsa_7020  z7
```
使用方式：
```sh
$ ./fix_complie.sh z7
已成功注释掉 CONFIG_YOCTO_NETWORK_SSTATE_FEEDS 配置项。
配置文件已成功更新。
BSP 配置文件中已存在 PREMIRRORS_prepend 内容。
BSP 配置文件已成功更新。
```

脚本内容如下：

##### fix_complie.sh
```bash
#!/bin/bash

# 配置文件路径
CONFIG_FILE="$1/project-spec/configs/config"
BSP_CONF_FILE="$1/project-spec/meta-user/conf/petalinuxbsp.conf"

# 新的配置值
NEW_PRE_MIRROR_URL='CONFIG_PRE_MIRROR_URL="file:///opt/mycache/downloads/"'
NEW_SSTATE_FEEDS_URL='CONFIG_YOCTO_LOCAL_SSTATE_FEEDS_URL="/opt/mycache/sstate_arm_2020.2/arm/  "'

# 新的 PREMIRRORS_prepend 内容
PREMIRRORS_CONTENT='PREMIRRORS_prepend = " \
git://.*/.* file:///opt/mycache/downloads/ \n\
gitsm://.*/.* file:///opt/mycache/downloads/ \n\
ftp://.*/.* file:///opt/mycache/downloads/ \n\
http://.*/.* file:///opt/mycache/downloads/ \n\
https://.*/.* file:///opt/mycache/downloads/ \n"
DL_DIR="/opt/mycache/downloads"
SSTATE_DIR="/opt/mycache/sstate_arm_2020.2/arm"

'

# 检查配置文件是否存在
if [ ! -f "$CONFIG_FILE" ]; then
    echo "配置文件 $CONFIG_FILE 不存在。"
    exit 1
fi


# 注释掉 CONFIG_YOCTO_NETWORK_SSTATE_FEEDS=y 这一行
if grep -q '^CONFIG_YOCTO_NETWORK_SSTATE_FEEDS=' "$CONFIG_FILE"; then
    sed -i '/^CONFIG_YOCTO_NETWORK_SSTATE_FEEDS=/ s/^/#/' "$CONFIG_FILE"
    echo "已成功注释掉 CONFIG_YOCTO_NETWORK_SSTATE_FEEDS 配置项。"
fi





# 替换或添加 CONFIG_PRE_MIRROR_URL
if grep -q '^CONFIG_PRE_MIRROR_URL=' "$CONFIG_FILE"; then
    # 如果存在，使用 sed 替换配置值
    sed -i 's|^CONFIG_PRE_MIRROR_URL=.*|'"$NEW_PRE_MIRROR_URL"'|' "$CONFIG_FILE"
else
    # 如果不存在，添加新的配置项
    echo "$NEW_PRE_MIRROR_URL" >> "$CONFIG_FILE"
fi

# 替换或添加 CONFIG_YOCTO_LOCAL_SSTATE_FEEDS_URL
if grep -q '^CONFIG_YOCTO_LOCAL_SSTATE_FEEDS_URL=' "$CONFIG_FILE"; then
    # 如果存在，使用 sed 替换配置值
    sed -i 's|^CONFIG_YOCTO_LOCAL_SSTATE_FEEDS_URL=.*|'"$NEW_SSTATE_FEEDS_URL"'|' "$CONFIG_FILE"
else
    # 如果不存在，添加新的配置项
    echo "$NEW_SSTATE_FEEDS_URL" >> "$CONFIG_FILE"
fi

# 确认替换或添加是否成功
if grep -q "$NEW_PRE_MIRROR_URL" "$CONFIG_FILE" && grep -q "$NEW_SSTATE_FEEDS_URL" "$CONFIG_FILE"; then
    echo "配置文件已成功更新。"
else
    echo "配置文件更新失败。"
    exit 1
fi

# 检查 BSP 配置文件是否存在
if [ ! -f "$BSP_CONF_FILE" ]; then
    echo "BSP 配置文件 $BSP_CONF_FILE 不存在。"
    exit 1
fi

# 添加 PREMIRRORS_prepend 内容到 BSP 配置文件
if ! grep -q '^PREMIRRORS_prepend' "$BSP_CONF_FILE"; then
    cat << EOF >> "$BSP_CONF_FILE"
$PREMIRRORS_CONTENT
EOF
    echo "已将 PREMIRRORS_prepend 内容添加到 BSP 配置文件。"
else
    echo "BSP 配置文件中已存在 PREMIRRORS_prepend 内容。"
fi

# 确认添加是否成功
if grep -q "^PREMIRRORS_prepend" "$BSP_CONF_FILE"; then
    echo "BSP 配置文件已成功更新。"
else
    echo "BSP 配置文件更新失败。"
    exit 1
fi
```

# 🔧 U-Boot 启动文件拆解技巧

通过编写 boot.cmd.default 来拆分启动项（使用 mkimage 工具生成 boot.scr）：
```sh
mkimage -c none -A arm -T script -d boot.cmd.default boot.scr
```

# 📄 启动脚本 boot.cmd.default 如下

##### boot.cmd.default
```bash

# mkimage -c none -A arm -T script -d boot.cmd.default boot.scr
#
################
ming_mmc_devnum=1

for boot_target in ${boot_targets};
do
	if test "${boot_target}" = "jtag" ; then
		bootm 0x00200000 0x04000000 0x00100000
		exit;
	fi
	if test "${boot_target}" = "mmc0" || test "${boot_target}" = "mmc1" ; then
	    echo " AAAAAAAAAAAAAWPF  Booting from SD (zImage)...${boot_target}--${devtype} -${devnum}-${distro_bootpart} "
		if test -e ${devtype} ${devnum}:${distro_bootpart} /zImage; then
			fatload ${devtype} ${devnum}:${distro_bootpart} 0x00200000 zImage;;
		fi
		if test -e ${devtype} ${devnum}:${distro_bootpart} /system.dtb; then
			fatload ${devtype} ${devnum}:${distro_bootpart} 0x00100000 system.dtb;
		fi
		if test -e ${devtype} ${devnum}:${distro_bootpart} /rootfs.cpio.gz.u-boot; then
			fatload ${devtype} ${devnum}:${distro_bootpart} 0x04000000 rootfs.cpio.gz.u-boot;
			bootm 0x00200000 0x04000000 0x00100000
			exit;
		fi
                if test -e ${devtype} ${devnum}:${distro_bootpart} /system.bit; then
			fatload ${devtype} ${devnum}:${distro_bootpart} 0x00800000 system.bit;
		fpga loadb 0 ${fileaddr} ${filesize}
		fi
		bootz  0x00200000 - 0x00100000
		exit;
	fi

	if test "${boot_target}" = "xspi0" || test "${boot_target}" = "qspi" || test "${boot_target}" = "qspi0"; then
		    echo "BBBBBBBBBBBBBBBBBKYLV1  Booting from QSPI (zImage)...${boot_target}--${devtype} -${ming_mmc_devnum}-${distro_bootpart} "
		 	 if test -z "${bootargs}"; then
    				 setenv bootargs 'console=ttyPS0,115200 root=/dev/mmcblk1p2 rw rootwait rootfstype=ext4 earlyprintk'
            fi
			if test -e ${devtype} ${ming_mmc_devnum}:${distro_bootpart} /zImage; then
				fatload ${devtype} ${ming_mmc_devnum}:${distro_bootpart} 0x00200000 zImage;;
			fi
			if test -e ${devtype} ${ming_mmc_devnum}:${distro_bootpart} /system.dtb; then
				fatload ${devtype} ${ming_mmc_devnum}:${distro_bootpart} 0x00100000 system.dtb;
			fi
			if test -e ${devtype} ${ming_mmc_devnum}:${distro_bootpart} /rootfs.cpio.gz.u-boot; then
				fatload ${devtype} ${ming_mmc_devnum}:${distro_bootpart} 0x04000000 rootfs.cpio.gz.u-boot;
				bootm 0x00200000 0x04000000 0x00100000
				exit;
			fi
					if test -e ${devtype} ${ming_mmc_devnum}:${distro_bootpart} /system.bit; then
				fatload ${devtype} ${ming_mmc_devnum}:${distro_bootpart} 0x00800000 system.bit;
			fpga loadb 0 ${fileaddr} ${filesize}
			fi
			bootz  0x00200000 - 0x00100000
			exit;
		fi

	if test "${boot_target}" = "nand" || test "${boot_target}" = "nand0"; then
		nand info
		if test "image.ub" = "image.ub"; then
			nand read 0x10000000 0x1000000 0x6400000;
			bootm 0x10000000;
			exit;
		fi
		if test "image.ub" = "uImage"; then
			nand read 0x00200000 0x1000000 0x3200000;
			nand read 0x04000000 0x4600000  0x3200000;
			bootm 0x00200000 0x04000000 0x00100000
			exit;
		fi
	fi
done

```

# 拷贝sd卡的文件到qspi和emmc
如果不再用sd卡,则将sd卡里的文件拷贝到到qspi和emmc里
## 将 BOOT.BIN 拷贝到qspi
##### copy_boot_to_qspi.sh
```bash
#!/bin/sh
echo "##############################################"
echo "########## COPY BOOT TO Flash QSPI #########"
echo "##############################################"
echo ""
boot=/media/sd-mmcblk0p1/BOOT.BIN
if [ ! -f ${boot} ]; then
	echo "ERROR: ${boot} file does not exist!"
	exit 1
fi
echo "Erase partition /dev/mtd0"
flash_erase /dev/mtd0 0 0
flashcp ${boot} /dev/mtd0
echo "##########         Complete         ##########"
echo "##############################################"

```

## 将emmc分区
emmc的分区和sd卡一样,一个fat一个ext4
##### emmc_partition.sh
```bash
#!/bin/sh

eMMC_DEVICE="/dev/mmcblk1"


umount "${eMMC_DEVICE}p1" 2>/dev/null
umount "${eMMC_DEVICE}p2" 2>/dev/null


if [ ! -b "$eMMC_DEVICE" ]; then
    echo "$eMMC_DEVICE not found!"
    exit 1
fi


fdisk "$eMMC_DEVICE" <<EOF
o
n
p
1

+100M
n
p
2


w
EOF


blockdev --rereadpt "${eMMC_DEVICE}"


mkfs.vfat -F 32 "${eMMC_DEVICE}p1"
mkfs.ext4 "${eMMC_DEVICE}p2"


fdisk -l "$eMMC_DEVICE"

```

## 将sd卡所有文件拷贝到emmc

##### copy_sd_to_emmc.sh
```bash
#!/bin/sh
set -euo pipefail
# Minimal but safer copy: avoid ownership-preserve errors on FAT boot partition

SD_BOOT=/media/sd-mmcblk0p1
SD_ROOT=/media/sd-mmcblk0p2
EMMC_BOOT=/media/sd-mmcblk1p1
EMMC_ROOT=/media/sd-mmcblk1p2

echo "Simple copy SD -> eMMC (safe-minimal)"

# Quick existence checks
for d in "$SD_BOOT" "$SD_ROOT" "$EMMC_BOOT" "$EMMC_ROOT"; do
    if [ ! -d "$d" ]; then
        echo "ERROR: directory $d does not exist or not mounted."
        exit 1
    fi
done

# Remove contents safely
rm -rf "${EMMC_BOOT:?}/"*
rm -rf "${EMMC_ROOT:?}/"*

# Copy boot: FAT usually -> avoid preserving ownership
if cp --help 2>&1 | grep -q -- '--no-preserve'; then
    cp -a --no-preserve=ownership "$SD_BOOT"/. "$EMMC_BOOT"/
else
    # BusyBox tar fallback: use -o (don't restore user:group)
    (cd "$SD_BOOT" && tar cf - .) | (cd "$EMMC_BOOT" && tar xpf - -o)
fi

# Copy root: usually ext4 -> preserve attributes
cp -a "$SD_ROOT"/. "$EMMC_ROOT"/

sync
echo "Done."
```
或者
```sh
#!/bin/sh
rm -rf  /media/sd-mmcblk1p1/*
rm -rf  /media/sd-mmcblk1p2/*
cp -a  /media/sd-mmcblk0p1/*   /media/sd-mmcblk1p1
cp -a  /media/sd-mmcblk0p2/*   /media/sd-mmcblk1p2
```
或者
```sh
#!/bin/sh
set -e  # Exit immediately if a command fails

SRC1=/media/sd-mmcblk0p1
SRC2=/media/sd-mmcblk0p2
DST1=/media/sd-mmcblk1p1
DST2=/media/sd-mmcblk1p2

echo ">>> Clearing $DST1 ..."
rm -rf ${DST1:?}/*

echo ">>> Copying from $SRC1 to $DST1 ..."
rsync -a --info=progress2 "$SRC1/" "$DST1/"

echo ">>> Clearing $DST2 ..."
rm -rf ${DST2:?}/*

echo ">>> Copying from $SRC2 to $DST2 ..."
rsync -a --info=progress2 "$SRC2/" "$DST2/"

sync
echo ">>> All done!"

```
# .bashrc环境变量配置
```sh
export JAVA_HOME=/opt/soft/jdk1.8.0_211
export JRE_HOME=${JAVA_HOME}/jre
export CLASSPATH=.:${JAVA_HOME}/lib:${JRE_HOME}/lib
export PATH=${JAVA_HOME}/bin:$PATH

alias sptl='source /opt/pkg/petalinux/2020.2/settings.sh'
alias svivado='source /opt/pkg/tools/Xilinx/Vivado/2020.2/settings64.sh'
alias svitis='source /opt/pkg/tools/Xilinx/Vitis/2020.2/settings64.sh'
alias ssdk='source /opt/petalinux/2020.2/environment-setup-cortexa9t2hf-neon-xilinx-linux-gnueabi'
alias sclion="/home/minglie/soft/clion-2023.3.4/bin/clion.sh"
```

# petalinux 命令
```shell
petalinux-create -t project --template zynq -n antbase
cd antbase
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
cp BOOT.BIN image.ub boot.scr    /media/wpf/PYNQ
cp BOOT.BIN image.ub boot.scr    /media/minglie/BOOT

# 修改xsa文件后,清理项目生成的中间文件
petalinux-build -x mrproper -f

# 编译设备树
petalinux-build -c device-tree -x clean
petalinux-build -c device-tree


# jtag启动
# 拷贝组织打包文件
petalinux-package --prebuilt --force
```
# jtag启动
```shell
petalinux-boot --jtag --prebuilt 3
```
# tftp启动
```shell
petalinux-boot --jtag --prebuilt 2
```
# 下载
```shell
zynq>pxe get
zynq>pxe boot
```
# qemu启动
```shell
petalinux-boot --qemu --kernel
```