
[pico-setup-windows](https://github.com/raspberrypi/pico-setup-windows)

# 全量编译
##  Developer PowerShell中执行以下命令
```bash

cd C:\Users\PC\Documents\Pico-v1.5.1\pico-examples\build\

# 直接用长路径，通过引号和转义处理空格
$env:PICO_SDK_PATH = "D:\Program Files\Raspberry Pi\Pico SDK v1.5.1\pico-sdk"
$env:PICO_TOOLCHAIN_PATH = "D:\Program Files\Raspberry Pi\Pico SDK v1.5.1\gcc-arm-none-eabi\bin"

# 重新执行CMake（用长路径，确保引号包裹）
cmake .. -G "NMake Makefiles" `
  -DPICO_SDK_PATH="$env:PICO_SDK_PATH" `
  -DPICO_TOOLCHAIN_PATH="$env:PICO_TOOLCHAIN_PATH"


nmake blink
```

# 修改blink后,只编译blink
```bash
nmake blink
```
# 下载
```
C:\Users\PC\Documents\Pico-v1.5.1\pico-examples\build\blink\blink.uf2
```

# c_cpp_properties.json
```json
{
    "configurations": [
        {
            "name": "Win32",
            "includePath": [
                "${workspaceFolder}/**",
                "D:/Program Files/Raspberry Pi/Pico SDK v1.5.1/pico-sdk/src/common/pico_stdlib/include",
                "D:/Program Files/Raspberry Pi/Pico SDK v1.5.1/pico-sdk/src/**"
            ],
            "defines": [
                "_DEBUG",
                "UNICODE",
                "_UNICODE"
            ],
            "compilerPath": "D:\\Program Files\\Raspberry Pi\\Pico SDK v1.5.1\\gcc-arm-none-eabi\\bin\\arm-none-eabi-gcc.exe",
            "cStandard": "c17",
            "cppStandard": "gnu++14",
            "intelliSenseMode": "windows-gcc-x86"
        }
    ],
    "version": 4
}

```

# Clion+CMake工程配置
## Toolchains 配置
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/eeb1c0b12741408ebc493df720487989.png)

## CMakeLists.txt
```bash
# Set minimum CMake version required
cmake_minimum_required(VERSION 3.13)

# Set Pico SDK path
set(PICO_SDK_PATH "D:/Program Files/Raspberry Pi/Pico SDK v1.5.1/pico-sdk")

# Include the Pico SDK CMake configuration
include(pico_sdk_import.cmake)

# Set project name and language
project(pipo_project C CXX ASM)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

# Initialize the Pico SDK
pico_sdk_init()

# Add executable target
add_executable(pipo_project
    main.c
)

# Link the Pico SDK libraries
target_link_libraries(pipo_project
    pico_stdlib
)

# Enable USB output, disable UART output
pico_enable_stdio_usb(pipo_project 1)
pico_enable_stdio_uart(pipo_project 0)

# Create additional output files
pico_add_extra_outputs(pipo_project)
```
## pico_sdk_import.cmake
```bash
# This is a copy of the pico_sdk_import.cmake file from the Pico SDK
# It's needed to properly import the Pico SDK in CMake projects

if (DEFINED ENV{PICO_SDK_PATH} AND (NOT PICO_SDK_PATH))
    set(PICO_SDK_PATH $ENV{PICO_SDK_PATH})
    message("Using PICO_SDK_PATH from environment: ${PICO_SDK_PATH}")
endif ()

if (NOT PICO_SDK_PATH)
    message(FATAL_ERROR "PICO_SDK_PATH is not defined. Either set it in the environment, or pass -DPICO_SDK_PATH=xxx to cmake")
endif ()

set(PICO_SDK_INIT_CMAKE_FILE "${PICO_SDK_PATH}/pico_sdk_init.cmake")
if (NOT EXISTS ${PICO_SDK_INIT_CMAKE_FILE})
    message(FATAL_ERROR "Could not find pico_sdk_init.cmake in ${PICO_SDK_PATH}")
endif ()

include(${PICO_SDK_INIT_CMAKE_FILE})
```

## main.c
```c
#include <stdio.h>
#include "pico/stdlib.h"
#include "hardware/gpio.h"

// Define the LED pin (GPIO 25 is the on-board LED for Pico)
#define LED_PIN 25

int main() {
    // Initialize the SDK
    stdio_init_all();
    
    // Configure the LED pin as an output
    gpio_init(LED_PIN);
    gpio_set_dir(LED_PIN, GPIO_OUT);
    
    printf("Pico LED Blink Program\n");
    
    // Blink the LED in a loop
    while (true) {
        // Turn LED on
        gpio_put(LED_PIN, 1);
        sleep_ms(500);  // Wait 500 milliseconds
        
        // Turn LED off
        gpio_put(LED_PIN, 0);
        sleep_ms(500);  // Wait 500 milliseconds
    }
    
    return 0;
}
```
# 如果有问题试试
##  手动执行
```bash
& "D:\Program Files\Raspberry Pi\Pico SDK v1.5.1\cmake\bin\cmake.exe" -DCMAKE_BUILD_TYPE=Debug -DCMAKE_MAKE_PROGRAM="D:/Program Files/JetBrains/CLion 2023.2/bin/ninja/win/x64/ninja.exe" -DPICO_TOOLCHAIN_PATH="D:/Program Files/Raspberry Pi/Pico SDK v1.5.1/gcc-arm-none-eabi/bin" -G Ninja -S D:\workspace\gitee\0\pipocmake -B D:\workspace\gitee\0\pipocmake\cmake-build-debug-pico

& "D:\Program Files\Raspberry Pi\Pico SDK v1.5.1\cmake\bin\cmake.exe" --build "D:\workspace\gitee\0\pipocmake\cmake-build-debug-pico"
```
##  设置环境变量
```
PICO_TOOLCHAIN_PATH=D:/Program Files/Raspberry Pi/Pico SDK v1.5.1/gcc-arm-none-eabi/bin
```
# 输出路径
```bash
D:\workspace\gitee\0\pipocmake\cmake-build-debug-pico\pipo_project.uf2
```


# 拷贝uf2文件到开发板
## copy_uf2.ps1
```bash
$sourceUf2 = "D:\workspace\gitee\0\pipocmake\cmake-build-debug\pipo_project.uf2"
$targetDir = "F:\"
Copy-Item -Path $sourceUf2 -Destination $targetDir -Force
```
## copy_uf2.bat
```bash
@echo off
set "src=D:\workspace\gitee\0\pipocmake\cmake-build-debug\pipo_project.uf2"
set "dst=F:"

if not exist "%src%" (
    echo Error: UF2 file not found!
    pause
    exit 1
)
if not exist "%dst%" (
    echo Error: USB drive %dst% not found!
    pause
    exit 1
)

copy /Y "%src%" %dst%
if %errorlevel% equ 0 (
    echo Success! Pico is rebooting...
) else (
    echo Failed! Reconnect Pico and try again.
)
pause
```