local M = {
    "neovim/nvim-lspconfig",
    dependencies = {
        { "williamboman/mason.nvim", opts = {} },
        "williamboman/mason-lspconfig.nvim",
        "saghen/blink.cmp",
    },
}

function M.config()
    local capabilities = require("blink.cmp").get_lsp_capabilities()

    require("mason").setup()
    require("mason-lspconfig").setup({
        ensure_installed = { "pyright", "ruff", "lua_ls" },
        automatic_enable = true,
    })

    -- Apply Blink capabilities to all LSP servers
    vim.lsp.config("*", {
        capabilities = capabilities,
    })

    -- Pyright for Python typing, autocomplete, and navigation
    vim.lsp.config("pyright", {
        settings = {
            python = {
                analysis = {
                    typeCheckingMode = "basic",
                    autoSearchPaths = true,
                    useLibraryCodeForTypes = true,
                },
            },
        },
    })

    -- Ruff for Python fast linting and code actions
    vim.lsp.config("ruff", {})

    -- Lua LS for Neovim config development
    vim.lsp.config("lua_ls", {
        settings = {
            Lua = {
                diagnostics = {
                    globals = { "vim" },
                },
            },
        },
    })

    -- Enable servers in Neovim 0.11+ / 0.12
    vim.lsp.enable({ "pyright", "ruff", "lua_ls" })
end

return M
