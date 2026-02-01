> vio_uart 是我在 FPGA 调试过程中设计的一种6字节定长轻量通信协议，适用于寄存器读写与 RPC 调用，遵循严格的一问一答机制。vio_uart 上位机可以使用 JavaScript 在浏览器中灵活编排测试流程，实现快速调试和测试。
# 参考
[基于串口实现可扩展的硬件函数 RPC 框架](https://blog.csdn.net/qq_26074053/article/details/149968390)

[Tang-Nano-1K移植vio_uart](https://blog.csdn.net/qq_26074053/article/details/156298625)

# [vio_uart.j2b.json](https://blog.csdn.net/qq_26074053/article/details/154620732)
```json
{
  "remark": "vio_uart定长6字节对称协议",
  "schema": {
    "CmdTypeEnum:bit[2]": {
        "0": "读",
        "1": "写",
        "2": "RPC"
      }
  },
  "agreement": [
    "1.用于fpga调试的6字节的定长协议,必须一问一答",
    "2.数据字段（data）采用小端序（低字节存低地址）",
    "3.cmdType=0/1时，endpoint为寄存器地址（取值0~29）;cmdType=2时，endpoint为RPC方法ID（funcId）",
    "4.读操作（cmdType=0）的data字段填充0x00;写操作（cmdType=1）的data为32位写入数据;RPC（cmdType=2）的data为方法第一个32位参数",
    "5.主机发出的数据包从机必须响应,从机响应完后主机才能发新的数据包",
    "6.rpc调用主机请求的[cmdType,endpoint]和从机响应的[cmdType,endpoint]是一样的",
    "7.fpga测的rpc处理器请求和响应的参数固定为4个u32,但单次rpc只带了1个参数,如果要用到其他三个参数则要用到寄存器[1~3](请求)和[7~9](响应)",
    "8.vio_uart的输出寄存器是通用寄存器,而输入寄存器则和vio_uart的输入绑定了,上位机只能读,不可写(写也没用)"
  ],
  "content": {
    "cmdType:u8;命令类型":{
      "_[1:0]": "1:CmdTypeEnum:bit[2]",
      "_[7:2]": ":bit[6];选用,[序号sid,0~63循环,主机生成,从机复用]"
    },
    "endpoint": "1:u8;cmdType是2为funcId,cmdType是0,1则是地址",
    "data": "6553147:u32;数据体"
  }
}
```
# 在线使用
[vio_uart.html](https://minglie.github.io/html/vio_uart/vio_uart.html)

![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/3b97b821873547c58fa656de340770b5.png)

# 例子
vio_uart只有三个接口Rpc,Write和Read
这里的M是 [ming_mock](https://www.npmjs.com/package/ming_mock)
```c
// 函数调用  funcId=1  参数data=1
const res=await VioUart.Rpc(1,1);
//16进制打印Rpc返回
console.log(res.ToHexString());
//寄存器1 写入1234567
await VioUart.Write(1,1234567);
//延时1ms
await M.sleepMs(1);
//读取寄存器1的数据
const readVal= await VioUart.Read(1);
console.log(readVal);
```