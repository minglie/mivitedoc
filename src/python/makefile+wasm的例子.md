[安装emsdk和make](https://blog.csdn.net/qq_26074053/article/details/154875243)
# 目录结构
```shell
PS D:\vtc\test> tree /a /f
卷 新加卷 的文件夹 PATH 列表
卷序列号为 1E8A-2CFF
D:.
|   Makefile
|   ming_wasm.html
|   ming_wasm.js
|   ming_wasm.wasm
|
+---.vscode
|       settings.json
|
\---src
        add.cpp
        add.h
        main.cpp
        test.cpp
        test.h
```

## Makefile
```shell
# 编译器设置
CC = emcc

# 编译选项 - 添加精简选项和ES6模块支持
CFLAGS = -O3 -s WASM=1 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web -s FILESYSTEM=0 -s NO_EXIT_RUNTIME=1 -s DETERMINISTIC=1

# 生成目录
BUILD_DIR = .

# 头文件目录 - 集中管理所有头文件目录
INCLUDE_DIRS = -I./src

# 源文件 - 集中管理所有C++文件
CPP_SOURCES = \
    src/main.cpp \
    src/add.cpp \
    src/test.cpp 

# 目标文件
TARGET = $(BUILD_DIR)/ming_wasm
HTML_FILE = $(BUILD_DIR)/ming_wasm.html


# 每行一个函数，新增/删除直接操作行，逗号结尾（最后一行可加可不加，Emscripten兼容）
EXPORTED_FUNCTIONS = '[\
    "_myfib", \
    "_main", \
    "_add", \
    "_test_function" \
]'

# 运行时方法也按行排列（可选，保持和导出函数格式一致）
EXPORTED_RUNTIME_METHODS = '[\
    "ccall", \
    "cwrap" \
]'





# 生成目标
all: $(TARGET) $(HTML_FILE)


# 统一编译所有C++源文件生成JS/WASM
$(TARGET): $(CPP_SOURCES)
	$(CC) $(CFLAGS) $(INCLUDE_DIRS) -o $(TARGET).js $(CPP_SOURCES) \
		-s EXPORTED_FUNCTIONS=$(EXPORTED_FUNCTIONS) \
		-s EXPORTED_RUNTIME_METHODS=$(EXPORTED_RUNTIME_METHODS) \
		-s SINGLE_FILE=0

# 生成HTML文件，包含完整的WebAssembly运行环境
$(HTML_FILE): $(CPP_SOURCES)
	$(CC) -O3 -s WASM=1 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web -s FILESYSTEM=0 -s NO_EXIT_RUNTIME=1 -s DETERMINISTIC=1 $(INCLUDE_DIRS) -o $(HTML_FILE) $(CPP_SOURCES) \
		-s EXPORTED_FUNCTIONS=$(EXPORTED_FUNCTIONS) \
		-s EXPORTED_RUNTIME_METHODS=$(EXPORTED_RUNTIME_METHODS) \
		-s SINGLE_FILE=0 -s NO_EXIT_RUNTIME=1

# 清理目标
clean:
	-rm -f $(BUILD_DIR)/*.js $(BUILD_DIR)/*.wasm $(HTML_FILE)

# 声明伪目标
.PHONY: all clean
```
## main.cpp
```cpp
#include <stdio.h>
#include <stdint.h>
#include <ctime>
#include  "add.h"


#ifdef __cplusplus
extern "C" {
#endif

uint32_t   myfib(uint32_t n){
    if(n<=1){
        return n;
    }
    return myfib(n-1)+myfib(n-2);
}

#ifdef __cplusplus
}
#endif








int main(int argc, char ** argv) {
    int t1=clock();
    printf("%d\n",myfib(20));
    int t2=clock();
    printf("%d\n",t2-t1);
     printf("1+wssssssw1=%d\n",add(1,1));
}



```
## add.h
```cpp
#ifndef ADD_H
#define ADD_H

// 条件编译：如果是C++编译器，用extern "C"包裹函数声明
#ifdef __cplusplus
extern "C" {
#endif


int add(int a, int b);


#ifdef __cplusplus
}
#endif

#endif // ADD_H
    

```

## add.cpp
```cpp
#include "add.h"
// 加法函数实现
int add(int a, int b) {
    return a + b;
}

```

## test.h
```cpp
#ifndef TEST_H
#define TEST_H

#ifdef __cplusplus
extern "C" {
#endif

// 测试函数声明
int test_function(int a, int b);

#ifdef __cplusplus
}
#endif

#endif // TEST_H
```

## test.cpp
```cpp
#include <stdio.h>

#ifdef __cplusplus
extern "C" {
#endif

// 一个简单的测试函数，用于演示
void test_function() {
    printf("Test function called successfully!\n");
}

#ifdef __cplusplus
}
#endif

```

## ming_wasm.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
    <script type="module" >

    // ES6模块导入测试
import MingWasmModule from './ming_wasm.js';

// 使用异步函数处理WebAssembly初始化
async function testES6Import() {
  try {
    console.log('开始测试ES6模块导入');
    
    // 等待Module ready Promise完成
    const Module = await MingWasmModule();
     console.log('WebAssembly模块加载成功');
    
    // 测试暴露的函数
    console.log('测试加法函数: 5 + 3 =', Module._add(5, 3));
    console.log('测试斐波那契函数: fib(10) =', Module._myfib(10));
    console.log('测试test_function函数:', Module._test_function());
    console.log('测试main函数:', Module._main());
    
    console.log('ES6模块导入测试成功！');
  } catch (error) {
    console.error('ES6模块导入测试失败:', error);
  }
}

// 执行测试
testES6Import();


    </script>
</body>
</html>

```

# js和wasm的字符串交互
```bash
PS D:\vtc\test> tree /a /f
卷 新加卷 的文件夹 PATH 列表
卷序列号为 1E8A-2CFF
D:.
|   Makefile
\---src
        main.cpp
        string_utils.cpp
```

## makefile
```bash
# 编译器设置
CC = emcc

# 编译选项 - 添加精简选项和ES6模块支持
# 新增：ALLOW_MEMORY_GROWTH=1（支持长字符串）、DEMANGLE_SUPPORT=0（兼容extern "C"）
CFLAGS = -O3 -s WASM=1 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web -s FILESYSTEM=0 -s NO_EXIT_RUNTIME=1 -s DETERMINISTIC=1 \
         -s ALLOW_MEMORY_GROWTH=1 -s DEMANGLE_SUPPORT=0 --std=c++11

# 生成目录
BUILD_DIR = .

# 头文件目录 - 集中管理所有头文件目录
INCLUDE_DIRS = -I./src

# 源文件 - 集中管理所有C++文件（可添加字符串处理相关文件，如 src/string_utils.cpp）
CPP_SOURCES = \
    src/main.cpp \
    src/string_utils.cpp  # 若有字符串处理文件，取消注释添加

# 目标文件
TARGET = $(BUILD_DIR)/ming_wasm
HTML_FILE = $(BUILD_DIR)/ming_wasm.html

# 每行一个函数，新增/删除直接操作行，逗号结尾（最后一行可加可不加，Emscripten兼容）
# 新增字符串相关导出函数：_to_uppercase（字符串处理）、_free_string（内存释放）
EXPORTED_FUNCTIONS = '[\
    "_main", \
    "_to_uppercase", \
    "_int2String", \
    "_free_string" \
]'

# 运行时方法也按行排列（可选，保持和导出函数格式一致）
# 新增：UTF8ToString（JS读取Wasm字符串核心方法）
EXPORTED_RUNTIME_METHODS = '[\
    "ccall", \
    "cwrap", \
    "UTF8ToString" \
]'

# 生成目标
all: $(TARGET) $(HTML_FILE)

# 统一编译所有C++源文件生成JS/WASM
$(TARGET): $(CPP_SOURCES)
	$(CC) $(CFLAGS) $(INCLUDE_DIRS) -o $(TARGET).js $(CPP_SOURCES) \
		-s EXPORTED_FUNCTIONS=$(EXPORTED_FUNCTIONS) \
		-s EXPORTED_RUNTIME_METHODS=$(EXPORTED_RUNTIME_METHODS) \
		-s SINGLE_FILE=0

# 生成HTML文件，包含完整的WebAssembly运行环境
$(HTML_FILE): $(CPP_SOURCES)
	$(CC) -O3 -s WASM=1 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web -s FILESYSTEM=0 -s NO_EXIT_RUNTIME=1 -s DETERMINISTIC=1 \
         -s ALLOW_MEMORY_GROWTH=1 -s DEMANGLE_SUPPORT=0 --std=c++11 $(INCLUDE_DIRS) -o $(HTML_FILE) $(CPP_SOURCES) \
		-s EXPORTED_FUNCTIONS=$(EXPORTED_FUNCTIONS) \
		-s EXPORTED_RUNTIME_METHODS=$(EXPORTED_RUNTIME_METHODS) \
		-s SINGLE_FILE=0 -s NO_EXIT_RUNTIME=1

# 清理目标
clean:
	-rm -f $(BUILD_DIR)/*.js $(BUILD_DIR)/*.wasm $(HTML_FILE)

# 声明伪目标
.PHONY: all clean
```
##  main.cpp
```cpp
#include <stdio.h>
#include <stdint.h>
#include <ctime>
extern "C" char* to_uppercase(const char* input);
int main(int argc, char ** argv) {

     printf("%s\n",to_uppercase("abc"));
}
```

##  string_utils.cpp
```cpp
#include <string>
#include <cstring>
#include <cctype>
#include <cstdlib>

// 必须用 extern "C" 避免 C++ 名字修饰
extern "C" {

__attribute__((visibility("default")))
void int2String(char strBuf[], uint32_t intv) {
    strBuf[0]='a';
    strBuf[1]='b';
    strBuf[2]='c';
    strBuf[3]=0;
}


// 关键：用编译器原生属性暴露函数，替代 EM_PORT_API（无需任何头文件）
__attribute__((visibility("default")))
char* to_uppercase(const char* input) {
    // 空输入处理
    if (!input || strlen(input) == 0) {
        char* empty = (char*)malloc(1);
        if (empty) empty[0] = '\0';
        return empty;
    }

    // 转大写逻辑
    std::string output(input);
    for (char& c : output) {
        c = static_cast<char>(toupper(static_cast<unsigned char>(c)));
    }

    // 分配内存并复制
    char* result = (char*)malloc(output.size() + 1);
    if (result) strcpy(result, output.c_str());
    return result;
}

// 释放内存函数
__attribute__((visibility("default")))
void free_string(char* str) {
    if (str) free(str);
}

}  // extern "C"
```
## ming_wasm.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
<script type="module" >



    import MingWasmModule from './ming_wasm.js';

    async function useWasmUppercase() {
        try {
            // 1. 初始化 Wasm 模块
            const Module = await MingWasmModule();
            console.log('Wasm 模块初始化成功');

            // 2. 提前包装 Wasm 函数（一次包装，多次使用）
            const toUppercase = Module.cwrap(
                'to_uppercase',  // Wasm 函数名（无下划线）
                'number',        // 返回值：内存地址
                ['string']       // 参数：JS 字符串
            );
            // 释放内存
            const freeString = Module.cwrap(
                'free_string',   // Wasm 释放函数名（无下划线）
                'void',          // 返回值：无
                ['number']       // 参数：内存地址
            );

            // 3. 多次调用包装后的函数（简洁高效）
            const testInputs = ["hello", "aBcDeF", "Wasm 123!", ""];
            testInputs.forEach((input, idx) => {
                const strPtr = toUppercase(input);
                const output = Module.UTF8ToString(strPtr);
                console.log(`用例 ${idx+1}：输入="${input}" → 输出="${output}"`);
                freeString(strPtr); // 每次调用后释放内存
            });

            // 4. 整数转字符串
            const int2String = Module.cwrap(
                'int2String',       // 函数名（无下划线）
                'void',             // 返回值：void（无返回值）
                ['number', 'number']// 参数：1. strBuf 内存地址；2. intVal（uint32_t → JS number）
            );
            const strBufPtr = Module._malloc(32);
            int2String(strBufPtr, 0x1234567);
            const output = Module.UTF8ToString(strBufPtr);
            console.log(`输入======="int2String" → 输出="${output}"`)
            freeString(strBufPtr);


        } catch (error) {
            console.error('调用失败：', error);
        }
    }

    useWasmUppercase();
</script>



</script>
</body>
</html>



```
# make命令
```bash
# 首次或增删方法执行用
make 
# 没增删方法执行用
make ./ming_wasm
```