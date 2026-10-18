local M = {
    "mfussenegger/nvim-dap",
    dependencies = {
        "mfussenegger/nvim-dap-python",
    },
    ft = "python",
    keys = {
        { "<leader>db", function() require("dap").toggle_breakpoint() end, desc = "Toggle Breakpoint" },
        { "<leader>dc", function() require("dap").continue() end, desc = "Start / Continue Debugging" },
        { "<leader>dn", function() require("dap").step_over() end, desc = "Step Over" },
        { "<leader>di", function() require("dap").step_into() end, desc = "Step Into" },
        { "<leader>do", function() require("dap").step_out() end, desc = "Step Out" },
    },
}

function M.config()
    local dap_python = require("dap-python")
    local mason_debugpy = vim.fn.stdpath("data") .. "/mason/packages/debugpy/venv/bin/python"
    dap_python.setup(mason_debugpy)
end

return M
