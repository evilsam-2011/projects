local M = {
    "stevearc/oil.nvim",
    dependencies = { "nvim-tree/nvim-web-devicons" },
    lazy = false,
    keys = {
        { "-", "<cmd>Oil<cr>", desc = "Open Parent Directory" },
        { "<leader>pv", "<cmd>Oil<cr>", desc = "Open Oil File Explorer" },
    },
    opts = {
        default_file_explorer = true,
        delete_to_trash = true,
        skip_confirm_for_simple_edits = true,
        view_options = {
            show_hidden = true,
        },
    },
}

return M
