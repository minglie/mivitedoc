
# [modbus.j2b.json5](https://blog.csdn.net/qq_26074053/article/details/154620732)
```json
{
  "remark": "modbusRtu.j2b.json",
  "agreement": [
    "1. 只列举了常用的0x03,0x06,0x10三个功能码"
  ],
  "schema": {
    "FuncIdEnum:u8;功能码": {
      "0x01": "读线圈;Read Coils",
      "0x02": "读离散输入;Read Discrete Inputs",
      "0x03": "读多个保持寄存器;Read Holding Registers",
      "0x04": "读输入寄存器;Read Input Registers",
      "0x05": "写单个线圈;Write Single Coil",
      "0x06": "写单个寄存器;Write Single Register",
      "0x07": "读设备ID;Read Device Identification",
      "0x0F": "写多个线圈;Write Multiple Coils",
      "0x10": "写多个寄存器;Write Multiple Registers"
    },
    "ReadHoldingRegisters;读取多个保持寄存器(0x03)": {
      "Call@,8": {
        "slaveAddr":"0:u8",
        "funId":"0x03:FuncIdEnum",
        "startAddr":"0:U16;起始寄存器地址",
        "quantity":"1:U16;寄存器数量",
        "crc":"0:U16;crc16"
      },
      "Reply": {
        "slaveAddr":"0:u8",
        "funId":"0x03:FuncIdEnum",
        "byteCount":"2:u8;数据字节数",
        "data":"0:U16[byteCount/2];寄存器数据",
        "crc":"0:U16;crc16"
      }
    },
    "WriteSingleRegister;写单个寄存器(0x06)": {
      "Call@,8": {
        "slaveAddr":"0:u8",
        "funId":"0x06:FuncIdEnum",
        "startAddr":"0:U16;寄存器地址",
        "data":"0:U16;寄存器值",
        "crc":"0:U16;crc16"
      },
      "Reply": {
        "slaveAddr":"0:u8",
        "funId":"0x06:FuncIdEnum",
        "startAddr":"0:U16;寄存器地址",
        "data":"0:U16;寄存器值",
        "crc":"0:U16;crc16"
      }
    },
    "WriteMultipleRegisters;写多个寄存器(0x10)": {
      "Call": {
        "slaveAddr":"0:u8",
        "funId":"0x10:FuncIdEnum",
        "startAddr":"0:U16;起始寄存器地址",
        "quantity":"0:U16;寄存器数量",
        "byteCount":"quantity*2:u8;数据字节数",
        "data":"0:U16[quantity];寄存器数据",
        "crc":"0:U16;crc16"
      },
      "Reply@,8": {
        "slaveAddr":"0:u8",
        "funId":"0x10:FuncIdEnum",
        "startAddr":"0:U16;起始寄存器地址",
        "quantity":"0:U16;寄存器数量",
        "crc":"0:U16;crc16"
      }
    }
  },
  "content;可用于生成或解析modbus数据包": {
      "request": ":ReadHoldingRegisters.Call",
      "response":   ":ReadHoldingRegisters.Reply"
  }
}

```