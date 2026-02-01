[波特律动字体生成](https://led.baud-dance.com/)

[oled320_240.j2b.json5](https://blog.csdn.net/qq_26074053/article/details/154620732)
```json
/**
 * ==============================================
 * j2b 存储结构说明
 * 参考规则: https://blog.csdn.net/qq_26074053/article/details/154620732
 * ==============================================
 *
 * Flash 存储布局（偏移地址 / 区块名称 / 区块大小）：
 *
 * 0x00000000  baseConfig     4096 bytes   // 基本配置区
 * 0x00001000  zoneAndJson    4096 bytes   // 区域配置 + JSON 信息
 * 0x00002000  picInfo        1920 bytes   // 图片信息配置
 * 0x000027a0  unZipHelp      5472 bytes   // 字体解压辅助表
 * 0x00003d00  zipImg         until end    // 图片数据区（压缩存储）
 *
 * 说明：
 * 1. baseConfig: 基本参数，通常很少修改
 * 2. zoneAndJson: 区域布局和面板 JSON 信息
 * 3. picInfo: 所有图片的配置信息
 * 4. unZipHelp: 字体/数字解压辅助表,用于快速渲染
 * 5. zipImg: 存放实际的图片和字体数据,根据 picInfo和unZipHelp解析
 */

{
  "remark": "彩屏上单色字体图的存储结构",
  "agreement": [
    "1. @,0的字段不占用spiFlash",
    "2. 固定48个区域和24个图片",
    "3. MagicEnum 是将图片内容和图片信息放在一起的一种方案(本文没用),这里将它拆解成 picInfo,unZipHelp,zipImg 三个部分 ",
    "4. 整个flash被分成两个文件 fc.bin(区域配置) 和 rg.bin(图片资源,注意在生成的rg.bin文件内部,已包含了一个默认的fc.bin)",
    "5. 在bootLoder里可用mu工具写入fc.bin和rg.bin",
    "6. 在应用程序里可以在浏览器通过z8_modman协议写入区域配置信息",
    "7. 区域数量通过遍历zoneConfig获得,图片数量通过遍历picInfo获得(遍历到无效id结束)",
    "8. 纯单色字模生成 用波特律动 https://led.baud-dance.com 生成"
  ],
  "schema": {
    "MagicEnum:str;字符串型枚举,用于在人眼在二进制文件里快速查到小文件位置": {
      "colorTable": ";颜色表",
      "pureAscii16_8": ";纯色16*8的ascii",
      "pureHanzi16_16": ";纯色16*16的汉字",
      "ascii24": ";渐变色24号的ascii",
      "ascii36": ";渐变色36号的ascii",
      "ascii48": ";渐变色48号的ascii",
      "number72": ";渐变色72号的数字",
      "background": ";背景图",
      "logo": ";logo图",
      "icon": ";icon图"
    },
    "Rgb565Color:u16": {
      "_[15:11] as red": ";红",
      "_[10:5] as green": ";绿",
      "_[4:0] as blue": ";蓝"
    },
    "ZipFontImgU16Unit:u16;渐变色字体图片单元": {
      "_[15:12] as colorInx": "0:bit[4];颜色索引,最大16渐变色",
      "_[11:0] as repeatNum": "0:bit[12];重复次数,做多重复4095次"
    },
    "ZipFontImgU24Unit:u24;渐变色字体图片单元": {
      "_[7:0] as colorInx": "0:u8;颜色索引",
      "_[23:8] as repeatNum": "0:u16;重复次数,做多重复65535次"
    },
    "ZipIconImgU32Unit:u32;图标图片单元": {
      "color": "0:Rgb565Color:u16;rgb颜色",
      "repeatNum": "0:u16;重复次数"
    },
    "UnZipAsciiHelper:u16[4][95];Ascii解压辅助": {
      "startColumn": "0:u16[95];未压缩的起始列数",
      "zipAddressOffset": "0:u16[95];压缩后的偏移地址",
      "unZipWidth": "0:u16[95];未压缩每个元素宽度",
      "zipByteSize": "0:u16[95];压缩后每个字符byte大小"
    },
    "UnZipNumberHelper:u16[4][14];数字解压辅助": {
      "startColumn": "0:u16[14];未压缩的起始列数",
      "zipAddressOffset": "0:u16[14];压缩后的偏移地址",
      "unZipWidth": "0:u16[14];未压缩每个元素宽度",
      "zipByteSize": "0:u16[14];压缩后每个字符byte大小"
    },
    "UnZipHanziHelper;Hanzi解压辅助": {
      "codeInx@,0": ":u32[341];辅助找到这341个汉字的索引,放到片内Flash",
      "data@0;341个元素": [
        {
          "zipAddressOffset": "0:u32;压缩后的偏移地址",
          "zipByteSize": "0:u16;压缩后每个字符byte大小"
        }
      ]
    }
  },
  "ZoneId:enum:u8;区域id": [
    "背景;单个",
    "logo;单个",
    "...icon;多个",
    "...dvb;多个",
    "...unit;多个",
    "...str;多个"
  ],
  "ZoneTypeEnum:bit[2]": {
    "1": "icon",
    "2": "dvb",
    "3": "unit",
    "0": "str"
  },
  "ZoneFontSizeEnum:bit[2]": {
    "0": "24号",
    "1": "36号",
    "2": "48号",
    "3": "72号"
  },
  "ZoneFontColorEnum:bit[3]": {
    "0": "黑黄",
    "1": "黑蓝",
    "2": "蓝白",
    "3": "黑绿"
  },
  "Zone@,24": {
    "id": "10:ZoneIdEnum:u8;区域id",
    "name@,0": "1:string;区域名",
    "type:u8;类型": {
      "_[7:6]": "0:ZoneId;区域类型",
      "_[5:4]": "0:ZoneFontSizeEnum;字体大小(icon忽略)",
      "_[3:1]": "0:ZoneFontColorEnum;字体颜色(icon忽略)",
      "_[0]": "0:bit[1];dvb单位是否可写"
    },
    "x": "0:u16;区域左上角x",
    "y": "0:u16;区域左上角y",
    "width": "0:u16;区域宽度",
    "height": "0:u16;区域高度",
    "alignDir": "0:u8;对齐方式 0:左对齐 1:右对齐 2:居中",
    "param": "0:u32;默认参数",
    "picInfoId": "0:u8;引用的图片id",
    "hash": "0:u16;区域hash值",
    "reserved": "0:u8[6];备用"
  },
  "PicInfo@,80": {
    "id": "1:u8;图片id",
    "name@,0": "1:string;图片名",
    "type:u8;类型": {
      "_[7:7]": "0:bit;0=小图(最多15个) 1=大图(最多7个)",
      "_[6:5]": "0:bit[2]; 1=icon  0=其他"
    },
    "width": "0:u16;图片宽度",
    "height": "0:u16;图片高度",
    "entry_col_bgn": "0:u16[15];每个元素起始列(非ascii字库)",
    "entry_width": "0:u16[15];每个元素宽度(非ascii字库)",
    "mem_addr": "0:u32; &zipImg+mem_addr为图片真实flash地址",
    "mem_size": "0:u32;图片bin文件大小",
    "needZip@,0": "0:u32;是否需要压缩",
    "file@,0": "0:string;图片的bin文件",
    "pngFile@,0": "0:string;图片的网络地址"
  },
  "ColorTableFile": {
    "length@0": "184:u32;总字节数",
    "magic@4": "0:MagicEnum:str;文件类型",
    "checkSum@20": "0:u32;后面的校验和",
    "fileName@,0": ";文件名",
    "data@24,256": {
      "blackYellow": "0:u16[16];黑底黄字",
      "blackBlue": "0:u16[16];黑底蓝字",
      "blueWhite": "0:u16[16];蓝底白字",
      "blackGreen": "0:u16[16];黑底绿字",
      "blackRed": "0:u16[16];黑底红字"
    }
  },
  "AsciiFontFile": {
    "length@0": "180:u32;总字节数",
    "magic@4": "0:MagicEnum:str;文件类型",
    "checkSum@20": "0:u32;后面的校验和",
    "fileName@,0": ";文件名",
    "width@24": "0:u16;图片宽度",
    "height@26": "0:u16;图片高度",
    "helper@28": "0:UnZipAsciiHelper",
    "data@408": "0:ZipFontImgU24Unit[?]"
  },
  "HanziFontFile": {
    "length@0": "0:u32;总字节数",
    "magic@4": "0:MagicEnum:str;文件类型",
    "checkSum@20": "0:u32;后面的校验和",
    "fileName@,0": "hanzi24.bin;文件名",
    "width@24": "0:u16;图片宽度",
    "height@26": "0:u16;图片高度",
    "helper@28": "0:UnZipHanziHelper",
    "data": "0:ZipFontImgU24Unit[?]"
  },
  "PureAsciiFontFile": {
    "length@0": "180:u32;总字节数",
    "magic@4": "0:MagicEnum:str;文件类型",
    "checkSum@20": "0:u32;后面的校验和",
    "fileName@,0": ";文件名",
    "data@24,1520": ":u8[95][16];纯色ascii"
  },
  "PureHanziFontFile@,16384": {
    "length@0": "180:u32;总字节数",
    "magic@4": "0:MagicEnum:str;文件类型",
    "checkSum@20": "0:u32;后面的校验和",
    "fileName@,0": ";文件名",
    "helper@,0": ":u32[341];辅助找到这341个汉字的索引,放到片内Flash",
    "data@24": ":u8[341][34];纯色汉字,前4个字节是UTF-8码"
  },
  "content": {
    "baseConfig@0,4096;基本配置,几乎不改": {
      "reserved@0x00000000": "0:u8;备用",
      "slaveAddress@0x00000001": "1:u8;从机地址",
      "sn@0x00000002": "2701001:u32;序列号"
    },
    "fc@0x00001000,4096;对应fc.bin文件,域配置": {
      "zoneConfig:Zone[48]@0x00001000,48*24;1152个字节": {
        "background": ":Zone;背景区域1个",
        "logo": ":Zone;logo区域1个",
        "icon": ":Zone[?];icon区域若干",
        "dvb": ":Zone[?];dvb区域若干",
        "unit": ":Zone[?];单位区域若干",
        "str": ":Zone[?];字符串区域若干"
      },
      "formConfigJson@0x00001480,2944": "0:string;面板的json信息"
    },
    "rg@0x00002000;对应rg.bin文件里0x00002000后面的内容,字体图库": {
      "resourceId@0x00002000,32": ":string;资源组编码和时间commonGroup2.2501020402",
      "picInfo:PicInfo[24]@0x00002020,1920": {
        "0": ":PicInfo;ascii_24",
        "1": ":PicInfo;ascii_36",
        "2": ":PicInfo;ascii_48",
        "3": ":PicInfo;num_72",
        "4": ":PicInfo;背景图",
        "5": ":PicInfo;logo",
        "6": ":PicInfo;图标0",
      },
      "unZipHelp@0x000027a0,5472;字体解码辅助": {
        "24号字体解压辅助@0x000027a0,760": ":UnZipAsciiHelper",
        "36号字体解压辅助@0x00002a98,760": ":UnZipAsciiHelper",
        "48号字体解压辅助@0x00002d90,760": ":UnZipAsciiHelper",
        "72号数字字体解压辅助@0x00003088,112": ":UnZipNumberHelper",
        "reserved@0x00003100,3080": ":u8[3080];备用空间(补全5472字节)"
      },
      "zipImg@0x00003d00;剩余容量存图片,最多24个图片,借助picInfo和unZipHelp 确定?大小 和 解析": {
        "ascii_24": ":ZipFontImgU24Unit[?]",
        "ascii_36": ":ZipFontImgU24Unit[?]",
        "ascii_48": ":ZipFontImgU24Unit[?]",
        "num_72": ":ZipFontImgU24Unit[?]",
        "背景图": ":ZipIconImgU32Unit[?]",
        "logo": ":ZipIconImgU32Unit[?]",
        "图标0": ":ZipIconImgU32Unit[?]"
      }
    },
  }
}



```