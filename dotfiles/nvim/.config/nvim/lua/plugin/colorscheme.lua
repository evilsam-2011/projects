local M = {
    "navarasu/onedark.nvim",
    lazy = false,
    priority = 1000,
}

function M.config()
    require("onedark").setup({
        style = "dark",
        colors = {
            bg = "#282c34",
            fg = "#bbc2cf",
            blue = "#51afef",
            green = "#98be65",
            yellow = "#ECBE7B",
            red = "#ff6c6b",
            magenta = "#c678dd",
            grey = "#5b6268",
        },
        highlights = {
            Normal = { bg = "#282c34", fg = "#bbc2cf" },
        },
    })
    require("onedark").load()
end

return M
