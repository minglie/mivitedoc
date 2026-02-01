# main.rs
```rust
// 示例：使用 clap 解析命令行，使用 serialport 列出串口并读写
// 运行示例：
//   列出串口： cargo run --bin 15_clap_serialport -- --list
//   读串口：   cargo run --bin 15_clap_serialport -- --port COM3 --baud 9600
//   写串口：   cargo run --bin 15_clap_serialport -- --port COM3 --baud 9600 --write "AT\r\n"

use clap::Parser;
use std::error::Error;
use std::io::{Read, Write};
use std::time::{Duration, Instant};
use std::thread;

#[derive(Parser, Debug)]
#[command(name = "serialtool", version, about = "Simple serial port tool with clap")]
struct Cli {
    /// 列出可用串口
    #[arg(short, long)]
    list: bool,

    /// 要打开的串口名（Windows 如 COM3，Linux 如 /dev/ttyUSB0）
    #[arg(short, long)]
    port: Option<String>,

    /// 波特率（默认 9600）
    #[arg(short, long, default_value_t = 9600)]
    baud: u32,

    /// 写入的字符串（可选，作为 ASCII 原样发送）
    #[arg(short, long)]
    write: Option<String>,

    /// 写入的十六进制字节串（例如："41 54 0D 0A" 或 "41540D0A"）
    #[arg(long, value_name = "HEX")] 
    write_hex: Option<String>,

    /// 读写超时时间（毫秒）
    #[arg(long, default_value_t = 1000)]
    timeout_ms: u64,

    /// 持续监听读取，直到 Ctrl+C 退出
    #[arg(long)]
    listen: bool,

    /// 定时发送的间隔（毫秒），与 --write/--write-hex 配合使用；0 表示只发送一次
    #[arg(long, default_value_t = 0)]
    interval_ms: u64,

    /// 回环：把收到的数据原样再发回端口（默认开启）
    #[arg(long, default_value_t = true)]
    loopback: bool,

    /// 关闭回环：显式禁用回环（优先级高于 --loopback）
    #[arg(long = "no-loopback")]
    no_loopback: bool,
}

fn main() {
    let cli = Cli::parse();

    // 列出串口：显式 --list
    if cli.list {
        if let Err(e) = list_ports() {
            eprintln!("列出串口失败: {}", e);
        }
    }

    // 解析待发送的字节（优先使用 --write-hex；否则使用 --write 的 ASCII 字节）
    let write_bytes: Option<Vec<u8>> = if let Some(hex) = &cli.write_hex {
        match parse_hex(hex) {
            Ok(b) => Some(b),
            Err(err) => {
                eprintln!("解析 --write-hex 失败: {}", err);
                return;
            }
        }
    } else if let Some(s) = &cli.write {
        Some(s.clone().into_bytes())
    } else {
        None
    };

    // 默认行为：无参数时自动监听 COM19
    let effective_listen = if cli.listen { true } else { cli.port.is_none() && !cli.list };

    // 打开端口：未 --list 或显式提供了 --port 时
    let should_open = !cli.list || cli.port.is_some();
    if should_open {
        let port_name = cli.port.clone().unwrap_or_else(|| "COM19".to_string());
        let effective_loopback = if cli.no_loopback { false } else { cli.loopback };
        if let Err(e) = open_and_rw(&port_name, cli.baud, write_bytes.as_deref(), cli.timeout_ms, effective_listen, cli.interval_ms, effective_loopback) {
            eprintln!("打开/读写串口失败: {}", e);
        }
    }
}

fn list_ports() -> Result<(), Box<dyn Error>> {
    let ports = serialport::available_ports()?;
    if ports.is_empty() {
        println!("未发现可用串口");
        return Ok(());
    }

    println!("发现以下串口：");
    for p in ports {
        use serialport::SerialPortType::*;
        print!("- {} ", p.port_name);
        match p.port_type {
            UsbPort(info) => println!("(USB vid={:04x}, pid={:04x}, serial={:?})", info.vid, info.pid, info.serial_number),
            BluetoothPort => println!("(Bluetooth)"),
            PciPort => println!("(PCI)"),
            Unknown => println!("(Unknown)"),
            _ => println!("({:?})", p.port_type),
        }
    }
    Ok(())
}

// 二进制工具：格式化与解析十六进制
fn fmt_hex(data: &[u8]) -> String {
    data.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" ")
}

fn parse_hex(s: &str) -> Result<Vec<u8>, String> {
    let filtered: String = s.chars().filter(|c| c.is_ascii_hexdigit()).collect();
    if filtered.len() % 2 != 0 {
        return Err("十六进制长度必须为偶数（允许空格分隔，但不支持 0x 前缀）".into());
    }
    let mut out = Vec::with_capacity(filtered.len() / 2);
    for i in (0..filtered.len()).step_by(2) {
        let byte_str = &filtered[i..i + 2];
        let byte = u8::from_str_radix(byte_str, 16).map_err(|_| format!("非法十六进制字节: {}", byte_str))?;
        out.push(byte);
    }
    Ok(out)
}

fn open_and_rw(port_name: &str, baud: u32, to_write: Option<&[u8]>, timeout_ms: u64, listen: bool, interval_ms: u64, loopback: bool) -> Result<(), Box<dyn Error>> {
    println!("打开串口: {} @ {}bps", port_name, baud);
    let timeout = Duration::from_millis(timeout_ms);
    let builder = serialport::new(port_name, baud).timeout(timeout);
    let mut port = builder.open()?;

    // 若提供待发送数据，先写入一次（二进制）
    if let Some(data) = to_write {
        println!("写入(HEX): {}", fmt_hex(data));
        port.write_all(data)?;
        port.flush()?;
    }

    // 监听模式：循环读取；可按间隔定时发送（二进制）
    if listen {
        let mut last = Instant::now();
        let mut buf = [0u8; 1024];
        loop {
            if interval_ms > 0 {
                if let Some(data) = to_write {
                    if last.elapsed() >= Duration::from_millis(interval_ms) {
                        println!("定时写入(HEX): {}", fmt_hex(data));
                        port.write_all(data)?;
                        port.flush()?;
                        last = Instant::now();
                    }
                }
            }

            match port.read(&mut buf) {
                Ok(n) => {
                    if n > 0 {
                        println!("读取到 {} 字节", n);
                        println!("HEX: {}", fmt_hex(&buf[..n]));
                        if loopback {
                            port.write_all(&buf[..n])?;
                            port.flush()?;
                            println!("回环发送(HEX): {}", fmt_hex(&buf[..n]));
                        }
                    }
                }
                Err(e) => {
                    use std::io::ErrorKind;
                    if e.kind() != ErrorKind::TimedOut {
                        println!("读取失败: {}", e);
                        thread::sleep(Duration::from_millis(50));
                    }
                    // 超时继续循环
                }
            }
        }
    } else {
        // 非监听：尝试读取一次（二进制）
        let mut buf = [0u8; 1024];
        match port.read(&mut buf) {
            Ok(n) => {
                if n > 0 {
                    println!("读取到 {} 字节", n);
                    println!("HEX: {}", fmt_hex(&buf[..n]));
                    if loopback {
                        port.write_all(&buf[..n])?;
                        port.flush()?;
                        println!("回环发送(HEX): {}", fmt_hex(&buf[..n]));
                    }
                } else {
                    println!("在 {}ms 超时内未读到数据", timeout_ms);
                }
            }
            Err(e) => println!("读取失败: {}", e),
        }
        Ok(())
    }
}
```

# Cargo.toml
```c
[package]
name = "abc"
version = "0.1.0"
edition = "2021"
[dependencies]
clap = { version = "4", features = ["derive"] }
serialport = "4"
```