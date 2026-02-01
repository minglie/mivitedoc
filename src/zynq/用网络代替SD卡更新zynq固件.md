# 前提准备
-  QSPI Flash里有个u-boot(这个u-boot只要能连网就行)
-  如果是空板可以先用JTAG下载U-BOOT.bin到QSPI Flash再操作
-  局域网里准备一个nfs服务器
-  局域网里准备一个tftp服务器
-  nfs服务器里有完整根文件系统和根文件系统压缩包以及tftp服务器里的5个文件
-  tftp服务器里有[BOOT.BIN  boot.scr  system.bit  system.dtb  zImag]5个文件

# 最终文件分布情况
boot.scr 脚本在emmc的第一个分区找启动文件
| 位置 | 内容 |
|------|------|
| QSPI Flash | BOOT.BIN(纯u-boot) |
| emmc的fat32 分区 | BOOT.BIN,  boot.scr,  system.bit,  system.dtb,  zImag |
| emmc的ext4 分区 | 根文件系统 |

### emmc的fat32分区的压缩包制作
这几个文件要在tftpf服务器里拷贝一份,首次启动会用到
```bash
tar -zcvf output.tar.gz ./output/*
```
### emmc的ext4分区的压缩包制作
```bash
cd /home/wpf/workspace/nfs/z8_rootfs/
sudo   tar -zcvf ../z8_rootfs.tar.gz .
```
# 进入u-boot
加载内核镜像,设备树,和挂载nfs启动
```bash
setenv ipaddr 192.168.3.211  
setenv serverip 192.168.3.4 
setenv gatewayip 192.168.3.1
setenv netmask 255.255.255.0
setenv loadaddr 0x00800000
tftpboot 0x00200000 zImage
tftpboot 0x00100000 system.dtb
tftpboot 0x00800000 system.bit 
setenv bootargs "ttyPS0,115200 root=/dev/nfs rw nfsroot=192.168.3.4:/home/wpf/workspace/nfs/z8_rootfs,nfsvers=3 ip=192.168.3.211:192.168.3.4:192.168.3.1:255.255.255.0::eth0:off"
bootz 0x00200000 - 0x00100000
```

#  将emmc分成两个区(vfat+ext4 )
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

# 拷贝或解压到emmc的两个区里(全量解压拷贝速度快)
emmc的两个区挂载在sd-mmcblk1p1和sd-mmcblk1p2
```bash
tar -zxvf /home/root/soft/output.tar.gz    -C  /media/sd-mmcblk1p1/ 
tar -zxvf /home/root/soft/z8_rootfs.tar.gz -C  /media/sd-mmcblk1p2/
```
## 增量拷贝灵活
```bash
scp -r minglie@192.168.3.38:/home/minglie/workspace/output/* /media/sd-mmcblk1p1/

scp -r minglie@192.168.3.38:/home/minglie/workspace/nfs/z8_rootfs/* /media/sd-mmcblk1p2/
```
# 将emmc里的BOOT.BIN到QSPI Flash里
## copy_emmc_boot_to_qspi.sh
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


