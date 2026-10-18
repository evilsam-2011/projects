local M = {
    "mfussenegger/nvim-lint",
    event = { "BufReadPost", "BufWritePost", "InsertLeave" },
}

function M.config()
    local lint = require("lint")

    lint.linters_by_ft = {
        python = { "ruff" },
    }

    local function try_lint()
        lint.try_lint()
    end

    vim.api.nvim_create_autocmd({ "BufReadPost", "BufWritePost", "InsertLeave" }, {
        group = vim.api.nvim_create_augroup("nvim-lint", { clear = true }),
        callback = try_lint,
    })

    try_lint()
end

return M
