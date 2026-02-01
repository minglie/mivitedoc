>这是个固定 24 位指令宽的简洁8位CPU设计,指令集参考经典 [8051指令集](https://aeb.win.tue.nl/comp/8051/set8051.html)。
设计内容包括：
>- 指令集：数据传送、算术逻辑运算、程序控制、堆栈操作等
>- 汇编器：将汇编代码翻译为 24 位机器码
>- CPU ：寄存器、ALU、状态标志、总线结构
>- RAM ：数据存储
>- ROM：程序存储
>- BUS： 连接 CPU、RAM、和外设
>- 例程：函数调用,GPIO,定时器,中断
>- 在 Quartus EP4CE6F17C8 测试 


# 指令集（99条）
>一条指令有三个字节组成,
> - 第1个字节是操作码
> - 第2和3个字节是操作数
> - 如果只有一个操作数,则第二个字节补0
> - 有 内存栈(8位宽)和寄存器栈(16位宽),内存栈用来存参数或存局部变量,寄存器栈用来存函数返回地址
> - 1个指令周期为2~4个机器周期

| 操作码 | 指令类别       | 指令                  | 功能说明                 | 例子            |
|-----|------------|---------------------|----------------------|---------------|
| 1   | **数据传送**   | `MOV A, #imm`       | 立即数 -> 累加器           | MOV A,#5      |
| 2   |            | `MOV A, addr`       | 内存 -> 累加器            | MOV A,10      |
| 3   |            | `MOV addr, A`       | 累加器 -> 内存            | MOV 20,A      |
| 4   |            | `MOV DPTR,  #imm16` | 立即数 ->  数据指针         | MOV DPTR,#300 |
| 5   |            | `MOV DPTR,  PC`     | PC -> 数据指针           | MOV DPTR,PC   |
| 6   |            | `MOV DPTRL, #imm`   | 立即数 -> 数据指针低8位       | MOV DPTRL, #1 |
| 7   |            | `MOV DPTRH, #imm`   | 立即数 -> 数据指针高8位       | MOV DPTRH, #2 |
| 8   |            | `MOV A, DPTRL`      | 数据指针低8位 -> 累加器       | MOV A, DPTRL  |
| 9   |            | `MOV A, DPTRH`      | 数据指针高8位 -> 累加器       | MOV A, DPTRH  |
| 10  |            | `MOV DPTRL, A`      | 累加器 ->数据指针低8位        | MOV DPTRL, A  |
| 11  |            | `MOV DPTRH, A`      | 累加器 -> 数据指针高8位       | MOV DPTRH, A  |
| 12  |            | `MOV A, Ri`         | 寄存器 -> 累加器           | MOV A,R0      |
| 13  |            | `MOV @Ri, A`        | 累加器 -> 指针            | MOV @R1,A     |
| 14  |            | `MOV A, @Ri`        | 指针  -> 累加器           | MOV A,@R1     |
| 15  |            | `MOV @Ri, addr`     | 内存  ->   指针          | MOV @R1,2     |
| 16  |            | `MOV addr, @Ri`     | 指针  ->   内存          | MOV 2,@R1     |
| 17  |            | `MOV @Ri, #imm`     | 立即数 -> 指针            | MOV @R1,#1    |
| 18  |            | `MOV Ri, A`         | 累加器 -> 寄存器           | MOV R1,A      |
| 19  |            | `MOV Ri, #imm`      | 立即数 -> 寄存器           | MOV R2,#15    |
| 20  |            | `MOV Ri, addr`      | 内存 -> 寄存器            | MOV R1,10     |
| 21  |            | `MOV addr,Ri`       | 寄存器-> 内存             | MOV 10,R1     |
| 22  |            | `MOV addr,#imm`     | 立即数-> 内存             | MOV 10,#2     |
| 23  |            | `MOV addr1,addr2`   | 内存-> 内存              | MOV 10,6      |
| 24  |            | `MOV Ri, Rj`        | 寄存器 -> 寄存器           | MOV R1,R2     |
| 25  |            | `MOV SP, #imm`      | 立即数 -> 内存堆栈指针        | MOV SP,#11    |
| 26  |            | `MOV PSW,#imm`      | 立即数 -> PSW           | MOV PSW,#20   |
| 27  |            | `MOV RSP,#imm`      | 立即数 -> 寄存器堆栈指针       | MOV RSP,#0    |
| 28  |            | `MOV A,RSP`         | 寄存器堆栈指针 ->累加器        | MOV A,RSP     |
| 29  |            | `MOV Ri,RSP`        | 寄存器堆栈指针 -> 寄存器       | MOV R0,RSP    |
| 30  |            | `MOV A,B`           | 寄存器B -> 寄存器A          | MOV A,B       |
| 31  |            | `MOV B,A`           | 寄存器A -> 寄存器B         | MOV B,A       |
| 32  | **算术运算**   | `ADD A, #imm`       | 累加器 + 立即数            | ADD A,#2      |
| 33  |            | `ADD A, Ri`         | 累加器 + 寄存器            | ADD A,R1      |
| 34  |            | `ADD A, addr`       | 累加器 + 内存             | ADD A,10      |
| 35  |            | `ADDC A, #imm`      | 带进位加法                | ADDC A,#1     |
| 36  |            | `ADDC A, Rj`        | 带借位加法                | ADDC A,R1     |
| 37  |            | `SUBB A, #imm`      | 带进位减法                | SUBB A,#1     |
| 38  |            | `SUBB A, Rj`        | 带借位减法                | SUBB A,R1     |
| 39  |            | `INC A`             | 累加器 +1               | INC A         |
| 40  |            | `DEC A`             | 累加器 -1               | DEC A         |
| 41  |            | `MUL AB`            | A * B → A=低8位, B=高8位 | MUL AB        |
| 42  |            | `DIV AB`            | A / B → A=商, B=余数    | DIV AB        |
| 43  | **逻辑运算**   | `ANL A,#imm`        | 累加器按位与立即数            | ANL A,#3      |
| 44  |            | `ANL A,Ri`          | 累加器按位与寄存器            | ANL A,R3      |
| 45  |            | `ANL  A,addr`       | 累加器按位与内存             | ANL A,10      |
| 46  |            | `ORL  A,#imm`       | 累加器按位或立即数            | ORL A,#5      |
| 47  |            | `ORL A,Ri`          | 累加器按位或寄存器            | ORL A,R4      |
| 48  |            | `ORL A,addr`        | 累加器按位或内存             | ORL A,20      |
| 49  |            | `XRL A,#imm`        | 累加器按位异或立即数           | XRL A,#3      |
| 50  |            | `XRL A,Ri`          | 累加器按位异或寄存器           | XRL A,R2      |
| 51  |            | `XRL A,addr`        | 累加器按位异或内存            | XRL A,15      |
| 52  | **位操作**    | `CLR  A     #imm`   | 累加器清除掩码位             | CLR  A , #1   |
| 53  |            | `CLR   A , Rj`      | 累加器清除掩码位             | CLR  A , R3   |
| 54  |            | `CLR   Ri ,#imm`    | 寄存器清除掩码位             | CLR  R1,  #1  |
| 55  |            | `CLR   Ri  ,  Rj`   | 寄存器清除掩码位             | CLR  R1 , R3  |
| 56  |            | `CLR   PSW  , #imm` | PSW清除掩码位             | CLR  PSW , #1 |
| 57  |            | `CLR   PSW ,  Rj`   | PSW清除掩码位             | CLR  PSW , R3 |
| 58  |            | `CLR   addr , #imm` | 内存清除掩码位              | CLR  3 , #1   |
| 59  |            | `CLR   addr , Rj`   | 内存清除掩码位              | CLR  3 , R3   |
| 60  |            | `SET   A   ,  #imm` | 累加器置位掩码位             | SET  A,  #1   |
| 61  |            | `SET   A  ,    Rj`  | 累加器置位掩码位             | SET  A , R3   |
| 62  |            | `SET   Ri  ,  #imm` | 寄存器置位掩码位             | SET  R1,  #1  |
| 63  |            | `SET   Ri  ,  Rj`   | 寄存器置位掩码位             | SET  R1 , R3  |
| 64  |            | `SET   PSW ,  #imm` | PSW置位掩码位             | SET  PSW,  #1 |
| 65  |            | `SET   PSW ,  Rj`   | PSW置位掩码位             | SET  PSW , R3 |
| 66  |            | `SET   addr , #imm` | 内存置位掩码位              | SET  3 , #1   |
| 67  |            | `SET   addr ,  Rj`  | 内存置位掩码位              | SET  3 , R3   |
| 68  |            | `CPL   A    , #imm` | 累加器翻转掩码位             | CPL  A , #1   |
| 69  |            | `CPL   A   ,  Rj`   | 累加器 翻转掩码位            | CPL  A , R3   |
| 70  |            | `CPL   Ri  ,  #imm` | 寄存器翻转掩码位             | CPL  R1 , #1  |
| 71  |            | `CPL   Ri  ,  Rj`   | 寄存器翻转掩码位             | CPL  R1,  R3  |
| 72  |            | `CPL   PSW ,  #imm` | PSW翻转掩码位             | CPL  PSW , #1 |
| 73  |            | `CPL   PSW ,  Rj`   | PSW翻转掩码位             | CPL  PSW,  R3 |
| 74  |            | `CPL  addr  , #imm` | 内存翻转掩码位              | CPL  3 , #1   |
| 75  |            | `CPL  addr ,  Rj`   | 内存翻转掩码位              | CPL  3 , R3   |
| 76  | **程序流程**   | `SJMP addr`         | 短跳转                  | SJMP 20       |
| 77  |            | `LJMP addr16`       | 绝对跳转                 | LJMP 300      |
| 78  |            | `JZ  addr`          | A=0 跳转               | JZ 50         |
| 79  |            | `JNZ addr`          | A≠0 跳转               | JNZ 50        |
| 80  |            | `JC  addr`          | C=1 跳转               | JC 30         |
| 81  |            | `JNC addr`          | C=0 跳转               | JNC 30        |
| 82  |            | `JP  addr`          | P=1 跳转               | JP 30         |
| 83  |            | `JNP addr`          | P=0 跳转               | JNP 30        |
| 84  |            | `CALL addr16`       | 调用子程序                | CALL 200      |
| 85  |            | `CALL DPTR`         | 调用子程序                | CALL DPTR     |
| 86  |            | `RET`               | 从子程序返回               | RET           |
| 87  | **内存栈操作**  | `PUSH #imm`         | 立即数入栈,SP+1           | PUSH #10      |
| 88  |            | `PUSH Ri`           | 寄存器入栈,SP+1           | PUSH R1       |
| 89  |            | `PUSH addr`         | RAM[addr]入栈，SP+1     | PUSH 20       |
| 90  |            | `POP Ri`            | 出栈到寄存器,SP-1          | POP R1        |
| 91  |            | `POP addr`          | 出栈到 RAM[addr],SP-1   | POP 20        |
| 92  | **寄存器栈操作** | `RPUSH #imm`        | 立即数入寄存器栈，RSP++       | RPUSH #10     |
| 93  |            | `RPUSH Ri`          | 寄存器入寄存器栈，RSP++       | RPUSH R1      |
| 94  |            | `RPUSH A`           | A 入寄存器栈，RSP++        | RPUSH A       |
| 95  |            | `RPOP  Ri`          | 出栈到寄存器，RSP--         | RPOP R1       |
| 96  |            | `RPOP  A`           | 出栈到 A,RSP--          | RPOP A        |
| 97  | **设置中断地址** | `EXINT addr16`      | 设置外部中断地址             | EXINT 16      |
| 98  |            | `TIMEINT addr16`    | 设置定时器中断地址            | TIMEINT 16    |
| 128 | **空指令**    | `NOP`               | 空指令                  | NOP           |

## asm2rom.js
```js
const fs = require('fs');

// ---------------- 指令表 ----------------
const isa_table = {
    "OP_MOV_A_IMM": ["1", "00", "{imm}"],
    "OP_MOV_A_MEM": ["2", "00", "{addr2}"],
    "OP_MOV_MEM_A": ["3", "00", "{addr1}"],
    "OP_MOV_DPTR_IMM": ["4", "{addr16_h}", "{addr16_l}"],
    "OP_MOV_DPTR_PC":["5","00","00"],
    "OP_MOV_DPTRL_IMM":["6","00","{imm}"],
    "OP_MOV_DPTRH_IMM":["7","00","{imm}"],
    "OP_MOV_A_DPTRL":["8","00","00"],
    "OP_MOV_A_DPTRH":["9","00","00"],
    "OP_MOV_DPTRL_A":["10","00","00"],
    "OP_MOV_DPTRH_A":["11","00","00"],
    "OP_MOV_A_R": ["12", "00", "{j}"],
    "OP_MOV_IND_A": ["13", "00", "{j}"],
    "OP_MOV_A_IND": ["14", "00", "{j}"],
    "OP_MOV_IND_MEM": ["15", "{i}", "{addr2}"],
    "OP_MOV_MEM_IND": ["16", "{addr1}", "{j}"],
    "OP_MOV_IND_IMM": ["17", "{i}", "{imm}"],
    "OP_MOV_R_A": ["18", "00", "{j}"],
    "OP_MOV_R_IMM": ["19", "{i}", "{imm}"],
    "OP_MOV_R_MEM": ["20", "{i}", "{addr2}"],
    "OP_MOV_MEM_R": ["21", "{addr1}", "{j}"],
    "OP_MOV_MEM_IMM": ["22", "{addr1}", "{imm}"],
    "OP_MOV_MEM_MEM": ["23", "{addr1}", "{addr2}"],
    "OP_MOV_R_R": ["24", "{i}", "{j}"],
    "OP_MOV_SP_IMM": ["25", "00", "{imm}"],
    "OP_MOV_PSW_IMM": ["26", "00", "{imm}"],
    "OP_MOV_RSP_IMM":["27","00","{imm}"],
    "OP_MOV_A_RSP":["28","00","00"],
    "OP_MOV_R_RSP":["29","{i}","00"],
    "OP_MOV_A_B":["30","00","00"],
    "OP_MOV_B_A":["31","00","00"],
    "OP_ADD_A_IMM": ["32", "00", "{imm}"],
    "OP_ADD_A_R": ["33", "00", "{j}"],
    "OP_ADD_A_MEM":  ["34", "00", "{addr2}"],
    "OP_ADDC_A_IMM": ["35", "00", "{imm}"],
    "OP_ADDC_A_R":["36", "00", "{j}"],
    "OP_SUBB_A_IMM": ["37", "00", "{imm}"],
    "OP_SUBB_A_R":["38", "00", "{j}"],
    "OP_INC_A": ["39", "00", "00"],
    "OP_DEC_A": ["40", "00", "00"],
    "OP_MUL_AB": ["41", "00", "00"],
    "OP_DIV_AB": ["42", "00", "00"],
    "OP_ANL_A_IMM": ["43", "00", "{imm}"],
    "OP_ANL_A_R": ["44", "00", "{j}"],
    "OP_ANL_A_MEM": ["45", "00", "{addr2}"],
    "OP_ORL_A_IMM": ["46", "00", "{imm}"],
    "OP_ORL_A_R": ["47", "00", "{j}"],
    "OP_ORL_A_MEM": ["48", "00", "{addr2}"],
    "OP_XRL_A_IMM": ["49", "00", "{imm}"],
    "OP_XRL_A_R": ["50", "00", "{j}"],
    "OP_XRL_A_MEM": ["51", "00", "{addr2}"],
    "OP_CLR_A_IMM": ["52", "00", "{imm}"],
    "OP_CLR_A_R": ["53", "00", "{j}"],
    "OP_CLR_R_IMM": ["54", "{i}", "{imm}"],
    "OP_CLR_R_R": ["55", "{i}", "{j}"],
    "OP_CLR_PSW_IMM": ["56", "00", "{imm}"],
    "OP_CLR_PSW_R": ["57", "00", "{j}"],
    "OP_CLR_MEM_IMM": ["58", "{addr1}", "{imm}"],
    "OP_CLR_MEM_R": ["59", "{addr1}", "{j}"],
    "OP_SET_A_IMM": ["60", "00", "{imm}"],
    "OP_SET_A_R": ["61", "00", "{j}"],
    "OP_SET_R_IMM": ["62", "00", "{imm}"],
    "OP_SET_R_R": ["63", "{i}", "{j}"],
    "OP_SET_PSW_IMM": ["64", "00", "{imm}"],
    "OP_SET_PSW_R": ["65", "00", "{j}"],
    "OP_SET_MEM_IMM": ["66", "{addr1}", "{imm}"],
    "OP_SET_MEM_R": ["67", "{addr1}", "{j}"],
    "OP_CPL_A_IMM": ["68", "00", "{imm}"],
    "OP_CPL_A_R": ["69", "00", "{j}"],
    "OP_CPL_R_IMM": ["70", "{i}", "{imm}"],
    "OP_CPL_R_R": ["71", "{i}", "{j}"],
    "OP_CPL_PSW_IMM": ["72", "00", "{imm}"],
    "OP_CPL_PSW_R": ["73", "00", "{j}"],
    "OP_CPL_MEM_IMM": ["74", "{addr1}", "{imm}"],
    "OP_CPL_MEM_R": ["75", "{addr1}", "{j}"],
    "OP_SJMP": ["76","{addr16_h}", "{addr16_l}"],
    "OP_LJMP": ["77", "{addr16_h}", "{addr16_l}"],
    "OP_JZ": ["78", "{addr16_h}", "{addr16_l}"],
    "OP_JNZ": ["79", "{addr16_h}", "{addr16_l}"],
    "OP_JC": ["80", "{addr16_h}", "{addr16_l}"],
    "OP_JNC": ["81","{addr16_h}", "{addr16_l}"],
    "OP_JP": ["82", "{addr16_h}", "{addr16_l}"],
    "OP_JNP": ["83", "{addr16_h}", "{addr16_l}"],
    "OP_CALL": ["84", "{addr16_h}", "{addr16_l}"],
    "OP_CALL_DPTR": ["85","00","00"],
    "OP_RET": ["86", "82", "00"],
    "OP_PUSH_IMM": ["87", "00", "{imm}"],
    "OP_PUSH_R": ["88", "00", "{j}"],
    "OP_PUSH_MEM": ["89", "00", "{addr1}"],
    "OP_POP_R": ["90", "00", "{j}"],
    "OP_POP_MEM": ["91", "00", "{addr1}"],
    "OP_RPUSH_IMM":["92","00","00"],
    "OP_RPUSH_R":["93","00","{j}"],
    "OP_RPUSH_A":["94","00","00"],
    "OP_RPOP_R":["95","00","{j}"],
    "OP_RPOP_A":["96","00","00"],
    "OP_EXINT":["97","{addr16_h}", "{addr16_l}"],
    "OP_TIMEINT":["98","{addr16_h}", "{addr16_l}"],
    "OP_NOP":["128","00","00"],
};

/**
 * 数字全统一到10进制
 * @param line
 * @returns {string|*}
 */
function num2dec(line) {
    const [code, comment] = line.split(/;(.*)/, 2);
    const newCode = code.replace(
        /(#?)(0[xX][0-9a-fA-F]+|0[bB][01]+|\d+)/g,
        (m, sharp, num) => {
            let value;
            if (/^0x/i.test(num)) {
                value = parseInt(num, 16);
            } else if (/^0b/i.test(num)) {
                value = parseInt(num.slice(2), 2);
            } else {
                value = parseInt(num, 10);
            }
            return sharp + value;
        }
    );
    return comment !== undefined ? newCode + ";" + comment : newCode;
}

/**
 * 汇编预处理
 * @param lines
 * @returns {*[]}
 */
function assemblePreprocessing(lines) {
    let memory = [];        // 内存数组
    let pc = 0;             // 当前地址
    const labelMap = {};    // 标签 -> 地址
    //第1遍扫描：删除行注释
    lines=lines.filter(line=>{
        line = line.trim();
        if (!line || line.startsWith('//')||line.startsWith(';')) {
            return false;
        }

        return true;
    })
    // 第2遍扫描：记录标签地址
    lines.forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('//')|| line.startsWith('#')||line.startsWith(';')) return;
        const orgMatch = line.match(/^ORG\s+(\d+)$/i);
        const labelMatch = line.match(/^([a-zA-Z_]\w*):$/);

        if (orgMatch) {
            pc = parseInt(orgMatch[1]);
        } else if (labelMatch) {
            labelMap[labelMatch[1]] = pc;
        } else {
            pc += 1; // 每条指令占一个地址
        }
    });

    // 第3遍扫描：生成内存并填充 NOP
    pc = 0;
    lines.forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('//') || line.endsWith(':')) return;

        const orgMatch = line.match(/^ORG\s+(\d+)$/i);
        if (orgMatch) {
            const newPC = parseInt(orgMatch[1]);
            while (pc < newPC) {  // 填充 NOP
                memory[pc++] = 'NOP';
            }
            pc = newPC;
            return;
        }

        let instr = line;
        // 标签跳转
        const jumpMatch = line.match(/^(EXINT|TIMEINT|CALL|LJMP|JZ|JNZ|JC|JNC|JP|JNP)\s+([a-zA-Z_]\w*)(?:\s*;.*)?$/i);
        if (jumpMatch) {
            const opcode = jumpMatch[1].toUpperCase(); // CALL 或 LJMP
            const label = jumpMatch[2];
            if (!(label in labelMap)) throw new Error(`Label not found: ${label}`);
            const addr = labelMap[label]; // 直接取整数地址
            instr = `${opcode} ${addr}`;  // 第二三字节直接用整数
        }
        instr= instr.replace(/\s+/g, ' ').toUpperCase()
        if(instr.startsWith("SETB C")){
            instr=instr.replaceAll("SETB C","SET PSW,#128")
        }else if(instr.startsWith("SETB XE")){
            instr=instr.replaceAll("SETB XE","SET PSW,#64")
        }else if(instr.startsWith("SETB EA")){
            instr=instr.replaceAll("SETB EA","SET PSW,#32")
        }else if(instr.startsWith("SETB TE")){
            instr=instr.replaceAll("SETB TE","SET PSW,#16")
        }else if(instr.startsWith("SETB TF")){
            instr=instr.replaceAll("SETB TF","SET PSW,#8")
        }else if(instr.startsWith("SETB OV")){
            instr=instr.replaceAll("SETB OV","SET PSW,#4")
        }else if(instr.startsWith("SETB XF")){
            instr=instr.replaceAll("SETB XF","SET PSW,#2")
        }else if(instr.startsWith("SETB P")){
            instr=instr.replaceAll("SETB P","SET PSW,#1")
        }else if(instr.startsWith("CLR C")){
            instr=instr.replaceAll("CLR C","CLR PSW,#128")
        }else if(instr.startsWith("CLR XE")){
            instr=instr.replaceAll("CLR XE","CLR PSW,#64")
        }else if(instr.startsWith("CLR EA")){
            instr=instr.replaceAll("CLR EA","CLR PSW,#32")
        }else if(instr.startsWith("CLR TE")){
            instr=instr.replaceAll("CLR TE","CLR PSW,#16")
        }else if(instr.startsWith("CLR TF")){
            instr=instr.replaceAll("CLR TF","CLR PSW,#8")
        }else if(instr.startsWith("CLR OV")){
            instr=instr.replaceAll("CLR OV","CLR PSW,#4")
        }else if(instr.startsWith("CLR XF")){
            instr=instr.replaceAll("CLR XF","CLR PSW,#2")
        }else if(instr.startsWith("CLR P")){
            instr=instr.replaceAll("CLR P","CLR PSW,#1")
        }
        //统一到10进制
        instr= num2dec(instr);
        memory[pc++] = instr;
    });

    return memory;
}



// ---------------- 工具函数 ----------------
function readAsmFile(filename) {
    let asmCode = fs.readFileSync(filename, "utf8");
    let asmList= asmCode.split('\n');
    asmList= assemblePreprocessing(asmList);
    let asmStr= asmList.join("\n")
    fs.writeFileSync("pure_"+filename,asmStr);
    return asmStr.split(/\r?\n/).map(l => l.split(";")[0].trim()).filter(l => l.length > 0);
}

function extractLabels(lines) {
    let labels = {};
    let addr = 0;
    lines.forEach(l => {
        let m = l.match(/^(\w+):$/);
        if (m) labels[m[1]] = addr;
        else addr++;
    });
    return labels;
}

function cleanOperand(str) {
    return str.replace(/\s+/g, '').toUpperCase();
}

// 根据指令和操作数匹配表中的 key
function matchKey(inst, operand) {
    operand = cleanOperand(operand);
    if (inst === "MOV") {
        if (operand.startsWith("A,B")) return "OP_MOV_A_B";
        if (operand.startsWith("B,A")) return "OP_MOV_B_A";
        if (operand.startsWith("A,RSP")) return "OP_MOV_A_RSP";
        if (operand.startsWith("A,#")) return "OP_MOV_A_IMM";
        if (operand.startsWith("A,R")) return "OP_MOV_A_R";
        if (operand.startsWith("DPTRL,A")) return "OP_MOV_DPTRL_A";
        if (operand.startsWith("DPTRH,A")) return "OP_MOV_DPTRH_A";
        if (operand.startsWith("DPTR,#")) return "OP_MOV_DPTR_IMM";
        if (operand.startsWith("DPTR,PC")) return "OP_MOV_DPTR_PC";
        if (operand.startsWith("DPTRL,#")) return "OP_MOV_DPTRL_IMM";
        if (operand.startsWith("DPTRH,#")) return "OP_MOV_DPTRH_IMM";
        if (operand.startsWith("A,DPTRL")) return "OP_MOV_A_DPTRL";
        if (operand.startsWith("A,DPTRH")) return "OP_MOV_A_DPTRH";
        if (/^A\s*,\s*(h[0-9a-fA-F]+|\d+)$/i.test(operand)) return "OP_MOV_A_MEM";
        if (/^@R([0-7])\s*,\s*A$/i.test(operand)) return "OP_MOV_IND_A";
        if (/^\s*@R([0-7])\s*,\s*#(\d+|0x[0-9a-fA-F]+|h[0-9a-fA-F]+)\s*$/i.test(operand)) return "OP_MOV_IND_IMM";
        if (/^@R([0-7])\s*,\s*(?!A\b).+$/i.test(operand)) return "OP_MOV_IND_MEM";
        if (/^A,@R([0-7])$/i.test(operand)) return "OP_MOV_A_IND";
        if (/^\s*(\d+)\s*,\s*#(\d+)$/i.test(operand)) return "OP_MOV_MEM_IMM";
        if (/^\s*(\d+)\s*,\s*(\d+)$/i.test(operand)) return "OP_MOV_MEM_MEM";
        if (/^\s*((?:\d+|0x[0-9a-fA-F]+|h[0-9a-fA-F]+))\s*,\s*@R([0-7])\s*$/i.test(operand)) return "OP_MOV_MEM_IND";
        if (/^\s*((?:\d+|0x[0-9a-fA-F]+|h[0-9a-fA-F]+))\s*,\s*R([0-7])\s*$/i.test(operand)) return "OP_MOV_MEM_R";
        if (/^R[0-7],A$/.test(operand)) return "OP_MOV_R_A";
        if (operand.endsWith(",A") && !/^R[0-7],A$/.test(operand)) return "OP_MOV_MEM_A";
        if (/^R[0-7],#/.test(operand)) return "OP_MOV_R_IMM";
        if (/^R[0-7],R[0-7]/.test(operand)) return "OP_MOV_R_R";
        if (/^R[0-7],RSP/.test(operand)) return "OP_MOV_R_RSP";
        if (/^R[0-7],/.test(operand)) return "OP_MOV_R_MEM";
        if (/^SP/.test(operand)) return "OP_MOV_SP_IMM";
        if (/^PSW/.test(operand)) return "OP_MOV_PSW_IMM";
        if (/^RSP,#/.test(operand)) return "OP_MOV_RSP_IMM";
    }
    if (inst === "ADD") {
        if (operand.startsWith("A,#")) return "OP_ADD_A_IMM";
        if (operand.startsWith("A,R")) return "OP_ADD_A_R";
        if (operand.startsWith("")) return "OP_ADD_A_MEM";
    }
    if (inst === "ADDC" && operand.startsWith("A,#")) return "OP_ADDC_A_IMM";
    if (inst === "ADDC" && operand.startsWith("A,R")) return "OP_ADDC_A_R";
    if (inst === "SUBB" && operand.startsWith("A,#")) return "OP_SUBB_A_IMM";
    if (inst === "SUBB" && operand.startsWith("A,R")) return "OP_SUBB_A_R";
    if (inst === "INC") return "OP_INC_A";
    if (inst === "DEC") return "OP_DEC_A";
    if (inst === "MUL") return "OP_MUL_AB";
    if (inst === "DIV") return "OP_DIV_AB";
    if (inst === "ANL") {
        if (operand.startsWith("A,#")) return "OP_ANL_A_IMM";
        if (operand.startsWith("A,R")) return "OP_ANL_A_R";
        if (operand.startsWith("")) return "OP_ANL_A_MEM";
    }
    if (inst === "ORL") {
        if (operand.startsWith("A,#")) return "OP_ORL_A_IMM";
        if (operand.startsWith("A,R")) return "OP_ORL_A_R";
        if (operand.startsWith("")) return "OP_ORL_A_MEM";
    }
    if (inst === "XRL") {
        if (operand.startsWith("A,#")) return "OP_XRL_A_IMM";
        if (operand.startsWith("A,R")) return "OP_XRL_A_R";
        if (operand.startsWith("")) return "OP_XRL_A_MEM";
    }
    if (inst === "CLR") {
        if (operand.startsWith("A,#")) return "OP_CLR_A_IMM";
        if (operand.startsWith("A,R")) return "OP_CLR_A_R";
        if (/^R[0-9],#/.test(operand)) return "OP_CLR_R_IMM";
        if (/^R[0-9],R[0-9]/.test(operand)) return "OP_CLR_R_R";
        if (operand.startsWith("PSW,#")) return "OP_CLR_PSW_IMM";
        if (operand.startsWith("PSW,R")) return "OP_CLR_PSW_R";
        if (/^\d+,#/.test(operand)) return "OP_CLR_MEM_IMM";
        if (/^\d+,R[0-9]/.test(operand)) return "OP_CLR_MEM_R";
    }
    if (inst === "SET") {
        if (operand.startsWith("A,#")) return "OP_SET_A_IMM";
        if (operand.startsWith("A,R")) return "OP_SET_A_R";
        if (/^R[0-9],#/.test(operand)) return "OP_SET_R_IMM";
        if (/^R[0-9],R[0-9]/.test(operand)) return "OP_SET_R_R";
        if (operand.startsWith("PSW,#")) return "OP_SET_PSW_IMM";
        if (operand.startsWith("PSW,R")) return "OP_SET_PSW_R";
        if (/^\d+,#/.test(operand)) return "OP_SET_MEM_IMM";
        if (/^\d+,R[0-9]/.test(operand)) return "OP_SET_MEM_R";
    }
    if (inst === "CPL") {
        if (operand.startsWith("A,#")) return "OP_CPL_A_IMM";
        if (operand.startsWith("A,R")) return "OP_CPL_A_R";
        if (/^R[0-9],#/.test(operand)) return "OP_CPL_R_IMM";
        if (/^R[0-9],R[0-9]/.test(operand)) return "OP_CPL_R_R";
        if (operand.startsWith("PSW,#")) return "OP_CPL_PSW_IMM";
        if (operand.startsWith("PSW,R")) return "OP_CPL_PSW_R";
        if (/^\d+,#/.test(operand)) return "OP_CPL_MEM_IMM";
        if (/^\d+,R[0-9]/.test(operand)) return "OP_CPL_MEM_R";
    }
    if (inst === "SJMP") return "OP_SJMP";
    if (inst === "LJMP") return "OP_LJMP";
    if (inst === "JZ") return "OP_JZ";
    if (inst === "JNZ") return "OP_JNZ";
    if (inst === "JC") return "OP_JC";
    if (inst === "JNC") return "OP_JNC";
    if (inst === "JP") return "OP_JP";
    if (inst === "JNP") return "OP_JNP";
    if (inst === "CALL" && operand==="DPTR") return "OP_CALL_DPTR";
    if (inst === "CALL") return "OP_CALL";
    if (inst === "RET") return "OP_RET";
    if (inst === "PUSH") {
        if (/^R[0-7]$/.test(operand)) return "OP_PUSH_R";
        else if (operand.includes("#")) return "OP_PUSH_IMM";
        else return "OP_PUSH_MEM";
    }
    if (inst === "POP") {
        if (/^R[0-7]$/.test(operand)) return "OP_POP_R";
        else return "OP_POP_MEM";
    }
    if (inst === "RPUSH") {
        if (/^R[0-7]$/.test(operand)) return "OP_RPUSH_R";
        else if (operand.includes("#")) return "OP_RPUSH_IMM";
        else return "OP_RPUSH_A";
    }
    if (inst === "RPOP") {
        if (/^R[0-7]$/.test(operand)) return "OP_RPOP_R";
        else return "OP_RPOP_A";
    }
    if (inst === "NOP") {
        return "OP_NOP";
    }
    if(inst==="EXINT"){
        return "OP_EXINT";
    }
    if(inst==="TIMEINT"){
        return "OP_TIMEINT";
    }
    return inst;
}


// 生成 Verilog 24-bit 代码
function generateCode(key, operand, labels) {
    let tpl = isa_table[key];
    if (!tpl) {
        console.error("未定义指令:", key, operand);
        process.exit(1);
    }
    operand = cleanOperand(operand);
    let bytes = tpl.slice();
    for (let i = 0; i < bytes.length; i++) {
        if (bytes[i].includes("{imm}")) {
            // 提取立即数，兼容 "R2,#15" 或 "A,#15"
            let parts = operand.split(",");
            let dataPart = parts.find(p => p.startsWith("#"));
            if (!dataPart) {
                console.error("立即数生成失败:", key, operand);
                process.exit(1);
            }
            let val;
            if (dataPart.includes("#H")) val = parseInt(dataPart.split("#H")[1], 16);
            else val = parseInt(dataPart.split("#")[1], 10);
            if (isNaN(val)) {
                console.error("立即数生成失败:", key, operand);
                process.exit(1);
            }
            bytes[i] = dataPart.includes("#H") ? `8'h${val.toString(16).padStart(2, '0')}` : `8'd${val}`;
        }else if (bytes[i].includes("{addr1}")) {
            let addrVal = operand.split(",")[0];
            bytes[i] = `8'd${Number.parseInt(addrVal)&0xff}`;
        } else if (bytes[i].includes("{addr2}")) {
            let addrVal=null;
            if(operand.includes(",")){
                addrVal = operand.split(",")[1];
            }else {
                addrVal=operand;
            }
            bytes[i] = `8'd${addrVal}`;
        } else if (bytes[i].includes("{addr16_h}")) {
            let val;
            if (operand.includes("#H")) val = parseInt(operand.split("#H")[1], 16);
            else if (operand.includes("#")) val = parseInt(operand.split("#")[1], 10);
            else val = parseInt(operand, 10);
            bytes[i] = `8'h${((val >> 8) & 0xFF).toString(16).padStart(2, '0')}`;
        } else if (bytes[i].includes("{addr16_l}")) {
            let val;
            if (operand.includes("#H")) val = parseInt(operand.split("#H")[1], 16);
            else if (operand.includes("#")) val = parseInt(operand.split("#")[1], 10);
            else val = parseInt(operand, 10);
            bytes[i] = `8'h${(val & 0xFF).toString(16).padStart(2, '0')}`;
        } else if (bytes[i].includes("{i}")) {
            let regVal = null;
            let m =  operand.match(/R([0-7])/); // R0~R7
            if (m) {
                if(m.length==2){
                    regVal = parseInt(m[1], 10);
                }
            }
            if (regVal === null || isNaN(regVal)) {
                console.error("寄存器索引生成失败:", key, operand);
                process.exit(1);
            }
            bytes[i] = `8'd${regVal}`;
        } else if (bytes[i].includes("{j}")) {
            let regVal = null;
            let m =  operand.match(/R([0-7])/); // R0~R7
            if (m) {
                if(m.length==2){
                    regVal = parseInt(m[1], 10);
                }
                if(m.length==4){
                    regVal = parseInt(m[3], 10);
                }
            }
            if (regVal === null || isNaN(regVal)) {
                console.error("寄存器索引生成失败:", key, operand);
                process.exit(1);
            }
            bytes[i] = `8'd${regVal}`;
        } else {
            bytes[i] = `8'd${bytes[i].padStart(2, '0')}`;
        }
    }

    return `{${bytes.join(",")}}`;
}


// ---------------- 主程序 ----------------
function asm2rom(filename) {
    let lines = readAsmFile(filename);
    let labels = extractLabels(lines);

    let rom = [];
    lines.forEach(l => {
        if (l.match(/^\w+:$/)) return;
        if(l.trim().startsWith("#")) return;
        let parts = l.trim().split(/\s+/);
        let inst = parts[0].toUpperCase();
        let operand = parts.slice(1).join('');
        let key = matchKey(inst, operand);
        let code = generateCode(key, operand, labels);
        rom.push({code, asm: l});
    });

    let romV = `// rom.v - auto generated by asm2rom.js
module rom #(
    parameter P_CLK_FREQ = 50_000_000
)(
    input wire i_clk,
    input wire i_rst_n,
    input wire [15:0] i_addr,
    output reg [23:0] o_data
);
always @(posedge i_clk or negedge i_rst_n) begin
    if(!i_rst_n) o_data <= 24'd0;
    else begin
        case(i_addr)
${rom.map((r, i) => `        16'd${i.toString(10).padStart(5, '0')}: o_data <= ${r.code}; // ${r.asm}`).join('\n')}
            default: o_data <= {8'd128,8'd00,8'd00};//NOP
        endcase
    end
end
endmodule
`;

    fs.writeFileSync("rom.v", romV);
    console.log("rom.v 生成完成，共 " + rom.length + " 条指令");
}

asm2rom("main.asm");

```
##  汇编输入文件 main.asm
```js
MOV A,#5
MOV A,10
```
##  汇编输出文件 rom.v
```c
// rom.v - auto generated by asm2rom.js
module rom #(
    parameter P_CLK_FREQ = 50_000_000
)(
    input wire i_clk,
    input wire i_rst_n,
    input wire [15:0] i_addr,
    output reg [23:0] o_data
);
always @(posedge i_clk or negedge i_rst_n) begin
    if(!i_rst_n) o_data <= 24'd0;
    else begin
        case(i_addr)
        16'd00000: o_data <= {8'd01,8'd00,8'd5}; // MOV A,#5
        16'd00001: o_data <= {8'd02,8'd00,8'd10}; // MOV A,10
            default: o_data <= {8'd128,8'd00,8'd00};//NOP
        endcase
    end
end
endmodule

```
# m8_cpu_isa.vh
```verilog
`ifndef M8_CPU_ISA_VH
`define M8_CPU_ISA_VH

// ============================================================
// CPU ISA Opcode Definition
// 指令宽度: 24bit
// [23:16] opcode
// [15:8]  op1
// [7:0]   op2
// ============================================================

// MOV A,#5
`define OP_MOV_A_IMM        8'd1
// MOV A,10
`define OP_MOV_A_MEM        8'd2
//MOV 20,A
`define OP_MOV_MEM_A        8'd3
// MOV DPTR,#300
`define OP_MOV_DPTR_IMM     8'd4
//MOV DPTR,  PC
`define OP_MOV_DPTR_PC      8'd5
//MOV DPTRL, #1
`define OP_MOV_DPTRL_IMM    8'd6
//MOV DPTRH, #2
`define OP_MOV_DPTRH_IMM    8'd7
//MOV A, DPTRL
`define OP_MOV_A_DPTRL      8'd8
//MOV A, DPTRH
`define OP_MOV_A_DPTRH      8'd9
//MOV DPTRL,A
`define OP_MOV_DPTRL_A      8'd10
//MOV DPTRH,A
`define OP_MOV_DPTRH_A      8'd11
// MOV A,R0
`define OP_MOV_A_R          8'd12
// MOV @R1,A
`define OP_MOV_IND_A        8'd13
// MOV A,@R1
`define OP_MOV_A_IND        8'd14
// MOV @R1,2
`define OP_MOV_IND_MEM      8'd15
// MOV 2,@R1
`define OP_MOV_MEM_IND      8'd16
// MOV @R1,#1
`define OP_MOV_IND_IMM      8'd17
// MOV R1,A
`define OP_MOV_R_A          8'd18
// MOV R2,#15
`define OP_MOV_R_IMM        8'd19
// MOV R1,10
`define OP_MOV_R_MEM        8'd20
// MOV 10,R1
`define OP_MOV_MEM_R        8'd21
//MOV 10,#2
`define OP_MOV_MEM_IMM       8'd22
//MOV 10,6
`define OP_MOV_MEM_MEM       8'd23
// MOV R1,R2
`define OP_MOV_R_R          8'd24
// MOV SP,#11
`define OP_MOV_SP_IMM       8'd25
//MOV PSW,#20
`define OP_MOV_PSW_IMM      8'd26
// MOV RSP,#0
`define OP_MOV_RSP_IMM      8'd27
// MOV A,RSP
`define OP_MOV_A_RSP        8'd28
//MOV R0,RSP
`define OP_MOV_R_RSP        8'd29
//MOV A,B
`define OP_MOV_A_B          8'd30
//MOV B,A
`define OP_MOV_B_A          8'd31
// ADD A,#2
`define OP_ADD_A_IMM        8'd32
//ADD A,R1
`define OP_ADD_A_R          8'd33
// ADD A,10
`define OP_ADD_A_MEM        8'd34
//ADDC A,#1
`define OP_ADDC_A_IMM       8'd35
//ADDC A,R1
`define OP_ADDC_A_R         8'd36
// SUBB A,#1
`define OP_SUBB_A_IMM       8'd37
//SUBB A,R1
`define OP_SUBB_A_R         8'd38
// INC A
`define OP_INC_A            8'd39
// DEC A
`define OP_DEC_A            8'd40
// MUL AB
`define OP_MUL_AB           8'd41
// DIV AB
`define OP_DIV_AB           8'd42
// ANL A,#3
`define OP_ANL_A_IMM        8'd43
// ANL A,R3
`define OP_ANL_A_R          8'd44
// ANL A,10
`define OP_ANL_A_MEM        8'd45
// ORL A,#5
`define OP_ORL_A_IMM        8'd46
// ORL A,R4
`define OP_ORL_A_R          8'd47
// ORL A,20
`define OP_ORL_A_MEM        8'd48
// XRL A,#3
`define OP_XRL_A_IMM        8'd49
// XRL A,R2
`define OP_XRL_A_R          8'd50
// XRL A,15
`define OP_XRL_A_MEM        8'd51
//CLR  A , #1
`define OP_CLR_A_IMM        8'd52
//CLR  A , R3
`define OP_CLR_A_R          8'd53
//CLR  R1 , #1
`define OP_CLR_R_IMM        8'd54
 //CLR  R1,  R3
`define OP_CLR_R_R          8'd55
 //CLR  PSW,  #1
`define OP_CLR_PSW_IMM      8'd56
 //CLR  PSW , R3
`define OP_CLR_PSW_R        8'd57
 //CLR  3 , #1
`define OP_CLR_MEM_IMM      8'd58
 //CLR  3 , R3
`define OP_CLR_MEM_R        8'd59
 // SET  A , #1
`define OP_SET_A_IMM        8'd60
 //SET  A , R3
`define OP_SET_A_R          8'd61
 // SET  R1 , #1
`define OP_SET_R_IMM        8'd62
 // SET  R1 , R3
`define OP_SET_R_R          8'd63
 // SET  PSW , #1
`define OP_SET_PSW_IMM      8'd64
 //SET  PSW , R3
`define OP_SET_PSW_R        8'd65
 //SET  3 , #1
`define OP_SET_MEM_IMM      8'd66
 //SET  3 , R3
`define OP_SET_MEM_R        8'd67
 // CPL  A , #1
`define OP_CPL_A_IMM        8'd68
 //CPL  A , R3
`define OP_CPL_A_R          8'd69
 //CPL  R1 , #1
`define OP_CPL_R_IMM        8'd70
 //CPL  R1 , R3
`define OP_CPL_R_R          8'd71
 // CPL  PSW , #1
`define OP_CPL_PSW_IMM      8'd72
 // CPL  PSW , R3
`define OP_CPL_PSW_R        8'd73
 // CPL  3 , #1
`define OP_CPL_MEM_IMM      8'd74
 //CPL  3 , R3
`define OP_CPL_MEM_R        8'd75
// SJMP 20
`define OP_SJMP             8'd76
// LJMP 300
`define OP_LJMP             8'd77
// JNZ 50
`define OP_JZ               8'd78
// JNZ addr8
`define OP_JNZ              8'd79
// JC 30
`define OP_JC               8'd80
// JNC 30
`define OP_JNC              8'd81
// JP 30
`define OP_JP               8'd82
// JNP 30
`define OP_JNP              8'd83
// CALL 200
`define OP_CALL             8'd84
// CALL DPTR
`define OP_CALL_DPTR        8'd85
// RET
`define OP_RET              8'd86
// PUSH #10
`define OP_PUSH_IMM         8'd87
// PUSH R1
`define OP_PUSH_R           8'd88
//  PUSH 20
`define OP_PUSH_MEM         8'd89
// POP R1
`define OP_POP_R            8'd90
//POP 20
`define OP_POP_MEM          8'd91
// RPUSH #10
`define OP_RPUSH_IMM        8'd92
// RPUSH R1
`define OP_RPUSH_R          8'd93
//RPUSH A
`define OP_RPUSH_A          8'd94
// RPOP R1
`define OP_RPOP_R           8'd95
//RPOP A
`define OP_RPOP_A           8'd96
// EXINT 16
`define OP_EXINT            8'd97
//TIMEINT 16
`define OP_TIMEINT          8'd98
//NOP
`define OP_NOP              8'd128
`endif // M8_CPU_ISA_VH

```
#  m8_cpu.v
```c
`include "m8_cpu_isa.vh"

module m8_cpu #(
        parameter P_CLK_FREQ = 50_000_000,
        //定时器分频(1ms)
        parameter P_CLK_TIME_DIV= 1000
    )(
        input  wire        i_clk,
        input  wire        i_rst_n,

        // ROM
        output reg  [15:0] o_rom_addr,
        input  wire [23:0] i_rom_data,

        // RAM
        output reg         o_ram_we,
        output reg  [7:0]  o_ram_addr,
        output reg  [7:0]  o_ram_wdata,
        input  wire [7:0]  i_ram_rdata,
        //外部上升沿中断
        input     i_ex_intr
    );

    // ---------------- Registers ----------------
    reg [15:0]  r_PC;
    reg [7:0]   r_A, r_B;           // 累加器、B寄存器
    reg [7:0]   r_R[0:7];//通用寄存器
    reg [15:0]  r_stack[0:7];//寄存器栈
    /**
     *   PSW = [  C | XE | EA | TE | TF | OV | XF |  P ]
     *            7    6    5    4     3    2    1    0
     */
    localparam L_C      = 3'd7,//进位 借位
               L_XE       =3'd6,//外部中断允许
               L_EA     = 3'd5,//总中断使能
               L_TE     = 3'd4,//定时器中断允许
               L_TF     = 3'd3,//定时器中断标志
               L_OV     = 3'd2,//溢出标志
               L_XF     = 3'd1,//外部中断标志
               L_P     = 3'd0;//奇偶校验位,A寄存器1的个数为奇数时P=1,偶数时 P=0

    reg [7:0]  r_PSW;
    reg [7:0]  r_SP;//内存栈指针
    reg [7:0]  r_RSP;//寄存器栈指针
    reg [15:0] r_DPTR;
    reg [15:0] r_EX_INTR_ADDR;//外部中断地址
    reg [15:0] r_TIME_INTR_ADDR;//内部定时器中断地址
    reg [7:0]  r_ir, r_op1, r_op2;
    reg [1:0]  r_state;
    reg [7:0]  r_state_cnt;


    localparam L_FETCH      = 2'd0,//取指
               L_EXEC       = 2'd1,//执行
               L_MEM_RD     = 2'd2,//读RAM
               L_MEM_WR     = 2'd3;//写RAM

    reg [7:0] r_mem_data_out;
    reg signed [7:0] r_jmp_off;
    integer i;
    always @(*) begin
        o_rom_addr=r_PC;
        r_ir = i_rom_data[23:16];   // 指令号 1~39
        r_op1 = i_rom_data[15:8];
        r_op2 = i_rom_data[7:0];
    end

    //-----------------------------------------------------
    // 外部中断信号产生
    //-----------------------------------------------------
    reg r_ex_intr_dly;
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            r_ex_intr_dly <= 1'b0;
        else
            r_ex_intr_dly <= i_ex_intr;
    end
    //外部中断标志
    wire w_ex_intr_flag=i_ex_intr && !r_ex_intr_dly;



    //-----------------------------------------------------
    // 内部定时器中断信号产生
    //-----------------------------------------------------
    localparam L_TIME_CNT_MAX = P_CLK_FREQ / P_CLK_TIME_DIV;
    reg [31:0] r_time_cnt;
    always @(posedge i_clk or negedge i_rst_n) begin
        if(!i_rst_n)
            r_time_cnt <= 'd0;
        else if(r_time_cnt == L_TIME_CNT_MAX-1)
            r_time_cnt <= 'd0;
        else
            r_time_cnt <= r_time_cnt + 1;
    end
    //定时器中断标志
    wire w_time_intr_flag=r_time_cnt ==L_TIME_CNT_MAX-1 || r_PSW[L_TF];


    // ---------------- Sequential Logic ----------------
    always @(posedge i_clk or negedge i_rst_n) begin
        if(!i_rst_n) begin
            r_PC <= 16'd0;
            r_A <= 8'd0;
            r_B <= 8'd0;
            r_PSW <= 8'd0;
            r_SP <= 8'd0;
            r_RSP<= 8'd0;
            r_DPTR <= 16'd0;
            r_EX_INTR_ADDR<=0;
            r_TIME_INTR_ADDR<=0;
            o_ram_we <= 1'b0;
            o_ram_addr <= 8'd0;
            o_ram_wdata <= 8'd0;
            r_state <= L_FETCH;
            r_state_cnt<=0;
            r_jmp_off <= 8'd0;
            for(i=0;i<8;i=i+1)
                r_R[i]<=8'd0;
        end
        else begin
            o_ram_we <= 1'b0; // 默认不写 RAM
            r_state_cnt<=r_state_cnt+1;
            //外部中断
            if(w_ex_intr_flag && r_PSW[L_EA]  && r_PSW[L_XE]) begin
                r_PSW[L_XF] <= 1;
            end
            //定时器中断
            if(w_time_intr_flag && r_PSW[L_EA]  && r_PSW[L_TE]) begin
                r_PSW[L_TF] <= 1;
            end
            //当前状态更新到上个状态
            case(r_state)
                // ---------------- FETCH ----------------
                L_FETCH: begin
                    if(r_ir>=`OP_SJMP && r_ir<=`OP_JNC)
                        r_jmp_off <= $signed(r_op2[7:0]);
                    //如果程序执行完,则重新执行
                    if(i_rom_data==0) begin
                        r_PC<=0;
                        r_state <= L_FETCH;
                    end
                    else  begin
                        r_state <= L_EXEC;
                    end
                end
                // ---------------- EXEC ----------------
                L_EXEC: begin
                    if (!(r_ir==`OP_LJMP || r_ir==`OP_SJMP || r_ir==`OP_CALL || r_ir==`OP_RET)) begin
                        r_PC <= r_PC + 1;
                    end
                    //默认下次取指
                    r_state <= L_FETCH;
                    //外部中断
                    if(r_PSW[L_XF]  && r_PSW[L_EA]  && r_PSW[L_XE]) begin
                        r_PSW[L_XF]<=0;
                        r_stack[r_RSP[2:0]] <= r_PC;
                        r_RSP <= r_RSP + 1;   // 栈顶指针上移
                        r_PC <= r_EX_INTR_ADDR;  //跳转中断服务
                        r_state <= L_FETCH;
                    end
                    //定时器中断
                    else if(r_PSW[L_TF] && r_PSW[L_EA]  && r_PSW[L_TE]) begin
                        r_PSW[L_TF]<=0;
                        r_stack[r_RSP[2:0]] <= r_PC;
                        r_RSP <= r_RSP + 1;   // 栈顶指针上移
                        r_PC <= r_TIME_INTR_ADDR;  //跳转中断服务
                        r_state <= L_FETCH;
                    end
                    else
                    case(r_ir)
                        // ---------------- 数据传送 ----------------
                        // MOV A,#5
                        `OP_MOV_A_IMM:
                            r_A <= r_op2;
                        // MOV A,10
                        `OP_MOV_A_MEM:  begin
                            o_ram_addr <= r_op2;
                            r_state <= L_MEM_RD;
                        end
                        // MOV 20,A
                        `OP_MOV_MEM_A:  begin
                            o_ram_addr <= r_op2;
                            r_mem_data_out <= r_A;
                            r_state <= L_MEM_WR;
                        end
                        // MOV DPTR,#300
                        `OP_MOV_DPTR_IMM:
                            r_DPTR <= {r_op1,r_op2};
                        //MOV DPTR, PC
                        `OP_MOV_DPTR_PC:
                            r_DPTR <= r_PC;
                        ///MOV DPTRL, #1
                        `OP_MOV_DPTRL_IMM:
                            r_DPTR[7:0]<=r_op2;
                        //MOV DPTRH, #2
                        `OP_MOV_DPTRH_IMM:
                            r_DPTR[15:8]<=r_op2;
                        //MOV A, DPTRL
                        `OP_MOV_A_DPTRL:
                            r_A<= r_DPTR[7:0];
                        //MOV A, DPTRH
                        `OP_MOV_A_DPTRH:
                            r_A<= r_DPTR[15:8];
                        //MOV DPTRL, A
                        `OP_MOV_DPTRL_A:
                            r_DPTR[7:0]<=r_A;
                        //MOV DPTRH, A
                        `OP_MOV_DPTRH_A:
                            r_DPTR[15:8]<=r_A;
                        // MOV A,R0
                        `OP_MOV_A_R:
                            r_A <= r_R[r_op2[2:0]];
                        //MOV @R1,A
                        `OP_MOV_IND_A: begin
                            o_ram_addr <= r_R[r_op2[2:0]];
                            r_mem_data_out <= r_A;
                            r_state <= L_MEM_WR;
                        end
                        //MOV A,@R1
                        `OP_MOV_A_IND:  begin
                            o_ram_addr <= r_R[r_op2[2:0]];
                            r_state <= L_MEM_RD;
                        end
                        //MOV @R1,2
                        `OP_MOV_IND_MEM: begin
                            o_ram_addr <= r_op2;
                            r_state <= L_MEM_RD;
                        end
                        //MOV 2,@R1
                        `OP_MOV_MEM_IND: begin
                            o_ram_addr <= r_R[r_op2[2:0]];
                            r_state <= L_MEM_RD;
                        end
                        //MOV @R1,#1
                        `OP_MOV_IND_IMM: begin
                            o_ram_addr <=  r_R[r_op1[2:0]];
                            r_mem_data_out <= r_op2;
                            r_state <= L_MEM_WR;
                        end
                        //MOV R1,A
                        `OP_MOV_R_A: begin
                            r_R[r_op2[2:0]] <= r_A;
                        end
                        //MOV R2,#15
                        `OP_MOV_R_IMM:
                            r_R[r_op1[2:0]] <= r_op2;
                        // MOV R1,10
                        `OP_MOV_R_MEM:  begin
                            o_ram_addr <= r_op2;
                            r_state <= L_MEM_RD;
                        end
                        // MOV 10,R1
                        `OP_MOV_MEM_R: begin
                            o_ram_addr <= r_op1;
                            r_mem_data_out <= r_R[r_op2[2:0]];
                            r_state <= L_MEM_WR;
                        end
                        //MOV 10,#2
                        `OP_MOV_MEM_IMM: begin
                            o_ram_addr <= r_op1;
                            r_mem_data_out <= r_op2;
                            r_state <= L_MEM_WR;
                        end
                        //MOV 10,6
                        `OP_MOV_MEM_MEM: begin
                            o_ram_addr <= r_op2;
                            r_state <= L_MEM_RD;
                        end
                        // MOV R1,R2
                        `OP_MOV_R_R:
                            r_R[r_op1[2:0]] <= r_R[r_op2[2:0]];
                        //MOV SP,#11
                        `OP_MOV_SP_IMM:
                            r_SP <= r_op2;
                        //MOV PSW,#20
                        `OP_MOV_PSW_IMM:
                            r_PSW <= r_op2;
                        `OP_MOV_RSP_IMM:
                            r_RSP <= r_op2;
                        `OP_MOV_A_RSP:
                            r_A<= r_RSP;
                        `OP_MOV_R_RSP:
                            r_R[r_op1[2:0]]<= r_RSP;
                        `OP_MOV_A_B:
                            r_A<= r_B;
                        `OP_MOV_B_A:
                            r_B<=r_A;
                        // ---------------- 算术 ----------------
                        // ADD A,#2
                        `OP_ADD_A_IMM: begin
                            {r_PSW[L_C], r_A} <= r_A + r_op2;
                            r_PSW[L_P] <= ^((r_A + r_op2) & 8'hFF);
                        end
                        // ADD A,R1
                        `OP_ADD_A_R: begin
                            {r_PSW[L_C], r_A} <= r_A + r_R[r_op2[2:0]];
                            r_PSW[L_P] <= ^((r_A + r_R[r_op2[2:0]]) & 8'hFF);
                        end
                        // ADD A,10
                        `OP_ADD_A_MEM: begin
                            {r_PSW[L_C], r_A} <= r_A + i_ram_rdata;
                            r_PSW[L_P] <= ^((r_A + i_ram_rdata)& 8'hFF);
                        end
                        // ADDC A,#1
                        `OP_ADDC_A_IMM: begin
                            {r_PSW[L_C], r_A} <= r_A + r_op2 + r_PSW[L_C];
                            r_PSW[L_P] <= ^((r_A + r_op2 + r_PSW[L_C]) & 8'hFF);
                        end
                        // ADDC A,R1
                        `OP_ADDC_A_R: begin
                            {r_PSW[L_C], r_A} <= r_A + r_R[r_op2[2:0]] + r_PSW[L_C];
                            r_PSW[L_P] <= ^((r_A + r_R[r_op2[2:0]] + r_PSW[L_C]) & 8'hFF);
                        end
                        // SUBB A,#3
                        `OP_SUBB_A_IMM: begin
                            {r_PSW[L_C], r_A} <= r_A - r_op2 - r_PSW[L_C];
                            r_PSW[L_P] <= ^((r_A - r_op2 - r_PSW[L_C]) & 8'hFF);
                        end
                        // SUBB A,R1
                        `OP_SUBB_A_R: begin
                            {r_PSW[L_C], r_A} <= r_A - r_R[r_op2[2:0]] - r_PSW[L_C];
                            r_PSW[L_P] <= ^((r_A - r_R[r_op2[2:0]] - r_PSW[L_C]) & 8'hFF);
                        end
                        // INC A
                        `OP_INC_A: begin
                            r_A <= r_A + 1;
                            r_PSW[L_P] <= ^(( r_A + 1)& 8'hFF);
                        end
                        // DEC A
                        `OP_DEC_A: begin
                            r_A <= r_A - 1;
                            r_PSW[L_P] <= ^(( r_A - 1)& 8'hFF);
                        end
                        // MUL AB
                        `OP_MUL_AB:
                            {r_B, r_A} <= r_A * r_B;
                        // DIV AB
                        `OP_DIV_AB:
                            if(r_B!=0) begin
                                r_A <= r_A / r_B;
                                r_B <= r_A % r_B;
                            end
                        // ---------------- 逻辑 ----------------
                        // ANL A,#3
                        `OP_ANL_A_IMM:
                            r_A <= r_A & r_op2;
                        // ANL A,R3
                        `OP_ANL_A_R:
                            r_A <= r_A & r_R[r_op2[2:0]];
                        // ANL A,10
                        `OP_ANL_A_MEM:
                            r_A <= r_A & i_ram_rdata;
                        // ORL A,#5
                        `OP_ORL_A_IMM:
                            r_A <= r_A | r_op2;
                        // ORL A,R4
                        `OP_ORL_A_R:
                            r_A <= r_A | r_R[r_op2[2:0]];
                        // ORL A,20
                        `OP_ORL_A_MEM:
                            r_A <= r_A | i_ram_rdata;
                        // XRL A,#3
                        `OP_XRL_A_IMM:
                            r_A <= r_A ^ r_op2;
                        // XRL A,15
                        `OP_XRL_A_R:
                            r_A <= r_A ^ i_ram_rdata;
                        // XRL A,R2
                        `OP_XRL_A_MEM:
                            r_A <= r_A ^ r_R[r_op2[2:0]];
                        // ---------------- 位操作 ----------------
                        //CLR  A , #1
                        `OP_CLR_A_IMM:
                            r_A <= r_A & ~r_op2;
                        //CLR  A , R3
                        `OP_CLR_A_R:
                            r_A <= r_A & ~r_R[r_op2[2:0]];
                        //CLR  R1 , #1
                        `OP_CLR_R_IMM:
                            r_R[r_op1[2:0]] <= r_R[r_op1[2:0]] & ~r_op2;
                        //CLR  R1,  R3
                        `OP_CLR_R_R:
                            r_R[r_op1[2:0]] <= r_R[r_op1[2:0]] & ~r_R[r_op2[2:0]];
                        //CLR  PSW,  #1
                        `OP_CLR_PSW_IMM:
                            r_PSW <= r_PSW & ~r_op2;
                        //CLR  PSW , R3
                        `OP_CLR_PSW_R:
                            r_PSW <= r_PSW & ~r_R[r_op2[2:0]];
                        //CLR  3,#1
                        `OP_CLR_MEM_IMM: begin
                            o_ram_addr <= r_op1;
                            r_state <= L_MEM_RD;
                        end
                        //CLR  3,R3
                        `OP_CLR_MEM_R: begin
                            o_ram_addr <= r_op1;
                            r_state <= L_MEM_RD;
                        end
                        // SET  A , #1
                        `OP_SET_A_IMM: begin
                            r_A <= r_A | r_op2;
                        end
                        //SET  A , R3
                        `OP_SET_A_R:
                            r_A <= r_A | r_R[r_op2[2:0]];
                        // SET  R1 , #1
                        `OP_SET_R_IMM:
                            r_R[r_op1[2:0]] <= r_R[r_op1[2:0]] | r_op2;
                        // SET  R1 , R3
                        `OP_SET_R_R:
                            r_R[r_op1[2:0]] <= r_R[r_op1[2:0]] | r_R[r_op2[2:0]];
                        // SET  PSW , #1
                        `OP_SET_PSW_IMM: begin
                            r_PSW <= r_PSW | r_op2;
                        end
                        //SET  PSW , R3
                        `OP_SET_PSW_R:
                            r_PSW <= r_PSW | r_R[r_op2[2:0]];
                        //SET  3 , #1
                        `OP_SET_MEM_IMM: begin
                            o_ram_addr <= r_op1;
                            r_state <= L_MEM_RD;
                        end
                        //SET  3 , R3
                        `OP_SET_MEM_R: begin
                            o_ram_addr <= r_op1;
                            r_state <= L_MEM_RD;
                        end
                        // CPL  A , #1
                        `OP_CPL_A_IMM:
                            r_A <= r_A ^ r_op2;
                        //CPL  A , R3
                        `OP_CPL_A_R:
                            r_A <= r_A ^ r_R[r_op2[2:0]];
                        //CPL  R1 , #1
                        `OP_CPL_R_IMM:
                            r_R[r_op1[2:0]] <= r_R[r_op1[2:0]] ^ r_op2;
                        //CPL  R1 , R3
                        `OP_CPL_R_R:
                            r_R[r_op1[2:0]] <= r_R[r_op1[2:0]]^r_R[r_op2[2:0]];
                        // CPL  PSW , #1
                        `OP_CPL_PSW_IMM:
                            r_PSW <= r_PSW ^ r_op2;
                        // CPL  PSW , R3
                        `OP_CPL_PSW_R:
                            r_PSW <= r_PSW ^ r_R[r_op2[2:0]];
                        // CPL  3 , #1
                        `OP_CPL_MEM_IMM: begin
                            o_ram_addr <= r_op1;
                            r_state <= L_MEM_RD;
                        end
                        //CPL  3 , R3
                        `OP_CPL_MEM_R: begin
                            o_ram_addr <= r_op1;
                            r_state <= L_MEM_RD;
                        end
                        // ---------------- 跳转 ----------------
                        // SJMP 20
                        `OP_SJMP:
                            r_PC <= r_PC + {{8{r_jmp_off[7]}}, r_jmp_off};
                        // LJMP 300
                        `OP_LJMP:
                            r_PC <= {r_op1,r_op2};
                        // JZ 50
                        `OP_JZ:
                            if(r_A==0)
                                r_PC <= {r_op1,r_op2};
                        // JNZ 50
                        `OP_JNZ:
                            if(r_A!=0)
                                r_PC <= {r_op1,r_op2};
                        // JC 30
                        `OP_JC:
                            if(r_PSW[L_C])
                                r_PC <= {r_op1,r_op2};
                        //JNC 30
                        `OP_JNC:
                            if(!r_PSW[L_C])
                                r_PC <= {r_op1,r_op2};
                        // JP 30
                        `OP_JP:
                            if(r_PSW[L_P])
                                r_PC <= {r_op1,r_op2};
                        //JNP 30
                        `OP_JNP:
                            if(!r_PSW[L_P])
                                r_PC <= {r_op1,r_op2};
                        // CALL 200
                        `OP_CALL: begin
                            r_stack[r_RSP[2:0]] <= r_PC + 1;
                            r_RSP <= r_RSP + 1;          // 栈顶指针上移
                            r_PC <= {r_op1,r_op2};       //跳转
                            r_state <= L_FETCH;
                        end
                        // RET
                        `OP_RET: begin
                            if (r_RSP > 0) begin
                                r_PC <= r_stack[r_RSP - 1]; // 先读栈顶
                                r_RSP <= r_RSP - 1;         // 再减栈顶指针
                            end
                            else begin
                                r_PC <= 0;
                            end
                            r_state <= L_FETCH;
                        end
                        // PUSH #10
                        `OP_PUSH_IMM: begin
                            o_ram_addr <= r_SP;
                            r_mem_data_out <= r_op2;
                            r_state <= L_MEM_WR;
                            r_SP <= r_SP + 1;

                        end
                        // PUSH R1
                        `OP_PUSH_R: begin
                            o_ram_addr <= r_SP;
                            r_mem_data_out <= r_R[r_op2[2:0]];
                            r_state <= L_MEM_WR;
                            r_SP <= r_SP + 1;

                        end
                        // PUSH 20
                        `OP_PUSH_MEM: begin
                            o_ram_addr <= r_SP;
                            r_mem_data_out <= i_ram_rdata;
                            r_state <= L_MEM_WR;
                            r_SP <= r_SP + 1;
                        end
                        // POP R1
                        `OP_POP_R:
                            r_R[r_op2[2:0]] <= i_ram_rdata;
                        // POP 20 (占位, L_MEM_RD 会读取)
                        `OP_POP_MEM:
                            o_ram_addr <= r_op2;
                        //RPUSH #10
                        `OP_RPUSH_IMM: begin
                            r_stack[r_RSP] <= r_op2;
                            r_RSP <= r_RSP+1;
                        end
                        //RPUSH R1
                        `OP_RPUSH_R   : begin
                            r_stack[r_RSP] <= r_R[r_op2[2:0]];
                            r_RSP <= r_RSP+1;
                        end
                        //RPUSH R1
                        `OP_RPUSH_A   : begin
                            r_stack[r_RSP] <= r_A;
                            r_RSP <= r_RSP+1;
                        end
                        //RPOP R1
                        `OP_RPOP_R   : begin
                            r_R[r_op2[2:0]] <=  r_stack[r_RSP];
                            r_RSP <= r_RSP-1;
                        end
                        //RPOP R1
                        `OP_RPOP_A : begin
                            r_A <=  r_stack[r_RSP];
                            r_RSP <= r_RSP-1;
                        end
                        // EXINT 16
                        `OP_EXINT:
                            r_EX_INTR_ADDR<={r_op1,r_op2};
                        // TIMEINT 16
                        `OP_TIMEINT:
                            r_TIME_INTR_ADDR<={r_op1,r_op2};
                        //NOP
                        `OP_NOP   : begin
                            r_A <= r_A;
                        end
                        default:
                            ;
                    endcase
                end
                // ---------------- MEM READ ----------------
                L_MEM_RD: begin
                    //读到A
                    if(r_ir==`OP_MOV_A_MEM||r_ir==`OP_MOV_A_IND) begin
                        r_A <= i_ram_rdata;
                        r_state <= L_FETCH;
                    end
                    //读到寄存器
                    else if(r_ir==`OP_MOV_R_MEM) begin
                        r_R[r_op1[2:0]] <= i_ram_rdata;
                        r_state <= L_FETCH;
                    end
                    //内存到指针
                    else if(r_ir==`OP_MOV_IND_MEM)  begin
                        o_ram_addr <= r_R[r_op1[2:0]] ;
                        r_mem_data_out <= i_ram_rdata;
                        r_state <= L_MEM_WR;
                    end
                    //指针到内存 或 内存到内存
                    else if(r_ir==`OP_MOV_MEM_IND || r_ir==`OP_MOV_MEM_MEM)  begin
                        o_ram_addr <= r_op1 ;
                        r_mem_data_out <= i_ram_rdata;
                        r_state <= L_MEM_WR;
                    end
                    //清0位操作
                    else if(r_ir==`OP_CLR_MEM_IMM)  begin
                        o_ram_addr <= r_op1 ;
                        r_mem_data_out <= i_ram_rdata & ~ r_op2;
                        r_state <= L_MEM_WR;
                    end
                    //清0位操作
                    else if(r_ir==`OP_CLR_MEM_R)  begin
                        o_ram_addr <= r_op1 ;
                        r_mem_data_out <= i_ram_rdata & ~r_R[r_op2[2:0]];
                        r_state <= L_MEM_WR;
                    end
                    //置1位操作
                    else if(r_ir==`OP_SET_MEM_IMM)  begin
                        o_ram_addr <= r_op1 ;
                        r_mem_data_out <= i_ram_rdata | r_op2;
                        r_state <= L_MEM_WR;
                    end
                    //置1位位操作
                    else if(r_ir==`OP_SET_MEM_R)  begin
                        o_ram_addr <= r_op1 ;
                        r_mem_data_out <= i_ram_rdata | r_R[r_op2[2:0]];
                        r_state <= L_MEM_WR;
                    end
                    //翻转位操作
                    else if(r_ir==`OP_CPL_MEM_IMM)  begin
                        o_ram_addr <= r_op1 ;
                        r_mem_data_out <= i_ram_rdata ^ r_op2;
                        r_state <= L_MEM_WR;
                    end
                    //翻转位位操作
                    else if(r_ir==`OP_CPL_MEM_R)  begin
                        o_ram_addr <= r_op1 ;
                        r_mem_data_out <= i_ram_rdata ^ r_R[r_op2[2:0]];
                        r_state <= L_MEM_WR;
                    end
                end
                // ---------------- MEM WRITE ----------------
                L_MEM_WR: begin
                    o_ram_we <= 1'b1;
                    o_ram_wdata <= r_mem_data_out;
                    r_state <= L_FETCH;
                end

            endcase
        end
    end
endmodule

```
# ram.v
```c
module ram #(
    parameter P_RAM_DEPTH = 32,        // RAM 深度（字节数）
    parameter P_CLK_FREQ = 50_000_000,   // 系统时钟频率（Hz）
    parameter P_ADDR_WIDTH =$clog2(P_RAM_DEPTH)
)(
    input  wire        i_clk,
    input  wire        i_rst_n,
    input  wire        i_we,
    input  wire [P_ADDR_WIDTH-1:0]  i_addr,
    input  wire [7:0]  i_wdata,
    output reg  [7:0]  o_rdata
);

    reg [7:0] r_mem [0:P_RAM_DEPTH-1];
    // 初值,用于仿真
    integer idx;
    initial begin
       for(idx = 0; idx < P_RAM_DEPTH; idx = idx + 1)  r_mem[idx] = 8'd0;
    end
    // ---------------- 同步写 ----------------
    always @(posedge i_clk or negedge i_rst_n) begin
        if(!i_rst_n) begin
           for(idx = 0; idx < P_RAM_DEPTH; idx = idx + 1) r_mem[idx] = 8'd0;
        end else begin
           if (i_we && i_addr < P_RAM_DEPTH)
                r_mem[i_addr] <= i_wdata;
        end
    end

   // ---------------- 组合读 ----------------
   always @(*) begin
      if(i_we)
          o_rdata = i_wdata;
      else if(i_addr < P_RAM_DEPTH)
          o_rdata = r_mem[i_addr];
      else
          o_rdata = 8'd0;
   end

endmodule

```
# gpio.v
```verilog
/**
 * ============================================================
 * Module Name : gpio
 * Description :
 *   Memory-mapped GPIO peripheral (RAM-style interface)
 *
 *   - True bidirectional GPIO (inout)
 *   - DATA / DIR / SET / CLR registers
 *   - Per-bit interrupt with edge select
 *   - Simple, CPU-friendly, single-cycle access
 *
 * Register Map :
 *
 *   0x0 DATA   [R/W]  GPIO data register
 *   0x1 DIR    [R/W]  Direction register (0=output, 1=input)
 *   0x2 SET    [W]    Write-1-to-set DATA bits
 *   0x3 CLR    [W]    Write-1-to-clear DATA bits
 *   0x4 IE     [R/W]  Interrupt enable
 *   0x5 IEDGE  [R/W]  Interrupt edge select (1=rising,0=falling)
 *   0x6 IPEND  [R/W1C]Interrupt pending (write 1 to clear)
 *
 * ============================================================
 */

module gpio #(
    parameter P_GPIO_WIDTH = 8,
    parameter P_ADDR_WIDTH = 3          //地址宽度
)(
    input  wire                   i_clk,
    input  wire                   i_rst_n,

    // CPU 总线接口
    input  wire                   i_we,
    input  wire [P_ADDR_WIDTH-1:0] i_addr,
    input  wire [7:0]             i_wdata,
    output reg  [7:0]             o_rdata,
    // GPIO 引脚
    inout  wire [P_GPIO_WIDTH-1:0] io_gpio,
    // 中断输出
    output wire                   o_irq
);

    // ---------------------------------------------------------
    // GPIO 寄存器
    // ---------------------------------------------------------
    reg [P_GPIO_WIDTH-1:0] r_data;    // DATA
    reg [P_GPIO_WIDTH-1:0] r_dir;     // DIR

    reg [P_GPIO_WIDTH-1:0] r_ie;      // Interrupt Enable
    reg [P_GPIO_WIDTH-1:0] r_iedge;   // Edge select
    reg [P_GPIO_WIDTH-1:0] r_ipend;   // Interrupt Pending

    // GPIO 输入同步（用于边沿检测）
    reg [P_GPIO_WIDTH-1:0] r_gpio_d;

    // ---------------------------------------------------------
    // 同步写寄存器
    // ---------------------------------------------------------
    always @(posedge i_clk or negedge i_rst_n) begin
        if(!i_rst_n) begin
            r_data  <= 0;
            //默认输入
            r_dir   <= {P_GPIO_WIDTH{1'b1}};
            r_ie    <= 0;
            r_iedge <= 0;
            r_ipend <= 0;
            r_gpio_d<= 0;
        end else begin
            // 保存上一拍 GPIO，用于边沿检测
            r_gpio_d <= io_gpio;

            // ---- GPIO 中断检测 ----
            r_ipend <= r_ipend | (
                r_ie &
                (
                    ( r_iedge & (~r_gpio_d &  io_gpio)) | // 上升沿
                    (~r_iedge & ( r_gpio_d & ~io_gpio))   // 下降沿
                )
            );

            // ---- CPU 写寄存器 ----
            if(i_we) begin
                case(i_addr)
                    3'd0: r_data <= i_wdata;
                    3'd1: r_dir  <= i_wdata;
                    3'd2: r_data <= r_data |  i_wdata;
                    3'd3: r_data <= r_data & ~i_wdata;
                    3'd4: r_ie   <= i_wdata;
                    3'd5: r_iedge<= i_wdata;
                    3'd6: r_ipend<= r_ipend & ~i_wdata; // W1C
                    default: ;
                endcase
            end
        end
    end

    // ---------------------------------------------------------
    // 组合读（RAM 风格）
    // ---------------------------------------------------------
    always @(*) begin
        if(i_we) begin
            o_rdata = i_wdata; // 写直通
        end else begin
            case(i_addr)
                3'd0: o_rdata = io_gpio;   // 读真实引脚电平
                3'd1: o_rdata = r_dir;
                3'd4: o_rdata = r_ie;
                3'd5: o_rdata = r_iedge;
                3'd6: o_rdata = r_ipend;
                default: o_rdata = 8'd0;
            endcase
        end
    end

    // ---------------------------------------------------------
    // GPIO 三态输出控制
    // ---------------------------------------------------------
    genvar i;
    generate
        for(i = 0; i < P_GPIO_WIDTH; i = i + 1) begin : GPIO_IO
            assign io_gpio[i] = r_dir[i] ? 1'bz: r_data[i];
        end
    endgenerate

    // ---------------------------------------------------------
    // 中断输出（OR 汇总）
    // ---------------------------------------------------------
    assign o_irq = |r_ipend;

endmodule

```
# bus.v
```verilog
module bus#(
     parameter P_CLK_FREQ = 50_000_000   // 系统时钟频率（Hz）
)(
    input  wire       i_clk,
    input  wire       i_rst_n,
    input  wire       i_we,       // 全局写使能
    input  wire [7:0] i_addr,
    input  wire [7:0] i_wdata,
    output reg  [7:0] o_rdata
);

    // 两个 RAM,1个gpio
    wire [7:0] w_rdata0, w_rdata1,w_rdata2;
    reg[2:0]   r_sel;
    //---------------- 总线选择 ----------------
    always @(*) begin
        if(i_addr < 32) begin
            o_rdata = w_rdata0;
            r_sel   = 3'd0;
        end
        else if(i_addr < 64) begin
            o_rdata = w_rdata1;
            r_sel   = 3'd1;
        end
        else if(i_addr < 72) begin
            o_rdata = w_rdata2;
            r_sel   = 3'd2;
        end
        else begin
            o_rdata = 8'd0;
            r_sel   = 3'd7;
        end
    end

    ram #(
        .P_RAM_DEPTH(32)
    ) u_ram0 (
        .i_clk(i_clk),
        .i_rst_n(i_rst_n),
        .i_we(i_we && r_sel==3'd0), //ram0 地址范围 0~31
        .i_addr(i_addr[4:0]),
        .i_wdata(i_wdata),
        .o_rdata(w_rdata0)
    );

    ram #(
        .P_RAM_DEPTH(32)
    ) u_ram1 (
        .i_clk(i_clk),
        .i_rst_n(i_rst_n),
        .i_we(i_we && r_sel==3'd1),  //ram1 地址范围 32~63
        .i_addr(i_addr[4:0]),
        .i_wdata(i_wdata),
        .o_rdata(w_rdata1)
    );

    gpio u_gpio (
        .i_clk(i_clk),
        .i_rst_n(i_rst_n),
        .i_we(i_we && r_sel==3'd2),  //ram1 地址范围 64~71
        .i_addr(i_addr[2:0]),
        .i_wdata(i_wdata),
        .o_rdata(w_rdata2)
    );
endmodule

```
# rom.v
```verilog
// rom.v - auto generated by asm2rom.js
module rom #(
    parameter P_CLK_FREQ = 50_000_000
)(
    input wire i_clk,
    input wire i_rst_n,
    input wire [15:0] i_addr,
    output reg [23:0] o_data
);
always @(posedge i_clk or negedge i_rst_n) begin
    if(!i_rst_n) o_data <= 24'd0;
    else begin
        case(i_addr)
        16'd00000: o_data <= {8'd01,8'd00,8'd5}; // MOV A,#5
        16'd00001: o_data <= {8'd02,8'd00,8'd10}; // MOV A,10
            default: o_data <= 24'h000000;
        endcase
    end
end
endmodule
```

# tb.sv
```verilog
`timescale 1ns/1ps

module tb;

    // ---------------- Parameter ----------------
    parameter P_CLK_FREQ = 50_000_000; // 时钟频率

    // ---------------- Reg/Wire ----------------
    reg         r_clk;
    reg         r_rst_n;
    reg         r_ex_intr;
    wire [15:0] w_rom_addr;
    wire [23:0] w_rom_data;

    wire        w_ram_we;
    wire [7:0]  w_ram_addr;
    wire [7:0]  w_ram_wdata;
    wire [7:0]  w_ram_rdata;

    // 系统时钟
    initial r_clk = 0;
    always #(1000_000_000/P_CLK_FREQ/2) r_clk = ~r_clk;

    //产生1个外部中断
   initial begin
       r_ex_intr = 0;
       forever begin
           // 中断周期（比如 ~10 个 CPU 周期，但不对齐）
           #(200);
           // 产生一次外部中断脉冲
           r_ex_intr = 1;
           #(100);
           r_ex_intr = 0;
       end
   end

    // ---------------- DUT ----------------
    m8_cpu #(
        .P_CLK_FREQ(P_CLK_FREQ),
        .P_CLK_TIME_DIV(5000000)
    ) u_m8_cpu (
        .i_clk(r_clk),
        .i_rst_n(r_rst_n),
        .o_rom_addr(w_rom_addr),
        .i_rom_data(w_rom_data),
        .o_ram_we(w_ram_we),
        .o_ram_addr(w_ram_addr),
        .o_ram_wdata(w_ram_wdata),
        .i_ram_rdata(w_ram_rdata),
        .i_ex_intr(r_ex_intr)
    );

    // ---------------- ROM ----------------
    rom #(
        .P_CLK_FREQ(P_CLK_FREQ)
    ) u_rom (
        .i_clk(r_clk),
        .i_rst_n(r_rst_n),
        .i_addr(w_rom_addr),
        .o_data(w_rom_data)
    );

    // ---------------- bus ----------------
    bus #(
        .P_CLK_FREQ(P_CLK_FREQ)
    ) u_bus (
        .i_clk(r_clk),
        .i_rst_n(r_rst_n),
        .i_we(w_ram_we),
        .i_addr(w_ram_addr),
        .i_wdata(w_ram_wdata),
        .o_rdata(w_ram_rdata)
    );

    // ---------------- Reset ----------------
    initial begin
        r_rst_n = 0;
        #2;
        r_rst_n = 1;
    end

    // ---------------- Simulation stop ----------------
    initial begin
        #1000; // 仿真时间，可根据需要调整
        $stop;
    end

      // ---------------------------------
    // VCD 波形输出（关键）
    // ---------------------------------
    /**
    initial begin
        $dumpfile("clock_div.vcd"); // 生成的波形文件名
        $dumpvars(0, tb);           // dump 整个 tb 层级
    end
    **/

endmodule

```
# 例程
## 四则运算
```bash
ORG 0
;加 1+2
MOV R0,#1
MOV A,#2
ADD A,R0
MOV R1,A

;减 10-1
MOV R0,#1
MOV A,#10
SUBB A,R0
MOV R1,A

;乘 3*7
MOV A,#3
MOV B,A
MOV A,#7
MUL AB
MOV R1,A

;除以 48/7
MOV A,#7
MOV B,A
MOV A,#48
DIV AB
MOV R1,A
```

## 多层函数的嵌套调用
```c
ORG 0
MOV A,#1
MOV A,#2
CALL test01
MOV A,#7
MOV A,#8
NOP
NOP
ORG 15
;1层子函数
test01:
MOV A,#3
CALL test02
MOV A,#6
RET

ORG 30
;2层子函数
test02:
MOV A,#4
MOV A,#5
RET
```
## 比较大小
```bash
ORG 0
    MOV R1, #3        ; R1 = 3
    MOV R2, #7        ; R2 = 7
    MOV A, R1         ; 把 R1 放入累加器 A
    CLR C;
    SUBB A, R2        ; A - R2 - CY ，带借位
    JC  R1_lt_R2       ; 如果 CY=1，说明 R1 < R2
    JNC R1_ge_R2      ; 如果 CY=0，说明 R1 >= R2
    NOP

ORG 20
R1_lt_R2:
    MOV A, #1         ; R1 < R2 时 A=1
    LJMP LOOP
R1_ge_R2:
    MOV A, #2         ; R1 >= R2 时 A=2
    LJMP LOOP

LOOP:
    LJMP LOOP         ; 无限循环
```
## bus测试
//A 是2312 循环
```bash
MOV 0, #1
MOV 1, #2
MOV 2, #3
MOV A, 1
MOV A, 2
MOV 44, #1
MOV 45, #2
MOV A, 44
MOV A, 45
LJMP 0
```
## 定时器中断测试
```bash
ORG 0
SETB EA;
SETB TE;
TIMEINT TIME_INTER;
LOOP:
    LJMP LOOP         ; 无限循环

ORG 20
;定时器中断
TIME_INTER:
    INC A
    RET

```

## 外部中断测试
```bash
ORG 0
SETB EA;
SETB XE;
EXINT EXINT;
LOOP:
    LJMP LOOP         ; 无限循环

ORG 20
;外部中断
EXINT:
    INC A
    RET
```
## GPIO测试
```bash
;gpio.0~7 默认全输入
MOV 65, #255
;gpio.0 设置为输出
CLR 65, #1
LOOP:
    CPL 64,#1  ;64.0 翻转
    CALL Delay; 延时
    LJMP LOOP  ; 无限循环
;延时函数
Delay:
MOV A,#5
Delay_LOOP:
DEC A
JNZ Delay_LOOP
RET
```
# Quartus EP4CE6F17C8 测试 
## readme.md
> bus.v 不通用
```bash
# 导入文件
```shell
set rtl_dir  D:/workspace/gitee/2/minicpu/m8_cpu
set_global_assignment -name VERILOG_FILE  $rtl_dir/m8_cpu.v
set_global_assignment -name VERILOG_FILE  $rtl_dir/gpio.v
set_global_assignment -name VERILOG_FILE  $rtl_dir/ram.v
set_global_assignment -name VERILOG_FILE  $rtl_dir/rom.v
set_global_assignment -name VERILOG_FILE  $rtl_dir/example/ax301/HC_FPGA_Demo_Top.v
set_global_assignment -name VERILOG_FILE  $rtl_dir/example/ax301/bus.v
set_global_assignment -name VERILOG_FILE  $rtl_dir/example/ax301/clock_div.v
```


## HC_FPGA_Demo_Top.v
```verilog
module HC_FPGA_Demo_Top
(
    input CLOCK_XTAL_50MHz,
	input RESET,
	input  KEY2,
    output LED0,
    output LED1
);
    localparam P_CLK_FREQ = 1_000;
    wire w_ex_intr;
    wire [7:0]  w_io_gpio;
    wire [15:0] w_rom_addr;
    wire [23:0] w_rom_data;
    wire        w_ram_we;
    wire [7:0]  w_ram_addr;
    wire [7:0]  w_ram_wdata;
    wire [7:0]  w_ram_rdata;
    wire w_o_clk;

    //系统时钟1KHZ
    clock_div#(
        .P_CLK_DIV_CNT(50000)
    ) u_clock_div(
        .i_clk(CLOCK_XTAL_50MHz),
        .i_rst_n(RESET),
        .o_clk_div(w_o_clk)
    );

 // ---------------- DUT ----------------
    m8_cpu #(
        .P_CLK_FREQ(P_CLK_FREQ),
        .P_CLK_TIME_DIV(1)
    ) u_m8_cpu (
        .i_clk(w_o_clk),
        .i_rst_n(RESET),
        .o_rom_addr(w_rom_addr),
        .i_rom_data(w_rom_data),
        .o_ram_we(w_ram_we),
        .o_ram_addr(w_ram_addr),
        .o_ram_wdata(w_ram_wdata),
        .i_ram_rdata(w_ram_rdata),
        .i_ex_intr(w_ex_intr)
    );

    // ---------------- ROM ----------------
    rom #(
        .P_CLK_FREQ(P_CLK_FREQ)
    ) u_rom (
        .i_clk(w_o_clk),
        .i_rst_n(RESET),
        .i_addr(w_rom_addr),
        .o_data(w_rom_data)
    );

    // ---------------- bus ----------------
    bus #(
        .P_CLK_FREQ(P_CLK_FREQ)
    ) u_bus (
        .i_clk(w_o_clk),
        .i_rst_n(RESET),
        .i_we(w_ram_we),
        .i_addr(w_ram_addr),
        .i_wdata(w_ram_wdata),
        .o_rdata(w_ram_rdata),
        .io_gpio(w_io_gpio)
    );

    assign LED0=w_io_gpio[0];
    assign LED1=w_o_clk;
endmodule


```
## clock_div.v
> 系统时钟分频到1KHZ
```verilog
`timescale 1ns / 1ps
module clock_div#(
    parameter P_CLK_DIV_CNT = 2 //MAX = 65535
)(
    input    i_clk     ,
    input    i_rst_n     ,
    output   o_clk_div
    );
reg         ro_clk_div ;

reg  [15:0] r_cnt      ;
assign o_clk_div = ro_clk_div;

localparam [15:0] L_COMPARE_CNT = P_CLK_DIV_CNT/2 - 1;

always @(posedge i_clk or negedge i_rst_n)begin
    if(!i_rst_n)
        r_cnt <= 'd0;
    else if(r_cnt == L_COMPARE_CNT)
        r_cnt <= 'd0;
    else
        r_cnt <= r_cnt + 1;
end

always @(posedge i_clk or negedge i_rst_n)begin
    if(!i_rst_n)
        ro_clk_div <= 'd0;
    else if(r_cnt == L_COMPARE_CNT)
        ro_clk_div <= ~ro_clk_div;
    else
        ro_clk_div <= ro_clk_div;
end

endmodule


```

## bus.v
```verilog
module bus#(
     parameter P_CLK_FREQ = 50_000_000   // 系统时钟频率（Hz）
)(
    input  wire       i_clk,
    input  wire       i_rst_n,
    input  wire       i_we,       // 全局写使能
    input  wire [7:0] i_addr,
    input  wire [7:0] i_wdata,
    output reg  [7:0] o_rdata,
    inout  wire [7:0] io_gpio
);

    // 两个 RAM,1个gpio
    wire [7:0] w_rdata0, w_rdata1,w_rdata2;
    reg[2:0]   r_sel;
    //---------------- 总线选择 ----------------
    always @(*) begin
        if(i_addr < 32) begin
            o_rdata = w_rdata0;
            r_sel   = 3'd0;
        end
        else if(i_addr < 64) begin
            o_rdata = w_rdata1;
            r_sel   = 3'd1;
        end
        else if(i_addr < 72) begin
            o_rdata = w_rdata2;
            r_sel   = 3'd2;
        end
        else begin
            o_rdata = 8'd0;
            r_sel   = 3'd7;
        end
    end

    ram #(
        .P_RAM_DEPTH(32)
    ) u_ram0 (
        .i_clk(i_clk),
        .i_rst_n(i_rst_n),
        .i_we(i_we && r_sel==3'd0), //ram0 地址范围 0~31
        .i_addr(i_addr[4:0]),
        .i_wdata(i_wdata),
        .o_rdata(w_rdata0)
    );

    ram #(
        .P_RAM_DEPTH(32)
    ) u_ram1 (
        .i_clk(i_clk),
        .i_rst_n(i_rst_n),
        .i_we(i_we && r_sel==3'd1),  //ram1 地址范围 32~63
        .i_addr(i_addr[4:0]),
        .i_wdata(i_wdata),
        .o_rdata(w_rdata1)
    );

    gpio u_gpio (
        .i_clk(i_clk),
        .i_rst_n(i_rst_n),
        .i_we(i_we && r_sel==3'd2),  //ram1 地址范围 64~71
        .i_addr(i_addr[2:0]),
        .i_wdata(i_wdata),
        .o_rdata(w_rdata2),
        .io_gpio(io_gpio)
    );
endmodule

```

## tb.sv
```verilog
`timescale 1ns/1ps

module tb;

    // ---------------- parameters ----------------
    localparam P_CLK_FREQ = 50_000_000;
    localparam CLK_PERIOD = 20;   // 50MHz -> 20ns

    // ---------------- tb signals ----------------
    reg CLOCK_XTAL_50MHz;
    reg RESET;
    reg KEY2;
    wire LED0;
    wire LED1;

    // ---------------- DUT ----------------
    HC_FPGA_Demo_Top dut (
        .CLOCK_XTAL_50MHz(CLOCK_XTAL_50MHz),
        .RESET(RESET),
        .KEY2(KEY2),
        .LED0(LED0),
        .LED1(LED1)
    );

    // ---------------- clock gen ----------------
    initial begin
        CLOCK_XTAL_50MHz = 1'b0;
        forever #(CLK_PERIOD/2) CLOCK_XTAL_50MHz = ~CLOCK_XTAL_50MHz;
    end

    // ---------------- reset & stimulus ----------------
    initial begin
        // default
        RESET = 1'b1;
        #100;
        RESET = 1'b0;
        #100;
        RESET = 1'b1;
        // 跑一段时间
        #100_00;

        $display("=== Simulation finished ===");
        $stop;
    end

    // ---------------- optional monitor ----------------
    initial begin
        $display("time\treset\tLED0");
        $monitor("%0t\t%b\t%b", $time, RESET, LED0);
    end

    // ---------------- waveform ----------------
//    initial begin
//        $dumpfile("hc_fpga_demo.vcd");
//        $dumpvars(0, tb_HC_FPGA_Demo_Top);
//    end

endmodule

```
## HC_FPGA_Tcl.tcl
```bash

#时钟引脚 50M
set_location_assignment PIN_E1 -to CLOCK_XTAL_50MHz
#复位引脚
set_location_assignment PIN_E15 -to RESET
#LED对应的引脚
set_location_assignment PIN_M12 -to LED0
set_location_assignment PIN_F16 -to LED1
set_location_assignment	PIN_E16	-to KEY2
```
## main.asm
> 系统时钟1KHZ ,LED0 52ms翻转一次
```bash
;系统时钟1ms 1个周期
;1条指令耗时2~4ms
;gpio.0 52ms取反一次
;gpio.0~7 默认全输入
MOV 65, #255
;gpio.0 设置为输出
CLR 65, #1
LOOP:
    CPL 64,#1  ;64.0 翻转  [4]
    CALL Delay; 延时       [2+2+10*4+2]
    LJMP LOOP  ; 无限循环   [2]
;延时函数
Delay:
MOV A,#10
Delay_LOOP:
DEC A
JNZ Delay_LOOP
RET
```