```bash
Windows PowerShell
版权所有（C） Microsoft Corporation。保留所有权利。

安装最新的 PowerShell，了解新功能和改进！https://aka.ms/PSWindows

PS D:\soft> git clone https://gitee.com/openeuler-graphics/emsdk.git
Cloning into 'emsdk'...
remote: Enumerating objects: 3414, done.
remote: Total 3414 (delta 0), reused 0 (delta 0), pack-reused 3414 (from 1)
Receiving objects: 100% (3414/3414), 2.01 MiB | 1.12 MiB/s, done.
Resolving deltas: 100% (2231/2231), done.
PS D:\soft>  cd .\emsdk\
PS D:\soft\emsdk> ls


    目录: D:\soft\emsdk


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d-----        2025/11/15     14:34                .circleci
d-----        2025/11/15     14:34                .github
d-----        2025/11/15     14:34                bazel
d-----        2025/11/15     14:34                docker
d-----        2025/11/15     14:34                scripts
d-----        2025/11/15     14:34                test
-a----        2025/11/15     14:34            393 .dockerignore
-a----        2025/11/15     14:34            441 .flake8
-a----        2025/11/15     14:34            488 .gitignore
-a----        2025/11/15     14:34             26 emcmdprompt.bat
-a----        2025/11/15     14:34           3489 emscripten-releases-tags.txt
-a----        2025/11/15     14:34           1677 emsdk
-a----        2025/11/15     14:34           1395 emsdk.bat
-a----        2025/11/15     14:34           1392 emsdk.ps1
-a----        2025/11/15     14:34         128291 emsdk.py
-a----        2025/11/15     14:34             34 emsdk_env.bat
-a----        2025/11/15     14:34            596 emsdk_env.csh
-a----        2025/11/15     14:34            316 emsdk_env.fish
-a----        2025/11/15     14:34            100 emsdk_env.ps1
-a----        2025/11/15     14:34           2048 emsdk_env.sh
-a----        2025/11/15     14:34          27640 emsdk_manifest.json
-a----        2025/11/15     14:34            744 legacy-binaryen-tags.txt
-a----        2025/11/15     14:34           1348 legacy-emscripten-tags.txt
-a----        2025/11/15     14:34           1353 LICENSE
-a----        2025/11/15     14:34           2455 llvm-tags-64bit.txt
-a----        2025/11/15     14:34          12698 README.md


PS D:\soft\emsdk> git branch
* master
PS D:\soft\emsdk> ./emsdk install latest
****
Error: You appear to be using the `master` branch of emsdk.
We recently made the switch to using `main`
In order to continue to receive updates you will need to make the switch locally too.
For normal clones without any local branches simply running the following command should be enough:
  `git checkout main`
For more information see https://github.com/emscripten-core/emsdk/issues/805
****
PS D:\soft\emsdk> git checkout main
branch 'main' set up to track 'origin/main'.
Switched to a new branch 'main'
PS D:\soft\emsdk> ./emsdk install latest --skip-deps
PS D:\soft\emsdk> ./emsdk update
Resolving SDK alias 'latest' to '3.1.22'
Resolving SDK version '3.1.22' to 'sdk-releases-upstream-990cee04a21caafc75955d736fb45791a7f2aeee-64bit'
Installing SDK 'sdk-releases-upstream-990cee04a21caafc75955d736fb45791a7f2aeee-64bit'..
Skipped installing node-14.18.2-64bit, already installed.
Skipped installing python-3.9.2-nuget-64bit, already installed.
Skipped installing java-8.152-64bit, already installed.
Skipped installing releases-upstream-990cee04a21caafc75955d736fb45791a7f2aeee-64bit, already installed.
All SDK components already installed: 'sdk-releases-upstream-990cee04a21caafc75955d736fb45791a7f2aeee-64bit'.
PS D:\soft\emsdk> ./emsdk_env.ps1
PS D:\soft\emsdk> ./emsdk activate latest
Resolving SDK alias 'latest' to '3.1.22'
Resolving SDK version '3.1.22' to 'sdk-releases-upstream-990cee04a21caafc75955d736fb45791a7f2aeee-64bit'
Setting the following tools as active:
   node-14.18.2-64bit
   python-3.9.2-nuget-64bit
   java-8.152-64bit
   releases-upstream-990cee04a21caafc75955d736fb45791a7f2aeee-64bit
PS D:\soft\emsdk>  emcc -v
emcc (Emscripten gcc/clang-like replacement + linker emulating GNU ld) 3.1.22 (a9981ae2a7dc3c45f833d0b2202f739d87ac05c8)
clang version 16.0.0 (https://github.com/llvm/llvm-project 8491d01cc385d08b8b4f5dd097239ea0009ddc63)
Target: wasm32-unknown-emscripten
Thread model: posix
InstalledDir: D:\soft\emsdk\upstream\bin
```
# emsdk环境变量永久生效
```bash
# 激活最新版本并永久配置环境变量
.\emsdk activate latest --permanent
```

# 测试 
## main.cpp
```cpp
#include <stdio.h>

int main(int argc, char ** argv) {
  printf("Hello World\n");
}
```
```bash
emcc  main.cpp    -s WASM=1 -o hello.html
```

### demo.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
    <script src="ming_wasm.js"></script>
</body>
</html>
<script>
  

   // 全局错误处理
        window.onerror = function(message, source, lineno, colno, error) {
            console.error('全局错误:', message, source, lineno, colno, error);
            return true;
        };
        // 配置Module对象
        window.Module = window.Module || {};
        
        // 模块初始化完成后的处理
        Module.onRuntimeInitialized = function() {
           console.log('WebAssembly模块已成功初始化');
           console.log("调用_add函数:",Module._add(2, 3));
        };
        // 初始化失败时的处理
        Module.onAbort = function(reason) {
            console.error('WebAssembly初始化失败:', reason);
        };
</script>
```
## index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
    
<script>
    if(1){
            function  fib(n){
                if(n<=1){
                    return n
                }
                return fib(n-1)+fib(n-2)
            }
            console.time("A")
            for(let i=0;i<100000;i++){
                    fib(20);
           }
            console.timeEnd("A")
    }
 
</script>


<script>
    if(1){
        fetch("./fib.wasm")
            .then(res=>res.arrayBuffer())
            .then(bytes=>WebAssembly.compile(bytes))
            .then(mod=>{
                const instance=new WebAssembly.Instance(mod);
                const U=instance.exports;
                console.time("B");
                 for(let i=0;i<100000;i++){
                    U.myfib(20);
                 }
                console.timeEnd("B"); 
            })
    }
</script>


</body>
</html>
```

```cpp
#include <stdio.h>
#include <emscripten/emscripten.h>

int main(int argc, char ** argv) {
    
}

#ifdef __cplusplus
extern "C" {
#endif

int  EMSCRIPTEN_KEEPALIVE    myfib(int n){
    if(n<=1){
        return n;
    }
    return myfib(n-1)+myfib(n-2);
}

#ifdef __cplusplus
}
#endif

```
## main.cpp
```cpp
#include <stdio.h>
#include <stdint.h>
#include <ctime>
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
}



```



```bash
emcc main.cpp -o fib.js -O2 -s EXPORTED_FUNCTIONS='["_myfib"]' -s MODULARIZE=1               
```

# makeFile 导出es6的js封装库
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

# 生成目标
all: $(TARGET) $(HTML_FILE)

# 统一编译所有C++源文件生成JS/WASM
$(TARGET): $(CPP_SOURCES)
	$(CC) $(CFLAGS) $(INCLUDE_DIRS) -o $(TARGET).js $(CPP_SOURCES) -s EXPORTED_FUNCTIONS='["_myfib", "_main", "_add", "_test_function"]' -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap"]' -s SINGLE_FILE=0

# 生成HTML文件，包含完整的WebAssembly运行环境
$(HTML_FILE): $(CPP_SOURCES)
	$(CC) -O3 -s WASM=1 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web -s FILESYSTEM=0 -s NO_EXIT_RUNTIME=1 -s DETERMINISTIC=1 $(INCLUDE_DIRS) -o $(HTML_FILE) $(CPP_SOURCES) -s EXPORTED_FUNCTIONS='["_myfib", "_main", "_add", "_test_function"]' -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap"]' -s SINGLE_FILE=0 -s NO_EXIT_RUNTIME=1

# 清理目标
clean:
	-rm -f $(BUILD_DIR)/*.js $(BUILD_DIR)/*.wasm $(HTML_FILE)

# 声明伪目标
.PHONY: all clean
```

# 测试 ming_wasm.js
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