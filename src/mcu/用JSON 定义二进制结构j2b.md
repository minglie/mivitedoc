# 🧩 用JSON 定义二进制结构j2b
在很多应用场景中，我们常常需要在 **JSON** 与 **二进制数据** 之间进行相互转换。然而，实现精确转换往往并不容易，因为我们缺少足够的信息来映射二者之间的结构。

现有的方案，比如 **Protobuf**、**FlatBuffer** 等，虽然功能强大，但在某些情况下显得 **过于复杂**，不够直观。尤其是当开发者希望直接从 JSON 理解二进制结构时，这些工具并不能很好地满足需求。

为了解决这一痛点，我设计了一种更 **简单直观** 的结构定义语言 —— **j2b**。

## j2b 的特点

- **直观易懂**：尽量在一行内描述一个属性，让 JSON 与二进制的映射一目了然。  
- **JSON 驱动**：完全基于 JSON 文件描述数据结构，支持多文件引用、嵌套类型、定长与变长字段。  
- **自然表达**：二进制结构定义变得像写 JSON 一样简单；变长类型必须指定容量，用于存储的数据应指定地址。  
- **兼容 C 结构体**：除了变长数组和复杂嵌套类型之外，j2b 的 Schema 与 C 语言结构体几乎完全对应。换句话说，  
  ***若不考虑变长数组和复杂类型嵌套，j2b 定义的二进制可以直接强转为 C 结构体。***

通过 j2b，你可以在保持 JSON 可读性的同时，轻松定义和操作复杂的二进制数据结构。



---
# j2b的功能和例子
```shell
┌────────────┐      ┌────────┐      ┌────────────┐
│   二进制    │ <──  │  j2b   │ ──>  │    json    │
└────────────┘      └────────┘      └────────────┘
```
 mi.json和 mi.bin 之间可以借助mi.j2b.json5双向转换,  mi.j2b.json里已经有足够的信息进行这种双向转换。
##  mi.j2b.json5
```json
{
  "remark": "j2b例子",
  "schema": {
       //u8类型的爱好枚举,实际存储是索引
      "HobbyEnum:u8": [
          "抽烟",
          "睡觉",
          "烫头"
      ],
     //Person大小是4字节,容量也是4字节,
      "Person@,4": {
          "name": "zs:char[2]",
          "age": "0:u8",
          "hobby": ":HobbyEnum"
      }
  },
  "content": {
      "zs": ":Person",
      "ls": ":Person"
  }
}
```
## mi.json
```json
{
  "zs":{
    "name": "zs",
    "age": 38,
    "hobby": "抽烟"
  },
  "ls": {
    "name": "ls",
    "age": 27,
    "hobby": "烫头"
  }
}
```
## mi.bin
mi.json 的二进制只有8个字节
```bash
122,115,38,0,108,115,27,2
```
## 🌐 规则和约定
解析出属性的标识符叫属性识别符
字段属性通过 ` "字段名:类型@绝对地址|相对地址,容量as别名#自定义名;描述" : "值:类型@绝对地址|相对地址,容量as别名#自定义名;描述"` 的形式描述
| 识别符 | 含义 |
|------|------|
| `""` | 字段名 或 值 |  
| `:` | 类型或继承 |  
| `@` | 对根的绝对地址, 在类型定义里和`\|`效果一样|  
| `\|` |   对父节点的相对地址 |  
| `,` | 容量 |  
| `as` | 别名 |  
| `#` |   宏 |  
| `#  xxx` | 自定义名 |  
| `;` | 描述 |  
| `$` |引用 |  
| `&` |字段地址 |  
| `[]` |数组 |  
| `_` |匿名解构 |  
| `?` |未知长度,但能通过其他方式获取长度 |  
| `//` |注释|  
| `.` |与$搭配,引用对象的属性或函数返回|  
  |`$xxx()` |引用函数xxx的返回|
   |`$xxx` |引用xxx|
| `xxxEnum` |枚举定义 |
 | `remark` |备注|
  | `agreement` |约定|
  |`schema` |类型定义|
   |`xxxContent` |内容定义|
  |`main` |入口|
   |`version` |版本|
  |`scripts` |脚本|
   |`define` |定义常量|
   |`name` |j2b名|
   |`import` |导入其他类型,函数,内容等|
   |`include` |引入其他|
   
    

1.  ```值上的属性的优先级大于字段名上的属性, 大多数情况属性可省略```
2.   ```只识别第一个分号前的, 第一个分号后的全是描述```
3.  ```这样设计的原因是在定义枚举类型或者 在类型继承 或 类型聚合 有时不方便把 类型写到值上, 就只能写到字段名上了 ```
4.  ```我尽量避开使用运算符+ - * / % 作为识别符```
5.   ```字段名与值的形式是完全一致的,大多属性只要没歧义都可省略。 ```
6. ```Type[]和Type[3],Type[?] 都是Type数组,区别是Type[]要带两字节长度,Type[?]种的?可根据其他信息动态判定```
7. ```_是匿名符,用于解构出bit, 或解构数组  出现在[]前面```
8.  ```地址,容量,数组长度等是个合理的js表达式,可不加$的引用#define和#import的东西 ```
9.   ```js表达式是最早的一步预处理,就是直接取eval(`xxx`)的返回```
10.  ```其他地方的$引用是后面要做的预处理```
11.  ```zone@32*2:u8[10*2];区域 预处理成  zone@64:u8[20];区域```
12.  ```自定义类型可以继承或组合已有的类型,在值声明可连带上父类型比如 red:ColorEnum:u8@10,1;颜色描述  是个合法的值```
13.  ```当属性和值都没有类型标注时,可参考基本类型根据值大概的反推出类型 ```
14.  ```#开头的字段是宏指令```
15.  ```#define 就是简单的替换,不做其他处理```
16.  ```#include 就是去掉括号的替换```
17.  ```#import 只是为了引用文件中的内容,不是替换```
18.  ```#include和#import会进行合并和覆盖```
19.  ```#include和#import 可以是字符串或数组可以用as起别名,无别名则是全局的```
20.   ```#agreement开头的是约定,数组,对象或字符串,是给人看的```
21. ```在j2b文件中agreement可以不加#,在j2bs和j2bc里则必须加#```
22.  ```$开头的标识,作用是引用其他文件的内容函数, 前面#define的内容等,解析前需要先替换。```
23.   ```//开头的字段和容量为0的字段会当做注释忽略掉```
24.  ```值可省略不写```
25.  ```类型必须跟在冒号后面```
26. ```不定长类型的字段,必须指定容量```
27.  ```有限枚举类型必须用Enum作为后缀不用再继承enum, 不定长枚举可以不用Enum后缀，但应当继承enum```
28. ```枚举设计的很自由,可继承字符串或数字```
29.  ```json对象定义枚举 , 可以写到键或值上(通过第一个枚举项区分在键上还是值上)```
30. ```json数组定义枚举,枚举继承数字用索引,枚举继承字符串用数组值```
31. ```除基本类型外,大写开头的是类型名,小写开头的是字段名```
32.  ```复合类型名必须用大写字母开头```
33. ```使用的类型必须是前面已经声明过的```
34. ```数组中的元素必须是同类型的```
35.  ``含有中括号的字段会被忽略掉，仅用于给人看  ``
36. ``对象类型是一种匿名类型(类型名为Type.field),适合只出现一次的场景,没必要做类型提取``
37. ```可以用"@地址,容量" 给内容加个地址标识和容量标识,实际长度由value决定,后续的值跟随```
38. ```可以用"@,容量" 给类型加个容量标识,容量为0的字段不参与序列化和反序化```
39. ```一个内容直接用content多个内容用xxxContent,  content也是个关键字```
40. ```解析文件前先合并文件的所有#include,#import和#define,后面覆盖前面,用于$xxx替换```
41. ```基本类型或公共类型可以不用#import或#include```
42.  ```j2b的配置文件同时也是j2b文件```
```shell
"字段名:类型@绝对地址|相对地址,容量as别名#自定义名;描述" : "值:类型@绝对地址|相对地址,容量as别名#自定义名;描述"
```
# 文件类型
## 配置文件 config.j2b.json （非必要）
j2b的配置文件同时也是j2b文件, ***j2b文件里最重要的两个字段是schema和content***
j2b的配置文件, 主要配置一些自定义类型和自定义内容。避免在其他文件中用#import或#include 默认基本类型和基本函数,不用import。
```json
{
   "remark":"非必须的j2b配置文件",
   "name": "mweb_font",
   "version": "1.0.0",
   "main": "main.j2b.json",
   "agreement":[
      "1.这个配置文件可以代替import和include",
      "2. schema和content会合并到j2b文件的schema和content里",
      "3. define引入全局 #define 宏"
      "4. import用于引入全局函数或全局类型"
   ],
   "scripts":{
         //json转二进制
        "build" :  "j2b main.j2b.json -o main.j2b.bin",
         //二进制转json
        "reverse" :"j2b main.j2b.bin  -o main.j2b.json"
	 },
   //全局的#define
   "define":{
       "PI"："3.14"
    },
   "import":[
         //引入全局函数,可用$U.xxx()引用
         "utils.js as U",
         //引入全局类型,可用$T.Type1引用
         "xxx.j2bs.json5 as T"，
          //引入全局内容,可以用$C.filed引用
         "xxx.j2bc.json5 as C"
    ],
   "schema":{
       "#include":["file01.j2bs.json5"]
    },
   "content":{
       "funcId": "1:u8;功能码"
    }
}
```
## 函数文件  file00.js
函数文件是一个js文件，引入函数文件后可以调用函数文件中的方法
```js
export default {
     max:(a,b)=>Math.max(a,b)
}
```
## 纯类型文件 file01.j2bs.json5
```json
{
  "#import":["xxx.j2bs.json5","file00.js as util"],
  "#define":{
      "vol": "55",
      "temp": "5"
  }
  "Type1":"1:u8",
}
```
## 纯内容文件 file02.j2bc.json5
```json
{
  "#import":"xxx.j2bs.json5",
  "name":"1:Type1",
  "hobby":"dance:str",
  "age":"$util.max(7,8):u8",
  "lever": "$vol:u32"
}
```
## 类型文件和内容文件的混合 xxx.j2b.json5
```json
{
   "remark":"这是一个注释",
   "schema":{
      "#include":["file01.j2bs.json5"],
      "Type2":  {
        "name":"1:Type1",
      }
   },
   //在j2b文件中agreement可以不加#,在j2bs和j2bc里则必须加#
   "agreement": [
       "1.这是一条约定"
   ]
   "content":{
       "#include":["file01.j2bs.json5 as file01" ,"file02.j2bc.json5"],
       "name":"1:Type1",
       "job":"doctor:str;医生",
       "hobby":"$file02.hobby;引用别名file02"
    }
}
```
# 函数
函数用于生成一些想要的东西, 函数是需要替换的,函数定义时不要加`$`前缀,在使用时要在前面加上`$`
前缀 , $_raw() 包裹的任何内容都不做替换。
| **函数** | **作用** | 
|-------------|---------------|
| `$max(1,2)`    | 最大值  | 
 |`$Type(1,5) `   | 用参数1,5 构造Type的值  | 
 |`$Type.s(1,2,3)`    | 类型Type数组的值  | 
  |`"$str(abc)`    | 字符串 "abc"  | 
  |`$str(max(1,2))`    | 字符串 "max(1,2)"  | 
   |`$str($max(1,2))`    | 字符串 "2"  | 
   |`$_raw($max(1,2))`    |  原始内容, 不解析  $max(1,2) | 
# 数据类型
数据类型用于  存储,传输,运算 和显示

影响如何序列化与反序列化


变长类型通过指针类型pointer或指定容量解决
## 🔢 基本类型
| **值形式** | **对应类型** | **字节数** | **说明 / 编码规则** |
|-------------|---------------|----------------------|---------------------|
| `"1:bit"`  `0b1`    | `bit`  | 0.125  | bit类型,仅出现在含中括号的字段里,不解析 |
| `"1:u1"`  `0b1`    | `bit`  | 0.125  | bit类型,仅出现在含中括号的字段里,不解析 |
| `"2:bit[2]"` `0b10`    | `bit[2]`  | 0.25  | bit数组,仅出现在含中括号的字段里,不解析 |
| `"2:u2"` `0b10`    | `bit[2]`  | 0.25  | bit数组,仅出现在含中括号的字段里,不解析 |
| `"true:bool"`    | `bool`  | 1  | 布尔类型 |
| `":enum"` | `enum`| 1| 枚举类型，实际存储为u8 |
| `"3:byte":0x38`    | `byte`   | 1 | 字节类型 |
| `"31,2,3:byte[16]"`  | `byte[16]` |  16    | 字节数组类型，不足补零 |
| `"3:byte[]"`  | `byte[]` |  2+n   | 不定长字节数组类型,可以用于小于64 KB的二进制文件 |
| `"3:u8"`: `0x38`    | `uint8_t`  | 1  | 无符号整数 |
| `"2:u16"`: `0x1238`   | `uint16_t`  | 2 | 小端编码 |
| `"2:u24"`: `0x123811`   | `uint24_t`  | 3 | 小端编码 |
| `"2:u32"`  `0x12382147`  | `uint32_t`  |4  | 小端编码 |
| `"0x1234:pointer"` | `uint32_t` | 4| 指针类型,小端编码|
| `"2:u64"` `0x1234567812345678`   | `uint64_t` | 8  | 小端编码 |
| `"2:U16"`: `0x1238`   | `uint16_t`  | 2 | 大端编码 |
| `"2:U24"`: `0x123811`   | `uint24_t`  | 3 | 大端编码 |
| `"2:U32"`  `0x12382147`  | `uint32_t`  |4  | 大端编码 |
| `"0x1234:Pointer"` | `uint32_t` | 4| 指针类型,大端编码|
| `"2:U64"` `0x1234567812345678`   | `uint64_t` | 8  | 大端编码 |
| `"-3:i8"`    | `int8_t`   |  1| 有符号整数 |
| `"2:i16"`   | `int16_t`|  2  | 小端编码 |
| `"2:i32"`   | `int32_t` | 4  | 小端编码 |
| `"2:i64"`   | `int64_t`| 8   | 小端编码 |
| `"3.1:f16"`    | `__fp16 `   |  2| 半精度浮点数 |
| `"2.0:f32"`   | `float`   | 4| 单精度浮点数 |
| `"2.1:f64"`   | `double ` | 8  | 双精度 |
| `"a:char"`    | `char`  | 1  | 字符类型 |
| `"abc:char[16]"` | `char[16]`|16 |固定长度为16的 ASCII 字符串，不足补零 |
| `"abc:str"` | `char[16]` |16| 固定长度为16的 ASCII 字符串，不足补零 |
| `"abc:char[]"` | `char *`| 2+n| 不定长字符串，前 2 字节为长度，后面为 ASCII 字符 |
| `"abc:string"` | `char *`| 2+n| 不定长字符串，前 2 字节为长度，后面为 ASCII 字符 |
| `"127.0.0.1:ipv4"` |`uint32_t`| 4 | IPv4 地址 |
| `"4:10:10 356:timestamp"` |`uint32_t`| 4 |相对毫秒时间戳 |
| `":event"` | `event`| 8| 32位相对毫秒时间戳+32位事件编码 |
| `":func"` | `func`| 16| 函数类型,实际为char[16] |
| `":file"` | `string`|? |文件 "file:D:/test.html"  或 "https://a/b.bin" 文件本身已内置长度了|
| `":bin"` | `binary` |4+n | 不定长二进制，前 4 字节为长度，后面为内容 |
| `":bytes"` | `binary` |? | 纯二进制,不自含长度,用于定义复合类型,不会单独出现,其长度从其他地方获得 |
| `":object"` | `object` | ?| 对象类型,类型名为Type.field|
| `":array"` | `array` | ?| 数组类型, 类型名为Type.field,实际是第0个元素类型的数组 |
| `":any"` | `any` | ?| 任意类型 |

## 📋 自由的枚举类型
 枚举类型用的很多, j2b的枚举设计的极其自由
```json
{
  "remark": "j2b中自由的枚举类型",
  "agreement": [
      "1. 枚举如何解析是根据枚举的父类型,枚举定义的值类型,枚举定义的值的第一项 决定的"
  ],
  "schema": {
     //枚举1,实际存储是索引
      "HobbyEnum:u8": [
          "抽烟",
          "睡觉",
          "烫头"
      ],
     //枚举2,实际存储是值
      "GenderEnum:u8": {
         "男":1,
         "女":2
      },
      //枚举3,实际存储是键
      "Color1Enum:str": {
        "red":";红;解析第一项决定枚举是键还是值",
        "blue":";蓝"
      },
      //枚举4,实际存储是值
      "Color2Enum:str": {
        "red":"红:str;解析第一项决定枚举是键还是值",
        "blue":"蓝"
      },
      //枚举5,实际存储是键
      "Color3Enum:u16": {
        "0xF800":"红;解析第一项决定枚举是键还是值",
        "0x001F":"蓝"
      },
    //枚举6,实际存储是值
    "Color4Enum:u16": {
      "红":"0xF800",
      "蓝":"0x001F"
    }
  },
  "content": {}
}
```
## 🧱 复合类型（结构体定义）

在 j2b Schema 中，一个 JSON 文件可以定义多个类型，也可以通过 `#include` 引入其他定义文件。  
示例如下：
### 文件名.j2bs.json5
```json
{
  "#include": ["引用的其他类型文件1.j2bs.json5"],
  //Type0是一个颜色枚举类型
  "Type0":"pink,red:enmu",
  //通过 _ 解构Rgb565Color定义
  "Rgb565Color:u16":{
        "_[15:11]": "0;红",
        "_[10:5]": "1;绿",
        "_[4:0]": "5;蓝"
  },
  //ColorEnum和Color2Enum效果一样 
  //都是继承于u8的枚举类型,解析时应兼容这两种风格
  "ColorEnum:u8":{
      "1":"red",
      "2":"orange"
   },
  "Color2Enum:u8":{
      "red":"1",
      "orange":"2"
   },
  "Type1": {
    "field1": "默认值:u16",
    "field2": "默认值:u32"
  },
  //Type2固定为1024字节
  "Type2@,1024": {
    "field1": ":u32",
    //field1的两个bit,忽略解析
    "field1[3:2]": "1:bit[2]",
    // 字段2是长度为 2 的 Type1 数组
    "field2": [":Type1", ":Type1"],
    //字段3 和字段2相同，等价写法
    "field3": ":Type1[2]",
    // 字段4 是不定长 Type1 数组
    // 二进制前需加 2 字节表示数组长度
    "field4": ":Type1[]",
    //field5在解析时会被忽略掉
   "//field5": ":string",
   //field6是一个Type0枚举类型的值
   "field6": "pink:Type0",
    //field7是对象类型,类型名为Type2.field7 
   "field7": {
         "age":"13:u8",
         "name":"zs:str",
     },
    //field8的起始地址是0x00200000容量是64字节
    "field8@0x00200000,64": {
         "age":"13:u8",
         "name":"zs:str",
     }
    //field9的容量是48字节的字节数组
    "field8@,48":"1,2,3:byte[]",
    //field10是长度为4的u8数组
    "field10":"$u8.s(1,2,3,4)"
  }
}
```
### 🪶 特性说明

- `$TypeName` 表示引用其他类型（类似结构体嵌套）  
- `[]` 表示数组，可以定长或不定长  
- `#include` 用于包含其他 JSON 文件定义  
- 同一个文件中可以定义多个类型  

---

# 实例
## 📦 实例1：Boot 文件头结构

下面展示一个完整的例子（文件名 `BootFile.json`），  
它定义了 **文件元信息**（`BootFileMeta`）和 **文件头结构**（`BootFileHeader`）：
### BootFile.j2bs.json
```json
{
  "#include": "BaseType.json",
  "BootFileMeta": {
    "id": "1:u32",
    "startAddr": "2:u32",
    "length": "3:u32",
    "capacity": ":u32",
    "type": "7:char[16]",
    "fileName": ":char[32]",
    "gmtCreate": ":u32",
    "gmtModified": ":u32",
    "comment": ":char[32]",
    "writeOffset#写偏移;这个字段不用持久化": ":u32",
    "readOffset": ":u32",
    "sumCheckCode": ":u32",
    "reserved": ":byte[12]"
  },

  "BootFileHeader": {
    "length": ":u32",
    "capacity": ":u32",
    "fileName": ":str32",
    "gmtCreate": ":u32",
    "gmtModified": ":u32",
    "fileNum": ":u32",
    "comment": ":char[32]",
    "reserved": ":byte[44]",
    "fileMetaList": [
      ":BootFileMeta",
      ":BootFileMeta"
    ]
  }
}
```

等价于以下 C 结构：

```c
struct BootFileMeta {
    uint32_t id;
    uint32_t startAddr;
    uint32_t length;
    uint32_t capacity;
    char type[16];
    char fileName[32];
    uint32_t gmtCreate;
    uint32_t gmtModified;
    char comment[32];
    uint32_t writeOffset;
    uint32_t readOffset;
    uint32_t sumCheckCode;
    uint8_t reserved[12];
};

struct BootFileHeader {
    uint32_t length;
    uint32_t capacity;
    char fileName[32];
    uint32_t gmtCreate;
    uint32_t gmtModified;
    uint32_t fileNum;
    char comment[32];
    uint8_t reserved[44];
    struct BootFileMeta fileMetaList[2];
};
```

---

## 📦 实例2：[vio_uart](https://blog.csdn.net/qq_26074053/article/details/149968390)定长6字节对称协议（一主一从）
```json
{
  "remark": "vio_uart定长6字节对称协议",
  "schema": {
    "CmdTypeEnum": "read,write,rpc:enum;0x00=读,0x01=写,0x02=RPC"
  },
  "agreement": [
    "1.用于fpga调试的6字节的定长协议,必须一问一答",
    "2.数据字段（data）采用小端序（低字节存低地址）",
    "3.cmdType=0/1时，endpoint为寄存器地址（取值0~29）;cmdType=2时，endpoint为RPC方法ID（funcId）",
    "4.读操作（cmdType=0）的data字段填充0x00;写操作（cmdType=1）的data为32位写入数据;RPC（cmdType=2）的data为方法第一个32位参数",
    "5.主机发出的数据包从机必须响应,从机响应完后主机才能发新的数据包",
    "6.rpc调用主机请求的[cmdType,endpoint]和从机响应的[cmdType,endpoint]是一样的",
    "7.fpga侧的rpc处理器请求和响应的参数固定为4个u32,但单次rpc只带了1个参数,如果要用到其他三个参数则要用到寄存器[1~3](请求)和[7~9](响应)"
  ],
  "content": {
    "cmdType": ":u8;命令类型",
    "cmdType[1:0]": "1:CmdTypeEnum;0x00=read,0x01=write,0x02=rpc",
    "cmdType[7:2]": ":bit[6];序号sid,0~63循环,主机生成,从机复用;不用sid固定为0",
    "endpoint": "1:u8;cmdType是2为funcId,cmdType是0,1则是地址",
    "data": "6553147:u32;数据体(小端序传输)"
  }
}
```
## 📦 实例3：一种通用的变长对称协议（一主多从）
```json
{
  "remark": "z8_modman变长对称协议",
  "schema": {
    "Ndata": {
      "length#长度": "10:u16;数据体长度（单位：字节）",
      "type#类型": "1:u16;数据类型标识",
      "data#数据体": "0:bytes;可变长度数据体(长度=length-4)"
    }
  },
  "agreement": [
    "1. 用于上位机驱动液晶屏的变长协议,为了高效传输,一些不重要的功能码无需响应",
    "2. 主从设备协议格式一致,序号（sid）范围0~255循环递增;从机响应时,需复用主机发送的序号(sid)和功能码(funcId)",
    "3. 帧头规则：外部传输时header固定为0xAA55（帧头标识）,内部队列存储时header字段表示帧长度",
    "4. 帧长约束：空NPack固定4字节,因此单包最小长度为「7字节（header+insId+sid+funcId+check）+4字节（空NPack）=11字节」",
    "5. 可自定义一些不重要的功能码无需响应,提高传输效率",
    "6. 因为收发独立,所以下位机产生的按键或编码器的事件,上位机可轮询,可订阅",
    "7. 主机测可控制均匀发出,防止因队列发满,造成阻塞或漏发"
  ],
  "content": {
    "header": "0xAA55:u16;双重含义：外部传输=帧头标识(0xAA55),内部存储=帧长度",
    "insId": "1:u8;实例id",
    "sid": "1:u8;通信序号（0~255循环）,主机生成,从机复用",
    "funcId": "1:u8;功能码（如读写/控制/查询等指令标识）,主机生成,从机复用",
    "data": "0:Ndata;数据区,遵循Ndata子结构定义",
    "check": "0:u16;16位异或校验码,校验范围=[insId,sid,funcId,data]"
  }
}
```
## ⚙️ j2b 的核心目标

- ✅ 用 JSON 定义二进制结构，让格式人可读、机器可解析  
- ✅ 支持多文件、嵌套、引用、定长/变长数组  
- ✅ 可在任意语言中生成结构体或序列化器  
---

## 🧠 和 Protobuf / FlatBuffer对比

| 对比项 | Protobuf / FlatBuffer | j2b Schema |
|---------|-----------------------|-------------|
| 结构定义方式 | 专用语法 | JSON 文件 |
| 工具链依赖 | 必须编译器 | 无需工具链 |
| 可读性 | 较差 | 极高 |
| 嵌入式可用性 | 较差 | 非常好 |
| 动态扩展 | 不方便 | 可直接修改 JSON |
| 跨语言性 | 静态生成 | 动态解析 |

---

## ✨ 总结

> j2b Schema 让“二进制结构”变得像写 JSON 一样简单。  
>  
> 它是一种 **轻量、直观、零依赖** 的通用数据描述语言，  
> 既能用于通信协议、固件格式，也能作为跨语言结构体模板。  
>  
> 让数据格式定义重新回归 —— **“人类可读”** 与 **“机器可解析”** 的统一。
