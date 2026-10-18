;; Use bash for internal subprocesses (login shell is fish).
(setq shell-file-name (executable-find "bash"))

(setq doom-font (font-spec :family "JetBrains Mono" :size 18)
      doom-variable-pitch-font (font-spec :family "Open Sans" :size 18))
(setq doom-theme 'doom-one)
(setq display-line-numbers-type 'relative)

;;; Org base directory (set before org loads)
(setq org-directory (expand-file-name "~/Documents/Notes/"))

;;; Org-Roam — same folder as org-directory (flat layout)
(setq org-roam-directory org-directory
      org-roam-dailies-directory "journal")

(setq org-agenda-files '("~/Documents/Notes/TODO.org"))


;; Create dirs if missing
(dolist (dir (list org-directory
                   org-roam-directory
                   (expand-file-name org-roam-dailies-directory org-roam-directory)))
  (unless (file-directory-p dir)
    (make-directory dir t)))

(after! org-roam
  ;; Daily: no body template — just create file with title and open immediately
  (setq org-roam-dailies-capture-templates
        '(("d" "daily" plain ""
           :target (file+head "%<%Y-%m-%d>.org" "#+title: %<%Y-%m-%d>\n")
           :unnarrowed t
           :immediate-finish t)))

  ;; Atomic note: blank file, just the title header
  (setq org-roam-capture-templates
        '(("n" "note" plain "%?"
           :target (file+head "notes/${slug}.org" "#+title: ${title}\n")
           :unnarrowed t))))

;;; Org-Roam UI (knowledge graph in browser)
(use-package! org-roam-ui
  :after org-roam
  :config
  (setq org-roam-ui-sync-theme t
        org-roam-ui-follow t
        org-roam-ui-update-on-save t))

;;; Mixed pitch (variable font for prose, monospace for code/tables)
(use-package! mixed-pitch
  :hook (org-mode . mixed-pitch-mode))

;;; Open org-roam notes fullscreen (not in a bottom popup)
(after! org-roam
  (set-popup-rules!
    '(("^CAPTURE-.*\\.org$" :ignore t)   ; daily / note capture buffers
      ("\\*org-roam\\*"     :ignore t)))) ; org-roam sidebar

;;; Hide *bold*/_italic_ markers (shown only when cursor is on them)
(setq org-hide-emphasis-markers t)

;;; Pretty heading bullets (org-superstar)
(use-package! org-superstar
  :hook (org-mode . org-superstar-mode)
  :config
  (setq org-superstar-remove-leading-stars t
        org-superstar-headline-bullets-list '("◉" "○" "●" "○" "✸" "✿")))

;;; Keybindings — all under SPC n
(map! :leader
      (:prefix ("n" . "notes")
       :desc "Open today's daily"  "d" #'org-roam-dailies-goto-today
       :desc "Find or create note" "f" #'org-roam-node-find
       :desc "Insert link"         "i" #'org-roam-node-insert
       :desc "Open graph"          "g" #'org-roam-ui-open))
