# 安装wsl
```bash
PS C:\Windows\system32> wsl --install
正在安装: 虚拟机平台
已安装 虚拟机平台。
正在安装: 适用于 Linux 的 Windows 子系统
已安装 适用于 Linux 的 Windows 子系统。
正在安装: Ubuntu
已安装 Ubuntu。
请求的操作成功。直到重新启动系统前更改将不会生效。
```
# wsl安装常用库
```bash
# 1. 更新包索引（解决“找不到包”“依赖缺失”问题）
sudo apt update -y
# 2. 安装核心工具（一条命令，含 gcc/g++/make/ld + 驱动必需依赖）
sudo apt install -y build-essential flex bison libssl-dev libelf-dev dwarves kmod gdb git
# 3.安装nfs
sudo apt install nfs-kernel-server
# 4.安装openssh
sudo apt install openssh-server
```
# 配置端口映射
```bash
PS C:\Windows\system32> ipconfig

Windows IP 配置


以太网适配器 以太网:

   连接特定的 DNS 后缀 . . . . . . . :
   IPv6 地址 . . . . . . . . . . . . : 2409:8a28:67f:3700:19f8:f591:4897:5100
   IPv6 地址 . . . . . . . . . . . . : 2409:8a28:67f:3700:2464:9f2a:b225:5
   临时 IPv6 地址. . . . . . . . . . : 2409:8a28:67f:3700:e5b0:f75b:ce6f:baa9
   本地链接 IPv6 地址. . . . . . . . : fe80::a1cf:1500:71c0:9508%14
   IPv4 地址 . . . . . . . . . . . . : 192.168.3.38
   子网掩码  . . . . . . . . . . . . : 255.255.255.0
   默认网关. . . . . . . . . . . . . : fe80::2664:9fff:fe2a:b225%14
                                       192.168.3.1

以太网适配器 vEthernet (WSL (Hyper-V firewall)):

   连接特定的 DNS 后缀 . . . . . . . :
   本地链接 IPv6 地址. . . . . . . . : fe80::d770:e406:b6e6:8bd9%25
   IPv4 地址 . . . . . . . . . . . . : 172.19.160.1
   子网掩码  . . . . . . . . . . . . : 255.255.240.0
   默认网关. . . . . . . . . . . . . :
# wsl中查看ip
minglie@mingLab:~$ ifconfig
eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1492
        inet 172.19.173.227  netmask 255.255.240.0  broadcast 172.19.175.255
        inet6 fe80::215:5dff:fecb:9867  prefixlen 64  scopeid 0x20<link>
        ether 00:15:5d:cb:98:67  txqueuelen 1000  (Ethernet)
        RX packets 4120  bytes 5284740 (5.2 MB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 3775  bytes 280783 (280.7 KB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0

lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536
        inet 127.0.0.1  netmask 255.0.0.0
        inet6 ::1  prefixlen 128  scopeid 0x10<host>
        loop  txqueuelen 1000  (Local Loopback)
        RX packets 32  bytes 3502 (3.5 KB)
        RX errors 0  dropped 0  overruns 0  frame 0
        TX packets 32  bytes 3502 (3.5 KB)
        TX errors 0  dropped 0 overruns 0  carrier 0  collisions 0

# 在管理员powershell进行端口映射
## 用于ssh
netsh interface portproxy add v4tov4 listenport=22 listenaddress=0.0.0.0 connectport=22 connectaddress=172.19.173.227
## 用于nfs, wsl里用rpcinfo -p看nfs端口
netsh interface portproxy add v4tov4 listenport=2049 listenaddress=0.0.0.0 connectport=2049 connectaddress=172.19.173.227

# Windows防火墙配置一个tcp所有端口的入站规则,让局域网可以访问到wsl
# 其他局域网测试22端口是否能连通
root@m8:~/workspace# nc -zvw3 192.168.3.38 22
192.168.3.38 22 (ssh) open
# 其他局域网测试ssh登录
root@m8:~# ssh minglie@192.168.3.38
```
