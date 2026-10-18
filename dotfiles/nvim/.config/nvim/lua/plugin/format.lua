local M = {
    "stevearc/conform.nvim",
    event = { "BufWritePre" },
    cmd = { "ConformInfo" },
    opts = {
        formatters_by_ft = {
            python = { "ruff_organize_imports", "ruff_format" },
            lua = { "stylua" },
        },
        format_on_save = {
            timeout_ms = 2000,
            lsp_format = "fallback",
        },
    },
}

return M
