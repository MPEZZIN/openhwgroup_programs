var g_data = {"name":"/shark0/processing/cv32e40p/users/processing/PRODUCTS_DIGITAL_DESIGN/PANTHER/PANTHER_1.0/CV32/NR/CFG_P_Z0/NR_QUESTA_INT_DEBUG_LONG/workdir/cv32e40p/tb/uvmt/uvmt_cv32e40p_tb_ifs.sv","src":"\n// Copyright 2020 OpenHW Group\n// Copyright 2020 Datum Technology Corporation\n// \n// Licensed under the Solderpad Hardware Licence, Version 2.0 (the \"License\");\n// you may not use this file except in compliance with the License.\n// You may obtain a copy of the License at\n// \n//     https://solderpad.org/licenses/\n// \n// Unless required by applicable law or agreed to in writing, software\n// distributed under the License is distributed on an \"AS IS\" BASIS,\n// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n// See the License for the specific language governing permissions and\n// limitations under the License.\n// \n\n// This file specifies all interfaces used by the CV32E40P test bench (uvmt_cv32e40p_tb).\n// Most interfaces support tasks to allow control by the ENV or test cases.\n\n`ifndef __UVMT_CV32E40P_TB_IFS_SV__\n`define __UVMT_CV32E40P_TB_IFS_SV__\n\n\n/**\n * clocks and reset\n */\ninterface uvmt_cv32e40p_clk_gen_if (output logic core_clock, output logic core_reset_n);\n\n   import uvm_pkg::*;\n   \n   bit       start_clk               = 0;\n   // TODO: get the uvme_cv32e40p_* values from random ENV CFG members.\n   realtime  core_clock_period       = 1500ps; // uvme_cv32e40p_clk_period * 1ps;\n   realtime  reset_deassert_duration = 7400ps; // uvme_cv32e40p_reset_deassert_duarion * 1ps;\n   realtime  reset_assert_duration   = 7400ps; // uvme_cv32e40p_reset_assert_duarion * 1ps;\n   \n   \n   /**\n    * Generates clock and reset signals.\n    * If reset_n comes up de-asserted (1'b1), wait a bit, then assert, then de-assert\n    * Otherwise, leave reset asserted, wait a bit, then de-assert.\n    */\n   initial begin\n      core_clock   = 0; // uvme_cv32e40p_clk_initial_value;\n      core_reset_n = 0; // uvme_cv32e40p_reset_initial_value;\n      wait (start_clk);\n      fork\n         forever begin\n            #(core_clock_period/2) core_clock = ~core_clock;\n         end\n         begin\n           if (core_reset_n == 1'b1) #(reset_deassert_duration);\n           core_reset_n = 1'b0;\n           #(reset_assert_duration);\n           core_reset_n = 1'b1;\n         end\n      join_none\n   end\n   \n   /**\n    * Sets clock period in ps.\n    */\n   function static void set_clk_period ( real clk_period );\n      core_clock_period = clk_period * 1ps;\n   endfunction : set_clk_period\n   \n   /** Triggers the generation of clk. */\n   function static void start();\n      start_clk = 1;\n      `uvm_info(\"CLK_GEN_IF\", \"uvmt_cv32e40p_clk_gen_if.start() called\", UVM_NONE)\n   endfunction : start\n   \nendinterface : uvmt_cv32e40p_clk_gen_if\n\n/**\n * Status information generated by the Virtual Peripherals in the DUT WRAPPER memory.\n */\ninterface uvmt_cv32e40p_vp_status_if (\n                                  output reg        tests_passed,\n                                  output reg        tests_failed,\n                                  output reg        exit_valid,\n                                  output reg [31:0] exit_value\n                                 );\n\n  import uvm_pkg::*;\n\n  // TODO: X/Z checks\n  initial begin\n  end\n\nendinterface : uvmt_cv32e40p_vp_status_if\n\n\n\n/**\n * Core status signals.\n */\ninterface uvmt_cv32e40p_core_status_if (\n                                    input  wire        core_busy,\n                                    input  logic       sec_lvl\n                                   );\n\n  import uvm_pkg::*;\n\nendinterface : uvmt_cv32e40p_core_status_if\n\n/**\n * ISA coverage interface\n * ISS wrapper will fill in ins (instruction) and fire ins_valid event\n */\ninterface uvmt_cv32e40p_isa_covg_if;\n\n  import uvm_pkg::*;\n  import uvme_cv32e40p_pkg::*;\n\n  event ins_valid;\n  ins_t ins;\n\nendinterface : uvmt_cv32e40p_isa_covg_if\n\n/**\n * Step and compare interface\n * Xcelium does not support event types in the module port list\n */\ninterface uvmt_cv32e40p_step_compare_if;\n\n  import uvm_pkg::*;\n\n  // From RTL riscv_tracer.sv\n  typedef struct {\n     logic [ 5:0] addr;\n     logic [31:0] value;\n   } reg_t;\n\n   event        ovp_cpu_valid;      // Indicate instruction successfully retired\n   event        ovp_cpu_trap;       // Indicate exception occured \n   event        ovp_cpu_halt;       // Indicate exception occured \n   bit   [31:0] ovp_cpu_PCr;        // Was iss_wrap.cpu.PCr\n   logic [31:0] ovp_cpu_GPR[32];\n   bit          ovp_cpu_state_idle;\n   bit          ovp_cpu_state_stepi;\n   bit          ovp_cpu_state_stop;\n   bit          ovp_cpu_state_cont;\n\n   event        riscv_retire;       // Was riscv_core.riscv_tracer_i.retire\n   event        riscv_trap;         // new event to indicate RTL took a trap\n   event        riscv_halt;         // new event to indicate RTL took a halt\n   \n   logic [31:0] insn_pc;\n   logic [31:0][31:0] riscy_GPR;    // packed dimensions, register index by data width\n   logic        deferint_prime;     // Stages deferint for the ISS deferint signal\n   logic        deferint_prime_ack; // Set low if deferint_prime was set due to interrupt ack (as opposed to wakeup)\n\n   int  num_pc_checks;\n   int  num_gpr_checks;\n   int  num_csr_checks;\n\n   // Report on the checkers at the end of simulation\n   function void report_step_compare();\n      if (num_pc_checks > 0) begin\n         `uvm_info(\"step_compare\", $sformatf(\"Checked PC 0d%0d times\", num_pc_checks), UVM_LOW);\n      end\n      else begin\n         `uvm_error(\"step_compare\", \"PC was checked 0 times!\");\n      end\n      if (num_gpr_checks > 0) begin\n         `uvm_info(\"step_compare\", $sformatf(\"Checked GPR 0d%0d times\", num_gpr_checks), UVM_LOW);\n      end\n      else begin\n         `uvm_error(\"step_compare\", \"GPR was checked 0 times!\");\n      end\n      if (num_csr_checks > 0) begin\n         `uvm_info(\"step_compare\", $sformatf(\"Checked CSR 0d%0d times\", num_csr_checks), UVM_LOW);\n      end\n      else begin\n         `uvm_error(\"step_compare\", \"CSR was checked 0 times!\");\n      end\n   endfunction // report_step_compare\n   \nendinterface: uvmt_cv32e40p_step_compare_if\n\n// Interface to debug assertions and covergroups\ninterface uvmt_cv32e40p_debug_cov_assert_if\n    import cv32e40p_pkg::*;\n    (\n    input  clk_i,\n    input  rst_ni,\n\n    // Core inputs\n    input         fetch_enable_i, // external core fetch enable\n\n    // External interrupt interface\n    input  [31:0] irq_i,\n    input         irq_ack_o,\n    input  [4:0]  irq_id_o,\n    input  [31:0] mie_q,\n\n    // Instruction fetch stage\n    input         if_stage_instr_rvalid_i, // Instruction word is valid\n    input  [31:0] if_stage_instr_rdata_i, // Instruction word data\n\n    // Instruction ID stage (determines executed instructions)  \n    input         id_stage_instr_valid_i, // instruction word is valid\n    input  [31:0] id_stage_instr_rdata_i, // Instruction word data\n    input         id_stage_is_compressed,\n    input  [31:0] id_stage_pc, // Program counter in decode\n    input  [31:0] if_stage_pc, // Program counter in fetch\n    input         is_decoding,\n    input         branch_taken_ex_i,\n    input         data_err_i,\n    input         is_fetch_failed_i,\n    input         id_valid,\n    input wire ctrl_state_e  ctrl_fsm_cs,            // Controller FSM states with debug_req\n    input         illegal_insn_i,\n    input         illegal_insn_q, // output from controller\n    input         ecall_insn_i,\n\n    input  [31:0] boot_addr_i,\n\n    input         rvfi_valid,\n    input  [31:0] rvfi_insn,\n    input         apu_req,\n    input         apu_gnt,\n    input         apu_busy,\n\n    // Debug signals\n    input         debug_req_i, // From controller\n    input         debug_mode_q, // From controller\n    input  [31:0] dcsr_q, // From controller\n    input  [31:0] depc_q, // From cs regs\n    input  [31:0] depc_n, // \n    input  [31:0] dm_halt_addr_i,\n    input  [31:0] dm_exception_addr_i,\n\n    input  [5:0]  mcause_q,\n    input  [31:0] mtvec,\n    input  [31:0] mepc_q,\n    input  [31:0] tdata1,\n    input  [31:0] tdata2,\n    input  trigger_match_i,\n\n    // Counter related input from cs_registers\n    input  [31:0] mcountinhibit_q,\n    input  [63:0] mcycle,\n    input  [63:0] minstret,\n    input  inst_ret,\n    // WFI Interface\n    input  core_sleep_o,\n\n    input  fence_i,\n      \n    input  csr_access,\n    input  [1:0] csr_op,\n    input  [1:0] csr_op_dec,\n    input  [11:0] csr_addr,\n    input  csr_we_int,\n\n    output logic is_wfi,\n    output logic in_wfi,\n    output logic dpc_will_hit,\n    output logic addr_match,\n    output logic is_ebreak,\n    output logic is_cebreak,\n    output logic is_dret,\n    output logic is_mulhsu,\n    output logic [31:0] pending_enabled_irq,\n    input  pc_set,\n    input  branch_in_decode\n);\n\n  clocking mon_cb @(posedge clk_i);    \n    input #1step\n    fetch_enable_i,\n\n    irq_i,\n    irq_ack_o,\n    irq_id_o,\n    mie_q,\n\n    if_stage_instr_rvalid_i,\n    if_stage_instr_rdata_i,\n\n    id_stage_instr_valid_i,\n    id_stage_instr_rdata_i,\n    id_stage_is_compressed,\n    id_stage_pc,\n    if_stage_pc,\n    is_decoding,\n    branch_taken_ex_i,\n    is_fetch_failed_i,\n    id_valid,\n    ctrl_fsm_cs,\n    illegal_insn_i,\n    illegal_insn_q,\n    ecall_insn_i,\n    boot_addr_i,\n    rvfi_valid,\n    rvfi_insn,\n    apu_req,\n    apu_gnt,\n    apu_busy,\n    debug_req_i,\n    debug_mode_q,\n    dcsr_q,\n    depc_q,\n    depc_n,\n    dm_halt_addr_i,\n    dm_exception_addr_i,\n    mcause_q,\n    mtvec,\n    mepc_q,\n    tdata1,\n    tdata2,\n    trigger_match_i,\n    fence_i,\n    mcountinhibit_q,\n    mcycle,\n    minstret,\n    inst_ret,\n    \n    core_sleep_o,\n    csr_access,\n    csr_op,\n    csr_op_dec,\n    csr_addr,\n    is_wfi,\n    in_wfi,\n    dpc_will_hit,\n    addr_match,\n    is_ebreak,\n    is_cebreak,\n    is_dret,\n    is_mulhsu,\n    pending_enabled_irq,\n    pc_set,\n    branch_in_decode;\n  endclocking : mon_cb\n\nendinterface : uvmt_cv32e40p_debug_cov_assert_if\n\n\n// core-v-verif simplify rvvi for coverage collection purpose \n  `define DEF_CSR_PORTS(CSR_NAME) \\\n  input logic [(XLEN-1):0] csr_``CSR_NAME``_rmask, \\\n  input logic [(XLEN-1):0] csr_``CSR_NAME``_wmask, \\\n  input logic [(XLEN-1):0] csr_``CSR_NAME``_rdata, \\\n  input logic [(XLEN-1):0] csr_``CSR_NAME``_wdata,\n\n  `define DEF_CSR_PORTS_VEC(CSR_NAME, VEC_SIZE) \\\n  input logic [(``VEC_SIZE``-1):0][(XLEN-1):0] csr_``CSR_NAME``_rmask, \\\n  input logic [(``VEC_SIZE``-1):0][(XLEN-1):0] csr_``CSR_NAME``_wmask, \\\n  input logic [(``VEC_SIZE``-1):0][(XLEN-1):0] csr_``CSR_NAME``_rdata, \\\n  input logic [(``VEC_SIZE``-1):0][(XLEN-1):0] csr_``CSR_NAME``_wdata,\n\n  `define ASSIGN_CSR_N_WB(CSR_ADDR, CSR_NAME) \\\n    bit csr_``CSR_NAME``_wb; \\\n    wire [31:0] csr_``CSR_NAME``_w; \\\n    wire [31:0] csr_``CSR_NAME``_r; \\\n    assign csr_``CSR_NAME``_w = csr_``CSR_NAME``_wdata &   csr_``CSR_NAME``_wmask; \\\n    assign csr_``CSR_NAME``_r = csr_``CSR_NAME``_rdata & ~(csr_``CSR_NAME``_wmask); \\\n    assign csr[``CSR_ADDR]    = csr_``CSR_NAME``_w | csr_``CSR_NAME``_r; \\\n    assign csr_wb[``CSR_ADDR] = csr_``CSR_NAME``_wb; \\\n    always @(csr[``CSR_ADDR]) begin \\\n        csr_``CSR_NAME``_wb = 1; \\\n    end \\\n    always @(posedge clk) begin \\\n        if (valid && csr_``CSR_NAME``_wb) begin \\\n            csr_``CSR_NAME``_wb = 0; \\\n        end \\\n    end\n\n  `define ASSIGN_CSR_N_WB_VEC(CSR_ADDR, CSR_NAME, CSR_ID) \\\n    bit csr_``CSR_NAME````CSR_ID``_wb; \\\n    wire [31:0] csr_``CSR_NAME````CSR_ID``_w; \\\n    wire [31:0] csr_``CSR_NAME````CSR_ID``_r; \\\n    assign csr_``CSR_NAME````CSR_ID``_w = csr_``CSR_NAME``_wdata[``CSR_ID] &   csr_``CSR_NAME``_wmask[``CSR_ID]; \\\n    assign csr_``CSR_NAME````CSR_ID``_r = csr_``CSR_NAME``_rdata[``CSR_ID] & ~(csr_``CSR_NAME``_wmask[``CSR_ID]); \\\n    assign csr[``CSR_ADDR]              = csr_``CSR_NAME````CSR_ID``_w | csr_``CSR_NAME````CSR_ID``_r; \\\n    assign csr_wb[``CSR_ADDR]           = csr_``CSR_NAME````CSR_ID``_wb; \\\n    always @(csr[``CSR_ADDR]) begin \\\n        csr_``CSR_NAME````CSR_ID``_wb = 1; \\\n    end \\\n    always @(posedge clk) begin \\\n        if (valid && csr_``CSR_NAME````CSR_ID``_wb) begin \\\n            csr_``CSR_NAME````CSR_ID``_wb = 0; \\\n        end \\\n    end\n\ninterface uvmt_cv32e40p_rvvi_if #(\n  parameter int ILEN    = 32,\n  parameter int XLEN    = 32\n) (\n    \n  input                               clk,\n  input                               valid,\n  input logic [(ILEN-1):0]            insn,\n  input                               trap,\n  input logic [31:0]                  pc_rdata,\n  input logic [31:0]                  wa_csr_mip,\n\n  uvma_interrupt_if                   interrupt_if,\n  uvma_debug_if                       debug_if,\n\n  // Currently only define specific csrs for current usage\n  `DEF_CSR_PORTS(lpstart0)\n  `DEF_CSR_PORTS(lpend0)\n  `DEF_CSR_PORTS(lpcount0)\n  `DEF_CSR_PORTS(lpstart1)\n  `DEF_CSR_PORTS(lpend1)\n  `DEF_CSR_PORTS(lpcount1)\n  `DEF_CSR_PORTS(mstatus)\n  `DEF_CSR_PORTS(mie)\n  `DEF_CSR_PORTS(mtvec)\n  `DEF_CSR_PORTS(mcause)\n  `DEF_CSR_PORTS(mip)\n  `DEF_CSR_PORTS(dcsr)\n  `DEF_CSR_PORTS_VEC(tdata,4)\n\n  input logic [31:0]                  dm_halt_addr\n \n);\n\n  wire [31:0]                 valid_irq;\n  wire [4095:0][32:0]         csr;\n  wire [4095:0]               csr_wb;\n  wire [4:0]                  csr_mcause_ecp_code;\n  wire [2:0]                  csr_dcsr_cause;\n  wire [31:0]                 csr_trig_pc;\n\n  logic [31:0]                irq_onehot_priority;\n  logic [31:0]                mtvec_base_addr;\n  logic [31:0]                mip;\n\n  // assign valid_irq            = csr[`CSR_MIP_ADDR] & csr[`CSR_MIE_ADDR]; // fixme: rvfi misses mip (pending rvfi fixes; workaround probe rtl signals - wa_csr_mip)\n  assign valid_irq            = wa_csr_mip & csr[`CSR_MIE_ADDR];\n  assign dbg_req              = debug_if.debug_req;\n  assign mie                  = csr[`CSR_MSTATUS_ADDR][3];\n  assign mip                  = csr[`CSR_MIP_ADDR];\n\n  assign csr_mcause_irq       = csr[`CSR_MCAUSE_ADDR][31];\n  assign csr_mcause_ecp_code  = csr[`CSR_MCAUSE_ADDR][4:0];\n  assign csr_dcsr_ebreakm     = csr[`CSR_DCSR_ADDR][15];\n  assign csr_dcsr_stepie      = csr[`CSR_DCSR_ADDR][11];\n  assign csr_dcsr_cause       = csr[`CSR_DCSR_ADDR][8:6];\n  assign csr_dcsr_step        = csr[`CSR_DCSR_ADDR][2];\n  assign csr_trig_execute     = csr[`CSR_TDATA1_ADDR][2];\n  assign csr_trig_pc          = csr[`CSR_TDATA2_ADDR];\n\n  assign mtvec_base_addr      = {csr[`CSR_MTVEC_ADDR][31:8], 8'h0};\n\n  // can be expanded. Currently only define for current usage\n  `ASSIGN_CSR_N_WB(`CSR_LPSTART0_ADDR, lpstart0)\n  `ASSIGN_CSR_N_WB(`CSR_LPEND0_ADDR, lpend0)\n  `ASSIGN_CSR_N_WB(`CSR_LPCOUNT0_ADDR, lpcount0)\n  `ASSIGN_CSR_N_WB(`CSR_LPSTART1_ADDR, lpstart1)\n  `ASSIGN_CSR_N_WB(`CSR_LPEND1_ADDR, lpend1)\n  `ASSIGN_CSR_N_WB(`CSR_LPCOUNT1_ADDR, lpcount1)\n  `ASSIGN_CSR_N_WB(`CSR_MSTATUS_ADDR, mstatus)\n  `ASSIGN_CSR_N_WB(`CSR_MIE_ADDR, mie)\n  `ASSIGN_CSR_N_WB(`CSR_MTVEC_ADDR, mtvec)\n  `ASSIGN_CSR_N_WB(`CSR_MCAUSE_ADDR, mcause)\n  `ASSIGN_CSR_N_WB(`CSR_MIP_ADDR, mip)\n  `ASSIGN_CSR_N_WB(`CSR_DCSR_ADDR, dcsr)\n  `ASSIGN_CSR_N_WB_VEC(`CSR_TDATA1_ADDR, tdata, 1);\n  `ASSIGN_CSR_N_WB_VEC(`CSR_TDATA2_ADDR, tdata, 2);\n\n  // irq_onehot_priority assignment (refer cv32e40p user manual, section 10.2)\n  // priority order (high->low) is irq[31]...irq[16], irq[11], irq[3], irq[7]\n  always @(valid_irq) begin\n    irq_onehot_priority = 0;\n    for (int i = 31; i != 0; i--) begin\n      if (valid_irq[i] && (i inside {31,30,29,28,27,26,25,24,23,22,21,20,19,18,17,16, 11,3,7})) begin\n        if (i == 7 && valid_irq[3]) continue;\n        else begin irq_onehot_priority[i] = valid_irq[i]; break; end\n      end\n    end\n  end\n    \nendinterface\n\n//\n//Interface for custom TB coverage component\n//\ninterface uvmt_cv32e40p_cov_if\n\n  import uvm_pkg::*;\n  import uvme_cv32e40p_pkg::*;\n  (\n    input               clk_i,\n    input               rst_ni,\n    input               if_stage_instr_rvalid_i,\n    input  [31:0]       if_stage_instr_rdata_i,\n    input               id_stage_instr_valid_i,\n    input               id_stage_id_valid_o,\n    input  [31:0]       id_stage_instr_rdata_i,\n    input               apu_req,\n    input               apu_gnt,\n    input               apu_busy,\n    input  [5:0]        apu_op,\n    input               apu_rvalid_i,\n    input               apu_perf_wb_o,\n    input  [5:0]        id_stage_apu_op_ex_o,\n    input               id_stage_apu_en_ex_o,\n    input  [5:0]        regfile_waddr_wb_o,  // regfile write port A addr from WB stage (lsu write-back)\n    input               regfile_we_wb_o,\n    input  [5:0]        regfile_alu_waddr_ex_o, // regfile write port B addr from EX stage (forwarding)\n    input               regfile_alu_we_ex_o,\n    input               ex_mulh_active,\n    input  [2:0]        ex_mult_op_ex,\n    input               ex_data_misaligned_i,\n    input               ex_data_misaligned_ex_i,\n    input               ex_data_req_i,\n    input               ex_data_rvalid_i,\n    input               ex_regfile_alu_we_i,\n    input               ex_apu_valid,\n    input               ex_apu_rvalid_q,\n    input               debug_req_i,\n    input               debug_mode_q,\n    input  [31:0]       dcsr_q,\n    input               trigger_match_i,\n\n    output logic[5:0]   o_curr_fpu_apu_op_if,\n    output logic[5:0]   o_last_fpu_apu_op_if,\n    output logic[4:0]   if_clk_cycle_window,\n    output [4:0]        curr_fpu_fd,\n    output [4:0]        curr_fpu_rd,\n    output [5:0]        curr_rd_at_ex_regfile_wr_contention,\n    output [5:0]        curr_rd_at_wb_regfile_wr_contention,\n    output [5:0]        prev_rd_waddr_contention,\n    output logic[1:0]   contention_state,\n    output              b2b_contention,\n    output              is_mulh_ex,\n    output              is_misaligned_data_req_ex,\n    output              is_post_inc_ld_st_inst_ex,\n    output              ex_apu_valid_memorised\n  );\n\n  `ifdef FPU_ADDMUL_LAT\n  parameter int FPU_LAT_1_CYC = `FPU_ADDMUL_LAT;\n  `else\n  parameter int FPU_LAT_1_CYC = 0;\n  `endif\n  parameter int MAX_FP_XACT_CYCLE = 19;\n\n  logic [4:0]       clk_cycle_window;\n  logic [5:0]       curr_fpu_apu_op_if;\n  logic [5:0]       last_fpu_contention_op_if;\n  logic [5:0]       prev_regfile_waddr_contention;\n  logic [4:0]       regfile_waddr_wb_fd;\n  logic [4:0]       regfile_alu_waddr_ex_fd;\n  logic [4:0]       regfile_waddr_wb_rd;\n  logic [4:0]       regfile_alu_waddr_ex_rd;\n  logic [5:0]       regfile_waddr_ex_contention;\n  logic [5:0]       regfile_waddr_wb_contention;\n  logic [1:0]       contention_valid;\n  logic             b2b_contention_valid;\n  logic [31:0]      current_instr_rdata;\n  logic [31:0]      previous_instr_rdata;\n\n  initial begin\n      clk_cycle_window = 0;\n      curr_fpu_apu_op_if = 0;\n      regfile_waddr_wb_fd = 0;\n      regfile_alu_waddr_ex_fd = 0;\n      regfile_waddr_wb_rd = 0;\n      regfile_alu_waddr_ex_rd = 0;\n      regfile_waddr_ex_contention = 0;\n      regfile_waddr_wb_contention = 0;\n      contention_valid = 0;\n      b2b_contention_valid = 0;\n  end\n\n  clocking mon_cb @(posedge clk_i);\n      default input #1step output #1ns;\n      input if_stage_instr_rvalid_i;\n      input if_stage_instr_rdata_i;\n      input id_stage_instr_valid_i;\n      input id_stage_id_valid_o;\n      input id_stage_instr_rdata_i;\n      input apu_req;\n      input apu_gnt;\n      input apu_busy;\n      input apu_op;\n      input apu_rvalid_i;\n      input apu_perf_wb_o;\n      input id_stage_apu_op_ex_o;\n      input id_stage_apu_en_ex_o;\n      input debug_req_i;\n      input debug_mode_q;\n      input trigger_match_i;\n      input dcsr_q;\n      inout is_mulh_ex;\n      inout is_misaligned_data_req_ex;\n      inout is_post_inc_ld_st_inst_ex;\n      inout ex_apu_valid_memorised;\n  endclocking : mon_cb\n\n  // bhv_logic_1\n  // calculate each APU operation's current clock cycle number during execution for functional coverage use\n  // input(s): apu_op, \n  bit detect_apu_rvalid = 1;\n  bit is_apu_addr_phase = 0;\n  always @(posedge clk_i or negedge rst_ni) begin\n      if (!rst_ni) begin\n        clk_cycle_window    = 0;\n        curr_fpu_apu_op_if  = 0;\n        detect_apu_rvalid   = 1;\n        is_apu_addr_phase   = 0;\n      end\n      else begin\n          assert (clk_cycle_window <= MAX_FP_XACT_CYCLE)\n            else `uvm_error(\"uvmt_cv32e40p_cov_if\", $sformatf(\"clk_cycle_window (%0d) > MAX_FP_XACT_CYCLE (%0d)\", clk_cycle_window, MAX_FP_XACT_CYCLE));\n          if (apu_req && apu_gnt && apu_rvalid_i) begin : IS_0_CYC_FPU\n            clk_cycle_window  = (is_apu_addr_phase) ? 1 : 0; // if b2b addr then 1\n            detect_apu_rvalid = (is_apu_addr_phase) ? 0 : 1; // if b2b addr then 0\n            is_apu_addr_phase = 1;\n            curr_fpu_apu_op_if = apu_op;\n          end\n          else if (apu_req && apu_gnt && !apu_rvalid_i) begin : NOT_0_CYC_FPU\n            clk_cycle_window  = 1;\n            detect_apu_rvalid = 0;\n            is_apu_addr_phase = 1;\n            curr_fpu_apu_op_if = apu_op;\n          end\n          else if (apu_busy && !apu_rvalid_i && !detect_apu_rvalid) begin : FPU_MULT_CYC\n            // fpu write delay should not increase the cyc cnt\n            clk_cycle_window += 1;\n          end\n          else if (apu_busy && apu_rvalid_i && !detect_apu_rvalid) begin : DONE_FPU_CYCLE\n            clk_cycle_window  = 0;\n            detect_apu_rvalid = 1;\n            is_apu_addr_phase = 0;\n          end\n          else if (!apu_busy && detect_apu_rvalid) begin\n            clk_cycle_window  = 0;\n          end\n      end\n  end\n\n  // bhv_logic_1a\n  // sample decoded instr that execute in progress\n  always @(posedge clk_i or negedge rst_ni) begin\n    if(!rst_ni) begin\n      previous_instr_rdata <= 0;\n      current_instr_rdata  <= 0;\n    end\n    else begin\n      if (id_stage_instr_valid_i && id_stage_id_valid_o) begin\n        previous_instr_rdata <= current_instr_rdata;\n        current_instr_rdata  <= id_stage_instr_rdata_i;\n      end\n      else begin\n        previous_instr_rdata <= current_instr_rdata;\n      end\n    end\n  end\n\n  // bhv_logic_2 (revised)\n  // Model APU contention state in EX/WB for functional coverage\n  // input(s): apu_perf_wb_o, regfile_waddr_wb_o, regfile_alu_waddr_ex_o\n  always @(posedge clk_i or negedge rst_ni) begin\n      if(!rst_ni) begin\n          contention_valid <= 0;\n          b2b_contention_valid <= 0;\n          last_fpu_contention_op_if <= 0;\n          prev_regfile_waddr_contention <= 0;\n      end\n      else begin\n          if (((contention_valid == 0) || (contention_valid == 2)) && (apu_perf_wb_o)) begin\n            contention_valid <= 1; //set contention_valid\n            b2b_contention_valid <= 0;\n            last_fpu_contention_op_if <= curr_fpu_apu_op_if;\n          end\n          else if((contention_valid == 1) && (apu_perf_wb_o)) begin\n            contention_valid <= 1; //reset contention_valid\n            b2b_contention_valid <= 1;\n            // if no APU execution during contention then nothing to do\n            // during contention another APU transaction cannot go through\n          end\n          else if((contention_valid == 1) && (!apu_perf_wb_o)) begin\n              contention_valid <= 2; //stalled write complete after contention\n              b2b_contention_valid <= 1;\n              if (FPU_LAT_1_CYC != 1) begin // IS_0_OR_2_CYCLAT\n                prev_regfile_waddr_contention <= regfile_alu_waddr_ex_o; // port B\n              end\n              else begin // IS_1_CYCLAT\n                prev_regfile_waddr_contention <= regfile_waddr_wb_o; // port A\n              end\n          end\n          else begin\n              contention_valid <= 0;\n              b2b_contention_valid <= 0;\n              prev_regfile_waddr_contention <= 0;\n          end\n      end\n  end\n\n\n  // bhv_logic_3\n  // sample each APU operation's destination register address for functional coverage\n  // input(s): apu_req, apu_busy, regfile_alu_we_ex_o, regfile_we_wb_o,  apu_rvalid_i\n  always @(posedge clk_i or negedge rst_ni) begin\n      if(!rst_ni) begin\n          regfile_alu_waddr_ex_fd <= 0;\n          regfile_alu_waddr_ex_rd <= 0;\n          regfile_waddr_wb_fd <= 0;\n          regfile_waddr_wb_rd <= 0;\n          regfile_waddr_wb_contention <= 0;\n          regfile_waddr_ex_contention <= 0;\n      end\n      else begin\n        if (FPU_LAT_1_CYC != 1) begin // IS_0_OR_2_CYCLAT\n          //Case for FPU Latency {0,2,3,4}, with regfile write from EX stage with highest priority of APU\n          if (((apu_req == 1) || (apu_busy == 1)) && (regfile_alu_we_ex_o == 1) && (apu_rvalid_i == 1)) begin\n              regfile_alu_waddr_ex_fd <= (regfile_alu_waddr_ex_o - 32);\n              regfile_alu_waddr_ex_rd <= (regfile_alu_waddr_ex_o < 32) ? regfile_alu_waddr_ex_o : 0;\n              regfile_waddr_ex_contention <= 0;\n              regfile_waddr_wb_contention <= 0;\n          end\n          else if ((contention_valid == 1) && (regfile_alu_we_ex_o == 1) && !apu_perf_wb_o) begin // write for stalled regfile wr at contention\n              regfile_alu_waddr_ex_fd <= 0;\n              regfile_alu_waddr_ex_rd <= 0;\n              regfile_waddr_ex_contention <= regfile_alu_waddr_ex_o; //should not be >31, check for illegal in coverage\n              regfile_waddr_wb_contention <= 0;\n          end\n          else begin\n              regfile_alu_waddr_ex_fd <= 0;\n              regfile_alu_waddr_ex_rd <= 0;\n              regfile_waddr_wb_fd <= 0;\n              regfile_waddr_wb_rd <= 0;\n              regfile_waddr_ex_contention <= 0;\n              regfile_waddr_wb_contention <= 0;\n          end\n        end // IS_0_OR_2_CYCLAT\n        else begin // IS_1_CYCLAT\n          //Case FPU Latency = 1; regfile wr from WB;LSU > priority;no LSU contention, F-inst regfile wr succeed\n          if ((apu_busy == 1) && (regfile_we_wb_o == 1) && (apu_rvalid_i == 1) && (!apu_perf_wb_o)) begin\n              regfile_waddr_wb_fd <= (regfile_waddr_wb_o - 32);\n              regfile_waddr_wb_rd <= (regfile_waddr_wb_o < 32) ? regfile_waddr_wb_o : 0;\n              regfile_waddr_ex_contention <= 0;\n              regfile_waddr_wb_contention <= 0;\n          end\n          //Case FPU Latency = 1; regfile wr from WB;LSU > priority;LSU contention,F-inst regfile wr stall\n          else if((apu_busy == 1) && (regfile_we_wb_o == 1) && (apu_rvalid_i == 1) && (apu_perf_wb_o)) begin\n              regfile_waddr_wb_fd <= 0;\n              regfile_waddr_wb_rd <= 0;\n              regfile_waddr_ex_contention <= 0;\n              regfile_waddr_wb_contention = regfile_waddr_wb_o; // contention between lsu and fpu using wb path\n          end\n          //Case FPU Latency = 1;regfile wr from WB;LSU > priority;LSU contention - FPU reg write cycle after contention\n          else if((contention_valid == 1) && (regfile_we_wb_o == 1) && !apu_perf_wb_o) begin\n              regfile_waddr_wb_fd <= (regfile_waddr_wb_o - 32);\n              regfile_waddr_wb_rd <= (regfile_waddr_wb_o < 32) ? regfile_waddr_wb_o : 0;\n              regfile_waddr_ex_contention <= 0;\n              regfile_waddr_wb_contention <= 0;\n          end\n          else begin\n              regfile_alu_waddr_ex_fd <= 0;\n              regfile_alu_waddr_ex_rd <= 0;\n              regfile_waddr_wb_fd <= 0;\n              regfile_waddr_wb_rd <= 0;\n              regfile_waddr_ex_contention <= 0;\n              regfile_waddr_wb_contention <= 0;\n          end\n        end // IS_1_CYCLAT\n      end\n  end\n\n  assign curr_fpu_fd = regfile_alu_waddr_ex_fd | regfile_waddr_wb_fd;\n  assign curr_fpu_rd = regfile_alu_waddr_ex_rd | regfile_waddr_wb_rd;\n  assign if_clk_cycle_window = clk_cycle_window;\n  assign o_curr_fpu_apu_op_if = curr_fpu_apu_op_if;\n  assign o_last_fpu_apu_op_if = last_fpu_contention_op_if;\n  assign curr_rd_at_ex_regfile_wr_contention = regfile_waddr_ex_contention;\n  assign curr_rd_at_wb_regfile_wr_contention = regfile_waddr_wb_contention;\n  assign contention_state = contention_valid;\n  assign b2b_contention = b2b_contention_valid;\n  assign prev_rd_waddr_contention = prev_regfile_waddr_contention;\n  assign is_mulh_ex = ex_mulh_active && (ex_mult_op_ex == 3'h6);\n  assign is_misaligned_data_req_ex = ex_data_misaligned_i || ex_data_misaligned_ex_i;\n  assign is_post_inc_ld_st_inst_ex = (ex_data_req_i || ex_data_rvalid_i) && ex_regfile_alu_we_i;\n  assign ex_apu_valid_memorised = ex_apu_valid & ex_apu_rvalid_q;\n\nendinterface : uvmt_cv32e40p_cov_if\n\n`endif // __UVMT_CV32E40P_TB_IFS_SV__\n","lang":"verilog"};
processSrcData(g_data);