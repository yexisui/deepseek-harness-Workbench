window.__ModuleLoader__.load({
	id: "@linxin666/dsh-client-ui-plain-chat",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/core/start.ts
		const PRESET_ID = "workbench-chat";
		/** A draft owns one id across uncertain retries; simultaneous sends share one attempt. */
		var ChatStart = class {
			port;
			cwd;
			mint;
			pending;
			id;
			epoch = 0;
			constructor(port, cwd, mint) {
				this.port = port;
				this.cwd = cwd;
				this.mint = mint;
			}
			reset() {
				this.epoch++;
				this.id = void 0;
				this.pending = void 0;
			}
			send(text) {
				if (this.pending) return this.pending;
				if (!text.trim()) return Promise.resolve();
				const epoch = this.epoch;
				const id = this.id ??= this.mint();
				const run = async () => {
					const result = await this.port.create({
						sessionId: id,
						cwd: this.cwd,
						agentPreset: PRESET_ID
					});
					if (!result.ok) throw new Error(result.error?.message ?? "Session creation failed");
					if (epoch !== this.epoch) return;
					await this.port.adopt({
						sessionId: id,
						cwd: this.cwd
					});
					if (epoch !== this.epoch) return;
					this.port.deliver(id, text);
					this.id = void 0;
				};
				const attempt = run().finally(() => {
					if (this.pending === attempt) this.pending = void 0;
				});
				this.pending = attempt;
				return attempt;
			}
		};
		//#endregion
		//#region src/client/slot-adapter.ts
		/** Version-scoped compatibility seam: retain the resident entry's inject, children and stores.
		* The SDK supports shadowing but cannot delegate a declared child tree. A reversible
		* component decorator avoids redeclaring that tree or patching installed SDK files.
		*/
		function decorateSlot(registry, key, expected, wrap) {
			const changes = /* @__PURE__ */ new Map();
			const sync = () => {
				for (const entry of registry.entries(key)) {
					if (changes.has(entry) || typeof entry.component !== "function" || entry.component.name !== expected) continue;
					const original = entry.component;
					const decorated = wrap(original);
					changes.set(entry, {
						original,
						decorated
					});
					entry.component = decorated;
				}
			};
			const unsubscribe = registry.subscribe(key, sync);
			sync();
			return () => {
				unsubscribe();
				for (const [entry, { original, decorated }] of changes) if (entry.component === decorated) entry.component = original;
				changes.clear();
			};
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-client-ui-plain-chat/src/client/Chat.module.css.mjs
		const css = ".yzXCLW_card{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#d5dbe7);background:var(--dsw-alias-bg-layer-2,#fff);width:100%;color:var(--dsw-alias-label-primary,#202938);border-radius:20px;padding:18px;box-shadow:0 3px 14px #182c5010}.yzXCLW_input{resize:vertical;box-sizing:border-box;width:100%;min-height:108px;max-height:300px;color:inherit;font:inherit;background:0 0;border:0;outline:none;line-height:1.6;display:block}.yzXCLW_input::placeholder{color:var(--dsw-alias-label-secondary,#78869f)}.yzXCLW_input:focus-visible{outline-offset:5px;border-radius:4px;outline:2px solid #8b9dd5}.yzXCLW_row{justify-content:space-between;align-items:center;gap:12px;margin-top:10px;display:flex}.yzXCLW_hint{opacity:.72;font-size:12px;line-height:1.6}.yzXCLW_send{background:var(--dsw-alias-button-primary-fill,#405eae);min-width:44px;min-height:44px;color:var(--dsw-alias-label-primary-foreground,#fff);cursor:pointer;border:0;border-radius:999px;flex-shrink:0;padding:10px 16px}.yzXCLW_send:hover{background:var(--dsw-alias-button-primary-hover,#334c91)}.yzXCLW_send:disabled{opacity:.45;cursor:default}.yzXCLW_error{color:#b53232;margin-top:10px;font-size:13px}.yzXCLW_badge{opacity:.8;font-size:14px}@media (width<=600px){.yzXCLW_card{padding:14px}.yzXCLW_row{align-items:flex-end}.yzXCLW_hint{font-size:11px}}";
		const tagId = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/Chat.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var Chat_module_css_default = {
			"badge": "yzXCLW_badge",
			"card": "yzXCLW_card",
			"error": "yzXCLW_error",
			"hint": "yzXCLW_hint",
			"input": "yzXCLW_input",
			"row": "yzXCLW_row",
			"send": "yzXCLW_send"
		};
		//#endregion
		//#region src/client/DraftComposer.tsx
		function DraftComposer({ start, t, available }) {
			const [draft, setDraft] = (0, react.useState)(() => {
				try {
					return sessionStorage.getItem("workbench-chat-draft") ?? "";
				} catch {
					return "";
				}
			});
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(false);
			const alive = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				alive.current = true;
				return () => {
					alive.current = false;
					start.reset();
				};
			}, [start]);
			const update = (value) => {
				setDraft(value);
				try {
					sessionStorage.setItem("workbench-chat-draft", value);
				} catch {}
			};
			const send = async () => {
				if (busy || !available || !draft.trim()) return;
				setBusy(true);
				setError(false);
				try {
					await start.send(draft);
					if (alive.current) update("");
				} catch {
					if (alive.current) setError(true);
				} finally {
					if (alive.current) setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: Chat_module_css_default.card,
				"data-dsh-plugin": "plain-chat",
				"data-dsh-part": "composer",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
						className: Chat_module_css_default.input,
						value: draft,
						onChange: (event) => update(event.target.value),
						placeholder: t("placeholder"),
						"aria-label": t("placeholder"),
						readOnly: busy,
						onKeyDown: (event) => {
							if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
								event.preventDefault();
								send();
							}
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: Chat_module_css_default.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: Chat_module_css_default.hint,
							children: [
								t("hint"),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("br", {}),
								t("model")
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: Chat_module_css_default.send,
							disabled: busy || !available || !draft.trim(),
							onClick: () => void send(),
							"aria-label": t("send"),
							children: busy ? t("sending") : "↑"
						})]
					}),
					(!available || error) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						role: "alert",
						className: Chat_module_css_default.error,
						children: t(available ? "failed" : "unavailable")
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const zh = {
			placeholder: "输入消息，开始对话",
			send: "发送消息",
			sending: "正在准备会话…",
			mode: "普通聊天",
			workspace: "选择工作区（可选）",
			history: "聊天",
			hint: "直接提问或写作；处理项目文件时再选择工作区。",
			model: "使用设置中的默认模型，进入会话后可切换。",
			failed: "无法开始对话，内容已保留。请检查模型与连接后重试。",
			unavailable: "普通聊天未加载，请重启 DSH 后刷新页面。"
		};
		const en = {
			placeholder: "Type a message to start chatting",
			send: "Send message",
			sending: "Preparing conversation…",
			mode: "Chat",
			workspace: "Choose workspace (optional)",
			history: "Chats",
			hint: "Ask questions or write. Choose a workspace for project files.",
			model: "Uses your default model; you can change it in the conversation.",
			failed: "Unable to start. Your draft is saved. Check your model and connection, then retry.",
			unavailable: "Chat is not loaded. Restart DSH and refresh the page."
		};
		//#endregion
		//#region ../dsh-i18n/src/client/ru/plain-chat.ts
		const ru = {
			placeholder: "Введите сообщение, чтобы начать разговор",
			send: "Отправить сообщение",
			sending: "Подготовка разговора…",
			mode: "Чат",
			workspace: "Выбрать рабочую область (необязательно)",
			history: "Чаты",
			hint: "Задавайте вопросы или пишите. Для работы с файлами выберите рабочую область.",
			model: "Используется модель по умолчанию; её можно изменить в разговоре.",
			failed: "Не удалось начать разговор. Черновик сохранён. Проверьте модель и подключение и повторите попытку.",
			unavailable: "Чат не загружен. Перезапустите DSH и обновите страницу."
		};
		//#endregion
		//#region src/client/apply.tsx
		const inject = [
			"slots",
			"locale",
			"sessions",
			"conversation",
			"layout",
			"remote",
			"remote.session"
		];
		const NS = "workbench-chat";
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "plain-chat: locale");
			ctx.effect(() => {
				try {
					return ctx.locale.register(NS, "ru", ru);
				} catch {
					return () => {};
				}
			}, "plain-chat: central Russian dictionary");
			const t = ctx.locale.bind(NS);
			const chatRoot = document.querySelector("meta[name=\"dsh-plain-chat-root\"]")?.content ?? "";
			const sessions = ctx.sessions;
			const layout = ctx.get("layout");
			const created = /* @__PURE__ */ new Set();
			let revision = 0;
			const listeners = /* @__PURE__ */ new Set();
			const subscribe = (fn) => {
				listeners.add(fn);
				return () => {
					listeners.delete(fn);
				};
			};
			const snapshot = () => revision;
			const clearSavedDraft = () => {
				try {
					sessionStorage.removeItem("workbench-chat-draft");
				} catch {}
			};
			const start = new ChatStart({
				create: (request) => ctx.remote.session.create(request),
				adopt: (request) => sessions.create(request),
				deliver: (id, text) => {
					const binding = sessions.binding(id);
					if (!binding) throw new Error("Plain chat session is unavailable");
					const input = ctx.conversation.input.for(binding.ctx);
					input.setDraft(text);
					created.add(id);
					clearSavedDraft();
					sessions.open(binding.sessionId);
					layout.selectPanel(null);
					input.submit();
				}
			}, chatRoot, () => `session-${crypto.randomUUID()}`);
			const registry = ctx.slots;
			ctx.effect(() => decorateSlot(registry, "main.conversation", "ConversationRoot", (Original) => {
				return function ChatConversation(props) {
					const draftKey = (0, react.useSyncExternalStore)(subscribe, snapshot);
					const summary = props.useSessions((s) => props.sessionId ? s.byId[props.sessionId] : void 0);
					const composerBlock = props.useComposerBlock((block) => block);
					const plain = summary?.projectionValues?.agentPreset === "workbench-chat" || created.has(props.sessionId);
					const noSession = props.sessionId === void 0;
					const translate = (key, ...args) => key === "hero.chooseWorkspace" && (plain || noSession) ? t("workspace") : props.t(key, ...args);
					const renderSlot = (key, owner, ...rest) => {
						if (key === "conversation.hero.agentPreset" && (plain || noSession)) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: Chat_module_css_default.badge,
							children: t("mode")
						});
						if (key === "conversation.composer.bar") {
							if (noSession) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DraftComposer, {
								start,
								t,
								available: chatRoot !== ""
							}, draftKey);
							if (plain && owner.onRequestWorkspace) return props.renderSlot(key, {
								...owner,
								disabled: false,
								blocked: composerBlock,
								placeholder: composerBlock?.reason ?? t("placeholder"),
								onRequestWorkspace: void 0
							}, ...rest);
							if (plain) return props.renderSlot(key, {
								...owner,
								placeholder: owner.blocked?.reason ?? t("placeholder")
							}, ...rest);
						}
						return props.renderSlot(key, owner, ...rest);
					};
					const selectWorkspace = async (id) => {
						start.reset();
						await props.selectWorkspace(id);
						if (!noSession) return;
						const current = sessions.list.getSnapshot().current;
						const binding = current ? sessions.binding(current) : void 0;
						let draft = "";
						try {
							draft = sessionStorage.getItem("workbench-chat-draft") ?? "";
						} catch {}
						if (binding && draft) {
							const input = ctx.conversation.input.for(binding.ctx);
							if (!input.state.getSnapshot().draft) {
								input.setDraft(draft);
								clearSavedDraft();
							}
						}
					};
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Original, {
						...props,
						t: translate,
						renderSlot,
						selectWorkspace
					});
				};
			}), "plain-chat: conversation adapter");
			ctx.effect(() => decorateSlot(registry, "sidebar", "SidebarRoot", (Original) => function ChatSidebar(props) {
				const startSession = (workspaceId) => {
					if (workspaceId !== void 0) return props.startSession(workspaceId);
					start.reset();
					clearSavedDraft();
					revision++;
					listeners.forEach((fn) => fn());
					sessions.clear();
					layout.selectPanel(null);
				};
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Original, {
					...props,
					startSession
				});
			}), "plain-chat: new conversation");
			ctx.effect(() => decorateSlot(registry, "sidebar.workspaces", "WorkspaceBrowser", (Original) => function ChatHistory(props) {
				const translate = (key, ...args) => key === "group.ungrouped" ? t("history") : props.t(key, ...args);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Original, {
					...props,
					t: translate
				});
			}), "plain-chat: history label");
			ctx.effect(() => () => {
				start.reset();
				listeners.clear();
			}, "plain-chat: cleanup");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map