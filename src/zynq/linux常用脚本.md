# 脚本相关
[PetaLinux 使用技巧与缓存配置](https://blog.csdn.net/qq_26074053/article/details/149570790)

[PetaLinux的JTAG启动](https://blog.csdn.net/qq_26074053/article/details/151044427)

# 查看MAC 地址
```bash
ip link show
```
# u-boot里改mac地址防冲突
```bash
printenv ethaddr
setenv ethaddr 00:0a:35:00:1e:54
saveenv
```

# 脚本结尾^M问题
```bash
dos2unix ant_ipconfig.sh
sed -i 's/\r//' ant_ipconfig.sh
```

# 文件名找文件
```bash
find . -name "ant_ipconfig.sh"
```

# 文件内容找文件
```bash
find . -type f -name "*.sh" | xargs grep -n "jiffies"
或
grep -r -F "jiffies" ./
```
# 磁盘占用只展开一层
```bash
du -h -d 1
```

# 内核模块安装检查确认
```bash
# 内核源码上
cat .config | grep XILINX_XADC
# 开发板上
zcat /proc/config.gz | grep USB_MON
zcat /proc/config.gz | grep XILINX_XADC
zcat /proc/config.gz | grep IIO
```
# web版的sqlite客户端
```bash
pip3 install sqlite-web
sqlite_web /path/to/your.db -H 0.0.0.0 -p 8080
```

# 免密登录配置
```bash
sudo  ssh-copy-id -i ~/.ssh/id_rsa.pub root@47.113.219.87
# 目标机密钥如果变了则
ssh-keygen -f "/home/wpf/.ssh/known_hosts" -R "47.113.219.87"
sudo  ssh-copy-id -p 60020  -i ~/.ssh/id_rsa.pub minglie@47.113.219.87
sudo  ssh-copy-id -i ~/.ssh/id_rsa.pub root@192.168.1.211
# 目标机密钥如果变了则
ssh-keygen -f "/home/wpf/.ssh/known_hosts" -R "192.168.1.211"
```