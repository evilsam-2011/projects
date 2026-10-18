local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.uv.fs_stat(lazypath) then
    vim.fn.system({
        "git",
        "clone",
        "--filter=blob:none",
        "https://github.com/folke/lazy.nvim.git",
        "--branch=stable",
        lazypath,
    })
end
vim.opt.rtp:prepend(lazypath)

require("lazy").setup({
    spec = {
        { import = "plugin.colorscheme" },
        { import = "plugin.treesitter" },
        { import = "plugin.telescope" },
        { import = "plugin.lsp" },
        { import = "plugin.completion" },
        { import = "plugin.format" },
        { import = "plugin.lint" },
        { import = "plugin.venv" },
        { import = "plugin.dap" },
        { import = "plugin.oil" },
        { import = "plugin.lualine" },
        { import = "plugin.flash" },
    },
})
