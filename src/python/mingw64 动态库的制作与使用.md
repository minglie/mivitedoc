# 工程目录
```bash
PS C:\Users\PC\CLionProjects\my_add> tree /F                                     
├─cmake-build-debug
│  ├─bin
│  │      libmy_add.dll
│  │      python_dll_tets.py
│  CMakeLists.txt
└─src
    │  main.cpp
    └─lib
        my_lib.cpp
        my_lib.h

```

# main.cpp
```c
#include "./lib/my_lib.h"  // 包含 DLL 的头文件
#include <iostream>
int main() {
    // 调用 DLL 中的函数
    int result = add(2, 3);  // 假设 DLL 中定义了 add 函数
    std::cout << "2 + 3 = " << result << std::endl;
    print_hello();  // 假设 DLL 中定义了 print_hello 函数
    return 0;
}
```

# lib/my_lib.h
```c
#ifndef MY_LIB_H
#define MY_LIB_H

// MinGW 兼容的导出/导入声明
#ifdef _WIN32
// 编译 DLL 时定义 MY_LIB_EXPORTS，启用导出
#ifdef MY_LIB_EXPORTS
#define MY_LIB_API __declspec(dllexport)
#else
#define MY_LIB_API __declspec(dllimport)
#endif
#else
#define MY_LIB_API
#endif

// 强制 C 语言命名规则（避免 MinGW32 C++ 编译的名字修饰）
#ifdef __cplusplus
extern "C" {
#endif

// 32位环境下明确指定 int 为 32位（与 MinGW32 兼容）
MY_LIB_API int __cdecl add(int a, int b);  // __cdecl 是 MinGW32 默认调用约定
MY_LIB_API void __cdecl print_hello();

#ifdef __cplusplus
}
#endif

#endif // MY_LIB_H
```
#  lib/my_lib.cpp
```c
#include "my_lib.h"
#include <iostream>

int add(int a, int b) {
    return a + b;
}

void print_hello() {
    std::cout << "Hello from dynamic library!" << std::endl;
}
```

# CMakeLists.txt
```bash
# 最低 CMake 版本要求
cmake_minimum_required(VERSION 3.10)

#是否动态库
set(CON_IS_BUILD_DLL 1)


# 项目名称
project(my_add)

# 设置 C++ 标准（可选，根据需要调整）
set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_STANDARD_REQUIRED ON)


# 输出
if(${CON_IS_BUILD_DLL})
    # 定义动态库：指定源码文件
    add_library(${PROJECT_NAME} SHARED
            src/lib/my_lib.cpp
            src/lib/my_lib.h  # 可选，方便 IDE 识别
    )

else ()
    add_executable(${PROJECT_NAME}
            src/lib/my_lib.h
            src/lib/my_lib.cpp
            src/main.cpp
)
endif()



# 设置动态库输出路径（可选，默认在 build 目录）
set_target_properties(${PROJECT_NAME} PROPERTIES
        LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib  # Linux/macOS
        RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin  # Windows（.dll 属于可执行文件类别）
)

# 安装配置（可选，用于系统级安装）
install(TARGETS ${PROJECT_NAME}
        LIBRARY DESTINATION src  # Linux/macOS: /usr/local/src 等
        RUNTIME DESTINATION bin  # Windows: 安装目录/bin
)
install(FILES src/my_lib.h DESTINATION include)  # 安装头文件
```
# python_dll_tets.py
```py
import os
import ctypes

# 1. 修正 MinGW 路径（用 raw 字符串，避免斜杠问题）
mingw_bin = r"D:\Program Files (x86)\Dev-Cpp\mingw64\bin"  # 去掉末尾的 /，用 \ 分隔
os.environ["PATH"] = mingw_bin + ";" + os.environ["PATH"]

# 2. 明确 DLL 路径（不要用 ./，直接写绝对路径或相对于脚本的路径）
# 假设 Python 脚本和 libmy_add.dll 在同一目录：
dll_path = os.path.join(os.path.dirname(__file__), "libmy_add.dll")
# 若不在同一目录，写绝对路径：
# dll_path = r"C:\Users\PC\CLionProjects\my_add\cmake-build-debug\bin\libmy_add.dll"

# 3. 先检查 DLL 文件是否存在
if not os.path.exists(dll_path):
    print(f"❌ DLL 文件不存在！实际路径：{dll_path}")
else:
    class MyAdd(object):
        def __init__(self, dll_path):
            try:
                # MSVC/VC++ 编译
                # windll.LoadLibrary(dll_path)
                #MinGW/GCC 编译
                self.dll = ctypes.CDLL(dll_path)
                self._init_functions()
                print("✅ DLL 加载成功！")
            except Exception as e:
                print(f"❌ 加载 DLL 失败: {e}")

        def _init_functions(self):
            # 声明 add 函数
            self.add = self.dll.add
            self.add.argtypes = [ctypes.c_int, ctypes.c_int]
            self.add.restype = ctypes.c_int

            # 声明 print_hello 函数
            self.print_hello = self.dll.print_hello
            self.print_hello.argtypes = []
            self.print_hello.restype = None

    # 测试
    if __name__ == "__main__":
        my_add = MyAdd(dll_path)
        if hasattr(my_add, 'add'):
            print(f"2 + 3 = {my_add.add(2, 3)}")
        if hasattr(my_add, 'print_hello'):
            my_add.print_hello()
```

```
✅ DLL 加载成功！
2 + 3 = 5
Hello from dynamic library!
```