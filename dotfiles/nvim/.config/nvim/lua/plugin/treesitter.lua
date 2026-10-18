local M = {
    "nvim-treesitter/nvim-treesitter",
    build = ":TSUpdate",
    lazy = false,
}

function M.config()
    require("nvim-treesitter").setup({})
    require("nvim-treesitter").install({
        "python",
        "c",
        "lua",
        "rust",
        "bash",
        "toml",
        "json",
        "markdown",
    })

    vim.api.nvim_create_autocmd("FileType", {
        callback = function()
            pcall(vim.treesitter.start)
        end,
    })
end

return M
