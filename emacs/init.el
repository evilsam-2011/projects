(menu-bar-mode -1) ;; disable menubar
(tool-bar-mode -1) ;; disable tool bar
(scroll-bar-mode -1) ;; disable scroll bar

(setq inhibit-startup-screen t) ;; no startup screen:

(global-display-line-numbers-mode t) ;; relative line numbers
(setq display-line-numbers-type 'relative)
(setq warning-minimum-level :error)

;; --- Package Management (MELPA) ---
(require 'package)
(add-to-list 'package-archives '("melpa" . "https://melpa.org/packages/") t)
(package-initialize)

;; Download package list if running for the first time
(unless package-archive-contents
  (package-refresh-contents))

;; --- Install & Enable Evil Mode ---
(unless (package-installed-p 'evil)
  (package-install 'evil))

;; Require C-u to work like Vim's scroll half-page up
(setq evil-want-C-u-scroll t)

(require 'evil)
(evil-mode 1)

;; --- Theme: Tokyo Night ---
(unless (package-installed-p 'tokyo-night)
  (package-install 'tokyo-night))

(load-theme 'tokyo-night t) ;; Options: 'tokyo-night, 'tokyo-night-storm, or 'tokyo-night-moon
;; --- Built-in Dired Configuration ---
(setq insert-directory-program "ls")
(setq dired-use-ls-dired nil)

(use-package dired
  :ensure nil
  :custom
  (dired-listing-switches "-aBhl --group-directories-first")
  (dired-auto-revert-buffer t)
  (dired-dwim-target t)
  :config
  (add-hook 'dired-mode-hook 'dired-hide-details-mode))

; --- Font Configuration ---
;; Set JetBrains Mono Nerd Font at 16pt (height 160)
(set-face-attribute 'default nil 
                    :font "JetBrainsMono Nerd Font" 
                    :height 160 
                    :weight 'medium)

(set-face-attribute 'fixed-pitch nil 
                    :font "JetBrainsMono Nerd Font" 
                    :height 160)

;; --- Code Completion (Company Mode) ---
(unless (package-installed-p 'company)
  (package-install 'company))

;; Enable company auto-completion globally
(add-hook 'after-init-hook 'global-company-mode)

;; Fast completion settings
(setq company-minimum-prefix-length 1   ;; Show popup after 1 character
      company-idle-delay 0.0)           ;; Show completion instantly

;; --- Language Server Client (Eglot - Built-in) ---
(use-package eglot
  :ensure nil
  :hook ((c-mode          . eglot-ensure)
         (c++-mode        . eglot-ensure)
         (python-mode     . eglot-ensure))

  :custom
  (eglot-ignored-server-capabilities '(:inlayHintProvider)))

;; Indentation Settings
(setq python-indent-offset 4)
(setq-default c-basic-offset 4)
(setq c-default-style "linux")
(custom-set-variables
 ;; custom-set-variables was added by Custom.
 ;; If you edit it by hand, you could mess it up, so be careful.
 ;; Your init file should contain only one such instance.
 ;; If there is more than one, they won't work right.
 '(package-selected-packages '(company evil gruber-darker-theme vterm)))
(custom-set-faces
 ;; custom-set-faces was added by Custom.
 ;; If you edit it by hand, you could mess it up, so be careful.
 ;; Your init file should contain only one such instance.
 ;; If there is more than one, they won't work right.
 )
;; --- Terminal Replacement (vterm) ---
(unless (package-installed-p 'vterm)
  (package-install 'vterm))

;; Increase scrollback history
(setq vterm-max-scrollback 10000)

;; Toggle function: opens/focuses vterm, or hides it if already active
(defun my/vterm-toggle ()
  "Toggle vterm buffer: open if closed/hidden, hide if currently active."
  (interactive)
  (if (eq major-mode 'vterm-mode)
      (quit-window)
    (vterm)))

;; Bind "vt" in Evil normal mode globally
(with-eval-after-load 'evil
  (evil-define-key 'normal 'global (kbd "v t") 'my/vterm-toggle))

;; Toggle vterm with C-c t
(global-set-key (kbd "C-c t") 'vterm)
