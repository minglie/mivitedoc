# apb_master.v

```verilog
module apb_master #(
    parameter ADDR_WIDTH = 32,
    parameter DATA_WIDTH = 32
)(
    input  wire                     clk,
    input  wire                     rst_n,
    
    // APB Master Interface
    output reg  [ADDR_WIDTH-1:0]    paddr,      // APB address bus
    output reg                      pwrite,     // Write signal
    output reg  [DATA_WIDTH-1:0]    pwdata,     // Write data
    input  wire [DATA_WIDTH-1:0]    prdata,     // Read data
    output reg                      psel,       // Peripheral select
    output reg                      penable,    // Enable signal
    input  wire                     pready,     // Ready signal
    input  wire                     pslverr,    // Slave error signal
    
    // User Interface
    input  wire                     start,      // Start transfer
    input  wire                     write,      // Write/Read control
    input  wire [ADDR_WIDTH-1:0]    addr,       // Address
    input  wire [DATA_WIDTH-1:0]    wdata,      // Write data
    output reg  [DATA_WIDTH-1:0]    rdata,      // Read data
    output reg                      done,       // Transfer done
    output reg                      error       // Error indicator
);

    // APB State Machine States
    localparam IDLE     = 2'b00;
    localparam SETUP    = 2'b01;
    localparam ACCESS   = 2'b10;
    
    reg [1:0] state, next_state;
    
    // State Machine
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            state <= IDLE;
        else
            state <= next_state;
    end
    
    // Next State Logic
    always @(*) begin
        case (state)
            IDLE: begin
                if (start)
                    next_state = SETUP;
                else
                    next_state = IDLE;
            end
            
            SETUP: begin
                next_state = ACCESS;
            end
            
            ACCESS: begin
                if (pready)
                    next_state = IDLE;
                else
                    next_state = ACCESS;
            end
            
            default: next_state = IDLE;
        endcase
    end
    
    // Output Logic
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            paddr   <= {ADDR_WIDTH{1'b0}};
            pwrite  <= 1'b0;
            pwdata  <= {DATA_WIDTH{1'b0}};
            psel    <= 1'b0;
            penable <= 1'b0;
            rdata   <= {DATA_WIDTH{1'b0}};
            done    <= 1'b0;
            error   <= 1'b0;
        end
        else begin
            case (state)
                IDLE: begin
                    psel    <= 1'b0;
                    penable <= 1'b0;
                    done    <= 1'b0;
                    error   <= 1'b0;
                    
                    if (start) begin
                        paddr  <= addr;
                        pwrite <= write;
                        pwdata <= wdata;
                    end
                end
                
                SETUP: begin
                    psel    <= 1'b1;
                    penable <= 1'b0;
                end
                
                ACCESS: begin
                    penable <= 1'b1;
                    
                    if (pready) begin
                        psel    <= 1'b0;
                        penable <= 1'b0;
                        done    <= 1'b1;
                        error   <= pslverr;
                        
                        if (!pwrite)
                            rdata <= prdata;
                    end
                end
            endcase
        end
    end

endmodule 
```

# apb_slave.v
```verilog
module apb_slave #(
    parameter ADDR_WIDTH = 32,
    parameter DATA_WIDTH = 32,
    parameter MEM_SIZE   = 256    // Memory size in bytes
)(
    input  wire                     clk,
    input  wire                     rst_n,
    
    // APB Slave Interface
    input  wire [ADDR_WIDTH-1:0]    paddr,      // APB address bus
    input  wire                     pwrite,     // Write signal
    input  wire [DATA_WIDTH-1:0]    pwdata,     // Write data
    output reg  [DATA_WIDTH-1:0]    prdata,     // Read data
    input  wire                     psel,       // Peripheral select
    input  wire                     penable,    // Enable signal
    output reg                      pready,     // Ready signal
    output reg                      pslverr     // Slave error signal
);

    // Memory array
    reg [DATA_WIDTH-1:0] memory [0:(MEM_SIZE/DATA_WIDTH)-1];
    
    // Address decoding
    wire valid_addr;
    assign valid_addr = (paddr < MEM_SIZE);
    
    // Memory access
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            prdata  <= {DATA_WIDTH{1'b0}};
            pready  <= 1'b0;
            pslverr <= 1'b0;
        end
        else begin
            if (psel && penable) begin
                if (valid_addr) begin
                    if (pwrite) begin
                        memory[paddr[DATA_WIDTH/8-1:0]] <= pwdata;
                    end
                    else begin
                        prdata <= memory[paddr[DATA_WIDTH/8-1:0]];
                    end
                    pready  <= 1'b1;
                    pslverr <= 1'b0;
                end
                else begin
                    pready  <= 1'b1;
                    pslverr <= 1'b1;
                end
            end
            else begin
                pready  <= 1'b0;
                pslverr <= 1'b0;
            end
        end
    end

endmodule 
```
# tb.v
```verilog
`timescale 1ns/1ps

module tb;
    // Parameters
    parameter ADDR_WIDTH = 32;
    parameter DATA_WIDTH = 32;
    parameter MEM_SIZE   = 256;
    parameter CLK_PERIOD = 10;  // 100MHz clock

    // Clock and reset
    reg clk;
    reg rst_n;

    // APB signals
    wire [ADDR_WIDTH-1:0] paddr;
    wire                  pwrite;
    wire [DATA_WIDTH-1:0] pwdata;
    wire [DATA_WIDTH-1:0] prdata;
    wire                  psel;
    wire                  penable;
    wire                  pready;
    wire                  pslverr;

    // Master control signals
    reg                   start;
    reg                   write;
    reg  [ADDR_WIDTH-1:0] addr;
    reg  [DATA_WIDTH-1:0] wdata;
    wire [DATA_WIDTH-1:0] rdata;
    wire                  done;
    wire                  error;

    // Instantiate APB Master
    apb_master #(
        .ADDR_WIDTH(ADDR_WIDTH),
        .DATA_WIDTH(DATA_WIDTH)
    ) u_apb_master (
        .clk(clk),
        .rst_n(rst_n),
        .paddr(paddr),
        .pwrite(pwrite),
        .pwdata(pwdata),
        .prdata(prdata),
        .psel(psel),
        .penable(penable),
        .pready(pready),
        .pslverr(pslverr),
        .start(start),
        .write(write),
        .addr(addr),
        .wdata(wdata),
        .rdata(rdata),
        .done(done),
        .error(error)
    );

    // Instantiate APB Slave
    apb_slave #(
        .ADDR_WIDTH(ADDR_WIDTH),
        .DATA_WIDTH(DATA_WIDTH),
        .MEM_SIZE(MEM_SIZE)
    ) u_apb_slave (
        .clk(clk),
        .rst_n(rst_n),
        .paddr(paddr),
        .pwrite(pwrite),
        .pwdata(pwdata),
        .prdata(prdata),
        .psel(psel),
        .penable(penable),
        .pready(pready),
        .pslverr(pslverr)
    );

    // Clock generation
    initial begin
        clk = 0;
        forever #(CLK_PERIOD/2) clk = ~clk;
    end

    // Test stimulus
    initial begin
        // Initialize signals
        rst_n = 0;
        start = 0;
        write = 0;
        addr = 0;
        wdata = 0;

        // Reset
        #(CLK_PERIOD*2);
        rst_n = 1;
        #(CLK_PERIOD*2);

        // Test Case 1: Write operation
        $display("Test Case 1: Write operation");
        write = 1;
        addr = 32'h00000000;
        wdata = 32'hA5A5A5A5;
        start = 1;
        #(CLK_PERIOD);
        start = 0;
        wait(done);
        #(CLK_PERIOD*2);

        // Test Case 2: Read operation
        $display("Test Case 2: Read operation");
        write = 0;
        addr = 32'h00000000;
        start = 1;
        #(CLK_PERIOD);
        start = 0;
        wait(done);
        if (rdata === 32'hA5A5A5A5)
            $display("Read data matches: 0x%h", rdata);
        else
            $display("Read data mismatch: Expected 0xA5A5A5A5, Got 0x%h", rdata);
        #(CLK_PERIOD*2);

        // Test Case 3: Write to different address
        $display("Test Case 3: Write to different address");
        write = 1;
        addr = 32'h00000004;
        wdata = 32'h5A5A5A5A;
        start = 1;
        #(CLK_PERIOD);
        start = 0;
        wait(done);
        #(CLK_PERIOD*2);

        // Test Case 4: Read from different address
        $display("Test Case 4: Read from different address");
        write = 0;
        addr = 32'h00000004;
        start = 1;
        #(CLK_PERIOD);
        start = 0;
        wait(done);
        if (rdata === 32'h5A5A5A5A)
            $display("Read data matches: 0x%h", rdata);
        else
            $display("Read data mismatch: Expected 0x5A5A5A5A, Got 0x%h", rdata);
        #(CLK_PERIOD*2);

        // Test Case 5: Invalid address access
        $display("Test Case 5: Invalid address access");
        write = 0;
        addr = 32'h00000100;  // Outside memory range
        start = 1;
        #(CLK_PERIOD);
        start = 0;
        wait(done);
        if (error)
            $display("Error signal asserted as expected for invalid address");
        else
            $display("Error: Error signal not asserted for invalid address");
        #(CLK_PERIOD*2);

        // End simulation
        $display("Simulation completed");
        #(CLK_PERIOD*2);
        $finish;
    end

    // Monitor
    initial begin
        $monitor("Time=%0t rst_n=%b start=%b write=%b addr=%h wdata=%h rdata=%h done=%b error=%b",
                 $time, rst_n, start, write, addr, wdata, rdata, done, error);
    end

endmodule 
```