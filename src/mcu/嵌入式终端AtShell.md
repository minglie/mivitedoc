
# 🧭 嵌入式终端命令交互系统 `AtShell`

`AtShell` 是一个适用于嵌入式系统的串口命令解析框架，支持两种交互模式（AT / MSH），用于设备调试、指令执行、格式化输出、命令历史与自动补全等功能。

---
## 🌐 在线演示

👉 [Wokwi 在线演示](https://wokwi.com/projects/402006915303326721)

📦️ [git仓库](https://github.com/minglie/ming_atshell)

---



## ✨ 模式说明

### 🟢 AT 模式（适用于串口助手）

- **格式：** `AT+fun(a,b,c)\r\n`
- **特点：**
  - 结构固定，适用于机器通信、协议调试
  - 支持固件升级（如配合 Xmodem1K）
- **示例：**
  ```cpp
  AT+c(55,01 02)
  ```

### 🔵 MSH 模式（类似 Linux Shell）

- **格式：** `fun a b`
- **特点：**
   - 支持直接通过命令序号执行对应的命令
  - 支持 tab 自动补全和历史记录 ↑↓
  - 类 Linux Shell 操作风格，适合调试
- **示例：**
  ```cpp
  help
  clean
  call 0x55 01 02
  ```

---




## 🔧 核心特性一览

| 特性                  | 描述 |
|-----------------------|------|
| 多命令注册           | 支持动态注册命令集 |
| 参数解析             | 支持 `,` 与空格分割参数 |
| 日志输出重定向       | 提供 info/debug/error 等日志级别 |
| 命令历史与补全       | MSH 模式下支持 ↑↓ 查阅、tab 补全 |
| 异步缓冲输出         | 适用于中断上下文延迟输出 |
| 模式可配置           | 通过宏配置启用 AT 或 MSH 模式 |

---

## 📁 文件结构说明

### `AtShell.h`

声明核心类 `AtShell` 及其接口：

```cpp
// 注册命令
bool Regist(AT_CMD_ENTRY_TypeDef cmd);

// 执行命令
bool Exec(char *str);

// 导入数据
int Import(uint8_t *buf, uint32_t len, uint32_t ms = 0);

// 格式化输出
int Printf(const char *format, ...);

// 返回状态响应
int Reply(uint8_t errCode);
```

快速注册命令：
```cpp
AT_SHELL_EXPORT(cmdName, desc, fun, userData);
```

---

### `AtShell.cpp`

实现串口数据解析、命令匹配与执行、日志输出等逻辑。

#### ✅ 默认内建命令

| 命令       | 描述             | 支持模式 |
|------------|------------------|----------|
| `help`     | 显示命令列表     | 全部     |
| `c(...)`   | 执行回调函数     | AT 模式  |
| `clean`    | 清屏操作         | MSH 模式 |
| `AT`       | 回显确认         | AT 模式  |

---

## 🧾 输出接口示例

```cpp
AT_printf("Result: %d\n", result);
AT_info("Info message: %s", msg);
```

---

## 🔗 C 语言接口（兼容非 C++ 项目）

```cpp
void at_init(ATWriteFun writeFun);
bool at_register(AT_CMD_ENTRY_TypeDef cmd);
int  at_import(uint8_t *buf, uint32_t len, uint32_t ms);
int  at_reply(uint8_t errCode);
```

---

## ⚙️ 编译宏配置表

| 宏定义                   | 功能说明                         |
|--------------------------|----------------------------------|
| `CON_AT_MSH`             | 0 表示 AT 模式，1 表示 MSH 模式 |
| `CON_AT_USE_CALLBACK`    | 支持 `AT+c(...)` 回调机制        |
| `CON_AT_USE_EXPORT`      | 启用异步缓冲输出（适用于中断）   |
| `RT_FINSH_ARG_MAX`       | 命令最大参数数量（默认 3）       |
| `FINSH_HISTORY_LINES`    | MSH 模式支持的历史命令条数       |

---

## 🧪 使用示例

```cpp
// 注册命令
AT_SHELL_EXPORT(mycmd, "custom test", my_function, NULL);

// 执行命令
g_atShell.Exec("mycmd 123 abc");

// 返回信息
AT_reply(CON_AT_R_SUCCESS);
AT_printf("Executed successfully\n");
```

---

## 📦 移植指南

本系统轻量、易移植，仅依赖标准 C 库函数：

> `string.h`, `stdarg.h`, `ctype.h`, `stdio.h`

可应用于：**串口 / USB CDC / BLE / TCP 等通信场景**

### ✅ 移植步骤

#### ① 初始化输出函数（串口发送）

```cpp
at_init(my_write_fun);  // 设置写函数
```

#### ② 导入串口接收数据

```cpp
at_import(rx_buf, len, get_ms());  // 在串口接收中调用
```

---

# 完整源码
## AtShell.h
```c
/*
 CON_AT_MSH=0: AT模式: 配合 Xmodem1K 更新固件
=>: AT+fun(a,b,c)\r\n
CON_AT_MSH=1: MSH模式: 调试
=>: fun a b \n
**/

#ifndef _AT_SHELL_H
#define _AT_SHELL_H

#include "stdint.h"
#include "string.h"
#include "stdbool.h"

//模式  0:AT    1:MSH
#define  CON_AT_MSH 1
//机器Hex通讯 AT+c(55,01 02)
#define  CON_AT_USE_CALLBACK 1
//方法数
#define  CON_AT_METHOD_NUM     10//  10
#define  FINSH_CMD_SIZE       20  //20             //最长命令尺寸
#define  RT_FINSH_ARG_MAX      3// 6        //参数个数
#define  FINSH_HISTORY_LINES    3       //历史命令条数
#define  CON_AT_R_SUCCESS   0    // 成功
#define  CON_AT_R_ERR_ARG   1    // 参数错误
#define  CON_AT_R_ERR_NO_CMD   2  //无此命令
#define  CON_AT_R_ERR_EXEC_FAIL 3  //执行失败
#define  CON_AT_WRITE_TIMEOUT   100
#define CON_METHOD_NAME_SIZE 8
#define CON_HELP_INFO_SIZE  16


typedef int (*ATServerFun)(int argc, char **argv);
typedef int (*ATWriteFun)(uint8_t *buf, uint32_t len,uint32_t timeout);

#if CON_AT_USE_CALLBACK == 1
typedef void (*ATCallBackFun)(uint32_t code, uint8_t *buf, uint32_t len);
#endif

typedef struct {
    char methodName[CON_METHOD_NAME_SIZE];
    char helpInfo[CON_HELP_INFO_SIZE];
    ATServerFun atFun;
    void *userData;
} AT_CMD_ENTRY_TypeDef;

#ifdef __cplusplus

class AtShell {
private:
    AT_CMD_ENTRY_TypeDef *m_cmdList;
    uint32_t m_cmdSize;
    int m_cmdNum;
    char m_buf[FINSH_CMD_SIZE];
    uint32_t m_bufLen;
    uint32_t m_importMs;
    uint32_t m_lock;
    int m_argc;
    char m_method[CON_METHOD_NAME_SIZE];
    char *m_argv[RT_FINSH_ARG_MAX];
    ATWriteFun m_writeFun;
    virtual bool Parse(char *str);

public:
    AtShell();
    AT_CMD_ENTRY_TypeDef *ctx;
#if CON_AT_USE_CALLBACK == 1
    ATCallBackFun m_atCallBackFun;
#endif
    virtual void Init(ATWriteFun writeFun);
    virtual char *GetBuf() { return m_buf; };
    virtual int GetCmdNum() { return m_cmdNum; };
    virtual bool Regist(AT_CMD_ENTRY_TypeDef cmd);
    virtual bool Regist(AT_CMD_ENTRY_TypeDef *cmdList, int cmdLen);
    virtual bool Exec(char *str);
    virtual int Import(uint8_t *buf, uint32_t len, uint32_t ms = 0);
    virtual int ImportForAt(uint8_t *buf, uint32_t len, uint32_t ms = 0);
    virtual int  Printf(const char *format, ...);
    virtual int Output(long nLevel, const char *pszFileName, int nLineNo, const char *pszFmt, ...);
    virtual int PrintfBs(uint8_t *buf, uint32_t len);
    virtual int Write(uint8_t *buf, uint32_t len,uint32_t timeout);
    virtual int Write(uint8_t data);
    virtual void AtCall(uint32_t code, uint8_t *buf, uint32_t len);
    virtual int Reply(uint8_t errCode);
    virtual void ShowVersion();

#if CON_AT_MSH == 1
    uint16_t m_currentHistory;
    uint16_t m_historyCount;
    char m_cmdHistory[FINSH_HISTORY_LINES][FINSH_CMD_SIZE];
    int m_stat;
    char m_line[FINSH_CMD_SIZE];
    uint8_t m_linePosition;
    uint8_t m_lineCurpos;

    virtual int ImportForMsh(uint8_t *buf, uint32_t len, uint32_t ms = 0);
    virtual void MshAddChar(char ch);
    virtual void ShellPushHistory();
    virtual void ShellAutoComplete(char *prefix);
    virtual void MshAutoComplete(char *prefix);
    virtual bool ShellHandleHistory();
#endif
};

extern AtShell g_atShell;

enum AT_LOG_LEVEL {
    AT_LOG_LEVEL_TRACE,
    AT_LOG_LEVEL_DEBUG,
    AT_LOG_LEVEL_INFO,
    AT_LOG_LEVEL_WARNING,
    AT_LOG_LEVEL_ERROR
};

extern AtShell g_atShell;

#define AT_m_buf  g_atShell.GetBuf()

#if CON_AT_MSH == 1
#define AT_FUN(fun)    #fun
#else
#define AT_FUN(fun)    "AT+"#fun
#endif
#define CONCAT(a, b) a ## b
#define AT_FILE_NAME(x)   strrchr(x,'\\')?strrchr(x,'\\')+1:x
#define AT_info(...)      g_atShell.Output(AT_LOG_LEVEL_INFO,__func__, __LINE__,__VA_ARGS__)
#define AT_debug(...)     g_atShell.Output(AT_LOG_LEVEL_DEBUG,AT_FILE_NAME(__FILE__), __LINE__,__VA_ARGS__)
#define AT_debug1(...)    g_atShell.Output(AT_LOG_LEVEL_DEBUG,__func__,__LINE__,__VA_ARGS__)
#define AT_error(...)     g_atShell.Output(AT_LOG_LEVEL_ERROR,__PRETTY_FUNCTION__,__LINE__,__VA_ARGS__)
#define AT_printf(format, ...)  g_atShell.Printf(format,##__VA_ARGS__)
#define AT_println(format, ...)  g_atShell.Printf(format,##__VA_ARGS__);AT_printf("\r\n")
#define AT_aprintf(format, ...)    g_atShell.AsyncPrintf(format,##__VA_ARGS__)
#define AT_aprintln(format, ...)  g_atShell.AsyncPrintf(format,##__VA_ARGS__);AT_aprintf("\r\n")
#define AT_printfBs(buf, len)  g_atShell.PrintfBs(buf,len)
#endif

#if CON_AT_USE_CALLBACK == 1
#define AT_SET_CALL_BACK(fun)          g_atShell.m_atCallBackFun=fun
#endif


#define AT_SHELL_EXPORT(cmdName, desc, fun, ...)  AT_CMD_ENTRY_TypeDef fun##entrycmd={AT_FUN(cmdName),#desc,fun,__VA_ARGS__}; at_register(fun##entrycmd)
#define AT_EXEC(cmd)    g_atShell.Exec(cmd)


#ifdef __cplusplus
extern "C" {
#endif
void at_init(ATWriteFun writeFun);
int  at_import(uint8_t *buf, uint32_t len, uint32_t ms);
bool at_register(AT_CMD_ENTRY_TypeDef cmd);
bool at_register_many(AT_CMD_ENTRY_TypeDef *cmdList, int cmdLen);
int  at_write(uint8_t *buf, uint32_t len,uint32_t timeout);
int  at_printf(const char *format, ...);
int  at_reply(uint8_t errCode);
int  at_hexStringToByteArray(const char *hexStr, unsigned char *bs);
long at_str_to_int(char* str);
void at_show_version();
#ifdef __cplusplus
}
#endif
#endif
```
## AtShell.cpp
```c
#include "AtShell.h"
#include "stdio.h"
#include "stdlib.h"
#include "stdarg.h"
#include "string.h"
#include <ctype.h>
#include <limits.h>

#define CON_AT_DELIMITER   "(,)"
#define CON_AT_DELIMITER_BANK   " "
#define FINSH_PROMPT        "$:"

static int __help(int argc, char **argv);

AtShell g_atShell;


#if CON_AT_MSH == 1

static int __clean(int argc, char **argv) {
    AT_printf("\033c");
    return 0;
}

#else
static int __at(int argc, char** argv) {
    at_reply(CON_AT_R_SUCCESS);
    return 0;
}
#endif


#if CON_AT_USE_CALLBACK == 1
static int __call(int argc, char **argv) {
    if (argc <= 2) {
        return 0;
    }
    char *hexStr = argv[2];
    uint32_t code = strtol(argv[1], NULL, 16);
    char *bs = g_atShell.GetBuf();
    int len = at_hexStringToByteArray(hexStr, (unsigned char *) bs);
    if (g_atShell.m_atCallBackFun != NULL) {
        g_atShell.m_atCallBackFun(code, (uint8_t *) bs, len);
    }
    return 0;
}

#endif

static AT_CMD_ENTRY_TypeDef s_ap_cmd_entry[CON_AT_METHOD_NUM] = {
        {AT_FUN(help), "list cmd", __help, 0},
#if CON_AT_USE_CALLBACK == 1
        {AT_FUN(c), "(55,01 02)", __call, 0},
#endif
#if CON_AT_MSH == 1
        {"clean", "clean screen", __clean, 0},
#else
        { "AT","",__at, 0 },
#endif
};

static int __help(int argc, char **argv) {
    int cmdInx = g_atShell.GetCmdNum();
    AT_printf("AtShell commands:\r\n");
    for (int i = 0; i < cmdInx; i++) {
        AT_printf("%2d.%-20s - %s \r\n", i, s_ap_cmd_entry[i].methodName, s_ap_cmd_entry[i].helpInfo);
    }
    return 0;
}


AtShell::AtShell() {
    m_cmdList = s_ap_cmd_entry;
    m_cmdSize = CON_AT_METHOD_NUM;
    m_cmdNum = 0;
    m_writeFun = NULL;
    m_bufLen = 0;
    m_importMs = 0;
    for (size_t i = 0; i < m_cmdSize; i++) {
        if (m_cmdList[i].atFun == NULL) {
            m_cmdNum = i;
            break;
        }
    }
}

bool AtShell::Regist(AT_CMD_ENTRY_TypeDef cmd) {
    if (m_cmdNum >= CON_AT_METHOD_NUM) {
        return false;
    }
    m_cmdList[m_cmdNum] = cmd;
    m_cmdNum++;
    return true;
}

bool AtShell::Regist(AT_CMD_ENTRY_TypeDef *cmdList, int cmdLen) {
    if (m_cmdNum + cmdLen > CON_AT_METHOD_NUM) {
        return false;
    }
    for (int i = 0; i < cmdLen; i++) {
        AtShell::Regist(cmdList[i]);
    }
    return true;
}

void AtShell::Init(ATWriteFun writeFun) {
    m_writeFun = writeFun;
}

bool AtShell::Parse(char *str) {
    if (m_buf != str) {
        strcpy(m_buf, str);
    }
    m_argv[0] = m_buf;
    char *token;
    char delimiter[16] = CON_AT_DELIMITER;
    if (strstr((char *) str, "AT") != (char *) str) {
        sprintf(delimiter, CON_AT_DELIMITER_BANK);
    }
    token = strtok(m_buf, delimiter);
    int i = 0;
    while (token != NULL) {
        if (i == 0) {
            snprintf(m_method, sizeof(m_method), "%s", token);
            snprintf(m_argv[0], sizeof(m_method), "%s", token);
            m_argv[1] = &m_buf[strlen(m_argv[0]) + 1];
        } else if (i < RT_FINSH_ARG_MAX) {
            sprintf(m_argv[i], "%s", token);
            m_argv[i + 1] = m_argv[i] + strlen(m_argv[i]) + 1;
        }
        token = strtok(NULL, delimiter);
        i++;
        m_argc = i;
    }
    return true;
}


bool AtShell::Exec(char *str) {
    m_lock = 1;
    bool r = Parse(str);
    if (r == false) {
        m_lock = 0;
        return r;
    }
    bool cmd_ret = false;
    //methodName match
    for (int i = 0; i < m_cmdNum; i++) {
        if (strcmp(m_cmdList[i].methodName, m_method) == 0) {
            this->ctx = &m_cmdList[i];
            m_cmdList[i].atFun(m_argc, m_argv);
            cmd_ret = true;
            break;
        }
    }
    //inx match
    if (!cmd_ret) {
        int inx = strtol(m_method, NULL, 10);
        if ('0' <= m_method[0] && m_method[0] <= '9' && inx < m_cmdNum) {
            this->ctx = &m_cmdList[inx];
            m_cmdList[inx].atFun(m_argc, m_argv);
            cmd_ret = true;
        }
    }
    if (!cmd_ret) {
        char *tcmd;
        tcmd = str;
        while (*tcmd != ' ' && *tcmd != '\0') {
            tcmd++;
        }
        *tcmd = '\0';
        this->Printf("%s: command not found.\n", str);
    }
    m_bufLen = 0;
    m_lock = 0;
    return cmd_ret;
}

int AtShell::Import(uint8_t *buf, uint32_t len, uint32_t ms) {
#if CON_AT_MSH == 1
    return this->ImportForMsh(buf, len, ms);
#else
    return  this->ImportForAt(buf, len, ms);
#endif
}



int AtShell::ImportForAt(uint8_t *buf, uint32_t len, uint32_t ms) {
    if (m_lock == 1 || len == 0 || len > sizeof(m_buf)) {
        return 0;
    }
    if (buf == NULL || ms - m_importMs > 10 || m_bufLen + len >= sizeof(m_buf)) {
        m_bufLen = 0;
    }
    if (buf != NULL) {
        memcpy(m_buf + m_bufLen, buf, len);
    }
    m_bufLen = m_bufLen + len;
    m_importMs = ms;
    if (m_bufLen < 3) {
        return 0;
    }
    if (m_buf[m_bufLen - 2] == 0x0d && m_buf[m_bufLen - 1] == 0x0a) {
        if (strstr((char *) m_buf, "AT") == (char *) m_buf) {
            m_buf[m_bufLen - 1] = 0;
            m_buf[m_bufLen - 2] = 0;
        } else {
            m_buf[m_bufLen - 1] = 0;
            m_buf[m_bufLen - 2] = 0;
        }
        this->Exec(m_buf);
        return m_bufLen;
    }
    return 0;
}


int AtShell::Printf(const char *format, ...) {
    char log_buf[256];
    va_list args;
    va_start(args, format);
    vsprintf(log_buf, format, args);
    uint32_t len = strlen(log_buf);
    m_writeFun((uint8_t *) log_buf, len,CON_AT_WRITE_TIMEOUT);
    va_end(args);
    return len;
}


int AtShell::Output(long nLevel, const char *pszFileName, int nLineNo, const char *format, ...) {
    char log_buf[256];
    snprintf(log_buf, sizeof(log_buf), "[%s:%d]", pszFileName, nLineNo);
    uint32_t len = strlen(log_buf);
    m_writeFun((uint8_t *) log_buf, len,CON_AT_WRITE_TIMEOUT);
    va_list args;
    va_start(args, format);
    vsprintf(log_buf, format, args);
    len = strlen(log_buf);
    m_writeFun((uint8_t *) log_buf, len,CON_AT_WRITE_TIMEOUT);
    va_end(args);
    return len;
}

int AtShell::PrintfBs(uint8_t *buf, uint32_t len) {
    char log_buf[256];
    if (len == 0 || len > 80) {
        return 0;
    }
    for (size_t i = 0; i < len; i++) {
        sprintf(&log_buf[3 * i], "%02X ", buf[i]);
    }
    log_buf[3 * len - 1] = '\n';
    this->Write((uint8_t *) log_buf, 3 * len,CON_AT_WRITE_TIMEOUT);
    return 3 * len;
}


int AtShell::Write(uint8_t *buf, uint32_t len,uint32_t timeout) {
    return m_writeFun(buf, len,timeout);
}

int AtShell::Write(uint8_t data) {
    uint8_t temp[1] = {data};
    return m_writeFun(temp, 1,CON_AT_WRITE_TIMEOUT);
}


void AtShell::AtCall(uint32_t code, uint8_t *buf, uint32_t len) {
    char log_buf[256];
    if (len == 0 || len > 80) {
        return;
    }
    for (size_t i = 0; i < len; i++) {
        sprintf(&log_buf[3 * i], "%02X ", buf[i]);
    }
    log_buf[3 * len - 1] = 0;
    this->Printf("AT+c(%d,%s)\r\n", code, log_buf);
}


int AtShell::Reply(uint8_t errCode) {
    if (errCode) {
        this->Printf("NG:%d\r\n", errCode);
        return errCode;
    }
    this->Printf("OK\r\n");
    return errCode;
}


void AtShell::ShowVersion() {
    this->Printf(" \\ | /\r\n");
    this->Printf("- AT_SHELL - %s  msh:%d \r\n", __DATE__, CON_AT_MSH);
    this->Printf(" / | \\\r\n");
#if CON_AT_MSH == 1
    char s[1] = {""};
    ShellAutoComplete(s);
#endif
}

static int str_common(const char *str1, const char *str2) {
    const char *str = str1;
    while ((*str != 0) && (*str2 != 0) && (*str == *str2)) {
        str++;
        str2++;
    }
    return (str - str1);
}


int AtShell::ImportForMsh(uint8_t *buf, uint32_t len, uint32_t ms) {
    for (size_t i = 0; i < len; i++) {
        MshAddChar(buf[i]);
    }
    return len;
}


void AtShell::ShellAutoComplete(char *prefix) {
    this->Printf("\r\n");
    MshAutoComplete(prefix);
    this->Printf("%s%s", FINSH_PROMPT, prefix);
}


void AtShell::MshAutoComplete(char *prefix) {
    int length, min_length;
    const char *name_ptr, *cmd_name;
    int index;
    min_length = 0;
    name_ptr = 0;
    if (*prefix == '\0') {
        return;
    }
    for (index = 0; index < g_atShell.GetCmdNum(); index++) {
        /* skip finsh shell function */
        cmd_name = s_ap_cmd_entry[index].methodName;
        if (strncmp(prefix, cmd_name, strlen(prefix)) == 0) {
            if (min_length == 0) {
                /* set name_ptr */
                name_ptr = cmd_name;
                /* set initial length */
                min_length = strlen(name_ptr);
            }
            length = str_common(name_ptr, cmd_name);
            if (length < min_length)
                min_length = length;

            this->Printf("%s\r\n", cmd_name);
        }
    }


    /* auto complete string */
    if (name_ptr != NULL) {
        strncpy(prefix, name_ptr, min_length);
    }
    return;
}

void AtShell::MshAddChar(char ch) {
    enum input_stat {
        WAIT_NORMAL = 0,
        WAIT_SPEC_KEY,
        WAIT_FUNC_KEY,
    };
    /*
     * handle control key
     * up key  : 0x1b 0x5b 0x41
     * down key: 0x1b 0x5b 0x42
     * right key:0x1b 0x5b 0x43
     * left key: 0x1b 0x5b 0x44
     */
    if (ch == 0x1b) {
        m_stat = WAIT_SPEC_KEY;
        return;
    } else if (m_stat == WAIT_SPEC_KEY) {
        if (ch == 0x5b) {
            m_stat = WAIT_FUNC_KEY;
            return;
        }
        m_stat = WAIT_NORMAL;
    } else if (m_stat == WAIT_FUNC_KEY) {
        m_stat = WAIT_NORMAL;
        if (ch == 0x41) /* up key */
        {
            /* prev history */
            if (m_currentHistory > 0)
                m_currentHistory--;
            else {
                m_currentHistory = 0;
                return;
            }

            /* copy the history command */
            memcpy(m_line, &m_cmdHistory[m_currentHistory][0], FINSH_CMD_SIZE);
            m_lineCurpos = m_linePosition = strlen(m_line);
            ShellHandleHistory();
            return;
        } else if (ch == 0x42) {
            /* next history */
            if (m_currentHistory < m_historyCount - 1)
                m_currentHistory++;
            else {
                /* set to the end of history */
                if (m_historyCount != 0)
                    m_currentHistory = m_historyCount - 1;
                else
                    return;
            }

            memcpy(m_line, &m_cmdHistory[m_currentHistory][0],
                   FINSH_CMD_SIZE);
            m_lineCurpos = m_linePosition = strlen(m_line);
            ShellHandleHistory();
            return;
        } else if (ch == 0x44) /* left key */
        {
            if (m_lineCurpos) {
                this->Printf("\b");
                m_lineCurpos--;
            }

            return;
        } else if (ch == 0x43) /* right key */
        {
            if (m_lineCurpos < m_linePosition) {
                this->Printf("%c", m_line[m_lineCurpos]);
                m_lineCurpos++;
            }

            return;
        }
    }
    /* received null or error */
    if (ch == '\0' || ch == 0xFF) return;
        /* handle tab key */
    else if (ch == '\t') {
        int i;
        /* move the cursor to the beginning of line */
        for (i = 0; i < m_lineCurpos; i++)
            this->Printf("\b");

        /* auto complete */
        ShellAutoComplete(&m_line[0]);
        /* re-calculate position */
        m_lineCurpos = m_linePosition = strlen(m_line);
        return;
    }
        /* handle backspace key */
    else if (ch == 0x7f || ch == 0x08) {
        /* note that line_curpos >= 0 */
        if (m_lineCurpos == 0)
            return;

        m_linePosition--;
        m_lineCurpos--;
        if (m_linePosition > m_lineCurpos) {
            int i;
            memmove(&m_line[m_lineCurpos],
                       &m_line[m_lineCurpos + 1],
                       m_linePosition - m_lineCurpos);
            m_line[m_linePosition] = 0;
            this->Printf("\b%s  \b", &m_line[m_lineCurpos]);

            /* move the cursor to the origin position */
            for (i = m_lineCurpos; i <= m_linePosition; i++)
                this->Printf("\b");
        } else {
            this->Printf("\b \b");
            m_line[m_linePosition] = 0;
        }

        return;
    }

    /* handle end of line, break */
    if (ch == '\r' || ch == '\n') {
        ShellPushHistory();

        this->Printf("\r\n");
        // printf("%s", line);
        m_line[m_linePosition] = '\0';
        g_atShell.Exec(m_line);
        this->Printf("\r\n%s", FINSH_PROMPT);
        memset(m_line, 0, sizeof(m_line));
        m_lineCurpos = m_linePosition = 0;
        return;
    }

    /* it's a large line, discard it */
    if (m_linePosition >= FINSH_CMD_SIZE)
        m_linePosition = 0;

    /* normal character */
    if (m_lineCurpos < m_linePosition) {
        int i;
        memmove(&m_line[m_lineCurpos + 1], &m_line[m_lineCurpos], m_linePosition - m_lineCurpos);
        m_line[m_lineCurpos] = ch;
        this->Printf("%s", &m_line[m_lineCurpos]);
        /* move the cursor to new position */
        for (i = m_lineCurpos; i < m_linePosition; i++)
            this->Printf("\b");
    } else {
        m_line[m_linePosition] = ch;
        this->Printf("%c", ch);
    }

    ch = 0;
    m_linePosition++;
    m_lineCurpos++;
    if (m_linePosition >= FINSH_CMD_SIZE) {
        /* clear command line */
        m_linePosition = 0;
        m_lineCurpos = 0;
    }
}


void AtShell::ShellPushHistory() {
    if (m_linePosition != 0) {
        /* push history */
        if (m_historyCount >= FINSH_HISTORY_LINES) {
            if (memcmp(&m_cmdHistory[FINSH_HISTORY_LINES - 1], m_line, FINSH_CMD_SIZE)) {
                /* move history */
                int index;
                for (index = 0; index < FINSH_HISTORY_LINES - 1; index++) {
                    memcpy(&m_cmdHistory[index][0],
                           &m_cmdHistory[index + 1][0], FINSH_CMD_SIZE);
                }
                memset(&m_cmdHistory[index][0], 0, FINSH_CMD_SIZE);
                memcpy(&m_cmdHistory[index][0], m_line, m_linePosition);
                m_historyCount = FINSH_HISTORY_LINES;
            }
        } else {
            if (m_historyCount == 0 || memcmp(&m_cmdHistory[m_historyCount - 1], m_line, FINSH_CMD_SIZE)) {
                m_currentHistory = m_historyCount;
                memset(&m_cmdHistory[m_historyCount][0], 0, FINSH_CMD_SIZE);
                memcpy(&m_cmdHistory[m_historyCount][0], m_line, m_linePosition);
                m_historyCount++;
            }
        }
    }
    m_currentHistory = m_historyCount;
}


bool AtShell::ShellHandleHistory() {
#if defined(_WIN32)
    int i;
    this->Printf("\r");
    for (i = 0; i <= 60; i++)
      this->Write(' ');
      this->Printf("\r");
#else
    AT_printf("\033[2K\r");
#endif
    this->Printf("%s%s", FINSH_PROMPT, m_line);
    return false;
}


void at_init(ATWriteFun writeFun) {
    g_atShell.Init(writeFun);
}

int at_import(uint8_t *buf, uint32_t len, uint32_t ms) {
    return g_atShell.Import(buf, len, ms);
}
bool at_register(AT_CMD_ENTRY_TypeDef cmd) {
    return g_atShell.Regist(cmd);
}
bool at_register_many(AT_CMD_ENTRY_TypeDef *cmdList, int cmdLen) {
    return g_atShell.Regist(cmdList, cmdLen);
}
int at_write(uint8_t *buf, uint32_t len,uint32_t timeout){
    return  g_atShell.Write(buf,len,timeout);
}
int at_printf(const char *format, ...) {
    char log_buf[256];
    va_list args;
    va_start(args, format);
    vsprintf(log_buf, format, args);
    uint32_t len = strlen(log_buf);
    g_atShell.Write((uint8_t *) log_buf, len,CON_AT_WRITE_TIMEOUT);
    va_end(args);
    return len;
}
int at_reply(uint8_t errCode) {
    return g_atShell.Reply(errCode);
}
void at_show_version() {
    g_atShell.ShowVersion();
}
int at_hexStringToByteArray(const char *hexStr, unsigned char *bs) {
    char token[3];
    int i = 0;
    long int byteValue;
    const int byteArrayLen = (strlen(hexStr) + 1) / 3;
    while (*hexStr && i < byteArrayLen) {
        if (isspace(*hexStr)) {
            hexStr++;
            continue;
        }
        if (!isxdigit(*hexStr)) {
            return i;
        }
        token[0] = *hexStr++;
        token[1] = *hexStr++;
        token[2] = '\0';
        byteValue = strtol(token, NULL, 16);
        bs[i] = (unsigned char) byteValue;
        i++;
    }
    return i;
}
```
> `AtShell` 框架设计清晰，代码结构良好，适合在 MCU / Linux / RTOS 等嵌入式环境中作为命令行接口内核使用。
