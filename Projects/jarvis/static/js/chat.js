/**
 * Jarvis — Chat & UI Controller
 * Features: conversation history, system prompt editor, auto-save, voice mode
 */

class SpectreApp {
    constructor() {
        this.isLoading = false;
        this.harryId = null;
        this.pennyId = null;
        this.davidId = null;
        this.currentEmployeeId = null;
        this.currentEmployeeType = 'harry';
        this.employees = [];
        this.chatHistory = [];
        this.currentConversationId = null;
        this.conversations = [];
        this.todos = [];
        this.todoFilter = 'all';

        this.elements = {
            chatMessages: document.getElementById("chatMessages"),
            chatInput: document.getElementById("chatInput"),
            sendBtn: document.getElementById("sendBtn"),
            typingIndicator: document.getElementById("typingIndicator"),
            statusBadge: document.getElementById("statusBadge"),
            statusDot: document.querySelector(".status-dot"),
            statusText: document.getElementById("statusText"),
            newChatBtn: document.getElementById("newChatBtn"),
            tokenUsage: document.getElementById("tokenUsage"),
            chatTab: document.getElementById("chatTab"),
            officeTab: document.getElementById("officeTab"),
            settingsTab: document.getElementById("settingsTab"),
            todosTab: document.getElementById("todosTab"),
            chatPanel: document.getElementById("chatPanel"),
            officePanel: document.getElementById("officePanel"),
            settingsPanel: document.getElementById("settingsPanel"),
            todosPanel: document.getElementById("todosPanel"),
            systemPromptInput: document.getElementById("systemPromptInput"),
            saveSystemPromptBtn: document.getElementById("saveSystemPromptBtn"),
            systemPromptStatus: document.getElementById("systemPromptStatus"),
            memoryInput: document.getElementById("memoryInput"),
            saveMemoryBtn: document.getElementById("saveMemoryBtn"),
            memoryStatus: document.getElementById("memoryStatus"),
            conversationItems: document.getElementById("conversationItems"),
            todosList: document.getElementById("todosList"),
            todoInput: document.getElementById("todoInput"),
            addTodoBtn: document.getElementById("addTodoBtn"),
        };

        this.init();
    }

    init() {
        this.bindEvents();
        this.checkStatus();
        this.loadSystemPrompt();
        this.loadMemory();
        this.office = new OfficeController(this);
        this.loadEmployees();
        this.loadConversations();
        this.checkGoogleStatus();
        this.loadTodos();

        // Start in office mode
        setTimeout(() => {
            this.switchTab("office");
        }, 500);
    }

    async loadEmployees() {
        try {
            const res = await fetch("/api/company/employees");
            const data = await res.json();
            this.employees = data.employees || [];
            const harry = this.employees.find(e => e.name === "Harry");
            const penny = this.employees.find(e => e.name === "Penny");
            const david = this.employees.find(e => e.name === "David");
            if (harry) {
                this.harryId = harry.id;
                if (!this.currentEmployeeId) {
                    this.currentEmployeeId = harry.id;
                    this.currentEmployeeType = 'harry';
                }
            }
            if (penny) {
                this.pennyId = penny.id;
            }
            if (david) {
                this.davidId = david.id;
            }
            this.updateChatUIForEmployee();
        } catch (err) {
            console.error("Failed to load employees:", err);
        }
    }

    bindEvents() {
        this.elements.sendBtn.addEventListener("click", () => this.sendMessage());
        this.elements.chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.elements.chatInput.addEventListener("input", () => {
            this.autoResizeTextarea();
            this.elements.sendBtn.disabled = !this.elements.chatInput.value.trim();
        });
        this.elements.newChatBtn.addEventListener("click", () => this.resetChat());
        this.elements.chatTab.addEventListener("click", () => this.switchTab("chat"));
        this.elements.todosTab.addEventListener("click", () => this.switchTab("todos"));
        this.elements.officeTab.addEventListener("click", () => this.switchTab("office"));
        this.elements.settingsTab.addEventListener("click", () => this.switchTab("settings"));
        this.elements.saveSystemPromptBtn.addEventListener("click", () => this.saveSystemPrompt());
        this.elements.saveMemoryBtn.addEventListener("click", () => this.saveMemory());

        // Employee selector buttons
        document.querySelectorAll('.emp-select-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchEmployee(btn.dataset.employee));
        });

        // Google connection buttons
        const connectBtn = document.getElementById('connectGoogleBtn');
        const disconnectBtn = document.getElementById('disconnectGoogleBtn');
        if (connectBtn) connectBtn.addEventListener('click', () => this.connectGoogle());
        if (disconnectBtn) disconnectBtn.addEventListener('click', () => this.disconnectGoogle());

        // Todo input: Enter to add
        const todoInput = this.elements.todoInput;
        const addTodoBtn = this.elements.addTodoBtn;
        if (todoInput) {
            todoInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addTodo();
                }
            });
        }
        if (addTodoBtn) {
            addTodoBtn.addEventListener('click', () => this.addTodo());
        }

        // Todo filter buttons
        document.querySelectorAll('.todo-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setTodoFilter(btn.dataset.filter);
            });
        });
    }

    async checkStatus() {
        try {
            const res = await fetch("/api/status");
            const data = await res.json();
            this.setStatus(data.status === "ok" ? "online" : "offline",
                data.status === "ok" ? "Spectre is ready" : "No API key");
        } catch {
            this.setStatus("offline", "Server offline");
        }
    }

    setStatus(state, text) {
        this.elements.statusDot.className = `status-dot ${state}`;
        this.elements.statusText.textContent = text;
    }

    async loadSystemPrompt() {
        try {
            const res = await fetch("/api/settings/system-prompt");
            const data = await res.json();
            this.elements.systemPromptInput.value = data.system_prompt;
        } catch { /* fallback */ }
    }

    async saveSystemPrompt() {
        const prompt = this.elements.systemPromptInput.value.trim();
        if (!prompt) { this.showToast("System prompt cannot be empty"); return; }
        try {
            const res = await fetch("/api/settings/system-prompt", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ system_prompt: prompt }),
            });
            if (!res.ok) throw new Error("Failed to save");
            this.showStatus("systemPromptStatus", "Saved!");
        } catch {
            this.showToast("Failed to save system prompt");
        }
    }

    async loadConversations() {
        try {
            const res = await fetch("/api/conversations");
            const data = await res.json();
            this.conversations = data.conversations || [];
            this.renderConversations();
        } catch (err) {
            console.error("Failed to load conversations:", err);
        }
    }

    renderConversations() {
        if (!this.elements.conversationItems) return;
        if (this.conversations.length === 0) {
            this.elements.conversationItems.innerHTML = `
                <div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 12px;">
                    No saved chats
                </div>
            `;
            return;
        }

        this.elements.conversationItems.innerHTML = this.conversations.map(conv => {
            const isActive = conv.id === this.currentConversationId;
            const icon = conv.employee_id === 'group' ? '👥' : '💬';
            return `
                <div class="conv-item ${isActive ? "active" : ""}" data-id="${conv.id}">
                    <span class="nav-icon">${icon}</span>
                    <div class="conv-title" title="${this.escapeHtml(conv.title)}">${this.escapeHtml(conv.title)}</div>
                    <button class="conv-delete" data-id="${conv.id}">✕</button>
                </div>
            `;
        }).join("");

        // Event listeners
        this.elements.conversationItems.querySelectorAll(".conv-item").forEach(item => {
            item.addEventListener("click", (e) => {
                if (e.target.classList.contains("conv-delete")) return;
                this.loadConversation(item.dataset.id);
            });
        });

        this.elements.conversationItems.querySelectorAll(".conv-delete").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.deleteConversation(btn.dataset.id);
            });
        });
    }

    async loadConversation(id) {
        try {
            const res = await fetch(`/api/conversations/${id}`);
            const data = await res.json();
            this.currentConversationId = data.id;
            
            // Map messages to chatHistory format preserving original roles
            this.chatHistory = (data.messages || []).map(m => ({
                role: m.role,
                content: m.content
            }));

            // If conversation has an employee_id, switch to that employee
            if (data.employee_id) {
                if (data.employee_id === 'group') {
                    this.currentEmployeeId = 'group';
                    this.currentEmployeeType = 'group';
                } else if (data.employee_id === this.harryId) {
                    this.currentEmployeeId = this.harryId;
                    this.currentEmployeeType = 'harry';
                } else if (data.employee_id === this.pennyId) {
                    this.currentEmployeeId = this.pennyId;
                    this.currentEmployeeType = 'penny';
                } else if (data.employee_id === this.davidId) {
                    this.currentEmployeeId = this.davidId;
                    this.currentEmployeeType = 'coder';
                } else {
                    this.currentEmployeeId = data.employee_id;
                    this.currentEmployeeType = null;
                }
                this.updateChatUIForEmployee();
            }

            this.renderMessages();
            this.renderConversations();
            
            // Switch tab to Chat
            this.switchTab("chat");
        } catch (err) {
            this.showToast("Failed to load conversation");
        }
    }

    async deleteConversation(id) {
        try {
            const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            
            if (this.currentConversationId === id) {
                this.currentConversationId = null;
                this.chatHistory = [];
                this.clearChatUI();
            }
            await this.loadConversations();
            this.showToast("Chat deleted");
        } catch (err) {
            this.showToast("Failed to delete chat");
        }
    }

    async saveCurrentConversation() {
        if (!this.currentConversationId || this.chatHistory.length === 0) return;
        try {
            // Generate title from first user message
            const firstUser = this.chatHistory.find(m => m.role === "user");
            const empName = this.getCurrentEmployeeName();
            const title = firstUser
                ? firstUser.content.slice(0, 50) + (firstUser.content.length > 50 ? "..." : "")
                : `Chat with ${empName}`;

            await fetch("/api/conversations/messages", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    conversation_id: this.currentConversationId,
                    employee_id: this.currentEmployeeId,
                    title: title,
                    messages: this.chatHistory,
                }),
            });
            await this.loadConversations();
        } catch (err) {
            console.error("Failed to auto-save conversation:", err);
        }
    }

    renderMessages() {
        this.elements.chatMessages.innerHTML = "";
        if (this.chatHistory.length === 0) {
            this.clearChatUI();
            return;
        }
        for (const msg of this.chatHistory) {
            this.addMessageDOM(msg.content, msg.role);
        }
    }

    async createNewConversation() {
        try {
            const res = await fetch("/api/conversations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employee_id: this.currentEmployeeId }),
            });
            const data = await res.json();
            this.currentConversationId = data.id;
            this.chatHistory = [];
            this.clearChatUI();
            this.updateChatUIForEmployee();
            await this.loadConversations();
            this.elements.chatInput.focus();
        } catch (err) {
            this.showToast("Failed to create chat");
        }
    }

    escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    // ---- Extract [MEMORY: ...] from AI replies and save to memory.md ----
    async extractMemory(reply) {
        if (!reply) return;
        const memoryRegex = /\[MEMORY:\s*([\s\S]*?)\]/g;
        let match;
        let found = false;
        while ((match = memoryRegex.exec(reply)) !== null) {
            const content = match[1].trim();
            if (content) {
                found = true;
                try {
                    await fetch("/api/memory/append", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ content: "- " + content }),
                    });
                } catch { /* silent */ }
            }
        }
        if (found) {
            this.loadMemory();  // refresh the memory textarea in Settings
        }
    }

    // ---- Memory ----
    async loadMemory() {
        try {
            const res = await fetch("/api/memory");
            const data = await res.json();
            this.elements.memoryInput.value = data.memory;
        } catch { /* fallback */ }
    }

    async saveMemory() {
        const content = this.elements.memoryInput.value.trim();
        try {
            const res = await fetch("/api/memory", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: content }),
            });
            if (!res.ok) throw new Error("Failed to save");
            this.showStatus("memoryStatus", "Saved!");
        } catch {
            this.showToast("Failed to save memory");
        }
    }

    showStatus(elId, msg) {
        const el = document.getElementById(elId);
        if (!el) return;
        el.textContent = msg;
        el.classList.add("visible");
        setTimeout(() => el.classList.remove("visible"), 2000);
    }

    switchTab(tab) {
        const isChat = tab === "chat";
        const isOffice = tab === "office";
        const isSettings = tab === "settings";
        const isTodos = tab === "todos";

        this.elements.chatTab.classList.toggle("active", isChat);
        this.elements.todosTab.classList.toggle("active", isTodos);
        this.elements.officeTab.classList.toggle("active", isOffice);
        this.elements.settingsTab.classList.toggle("active", isSettings);
        this.elements.chatPanel.classList.toggle("active", isChat);
        this.elements.todosPanel.classList.toggle("active", isTodos);
        this.elements.officePanel.classList.toggle("active", isOffice);
        this.elements.settingsPanel.classList.toggle("active", isSettings);

        if (isChat) {
            this.elements.chatInput.focus();
            this.updateChatUIForEmployee();
        }
        if (isTodos) {
            this.loadTodos();
            setTimeout(() => {
                if (this.elements.todoInput) this.elements.todoInput.focus();
            }, 100);
        }
        if (isOffice && this.office) this.office.onTabShown();
    }

    async resetChat() {
        await this.createNewConversation();
    }

    clearChatUI() {
        this.updateChatUIForEmployee();
        this.elements.tokenUsage.innerHTML = "<span>Tokens: —</span>";
    }

    getCurrentEmployeeName() {
        if (this.currentEmployeeType === 'harry') return 'Harry';
        if (this.currentEmployeeType === 'penny') return 'Penny';
        if (this.currentEmployeeType === 'coder') return 'David';
        if (this.currentEmployeeType === 'group') return 'Group';
        const emp = this.employees.find(e => e.id === this.currentEmployeeId);
        return emp ? emp.name : 'Employee';
    }

    getCurrentEmployeeEmoji() {
        if (this.currentEmployeeType === 'harry') return '👻';
        if (this.currentEmployeeType === 'penny') return '🤖';
        if (this.currentEmployeeType === 'coder') return '💻';
        if (this.currentEmployeeType === 'group') return '💬';
        return '💬';
    }

    getSenderInfo(senderName) {
        const map = {
            'harry': { emoji: '👻', color: '#ff69b4', class: 'harry-avatar' },
            'penny': { emoji: '🤖', color: '#20c997', class: 'penny-avatar' },
            'david': { emoji: '💻', color: '#845ef7', class: 'david-avatar' },
            'ceo':   { emoji: '👑', color: '#ffd700', class: 'user-avatar' },
        };
        const key = (senderName || '').toLowerCase();
        return map[key] || { emoji: '💬', color: '#666', class: 'spectre-avatar' };
    }

    updateChatUIForEmployee() {
        const name = this.getCurrentEmployeeName();
        const emoji = this.getCurrentEmployeeEmoji();
        const isHarry = this.currentEmployeeType === 'harry';
        const isPenny = this.currentEmployeeType === 'penny';
        const isDavid = this.currentEmployeeType === 'coder';
        const isGroup = this.currentEmployeeType === 'group';

        // Update employee selector buttons
        document.querySelectorAll('.emp-select-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.employee === this.currentEmployeeType);
        });

        // Update welcome message
        const welcomeEl = document.getElementById('welcomeMessage');
        const welcomeAvatar = document.getElementById('welcomeAvatar');
        const welcomeContent = document.getElementById('welcomeContent');
        if (welcomeEl) {
            if (isHarry) {
                welcomeAvatar.textContent = '👻';
                welcomeAvatar.style.background = 'linear-gradient(135deg, #ff69b4, #ff7eb8)';
                welcomeContent.innerHTML = `<p>Boo! 👋 Welcome, CEO! I'm <strong>Harry</strong>, your ghostly manager. How can I help you run the company today?</p>`;
            } else if (isPenny) {
                welcomeAvatar.textContent = '🤖';
                welcomeAvatar.style.background = 'linear-gradient(135deg, #20c997, #28d9a7)';
                welcomeContent.innerHTML = `<p>Hello CEO! 👋 I'm <strong>Penny</strong>, your personal assistant. How can I help you stay organized today? 📋</p>`;
            } else if (isDavid) {
                welcomeAvatar.textContent = '💻';
                welcomeAvatar.style.background = 'linear-gradient(135deg, #845ef7, #a27eff)';
                welcomeContent.innerHTML = `<p>Hey CEO! 🚀 I'm <strong>David</strong>, your senior software engineer. Ready to build something awesome. What are we coding today? 💻</p>`;
            } else if (isGroup) {
                welcomeAvatar.textContent = '💬';
                welcomeAvatar.style.background = 'linear-gradient(135deg, #ff69b4, #845ef7, #20c997)';
                welcomeContent.innerHTML = `<p>👋 Welcome to <strong>Group Chat</strong>, CEO! Talk to everyone at once. Use <code>@harry</code>, <code>@penny</code>, or <code>@david</code> to ping someone directly, or ask Harry to delegate tasks to the team!</p>`;
            }
        }

        // Update input placeholder
        const input = this.elements.chatInput;
        if (input) {
            input.placeholder = `Message ${name}...`;
        }

        // Update sidebar footer
        const sidebarName = document.getElementById('sidebarEmployeeName');
        const sidebarEmoji = document.getElementById('sidebarEmployeeEmoji');
        if (sidebarName) sidebarName.textContent = name;
        if (sidebarEmoji) sidebarEmoji.textContent = emoji;

        // Update typing indicator
        const typing = this.elements.typingIndicator;
        if (typing) {
            typing.textContent = `${name} is thinking...`;
        }

        // Update send button title
        const sendBtn = this.elements.sendBtn;
        if (sendBtn) {
            sendBtn.title = `Send to ${name}`;
        }
    }

    switchEmployee(type) {
        if (type === this.currentEmployeeType) return;
        if (type === 'harry' && this.harryId) {
            this.currentEmployeeType = 'harry';
            this.currentEmployeeId = this.harryId;
        } else if (type === 'penny' && this.pennyId) {
            this.currentEmployeeType = 'penny';
            this.currentEmployeeId = this.pennyId;
        } else if (type === 'coder' && this.davidId) {
            this.currentEmployeeType = 'coder';
            this.currentEmployeeId = this.davidId;
        } else if (type === 'group') {
            this.currentEmployeeType = 'group';
            this.currentEmployeeId = 'group';
        } else {
            return;
        }

        // Reset conversation
        this.currentConversationId = null;
        this.chatHistory = [];
        this.clearChatUI();
        this.loadConversations();
        this.elements.chatInput.focus();
    }

    async sendMessage(text) {
        const content = text || this.elements.chatInput.value.trim();
        if (!content || this.isLoading) return;

        const isGroup = this.currentEmployeeType === 'group';

        if (!isGroup && !this.currentEmployeeId) return;

        // Create a conversation if none exists
        if (!this.currentConversationId) {
            try {
                const res = await fetch("/api/conversations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ employee_id: this.currentEmployeeId || 'group' }),
                });
                const data = await res.json();
                this.currentConversationId = data.id;
                await this.loadConversations();
            } catch (err) {
                this.showToast("Failed to create chat");
                return;
            }
        }

        this.elements.chatInput.value = "";
        this.elements.sendBtn.disabled = true;
        this.autoResizeTextarea();

        this.addMessageDOM(content, "user");
        this.chatHistory.push({ role: "user", content });

        // Auto-save user message immediately
        await this.saveCurrentConversation();

        this.setTyping(true);

        const empName = this.getCurrentEmployeeName();

        try {
            let reply;
            if (isGroup) {
                // Group chat — route through group endpoint
                const res = await fetch(`/api/company/group-chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: content,
                        conversation_history: this.chatHistory.slice(-20),
                    }),
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.detail || `Group chat error`);
                }

                const data = await res.json();
                // Process each interaction
                for (const interaction of data.interactions) {
                    const msgText = interaction.type === "delegation"
                        ? `→ **${interaction.from_name}** delegated to **${interaction.to_name}**:\n> ${interaction.message}`
                        : interaction.message;

                    this.addMessageDOM(msgText, interaction.from_name.toLowerCase() === 'ceo' ? 'user' : interaction.from_name);
                    this.chatHistory.push({ role: interaction.from_name.toLowerCase(), content: msgText });
                }
                reply = data.interactions.map(i => i.message).join('\n\n');
            } else {
                // Solo employee chat
                const res = await fetch(`/api/company/chat/${this.currentEmployeeId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: content,
                        conversation_history: this.chatHistory.slice(-20),
                    }),
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.detail || `${empName} is busy right now`);
                }

                const data = await res.json();
                reply = data.reply;

                this.addMessageDOM(reply, "assistant");
                this.chatHistory.push({ role: "assistant", content: reply });

                // Extract memory from reply
                this.extractMemory(reply);

                // Display token usage
                if (data.usage) {
                    this.elements.tokenUsage.innerHTML = `
                        <span>Tokens: ${data.usage.total_tokens} (${data.usage.prompt_tokens}↑ ${data.usage.completion_tokens}↓)</span>
                    `;
                }
            }

            // Auto-save conversation
            await this.saveCurrentConversation();

            // Refresh todos in case Penny modified them
            this.loadTodos();

            return reply;
        } catch (err) {
            const errMsg = `⚠️ **Error:** ${err.message || "Failed to reach " + empName + "."}`;
            this.addMessageDOM(errMsg, "assistant");
            this.chatHistory.push({ role: "assistant", content: errMsg });
            return errMsg;
        } finally {
            this.setTyping(false);
        }
    }

    addMessageDOM(content, role) {
        const div = document.createElement("div");
        const isUser = role === "user";
        const isGroupSender = !isUser && role !== "assistant" && role !== "system";

        // For group chat, role is the sender name (e.g. 'harry', 'penny', 'david')
        let senderInfo;
        if (isUser) {
            senderInfo = { emoji: '👑', class: 'user-avatar', name: 'You' };
        } else if (isGroupSender) {
            senderInfo = this.getSenderInfo(role);
            senderInfo.name = role.charAt(0).toUpperCase() + role.slice(1);
        } else {
            // Solo chat mode — use current employee's info
            const isHarry = this.currentEmployeeType === 'harry';
            const isPenny = this.currentEmployeeType === 'penny';
            const isDavid = this.currentEmployeeType === 'coder';
            if (isHarry) senderInfo = { emoji: '👻', class: 'harry-avatar', name: 'Harry' };
            else if (isPenny) senderInfo = { emoji: '🤖', class: 'penny-avatar', name: 'Penny' };
            else if (isDavid) senderInfo = { emoji: '💻', class: 'david-avatar', name: 'David' };
            else senderInfo = { emoji: '💬', class: 'spectre-avatar', name: 'Assistant' };
        }

        div.className = `message ${isUser ? "user" : "spectre"}`;
        const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        div.innerHTML = `
            <div class="message-avatar ${senderInfo.class}">${senderInfo.emoji}</div>
            <div class="message-content">
                ${isGroupSender ? `<div class="message-sender">${senderInfo.name}</div>` : ''}
                ${this.renderContent(content)}
                <div class="message-time">${time}</div>
            </div>
        `;
        this.elements.chatMessages.appendChild(div);
        this.scrollToBottom();
    }

    renderContent(text) {
        const escaped = this.escapeHtml(text);
        return escaped
            .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
                const langClass = lang ? ` class="language-${lang}"` : "";
                return `<pre><code${langClass}>${code.trim()}</code></pre>`;
            })
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/\*([^*]+)\*/g, "<em>$1</em>")
            .replace(/\n/g, "<br />");
    }

    setTyping(active) {
        this.isLoading = active;
        this.elements.typingIndicator.classList.toggle("active", active);
        this.elements.sendBtn.disabled = active || !this.elements.chatInput.value.trim();
    }

    autoResizeTextarea() {
        const ta = this.elements.chatInput;
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }

    scrollToBottom() {
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }

    showToast(message) {
        const existing = document.querySelector(".toast");
        if (existing) existing.remove();
        const toast = document.createElement("div");
        toast.className = "toast";
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add("visible"));
        setTimeout(() => {
            toast.classList.remove("visible");
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ---- To-Do List ----

    async loadTodos() {
        const list = this.elements.todosList;
        if (!list) return;

        try {
            const filterParam = this.todoFilter === 'all' ? '' : this.todoFilter;
            const res = await fetch(`/api/todos${filterParam ? `?filter=${filterParam}` : ''}`);
            const data = await res.json();
            this.todos = data.todos || [];
            this.renderTodos();
        } catch (err) {
            console.error("Failed to load todos:", err);
            list.innerHTML = `<div class="todo-empty"><div class="todo-empty-icon">⚠️</div>Failed to load tasks</div>`;
        }
    }

    renderTodos() {
        const list = this.elements.todosList;
        if (!list) return;

        // Update filter button active state
        document.querySelectorAll('.todo-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === this.todoFilter);
        });

        if (this.todos.length === 0) {
            const messages = {
                all: '<div class="todo-empty-icon">📋</div>No tasks yet. Add one above!',
                active: '<div class="todo-empty-icon">✅</div>All tasks completed! 🎉',
                completed: '<div class="todo-empty-icon">📋</div>No completed tasks yet.',
            };
            list.innerHTML = `<div class="todo-empty">${messages[this.todoFilter] || messages.all}</div>`;
            return;
        }

        list.innerHTML = this.todos.map(todo => {
            const checked = todo.completed ? 'checked' : '';
            const textClass = todo.completed ? 'todo-text completed' : 'todo-text';
            return `
                <div class="todo-item" data-id="${todo.id}">
                    <div class="todo-checkbox ${checked}" data-id="${todo.id}">${todo.completed ? '✓' : ''}</div>
                    <div class="${textClass}">${this.escapeHtml(todo.text)}</div>
                    <button class="todo-delete-btn" data-id="${todo.id}" title="Delete task">✕</button>
                </div>
            `;
        }).join('');

        // Bind events
        list.querySelectorAll('.todo-checkbox').forEach(cb => {
            cb.addEventListener('click', () => this.toggleTodo(parseInt(cb.dataset.id)));
        });
        list.querySelectorAll('.todo-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => this.deleteTodo(parseInt(btn.dataset.id)));
        });
    }

    async addTodo() {
        const input = this.elements.todoInput;
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        try {
            const res = await fetch('/api/todos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });
            if (!res.ok) throw new Error('Failed to add');
            input.value = '';
            this.todoFilter = 'all';
            await this.loadTodos();
            input.focus();
        } catch (err) {
            this.showToast('Failed to add task: ' + err.message);
        }
    }

    async toggleTodo(id) {
        try {
            const res = await fetch(`/api/todos/${id}/toggle`, { method: 'PUT' });
            if (!res.ok) throw new Error('Failed to toggle');
            await this.loadTodos();
        } catch (err) {
            this.showToast('Failed to update task');
        }
    }

    async deleteTodo(id) {
        try {
            const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            await this.loadTodos();
        } catch (err) {
            this.showToast('Failed to delete task');
        }
    }

    setTodoFilter(filter) {
        this.todoFilter = filter;
        this.loadTodos();
    }

    // ---- Google Services ----

    async checkGoogleStatus() {
        const statusText = document.getElementById('googleStatusText');
        const connectBtn = document.getElementById('connectGoogleBtn');
        const disconnectBtn = document.getElementById('disconnectGoogleBtn');
        if (!statusText) return;

        try {
            const res = await fetch("/api/google/status");
            const data = await res.json();

            if (data.connected) {
                statusText.innerHTML = '<span style="color: var(--success);">✅ Connected to Google Calendar &amp; Gmail</span>';
                if (connectBtn) connectBtn.style.display = 'none';
                if (disconnectBtn) disconnectBtn.style.display = 'inline-block';
            } else if (data.configured) {
                statusText.textContent = '🔑 Google configured — click to connect';
                if (connectBtn) connectBtn.style.display = 'inline-block';
                if (disconnectBtn) disconnectBtn.style.display = 'none';
            } else {
                statusText.innerHTML = '⚠️ Not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to your .env file.';
                if (connectBtn) connectBtn.style.display = 'none';
                if (disconnectBtn) disconnectBtn.style.display = 'none';
            }
        } catch (err) {
            statusText.textContent = '⚠️ Could not check Google status';
            console.error("Google status error:", err);
        }
    }

    async connectGoogle() {
        try {
            const res = await fetch("/api/google/auth-url");
            const data = await res.json();
            if (data.auth_url) {
                // Open Google OAuth in a new window
                window.open(data.auth_url, '_blank', 'width=600,height=700');
                this.showToast('🔄 Complete the authorization in the popup, then return here.');
                
                // Poll for connection status every 2 seconds for 60 seconds
                let attempts = 0;
                const maxAttempts = 30;
                const pollInterval = setInterval(async () => {
                    attempts++;
                    try {
                        const statusRes = await fetch("/api/google/status");
                        const statusData = await statusRes.json();
                        if (statusData.connected) {
                            clearInterval(pollInterval);
                            this.checkGoogleStatus();
                            this.showToast('✅ Google account connected successfully!');
                        }
                    } catch { /* ignore polling errors */ }
                    if (attempts >= maxAttempts) {
                        clearInterval(pollInterval);
                    }
                }, 2000);
            } else {
                this.showToast('Failed to get Google auth URL');
            }
        } catch (err) {
            this.showToast('Failed to connect to Google: ' + err.message);
        }
    }

    async disconnectGoogle() {
        try {
            const res = await fetch("/api/google/disconnect", { method: "POST" });
            if (res.ok) {
                this.showToast('🔌 Google account disconnected');
                this.checkGoogleStatus();
            }
        } catch (err) {
            this.showToast('Failed to disconnect: ' + err.message);
        }
    }
}



/**
 * OfficeController — Virtual Company HQ
 * Manages the office building view, Harry the ghost manager, and employees.
 */
class OfficeController {
    constructor(app) {
        this.app = app;
        this.el = app.elements;
        this.harryId = null;
        this.employees = [];

        this.bindEvents();
        this.loadEmployees();
    }

    bindEvents() {
        const addBtn = document.getElementById("btnAddEmployee");
        const cancelBtn = document.getElementById("cancelAddEmployee");
        const confirmBtn = document.getElementById("confirmAddEmployee");
        const ghostContainer = document.getElementById("ghostContainer");
        const pennyContainer = document.getElementById("pennyGhostContainer");

        addBtn.addEventListener("click", () => {
            document.getElementById("addEmployeeForm").style.display = "flex";
            addBtn.style.display = "none";
        });

        cancelBtn.addEventListener("click", () => {
            document.getElementById("addEmployeeForm").style.display = "none";
            addBtn.style.display = "inline-block";
        });

        confirmBtn.addEventListener("click", () => this.addEmployee());

        // Click Harry to make him zoom around!
        if (ghostContainer) {
            ghostContainer.addEventListener("click", () => this.animateHarry());
        }

        // Click Penny to make her zoom around too!
        if (pennyContainer) {
            pennyContainer.addEventListener("click", () => this.animatePenny());
        }
    }

    async loadEmployees() {
        try {
            const res = await fetch("/api/company/employees");
            const data = await res.json();
            this.employees = data.employees || [];
            // Find Harry
            const harry = this.employees.find(e => e.name === "Harry");
            if (harry) this.harryId = harry.id;
            this.renderEmployees();
            this.renderEmployeeGrid();
        } catch (err) {
            console.error("Failed to load employees:", err);
        }
    }

    async addEmployee() {
        const name = document.getElementById("empNameInput").value.trim();
        const role = document.getElementById("empRoleInput").value.trim();
        const model = document.getElementById("empModelInput").value;

        if (!name || !role) {
            this.app.showToast("Please enter a name and role for the employee.");
            return;
        }

        try {
            const res = await fetch("/api/company/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, role, model }),
            });
            if (!res.ok) throw new Error("Failed to hire");

            const emp = await res.json();
            this.app.showToast(`${emp.name} has been hired! 🎉`);

            // Reset form
            document.getElementById("empNameInput").value = "";
            document.getElementById("empRoleInput").value = "";
            document.getElementById("addEmployeeForm").style.display = "none";
            document.getElementById("btnAddEmployee").style.display = "inline-block";

            await this.loadEmployees();
        } catch (err) {
            this.app.showToast("Failed to hire employee: " + err.message);
        }
    }

    async deleteEmployee(id, name) {
        try {
            const res = await fetch(`/api/company/employees/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to fire");
            this.app.showToast(`${name} has been let go. 🫡`);
            await this.loadEmployees();
        } catch (err) {
            this.app.showToast("Failed to delete employee: " + err.message);
        }
    }

    renderEmployees() {
        const container = document.getElementById("employeesList");
        // Show all employees (including Harry and Penny) for memory editing

        if (this.employees.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px;">
                    <div style="font-size: 32px; margin-bottom: 8px;">👥</div>
                    No team members yet. Click "+ Add Employee" to hire someone!
                </div>
            `;
            return;
        }

        container.innerHTML = this.employees.map(emp => `
            <div class="emp-card">
                <div class="emp-avatar" style="background: ${emp.avatar_color}">
                    ${emp.name.charAt(0).toUpperCase()}
                </div>
                <div class="emp-info">
                    <div class="emp-name">${this.escapeHtml(emp.name)}</div>
                    <div class="emp-role-text">${this.escapeHtml(emp.role)}</div>
                </div>
                <span class="emp-model-badge">${emp.model}</span>
                <button class="emp-memory-btn" data-id="${emp.id}" data-name="${this.escapeHtml(emp.name)}" title="Edit personal memory">🧠</button>
                <button class="emp-personality-btn" data-id="${emp.id}" data-name="${this.escapeHtml(emp.name)}" title="Edit personality">📝</button>
                <button class="emp-delete-btn" data-id="${emp.id}" data-name="${this.escapeHtml(emp.name)}" title="Remove employee">✕</button>
            </div>
            <div class="emp-memory-editor" id="mem-${emp.id}" style="display: none;">
                <div class="emp-memory-editor-header">
                    <span class="emp-memory-editor-title">🧠 ${this.escapeHtml(emp.name)}'s Memory</span>
                </div>
                <textarea class="emp-memory-textarea" rows="3" placeholder="This employee's long-term memory..."></textarea>
                <div class="form-actions" style="margin-top: 6px;">
                    <button class="btn-secondary emp-memory-cancel" data-id="${emp.id}">Cancel</button>
                    <button class="btn-primary emp-memory-save" data-id="${emp.id}">Save Memory</button>
                </div>
            </div>
            <div class="emp-personality-editor" id="per-${emp.id}" style="display: none;">
                <div class="emp-memory-editor-header">
                    <span class="emp-memory-editor-title">📝 ${this.escapeHtml(emp.name)}'s Personality</span>
                </div>
                <textarea class="emp-personality-textarea" rows="3" placeholder="This employee's personality and identity..."></textarea>
                <div class="form-actions" style="margin-top: 6px;">
                    <button class="btn-secondary emp-personality-cancel" data-id="${emp.id}">Cancel</button>
                    <button class="btn-primary emp-personality-save" data-id="${emp.id}">Save Personality</button>
                </div>
            </div>
        `).join("");

        // Add delete handlers
        container.querySelectorAll(".emp-delete-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                this.deleteEmployee(btn.dataset.id, btn.dataset.name);
            });
        });

        // Add memory button handlers
        container.querySelectorAll(".emp-memory-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const editor = document.getElementById(`mem-${btn.dataset.id}`);
                const isHidden = editor.style.display === "none";
                
                // Close all editors
                document.querySelectorAll(".emp-memory-editor, .emp-personality-editor").forEach(el => {
                    el.style.display = "none";
                });
                
                if (isHidden) {
                    try {
                        const res = await fetch(`/api/company/employees/${btn.dataset.id}/memory`);
                        const data = await res.json();
                        const textarea = editor.querySelector(".emp-memory-textarea");
                        textarea.value = data.memory || "";
                    } catch { /* silent */ }
                    editor.style.display = "block";
                }
            });
        });

        // Add memory save handlers
        container.querySelectorAll(".emp-memory-save").forEach(btn => {
            btn.addEventListener("click", async () => {
                const editor = document.getElementById(`mem-${btn.dataset.id}`);
                const textarea = editor.querySelector(".emp-memory-textarea");
                const content = textarea.value.trim();
                try {
                    const res = await fetch(`/api/company/employees/${btn.dataset.id}/memory`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ content: content }),
                    });
                    if (!res.ok) throw new Error();
                    this.app.showToast(`🧠 Memory saved for ${btn.dataset.name}!`);
                    editor.style.display = "none";
                } catch {
                    this.app.showToast("Failed to save memory");
                }
            });
        });

        // Add memory cancel handlers
        container.querySelectorAll(".emp-memory-cancel").forEach(btn => {
            btn.addEventListener("click", () => {
                const editor = document.getElementById(`mem-${btn.dataset.id}`);
                editor.style.display = "none";
            });
        });

        // Add personality button handlers
        container.querySelectorAll(".emp-personality-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const editor = document.getElementById(`per-${btn.dataset.id}`);
                const isHidden = editor.style.display === "none";
                
                // Close all editors
                document.querySelectorAll(".emp-memory-editor, .emp-personality-editor").forEach(el => {
                    el.style.display = "none";
                });
                
                if (isHidden) {
                    try {
                        const res = await fetch(`/api/company/employees/${btn.dataset.id}/personality`);
                        const data = await res.json();
                        const textarea = editor.querySelector(".emp-personality-textarea");
                        textarea.value = data.personality || "";
                    } catch { /* silent */ }
                    editor.style.display = "block";
                }
            });
        });

        // Add personality save handlers
        container.querySelectorAll(".emp-personality-save").forEach(btn => {
            btn.addEventListener("click", async () => {
                const editor = document.getElementById(`per-${btn.dataset.id}`);
                const textarea = editor.querySelector(".emp-personality-textarea");
                const content = textarea.value.trim();
                try {
                    const res = await fetch(`/api/company/employees/${btn.dataset.id}/personality`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ content: content }),
                    });
                    if (!res.ok) throw new Error();
                    this.app.showToast(`📝 Personality saved for ${btn.dataset.name}!`);
                    editor.style.display = "none";
                } catch {
                    this.app.showToast("Failed to save personality");
                }
            });
        });

        // Add personality cancel handlers
        container.querySelectorAll(".emp-personality-cancel").forEach(btn => {
            btn.addEventListener("click", () => {
                const editor = document.getElementById(`per-${btn.dataset.id}`);
                editor.style.display = "none";
            });
        });
    }

    renderEmployeeGrid() {
        const grid = document.getElementById("employeesGrid");
        const empty = document.getElementById("employeesEmpty");
        const others = this.employees.filter(e => e.name !== "Harry" && e.name !== "Penny");

        if (others.length === 0) {
            grid.innerHTML = "";
            empty.style.display = "flex";
            return;
        }

        empty.style.display = "none";
        grid.innerHTML = others.map(emp => `
            <div class="emp-mini-card">
                <span class="emp-mini-dot" style="background: ${emp.avatar_color}"></span>
                <span class="emp-mini-name">${this.escapeHtml(emp.name)}</span>
                <span class="emp-mini-role">${this.escapeHtml(emp.role)}</span>
            </div>
        `).join("");
    }

    escapeHtml(text) {
        return this.app.escapeHtml(text);
    }



    animateHarry() {
        // When clicking Harry, he speeds up and zooms around
        const container = document.getElementById("ghostContainer");
        if (!container) return;
        
        // Add speeding class for a quick burst
        container.classList.add("speeding");
        
        // Trigger a small celebration burst
        const ghost = document.getElementById("ghostHarry");
        if (ghost) {
            ghost.style.animation = "none";
            void ghost.offsetHeight;
            ghost.style.animation = "ghost-bob 0.4s ease-in-out 5";
        }
        
        setTimeout(() => {
            container.classList.remove("speeding");
            if (ghost) {
                ghost.style.animation = "ghost-bob 3s ease-in-out infinite";
            }
        }, 3000);
    }

    animatePenny() {
        // When clicking Penny, she speeds up and zooms around too!
        const container = document.getElementById("pennyGhostContainer");
        if (!container) return;
        
        container.classList.add("speeding");
        
        const ghost = document.getElementById("ghostPenny");
        if (ghost) {
            ghost.style.animation = "none";
            void ghost.offsetHeight;
            ghost.style.animation = "penny-bob 0.4s ease-in-out 5";
        }
        
        setTimeout(() => {
            container.classList.remove("speeding");
            if (ghost) {
                ghost.style.animation = "penny-bob 3.5s ease-in-out infinite";
            }
        }, 3000);
    }

    onTabShown() {
        // Refresh employees
        this.loadEmployees();
    }
}

// ---- Boot ----
document.addEventListener("DOMContentLoaded", () => {
    new SpectreApp();
});
