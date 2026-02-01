[在线verilog转电路图](https://digitaljs.tilk.eu/?#)     

简单门电路 [https://logic.ly/demo/](https://logic.ly/demo/)

# 数学基础
## 普通逻辑
与自然语言关系紧密, 亚里士多德三段论,‌‌[穆勒五法](https://www.baidu.com/s?wd=%E7%A9%86%E5%8B%92%E4%BA%94%E6%B3%95&rsv_idx=2&tn=baiduhome_pg&usm=3&ie=utf-8&rsv_pq=f7c6b3b70e2f451d&oq=%E7%B1%B3%E5%8B%92%E4%BA%94%E6%B3%95&rsv_t=7c0eP4FQ%2FhoZkq6fzyczifMqBzXVTj0uAJZr5X2yc6rd%2BdyfhQdRymvNnp2B%2BEdXR6dS&sa=re_dqa_generate) , 语言, <font style="color:rgb(64, 64, 64);">语义,概念,定义,辩论, 诈骗 等, 是文科类的逻辑。</font>

## 离散数学
不连续数学

### 数理逻辑
命题逻辑与谓词逻辑, 与[数学推理](https://lucd6w.yuque.com/lucd6w/sfwhhr/eeftle?singleDoc#%20《对偶原理与蕴含定理》)关系紧密, 它能简化一些普通逻辑中的描述

### <font style="color:rgb(30, 31, 36);">图论</font>
<font style="color:rgb(30, 31, 36);">二面图,欧拉图,树,哈密顿图</font>

### <font style="color:rgb(30, 31, 36);">组合</font>
<font style="color:rgb(51, 51, 51);">组合计数、组合设计、</font><font style="color:rgb(51, 51, 51);">组合规划</font><font style="color:rgb(51, 51, 51);">,组合几何</font>

### 抽象代数
_研究各种代数系统 _<font style="color:rgb(51, 51, 51);">群,环,域 模,格,线性空间, ,Galois理论,布尔代数等</font>

### 布尔代数
是与门电路直接相关的一种代数

# 物理级 & 开关级
## 真空电子管二极管(1904)
  ![](https://i-blog.csdnimg.cn/direct/0684e32867794eae5fff735c7b7e129c.png)
  ![](https://i-blog.csdnimg.cn/direct/a9b3e84402fe96389d5c55141e7c4ba7.jpeg)



## 电子三极管（1906）
![](https://i-blog.csdnimg.cn/direct/74d9b513700922c09ea8c4be3514fc98.gif)
![](https://i-blog.csdnimg.cn/direct/3bd115dd25b4ae9895411d4d60ad0597.jpeg)

## 晶体三极管（<font style="color:rgb(51, 51, 51);">1947</font>）
![](https://i-blog.csdnimg.cn/direct/84f1be849c425fe984c16db05cd4b28c.jpeg)

## 场效应管
![](https://i-blog.csdnimg.cn/direct/bff92846769828cfe7af5401a75e8313.png)

![](https://i-blog.csdnimg.cn/direct/950d40a9e0612cf0ee1b6d592bdc3a11.png)

N沟道增强型输出曲线

![](https://i-blog.csdnimg.cn/direct/7a678f12d29296320c39d9344fe6d96d.png)

![](https://i-blog.csdnimg.cn/direct/eb543712401176d550115a27d336730b.png)



## 或非门  和  与非门
![](https://i-blog.csdnimg.cn/direct/681f3528572700be04b9a74f20a39bba.png)

主要缺点：

1）输出电阻R0受输入状态影响,即输出电阻不一样，能够相差四倍。如：

A=1, B=1，则R0 = Ron2 + Ron4 = 2Ron

A=0, B=0，则R0 = Ron2 // Ron4 = 1/2Ron

2）输出的高低电平受输入端数目的影响

输入端越多，，串联的驱动管数目也越多，输出的VOL越高，VOH也更高。

当输入端全部为低电平时，输入端越多负载并联的数目越多，输出的高电平VOH也越高。

3）逻辑上与非 ,或非都完备,但工程上与非更好

PMOS采用空穴导电，NMOS采用电子导电，由于PMOS的载流子的迁移率比NMOS的迁移率小，所以，同样尺寸条件下，PMOS的充电时间要大于NMOS的充电时间长。

在互补CMOS电路中，与非门是PMOS管并联，NMOS管串联，而或非门正好相反，所以，同样尺寸条件下，<font style="color:#DF2A3F;">与非门的速度快，所以，在互补CMOS电路中，优先选择与非门。</font>

## 与非门 (数字电路的原子)
![](https://i-blog.csdnimg.cn/direct/92223a3d031eed23e9df2afebd8830f2.png)



# 门级
## 门电路
与非是完备的,只需与非门就可以搭建CPU

![](https://i-blog.csdnimg.cn/direct/7f5b8ce833f85b2a8c2b50cd7225361e.jpeg)
![](https://i-blog.csdnimg.cn/direct/4e38697b13feddb7c435392a605fc953.jpeg)
![](https://i-blog.csdnimg.cn/direct/25594a1af53f520a06337cf39f3af085.jpeg)

![](https://i-blog.csdnimg.cn/direct/a4a0a1854ffd918a237b4c30708ae88c.jpeg)
![](https://i-blog.csdnimg.cn/direct/05c055e6520d9cfcc15ee05427721507.jpeg)
![](https://i-blog.csdnimg.cn/direct/87e04a21d1ce1d4b51d132364086029d.jpeg)

## 锁存器与触发器
锁存器原型

X==Y , 

X=0,Y=0

X=1,Y=1

即使撤去X的输入,Y仍保持撤去X之前的值,电路有记忆功能,所以产生了时序电路

![](https://i-blog.csdnimg.cn/direct/14bcd43d8a8a7f8e93e41cfed2a7ae3d.png)







![](https://i-blog.csdnimg.cn/direct/f5f13bab0c3e557839d25bba9f366554.png)



![](https://i-blog.csdnimg.cn/direct/b7deb9e25adacbe7bf420fcca9bfb404.png)





![](https://i-blog.csdnimg.cn/direct/966eaf13701aaa06adf95730dd3962df.png)



![](https://i-blog.csdnimg.cn/direct/75aa746d9d35b9577c2678b45356c232.png)



![](https://i-blog.csdnimg.cn/direct/943b01a68c2cad97d90baa87f3d82788.png)

![](https://i-blog.csdnimg.cn/direct/d6c8acbb7e5a69d29bf485533398320a.png)

![](https://i-blog.csdnimg.cn/direct/2bd86cdf91901d206858008598ecc193.png)

![](https://i-blog.csdnimg.cn/direct/4b72c5062dbf8623e906c6e248b3e843.png)

![](https://i-blog.csdnimg.cn/direct/44fa99dedee5d6321a11da7d2d409777.png)



![](https://i-blog.csdnimg.cn/direct/40cfc7e5e872eca71996f838de5268b3.png)

# 可编程器件
## 组合逻辑的范式 ROM 
![](https://i-blog.csdnimg.cn/direct/c45d6997f522185ab2800c2123685882.png)
![](https://i-blog.csdnimg.cn/direct/5a647ce8da50d5d7fb59e03b4410f7ee.png)
![](https://i-blog.csdnimg.cn/direct/5d1943796c0337344b6a78e2b8a4470c.png)



## LUT 查找表
ABCD的地址线, RAM存不同的值，则LUT实现不同的逻辑

# ![](https://i-blog.csdnimg.cn/direct/bfc513125a1a359ef353dcde537bd252.png)
## LE   <font style="color:rgb(20, 21, 26);">可编程逻辑单元</font>
![](https://i-blog.csdnimg.cn/direct/471ae9d1776b33c117b07e789d5ab9fa.png)

# systemVerilog
_SystemVerilog是Verilog的超集,用于硬件描述与验证_

## 物理级
<font style="color:rgb(20, 21, 26);">描述了电路的物理实现，包括晶体管的尺寸、布局、连线等。这一层次通常由EDA（电子设计自动化）工具在综合、布局和布线（Place & Route）过程中处理。</font>

## 开关级
<font style="color:rgb(20, 21, 26);">描述了晶体管和开关级别的电路行为。在这一层次，设计者需要考虑晶体管的开关特性，通常用于非常底层的电路设计和分析</font>

大多数fpga不支持开关级描述, modelsim支持

![](https://i-blog.csdnimg.cn/direct/d793f900db3c60a80265759639ffbf9d.png)

| <font style="color:rgb(51, 51, 51);">nmos</font> | <font style="color:rgb(51, 51, 51);">控制端</font> | <font style="color:rgb(51, 51, 51);">输出 </font> | <font style="color:rgb(51, 51, 51);"> 控制端</font> | <font style="color:rgb(51, 51, 51);">输出  </font> | <font style="color:rgb(51, 51, 51);"> </font> | <font style="color:rgb(51, 51, 51);">pmos</font> | <font style="color:rgb(51, 51, 51);">控制端</font> | <font style="color:rgb(51, 51, 51);">输出  </font> | <font style="color:rgb(51, 51, 51);"> 控制端</font> | <font style="color:rgb(51, 51, 51);"> 输出 </font> |
| :---: | :--- | :---: | :--- | :---: | :--- | :---: | :--- | :---: | :--- | :--- |
| <font style="color:rgb(51, 51, 51);"> </font> | <font style="color:rgb(51, 51, 51);">0</font> | <font style="color:rgb(51, 51, 51);">1</font> | <font style="color:rgb(51, 51, 51);">x</font> | <font style="color:rgb(51, 51, 51);">z</font> | <font style="color:rgb(51, 51, 51);"> </font> | <font style="color:rgb(51, 51, 51);"> </font> | <font style="color:rgb(51, 51, 51);">0</font> | <font style="color:rgb(51, 51, 51);">1</font> | <font style="color:rgb(51, 51, 51);">x</font> | <font style="color:rgb(51, 51, 51);">z</font> |
| <font style="color:rgb(51, 51, 51);">0</font> | <font style="color:rgb(51, 51, 51);">z</font> | <font style="color:rgb(51, 51, 51);">0</font> | <font style="color:rgb(51, 51, 51);">0/z</font> | <font style="color:rgb(51, 51, 51);">0/z</font> | <font style="color:rgb(51, 51, 51);"> </font> | <font style="color:rgb(51, 51, 51);">0</font> | <font style="color:rgb(51, 51, 51);">0</font> | <font style="color:rgb(51, 51, 51);">z</font> | <font style="color:rgb(51, 51, 51);">0/z</font> | <font style="color:rgb(51, 51, 51);">0/z</font> |
| <font style="color:rgb(51, 51, 51);">1</font> | <font style="color:rgb(51, 51, 51);">z</font> | <font style="color:rgb(51, 51, 51);">1</font> | <font style="color:rgb(51, 51, 51);">1/z</font> | <font style="color:rgb(51, 51, 51);">1/z</font> | <font style="color:rgb(51, 51, 51);"> </font> | <font style="color:rgb(51, 51, 51);">1</font> | <font style="color:rgb(51, 51, 51);">1</font> | <font style="color:rgb(51, 51, 51);">z</font> | <font style="color:rgb(51, 51, 51);">1/z</font> | <font style="color:rgb(51, 51, 51);">1/z</font> |
| <font style="color:rgb(51, 51, 51);">x</font> | <font style="color:rgb(51, 51, 51);">z</font> | <font style="color:rgb(51, 51, 51);">x</font> | <font style="color:rgb(51, 51, 51);">x</font> | <font style="color:rgb(51, 51, 51);">x</font> | <font style="color:rgb(51, 51, 51);"> </font> | <font style="color:rgb(51, 51, 51);">x</font> | <font style="color:rgb(51, 51, 51);">x</font> | <font style="color:rgb(51, 51, 51);">z</font> | <font style="color:rgb(51, 51, 51);">x</font> | <font style="color:rgb(51, 51, 51);">x</font> |
| <font style="color:rgb(51, 51, 51);">z</font> | <font style="color:rgb(51, 51, 51);">z</font> | <font style="color:rgb(51, 51, 51);">x</font> | <font style="color:rgb(51, 51, 51);">x</font> | <font style="color:rgb(51, 51, 51);">x</font> | <font style="color:rgb(51, 51, 51);"> </font> | <font style="color:rgb(51, 51, 51);">z</font> | <font style="color:rgb(51, 51, 51);">x</font> | <font style="color:rgb(51, 51, 51);">z</font> | <font style="color:rgb(51, 51, 51);">x</font> | <font style="color:rgb(51, 51, 51);">x</font> |


  


```verilog
module MOS_TEST(input CTRL, IN1,
                output OUTN, OUTP);

  //tri
  pmos pmos1           (OUTP, IN1, CTRL) ;
  //no instantiation name
  nmos                 (OUTN, IN1, CTRL) ;
endmodule


/**
# vsim -voptargs="+acc" work.tb 
# Start time: 00:18:54 on Oct 04,2024
# ** Note: (vsim-3813) Design is being optimized due to module recompilation...
# Loading work.tb(fast)
# Loading work.MOS_TEST(fast)
# Time =                    0 : CTRL = 0, IN1 = 0, OUTN = z, OUTP = 0
# Time =                   10 : CTRL = 0, IN1 = 1, OUTN = z, OUTP = 1
# Time =                   20 : CTRL = 1, IN1 = 0, OUTN = 0, OUTP = z
# Time =                   30 : CTRL = 1, IN1 = 1, OUTN = 1, OUTP = z
# Time =                   40 : CTRL = 0, IN1 = 0, OUTN = z, OUTP = 0
# ** Note: $finish    : ../tb.v(25)
#    Time: 50 fs  Iteration: 0  Instance: /tb
**/

// 测试模块
module tb;
  reg CTRL, IN1;
  wire OUTN, OUTP;

  // 实例化被测试模块
  MOS_TEST uut (.CTRL(CTRL), .IN1(IN1), .OUTN(OUTN), .OUTP(OUTP));

  initial begin
    // 初始化输入
    CTRL = 0; IN1 = 0;
    #10; // 等待10个时间单位

    // 测试不同的输入组合
    CTRL = 0; IN1 = 1;
    #10;
    CTRL = 1; IN1 = 0;
    #10;
    CTRL = 1; IN1 = 1;
    #10;
    CTRL = 0; IN1 = 0;
    #10;

    // 结束测试
    $finish;
  end

  // 监视信号变化
  initial begin
    $monitor("Time = %d : CTRL = %b, IN1 = %b, OUTN = %b, OUTP = %b", $time, CTRL, IN1, OUTN, OUTP);
  end
endmodule
```

## 门级
<font style="color:rgb(51, 51, 51);">多路选择器</font>

[在线测试](https://digitaljs.tilk.eu/?#)

<font style="color:rgb(51, 51, 51);">下面对比四选一选择的实现方式，来说明门级建模较行为级建模的繁琐性。</font>

<font style="color:rgb(51, 51, 51);">输入为 A、B、C、D，输出为 F，选择信号为 S1、S0，则 4 路选择器的表达式为：</font>

![](https://i-blog.csdnimg.cn/direct/a061e59f7f9ea91e24c1fe36aa7b101d.png)

![](https://i-blog.csdnimg.cn/direct/905c3246a2491e115d7499e82488d583.png)

下面的门电路的实例没起名字

```verilog
module mux4to1_gate(
      input       A, B, C, D ,
      input       S0, S1,
      output      F );
   //reversing
   wire         S0R, S1R ;
   not  (S0R, S0) ;
   not  (S1R, S1) ;
   //logic and
   wire         AAND, BAND, CAND, DAND ;
   and  (AAND, A, S1R, S0R);
   and  (BAND, B, S1R, S0);
   and  (CAND, C, S1,  S0R);
   and  (DAND, D, S1,  S0);
   //outGate 是or 门的实例名,前面的门没起名字
   or outGate(F, AAND, BAND, CAND, DAND) ;
endmodule
```

门级锁存器

![](https://i-blog.csdnimg.cn/direct/ff9b3754495c62db2516eeeaca7316d4.png)



```verilog
/**
门级
点触B开灯
点触A关灯
**/
module my_latch(
    input  A,  // RESET 信号
    input  B,  // SET 信号
    output C
);
assign C = C & ~A | B ;
endmodule
```



```verilog
/**
门级
点触B开灯
点触A关灯
**/
module my_latch(
    input  A,  // RESET 信号
    input  B,  // SET 信号
   output C
);

wire   w0,w1,w2 ;

not   (w0, A) ;
and  (w2,w0,w1) ;
or   (w1, w2, B) ;

assign C=w1;

endmodule


```

```verilog
module my_latch(
    input  A,  // RESET 信号
    input  B,  // SET 信号
   output C
);
wire   w0,w1,w2 ;
assign w0=~A;
assign w2=w0 && w1;
assign w1=w2||B;
assign C=w1;
endmodule


```



```verilog
module my_latch(
    input  A,  // RESET 信号
    input  B,  // SET 信号
    output reg C
);
always @ (A or B) begin
    if (A) 
        C = 0;   // 如果 A 为高，则复位 C 为 0
    else if (B) 
        C = 1;   // 如果 B 为高，则置位 C 为 1
    else 
        C = C;   // 如果 A 和 B 都为低，则保持 C 的当前状态
end
endmodule
```



梯形图 与上面的数字电路功能上相同

![](https://i-blog.csdnimg.cn/direct/4465520fba18d09327a860d416763231.png)

实物

![](https://i-blog.csdnimg.cn/direct/eb66d77656ac6d3ed167c4609aa5a1da.jpeg)

## <font style="color:rgb(20, 21, 26);">寄存器传输级（RTL）</font>
<font style="color:rgb(20, 21, 26);">RTL描述关注于数据在寄存器之间的流动以及基本的逻辑操作。它使用组合逻辑（如逻辑门、算术运算）和时序逻辑（如触发器、时钟边沿）来描述电路。</font>

<font style="color:rgb(20, 21, 26);">这样的描述更接近于硬件的实现细节</font>

```verilog
module adderRTL(
    input [3:0] a,
    input [3:0] b,
    output [4:0] sum,
    input clk
);

reg [3:0] temp_sum;

always @(posedge clk) begin
    temp_sum <= a + b; // 在时钟边沿更新寄存器
end

assign sum = temp_sum; // 将内部寄存器的值赋给输出

endmodule
```



## 行为级
<font style="color:rgb(20, 21, 26);">行为级描述关注于电路做什么，而不是如何做。它使用高级语言结构（如过程、函数、条件语句、循环等）来描述电路的功能和行为。 行为级代码可能不包含时钟信号,不直接涉及时钟边沿触发的行为。</font>

<font style="color:rgb(20, 21, 26);">模拟电路的元件为电阻，电容，电感,三极管等</font>

<font style="color:rgb(20, 21, 26);">数字电路的元件为  基本门电路, 选择器 ,D触发器, 运算器, 比较器,计数器  等</font>

```verilog
module adder_behavioral(
    input [3:0] a,
    input [3:0] b,
    output reg [4:0] sum
);

always @(*) begin
    sum = a + b; // 简单的行为级描述
end

endmodule
```

```verilog
module mux4to1_behavior(
   input       A, B, C, D ,
   input       S0, S1,
   output      F );
   assign F = {S1, S0} == 2'b00 ? A :
               {S1, S0} == 2'b01 ? B :
               {S1, S0} == 2'b10 ? C :
               {S1, S0} == 2'b11 ? D : 0 ;
endmodule
```



## <font style="color:rgb(20, 21, 26);">系统级</font>
<font style="color:rgb(20, 21, 26);">系统级设计关注于整个系统的功能和性能，通常不涉及具体的硬件实现细节。</font>

```verilog
// 定义一个简单的内存接口
interface MemoryInterface;
    logic [31:0] address;
    logic [31:0] data;
    logic write_enable;
    logic read_enable;
    modport processor (
        output address,
        input data,
        output write_enable,
        output read_enable
    );
endinterface

// 定义一个简单的处理器类
class Processor;
    MemoryInterface mem_if;
    int program_counter;

    function new(MemoryInterface mem_if);
        this.mem_if = mem_if;
        this.program_counter = 0;
    endfunction

    // 处理器执行指令的方法
    function void execute_instruction();
        if (mem_if.read_enable) begin
            // 读取内存中的数据
            mem_if.data = read_from_memory(mem_if.address);
        end
        if (mem_if.write_enable) begin
            // 写数据到内存
            write_to_memory(mem_if.address, mem_if.data);
        end
        // 更新程序计数器
        program_counter++;
    endfunction

    // 模拟从内存读取数据的方法
    function logic [31:0] read_from_memory(input logic [31:0] addr);
        // 这里可以添加内存读取逻辑
        return 32'hDEADBEEF; // 示例数据
    endfunction

    // 模拟向内存写入数据的方法
    function void write_to_memory(input logic [31:0] addr, input logic [31:0] data);
        // 这里可以添加内存写入逻辑
    endfunction
endclass


module top;
    MemoryInterface mem_if();
    Processor proc(mem_if);
    initial begin
        // 初始化内存接口
        mem_if.address = 0;
        mem_if.write_enable = 0;
        mem_if.read_enable = 1;

        // 模拟处理器执行指令
        for (int i = 0; i < 10; i++) begin
            proc.execute_instruction();
            $display("Data read from memory: %h", mem_if.data);
        end
    end
endmodule
```
