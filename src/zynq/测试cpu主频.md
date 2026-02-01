
```shell
#!/bin/sh
# 获取第一次 jiffies
j1=$(cat /proc/timer_list | grep '^jiffies:' | head -n 1 | awk '{print $2}')
echo "First jiffies: $j1"
sleep 1
# 获取第二次 jiffies
j2=$(cat /proc/timer_list | grep '^jiffies:' | head -n 1 | awk '{print $2}')
echo "Second jiffies: $j2"
# 计算差值
hz=$((j2 - j1))
echo "CONFIG_HZ is likely: $hz"

```