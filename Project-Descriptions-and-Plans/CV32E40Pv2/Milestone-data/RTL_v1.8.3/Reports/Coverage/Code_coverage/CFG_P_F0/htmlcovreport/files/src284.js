var g_data = {"name":"/shark0/processing/cv32e40p/users/processing/PRODUCTS_DIGITAL_DESIGN/PANTHER/PANTHER_1.0/CV32/NR/CFG_P_F0/NR_QUESTA_INT_DEBUG_LONG/workdir/core-v-cores/cv32e40p/rtl/vendor/pulp_platform_fpnew/src/fpnew_noncomp.sv","src":"// Copyright 2019 ETH Zurich and University of Bologna.\n//\n// Copyright and related rights are licensed under the Solderpad Hardware\n// License, Version 0.51 (the \"License\"); you may not use this file except in\n// compliance with the License. You may obtain a copy of the License at\n// http://solderpad.org/licenses/SHL-0.51. Unless required by applicable law\n// or agreed to in writing, software, hardware and materials distributed under\n// this License is distributed on an \"AS IS\" BASIS, WITHOUT WARRANTIES OR\n// CONDITIONS OF ANY KIND, either express or implied. See the License for the\n// specific language governing permissions and limitations under the License.\n//\n// SPDX-License-Identifier: SHL-0.51\n\n// Author: Stefan Mach <smach@iis.ee.ethz.ch>\n\n`include \"common_cells/registers.svh\"\n\nmodule fpnew_noncomp #(\n  parameter fpnew_pkg::fp_format_e   FpFormat    = fpnew_pkg::fp_format_e'(0),\n  parameter int unsigned             NumPipeRegs = 0,\n  parameter fpnew_pkg::pipe_config_t PipeConfig  = fpnew_pkg::BEFORE,\n  parameter type                     TagType     = logic,\n  parameter type                     AuxType     = logic,\n  // Do not change\n  localparam int unsigned WIDTH = fpnew_pkg::fp_width(FpFormat),\n  localparam int unsigned ExtRegEnaWidth = NumPipeRegs == 0 ? 1 : NumPipeRegs\n) (\n  input logic                  clk_i,\n  input logic                  rst_ni,\n  // Input signals\n  input logic [1:0][WIDTH-1:0]     operands_i, // 2 operands\n  input logic [1:0]                is_boxed_i, // 2 operands\n  input fpnew_pkg::roundmode_e     rnd_mode_i,\n  input fpnew_pkg::operation_e     op_i,\n  input logic                      op_mod_i,\n  input TagType                    tag_i,\n  input logic                      mask_i,\n  input AuxType                    aux_i,\n  // Input Handshake\n  input  logic                     in_valid_i,\n  output logic                     in_ready_o,\n  input  logic                     flush_i,\n  // Output signals\n  output logic [WIDTH-1:0]         result_o,\n  output fpnew_pkg::status_t       status_o,\n  output logic                     extension_bit_o,\n  output fpnew_pkg::classmask_e    class_mask_o,\n  output logic                     is_class_o,\n  output TagType                   tag_o,\n  output logic                     mask_o,\n  output AuxType                   aux_o,\n  // Output handshake\n  output logic                     out_valid_o,\n  input  logic                     out_ready_i,\n  // Indication of valid data in flight\n  output logic                     busy_o,\n  // External register enable override\n  input  logic [ExtRegEnaWidth-1:0] reg_ena_i\n);\n\n  // ----------\n  // Constants\n  // ----------\n  localparam int unsigned EXP_BITS = fpnew_pkg::exp_bits(FpFormat);\n  localparam int unsigned MAN_BITS = fpnew_pkg::man_bits(FpFormat);\n  // Pipelines\n  localparam NUM_INP_REGS = (PipeConfig == fpnew_pkg::BEFORE || PipeConfig == fpnew_pkg::INSIDE)\n                            ? NumPipeRegs\n                            : (PipeConfig == fpnew_pkg::DISTRIBUTED\n                               ? ((NumPipeRegs + 1) / 2) // First to get distributed regs\n                               : 0); // no regs here otherwise\n  localparam NUM_OUT_REGS = PipeConfig == fpnew_pkg::AFTER\n                            ? NumPipeRegs\n                            : (PipeConfig == fpnew_pkg::DISTRIBUTED\n                               ? (NumPipeRegs / 2) // Last to get distributed regs\n                               : 0); // no regs here otherwise\n\n  // ----------------\n  // Type definition\n  // ----------------\n  typedef struct packed {\n    logic                sign;\n    logic [EXP_BITS-1:0] exponent;\n    logic [MAN_BITS-1:0] mantissa;\n  } fp_t;\n\n  // ---------------\n  // Input pipeline\n  // ---------------\n  // Input pipeline signals, index i holds signal after i register stages\n  logic                  [0:NUM_INP_REGS][1:0][WIDTH-1:0] inp_pipe_operands_q;\n  logic                  [0:NUM_INP_REGS][1:0]            inp_pipe_is_boxed_q;\n  fpnew_pkg::roundmode_e [0:NUM_INP_REGS]                 inp_pipe_rnd_mode_q;\n  fpnew_pkg::operation_e [0:NUM_INP_REGS]                 inp_pipe_op_q;\n  logic                  [0:NUM_INP_REGS]                 inp_pipe_op_mod_q;\n  TagType                [0:NUM_INP_REGS]                 inp_pipe_tag_q;\n  logic                  [0:NUM_INP_REGS]                 inp_pipe_mask_q;\n  AuxType                [0:NUM_INP_REGS]                 inp_pipe_aux_q;\n  logic                  [0:NUM_INP_REGS]                 inp_pipe_valid_q;\n  // Ready signal is combinatorial for all stages\n  logic [0:NUM_INP_REGS] inp_pipe_ready;\n\n  // Input stage: First element of pipeline is taken from inputs\n  assign inp_pipe_operands_q[0] = operands_i;\n  assign inp_pipe_is_boxed_q[0] = is_boxed_i;\n  assign inp_pipe_rnd_mode_q[0] = rnd_mode_i;\n  assign inp_pipe_op_q[0]       = op_i;\n  assign inp_pipe_op_mod_q[0]   = op_mod_i;\n  assign inp_pipe_tag_q[0]      = tag_i;\n  assign inp_pipe_mask_q[0]     = mask_i;\n  assign inp_pipe_aux_q[0]      = aux_i;\n  assign inp_pipe_valid_q[0]    = in_valid_i;\n  // Input stage: Propagate pipeline ready signal to updtream circuitry\n  assign in_ready_o = inp_pipe_ready[0];\n  // Generate the register stages\n  for (genvar i = 0; i < NUM_INP_REGS; i++) begin : gen_input_pipeline\n    // Internal register enable for this stage\n    logic reg_ena;\n    // Determine the ready signal of the current stage - advance the pipeline:\n    // 1. if the next stage is ready for our data\n    // 2. if the next stage only holds a bubble (not valid) -> we can pop it\n    assign inp_pipe_ready[i] = inp_pipe_ready[i+1] | ~inp_pipe_valid_q[i+1];\n    // Valid: enabled by ready signal, synchronous clear with the flush signal\n    `FFLARNC(inp_pipe_valid_q[i+1], inp_pipe_valid_q[i], inp_pipe_ready[i], flush_i, 1'b0, clk_i, rst_ni)\n    // Enable register if pipleine ready and a valid data item is present\n    assign reg_ena = (inp_pipe_ready[i] & inp_pipe_valid_q[i]) | reg_ena_i[i];\n    // Generate the pipeline registers within the stages, use enable-registers\n    `FFL(inp_pipe_operands_q[i+1], inp_pipe_operands_q[i], reg_ena, '0)\n    `FFL(inp_pipe_is_boxed_q[i+1], inp_pipe_is_boxed_q[i], reg_ena, '0)\n    `FFL(inp_pipe_rnd_mode_q[i+1], inp_pipe_rnd_mode_q[i], reg_ena, fpnew_pkg::RNE)\n    `FFL(inp_pipe_op_q[i+1],       inp_pipe_op_q[i],       reg_ena, fpnew_pkg::FMADD)\n    `FFL(inp_pipe_op_mod_q[i+1],   inp_pipe_op_mod_q[i],   reg_ena, '0)\n    `FFL(inp_pipe_tag_q[i+1],      inp_pipe_tag_q[i],      reg_ena, TagType'('0))\n    `FFL(inp_pipe_mask_q[i+1],     inp_pipe_mask_q[i],     reg_ena, '0)\n    `FFL(inp_pipe_aux_q[i+1],      inp_pipe_aux_q[i],      reg_ena, AuxType'('0))\n  end\n\n  // ---------------------\n  // Input classification\n  // ---------------------\n  fpnew_pkg::fp_info_t [1:0] info_q;\n\n  // Classify input\n  fpnew_classifier #(\n    .FpFormat    ( FpFormat ),\n    .NumOperands ( 2        )\n    ) i_class_a (\n    .operands_i ( inp_pipe_operands_q[NUM_INP_REGS] ),\n    .is_boxed_i ( inp_pipe_is_boxed_q[NUM_INP_REGS] ),\n    .info_o     ( info_q                            )\n  );\n\n  fp_t                 operand_a, operand_b;\n  fpnew_pkg::fp_info_t info_a,    info_b;\n\n  // Packing-order-agnostic assignments\n  assign operand_a = inp_pipe_operands_q[NUM_INP_REGS][0];\n  assign operand_b = inp_pipe_operands_q[NUM_INP_REGS][1];\n  assign info_a    = info_q[0];\n  assign info_b    = info_q[1];\n\n  logic any_operand_inf;\n  logic any_operand_nan;\n  logic signalling_nan;\n\n  // Reduction for special case handling\n  assign any_operand_inf = (| {info_a.is_inf,        info_b.is_inf});\n  assign any_operand_nan = (| {info_a.is_nan,        info_b.is_nan});\n  assign signalling_nan  = (| {info_a.is_signalling, info_b.is_signalling});\n\n  logic operands_equal, operand_a_smaller;\n\n  // Equality checks for zeroes too\n  assign operands_equal    = (operand_a == operand_b) || (info_a.is_zero && info_b.is_zero);\n  // Invert result if non-zero signs involved (unsigned comparison)\n  assign operand_a_smaller = (operand_a < operand_b) ^ (operand_a.sign || operand_b.sign);\n\n  // ---------------\n  // Sign Injection\n  // ---------------\n  fp_t                sgnj_result;\n  fpnew_pkg::status_t sgnj_status;\n  logic               sgnj_extension_bit;\n\n  // Sign Injection - operation is encoded in rnd_mode_q:\n  // RNE = SGNJ, RTZ = SGNJN, RDN = SGNJX, RUP = Passthrough (no NaN-box check)\n  always_comb begin : sign_injections\n    logic sign_a, sign_b; // internal signs\n    // Default assignment\n    sgnj_result = operand_a; // result based on operand a\n\n    // NaN-boxing check will treat invalid inputs as canonical NaNs\n    if (!info_a.is_boxed) sgnj_result = '{sign: 1'b0, exponent: '1, mantissa: 2**(MAN_BITS-1)};\n\n    // Internal signs are treated as positive in case of non-NaN-boxed values\n    sign_a = operand_a.sign & info_a.is_boxed;\n    sign_b = operand_b.sign & info_b.is_boxed;\n\n    // Do the sign injection based on rm field\n    unique case (inp_pipe_rnd_mode_q[NUM_INP_REGS])\n      fpnew_pkg::RNE: sgnj_result.sign = sign_b;          // SGNJ\n      fpnew_pkg::RTZ: sgnj_result.sign = ~sign_b;         // SGNJN\n      fpnew_pkg::RDN: sgnj_result.sign = sign_a ^ sign_b; // SGNJX\n      fpnew_pkg::RUP: sgnj_result      = operand_a;       // passthrough\n      default: sgnj_result = '{default: fpnew_pkg::DONT_CARE}; // don't care\n    endcase\n  end\n\n  assign sgnj_status = '0;        // sign injections never raise exceptions\n\n  // op_mod_q enables integer sign-extension of result (for storing to integer regfile)\n  assign sgnj_extension_bit = inp_pipe_op_mod_q[NUM_INP_REGS] ? sgnj_result.sign : 1'b1;\n\n  // ------------------\n  // Minimum / Maximum\n  // ------------------\n  fp_t                minmax_result;\n  fpnew_pkg::status_t minmax_status;\n  logic               minmax_extension_bit;\n\n  // Minimum/Maximum - operation is encoded in rnd_mode_q:\n  // RNE = MIN, RTZ = MAX\n  always_comb begin : min_max\n    // Default assignment\n    minmax_status = '0;\n\n    // Min/Max use quiet comparisons - only sNaN are invalid\n    minmax_status.NV = signalling_nan;\n\n    // Both NaN inputs cause a NaN output\n    if (info_a.is_nan && info_b.is_nan)\n      minmax_result = '{sign: 1'b0, exponent: '1, mantissa: 2**(MAN_BITS-1)}; // canonical qNaN\n    // If one operand is NaN, the non-NaN operand is returned\n    else if (info_a.is_nan) minmax_result = operand_b;\n    else if (info_b.is_nan) minmax_result = operand_a;\n    // Otherwise decide according to the operation\n    else begin\n      unique case (inp_pipe_rnd_mode_q[NUM_INP_REGS])\n        fpnew_pkg::RNE: minmax_result = operand_a_smaller ? operand_a : operand_b; // MIN\n        fpnew_pkg::RTZ: minmax_result = operand_a_smaller ? operand_b : operand_a; // MAX\n        default: minmax_result = '{default: fpnew_pkg::DONT_CARE}; // don't care\n      endcase\n    end\n  end\n\n  assign minmax_extension_bit = 1'b1; // NaN-box as result is always a float value\n\n  // ------------\n  // Comparisons\n  // ------------\n  fp_t                cmp_result;\n  fpnew_pkg::status_t cmp_status;\n  logic               cmp_extension_bit;\n\n  // Comparisons - operation is encoded in rnd_mode_q:\n  // RNE = LE, RTZ = LT, RDN = EQ\n  // op_mod_q inverts boolean outputs\n  always_comb begin : comparisons\n    // Default assignment\n    cmp_result = '0; // false\n    cmp_status = '0; // no flags\n\n    // Signalling NaNs always compare as false and are illegal\n    if (signalling_nan) cmp_status.NV = 1'b1; // invalid operation\n    // Otherwise do comparisons\n    else begin\n      unique case (inp_pipe_rnd_mode_q[NUM_INP_REGS])\n        fpnew_pkg::RNE: begin // Less than or equal\n          if (any_operand_nan) cmp_status.NV = 1'b1; // Signalling comparison: NaNs are invalid\n          else cmp_result = (operand_a_smaller | operands_equal) ^ inp_pipe_op_mod_q[NUM_INP_REGS];\n        end\n        fpnew_pkg::RTZ: begin // Less than\n          if (any_operand_nan) cmp_status.NV = 1'b1; // Signalling comparison: NaNs are invalid\n          else cmp_result = (operand_a_smaller & ~operands_equal) ^ inp_pipe_op_mod_q[NUM_INP_REGS];\n        end\n        fpnew_pkg::RDN: begin // Equal\n          if (any_operand_nan) cmp_result = inp_pipe_op_mod_q[NUM_INP_REGS]; // NaN always not equal\n          else cmp_result = operands_equal ^ inp_pipe_op_mod_q[NUM_INP_REGS];\n        end\n        default: cmp_result = '{default: fpnew_pkg::DONT_CARE}; // don't care\n      endcase\n    end\n  end\n\n  assign cmp_extension_bit = 1'b0; // Comparisons always produce booleans in integer registers\n\n  // ---------------\n  // Classification\n  // ---------------\n  fpnew_pkg::status_t    class_status;\n  logic                  class_extension_bit;\n  fpnew_pkg::classmask_e class_mask_d; // the result is actually here\n\n  // Classification - always return the classification mask on the dedicated port\n  always_comb begin : classify\n    if (info_a.is_normal) begin\n      class_mask_d = operand_a.sign       ? fpnew_pkg::NEGNORM    : fpnew_pkg::POSNORM;\n    end else if (info_a.is_subnormal) begin\n      class_mask_d = operand_a.sign       ? fpnew_pkg::NEGSUBNORM : fpnew_pkg::POSSUBNORM;\n    end else if (info_a.is_zero) begin\n      class_mask_d = operand_a.sign       ? fpnew_pkg::NEGZERO    : fpnew_pkg::POSZERO;\n    end else if (info_a.is_inf) begin\n      class_mask_d = operand_a.sign       ? fpnew_pkg::NEGINF     : fpnew_pkg::POSINF;\n    end else if (info_a.is_nan) begin\n      class_mask_d = info_a.is_signalling ? fpnew_pkg::SNAN       : fpnew_pkg::QNAN;\n    end else begin\n      class_mask_d = fpnew_pkg::QNAN; // default value\n    end\n  end\n\n  assign class_status        = '0;   // classification does not set flags\n  assign class_extension_bit = 1'b0; // classification always produces results in integer registers\n\n  // -----------------\n  // Result selection\n  // -----------------\n  fp_t                   result_d;\n  fpnew_pkg::status_t    status_d;\n  logic                  extension_bit_d;\n  logic                  is_class_d;\n\n  // Select result\n  always_comb begin : select_result\n    unique case (inp_pipe_op_q[NUM_INP_REGS])\n      fpnew_pkg::SGNJ: begin\n        result_d        = sgnj_result;\n        status_d        = sgnj_status;\n        extension_bit_d = sgnj_extension_bit;\n      end\n      fpnew_pkg::MINMAX: begin\n        result_d        = minmax_result;\n        status_d        = minmax_status;\n        extension_bit_d = minmax_extension_bit;\n      end\n      fpnew_pkg::CMP: begin\n        result_d        = cmp_result;\n        status_d        = cmp_status;\n        extension_bit_d = cmp_extension_bit;\n      end\n      fpnew_pkg::CLASSIFY: begin\n        result_d        = '{default: fpnew_pkg::DONT_CARE}; // unused\n        status_d        = class_status;\n        extension_bit_d = class_extension_bit;\n      end\n      default: begin\n        result_d        = '{default: fpnew_pkg::DONT_CARE}; // dont care\n        status_d        = '{default: fpnew_pkg::DONT_CARE}; // dont care\n        extension_bit_d = fpnew_pkg::DONT_CARE;             // dont care\n      end\n    endcase\n  end\n\n  assign is_class_d = (inp_pipe_op_q[NUM_INP_REGS] == fpnew_pkg::CLASSIFY);\n\n  // ----------------\n  // Output Pipeline\n  // ----------------\n  // Output pipeline signals, index i holds signal after i register stages\n  fp_t                   [0:NUM_OUT_REGS] out_pipe_result_q;\n  fpnew_pkg::status_t    [0:NUM_OUT_REGS] out_pipe_status_q;\n  logic                  [0:NUM_OUT_REGS] out_pipe_extension_bit_q;\n  fpnew_pkg::classmask_e [0:NUM_OUT_REGS] out_pipe_class_mask_q;\n  logic                  [0:NUM_OUT_REGS] out_pipe_is_class_q;\n  TagType                [0:NUM_OUT_REGS] out_pipe_tag_q;\n  logic                  [0:NUM_OUT_REGS] out_pipe_mask_q;\n  AuxType                [0:NUM_OUT_REGS] out_pipe_aux_q;\n  logic                  [0:NUM_OUT_REGS] out_pipe_valid_q;\n  // Ready signal is combinatorial for all stages\n  logic [0:NUM_OUT_REGS] out_pipe_ready;\n\n  // Input stage: First element of pipeline is taken from inputs\n  assign out_pipe_result_q[0]        = result_d;\n  assign out_pipe_status_q[0]        = status_d;\n  assign out_pipe_extension_bit_q[0] = extension_bit_d;\n  assign out_pipe_class_mask_q[0]    = class_mask_d;\n  assign out_pipe_is_class_q[0]      = is_class_d;\n  assign out_pipe_tag_q[0]           = inp_pipe_tag_q[NUM_INP_REGS];\n  assign out_pipe_mask_q[0]          = inp_pipe_mask_q[NUM_INP_REGS];\n  assign out_pipe_aux_q[0]           = inp_pipe_aux_q[NUM_INP_REGS];\n  assign out_pipe_valid_q[0]         = inp_pipe_valid_q[NUM_INP_REGS];\n  // Input stage: Propagate pipeline ready signal to inside pipe\n  assign inp_pipe_ready[NUM_INP_REGS] = out_pipe_ready[0];\n  // Generate the register stages\n  for (genvar i = 0; i < NUM_OUT_REGS; i++) begin : gen_output_pipeline\n    // Internal register enable for this stage\n    logic reg_ena;\n    // Determine the ready signal of the current stage - advance the pipeline:\n    // 1. if the next stage is ready for our data\n    // 2. if the next stage only holds a bubble (not valid) -> we can pop it\n    assign out_pipe_ready[i] = out_pipe_ready[i+1] | ~out_pipe_valid_q[i+1];\n    // Valid: enabled by ready signal, synchronous clear with the flush signal\n    `FFLARNC(out_pipe_valid_q[i+1], out_pipe_valid_q[i], out_pipe_ready[i], flush_i, 1'b0, clk_i, rst_ni)\n    // Enable register if pipleine ready and a valid data item is present\n    assign reg_ena = (out_pipe_ready[i] & out_pipe_valid_q[i]) | reg_ena_i[NUM_INP_REGS + i];\n    // Generate the pipeline registers within the stages, use enable-registers\n    `FFL(out_pipe_result_q[i+1],        out_pipe_result_q[i],        reg_ena, '0)\n    `FFL(out_pipe_status_q[i+1],        out_pipe_status_q[i],        reg_ena, '0)\n    `FFL(out_pipe_extension_bit_q[i+1], out_pipe_extension_bit_q[i], reg_ena, '0)\n    `FFL(out_pipe_class_mask_q[i+1],    out_pipe_class_mask_q[i],    reg_ena, fpnew_pkg::QNAN)\n    `FFL(out_pipe_is_class_q[i+1],      out_pipe_is_class_q[i],      reg_ena, '0)\n    `FFL(out_pipe_tag_q[i+1],           out_pipe_tag_q[i],           reg_ena, TagType'('0))\n    `FFL(out_pipe_mask_q[i+1],          out_pipe_mask_q[i],          reg_ena, '0)\n    `FFL(out_pipe_aux_q[i+1],           out_pipe_aux_q[i],           reg_ena, AuxType'('0))\n  end\n  // Output stage: Ready travels backwards from output side, driven by downstream circuitry\n  assign out_pipe_ready[NUM_OUT_REGS] = out_ready_i;\n  // Output stage: assign module outputs\n  assign result_o        = out_pipe_result_q[NUM_OUT_REGS];\n  assign status_o        = out_pipe_status_q[NUM_OUT_REGS];\n  assign extension_bit_o = out_pipe_extension_bit_q[NUM_OUT_REGS];\n  assign class_mask_o    = out_pipe_class_mask_q[NUM_OUT_REGS];\n  assign is_class_o      = out_pipe_is_class_q[NUM_OUT_REGS];\n  assign tag_o           = out_pipe_tag_q[NUM_OUT_REGS];\n  assign mask_o          = out_pipe_mask_q[NUM_OUT_REGS];\n  assign aux_o           = out_pipe_aux_q[NUM_OUT_REGS];\n  assign out_valid_o     = out_pipe_valid_q[NUM_OUT_REGS];\n  assign busy_o          = (| {inp_pipe_valid_q, out_pipe_valid_q});\nendmodule\n","lang":"verilog"};
processSrcData(g_data);