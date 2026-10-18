local M = {
  "nvim-lualine/lualine.nvim",
  dependencies = { "nvim-tree/nvim-web-devicons" },
  event = "VeryLazy",
  opts = {
    options = {
      theme = {
        normal = {
          a = { fg = "#21242b", bg = "#51afef", gui = "bold" },
          b = { fg = "#bbc2cf", bg = "#282c34" },
          c = { fg = "#bbc2cf", bg = "#21242b" },
        },
        insert = {
          a = { fg = "#21242b", bg = "#bbc2cf", gui = "bold" },
        },
        visual = {
          a = { fg = "#21242b", bg = "#5b6268", gui = "bold" },
        },
        replace = {
          a = { fg = "#21242b", bg = "#9ca0a4", gui = "bold" },
        },
        command = {
          a = { fg = "#21242b", bg = "#51afef", gui = "bold" },
        },
        inactive = {
          a = { fg = "#5b6268", bg = "#21242b" },
          b = { fg = "#5b6268", bg = "#21242b" },
          c = { fg = "#5b6268", bg = "#21242b" },
        },
      },
      section_separators = { left = "", right = "" },
      component_separators = { left = "", right = "" },
    },
    sections = {
      lualine_a = {
        {
          "mode",
          separator = { left = "", right = "" },
          padding = { left = 1, right = 1 },
        },
      },
      lualine_b = {
        { "branch", icon = "" },
        {
          "diff",
          symbols = {
            added = " ",
            modified = " ",
            removed = " ",
          },
        },
      },
      lualine_c = {
        {
          "diagnostics",
          symbols = {
            error = " ",
            warn = " ",
            info = " ",
            hint = " ",
          },
        },
        { "filetype", icon_only = true, separator = "", padding = { left = 1, right = 0 } },
        { "filename", path = 1, symbols = { modified = "  ", readonly = "  ", unnamed = " [No Name] " } },
      },
      lualine_x = {
        {
          function()
            local ok, venv_selector = pcall(require, "venv-selector")
            if ok then
              local venv = venv_selector.venv()
              if venv and venv ~= "" then
                return "󰌠 " .. vim.fn.fnamemodify(venv, ":t")
              end
            end
            local env_venv = vim.env.VIRTUAL_ENV
            if env_venv and env_venv ~= "" then
              return "󰌠 " .. vim.fn.fnamemodify(env_venv, ":t")
            end
            return ""
          end,
          cond = function()
            return vim.bo.filetype == "python"
          end,
        },
      },
      lualine_y = {
        { "progress", separator = " ", padding = { left = 1, right = 1 } },
        { "location", padding = { left = 0, right = 1 } },
      },
      lualine_z = {
        {
          function()
            return " " .. os.date("%R")
          end,
          separator = { left = "", right = "" },
          padding = { left = 1, right = 1 },
        },
      },
    },
  },
}

return M
