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
		let react_dom = require("react-dom");
		//#region src/core/start.ts
		const PRESET_ID = "workbench-chat";
		/** A draft owns one id across uncertain retries; simultaneous sends share one attempt. */
		var ChatStart = class {
			port;
			cwd;
			mint;
			preset;
			pending;
			id;
			epoch = 0;
			chosenPreset;
			constructor(port, cwd, mint, preset = () => PRESET_ID) {
				this.port = port;
				this.cwd = cwd;
				this.mint = mint;
				this.preset = preset;
			}
			reset() {
				this.epoch++;
				this.id = void 0;
				this.pending = void 0;
				this.chosenPreset = void 0;
			}
			send(text) {
				if (this.pending) return this.pending;
				if (!text.trim()) return Promise.resolve();
				const epoch = this.epoch;
				const id = this.id ??= this.mint();
				const run = async () => {
					const agentPreset = this.chosenPreset ??= this.preset();
					const result = await this.port.create({
						sessionId: id,
						cwd: this.cwd,
						agentPreset
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
					this.chosenPreset = void 0;
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
		const css$11 = ".yzXCLW_card{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#d5dbe7);background:var(--dsw-alias-bg-layer-2,#fff);width:100%;color:var(--dsw-alias-label-primary,#202938);border-radius:20px;padding:18px;box-shadow:0 3px 14px #182c5010}.yzXCLW_input{resize:vertical;box-sizing:border-box;width:100%;min-height:108px;max-height:300px;color:inherit;font:inherit;background:0 0;border:0;outline:none;line-height:1.6;display:block}.yzXCLW_input::placeholder{color:var(--dsw-alias-label-secondary,#78869f)}.yzXCLW_input:focus-visible{outline-offset:5px;border-radius:4px;outline:2px solid #8b9dd5}.yzXCLW_row{justify-content:space-between;align-items:center;gap:12px;margin-top:10px;display:flex}.yzXCLW_hint{opacity:.72;font-size:12px;line-height:1.6}.yzXCLW_send{background:var(--dsw-alias-button-primary-fill,#405eae);min-width:44px;min-height:44px;color:var(--dsw-alias-label-primary-foreground,#fff);cursor:pointer;border:0;border-radius:999px;flex-shrink:0;padding:10px 16px}.yzXCLW_send:hover{background:var(--dsw-alias-button-primary-hover,#334c91)}.yzXCLW_send:disabled{opacity:.45;cursor:default}.yzXCLW_error{color:#b53232;margin-top:10px;font-size:13px}.yzXCLW_badge{opacity:.8;font-size:14px}.yzXCLW_previewNotice{border-bottom:1px solid var(--dsw-alias-border-l2,#d5dbe7);color:var(--dsw-alias-label-secondary,#78869f);flex-wrap:wrap;align-items:center;gap:8px 16px;margin-bottom:14px;padding:0 0 14px;font-size:12px;line-height:1.7;display:flex}.yzXCLW_previewNotice button{color:var(--dsw-alias-button-primary-fill,#405eae);cursor:pointer;font:inherit;background:0 0;border:0;padding:3px 0}@media (width<=600px){.yzXCLW_card{padding:14px}.yzXCLW_row{align-items:flex-end}.yzXCLW_hint{font-size:11px}}.yzXCLW_conversationShell{flex-direction:column;min-width:0;height:100%;min-height:0;display:flex}.yzXCLW_assistantToolbar{flex:none;align-items:center;min-width:0;padding:20px 28px 8px;display:flex}.yzXCLW_conversationContent{flex:1;min-width:0;min-height:0}@media (width<=600px){.yzXCLW_assistantToolbar{padding:12px 16px 6px}}";
		const tagId$11 = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/Chat.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$11) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId$11;
			tag.textContent = css$11;
			document.head.appendChild(tag);
		}
		var Chat_module_css_default = {
			"assistantToolbar": "yzXCLW_assistantToolbar",
			"badge": "yzXCLW_badge",
			"card": "yzXCLW_card",
			"conversationContent": "yzXCLW_conversationContent",
			"conversationShell": "yzXCLW_conversationShell",
			"error": "yzXCLW_error",
			"hint": "yzXCLW_hint",
			"input": "yzXCLW_input",
			"previewNotice": "yzXCLW_previewNotice",
			"row": "yzXCLW_row",
			"send": "yzXCLW_send"
		};
		//#endregion
		//#region src/client/DraftComposer.tsx
		function DraftComposer({ start, t, available, previewOnly = false, onReturnChat, initialDraft, onDraftChange }) {
			const [draft, setDraft] = (0, react.useState)(() => {
				if (initialDraft !== void 0) return initialDraft;
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
				onDraftChange?.(value);
			};
			const send = async () => {
				if (busy || previewOnly || !available || !draft.trim()) return;
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
					previewOnly && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: Chat_module_css_default.previewNotice,
						role: "status",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("rolesChatOnly") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: onReturnChat,
							children: t("rolesReturnChat")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
						className: Chat_module_css_default.input,
						value: draft,
						onChange: (event) => update(event.target.value),
						placeholder: t(previewOnly ? "rolesComposer" : "placeholder"),
						"aria-label": t(previewOnly ? "rolesComposer" : "placeholder"),
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
							disabled: busy || previewOnly || !available || !draft.trim(),
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
		//#region \0dsh-css:packages/dsh-client-ui-plain-chat/src/client/AppearanceNavigation.module.css.mjs
		const css$10 = ".W_oMjq_group{width:100%;min-width:0}.W_oMjq_heading{box-sizing:border-box;cursor:pointer;align-items:center;gap:10px;width:100%;list-style:none;display:flex}.W_oMjq_heading::-webkit-details-marker{display:none}.W_oMjq_heading>svg{flex-shrink:0}.W_oMjq_heading:focus-visible{outline:2px solid var(--dsw-alias-button-primary-fill,#4263ba);outline-offset:-2px;border-radius:8px}.W_oMjq_chevron{opacity:.65;margin-left:auto}.W_oMjq_group[open]>.W_oMjq_heading .W_oMjq_chevron{transform:rotate(90deg)}.W_oMjq_children{border-left:1px solid var(--dsw-alias-border-l2,#dfe4ed);flex-direction:column;gap:4px;margin:4px 0 6px 17px;padding-left:10px;display:flex}.W_oMjq_children>button{box-sizing:border-box;width:100%;font-size:13px}";
		const tagId$10 = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/AppearanceNavigation.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$10) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId$10;
			tag.textContent = css$10;
			document.head.appendChild(tag);
		}
		var AppearanceNavigation_module_css_default = {
			"chevron": "W_oMjq_chevron",
			"children": "W_oMjq_children",
			"group": "W_oMjq_group",
			"heading": "W_oMjq_heading"
		};
		//#endregion
		//#region src/client/AppearanceNavigation.tsx
		const appearanceIds = /* @__PURE__ */ new Set([
			"skin-center",
			"pet",
			"dsh-workshop"
		]);
		function AppearanceGroup({ items, label }) {
			const ref = (0, react.useRef)(null);
			const active = items.find((item) => item.props["aria-current"] === "true")?.key;
			(0, react.useEffect)(() => {
				if (active && ref.current) ref.current.open = true;
			}, [active]);
			const baseClass = (items.find((item) => !item.props["aria-current"]) ?? items[0])?.props.className ?? "";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				ref,
				className: AppearanceNavigation_module_css_default.group,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
					className: `${baseClass} ${AppearanceNavigation_module_css_default.heading}`,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
							width: "16",
							height: "16",
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "1.7",
							"aria-hidden": "true",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12 3a9 9 0 1 0 0 18h1.4a2 2 0 0 0 1.4-3.4 1.5 1.5 0 0 1 1.1-2.6H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
									cx: "7.5",
									cy: "11",
									r: ".8"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
									cx: "10",
									cy: "7.5",
									r: ".8"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
									cx: "15",
									cy: "7.5",
									r: ".8"
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
							className: AppearanceNavigation_module_css_default.chevron,
							width: "14",
							height: "14",
							viewBox: "0 0 16 16",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "1.5",
							"aria-hidden": "true",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m6 3 5 5-5 5" })
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: AppearanceNavigation_module_css_default.children,
					children: items
				})]
			});
		}
		/** Only transform navigation elements. Keep original buttons, callbacks and page slots. */
		function groupNavigation(node, label) {
			if (!(0, react.isValidElement)(node)) return node;
			const children = react.Children.toArray(node.props.children);
			const items = children.filter((child) => (0, react.isValidElement)(child) && child.type === "button" && appearanceIds.has(String(child.key).replace(/^\.\$/, "")));
			if (items.length) {
				let inserted = false;
				return (0, react.cloneElement)(node, {}, children.flatMap((child) => {
					if (!items.includes(child)) return [child];
					if (inserted) return [];
					inserted = true;
					return [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AppearanceGroup, {
						items,
						label
					}, "workbench-appearance")];
				}));
			}
			return node.props.children === void 0 ? node : (0, react.cloneElement)(node, {}, children.map((child) => groupNavigation(child, label)));
		}
		/** SDK rc.2 compatibility seam: decorate the private panel's rendered navigation only. */
		function withAppearanceNavigation(Original, label, navigation) {
			const panels = /* @__PURE__ */ new Map();
			const transform = (node) => {
				if (!(0, react.isValidElement)(node)) return node;
				if (typeof node.type === "function" && node.type.name === "SettingsPanel") {
					const Panel = node.type;
					if (!panels.has(Panel)) panels.set(Panel, function AppearanceSettingsPanel(props) {
						return groupNavigation(Panel(props), label());
					});
					return react.default.createElement(panels.get(Panel), {
						...node.props,
						key: node.key
					});
				}
				return node.props.children === void 0 ? node : (0, react.cloneElement)(node, {}, react.Children.map(node.props.children, transform));
			};
			const subscribe = navigation?.subscribe ?? (() => () => {});
			const snapshot = navigation?.getSnapshot ?? (() => 0);
			return function AppearanceSettingsRoot(props) {
				const request = (0, react.useSyncExternalStore)(subscribe, snapshot);
				const handled = (0, react.useRef)(0);
				const tree = Original(props);
				let panel;
				let trigger;
				const find = (node) => {
					if (!(0, react.isValidElement)(node)) return;
					if (typeof node.type === "function" && node.type.name === "SettingsPanel") panel = node;
					if (node.type === "button" && node.props["aria-haspopup"] === "dialog") trigger = node;
					react.Children.forEach(node.props.children, find);
				};
				find(tree);
				(0, react.useEffect)(() => {
					if (request === 0 || request === handled.current) return;
					if (panel) {
						panel.props.onSelect(navigation?.getSection() ?? "agent-presets");
						handled.current = request;
					} else trigger?.props.onClick();
				}, [
					request,
					panel,
					trigger
				]);
				return transform(tree);
			};
		}
		//#endregion
		//#region src/client/capability-catalog.ts
		const catalog = [
			{
				id: "browser",
				name: "capBrowser",
				description: "capBrowserDesc",
				category: "web",
				provider: "BrowserSkill",
				color: "#5275df"
			},
			{
				id: "documents",
				name: "capDocuments",
				description: "capDocumentsDesc",
				category: "office",
				provider: "Documents",
				color: "#9870d4"
			},
			{
				id: "sheets",
				name: "capSheets",
				description: "capSheetsDesc",
				category: "office",
				provider: "Spreadsheets",
				color: "#299c80"
			},
			{
				id: "knowledge",
				name: "capKnowledge",
				description: "capKnowledgeDesc",
				category: "data",
				provider: "Knowledge",
				color: "#cc9439"
			},
			{
				id: "files",
				name: "capFiles",
				description: "capFilesDesc",
				category: "data",
				provider: "Files",
				color: "#c27955"
			},
			{
				id: "mail",
				name: "capMail",
				description: "capMailDesc",
				category: "office",
				provider: "Mail",
				color: "#ca698b"
			}
		];
		const defaults = () => ({
			enabled: true,
			browser: "Edge",
			access: "specific",
			sites: "",
			read: true,
			fill: true,
			submit: false,
			confirm: true,
			location: ""
		});
		//#endregion
		//#region src/client/capability-preview.tsx
		/** UI demonstration state only: no storage, host API, plugin or permission mutation. */
		function createCapabilityPreview() {
			let drafts = Object.fromEntries(catalog.map((item) => [item.id, {
				pinned: item.id === "browser",
				instructions: null,
				options: defaults()
			}]));
			const listeners = /* @__PURE__ */ new Set();
			return {
				getSnapshot: () => drafts,
				subscribe: (fn) => {
					listeners.add(fn);
					return () => {
						listeners.delete(fn);
					};
				},
				update: (id, patch) => {
					drafts = {
						...drafts,
						[id]: {
							...drafts[id],
							...patch
						}
					};
					listeners.forEach((fn) => fn());
				}
			};
		}
		(0, react.createContext)(null);
		//#endregion
		//#region src/client/capability-settings.tsx
		function registerCapabilityCenter(slots, label, component) {
			slots.inject("settings.section", () => slots.register({
				name: "settings.section",
				id: "capability-center",
				order: 21,
				label,
				locale: "workbench-chat"
			}, component));
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-client-ui-plain-chat/src/client/Roles.module.css.mjs
		const css$9 = ".fwzdhW_section,.fwzdhW_dialog,.fwzdhW_picker,.fwzdhW_presetDisclosure{--role-bg:var(--dsw-alias-bg-layer-2,#fff);--role-text:var(--dsw-alias-label-primary,#202938);--role-muted:var(--dsw-alias-label-secondary,#758095);--role-border:var(--dsw-alias-border-l2,#e0e5ec);--role-accent:var(--dsw-alias-button-primary-fill,#4263ba);color:var(--role-text);font:inherit}.fwzdhW_section{box-sizing:border-box;width:100%;padding:4px 0 0}.fwzdhW_sectionHeader{justify-content:space-between;align-items:center;gap:20px;margin-bottom:22px;display:flex}.fwzdhW_titleRow{align-items:center;gap:12px;display:flex}.fwzdhW_section h2,.fwzdhW_dialog h2{letter-spacing:-.4px;margin:0;font-size:20px;font-weight:650}.fwzdhW_sectionHeader p{color:var(--role-muted);margin:8px 0 0;font-size:13px;line-height:1.7}.fwzdhW_previewBadge,.fwzdhW_exampleBadge{border:1px solid var(--role-border);color:var(--role-muted);white-space:nowrap;border-radius:6px;flex-shrink:0;align-items:center;padding:3px 8px;font-size:11px;font-weight:500;line-height:1.4;display:inline-flex}.fwzdhW_exampleBadge{background:color-mix(in srgb,var(--role-accent) 8%,var(--role-bg));color:var(--role-accent);border-color:#0000}.fwzdhW_primary,.fwzdhW_secondary{border:1px solid var(--role-border);font:inherit;cursor:pointer;white-space:nowrap;border-radius:9px;padding:10px 16px;font-size:13px;font-weight:550}.fwzdhW_primary{background:var(--role-accent);color:var(--dsw-alias-label-primary-foreground,#fff);border-color:#0000}.fwzdhW_secondary{background:var(--role-bg);color:var(--role-text)}.fwzdhW_primary:hover:not(:disabled){filter:brightness(1.08)}.fwzdhW_primary:disabled{opacity:.42;cursor:not-allowed}.fwzdhW_cards{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;display:grid}.fwzdhW_selectionStatus{min-height:30px;color:var(--role-muted);justify-content:space-between;align-items:center;gap:12px;margin:-4px 0 18px;font-size:12px;line-height:1.7;display:flex}.fwzdhW_roleCard{transition:box-shadow .18s,border-color .18s;position:relative}.fwzdhW_cardSelect{z-index:1;cursor:pointer;background:0 0;border:0;border-radius:12px 12px 0 0;padding:0;position:absolute;inset:0 0 51px}.fwzdhW_cardSelect:hover{background:color-mix(in srgb,var(--role-color) 5%,transparent)}.fwzdhW_roleCard .fwzdhW_cardAction{z-index:2;position:relative}.fwzdhW_cardBody{border-radius:10px 10px 0 0;flex:1;margin:-22px -22px 0;padding:22px 22px 0;position:relative}.fwzdhW_cardBody .fwzdhW_cardSelect{border-radius:10px 10px 0 0;inset:0}.fwzdhW_cardSelect:disabled{cursor:default}.fwzdhW_cardSelect:disabled:hover{background:0 0}.fwzdhW_roleCard .fwzdhW_cardSummary{-webkit-line-clamp:3;overflow-wrap:anywhere;-webkit-box-orient:vertical;min-height:5.4em;display:-webkit-box;overflow:hidden}.fwzdhW_cardControls{z-index:2;border-top:1px solid color-mix(in srgb,var(--role-color) 25%,var(--role-border));align-items:center;gap:18px;display:flex;position:relative}.fwzdhW_cardControls .fwzdhW_cardAction{border-top:0;flex:1;width:auto;min-width:0}.fwzdhW_cardControls .fwzdhW_textButton{min-height:44px;color:var(--role-muted)}.fwzdhW_roleCard .fwzdhW_chatCardNote{padding:14px 0;font-size:12px}.fwzdhW_selectedCard{box-shadow:0 0 0 2px var(--role-color),0 7px 20px color-mix(in srgb,var(--role-color) 20%,transparent);animation:.3s ease-out fwzdhW_roleSelect}.fwzdhW_roleCard .fwzdhW_exampleBadge.fwzdhW_selectedBadge{background:var(--role-color);color:var(--role-on-color,white)}@keyframes fwzdhW_roleSelect{0%,to{transform:translate(0)}30%{transform:translate(-3px)}60%{transform:translate(3px)}}@media (prefers-reduced-motion:reduce){.fwzdhW_selectedCard{animation:none}}.fwzdhW_currentAssistant{--role-bg:var(--dsw-alias-bg-layer-2,#fff);--role-text:var(--dsw-alias-label-primary,#202938);--role-muted:var(--dsw-alias-label-secondary,#758095);--role-accent:var(--dsw-alias-button-primary-fill,#4263ba);box-sizing:border-box;border:1px solid color-mix(in srgb,var(--role-color) 22%,transparent);background:color-mix(in srgb,var(--role-bg) 88%,transparent);backdrop-filter:blur(12px);max-width:100%;min-height:38px;color:var(--role-text);text-align:left;font:inherit;cursor:pointer;border-radius:22px;align-items:center;gap:8px;padding:6px 12px 6px 7px;transition:background .16s,border-color .16s,box-shadow .16s;display:inline-flex;box-shadow:0 2px 8px #182c5008}.fwzdhW_currentAssistant:hover{background:color-mix(in srgb,var(--role-color) 8%,var(--role-bg));border-color:color-mix(in srgb,var(--role-color) 45%,transparent);box-shadow:0 3px 12px #182c5010}.fwzdhW_currentAssistant:focus-visible{outline:2px solid var(--role-accent);outline-offset:3px}.fwzdhW_currentAssistant .fwzdhW_icon{border-radius:50%;width:24px;height:24px}.fwzdhW_currentAssistant .fwzdhW_icon svg{width:15px;height:15px}.fwzdhW_currentText{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:13px;font-weight:550;line-height:20px;overflow:hidden}.fwzdhW_currentHint{color:var(--role-muted);border-left:1px solid color-mix(in srgb,var(--role-muted) 20%,transparent);flex-shrink:0;padding:0 6px;font-size:10px;line-height:16px}.fwzdhW_currentArrow{width:14px;height:14px;color:var(--role-muted);flex-shrink:0}@media (width<=400px){.fwzdhW_currentHint{display:none}}.fwzdhW_roleCard{border:1px solid var(--role-border);background:var(--role-bg);border-radius:14px;flex-direction:column;min-width:0;padding:22px 22px 0;display:flex}.fwzdhW_cardTop{justify-content:space-between;align-items:center;gap:12px;display:flex}.fwzdhW_icon{width:42px;height:42px;color:var(--role-accent);background:color-mix(in srgb,var(--role-accent) 8%,var(--role-bg));border-radius:11px;flex-shrink:0;justify-content:center;align-items:center;display:inline-flex}.fwzdhW_icon svg{width:23px;height:23px}.fwzdhW_icon img{object-fit:contain;width:100%;height:100%;padding:4px;display:block}.fwzdhW_currentAssistant .fwzdhW_icon img{padding:2px}.fwzdhW_icon{color:color-mix(in srgb,var(--role-color,var(--role-accent)) 65%,var(--role-text));background:color-mix(in srgb,var(--role-color,var(--role-accent)) 20%,var(--role-bg))}.fwzdhW_roleCard,.fwzdhW_livePreview{border-color:color-mix(in srgb,var(--role-color) 40%,var(--role-border));border-top:4px solid var(--role-color);background:linear-gradient(135deg,color-mix(in srgb,var(--role-color) 18%,var(--role-bg)),color-mix(in srgb,var(--role-color) 6%,var(--role-bg)))}.fwzdhW_roleCard .fwzdhW_exampleBadge,.fwzdhW_roleCard .fwzdhW_tags span{background:color-mix(in srgb,var(--role-color) 15%,var(--role-bg));color:color-mix(in srgb,var(--role-color) 45%,var(--role-text))}.fwzdhW_roleCard .fwzdhW_cardAction{color:color-mix(in srgb,var(--role-color) 55%,var(--role-text));border-top-color:color-mix(in srgb,var(--role-color) 25%,var(--role-border))}.fwzdhW_roleCard h3{margin:18px 0 8px;font-size:16px;font-weight:650}.fwzdhW_roleCard p{color:var(--role-muted);margin:0;font-size:13px;line-height:1.8}.fwzdhW_tags{flex-wrap:wrap;gap:7px;margin:18px 0 22px;display:flex}.fwzdhW_tags span{background:color-mix(in srgb,var(--role-muted) 8%,var(--role-bg));color:var(--role-muted);border-radius:5px;padding:4px 8px;font-size:11px}.fwzdhW_cardAction{border:0;border-top:1px solid var(--role-border);width:100%;color:var(--role-accent);font:inherit;cursor:pointer;background:0 0;justify-content:space-between;align-items:center;margin-top:auto;padding:14px 0;font-size:13px;display:flex}.fwzdhW_createCard{border:1px dashed var(--role-border);width:100%;color:var(--role-muted);font:inherit;cursor:pointer;background:0 0;border-radius:14px;justify-content:flex-start;align-items:center;gap:13px;margin-top:16px;padding:16px 20px;display:flex}.fwzdhW_createCard:hover{border-color:var(--role-accent);background:color-mix(in srgb,var(--role-accent) 3%,var(--role-bg))}.fwzdhW_createCard strong{color:var(--role-text);font-size:14px;font-weight:550}.fwzdhW_createCard>span:last-child{text-align:left;font-size:12px;line-height:1.8}.fwzdhW_plus{border:1px solid var(--role-border);border-radius:50%;place-items:center;width:38px;height:38px;font-size:24px;font-weight:300;display:grid}.fwzdhW_createCard .fwzdhW_plus{flex-shrink:0;width:30px;height:30px}.fwzdhW_createCard strong{flex-shrink:0}@media (width<=680px){.fwzdhW_createCard{flex-wrap:wrap}.fwzdhW_createCard>span:last-child{width:100%}}.fwzdhW_sectionNote{color:var(--role-muted);margin:14px 0 0;font-size:12px;line-height:1.8}.fwzdhW_presetDisclosure{border:1px solid var(--role-border);background:var(--role-bg);border-radius:10px;margin-top:24px}.fwzdhW_presetDisclosure>summary{cursor:pointer;justify-content:space-between;align-items:center;gap:16px;padding:14px 16px;font-size:14px;font-weight:550;list-style:none;display:flex}.fwzdhW_presetDisclosure>summary::-webkit-details-marker{display:none}.fwzdhW_presetDisclosure>summary:hover{background:color-mix(in srgb,var(--role-muted) 5%,transparent);border-radius:10px}.fwzdhW_presetDisclosure>summary:focus-visible{outline:2px solid var(--role-accent);outline-offset:3px;border-radius:10px}.fwzdhW_disclosureChevron{width:16px;height:16px;color:var(--role-muted);flex-shrink:0}.fwzdhW_presetDisclosure[open]>summary .fwzdhW_disclosureChevron{transform:rotate(90deg)}.fwzdhW_disclosureContent{border-top:1px solid var(--role-border);padding:18px 16px}.fwzdhW_dialog{background:var(--role-bg);border:1px solid var(--role-border);border-radius:18px;width:560px;max-width:calc(100vw - 32px);max-height:calc(100dvh - 40px);padding:0;overflow:auto;box-shadow:0 24px 90px #10223d30}.fwzdhW_dialog::backdrop{backdrop-filter:blur(3px);background:#0e18224d}.fwzdhW_dialog[open]{flex-direction:column;display:flex}.fwzdhW_wide{width:1240px;height:min(850px,100dvh - 40px);overflow:hidden}.fwzdhW_editorDetails{border:1px solid var(--role-border);border-radius:8px;padding:0 12px}.fwzdhW_editorDetails>summary{cursor:pointer;color:var(--role-muted);padding:10px 0;font-size:12px}.fwzdhW_editorDetails>fieldset,.fwzdhW_editorDetails>div{padding:8px 0 14px}.fwzdhW_colorSample{border-radius:50%;width:11px;height:11px;margin-left:10px;display:inline-block}.fwzdhW_dialogHeader{border-bottom:1px solid var(--role-border);flex-shrink:0;justify-content:space-between;align-items:center;gap:20px;padding:22px 26px;display:flex}.fwzdhW_dialogHeader h2{font-size:18px}.fwzdhW_close{color:var(--role-muted);cursor:pointer;background:0 0;border:0;border-radius:6px;width:32px;height:32px;font-size:25px;line-height:1}.fwzdhW_close:hover{background:color-mix(in srgb,var(--role-muted) 10%,var(--role-bg))}.fwzdhW_editorScroll{min-height:0;padding:20px 26px 24px;overflow:auto}.fwzdhW_intro{color:var(--role-muted);margin:0 0 16px;font-size:13px;line-height:1.8}.fwzdhW_notice{background:color-mix(in srgb,var(--role-accent) 4%,var(--role-bg));border:1px solid var(--role-border);color:var(--role-muted);border-radius:8px;align-items:center;gap:10px;margin-bottom:24px;padding:11px 13px;font-size:12px;line-height:1.7;display:flex}.fwzdhW_editorGrid{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);align-items:start;gap:28px;display:grid}.fwzdhW_fields{flex-direction:column;gap:18px;display:flex}.fwzdhW_field{flex-direction:column;gap:8px;font-size:13px;font-weight:550;display:flex}.fwzdhW_field input,.fwzdhW_field textarea{box-sizing:border-box;border:1px solid var(--role-border);width:100%;color:var(--role-text);background:var(--role-bg);font:inherit;border-radius:8px;padding:10px 12px;font-weight:400;line-height:1.7}.fwzdhW_field textarea{resize:vertical;min-height:85px}.fwzdhW_field input::placeholder,.fwzdhW_field textarea::placeholder{color:var(--role-muted);opacity:.75}.fwzdhW_field input:focus,.fwzdhW_field textarea:focus{outline:2px solid color-mix(in srgb,var(--role-accent) 22%,transparent);border-color:var(--role-accent)}.fwzdhW_colorField{border:0;min-width:0;margin:0;padding:0}.fwzdhW_colorField legend{margin-bottom:10px;padding:0;font-size:13px;font-weight:550}.fwzdhW_palette{flex-wrap:wrap;gap:10px;display:flex}.fwzdhW_swatch{cursor:pointer;color:#fff;text-shadow:0 1px 2px #0007;border:2px solid #0000;border-radius:50%;place-items:center;width:28px;height:28px;padding:0;font-size:16px;display:grid}.fwzdhW_swatch[aria-pressed=true]{outline:2px solid var(--role-text);outline-offset:3px}.fwzdhW_customColor{flex-wrap:wrap;align-items:center;gap:10px;margin-top:14px;font-size:12px;display:flex}.fwzdhW_customColor label,.fwzdhW_customColor input{cursor:pointer}.fwzdhW_customColor input{box-sizing:border-box;border:1px solid var(--role-border);background:var(--role-bg);border-radius:6px;width:34px;height:30px;padding:2px}.fwzdhW_customColor input:focus-visible{outline:2px solid var(--role-accent);outline-offset:3px}.fwzdhW_customColor code{color:var(--role-muted);font-size:12px}.fwzdhW_livePreview{overflow-wrap:anywhere;border-radius:12px;padding:20px}.fwzdhW_previewHeading{justify-content:space-between;align-items:center;font-size:12px;font-weight:600;display:flex}.fwzdhW_dot{background:var(--role-color,var(--role-accent));border-radius:50%;width:6px;height:6px}.fwzdhW_caption{color:var(--role-muted);margin:6px 0 0;font-size:12px;line-height:1.7}.fwzdhW_previewIdentity{align-items:center;gap:12px;margin:24px 0;display:flex}.fwzdhW_previewIdentity h3{margin:0;font-size:16px;font-weight:650}.fwzdhW_previewSection{margin-top:20px}.fwzdhW_previewSection h4{letter-spacing:.5px;color:var(--role-muted);margin:0 0 8px;font-size:11px;font-weight:500}.fwzdhW_previewSection p{white-space:pre-wrap;margin:0;font-size:12px;line-height:1.9}.fwzdhW_empty{color:var(--role-muted);opacity:.65}.fwzdhW_sessionHint{border-top:1px solid var(--role-border);color:var(--role-muted);margin:24px 0 0;padding-top:15px;font-size:11px;line-height:1.7}.fwzdhW_footer{border-top:1px solid var(--role-border);flex-shrink:0;justify-content:space-between;align-items:center;gap:16px;padding:16px 26px;display:flex}.fwzdhW_footer p{color:var(--role-muted);margin:0;font-size:11px;line-height:1.7}.fwzdhW_actions{gap:10px;display:flex}.fwzdhW_picker{border:1px solid var(--role-border);background:var(--role-bg);cursor:pointer;border-radius:10px;align-items:center;gap:9px;padding:6px 10px 6px 6px;font-size:13px;display:inline-flex}.fwzdhW_picker .fwzdhW_icon{border-radius:6px;width:27px;height:27px}.fwzdhW_picker .fwzdhW_icon svg{width:17px;height:17px}.fwzdhW_choices{padding:22px 26px 26px;overflow:auto}.fwzdhW_choice{border:1px solid var(--role-border);text-align:left;background:var(--role-bg);width:100%;color:var(--role-text);font:inherit;cursor:pointer;border-radius:12px;align-items:center;gap:14px;margin-bottom:12px;padding:17px;display:flex}.fwzdhW_choice:hover,.fwzdhW_chosen{border-color:var(--role-accent);background:color-mix(in srgb,var(--role-accent) 4%,var(--role-bg))}.fwzdhW_choiceText{flex-direction:column;flex:1;gap:8px;min-width:0;display:flex}.fwzdhW_choiceText strong{flex-wrap:wrap;align-items:center;gap:8px;font-size:14px;font-weight:600;display:flex}.fwzdhW_choiceText>span{color:var(--role-muted);font-size:12px;line-height:1.7}.fwzdhW_radio{border:1px solid var(--role-border);border-radius:50%;flex-shrink:0;place-items:center;width:19px;height:19px;font-size:12px;display:grid}.fwzdhW_chosen .fwzdhW_radio{color:#fff;border-color:var(--role-accent);background:var(--role-accent)}.fwzdhW_choiceTools{border-bottom:1px solid var(--role-border);justify-content:space-between;gap:16px;padding:2px 0 14px;display:flex}.fwzdhW_textButton,.fwzdhW_back{color:var(--role-accent);font:inherit;cursor:pointer;background:0 0;border:0;padding:6px 0;font-size:12px}.fwzdhW_back{align-self:flex-start;margin:14px 26px 0}.fwzdhW_section button:focus-visible,.fwzdhW_dialog button:focus-visible,.fwzdhW_picker:focus-visible{outline:2px solid var(--role-accent);outline-offset:3px}@media (width<=680px){.fwzdhW_cards,.fwzdhW_editorGrid{grid-template-columns:1fr}.fwzdhW_sectionHeader{flex-direction:column;align-items:flex-start;gap:14px}.fwzdhW_createCard{padding:22px}.fwzdhW_dialogHeader,.fwzdhW_editorScroll,.fwzdhW_choices{padding:16px}.fwzdhW_footer{flex-direction:column;align-items:flex-end;gap:10px;padding:14px 16px}.fwzdhW_notice{align-items:flex-start}.fwzdhW_dialog{max-height:calc(100dvh - 24px)}.fwzdhW_livePreview{padding:16px}}";
		const tagId$9 = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/Roles.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$9) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId$9;
			tag.textContent = css$9;
			document.head.appendChild(tag);
		}
		var Roles_module_css_default = {
			"actions": "fwzdhW_actions",
			"back": "fwzdhW_back",
			"caption": "fwzdhW_caption",
			"cardAction": "fwzdhW_cardAction",
			"cardBody": "fwzdhW_cardBody",
			"cardControls": "fwzdhW_cardControls",
			"cardSelect": "fwzdhW_cardSelect",
			"cardSummary": "fwzdhW_cardSummary",
			"cardTop": "fwzdhW_cardTop",
			"cards": "fwzdhW_cards",
			"chatCardNote": "fwzdhW_chatCardNote",
			"choice": "fwzdhW_choice",
			"choiceText": "fwzdhW_choiceText",
			"choiceTools": "fwzdhW_choiceTools",
			"choices": "fwzdhW_choices",
			"chosen": "fwzdhW_chosen",
			"close": "fwzdhW_close",
			"colorField": "fwzdhW_colorField",
			"colorSample": "fwzdhW_colorSample",
			"createCard": "fwzdhW_createCard",
			"currentArrow": "fwzdhW_currentArrow",
			"currentAssistant": "fwzdhW_currentAssistant",
			"currentHint": "fwzdhW_currentHint",
			"currentText": "fwzdhW_currentText",
			"customColor": "fwzdhW_customColor",
			"dialog": "fwzdhW_dialog",
			"dialogHeader": "fwzdhW_dialogHeader",
			"disclosureChevron": "fwzdhW_disclosureChevron",
			"disclosureContent": "fwzdhW_disclosureContent",
			"dot": "fwzdhW_dot",
			"editorDetails": "fwzdhW_editorDetails",
			"editorGrid": "fwzdhW_editorGrid",
			"editorScroll": "fwzdhW_editorScroll",
			"empty": "fwzdhW_empty",
			"exampleBadge": "fwzdhW_exampleBadge",
			"field": "fwzdhW_field",
			"fields": "fwzdhW_fields",
			"footer": "fwzdhW_footer",
			"icon": "fwzdhW_icon",
			"intro": "fwzdhW_intro",
			"livePreview": "fwzdhW_livePreview",
			"notice": "fwzdhW_notice",
			"palette": "fwzdhW_palette",
			"picker": "fwzdhW_picker",
			"plus": "fwzdhW_plus",
			"presetDisclosure": "fwzdhW_presetDisclosure",
			"previewBadge": "fwzdhW_previewBadge",
			"previewHeading": "fwzdhW_previewHeading",
			"previewIdentity": "fwzdhW_previewIdentity",
			"previewSection": "fwzdhW_previewSection",
			"primary": "fwzdhW_primary",
			"radio": "fwzdhW_radio",
			"roleCard": "fwzdhW_roleCard",
			"roleSelect": "fwzdhW_roleSelect",
			"secondary": "fwzdhW_secondary",
			"section": "fwzdhW_section",
			"sectionHeader": "fwzdhW_sectionHeader",
			"sectionNote": "fwzdhW_sectionNote",
			"selectedBadge": "fwzdhW_selectedBadge",
			"selectedCard": "fwzdhW_selectedCard",
			"selectionStatus": "fwzdhW_selectionStatus",
			"sessionHint": "fwzdhW_sessionHint",
			"swatch": "fwzdhW_swatch",
			"tags": "fwzdhW_tags",
			"textButton": "fwzdhW_textButton",
			"titleRow": "fwzdhW_titleRow",
			"wide": "fwzdhW_wide"
		};
		//#endregion
		//#region src/client/PreviewModal.tsx
		function Modal$1({ title, onClose, children, wide = false, closeLabel, className = "" }) {
			const ref = (0, react.useRef)(null);
			const titleId = (0, react.useId)();
			(0, react.useEffect)(() => {
				const previous = document.activeElement;
				const dialog = ref.current;
				dialog.showModal();
				return () => {
					dialog.close();
					if (previous?.isConnected) previous.focus();
				};
			}, []);
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dialog", {
				ref,
				className: `${Roles_module_css_default.dialog} ${wide ? Roles_module_css_default.wide : ""} ${className}`,
				"aria-labelledby": titleId,
				onKeyDown: (event) => {
					if (event.key !== "Escape") return;
					event.stopPropagation();
					if (!event.defaultPrevented) {
						event.preventDefault();
						onClose();
					}
				},
				onCancel: (event) => {
					event.preventDefault();
					event.stopPropagation();
					onClose();
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: Roles_module_css_default.dialogHeader,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						id: titleId,
						children: title
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						autoFocus: true,
						className: Roles_module_css_default.close,
						onClick: onClose,
						"aria-label": closeLabel,
						children: "×"
					})]
				}), children]
			}), document.body);
		}
		//#endregion
		//#region src/client/role-catalog.ts
		const roleIds = [
			"analyst",
			"marketing",
			"manager",
			"developer"
		];
		const roleCatalog = {
			analyst: {
				color: "#4F73E8",
				name: "rolesAnalyst",
				summary: "rolesSummary",
				tags: [
					"rolesTagOne",
					"rolesTagTwo",
					"rolesTagThree"
				],
				duties: "rolesDutiesValue",
				requirements: "rolesRequirementsValue",
				format: "rolesFormatValue"
			},
			marketing: {
				color: "#E58A32",
				name: "rolesMarketing",
				summary: "rolesMarketingSummary",
				tags: [
					"rolesMarketingTagOne",
					"rolesMarketingTagTwo",
					"rolesMarketingTagThree"
				],
				duties: "rolesMarketingDuties",
				requirements: "rolesMarketingRequirements",
				format: "rolesMarketingFormat"
			},
			manager: {
				color: "#9A62D8",
				name: "rolesManager",
				summary: "rolesManagerSummary",
				tags: [
					"rolesManagerTagOne",
					"rolesManagerTagTwo",
					"rolesManagerTagThree"
				],
				duties: "rolesManagerDuties",
				requirements: "rolesManagerRequirements",
				format: "rolesManagerFormat"
			},
			developer: {
				color: "#22A58B",
				name: "rolesDeveloper",
				summary: "rolesDeveloperSummary",
				tags: [
					"rolesDeveloperTagOne",
					"rolesDeveloperTagTwo",
					"rolesDeveloperTagThree"
				],
				duties: "rolesDeveloperDuties",
				requirements: "rolesDeveloperRequirements",
				format: "rolesDeveloperFormat"
			}
		};
		//#endregion
		//#region \0dsh-css:packages/dsh-client-ui-plain-chat/src/client/Capabilities.module.css.mjs
		const css$8 = ".ChWdyq_banner{border-bottom:1px solid var(--role-border);color:var(--role-muted);background:color-mix(in srgb,var(--role-accent) 4%,var(--role-bg));flex-shrink:0;align-items:center;gap:8px;padding:11px 24px;font-size:12px;line-height:1.6;display:flex}.ChWdyq_bannerDot{background:#c09542;border-radius:50%;flex-shrink:0;width:6px;height:6px}.ChWdyq_workbench{grid-template-columns:var(--library-width) var(--left-rail) minmax(380px,1fr) var(--right-rail) var(--inspector-width);flex:1;grid-template-rows:minmax(0,1fr);min-height:0;font-size:13px;line-height:1.6;transition:grid-template-columns .22s;display:grid;position:relative;overflow:hidden}.ChWdyq_resizing{user-select:none;cursor:col-resize;transition:none}.ChWdyq_workbench *{box-sizing:border-box}.ChWdyq_workbench,.ChWdyq_library,.ChWdyq_canvas,.ChWdyq_inspector{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--role-muted) 30%,transparent) transparent}.ChWdyq_workbench button,.ChWdyq_workbench input,.ChWdyq_workbench select,.ChWdyq_workbench textarea{font:inherit}.ChWdyq_workbench button{cursor:pointer}.ChWdyq_library{background:color-mix(in srgb,var(--role-muted) 4%,var(--role-bg));flex-direction:column;grid-area:1/1;min-width:0;padding:20px 12px 12px;display:flex;overflow:hidden}.ChWdyq_canvas,.ChWdyq_inspector{overscroll-behavior:contain;overflow:auto}.ChWdyq_library[hidden],.ChWdyq_inspector[hidden]{display:none}.ChWdyq_columnHeading{justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px;display:flex}.ChWdyq_columnHeading h3{margin:0;font-size:14px;font-weight:650}.ChWdyq_columnHeading p{color:var(--role-muted);margin:5px 0 0;font-size:11px}.ChWdyq_collapseButton{border:1px solid var(--role-border);background:var(--role-bg);width:26px;height:26px;color:var(--role-muted);border-radius:7px;flex-shrink:0;place-items:center;padding:0;line-height:1;display:grid;font-size:22px!important}.ChWdyq_collapseButton:hover{color:var(--role-accent);border-color:var(--role-accent)}.ChWdyq_rail{z-index:2;border-inline:1px solid var(--role-border);background:color-mix(in srgb,var(--role-muted) 3%,var(--role-bg));color:var(--role-muted);cursor:col-resize;touch-action:none;user-select:none;grid-row:1;justify-content:center;align-items:center;min-width:0;display:flex;position:relative;outline-offset:-2px!important}.ChWdyq_leftRail{grid-column:2}.ChWdyq_rightRail{grid-column:4}.ChWdyq_rail:hover,.ChWdyq_rail:focus-visible,.ChWdyq_collapseReady{background:color-mix(in srgb,var(--role-accent) 10%,var(--role-bg));color:var(--role-accent)}.ChWdyq_collapseReady{box-shadow:inset 0 0 0 1px var(--role-accent)}.ChWdyq_railHandle{pointer-events:none;flex-direction:column;justify-content:center;align-items:center;gap:9px;width:100%;min-width:0;height:58px;display:flex}.ChWdyq_railHandle svg{width:18px;height:18px;display:none}.ChWdyq_railArrow{font-size:20px;line-height:14px}.ChWdyq_railGrip{opacity:.55;border-inline:1px solid;width:3px;height:16px}.ChWdyq_railCollapsed{cursor:ew-resize}.ChWdyq_railCollapsed .ChWdyq_railHandle{border-block:1px solid var(--role-border);background:var(--role-bg);border-radius:9px;height:92px;transition:background .15s,box-shadow .15s;box-shadow:0 2px 7px #172b4d08}.ChWdyq_railCollapsed .ChWdyq_railHandle svg{display:block}.ChWdyq_railCollapsed:hover .ChWdyq_railHandle{box-shadow:0 2px 10px color-mix(in srgb,var(--role-accent) 18%,transparent)}.ChWdyq_search{border:1px solid var(--role-border);background:var(--role-bg);border-radius:8px;align-items:center;gap:8px;padding:9px 11px;display:flex}.ChWdyq_search svg{width:17px;height:17px;color:var(--role-muted);flex-shrink:0}.ChWdyq_search input{width:100%;min-width:0;color:var(--role-text);background:0 0;border:0;outline:0;font-size:12px}.ChWdyq_search:focus-within{outline:2px solid color-mix(in srgb,var(--role-accent) 25%,transparent);border-color:var(--role-accent)}.ChWdyq_filters{flex-wrap:wrap;flex-shrink:0;gap:3px;margin:12px 0;display:flex}.ChWdyq_filters button{color:var(--role-muted);background:0 0;border:1px solid #0000;border-radius:6px;padding:5px 7px;font-size:11px}.ChWdyq_filters button[aria-pressed=true]{color:var(--role-text);background:var(--role-bg);border-color:var(--role-border);box-shadow:0 1px 3px #00000006}.ChWdyq_library .ChWdyq_columnHeading,.ChWdyq_library .ChWdyq_search{flex-shrink:0}.ChWdyq_library .ChWdyq_columnHeading{margin-bottom:14px}.ChWdyq_manageLink{color:var(--role-accent);text-align:left;cursor:pointer;background:0 0;border:0;margin-top:4px;margin-bottom:6px;padding:4px 0;font-size:11px!important}.ChWdyq_catalog{overscroll-behavior:contain;scrollbar-width:thin;flex-direction:column;flex:1;gap:8px;min-height:0;padding:2px;display:flex;overflow:auto}.ChWdyq_catalogCard{border:1px solid var(--role-border);background:var(--role-bg);border-radius:9px;flex-shrink:0;align-items:center;gap:2px;width:100%;min-width:0;min-height:68px;padding:9px 5px 9px 8px;transition:box-shadow .15s,border-color .15s;display:flex}.ChWdyq_catalogCard[draggable=true]{cursor:grab;user-select:none;touch-action:pan-y}.ChWdyq_grip{touch-action:none}.ChWdyq_dragGhost{pointer-events:none;z-index:10;border:1px solid var(--role-accent);background:var(--role-bg);color:var(--role-accent);border-radius:8px;padding:10px 16px;font-size:12px;position:fixed;box-shadow:0 5px 18px #172a4433}.ChWdyq_catalogCard[draggable=true]:active{cursor:grabbing}.ChWdyq_catalogCard:hover{border-color:color-mix(in srgb,var(--role-accent) 50%,var(--role-border))}.ChWdyq_catalogSelected{border-color:color-mix(in srgb,var(--role-accent) 65%,var(--role-border));background:color-mix(in srgb,var(--role-accent) 3%,var(--role-bg))}.ChWdyq_catalogInspect{text-align:left;min-width:0;color:var(--role-text);background:0 0;border:0;flex:1;align-items:center;gap:7px;padding:0;display:flex;cursor:grab!important}.ChWdyq_catalogInspect>span:nth-child(2){flex-direction:column;flex:1;min-width:0;display:flex}.ChWdyq_catalogInspect strong,.ChWdyq_catalogInspect small{white-space:nowrap;text-overflow:ellipsis;display:block;overflow:hidden}.ChWdyq_catalogInspect strong{font-size:12px;font-weight:600}.ChWdyq_catalogInspect small{color:var(--role-muted);margin-top:2px;font-size:10px}.ChWdyq_quickAdd{width:26px;height:30px;color:var(--role-accent);background:0 0;border:0;border-radius:6px;flex-shrink:0;padding:0;font-size:17px!important}.ChWdyq_quickAdd:hover:not(:disabled){background:color-mix(in srgb,var(--role-accent) 9%,transparent)}.ChWdyq_quickAdd:disabled{cursor:default;color:#39947c;font-size:13px!important}.ChWdyq_grip{width:9px;color:var(--role-muted);opacity:.55;flex-shrink:0;font-size:16px}.ChWdyq_icon{width:32px;height:32px;color:color-mix(in srgb,var(--cap-color) 75%,var(--role-text));background:color-mix(in srgb,var(--cap-color) 11%,var(--role-bg));border-radius:8px;flex-shrink:0;place-items:center;display:inline-grid}.ChWdyq_icon svg{width:20px;height:20px}.ChWdyq_libraryNote{color:var(--role-muted);flex-shrink:0;margin:10px 0 0;padding-inline:2px;font-size:10px}.ChWdyq_emptySearch{text-align:center;color:var(--role-muted);padding:24px 0;font-size:12px}.ChWdyq_emptySearch button{color:var(--role-accent);background:0 0;border:0}.ChWdyq_canvas{grid-area:1/3;min-width:0;padding:24px 26px}.ChWdyq_step{color:var(--role-muted);opacity:.65;font-variant-numeric:tabular-nums;font-size:12px}.ChWdyq_attachedHeading{margin-top:28px}.ChWdyq_count{background:color-mix(in srgb,var(--role-accent) 8%,var(--role-bg));color:var(--role-accent);border-radius:6px;place-items:center;width:20px;height:20px;margin-left:5px;font-size:11px;display:inline-grid}.ChWdyq_dropZone{border:1px dashed var(--role-border);border-radius:12px;padding:10px;transition:background .15s,border-color .15s}.ChWdyq_dragReady{border-color:var(--role-accent)}.ChWdyq_dragOver{background:color-mix(in srgb,var(--role-accent) 9%,var(--role-bg));outline:3px solid color-mix(in srgb,var(--role-accent) 12%,transparent);border-style:solid}.ChWdyq_dropHint{text-align:center;color:var(--role-muted);flex-direction:column;align-items:center;gap:8px;padding:30px 10px;display:flex}.ChWdyq_dropHint>span{border:1px solid var(--role-border);background:var(--role-bg);border-radius:10px;place-items:center;width:36px;height:36px;font-size:23px;display:grid}.ChWdyq_dropHint strong{font-size:12px;font-weight:500}.ChWdyq_dropHint p{margin:0;font-size:11px}.ChWdyq_dropCompact{flex-direction:row;justify-content:center;padding:10px}.ChWdyq_dropCompact>span{background:0 0;border:0;width:auto;height:auto;font-size:20px}.ChWdyq_attachedCard{border:1px solid var(--role-border);background:var(--role-bg);border-radius:9px;align-items:center;margin-bottom:8px;transition:opacity .15s;display:flex}.ChWdyq_attachedSelected{border-color:var(--role-accent);box-shadow:0 0 0 1px color-mix(in srgb,var(--role-accent) 10%,transparent);background:color-mix(in srgb,var(--role-accent) 3%,var(--role-bg))}.ChWdyq_attachedSelect{text-align:left;min-width:0;color:var(--role-text);background:0 0;border:0;flex:1;align-items:center;gap:10px;padding:12px;display:flex}.ChWdyq_attachedSelect>span:last-child{flex-direction:column;min-width:0;display:flex}.ChWdyq_attachedSelect strong{font-size:12px;font-weight:550}.ChWdyq_attachedSelect small{color:var(--role-muted);flex-wrap:wrap;align-items:center;gap:5px;font-size:10px;display:flex}.ChWdyq_enabledDot,.ChWdyq_disabledDot{background:#36a18b;border-radius:50%;width:5px;height:5px;display:inline-block}.ChWdyq_disabledDot{background:var(--role-muted)}.ChWdyq_disabledCard{opacity:.65}.ChWdyq_remove{width:27px;height:27px;color:var(--role-muted);background:0 0;border:0;border-radius:6px;flex-shrink:0;margin-right:9px;font-size:20px!important}.ChWdyq_remove:hover{background:color-mix(in srgb,var(--role-muted) 10%,var(--role-bg));color:var(--role-text)}.ChWdyq_inspector{background:color-mix(in srgb,var(--role-muted) 2%,var(--role-bg));grid-area:1/5;min-width:0;padding:0 20px 24px}.ChWdyq_inspectorHeader{align-items:center;gap:10px;display:flex}.ChWdyq_inspectorHeader .ChWdyq_inspectorTabs{flex:1;gap:14px;min-width:0}.ChWdyq_inspectorHeader .ChWdyq_collapseButton{margin-top:9px}.ChWdyq_inspectorTabs{border-bottom:1px solid var(--role-border);gap:20px;padding-top:9px;display:flex}.ChWdyq_inspectorTabs button{color:var(--role-muted);background:0 0;border:0;border-bottom:2px solid #0000;padding:15px 0 12px;font-size:12px}.ChWdyq_inspectorTabs button[aria-pressed=true]{color:var(--role-accent);border-bottom-color:var(--role-accent);font-weight:600}.ChWdyq_assistantName{color:var(--role-muted);overflow-wrap:anywhere;margin:18px 0;font-size:11px}.ChWdyq_detailIdentity{align-items:center;gap:10px;display:flex}.ChWdyq_detailIdentity .ChWdyq_icon{width:40px;height:40px}.ChWdyq_detailIdentity h3{margin:0;font-size:15px;font-weight:600}.ChWdyq_detailIdentity span:not(.ChWdyq_icon){color:var(--role-muted);font-size:11px}.ChWdyq_detailDescription{color:var(--role-muted);margin:14px 0;font-size:12px;line-height:1.7}.ChWdyq_connection{background:color-mix(in srgb,#b99449 8%,var(--role-bg));color:var(--role-muted);border-radius:7px;align-items:center;gap:7px;margin-top:12px;margin-bottom:20px;padding:9px 10px;font-size:11px;display:flex}.ChWdyq_statusDot{background:#bc974c;border-radius:50%;width:5px;height:5px}.ChWdyq_switchRow{cursor:pointer;justify-content:space-between;align-items:center;gap:12px;padding:0 0 18px;display:flex;position:relative}.ChWdyq_switchRow>span:first-child{flex:1;min-width:0}.ChWdyq_switchRow strong{font-size:12px;font-weight:500}.ChWdyq_switchRow small{color:var(--role-muted);margin-top:4px;font-size:10px;line-height:1.7;display:block}.ChWdyq_switchRow input{opacity:0;width:32px;height:20px;margin:0;position:absolute;right:0}.ChWdyq_switchTrack{background:color-mix(in srgb,var(--role-muted) 32%,var(--role-bg));pointer-events:none;border-radius:20px;flex-shrink:0;width:32px;height:18px;padding:3px}.ChWdyq_switchTrack:after{content:\"\";background:#fff;border-radius:50%;width:12px;height:12px;transition:transform .15s;display:block;box-shadow:0 1px 3px #0002}.ChWdyq_switchRow input:checked+.ChWdyq_switchTrack{background:var(--role-accent)}.ChWdyq_switchRow input:checked+.ChWdyq_switchTrack:after{transform:translate(14px)}.ChWdyq_switchRow input:focus-visible+.ChWdyq_switchTrack{outline:2px solid var(--role-accent);outline-offset:3px}.ChWdyq_settingsFields{border:0;border-top:1px solid var(--role-border);min-width:0;margin:0;padding:18px 0 0}.ChWdyq_settingsFields:disabled{opacity:.48}.ChWdyq_field{flex-direction:column;gap:8px;margin-bottom:18px;font-size:12px;display:flex}.ChWdyq_field input,.ChWdyq_field select,.ChWdyq_field textarea{border:1px solid var(--role-border);background:var(--role-bg);color:var(--role-text);border-radius:7px;width:100%;min-width:0;padding:9px 10px;font-size:12px}.ChWdyq_field textarea{resize:vertical;line-height:1.7}.ChWdyq_field input::placeholder,.ChWdyq_field textarea::placeholder,.ChWdyq_search input::placeholder{color:var(--role-muted);opacity:.8}.ChWdyq_field input:focus,.ChWdyq_field select:focus,.ChWdyq_field textarea:focus{outline:2px solid color-mix(in srgb,var(--role-accent) 25%,transparent);border-color:var(--role-accent)}.ChWdyq_actionsGroup{border:0;margin:0 0 22px;padding:0}.ChWdyq_actionsGroup legend{margin-bottom:10px;font-size:12px}.ChWdyq_actionsGroup label{cursor:pointer;align-items:center;gap:8px;margin:8px 0;font-size:12px;display:flex}.ChWdyq_actionsGroup input{accent-color:var(--role-accent);width:14px;height:14px;margin:0}.ChWdyq_notAdded{padding-bottom:18px}.ChWdyq_notAdded p{color:var(--role-muted);font-size:11px}.ChWdyq_notAdded button{color:var(--dsw-alias-label-primary-foreground,#fff);background:var(--role-accent);border:0;border-radius:7px;width:100%;padding:8px 12px;font-size:12px}.ChWdyq_output{flex-direction:column;gap:9px;margin:18px 0;font-size:12px;display:flex}.ChWdyq_output strong{color:var(--role-muted);border:1px solid var(--role-border);border-radius:7px;padding:10px;font-weight:400}.ChWdyq_inspectorEmpty{color:var(--role-muted);text-align:center;padding:65px 0}.ChWdyq_inspectorEmpty>span{font-size:32px}.ChWdyq_inspectorEmpty h3{font-size:13px;font-weight:500}.ChWdyq_inspectorEmpty p{font-size:12px;line-height:1.8}.ChWdyq_overview{overflow-wrap:anywhere}.ChWdyq_overview h4{margin:20px 0 10px;font-size:12px}.ChWdyq_summaryCaps{flex-wrap:wrap;gap:7px;display:flex}.ChWdyq_summaryCaps span{border:1px solid var(--role-border);color:var(--role-muted);border-radius:6px;padding:4px 7px;font-size:10px}.ChWdyq_muted{color:var(--role-muted);font-size:12px}.ChWdyq_srOnly{clip:rect(0,0,0,0);white-space:nowrap;border:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}.ChWdyq_catalogGroup{color:var(--role-muted);margin:15px 0 7px;font-size:11px;font-weight:500}.ChWdyq_catalogCard,.ChWdyq_sortHandle{user-select:none}.ChWdyq_sortHandle{color:var(--role-muted);cursor:grab;touch-action:none;background:0 0;border:0;flex-shrink:0;padding:9px 3px;font-size:19px}.ChWdyq_sortHandle:active{cursor:grabbing}.ChWdyq_sortHandle:focus-visible{outline:2px solid var(--role-accent);border-radius:5px}.ChWdyq_sortSource{opacity:.5}.ChWdyq_sortTarget{box-shadow:0 -3px 0 var(--role-accent)}.ChWdyq_compact{grid-template-columns:30px minmax(0,1fr) 30px;transition:none}.ChWdyq_compact .ChWdyq_canvas{grid-column:2;padding:20px 16px}.ChWdyq_compact .ChWdyq_library,.ChWdyq_compact .ChWdyq_inspector{z-index:4;grid-column:auto;position:absolute;top:0;bottom:0;box-shadow:0 0 22px #14244124}.ChWdyq_compact .ChWdyq_library{width:var(--library-width);padding:18px 10px 10px;left:0}.ChWdyq_compact .ChWdyq_inspector{width:var(--inspector-width);padding:0 14px 20px;right:0}.ChWdyq_compact .ChWdyq_rail{z-index:5;grid-column:auto;position:absolute;top:0;bottom:0}.ChWdyq_compact .ChWdyq_leftRail{left:var(--library-width);width:var(--left-rail)}.ChWdyq_compact .ChWdyq_rightRail{right:var(--inspector-width);width:var(--right-rail)}@media (width<=1100px){.ChWdyq_canvas{padding:22px 18px}.ChWdyq_library{padding:20px 10px 10px}.ChWdyq_inspector{padding-left:16px;padding-right:16px}}@media (width<=620px){.ChWdyq_banner{padding:10px 16px;font-size:11px}}@media (prefers-reduced-motion:reduce){.ChWdyq_workbench,.ChWdyq_workbench *,.ChWdyq_switchTrack:after{transition:none}}";
		const tagId$8 = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/Capabilities.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$8) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId$8;
			tag.textContent = css$8;
			document.head.appendChild(tag);
		}
		var Capabilities_module_css_default = {
			"actionsGroup": "ChWdyq_actionsGroup",
			"assistantName": "ChWdyq_assistantName",
			"attachedCard": "ChWdyq_attachedCard",
			"attachedHeading": "ChWdyq_attachedHeading",
			"attachedSelect": "ChWdyq_attachedSelect",
			"attachedSelected": "ChWdyq_attachedSelected",
			"banner": "ChWdyq_banner",
			"bannerDot": "ChWdyq_bannerDot",
			"canvas": "ChWdyq_canvas",
			"catalog": "ChWdyq_catalog",
			"catalogCard": "ChWdyq_catalogCard",
			"catalogGroup": "ChWdyq_catalogGroup",
			"catalogInspect": "ChWdyq_catalogInspect",
			"catalogSelected": "ChWdyq_catalogSelected",
			"collapseButton": "ChWdyq_collapseButton",
			"collapseReady": "ChWdyq_collapseReady",
			"columnHeading": "ChWdyq_columnHeading",
			"compact": "ChWdyq_compact",
			"connection": "ChWdyq_connection",
			"count": "ChWdyq_count",
			"detailDescription": "ChWdyq_detailDescription",
			"detailIdentity": "ChWdyq_detailIdentity",
			"disabledCard": "ChWdyq_disabledCard",
			"disabledDot": "ChWdyq_disabledDot",
			"dragGhost": "ChWdyq_dragGhost",
			"dragOver": "ChWdyq_dragOver",
			"dragReady": "ChWdyq_dragReady",
			"dropCompact": "ChWdyq_dropCompact",
			"dropHint": "ChWdyq_dropHint",
			"dropZone": "ChWdyq_dropZone",
			"emptySearch": "ChWdyq_emptySearch",
			"enabledDot": "ChWdyq_enabledDot",
			"field": "ChWdyq_field",
			"filters": "ChWdyq_filters",
			"grip": "ChWdyq_grip",
			"icon": "ChWdyq_icon",
			"inspector": "ChWdyq_inspector",
			"inspectorEmpty": "ChWdyq_inspectorEmpty",
			"inspectorHeader": "ChWdyq_inspectorHeader",
			"inspectorTabs": "ChWdyq_inspectorTabs",
			"leftRail": "ChWdyq_leftRail",
			"library": "ChWdyq_library",
			"libraryNote": "ChWdyq_libraryNote",
			"manageLink": "ChWdyq_manageLink",
			"muted": "ChWdyq_muted",
			"notAdded": "ChWdyq_notAdded",
			"output": "ChWdyq_output",
			"overview": "ChWdyq_overview",
			"quickAdd": "ChWdyq_quickAdd",
			"rail": "ChWdyq_rail",
			"railArrow": "ChWdyq_railArrow",
			"railCollapsed": "ChWdyq_railCollapsed",
			"railGrip": "ChWdyq_railGrip",
			"railHandle": "ChWdyq_railHandle",
			"remove": "ChWdyq_remove",
			"resizing": "ChWdyq_resizing",
			"rightRail": "ChWdyq_rightRail",
			"search": "ChWdyq_search",
			"settingsFields": "ChWdyq_settingsFields",
			"sortHandle": "ChWdyq_sortHandle",
			"sortSource": "ChWdyq_sortSource",
			"sortTarget": "ChWdyq_sortTarget",
			"srOnly": "ChWdyq_srOnly",
			"statusDot": "ChWdyq_statusDot",
			"step": "ChWdyq_step",
			"summaryCaps": "ChWdyq_summaryCaps",
			"switchRow": "ChWdyq_switchRow",
			"switchTrack": "ChWdyq_switchTrack",
			"workbench": "ChWdyq_workbench"
		};
		//#endregion
		//#region \0dsh-css:packages/dsh-client-ui-plain-chat/src/client/CapabilityCenter.module.css.mjs
		const css$7 = ".T4-_kG_center{--role-bg:var(--dsw-alias-bg-layer-2,#fff);--role-text:var(--dsw-alias-label-primary,#202938);--role-muted:var(--dsw-alias-label-secondary,#758095);--role-border:var(--dsw-alias-border-l2,#e0e5ec);--role-accent:var(--dsw-alias-button-primary-fill,#4263ba);color:var(--role-text);box-sizing:border-box;width:100%;min-width:0;font-family:inherit;font-size:13px;line-height:1.6;container-type:inline-size}.T4-_kG_center *{box-sizing:border-box}.T4-_kG_center button,.T4-_kG_center input,.T4-_kG_center textarea,.T4-_kG_center select{font:inherit}.T4-_kG_center button{cursor:pointer}.T4-_kG_center button:focus-visible{outline:2px solid var(--role-accent);outline-offset:3px}.T4-_kG_heading{justify-content:space-between;align-items:center;gap:16px;margin:4px 0 20px;display:flex}.T4-_kG_heading h2{align-items:center;gap:10px;margin:0;font-size:22px;font-weight:650;display:flex}.T4-_kG_heading h2 span{border:1px solid var(--role-border);color:var(--role-muted);border-radius:5px;padding:2px 6px;font-size:10px;font-weight:400}.T4-_kG_heading p{color:var(--role-muted);margin:7px 0 0;font-size:12px}.T4-_kG_mark{background:color-mix(in srgb,var(--role-accent) 8%,var(--role-bg));width:46px;height:46px;color:var(--role-accent);border-radius:14px;place-items:center;font-size:32px;display:grid}.T4-_kG_notice{color:var(--role-muted);background:color-mix(in srgb,var(--role-accent) 5%,var(--role-bg));border-radius:8px;margin:0 0 20px;padding:11px 13px;font-size:11px}.T4-_kG_search{border:1px solid var(--role-border);border-radius:9px;align-items:center;gap:9px;padding:11px 13px;display:flex}.T4-_kG_search svg{width:17px;height:17px;color:var(--role-muted);flex-shrink:0}.T4-_kG_search input{color:var(--role-text);background:0 0;border:0;outline:0;width:100%;min-width:0;font-size:12px}.T4-_kG_search:focus-within{outline:2px solid color-mix(in srgb,var(--role-accent) 25%,transparent)}.T4-_kG_filters{flex-wrap:wrap;gap:6px;margin:15px 0 20px;display:flex}.T4-_kG_filters button{color:var(--role-muted);background:0 0;border:1px solid #0000;border-radius:7px;align-items:center;gap:6px;padding:6px 9px;font-size:12px;display:flex}.T4-_kG_filters button[aria-pressed=true]{background:color-mix(in srgb,var(--role-accent) 8%,var(--role-bg));color:var(--role-accent);border-color:color-mix(in srgb,var(--role-accent) 22%,var(--role-border))}.T4-_kG_filters span{opacity:.75;font-size:10px}.T4-_kG_grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;display:grid}.T4-_kG_card{border:1px solid var(--role-border);background:var(--role-bg);border-radius:12px;min-width:0;padding:18px;transition:border-color .15s,box-shadow .15s}.T4-_kG_card:hover{border-color:color-mix(in srgb,var(--role-accent) 40%,var(--role-border));box-shadow:0 4px 14px #13223a08}.T4-_kG_cardHeading,.T4-_kG_detailHeader{align-items:center;gap:10px;display:flex}.T4-_kG_cardHeading>div,.T4-_kG_detailHeader>div{flex:1;min-width:0}.T4-_kG_cardHeading h3{overflow-wrap:anywhere;margin:0;font-size:14px}.T4-_kG_cardHeading small{color:var(--role-muted);font-size:11px}.T4-_kG_pin{width:28px;height:28px;color:var(--role-muted);background:0 0;border:0;border-radius:6px;flex-shrink:0;padding:0;font-size:22px!important}.T4-_kG_pin[aria-pressed=true]{color:var(--role-accent)}.T4-_kG_pin:hover{background:color-mix(in srgb,var(--role-accent) 8%,transparent)}.T4-_kG_description{color:var(--role-muted);margin:15px 0;font-size:12px;line-height:1.7}.T4-_kG_cardStatus{color:var(--role-muted);flex-wrap:wrap;justify-content:space-between;gap:7px;margin-bottom:16px;font-size:10px;display:flex}.T4-_kG_cardStatus>span{align-items:center;gap:5px;display:flex}.T4-_kG_cardStatus button{color:var(--role-muted);background:0 0;border:0;padding:0;font-size:10px}.T4-_kG_cardStatus button:hover{color:var(--role-accent)}.T4-_kG_statusDot{background:#bd9650;border-radius:50%;flex-shrink:0;width:5px;height:5px;display:inline-block}.T4-_kG_configure{border:0;border-top:1px solid var(--role-border);width:100%;color:var(--role-accent);background:0 0;justify-content:space-between;align-items:center;padding:10px 0 0;display:flex;font-size:12px!important}.T4-_kG_back{color:var(--role-accent);background:0 0;border:0;margin:0 0 22px;padding:0;font-size:12px!important}.T4-_kG_detailHeader h3{margin:0;font-size:20px}.T4-_kG_detailHeader p{color:var(--role-muted);margin:2px 0 0;font-size:12px}.T4-_kG_tabs{border-bottom:1px solid var(--role-border);flex-wrap:wrap;gap:18px;margin-top:20px;display:flex}.T4-_kG_tabs button{color:var(--role-muted);background:0 0;border:0;border-bottom:2px solid #0000;padding:9px 0 11px;font-size:12px}.T4-_kG_tabs button[aria-pressed=true]{color:var(--role-accent);border-color:var(--role-accent);font-weight:600}.T4-_kG_detailBody{padding:22px 0 8px}.T4-_kG_connection{border:1px solid var(--role-border);border-radius:10px;flex-wrap:wrap;align-items:baseline;gap:10px;padding:18px;display:flex}.T4-_kG_connection>div{flex:1;min-width:160px}.T4-_kG_connection strong{font-size:13px}.T4-_kG_connection p{color:var(--role-muted);margin:6px 0 0;font-size:12px}.T4-_kG_connection button{border:1px solid var(--role-border);color:var(--role-muted);cursor:default;background:0 0;border-radius:7px;padding:7px 10px;font-size:11px}.T4-_kG_overviewActions{grid-template-columns:1fr 1fr;gap:12px;margin:16px 0 24px;display:grid}.T4-_kG_overviewActions button{border:1px solid var(--role-border);color:var(--role-text);background:0 0;border-radius:9px;justify-content:space-between;align-items:center;gap:8px;padding:14px;font-size:12px;display:flex}.T4-_kG_overviewActions span{color:var(--role-muted)}.T4-_kG_technical{color:var(--role-muted);border-top:1px solid var(--role-border);padding-top:15px;font-size:12px}.T4-_kG_technical summary{cursor:pointer}.T4-_kG_technical dl{grid-template-columns:100px 1fr;gap:10px;display:grid}.T4-_kG_technical dd{overflow-wrap:anywhere;color:var(--role-text);margin:0}.T4-_kG_hint{color:var(--role-muted);margin:0 0 20px;font-size:12px;line-height:1.8}.T4-_kG_draftNote{color:var(--role-muted);border-top:1px solid var(--role-border);padding:12px 0 0;font-size:11px}.T4-_kG_roleRow{border:1px solid var(--role-border);border-radius:9px;justify-content:space-between;align-items:center;gap:16px;margin-bottom:10px;padding:14px;display:flex}.T4-_kG_roleRow>div{min-width:0}.T4-_kG_roleRow strong{font-size:13px}.T4-_kG_roleRow small{color:var(--role-muted);margin-top:3px;font-size:11px;display:block}.T4-_kG_roleRow button,.T4-_kG_empty button{color:var(--role-accent);background:0 0;border:0;flex-shrink:0;padding:5px 0;font-size:11px}.T4-_kG_currentRole{background:color-mix(in srgb,var(--role-accent) 5%,var(--role-bg));margin-bottom:20px}.T4-_kG_empty{text-align:center;color:var(--role-muted);padding:40px 16px;font-size:12px}.T4-_kG_empty strong{font-size:14px;font-weight:500}dialog.T4-_kG_overlayDialog{width:760px;overflow:hidden}.T4-_kG_overlayBody{overscroll-behavior:contain;min-height:0;padding:24px 28px;overflow:auto}.T4-_kG_overlayBack{color:var(--dsw-alias-button-primary-fill,#4263ba);font:inherit;cursor:pointer;background:0 0;border:0;margin:0 0 18px;padding:0;font-size:12px}@container (width<=480px){.T4-_kG_grid{grid-template-columns:1fr}.T4-_kG_mark{display:none}.T4-_kG_roleRow{flex-direction:column;align-items:flex-start;gap:6px}.T4-_kG_tabs{gap:13px}}@media (width<=620px){.T4-_kG_overlayBody{padding:18px 16px}}@media (prefers-reduced-motion:reduce){.T4-_kG_card{transition:none}}";
		const tagId$7 = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/CapabilityCenter.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$7) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId$7;
			tag.textContent = css$7;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region src/client/useCapabilityPanels.ts
		const minimum = {
			left: 210,
			right: 250
		};
		const maximum = {
			left: 360,
			right: 420
		};
		const centerMinimum = 380;
		const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
		/** Layout state is local to the editor; panels stay mounted when hidden. */
		function useCapabilityPanels(inspectorInitiallyOpen) {
			const root = (0, react.useRef)(null);
			const [containerWidth, setContainerWidth] = (0, react.useState)(1240);
			const [opened, setOpened] = (0, react.useState)({
				left: true,
				right: inspectorInitiallyOpen
			});
			const [widths, setWidths] = (0, react.useState)({
				left: 260,
				right: 300
			});
			const [drawer, setDrawer] = (0, react.useState)(null);
			const [resizing, setResizing] = (0, react.useState)(null);
			const [willCollapse, setWillCollapse] = (0, react.useState)(false);
			const drag = (0, react.useRef)(null);
			const suppressClick = (0, react.useRef)(false);
			const compact = containerWidth < 900;
			const leftOpen = compact ? drawer === "left" : opened.left;
			const rightOpen = compact ? drawer === "right" : opened.right;
			(0, react.useEffect)(() => {
				const element = root.current;
				if (!element || typeof ResizeObserver === "undefined") return;
				const observer = new ResizeObserver(([entry]) => {
					if (entry) setContainerWidth(entry.contentRect.width);
				});
				observer.observe(element);
				return () => observer.disconnect();
			}, []);
			const available = containerWidth - centerMinimum - (leftOpen ? 14 : 30) - (rightOpen ? 14 : 30);
			const base = (leftOpen ? minimum.left : 0) + (rightOpen ? minimum.right : 0);
			const extra = (leftOpen ? widths.left - minimum.left : 0) + (rightOpen ? widths.right - minimum.right : 0);
			const ratio = extra > 0 ? clamp((available - base) / extra, 0, 1) : 1;
			const panelWidth = (side) => compact ? Math.min(widths[side], Math.max(210, containerWidth - 62)) : minimum[side] + (widths[side] - minimum[side]) * ratio;
			const leftWidth = panelWidth("left");
			const rightWidth = panelWidth("right");
			const isOpen = (side) => side === "left" ? leftOpen : rightOpen;
			const open = (side) => {
				if (compact) setDrawer(side);
				else setOpened((previous) => ({
					...previous,
					[side]: true
				}));
			};
			const close = (side) => {
				if (compact) setDrawer((previous) => previous === side ? null : previous);
				else setOpened((previous) => ({
					...previous,
					[side]: false
				}));
			};
			const toggle = (side) => isOpen(side) ? close(side) : open(side);
			const resize = (side, value) => {
				const limit = compact ? containerWidth - 62 : available - (side === "left" ? rightOpen ? rightWidth : 0 : leftOpen ? leftWidth : 0);
				setWidths((previous) => ({
					...previous,
					[side]: clamp(value, minimum[side], Math.min(maximum[side], limit))
				}));
			};
			const cancel = () => {
				const current = drag.current;
				if (!current) return;
				setWidths((previous) => ({
					...previous,
					[current.side]: current.savedWidth
				}));
				if (compact) setDrawer(current.previousDrawer);
				else setOpened((previous) => ({
					...previous,
					[current.side]: current.wasOpen
				}));
				drag.current = null;
				setResizing(null);
				setWillCollapse(false);
			};
			const railEvents = (side) => ({
				onPointerDown(event) {
					if (event.button !== 0 || drag.current) return;
					event.preventDefault();
					event.currentTarget.focus();
					event.currentTarget.setPointerCapture(event.pointerId);
					suppressClick.current = false;
					drag.current = {
						side,
						pointerId: event.pointerId,
						startX: event.clientX,
						startWidth: panelWidth(side),
						savedWidth: widths[side],
						wasOpen: isOpen(side),
						delta: 0,
						previousDrawer: drawer
					};
				},
				onPointerMove(event) {
					const current = drag.current;
					if (!current || current.pointerId !== event.pointerId) return;
					current.delta = (event.clientX - current.startX) * (side === "left" ? 1 : -1);
					if (Math.abs(current.delta) < 5 && !resizing) return;
					suppressClick.current = true;
					setResizing(side);
					if (!current.wasOpen) if (current.delta > 40) {
						open(side);
						resize(side, current.savedWidth + current.delta - 40);
					} else close(side);
					else {
						setWillCollapse(current.startWidth + current.delta < 140);
						resize(side, current.startWidth + current.delta);
					}
				},
				onPointerUp(event) {
					const current = drag.current;
					if (!current || current.pointerId !== event.pointerId) return;
					if (suppressClick.current && current.wasOpen && current.startWidth + current.delta < 140) {
						close(side);
						setWidths((previous) => ({
							...previous,
							[side]: current.savedWidth
						}));
					}
					drag.current = null;
					setResizing(null);
					setWillCollapse(false);
					event.currentTarget.releasePointerCapture(event.pointerId);
				},
				onPointerCancel: cancel,
				onLostPointerCapture: cancel,
				onClick() {
					if (suppressClick.current) {
						suppressClick.current = false;
						return;
					}
					toggle(side);
				},
				onKeyDown(event) {
					if (event.key === "Escape" && drag.current) {
						event.preventDefault();
						event.stopPropagation();
						cancel();
						return;
					}
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						toggle(side);
						return;
					}
					if (event.key === "Home") {
						event.preventDefault();
						close(side);
						return;
					}
					if (event.key === "End") {
						event.preventDefault();
						open(side);
						return;
					}
					if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
					event.preventDefault();
					const delta = (event.key === "ArrowRight" ? 24 : -24) * (side === "left" ? 1 : -1);
					if (!isOpen(side)) {
						if (delta > 0) open(side);
						return;
					}
					if (panelWidth(side) + delta < minimum[side]) close(side);
					else resize(side, panelWidth(side) + delta);
				}
			});
			return {
				root,
				compact,
				leftOpen,
				rightOpen,
				leftWidth,
				rightWidth,
				resizing,
				willCollapse,
				style: {
					"--library-width": `${leftOpen ? leftWidth : 0}px`,
					"--inspector-width": `${rightOpen ? rightWidth : 0}px`,
					"--left-rail": `${leftOpen ? 14 : 30}px`,
					"--right-rail": `${rightOpen ? 14 : 30}px`
				},
				railEvents,
				open,
				close
			};
		}
		//#endregion
		//#region src/client/useCapabilityDrag.ts
		/** Pointer dragging distinguishes a deliberate drag from a card or add-button click. */
		function useCapabilityDrag(add) {
			const zone = (0, react.useRef)(null);
			const callback = (0, react.useRef)(add);
			callback.current = add;
			const gesture = (0, react.useRef)(null);
			const suppressClickUntil = (0, react.useRef)(0);
			const [drag, setDrag] = (0, react.useState)(null);
			const [over, setOver] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				const isOver = (x, y) => {
					const target = document.elementFromPoint?.(x, y);
					return !!target && !!zone.current?.contains(target);
				};
				const clear = () => {
					const current = gesture.current;
					gesture.current = null;
					if (current?.source.hasPointerCapture?.(current.pointer)) current.source.releasePointerCapture(current.pointer);
					setDrag(null);
					setOver(false);
				};
				const move = (event) => {
					const current = gesture.current;
					if (!current || current.pointer !== event.pointerId) return;
					if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 7) return;
					if (!current.moved) {
						current.moved = true;
						current.source.setPointerCapture?.(current.pointer);
						zone.current?.scrollIntoView?.({
							block: "nearest",
							inline: "nearest"
						});
					}
					event.preventDefault();
					setDrag({
						id: current.id,
						x: event.clientX,
						y: event.clientY
					});
					setOver(isOver(event.clientX, event.clientY));
				};
				const finish = (event) => {
					const current = gesture.current;
					if (!current || current.pointer !== event.pointerId) return;
					if (current.moved) {
						suppressClickUntil.current = Date.now() + 250;
						if (isOver(event.clientX, event.clientY)) callback.current(current.id);
					}
					clear();
				};
				const cancel = () => {
					if (gesture.current?.moved) suppressClickUntil.current = Date.now() + 250;
					clear();
				};
				const key = (event) => {
					if (event.key === "Escape" && gesture.current?.moved) {
						event.preventDefault();
						event.stopPropagation();
						cancel();
					}
				};
				window.addEventListener("pointermove", move, { passive: false });
				window.addEventListener("pointerup", finish);
				window.addEventListener("pointercancel", cancel);
				window.addEventListener("blur", cancel);
				window.addEventListener("keydown", key, true);
				return () => {
					window.removeEventListener("pointermove", move);
					window.removeEventListener("pointerup", finish);
					window.removeEventListener("pointercancel", cancel);
					window.removeEventListener("blur", cancel);
					window.removeEventListener("keydown", key, true);
				};
			}, []);
			return {
				zone,
				drag,
				over,
				start: (id, event) => {
					if (event.button !== 0 || gesture.current || event.target.closest("[data-capability-add]")) return;
					gesture.current = {
						id,
						pointer: event.pointerId,
						x: event.clientX,
						y: event.clientY,
						moved: false,
						source: event.currentTarget
					};
				},
				click: (event) => {
					if (Date.now() < suppressClickUntil.current) {
						event.preventDefault();
						event.stopPropagation();
					}
				}
			};
		}
		//#endregion
		//#region src/client/RoleAssistants.tsx
		/** Keep the original roster mounted so collapsing does not discard its state. */
		function AgentPresetDisclosure({ t, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: Roles_module_css_default.presetDisclosure,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [t("rolesExisting"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
					className: Roles_module_css_default.disclosureChevron,
					"aria-hidden": "true",
					viewBox: "0 0 16 16",
					fill: "none",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "m6 3 5 5-5 5",
						stroke: "currentColor",
						strokeWidth: "1.5",
						strokeLinecap: "round",
						strokeLinejoin: "round"
					})
				})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: Roles_module_css_default.disclosureContent,
					children
				})]
			});
		}
		//#endregion
		//#region ../dsh-capabilities/src/core/requirements-model.ts
		/** Persisted requirements contracts. Pure data and rendering, shared by host and UI. */
		const REQUIREMENTS_CAPABILITY_ID = "requirements-analysis";
		const REQUIREMENTS_COMPONENT_ID = "requirements-service";
		const defaultRequirementSettings = () => ({
			purpose: "discussion",
			depth: "standard",
			focus: "流程、权限、异常",
			questionStyle: "short",
			model: "",
			language: "中文"
		});
		const emptyRequirementOverview = () => ({
			background: "",
			goal: "",
			scope: "",
			excluded: "",
			roles: ""
		});
		const emptyRequirement = () => ({
			title: "",
			description: "",
			module: "",
			kind: "functional",
			priority: "must",
			status: "pending",
			actor: "",
			trigger: "",
			preconditions: "",
			steps: "",
			rules: "",
			exceptions: "",
			inputs: "",
			outputs: "",
			acceptance: "",
			sources: [],
			origin: "user"
		});
		const requirementStatusNames = {
			pending: "待确认",
			confirmed: "已确认",
			review: "待复核",
			deferred: "暂缓"
		};
		const questionStatusNames = {
			open: "待回答",
			answered: "已回答·待处理",
			resolved: "已解决",
			deferred: "暂缓",
			dismissed: "不适用"
		};
		const activeRequirements = (task) => task.requirements.filter((item) => !item.removed);
		const openQuestions = (task) => task.questions.filter((item) => !["resolved", "dismissed"].includes(item.status));
		//#endregion
		//#region ../dsh-capabilities/src/core/developer-model.ts
		const DEVELOPER_CAPABILITY_ID = "developer-workspace";
		const developerParts = [
			{
				componentId: "developer-files",
				actions: ["develop"]
			},
			{
				componentId: "developer-git",
				actions: ["inspect-git"]
			},
			{
				componentId: "developer-checks",
				actions: ["verify-code"]
			}
		];
		const developerSummary = (task) => ({
			id: task.id,
			title: task.title,
			cwd: task.cwd,
			roleId: task.roleId,
			roleVersion: task.roleVersion,
			updatedAt: task.updatedAt,
			running: task.rounds.some((r) => r.status === "running") || task.checks.some((r) => r.status === "running")
		});
		//#endregion
		//#region ../dsh-capabilities/src/core/default-roles.ts
		const MEETING_ROLE_ID = "meeting-minutes-demo";
		const MEETING_CAPABILITY_ID = "meeting-transcription";
		//#endregion
		//#region ../dsh-capabilities/src/core/model.ts
		/** JSON-only contract shared by the host and UI; never imports a host service. */
		const browserPackage = "@wxg-prc-cpg/browser-skill-dsh-plugin";
		const components = [
			...developerParts.map((part, i) => ({
				id: part.componentId,
				name: [
					"项目文件与开发对话",
					"Git 变更与版本",
					"项目验证运行"
				][i],
				provider: i === 1 ? "@linxin666/dsh-client-ui-git-graph" : "@linxin666/dsh-capabilities",
				version: "1.0.0",
				actions: [...part.actions],
				dependencies: [],
				icon: "document",
				sourceLabel: "内置开发服务",
				management: "developer",
				capabilityIds: [DEVELOPER_CAPABILITY_ID],
				required: true,
				compositionVersion: 2
			})),
			{
				id: "browserskill",
				name: "浏览器操作",
				provider: browserPackage,
				version: "0.3.0",
				actions: [
					"navigate",
					"read",
					"screenshot"
				],
				dependencies: [
					"@deepseek-ai/dsh-tools",
					"@deepseek-ai/dsh-agent",
					"@deepseek-ai/dsh-session",
					"@deepseek-ai/dsh-skill",
					"@deepseek-ai/dsh-attachment",
					"bsk",
					"browser-extension"
				],
				icon: "browser",
				sourceLabel: "BrowserSkill",
				management: "browser",
				pluginModule: "@linxin666/dsh-capabilities/browser",
				compositionVersion: 1
			},
			{
				id: "meeting-asr",
				name: "会议录音转写",
				provider: "@linxin666/dsh-capabilities",
				version: "1.0.0",
				actions: ["transcribe"],
				dependencies: [],
				icon: "audio",
				sourceLabel: "内置会议服务",
				management: "meeting-asr",
				capabilityIds: [MEETING_CAPABILITY_ID],
				required: true,
				compositionVersion: 2
			},
			{
				id: REQUIREMENTS_COMPONENT_ID,
				name: "需求分析服务",
				provider: "@linxin666/dsh-capabilities",
				version: "1.0.0",
				actions: ["analyze-requirements"],
				dependencies: [],
				icon: "document",
				sourceLabel: "内置需求服务",
				management: "requirements",
				capabilityIds: [REQUIREMENTS_CAPABILITY_ID],
				required: true,
				compositionVersion: 2
			}
		];
		const actionNames = {
			navigate: "打开网页",
			read: "读取网页",
			screenshot: "截取页面",
			transcribe: "转写录音",
			"analyze-requirements": "分析与整理需求",
			develop: "读取与按任务授权编辑项目",
			"inspect-git": "审阅差异与手动 Git 操作",
			"verify-code": "运行已确认的项目检查"
		};
		const emptyDefinition = () => ({
			name: "",
			description: "",
			instructions: "",
			components: []
		});
		const emptyRole = () => ({
			name: "",
			color: "#4F73E8",
			duties: "",
			requirements: "",
			format: "",
			capabilities: []
		});
		const latest = (versions) => versions.at(-1);
		function resolveBinding(state, binding) {
			return state.capabilities.find((c) => c.id === binding.capabilityId)?.versions.find((v) => v.version === binding.version);
		}
		function actionsOf(definition) {
			return [...new Set(definition?.components.flatMap((part) => {
				return components.find((c) => c.id === part.componentId)?.dependencies.some((dep) => definition.excludedDependencies?.includes(dep)) ? [] : part.actions;
			}) ?? [])];
		}
		/** 永久删除必须保护所有历史岗位版本，不能只检查当前列表或活动会话。 */
		function capabilityDeletionReferences(state, capabilityId) {
			return state.roles.filter((role) => role.draft.capabilities.some((binding) => binding.capabilityId === capabilityId) || role.versions.some((version) => version.capabilities.some((binding) => binding.capabilityId === capabilityId)));
		}
		//#endregion
		//#region src/client/meeting-capability-status.ts
		function useMeetingAvailability(revision) {
			const [status, setStatus] = (0, react.useState)(null);
			const refresh = (0, react.useCallback)(async () => {
				try {
					const response = await fetch("/api/capabilities/meeting/config", { credentials: "same-origin" });
					if (!response.ok) throw new Error(`状态读取失败（${response.status}）`);
					setStatus(await response.json());
				} catch (error) {
					setStatus({
						ready: false,
						message: error instanceof Error ? error.message : String(error)
					});
				}
			}, []);
			(0, react.useEffect)(() => {
				refresh();
				const onFocus = () => {
					refresh();
				};
				window.addEventListener("focus", onFocus);
				return () => window.removeEventListener("focus", onFocus);
			}, [refresh, revision]);
			return {
				status,
				refresh
			};
		}
		//#endregion
		//#region src/client/developer-client.ts
		const developerUrl = (route, params = {}) => "/api/capabilities/developer/" + route + "?" + new URLSearchParams(params);
		async function developerApi(route, params = {}, body, method = body === void 0 ? "GET" : "POST") {
			const response = await fetch(developerUrl(route, params), {
				method,
				credentials: "same-origin",
				...body === void 0 ? {} : {
					headers: { "content-type": "application/json" },
					body: JSON.stringify(body)
				}
			});
			const value = await response.json();
			if (!response.ok) throw new Error(value.error || `开发服务错误 (${response.status})`);
			return value;
		}
		function usesDeveloper(state, version) {
			const binding = version?.capabilities.find((b) => b.capabilityId === "developer-workspace" && b.enabled);
			return !!binding && actionsOf(state?.capabilities.find((c) => c.id === binding.capabilityId)?.versions.find((v) => v.version === binding.version)).includes("develop") && (!binding.actions || binding.actions.includes("develop"));
		}
		function createDeveloperHistory() {
			let activeId = null;
			try {
				activeId = sessionStorage.getItem("workbench-developer-active");
			} catch {}
			let state = {
				items: [],
				activeId,
				error: ""
			};
			const listeners = /* @__PURE__ */ new Set(), removed = /* @__PURE__ */ new Set();
			const update = (next) => {
				state = {
					...state,
					...next
				};
				try {
					state.activeId ? sessionStorage.setItem("workbench-developer-active", state.activeId) : sessionStorage.removeItem("workbench-developer-active");
				} catch {}
				listeners.forEach((fn) => fn());
			};
			return {
				subscribe: (fn) => {
					listeners.add(fn);
					return () => {
						listeners.delete(fn);
					};
				},
				getSnapshot: () => state,
				load: async () => {
					try {
						const result = await developerApi("tasks");
						update({
							items: result.items.filter((row) => !removed.has(row.id)),
							error: ""
						});
					} catch (error) {
						update({ error: error instanceof Error ? error.message : String(error) });
					}
				},
				open: (id) => update({ activeId: id }),
				leave: () => update({ activeId: null }),
				upsert: (task, activate) => {
					if (removed.has(task.id)) return;
					const row = developerSummary(task), old = state.items.find((r) => r.id === row.id);
					if (old && old.updatedAt > row.updatedAt) return;
					update({
						items: [...state.items.filter((r) => r.id !== row.id), row].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
						...activate ? { activeId: row.id } : {}
					});
				},
				remove: async (id) => {
					await developerApi("task", { id }, void 0, "DELETE");
					removed.add(id);
					update({
						items: state.items.filter((row) => row.id !== id),
						activeId: state.activeId === id ? null : state.activeId
					});
				}
			};
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-client-ui-plain-chat/src/client/ManagedCapabilities.module.css.mjs
		const css$6 = ".eqpZFq_page{--role-bg:var(--dsw-alias-bg-layer-2,#fff);--role-text:var(--dsw-alias-label-primary,#202938);--role-muted:var(--dsw-alias-label-secondary,#758095);--role-border:var(--dsw-alias-border-l2,#e0e5ec);--role-accent:var(--dsw-alias-button-primary-fill,#4263ba);color:var(--role-text);min-width:0;font:inherit}.eqpZFq_heading,.eqpZFq_actions,.eqpZFq_tabs,.eqpZFq_status{flex-wrap:wrap;align-items:center;gap:10px;display:flex}.eqpZFq_heading{justify-content:space-between;margin-bottom:20px}.eqpZFq_heading h2,.eqpZFq_heading h3{margin:0 0 6px}.eqpZFq_page p{line-height:1.7}.eqpZFq_muted,.eqpZFq_time{color:var(--role-muted);font-size:12px}.eqpZFq_button{color:inherit;border:1px solid var(--role-border);background:var(--role-bg);cursor:pointer;border-radius:8px;padding:8px 12px}.eqpZFq_button:hover{border-color:var(--role-accent)}.eqpZFq_primary{background:var(--role-accent);color:#fff;border-color:var(--role-accent)}.eqpZFq_button:disabled{opacity:.5;cursor:default}.eqpZFq_search{box-sizing:border-box;border:1px solid var(--role-border);background:var(--role-bg);width:100%;color:inherit;border-radius:9px;margin:12px 0;padding:11px 13px}.eqpZFq_tabs{border-bottom:1px solid var(--role-border);gap:3px;margin:16px 0}.eqpZFq_tabs button{color:var(--role-muted);cursor:pointer;background:0 0;border:0;border-bottom:2px solid #0000;padding:10px 13px}.eqpZFq_tabs button[aria-pressed=true]{color:var(--role-accent);border-bottom-color:var(--role-accent)}.eqpZFq_grid{grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr));gap:14px;display:grid}.eqpZFq_card,.eqpZFq_row{border:1px solid var(--role-border);background:var(--role-bg);border-radius:12px;padding:16px}.eqpZFq_card{flex-direction:column;gap:9px;display:flex}.eqpZFq_card h3{margin:0;font-size:15px}.eqpZFq_card p{margin:0;font-size:12px}.eqpZFq_card .eqpZFq_actions{margin-top:auto}.eqpZFq_row{flex-wrap:wrap;justify-content:space-between;align-items:center;gap:14px;margin:10px 0;display:flex}.eqpZFq_row small{color:var(--role-muted);word-break:break-all;margin-top:5px;display:block}.eqpZFq_badge{background:color-mix(in srgb,var(--role-accent) 9%,var(--role-bg));color:var(--role-text);border-radius:6px;padding:3px 7px;font-size:11px}.eqpZFq_notice{border:1px solid var(--role-border);background:color-mix(in srgb,var(--role-accent) 4%,var(--role-bg));border-radius:9px;padding:12px 14px}.eqpZFq_error{color:#b33c42;background:color-mix(in srgb,#b33c42 6%,var(--role-bg));border-radius:8px;padding:10px}.eqpZFq_fields{flex-direction:column;gap:16px;display:flex}.eqpZFq_field{flex-direction:column;gap:8px;font-size:13px;font-weight:550;display:flex}.eqpZFq_field input,.eqpZFq_field textarea,.eqpZFq_field select{box-sizing:border-box;border:1px solid var(--role-border);background:var(--role-bg);width:100%;color:inherit;font:inherit;border-radius:8px;padding:10px;font-weight:400}.eqpZFq_secretField{align-items:center;gap:6px;display:flex}.eqpZFq_secretField input{flex:1;min-width:0}.eqpZFq_secretField button{border:1px solid var(--role-border)}.eqpZFq_check{align-items:center;gap:8px;margin:12px 0;font-size:13px;display:flex}.eqpZFq_footer{border-top:1px solid var(--role-border);flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;padding:16px 22px;display:flex}.eqpZFq_footer p{margin:0;font-size:12px}.eqpZFq_empty{text-align:center;color:var(--role-muted);padding:40px 15px}.eqpZFq_list{margin:8px 0;padding-left:20px;font-size:12px;line-height:1.9}.eqpZFq_dialogBody{max-height:70vh;padding:20px 24px;overflow:auto}.eqpZFq_tasks{border-bottom:1px solid var(--role-border);padding:10px 16px;font-size:12px}.eqpZFq_tasks button{margin-left:12px}.eqpZFq_choice{text-align:left;border:1px solid var(--role-border);background:var(--role-bg);width:100%;color:inherit;border-radius:10px;align-items:center;gap:12px;margin:8px 0;padding:14px;display:flex}.eqpZFq_choice[aria-pressed=true]{border-color:var(--role-accent)}.eqpZFq_choice span{flex:1}.eqpZFq_choice small{color:var(--role-muted);margin-top:5px;display:block}.eqpZFq_cardTop{align-items:center;gap:9px;display:flex}.eqpZFq_cardSource{color:var(--role-muted);flex:1;font-size:11px}.eqpZFq_iconButton{width:34px;height:34px;color:var(--role-muted);cursor:pointer;background:0 0;border:1px solid #0000;border-radius:8px;flex-shrink:0;justify-content:center;align-items:center;transition:color .15s,background .15s,transform .15s;display:inline-flex}.eqpZFq_iconButton:hover{color:var(--role-accent);background:color-mix(in srgb,var(--role-accent) 8%,transparent)}.eqpZFq_iconButton.eqpZFq_pinned{color:#fff;background:#344575;border-color:#7585b1;box-shadow:0 2px 5px #0f1a3c26}.eqpZFq_iconButton.eqpZFq_pinned:hover{color:#fff;background:#29385f}.eqpZFq_pinned svg{fill:color-mix(in srgb,currentColor 18%,transparent)}.eqpZFq_iconButton:active{transform:scale(.92)}.eqpZFq_pinnedCard{border-color:color-mix(in srgb,var(--role-accent) 38%,var(--role-border))}.eqpZFq_cardDescription{color:var(--role-muted);overflow-wrap:anywhere}.eqpZFq_cardMeta{color:var(--role-muted);flex-wrap:wrap;align-items:center;gap:8px;margin:3px 0;font-size:11px;display:flex}.eqpZFq_pinLabel{color:color-mix(in srgb,var(--role-accent) 40%,var(--role-text))}.eqpZFq_card h3{overflow-wrap:anywhere}.eqpZFq_cardFooter{border-top:1px solid var(--role-border);flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-top:auto;padding-top:12px;display:flex}.eqpZFq_inlineAction{justify-content:center;align-items:center;gap:5px;display:inline-flex}.eqpZFq_removeAction{color:var(--role-muted);cursor:pointer;background:0 0;border:1px solid #0000;border-radius:8px;padding:8px}.eqpZFq_removeAction:hover{color:var(--dsw-alias-label-error,#b43f4c);background:#b43f4c14}.eqpZFq_iconButton:disabled,.eqpZFq_removeAction:disabled{opacity:.5;cursor:default}.eqpZFq_page button:focus-visible{outline:2px solid var(--role-accent);outline-offset:3px}.eqpZFq_dangerButton{color:#fff;background:#ac3444;border-color:#ac3444}.eqpZFq_removalImpact{border:1px solid var(--role-border);border-radius:10px;padding:14px;font-size:13px}.eqpZFq_confirmActions{justify-content:flex-end;gap:10px;margin-top:20px;display:flex}.eqpZFq_recycleToolbar{border:1px solid var(--role-border);background:color-mix(in srgb,var(--role-accent) 5%,var(--role-bg));border-radius:10px;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin:14px 0;padding:12px;display:flex}.eqpZFq_selectionSummary{flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;display:flex}.eqpZFq_recycleSelect{cursor:pointer;flex-shrink:0;justify-content:center;align-items:center;width:32px;height:32px;display:inline-flex;position:relative}.eqpZFq_recycleSelect input{opacity:0;cursor:pointer;z-index:1;width:100%;height:100%;margin:0;position:absolute;inset:0}.eqpZFq_selectionMark{box-sizing:border-box;border:1px solid var(--role-muted);background:var(--role-bg);border-radius:5px;justify-content:center;align-items:center;width:20px;height:20px;display:flex}.eqpZFq_selectionMark svg{fill:none;stroke:currentColor;stroke-width:2px;stroke-linecap:round;stroke-linejoin:round;width:18px;height:18px}.eqpZFq_recycleSelect input:checked+.eqpZFq_selectionMark,.eqpZFq_recycleSelect input:indeterminate+.eqpZFq_selectionMark{color:#fff;background:#344575;border-color:#7585b1}.eqpZFq_recycleSelect input:focus-visible+.eqpZFq_selectionMark{outline:2px solid var(--role-accent);outline-offset:3px}.eqpZFq_recycleSelect input:disabled{cursor:default}.eqpZFq_recycleSelect input:disabled+.eqpZFq_selectionMark{opacity:.45}.eqpZFq_selectedCard{background:color-mix(in srgb,#7585b1 10%,var(--role-bg));border-color:#7585b1;box-shadow:0 0 0 1px #7585b1}.eqpZFq_deleteList{overflow-wrap:anywhere;max-height:180px;overflow:auto}.eqpZFq_compositionFieldset{border:0;min-width:0;margin:0;padding:0}.eqpZFq_compositionInfo{border:1px solid var(--role-border);border-radius:9px;margin-bottom:18px;padding:12px}.eqpZFq_compositionInfo summary{color:var(--role-muted);cursor:pointer;font-size:12px}.eqpZFq_compositionInfo[open] summary{margin-bottom:16px}.eqpZFq_associationRow{border:1px solid var(--role-border);background:var(--role-bg);border-radius:10px;justify-content:space-between;align-items:center;gap:12px;margin:10px 0;padding:14px 16px;display:flex}.eqpZFq_associationIdentity{align-items:center;gap:12px;min-width:0;display:flex}.eqpZFq_associationIdentity>div{min-width:0}.eqpZFq_associationIdentity strong{margin-right:8px}.eqpZFq_associationIdentity small{color:var(--role-muted);overflow-wrap:anywhere;margin-top:5px;font-size:11px;display:block}.eqpZFq_associationSymbol{width:34px;height:34px;color:var(--role-accent);background:color-mix(in srgb,var(--role-accent) 10%,transparent);border-radius:8px;flex-shrink:0;place-items:center;font-size:22px;display:grid}.eqpZFq_associationActions{flex-shrink:0;align-items:center;gap:6px;display:flex}.eqpZFq_compositionFeedback,.eqpZFq_compositionToolbar{border:1px solid var(--role-border);background:var(--role-bg);border-radius:9px;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin:12px 0;padding:12px;font-size:12px;display:flex}.eqpZFq_compositionToolbar{z-index:1;position:sticky;bottom:0;box-shadow:0 -5px 12px #00000008}.eqpZFq_missingAssociations{border:1px solid color-mix(in srgb,#be8432 55%,var(--role-border));background:color-mix(in srgb,#be8432 8%,var(--role-bg));border-radius:9px;margin:10px 0;padding:12px;font-size:12px}.eqpZFq_missingRow{flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-top:10px;display:flex}.eqpZFq_missingRow small{color:var(--role-muted)}@media (width<=650px){.eqpZFq_associationRow{flex-wrap:wrap;align-items:flex-start;padding:12px}.eqpZFq_associationActions{margin-left:auto}}@media (prefers-reduced-motion:reduce){.eqpZFq_iconButton{transition:none}.eqpZFq_iconButton:active{transform:none}}";
		const tagId$6 = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/ManagedCapabilities.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$6) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId$6;
			tag.textContent = css$6;
			document.head.appendChild(tag);
		}
		var ManagedCapabilities_module_css_default = {
			"actions": "eqpZFq_actions",
			"associationActions": "eqpZFq_associationActions",
			"associationIdentity": "eqpZFq_associationIdentity",
			"associationRow": "eqpZFq_associationRow",
			"associationSymbol": "eqpZFq_associationSymbol",
			"badge": "eqpZFq_badge",
			"button": "eqpZFq_button",
			"card": "eqpZFq_card",
			"cardDescription": "eqpZFq_cardDescription",
			"cardFooter": "eqpZFq_cardFooter",
			"cardMeta": "eqpZFq_cardMeta",
			"cardSource": "eqpZFq_cardSource",
			"cardTop": "eqpZFq_cardTop",
			"check": "eqpZFq_check",
			"choice": "eqpZFq_choice",
			"compositionFeedback": "eqpZFq_compositionFeedback",
			"compositionFieldset": "eqpZFq_compositionFieldset",
			"compositionInfo": "eqpZFq_compositionInfo",
			"compositionToolbar": "eqpZFq_compositionToolbar",
			"confirmActions": "eqpZFq_confirmActions",
			"dangerButton": "eqpZFq_dangerButton",
			"deleteList": "eqpZFq_deleteList",
			"dialogBody": "eqpZFq_dialogBody",
			"empty": "eqpZFq_empty",
			"error": "eqpZFq_error",
			"field": "eqpZFq_field",
			"fields": "eqpZFq_fields",
			"footer": "eqpZFq_footer",
			"grid": "eqpZFq_grid",
			"heading": "eqpZFq_heading",
			"iconButton": "eqpZFq_iconButton",
			"inlineAction": "eqpZFq_inlineAction",
			"list": "eqpZFq_list",
			"missingAssociations": "eqpZFq_missingAssociations",
			"missingRow": "eqpZFq_missingRow",
			"muted": "eqpZFq_muted",
			"notice": "eqpZFq_notice",
			"page": "eqpZFq_page",
			"pinLabel": "eqpZFq_pinLabel",
			"pinned": "eqpZFq_pinned",
			"pinnedCard": "eqpZFq_pinnedCard",
			"primary": "eqpZFq_primary",
			"recycleSelect": "eqpZFq_recycleSelect",
			"recycleToolbar": "eqpZFq_recycleToolbar",
			"removalImpact": "eqpZFq_removalImpact",
			"removeAction": "eqpZFq_removeAction",
			"row": "eqpZFq_row",
			"search": "eqpZFq_search",
			"secretField": "eqpZFq_secretField",
			"selectedCard": "eqpZFq_selectedCard",
			"selectionMark": "eqpZFq_selectionMark",
			"selectionSummary": "eqpZFq_selectionSummary",
			"status": "eqpZFq_status",
			"tabs": "eqpZFq_tabs",
			"tasks": "eqpZFq_tasks",
			"time": "eqpZFq_time"
		};
		//#endregion
		//#region src/client/DeveloperProjectSettings.tsx
		/** One form and API for the workspace and the capability's default-configuration page. */
		function DeveloperProjectSettings({ cwd: initial, disabled = false, onSaved, onEditingChange }) {
			const [cwd, setCwd] = (0, react.useState)(initial ?? ""), [projects, setProjects] = (0, react.useState)([]), [config, setConfig] = (0, react.useState)(null), [error, setError] = (0, react.useState)(""), [busy, setBusy] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (!initial) developerApi("projects").then(setProjects).catch((e) => setError(e.message));
			}, [initial]);
			(0, react.useEffect)(() => {
				let alive = true;
				setConfig(null);
				if (cwd) developerApi("project", { cwd }).then((c) => {
					if (alive) setConfig(c);
				}).catch((e) => {
					if (alive) setError(e.message);
				});
				return () => {
					alive = false;
				};
			}, [cwd]);
			const change = (value) => {
				setConfig(value);
				onEditingChange?.(true);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ManagedCapabilities_module_css_default.page,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "配置作用于所选项目的新验证。模型沿用工作台账户，在对话中选择；项目内文件默认只读。" }),
					!initial && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: ["项目", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
						"aria-label": "配置的项目",
						value: cwd,
						onChange: (e) => setCwd(e.target.value),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: "",
							children: "选择已登记项目"
						}), projects.map((p) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
							value: p.path,
							children: [
								p.name,
								" · ",
								p.path
							]
						}, p.path))]
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: cwd }),
					config && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "验证命令" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "保存后可在“运行”页主动执行。脚本使用本机权限运行，工作目录固定为此项目。" }),
						config.commands.map((c, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.row,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									"aria-label": `检查名称 ${i + 1}`,
									value: c.name,
									disabled,
									onChange: (e) => change({
										...config,
										commands: config.commands.map((v) => v.id === c.id ? {
											...v,
											name: e.target.value
										} : v)
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									"aria-label": `检查命令 ${i + 1}`,
									value: c.command,
									disabled,
									onChange: (e) => change({
										...config,
										commands: config.commands.map((v) => v.id === c.id ? {
											...v,
											command: e.target.value
										} : v)
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									disabled,
									"aria-label": "移除检查 " + c.name,
									onClick: () => change({
										...config,
										commands: config.commands.filter((v) => v.id !== c.id)
									}),
									children: "移除"
								})
							]
						}, c.id)),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.actions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								disabled,
								onClick: () => change({
									...config,
									commands: [...config.commands, {
										id: crypto.randomUUID(),
										name: "",
										command: ""
									}]
								}),
								children: "添加命令"
							}), config.candidates.filter((c) => !config.commands.some((v) => v.command === c.command)).map((c) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								disabled,
								onClick: () => change({
									...config,
									commands: [...config.commands, {
										...c,
										id: crypto.randomUUID()
									}]
								}),
								children: ["加入 ", c.name]
							}, c.name))]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: ["外部编辑器", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							"aria-label": "外部编辑器",
							disabled,
							value: config.editor,
							onChange: (e) => change({
								...config,
								editor: e.target.value
							}),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "none",
								children: "未配置"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "vscode",
								children: "本机 VS Code（需已安装）"
							})]
						})] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: `${ManagedCapabilities_module_css_default.button} ${ManagedCapabilities_module_css_default.primary}`,
							disabled: disabled || busy,
							onClick: () => {
								setBusy(true);
								setError("");
								developerApi("project", {}, {
									cwd,
									revision: config.revision,
									settings: {
										commands: config.commands,
										editor: config.editor
									}
								}).then((c) => {
									setConfig(c);
									onEditingChange?.(false);
									onSaved?.();
								}).catch((e) => setError(e.message)).finally(() => setBusy(false));
							},
							children: busy ? "保存中…" : "保存项目设置"
						})
					] }),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						children: error
					})
				]
			});
		}
		//#endregion
		//#region src/client/RequirementsSettings.tsx
		function useRequirementAvailability(revision) {
			const [status, setStatus] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)("");
			const refresh = (0, react.useCallback)(async () => {
				try {
					const response = await fetch("/api/capabilities/requirements/config", { credentials: "same-origin" });
					const value = await response.json();
					if (!response.ok) throw new Error(value.error ?? "需求配置读取失败");
					setStatus(value);
					setError("");
				} catch (error) {
					setError(error instanceof Error ? error.message : String(error));
				}
			}, []);
			(0, react.useEffect)(() => {
				refresh();
				window.addEventListener("focus", refresh);
				return () => window.removeEventListener("focus", refresh);
			}, [refresh, revision]);
			return {
				status,
				error,
				refresh,
				accept: setStatus
			};
		}
		function RequirementsSettings({ status, onSaved, disabled = false, onEditingChange }) {
			const [draft, setDraft] = (0, react.useState)(null), [revision, setRevision] = (0, react.useState)(0);
			const [busy, setBusy] = (0, react.useState)(false), [message, setMessage] = (0, react.useState)("");
			const value = draft ?? status?.defaults;
			(0, react.useEffect)(() => {
				onEditingChange(draft !== null);
				return () => onEditingChange(false);
			}, [draft, onEditingChange]);
			if (!value || !status) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "status",
				children: "正在读取需求分析配置…"
			});
			const change = (patch) => {
				if (!draft) setRevision(status.revision);
				setDraft({
					...value,
					...patch
				});
				setMessage("");
			};
			const save = async () => {
				setBusy(true);
				setMessage("");
				try {
					const response = await fetch("/api/capabilities/requirements/config", {
						method: "POST",
						credentials: "same-origin",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							revision,
							defaults: value
						})
					});
					const result = await response.json();
					if (!response.ok) throw new Error(result.error ?? "需求配置保存失败");
					onSaved(result);
					setDraft(null);
					setMessage("默认配置已保存，之后新建的分析采用这些设置。");
				} catch (error) {
					setMessage(error instanceof Error ? error.message : String(error));
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				"aria-label": "需求分析默认配置",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ManagedCapabilities_module_css_default.notice,
						children: "默认值作用于之后新建的需求分析。已有分析保留自己的设置；模型账号沿用工作台配置。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
						disabled: disabled || busy,
						className: ManagedCapabilities_module_css_default.compositionFieldset,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.fields,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: ManagedCapabilities_module_css_default.field,
									children: ["默认整理深度", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										value: value.depth,
										onChange: (e) => change({ depth: e.target.value }),
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "brief",
												children: "简要清单"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "standard",
												children: "标准需求说明"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "detailed",
												children: "详细规格"
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: ManagedCapabilities_module_css_default.field,
									children: ["提问节奏", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										value: value.questionStyle,
										onChange: (e) => change({ questionStyle: e.target.value }),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "short",
											children: "少量关键问题"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: "detailed",
											children: "逐项详细核对"
										})]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: ManagedCapabilities_module_css_default.field,
									children: [
										"默认模型",
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											value: value.model,
											maxLength: 240,
											placeholder: "留空使用工作台默认模型",
											onChange: (e) => change({ model: e.target.value })
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "可填写工作台已配置的模型标识（提供方/模型）；也可在分析对话中选择模型。" })
									]
								})
							]
						}), draft && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.confirmActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: ManagedCapabilities_module_css_default.button,
								onClick: () => {
									setDraft(null);
									setMessage("");
								},
								children: "取消修改"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: `${ManagedCapabilities_module_css_default.button} ${ManagedCapabilities_module_css_default.primary}`,
								onClick: () => void save(),
								children: "保存默认配置"
							})]
						})]
					}),
					draft && revision !== status.revision && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ManagedCapabilities_module_css_default.error,
						children: "配置已被更新，请取消修改后重新核对；当前输入仍保留。"
					}),
					message && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						children: message
					})
				]
			});
		}
		//#endregion
		//#region src/client/MeetingAsrSettings.tsx
		async function post$2(path, body) {
			const response = await fetch(`/api/capabilities/meeting/${path}`, {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body)
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || `保存失败（${response.status}）`);
			return result;
		}
		function EyeIcon({ visible }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				"aria-hidden": "true",
				viewBox: "0 0 24 24",
				width: "18",
				height: "18",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.8",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "12",
						cy: "12",
						r: "2.5"
					}),
					!visible && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 21 21 3" })
				]
			});
		}
		function MeetingAsrSettings({ status, refresh, disabled, onEditingChange }) {
			const [editing, setEditing] = (0, react.useState)(false);
			const [endpoint, setEndpoint] = (0, react.useState)(""), [model, setModel] = (0, react.useState)("");
			const [format, setFormat] = (0, react.useState)("verbose_json"), [maxMb, setMaxMb] = (0, react.useState)(25);
			const [keyDraft, setKeyDraft] = (0, react.useState)(""), [keyDirty, setKeyDirty] = (0, react.useState)(false), [keyVisible, setKeyVisible] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false), [error, setError] = (0, react.useState)(""), [notice, setNotice] = (0, react.useState)("");
			const start = () => {
				setEndpoint(status?.endpoint ?? "");
				setModel(status?.asrModel ?? "");
				setFormat(status?.format === "json" ? "json" : "verbose_json");
				setMaxMb(status?.maxMb ?? 25);
				setKeyDraft("");
				setKeyDirty(false);
				setKeyVisible(false);
				setError("");
				setNotice("");
				setEditing(true);
				onEditingChange?.(true);
			};
			const stop = () => {
				setEditing(false);
				setKeyDraft("");
				setKeyVisible(false);
				setKeyDirty(false);
				setError("");
				onEditingChange?.(false);
			};
			const toggleKey = async () => {
				if (keyVisible) {
					setKeyVisible(false);
					if (!keyDirty) setKeyDraft("");
					return;
				}
				if (!keyDraft && status?.keySource === "saved") {
					setBusy(true);
					setError("");
					try {
						const value = await post$2("config/reveal", {});
						setKeyDraft(value.apiKey ?? "");
					} catch (cause) {
						setError(cause instanceof Error ? cause.message : String(cause));
						return;
					} finally {
						setBusy(false);
					}
				} else if (!keyDraft && status?.keySource === "environment") {
					setError("环境变量提供的密钥不能在界面查看；可直接输入新密钥覆盖。");
					return;
				}
				setKeyVisible(true);
			};
			const save = async (clearKey = false) => {
				if (!endpoint.trim() || !model.trim()) {
					setError("请填写服务地址和识别模型");
					return;
				}
				if (!Number.isInteger(maxMb) || maxMb < 1 || maxMb > 100) {
					setError("录音大小限制应为 1–100 MB");
					return;
				}
				setBusy(true);
				setError("");
				setNotice("");
				try {
					await post$2("config", {
						revision: status?.revision,
						endpoint: endpoint.trim(),
						model: model.trim(),
						format,
						maxMb,
						...clearKey ? { clearKey: true } : keyDirty && keyDraft.trim() ? { apiKey: keyDraft.trim() } : {}
					});
					await refresh();
					stop();
					setNotice(clearKey ? "已移除界面保存的密钥。" : "识别配置已保存并生效。");
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			};
			const reset = async () => {
				if (!window.confirm("恢复使用工作台环境变量中的语音识别配置？")) return;
				setBusy(true);
				setError("");
				try {
					await post$2("config", {
						revision: status?.revision,
						reset: true
					});
					await refresh();
					stop();
					setNotice("已恢复使用环境变量配置。");
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: ManagedCapabilities_module_css_default.row,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "兼容语音识别接口" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: ["服务地址：", status?.endpoint || "待配置"] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: ["识别模型：", status?.asrModel || "待配置"] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
							"API Key：",
							status?.hasKey ? "********" : "未配置或本地服务无需密钥",
							status?.keySource === "environment" ? "（环境变量）" : ""
						] })
					] }), !editing && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: ManagedCapabilities_module_css_default.button,
						disabled: disabled || !status?.editable,
						onClick: start,
						children: "编辑识别配置"
					})]
				}),
				editing && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: ManagedCapabilities_module_css_default.fields,
					"data-meeting-asr-editor": true,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: ManagedCapabilities_module_css_default.field,
							children: ["服务地址", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								"aria-label": "语音识别服务地址",
								value: endpoint,
								onChange: (event) => setEndpoint(event.target.value),
								placeholder: "https://.../v1/audio/transcriptions"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: ManagedCapabilities_module_css_default.field,
							children: ["识别模型", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								"aria-label": "语音识别模型",
								value: model,
								onChange: (event) => setModel(event.target.value),
								placeholder: "例如 whisper-1"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: ManagedCapabilities_module_css_default.field,
							children: ["API Key", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ManagedCapabilities_module_css_default.secretField,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									"aria-label": "语音识别 API Key",
									type: keyVisible ? "text" : "password",
									value: keyDraft,
									placeholder: status?.hasKey ? "********" : "可选，本地服务可留空",
									autoComplete: "off",
									spellCheck: false,
									onChange: (event) => {
										setKeyDraft(event.target.value);
										setKeyDirty(true);
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: ManagedCapabilities_module_css_default.iconButton,
									"aria-label": keyVisible ? "隐藏 API Key" : "显示 API Key",
									title: keyVisible ? "隐藏 API Key" : "显示 API Key",
									disabled: busy,
									onClick: () => void toggleKey(),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EyeIcon, { visible: keyVisible })
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.actions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: ManagedCapabilities_module_css_default.field,
								children: ["响应格式", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									value: format,
									onChange: (event) => setFormat(event.target.value),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "verbose_json",
										children: "verbose_json（含时间片段）"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "json",
										children: "json"
									})]
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: ManagedCapabilities_module_css_default.field,
								children: ["录音大小上限（MB）", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									"aria-label": "录音大小上限",
									type: "number",
									min: "1",
									max: "100",
									value: maxMb,
									onChange: (event) => setMaxMb(Number(event.target.value))
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.actions,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: `${ManagedCapabilities_module_css_default.button} ${ManagedCapabilities_module_css_default.primary}`,
									disabled: busy,
									onClick: () => void save(),
									children: busy ? "保存中…" : "保存配置"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: ManagedCapabilities_module_css_default.button,
									disabled: busy,
									onClick: stop,
									children: "取消"
								}),
								status?.keySource === "saved" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: ManagedCapabilities_module_css_default.button,
									disabled: busy,
									onClick: () => void save(true),
									children: "移除已保存密钥"
								}),
								status?.configSource === "saved" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: ManagedCapabilities_module_css_default.button,
									disabled: busy,
									onClick: () => void reset(),
									children: "恢复环境变量配置"
								})
							]
						})
					]
				}),
				error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: ManagedCapabilities_module_css_default.error,
					role: "alert",
					children: error
				}),
				notice && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: ManagedCapabilities_module_css_default.notice,
					role: "status",
					children: notice
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: ManagedCapabilities_module_css_default.muted,
					children: "录音转写使用这里的接口；纪要生成模型仍在会议对话中选择。保存后无需重启工作台。"
				})
			] });
		}
		//#endregion
		//#region ../dsh-capabilities/src/core/composition.ts
		function availableComponents(capabilityId) {
			const scoped = components.filter((c) => c.capabilityIds?.includes(capabilityId ?? ""));
			return scoped.length ? scoped : components.filter((c) => !c.capabilityIds);
		}
		function requiredComponents(capabilityId) {
			return availableComponents(capabilityId).filter((c) => c.required);
		}
		function compositionSupported(data, capabilityId) {
			return (data.compositionVersion ?? 0) >= Math.max(1, ...availableComponents(capabilityId).map((c) => c.compositionVersion));
		}
		function compatibilityIssues(value, capabilityId) {
			const allowed = availableComponents(capabilityId);
			return value.components.filter((p) => !allowed.some((c) => c.id === p.componentId)).map((p) => `${components.find((c) => c.id === p.componentId)?.name ?? p.componentId}不支持当前能力的执行流程`);
		}
		function missingAssociations(value, capabilityId) {
			return [...requiredComponents(capabilityId).filter((c) => !value.components.some((p) => p.componentId === c.id)).map((c) => c.id), ...missingDependencies(value)];
		}
		const dependencyName = (id) => id.replace("@deepseek-ai/dsh-", "");
		/** Environment requirements (CLI/extension) are not removable plugin associations. */
		function supportDependencies(value) {
			return [...new Set(value.components.flatMap((part) => components.find((c) => c.id === part.componentId)?.dependencies.filter((id) => id.startsWith("@")) ?? []))];
		}
		function dependencyUsers(value, id) {
			return value.components.flatMap((part) => {
				const descriptor = components.find((c) => c.id === part.componentId);
				return descriptor?.dependencies.includes(id) ? [descriptor] : [];
			});
		}
		function missingDependencies(value) {
			return supportDependencies(value).filter((id) => value.excludedDependencies?.includes(id));
		}
		function compositionIds(value) {
			const ids = [...value.components.map((p) => p.componentId), ...supportDependencies(value).filter((id) => !value.excludedDependencies?.includes(id))];
			return [...(value.componentOrder ?? []).filter((id) => ids.includes(id)), ...ids.filter((id) => !value.componentOrder?.includes(id))];
		}
		function addAssociation(value, id) {
			if (supportDependencies(value).includes(id)) return {
				...value,
				excludedDependencies: (value.excludedDependencies ?? []).filter((dep) => dep !== id)
			};
			const descriptor = components.find((c) => c.id === id);
			if (!descriptor || value.components.some((p) => p.componentId === id)) return value;
			return {
				...value,
				components: [...value.components, {
					componentId: id,
					actions: [...descriptor.actions]
				}]
			};
		}
		function removeAssociation(value, id) {
			if (supportDependencies(value).includes(id)) return {
				...value,
				excludedDependencies: [.../* @__PURE__ */ new Set([...value.excludedDependencies ?? [], id])],
				componentOrder: (value.componentOrder ?? []).filter((key) => key !== id)
			};
			const next = {
				...value,
				components: value.components.filter((p) => p.componentId !== id)
			};
			const needed = supportDependencies(next);
			next.excludedDependencies = (value.excludedDependencies ?? []).filter((dep) => needed.includes(dep));
			const remaining = [...next.components.map((p) => p.componentId), ...needed];
			next.componentOrder = (value.componentOrder ?? []).filter((key) => remaining.includes(key));
			return next;
		}
		function moveAssociation(value, id, target) {
			const ids = compositionIds(value), from = ids.indexOf(id), to = ids.indexOf(target);
			if (from < 0 || to < 0 || from === to) return value;
			ids.splice(from, 1);
			ids.splice(to, 0, id);
			return {
				...value,
				componentOrder: ids
			};
		}
		//#endregion
		//#region ../dsh-capabilities/src/core/validation.ts
		function issues(definition, capabilityId) {
			const missing = missingAssociations(definition, capabilityId);
			return [
				...compatibilityIssues(definition, capabilityId),
				...definition.components.length === 0 && !missing.length ? ["尚未添加组件"] : definition.components.flatMap((p) => p.actions.length ? [] : ["至少选择一个业务动作"]),
				...missing.map((id) => `缺少必需组件：${components.find((c) => c.id === id)?.name ?? dependencyName(id)}，补回后才能发布`)
			];
		}
		function roleCompositionIssues(value) {
			const active = value.capabilities.filter((binding) => binding.enabled);
			if (active.some((binding) => binding.capabilityId === "developer-workspace") && active.some((binding) => binding.capabilityId !== "developer-workspace")) return ["开发工作区暂不支持与其他执行能力混用；草稿可以保存，请停用其他能力后发布。"];
			return active.some((binding) => binding.capabilityId === "requirements-analysis") && active.some((binding) => binding.capabilityId !== "requirements-analysis") ? ["需求分析使用独立工作区，暂不支持与其他执行能力混用。请停用或移除其他能力后发布；草稿可以继续保存。"] : [];
		}
		//#endregion
		//#region src/client/capability-client.ts
		let view = {
			data: null,
			error: "",
			revision: 0
		};
		const listeners = /* @__PURE__ */ new Set();
		let pending;
		function emit(patch) {
			view = {
				...view,
				...patch,
				revision: view.revision + 1
			};
			listeners.forEach((fn) => fn());
		}
		async function request$1(path, body) {
			const response = await fetch(`/api/capabilities/${path}`, {
				credentials: "same-origin",
				...body === void 0 ? {} : {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(body)
				}
			});
			const value = await response.json().catch(() => ({ error: "能力服务尚未加载，请检查工作台运行配置。" }));
			if (!response.ok) throw new Error(value.error ?? "能力服务请求失败");
			return value;
		}
		const capabilityClient = {
			getSnapshot: () => view,
			subscribe: (fn) => {
				listeners.add(fn);
				return () => {
					listeners.delete(fn);
				};
			},
			refresh() {
				if (pending) return pending;
				pending = request$1("state").then((data) => emit({
					data,
					error: ""
				})).catch((error) => emit({ error: String(error.message ?? error) })).finally(() => {
					pending = void 0;
				});
				return pending;
			},
			async command(command, revision = view.data?.state.revision) {
				if (revision === void 0) throw new Error("请先等待能力数据加载");
				const result = await request$1("command", {
					revision,
					command
				});
				await capabilityClient.refresh();
				return result.id;
			},
			async check(connect = false) {
				await request$1(connect ? "connect" : "check", {});
				await capabilityClient.refresh();
			},
			async stop(sessionId) {
				await request$1("stop", { sessionId });
				await capabilityClient.refresh();
			},
			async uploadRoleIcon(dataUrl) {
				const result = await request$1("icons", { dataUrl });
				if (!/^[a-f0-9]{64}$/.test(result.id)) throw new Error("图标保存结果无效，请重试");
				return result.id;
			}
		};
		function useCapabilities() {
			const state = (0, react.useSyncExternalStore)(capabilityClient.subscribe, capabilityClient.getSnapshot);
			(0, react.useEffect)(() => {
				capabilityClient.refresh();
				const refresh = () => {
					if (!document.hidden) capabilityClient.refresh();
				};
				const timer = window.setInterval(refresh, 15e3);
				window.addEventListener("focus", refresh);
				return () => {
					clearInterval(timer);
					window.removeEventListener("focus", refresh);
				};
			}, []);
			return state;
		}
		const editorDrafts = /* @__PURE__ */ new Map();
		function openCapabilityLink(link) {
			try {
				sessionStorage.setItem("workbench-capability-link", JSON.stringify(link));
			} catch {}
			window.dispatchEvent(new CustomEvent("workbench-capability-link", { detail: link }));
		}
		function lastCapabilityLink() {
			try {
				return JSON.parse(sessionStorage.getItem("workbench-capability-link") ?? "null") ?? void 0;
			} catch {
				return;
			}
		}
		//#endregion
		//#region src/client/useCapabilityDefinition.ts
		const changed = "workbench-capability-draft";
		function clearCapabilityDraft(id) {
			editorDrafts.delete(`capability:${id ?? "new"}`);
			window.dispatchEvent(new Event(changed));
		}
		/** Detail and editor share the same uncommitted draft and optimistic save revision. */
		function useCapabilityDefinition(id, data) {
			const [, refresh] = (0, react.useReducer)((n) => n + 1, 0), [empty] = (0, react.useState)(emptyDefinition);
			(0, react.useEffect)(() => {
				window.addEventListener(changed, refresh);
				return () => window.removeEventListener(changed, refresh);
			}, []);
			const key = `capability:${id ?? "new"}`, cached = editorDrafts.get(key);
			const saved = data.state.capabilities.find((c) => c.id === id)?.draft ?? empty;
			const draft = cached?.value ?? saved, revision = cached?.revision ?? data.state.revision;
			const change = (value, base = revision) => {
				editorDrafts.set(key, {
					value: structuredClone(value),
					revision: base
				});
				window.dispatchEvent(new Event(changed));
			};
			return {
				draft,
				revision,
				change,
				dirty: JSON.stringify(draft) !== JSON.stringify(saved),
				discard: () => clearCapabilityDraft(id),
				rebase: () => change(draft, data.state.revision)
			};
		}
		//#endregion
		//#region src/client/useCompositionSort.ts
		function useCompositionSort(move) {
			const root = (0, react.useRef)(null), callback = (0, react.useRef)(move);
			callback.current = move;
			const gesture = (0, react.useRef)(null);
			const [sorting, setSorting] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				const hit = (event) => {
					const row = document.elementFromPoint?.(event.clientX, event.clientY)?.closest("[data-composition-row]");
					return row && root.current?.contains(row) ? row.dataset.compositionRow : null;
				};
				const clear = () => {
					const current = gesture.current;
					gesture.current = null;
					setSorting(null);
					if (current?.handle.hasPointerCapture?.(current.pointer)) current.handle.releasePointerCapture(current.pointer);
				};
				const move = (event) => {
					const current = gesture.current;
					if (!current || current.pointer !== event.pointerId) return;
					if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 7) return;
					current.moved = true;
					event.preventDefault();
					current.handle.setPointerCapture?.(current.pointer);
					setSorting({
						id: current.id,
						target: hit(event)
					});
					const scroll = root.current?.closest("section"), box = scroll?.getBoundingClientRect();
					if (scroll && box) {
						if (event.clientY < box.top + 45) scroll.scrollTop -= 12;
						else if (event.clientY > box.bottom - 45) scroll.scrollTop += 12;
					}
				};
				const finish = (event) => {
					const current = gesture.current;
					if (!current || current.pointer !== event.pointerId) return;
					const target = hit(event);
					if (current.moved && target && target !== current.id) callback.current?.(current.id, target);
					clear();
				};
				const cancel = (event) => {
					if (event.key === "Escape" && gesture.current) {
						event.preventDefault();
						event.stopPropagation();
						clear();
					}
				};
				window.addEventListener("pointermove", move, { passive: false });
				window.addEventListener("pointerup", finish);
				window.addEventListener("pointercancel", clear);
				window.addEventListener("blur", clear);
				window.addEventListener("keydown", cancel, true);
				return () => {
					window.removeEventListener("pointermove", move);
					window.removeEventListener("pointerup", finish);
					window.removeEventListener("pointercancel", clear);
					window.removeEventListener("blur", clear);
					window.removeEventListener("keydown", cancel, true);
					gesture.current = null;
				};
			}, []);
			return {
				root,
				sorting,
				start: (id, event) => {
					if (!callback.current || event.button !== 0) return;
					event.stopPropagation();
					gesture.current = {
						id,
						pointer: event.pointerId,
						x: event.clientX,
						y: event.clientY,
						moved: false,
						handle: event.currentTarget
					};
				}
			};
		}
		//#endregion
		//#region src/client/ManagedWorkbench.tsx
		function CapabilityGlyph({ kind = "browser" }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: Capabilities_module_css_default.icon,
				style: { "--cap-color": kind === "audio" ? "#6683bd" : "#4F73E8" },
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.6",
					children: kind === "document" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6" }) }) : kind === "audio" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "9",
						y: "3",
						width: "6",
						height: "12",
						rx: "3"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M6 11a6 6 0 0 0 12 0M12 17v4m-4 0h8" })] }) : kind === "support" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" }) }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
							cx: "12",
							cy: "12",
							r: "9"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ellipse", {
							cx: "12",
							cy: "12",
							rx: "4",
							ry: "9"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 12h18" })
					] })
				})
			});
		}
		/** Reuses the tested resize/drag hooks and the established compact row design. */
		function ManagedWorkbench({ library, attached, selected, onSelect, onAdd, onRemove, form, inspector, title, libraryTitle, onManage, onReorder, removeIcon, attachedTitle = "已添加的配件", compositionNotice }) {
			const panels = useCapabilityPanels(attached.length > 0), prefix = (0, react.useId)();
			const [query, setQuery] = (0, react.useState)(""), [feedback, setFeedback] = (0, react.useState)(null);
			const cards = (0, react.useRef)(/* @__PURE__ */ new Map());
			const add = (id) => {
				const duplicate = attached.some((a) => a.id === id);
				onAdd(id);
				setFeedback((old) => ({
					id,
					duplicate,
					sequence: (old?.sequence ?? 0) + 1
				}));
			};
			const drag = useCapabilityDrag(add);
			const sort = useCompositionSort(onReorder);
			const [sortNotice, setSortNotice] = (0, react.useState)("");
			(0, react.useLayoutEffect)(() => {
				if (!feedback) return;
				const row = cards.current.get(feedback.id);
				if (!row) return;
				row.scrollIntoView?.({ block: "nearest" });
				const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
				const animation = row.animate?.(reduced || feedback.duplicate ? [{ opacity: .65 }, { opacity: 1 }] : [
					{ transform: "translateY(-4px) scale(.98)" },
					{
						transform: "translateY(2px) scale(1.015)",
						offset: .4
					},
					{
						transform: "translateY(-1px) scale(.995)",
						offset: .7
					},
					{ transform: "none" }
				], {
					duration: reduced ? 150 : 340,
					easing: "ease-out"
				});
				return () => animation?.cancel();
			}, [feedback]);
			const configure = (id) => {
				onSelect(id);
				panels.open("right");
			};
			const rail = (side) => {
				const open = side === "left" ? panels.leftOpen : panels.rightOpen;
				const label = `${open ? "收起" : "展开"}${side === "left" ? libraryTitle : "设置"}`;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					role: "separator",
					tabIndex: 0,
					"aria-label": label,
					"aria-orientation": "vertical",
					"aria-controls": `${prefix}-${side}`,
					"aria-valuemin": 0,
					"aria-valuemax": side === "left" ? 360 : 420,
					"aria-valuenow": Math.round(open ? side === "left" ? panels.leftWidth : panels.rightWidth : 0),
					title: `${label} · 拖动调整宽度，双击恢复`,
					className: `${Capabilities_module_css_default.rail} ${side === "left" ? Capabilities_module_css_default.leftRail : Capabilities_module_css_default.rightRail} ${open ? "" : Capabilities_module_css_default.railCollapsed} ${panels.resizing === side && panels.willCollapse ? Capabilities_module_css_default.collapseReady : ""}`,
					...panels.railEvents(side),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: Capabilities_module_css_default.railHandle,
						"aria-hidden": "true",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "▥" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: Capabilities_module_css_default.railArrow,
								children: side === "left" === open ? "‹" : "›"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: Capabilities_module_css_default.railGrip })
						]
					})
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: Capabilities_module_css_default.banner,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: Capabilities_module_css_default.bannerDot }), "保存草稿可继续编辑；发布版本后可由岗位使用。移除配件不会卸载共享插件。"]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: panels.root,
					style: panels.style,
					className: `${Capabilities_module_css_default.workbench} ${panels.compact ? Capabilities_module_css_default.compact : ""} ${panels.resizing ? Capabilities_module_css_default.resizing : ""}`,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							id: `${prefix}-left`,
							hidden: !panels.leftOpen,
							className: Capabilities_module_css_default.library,
							"aria-label": libraryTitle,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: Capabilities_module_css_default.columnHeading,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: libraryTitle }), onManage && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: Capabilities_module_css_default.manageLink,
										onClick: onManage,
										children: "管理能力 ↗"
									})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: Capabilities_module_css_default.collapseButton,
										onClick: () => panels.close("left"),
										"aria-label": "收起左栏",
										children: "‹"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									className: Capabilities_module_css_default.search,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										placeholder: "搜索名称或组件",
										"aria-label": "搜索配件",
										value: query,
										onChange: (e) => setQuery(e.target.value)
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: Capabilities_module_css_default.catalog,
									children: library.filter((i) => `${i.name} ${i.subtitle}`.toLowerCase().includes(query.toLowerCase())).map((item, index, items) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.default.Fragment, { children: [item.group && items[index - 1]?.group !== item.group && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
										className: Capabilities_module_css_default.catalogGroup,
										children: item.group
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
										className: `${Capabilities_module_css_default.catalogCard} ${selected === item.id ? Capabilities_module_css_default.catalogSelected : ""}`,
										onPointerDown: (e) => !item.disabled && drag.start(item.id, e),
										onClickCapture: drag.click,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: Capabilities_module_css_default.catalogInspect,
												title: item.name,
												onClick: () => configure(item.id),
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityGlyph, { kind: item.icon ?? (item.id === "meeting-transcription" ? "audio" : item.id.startsWith("@") ? "support" : "browser") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: item.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: item.subtitle })] })]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												"data-capability-add": true,
												type: "button",
												className: Capabilities_module_css_default.quickAdd,
												disabled: item.disabled || attached.some((a) => a.id === item.id),
												"aria-label": `添加 ${item.name}`,
												onClick: () => add(item.id),
												children: attached.some((a) => a.id === item.id) ? "✓" : "＋"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: Capabilities_module_css_default.grip,
												"aria-hidden": "true",
												children: "⠿"
											})
										]
									})] }, item.id))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: Capabilities_module_css_default.libraryNote,
									children: "仅列出已适配的组件和已发布的能力"
								})
							]
						}),
						rail("left"),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: Capabilities_module_css_default.canvas,
							"aria-label": title,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: Capabilities_module_css_default.columnHeading,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: title }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: Capabilities_module_css_default.step,
										children: "01"
									})]
								}),
								form,
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: `${Capabilities_module_css_default.columnHeading} ${Capabilities_module_css_default.attachedHeading}`,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", { children: [
										attachedTitle,
										" ",
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: Capabilities_module_css_default.count,
											children: attached.length
										})
									] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: Capabilities_module_css_default.step,
										children: "02"
									})]
								}),
								compositionNotice,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									ref: sort.root,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										ref: drag.zone,
										"aria-label": "拖入配件",
										className: `${Capabilities_module_css_default.dropZone} ${drag.drag ? Capabilities_module_css_default.dragReady : ""} ${drag.over ? Capabilities_module_css_default.dragOver : ""}`,
										children: [attached.map((item, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											ref: (node) => {
												if (node) cards.current.set(item.id, node);
												else cards.current.delete(item.id);
											},
											className: `${Capabilities_module_css_default.attachedCard} ${selected === item.id ? Capabilities_module_css_default.attachedSelected : ""} ${sort.sorting?.id === item.id ? Capabilities_module_css_default.sortSource : ""} ${sort.sorting?.target === item.id && sort.sorting.id !== item.id ? Capabilities_module_css_default.sortTarget : ""}`,
											"data-attached-capability": item.id,
											"data-composition-row": item.id,
											children: [
												onReorder && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: Capabilities_module_css_default.sortHandle,
													"aria-label": `调整顺序：${item.name}`,
													title: "拖动排序；方向键上下移动",
													onPointerDown: (e) => sort.start(item.id, e),
													onKeyDown: (e) => {
														if (!["ArrowUp", "ArrowDown"].includes(e.key)) return;
														e.preventDefault();
														e.stopPropagation();
														const target = attached[index + (e.key === "ArrowUp" ? -1 : 1)];
														if (target) {
															onReorder(item.id, target.id);
															setSortNotice(`${item.name}已${e.key === "ArrowUp" ? "上移" : "下移"}`);
														}
													},
													children: "⠿"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
													type: "button",
													className: Capabilities_module_css_default.attachedSelect,
													onClick: () => configure(item.id),
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityGlyph, { kind: item.icon ?? (item.id === "meeting-transcription" ? "audio" : item.id.startsWith("@") ? "support" : "browser") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: item.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: item.subtitle })] })]
												}),
												item.removable !== false && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: Capabilities_module_css_default.remove,
													title: `移除 ${item.name}`,
													"aria-label": `移除 ${item.name}`,
													onClick: () => onRemove(item.id),
													children: removeIcon ?? "×"
												})
											]
										}, item.id)), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: `${Capabilities_module_css_default.dropHint} ${attached.length ? Capabilities_module_css_default.dropCompact : ""}`,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "＋" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "拖入配件，或点击左侧加号" })]
										})]
									})
								})
							]
						}),
						rail("right"),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
							id: `${prefix}-right`,
							hidden: !panels.rightOpen,
							className: Capabilities_module_css_default.inspector,
							"aria-label": "配件设置",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: Capabilities_module_css_default.inspectorHeader,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "配件设置" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: Capabilities_module_css_default.collapseButton,
									onClick: () => panels.close("right"),
									"aria-label": "收起右栏",
									children: "›"
								})]
							}), inspector]
						})
					]
				}),
				drag.drag && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: Capabilities_module_css_default.dragGhost,
					"aria-hidden": "true",
					style: {
						left: drag.drag.x + 12,
						top: drag.drag.y + 12
					},
					children: library.find((i) => i.id === drag.drag.id)?.name
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: Capabilities_module_css_default.srOnly,
					role: "status",
					children: feedback ? `${feedback.duplicate ? "已添加" : "添加成功"}：${library.find((i) => i.id === feedback.id)?.name}` : ""
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: Capabilities_module_css_default.srOnly,
					role: "status",
					children: sortNotice
				})
			] });
		}
		//#endregion
		//#region src/client/CapabilitySelection.tsx
		function CapabilitySelection({ checked, mixed = false, disabled = false, label, onChange }) {
			const ref = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (ref.current) ref.current.indeterminate = mixed;
			}, [mixed]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: ManagedCapabilities_module_css_default.recycleSelect,
				title: label,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					ref,
					type: "checkbox",
					checked,
					disabled,
					"aria-label": label,
					onChange
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: ManagedCapabilities_module_css_default.selectionMark,
					"aria-hidden": "true",
					children: mixed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						viewBox: "0 0 20 20",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M5 10h10" })
					}) : checked ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						viewBox: "0 0 20 20",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m4 10 4 4 8-8" })
					}) : null
				})]
			});
		}
		//#endregion
		//#region src/client/ManagedCapabilityCards.tsx
		function CapabilityActionIcon({ kind }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "17",
				height: "17",
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.7",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: kind === "pin" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M16 3 21 8l-4 1-3 5v3l-7-7h3l5-3z" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m3 21 7-7" })] }) : kind === "remove" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" }) }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 4v6h6M3 10a9 9 0 1 1 1 8" }) })
			});
		}
		function capabilityImpact(data, id) {
			return {
				roles: data.state.roles.filter((r) => r.draft.capabilities.some((b) => b.capabilityId === id) || latest(r.versions)?.capabilities.some((b) => b.capabilityId === id)),
				tasks: data.tasks.filter((t) => t.status !== "stopped" && data.state.roles.find((r) => r.id === t.roleId)?.versions.find((v) => v.version === t.roleVersion)?.capabilities.some((b) => b.enabled && b.capabilityId === id))
			};
		}
		function ManagedCapabilityCard({ capability: c, data, busy, onManage, onPin, onRemove, onRestore, onPurge, selection, meetingStatus, requirementsStatus }) {
			const status = c.removedAt ? "已移除" : !c.enabled ? "已停用" : !c.versions.length ? "草稿" : c.id === "developer-workspace" ? "项目内检测" : c.id === "requirements-analysis" ? requirementsStatus?.ready ? "可使用" : requirementsStatus ? "待配置" : "检测中" : c.id === "meeting-transcription" ? meetingStatus?.ready ? "已配置" : meetingStatus?.state === "disabled" ? "不可用" : meetingStatus ? "待配置" : "检测中" : data.health.state === "ready" ? "可使用" : "待连接";
			const pinLabel = `${c.pinned ? "取消收藏" : "收藏能力"}：${c.draft.name}`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: `${ManagedCapabilities_module_css_default.card} ${c.pinned && !c.removedAt ? ManagedCapabilities_module_css_default.pinnedCard : ""} ${selection?.checked ? ManagedCapabilities_module_css_default.selectedCard : ""}`,
				"data-managed-capability": c.id,
				"data-selected": selection?.checked,
				onClick: (event) => {
					if (selection && !busy && !event.target.closest("button,input,label")) selection.onChange();
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ManagedCapabilities_module_css_default.cardTop,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityGlyph, { kind: c.id === "requirements-analysis" || c.id === "developer-workspace" ? "document" : c.id === "meeting-transcription" ? "audio" : "browser" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ManagedCapabilities_module_css_default.cardSource,
								children: c.source === "builtin" ? "内置能力" : "我的能力"
							}),
							selection && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilitySelection, {
								checked: selection.checked,
								disabled: busy,
								label: `选择能力：${c.draft.name}`,
								onChange: selection.onChange
							}),
							" ",
							!c.removedAt && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: `${ManagedCapabilities_module_css_default.iconButton} ${c.pinned ? ManagedCapabilities_module_css_default.pinned : ""}`,
								type: "button",
								disabled: busy,
								"aria-label": pinLabel,
								title: pinLabel,
								"aria-pressed": c.pinned,
								onClick: onPin,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityActionIcon, { kind: "pin" })
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: c.draft.name }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ManagedCapabilities_module_css_default.cardDescription,
						children: c.draft.description || "尚未填写能力简介"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ManagedCapabilities_module_css_default.cardMeta,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ManagedCapabilities_module_css_default.badge,
								title: c.id === "requirements-analysis" ? requirementsStatus?.message : c.id === "meeting-transcription" ? meetingStatus?.message : void 0,
								children: status
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [capabilityImpact(data, c.id).roles.length, " 个岗位引用"] }),
							c.pinned && !c.removedAt && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ManagedCapabilities_module_css_default.pinLabel,
								children: "已收藏"
							})
						]
					}),
					c.removedAt && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ManagedCapabilities_module_css_default.cardMeta,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["移除于 ", new Date(c.removedAt).toLocaleString()] }), capabilityDeletionReferences(data.state, c.id).length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ManagedCapabilities_module_css_default.badge,
							title: "岗位配置或历史版本仍在引用，清空回收站时会保留",
							children: "引用保护"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ManagedCapabilities_module_css_default.cardFooter,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: ManagedCapabilities_module_css_default.button,
							onClick: onManage,
							children: c.removedAt ? "查看配置 →" : "管理能力 →"
						}), c.removedAt ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.actions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								className: `${ManagedCapabilities_module_css_default.button} ${ManagedCapabilities_module_css_default.inlineAction}`,
								disabled: busy,
								"aria-label": `恢复能力：${c.draft.name}`,
								onClick: onRestore,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityActionIcon, { kind: "restore" }), "恢复"]
							}), onPurge && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: `${ManagedCapabilities_module_css_default.iconButton} ${ManagedCapabilities_module_css_default.removeAction}`,
								disabled: busy,
								"aria-label": `永久删除能力：${c.draft.name}`,
								title: `永久删除能力：${c.draft.name}`,
								onClick: onPurge,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityActionIcon, { kind: "remove" })
							})]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: `${ManagedCapabilities_module_css_default.iconButton} ${ManagedCapabilities_module_css_default.removeAction}`,
							disabled: busy,
							"aria-label": `移除能力：${c.draft.name}`,
							title: `移除能力：${c.draft.name}`,
							onClick: onRemove,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityActionIcon, { kind: "remove" })
						})]
					})
				]
			});
		}
		function RemoveCapabilityDialog({ data, id, onClose, onRemoved }) {
			const cap = data.state.capabilities.find((c) => c.id === id), { roles, tasks } = capabilityImpact(data, id);
			const [revision, setRevision] = (0, react.useState)(data.state.revision), [busy, setBusy] = (0, react.useState)(false), [error, setError] = (0, react.useState)("");
			const changed = revision !== data.state.revision;
			const remove = async () => {
				setBusy(true);
				setError("");
				try {
					await capabilityClient.command({
						type: "capability.remove",
						id
					}, revision);
					onRemoved();
				} catch (error) {
					setError(error instanceof Error ? error.message : String(error));
				} finally {
					setBusy(false);
				}
			};
			if (!cap) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal$1, {
				title: "能力已不存在",
				closeLabel: "取消移除",
				onClose,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: `${ManagedCapabilities_module_css_default.page} ${ManagedCapabilities_module_css_default.dialogBody}`,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						children: "此能力已被其他页面永久删除。关闭后可继续管理其他能力。"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ManagedCapabilities_module_css_default.confirmActions,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: ManagedCapabilities_module_css_default.button,
							onClick: onClose,
							children: "关闭"
						})
					})]
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal$1, {
				title: "移除能力",
				closeLabel: "取消移除",
				onClose: () => {
					if (!busy) onClose();
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: `${ManagedCapabilities_module_css_default.page} ${ManagedCapabilities_module_css_default.dialogBody}`,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
							"将「",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: cap.draft.name }),
							"」移入回收站。"
						] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: ManagedCapabilities_module_css_default.notice,
							children: "移除后停止提供此能力，不能再添加到岗位。配置、历史版本和已有岗位引用会保留，可在“回收站”中恢复；恢复后需要手动启用。"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.removalImpact,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [
									roles.length,
									" 个岗位引用 · ",
									tasks.length,
									" 个活动会话"
								] }),
								roles.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
									className: ManagedCapabilities_module_css_default.list,
									children: roles.map((r) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: r.draft.name }, r.id))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: ManagedCapabilities_module_css_default.muted,
									children: [cap.id === "developer-workspace" ? "移除后将阻止开发任务后续执行，已有代码、任务和验证记录保留。" : cap.id === "requirements-analysis" ? "移除后将阻止新建需求分析和继续调用模型；已保存的需求记录与确认版本仍保留。" : cap.id === "meeting-transcription" ? "移除后将无法新建或继续处理会议录音；已有会议记录仍保留。" : tasks.length ? "相关会话的后续调用将被阻止，并请求停止其浏览器任务。" : "没有相关的活动会话。", "共享插件及其他能力保持不变。"]
								})
							]
						}),
						error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							role: "alert",
							className: ManagedCapabilities_module_css_default.error,
							children: error
						}),
						changed && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							role: "status",
							className: ManagedCapabilities_module_css_default.notice,
							children: ["配置已有更新，请核对上方引用范围。", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: ManagedCapabilities_module_css_default.button,
								disabled: busy,
								onClick: () => {
									setRevision(data.state.revision);
									setError("");
								},
								children: "已核对，更新操作基准"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.confirmActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: ManagedCapabilities_module_css_default.button,
								disabled: busy,
								onClick: onClose,
								children: "取消"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: `${ManagedCapabilities_module_css_default.button} ${ManagedCapabilities_module_css_default.dangerButton}`,
								disabled: busy || changed,
								onClick: () => void remove(),
								children: busy ? "正在移除…" : "确认移除"
							})]
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/ComponentService.tsx
		/** Module differences live here; shared composition views never assume a browser environment. */
		const adapters = {
			developer: () => ({
				description: "在开发工作区读取项目、按任务授权编辑、查看真实 Git 差异并运行已确认的检查。",
				status: "项目和服务可用性在开发工作区实际检测",
				title: "开发工作区服务",
				name: "项目文件、共享 Git 服务与验证进程",
				detail: "模型沿用工作台账户。验证命令、编辑器在每个项目的“项目设置”统一保存；每个开发任务默认只读。",
				publishNotice: "三个必需组件和动作齐全后才能发布。草稿编辑不影响已发布任务；历史版本和代码保留。"
			}),
			requirements: ({ requirementsStatus }) => ({
				description: "在需求工作区澄清问题、整理来源与条目、确认版本并生成需求文档。可由多个岗位引用同一能力；暂不支持复制或与浏览器执行能力混用。",
				status: requirementsStatus?.message ?? "正在读取需求分析配置…",
				title: "需求分析服务",
				name: "工作台模型与需求存储",
				detail: "整理深度、提问节奏和默认模型在同一配置入口保存。配置存在不代表模型实际调用已经通过。",
				configuration: "配置服务",
				publishNotice: "必须保留需求分析服务和动作才可发布。已保存任务与确认版本保留；岗位引用更新后新分析采用新版本。"
			}),
			browser: ({ data }) => ({
				description: "通过 BrowserSkill 在独立浏览器窗口中执行已授权的网页动作。",
				status: data.health.message,
				title: "浏览器环境",
				name: "本机 CLI 与浏览器扩展",
				detail: `${data.health.cliVersion ?? "CLI 版本待检测"} · 环境连接单独管理，不作为可拆卸的组件关联。`,
				publishNotice: "新增动作仅由新版本采用。移除动作会立即限制引用此能力的旧会话，并停止正在使用它的浏览器任务。"
			}),
			"meeting-asr": ({ meetingStatus }) => ({
				description: "使用兼容音频转写接口识别录音。当前仅适配会议纪要助手流程；纪要模型在对话中选择。",
				status: meetingStatus?.ready ? "识别接口已配置 · 待实际调用验证" : meetingStatus?.message ?? "正在读取识别配置…",
				title: "语音识别服务",
				name: "兼容音频转写接口",
				detail: "接口配置独立保存，作用于新转写任务。工作台提供设置存储与纪要模型；凭据不会写入能力版本。",
				configuration: "配置服务",
				publishNotice: "当前会议流程必须保留转写组件和动作。发布新的能力版本不会清除录音、转写、纪要或服务配置；岗位是否采用新版本由下方选择决定。"
			})
		};
		function componentService(component, context) {
			return adapters[component.management](context);
		}
		function ComponentEnvironment({ component, data, meetingStatus, requirementsStatus, onConfigure, disabled = false }) {
			const info = componentService(component, {
				data,
				meetingStatus,
				requirementsStatus
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"data-component-environment": component.management,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: info.title }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: ManagedCapabilities_module_css_default.row,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: info.name }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: info.status }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: info.detail })
					] }), info.configuration && onConfigure && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: ManagedCapabilities_module_css_default.button,
						disabled,
						onClick: onConfigure,
						children: info.configuration
					})]
				})]
			});
		}
		//#endregion
		//#region src/client/ComponentComposition.tsx
		const associationName = (id) => components.find((c) => c.id === id)?.name ?? dependencyName(id);
		function compositionItems(draft, capabilityId) {
			return compositionIds(draft).map((id) => {
				const part = draft.components.find((p) => p.componentId === id);
				return {
					id,
					name: associationName(id),
					icon: components.find((c) => c.id === id)?.icon ?? "support",
					subtitle: part ? `${requiredComponents(capabilityId).some((c) => c.id === id) ? "必需组件" : "业务组件"} · ${part.actions.map((a) => actionNames[a]).join(" · ") || "未选择动作"}` : `必需支持 · ${dependencyUsers(draft, id).map((c) => c.name).join("、")}`
				};
			});
		}
		function compositionLibrary(draft, capabilityId) {
			const business = availableComponents(capabilityId);
			const support = [...new Set(business.flatMap((c) => c.dependencies.filter((id) => id.startsWith("@"))))];
			const needed = supportDependencies(draft);
			return [...business.map((c) => ({
				id: c.id,
				name: c.name,
				icon: c.icon,
				subtitle: `v${c.version} · ${c.sourceLabel}`,
				group: "业务组件"
			})), ...support.map((id) => ({
				id,
				name: dependencyName(id),
				icon: "support",
				subtitle: needed.includes(id) ? missingDependencies(draft).includes(id) ? "缺少关联 · 拖入补回" : "必需支持" : "先添加对应业务组件",
				disabled: !needed.includes(id),
				group: "支持组件"
			}))];
		}
		const compositionKey = (value) => JSON.stringify([
			value.components,
			value.excludedDependencies,
			value.componentOrder
		]);
		function useAssociationEditing(draft, change, capabilityId) {
			const [removing, setRemoving] = (0, react.useState)(null);
			const [undo, setUndo] = (0, react.useState)(null);
			const feedback = undo && undo.after === compositionKey(draft) ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ManagedCapabilities_module_css_default.compositionFeedback,
				role: "status",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
					"已移除 ",
					undo.name,
					" 的关联。"
				] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					className: ManagedCapabilities_module_css_default.button,
					onClick: () => {
						change({
							...draft,
							components: undo.before.components,
							excludedDependencies: undo.before.excludedDependencies,
							componentOrder: undo.before.componentOrder
						});
						setUndo(null);
					},
					children: "撤销移除"
				})]
			}) : null;
			const request = (id) => setRemoving(id);
			return {
				request,
				dialog: removing ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RemoveAssociationDialog, {
					id: removing,
					draft,
					capabilityId,
					onClose: () => setRemoving(null),
					onConfirm: () => {
						const next = removeAssociation(draft, removing);
						setUndo({
							before: structuredClone(draft),
							after: compositionKey(next),
							name: associationName(removing)
						});
						change(next);
						setRemoving(null);
					}
				}) : null,
				feedback
			};
		}
		function RemoveAssociationDialog({ id, draft, capabilityId, onClose, onConfirm }) {
			const users = dependencyUsers(draft, id), required = users.length > 0 || requiredComponents(capabilityId).some((c) => c.id === id);
			const part = draft.components.find((p) => p.componentId === id);
			const actions = [...new Set(users.length ? draft.components.filter((p) => users.some((c) => c.id === p.componentId)).flatMap((p) => p.actions) : part?.actions ?? [])];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal$1, {
				title: `移除 ${associationName(id)} 组件关联？`,
				closeLabel: "取消移除关联",
				onClose,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: `${ManagedCapabilities_module_css_default.page} ${ManagedCapabilities_module_css_default.dialogBody}`,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: ["当前能力：", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: draft.name || "未命名能力" })] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.removalImpact,
							children: [required ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: users.length ? "必需支持组件" : "必需组件" }),
								" · ",
								users.length ? users.map((c) => c.name).join("、") : "当前能力的执行流程",
								"需要此组件。"
							] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "移除后，当前草稿将缺少必需依赖。可以保存草稿，补回后才能发布。" })] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "将从当前草稿移除此业务组件，其不再使用的自动关联也会一并解除。" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: ["涉及动作：", actions.map((a) => actionNames[a]).join("、") || "无已选动作"] })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: ManagedCapabilities_module_css_default.muted,
							children: "本次只修改当前能力草稿。共享插件不会卸载，其他能力、已发布版本和当前会话保持原状。"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: ManagedCapabilities_module_css_default.muted,
							children: "服务配置、凭据和历史处理结果（包括录音、转写及纪要）均保留。"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.confirmActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: ManagedCapabilities_module_css_default.button,
								onClick: onClose,
								children: "取消"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: `${ManagedCapabilities_module_css_default.button} ${ManagedCapabilities_module_css_default.dangerButton}`,
								onClick: onConfirm,
								children: "移除关联"
							})]
						})
					]
				})
			});
		}
		function MissingAssociations({ draft, change, capabilityId, disabled = false }) {
			const missing = missingAssociations(draft, capabilityId);
			return missing.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ManagedCapabilities_module_css_default.missingAssociations,
				role: "status",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [
					"草稿缺少 ",
					missing.length,
					" 个必需组件，暂时无法发布"
				] }), missing.map((id) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: ManagedCapabilities_module_css_default.missingRow,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [associationName(id), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
						" · ",
						dependencyUsers(draft, id).map((c) => c.name).join("、") || "当前能力",
						"需要"
					] })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						className: ManagedCapabilities_module_css_default.button,
						disabled,
						onClick: () => change(addAssociation(draft, id)),
						children: ["补回 ", associationName(id)]
					})]
				}, id))]
			}) : null;
		}
		function SupportInspector({ id, draft, data, change }) {
			const users = dependencyUsers(draft, id), status = data.dependencies?.find((d) => d.id === id);
			const missing = missingDependencies(draft).includes(id);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: dependencyName(id) }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: ManagedCapabilities_module_css_default.muted,
					children: id
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "必需支持组件" }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: ["当前系统：", status?.loaded ? "已加载" : status?.installed ? "已安装，未加载" : status ? "未安装" : "尚未检测"] }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: ["当前能力：", !users.length ? "尚无业务组件需要" : missing ? "缺少关联" : "已关联"] }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
					"由",
					users.map((c) => c.name).join("、") || "对应业务组件",
					"使用。"
				] }),
				users.length > 0 && missing && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					className: ManagedCapabilities_module_css_default.button,
					onClick: () => change(addAssociation(draft, id)),
					children: "补回组件"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: ManagedCapabilities_module_css_default.muted,
					children: "移除当前能力中的关联不会停用共享服务。展示顺序不代表执行顺序。"
				})
			] });
		}
		function BusinessInspector({ component, draft, capabilityId, data, meetingStatus, requirementsStatus, onConfigure, children }) {
			const part = draft.components.find((p) => p.componentId === component.id), info = componentService(component, {
				data,
				meetingStatus,
				requirementsStatus
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: component.name }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
					className: ManagedCapabilities_module_css_default.muted,
					children: [
						component.sourceLabel,
						" · v",
						component.version
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: info.description }),
				requiredComponents(capabilityId).some((c) => c.id === component.id) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: ManagedCapabilities_module_css_default.notice,
					children: "必需组件 · 可从草稿移除，补回组件并选择动作后才能发布。"
				}),
				children ?? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: ["当前动作：", part?.actions.map((a) => actionNames[a]).join("、") || "未选择动作"] }),
				component.dependencies.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "依赖要求" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: ManagedCapabilities_module_css_default.list,
						children: component.dependencies.map((dep) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
							dependencyName(dep),
							" · ",
							dep.startsWith("@") ? missingDependencies(draft).includes(dep) ? "缺少关联" : part ? "已关联" : "待添加" : "运行环境"
						] }, dep))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ManagedCapabilities_module_css_default.muted,
						children: "添加业务组件时自动关联支持组件；缺少必需组件的草稿暂时无法发布。"
					})
				] }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: ManagedCapabilities_module_css_default.muted,
					children: "组件展示顺序不代表执行顺序。配置状态与草稿完整性分别检查。"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComponentEnvironment, {
					component,
					data,
					meetingStatus,
					requirementsStatus,
					onConfigure
				})
			] });
		}
		function ComponentRelations({ data, capabilityId, onEdit, meetingStatus, requirementsStatus, onConfigure }) {
			const cap = data.state.capabilities.find((c) => c.id === capabilityId);
			const { draft, change, dirty, revision, discard } = useCapabilityDefinition(capabilityId, data);
			const edit = useAssociationEditing(draft, change, capabilityId);
			const [inspecting, setInspecting] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false), [message, setMessage] = (0, react.useState)(""), [discarding, setDiscarding] = (0, react.useState)(false);
			const save = async () => {
				setBusy(true);
				setMessage("");
				try {
					await capabilityClient.command({
						type: "capability.save",
						id: capabilityId,
						definition: draft,
						publish: false
					}, revision);
					discard();
					setMessage("草稿已保存。已发布版本保持原状。");
				} catch (error) {
					setMessage(error instanceof Error ? error.message : String(error));
				} finally {
					setBusy(false);
				}
			};
			const referenced = data.state.roles.filter((r) => r.draft.capabilities.some((b) => b.capabilityId === capabilityId) || r.versions.at(-1)?.capabilities.some((b) => b.capabilityId === capabilityId));
			const disabled = busy || !!cap.removedAt || !compositionSupported(data, capabilityId);
			const statusMessage = dirty && message === "草稿已保存。已发布版本保持原状。" ? "有未保存的组件修改" : message || "有未保存的组件修改";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				"aria-label": "关联组件组合",
				children: [
					!compositionSupported(data, capabilityId) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ManagedCapabilities_module_css_default.notice,
						role: "status",
						children: "组件组合服务待更新。请保存当前工作并正常重启工作台后编辑，避免旧服务忽略新的关联配置。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ManagedCapabilities_module_css_default.heading,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "当前组件组合" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", {
							className: ManagedCapabilities_module_css_default.muted,
							children: [
								"草稿 · ",
								compositionIds(draft).length,
								" 个关联 · ",
								referenced.length,
								" 个岗位引用"
							]
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: ManagedCapabilities_module_css_default.button,
							disabled,
							onClick: onEdit,
							children: "编辑组件组合"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ManagedCapabilities_module_css_default.muted,
						children: "拖入和排序可在组合编辑器中完成。移除关联只修改当前能力草稿。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
						className: ManagedCapabilities_module_css_default.compositionFieldset,
						disabled,
						children: [
							edit.feedback,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MissingAssociations, {
								draft,
								change,
								capabilityId,
								disabled
							}),
							compositionItems(draft, capabilityId).map((item) => {
								const business = components.find((c) => c.id === item.id), status = data.dependencies?.find((d) => d.id === (business?.provider ?? item.id));
								const info = business && componentService(business, {
									data,
									meetingStatus,
									requirementsStatus
								});
								const required = requiredComponents(capabilityId).some((c) => c.id === item.id);
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ManagedCapabilities_module_css_default.associationRow,
									"data-association": item.id,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: ManagedCapabilities_module_css_default.associationIdentity,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityGlyph, { kind: item.icon }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: item.name }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: ManagedCapabilities_module_css_default.badge,
												children: business ? required ? "必需组件" : "业务组件" : "必需支持"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: business ? `${business.sourceLabel} · v${business.version}` : item.id }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: item.subtitle }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: info?.status ?? `${status?.pendingRestart ? "待重启" : status?.loaded ? "系统已加载" : status?.installed ? "系统已安装" : status ? "系统未安装" : "状态待检测"}${status?.version ? ` · ${status.version}` : ""}` })
										] })]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: ManagedCapabilities_module_css_default.associationActions,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: ManagedCapabilities_module_css_default.button,
												onClick: () => business && !business.pluginModule ? setInspecting(business) : openCapabilityLink({
													section: "plugins",
													moduleName: business?.pluginModule ?? item.id,
													capabilityId
												}),
												children: business && !business.pluginModule ? "查看详情" : "查看组件 ↗"
											}),
											info?.configuration && onConfigure && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: ManagedCapabilities_module_css_default.button,
												onClick: onConfigure,
												children: info.configuration
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: `${ManagedCapabilities_module_css_default.iconButton} ${ManagedCapabilities_module_css_default.removeAction}`,
												title: `移除关联：${item.name}`,
												"aria-label": `移除关联：${item.name}`,
												onClick: () => edit.request(item.id),
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityActionIcon, { kind: "remove" })
											})
										]
									})]
								}, item.id);
							}),
							!draft.components.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ManagedCapabilities_module_css_default.empty,
								children: "当前草稿没有业务组件。打开组合编辑器，拖入组件开始组合。"
							})
						]
					}),
					(dirty || message) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ManagedCapabilities_module_css_default.compositionToolbar,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							role: "status",
							children: statusMessage
						}), dirty && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.actions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: ManagedCapabilities_module_css_default.button,
								disabled,
								onClick: () => setDiscarding(true),
								children: "放弃修改"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: `${ManagedCapabilities_module_css_default.button} ${ManagedCapabilities_module_css_default.primary}`,
								disabled,
								onClick: () => void save(),
								children: busy ? "保存中…" : "保存草稿"
							})]
						})]
					}),
					dirty && revision !== data.state.revision && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ManagedCapabilities_module_css_default.error,
						children: "配置已在其他页面变化。当前草稿保留；请在组合编辑器核对最新配置后再保存。"
					}),
					availableComponents(capabilityId).filter((c, i, all) => all.findIndex((other) => other.management === c.management) === i).map((component) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComponentEnvironment, {
						component,
						data,
						meetingStatus,
						requirementsStatus,
						onConfigure,
						disabled: !!cap.removedAt
					}, component.id)),
					inspecting && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal$1, {
						title: "组件详情",
						closeLabel: "关闭组件详情",
						onClose: () => setInspecting(null),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: `${ManagedCapabilities_module_css_default.page} ${ManagedCapabilities_module_css_default.dialogBody}`,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BusinessInspector, {
								component: inspecting,
								draft,
								capabilityId,
								data,
								meetingStatus,
								requirementsStatus,
								onConfigure: onConfigure ? () => {
									setInspecting(null);
									onConfigure();
								} : void 0
							})
						})
					}),
					edit.dialog,
					discarding && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal$1, {
						title: "放弃本次组件修改？",
						closeLabel: "继续编辑",
						onClose: () => setDiscarding(false),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `${ManagedCapabilities_module_css_default.page} ${ManagedCapabilities_module_css_default.dialogBody}`,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "将恢复至上次保存的能力草稿，包括本次未保存的名称、说明和组件调整。" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ManagedCapabilities_module_css_default.confirmActions,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: ManagedCapabilities_module_css_default.button,
									onClick: () => setDiscarding(false),
									children: "继续编辑"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: ManagedCapabilities_module_css_default.button,
									onClick: () => {
										discard();
										setMessage("");
										setDiscarding(false);
									},
									children: "放弃修改"
								})]
							})]
						})
					})
				]
			});
		}
		//#endregion
		//#region src/client/RoleAppearance.tsx
		const roleIconOptions = [
			{
				id: "analyst",
				name: "需求清单"
			},
			{
				id: "chart",
				name: "数据分析"
			},
			{
				id: "marketing",
				name: "市场推广"
			},
			{
				id: "manager",
				name: "项目计划"
			},
			{
				id: "developer",
				name: "开发编程"
			},
			{
				id: "browser",
				name: "网页浏览"
			},
			{
				id: "book",
				name: "知识资料"
			},
			{
				id: "document",
				name: "文档写作"
			},
			{
				id: "search",
				name: "资料检索"
			},
			{
				id: "support",
				name: "客户服务"
			},
			{
				id: "briefcase",
				name: "业务工作"
			},
			{
				id: "idea",
				name: "创意构思"
			},
			{
				id: "chat",
				name: "自由交流"
			}
		];
		function roleAppearanceDefaults(roleId) {
			if (roleId === "meeting-minutes-demo") return {
				color: "#6683bd",
				icon: {
					kind: "builtin",
					id: "document"
				}
			};
			const id = roleId === "chat" ? "chat" : roleIds.find((id) => roleId === `builtin-${id}`) ?? "analyst";
			return {
				color: id === "chat" ? "#78869f" : roleCatalog[id].color,
				icon: {
					kind: "builtin",
					id
				}
			};
		}
		function roleAppearanceIconId(roleId, icon) {
			if (icon?.kind === "png") return "png";
			if (icon?.kind === "builtin" && roleIconOptions.some((option) => option.id === icon.id)) return icon.id;
			return roleAppearanceDefaults(roleId).icon.id;
		}
		function appearanceStyle(color) {
			const rgb = /^#[0-9a-f]{6}$/i.test(color) ? [
				1,
				3,
				5
			].map((i) => parseInt(color.slice(i, i + 2), 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4) : [
				0,
				0,
				0
			];
			return {
				"--role-color": color,
				"--role-on-color": .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2] > .179 ? "#111111" : "#ffffff"
			};
		}
		function Glyph({ id }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.6",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				children: {
					analyst: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "5",
						y: "5",
						width: "14",
						height: "16",
						rx: "2"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M9 5V3h6v2M9 10h6M9 14h6M9 18h3" })] }),
					marketing: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4 10h4l11-5v14L8 14H4zM8 14l2 6H6l-2-6M22 10v4" }),
					manager: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "3",
						y: "5",
						width: "18",
						height: "16",
						rx: "2"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M7 3v4M17 3v4M3 10h18M7 15l2 2 4-4M16 15h2" })] }),
					developer: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m7 7-5 5 5 5M17 7l5 5-5 5M14 4l-4 16" }),
					chat: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M20 11.5a8 8 0 0 1-8 8H5l-3 2V11.5a9 9 0 0 1 18 0Z" }),
					chart: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 3v18h18M8 16v-5M13 16V7M18 16v-8" }) }),
					book: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12 5C9 3 6 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1ZM12 5v15" }) }),
					document: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9ZM14 3v6h6M8 13h8M8 17h5" }) }),
					search: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "10.5",
						cy: "10.5",
						r: "6.5"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m16 16 5 5" })] }),
					support: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4 14v-3a8 8 0 0 1 16 0v6a4 4 0 0 1-4 4h-3" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
							x: "3",
							y: "11",
							width: "4",
							height: "7",
							rx: "2"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
							x: "17",
							y: "11",
							width: "4",
							height: "7",
							rx: "2"
						})
					] }),
					briefcase: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "3",
						y: "7",
						width: "18",
						height: "14",
						rx: "2"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 7V3h8v4M8 7v14M16 7v14" })] }),
					idea: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M9 18v-2c0-2-4-3-4-7a7 7 0 0 1 14 0c0 4-4 5-4 7v2M9 18h6M10 22h4" }) }),
					browser: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
							cx: "12",
							cy: "12",
							r: "9"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ellipse", {
							cx: "12",
							cy: "12",
							rx: "4",
							ry: "9"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 12h18" })
					] })
				}[id]
			});
		}
		/** All role surfaces share the same fallback and never tint custom PNG pixels. */
		function RoleAppearanceIcon({ roleId, icon, color, className }) {
			const [failedImage, setFailedImage] = (0, react.useState)(null);
			const asset = icon?.kind === "png" && /^[a-f0-9]{64}$/.test(icon.assetId) ? icon.assetId : void 0;
			const id = roleAppearanceIconId(roleId, icon);
			const fallback = roleAppearanceDefaults(roleId).icon.id;
			const showImage = asset !== void 0 && !(failedImage?.assetId === asset && failedImage.icon === icon);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: `${Roles_module_css_default.icon} ${className ?? ""}`,
				style: appearanceStyle(color),
				"data-role-appearance-icon": showImage ? "png" : id === "png" ? fallback : id,
				"aria-hidden": "true",
				children: showImage ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
					src: `/api/capabilities/icons/${asset}`,
					alt: "",
					onError: () => setFailedImage({
						assetId: asset,
						icon
					})
				}, asset) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Glyph, { id: id === "png" ? fallback : id })
			});
		}
		//#endregion
		//#region src/client/appearance-color.ts
		/** A fixed honeycomb keeps familiar choices in the same position while HEX remains unrestricted. */
		const appearancePalette = [
			[
				"#dd5376",
				"#e58a32",
				"#d9aa3c",
				"#91ac43"
			],
			[
				"#b74f82",
				"#ea6e78",
				"#eea668",
				"#d4bf65",
				"#5baf69"
			],
			[
				"#9a62d8",
				"#c77ebb",
				"#e7a1b1",
				"#dfc196",
				"#a8c587",
				"#22a58b"
			],
			[
				"#704cbd",
				"#a297d8",
				"#a8b6df",
				"#78869f",
				"#85bbb8",
				"#57b7a8",
				"#238e89"
			],
			[
				"#576bc4",
				"#7298de",
				"#a6c8e5",
				"#c3d9df",
				"#68b5c9",
				"#2597b3"
			],
			[
				"#4263ba",
				"#4f73e8",
				"#528ebc",
				"#467d93",
				"#4c697f"
			],
			[
				"#344575",
				"#344052",
				"#72808f",
				"#b3bac4"
			]
		];
		function normalizeHex(input) {
			const value = input.trim().replace(/^#/, "");
			if (/^[\da-f]{3}$/i.test(value)) return `#${[...value].map((char) => char + char).join("").toLowerCase()}`;
			if (/^[\da-f]{6}$/i.test(value)) return `#${value.toLowerCase()}`;
		}
		function hexToHsl(hex) {
			const value = normalizeHex(hex) ?? "#78869f";
			const [r, g, b] = [
				1,
				3,
				5
			].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
			const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
			const lightness = (max + min) / 2;
			const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
			let hue = delta === 0 ? 0 : max === r ? (g - b) / delta % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
			hue = (hue * 60 + 360) % 360;
			return {
				hue,
				saturation: saturation * 100,
				lightness: lightness * 100
			};
		}
		function hslToHex(hue, saturation, lightness) {
			const l = Math.max(0, Math.min(100, lightness)) / 100, s = Math.max(0, Math.min(100, saturation)) / 100;
			const c = (1 - Math.abs(2 * l - 1)) * s, h = (hue % 360 + 360) % 360 / 60;
			const x = c * (1 - Math.abs(h % 2 - 1)), m = l - c / 2;
			return `#${(h < 1 ? [
				c,
				x,
				0
			] : h < 2 ? [
				x,
				c,
				0
			] : h < 3 ? [
				0,
				c,
				x
			] : h < 4 ? [
				0,
				x,
				c
			] : h < 5 ? [
				x,
				0,
				c
			] : [
				c,
				0,
				x
			]).map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("")}`;
		}
		function swatchInk(hex) {
			const value = normalizeHex(hex) ?? "#78869f";
			const linear = [
				1,
				3,
				5
			].map((index) => parseInt(value.slice(index, index + 2), 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
			return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722 > .179 ? "#172236" : "#ffffff";
		}
		const centeredImage = {
			scale: 1,
			x: 0,
			y: 0
		};
		function validateRoleIconFile(file) {
			if (!file.size) throw new Error("图片为空，请重新选择 PNG。");
			if (file.size > 2097152) throw new Error("PNG 图片不能超过 2 MB。");
			if (file.type !== "image/png" && !(file.type === "" && /\.png$/i.test(file.name))) throw new Error("请选择 PNG 格式的图片。");
		}
		async function loadRoleIconFile(file) {
			validateRoleIconFile(file);
			const dataUrl = await new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(String(reader.result));
				reader.onerror = () => reject(/* @__PURE__ */ new Error("图片读取失败，请重新选择。"));
				reader.onabort = () => reject(/* @__PURE__ */ new Error("图片读取已取消。"));
				reader.readAsDataURL(file);
			});
			const bytes = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
			if (![
				137,
				80,
				78,
				71,
				13,
				10,
				26,
				10
			].every((byte, index) => bytes.charCodeAt(index) === byte)) throw new Error("图片内容不是有效的 PNG，请重新选择。");
			if (bytes.length < 24) throw new Error("PNG 文件不完整。");
			const view = new DataView(new Uint8Array([...bytes.slice(0, 24)].map((char) => char.charCodeAt(0))).buffer);
			if (view.getUint32(8) !== 13 || bytes.slice(12, 16) !== "IHDR") throw new Error("PNG 图片头无效。");
			validateDimensions(view.getUint32(16), view.getUint32(20));
			return new Promise((resolve, reject) => {
				const image = new Image();
				image.onload = () => {
					try {
						validateDimensions(image.naturalWidth, image.naturalHeight);
						resolve(image);
					} catch (error) {
						reject(error);
					}
				};
				image.onerror = () => reject(/* @__PURE__ */ new Error("无法打开这张 PNG，请选择其他图片。"));
				image.src = dataUrl;
			});
		}
		async function loadSavedRoleIcon(assetId) {
			if (!/^[a-f0-9]{64}$/.test(assetId)) throw new Error("当前图片引用无效，请重新选择 PNG。");
			const response = await fetch(`/api/capabilities/icons/${assetId}`, { credentials: "same-origin" });
			if (!response.ok) throw new Error("当前图片无法读取，请重新选择 PNG。");
			const blob = await response.blob();
			return loadRoleIconFile(new File([blob], "role-icon.png", { type: "image/png" }));
		}
		function validateDimensions(width, height) {
			if (!width || !height || width > 4096 || height > 4096) throw new Error("图片尺寸需在 1 到 4096 像素之间。");
		}
		/** Contain at 100%; transformations are measured against the final square, not source pixels. */
		function imageDrawRect(width, height, adjustment, size = 256) {
			if (width <= 0 || height <= 0 || !Number.isFinite(width + height)) throw new Error("图片尺寸无效。");
			const scale = Math.min(size / width, size / height) * Math.max(.5, Math.min(2, adjustment.scale));
			const w = width * scale, h = height * scale;
			return {
				x: (size - w) / 2 + Math.max(-50, Math.min(50, adjustment.x)) / 100 * size,
				y: (size - h) / 2 + Math.max(-50, Math.min(50, adjustment.y)) / 100 * size,
				width: w,
				height: h
			};
		}
		function renderRoleIcon(image, adjustment) {
			const canvas = document.createElement("canvas");
			canvas.width = canvas.height = 256;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("当前环境无法处理图片，请使用推荐图标。");
			const rect = imageDrawRect(image.naturalWidth, image.naturalHeight, adjustment);
			context.clearRect(0, 0, 256, 256);
			context.imageSmoothingEnabled = true;
			context.imageSmoothingQuality = "high";
			context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
			return canvas.toDataURL("image/png");
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-client-ui-plain-chat/src/client/RoleAppearanceEditor.module.css.mjs
		const css$5 = ".UhGNxW_editor{border:1px solid var(--role-border);background:var(--role-bg);border-radius:12px;min-width:0;overflow:hidden;container-type:inline-size}.UhGNxW_summary{cursor:pointer;min-height:48px;color:var(--role-text);align-items:center;gap:10px;padding:0 15px;font-size:13px;font-weight:550;list-style:none;display:flex}.UhGNxW_summary::-webkit-details-marker{display:none}.UhGNxW_chevron{font-size:21px;font-weight:400;transition:transform .15s}.UhGNxW_editor[open]>.UhGNxW_summary .UhGNxW_chevron{transform:rotate(90deg)}.UhGNxW_editor[open]>.UhGNxW_summary{border-bottom:1px solid var(--role-border)}.UhGNxW_summaryColor,.UhGNxW_colorSample{border:1px solid #7d879333;border-radius:6px;flex-shrink:0;width:18px;height:18px}.UhGNxW_summaryColor{margin-left:auto}.UhGNxW_summary .UhGNxW_summaryIcon{border-radius:7px;width:26px;height:26px}.UhGNxW_summary .UhGNxW_summaryIcon svg{width:16px;height:16px}.UhGNxW_layout{grid-template-columns:minmax(220px,1fr) minmax(210px,.85fr);gap:24px;padding:20px;display:grid}.UhGNxW_controls{min-width:0}.UhGNxW_editor h4{color:var(--role-text);margin:0;font-size:13px;font-weight:600}.UhGNxW_sectionHeading{justify-content:space-between;align-items:center;gap:10px;display:flex}.UhGNxW_sectionHeading>span{color:var(--role-muted);font-size:11px}.UhGNxW_honeycomb{flex-direction:column;align-items:center;padding:15px 0 10px;display:flex}.UhGNxW_hexRow{gap:3px;display:flex}.UhGNxW_hexRow+.UhGNxW_hexRow{margin-top:-5px}.UhGNxW_swatch{clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);cursor:pointer;border:0;place-items:center;width:32px;height:37px;padding:7px;transition:filter .15s;display:grid}.UhGNxW_swatch svg{fill:none;stroke:currentColor;stroke-width:3px;stroke-linecap:round;stroke-linejoin:round;width:19px;height:19px}.UhGNxW_swatch:hover{filter:brightness(1.14)}.UhGNxW_swatch[aria-pressed=true]{z-index:1;position:relative}.UhGNxW_swatch[aria-pressed=true]:after{content:\"\";clip-path:inherit;opacity:.12;background:currentColor;position:absolute;inset:2px}.UhGNxW_swatch:focus-visible{filter:brightness(.7);outline:0}.UhGNxW_rangeLabel{color:var(--role-text);flex-direction:column;gap:6px;margin:9px 0 13px;font-size:12px;font-weight:400;display:flex}.UhGNxW_rangeLabel>span{justify-content:space-between;gap:10px;display:flex}.UhGNxW_rangeLabel output{color:var(--role-muted)}.UhGNxW_editor .UhGNxW_rangeLabel input{width:100%;height:18px;accent-color:var(--role-accent);cursor:pointer;background:0 0;margin:0;padding:0}.UhGNxW_hexLabel{border:1px solid var(--role-border);color:var(--role-muted);border-radius:8px;align-items:center;gap:10px;padding:5px 10px;font-size:12px;display:flex}.UhGNxW_editor .UhGNxW_hexLabel input{width:auto;min-width:0;color:var(--role-text);background:0 0;border:0;flex:1;padding:5px 0;font:12px ui-monospace,monospace}.UhGNxW_hexLabel:focus-within{outline:2px solid var(--role-accent);outline-offset:2px}.UhGNxW_hexLabel input:focus{outline:0}.UhGNxW_iconSection{margin-top:23px}.UhGNxW_tabs{border-bottom:1px solid var(--role-border);gap:3px;margin:10px 0 12px;display:flex}.UhGNxW_tabs button{color:var(--role-muted);cursor:pointer;font:inherit;background:0 0;border:0;border-bottom:2px solid #0000;flex:1;padding:9px 5px;font-size:12px}.UhGNxW_tabs button[aria-selected=true]{color:var(--role-accent);border-bottom-color:var(--role-accent);font-weight:550}.UhGNxW_iconGrid{grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:7px;display:grid}.UhGNxW_iconGrid button{border:1px solid var(--role-border);min-width:0;color:var(--role-text);cursor:pointer;font:inherit;background:0 0;border-radius:9px;flex-direction:column;align-items:center;gap:5px;padding:8px 3px;font-size:10px;display:flex;position:relative}.UhGNxW_iconGrid button>span:first-child{background:0 0;border-radius:7px;width:28px;height:28px}.UhGNxW_iconGrid button svg{width:20px;height:20px}.UhGNxW_iconGrid button[aria-pressed=true]{background:color-mix(in srgb,var(--role-accent) 9%,var(--role-bg));border-color:var(--role-accent);box-shadow:inset 0 0 0 1px var(--role-accent)}.UhGNxW_iconCheck{color:var(--role-accent);font-size:9px;position:absolute;top:2px;right:4px}.UhGNxW_fileInput{opacity:0;pointer-events:none;width:1px;height:1px;position:absolute}.UhGNxW_uploadButton{border:1px dashed var(--role-border);width:100%;color:var(--role-accent);background:color-mix(in srgb,var(--role-accent) 3%,var(--role-bg));font:inherit;cursor:pointer;border-radius:9px;justify-content:center;align-items:center;gap:8px;padding:13px 8px;font-size:12px;display:flex}.UhGNxW_uploadButton>span{font-size:20px}.UhGNxW_editor .UhGNxW_help{color:var(--role-muted);margin:9px 0 0;font-size:11px;font-weight:400;line-height:1.7}.UhGNxW_imageStage{border:1px solid var(--role-border);background-color:var(--role-bg);background-image:conic-gradient(color-mix(in srgb,var(--role-muted) 15%,transparent) 25%,transparent 0 50%,color-mix(in srgb,var(--role-muted) 15%,transparent) 0 75%,transparent 0);background-size:16px 16px;border-radius:10px;width:144px;height:144px;margin:15px auto;overflow:hidden}.UhGNxW_imageStage img{object-fit:contain;width:100%;height:100%}.UhGNxW_imageActions,.UhGNxW_footer{flex-wrap:wrap;justify-content:space-between;gap:8px;display:flex}.UhGNxW_imageActions button,.UhGNxW_footer button{border:1px solid var(--role-border);background:var(--role-bg);color:var(--role-text);cursor:pointer;font:inherit;border-radius:7px;padding:8px 10px;font-size:11px}.UhGNxW_imageActions .UhGNxW_applyButton{color:#fff;background:var(--role-accent);border-color:var(--role-accent)}.UhGNxW_imageActions button:disabled{opacity:.55;cursor:default}.UhGNxW_editor .UhGNxW_error{color:var(--dsw-alias-label-error,#b33c42);background:color-mix(in srgb,#b33c42 8%,var(--role-bg));border-radius:7px;margin:10px 0 0;padding:8px;font-size:12px;line-height:1.6}.UhGNxW_previews{border:1px solid var(--role-border);background:color-mix(in srgb,var(--role-muted) 3%,var(--role-bg));border-radius:12px;flex-direction:column;align-self:start;gap:12px;min-width:0;padding:16px;display:flex}.UhGNxW_previewCaption{color:var(--role-muted);margin:5px 0 -5px;font-size:11px}.UhGNxW_previewCard{border:1px solid color-mix(in srgb,var(--role-color) 40%,var(--role-border));border-top:4px solid var(--role-color);background:linear-gradient(135deg,color-mix(in srgb,var(--role-color) 18%,var(--role-bg)),color-mix(in srgb,var(--role-color) 6%,var(--role-bg)));border-radius:10px;padding:16px}.UhGNxW_previewCardTop{justify-content:space-between;align-items:center;gap:8px;margin-bottom:14px;display:flex}.UhGNxW_previewBadge{color:color-mix(in srgb,var(--role-color) 45%,var(--role-text));background:color-mix(in srgb,var(--role-color) 12%,var(--role-bg));border-radius:5px;padding:3px 6px;font-size:10px}.UhGNxW_previewCard>strong{color:var(--role-text);overflow-wrap:anywhere;font-size:15px}.UhGNxW_editor .UhGNxW_previewCard p{-webkit-line-clamp:3;color:var(--role-muted);overflow-wrap:anywhere;-webkit-box-orient:vertical;margin:8px 0 14px;font-size:12px;line-height:1.8;display:-webkit-box;overflow:hidden}.UhGNxW_previewSelected{border-top:1px solid color-mix(in srgb,var(--role-color) 25%,var(--role-border));color:color-mix(in srgb,var(--role-color) 55%,var(--role-text));padding-top:10px;font-size:11px}.UhGNxW_toolbarPreview,.UhGNxW_choicePreview{color:var(--role-text);background:var(--role-bg);border:1px solid color-mix(in srgb,var(--role-color) 40%,var(--role-border));align-items:center;gap:8px;padding:8px;display:flex}.UhGNxW_toolbarPreview{box-sizing:border-box;border-radius:24px;align-self:flex-start;max-width:100%;padding-right:12px}.UhGNxW_toolbarPreview strong,.UhGNxW_choicePreview strong{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:12px;font-weight:550;overflow:hidden}.UhGNxW_choicePreview{border-radius:9px}.UhGNxW_choicePreview strong{flex:1}.UhGNxW_previewCheck{color:color-mix(in srgb,var(--role-color) 65%,var(--role-text))}.UhGNxW_localIcon{background:color-mix(in srgb,var(--role-color) 20%,var(--role-bg));border-radius:11px;flex-shrink:0;justify-content:center;align-items:center;width:42px;height:42px;display:inline-flex}.UhGNxW_localIcon img{box-sizing:border-box;object-fit:contain;width:100%;height:100%;padding:4px}.UhGNxW_previews .UhGNxW_smallIcon{border-radius:8px;width:28px;height:28px}.UhGNxW_previews .UhGNxW_smallIcon svg{width:18px;height:18px}.UhGNxW_previews .UhGNxW_smallIcon img{padding:2px}.UhGNxW_footer{border-top:1px solid var(--role-border);justify-content:flex-start;padding:12px 20px}.UhGNxW_footer button{color:var(--role-muted);background:0 0}.UhGNxW_editor button:focus-visible,.UhGNxW_summary:focus-visible{outline:2px solid var(--role-accent);outline-offset:2px}@container (width<=590px){.UhGNxW_layout{grid-template-columns:1fr;gap:18px;padding:15px}.UhGNxW_controls{grid-template-columns:minmax(220px,1fr) minmax(190px,1fr);align-items:start;gap:22px;display:grid}.UhGNxW_iconSection{margin-top:0}}@container (width<=460px){.UhGNxW_controls{display:block}.UhGNxW_iconSection{margin-top:23px}.UhGNxW_layout{padding:12px}.UhGNxW_previews{padding:13px}.UhGNxW_footer{padding:12px}}@container (width<=280px){.UhGNxW_swatch{width:27px;height:31px;padding:5px}.UhGNxW_hexRow{gap:2px}.UhGNxW_hexRow+.UhGNxW_hexRow{margin-top:-4px}}@media (prefers-reduced-motion:reduce){.UhGNxW_chevron,.UhGNxW_swatch{transition:none}}";
		const tagId$5 = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/RoleAppearanceEditor.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$5) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId$5;
			tag.textContent = css$5;
			document.head.appendChild(tag);
		}
		var RoleAppearanceEditor_module_css_default = {
			"applyButton": "UhGNxW_applyButton",
			"chevron": "UhGNxW_chevron",
			"choicePreview": "UhGNxW_choicePreview",
			"colorSample": "UhGNxW_colorSample",
			"controls": "UhGNxW_controls",
			"editor": "UhGNxW_editor",
			"error": "UhGNxW_error",
			"fileInput": "UhGNxW_fileInput",
			"footer": "UhGNxW_footer",
			"help": "UhGNxW_help",
			"hexLabel": "UhGNxW_hexLabel",
			"hexRow": "UhGNxW_hexRow",
			"honeycomb": "UhGNxW_honeycomb",
			"iconCheck": "UhGNxW_iconCheck",
			"iconGrid": "UhGNxW_iconGrid",
			"iconSection": "UhGNxW_iconSection",
			"imageActions": "UhGNxW_imageActions",
			"imageStage": "UhGNxW_imageStage",
			"layout": "UhGNxW_layout",
			"localIcon": "UhGNxW_localIcon",
			"previewBadge": "UhGNxW_previewBadge",
			"previewCaption": "UhGNxW_previewCaption",
			"previewCard": "UhGNxW_previewCard",
			"previewCardTop": "UhGNxW_previewCardTop",
			"previewCheck": "UhGNxW_previewCheck",
			"previewSelected": "UhGNxW_previewSelected",
			"previews": "UhGNxW_previews",
			"rangeLabel": "UhGNxW_rangeLabel",
			"sectionHeading": "UhGNxW_sectionHeading",
			"smallIcon": "UhGNxW_smallIcon",
			"summary": "UhGNxW_summary",
			"summaryColor": "UhGNxW_summaryColor",
			"summaryIcon": "UhGNxW_summaryIcon",
			"swatch": "UhGNxW_swatch",
			"tabs": "UhGNxW_tabs",
			"toolbarPreview": "UhGNxW_toolbarPreview",
			"uploadButton": "UhGNxW_uploadButton"
		};
		//#endregion
		//#region src/client/RoleAppearanceEditor.tsx
		function RoleAppearanceEditor({ roleId, value, initialAppearance, onChange, onBusyChange }) {
			const uid = (0, react.useId)(), [tab, setTab] = (0, react.useState)(value.icon?.kind === "png" ? "png" : "builtin");
			const [hex, setHex] = (0, react.useState)(value.color), [source, setSource] = (0, react.useState)(null);
			const [adjustment, setAdjustment] = (0, react.useState)({ ...centeredImage }), [preview, setPreview] = (0, react.useState)("");
			const [dirty, setDirty] = (0, react.useState)(false), [working, setWorking] = (0, react.useState)(null), [error, setError] = (0, react.useState)("");
			const fileInput = (0, react.useRef)(null), generation = (0, react.useRef)(0), mounted = (0, react.useRef)(true);
			const current = (0, react.useRef)({
				value,
				onChange,
				onBusyChange
			});
			current.current = {
				value,
				onChange,
				onBusyChange
			};
			const lastColor = (0, react.useRef)(value.color), hue = (0, react.useRef)(hexToHsl(value.color));
			const invalidHex = normalizeHex(hex) === void 0, pending = !!working || dirty || invalidHex;
			(0, react.useEffect)(() => {
				if (lastColor.current !== value.color) {
					lastColor.current = value.color;
					hue.current = hexToHsl(value.color);
					setHex(value.color);
				}
			}, [value.color]);
			(0, react.useEffect)(() => {
				current.current.onBusyChange?.(pending);
			}, [pending]);
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
					generation.current++;
					current.current.onBusyChange?.(false);
				};
			}, []);
			const color = normalizeHex(value.color) ?? "#78869f";
			const changeColor = (next, rebase = true) => {
				lastColor.current = next;
				if (rebase) hue.current = hexToHsl(next);
				setHex(next);
				current.current.onChange({
					color: next,
					icon: current.current.value.icon
				});
			};
			const discardImage = () => {
				generation.current++;
				setSource(null);
				setPreview("");
				setDirty(false);
				setWorking(null);
				setError("");
				setAdjustment({ ...centeredImage });
				if (fileInput.current) fileInput.current.value = "";
			};
			const reset = (appearance) => {
				discardImage();
				setTab(appearance.icon?.kind === "png" ? "png" : "builtin");
				lastColor.current = appearance.color;
				hue.current = hexToHsl(appearance.color);
				setHex(appearance.color);
				onChange({
					color: appearance.color,
					icon: appearance.icon
				});
			};
			const chooseIcon = (icon) => {
				discardImage();
				onChange({
					color: current.current.value.color,
					icon
				});
			};
			const loadImage = async (load) => {
				const token = ++generation.current;
				setWorking("read");
				setError("");
				setSource(null);
				setPreview("");
				setDirty(false);
				try {
					const image = await load();
					if (!mounted.current || generation.current !== token) return;
					const result = renderRoleIcon(image, centeredImage);
					setSource(image);
					setAdjustment({ ...centeredImage });
					setPreview(result);
					setDirty(true);
				} catch (reason) {
					if (mounted.current && generation.current === token) setError(reason instanceof Error ? reason.message : "图片处理失败，请重试。");
				} finally {
					if (mounted.current && generation.current === token) setWorking(null);
				}
			};
			const adjust = (next) => {
				if (!source) return;
				generation.current++;
				setWorking(null);
				setError("");
				try {
					setPreview(renderRoleIcon(source, next));
					setAdjustment(next);
					setDirty(true);
				} catch (reason) {
					setError(reason instanceof Error ? reason.message : "图片处理失败。");
				}
			};
			const applyImage = async () => {
				if (!preview || !dirty || working) return;
				const token = ++generation.current, dataUrl = preview;
				setWorking("upload");
				setError("");
				try {
					const assetId = await capabilityClient.uploadRoleIcon(dataUrl);
					if (!mounted.current || generation.current !== token) return;
					current.current.onChange({
						color: current.current.value.color,
						icon: {
							kind: "png",
							assetId
						}
					});
					setDirty(false);
				} catch (reason) {
					if (mounted.current && generation.current === token) setError(reason instanceof Error ? reason.message : "图片保存失败，请重试。");
				} finally {
					if (mounted.current && generation.current === token) setWorking(null);
				}
			};
			const changeTab = (next) => {
				if (tab !== next) {
					discardImage();
					setTab(next);
				}
			};
			const selectedIcon = roleAppearanceIconId(roleId, value.icon);
			const PreviewIcon = ({ className = "" }) => preview && tab === "png" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: `${RoleAppearanceEditor_module_css_default.localIcon} ${className}`,
				style: appearanceStyle(color),
				"data-role-appearance-icon": "png",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
					src: preview,
					alt: ""
				})
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleAppearanceIcon, {
				roleId,
				icon: value.icon,
				color,
				className
			});
			const name = value.name.trim() || "未命名岗位助手";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: RoleAppearanceEditor_module_css_default.editor,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
						className: RoleAppearanceEditor_module_css_default.summary,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: RoleAppearanceEditor_module_css_default.chevron,
								"aria-hidden": "true",
								children: "›"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "外观与配色" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: RoleAppearanceEditor_module_css_default.summaryColor,
								style: { background: color },
								"aria-label": `主题色 ${color}`
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleAppearanceIcon, {
								roleId,
								icon: value.icon,
								color,
								className: RoleAppearanceEditor_module_css_default.summaryIcon
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RoleAppearanceEditor_module_css_default.layout,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: RoleAppearanceEditor_module_css_default.controls,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								className: RoleAppearanceEditor_module_css_default.colorSection,
								"aria-label": "岗位主题色",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: RoleAppearanceEditor_module_css_default.sectionHeading,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "主题颜色" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "点选六角色块" })]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: RoleAppearanceEditor_module_css_default.honeycomb,
										role: "group",
										"aria-label": "六角颜色盘",
										children: appearancePalette.map((row, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: RoleAppearanceEditor_module_css_default.hexRow,
											children: row.map((swatch) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: RoleAppearanceEditor_module_css_default.swatch,
												title: swatch.toUpperCase(),
												"aria-label": `主题色 ${swatch}`,
												"aria-pressed": color === swatch,
												style: {
													background: swatch,
													color: swatchInk(swatch)
												},
												onClick: () => changeColor(swatch),
												children: color === swatch && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
													viewBox: "0 0 24 24",
													"aria-hidden": "true",
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m6 12 4 4 8-8" })
												})
											}, swatch))
										}, index))
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: RoleAppearanceEditor_module_css_default.rangeLabel,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["明暗 ", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("output", { children: [Math.round(hexToHsl(color).lightness), "%"] })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "range",
											min: "0",
											max: "100",
											step: "1",
											"aria-label": "主题色明暗",
											value: Math.round(hexToHsl(color).lightness),
											onChange: (event) => changeColor(hslToHex(hue.current.hue, hue.current.saturation, Number(event.target.value)), false)
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: RoleAppearanceEditor_module_css_default.hexLabel,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "HEX" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: RoleAppearanceEditor_module_css_default.colorSample,
												style: { background: color }
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												"aria-label": "HEX 色值",
												value: hex,
												maxLength: 7,
												spellCheck: false,
												"aria-invalid": invalidHex,
												onChange: (event) => {
													const text = event.target.value;
													setHex(text);
													const normalized = normalizeHex(text);
													if (normalized) {
														lastColor.current = normalized;
														hue.current = hexToHsl(normalized);
														onChange({
															color: normalized,
															icon: current.current.value.icon
														});
													}
												},
												onBlur: () => setHex(color)
											})
										]
									}),
									invalidHex && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: RoleAppearanceEditor_module_css_default.help,
										children: "请输入 3 位或 6 位十六进制色值，例如 #4263BA。"
									})
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								className: RoleAppearanceEditor_module_css_default.iconSection,
								"aria-label": "岗位图标",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "岗位图标" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: RoleAppearanceEditor_module_css_default.tabs,
										role: "tablist",
										"aria-label": "图标来源",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											role: "tab",
											id: `${uid}-builtin-tab`,
											"aria-controls": `${uid}-builtin-panel`,
											"aria-selected": tab === "builtin",
											onClick: () => changeTab("builtin"),
											children: "推荐图标"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											role: "tab",
											id: `${uid}-png-tab`,
											"aria-controls": `${uid}-png-panel`,
											"aria-selected": tab === "png",
											onClick: () => changeTab("png"),
											children: "自定义 PNG"
										})]
									}),
									tab === "builtin" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										id: `${uid}-builtin-panel`,
										role: "tabpanel",
										"aria-labelledby": `${uid}-builtin-tab`,
										className: RoleAppearanceEditor_module_css_default.iconGrid,
										children: roleIconOptions.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											title: option.name,
											"aria-label": `图标：${option.name}`,
											"aria-pressed": selectedIcon === option.id,
											onClick: () => chooseIcon({
												kind: "builtin",
												id: option.id
											}),
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleAppearanceIcon, {
													icon: {
														kind: "builtin",
														id: option.id
													},
													color
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: option.name }),
												selectedIcon === option.id && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: RoleAppearanceEditor_module_css_default.iconCheck,
													"aria-hidden": "true",
													children: "✓"
												})
											]
										}, option.id))
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										id: `${uid}-png-panel`,
										role: "tabpanel",
										"aria-labelledby": `${uid}-png-tab`,
										className: RoleAppearanceEditor_module_css_default.imagePanel,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												ref: fileInput,
												type: "file",
												accept: "image/png,.png",
												"aria-label": "上传 PNG 图标",
												className: RoleAppearanceEditor_module_css_default.fileInput,
												onChange: (event) => {
													const file = event.target.files?.[0];
													event.target.value = "";
													if (file) loadImage(() => loadRoleIconFile(file));
												}
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: RoleAppearanceEditor_module_css_default.uploadButton,
												onClick: () => fileInput.current?.click(),
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													"aria-hidden": "true",
													children: "＋"
												}), source || value.icon?.kind === "png" ? "重新选择 PNG" : "选择 PNG 图片"]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: RoleAppearanceEditor_module_css_default.help,
												children: "支持透明背景，保留图片原色。最大 2 MB、4096 × 4096 像素。"
											}),
											!source && value.icon?.kind === "png" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: RoleAppearanceEditor_module_css_default.imageActions,
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													disabled: !!working,
													onClick: () => {
														const icon = current.current.value.icon;
														if (icon?.kind === "png") loadImage(() => loadSavedRoleIcon(icon.assetId));
													},
													children: "调整当前图片"
												})
											}),
											source && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: RoleAppearanceEditor_module_css_default.imageStage,
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
														src: preview,
														alt: "PNG 图标调整预览"
													})
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
													className: RoleAppearanceEditor_module_css_default.rangeLabel,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["缩放 ", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("output", { children: [Math.round(adjustment.scale * 100), "%"] })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														"aria-label": "PNG 缩放",
														type: "range",
														min: "50",
														max: "200",
														value: Math.round(adjustment.scale * 100),
														onChange: (event) => adjust({
															...adjustment,
															scale: Number(event.target.value) / 100
														})
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
													className: RoleAppearanceEditor_module_css_default.rangeLabel,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["水平位置 ", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("output", { children: [adjustment.x, "%"] })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														"aria-label": "PNG 水平位置",
														type: "range",
														min: "-50",
														max: "50",
														value: adjustment.x,
														onChange: (event) => adjust({
															...adjustment,
															x: Number(event.target.value)
														})
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
													className: RoleAppearanceEditor_module_css_default.rangeLabel,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["垂直位置 ", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("output", { children: [adjustment.y, "%"] })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														"aria-label": "PNG 垂直位置",
														type: "range",
														min: "-50",
														max: "50",
														value: adjustment.y,
														onChange: (event) => adjust({
															...adjustment,
															y: Number(event.target.value)
														})
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: RoleAppearanceEditor_module_css_default.imageActions,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														onClick: () => adjust({ ...centeredImage }),
														children: "恢复居中"
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: RoleAppearanceEditor_module_css_default.applyButton,
														disabled: !dirty || !!working,
														onClick: () => void applyImage(),
														children: working === "upload" ? "应用中…" : dirty ? "应用图片" : "已应用图片"
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: RoleAppearanceEditor_module_css_default.help,
													children: dirty ? "调整后点击“应用图片”，再保存岗位。" : "图片已加入岗位草稿，保存岗位后生效。"
												})
											] }),
											working === "read" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: RoleAppearanceEditor_module_css_default.help,
												role: "status",
												children: "正在读取图片…"
											}),
											error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: RoleAppearanceEditor_module_css_default.error,
												role: "alert",
												children: error
											})
										]
									})
								]
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
							className: RoleAppearanceEditor_module_css_default.previews,
							"aria-label": "外观即时预览",
							style: appearanceStyle(color),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: RoleAppearanceEditor_module_css_default.sectionHeading,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "即时预览" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "三个入口同步展示" })]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: RoleAppearanceEditor_module_css_default.previewCaption,
									children: "岗位卡片"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: RoleAppearanceEditor_module_css_default.previewCard,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: RoleAppearanceEditor_module_css_default.previewCardTop,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PreviewIcon, {}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: RoleAppearanceEditor_module_css_default.previewBadge,
												children: "岗位助手"
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: name }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: value.duties.trim() || "在这里预览助手的职责、图标和主题颜色。" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: RoleAppearanceEditor_module_css_default.previewSelected,
											children: "✓ 已选定"
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: RoleAppearanceEditor_module_css_default.previewCaption,
									children: "左上角入口"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: RoleAppearanceEditor_module_css_default.toolbarPreview,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PreviewIcon, { className: RoleAppearanceEditor_module_css_default.smallIcon }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: name }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											"aria-hidden": "true",
											children: "›"
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: RoleAppearanceEditor_module_css_default.previewCaption,
									children: "新对话选项"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: RoleAppearanceEditor_module_css_default.choicePreview,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PreviewIcon, { className: RoleAppearanceEditor_module_css_default.smallIcon }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: name }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: RoleAppearanceEditor_module_css_default.previewCheck,
											"aria-hidden": "true",
											children: "✓"
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: RoleAppearanceEditor_module_css_default.help,
									children: "文字随当前主题保持清晰，PNG 不随主题色染色。"
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RoleAppearanceEditor_module_css_default.footer,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => reset(roleAppearanceDefaults(roleId)),
							children: "恢复默认外观"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => reset(initialAppearance),
							children: "撤销本次外观修改"
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/requirements-routing.ts
		/** Route by the exact published binding, including custom roles; the service enforces current authority. */
		function usesRequirements(state, version) {
			const binding = version?.capabilities.find((item) => item.capabilityId === "requirements-analysis" && item.enabled);
			if (!state || !binding) return false;
			const published = state.capabilities.find((item) => item.id === binding.capabilityId)?.versions.find((item) => item.version === binding.version);
			return actionsOf(published).includes("analyze-requirements") && (!binding.actions || binding.actions.includes("analyze-requirements"));
		}
		//#endregion
		//#region src/client/ManagedRoles.tsx
		const freeChat = {
			name: "自由聊天",
			color: "#78869f",
			description: "日常问答、写作与想法讨论，无需选择工作区。"
		};
		const MEETING_DEMO_ROLE_ID = MEETING_ROLE_ID;
		function useMeetingStatus() {
			return useMeetingAvailability().status;
		}
		function ManagedRoleEditor({ id, onClose }) {
			const { data } = useCapabilities();
			(0, react.useEffect)(() => {
				const navigate = (event) => {
					if (event.detail?.section === "plugins") onClose();
				};
				window.addEventListener("workbench-capability-link", navigate);
				return () => window.removeEventListener("workbench-capability-link", navigate);
			}, [onClose]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal$1, {
				title: id ? "编辑岗位助手" : "创建岗位助手",
				closeLabel: "关闭岗位编辑",
				onClose,
				wide: true,
				children: data ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleForm, {
					id,
					onClose
				}, id ?? "new") : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "正在读取岗位…" })
			});
		}
		function RoleForm({ id, onClose }) {
			const { data } = useCapabilities(), state = data.state, role = state.roles.find((r) => r.id === id), key = `role:${id ?? "new"}`, cached = editorDrafts.get(key);
			const meetingStatus = useMeetingStatus();
			const { status: requirementsStatus } = useRequirementAvailability(state.revision);
			const [draft, setDraft] = (0, react.useState)(() => structuredClone(cached?.value ?? role?.draft ?? emptyRole()));
			const [initialAppearance] = (0, react.useState)(() => structuredClone({
				color: draft.color,
				icon: draft.icon
			}));
			const [appearanceBusy, setAppearanceBusy] = (0, react.useState)(false);
			const [appearanceRevision, setAppearanceRevision] = (0, react.useState)(0);
			const [revision, setRevision] = (0, react.useState)(cached?.revision ?? state.revision), [selected, setSelected] = (0, react.useState)(id === "meeting-minutes-demo" ? MEETING_CAPABILITY_ID : draft.capabilities[0]?.capabilityId ?? null);
			const [center, setCenter] = (0, react.useState)(false), [busy, setBusy] = (0, react.useState)(false), [error, setError] = (0, react.useState)(""), [review, setReview] = (0, react.useState)(false);
			const change = (value) => {
				setDraft(value);
				editorDrafts.set(key, {
					value: structuredClone(value),
					revision
				});
			};
			const binding = draft.capabilities.find((b) => b.capabilityId === selected), cap = state.capabilities.find((c) => c.id === selected), version = binding && resolveBinding(state, binding);
			const updateBinding = (patch) => change({
				...draft,
				capabilities: draft.capabilities.map((b) => b.capabilityId === selected ? {
					...b,
					...patch
				} : b)
			});
			const save = async (publish) => {
				if (appearanceBusy) return;
				setBusy(true);
				setError("");
				try {
					await capabilityClient.command({
						type: "role.save",
						id,
						definition: draft,
						publish
					}, revision);
					editorDrafts.delete(key);
					onClose();
				} catch (error) {
					setError(error instanceof Error ? error.message : String(error));
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagedWorkbench, {
					libraryTitle: id === "meeting-minutes-demo" ? "会议流程能力" : "能力配件库",
					title: "岗位信息",
					selected,
					onSelect: setSelected,
					onManage: () => setCenter(true),
					library: state.capabilities.filter((c) => !c.removedAt && c.versions.length && (id === "meeting-minutes-demo" ? c.id === "meeting-transcription" : c.id !== "meeting-transcription")).map((c) => ({
						id: c.id,
						name: c.draft.name,
						icon: c.id === "requirements-analysis" ? "document" : c.id === "meeting-transcription" ? "audio" : "browser",
						subtitle: `v${latest(c.versions).version} · ${c.enabled ? "已发布" : "已停用"}`,
						disabled: id === MEETING_ROLE_ID
					})),
					attached: draft.capabilities.map((b) => {
						const c = state.capabilities.find((c) => c.id === b.capabilityId);
						return {
							id: b.capabilityId,
							name: c?.draft.name ?? "能力缺失",
							icon: b.capabilityId === "requirements-analysis" ? "document" : b.capabilityId === "meeting-transcription" ? "audio" : "browser",
							subtitle: `v${b.version} · ${c?.removedAt ? "能力已移除" : !b.enabled ? "岗位中停用" : !c?.enabled ? "能力已停用" : b.capabilityId === "requirements-analysis" ? requirementsStatus?.ready ? "可使用" : "待配置" : b.capabilityId === "meeting-transcription" ? meetingStatus?.ready ? "已配置" : meetingStatus?.state === "disabled" ? "不可用" : "待配置" : data.health.state === "ready" ? "可使用" : "待连接"}`,
							removable: b.capabilityId !== MEETING_CAPABILITY_ID
						};
					}),
					onAdd: (capabilityId) => {
						if (id === "meeting-minutes-demo") return;
						const c = state.capabilities.find((c) => c.id === capabilityId), v = c && latest(c.versions);
						if (v && !c?.removedAt && !draft.capabilities.some((b) => b.capabilityId === capabilityId)) change({
							...draft,
							capabilities: [...draft.capabilities, {
								capabilityId,
								version: v.version,
								enabled: true
							}]
						});
						setSelected(capabilityId);
					},
					onRemove: (capabilityId) => {
						if (capabilityId !== "meeting-transcription") change({
							...draft,
							capabilities: draft.capabilities.filter((b) => b.capabilityId !== capabilityId)
						});
					},
					form: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: `${ManagedCapabilities_module_css_default.page} ${ManagedCapabilities_module_css_default.fields}`,
						children: [
							id === "meeting-minutes-demo" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ManagedCapabilities_module_css_default.notice,
								children: ["此岗位已关联“会议录音转写”能力，并提供快速生成和引导整理两种对话流程。下方的职责、要求和输出格式会用于新会议的纪要生成。", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: ManagedCapabilities_module_css_default.button,
									onClick: () => setCenter(true),
									children: "查看录音转写能力 →"
								})]
							}),
							draft.capabilities.some((b) => b.capabilityId === "requirements-analysis") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ManagedCapabilities_module_css_default.notice,
								children: "需求分析岗位提供对话、需求工作区和轨迹。职责与工作要求会用于新分析；该流程暂不支持同时启用其他执行能力。"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: ManagedCapabilities_module_css_default.field,
								children: ["助手名称", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									value: draft.name,
									maxLength: 80,
									placeholder: "例如：网页资料分析助手",
									onChange: (e) => change({
										...draft,
										name: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleAppearanceEditor, {
								roleId: id,
								value: draft,
								initialAppearance,
								onBusyChange: setAppearanceBusy,
								onChange: (patch) => setDraft((current) => {
									const value = {
										...current,
										...patch
									};
									editorDrafts.set(key, {
										value: structuredClone(value),
										revision
									});
									return value;
								})
							}, appearanceRevision),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: ManagedCapabilities_module_css_default.field,
								children: ["岗位职责", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									rows: 4,
									maxLength: 8e3,
									value: draft.duties,
									onChange: (e) => change({
										...draft,
										duties: e.target.value
									})
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: "工作要求与输出格式" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ManagedCapabilities_module_css_default.fields,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: ManagedCapabilities_module_css_default.field,
									children: ["工作要求", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										rows: 3,
										maxLength: 8e3,
										value: draft.requirements,
										onChange: (e) => change({
											...draft,
											requirements: e.target.value
										})
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: ManagedCapabilities_module_css_default.field,
									children: ["输出格式", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										rows: 3,
										maxLength: 4e3,
										value: draft.format,
										onChange: (e) => change({
											...draft,
											format: e.target.value
										})
									})]
								})]
							})] }),
							role && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: ManagedCapabilities_module_css_default.field,
								children: ["从历史版本恢复到草稿", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									value: "",
									onChange: (e) => {
										const v = role.versions.find((v) => v.version === Number(e.target.value));
										if (v) {
											change(structuredClone(v));
											setAppearanceRevision((value) => value + 1);
										}
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "",
										children: "选择版本…"
									}), role.versions.map((v) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
										value: v.version,
										children: [
											"v",
											v.version,
											" · ",
											v.name
										]
									}, v.version))]
								})]
							})
						]
					}),
					inspector: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ManagedCapabilities_module_css_default.page,
						children: cap?.id === "meeting-transcription" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: cap.draft.name }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ManagedCapabilities_module_css_default.muted,
								children: cap.draft.description
							}),
							cap.removedAt && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ManagedCapabilities_module_css_default.notice,
								children: "此能力已移除，请在能力中心恢复后使用。"
							}),
							binding && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: ManagedCapabilities_module_css_default.check,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: binding.enabled,
									onChange: (e) => updateBinding({ enabled: e.target.checked })
								}), "在此岗位中启用录音转写"]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: ManagedCapabilities_module_css_default.field,
								children: ["采用的能力版本", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
									value: binding.version,
									onChange: (e) => updateBinding({
										version: Number(e.target.value),
										actions: void 0
									}),
									children: cap.versions.map((v) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
										value: v.version,
										children: [
											"v",
											v.version,
											" · ",
											v.createdAt.slice(0, 10)
										]
									}, v.version))
								})]
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ManagedCapabilities_module_css_default.notice,
								children: meetingStatus?.message ?? "正在检查语音识别配置…"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: ManagedCapabilities_module_css_default.button,
								onClick: () => setCenter(true),
								children: "管理录音转写能力 ↗"
							})
						] }) : cap ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: cap.draft.name }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ManagedCapabilities_module_css_default.muted,
								children: cap.draft.description
							}),
							cap.removedAt && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ManagedCapabilities_module_css_default.notice,
								children: "此能力已移除，当前不可执行。可从岗位中移除此配件，或在能力中心恢复。"
							}),
							binding ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: ManagedCapabilities_module_css_default.check,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: binding.enabled,
										onChange: (e) => updateBinding({ enabled: e.target.checked })
									}), "在此岗位中启用"]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: ManagedCapabilities_module_css_default.field,
									children: ["采用的能力版本", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										value: binding.version,
										onChange: (e) => updateBinding({
											version: Number(e.target.value),
											actions: void 0
										}),
										children: cap.versions.map((v) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
											value: v.version,
											children: [
												"v",
												v.version,
												" · ",
												v.createdAt.slice(0, 10)
											]
										}, v.version))
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: ManagedCapabilities_module_css_default.check,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: binding.actions !== void 0,
										onChange: (e) => updateBinding({ actions: e.target.checked ? actionsOf(version) : void 0 })
									}), "为此岗位缩小动作范围"]
								}),
								binding.actions !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionFields, {
									value: binding.actions,
									available: actionsOf(version),
									onChange: (actions) => updateBinding({ actions })
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: ManagedCapabilities_module_css_default.muted,
									children: ["继承该版本默认动作：", actionsOf(version).map((a) => actionNames[a]).join("、")]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: ManagedCapabilities_module_css_default.notice,
									children: cap.id === "requirements-analysis" ? requirementsStatus?.message ?? "正在读取需求配置…" : data.health.message
								})
							] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "先添加此能力，再设置岗位覆盖。" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: ManagedCapabilities_module_css_default.button,
								onClick: () => setCenter(true),
								children: "查看能力及关联组件 ↗"
							})
						] }) : id === "meeting-minutes-demo" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.notice,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "会议录音转纪要" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "快速生成、引导整理与录音转写由会议流程提供。语音识别接口在服务端配置，密钥不会保存到岗位草稿。" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: ManagedCapabilities_module_css_default.button,
									onClick: () => setCenter(true),
									children: "查看能力中心 →"
								})
							]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: ManagedCapabilities_module_css_default.empty,
							children: "选择已添加的能力以调整设置。"
						})
					})
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: `${ManagedCapabilities_module_css_default.page} ${ManagedCapabilities_module_css_default.footer}`,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						className: ManagedCapabilities_module_css_default.error,
						children: error
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: appearanceBusy ? "请先在外观与配色中完成图片应用或修正颜色，再保存岗位。" : roleCompositionIssues(draft).join("；") || "保存并发布后，新对话将采用这个岗位版本。" }), revision !== state.revision && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: ManagedCapabilities_module_css_default.button,
						onClick: () => setRevision(state.revision),
						children: "保留草稿并更新保存基准"
					})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ManagedCapabilities_module_css_default.actions,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: ManagedCapabilities_module_css_default.button,
							disabled: busy || appearanceBusy,
							onClick: () => void save(false),
							children: "保存草稿"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: `${ManagedCapabilities_module_css_default.button} ${ManagedCapabilities_module_css_default.primary}`,
							disabled: busy || appearanceBusy || !draft.name.trim() || roleCompositionIssues(draft).length > 0,
							onClick: () => setReview(true),
							children: "保存并发布"
						})]
					})]
				}),
				center && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal$1, {
					title: "能力中心",
					closeLabel: "返回岗位",
					onClose: () => setCenter(false),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: `${ManagedCapabilities_module_css_default.page} ${ManagedCapabilities_module_css_default.dialogBody}`,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: ManagedCapabilities_module_css_default.button,
							onClick: () => setCenter(false),
							children: "← 返回岗位，保留草稿"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagedCenter, {
							embedded: true,
							initialId: selected ?? void 0
						})]
					})
				}),
				review && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal$1, {
					title: "发布岗位版本",
					closeLabel: "返回编辑",
					onClose: () => setReview(false),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: `${ManagedCapabilities_module_css_default.page} ${ManagedCapabilities_module_css_default.dialogBody}`,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
								draft.name,
								" · v",
								(latest(role?.versions ?? [])?.version ?? 0) + 1
							] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: ManagedCapabilities_module_css_default.list,
								children: draft.capabilities.map((b) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
									state.capabilities.find((c) => c.id === b.capabilityId)?.draft.name,
									" · v",
									b.version,
									" · ",
									b.enabled ? (b.actions ?? actionsOf(resolveBinding(state, b))).map((a) => actionNames[a]).join("、") : "停用"
								] }, b.capabilityId))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ManagedCapabilities_module_css_default.notice,
								children: draft.capabilities.some((b) => b.enabled && b.capabilityId === "requirements-analysis") ? "新需求分析采用此岗位版本；已有分析保留创建时的要求和确认结果。停用能力或缩小权限会限制后续模型调用。" : id === "meeting-minutes-demo" ? "新会议将采用此岗位版本的名称、外观、纪要要求与录音转写能力关联；已有会议保留创建时的版本。" : "新增能力和放宽动作只由新对话采用。移除能力或缩小权限会立即限制旧会话，并停止受影响的浏览器任务。"
							}),
							error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								role: "alert",
								className: ManagedCapabilities_module_css_default.error,
								children: error
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: `${ManagedCapabilities_module_css_default.button} ${ManagedCapabilities_module_css_default.primary}`,
								disabled: busy || appearanceBusy,
								onClick: () => void save(true),
								children: busy ? "保存中…" : "确认发布"
							})
						]
					})
				})
			] });
		}
		function ManagedRolesSection({ selected, onSelect }) {
			const { data, error } = useCapabilities(), [editor, setEditor] = (0, react.useState)(null), [message, setMessage] = (0, react.useState)("");
			const meetingStatus = useMeetingStatus();
			const displayedRoles = [...data?.state.roles ?? []].sort((left, right) => Number(right.id === MEETING_ROLE_ID) - Number(left.id === MEETING_ROLE_ID));
			const selectedRole = data?.state.roles.find((role) => role.id === selected && role.enabled && role.versions.length);
			const toggleRole = async (id, enabled) => {
				try {
					await capabilityClient.command({
						type: "role.toggle",
						id,
						enabled
					});
					if (!enabled && selected === id) onSelect("chat");
				} catch (error) {
					setMessage(error instanceof Error ? error.message : String(error));
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: Roles_module_css_default.section,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: Roles_module_css_default.sectionHeader,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: "岗位助手" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "为每一类工作，准备一位熟悉职责的助手。" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: Roles_module_css_default.primary,
							onClick: () => setEditor({}),
							children: "＋ 创建岗位助手"
						})]
					}),
					(error || message) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						className: ManagedCapabilities_module_css_default.error,
						children: message || error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: Roles_module_css_default.selectionStatus,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							role: "status",
							children: selected === "chat" ? `已选定：${freeChat.name}` : selectedRole ? `已选定：${selectedRole.draft.name}` : data ? "当前岗位暂不可用" : "正在读取选定岗位…"
						}), selected !== "chat" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: Roles_module_css_default.textButton,
							onClick: () => onSelect("chat"),
							children: "返回自由聊天"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: Roles_module_css_default.cards,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
							"data-role-id": "chat",
							"aria-label": freeChat.name,
							className: `${Roles_module_css_default.roleCard} ${selected === "chat" ? Roles_module_css_default.selectedCard : ""}`,
							style: appearanceStyle(freeChat.color),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: Roles_module_css_default.cardBody,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: Roles_module_css_default.cardSelect,
										"aria-label": `选定助手：${freeChat.name}`,
										"aria-pressed": selected === "chat",
										onClick: () => onSelect("chat")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: Roles_module_css_default.cardTop,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleAppearanceIcon, {
											roleId: "chat",
											color: freeChat.color
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: `${Roles_module_css_default.exampleBadge} ${selected === "chat" ? Roles_module_css_default.selectedBadge : ""}`,
											children: selected === "chat" ? "✓ 已选定" : "内置"
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: freeChat.name }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: Roles_module_css_default.cardSummary,
										children: freeChat.description
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: Roles_module_css_default.tags,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "内置基础助手" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "日常问答" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "写作讨论" })
										]
									})
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: Roles_module_css_default.cardControls,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: Roles_module_css_default.chatCardNote,
									children: "无需岗位配置，随时开始聊天。"
								})
							})]
						}), displayedRoles.map((role) => {
							const published = latest(role.versions), selectable = role.enabled && !!published, chosen = selectable && selected === role.id;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
								"data-role-id": role.id,
								"aria-label": role.draft.name,
								className: `${Roles_module_css_default.roleCard} ${chosen ? Roles_module_css_default.selectedCard : ""}`,
								style: appearanceStyle(role.draft.color),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: Roles_module_css_default.cardBody,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: Roles_module_css_default.cardSelect,
											"aria-label": `选定助手：${role.draft.name}`,
											"aria-pressed": chosen,
											disabled: !selectable,
											onClick: () => onSelect(role.id)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: Roles_module_css_default.cardTop,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleAppearanceIcon, {
												roleId: role.id,
												icon: role.draft.icon,
												color: role.draft.color
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: `${Roles_module_css_default.exampleBadge} ${chosen ? Roles_module_css_default.selectedBadge : ""}`,
												children: chosen ? "✓ 已选定" : !role.enabled ? "已停用" : published ? "岗位助手" : "草稿"
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: role.draft.name }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: Roles_module_css_default.cardSummary,
											title: role.draft.duties,
											children: role.draft.duties || "点击编辑岗位，填写职责与工作要求。"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: Roles_module_css_default.tags,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: published ? `已发布 v${published.version}` : "未发布" }), role.id === "meeting-minutes-demo" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "快速生成 · 引导整理" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												title: meetingStatus?.message,
												children: meetingStatus?.ready === true ? "录音转写已配置" : meetingStatus?.state === "disabled" ? "录音转写不可用" : meetingStatus?.ready === false ? "录音转写待配置" : "正在检测录音转写"
											})] }) : usesRequirements(data?.state, published) ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "快速整理 · 引导分析" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "需求工作区" })] }) : role.id === "builtin-analyst" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [role.draft.capabilities.length, " 个能力"] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "可编辑岗位，选择需求分析能力" })] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [role.draft.capabilities.length, " 个能力"] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [data?.tasks.filter((t) => t.roleId === role.id && t.status !== "stopped").length ?? 0, " 个活动会话"] })] })]
										})
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: Roles_module_css_default.cardControls,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										className: Roles_module_css_default.cardAction,
										onClick: () => setEditor({ id: role.id }),
										children: ["编辑岗位", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											"aria-hidden": "true",
											children: "↗"
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: Roles_module_css_default.textButton,
										onClick: () => void toggleRole(role.id, !role.enabled),
										children: role.enabled ? "停用" : "启用"
									})]
								})]
							}, role.id);
						})]
					}),
					data && !data.state.roles.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ManagedCapabilities_module_css_default.empty,
						children: "还没有保存的岗位助手。创建后即可装配能力。"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: Roles_module_css_default.sectionNote,
						children: "点击卡片选定助手；选择会用于下一次新对话，当前对话保持不变。"
					}),
					editor && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagedRoleEditor, {
						id: editor.id,
						onClose: () => setEditor(null)
					})
				]
			});
		}
		function ManagedRolePicker({ selected, onSelect, t }) {
			const { data } = useCapabilities(), [open, setOpen] = (0, react.useState)(false), [editor, setEditor] = (0, react.useState)(false);
			const role = data?.state.roles.find((role) => role.id === selected);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					className: Roles_module_css_default.picker,
					"aria-haspopup": "dialog",
					onClick: () => setOpen(true),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleAppearanceIcon, {
							roleId: role?.id ?? "chat",
							icon: role?.draft.icon,
							color: role?.draft.color ?? freeChat.color
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: role?.draft.name ?? t("mode") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "⌄" })
					]
				}),
				open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal$1, {
					title: "选择岗位助手",
					closeLabel: "关闭",
					onClose: () => setOpen(false),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: `${ManagedCapabilities_module_css_default.page} ${ManagedCapabilities_module_css_default.dialogBody}`,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								className: ManagedCapabilities_module_css_default.choice,
								"aria-pressed": selected === "chat",
								onClick: () => {
									onSelect("chat");
									setOpen(false);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleAppearanceIcon, {
									roleId: "chat",
									color: freeChat.color
								}) }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: freeChat.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: freeChat.description })] })]
							}),
							[...data?.state.roles ?? []].sort((left, right) => Number(right.id === "meeting-minutes-demo") - Number(left.id === "meeting-minutes-demo")).filter((role) => role.enabled && role.versions.length).map((role) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								className: ManagedCapabilities_module_css_default.choice,
								"aria-pressed": selected === role.id,
								onClick: () => {
									onSelect(role.id);
									setOpen(false);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleAppearanceIcon, {
									roleId: role.id,
									icon: role.draft.icon,
									color: role.draft.color
								}) }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: latest(role.versions).name }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: role.id === "meeting-minutes-demo" ? `v${latest(role.versions).version} · 快速生成 / 引导整理` : usesRequirements(data?.state, latest(role.versions)) ? `v${latest(role.versions).version} · 快速整理 / 引导分析` : `v${latest(role.versions).version} · ${latest(role.versions).capabilities.length} 个能力` })] })]
							}, role.id)),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: ManagedCapabilities_module_css_default.button,
								onClick: () => setEditor(true),
								children: "＋ 创建岗位助手"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ManagedCapabilities_module_css_default.muted,
								children: "选择仅用于下一次新对话，当前对话的岗位不会改变。"
							})
						]
					})
				}),
				editor && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagedRoleEditor, { onClose: () => setEditor(false) })
			] });
		}
		function ManagedCurrentAssistant({ selected, onOpen, preset }) {
			const { data } = useCapabilities();
			const role = data?.state.roles.find((role) => role.id === selected);
			const appearance = (preset ? role?.versions.find((version) => version.preset === preset) : void 0) ?? role?.draft;
			const name = appearance?.name ?? freeChat.name, color = appearance?.color ?? freeChat.color;
			const iconSpec = appearance?.icon;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				"data-current-assistant": "true",
				"data-role-icon": roleAppearanceIconId(role?.id ?? "chat", iconSpec),
				className: Roles_module_css_default.currentAssistant,
				style: appearanceStyle(color),
				"aria-label": `打开岗位助手：${name}`,
				title: `当前选定：${name} · 点击管理岗位`,
				onClick: onOpen,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleAppearanceIcon, {
						roleId: role?.id ?? "chat",
						icon: iconSpec,
						color
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: Roles_module_css_default.currentText,
						children: name
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						className: Roles_module_css_default.currentArrow,
						"aria-hidden": "true",
						viewBox: "0 0 16 16",
						fill: "none",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							d: "m6 4 4 4-4 4",
							stroke: "currentColor",
							strokeWidth: "1.5",
							strokeLinecap: "round",
							strokeLinejoin: "round"
						})
					})
				]
			});
		}
		function BrowserTaskStatus({ sessionId }) {
			const { data } = useCapabilities(), [error, setError] = (0, react.useState)("");
			const task = data?.tasks.find((t) => t.sessionId === sessionId);
			if (!task || !task.browserSessions.length && task.status === "idle") return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `${ManagedCapabilities_module_css_default.page} ${ManagedCapabilities_module_css_default.tasks}`,
				role: "status",
				children: [
					{
						idle: "浏览器空闲",
						running: "浏览器执行中",
						stopping: "正在停止",
						stopped: "已确认停止",
						error: "需要处理"
					}[task.status],
					task.action && ` · ${task.action}`,
					" · ",
					task.browserSessions.length,
					" 个窗口",
					!["stopped", "stopping"].includes(task.status) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: ManagedCapabilities_module_css_default.button,
						onClick: () => void capabilityClient.stop(task.sessionId).catch((e) => setError(e.message)),
						children: "停止浏览器任务"
					}),
					(error || task.error) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ManagedCapabilities_module_css_default.error,
						children: error || task.error
					})
				]
			});
		}
		//#endregion
		//#region src/client/ManagedRecycleBin.tsx
		function DeleteCapabilitiesDialog({ data, ids, emptying, onClose, onDeleted }) {
			const [revision, setRevision] = (0, react.useState)(data.state.revision), [busy, setBusy] = (0, react.useState)(false), [error, setError] = (0, react.useState)("");
			const candidates = data.state.capabilities.filter((c) => ids.includes(c.id) && c.removedAt);
			const protectedItems = candidates.map((cap) => ({
				cap,
				roles: capabilityDeletionReferences(data.state, cap.id)
			})).filter((x) => x.roles.length);
			const eligible = candidates.filter((c) => !protectedItems.some((x) => x.cap.id === c.id));
			const changed = revision !== data.state.revision;
			const purge = async () => {
				setBusy(true);
				setError("");
				const deleting = eligible.map((c) => c.id);
				try {
					await capabilityClient.command({
						type: "capability.purge",
						ids: deleting
					}, revision);
					deleting.forEach((id) => editorDrafts.delete(`capability:${id}`));
					onDeleted(deleting, protectedItems.length);
				} catch (error) {
					setError(error instanceof Error ? error.message : String(error));
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal$1, {
				title: emptying ? "清空回收站" : "永久删除能力",
				closeLabel: "取消永久删除",
				onClose: () => {
					if (!busy) onClose();
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: `${ManagedCapabilities_module_css_default.page} ${ManagedCapabilities_module_css_default.dialogBody}`,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							className: ManagedCapabilities_module_css_default.notice,
							children: [
								emptying ? "清空范围为打开此窗口时回收站中的全部能力，包含搜索结果之外的项目。" : "仅处理本次选中的能力。",
								"可永久删除 ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: eligible.length }),
								" 项，保留 ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: protectedItems.length }),
								" 项。"
							]
						}),
						eligible.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
							"以下能力的配置和历史版本将永久删除，",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "无法通过回收站恢复" }),
							"："
						] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: `${ManagedCapabilities_module_css_default.list} ${ManagedCapabilities_module_css_default.deleteList}`,
							children: eligible.map((c) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: c.draft.name }, c.id))
						})] }),
						protectedItems.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.removalImpact,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "以下能力有引用，将继续保留" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
									className: `${ManagedCapabilities_module_css_default.list} ${ManagedCapabilities_module_css_default.deleteList}`,
									children: protectedItems.map(({ cap, roles }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: cap.draft.name }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("br", {}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: ManagedCapabilities_module_css_default.muted,
											children: ["岗位配置或历史版本：", roles.map((r) => r.draft.name).join("、")]
										})
									] }, cap.id))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: ManagedCapabilities_module_css_default.muted,
									children: "为保留岗位和历史会话配置，不会自动解除这些引用。仅从当前岗位拆下也不会删除历史版本中的引用。"
								})
							]
						}),
						!candidates.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "这些能力已不在回收站中，请关闭后刷新列表。" }),
						error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							role: "alert",
							className: ManagedCapabilities_module_css_default.error,
							children: error
						}),
						changed && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							role: "status",
							className: ManagedCapabilities_module_css_default.notice,
							children: ["配置已有更新，请重新核对以上范围。", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: ManagedCapabilities_module_css_default.button,
								disabled: busy,
								onClick: () => {
									setRevision(data.state.revision);
									setError("");
								},
								children: "已核对，更新操作基准"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.confirmActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: ManagedCapabilities_module_css_default.button,
								disabled: busy,
								onClick: onClose,
								children: "取消"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: `${ManagedCapabilities_module_css_default.button} ${ManagedCapabilities_module_css_default.dangerButton}`,
								disabled: busy || changed || !eligible.length,
								onClick: () => void purge(),
								children: busy ? "正在删除…" : `永久删除 ${eligible.length} 项`
							})]
						})
					]
				})
			});
		}
		function ManagedRecycleBin({ data, query, onInspect, onNotice }) {
			const [checked, setChecked] = (0, react.useState)([]), [busy, setBusy] = (0, react.useState)(false), [error, setError] = (0, react.useState)("");
			const [deleting, setDeleting] = (0, react.useState)(null);
			const removed = data.state.capabilities.filter((c) => c.removedAt).sort((a, b) => b.removedAt.localeCompare(a.removedAt));
			const visible = removed.filter((c) => `${c.draft.name} ${c.draft.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
			const selected = checked.filter((id) => visible.some((c) => c.id === id)), all = visible.length > 0 && selected.length === visible.length;
			(0, react.useEffect)(() => {
				setChecked([]);
			}, [query]);
			const toggle = (id) => setChecked(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
			const restore = async (ids) => {
				setBusy(true);
				setError("");
				try {
					await capabilityClient.command({
						type: "capability.restoreMany",
						ids
					}, data.state.revision);
					setChecked((current) => current.filter((id) => !ids.includes(id)));
					onNotice(`已恢复 ${ids.length} 项能力，当前保持停用。可在“全部”中检查并启用。`);
				} catch (error) {
					setError(error instanceof Error ? error.message : String(error));
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"data-recycle-bin": true,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ManagedCapabilities_module_css_default.muted,
						children: "移除的能力保存在回收站中。恢复后保持停用；永久删除后无法恢复。"
					}),
					removed.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ManagedCapabilities_module_css_default.recycleToolbar,
						role: "group",
						"aria-label": "回收站批量操作",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.selectionSummary,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilitySelection, {
									checked: all,
									mixed: selected.length > 0 && !all,
									disabled: busy || !visible.length,
									label: query.trim() ? "全选当前搜索结果" : "全选回收站能力",
									onChange: () => setChecked(all ? [] : visible.map((c) => c.id))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: query.trim() ? "全选结果" : "全选" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: ManagedCapabilities_module_css_default.muted,
									children: [
										"已选 ",
										selected.length,
										" / ",
										visible.length,
										" 项"
									]
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.actions,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									className: `${ManagedCapabilities_module_css_default.button} ${ManagedCapabilities_module_css_default.inlineAction}`,
									disabled: busy || !selected.length,
									onClick: () => void restore(selected),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityActionIcon, { kind: "restore" }), "恢复选中"]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: ManagedCapabilities_module_css_default.button,
									disabled: busy || !selected.length,
									onClick: () => setDeleting({
										ids: selected,
										emptying: false
									}),
									children: "删除选中"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									className: `${ManagedCapabilities_module_css_default.button} ${ManagedCapabilities_module_css_default.inlineAction}`,
									disabled: busy,
									onClick: () => setDeleting({
										ids: removed.map((c) => c.id),
										emptying: true
									}),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityActionIcon, { kind: "remove" }), "清空回收站"]
								})
							]
						})]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						className: ManagedCapabilities_module_css_default.error,
						children: error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ManagedCapabilities_module_css_default.grid,
						children: visible.map((c) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagedCapabilityCard, {
							capability: c,
							data,
							busy,
							onManage: () => onInspect(c.id),
							onPin: () => {},
							onRemove: () => {},
							onRestore: () => void restore([c.id]),
							onPurge: () => setDeleting({
								ids: [c.id],
								emptying: false
							}),
							selection: {
								checked: selected.includes(c.id),
								onChange: () => toggle(c.id)
							}
						}, c.id))
					}),
					!visible.length && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ManagedCapabilities_module_css_default.empty,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityActionIcon, { kind: "remove" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: removed.length ? "回收站中没有匹配的能力。" : "回收站为空" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ManagedCapabilities_module_css_default.muted,
								children: removed.length ? "试试其他名称或清除搜索条件。" : "移除的能力会显示在这里。"
							})
						]
					}),
					deleting && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DeleteCapabilitiesDialog, {
						data,
						ids: deleting.ids,
						emptying: deleting.emptying,
						onClose: () => setDeleting(null),
						onDeleted: (ids, protectedCount) => {
							setDeleting(null);
							setChecked((current) => current.filter((id) => !ids.includes(id)));
							onNotice(`已永久删除 ${ids.length} 项能力${protectedCount ? `，${protectedCount} 项因岗位或历史版本引用而保留` : ""}。`);
						}
					})
				]
			});
		}
		//#endregion
		//#region src/client/ManagedCenter.tsx
		function ActionFields({ value, available = [
			"navigate",
			"read",
			"screenshot"
		], onChange }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: available.map((action) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: ManagedCapabilities_module_css_default.check,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					checked: value.includes(action),
					onChange: (e) => onChange(e.target.checked ? [...value, action] : value.filter((a) => a !== action))
				}), actionNames[action]]
			}, action)) });
		}
		function CapabilityEditor({ id, data, onClose, onSaved, compositionFocus = false, meetingStatus, requirementsStatus, onConfigure }) {
			const cap = data.state.capabilities.find((c) => c.id === id);
			const { draft, revision, change, rebase } = useCapabilityDefinition(id, data);
			const associationEdit = useAssociationEditing(draft, change, id);
			const [selected, setSelected] = (0, react.useState)(draft.components[0]?.componentId ?? null);
			const [busy, setBusy] = (0, react.useState)(false), [message, setMessage] = (0, react.useState)(""), [review, setReview] = (0, react.useState)(false), [applyRoles, setApplyRoles] = (0, react.useState)([]);
			const part = draft.components.find((p) => p.componentId === selected), descriptor = components.find((c) => c.id === selected);
			const linked = data.state.roles.filter((r) => latest(r.versions)?.capabilities.some((b) => b.capabilityId === id));
			const save = async (publish) => {
				setBusy(true);
				setMessage("");
				try {
					const result = await capabilityClient.command({
						type: "capability.save",
						id,
						definition: draft,
						publish,
						applyToRoles: publish ? applyRoles : []
					}, revision);
					clearCapabilityDraft(id);
					onSaved(result);
					onClose();
				} catch (error) {
					setMessage(String(error instanceof Error ? error.message : error));
				} finally {
					setBusy(false);
				}
			};
			if (!compositionSupported(data, id)) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal$1, {
				title: "组件组合服务待更新",
				closeLabel: "关闭编辑器",
				onClose,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: `${ManagedCapabilities_module_css_default.page} ${ManagedCapabilities_module_css_default.dialogBody}`,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "请保存当前工作并正常重启工作台后编辑，避免旧服务忽略新的关联配置。已有草稿会保留。" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: ManagedCapabilities_module_css_default.button,
						onClick: () => void capabilityClient.refresh(),
						children: "重新检测"
					})]
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal$1, {
				title: id ? "编辑能力" : "创建能力",
				closeLabel: "关闭编辑器",
				onClose,
				wide: true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: ManagedCapabilities_module_css_default.page,
					style: { display: "contents" },
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagedWorkbench, {
							libraryTitle: "组件库",
							title: compositionFocus ? "组件组合" : "能力信息",
							library: compositionLibrary(draft, id),
							selected,
							onSelect: setSelected,
							attached: compositionItems(draft, id),
							attachedTitle: "当前组件组合",
							removeIcon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityActionIcon, { kind: "remove" }),
							onAdd: (componentId) => {
								change(addAssociation(draft, componentId));
								setSelected(componentId);
							},
							onRemove: associationEdit.request,
							onReorder: (from, to) => change(moveAssociation(draft, from, to)),
							compositionNotice: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [associationEdit.feedback, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MissingAssociations, {
								draft,
								change,
								capabilityId: id
							})] }),
							form: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
								open: !compositionFocus,
								className: ManagedCapabilities_module_css_default.compositionInfo,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: "能力名称与使用说明" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ManagedCapabilities_module_css_default.fields,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: ManagedCapabilities_module_css_default.field,
											children: ["能力名称", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												value: draft.name,
												maxLength: 80,
												placeholder: "例如：网页资料采集",
												onChange: (e) => change({
													...draft,
													name: e.target.value
												})
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: ManagedCapabilities_module_css_default.field,
											children: ["简介", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
												rows: 2,
												maxLength: 1e3,
												value: draft.description,
												onChange: (e) => change({
													...draft,
													description: e.target.value
												})
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: ManagedCapabilities_module_css_default.field,
											children: ["使用说明", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
												rows: 6,
												maxLength: 8e3,
												value: draft.instructions,
												onChange: (e) => change({
													...draft,
													instructions: e.target.value
												})
											})]
										}),
										cap && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: ManagedCapabilities_module_css_default.field,
											children: ["从历史版本恢复到当前草稿", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
												value: "",
												onChange: (e) => {
													const value = cap.versions.find((v) => v.version === Number(e.target.value));
													if (value) change(structuredClone(value));
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "",
													children: "选择版本…"
												}), cap.versions.map((v) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
													value: v.version,
													children: [
														"v",
														v.version,
														" · ",
														v.createdAt.slice(0, 16).replace("T", " ")
													]
												}, v.version))]
											})]
										})
									]
								})]
							}),
							inspector: selected?.startsWith("@") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SupportInspector, {
								id: selected,
								draft,
								data,
								change
							}) : descriptor ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BusinessInspector, {
								component: descriptor,
								draft,
								capabilityId: id,
								data,
								meetingStatus,
								requirementsStatus,
								onConfigure,
								children: part ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionFields, {
									value: part.actions,
									available: descriptor.actions,
									onChange: (actions) => change({
										...draft,
										components: draft.components.map((p) => p.componentId === selected ? {
											...p,
											actions
										} : p)
									})
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "请先将组件添加到中间区域。" })
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ManagedCapabilities_module_css_default.empty,
								children: "选择一个组件以调整动作。"
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.footer,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [message ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								role: "alert",
								className: ManagedCapabilities_module_css_default.error,
								children: message
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: issues(draft, id).join("；") || "已选择受支持的动作。发布前可检查影响范围。" }), revision !== data.state.revision && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: ManagedCapabilities_module_css_default.button,
								onClick: () => {
									rebase();
									setMessage("已更新基准，请核对保留的草稿后保存。");
								},
								children: "保留草稿并更新保存基准"
							})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ManagedCapabilities_module_css_default.actions,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: ManagedCapabilities_module_css_default.button,
									disabled: busy,
									onClick: () => void save(false),
									children: "保存草稿"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: `${ManagedCapabilities_module_css_default.button} ${ManagedCapabilities_module_css_default.primary}`,
									disabled: busy || !draft.name.trim() || issues(draft, id).length > 0,
									onClick: () => setReview(true),
									children: "检查并发布"
								})]
							})]
						}),
						associationEdit.dialog,
						review && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal$1, {
							title: "发布新版本",
							closeLabel: "返回编辑",
							onClose: () => setReview(false),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: `${ManagedCapabilities_module_css_default.page} ${ManagedCapabilities_module_css_default.dialogBody}`,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
										"当前发布：v",
										latest(cap?.versions ?? [])?.version ?? 0,
										" → v",
										(latest(cap?.versions ?? [])?.version ?? 0) + 1
									] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: ["原动作：", actionsOf(latest(cap?.versions ?? [])).map((a) => actionNames[a]).join("、") || "无"] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: ["新动作：", actionsOf(draft).map((a) => actionNames[a]).join("、") || "无"] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: ManagedCapabilities_module_css_default.notice,
										children: [...new Set(availableComponents(id).map((component) => componentService(component, {
											data,
											meetingStatus,
											requirementsStatus
										}).publishNotice))].join(" ")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "让以下岗位的新会话采用此版本" }),
									linked.map((role) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: ManagedCapabilities_module_css_default.check,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: applyRoles.includes(role.id),
											onChange: (e) => setApplyRoles(e.target.checked ? [...applyRoles, role.id] : applyRoles.filter((id) => id !== role.id))
										}), role.draft.name]
									}, role.id)),
									!linked.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: ManagedCapabilities_module_css_default.muted,
										children: "尚无引用此能力的已发布岗位。"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: `${ManagedCapabilities_module_css_default.button} ${ManagedCapabilities_module_css_default.primary}`,
										disabled: busy,
										onClick: () => void save(true),
										children: busy ? "发布中…" : "发布本地版本"
									}),
									message && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										role: "alert",
										className: ManagedCapabilities_module_css_default.error,
										children: message
									})
								]
							})
						})
					]
				})
			});
		}
		function ManagedCenter({ initialId, embedded = false }) {
			const { data, error } = useCapabilities();
			const { status: meetingStatus, refresh: refreshMeeting } = useMeetingAvailability(data?.state.revision);
			const { status: requirementsStatus, refresh: refreshRequirements, error: requirementsError, accept: acceptRequirementsConfig } = useRequirementAvailability(data?.state.revision);
			const [selected, setSelected] = (0, react.useState)(initialId ?? lastCapabilityLink()?.capabilityId ?? null), [tab, setTab] = (0, react.useState)("overview"), [query, setQuery] = (0, react.useState)(""), [filter, setFilter] = (0, react.useState)("all");
			const [editor, setEditor] = (0, react.useState)(null), [role, setRole] = (0, react.useState)(null), [message, setMessage] = (0, react.useState)(""), [busy, setBusy] = (0, react.useState)(false);
			const [removing, setRemoving] = (0, react.useState)(null), [notice, setNotice] = (0, react.useState)("");
			const [meetingEditing, setMeetingEditing] = (0, react.useState)(false);
			const [compositionReturn, setCompositionReturn] = (0, react.useState)(null);
			const meetingNavigate = (action) => {
				if (!meetingEditing || window.confirm("服务配置尚未保存，确定放弃修改？")) {
					setMeetingEditing(false);
					action();
				}
			};
			const configureComponents = (from) => meetingNavigate(() => {
				setCompositionReturn(from);
				setEditor(null);
				setTab("defaults");
			});
			const returnToComposition = () => meetingNavigate(() => {
				setTab("components");
				if (compositionReturn === "editor" && selected) setEditor({
					id: selected,
					compositionFocus: true
				});
				setCompositionReturn(null);
			});
			(0, react.useEffect)(() => {
				const open = (event) => {
					const link = event.detail;
					if (link.section === "capability-center") setSelected(link.capabilityId ?? null);
				};
				window.addEventListener("workbench-capability-link", open);
				return () => window.removeEventListener("workbench-capability-link", open);
			}, []);
			const run = async (fn) => {
				setBusy(true);
				setMessage("");
				try {
					await fn();
				} catch (error) {
					setMessage(error instanceof Error ? error.message : String(error));
				} finally {
					setBusy(false);
				}
			};
			if (!data) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ManagedCapabilities_module_css_default.page,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					role: error ? "alert" : "status",
					children: error || "正在读取能力数据…"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					className: ManagedCapabilities_module_css_default.button,
					onClick: () => void capabilityClient.refresh(),
					children: "重新加载"
				})]
			});
			const item = data.state.capabilities.find((c) => c.id === selected);
			const meetingAssistantName = data.state.roles.find((role) => role.id === "meeting-minutes-demo")?.draft.name ?? "会议纪要助手";
			const linked = (id) => capabilityImpact(data, id).roles;
			const removedCount = data.state.capabilities.filter((c) => c.removedAt).length;
			const visible = data.state.capabilities.filter((c) => (filter === "removed" ? Boolean(c.removedAt) : !c.removedAt) && (filter !== "pinned" || c.pinned) && (filter !== "pending" || !c.enabled || !c.versions.length || (c.id === "developer-workspace" ? false : c.id === "requirements-analysis" ? !requirementsStatus?.ready : c.id === "meeting-transcription" ? !meetingStatus?.ready : data.health.state !== "ready")) && (filter !== "unused" || !linked(c.id).length) && `${c.draft.name} ${c.draft.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a, b) => Number(b.pinned) - Number(a.pinned));
			const restore = (id) => void run(async () => {
				await capabilityClient.command({
					type: "capability.restore",
					id
				});
				setNotice("能力已恢复，当前保持停用。可在“管理能力”中检查配置并启用。");
				setFilter("all");
				setSelected(id);
				setTab("overview");
			});
			if (item?.id === "meeting-transcription" || item?.id === "requirements-analysis" || item?.id === "developer-workspace") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: ManagedCapabilities_module_css_default.page,
				"data-capability-center": true,
				"data-meeting-capability-detail": item.id === "meeting-transcription" || void 0,
				"data-workflow-capability-detail": item.id,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: ManagedCapabilities_module_css_default.button,
						onClick: () => meetingNavigate(() => setSelected(null)),
						children: item.removedAt ? "← 返回回收站" : "← 全部能力"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ManagedCapabilities_module_css_default.heading,
						style: { marginTop: 18 },
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.actions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityGlyph, { kind: item.id === "meeting-transcription" ? "audio" : "document" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: item.draft.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: ManagedCapabilities_module_css_default.muted,
								children: ["内置能力 · v", latest(item.versions)?.version ?? 1]
							})] })]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: ManagedCapabilities_module_css_default.actions,
							children: item.removedAt ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: ManagedCapabilities_module_css_default.button,
								disabled: busy,
								onClick: () => restore(item.id),
								children: "恢复能力"
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: ManagedCapabilities_module_css_default.button,
								onClick: () => meetingNavigate(() => setEditor({ id: item.id })),
								children: "编辑能力"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: `${ManagedCapabilities_module_css_default.iconButton} ${ManagedCapabilities_module_css_default.removeAction}`,
								disabled: busy,
								"aria-label": `移除能力：${item.draft.name}`,
								onClick: () => setRemoving(item.id),
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityActionIcon, { kind: "remove" })
							})] })
						})]
					}),
					(error || message) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						className: ManagedCapabilities_module_css_default.error,
						children: message || error
					}),
					notice && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						className: ManagedCapabilities_module_css_default.notice,
						children: notice
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: item.draft.description }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ManagedCapabilities_module_css_default.tabs,
						children: [
							["overview", "概览与连接"],
							["instructions", "使用说明"],
							["defaults", "默认配置"],
							["components", "关联组件"],
							["roles", "使用岗位"]
						].map(([value, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							"aria-pressed": tab === value,
							onClick: () => meetingNavigate(() => setTab(value)),
							children: label
						}, value))
					}),
					tab === "overview" && item.id === "developer-workspace" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "开发工作区已登记。项目、Git 和模型状态在任务中实际检测；新任务默认只读。" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: ManagedCapabilities_module_css_default.check,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: item.enabled,
							disabled: busy || !!item.removedAt,
							onChange: (e) => void run(() => capabilityClient.command({
								type: "capability.toggle",
								id: item.id,
								enabled: e.target.checked
							}))
						}), "启用此能力"]
					})] }),
					tab === "overview" && item.id !== "developer-workspace" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.row,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: item.removedAt ? "此能力已移除" : !item.enabled ? "此能力已停用" : item.id === "requirements-analysis" ? requirementsStatus?.ready ? "需求分析服务可用" : "需求分析待配置" : meetingStatus?.ready ? "语音识别接口已配置" : "语音识别接口待配置" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: item.id === "requirements-analysis" ? requirementsError || requirementsStatus?.message || "正在检查配置…" : meetingStatus?.message ?? "正在检查配置…" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: ManagedCapabilities_module_css_default.button,
								disabled: busy,
								onClick: () => void (item.id === "requirements-analysis" ? refreshRequirements() : refreshMeeting()),
								children: "刷新状态"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: ManagedCapabilities_module_css_default.check,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: item.enabled,
								disabled: busy || !!item.removedAt,
								onChange: (event) => void run(() => capabilityClient.command({
									type: "capability.toggle",
									id: item.id,
									enabled: event.target.checked
								}))
							}), "启用此能力"]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: ManagedCapabilities_module_css_default.muted,
							children: item.id === "requirements-analysis" ? "可由配置了需求分析能力的岗位使用。停用后阻止分析调用，已有资料、需求和确认版本保留。配置状态与实际调用结果分别记录。" : `由${meetingAssistantName}使用。停用后不能新建或继续处理录音；已有纪要和转写记录保留。`
						})
					] }),
					tab === "instructions" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: { whiteSpace: "pre-wrap" },
						children: item.draft.instructions
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: ManagedCapabilities_module_css_default.button,
						disabled: !!item.removedAt,
						onClick: () => setEditor({ id: item.id }),
						children: "编辑说明"
					})] }),
					tab === "defaults" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [compositionReturn && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: ManagedCapabilities_module_css_default.button,
						onClick: returnToComposition,
						children: "← 返回组件组合"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: item.id === "developer-workspace" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DeveloperProjectSettings, {
						disabled: !!item.removedAt,
						onEditingChange: setMeetingEditing
					}) : item.id === "requirements-analysis" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RequirementsSettings, {
						status: requirementsStatus,
						onSaved: acceptRequirementsConfig,
						disabled: !!item.removedAt,
						onEditingChange: setMeetingEditing
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MeetingAsrSettings, {
						status: meetingStatus,
						refresh: refreshMeeting,
						disabled: !!item.removedAt,
						onEditingChange: setMeetingEditing
					}) })] }),
					tab === "components" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComponentRelations, {
						data,
						capabilityId: item.id,
						meetingStatus,
						requirementsStatus,
						onConfigure: () => configureComponents("relations"),
						onEdit: () => setEditor({
							id: item.id,
							compositionFocus: true
						})
					}, `relations:${item.id}`),
					tab === "roles" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: linked(item.id).map((used) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ManagedCapabilities_module_css_default.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: used.draft.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
							used.enabled ? "已启用" : "已停用",
							" · 已发布 v",
							latest(used.versions)?.version ?? 1
						] })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: ManagedCapabilities_module_css_default.button,
							onClick: () => setRole(used.id),
							children: "编辑岗位 →"
						})]
					}, used.id)) }),
					removing && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RemoveCapabilityDialog, {
						id: removing,
						data,
						onClose: () => setRemoving(null),
						onRemoved: () => {
							setRemoving(null);
							setSelected(null);
							setNotice("能力已移除，可在“回收站”中恢复。");
						}
					}),
					editor && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityEditor, {
						id: editor.id,
						compositionFocus: editor.compositionFocus,
						data,
						meetingStatus,
						requirementsStatus,
						onConfigure: () => configureComponents("editor"),
						onClose: () => setEditor(null),
						onSaved: setSelected
					}, editor.id ?? "new"),
					role && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagedRoleEditor, {
						id: role,
						onClose: () => setRole(null)
					})
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: ManagedCapabilities_module_css_default.page,
				"data-capability-center": true,
				children: [
					!embedded && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ManagedCapabilities_module_css_default.heading,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: "能力中心" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ManagedCapabilities_module_css_default.muted,
							children: "编辑能力、组合组件，再装配到岗位助手。"
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: `${ManagedCapabilities_module_css_default.button} ${ManagedCapabilities_module_css_default.primary}`,
							onClick: () => setEditor({}),
							children: "＋ 创建能力"
						})]
					}),
					(error || message) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						className: ManagedCapabilities_module_css_default.error,
						children: message || error
					}),
					notice && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						className: ManagedCapabilities_module_css_default.notice,
						children: notice
					}),
					item ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: ManagedCapabilities_module_css_default.button,
							onClick: () => setSelected(null),
							children: filter === "removed" ? "← 返回回收站" : "← 全部能力"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.heading,
							style: { marginTop: 18 },
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ManagedCapabilities_module_css_default.actions,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityGlyph, {}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: item.draft.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: ManagedCapabilities_module_css_default.muted,
									children: [
										item.source === "builtin" ? "内置能力" : "我的能力",
										" · ",
										item.versions.length ? `v${latest(item.versions).version}` : "未发布草稿"
									]
								})] })]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ManagedCapabilities_module_css_default.actions,
								children: item.removedAt ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									className: `${ManagedCapabilities_module_css_default.button} ${ManagedCapabilities_module_css_default.inlineAction}`,
									disabled: busy,
									onClick: () => restore(item.id),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityActionIcon, { kind: "restore" }), "恢复能力"]
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: ManagedCapabilities_module_css_default.button,
										onClick: () => setEditor({ id: item.id }),
										children: "编辑能力"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: ManagedCapabilities_module_css_default.button,
										disabled: busy,
										onClick: () => void run(async () => {
											const id = await capabilityClient.command({
												type: "capability.copy",
												id: item.id
											});
											setSelected(id);
											setEditor({ id });
										}),
										children: "复制为我的能力"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: `${ManagedCapabilities_module_css_default.iconButton} ${ManagedCapabilities_module_css_default.removeAction}`,
										disabled: busy,
										"aria-label": `移除能力：${item.draft.name}`,
										title: `移除能力：${item.draft.name}`,
										onClick: () => setRemoving(item.id),
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityActionIcon, { kind: "remove" })
									})
								] })
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: item.draft.description }),
						item.removedAt && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: ManagedCapabilities_module_css_default.notice,
							children: "此能力已移除，配置与岗位引用已保留。恢复后可继续编辑，并按需手动启用。"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: ManagedCapabilities_module_css_default.tabs,
							children: [
								["overview", "概览与连接"],
								["instructions", "使用说明"],
								["defaults", "默认配置"],
								["components", "关联组件"],
								["roles", "使用岗位"]
							].map(([value, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								"aria-pressed": tab === value,
								onClick: () => setTab(value),
								children: label
							}, value))
						}),
						tab === "overview" && item.id === "developer-workspace" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "开发工作区已登记。项目、Git 和模型状态在任务中实际检测；新任务默认只读。" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: ManagedCapabilities_module_css_default.check,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: item.enabled,
								disabled: busy || !!item.removedAt,
								onChange: (e) => void run(() => capabilityClient.command({
									type: "capability.toggle",
									id: item.id,
									enabled: e.target.checked
								}))
							}), "启用此能力"]
						})] }),
						tab === "overview" && item.id !== "developer-workspace" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ManagedCapabilities_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: item.removedAt ? "此能力已移除" : item.enabled ? data.health.message : "此能力已停用" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: ["检测时间：", data.health.checkedAt ? new Date(data.health.checkedAt).toLocaleString() : "尚未检测"] })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ManagedCapabilities_module_css_default.actions,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: ManagedCapabilities_module_css_default.button,
										disabled: busy || !!item.removedAt,
										onClick: () => void run(() => capabilityClient.check()),
										children: "检测连接"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: ManagedCapabilities_module_css_default.button,
										disabled: busy || !!item.removedAt,
										onClick: () => void run(() => capabilityClient.check(true)),
										children: "启动本地连接"
									})]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: ManagedCapabilities_module_css_default.check,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: item.enabled,
									disabled: busy || !!item.removedAt,
									onChange: (e) => void run(() => capabilityClient.command({
										type: "capability.toggle",
										id: item.id,
										enabled: e.target.checked
									}))
								}), "启用此能力"]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: ManagedCapabilities_module_css_default.muted,
								children: [
									"影响范围：",
									linked(item.id).length,
									" 个岗位、",
									capabilityImpact(data, item.id).tasks.length,
									" 个活动会话。停用将立即阻止后续调用，并停止相关浏览器任务；保留配置与岗位引用。"
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ManagedCapabilities_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [linked(item.id).length, " 个岗位引用"] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: ManagedCapabilities_module_css_default.button,
									onClick: () => setTab("roles"),
									children: "查看岗位 →"
								})]
							})
						] }),
						tab === "instructions" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: { whiteSpace: "pre-wrap" },
							children: item.draft.instructions || "尚未填写使用说明。"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: ManagedCapabilities_module_css_default.button,
							disabled: !!item.removedAt,
							onClick: () => setEditor({ id: item.id }),
							children: "编辑说明"
						})] }),
						tab === "defaults" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: ["已发布动作：", actionsOf(latest(item.versions)).map((a) => actionNames[a]).join("、") || "无"] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ManagedCapabilities_module_css_default.notice,
								children: "岗位可覆盖为更少的动作。点击、填写、提交和站点白名单尚未开放。"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: ManagedCapabilities_module_css_default.button,
								disabled: !!item.removedAt,
								onClick: () => setEditor({ id: item.id }),
								children: "编辑组件与动作"
							})
						] }),
						tab === "components" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComponentRelations, {
							data,
							capabilityId: item.id,
							meetingStatus,
							requirementsStatus,
							onConfigure: () => configureComponents("relations"),
							onEdit: () => setEditor({
								id: item.id,
								compositionFocus: true
							})
						}, `relations:${item.id}`),
						tab === "roles" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [linked(item.id).map((r) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ManagedCapabilities_module_css_default.row,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: r.draft.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
								r.versions.length ? `已发布 v${latest(r.versions).version}` : "草稿",
								" · ",
								r.enabled ? "启用" : "停用"
							] })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: ManagedCapabilities_module_css_default.button,
								onClick: () => setRole(r.id),
								children: "编辑岗位 →"
							})]
						}, r.id)), !linked(item.id).length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: ManagedCapabilities_module_css_default.empty,
							children: "尚无岗位使用此能力。"
						})] })
					] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: ManagedCapabilities_module_css_default.search,
							"aria-label": "搜索能力",
							placeholder: "搜索能力名称或用途",
							value: query,
							onChange: (e) => setQuery(e.target.value)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: ManagedCapabilities_module_css_default.tabs,
							children: [
								["all", "全部"],
								["pinned", "收藏"],
								["pending", "待就绪"],
								["unused", "未使用"],
								["removed", `回收站${removedCount ? ` ${removedCount}` : ""}`]
							].map(([value, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								"aria-pressed": filter === value,
								onClick: () => {
									setFilter(value);
									setNotice("");
								},
								children: label
							}, value))
						}),
						filter === "removed" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagedRecycleBin, {
							data,
							query,
							onInspect: (id) => {
								setSelected(id);
								setTab("overview");
								setNotice("");
							},
							onNotice: setNotice
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ManagedCapabilities_module_css_default.grid,
								children: visible.map((c) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagedCapabilityCard, {
									capability: c,
									data,
									busy,
									meetingStatus: c.id === "meeting-transcription" ? meetingStatus : void 0,
									requirementsStatus: c.id === "requirements-analysis" ? requirementsStatus : void 0,
									onManage: () => {
										setSelected(c.id);
										setTab("overview");
										setNotice("");
									},
									onPin: () => void run(() => capabilityClient.command({
										type: "capability.pin",
										id: c.id,
										pinned: !c.pinned
									})),
									onRemove: () => {
										setRemoving(c.id);
										setNotice("");
									},
									onRestore: () => restore(c.id)
								}, c.id))
							}),
							!visible.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ManagedCapabilities_module_css_default.empty,
								children: query.trim() ? "没有找到匹配的能力，试试其他名称或用途。" : filter === "removed" ? "暂无已移除的能力。" : filter === "pinned" ? "暂无收藏能力，点击卡片右上角的图钉即可收藏。" : "没有符合条件的能力。"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: ManagedCapabilities_module_css_default.muted,
								children: [
									"会议录音转写由",
									meetingAssistantName,
									"调用；录音会发送至你配置的识别服务，纪要由工作台已配置的模型生成。其他可组合能力仍按现有配置管理。"
								]
							})
						] })
					] }),
					removing && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RemoveCapabilityDialog, {
						id: removing,
						data,
						onClose: () => setRemoving(null),
						onRemoved: () => {
							setRemoving(null);
							setSelected(null);
							setNotice("能力已移除，可在“回收站”中恢复。");
						}
					}),
					editor && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityEditor, {
						id: editor.id,
						compositionFocus: editor.compositionFocus,
						data,
						meetingStatus,
						requirementsStatus,
						onConfigure: () => configureComponents("editor"),
						onClose: () => setEditor(null),
						onSaved: setSelected
					}, editor.id ?? "new"),
					role && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagedRoleEditor, {
						id: role,
						onClose: () => setRole(null)
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-client-ui-plain-chat/src/client/DeveloperAssistant.module.css.mjs
		const css$4 = "._4WjmSG_workspace{--dev-accent:#22a58b;--dev-bg:var(--dsw-alias-bg-layer-2,#fff);--dev-panel:var(--dsw-alias-bg-layer-1,#f5f7f8);--dev-border:var(--dsw-alias-border-l2,#e2e6e8);--dev-text:var(--dsw-alias-label-primary,#263338);--dev-muted:var(--dsw-alias-label-secondary,#68777d);min-width:0;height:100%;min-height:460px;color:var(--dev-text);background:var(--dev-bg);flex-direction:column;font-size:13px;display:flex;overflow:hidden;container-type:inline-size}._4WjmSG_workspace *,._4WjmSG_dialog *{box-sizing:border-box}._4WjmSG_workspace button,._4WjmSG_dialog button{font:inherit;color:inherit;border:1px solid var(--dev-border,#dce3e5);background:var(--dev-bg,transparent);cursor:pointer;border-radius:7px;padding:6px 10px;line-height:1.4}._4WjmSG_workspace button:hover,._4WjmSG_dialog button:hover{background:#22a58b17}._4WjmSG_workspace button:disabled,._4WjmSG_dialog button:disabled{opacity:.48;cursor:default}._4WjmSG_workspace button:focus-visible,._4WjmSG_workspace input:focus-visible,._4WjmSG_workspace textarea:focus-visible,._4WjmSG_workspace select:focus-visible{outline:2px solid var(--dev-accent);outline-offset:2px}._4WjmSG_workspace button[aria-pressed=true]{color:var(--dev-accent);background:#22a58b17}._4WjmSG_workspace input,._4WjmSG_workspace select,._4WjmSG_workspace textarea,._4WjmSG_dialog input,._4WjmSG_dialog textarea,._4WjmSG_dialog select{font:inherit;color:inherit;background:var(--dev-bg,transparent);border:1px solid var(--dev-border,#dce3e5);border-radius:7px;min-width:0;max-width:100%;padding:8px}._4WjmSG_header{justify-content:space-between;align-items:center;gap:12px;padding:13px 20px 10px;display:flex}._4WjmSG_eyebrow{color:var(--dev-accent);letter-spacing:.12em;font-size:10px}._4WjmSG_header h2{margin:3px 0;font-size:18px;font-weight:650}._4WjmSG_actions,._4WjmSG_codeBar{flex-wrap:wrap;align-items:center;gap:7px;display:flex}._4WjmSG_context{align-items:center;gap:7px;padding:0 20px 10px;display:flex}._4WjmSG_context>span{color:var(--dev-muted);white-space:nowrap;text-overflow:ellipsis;flex:1;min-width:20px;font-size:11px;overflow:hidden}._4WjmSG_context>select{margin-left:auto}._4WjmSG_tabs{border-bottom:1px solid var(--dev-border);flex-shrink:0;gap:5px;padding:0 14px;display:flex;overflow-x:auto}._4WjmSG_tabs button{white-space:nowrap;color:var(--dev-muted);border:0;border-bottom:2px solid #0000;border-radius:0;padding:10px 15px}._4WjmSG_tabs button[aria-selected=true]{color:var(--dev-accent);border-bottom-color:var(--dev-accent);font-weight:650}._4WjmSG_refresh{background:var(--dev-panel);color:var(--dev-muted);justify-content:space-between;align-items:center;padding:5px 20px;font-size:11px;display:flex}._4WjmSG_refresh button{padding:2px 9px;font-size:11px}._4WjmSG_body{flex:1;grid-template-columns:minmax(0,1fr) 322px;min-height:0;display:grid;position:relative;overflow:hidden}._4WjmSG_noChat{grid-template-columns:minmax(0,1fr)}._4WjmSG_main{flex-direction:column;min-width:0;min-height:0;display:flex;overflow:hidden}._4WjmSG_editor{flex:1;min-width:0;min-height:0;display:flex;position:relative}._4WjmSG_files{border-right:1px solid var(--dev-border);background:var(--dev-panel);flex-direction:column;flex:0 0 200px;gap:8px;width:200px;min-height:0;padding:10px;display:flex}._4WjmSG_files ._4WjmSG_codeBar{border:0;justify-content:space-between;padding:0}._4WjmSG_files small{color:var(--dev-muted);font-size:10px}._4WjmSG_files ._4WjmSG_codeBar button{padding:2px 5px;font-size:10px}._4WjmSG_fileRows{flex:1;min-height:0;overflow:auto}._4WjmSG_fileRows button{text-align:left;overflow-wrap:anywhere;border:0;border-radius:5px;width:100%;padding:7px 5px;font-size:11px;display:block}._4WjmSG_fileRows small{display:block}._4WjmSG_fileRows h4{color:var(--dev-muted);margin:17px 4px 6px;font-size:11px}._4WjmSG_fileRows b{color:var(--dev-accent)}._4WjmSG_code{flex-direction:column;flex:1;min-width:0;min-height:0;display:flex;overflow:hidden}._4WjmSG_openFiles{background:var(--dev-panel);flex-shrink:0;display:flex;overflow-x:auto}._4WjmSG_openFiles>span{white-space:nowrap;display:flex}._4WjmSG_openFiles button{border-width:0 1px 1px 0;border-radius:0;font-size:11px}._4WjmSG_codeBar{border-bottom:1px solid var(--dev-border);flex-shrink:0;padding:8px 12px}._4WjmSG_codeBar strong{white-space:nowrap;text-overflow:ellipsis;max-width:260px;font-size:12px;overflow:hidden}._4WjmSG_codeBar small{color:var(--dev-muted);overflow-wrap:anywhere;font-size:10px}._4WjmSG_codeBar button{padding:3px 7px;font-size:11px}._4WjmSG_codeBar h3{margin:0 auto 0 0;font-size:14px}._4WjmSG_codeScroll{flex:1;min-height:0;padding:8px 0 20px;overflow:auto}._4WjmSG_codePane{min-width:0;overflow:auto}._4WjmSG_codeLine{align-items:baseline;min-height:22px;font:12px/1.8 Consolas,ui-monospace,monospace;display:flex}._4WjmSG_codeLine>button{font:inherit;min-width:50px;color:var(--dev-muted);background:0 0;border:0;border-radius:0;flex-shrink:0;padding:0 10px}._4WjmSG_codeLine code{white-space:pre;padding-right:18px}._4WjmSG_selectedLine{background:#22a58b26}._4WjmSG_split{grid-template-columns:minmax(0,1fr) minmax(0,1fr);height:100%;display:grid}._4WjmSG_split>:first-child{border-right:1px solid var(--dev-border)}._4WjmSG_patch{white-space:pre;max-height:55vh;margin:0;padding:6px 14px;font:12px/1.8 Consolas,ui-monospace,monospace;overflow:auto}._4WjmSG_codeScroll>._4WjmSG_patch{max-height:none;overflow:visible}._4WjmSG_patch>span{min-width:fit-content;display:block}._4WjmSG_patch br{display:none}._4WjmSG_added{color:light-dark(#168365,#72cbb4);background:#22a58b21}._4WjmSG_removed{color:light-dark(#bf424c,#ec919b);background:#d4515b1a}._4WjmSG_hunk{color:light-dark(#557db7,#8faee0);background:#557db71a}._4WjmSG_chat{border-left:1px solid var(--dev-border);background:var(--dev-bg);flex-direction:column;min-height:0;display:flex;overflow:hidden}._4WjmSG_chat>._4WjmSG_codeBar{justify-content:space-between}._4WjmSG_messages{flex:1;min-height:0;padding:14px;overflow:auto}._4WjmSG_messages article{overflow-wrap:anywhere;margin-bottom:17px}._4WjmSG_messages small{color:var(--dev-muted);font-size:10px}._4WjmSG_messages p{white-space:pre-wrap;margin:5px 0;line-height:1.7}._4WjmSG_messages pre{white-space:pre-wrap;font-size:11px}._4WjmSG_userMessage{background:var(--dev-panel);border-radius:10px;padding:10px 12px}._4WjmSG_assistantMessage{padding:4px}._4WjmSG_execution{border:1px solid var(--dev-border);border-left:3px solid var(--dev-accent);border-radius:6px;padding:10px;font-size:11px}._4WjmSG_composer{border-top:1px solid var(--dev-border);flex-direction:column;gap:8px;padding:12px;display:flex}._4WjmSG_composer textarea{resize:vertical;width:100%;min-height:104px;max-height:240px;line-height:1.6}._4WjmSG_composer ._4WjmSG_actions{justify-content:space-between}._4WjmSG_composer small{color:var(--dev-muted);font-size:10px}._4WjmSG_contextChips{flex-wrap:wrap;gap:4px;display:flex}._4WjmSG_contextChips button{text-overflow:ellipsis;white-space:nowrap;max-width:100%;font-size:10px;overflow:hidden}._4WjmSG_workspace ._4WjmSG_primary,._4WjmSG_dialog ._4WjmSG_primary{background:var(--dsw-alias-button-primary-fill,#168f77);color:var(--dsw-alias-label-primary-foreground,#fff);border-color:#0000}._4WjmSG_workspace ._4WjmSG_primary:hover,._4WjmSG_dialog ._4WjmSG_primary:hover{background:var(--dsw-alias-button-primary-hover,#107c66)}._4WjmSG_footer{border-top:1px solid var(--dev-border);background:var(--dev-panel);color:var(--dev-muted);justify-content:space-between;align-items:center;gap:8px;padding:6px 14px;font-size:10px;display:flex}._4WjmSG_footer button{border:0;padding:2px;font-size:11px}._4WjmSG_empty{text-align:center;color:var(--dev-muted);padding:32px 22px;line-height:1.8}._4WjmSG_empty input,._4WjmSG_empty select{width:min(520px,100%);margin:12px auto;display:block}._4WjmSG_error{color:#c34350;overflow-wrap:anywhere;background:#c3435012;margin:0;padding:8px 14px;font-size:12px}._4WjmSG_notice{background:#bc8e3114;justify-content:space-between;gap:10px;padding:8px 15px;display:flex}._4WjmSG_scroll{flex:1;min-height:0;padding:16px;overflow:auto}._4WjmSG_row{border-bottom:1px solid var(--dev-border);overflow-wrap:anywhere;justify-content:space-between;align-items:center;gap:12px;padding:12px 2px;display:flex}._4WjmSG_row small,._4WjmSG_card small{color:var(--dev-muted);margin:4px 0;font-size:11px;display:block}._4WjmSG_card{border:1px solid var(--dev-border);overflow-wrap:anywhere;border-radius:9px;margin:12px 0;padding:15px}._4WjmSG_card code{margin:9px 0;font-size:12px;display:block}._4WjmSG_card p{font-size:12px}._4WjmSG_versionGrid{flex:1;grid-template-columns:245px minmax(0,1fr);min-height:0;display:grid}._4WjmSG_history{border-right:1px solid var(--dev-border);overflow:auto}._4WjmSG_history button{text-align:left;border-width:0 0 1px;border-radius:0;width:100%;padding:13px;display:block}._4WjmSG_history b{font-size:12px;display:block}._4WjmSG_history small{color:var(--dev-muted);margin-top:4px;font-size:10px;display:block}._4WjmSG_terminal{color:#d2e5e7;white-space:pre-wrap;overflow-wrap:anywhere;background:#15232a;border-radius:8px;min-height:170px;padding:15px;font:12px/1.7 Consolas,monospace}._4WjmSG_dialog{flex-direction:column;gap:12px;max-height:76vh;padding:18px;display:flex;overflow:auto}._4WjmSG_dialog label{flex-direction:column;gap:7px;display:flex}._4WjmSG_dialog textarea{min-height:100px}._4WjmSG_dialog pre{max-width:100%;overflow:auto}._4WjmSG_fileToggle{display:none}@container (width<=1099px){._4WjmSG_files{display:none}._4WjmSG_filesOpen{z-index:3;width:250px;display:flex;position:absolute;top:0;bottom:0;left:0;box-shadow:8px 0 24px #0002}._4WjmSG_fileToggle{align-self:start;margin:6px 10px;display:block;font-size:11px!important}._4WjmSG_versionGrid{grid-template-columns:190px minmax(0,1fr)}}@container (width<=799px){._4WjmSG_body{grid-template-columns:minmax(0,1fr)}._4WjmSG_chat{z-index:4;border-left:0;position:absolute;inset:0}._4WjmSG_header{flex-wrap:wrap;padding:10px}._4WjmSG_header h2{font-size:16px}._4WjmSG_header ._4WjmSG_actions button{font-size:11px}._4WjmSG_context{flex-wrap:wrap;padding:0 10px 8px}._4WjmSG_context span{flex-basis:100%;order:4}._4WjmSG_context select{max-width:110px}._4WjmSG_tabs{padding:0 5px}._4WjmSG_tabs button{padding:9px 12px}._4WjmSG_versionGrid{grid-template-columns:minmax(0,1fr);overflow:auto}._4WjmSG_history{max-height:200px}._4WjmSG_versionGrid ._4WjmSG_code{min-height:330px}._4WjmSG_footer>span{display:none}._4WjmSG_row{flex-wrap:wrap}._4WjmSG_codeBar strong{max-width:100%}}@media (prefers-color-scheme:dark){._4WjmSG_workspace{--dev-bg:var(--dsw-alias-bg-layer-2,#192126);--dev-panel:var(--dsw-alias-bg-layer-1,#202b31);--dev-border:var(--dsw-alias-border-l2,#35434a);--dev-text:var(--dsw-alias-label-primary,#deeaec);--dev-muted:var(--dsw-alias-label-secondary,#99a9af)}._4WjmSG_added{color:#72cbb4}._4WjmSG_removed{color:#ec919b}}._4WjmSG_dialog{--dev-bg:var(--dsw-alias-bg-layer-2,#fff);--dev-border:var(--dsw-alias-border-l2,#e2e6e8);color:var(--dsw-alias-label-primary,#263338);background:var(--dev-bg)}";
		const tagId$4 = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/DeveloperAssistant.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var DeveloperAssistant_module_css_default = {
			"actions": "_4WjmSG_actions",
			"added": "_4WjmSG_added",
			"assistantMessage": "_4WjmSG_assistantMessage",
			"body": "_4WjmSG_body",
			"card": "_4WjmSG_card",
			"chat": "_4WjmSG_chat",
			"code": "_4WjmSG_code",
			"codeBar": "_4WjmSG_codeBar",
			"codeLine": "_4WjmSG_codeLine",
			"codePane": "_4WjmSG_codePane",
			"codeScroll": "_4WjmSG_codeScroll",
			"composer": "_4WjmSG_composer",
			"context": "_4WjmSG_context",
			"contextChips": "_4WjmSG_contextChips",
			"dialog": "_4WjmSG_dialog",
			"editor": "_4WjmSG_editor",
			"empty": "_4WjmSG_empty",
			"error": "_4WjmSG_error",
			"execution": "_4WjmSG_execution",
			"eyebrow": "_4WjmSG_eyebrow",
			"fileRows": "_4WjmSG_fileRows",
			"fileToggle": "_4WjmSG_fileToggle",
			"files": "_4WjmSG_files",
			"filesOpen": "_4WjmSG_filesOpen",
			"footer": "_4WjmSG_footer",
			"header": "_4WjmSG_header",
			"history": "_4WjmSG_history",
			"hunk": "_4WjmSG_hunk",
			"main": "_4WjmSG_main",
			"messages": "_4WjmSG_messages",
			"noChat": "_4WjmSG_noChat",
			"notice": "_4WjmSG_notice",
			"openFiles": "_4WjmSG_openFiles",
			"patch": "_4WjmSG_patch",
			"primary": "_4WjmSG_primary",
			"refresh": "_4WjmSG_refresh",
			"removed": "_4WjmSG_removed",
			"row": "_4WjmSG_row",
			"scroll": "_4WjmSG_scroll",
			"selectedLine": "_4WjmSG_selectedLine",
			"split": "_4WjmSG_split",
			"tabs": "_4WjmSG_tabs",
			"terminal": "_4WjmSG_terminal",
			"userMessage": "_4WjmSG_userMessage",
			"versionGrid": "_4WjmSG_versionGrid",
			"workspace": "_4WjmSG_workspace"
		};
		//#endregion
		//#region src/client/DeveloperAssistant.tsx
		const tabs = [
			["develop", "开发"],
			["changes", "变更"],
			["versions", "版本"],
			["runs", "运行"]
		];
		const scopes = [
			["round", "本轮变更"],
			["task", "任务累计"],
			["uncommitted", "未提交"],
			["branch", "分支比较"]
		];
		function saved(key, draft = "") {
			try {
				return {
					cwd: "",
					tab: "develop",
					scope: "uncommitted",
					path: "",
					draft,
					model: "",
					contexts: [],
					chat: true,
					...JSON.parse(sessionStorage.getItem(key) ?? "{}")
				};
			} catch {
				return {
					cwd: "",
					tab: "develop",
					scope: "uncommitted",
					path: "",
					draft,
					model: "",
					contexts: [],
					chat: true
				};
			}
		}
		function Tabs({ values, value, onChange, label }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: DeveloperAssistant_module_css_default.tabs,
				role: "tablist",
				"aria-label": label,
				children: values.map(([id, title], index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					role: "tab",
					"aria-selected": value === id,
					tabIndex: value === id ? 0 : -1,
					onClick: () => onChange(id),
					onKeyDown: (e) => {
						const next = e.key === "ArrowRight" ? (index + 1) % values.length : e.key === "ArrowLeft" ? (index + values.length - 1) % values.length : e.key === "Home" ? 0 : e.key === "End" ? values.length - 1 : -1;
						if (next >= 0) {
							e.preventDefault();
							onChange(values[next][0]);
							(e.currentTarget.parentElement?.children[next])?.focus();
						}
					},
					children: title
				}, id))
			});
		}
		function DeveloperAssistant(props) {
			const storageKey = "workbench-developer-view-" + (props.taskId ?? props.draftKey);
			const [view, setView] = (0, react.useState)(() => saved(storageKey, props.initialDraft)), viewRef = (0, react.useRef)(view);
			viewRef.current = view;
			const set = (patch) => setView((old) => ({
				...old,
				...patch
			}));
			const [task, setTask] = (0, react.useState)(null), taskRef = (0, react.useRef)(task);
			taskRef.current = task;
			const [state, setState] = (0, react.useState)(null), [files, setFiles] = (0, react.useState)([]), [excluded, setExcluded] = (0, react.useState)([]);
			const [projects, setProjects] = (0, react.useState)([]), [projectPath, setProjectPath] = (0, react.useState)(""), [models, setModels] = (0, react.useState)([]);
			const [error, setError] = (0, react.useState)(""), [busy, setBusy] = (0, react.useState)(false), [refreshing, setRefreshing] = (0, react.useState)(false), [updated, setUpdated] = (0, react.useState)(""), [epoch, setEpoch] = (0, react.useState)(0), [fileEpoch, setFileEpoch] = (0, react.useState)(0);
			const [search, setSearch] = (0, react.useState)(""), [matches, setMatches] = (0, react.useState)(null), [changed, setChanged] = (0, react.useState)([]), [compareLabel, setCompareLabel] = (0, react.useState)("");
			const [file, setFile] = (0, react.useState)(null), [diff, setDiff] = (0, react.useState)(null), [showDiff, setShowDiff] = (0, react.useState)(false), [split, setSplit] = (0, react.useState)(false), [opened, setOpened] = (0, react.useState)([]), [group, setGroup] = (0, react.useState)("unstaged");
			const [base, setBase] = (0, react.useState)(""), [selectedRound, setSelectedRound] = (0, react.useState)(""), [checkpoint, setCheckpoint] = (0, react.useState)(""), [versionTab, setVersionTab] = (0, react.useState)("commits"), [runTab, setRunTab] = (0, react.useState)("checks");
			const [graph, setGraph] = (0, react.useState)(null), [branches, setBranches] = (0, react.useState)(null), [worktrees, setWorktrees] = (0, react.useState)(null);
			const [commit, setCommit] = (0, react.useState)(""), [runId, setRunId] = (0, react.useState)(""), [project, setProject] = (0, react.useState)(null), [showFiles, setShowFiles] = (0, react.useState)(false);
			const [dialog, setDialog] = (0, react.useState)(""), [name, setName] = (0, react.useState)(""), [message, setMessage] = (0, react.useState)(""), [preview, setPreview] = (0, react.useState)(null), [previewDiffs, setPreviewDiffs] = (0, react.useState)([]);
			const [restore, setRestore] = (0, react.useState)(null), [settingsDirty, setSettingsDirty] = (0, react.useState)(false);
			const [selectedLines, setSelectedLines] = (0, react.useState)(null), [hunk, setHunk] = (0, react.useState)(0), codeRef = (0, react.useRef)(null);
			const [requestId] = (0, react.useState)(() => {
				const key = storageKey + "-request";
				let id = sessionStorage.getItem(key);
				if (!id) {
					id = crypto.randomUUID();
					sessionStorage.setItem(key, id);
				}
				return id;
			});
			const alive = (0, react.useRef)(true), pending = (0, react.useRef)(false), sending = (0, react.useRef)(null);
			const cwd = task?.cwd ?? view.cwd, running = !!task && (task.rounds.some((r) => r.status === "running") || task.checks.some((c) => c.status === "running"));
			const accept = (next) => {
				props.onCommit(next);
				if (!alive.current) return;
				if (taskRef.current?.id === next.id && taskRef.current.revision > next.revision) return;
				taskRef.current = next;
				setTask(next);
			};
			const run = async (fn) => {
				if (pending.current) return;
				pending.current = true;
				setBusy(true);
				setError("");
				try {
					await fn();
				} catch (e) {
					if (alive.current) setError(e instanceof Error ? e.message : String(e));
				} finally {
					pending.current = false;
					if (alive.current) setBusy(false);
				}
			};
			const refresh = () => setEpoch((e) => e + 1);
			const ensure = async () => {
				if (taskRef.current) return taskRef.current;
				if (!cwd) throw new Error("请先选择本地项目");
				const next = await developerApi("create", {}, {
					requestId,
					cwd,
					roleId: props.roleId,
					roleVersion: props.roleVersion,
					model: view.model
				});
				accept(next);
				return next;
			};
			const taskAction = async (route, data = {}) => {
				const next = await developerApi(route, {}, {
					id: (await ensure()).id,
					...data
				});
				accept(next);
				refresh();
			};
			const chooseFile = (path, side = "unstaged") => {
				set({ path });
				setGroup(side);
				setSelectedLines(null);
				setShowFiles(false);
				setOpened((items) => items.includes(path) ? items : [...items, path]);
				setHunk(0);
			};
			(0, react.useEffect)(() => {
				alive.current = true;
				developerApi("projects").then(setProjects).catch((e) => setError(e.message));
				props.loadModels().then(setModels).catch((e) => setError(e.message));
				return () => {
					alive.current = false;
				};
			}, []);
			(0, react.useEffect)(() => {
				try {
					sessionStorage.setItem(storageKey, JSON.stringify(view));
				} catch {}
				props.onDraftChange?.(view.draft);
			}, [view, storageKey]);
			(0, react.useEffect)(() => {
				let current = true;
				if (taskRef.current?.id === props.taskId) return;
				if (props.taskId) developerApi("task", { id: props.taskId }).then((next) => {
					if (!current) return;
					accept(next);
					const savedView = saved(storageKey);
					set({
						...savedView,
						cwd: next.cwd,
						draft: savedView.draft || next.draft,
						model: savedView.model || next.model
					});
				}).catch((e) => {
					if (current) setError(e.message);
				});
				return () => {
					current = false;
				};
			}, [props.taskId]);
			(0, react.useEffect)(() => {
				if (!task?.id || !running) return;
				let stopped = false, timer;
				const poll = async () => {
					try {
						const next = await developerApi("task", { id: task.id });
						if (!stopped) accept(next);
					} catch (e) {
						if (!stopped) setError(e.message);
					}
					if (!stopped) timer = setTimeout(poll, 1300);
				};
				timer = setTimeout(poll, 1e3);
				return () => {
					stopped = true;
					clearTimeout(timer);
				};
			}, [task?.id, running]);
			(0, react.useEffect)(() => {
				setState(null);
				setFiles([]);
				setFile(null);
				setDiff(null);
				setOpened([]);
				setSelectedLines(null);
				setUpdated("");
			}, [cwd]);
			(0, react.useEffect)(() => {
				if (!cwd) return;
				let current = true;
				setRefreshing(true);
				Promise.all([
					developerApi("state", { cwd }),
					developerApi("files", { cwd }),
					developerApi("project", { cwd })
				]).then(([state, listing, config]) => {
					if (!current) return;
					setState(state);
					setFiles(listing.files);
					setExcluded(listing.excluded);
					setProject(config);
					setUpdated((/* @__PURE__ */ new Date()).toLocaleTimeString());
					setError("");
				}).catch((e) => {
					if (current) setError("刷新失败，保留上次内容：" + e.message);
				}).finally(() => {
					if (current) setRefreshing(false);
				});
				return () => {
					current = false;
				};
			}, [
				cwd,
				epoch,
				running
			]);
			(0, react.useEffect)(() => {
				if (!cwd) return;
				const source = new EventSource(developerUrl("events", { cwd }));
				let timer;
				const change = () => {
					clearTimeout(timer);
					timer = setTimeout(() => {
						refresh();
						setFileEpoch((e) => e + 1);
					}, 700);
				};
				source.addEventListener("change", change);
				window.addEventListener("focus", change);
				source.onerror = () => setError("实时刷新连接中断，正在重连；可手动刷新");
				return () => {
					clearTimeout(timer);
					source.close();
					window.removeEventListener("focus", change);
				};
			}, [cwd]);
			const effectiveScope = view.tab === "versions" && versionTab === "commits" && commit ? "commit" : view.scope === "uncommitted" ? group : view.scope;
			(0, react.useEffect)(() => {
				if (!cwd) return;
				let current = true;
				const load = async () => {
					if (view.tab === "develop" || view.scope === "uncommitted") {
						setChanged([]);
						setCompareLabel("HEAD / 暂存区 / 工作目录");
						return;
					}
					if (effectiveScope === "branch" || effectiveScope === "commit") {
						const ref = effectiveScope === "commit" ? commit : base;
						if (!ref) {
							setChanged([]);
							return;
						}
						const result = await developerApi("compare", {
							cwd,
							ref,
							commit: String(effectiveScope === "commit")
						});
						if (current) {
							setChanged(result.files);
							setCompareLabel((result.base.slice(0, 8) || "空版本") + " → " + result.target.slice(0, 8));
						}
					} else if (task) {
						const result = await developerApi("changes", {
							id: task.id,
							scope: effectiveScope,
							selected: effectiveScope === "round" ? selectedRound : checkpoint
						});
						if (current) {
							setChanged(result.files);
							setCompareLabel(result.label);
						}
					} else {
						setChanged([]);
						setCompareLabel("首次发送或保存任务后记录起点");
					}
				};
				load().catch((e) => {
					if (current) setError(e.message);
				});
				return () => {
					current = false;
				};
			}, [
				cwd,
				view.tab,
				effectiveScope,
				base,
				commit,
				task?.revision,
				state?.fingerprint,
				selectedRound,
				checkpoint
			]);
			(0, react.useEffect)(() => {
				if (!cwd || !view.path) {
					setFile(null);
					setDiff(null);
					return;
				}
				let current = true;
				const load = async () => {
					if (view.tab === "develop" && !showDiff) {
						const data = await developerApi("file", {
							cwd,
							path: view.path
						});
						if (current) {
							setFile(data);
							setDiff(null);
						}
						return;
					}
					const scope = view.tab === "develop" ? group : effectiveScope;
					if ([
						"task",
						"round",
						"checkpoint"
					].includes(scope) && !task) return;
					const data = await developerApi("diff", {
						cwd,
						path: view.path,
						scope,
						id: task?.id ?? "",
						selected: scope === "round" ? selectedRound : checkpoint,
						ref: scope === "commit" ? commit : base
					});
					if (!data.before || !data.after || typeof data.patch !== "string") throw new Error("差异响应无效，请重新读取");
					if (current) {
						setDiff(data);
						setFile(null);
					}
				};
				load().catch((e) => {
					if (current) setError(e.message);
				});
				return () => {
					current = false;
				};
			}, [
				cwd,
				view.path,
				view.tab,
				effectiveScope,
				group,
				showDiff,
				fileEpoch,
				selectedRound,
				checkpoint,
				base,
				commit,
				task?.id
			]);
			(0, react.useEffect)(() => {
				if (!cwd || view.tab !== "versions") return;
				let current = true;
				Promise.all([
					developerApi("graph", { cwd }),
					developerApi("branches", { cwd }),
					developerApi("worktrees", { cwd })
				]).then(([a, b, c]) => {
					if (current) {
						setGraph(a);
						setBranches(b);
						setWorktrees(c);
					}
				}).catch((e) => {
					if (current) setError(e.message);
				});
				return () => {
					current = false;
				};
			}, [
				cwd,
				view.tab,
				epoch
			]);
			const addContext = (instruction = "") => {
				if (!view.path) return;
				const side = selectedLines?.side ?? "after", content = diff ? diff[side] : file;
				if (!content || content.reason) return;
				const lines = content.text.split("\n"), start = selectedLines?.start ?? 1, end = selectedLines?.end ?? Math.min(lines.length, 160);
				const context = {
					path: view.path,
					side,
					version: content.version,
					start,
					end,
					text: lines.slice(start - 1, end).join("\n").slice(0, 16e3)
				};
				set({
					contexts: [...view.contexts.filter((c) => !(c.path === context.path && c.start === context.start && c.side === context.side)), context].slice(-12),
					draft: instruction ? `${instruction} ${view.path}:${start}-${end}\n${view.draft}` : view.draft,
					chat: true
				});
			};
			const send = () => void run(async () => {
				if (!view.draft.trim()) return;
				const sent = view.draft, contexts = view.contexts, current = await ensure();
				sending.current ??= crypto.randomUUID();
				const next = await developerApi("send", {}, {
					id: current.id,
					requestId: sending.current,
					message: sent,
					contexts,
					model: view.model
				});
				sending.current = null;
				accept(next);
				if (viewRef.current.draft === sent) set({
					draft: "",
					contexts: []
				});
				refresh();
			});
			const openCommit = () => void run(async () => {
				await ensure();
				const result = await developerApi("preview", { cwd });
				setPreview(result);
				setPreviewDiffs([]);
				setDialog("commit");
				const diffs = await Promise.all(result.files.filter((path) => !excluded.includes(path)).map((path) => developerApi("diff", {
					cwd,
					path,
					scope: "staged"
				})));
				setPreviewDiffs(diffs);
			});
			const createAt = async (root) => {
				const next = await developerApi("create", {}, {
					requestId: crypto.randomUUID(),
					cwd: root,
					roleId: props.roleId,
					roleVersion: props.roleVersion,
					model: view.model
				});
				accept(next);
				set({
					cwd: root,
					path: "",
					tab: "develop",
					scope: "uncommitted"
				});
				setOpened([]);
				setDialog("");
				refresh();
			};
			const latestCheck = task?.checks.at(-1), selectedCheck = task?.checks.find((c) => c.id === runId) ?? latestCheck;
			const statusText = (check) => ({
				running: "运行中",
				passed: "通过",
				failed: "失败",
				stopped: "已停止",
				interrupted: "已中断"
			})[check.status] + (check.changedDuringRun ? " · 运行期间代码变化" : check.fingerprint !== state?.fingerprint ? " · 当前代码待复验" : "");
			const groups = [
				{
					id: "unstaged",
					title: "未暂存",
					items: state?.files.filter((f) => !f.conflict && f.index !== "?" && f.worktree !== " ") ?? []
				},
				{
					id: "staged",
					title: "已暂存",
					items: state?.files.filter((f) => !f.conflict && f.index !== " " && f.index !== "?") ?? []
				},
				{
					id: "untracked",
					title: "未跟踪",
					items: state?.files.filter((f) => f.index === "?") ?? []
				},
				{
					id: "conflict",
					title: "冲突",
					items: state?.files.filter((f) => f.conflict) ?? []
				}
			];
			const code = (content, side) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: DeveloperAssistant_module_css_default.codePane,
				children: content.reason ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
					className: DeveloperAssistant_module_css_default.empty,
					children: [
						content.reason,
						" · ",
						content.size,
						" 字节"
					]
				}) : content.text.split("\n").map((line, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: `${DeveloperAssistant_module_css_default.codeLine} ${selectedLines?.side === side && index + 1 >= selectedLines.start && index + 1 <= selectedLines.end ? DeveloperAssistant_module_css_default.selectedLine : ""}`,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						title: "点击选择行，Shift 点击扩展片段",
						"aria-label": `选择${side === "before" ? "旧" : "新"}版本第 ${index + 1} 行`,
						onClick: (e) => setSelectedLines(e.shiftKey && selectedLines?.side === side ? {
							side,
							start: Math.min(selectedLines.start, index + 1),
							end: Math.max(selectedLines.start, index + 1)
						} : {
							side,
							start: index + 1,
							end: index + 1
						}),
						children: index + 1
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: line || " " })]
				}, index))
			});
			const codePanel = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: DeveloperAssistant_module_css_default.code,
				"aria-label": "代码与差异",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: DeveloperAssistant_module_css_default.openFiles,
						children: opened.map((path) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							"aria-pressed": view.path === path,
							onClick: () => chooseFile(path, group),
							children: path.split("/").at(-1)
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							"aria-label": "关闭文件 " + path,
							onClick: () => {
								const next = opened.filter((p) => p !== path);
								setOpened(next);
								if (view.path === path) set({ path: next.at(-1) ?? "" });
							},
							children: "×"
						})] }, path))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: DeveloperAssistant_module_css_default.codeBar,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
							title: view.path,
							children: view.path || "选择文件"
						}), view.path && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								onClick: () => {
									setShowDiff(!showDiff);
									if (view.tab !== "develop") set({ tab: "develop" });
								},
								children: view.tab === "develop" && !showDiff ? "查看差异" : "查看代码"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								onClick: () => setFileEpoch((e) => e + 1),
								children: "重新读取"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								onClick: () => addContext(),
								children: "添加到对话"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								onClick: () => void run(async () => {
									await developerApi("open-editor", {}, {
										cwd,
										path: view.path
									});
								}),
								children: "外部编辑器"
							})
						] })]
					}),
					diff && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: DeveloperAssistant_module_css_default.codeBar,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: diff.label }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								"aria-pressed": split,
								onClick: () => setSplit(!split),
								children: split ? "行内差异" : "左右对照"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								onClick: () => {
									const nodes = codeRef.current?.querySelectorAll("[data-hunk]");
									if (!nodes?.length) return;
									const next = (hunk + 1) % nodes.length;
									setHunk(next);
									nodes[next]?.scrollIntoView({ block: "center" });
								},
								children: "下一处修改"
							})
						]
					}),
					selectedLines && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: DeveloperAssistant_module_css_default.codeBar,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
							"已选 ",
							selectedLines.start,
							"–",
							selectedLines.end,
							" 行"
						] }), [
							"解释",
							"审查",
							"修改",
							"补测试"
						].map((label) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							onClick: () => addContext(label),
							children: label
						}, label))]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: DeveloperAssistant_module_css_default.codeScroll,
						ref: codeRef,
						children: file ? code(file, "after") : diff ? diff.before.reason || diff.after.reason ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: DeveloperAssistant_module_css_default.empty,
							children: diff.before.reason || diff.after.reason
						}) : split ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: DeveloperAssistant_module_css_default.split,
							children: [code(diff.before, "before"), code(diff.after, "after")]
						}) : diff.patch ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
							className: DeveloperAssistant_module_css_default.patch,
							children: diff.patch.split("\n").map((line, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								"data-hunk": line.startsWith("@@") || void 0,
								className: line.startsWith("+") ? DeveloperAssistant_module_css_default.added : line.startsWith("-") ? DeveloperAssistant_module_css_default.removed : line.startsWith("@@") ? DeveloperAssistant_module_css_default.hunk : "",
								children: [line || " ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("br", {})]
							}, index))
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: DeveloperAssistant_module_css_default.empty,
							children: "此比较范围内没有文本变化"
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: DeveloperAssistant_module_css_default.empty,
							children: "从左侧选择文件，阅读代码或审阅变化。"
						})
					})
				]
			});
			const fileList = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
				className: `${DeveloperAssistant_module_css_default.files} ${showFiles ? DeveloperAssistant_module_css_default.filesOpen : ""}`,
				"aria-label": "项目文件",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: DeveloperAssistant_module_css_default.codeBar,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: view.tab === "develop" ? "项目文件" : "变更文件" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							onClick: () => setShowFiles(false),
							children: "收起"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						"aria-label": "搜索文件",
						placeholder: "搜索路径或内容",
						value: search,
						onChange: (e) => {
							setSearch(e.target.value);
							setMatches(null);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						onClick: () => void run(async () => setMatches(await developerApi("search", {
							cwd,
							q: search
						}))),
						children: "搜索内容"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: DeveloperAssistant_module_css_default.fileRows,
						children: matches ? matches.map((m, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							onClick: () => {
								chooseFile(m.path);
								set({ tab: "develop" });
								setShowDiff(false);
								setSelectedLines({
									side: "after",
									start: m.line,
									end: m.line
								});
							},
							children: [
								m.path,
								":",
								m.line,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: m.text })
							]
						}, i)) : view.tab === "develop" ? files.filter((path) => path.toLowerCase().includes(search.toLowerCase())).map((path) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							"aria-pressed": view.path === path,
							title: path,
							onClick: () => chooseFile(path),
							children: path
						}, path)) : view.scope === "uncommitted" && effectiveScope !== "commit" ? groups.map((g) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h4", { children: [
							g.title,
							" · ",
							g.items.length
						] }), g.items.filter((f) => f.path.includes(search)).map((f) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							"aria-pressed": view.path === f.path && group === (g.id === "staged" ? "staged" : "unstaged"),
							title: f.oldPath ? `${f.oldPath} → ${f.path}` : f.path,
							onClick: () => chooseFile(f.path, g.id === "staged" ? "staged" : "unstaged"),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: f.index === "?" ? "A" : g.id === "staged" ? f.index : f.worktree }),
								" ",
								f.path
							]
						}, f.path))] }, g.id)) : changed.filter((path) => path.includes(search)).map((path) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							"aria-pressed": view.path === path,
							onClick: () => chooseFile(path),
							children: path
						}, path))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [excluded.length, " 个凭据、生成物或运行目录排除项"] })
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: DeveloperAssistant_module_css_default.workspace,
				"data-dsh-plugin": "developer-assistant",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: DeveloperAssistant_module_css_default.header,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: DeveloperAssistant_module_css_default.eyebrow,
							children: "开发工作区"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: task?.title ?? "新开发任务" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: DeveloperAssistant_module_css_default.actions,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									disabled: busy,
									onClick: () => {
										setName(task?.title ?? "新开发任务");
										setDialog("title");
									},
									children: "任务名称"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									disabled: !cwd,
									onClick: () => setDialog("settings"),
									children: "项目设置"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									"aria-pressed": view.chat,
									onClick: () => set({ chat: !view.chat }),
									children: "对话"
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: DeveloperAssistant_module_css_default.context,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								title: cwd,
								onClick: () => setDialog("project"),
								children: cwd ? cwd.split(/[\\/]/).at(-1) : "选择本地项目"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								onClick: () => {
									set({ tab: "versions" });
									setVersionTab("branches");
								},
								children: !cwd ? "未选择项目" : !state ? "读取 Git 状态…" : state.git ? state.branch || "分离 HEAD" : "未初始化 Git"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								title: cwd,
								children: cwd || "绑定项目后开始阅读和开发"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								"aria-label": "工作权限",
								value: task?.permission ?? "read",
								disabled: busy || !cwd,
								onChange: (e) => {
									const permission = e.target.value;
									run(async () => {
										const current = await ensure();
										accept(await developerApi("settings", {}, {
											id: current.id,
											revision: current.revision,
											settings: { permission }
										}));
									});
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "read",
									children: "只读讨论"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "edit",
									children: "允许编辑"
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tabs, {
						values: tabs,
						value: view.tab,
						onChange: (tab) => set({ tab }),
						label: "开发助手主页签"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: DeveloperAssistant_module_css_default.refresh,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							role: "status",
							children: [refreshing ? "正在刷新…" : updated ? "上次读取 " + updated : "等待选择项目", state ? ` · ${state.files.length} 个变更文件` : ""]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							disabled: !cwd || refreshing,
							onClick: () => {
								refresh();
								setFileEpoch((e) => e + 1);
							},
							children: "刷新"
						})]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						className: DeveloperAssistant_module_css_default.error,
						children: error
					}),
					!cwd ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: DeveloperAssistant_module_css_default.empty,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "选择本地项目" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "先阅读代码；需要修改时，将顶部权限切换为“允许编辑”。" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								"aria-label": "已有项目",
								value: view.cwd,
								onChange: (e) => set({ cwd: e.target.value }),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "",
									children: "选择已登记项目"
								}), projects.map((p) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
									value: p.path,
									children: [
										p.name,
										" · ",
										p.path
									]
								}, p.path))]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								"aria-label": "本地项目路径",
								placeholder: "输入本地项目绝对路径",
								value: projectPath,
								onChange: (e) => setProjectPath(e.target.value)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								disabled: busy || !projectPath.trim(),
								onClick: () => void run(async () => {
									const p = await developerApi("register", {}, { cwd: projectPath });
									set({ cwd: p.path });
									refresh();
								}),
								children: "添加并打开目录"
							})
						]
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						!state?.git && state && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: DeveloperAssistant_module_css_default.notice,
							children: ["当前是普通文件夹，可以浏览和讨论。", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								disabled: busy,
								onClick: () => {
									setDialog("init");
								},
								children: "初始化 Git"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `${DeveloperAssistant_module_css_default.body} ${view.chat ? "" : DeveloperAssistant_module_css_default.noChat}`,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("main", {
								className: DeveloperAssistant_module_css_default.main,
								children: [
									view.tab === "changes" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tabs, {
										values: scopes,
										value: view.scope,
										onChange: (scope) => {
											set({ scope });
											setCheckpoint("");
										},
										label: "比较范围"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: DeveloperAssistant_module_css_default.codeBar,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: compareLabel }),
											view.scope === "round" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
												"aria-label": "开发轮次",
												value: selectedRound,
												onChange: (e) => setSelectedRound(e.target.value),
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "",
													children: "最新一轮"
												}), task?.rounds.map((r, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
													value: r.id,
													children: [
														"第 ",
														i + 1,
														" 轮 · ",
														r.status
													]
												}, r.id))]
											}),
											view.scope === "branch" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												"aria-label": "比较基准",
												placeholder: "输入分支或提交，例如 main",
												value: base,
												onChange: (e) => setBase(e.target.value)
											}),
											view.scope === "uncommitted" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												disabled: busy || !view.path || running,
												onClick: () => void run(() => taskAction("git", { command: {
													type: group === "staged" ? "unstage" : "stage",
													paths: [view.path],
													expected: state
												} })),
												children: group === "staged" ? "取消暂存此文件" : "暂存整个文件"
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												disabled: busy || running,
												onClick: openCommit,
												children: "提交预览"
											})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												onClick: () => set({ scope: "uncommitted" }),
												children: "整理提交"
											})
										]
									})] }),
									(view.tab === "develop" || view.tab === "changes") && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: DeveloperAssistant_module_css_default.fileToggle,
										onClick: () => setShowFiles(!showFiles),
										children: "文件列表"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: DeveloperAssistant_module_css_default.editor,
										children: [fileList, codePanel]
									})] }),
									view.tab === "versions" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tabs, {
											label: "版本页面",
											values: [
												["commits", "提交记录"],
												["branches", "分支与目录"],
												["checkpoints", "检查点"]
											],
											value: versionTab,
											onChange: setVersionTab
										}),
										versionTab === "commits" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: DeveloperAssistant_module_css_default.versionGrid,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
												className: DeveloperAssistant_module_css_default.history,
												children: [graph?.commits.map((c) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
													"aria-pressed": commit === c.oid,
													onClick: () => {
														setCommit(c.oid);
														set({ scope: "commit" });
														chooseFile("");
													},
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("b", { children: [
															c.oid.slice(0, 7),
															" · ",
															c.subject
														] }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
															c.author,
															" · ",
															(/* @__PURE__ */ new Date(c.authorTime * 1e3)).toLocaleString()
														] }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: c.refs.join(" · ") })
													]
												}, c.oid)), !graph?.commits.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: DeveloperAssistant_module_css_default.empty,
													children: "尚无提交记录"
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
												className: DeveloperAssistant_module_css_default.main,
												children: [commit && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: DeveloperAssistant_module_css_default.codeBar,
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: commit.slice(0, 12) }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															onClick: () => void navigator.clipboard.writeText(commit).catch((e) => setError(e.message)),
															children: "复制标识"
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															onClick: () => {
																setBase(commit);
																set({
																	tab: "changes",
																	scope: "branch"
																});
															},
															children: "设为比较起点"
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
															"aria-label": "提交中的文件",
															value: view.path,
															onChange: (e) => chooseFile(e.target.value),
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																value: "",
																children: "选择文件"
															}), changed.map((path) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { children: path }, path))]
														})
													]
												}), codePanel]
											})]
										}),
										versionTab === "branches" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: DeveloperAssistant_module_css_default.scroll,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: DeveloperAssistant_module_css_default.codeBar,
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "本地分支" }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															disabled: busy || running,
															onClick: () => {
																setName("codex/");
																setDialog("branch");
															},
															children: "创建分支"
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															disabled: busy || running,
															onClick: () => {
																setName("");
																setDialog("worktree");
															},
															children: "创建独立目录"
														})
													]
												}),
												branches?.branches.map((b) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: DeveloperAssistant_module_css_default.row,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [b.name, b.current ? " · 当前" : ""] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														onClick: () => {
															setBase(b.name);
															set({
																tab: "changes",
																scope: "branch"
															});
														},
														children: "比较"
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														disabled: busy || running || b.current,
														onClick: () => {
															setName(b.name);
															setDialog("switch");
														},
														children: "切换"
													})] })]
												}, b.name)),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "工作目录" }),
												worktrees?.worktrees.map((w) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: DeveloperAssistant_module_css_default.card,
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [w.branch || "分离 HEAD", w.main ? " · 主目录" : ""] }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: w.path }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: worktrees.tasks?.filter((t) => t.cwd.replaceAll("\\", "/") === w.path.replaceAll("\\", "/")).map((t) => t.title + (t.running ? "（运行中）" : "")).join("、") || "暂无开发任务" }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															disabled: busy || w.path.replaceAll("\\", "/") === cwd.replaceAll("\\", "/"),
															onClick: () => void run(async () => {
																await developerApi("register", {}, { cwd: w.path });
																await createAt(w.path);
															}),
															children: "在此目录新建开发任务"
														})
													]
												}, w.path))
											]
										}),
										versionTab === "checkpoints" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: DeveloperAssistant_module_css_default.scroll,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: DeveloperAssistant_module_css_default.codeBar,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "任务检查点" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														disabled: busy || running,
														onClick: () => {
															setName("");
															setDialog("checkpoint");
														},
														children: "新建检查点"
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "保存项目文本快照，排除凭据、生成物、链接及大文件；不会创建 Git 提交。" }),
												task?.checkpoints.map((c) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: DeveloperAssistant_module_css_default.row,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: c.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: new Date(c.at).toLocaleString() })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														onClick: () => {
															setCheckpoint(c.id);
															set({
																tab: "changes",
																scope: "checkpoint"
															});
														},
														children: "与当前比较"
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														disabled: busy || running || task.permission !== "edit",
														onClick: () => void run(async () => {
															setCheckpoint(c.id);
															setRestore(await developerApi("restore-preview", {
																id: task.id,
																checkpoint: c.id
															}));
															setDialog("restore");
														}),
														children: "恢复预览"
													})] })]
												}, c.id))
											]
										})
									] }),
									view.tab === "runs" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tabs, {
										label: "运行页面",
										values: [
											["checks", "验证记录"],
											["output", "终端输出"],
											["events", "操作轨迹"]
										],
										value: runTab,
										onChange: setRunTab
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: DeveloperAssistant_module_css_default.scroll,
										children: [
											runTab === "checks" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: DeveloperAssistant_module_css_default.codeBar,
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "项目检查" }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															onClick: () => setDialog("settings"),
															children: "配置命令"
														}),
														project?.commands.map((c) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
															disabled: busy || running,
															onClick: () => void run(() => taskAction("verify", {
																commandId: c.id,
																requestId: crypto.randomUUID()
															})),
															children: ["运行 ", c.name]
														}, c.id))
													]
												}),
												!project?.commands.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "尚未确认验证命令。可从项目 package.json 中选择脚本，或在项目设置中添加命令。" }),
												task?.checks.slice().reverse().map((c) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: DeveloperAssistant_module_css_default.card,
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [
															c.name,
															" · ",
															statusText(c)
														] }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: c.command }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
															c.cwd,
															" · 代码 ",
															c.fingerprint.slice(0, 10),
															" · ",
															new Date(c.at).toLocaleString()
														] }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "验证对象为工作目录中纳入比较的文件；凭据与生成物不计入指纹。暂存区内容需单独检查。" }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															onClick: () => {
																setRunId(c.id);
																setRunTab("output");
															},
															children: "查看输出"
														}),
														c.status === "running" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															disabled: busy,
															onClick: () => void run(() => taskAction("stop")),
															children: "停止检查"
														})
													]
												}, c.id))
											] }),
											runTab === "output" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
												"aria-label": "选择进程输出",
												value: selectedCheck?.id ?? "",
												onChange: (e) => setRunId(e.target.value),
												children: task?.checks.map((c) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
													value: c.id,
													children: [
														c.name,
														" · ",
														new Date(c.at).toLocaleString()
													]
												}, c.id))
											}), selectedCheck ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
													statusText(selectedCheck),
													" · 退出码 ",
													selectedCheck.exitCode ?? "—"
												] }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
													className: DeveloperAssistant_module_css_default.terminal,
													children: selectedCheck.output || "等待进程输出…"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													onClick: () => set({
														chat: true,
														draft: `请分析这次验证输出：\n${selectedCheck.command}\n${selectedCheck.output.slice(-12e3)}`
													}),
													children: "围绕输出讨论"
												})
											] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "尚无运行输出" })] }),
											runTab === "events" && task?.events.slice().reverse().map((e) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: DeveloperAssistant_module_css_default.row,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
													new Date(e.at).toLocaleTimeString(),
													" · ",
													e.kind
												] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: e.text })] }), e.path && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													onClick: () => {
														chooseFile(e.path);
														set({
															tab: "changes",
															scope: "uncommitted"
														});
													},
													children: e.path
												})]
											}, e.id))
										]
									})] })
								]
							}), view.chat && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
								className: DeveloperAssistant_module_css_default.chat,
								"aria-label": "开发对话",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: DeveloperAssistant_module_css_default.codeBar,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "开发对话" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											onClick: () => set({ chat: false }),
											children: "收起"
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: DeveloperAssistant_module_css_default.messages,
										children: [
											task?.messages.map((m) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
												className: m.role === "user" ? DeveloperAssistant_module_css_default.userMessage : DeveloperAssistant_module_css_default.assistantMessage,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: m.role === "user" ? "你" : "开发助手" }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: m.text }),
													m.contexts?.map((c, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [
														c.path,
														":",
														c.start,
														"–",
														c.end,
														" · ",
														c.version.slice(0, 8)
													] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: c.text })] }, i))
												]
											}, m.id)),
											!task?.messages.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: DeveloperAssistant_module_css_default.empty,
												children: "选中代码行添加上下文，或直接描述要理解和修改的功能。"
											}),
											task?.rounds.at(-1) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: DeveloperAssistant_module_css_default.execution,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: running ? "正在执行" : "最近一轮：" + task.rounds.at(-1).status }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: task.rounds.at(-1)?.error || task.events.at(-1)?.text }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														onClick: () => set({
															tab: "changes",
															scope: "round"
														}),
														children: "查看本轮变更"
													})
												]
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: DeveloperAssistant_module_css_default.composer,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: DeveloperAssistant_module_css_default.contextChips,
												children: view.contexts.map((c, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
													title: c.text,
													onClick: () => set({ contexts: view.contexts.filter((_, j) => i !== j) }),
													children: [
														c.path,
														":",
														c.start,
														"–",
														c.end,
														" ×"
													]
												}, i))
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
												"aria-label": "开发消息",
												placeholder: "描述要理解、修改或验证的功能…",
												value: view.draft,
												onChange: (e) => {
													sending.current = null;
													set({ draft: e.target.value });
												},
												onKeyDown: (e) => {
													if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
														e.preventDefault();
														if (!busy && !running) send();
													}
												}
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
												"aria-label": "开发模型",
												value: view.model,
												onChange: (e) => set({ model: e.target.value }),
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "",
													children: "工作台默认模型"
												}), models.map((m) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: m.id,
													children: m.name
												}, m.id))]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: DeveloperAssistant_module_css_default.actions,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [task?.permission === "edit" ? "允许项目内编辑" : "只读讨论", " · Ctrl+Enter 发送"] }), running ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													disabled: busy,
													onClick: () => void run(() => taskAction("stop")),
													children: "停止"
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: DeveloperAssistant_module_css_default.primary,
													disabled: busy || !view.draft.trim(),
													onClick: send,
													children: busy ? "处理中…" : "发送"
												})]
											})
										]
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
							className: DeveloperAssistant_module_css_default.footer,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								onClick: () => set({ tab: "runs" }),
								children: running ? "执行进行中" : latestCheck ? `${latestCheck.name}：${statusText(latestCheck)}` : "尚未运行验证"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: task ? "任务已保存" : "首次发送或操作时保存任务" })]
						})
					] }),
					dialog && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal$1, {
						title: {
							settings: "项目设置",
							title: "任务名称",
							project: "选择项目",
							commit: "提交预览",
							branch: "创建分支",
							switch: "切换分支",
							worktree: "独立工作目录",
							checkpoint: "新建检查点",
							restore: "恢复检查点",
							init: "初始化 Git"
						}[dialog] ?? "操作",
						closeLabel: "关闭开发操作",
						wide: dialog === "commit" || dialog === "settings",
						onClose: () => {
							if (!settingsDirty || window.confirm("项目设置尚未保存，放弃本次修改？")) {
								setDialog("");
								setSettingsDirty(false);
							}
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: DeveloperAssistant_module_css_default.dialog,
							children: [
								dialog === "settings" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DeveloperProjectSettings, {
									cwd,
									disabled: running,
									onEditingChange: setSettingsDirty,
									onSaved: () => {
										setSettingsDirty(false);
										refresh();
										setDialog("");
									}
								}),
								[
									"title",
									"branch",
									"switch",
									"worktree",
									"checkpoint"
								].includes(dialog) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [dialog === "branch" ? "分支名称（从当前 HEAD 创建并切换）" : dialog === "switch" ? "即将切换到分支；此目录中其他会话也会受到影响" : "名称", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										autoFocus: true,
										"aria-label": "操作名称",
										value: name,
										disabled: dialog === "switch",
										onChange: (e) => setName(e.target.value)
									})] }),
									dialog === "worktree" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "起点为当前 HEAD，原目录的未提交修改保留在原处。创建后会在新目录建立独立任务。" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										className: DeveloperAssistant_module_css_default.primary,
										disabled: busy || !name.trim(),
										onClick: () => void run(async () => {
											if (dialog === "title") {
												const current = await ensure();
												accept(await developerApi("settings", {}, {
													id: current.id,
													revision: current.revision,
													settings: { title: name }
												}));
											}
											if (dialog === "branch" || dialog === "switch") await taskAction("git", { command: {
												type: dialog,
												name
											} });
											if (dialog === "checkpoint") await taskAction("checkpoint", { name });
											if (dialog === "worktree") {
												const result = await developerApi("worktree", {}, {
													id: (await ensure()).id,
													name,
													base: "HEAD"
												});
												await createAt(result.path);
											}
											setDialog("");
											refresh();
										}),
										children: ["确认", dialog === "switch" ? "切换" : "保存"]
									})
								] }),
								dialog === "project" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "更换项目会建立新的开发任务，当前记录保留。" }), projects.map((p) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									disabled: busy,
									onClick: () => void run(async () => {
										if (task) await createAt(p.path);
										else {
											set({
												cwd: p.path,
												path: ""
											});
											setDialog("");
										}
									}),
									children: [
										p.name,
										" · ",
										p.path
									]
								}, p.path))] }),
								dialog === "init" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "在以下目录创建 Git 仓库：" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: cwd }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "现有文件不会自动暂存或提交。建议先检查 .gitignore。" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										disabled: busy,
										onClick: () => void run(async () => {
											await developerApi("init", {}, { cwd });
											setDialog("");
											refresh();
										}),
										children: "初始化此目录"
									})
								] }),
								dialog === "commit" && preview && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
										"提交到 ",
										preview.branch || "分离 HEAD",
										"，完整暂存区共 ",
										preview.files.length,
										" 个文件。原有暂存项一并列在下方。"
									] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: preview.patch }),
									preview.files.map((path) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: path }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
										className: DeveloperAssistant_module_css_default.patch,
										children: previewDiffs.find((d) => d.path === path)?.patch || "正在读取或文件不支持文本预览"
									})] }, path)),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: ["提交说明", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										"aria-label": "提交说明",
										value: message,
										onChange: (e) => setMessage(e.target.value)
									})] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "验证针对工作目录；提交前将重新检查 HEAD 和索引版本。" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: DeveloperAssistant_module_css_default.primary,
										disabled: busy || !message.trim() || !preview.files.length,
										onClick: () => void run(async () => {
											await taskAction("git", { command: {
												type: "commit",
												message,
												expected: preview
											} });
											setMessage("");
											setDialog("");
										}),
										children: "提交到当前分支"
									})
								] }),
								dialog === "restore" && restore && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "仅恢复本任务写入且之后未被改动的文件。暂存区保持原状。" }),
									restore.files.map((f) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
										f.action,
										" ",
										f.path,
										" · ",
										f.reason || "可恢复"
									] }, f.path)),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										disabled: busy || !restore.files.some((f) => !f.reason),
										onClick: () => void run(async () => {
											await taskAction("restore", {
												checkpoint,
												fingerprint: restore.fingerprint,
												paths: restore.files.filter((f) => !f.reason).map((f) => f.path)
											});
											setDialog("");
										}),
										children: "恢复可处理的文件"
									})
								] }),
								error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									role: "alert",
									className: DeveloperAssistant_module_css_default.error,
									children: error
								})
							]
						})
					})
				]
			});
		}
		//#endregion
		//#region src/client/requirements-client.ts
		var RequirementsApiError = class extends Error {
			status;
			constructor(message, status) {
				super(message);
				this.status = status;
				this.name = "RequirementsApiError";
			}
		};
		const endpoint$1 = "/api/capabilities/requirements";
		async function request(path, init) {
			const response = await fetch(`${endpoint$1}${path}`, {
				credentials: "same-origin",
				...init
			});
			const body = await response.json().catch(() => ({ error: "需求分析服务未返回有效数据，请检查工作台运行状态。" }));
			if (!response.ok) throw new RequirementsApiError(body.error || `请求失败（${response.status}）`, response.status);
			return body;
		}
		function post$1(path, body) {
			return request(path, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body)
			});
		}
		const getRequirementConfig = (roleId) => request(`/config?roleId=${encodeURIComponent(roleId)}`);
		const getRequirementTask = (id) => request(`/task/${encodeURIComponent(id)}`);
		const listRequirementTasks = ({ offset = 0, limit = 40 } = {}) => request(`/tasks?offset=${offset}&limit=${limit}`);
		const deleteRequirementTask = (id) => request(`/task/${encodeURIComponent(id)}`, { method: "DELETE" });
		const createRequirementTask = (body) => post$1("/create", body);
		const commandRequirementTask = (id, revision, command) => post$1("/command", {
			id,
			revision,
			command
		});
		const summarizeRequirementTask = (task) => ({
			id: task.id,
			title: task.title,
			mode: task.mode,
			updatedAt: task.updatedAt,
			roleId: task.roleId,
			roleVersion: task.roleVersion,
			confirmed: task.requirements.filter((r) => !r.removed && r.status === "confirmed").length,
			total: task.requirements.filter((r) => !r.removed).length,
			openQuestions: task.questions.filter((q) => !["resolved", "dismissed"].includes(q.status)).length,
			running: task.run?.status === "running"
		});
		function sourceText(task, source) {
			if (source.materialId) {
				const material = task.materials.find((m) => m.id === source.materialId);
				if (!material) return {
					title: "原资料不可用 · 保留引用片段",
					text: source.quote
				};
				const revision = source.revision ?? material.revision;
				const entry = revision === material.revision ? material : material.history.find((h) => h.revision === revision);
				return {
					title: `${entry?.name ?? material.name} · 修订 ${revision}${material.removed ? " · 已移除" : ""}`,
					text: entry?.text ?? source.quote
				};
			}
			const message = task.messages.find((m) => m.id === source.messageId);
			return {
				title: message ? `对话依据 · ${new Date(message.createdAt).toLocaleString()}` : "引用片段",
				text: message?.text ?? source.quote
			};
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-client-ui-plain-chat/src/client/RequirementsAssistant.module.css.mjs
		const css$3 = ".P-xFQa_root{--ink:var(--dsw-alias-label-primary,#202938);--muted:var(--dsw-alias-label-secondary,#758095);--border:var(--dsw-alias-border-l2,#dce3ef);--surface:var(--dsw-alias-bg-layer-2,#fff);--accent:var(--dsw-alias-button-primary-fill,#546da9);--accent-text:var(--dsw-alias-brand-primary,var(--accent));--soft:color-mix(in srgb,var(--accent) 6%,var(--surface));color:var(--ink);background:var(--dsw-alias-bg-layer-1,var(--surface));font:inherit;flex-direction:column;width:100%;height:100%;min-height:0;font-size:13px;display:flex;overflow:hidden}.P-xFQa_root *{box-sizing:border-box}.P-xFQa_root button,.P-xFQa_root input,.P-xFQa_root textarea,.P-xFQa_root select{font:inherit}.P-xFQa_root button{cursor:pointer;border:1px solid var(--border);background:var(--surface);color:var(--ink);border-radius:8px;padding:7px 11px;line-height:1.35;transition:border-color .15s,background .15s}.P-xFQa_root button:hover:not(:disabled){border-color:var(--accent);color:var(--accent-text);background:var(--soft)}.P-xFQa_root button:disabled{opacity:.45;cursor:not-allowed}.P-xFQa_root :is(button,input,textarea,select,summary):focus-visible{outline:2px solid var(--accent);outline-offset:3px}.P-xFQa_root input:not([type=checkbox]),.P-xFQa_root textarea,.P-xFQa_root select{border:1px solid var(--border);color:var(--ink);background:var(--surface);border-radius:8px;min-width:0;padding:9px 11px}.P-xFQa_root input[type=checkbox]{accent-color:var(--accent);cursor:pointer;flex:none;width:15px;height:15px}.P-xFQa_root textarea{resize:vertical;width:100%;line-height:1.65}.P-xFQa_root h2{margin:0 0 6px;font-size:20px;font-weight:650;line-height:1.4}.P-xFQa_root h3{margin:0 0 8px;font-size:14px;font-weight:650;line-height:1.6}.P-xFQa_root p{white-space:pre-wrap;overflow-wrap:anywhere;margin:7px 0;line-height:1.75}.P-xFQa_root small{color:var(--muted);font-size:11px;line-height:1.6}.P-xFQa_root summary{cursor:pointer}.P-xFQa_root details>summary{padding:8px 0}.P-xFQa_primary{color:#fff!important;background:var(--accent)!important;border-color:var(--accent)!important;font-weight:600!important}.P-xFQa_muted{color:var(--muted);font-size:12px;line-height:1.7}.P-xFQa_block{margin-top:5px;display:block}.P-xFQa_heading{border-bottom:1px solid var(--border);flex:none;justify-content:space-between;align-items:center;gap:16px;min-height:66px;padding:13px 28px;display:flex}.P-xFQa_heading>div:first-child{flex-direction:column;gap:4px;min-width:0;display:flex}.P-xFQa_heading strong{text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:650;overflow:hidden}.P-xFQa_saveState{color:var(--muted);font-size:10px}.P-xFQa_heading button{padding:6px 8px;font-size:11px}.P-xFQa_countBadge{border:1px solid var(--border);color:var(--muted);white-space:nowrap;border-radius:6px;padding:4px 7px;font-size:10px}.P-xFQa_tabs{border-bottom:1px solid var(--border);scrollbar-width:thin;flex:none;gap:27px;min-height:43px;padding:0 28px;display:flex;overflow-x:auto}.P-xFQa_tabs button{color:var(--muted);white-space:nowrap;background:0 0;border:0;border-bottom:2px solid #0000;border-radius:0;flex:none;padding:11px 0;font-size:13px}.P-xFQa_tabs button[aria-selected=true]{border-bottom-color:var(--accent);color:var(--ink);font-weight:650}.P-xFQa_tabs button:hover:not(:disabled){border-bottom-color:var(--accent);background:0 0}.P-xFQa_subtabs{background:var(--soft);flex:none}.P-xFQa_subtabs .P-xFQa_tabs{gap:24px;min-height:42px}.P-xFQa_subtabs .P-xFQa_tabs button{font-size:12px}.P-xFQa_scroll{overscroll-behavior:contain;scroll-behavior:smooth;flex:1;min-height:0;overflow:auto}.P-xFQa_chat{width:min(930px,100% - 64px);margin:auto;padding:30px 0}.P-xFQa_intro{align-items:flex-start;gap:15px;margin:3px 0 24px;display:flex}.P-xFQa_intro>span:first-child{border-radius:12px;flex:none;width:38px;height:38px}.P-xFQa_intro>div{min-width:0}.P-xFQa_intro small{font-size:11px;font-weight:650}.P-xFQa_intro h2{margin:4px 0 8px;font-size:21px}.P-xFQa_intro p{color:var(--muted);font-size:13px}.P-xFQa_modes{grid-template-columns:repeat(2,minmax(0,1fr));gap:15px;margin:24px 0;display:grid}.P-xFQa_modes button{text-align:left;border-color:color-mix(in srgb,var(--accent) 28%,var(--border));border-radius:14px;flex-direction:column;align-items:flex-start;min-height:190px;padding:22px;transition:transform .2s,border-color .2s;display:flex;box-shadow:0 4px 20px #182c5006}.P-xFQa_modes button:hover:not(:disabled){transform:translateY(-2px)}.P-xFQa_modes button>span{color:var(--accent-text);background:var(--soft);border-radius:10px;place-items:center;width:34px;height:34px;margin-bottom:13px;font-size:21px;display:grid}.P-xFQa_modes b{font-size:16px}.P-xFQa_modes p{color:var(--muted);font-size:12px}.P-xFQa_modes em{color:var(--accent-text);margin-top:auto;padding-top:15px;font-size:11px;font-style:normal}.P-xFQa_modes button[aria-pressed=true]{border-color:var(--accent);background:var(--soft)}.P-xFQa_modes b small{color:var(--accent-text);margin-left:6px;font-size:10px;font-weight:500}.P-xFQa_chooser{padding:20px 0}.P-xFQa_chooser .P-xFQa_intro{margin:0 0 16px}.P-xFQa_chooser .P-xFQa_intro h2{margin-bottom:6px}.P-xFQa_chooser .P-xFQa_chooserSummary{margin:12px 0;padding:12px 16px}.P-xFQa_chooser .P-xFQa_modes{margin:12px 0}.P-xFQa_chooser .P-xFQa_modes button{min-height:150px;padding:16px}.P-xFQa_chooser .P-xFQa_modes button>span{width:28px;height:28px;margin-bottom:8px;font-size:18px}.P-xFQa_chooser .P-xFQa_modes b{font-size:15px}.P-xFQa_chooser .P-xFQa_modes p{margin:6px 0}.P-xFQa_chooser .P-xFQa_modes em{padding-top:8px}.P-xFQa_chooserSummary{background:var(--soft);border:1px solid var(--border);border-radius:12px;justify-content:space-between;align-items:center;gap:16px;margin:20px 0;padding:17px 20px;display:flex}.P-xFQa_chooserSummary>div{min-width:0}.P-xFQa_chooserSummary strong{overflow-wrap:anywhere;font-size:14px}.P-xFQa_chooserSummary p{color:var(--muted);margin:5px 0 0;font-size:11px}.P-xFQa_chooserSummary button{flex:none;font-size:12px}.P-xFQa_chooserReturn{justify-content:space-between;align-items:center;gap:12px;margin:18px 0;display:flex}.P-xFQa_chooserReturn button{font-size:11px}.P-xFQa_draftRetry{color:var(--muted);border:1px solid var(--border);border-radius:8px;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin:3px 20px;padding:8px 13px;font-size:11px;display:flex}.P-xFQa_draftRetry button{padding:5px 9px;font-size:11px}.P-xFQa_workflow{color:var(--muted);justify-content:center;align-items:center;gap:14px;padding:10px 0;font-size:11px;display:flex}.P-xFQa_workflow i{color:var(--border);font-style:normal}.P-xFQa_toolbar{flex-wrap:wrap;align-items:center;gap:7px;display:flex}.P-xFQa_toolbar button{padding:6px 9px;font-size:11px}.P-xFQa_tag,.P-xFQa_status,.P-xFQa_warningTag{border:1px solid var(--border);width:max-content;color:var(--muted);white-space:nowrap;border-radius:6px;align-items:center;padding:3px 7px;font-size:10px;line-height:1.6;display:inline-flex}.P-xFQa_status[data-status=confirmed],.P-xFQa_status[data-status=resolved]{color:#3e9273;border-color:color-mix(in srgb,#4d9c78 25%,var(--border));background:color-mix(in srgb,#4d9c78 6%,var(--surface))}.P-xFQa_status[data-status=review],.P-xFQa_warningTag{color:#ad7839;background:color-mix(in srgb,#c79b4a 7%,var(--surface));border-color:color-mix(in srgb,#c79b4a 30%,var(--border))}.P-xFQa_card{border:1px solid var(--border);background:var(--surface);border-radius:12px;margin:16px 0;padding:19px 21px}.P-xFQa_card p{font-size:12px}.P-xFQa_sectionHead{justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;display:flex}.P-xFQa_sectionHead>div:first-child{min-width:0}.P-xFQa_sectionHead h3{margin-bottom:0}.P-xFQa_sectionHead p{color:var(--muted);margin:4px 0 0;font-size:12px}.P-xFQa_sectionHead button{white-space:nowrap;font-size:11px}.P-xFQa_userMessage{border:1px solid color-mix(in srgb,var(--accent) 25%,var(--border));background:var(--soft);border-radius:14px 14px 4px;max-width:82%;margin:22px 0 22px auto;padding:13px 17px}.P-xFQa_assistantMessage{margin:24px 0;padding:0 4px}.P-xFQa_assistantMessage small{font-weight:600}.P-xFQa_assistantMessage p,.P-xFQa_userMessage p{margin:5px 0}.P-xFQa_progress{border:1px solid var(--border);border-radius:12px;align-items:center;gap:14px;margin:20px 0;padding:17px;display:flex}.P-xFQa_progress>div{flex:1}.P-xFQa_progress p{color:var(--muted);margin:4px 0 0;font-size:11px}.P-xFQa_spinner{border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;width:20px;height:20px;animation:1.1s linear infinite P-xFQa_spin}@keyframes P-xFQa_spin{to{transform:rotate(360deg)}}.P-xFQa_runError,.P-xFQa_error{color:#b25555;background:color-mix(in srgb,#c46565 7%,var(--surface));border:1px solid color-mix(in srgb,#c46565 25%,var(--border));border-radius:8px;padding:10px 13px;font-size:12px;line-height:1.7}.P-xFQa_runError{margin:18px 0}.P-xFQa_error{white-space:pre-wrap;flex:none;justify-content:space-between;gap:10px;max-height:180px;margin:9px 20px;display:flex;overflow:auto}.P-xFQa_error button,.P-xFQa_notice button{color:inherit;background:0 0;border:0;align-self:flex-start;padding:0 4px}.P-xFQa_notice{background:var(--soft);color:var(--accent-text);border-radius:7px;flex:none;justify-content:space-between;gap:10px;margin:7px 20px;padding:8px 12px;font-size:12px;display:flex}.P-xFQa_availability{background:var(--soft);color:var(--muted);border-bottom:1px solid var(--border);flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;padding:8px 28px;font-size:11px;display:flex}.P-xFQa_availability button{padding:4px 8px;font-size:11px}.P-xFQa_proposal{border:1px solid var(--border);border-radius:9px;margin:10px 0;padding:4px 13px}.P-xFQa_proposal summary{align-items:center;gap:8px;display:flex}.P-xFQa_proposal summary strong{overflow-wrap:anywhere;flex:1;font-size:12px}.P-xFQa_proposal summary small{white-space:nowrap;font-size:10px}.P-xFQa_details{grid-template-columns:92px minmax(0,1fr);gap:8px 12px;margin:12px 0;font-size:12px;line-height:1.65;display:grid}.P-xFQa_details dt{color:var(--muted)}.P-xFQa_details dd{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.P-xFQa_before{background:color-mix(in srgb,#c79b4a 6%,var(--surface));color:var(--muted);border-left:2px solid var(--border);margin-bottom:5px;padding:4px 7px}.P-xFQa_sources{flex-wrap:wrap;gap:6px;margin:5px 0;display:flex}.P-xFQa_sources button{color:var(--accent-text);background:0 0;border:0;padding:2px 0;font-size:10px}.P-xFQa_questionPreview{border-top:1px solid var(--border);padding:12px 0}.P-xFQa_questionPreview b{font-size:12px}.P-xFQa_questionPreview p{color:var(--muted);font-size:11px}.P-xFQa_questionPreview button{margin-right:8px;font-size:11px}.P-xFQa_workspace{width:min(1180px,100% - 56px);margin:0 auto;padding:26px 0 36px}.P-xFQa_stats{grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:22px 0;display:grid}.P-xFQa_stats button{border-radius:12px;flex-direction:column;align-items:flex-start;padding:19px 18px;display:flex}.P-xFQa_stats strong{color:var(--accent-text);letter-spacing:-.5px;font-size:27px;font-weight:600}.P-xFQa_stats strong small{font-size:13px;font-weight:400}.P-xFQa_stats span{color:var(--muted);margin-top:6px;font-size:11px}.P-xFQa_twoColumns{grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px;display:grid}.P-xFQa_twoColumns .P-xFQa_card{margin:7px 0}.P-xFQa_compactList{margin:6px 0 0;padding-left:18px;font-size:12px;line-height:1.8}.P-xFQa_compactList li{padding:5px 0}.P-xFQa_compactList time{color:var(--muted);margin-right:8px;font-size:10px}.P-xFQa_dimmed{opacity:.65}.P-xFQa_excerpt{-webkit-line-clamp:2;color:var(--muted);-webkit-box-orient:vertical;max-width:440px;display:-webkit-box;overflow:hidden;font-size:11px!important}.P-xFQa_filters{flex-wrap:wrap;gap:9px;margin:18px 0;display:flex}.P-xFQa_filters input{flex:1;min-width:150px;max-width:430px}.P-xFQa_filters select{min-width:130px}.P-xFQa_selectionBar{border:1px solid color-mix(in srgb,var(--accent) 30%,var(--border));background:var(--soft);border-radius:9px;flex-wrap:wrap;align-items:center;gap:8px;margin:12px 0;padding:10px 13px;display:flex}.P-xFQa_selectionBar>span{color:var(--accent-text);margin-right:8px;font-size:11px}.P-xFQa_selectionBar button{padding:5px 8px;font-size:11px}.P-xFQa_tableWrap{border:1px solid var(--border);border-radius:11px;margin-top:15px;overflow:auto}.P-xFQa_table{border-collapse:collapse;width:100%;min-width:700px;font-size:12px}.P-xFQa_table th{text-align:left;background:var(--soft);color:var(--muted);white-space:nowrap;padding:11px 12px;font-size:11px;font-weight:500}.P-xFQa_table td{border-top:1px solid var(--border);vertical-align:top;padding:13px 12px}.P-xFQa_table td:first-child{width:34px}.P-xFQa_table td:nth-child(2){width:40%}.P-xFQa_table td:last-child{min-width:130px}.P-xFQa_rowTitle{color:var(--ink);text-align:left;flex-direction:column;gap:3px;display:flex;background:0 0!important;border:0!important;padding:0!important}.P-xFQa_rowTitle small{color:var(--accent-text);font-size:10px}.P-xFQa_rowTitle strong{font-size:13px;font-weight:600}.P-xFQa_rowActions{flex-wrap:wrap;gap:5px;display:flex}.P-xFQa_rowActions button{padding:4px 6px;font-size:10px}.P-xFQa_rowActions details{width:100%}.P-xFQa_rowActions summary{color:var(--muted);font-size:10px;padding:5px 0!important}.P-xFQa_rowActions details>div{flex-wrap:wrap;gap:5px;margin-top:3px;display:flex}.P-xFQa_flowCard{border:1px solid var(--border);background:var(--surface);border-radius:12px;gap:14px;margin:15px 0;padding:19px;display:flex}.P-xFQa_flowCard>div{flex:1;min-width:0}.P-xFQa_flowCard p{font-size:12px}.P-xFQa_stepNumber{background:var(--soft);width:29px;height:29px;color:var(--accent-text);border-radius:9px;flex:none;place-items:center;font-size:12px;display:grid}.P-xFQa_flowDetails{color:var(--muted);grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 20px;margin:10px 0;font-size:11px;line-height:1.75;display:grid}.P-xFQa_choices{flex-wrap:wrap;gap:7px;margin:11px 0;display:flex}.P-xFQa_choices button{color:var(--accent-text);background:var(--soft);font-size:11px}.P-xFQa_field{flex-direction:column;gap:7px;min-width:0;margin:15px 0;display:flex}.P-xFQa_field>span{font-size:12px;font-weight:550}.P-xFQa_field>span small{color:var(--muted);font-size:10px;font-weight:400}.P-xFQa_field textarea{min-height:90px}.P-xFQa_field input,.P-xFQa_field select{width:100%}.P-xFQa_check{align-items:center;gap:6px;font-size:12px;display:inline-flex}.P-xFQa_relations{border:1px solid var(--border);border-radius:9px;margin:16px 0;padding:10px 12px}.P-xFQa_relations legend{color:var(--muted);padding:0 6px;font-size:12px}.P-xFQa_relations label{align-items:center;gap:8px;padding:6px 0;font-size:12px;display:flex}.P-xFQa_documentControls{border:1px solid var(--border);background:var(--soft);border-radius:11px;flex-wrap:wrap;align-items:end;gap:12px;margin:20px 0;padding:8px 16px 16px;display:flex}.P-xFQa_documentControls .P-xFQa_field{flex:1;min-width:140px;margin:5px 0 0}.P-xFQa_documentControls button{min-height:35px;font-size:12px}.P-xFQa_document{border:1px solid var(--border);background:var(--surface);border-radius:12px;margin:20px 0;padding:35px 42px;font-size:12px;line-height:1.85}.P-xFQa_document h1{margin:0 0 20px;font-size:23px}.P-xFQa_document h2{color:var(--accent-text);border-bottom:1px solid var(--border);margin-top:24px;padding-bottom:9px;font-size:17px}.P-xFQa_document h3{margin-top:18px;font-size:14px}.P-xFQa_document p{margin:4px 0}.P-xFQa_docGap{height:5px}.P-xFQa_warning{color:#ad7839;border:1px solid color-mix(in srgb,#c79b4a 35%,var(--border));background:color-mix(in srgb,#c79b4a 7%,var(--surface));border-radius:8px;margin:12px 0;padding:11px 14px;font-size:12px;line-height:1.7}.P-xFQa_versionRow{border-top:1px solid var(--border);align-items:center;gap:10px;padding:12px 0;display:flex}.P-xFQa_versionRow>div{flex:1;min-width:0}.P-xFQa_versionRow strong{font-size:12px;display:block}.P-xFQa_versionRow small{margin-top:4px;display:block}.P-xFQa_versionRow button{font-size:11px}.P-xFQa_timeline{margin:16px 0;padding:10px 0;list-style:none}.P-xFQa_timeline li{border-top:1px solid var(--border);gap:20px;padding:13px 0;display:flex}.P-xFQa_timeline time{color:var(--muted);flex:none;width:110px;padding-top:4px;font-size:11px}.P-xFQa_timeline p{margin:0;font-size:12px}.P-xFQa_timeline button{color:var(--accent-text);background:0 0;border:0;padding:5px 0;font-size:10px}.P-xFQa_composerWrap{flex:none;width:min(970px,100% - 44px);margin:auto;padding:6px 0 14px}.P-xFQa_quickActions{flex-wrap:wrap;gap:6px;margin-bottom:9px;display:flex}.P-xFQa_quickActions button{color:var(--muted);background:0 0;border-radius:7px;padding:5px 9px;font-size:10px}.P-xFQa_composer{border:1px solid var(--border);background:var(--surface);border-radius:18px;padding:12px 15px 10px;box-shadow:0 4px 22px #182c5010}.P-xFQa_composer>textarea{background:0 0;border:0;border-radius:0;min-height:65px;max-height:160px;padding:2px 0;font-size:14px}.P-xFQa_composer>textarea:focus-visible{outline-offset:2px;outline-width:1px}.P-xFQa_composer>textarea::placeholder{color:var(--muted)}.P-xFQa_composerTools,.P-xFQa_composerTools>div{justify-content:space-between;align-items:center;gap:10px;display:flex}.P-xFQa_composerTools button{color:var(--accent-text);background:0 0;border:0;padding:2px 5px;font-size:22px}.P-xFQa_composerTools select{color:var(--muted);border:0;max-width:200px;padding:4px 3px;font-size:10px}.P-xFQa_composerTools small{font-size:10px}.P-xFQa_composerTools .P-xFQa_send{background:var(--accent);color:#fff;border-radius:50%;width:35px;height:35px;font-size:24px}.P-xFQa_contextNote{background:var(--soft);color:var(--accent-text);border-radius:7px;justify-content:space-between;gap:10px;margin-bottom:8px;padding:7px 10px;font-size:11px;display:flex}.P-xFQa_contextNote button{color:var(--accent-text);background:0 0;border:0;padding:0 4px}.P-xFQa_empty{text-align:center;color:var(--muted);flex-direction:column;align-items:center;padding:55px 20px;font-size:12px;line-height:1.8;display:flex}.P-xFQa_empty>span{opacity:.4;padding-bottom:10px;font-size:33px}.P-xFQa_empty h3{color:var(--ink);font-size:15px}.P-xFQa_empty button{margin-top:12px}.P-xFQa_overlay{z-index:1300;backdrop-filter:blur(2px);background:#13213555;justify-content:center;align-items:center;padding:24px;display:flex;position:fixed;inset:0}.P-xFQa_dialog{border:1px solid var(--border);background:var(--surface);width:min(760px,100%);max-height:calc(100dvh - 48px);color:var(--ink);border-radius:15px;flex-direction:column;display:flex;overflow:hidden;box-shadow:0 20px 70px #1118273d}.P-xFQa_dialog:focus{outline:none}.P-xFQa_dialog>header{border-bottom:1px solid var(--border);flex:none;justify-content:space-between;align-items:center;padding:16px 23px;display:flex}.P-xFQa_dialog>header h2{margin:0;font-size:16px}.P-xFQa_dialog>header button{color:var(--muted);background:0 0;border:0;padding:0 5px;font-size:22px}.P-xFQa_dialogBody{min-height:0;padding:12px 24px 22px;overflow:auto}.P-xFQa_dialogBody>.P-xFQa_error{margin:2px 0 10px}.P-xFQa_dialogBody>details{border-top:1px solid var(--border);margin:16px 0}.P-xFQa_dialogBody>details>summary{font-size:13px;font-weight:600}.P-xFQa_dialog>footer{border-top:1px solid var(--border);flex-wrap:wrap;flex:none;justify-content:flex-end;align-items:center;gap:9px;padding:14px 22px;display:flex}.P-xFQa_dialog>footer>span{margin-right:auto;font-size:10px}.P-xFQa_dialog blockquote{border-left:3px solid var(--accent);background:var(--soft);white-space:pre-wrap;margin:14px 0;padding:12px 15px;line-height:1.8}.P-xFQa_rawText{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;margin:12px 0;font-size:12px;line-height:1.85}.P-xFQa_conflict{border:1px solid var(--border);background:var(--soft);border-radius:9px;padding:14px}.P-xFQa_conflict button{font-size:11px}@media (width<=850px){.P-xFQa_heading{padding:12px 18px}.P-xFQa_heading .P-xFQa_countBadge{display:none}.P-xFQa_tabs{gap:22px;padding:0 18px}.P-xFQa_chat{width:calc(100% - 38px)}.P-xFQa_workspace{width:calc(100% - 36px)}.P-xFQa_sectionHead{flex-wrap:wrap}.P-xFQa_stats{gap:8px}.P-xFQa_stats button{padding:15px 12px}.P-xFQa_document{padding:26px}.P-xFQa_flowDetails{grid-template-columns:1fr}}@media (width<=600px){.P-xFQa_root{font-size:12px}.P-xFQa_heading{gap:8px;min-height:58px}.P-xFQa_heading strong{font-size:13px}.P-xFQa_heading .P-xFQa_toolbar{flex:none;gap:4px}.P-xFQa_heading button{padding:5px;font-size:10px}.P-xFQa_tabs,.P-xFQa_subtabs .P-xFQa_tabs{gap:23px;padding:0 15px}.P-xFQa_chat{width:calc(100% - 28px);padding:21px 0}.P-xFQa_intro{gap:10px}.P-xFQa_intro h2{font-size:18px}.P-xFQa_intro p{font-size:11px}.P-xFQa_intro>span:first-child{width:30px;height:30px}.P-xFQa_modes{grid-template-columns:1fr;gap:10px;margin-top:16px}.P-xFQa_modes button{min-height:145px;padding:16px}.P-xFQa_modes button>span{width:26px;height:26px;margin-bottom:9px;font-size:17px}.P-xFQa_modes b{font-size:14px}.P-xFQa_modes em{padding-top:8px}.P-xFQa_workflow{gap:8px;font-size:10px}.P-xFQa_card{padding:15px}.P-xFQa_workspace{width:calc(100% - 28px);padding:20px 0}.P-xFQa_twoColumns{grid-template-columns:1fr}.P-xFQa_stats{grid-template-columns:repeat(2,minmax(0,1fr))}.P-xFQa_stats strong{font-size:24px}.P-xFQa_table{min-width:640px}.P-xFQa_table td,.P-xFQa_table th{padding:10px}.P-xFQa_composerWrap{width:calc(100% - 20px);padding-bottom:8px}.P-xFQa_quickActions{gap:5px}.P-xFQa_quickActions button{padding:5px 6px;font-size:9px}.P-xFQa_composer{border-radius:15px;padding:10px 12px}.P-xFQa_composer>textarea{min-height:58px;font-size:13px}.P-xFQa_composerTools small{display:none}.P-xFQa_composerTools select{max-width:185px}.P-xFQa_error,.P-xFQa_notice{margin:6px 12px;font-size:11px}.P-xFQa_availability{padding:8px 14px}.P-xFQa_proposal{padding:2px 10px}.P-xFQa_proposal summary{flex-wrap:wrap;gap:6px}.P-xFQa_proposal summary strong{flex-basis:60%}.P-xFQa_proposal summary small{padding-left:22px}.P-xFQa_details{grid-template-columns:75px minmax(0,1fr);gap:7px 9px;font-size:11px}.P-xFQa_flowCard{gap:10px;padding:14px}.P-xFQa_stepNumber{width:24px;height:24px}.P-xFQa_flowCard .P-xFQa_sectionHead{margin-bottom:6px}.P-xFQa_flowCard .P-xFQa_toolbar{gap:5px}.P-xFQa_document{padding:22px 18px}.P-xFQa_document h1{font-size:19px}.P-xFQa_document h2{font-size:15px}.P-xFQa_versionRow{flex-wrap:wrap}.P-xFQa_versionRow>div{flex-basis:100%}.P-xFQa_timeline li{flex-direction:column;gap:3px}.P-xFQa_timeline time{width:auto}.P-xFQa_overlay{padding:8px}.P-xFQa_dialog{border-radius:12px;max-height:calc(100dvh - 16px)}.P-xFQa_dialog>header{padding:13px 16px}.P-xFQa_dialogBody{padding:9px 16px 18px}.P-xFQa_dialog>footer{padding:12px 16px}.P-xFQa_dialog>footer>span{display:none}}@media (prefers-reduced-motion:reduce){.P-xFQa_root button,.P-xFQa_modes button{transition:none}.P-xFQa_modes button:hover:not(:disabled){transform:none}.P-xFQa_spinner{animation:none}.P-xFQa_scroll{scroll-behavior:auto}}";
		const tagId$3 = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/RequirementsAssistant.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var RequirementsAssistant_module_css_default = {
			"assistantMessage": "P-xFQa_assistantMessage",
			"availability": "P-xFQa_availability",
			"before": "P-xFQa_before",
			"block": "P-xFQa_block",
			"card": "P-xFQa_card",
			"chat": "P-xFQa_chat",
			"check": "P-xFQa_check",
			"choices": "P-xFQa_choices",
			"chooser": "P-xFQa_chooser",
			"chooserReturn": "P-xFQa_chooserReturn",
			"chooserSummary": "P-xFQa_chooserSummary",
			"compactList": "P-xFQa_compactList",
			"composer": "P-xFQa_composer",
			"composerTools": "P-xFQa_composerTools",
			"composerWrap": "P-xFQa_composerWrap",
			"conflict": "P-xFQa_conflict",
			"contextNote": "P-xFQa_contextNote",
			"countBadge": "P-xFQa_countBadge",
			"details": "P-xFQa_details",
			"dialog": "P-xFQa_dialog",
			"dialogBody": "P-xFQa_dialogBody",
			"dimmed": "P-xFQa_dimmed",
			"docGap": "P-xFQa_docGap",
			"document": "P-xFQa_document",
			"documentControls": "P-xFQa_documentControls",
			"draftRetry": "P-xFQa_draftRetry",
			"empty": "P-xFQa_empty",
			"error": "P-xFQa_error",
			"excerpt": "P-xFQa_excerpt",
			"field": "P-xFQa_field",
			"filters": "P-xFQa_filters",
			"flowCard": "P-xFQa_flowCard",
			"flowDetails": "P-xFQa_flowDetails",
			"heading": "P-xFQa_heading",
			"intro": "P-xFQa_intro",
			"modes": "P-xFQa_modes",
			"muted": "P-xFQa_muted",
			"notice": "P-xFQa_notice",
			"overlay": "P-xFQa_overlay",
			"primary": "P-xFQa_primary",
			"progress": "P-xFQa_progress",
			"proposal": "P-xFQa_proposal",
			"questionPreview": "P-xFQa_questionPreview",
			"quickActions": "P-xFQa_quickActions",
			"rawText": "P-xFQa_rawText",
			"relations": "P-xFQa_relations",
			"root": "P-xFQa_root",
			"rowActions": "P-xFQa_rowActions",
			"rowTitle": "P-xFQa_rowTitle",
			"runError": "P-xFQa_runError",
			"saveState": "P-xFQa_saveState",
			"scroll": "P-xFQa_scroll",
			"sectionHead": "P-xFQa_sectionHead",
			"selectionBar": "P-xFQa_selectionBar",
			"send": "P-xFQa_send",
			"sources": "P-xFQa_sources",
			"spin": "P-xFQa_spin",
			"spinner": "P-xFQa_spinner",
			"stats": "P-xFQa_stats",
			"status": "P-xFQa_status",
			"stepNumber": "P-xFQa_stepNumber",
			"subtabs": "P-xFQa_subtabs",
			"table": "P-xFQa_table",
			"tableWrap": "P-xFQa_tableWrap",
			"tabs": "P-xFQa_tabs",
			"tag": "P-xFQa_tag",
			"timeline": "P-xFQa_timeline",
			"toolbar": "P-xFQa_toolbar",
			"twoColumns": "P-xFQa_twoColumns",
			"userMessage": "P-xFQa_userMessage",
			"versionRow": "P-xFQa_versionRow",
			"warning": "P-xFQa_warning",
			"warningTag": "P-xFQa_warningTag",
			"workflow": "P-xFQa_workflow",
			"workspace": "P-xFQa_workspace"
		};
		//#endregion
		//#region src/client/RequirementsAssistant.tsx
		const mainTabs = [
			["chat", "对话"],
			["workspace", "需求工作区"],
			["trace", "轨迹"]
		];
		const workspaceTabs = [
			["overview", "概览"],
			["materials", "资料"],
			["requirements", "需求清单"],
			["flows", "流程与规则"],
			["questions", "待确认"],
			["document", "需求文档"]
		];
		const priorityNames = {
			must: "必须",
			should: "应该",
			could: "可以"
		};
		const originNames = {
			user: "用户整理",
			source: "资料提取",
			assistant: "助手建议"
		};
		const fieldNames = {
			title: "名称",
			description: "需求描述",
			module: "所属模块",
			kind: "类型",
			priority: "优先级",
			status: "状态",
			actor: "执行角色",
			trigger: "触发条件",
			preconditions: "前置条件",
			steps: "操作步骤",
			rules: "业务规则",
			exceptions: "异常处理",
			inputs: "输入数据",
			outputs: "输出内容",
			acceptance: "验收标准",
			sources: "依据",
			origin: "提出方式",
			name: "名称",
			action: "处理动作",
			condition: "适用条件",
			result: "预期结果",
			next: "下一步",
			exception: "例外 / 异常分支",
			requirementIds: "关联需求",
			question: "需要确认的问题",
			reason: "为什么需要确认",
			options: "可选答案",
			answer: "当前答复",
			blocking: "影响需求确认",
			background: "业务背景与现状",
			goal: "业务目标",
			scope: "本次范围",
			excluded: "暂缓范围 / 外部依赖",
			roles: "使用角色"
		};
		const operationNames = {
			analyze: "整理需求",
			clarify: "引导澄清",
			check: "检查遗漏",
			revise: "讨论修改",
			document: "调整文档内容"
		};
		const editorNames = {
			overview: "编辑分析概览",
			settings: "本次分析设置",
			material: "资料内容",
			requirement: "需求详情",
			flow: "流程步骤",
			rule: "业务规则",
			question: "待确认问题",
			split: "拆分需求",
			merge: "合并需求",
			version: "保存确认版本"
		};
		const id = () => crypto.randomUUID();
		const time = (value) => new Date(value).toLocaleString("zh-CN", {
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit"
		});
		function restoreLocal(key) {
			try {
				return JSON.parse(sessionStorage.getItem(key) ?? "{}");
			} catch {
				return {};
			}
		}
		function rememberLocal(key, value) {
			try {
				sessionStorage.setItem(key, JSON.stringify(value));
			} catch {}
		}
		function TabBar({ items, value, label, onChange }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: RequirementsAssistant_module_css_default.tabs,
				role: "tablist",
				"aria-label": label,
				children: items.map(([key, name], index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					role: "tab",
					"aria-selected": value === key,
					tabIndex: value === key ? 0 : -1,
					onClick: () => onChange(key),
					onKeyDown: (event) => {
						if (![
							"ArrowRight",
							"ArrowLeft",
							"Home",
							"End"
						].includes(event.key)) return;
						event.preventDefault();
						const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
						onChange(items[next][0]);
						(event.currentTarget.parentElement?.children[next])?.focus();
					},
					children: name
				}, key))
			});
		}
		function Empty({ title, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: RequirementsAssistant_module_css_default.empty,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						"aria-hidden": "true",
						children: "▤"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: title }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children })
				]
			});
		}
		function Field({ label, value, onChange, multiline = false, placeholder, required = false }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: RequirementsAssistant_module_css_default.field,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [label, required && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: " 必填" })] }), multiline ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
					"aria-label": label,
					value,
					onChange: (e) => onChange(e.target.value),
					placeholder,
					rows: 3
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					"aria-label": label,
					value,
					onChange: (e) => onChange(e.target.value),
					placeholder
				})]
			});
		}
		function SelectField({ label, value, options, onChange }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: RequirementsAssistant_module_css_default.field,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
					"aria-label": label,
					value,
					onChange: (e) => onChange(e.target.value),
					children: options.map(([key, name]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
						value: key,
						children: name
					}, key))
				})]
			});
		}
		function Modal({ title, children, footer, onClose }) {
			const dialog = (0, react.useRef)(null);
			const close = (0, react.useRef)(onClose);
			close.current = onClose;
			(0, react.useEffect)(() => {
				const previous = document.activeElement;
				dialog.current?.focus();
				return () => {
					if (previous?.isConnected) previous.focus();
				};
			}, []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: RequirementsAssistant_module_css_default.overlay,
				onMouseDown: (e) => {
					if (e.target === e.currentTarget) close.current();
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: dialog,
					className: RequirementsAssistant_module_css_default.dialog,
					role: "dialog",
					"aria-modal": "true",
					"aria-label": title,
					tabIndex: -1,
					onKeyDown: (e) => {
						if (e.key === "Escape") {
							e.stopPropagation();
							close.current();
						}
						if (e.key === "Tab") {
							const focusable = Array.from(dialog.current?.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex=\"0\"]") ?? []);
							const first = focusable[0], last = focusable.at(-1);
							if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
								e.preventDefault();
								last?.focus();
							} else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
								e.preventDefault();
								first?.focus();
							}
						}
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: title }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: onClose,
							"aria-label": "关闭面板",
							children: "×"
						})] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: RequirementsAssistant_module_css_default.dialogBody,
							children
						}),
						footer && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("footer", { children: footer })
					]
				})
			});
		}
		function DocumentPreview({ text }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: RequirementsAssistant_module_css_default.document,
				children: text.split("\n").map((line, i) => line.startsWith("### ") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: line.slice(4) }, i) : line.startsWith("## ") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: line.slice(3) }, i) : line.startsWith("# ") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", { children: line.slice(2) }, i) : line ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: line }, i) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: RequirementsAssistant_module_css_default.docGap }, i))
			});
		}
		function RequirementsAssistant({ taskId, draftKey, initialDraft, roleId, roleVersion, assistant, loadModels, onCommit, onDraftChange }) {
			const instanceId = (0, react.useRef)(draftKey ?? id());
			const storageKey = (0, react.useRef)(`workbench-requirement-edit:${taskId || `new:${instanceId.current}`}`);
			const initial = (0, react.useRef)(restoreLocal(storageKey.current));
			const creationId = (0, react.useRef)(initial.current.creationId ?? id());
			const creationPromise = (0, react.useRef)();
			const [task, setTask] = (0, react.useState)(null);
			const taskRef = (0, react.useRef)(null);
			const commitRef = (0, react.useRef)(onCommit);
			commitRef.current = onCommit;
			const draftChangeRef = (0, react.useRef)(onDraftChange);
			draftChangeRef.current = onDraftChange;
			const mounted = (0, react.useRef)(true);
			const [availability, setAvailability] = (0, react.useState)(null);
			const [models, setModels] = (0, react.useState)([]);
			const [tab, setTab] = (0, react.useState)("chat");
			const [workspace, setWorkspace] = (0, react.useState)("overview");
			const [mode, setMode] = (0, react.useState)(initial.current.mode ?? "guided");
			const modeRef = (0, react.useRef)(mode);
			modeRef.current = mode;
			const [modeSelected, setModeSelected] = (0, react.useState)(initial.current.modeSelected ?? !!taskId);
			const [chatView, setChatView] = (0, react.useState)(initial.current.chatView ?? (taskId ? "work" : "chooser"));
			const [draft, setDraft] = (0, react.useState)(initial.current.draft ?? (taskId ? "" : initialDraft) ?? "");
			const draftRef = (0, react.useRef)(draft);
			draftRef.current = draft;
			const [context, setContext] = (0, react.useState)(initial.current.context ?? "");
			const [editor, setEditor] = (0, react.useState)(initial.current.editor);
			const editorRef = (0, react.useRef)(editor);
			editorRef.current = editor;
			const [source, setSource] = (0, react.useState)();
			const [notice, setNotice] = (0, react.useState)("");
			const [error, setError] = (0, react.useState)("");
			const [loading, setLoading] = (0, react.useState)(!!taskId);
			const [busy, setBusy] = (0, react.useState)(false);
			const busyRef = (0, react.useRef)(false);
			const [draftSaveFailed, setDraftSaveFailed] = (0, react.useState)(false);
			const [selected, setSelected] = (0, react.useState)([]);
			const [proposalSelection, setProposalSelection] = (0, react.useState)([]);
			const [search, setSearch] = (0, react.useState)("");
			const [statusFilter, setStatusFilter] = (0, react.useState)("all");
			const [flowView, setFlowView] = (0, react.useState)("flows");
			const [questionFilter, setQuestionFilter] = (0, react.useState)("active");
			const [answers, setAnswers] = (0, react.useState)(initial.current.answers ?? {});
			const [documentDepth, setDocumentDepth] = (0, react.useState)("standard");
			const [documentRange, setDocumentRange] = (0, react.useState)("all");
			const [versionId, setVersionId] = (0, react.useState)("");
			const [traceFilter, setTraceFilter] = (0, react.useState)("all");
			const [confirm, setConfirm] = (0, react.useState)();
			const fileInput = (0, react.useRef)(null);
			const composer = (0, react.useRef)(null);
			const scrollArea = (0, react.useRef)(null);
			const chooserHeading = (0, react.useRef)(null);
			const chatScroll = (0, react.useRef)({
				chooser: 0,
				work: 0
			});
			const focusChatView = (0, react.useRef)(false);
			const assistantName = assistant?.name ?? "需求分析助手";
			const running = task?.run?.status === "running";
			const requirements = task ? activeRequirements(task) : [];
			const pendingQuestions = task ? openQuestions(task) : [];
			const pendingProposal = task?.proposal?.items.filter((item) => !item.accepted && !item.rejected) ?? [];
			const selectedIds = selected.filter((key) => requirements.some((r) => r.id === key));
			const allSelected = documentRange === "confirmed" ? requirements.filter((r) => r.status === "confirmed").map((r) => r.id) : documentRange === "selected" ? selectedIds : void 0;
			const viewedVersion = task?.versions.find((v) => v.id === versionId);
			const preview = task ? viewedVersion?.markdown ?? task.document?.markdown ?? "" : "";
			const hasUnsavedDraft = task ? task.draft !== draft : !!draft.trim();
			const localDraft = (0, react.useRef)({});
			localDraft.current = {
				draft,
				editor,
				mode,
				modeSelected,
				chatView,
				creationId: creationId.current,
				context,
				answers
			};
			function rememberCurrent() {
				rememberLocal(storageKey.current, localDraft.current);
			}
			function updateDraft(value) {
				draftRef.current = value;
				setDraft(value);
				localDraft.current = {
					...localDraft.current,
					draft: value
				};
				rememberCurrent();
				if (mounted.current) draftChangeRef.current?.(value);
			}
			const acceptTask = (next) => {
				if (taskRef.current && next.id === taskRef.current.id && next.revision < taskRef.current.revision) return;
				taskRef.current = next;
				const key = `workbench-requirement-edit:${next.id}`;
				if (storageKey.current !== key) {
					rememberLocal(key, localDraft.current);
					try {
						sessionStorage.removeItem(storageKey.current);
					} catch {}
					storageKey.current = key;
				}
				if (mounted.current) setTask(next);
				commitRef.current?.(summarizeRequirementTask(next));
			};
			(0, react.useEffect)(() => {
				mounted.current = true;
				getRequirementConfig(roleId).then((value) => {
					if (mounted.current) {
						setAvailability(value);
						if (!taskId) setDocumentDepth(value.defaults.depth);
					}
				}).catch((e) => {
					if (mounted.current) setError(String(e.message ?? e));
				});
				if (loadModels) loadModels().then((value) => {
					if (mounted.current) setModels(value);
				}).catch((e) => {
					if (mounted.current) setNotice(`模型列表暂不可用：${e.message ?? e}，仍可使用工作台默认模型。`);
				});
				if (taskId) getRequirementTask(taskId).then((value) => {
					if (mounted.current) {
						acceptTask(value);
						setMode(value.mode);
						setModeSelected(true);
						setDocumentDepth(value.settings.depth);
						if (initial.current.draft === void 0) setDraft(value.draft);
					}
				}).catch((e) => {
					if (mounted.current) setError(String(e.message ?? e));
				}).finally(() => {
					if (mounted.current) setLoading(false);
				});
				return () => {
					mounted.current = false;
				};
			}, []);
			(0, react.useEffect)(() => {
				rememberCurrent();
			}, [
				draft,
				editor,
				mode,
				modeSelected,
				chatView,
				context,
				answers,
				task?.id
			]);
			(0, react.useLayoutEffect)(() => {
				if (tab !== "chat") return;
				if (scrollArea.current) scrollArea.current.scrollTop = chatScroll.current[chatView];
				if (focusChatView.current) {
					(chatView === "chooser" ? chooserHeading.current : composer.current)?.focus({ preventScroll: true });
					focusChatView.current = false;
				}
			}, [tab, chatView]);
			(0, react.useEffect)(() => {
				if (!task?.id || !running) return;
				const refresh = async () => {
					if (busyRef.current) return;
					try {
						const value = await getRequirementTask(task.id);
						if (mounted.current) acceptTask(value);
					} catch (e) {
						if (mounted.current) setError(`任务状态读取失败：${e instanceof Error ? e.message : e}`);
					}
				};
				const timer = window.setInterval(() => void refresh(), 2500);
				return () => clearInterval(timer);
			}, [task?.id, running]);
			(0, react.useEffect)(() => {
				setProposalSelection(task?.proposal?.items.filter((i) => !i.accepted && !i.rejected).map((i) => i.id) ?? []);
			}, [task?.proposal?.id]);
			(0, react.useEffect)(() => {
				if (loading || taskId && !task || !hasUnsavedDraft || busy || running || draftSaveFailed) return;
				const timer = window.setTimeout(() => {
					persistDraft();
				}, 1e3);
				return () => clearTimeout(timer);
			}, [
				draft,
				task?.draft,
				busy,
				running,
				loading,
				draftSaveFailed
			]);
			(0, react.useEffect)(() => {
				const beforeUnload = (e) => {
					if (editorRef.current || (taskRef.current ? taskRef.current.draft !== draftRef.current : draftRef.current.trim())) {
						e.preventDefault();
						e.returnValue = "";
					}
				};
				window.addEventListener("beforeunload", beforeUnload);
				return () => window.removeEventListener("beforeunload", beforeUnload);
			}, []);
			async function command(value, success, quiet = false) {
				if (busyRef.current || !taskRef.current) return;
				busyRef.current = true;
				setBusy(true);
				if (!quiet) {
					setError("");
					setNotice("");
				}
				try {
					const latest = await commandRequirementTask(taskRef.current.id, taskRef.current.revision, value);
					acceptTask(latest);
					if (success) setNotice(success);
					return latest;
				} catch (e) {
					if (e instanceof RequirementsApiError && e.status === 409) {
						try {
							acceptTask(await getRequirementTask(taskRef.current.id));
						} catch {}
						setError(`${e.message}。已重新读取保存结果，本地输入仍保留；请核对后重试。`);
					} else setError(e instanceof Error ? e.message : String(e));
					return;
				} finally {
					busyRef.current = false;
					if (mounted.current) setBusy(false);
				}
			}
			async function ensureTask(titleHint) {
				if (taskRef.current) return taskRef.current;
				if (creationPromise.current) return creationPromise.current;
				if (busyRef.current || taskId && !taskRef.current) return;
				busyRef.current = true;
				setBusy(true);
				setError("");
				rememberCurrent();
				const pending = (async () => {
					try {
						const settings = {
							...defaultRequirementSettings(),
							...availability?.defaults
						};
						const created = await createRequirementTask({
							roleId,
							roleVersion,
							mode: modeRef.current,
							title: (draftRef.current.trim() || titleHint || "新的需求分析").slice(0, 32),
							settings,
							requestId: creationId.current,
							draft: draftRef.current
						});
						acceptTask(created);
						if (mounted.current) {
							setMode(created.mode);
							setModeSelected(true);
						}
						return created;
					} catch (e) {
						if (mounted.current) {
							setError(e instanceof Error ? e.message : String(e));
							setDraftSaveFailed(!!draftRef.current.trim());
						}
						return;
					} finally {
						busyRef.current = false;
						creationPromise.current = void 0;
						if (mounted.current) setBusy(false);
					}
				})();
				creationPromise.current = pending;
				return pending;
			}
			async function persistDraft(retry = false) {
				if (busyRef.current && !creationPromise.current) return;
				setDraftSaveFailed(false);
				if (retry) setError("");
				if (!taskRef.current && !draftRef.current.trim()) return;
				const current = await ensureTask();
				if (!current) return;
				if (current.draft === draftRef.current) return;
				const saved = await command({
					type: "save",
					draft: draftRef.current
				}, void 0, true);
				if (mounted.current) setDraftSaveFailed(!saved);
			}
			async function begin(selectedMode) {
				if (busyRef.current || taskRef.current?.run?.status === "running") return;
				if (taskRef.current && selectedMode !== taskRef.current.mode) {
					if (!await command({
						type: "save",
						mode: selectedMode
					})) return;
					setNotice(`已切换为${selectedMode === "quick" ? "快速整理" : "引导分析"}，当前内容已保留。`);
				}
				modeRef.current = selectedMode;
				setMode(selectedMode);
				setModeSelected(true);
				focusChatView.current = true;
				setChatView("work");
				setTab("chat");
				localDraft.current = {
					...localDraft.current,
					mode: selectedMode,
					modeSelected: true,
					chatView: "work"
				};
				rememberCurrent();
				composer.current?.focus();
			}
			function showChooser() {
				focusChatView.current = true;
				setChatView("chooser");
				setTab("chat");
				localDraft.current = {
					...localDraft.current,
					chatView: "chooser"
				};
				rememberCurrent();
			}
			function showWork() {
				focusChatView.current = true;
				setChatView("work");
				setTab("chat");
				localDraft.current = {
					...localDraft.current,
					chatView: "work"
				};
				rememberCurrent();
			}
			async function run(operation, instruction = draft, scope = context) {
				if (!instruction.trim() || running || busyRef.current) return;
				const current = await ensureTask();
				if (!current) return;
				if (await command({
					type: "run",
					operation,
					instruction: instruction.trim(),
					context: scope || void 0,
					model: current.settings.model || void 0,
					requestId: id()
				})) {
					if (instruction === draftRef.current) updateDraft("");
					setModeSelected(true);
					showWork();
				}
			}
			async function importFile(file) {
				if (!file) return;
				if (!/\.(txt|md|markdown)$/i.test(file.name)) {
					setError("第一版支持 TXT 和 Markdown 文件，请将其他文档中的文字粘贴到资料页。");
					return;
				}
				const max = availability?.maxTextChars ?? 1e5;
				if (file.size > max * 4) {
					setError(`文件过大，请拆成不超过 ${max.toLocaleString()} 字符的资料。`);
					return;
				}
				try {
					const text = await file.text();
					if (text.includes("\0") || text.length > max) throw new Error(`请使用 UTF-8 文本文件，每份不超过 ${max.toLocaleString()} 字符。`);
					setEditor({
						kind: "material",
						value: {
							name: file.name,
							kind: /\.txt$/i.test(file.name) ? "txt" : "markdown",
							text
						}
					});
					setTab("workspace");
					setWorkspace("materials");
				} catch (e) {
					setError(e instanceof Error ? e.message : String(e));
				}
			}
			function openEditor(kind, object) {
				setError("");
				const value = object ? { ...object } : kind === "requirement" ? emptyRequirement() : kind === "flow" ? {
					name: "",
					actor: "",
					action: "",
					condition: "",
					result: "",
					next: "",
					exception: "",
					requirementIds: []
				} : kind === "rule" ? {
					name: "",
					condition: "",
					action: "",
					exception: "",
					requirementIds: [],
					sources: []
				} : kind === "question" ? {
					question: "",
					reason: "",
					options: [],
					answer: "",
					status: "open",
					blocking: false,
					requirementIds: [],
					sources: []
				} : {
					name: "",
					text: "",
					kind: "text"
				};
				setEditor({
					kind,
					value,
					base: object ? { ...object } : void 0
				});
			}
			function currentEditorObject(edit) {
				const current = taskRef.current;
				if (!current) return void 0;
				if (edit.kind === "overview") return {
					title: current.title,
					...current.overview
				};
				if (edit.kind === "settings") return { ...current.settings };
				return (edit.kind === "requirement" ? current.requirements : edit.kind === "material" ? current.materials : edit.kind === "flow" ? current.flows : edit.kind === "rule" ? current.rules : edit.kind === "question" ? current.questions : []).find((row) => row.id === edit.value.id);
			}
			async function saveEditor() {
				if (!editor || busyRef.current) return;
				const latest = currentEditorObject(editor);
				if (editor.base && JSON.stringify(editor.base) !== JSON.stringify(latest) && !editor.conflict) {
					setEditor({
						...editor,
						conflict: true
					});
					setError("这项内容已有新修订。请对照下方的当前保存内容，再决定保留本地修改或加载新修订。");
					return;
				}
				const v = editor.value, str = (key) => String(v[key] ?? "");
				let value;
				if (editor.kind === "overview") {
					const overview = Object.fromEntries(Object.keys(emptyRequirementOverview()).map((key) => [key, str(key)]));
					if (!str("title").trim()) {
						setError("请填写分析名称。");
						return;
					}
					value = {
						type: "save",
						title: str("title"),
						overview
					};
				} else if (editor.kind === "settings") value = {
					type: "save",
					settings: v
				};
				else if (editor.kind === "requirement") {
					if (!str("title").trim()) {
						setError("请填写需求名称。");
						return;
					}
					value = {
						type: "requirement.save",
						requirement: v
					};
				} else if (editor.kind === "material") {
					if (!str("name").trim() || !str("text").trim()) {
						setError("请填写资料名称和内容。");
						return;
					}
					if (str("text").length > (availability?.maxTextChars ?? 1e5)) {
						setError("资料超过允许的字符数，请拆分后保存。");
						return;
					}
					value = {
						type: "material.save",
						material: v
					};
				} else if (editor.kind === "flow") {
					if (!str("name").trim()) {
						setError("请填写步骤名称。");
						return;
					}
					value = {
						type: "flow.save",
						flow: v
					};
				} else if (editor.kind === "rule") {
					if (!str("name").trim()) {
						setError("请填写规则名称。");
						return;
					}
					value = {
						type: "rule.save",
						rule: v
					};
				} else if (editor.kind === "question") {
					if (!str("question").trim()) {
						setError("请填写需要确认的问题。");
						return;
					}
					value = {
						type: "question.save",
						question: v
					};
				} else if (editor.kind === "split") {
					const titles = str("titles").split("\n").map((t) => t.trim()).filter(Boolean);
					if (titles.length < 2) {
						setError("请至少填写两个新需求名称，每行一个。");
						return;
					}
					value = {
						type: "requirement.split",
						id: str("id"),
						titles
					};
				} else if (editor.kind === "merge") {
					if (!str("title").trim()) {
						setError("请填写合并后的名称。");
						return;
					}
					value = {
						type: "requirement.merge",
						ids: v.ids,
						title: str("title")
					};
				} else value = {
					type: "version.create",
					selectedIds: v.ids,
					note: str("note")
				};
				if (!await ensureTask(editor.kind === "material" ? str("name") : editor.kind === "requirement" ? str("title") : void 0)) return;
				const result = await command(value, editor.kind === "version" ? "确认版本已保存，可在需求文档中查看和导出。" : "修改已保存。");
				if (result) {
					setEditor(void 0);
					if (editor.kind === "settings") setDocumentDepth(result.settings.depth);
					if (editor.kind === "version") {
						setTab("workspace");
						setWorkspace("document");
						setVersionId(result.versions.at(-1)?.id ?? "");
					}
				}
			}
			function discuss(objectId) {
				setContext(objectId);
				showWork();
				composer.current?.focus();
			}
			function goto(next) {
				setTab("workspace");
				setWorkspace(next);
			}
			function sourceLinks(sources) {
				return sources.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: RequirementsAssistant_module_css_default.sources,
					children: sources.map((ref, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setSource(ref),
						title: ref.quote,
						children: ["↗ 依据 ", i + 1]
					}, i))
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: RequirementsAssistant_module_css_default.muted,
					children: "尚未引用原文"
				});
			}
			function contextLabel(objectId) {
				const r = task?.requirements.find((row) => row.id === objectId);
				if (r) return `${r.number} ${r.title}`;
				const q = task?.questions.find((row) => row.id === objectId);
				if (q) return `${q.number} ${q.question}`;
				return [...task?.flows ?? [], ...task?.rules ?? []].find((row) => row.id === objectId)?.name ?? "已移除的讨论对象";
			}
			function displayValue(key, value) {
				if (key === "sources" && Array.isArray(value)) return value.map((ref) => `「${ref.quote}」`).join("\n");
				if (key === "requirementIds" && Array.isArray(value)) return value.map((id) => requirements.find((r) => r.id === id)?.number ?? id).join("、") || "本次分析";
				if (key === "priority") return priorityNames[value] ?? String(value);
				if (key === "status") return {
					...requirementStatusNames,
					...questionStatusNames
				}[value] ?? String(value);
				if (key === "origin") return originNames[value] ?? String(value);
				if (typeof value === "boolean") return value ? "是" : "否";
				return Array.isArray(value) ? value.join("\n") : String(value ?? "");
			}
			function objectDetails(object, before) {
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dl", {
					className: RequirementsAssistant_module_css_default.details,
					children: Object.entries(object).filter(([key, value]) => fieldNames[key] && value !== void 0 && (before || value !== "" && (!Array.isArray(value) || value.length)) && (!before || JSON.stringify(before[key]) !== JSON.stringify(value))).map(([key, value]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.default.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: fieldNames[key] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dd", { children: [before && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RequirementsAssistant_module_css_default.before,
						children: ["原：", displayValue(key, before[key]) || "未填写"]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [before ? "建议：" : "", displayValue(key, value) || "清空此字段"] })] })] }, key))
				});
			}
			function proposalBefore(item) {
				if (!task) return;
				return item.kind === "overview" ? task.overview : item.kind === "requirement" ? task.requirements.find((r) => r.id === item.targetId) : item.kind === "flow" ? task.flows.find((r) => r.id === item.targetId) : item.kind === "rule" ? task.rules.find((r) => r.id === item.targetId) : task.questions.find((r) => r.id === item.targetId);
			}
			async function exportDocument(format) {
				if (!task || !preview) return;
				setError("");
				try {
					if (format === "clipboard") await navigator.clipboard.writeText(preview);
					if (format === "markdown") {
						const blob = new Blob([preview], { type: "text/markdown;charset=utf-8" });
						const url = URL.createObjectURL(blob);
						const a = document.createElement("a");
						a.href = url;
						a.download = `${task.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")}${viewedVersion ? `-V${viewedVersion.number}` : "-讨论稿"}.md`;
						a.click();
						window.setTimeout(() => URL.revokeObjectURL(url), 1e3);
					}
					if (format === "print") {
						const win = window.open("", "_blank");
						if (!win) throw new Error("打印窗口被拦截，请允许此站点打开打印窗口后重试。");
						const escape = (value) => value.replace(/[&<>"']/g, (char) => ({
							"&": "&amp;",
							"<": "&lt;",
							">": "&gt;",
							"\"": "&quot;",
							"'": "&#39;"
						})[char]);
						win.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escape(task.title)}</title><style>body{font:14px/1.8 system-ui,sans-serif;color:#182439;max-width:800px;margin:32px auto}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}@page{size:A4;margin:18mm}</style></head><body><pre>${escape(preview)}</pre></body></html>`);
						win.document.close();
						win.focus();
						win.print();
					}
					await command({
						type: "export",
						format,
						versionId: viewedVersion?.id
					}, format === "clipboard" ? "已复制当前文档。" : format === "markdown" ? "已导出当前 Markdown 文档。" : "已打开系统打印窗口，可选择保存为 PDF。");
				} catch (e) {
					setError(e instanceof Error ? e.message : String(e));
				}
			}
			const modelOptions = [["", "工作台默认模型"], ...models.map((m) => [m.id, m.name])];
			if (task?.settings.model && !modelOptions.some(([value]) => value === task.settings.model)) modelOptions.push([task.settings.model, `${task.settings.model}（已保存）`]);
			const formField = (key, label = fieldNames[key] ?? key, multiline = true, required = false) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
				label,
				value: String(editor?.value[key] ?? ""),
				multiline,
				required,
				onChange: (value) => setEditor((current) => current && {
					...current,
					value: {
						...current.value,
						[key]: value
					}
				})
			}, key);
			const formSelect = (key, label, options) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectField, {
				label,
				value: String(editor?.value[key] ?? ""),
				options,
				onChange: (value) => setEditor((current) => current && {
					...current,
					value: {
						...current.value,
						[key]: value
					}
				})
			});
			const relationField = () => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
				className: RequirementsAssistant_module_css_default.relations,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", { children: "关联需求" }), requirements.length ? requirements.map((r) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: (editor?.value.requirementIds ?? []).includes(r.id),
						onChange: (e) => setEditor((current) => current && {
							...current,
							value: {
								...current.value,
								requirementIds: e.target.checked ? [...current.value.requirementIds ?? [], r.id] : (current.value.requirementIds ?? []).filter((key) => key !== r.id)
							}
						})
					}),
					r.number,
					" ",
					r.title
				] }, r.id)) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "先添加需求，再关联具体条目。未选中时适用于整个分析。" })]
			});
			const renderEditor = () => {
				if (!editor) return null;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Modal, {
					title: editorNames[editor.kind],
					onClose: () => {
						setEditor(void 0);
						setError("");
					},
					footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: RequirementsAssistant_module_css_default.muted,
							children: "保存后更新本次分析"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							onClick: () => setEditor(void 0),
							children: "取消"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: RequirementsAssistant_module_css_default.primary,
							disabled: busy,
							onClick: () => void saveEditor(),
							children: busy ? "正在保存…" : editor.conflict ? "采用本地修改并保存" : editor.kind === "version" ? "保存确认版本" : "保存修改"
						})
					] }),
					children: [
						error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "alert",
							className: RequirementsAssistant_module_css_default.error,
							children: error
						}),
						editor.conflict && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: RequirementsAssistant_module_css_default.conflict,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "当前保存内容" }),
								objectDetails(currentEditorObject(editor) ?? {}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									onClick: () => {
										const current = currentEditorObject(editor);
										if (current) {
											setEditor({
												kind: editor.kind,
												value: { ...current },
												base: { ...current }
											});
											setError("");
										}
									},
									children: "加载当前保存内容"
								})
							]
						}),
						editor.kind === "overview" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [formField("title", "分析名称", false, true), [
							"background",
							"goal",
							"scope",
							"excluded",
							"roles"
						].map((key) => formField(key))] }),
						editor.kind === "settings" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: RequirementsAssistant_module_css_default.twoColumns,
								children: [
									formSelect("purpose", "输出用途", [
										["discussion", "业务讨论"],
										["review", "需求评审"],
										["handoff", "开发交接"]
									]),
									formSelect("depth", "整理深度", [
										["brief", "简要清单"],
										["standard", "标准需求说明"],
										["detailed", "详细规格"]
									]),
									formSelect("questionStyle", "提问节奏", [["short", "少量关键问题"], ["detailed", "逐项详细核对"]]),
									formSelect("model", "分析模型", modelOptions)
								]
							}),
							formField("focus", "关注重点"),
							formField("language", "输出语言", false),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: RequirementsAssistant_module_css_default.muted,
								children: "设置用于后续分析，已有需求和确认版本保持可追溯。"
							})
						] }),
						editor.kind === "material" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							formField("name", "资料名称", false, true),
							formField("text", "资料原文", true, true),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: RequirementsAssistant_module_css_default.muted,
								children: [
									String(editor.value.text ?? "").length.toLocaleString(),
									" / ",
									(availability?.maxTextChars ?? 1e5).toLocaleString(),
									" 字符。保存新修订时保留旧引用所用的原文。"
								]
							}),
							Array.isArray(editor.value.history) && editor.value.history.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [
								"历史原文（",
								editor.value.history.length,
								"）"
							] }), editor.value.history.map((h) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [
								"修订 ",
								h.revision,
								" · ",
								h.name
							] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
								className: RequirementsAssistant_module_css_default.rawText,
								children: h.text
							})] }, h.revision))] })
						] }),
						editor.kind === "requirement" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: RequirementsAssistant_module_css_default.contextNote,
								children: [
									String(editor.value.number ?? "新需求"),
									" · ",
									requirementStatusNames[editor.value.status] ?? "待确认",
									editor.value.status === "confirmed" && " · 修改业务内容后需要重新确认"
								]
							}),
							formField("title", "需求名称", false, true),
							formField("description"),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: RequirementsAssistant_module_css_default.twoColumns,
								children: [
									formField("module", "所属模块", false),
									formField("actor", "使用角色", false),
									formSelect("priority", "优先级", Object.entries(priorityNames)),
									formSelect("kind", "需求类型", [
										["functional", "功能需求"],
										["nonfunctional", "非功能需求"],
										["constraint", "约束"]
									])
								]
							}),
							formField("acceptance", "验收标准（什么情况、什么操作、什么结果）", true),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
								open: true,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: "业务过程与规则" }), [
									"trigger",
									"preconditions",
									"steps",
									"rules",
									"exceptions",
									"inputs",
									"outputs"
								].map((key) => formField(key))]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "原始依据" }),
							sourceLinks(editor.value.sources ?? []),
							!!editor.value.id && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "相关操作记录" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
									className: RequirementsAssistant_module_css_default.compactList,
									children: task?.events.filter((e) => e.objectId === editor.value.id).slice(-8).reverse().map((e) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
										time(e.at),
										" · ",
										e.text
									] }, e.id))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									onClick: () => {
										discuss(String(editor.value.id));
										setEditor(void 0);
									},
									children: "围绕此项讨论 →"
								})
							] })
						] }),
						editor.kind === "flow" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							formField("name", "步骤名称", false, true),
							[
								"actor",
								"action",
								"condition",
								"result",
								"next",
								"exception"
							].map((key) => formField(key, fieldNames[key], key !== "actor")),
							relationField()
						] }),
						editor.kind === "rule" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							formField("name", "规则名称", false, true),
							[
								"condition",
								"action",
								"exception"
							].map((key) => formField(key)),
							relationField(),
							sourceLinks(editor.value.sources ?? [])
						] }),
						editor.kind === "question" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							formField("question", "需要确认的问题", true, true),
							formField("reason"),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
								label: "可选答案（每行一个）",
								multiline: true,
								value: (editor.value.options ?? []).join("\n"),
								onChange: (value) => setEditor({
									...editor,
									value: {
										...editor.value,
										options: value.split("\n")
									}
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: RequirementsAssistant_module_css_default.check,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: !!editor.value.blocking,
									onChange: (e) => setEditor({
										...editor,
										value: {
											...editor.value,
											blocking: e.target.checked
										}
									})
								}), "未处理前，相关需求不能确认"]
							}),
							relationField(),
							sourceLinks(editor.value.sources ?? [])
						] }),
						editor.kind === "split" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "原需求将保留追溯关系，新条目需要分别完善内容和验收标准。" }), formField("titles", "新需求名称（每行一个，至少两条）", true, true)] }),
						editor.kind === "merge" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
							"将合并所选 ",
							editor.value.ids.length,
							" 条需求，原条目保留在已移除记录中。"
						] }), formField("title", "合并后的需求名称", false, true)] }),
						editor.kind === "version" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "固定所选需求的当前内容，作为可导出的确认版本。" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: RequirementsAssistant_module_css_default.compactList,
								children: requirements.filter((r) => editor.value.ids.includes(r.id)).map((r) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
									r.number,
									" ",
									r.title,
									" · ",
									requirementStatusNames[r.status]
								] }, r.id))
							}),
							formField("note", "版本说明（例如：报销基础功能 V1）"),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: RequirementsAssistant_module_css_default.muted,
								children: "保存时检查所选需求的确认状态、验收标准及关联的阻断问题。"
							})
						] })
					]
				});
			};
			const chooserView = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `${RequirementsAssistant_module_css_default.chat} ${RequirementsAssistant_module_css_default.chooser}`,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RequirementsAssistant_module_css_default.intro,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleAppearanceIcon, {
							color: assistant?.color ?? "#9b77bc",
							icon: assistant?.icon ?? {
								kind: "builtin",
								id: "analyst"
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: assistantName }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
								ref: chooserHeading,
								tabIndex: -1,
								children: task ? "选择接下来如何分析" : "选择分析方式"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: task ? "继续处理当前需求，已有资料和结果已保留。" : "提供业务描述、会议纪要或需求初稿，一起梳理流程、功能和需要确认的问题。" })
						] })]
					}),
					task && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: RequirementsAssistant_module_css_default.chooserSummary,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: task.title }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
							task.materials.filter((m) => !m.removed).length,
							" 份资料 · ",
							requirements.length,
							" 条需求 · ",
							pendingQuestions.length,
							" 个待确认问题"
						] })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							onClick: showWork,
							children: "返回对话"
						})]
					}),
					!task && modeSelected && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RequirementsAssistant_module_css_default.chooserReturn,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: RequirementsAssistant_module_css_default.muted,
							children: ["当前方式：", mode === "quick" ? "快速整理" : "引导分析"]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							onClick: showWork,
							children: "返回对话"
						})]
					}),
					running && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: RequirementsAssistant_module_css_default.progress,
						role: "status",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: RequirementsAssistant_module_css_default.spinner }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [
								"正在",
								operationNames[task.run.operation],
								"…"
							] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "本轮结束后可切换分析方式，也可以先停止本轮分析。" })] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								disabled: busy,
								onClick: () => void command({ type: "run.stop" }, "本轮分析已停止，原资料和已保存结果保留。"),
								children: "停止"
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RequirementsAssistant_module_css_default.modes,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							"aria-label": "选择快速整理",
							"aria-pressed": modeSelected && mode === "quick",
							disabled: busy || loading || running,
							onClick: () => void begin("quick"),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "▤" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("b", { children: ["快速整理 ", modeSelected && mode === "quick" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "当前使用" })] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "已有业务描述、会议纪要或需求初稿，优先整理需求清单和待确认问题。" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: "选择快速整理 →" })
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							"aria-label": "选择引导分析",
							"aria-pressed": modeSelected && mode === "guided",
							disabled: busy || loading || running,
							onClick: () => void begin("guided"),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "☷" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("b", { children: ["引导分析 ", modeSelected && mode === "guided" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "当前使用" })] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "从目标和当前问题出发，逐步明确流程、范围与验收。" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: "选择引导分析 →" })
							]
						})]
					}),
					!task && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RequirementsAssistant_module_css_default.workflow,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "提供想法" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { children: "→" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "澄清问题" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { children: "→" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "核对需求" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { children: "→" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "形成文档" })
						]
					})
				]
			});
			const workView = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: RequirementsAssistant_module_css_default.chat,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RequirementsAssistant_module_css_default.intro,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleAppearanceIcon, {
							color: assistant?.color ?? "#9b77bc",
							icon: assistant?.icon ?? {
								kind: "builtin",
								id: "analyst"
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: assistantName }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: task?.messages.length ? "把想法逐步整理成可确认的需求" : "从一个想法，开始讲清需求。" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "提供业务描述、会议纪要或需求初稿，一起梳理流程、功能和需要确认的问题。" })
						] })]
					}),
					!task && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: RequirementsAssistant_module_css_default.toolbar,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: RequirementsAssistant_module_css_default.tag,
							children: ["当前方式：", mode === "quick" ? "快速整理" : "引导分析"]
						})
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: RequirementsAssistant_module_css_default.card,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: mode === "quick" ? "准备好资料后，开始整理" : "先告诉我想解决什么问题" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: RequirementsAssistant_module_css_default.muted,
								children: mode === "quick" ? "粘贴业务描述、会议纪要，或导入文本文件。保存资料后可主动开始整理。" : "描述当前做法、需要解决的问题和业务目标。你也可以先补充资料或手工记录一条需求。"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: RequirementsAssistant_module_css_default.toolbar,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										onClick: () => openEditor("material"),
										children: "＋ 粘贴资料"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										onClick: () => fileInput.current?.click(),
										children: "添加 TXT / Markdown"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										onClick: () => openEditor("requirement"),
										children: "＋ 新增需求"
									})
								]
							})
						]
					})] }),
					task && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: RequirementsAssistant_module_css_default.toolbar,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: RequirementsAssistant_module_css_default.tag,
									children: ["当前方式：", task.mode === "quick" ? "快速整理" : "引导分析"]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: RequirementsAssistant_module_css_default.muted,
									children: [
										task.materials.filter((m) => !m.removed).length,
										" 份资料 · ",
										requirements.length,
										" 条需求"
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									onClick: () => goto("requirements"),
									children: "打开需求清单 →"
								})
							]
						}),
						!task.messages.length && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: RequirementsAssistant_module_css_default.card,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: task.mode === "quick" ? "准备好资料后，开始整理" : "先告诉我想解决什么问题" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: RequirementsAssistant_module_css_default.muted,
									children: task.mode === "quick" ? "添加原文或文本文件，再点击“整理需求清单”。生成的建议会先展示给你核对。" : "例如：目前部门报销依靠表格传递，我希望员工能在线提交并查询审批进度。"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: RequirementsAssistant_module_css_default.toolbar,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											onClick: () => openEditor("material"),
											children: "＋ 粘贴资料"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											onClick: () => fileInput.current?.click(),
											children: "添加 TXT / Markdown"
										}),
										task.materials.some((m) => !m.removed) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: RequirementsAssistant_module_css_default.primary,
											disabled: busy || running,
											onClick: () => void run("analyze", "请根据已有资料整理需求清单、业务流程、规则和待确认问题，并引用真实原文。"),
											children: "开始整理 →"
										})
									]
								})
							]
						}),
						task.messages.map((message) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
							className: message.role === "user" ? RequirementsAssistant_module_css_default.userMessage : RequirementsAssistant_module_css_default.assistantMessage,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
								message.role === "user" ? "你" : assistantName,
								" · ",
								time(message.createdAt),
								message.context && ` · ${contextLabel(message.context)}`
							] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: message.text })]
						}, message.id)),
						running && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: RequirementsAssistant_module_css_default.progress,
							role: "status",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: RequirementsAssistant_module_css_default.spinner }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [
									"正在",
									operationNames[task.run.operation],
									"…"
								] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "可以编辑工作区或切换会话，结果完成后将作为建议显示。" })] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									disabled: busy,
									onClick: () => void command({ type: "run.stop" }, "本轮分析已停止，原资料和已保存结果保留。"),
									children: "停止"
								})
							]
						}),
						task.run && [
							"error",
							"interrupted",
							"stopped"
						].includes(task.run.status) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: RequirementsAssistant_module_css_default.runError,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: task.run.status === "error" ? "本轮分析失败" : task.run.status === "interrupted" ? "上次分析被中断" : "本轮分析已停止" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: task.run.error || "可以调整输入后重试。" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									disabled: busy,
									onClick: () => void run(task.run.operation, task.run.instruction),
									children: "重试本轮分析"
								})
							]
						}),
						task.proposal && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: RequirementsAssistant_module_css_default.card,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: RequirementsAssistant_module_css_default.sectionHead,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "本轮建议 · 采用后加入草稿" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: task.proposal.summary || "核对本轮整理结果" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: RequirementsAssistant_module_css_default.tag,
										children: [pendingProposal.length, " 项待核对"]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: RequirementsAssistant_module_css_default.muted,
									children: "采用表示收进草稿。业务内容仍需在需求清单中逐项确认。"
								}),
								pendingProposal.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
									className: RequirementsAssistant_module_css_default.proposal,
									open: pendingProposal.length <= 3,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												"aria-label": `选择建议 ${item.id}`,
												type: "checkbox",
												checked: proposalSelection.includes(item.id),
												onClick: (e) => e.stopPropagation(),
												onChange: (e) => setProposalSelection((current) => e.target.checked ? [...current, item.id] : current.filter((key) => key !== item.id))
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: RequirementsAssistant_module_css_default.tag,
												children: {
													requirement: "需求",
													flow: "流程",
													rule: "规则",
													question: "问题",
													overview: "概览"
												}[item.kind]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: String(item.value.title || item.value.name || item.value.question || "业务背景与范围") }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: item.targetId || item.kind === "overview" ? "修改建议" : "新增建议" })
										] }),
										objectDetails(item.value, proposalBefore(item)),
										"sources" in item.value && sourceLinks(item.value.sources)
									]
								}, item.id)),
								pendingProposal.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: RequirementsAssistant_module_css_default.toolbar,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: RequirementsAssistant_module_css_default.check,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: pendingProposal.every((p) => proposalSelection.includes(p.id)),
												onChange: (e) => setProposalSelection(e.target.checked ? pendingProposal.map((p) => p.id) : [])
											}), "全选"]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: RequirementsAssistant_module_css_default.primary,
											disabled: busy || !proposalSelection.some((key) => pendingProposal.some((p) => p.id === key)),
											onClick: () => void command({
												type: "proposal.apply",
												proposalId: task.proposal.id,
												ids: proposalSelection.filter((key) => pendingProposal.some((p) => p.id === key))
											}, "已采用选中建议，请在需求清单中继续核对并确认。"),
											children: "采用选中建议"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											disabled: busy || !proposalSelection.length,
											onClick: () => void command({
												type: "proposal.reject",
												proposalId: task.proposal.id,
												ids: proposalSelection.filter((key) => pendingProposal.some((p) => p.id === key))
											}, "所选建议已标记为不采用。"),
											children: "不采用选中"
										})
									]
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: RequirementsAssistant_module_css_default.muted,
									children: "本轮建议已处理。可以继续讨论或检查遗漏。"
								})
							]
						}),
						pendingQuestions.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: RequirementsAssistant_module_css_default.card,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: RequirementsAssistant_module_css_default.sectionHead,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "接下来需要确认" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									onClick: () => goto("questions"),
									children: [
										"全部 ",
										pendingQuestions.length,
										" 项 →"
									]
								})]
							}), pendingQuestions.slice(0, task.settings.questionStyle === "short" ? 3 : 6).map((q) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: RequirementsAssistant_module_css_default.questionPreview,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("b", { children: [
										q.number,
										" · ",
										q.question
									] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: q.reason }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										onClick: () => goto("questions"),
										children: "回答问题"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										disabled: busy,
										onClick: () => void command({
											type: "question.status",
											id: q.id,
											status: "deferred"
										}, "问题已暂缓，稍后可在待确认页继续处理。"),
										children: "暂时跳过"
									})
								]
							}, q.id))]
						})
					] })
				]
			});
			const overviewView = task && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: RequirementsAssistant_module_css_default.sectionHead,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "分析概览" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: task.title })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						onClick: () => openEditor("overview", {
							title: task.title,
							...task.overview
						}),
						children: "编辑基本信息"
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: RequirementsAssistant_module_css_default.stats,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							onClick: () => goto("requirements"),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: requirements.length }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "需求条目" })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							onClick: () => {
								setStatusFilter("confirmed");
								goto("requirements");
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [requirements.filter((r) => r.status === "confirmed").length, /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [" / ", requirements.length] })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "已确认" })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							onClick: () => goto("questions"),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: pendingQuestions.length }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "待确认问题" })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							onClick: () => goto("document"),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: task.versions.length }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "确认版本" })]
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: RequirementsAssistant_module_css_default.twoColumns,
					children: Object.entries(task.overview).map(([key, value]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: RequirementsAssistant_module_css_default.card,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: fieldNames[key] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: value ? "" : RequirementsAssistant_module_css_default.muted,
							children: value || "尚未整理，可手工补充或通过对话澄清。"
						})]
					}, key))
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: RequirementsAssistant_module_css_default.card,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RequirementsAssistant_module_css_default.sectionHead,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "最近修改" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							onClick: () => setTab("trace"),
							children: "查看轨迹 →"
						})]
					}), task.events.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: RequirementsAssistant_module_css_default.compactList,
						children: task.events.slice(-5).reverse().map((event) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("time", { children: time(event.at) }),
							" ",
							event.text
						] }, event.id))
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: RequirementsAssistant_module_css_default.muted,
						children: "添加资料或需求后，这里显示实际操作记录。"
					})]
				})
			] });
			const materialsView = task && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: RequirementsAssistant_module_css_default.sectionHead,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: "资料" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "为每条需求保留可追溯的原文依据。" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: RequirementsAssistant_module_css_default.toolbar,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						onClick: () => fileInput.current?.click(),
						children: "添加文本文件"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: RequirementsAssistant_module_css_default.primary,
						onClick: () => openEditor("material"),
						children: "＋ 粘贴资料"
					})]
				})]
			}), !task.materials.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
				title: "还没有添加资料",
				children: "粘贴业务描述、会议纪要，或导入 TXT、Markdown 文件。"
			}) : task.materials.map((material) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: `${RequirementsAssistant_module_css_default.card} ${material.removed ? RequirementsAssistant_module_css_default.dimmed : ""}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: RequirementsAssistant_module_css_default.sectionHead,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: material.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
						material.kind === "text" ? "粘贴文本" : material.kind.toUpperCase(),
						" · 修订 ",
						material.revision,
						" · ",
						material.text.length.toLocaleString(),
						" 字符 · ",
						requirements.reduce((n, r) => n + r.sources.filter((ref) => ref.materialId === material.id).length, 0),
						" 处需求引用",
						material.removed && " · 已移除"
					] })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RequirementsAssistant_module_css_default.toolbar,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								onClick: () => openEditor("material", material),
								children: "查看 / 编辑"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								disabled: busy || running || material.removed,
								onClick: () => {
									setContext("");
									run("analyze", `请重新整理资料「${material.name}」（${material.id}）的需求和问题，核对当前已有条目，提出有原文依据的新增或修改建议。`, "");
								},
								children: "重新整理"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								disabled: busy,
								onClick: () => material.removed ? void command({
									type: "material.remove",
									id: material.id,
									removed: false
								}, "资料已恢复。") : setConfirm({
									title: "从本次分析移除资料",
									detail: "移除后不再用于后续分析。已有需求的引用和原文修订保留，可在这里恢复。",
									command: {
										type: "material.remove",
										id: material.id,
										removed: true
									}
								}),
								children: material.removed ? "恢复资料" : "移除"
							})
						]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
					className: RequirementsAssistant_module_css_default.excerpt,
					children: [material.text.slice(0, 260), material.text.length > 260 && "…"]
				})]
			}, material.id))] });
			const filteredRequirements = (task?.requirements ?? []).filter((r) => statusFilter === "removed" ? r.removed : !r.removed && (statusFilter === "all" || r.status === statusFilter)).filter((r) => `${r.number} ${r.title} ${r.module} ${r.description}`.toLowerCase().includes(search.toLowerCase()));
			const requirementsView = task && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: RequirementsAssistant_module_css_default.sectionHead,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: "需求清单" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "逐项完善规则和验收标准，再确认业务内容。" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: RequirementsAssistant_module_css_default.primary,
						onClick: () => openEditor("requirement"),
						children: "＋ 新增需求"
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: RequirementsAssistant_module_css_default.filters,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						"aria-label": "搜索需求",
						placeholder: "搜索编号、名称、模块…",
						value: search,
						onChange: (e) => setSearch(e.target.value)
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
						"aria-label": "需求状态筛选",
						value: statusFilter,
						onChange: (e) => setStatusFilter(e.target.value),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "all",
								children: "全部有效需求"
							}),
							Object.entries(requirementStatusNames).map(([key, name]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: key,
								children: name
							}, key)),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "removed",
								children: "已移除"
							})
						]
					})]
				}),
				selectedIds.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: RequirementsAssistant_module_css_default.selectionBar,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
							"已选 ",
							selectedIds.length,
							" 条"
						] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							disabled: busy,
							onClick: () => void command({
								type: "requirement.status",
								ids: selectedIds,
								status: "confirmed"
							}, "所选需求已确认。"),
							children: "确认"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							disabled: busy,
							onClick: () => void command({
								type: "requirement.status",
								ids: selectedIds,
								status: "deferred"
							}, "所选需求已暂缓。"),
							children: "暂缓"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							disabled: selectedIds.length < 2,
							onClick: () => setEditor({
								kind: "merge",
								value: {
									ids: selectedIds,
									title: ""
								}
							}),
							children: "合并"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							onClick: () => setEditor({
								kind: "version",
								value: {
									ids: selectedIds,
									note: ""
								}
							}),
							children: "保存确认版本"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							onClick: () => {
								setDocumentRange("selected");
								goto("document");
							},
							children: "生成所选文档"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							"aria-label": "清除需求选择",
							onClick: () => setSelected([]),
							children: "×"
						})
					]
				}),
				filteredRequirements.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: RequirementsAssistant_module_css_default.tableWrap,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
						className: RequirementsAssistant_module_css_default.table,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								"aria-label": "选择当前列表全部需求",
								checked: filteredRequirements.filter((r) => !r.removed).length > 0 && filteredRequirements.filter((r) => !r.removed).every((r) => selectedIds.includes(r.id)),
								onChange: (e) => setSelected(e.target.checked ? [.../* @__PURE__ */ new Set([...selected, ...filteredRequirements.filter((r) => !r.removed).map((r) => r.id)])] : selected.filter((key) => !filteredRequirements.some((r) => r.id === key)))
							}) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "需求" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "模块 / 优先级" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "状态 / 依据" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "操作" })
						] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: filteredRequirements.map((r) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								disabled: !!r.removed,
								"aria-label": `选择 ${r.number}`,
								checked: selectedIds.includes(r.id),
								onChange: (e) => setSelected((current) => e.target.checked ? [...current, r.id] : current.filter((key) => key !== r.id))
							}) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								className: RequirementsAssistant_module_css_default.rowTitle,
								onClick: () => openEditor("requirement", r),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: r.number }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: r.title })]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: RequirementsAssistant_module_css_default.excerpt,
								children: r.description || "待补充说明"
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", { children: [r.module || "未分组", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
								className: RequirementsAssistant_module_css_default.block,
								children: priorityNames[r.priority]
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: RequirementsAssistant_module_css_default.status,
									"data-status": r.status,
									children: r.removed ? "已移除" : requirementStatusNames[r.status]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
									className: RequirementsAssistant_module_css_default.block,
									children: originNames[r.origin]
								}),
								sourceLinks(r.sources)
							] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: RequirementsAssistant_module_css_default.rowActions,
								children: r.removed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									disabled: busy,
									onClick: () => void command({
										type: "requirement.remove",
										ids: [r.id],
										removed: false
									}, "需求已恢复，请重新核对。"),
									children: "恢复"
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										onClick: () => discuss(r.id),
										children: "讨论"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										disabled: busy || r.status === "confirmed",
										onClick: () => void command({
											type: "requirement.status",
											ids: [r.id],
											status: "confirmed"
										}, `${r.number} 已确认。`),
										children: "确认"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", {
										"aria-label": `${r.number} 更多操作`,
										children: "更多"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											onClick: () => setEditor({
												kind: "split",
												value: {
													id: r.id,
													titles: ""
												}
											}),
											children: "拆分需求"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											disabled: busy,
											onClick: () => void command({
												type: "requirement.status",
												ids: [r.id],
												status: r.status === "deferred" ? "pending" : "deferred"
											}),
											children: r.status === "deferred" ? "继续讨论" : "暂缓"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											onClick: () => setConfirm({
												title: "移除需求",
												detail: `${r.number} ${r.title} 将从工作草稿中移除。历史确认版本保留，可在“已移除”筛选中恢复。`,
												command: {
													type: "requirement.remove",
													ids: [r.id],
													removed: true
												}
											}),
											children: "移除需求"
										})
									] })] })
								] })
							}) })
						] }, r.id)) })]
					})
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
					title: search || statusFilter !== "all" ? "没有匹配的需求" : "从第一条需求开始",
					children: "通过对话整理后采用建议，或点击“新增需求”手工填写。"
				})
			] });
			const flowsView = task && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: RequirementsAssistant_module_css_default.sectionHead,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: "流程与规则" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "明确执行人、条件、正常步骤与异常分支。" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RequirementsAssistant_module_css_default.toolbar,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							disabled: busy || running,
							onClick: () => void run("check", "请检查业务流程的执行人、下一步、退回、撤销、重复提交及规则冲突，把缺失内容列为待确认问题。"),
							children: "检查流程缺项"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							className: RequirementsAssistant_module_css_default.primary,
							onClick: () => openEditor(flowView === "flows" ? "flow" : "rule"),
							children: ["＋ ", flowView === "flows" ? "添加步骤" : "添加规则"]
						})]
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TabBar, {
					label: "流程与规则视图",
					value: flowView,
					items: [["flows", "业务流程"], ["rules", "业务规则"]],
					onChange: setFlowView
				}),
				flowView === "flows" ? task.flows.length ? task.flows.map((flow, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: RequirementsAssistant_module_css_default.flowCard,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: RequirementsAssistant_module_css_default.stepNumber,
						children: index + 1
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: RequirementsAssistant_module_css_default.sectionHead,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: flow.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: RequirementsAssistant_module_css_default.toolbar,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										"aria-label": `上移 ${flow.name}`,
										disabled: busy || index === 0,
										onClick: () => void command({
											type: "flow.move",
											id: flow.id,
											direction: -1
										}),
										children: "↑"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										"aria-label": `下移 ${flow.name}`,
										disabled: busy || index === task.flows.length - 1,
										onClick: () => void command({
											type: "flow.move",
											id: flow.id,
											direction: 1
										}),
										children: "↓"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										onClick: () => openEditor("flow", flow),
										children: "编辑"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										onClick: () => discuss(flow.id),
										children: "讨论"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										"aria-label": `移除步骤 ${flow.name}`,
										onClick: () => setConfirm({
											title: "移除流程步骤",
											detail: `将从工作草稿中移除「${flow.name}」，请随后核对前后步骤和异常分支。`,
											command: {
												type: "flow.remove",
												id: flow.id
											}
										}),
										children: "移除"
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: flow.actor || "执行人待确认" }),
							" · ",
							flow.action || "动作待确认"
						] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: RequirementsAssistant_module_css_default.flowDetails,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["进入条件：", flow.condition || "待确认"] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["预期结果：", flow.result || "待确认"] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["下一步：", flow.next || "待确认"] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["异常：", flow.exception || "待确认"] })
							]
						}),
						flow.requirementIds.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: ["关联：", displayValue("requirementIds", flow.requirementIds)] })
					] })]
				}, flow.id)) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
					title: "还没有业务流程",
					children: "添加步骤，或通过对话梳理业务从开始到结束的过程。"
				}) : task.rules.length ? task.rules.map((rule) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: RequirementsAssistant_module_css_default.card,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: RequirementsAssistant_module_css_default.sectionHead,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: rule.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: RequirementsAssistant_module_css_default.toolbar,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										onClick: () => openEditor("rule", rule),
										children: "编辑"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										onClick: () => discuss(rule.id),
										children: "讨论"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										onClick: () => setConfirm({
											title: "移除业务规则",
											detail: `将从工作草稿中移除「${rule.name}」，历史确认版本保留。`,
											command: {
												type: "rule.remove",
												id: rule.id
											}
										}),
										children: "移除"
									})
								]
							})]
						}),
						objectDetails(rule),
						sourceLinks(rule.sources)
					]
				}, rule.id)) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
					title: "还没有业务规则",
					children: "补充权限、金额条件、数据校验或例外情况，并关联具体需求。"
				})
			] });
			const questionsView = task && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: RequirementsAssistant_module_css_default.sectionHead,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: "待确认" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "集中处理缺失信息、冲突与业务选择。" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: RequirementsAssistant_module_css_default.primary,
						onClick: () => openEditor("question"),
						children: "＋ 添加问题"
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: RequirementsAssistant_module_css_default.filters,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
						"aria-label": "问题状态筛选",
						value: questionFilter,
						onChange: (e) => setQuestionFilter(e.target.value),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "active",
								children: "未处理的问题"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "all",
								children: "全部问题"
							}),
							Object.entries(questionStatusNames).map(([key, name]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: key,
								children: name
							}, key))
						]
					})
				}),
				task.questions.filter((q) => questionFilter === "all" || (questionFilter === "active" ? !["resolved", "dismissed"].includes(q.status) : q.status === questionFilter)).map((q) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: RequirementsAssistant_module_css_default.card,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: RequirementsAssistant_module_css_default.sectionHead,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", { children: [
								q.number,
								" · ",
								q.question
							] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: RequirementsAssistant_module_css_default.status,
								"data-status": q.status,
								children: questionStatusNames[q.status]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: q.reason || "请结合实际业务确认。" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: RequirementsAssistant_module_css_default.toolbar,
							children: [
								q.blocking && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: RequirementsAssistant_module_css_default.warningTag,
									children: "影响需求确认"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: ["影响范围：", displayValue("requirementIds", q.requirementIds)] }),
								sourceLinks(q.sources)
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: RequirementsAssistant_module_css_default.choices,
							children: q.options.filter(Boolean).map((option, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								onClick: () => setAnswers((current) => ({
									...current,
									[q.id]: option
								})),
								children: option
							}, index))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							label: `回答 ${q.number}`,
							multiline: true,
							value: answers[q.id] ?? q.answer,
							placeholder: "填写已确认的业务决定，也可以说明需要向谁核实",
							onChange: (value) => setAnswers((current) => ({
								...current,
								[q.id]: value
							}))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: RequirementsAssistant_module_css_default.toolbar,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: RequirementsAssistant_module_css_default.primary,
									disabled: busy || !(answers[q.id] ?? q.answer).trim(),
									onClick: async () => {
										if (await command({
											type: "question.answer",
											id: q.id,
											answer: answers[q.id] ?? q.answer
										}, "回答已保存。可生成修改建议，采用或手工修改需求后再标记解决。")) setAnswers((current) => {
											const copy = { ...current };
											delete copy[q.id];
											return copy;
										});
									},
									children: "保存回答"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									disabled: busy || running || !q.answer,
									onClick: () => {
										setContext(q.id);
										run("revise", `根据 ${q.number}「${q.question}」已保存的回答「${q.answer}」，提出相关需求和流程的修改建议。`, q.id);
									},
									children: "根据回答更新建议"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									disabled: busy || !["answered", "deferred"].includes(q.status),
									onClick: () => setConfirm({
										title: "将问题标记为已解决",
										detail: "请确认回答已落实到相关需求、规则或流程中。此操作会解除该问题对需求确认的阻断。",
										command: {
											type: "question.status",
											id: q.id,
											status: "resolved"
										}
									}),
									children: "标记已解决"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									disabled: busy,
									onClick: () => void command({
										type: "question.status",
										id: q.id,
										status: [
											"resolved",
											"dismissed",
											"deferred"
										].includes(q.status) ? "open" : "deferred"
									}),
									children: [
										"resolved",
										"dismissed",
										"deferred"
									].includes(q.status) ? "重新打开" : "暂缓"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									disabled: busy || q.status === "dismissed",
									onClick: () => setConfirm({
										title: "标记问题不适用",
										detail: "仅当本次需求范围无需处理此问题时使用。标记后可重新打开。",
										command: {
											type: "question.status",
											id: q.id,
											status: "dismissed"
										}
									}),
									children: "不适用"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									onClick: () => openEditor("question", q),
									children: "编辑问题"
								})
							]
						})
					]
				}, q.id)),
				!task.questions.some((q) => questionFilter === "all" || (questionFilter === "active" ? !["resolved", "dismissed"].includes(q.status) : q.status === questionFilter)) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
					title: "当前没有匹配的问题",
					children: "可以通过对话检查遗漏，也可以手工添加需要业务人员确认的问题。"
				})
			] });
			const documentsView = task && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: RequirementsAssistant_module_css_default.sectionHead,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: "需求文档" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "从已保存的需求生成讨论稿，或导出固定的确认版本。" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						onClick: () => setEditor({
							kind: "version",
							value: {
								ids: selectedIds.length ? selectedIds : requirements.filter((r) => r.status === "confirmed").map((r) => r.id),
								note: ""
							}
						}),
						disabled: !requirements.some((r) => r.status === "confirmed"),
						children: "保存确认版本"
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: RequirementsAssistant_module_css_default.documentControls,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectField, {
						label: "查看版本",
						value: versionId,
						onChange: setVersionId,
						options: [["", "当前工作草稿"], ...task.versions.map((v) => [v.id, `V${v.number} · ${v.note || v.title}`])]
					}), !viewedVersion && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectField, {
							label: "文档模板",
							value: documentDepth,
							onChange: (value) => setDocumentDepth(value),
							options: [
								["brief", "简要清单"],
								["standard", "标准需求说明"],
								["detailed", "详细规格"]
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectField, {
							label: "内容范围",
							value: documentRange,
							onChange: (value) => setDocumentRange(value),
							options: [
								["all", "全部有效需求"],
								["confirmed", "仅已确认需求"],
								["selected", `勾选需求（${selectedIds.length}）`]
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: RequirementsAssistant_module_css_default.primary,
							disabled: busy || allSelected !== void 0 && !allSelected.length,
							onClick: () => void command({
								type: "document.generate",
								depth: documentDepth,
								selectedIds: allSelected
							}, "文档已根据当前保存的需求更新。"),
							children: "更新文档预览"
						})
					] })]
				}),
				!viewedVersion && task.document && task.document.dataRevision !== task.dataRevision && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: RequirementsAssistant_module_css_default.warning,
					role: "status",
					children: "需求内容已有变化，当前文档基于较早的内容，请更新预览后再交付。"
				}),
				!viewedVersion && task.document && (documentDepth !== task.document.depth || JSON.stringify(allSelected ?? requirements.map((r) => r.id)) !== JSON.stringify(task.document.selectedIds)) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: RequirementsAssistant_module_css_default.muted,
					children: "模板或范围已调整，点击“更新文档预览”后生效。"
				}),
				preview ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: RequirementsAssistant_module_css_default.toolbar,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: RequirementsAssistant_module_css_default.tag,
							children: viewedVersion ? `确认版本 V${viewedVersion.number}` : "讨论稿 · 包含条目状态"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							disabled: busy,
							onClick: () => void exportDocument("clipboard"),
							children: "复制"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							disabled: busy,
							onClick: () => void exportDocument("markdown"),
							children: "导出 Markdown"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							disabled: busy,
							onClick: () => void exportDocument("print"),
							children: "打印 / 保存 PDF"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							onClick: () => {
								setContext("");
								updateDraft(`请根据需求文档${viewedVersion ? ` V${viewedVersion.number}` : "当前草稿"}提出修改建议：`);
								showWork();
							},
							children: "讨论文档内容"
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DocumentPreview, { text: preview })] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
					title: "生成第一份需求说明",
					children: "选择文档模板和范围，再点击“更新文档预览”。未确认内容会明确标注。"
				}),
				task.versions.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: RequirementsAssistant_module_css_default.card,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "版本记录" }), [...task.versions].reverse().map((v) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RequirementsAssistant_module_css_default.versionRow,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [
								"V",
								v.number,
								" · ",
								v.note || v.title
							] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
								time(v.createdAt),
								" · ",
								v.selectedIds.length,
								" 条已确认需求"
							] })] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								onClick: () => setVersionId(v.id),
								children: "查看"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								disabled: busy || running,
								onClick: () => setConfirm({
									title: "恢复版本到工作草稿",
									detail: `将 V${v.number} 所含需求和关联内容恢复到工作草稿，并标记为待复核。其他需求和确认版本历史保留。`,
									command: {
										type: "version.restore",
										id: v.id
									}
								}),
								children: "恢复到草稿"
							})
						]
					}, v.id))]
				})
			] });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: RequirementsAssistant_module_css_default.root,
				"data-requirements-assistant": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: RequirementsAssistant_module_css_default.heading,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: task?.title ?? assistantName }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: RequirementsAssistant_module_css_default.saveState,
							children: loading ? "正在读取…" : busy ? "正在保存…" : draftSaveFailed ? "草稿保存失败 · 本地输入已保留" : hasUnsavedDraft ? "输入草稿待保存" : task ? `已保存 · ${time(task.updatedAt)}` : chatView === "chooser" ? "选择分析方式，也可以直接描述你的想法" : "当前会话 · 尚未保存业务内容"
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: RequirementsAssistant_module_css_default.toolbar,
							children: [task && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [requirements.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: RequirementsAssistant_module_css_default.countBadge,
								children: [
									requirements.filter((r) => r.status === "confirmed").length,
									"/",
									requirements.length,
									" 已确认"
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								onClick: () => openEditor("settings", task.settings),
								children: "分析设置"
							})] }), chatView === "work" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								onClick: showChooser,
								children: "切换分析方式"
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TabBar, {
						items: mainTabs,
						value: tab,
						label: "需求分析视图",
						onChange: setTab
					}),
					error && !editor && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RequirementsAssistant_module_css_default.error,
						role: "alert",
						children: [error, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							"aria-label": "关闭错误提示",
							onClick: () => setError(""),
							children: "×"
						})]
					}),
					draftSaveFailed && !editor && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RequirementsAssistant_module_css_default.draftRetry,
						role: "status",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "未保存的输入仍保留在当前会话。" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							disabled: busy || loading,
							onClick: () => void persistDraft(true),
							children: "重试保存草稿"
						})]
					}),
					notice && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RequirementsAssistant_module_css_default.notice,
						role: "status",
						children: [notice, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							"aria-label": "关闭提示",
							onClick: () => setNotice(""),
							children: "×"
						})]
					}),
					availability && !availability.ready && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RequirementsAssistant_module_css_default.availability,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: availability.message }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							onClick: () => openCapabilityLink({
								section: "capability-center",
								capabilityId: "requirements-analysis"
							}),
							children: "查看能力配置"
						})]
					}),
					tab === "workspace" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: RequirementsAssistant_module_css_default.subtabs,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TabBar, {
							items: workspaceTabs,
							value: workspace,
							label: "需求工作区页面",
							onChange: setWorkspace
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("main", {
						ref: scrollArea,
						className: RequirementsAssistant_module_css_default.scroll,
						onScroll: (event) => {
							if (tab === "chat") chatScroll.current[chatView] = event.currentTarget.scrollTop;
						},
						role: "tabpanel",
						"aria-label": tab === "workspace" ? workspaceTabs.find(([key]) => key === workspace)?.[1] : mainTabs.find(([key]) => key === tab)?.[1],
						children: loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, { title: "正在读取已保存的分析…" }) : taskId && !task ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
							title: "分析记录暂时无法读取",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								onClick: async () => {
									setLoading(true);
									try {
										const next = await getRequirementTask(taskId);
										acceptTask(next);
										setDraft(initial.current.draft ?? next.draft);
										setError("");
									} catch (e) {
										setError(e instanceof Error ? e.message : String(e));
									} finally {
										setLoading(false);
									}
								},
								children: "重新读取"
							})
						}) : tab === "chat" ? chatView === "chooser" ? chooserView : workView : !task ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
							title: tab === "trace" ? "尚无操作记录" : "添加资料或记录第一条需求",
							children: tab === "trace" ? "保存业务内容后，这里显示实际操作记录。" : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "确认保存后，可以在当前会话继续整理和编辑。" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: RequirementsAssistant_module_css_default.toolbar,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										disabled: busy,
										onClick: () => openEditor("material"),
										children: "＋ 粘贴资料"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										disabled: busy,
										onClick: () => fileInput.current?.click(),
										children: "添加 TXT / Markdown"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: RequirementsAssistant_module_css_default.primary,
										disabled: busy,
										onClick: () => openEditor("requirement"),
										children: "＋ 新增需求"
									})
								]
							})] })
						}) : tab === "workspace" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: RequirementsAssistant_module_css_default.workspace,
							children: {
								overview: overviewView,
								materials: materialsView,
								requirements: requirementsView,
								flows: flowsView,
								questions: questionsView,
								document: documentsView
							}[workspace]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: RequirementsAssistant_module_css_default.workspace,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: RequirementsAssistant_module_css_default.sectionHead,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: "操作轨迹" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "这里记录服务端实际完成的操作及处理结果。" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										onClick: showWork,
										children: "返回对话继续讨论"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									"aria-label": "轨迹类型筛选",
									value: traceFilter,
									onChange: (e) => setTraceFilter(e.target.value),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "all",
										children: "全部操作"
									}), Object.entries({
										material: "资料",
										analysis: "分析",
										change: "修改",
										confirm: "确认",
										version: "版本",
										export: "导出"
									}).map(([key, value]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: key,
										children: value
									}, key))]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
									className: RequirementsAssistant_module_css_default.timeline,
									children: [...task.events].reverse().filter((event) => traceFilter === "all" || event.kind === traceFilter).map((event) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("time", { children: time(event.at) }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: event.text }), event.objectId && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										onClick: () => {
											const r = task.requirements.find((r) => r.id === event.objectId), m = task.materials.find((m) => m.id === event.objectId), q = task.questions.find((q) => q.id === event.objectId), v = task.versions.find((v) => v.id === event.objectId), f = task.flows.find((f) => f.id === event.objectId), rule = task.rules.find((rule) => rule.id === event.objectId);
											if (r) openEditor("requirement", r);
											else if (m) openEditor("material", m);
											else if (q) {
												goto("questions");
												setQuestionFilter("all");
											} else if (v) {
												setVersionId(v.id);
												goto("document");
											} else if (f) openEditor("flow", f);
											else if (rule) openEditor("rule", rule);
											else setNotice("该操作对象的内容已变更，历史事件仍保留在轨迹中。");
										},
										children: "查看关联内容 →"
									})] })] }, event.id))
								}),
								!task.events.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, { title: "尚无操作记录" })
							]
						})
					}),
					tab === "chat" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RequirementsAssistant_module_css_default.composerWrap,
						children: [task && chatView === "work" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: RequirementsAssistant_module_css_default.quickActions,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									disabled: busy || running,
									onClick: () => void run("analyze", "请根据现有资料和对话整理需求清单，明确来源，并将不确定内容作为问题。"),
									children: "整理需求清单"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									disabled: busy || running,
									onClick: () => void run("clarify", "请根据当前目标、角色、范围、流程、规则和验收中仍缺失的信息，继续提出需要确认的关键问题。"),
									children: "继续澄清"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									disabled: busy || running,
									onClick: () => void run("check", "请检查当前需求中的权限、异常、数据校验、重复或冲突，提出有依据的修改建议和待确认问题。"),
									children: "检查遗漏"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									onClick: () => goto("document"),
									children: "生成需求文档"
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: RequirementsAssistant_module_css_default.composer,
							children: [
								context && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: RequirementsAssistant_module_css_default.contextNote,
									children: [
										"当前讨论：",
										contextLabel(context),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											"aria-label": "取消当前讨论对象",
											onClick: () => setContext(""),
											children: "×"
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									ref: composer,
									"aria-label": "需求分析输入",
									value: draft,
									placeholder: mode === "quick" ? "补充需求描述，或告诉我需要修改哪一项…" : "描述你的想法、当前问题或希望实现的功能…",
									onChange: (e) => updateDraft(e.target.value),
									onKeyDown: (e) => {
										if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
											e.preventDefault();
											run(context ? "revise" : mode === "quick" ? "analyze" : "clarify");
										}
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: RequirementsAssistant_module_css_default.composerTools,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										"aria-label": "添加需求资料",
										disabled: busy || loading,
										onClick: () => openEditor("material"),
										children: "＋"
									}), task && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										"aria-label": "本次分析模型",
										disabled: busy || running,
										value: task.settings.model,
										onChange: (e) => void command({
											type: "save",
											settings: {
												...task.settings,
												model: e.target.value
											}
										}),
										children: modelOptions.map(([value, name]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value,
											children: name
										}, value))
									})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: running ? "分析期间可继续输入草稿" : "Enter 发送 · Shift+Enter 换行" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: RequirementsAssistant_module_css_default.send,
										"aria-label": "发送需求分析消息",
										disabled: busy || running || loading || !draft.trim(),
										onClick: () => void run(context ? "revise" : mode === "quick" ? "analyze" : "clarify"),
										children: "↑"
									})] })]
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						ref: fileInput,
						type: "file",
						hidden: true,
						accept: ".txt,.md,.markdown,text/plain,text/markdown",
						onChange: (e) => {
							importFile(e.target.files?.[0]);
							e.target.value = "";
						}
					}),
					renderEditor(),
					source && task && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Modal, {
						title: "查看原始依据",
						onClose: () => setSource(void 0),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: sourceText(task, source).title }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("blockquote", { children: source.quote }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "完整原文" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
								className: RequirementsAssistant_module_css_default.rawText,
								children: sourceText(task, source).text
							})
						]
					}),
					confirm && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Modal, {
						title: confirm.title,
						onClose: () => setConfirm(void 0),
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							onClick: () => setConfirm(void 0),
							children: "取消"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: RequirementsAssistant_module_css_default.primary,
							disabled: busy,
							onClick: async () => {
								if (await command(confirm.command, "操作已保存。")) setConfirm(void 0);
							},
							children: busy ? "正在保存…" : "确认"
						})] }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: confirm.detail }), error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: RequirementsAssistant_module_css_default.error,
							role: "alert",
							children: error
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/requirement-history.ts
		const ACTIVE_KEY$1 = "workbench-requirements-active-v1";
		const summarize = (task) => ({
			id: task.id,
			title: task.title,
			mode: task.mode,
			updatedAt: task.updatedAt,
			roleId: task.roleId,
			roleVersion: task.roleVersion,
			confirmed: task.requirements.filter((r) => !r.removed && r.status === "confirmed").length,
			total: task.requirements.filter((r) => !r.removed).length,
			openQuestions: task.questions.filter((q) => !["resolved", "dismissed"].includes(q.status)).length,
			running: task.run?.status === "running"
		});
		/** Persist only the selected ID in the browser. The server owns the complete history. */
		function createRequirementHistory(api = {
			list: listRequirementTasks,
			get: getRequirementTask,
			remove: deleteRequirementTask
		}) {
			let saved = null;
			try {
				saved = sessionStorage.getItem(ACTIVE_KEY$1);
			} catch {}
			let state = {
				items: [],
				total: 0,
				hasMore: false,
				activeId: saved,
				loading: false,
				error: ""
			};
			let offset = 0;
			const removed = /* @__PURE__ */ new Set();
			const listeners = /* @__PURE__ */ new Set();
			const update = (patch) => {
				state = {
					...state,
					...patch
				};
				try {
					if (state.activeId) sessionStorage.setItem(ACTIVE_KEY$1, state.activeId);
					else sessionStorage.removeItem(ACTIVE_KEY$1);
				} catch {}
				listeners.forEach((listener) => listener());
			};
			const merge = (items) => {
				const merged = new Map(state.items.map((item) => [item.id, item]));
				for (const item of items) if (!removed.has(item.id) && (!merged.has(item.id) || merged.get(item.id).updatedAt <= item.updatedAt)) merged.set(item.id, item);
				return [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
			};
			const load = async (more = false) => {
				if (state.loading) return;
				update({
					loading: true,
					error: ""
				});
				try {
					const page = await api.list({
						offset: more ? offset : 0,
						limit: 30
					});
					offset = (more ? offset : 0) + page.items.length;
					update({
						items: merge(page.items),
						total: page.total,
						hasMore: offset < page.total
					});
					const id = state.activeId;
					if (id && !state.items.some((item) => item.id === id)) {
						const task = await api.get(id);
						update({ items: merge([summarize(task)]) });
					}
				} catch (error) {
					update({ error: error instanceof Error ? error.message : String(error) });
				} finally {
					update({ loading: false });
				}
			};
			return {
				getSnapshot: () => state,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				load,
				active: () => state.items.find((item) => item.id === state.activeId),
				open: (id) => {
					if (state.items.some((item) => item.id === id)) update({ activeId: id });
				},
				leave: () => update({ activeId: null }),
				upsert: (item, activate = false) => {
					if (!removed.has(item.id)) update({
						items: merge([item]),
						total: state.total + Number(!state.items.some((row) => row.id === item.id)),
						...activate ? { activeId: item.id } : {}
					});
				},
				remove: async (id) => {
					await api.remove(id);
					removed.add(id);
					update({
						items: state.items.filter((item) => item.id !== id),
						total: Math.max(0, state.total - 1),
						activeId: state.activeId === id ? null : state.activeId
					});
				}
			};
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-client-ui-plain-chat/src/client/MeetingDemo.module.css.mjs
		const css$2 = ".oLleaW_root{--ink:var(--dsw-alias-label-primary,#202938);--muted:var(--dsw-alias-label-secondary,#758095);--border:var(--dsw-alias-border-l2,#dce3ef);--surface:var(--dsw-alias-bg-layer-2,#fff);--accent:var(--dsw-alias-button-primary-fill,#4d68ad);width:100%;height:100%;min-height:0;color:var(--ink);font:inherit;flex-direction:column;display:flex}.oLleaW_root button{font:inherit;cursor:pointer}.oLleaW_root button:focus-visible,.oLleaW_root textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.oLleaW_heading{border-bottom:1px solid var(--border);justify-content:space-between;align-items:center;gap:16px;min-height:60px;padding:0 28px;display:flex}.oLleaW_heading>div{align-items:center;gap:13px;display:flex}.oLleaW_heading>div:first-child span{color:var(--muted)}.oLleaW_heading strong{font-size:16px;font-weight:650}.oLleaW_heading button{color:var(--muted);background:0 0;border:0;font-size:12px}.oLleaW_heading button:hover{color:var(--accent)}.oLleaW_demoBadge{border:1px solid var(--border);color:var(--muted);border-radius:7px;padding:4px 8px;font-size:11px}.oLleaW_tabs{border-bottom:1px solid var(--border);flex:none;gap:30px;height:44px;padding:0 28px;display:flex}.oLleaW_tabs button{color:var(--muted);background:0 0;border:0;border-bottom:2px solid #0000;padding:0 2px;font-size:14px}.oLleaW_tabs button[aria-selected=true]{border-color:var(--accent);color:var(--ink);font-weight:650}.oLleaW_scroll{overscroll-behavior:contain;flex:1;min-height:0;overflow:auto}.oLleaW_messages{width:min(900px,100% - 64px);margin:0 auto;padding:28px 0 40px}.oLleaW_message{align-items:flex-start;gap:12px;margin:0 0 28px;display:flex}.oLleaW_message>span:first-child{border-radius:10px;width:32px;height:32px}.oLleaW_messageBody{flex:1;min-width:0;max-width:810px;font-size:14px;line-height:1.75}.oLleaW_messageBody>p{margin:0 0 12px}.oLleaW_messageBody .oLleaW_lead{margin:0 0 9px;font-size:19px;font-weight:650}.oLleaW_messageBody .oLleaW_muted{color:var(--muted);margin-top:13px;font-size:12px}.oLleaW_byline{margin:2px 0 10px;font-size:12px;font-weight:700}.oLleaW_byline span{color:var(--muted);margin-left:7px;font-size:10px;font-weight:400}.oLleaW_userMessage{justify-content:flex-end;margin:0 0 24px;display:flex}.oLleaW_userMessage>div{border:1px solid color-mix(in srgb,var(--accent) 23%,var(--border));background:color-mix(in srgb,var(--accent) 8%,var(--surface));overflow-wrap:anywhere;border-radius:16px 16px 4px;max-width:min(560px,85%);padding:10px 14px;font-size:13px;line-height:1.6}.oLleaW_userMessage small{color:var(--muted);font-size:10px;display:block}.oLleaW_modes{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;max-width:710px;margin:17px 0 4px;display:grid}.oLleaW_modes button{border:1px solid color-mix(in srgb,var(--accent) 30%,var(--border));background:var(--surface);min-height:132px;color:var(--ink);text-align:left;border-radius:12px;flex-direction:column;align-items:flex-start;padding:16px;transition:transform .16s,border-color .16s;display:flex}.oLleaW_modes button:hover{border-color:var(--accent);transform:translateY(-2px)}.oLleaW_modes b{font-size:15px}.oLleaW_modes span{color:var(--muted);margin-top:7px;font-size:12px}.oLleaW_modes em{color:var(--accent);margin-top:auto;font-size:11px;font-style:normal;font-weight:650}.oLleaW_selectedMode{border:1px solid var(--border);background:var(--surface);color:var(--accent);border-radius:8px;padding:8px 11px;font-size:12px;display:inline-block}.oLleaW_choices{flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px;display:flex}.oLleaW_choices>span{color:var(--muted);font-size:12px}.oLleaW_choices button,.oLleaW_cardFooter button,.oLleaW_uploadPrompt>button:not(.oLleaW_primary){border:1px solid var(--border);background:var(--surface);color:var(--accent);border-radius:8px;padding:7px 10px;font-size:12px}.oLleaW_choices button:hover,.oLleaW_cardFooter button:hover,.oLleaW_uploadPrompt>button:hover{border-color:var(--accent)}.oLleaW_uploadPrompt{border:1px dashed color-mix(in srgb,var(--accent) 50%,var(--border));background:var(--surface);border-radius:11px;flex-wrap:wrap;align-items:center;gap:11px;max-width:680px;padding:13px;display:flex}.oLleaW_uploadPrompt>span{background:color-mix(in srgb,var(--accent) 12%,var(--surface));width:36px;height:36px;color:var(--accent);border-radius:9px;place-items:center;font-size:22px;display:grid}.oLleaW_uploadPrompt>div{flex:1;min-width:160px}.oLleaW_uploadPrompt strong,.oLleaW_uploadPrompt small{display:block}.oLleaW_uploadPrompt strong{font-size:12px}.oLleaW_uploadPrompt small{color:var(--muted);font-size:10px}.oLleaW_modelControl{color:var(--muted);flex-wrap:wrap;align-items:center;gap:8px;margin-top:9px;font-size:11px;display:flex}.oLleaW_modelControl select{border:1px solid var(--border);background:var(--surface);min-width:180px;max-width:100%;color:var(--ink);font:inherit;border-radius:7px;padding:6px 9px}.oLleaW_modelRow{flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;padding:0 18px 13px;display:flex}.oLleaW_modelRow button{border:1px solid var(--border);background:var(--surface);color:var(--accent);border-radius:8px;padding:7px 10px;font-size:11px}.oLleaW_primary{border-radius:8px;padding:8px 12px;font-size:12px;background:var(--accent)!important;color:#fff!important;border:0!important}.oLleaW_primary:disabled{opacity:.5;cursor:not-allowed}.oLleaW_progress{border:1px solid var(--border);background:var(--surface);border-radius:11px;align-items:center;gap:13px;max-width:570px;padding:15px;display:flex}.oLleaW_progress>span{color:var(--accent);font-size:27px}.oLleaW_progress>div{flex:1}.oLleaW_progress strong,.oLleaW_progress small{display:block}.oLleaW_progress strong{font-size:12px}.oLleaW_progress small{color:var(--muted);font-size:10px}.oLleaW_progressTrack{background:var(--border);border-radius:9px;height:5px;margin-top:8px;overflow:hidden}.oLleaW_progressTrack i{background:var(--accent);border-radius:9px;width:72%;height:100%;animation:1.5s ease-in-out infinite oLleaW_progress;display:block}@keyframes oLleaW_progress{0%{transform:translate(-110%)}to{transform:translate(150%)}}.oLleaW_resultCard{border:1px solid var(--border);background:var(--surface);border-radius:12px;max-width:760px;overflow:hidden;box-shadow:0 4px 18px #182c500b}.oLleaW_audioBar{border-bottom:1px solid var(--border);flex-wrap:wrap;align-items:center;gap:8px;padding:9px 18px;display:flex}.oLleaW_audioBar audio{width:min(420px,100%);height:36px}.oLleaW_audioBar small{color:var(--muted);font-size:10px}.oLleaW_cardHead{border-bottom:1px solid var(--border);justify-content:space-between;align-items:center;gap:10px;padding:15px 18px;display:flex}.oLleaW_cardHead small{color:var(--accent);font-size:10px;font-weight:700;display:block}.oLleaW_cardHead h3{margin:2px 0 0;font-size:15px}.oLleaW_cardHead>span{white-space:nowrap;border:1px solid var(--border);color:var(--muted);border-radius:6px;padding:4px 7px;font-size:10px}.oLleaW_transcriptRows{padding:0 18px}.oLleaW_transcriptRow{border-bottom:1px solid var(--border);grid-template-columns:48px minmax(0,1fr);gap:12px;padding:13px 0;display:grid}.oLleaW_transcriptRow:last-child{border-bottom:0}.oLleaW_transcriptRow time{color:var(--accent);font-size:11px}.oLleaW_transcriptRow strong{font-size:11px}.oLleaW_transcriptRow p{margin:4px 0 0;font-size:12px;line-height:1.7}.oLleaW_transcriptRow textarea{box-sizing:border-box;resize:vertical;border:1px solid var(--border);background:var(--surface);width:100%;min-height:58px;color:var(--ink);font:inherit;border-radius:7px;margin-top:6px;padding:8px;font-size:12px;line-height:1.6;display:block}.oLleaW_speakerInput{border:1px solid var(--border);background:var(--surface);max-width:180px;color:var(--ink);font:inherit;border-radius:6px;padding:4px 6px;font-size:11px;display:block}.oLleaW_cardFooter{border-top:1px solid var(--border);flex-wrap:wrap;align-items:center;gap:8px;padding:12px 18px;display:flex}.oLleaW_cardFooter span{min-width:180px;color:var(--muted);flex:1;font-size:10px}.oLleaW_minutes{padding:4px 20px 19px}.oLleaW_minutes section{margin-top:13px}.oLleaW_minutes h4{margin:0 0 5px;font-size:12px}.oLleaW_minutes p{margin:0;font-size:12px;line-height:1.75}.oLleaW_minutes small{color:var(--muted);font-size:10px}.oLleaW_actionLine{border:1px solid var(--border);border-radius:7px;flex-wrap:wrap;justify-content:space-between;gap:5px 12px;margin:6px 0;padding:8px 10px;font-size:11px;display:flex}.oLleaW_actionLine span{color:var(--muted)}.oLleaW_sourceLink{color:var(--accent);background:0 0;border:0;padding:0;font-size:10px}.oLleaW_sourceLink:hover{text-decoration:underline}.oLleaW_highlight{background:color-mix(in srgb,#d8a254 8%,var(--surface));border-left:3px solid #d8a254;margin-left:-8px;padding-left:8px}.oLleaW_trace{border:1px solid var(--border);background:var(--surface);border-radius:12px;width:min(760px,100% - 64px);margin:30px auto;padding:22px}.oLleaW_trace h2{margin:0 0 5px;font-size:18px}.oLleaW_trace p{color:var(--muted);font-size:12px}.oLleaW_trace ol{margin:20px 0 0;padding:0;list-style:none}.oLleaW_trace li{border-top:1px solid var(--border);gap:13px;padding:10px 0;font-size:12px;display:flex}.oLleaW_trace li span{color:var(--accent)}.oLleaW_composerWrap{flex:none;width:min(970px,100% - 48px);margin:0 auto;padding:10px 0 14px}.oLleaW_composer{border:1px solid var(--border);background:var(--surface);border-radius:20px;padding:12px 15px 10px;box-shadow:0 4px 22px #182c5014}.oLleaW_composer textarea{resize:vertical;box-sizing:border-box;width:100%;min-height:65px;max-height:160px;color:var(--ink);font:inherit;background:0 0;border:0;outline:0;font-size:15px;line-height:1.5;display:block}.oLleaW_composer textarea::placeholder{color:var(--muted)}.oLleaW_composerTools,.oLleaW_composerTools>div{justify-content:space-between;align-items:center;gap:10px;display:flex}.oLleaW_composerTools>div span{color:var(--muted);font-size:11px}.oLleaW_composerTools button{color:var(--accent);background:0 0;border:0;font-size:24px}.oLleaW_composerTools button:disabled{opacity:.35;cursor:default}.oLleaW_composerTools .oLleaW_send{background:var(--accent);color:#fff;border-radius:50%;width:38px;height:38px;line-height:1}.oLleaW_notice{color:var(--accent);text-align:center;margin:5px 0 0;font-size:11px}@media (width<=660px){.oLleaW_heading{min-height:52px;padding:0 15px}.oLleaW_heading>div{gap:7px}.oLleaW_heading strong{font-size:13px}.oLleaW_tabs{padding:0 15px}.oLleaW_messages{width:calc(100% - 28px);padding-top:17px}.oLleaW_message{gap:8px}.oLleaW_message>span:first-child{width:27px;height:27px}.oLleaW_messageBody{font-size:13px}.oLleaW_modes{grid-template-columns:1fr}.oLleaW_modes button{min-height:100px}.oLleaW_uploadPrompt>button{flex:1}.oLleaW_composerWrap{width:calc(100% - 18px);padding-bottom:6px}.oLleaW_composer{border-radius:16px}.oLleaW_composerTools>div span{font-size:9px}.oLleaW_trace{box-sizing:border-box;width:calc(100% - 26px)}}@media (prefers-reduced-motion:reduce){.oLleaW_modes button{transition:none}.oLleaW_modes button:hover{transform:none}.oLleaW_progressTrack i{animation:none}}";
		const tagId$2 = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/MeetingDemo.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var MeetingDemo_module_css_default = {
			"actionLine": "oLleaW_actionLine",
			"audioBar": "oLleaW_audioBar",
			"byline": "oLleaW_byline",
			"cardFooter": "oLleaW_cardFooter",
			"cardHead": "oLleaW_cardHead",
			"choices": "oLleaW_choices",
			"composer": "oLleaW_composer",
			"composerTools": "oLleaW_composerTools",
			"composerWrap": "oLleaW_composerWrap",
			"demoBadge": "oLleaW_demoBadge",
			"heading": "oLleaW_heading",
			"highlight": "oLleaW_highlight",
			"lead": "oLleaW_lead",
			"message": "oLleaW_message",
			"messageBody": "oLleaW_messageBody",
			"messages": "oLleaW_messages",
			"minutes": "oLleaW_minutes",
			"modelControl": "oLleaW_modelControl",
			"modelRow": "oLleaW_modelRow",
			"modes": "oLleaW_modes",
			"muted": "oLleaW_muted",
			"notice": "oLleaW_notice",
			"primary": "oLleaW_primary",
			"progress": "oLleaW_progress",
			"progressTrack": "oLleaW_progressTrack",
			"resultCard": "oLleaW_resultCard",
			"root": "oLleaW_root",
			"scroll": "oLleaW_scroll",
			"selectedMode": "oLleaW_selectedMode",
			"send": "oLleaW_send",
			"sourceLink": "oLleaW_sourceLink",
			"speakerInput": "oLleaW_speakerInput",
			"tabs": "oLleaW_tabs",
			"trace": "oLleaW_trace",
			"transcriptRow": "oLleaW_transcriptRow",
			"transcriptRows": "oLleaW_transcriptRows",
			"uploadPrompt": "oLleaW_uploadPrompt",
			"userMessage": "oLleaW_userMessage"
		};
		//#endregion
		//#region src/client/MeetingDemo.tsx
		const endpoint = "/api/capabilities/meeting";
		const formatTime = (ms) => `${Math.floor(ms / 6e4).toString().padStart(2, "0")}:${Math.floor(ms % 6e4 / 1e3).toString().padStart(2, "0")}`;
		const escapeHtml = (value) => value.replace(/[&<>"']/g, (char) => ({
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			"\"": "&quot;",
			"'": "&#39;"
		})[char] ?? char);
		async function api(path, init) {
			const response = await fetch(`${endpoint}${path}`, {
				credentials: "same-origin",
				...init
			});
			const body = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(body.error || `请求失败（${response.status}）`);
			return body;
		}
		function post(path, body) {
			return api(path, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body)
			});
		}
		function restore(value) {
			if (!value || typeof value !== "object") return void 0;
			const state = value;
			if (!Array.isArray(state.messages) || !Array.isArray(state.trace) || typeof state.draft !== "string") return void 0;
			if (typeof state.jobId === "string" || state.phase === "start") return state;
			return {
				...state,
				phase: [
					"audience",
					"focus",
					"upload"
				].includes(state.phase) ? state.phase : "upload",
				jobId: null,
				showTranscript: false,
				messages: state.messages.filter((message) => ![
					"transcript",
					"minutes",
					"upload"
				].includes(message.kind))
			};
		}
		function minutesText(minutes) {
			return [
				minutes.title,
				"",
				"会议概览",
				minutes.overview,
				"",
				"主要结论",
				...minutes.decisions.map((item) => `• ${item.text}`),
				"",
				"行动项",
				...minutes.actions.map((item) => `• ${item.text}${item.owner ? `｜负责人：${item.owner}` : ""}${item.deadline ? `｜期限：${item.deadline}` : ""}`),
				"",
				"待确认事项",
				...minutes.unknown.map((item) => `• ${item.text}`)
			].join("\n");
		}
		function MeetingDemo({ initialState, loadModels, onSnapshot, onCommit, onReset, assistant, roleVersion } = {}) {
			const initial = (0, react.useRef)(restore(initialState));
			const assistantName = assistant?.name ?? "会议纪要助手";
			const assistantColor = assistant?.color ?? "#6683bd";
			const assistantIcon = assistant?.icon ?? {
				kind: "builtin",
				id: "document"
			};
			const [mode, setMode] = (0, react.useState)(initial.current?.mode ?? null);
			const [phase, setPhase] = (0, react.useState)(initial.current?.phase ?? "start");
			const [audience, setAudience] = (0, react.useState)(initial.current?.audience ?? "");
			const [focus, setFocus] = (0, react.useState)(initial.current?.focus ?? "");
			const [summaryModel, setSummaryModel] = (0, react.useState)(initial.current?.summaryModel ?? "");
			const [models, setModels] = (0, react.useState)([]);
			const [messages, setMessages] = (0, react.useState)(initial.current?.messages ?? [{
				id: 0,
				kind: "intro"
			}]);
			const [trace, setTrace] = (0, react.useState)(initial.current?.trace ?? ["打开会议纪要助手"]);
			const [tab, setTab] = (0, react.useState)("chat");
			const [draft, setDraft] = (0, react.useState)(initial.current?.draft ?? "");
			const [jobId, setJobId] = (0, react.useState)(initial.current?.jobId ?? null);
			const [job, setJob] = (0, react.useState)(null);
			const [segments, setSegments] = (0, react.useState)([]);
			const [showTranscript, setShowTranscript] = (0, react.useState)(initial.current?.showTranscript ?? false);
			const [availability, setAvailability] = (0, react.useState)(null);
			const [notice, setNotice] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const input = (0, react.useRef)(null);
			const player = (0, react.useRef)(null);
			const scroll = (0, react.useRef)(null);
			const nextId = (0, react.useRef)(Math.max(0, ...messages.map((message) => message.id)) + 1);
			const snapshotCallback = (0, react.useRef)(onSnapshot);
			snapshotCallback.current = onSnapshot;
			(0, react.useEffect)(() => {
				snapshotCallback.current?.({
					mode,
					phase,
					audience,
					focus,
					summaryModel,
					messages,
					trace,
					draft,
					jobId,
					showTranscript,
					roleVersion
				});
			}, [
				mode,
				phase,
				audience,
				focus,
				summaryModel,
				messages,
				trace,
				draft,
				jobId,
				showTranscript,
				roleVersion
			]);
			(0, react.useEffect)(() => {
				api("/config").then(setAvailability).catch((error) => setAvailability({
					ready: false,
					message: String(error),
					maxBytes: 0,
					provider: "自定义语音识别接口"
				}));
			}, []);
			(0, react.useEffect)(() => {
				if (loadModels) loadModels().then(setModels).catch(() => setModels([]));
			}, [loadModels]);
			(0, react.useEffect)(() => {
				if (!jobId) return;
				let active = true;
				const check = async () => {
					try {
						const next = await api(`/job/${jobId}`);
						if (!active) return;
						setJob(next);
						if (next.status === "transcribed" && mode === "guided") {
							setPhase("transcript");
							setSegments((current) => current.length ? current : next.segments);
							setMessages((current) => current.some((message) => message.kind === "transcript") ? current : [...current, {
								id: nextId.current++,
								kind: "transcript"
							}]);
						} else if (next.status === "ready") {
							setPhase("ready");
							setSegments(next.segments);
							setMessages((current) => current.some((message) => message.kind === "minutes") ? current : [...current, {
								id: nextId.current++,
								kind: "minutes"
							}]);
						}
					} catch (error) {
						if (active) setNotice(error instanceof Error ? error.message : String(error));
					}
				};
				check();
				const timer = window.setInterval(() => {
					if (!job || [
						"uploading",
						"transcribing",
						"generating"
					].includes(job.status)) check();
				}, 2500);
				return () => {
					active = false;
					window.clearInterval(timer);
				};
			}, [
				jobId,
				mode,
				job?.status
			]);
			(0, react.useEffect)(() => {
				if (tab === "chat" && scroll.current?.scrollTo) scroll.current.scrollTo({
					top: scroll.current.scrollHeight,
					behavior: "smooth"
				});
			}, [
				messages,
				phase,
				tab
			]);
			(0, react.useEffect)(() => {
				if (!notice) return;
				const timer = window.setTimeout(() => setNotice(""), 6e3);
				return () => window.clearTimeout(timer);
			}, [notice]);
			const add = (...entries) => setMessages((current) => [...current, ...entries.map((entry) => ({
				...entry,
				id: nextId.current++
			}))]);
			const log = (value) => setTrace((current) => [...current, value]);
			const chooseMode = (value) => {
				if (phase !== "start") return;
				onCommit?.(`会议纪要 · ${value === "quick" ? "快速生成" : "引导整理"}`);
				setMode(value);
				add({
					kind: "user",
					text: value === "quick" ? "快速生成" : "引导整理"
				}, {
					kind: "assistant",
					text: value === "quick" ? "上传录音后，我会直接生成纪要草稿。" : "先选择纪要用途和关注重点，再上传录音核对转写。"
				});
				setPhase(value === "quick" ? "upload" : "audience");
				log(`选择${value === "quick" ? "快速生成" : "引导整理"}`);
			};
			const chooseAudience = (value) => {
				if (phase !== "audience") return;
				setAudience(value);
				setPhase("focus");
				add({
					kind: "user",
					text: value
				}, {
					kind: "assistant",
					text: "这次希望重点突出什么？"
				});
				log(`纪要用途：${value}`);
			};
			const chooseFocus = (value) => {
				if (phase !== "focus") return;
				setFocus(value);
				setPhase("upload");
				add({
					kind: "user",
					text: value
				}, {
					kind: "assistant",
					text: "准备好了，请上传录音。"
				});
				log(`关注重点：${value}`);
			};
			const onFile = async (file) => {
				if (!file || phase !== "upload" || busy) return;
				if (!/\.(mp3|m4a|wav|aac|flac|ogg|opus|webm|mp4)$/i.test(file.name)) {
					setNotice("请选择 MP3、M4A、WAV 等支持的音视频文件");
					return;
				}
				if (file.size > (availability?.maxBytes ?? 0)) {
					setNotice("录音超过当前上传限制");
					return;
				}
				if (!availability?.ready) {
					setNotice(availability?.message || "转写服务尚未配置");
					return;
				}
				setBusy(true);
				setPhase("processing");
				add({
					kind: "upload",
					file: file.name
				});
				log(`上传录音：${file.name}`);
				try {
					const created = await post("/create", {
						fileName: file.name,
						mode,
						audience,
						focus,
						summaryModel,
						roleVersion
					});
					setJobId(created.id);
					const uploaded = await api(`/upload/${created.id}`, {
						method: "PUT",
						headers: { "Content-Type": "application/octet-stream" },
						body: file
					});
					setJob(uploaded);
					log("录音上传完成，开始语音转写");
				} catch (error) {
					setNotice(error instanceof Error ? error.message : String(error));
					setPhase("upload");
				} finally {
					setBusy(false);
					if (input.current) input.current.value = "";
				}
			};
			const retry = async () => {
				if (!jobId) return;
				if (job && !job.size) {
					setJobId(null);
					setJob(null);
					setPhase("upload");
					setNotice("请重新选择录音上传");
					return;
				}
				if (job?.segments.length) {
					generate();
					return;
				}
				setBusy(true);
				try {
					const next = await post("/retry", { id: jobId });
					setJob(next);
					setPhase(next.status === "transcribed" ? "transcript" : "processing");
					log("重试处理录音");
				} catch (error) {
					setNotice(error instanceof Error ? error.message : String(error));
				} finally {
					setBusy(false);
				}
			};
			const generate = async (instruction) => {
				if (!jobId || busy) return;
				setBusy(true);
				setPhase("processing");
				try {
					await post("/generate", {
						id: jobId,
						summaryModel,
						...instruction ? { instruction } : mode === "guided" ? { segments } : {}
					});
					setJob((current) => current ? {
						...current,
						status: "generating"
					} : current);
					log(instruction ? `修改纪要：${instruction}` : "核对转写并生成纪要");
				} catch (error) {
					setNotice(error instanceof Error ? error.message : String(error));
					setPhase(instruction ? "ready" : "transcript");
				} finally {
					setBusy(false);
				}
			};
			const revise = (value) => {
				if (phase !== "ready" || !value.trim()) return;
				add({
					kind: "user",
					text: value
				}, {
					kind: "assistant",
					text: "正在根据录音与现有纪要修改…"
				});
				generate(value);
			};
			const send = () => {
				const value = draft.trim();
				if (!value) return;
				setDraft("");
				if (phase === "audience") return chooseAudience(value);
				if (phase === "focus") return chooseFocus(value);
				if (phase === "ready") return revise(value);
				if (phase === "start") add({
					kind: "user",
					text: value
				}, {
					kind: "assistant",
					text: "请先选择“快速生成”或“引导整理”。"
				});
				else setNotice(phase === "transcript" ? "请先在转写原文中核对并确认" : phase === "processing" ? "正在处理录音，请稍候" : "请先上传录音");
			};
			const seek = (id) => {
				const row = job?.segments.find((segment) => segment.id === id);
				if (!row) return;
				setShowTranscript(true);
				window.setTimeout(() => {
					document.getElementById(`meeting-source-${id}`)?.scrollIntoView({
						behavior: "smooth",
						block: "center"
					});
					if (player.current) {
						player.current.currentTime = row.start / 1e3;
						player.current.play().catch(() => {});
					}
				}, 0);
			};
			const sourceLinks = (item) => item.sourceIds.map((id) => {
				const row = job?.segments.find((segment) => segment.id === id);
				return row ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					className: MeetingDemo_module_css_default.sourceLink,
					onClick: () => seek(id),
					children: ["回听 ", formatTime(row.start)]
				}, id) : null;
			});
			const modelControl = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: MeetingDemo_module_css_default.modelControl,
				children: ["纪要模型", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
					"aria-label": "纪要模型",
					value: summaryModel,
					onChange: (event) => setSummaryModel(event.target.value),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
						value: "",
						children: "工作台默认模型"
					}), models.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
						value: model.id,
						children: [
							model.name,
							" · ",
							model.id
						]
					}, model.id))]
				})]
			});
			const copyMinutes = async () => {
				if (!job?.minutes) return;
				try {
					await navigator.clipboard.writeText(minutesText(job.minutes));
					setNotice("已复制当前纪要");
				} catch {
					setNotice("复制失败，可选中文字手动复制");
				}
			};
			const printMinutes = () => {
				if (!job?.minutes) return;
				const windowRef = window.open("", "_blank", "width=900,height=700");
				if (!windowRef) {
					setNotice("打印窗口被拦截，请允许弹出窗口后重试");
					return;
				}
				const html = minutesText(job.minutes).split("\n").map((line) => `<div>${escapeHtml(line) || "&nbsp;"}</div>`).join("");
				windowRef.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(job.minutes.title)}</title><style>body{font:15px/1.7 system-ui,sans-serif;max-width:760px;margin:40px auto;color:#202938}div{white-space:pre-wrap}div:first-child{font-size:24px;font-weight:700;margin-bottom:20px}@page{size:A4;margin:18mm}</style></head><body>${html}</body></html>`);
				windowRef.document.close();
				windowRef.focus();
				windowRef.print();
			};
			const transcriptCard = (editable) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: MeetingDemo_module_css_default.resultCard,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: MeetingDemo_module_css_default.cardHead,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "录音转写" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: editable ? "请先核对原文" : "转写原文" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [job?.segments.length ?? 0, " 个片段"] })]
					}),
					jobId && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: MeetingDemo_module_css_default.audioBar,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("audio", {
							ref: player,
							controls: true,
							preload: "metadata",
							src: `${endpoint}/audio/${jobId}`
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "点击时间戳可从对应位置回听" })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: MeetingDemo_module_css_default.transcriptRows,
						children: (editable ? segments : job?.segments ?? []).map((row, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: MeetingDemo_module_css_default.transcriptRow,
							id: `meeting-source-${row.id}`,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: MeetingDemo_module_css_default.sourceLink,
								onClick: () => seek(row.id),
								children: formatTime(row.start)
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: editable ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: MeetingDemo_module_css_default.speakerInput,
								"aria-label": `${formatTime(row.start)} 发言人`,
								value: row.speaker,
								onChange: (event) => setSegments((current) => current.map((item, i) => i === index ? {
									...item,
									speaker: event.target.value
								} : item))
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								"aria-label": `${formatTime(row.start)} 转写文字`,
								value: row.text,
								onChange: (event) => setSegments((current) => current.map((item, i) => i === index ? {
									...item,
									text: event.target.value
								} : item))
							})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: row.speaker }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: row.text })] }) })]
						}, row.id))
					}),
					editable && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: MeetingDemo_module_css_default.cardFooter,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "可修改说话人和识别文字，确认后生成纪要。" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: MeetingDemo_module_css_default.primary,
							disabled: busy,
							onClick: () => void generate(),
							children: "确认转写，生成纪要 →"
						})]
					})
				]
			});
			const minutesCard = () => !job?.minutes ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: MeetingDemo_module_css_default.resultCard,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: MeetingDemo_module_css_default.cardHead,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "会议纪要 · 可继续对话修改" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: job.minutes.title })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "基于录音生成" })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: MeetingDemo_module_css_default.minutes,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "会议概览" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: job.minutes.overview })] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "主要结论" }), job.minutes.decisions.map((item, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
								item.text,
								" ",
								sourceLinks(item)
							] }, index))] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "行动项" }), job.minutes.actions.map((item, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: MeetingDemo_module_css_default.actionLine,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: item.text }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
									item.owner || "负责人待确认",
									" · ",
									item.deadline || "期限待确认",
									" ",
									sourceLinks(item)
								] })]
							}, index))] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "待确认事项" }), job.minutes.unknown.map((item, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
								item.text,
								" ",
								sourceLinks(item)
							] }, index))] })
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: MeetingDemo_module_css_default.cardFooter,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								onClick: () => void copyMinutes(),
								children: "复制纪要"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								onClick: printMinutes,
								children: "打印 / 保存 PDF"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								onClick: () => setShowTranscript((value) => !value),
								children: showTranscript ? "收起转写" : "查看转写原文"
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: MeetingDemo_module_css_default.modelRow,
						children: [modelControl, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							disabled: busy,
							onClick: () => void generate(),
							children: "用所选模型重新生成"
						})]
					}),
					showTranscript && transcriptCard(false)
				]
			});
			const assistantMessage = (children, key) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: MeetingDemo_module_css_default.message,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleAppearanceIcon, {
					roleId: MEETING_DEMO_ROLE_ID,
					icon: assistantIcon,
					color: assistantColor
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: MeetingDemo_module_css_default.messageBody,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: MeetingDemo_module_css_default.byline,
						children: assistantName
					}), children]
				})]
			}, key);
			const renderMessage = (message) => {
				if (message.kind === "user" || message.kind === "upload") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("article", {
					className: MeetingDemo_module_css_default.userMessage,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: message.kind === "upload" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						"♫　",
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: message.file }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "会议录音" })
					] }) : message.text })
				}, message.id);
				if (message.kind === "intro") return assistantMessage(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: MeetingDemo_module_css_default.lead,
						children: [
							"你好，我是",
							assistantName,
							"。"
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "我可以帮你把会议录音整理为结论和待办。先选择这次的处理方式：" }),
					mode ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: MeetingDemo_module_css_default.selectedMode,
						children: [
							"已选择 ",
							mode === "quick" ? "快速生成" : "引导整理",
							" · 后续仍可在对话中修改"
						]
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: MeetingDemo_module_css_default.modes,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							onClick: () => chooseMode("quick"),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: "⚡　快速生成" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "上传录音后直接生成纪要草稿" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: "适合马上看结果 →" })
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							onClick: () => chooseMode("guided"),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: "☷　引导整理" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "先选用途与重点，再核对转写" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: "适合需要把控细节 →" })
							]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: MeetingDemo_module_css_default.muted,
						children: ["录音由你配置的语音识别接口处理；纪要使用工作台模型。", availability?.message]
					})
				] }), message.id);
				if (message.kind === "assistant") return assistantMessage(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: message.text }),
					phase === "audience" && message.text?.startsWith("先选择") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: MeetingDemo_module_css_default.choices,
						children: [
							"团队同步",
							"领导汇报",
							"客户沟通"
						].map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							onClick: () => chooseAudience(value),
							children: value
						}, value))
					}),
					phase === "focus" && message.text === "这次希望重点突出什么？" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: MeetingDemo_module_css_default.choices,
						children: [
							"结论与待办",
							"风险与问题",
							"完整讨论"
						].map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							onClick: () => chooseFocus(value),
							children: value
						}, value))
					}),
					phase === "upload" && (message.text?.startsWith("上传录音") || message.text?.startsWith("准备好了")) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: MeetingDemo_module_css_default.uploadPrompt,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "♫" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "添加会议录音" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
								"MP3、M4A、WAV 等 · 最大 ",
								Math.round((availability?.maxBytes ?? 25 * 1024 * 1024) / 1024 / 1024),
								" MB"
							] })] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: MeetingDemo_module_css_default.primary,
								disabled: !availability?.ready || busy,
								onClick: () => input.current?.click(),
								children: "选择录音"
							}),
							!availability?.ready && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => openCapabilityLink({
									section: "capability-center",
									capabilityId: "meeting-transcription"
								}),
								children: "前往能力中心"
							})
						]
					}), modelControl] })
				] }), message.id);
				if (message.kind === "transcript") return assistantMessage(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "转写已完成。请核对说话人和关键内容，确认后生成纪要。" }), transcriptCard(true)] }), message.id);
				if (message.kind === "minutes") return assistantMessage(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "纪要已生成。你可以继续在下方对话框提出修改。" }),
					minutesCard(),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: MeetingDemo_module_css_default.choices,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "试试：" }), [
							"把待办放在前面",
							"缩短摘要",
							"突出待确认事项"
						].map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							onClick: () => revise(value),
							children: value
						}, value))]
					})
				] }), message.id);
				return null;
			};
			const status = job?.status;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: MeetingDemo_module_css_default.root,
				"data-meeting-demo": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: MeetingDemo_module_css_default.heading,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "你好" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: assistantName })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: MeetingDemo_module_css_default.demoBadge,
							children: availability?.ready ? "录音转纪要" : "待配置"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							onClick: () => onReset?.(),
							children: "重新开始"
						})] })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: MeetingDemo_module_css_default.tabs,
						role: "tablist",
						"aria-label": "会话视图",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							role: "tab",
							"aria-selected": tab === "chat",
							onClick: () => setTab("chat"),
							children: "对话"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							role: "tab",
							"aria-selected": tab === "trace",
							onClick: () => setTab("trace"),
							children: "轨迹"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: MeetingDemo_module_css_default.scroll,
						ref: scroll,
						role: "tabpanel",
						children: tab === "chat" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: MeetingDemo_module_css_default.messages,
							children: [
								messages.map(renderMessage),
								phase === "processing" && status !== "error" && assistantMessage(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: MeetingDemo_module_css_default.progress,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "◌" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: status === "generating" || status === "transcribed" ? "正在生成纪要…" : status === "uploading" ? "正在上传录音…" : "正在转写录音…" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "可以切换会话，处理完成后回来查看" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: MeetingDemo_module_css_default.progressTrack,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {})
										})
									] })]
								}), -1),
								status === "error" && assistantMessage(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: MeetingDemo_module_css_default.resultCard,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: MeetingDemo_module_css_default.cardHead,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: "处理失败" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: job?.error })] })
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: MeetingDemo_module_css_default.cardFooter,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											disabled: busy,
											onClick: () => void retry(),
											children: "重试"
										})
									})]
								}), -2)
							]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: MeetingDemo_module_css_default.trace,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: "会话轨迹" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "记录本次会议处理步骤。" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", { children: trace.map((entry, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: String(index + 1).padStart(2, "0") }), entry] }, index)) })
							]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: MeetingDemo_module_css_default.composerWrap,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: MeetingDemo_module_css_default.composer,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								"aria-label": "输入消息",
								value: draft,
								onChange: (event) => setDraft(event.target.value),
								onKeyDown: (event) => {
									if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
										event.preventDefault();
										send();
									}
								},
								placeholder: phase === "start" ? "先选择上方的整理方式，或输入消息" : phase === "audience" ? "输入纪要用途" : phase === "focus" ? "输入关注重点" : phase === "ready" ? "输入要求，继续修改纪要" : "输入消息，继续对话"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: MeetingDemo_module_css_default.composerTools,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									"aria-label": "添加录音",
									title: "添加录音",
									disabled: phase !== "upload" || !availability?.ready || busy,
									onClick: () => input.current?.click(),
									children: "＋"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: availability?.ready ? "录音交由已配置的识别接口处理" : "语音识别尚未配置" })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: assistantName }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: MeetingDemo_module_css_default.send,
									"aria-label": "发送消息",
									disabled: !draft.trim() || busy,
									onClick: send,
									children: "↑"
								})] })]
							})]
						}), notice && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: MeetingDemo_module_css_default.notice,
							role: "status",
							children: notice
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						ref: input,
						type: "file",
						accept: ".mp3,.m4a,.wav,.aac,.flac,.ogg,.opus,.webm,.mp4",
						hidden: true,
						onChange: (event) => void onFile(event.target.files?.[0])
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-client-ui-plain-chat/src/client/LocalConversationRows.module.css.mjs
		const css$1 = ".z58OfW_rows{flex-direction:column;gap:2px;display:flex}.z58OfW_fallbackHeading{color:var(--dsw-alias-label-secondary,#65769a);padding:12px 16px 6px;font-size:12px;font-weight:600}.z58OfW_row{min-width:0;height:32px;color:var(--dsw-alias-label-primary,#202938);border-radius:8px;align-items:center;margin:0 8px;display:flex}.z58OfW_row:hover,.z58OfW_active{background:var(--dsw-alias-interactive-bg-hover,#e9eff9)}.z58OfW_open{min-width:0;height:100%;color:inherit;text-align:left;cursor:pointer;font:inherit;background:0 0;border:0;flex:1;align-items:center;gap:4px;padding:0 4px 0 24px;display:flex}.z58OfW_icon{width:16px;color:var(--dsw-alias-label-tertiary,#8995aa);flex:none;font-size:15px}.z58OfW_title{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;font-size:14px;line-height:20px;overflow:hidden}.z58OfW_open small{color:var(--dsw-alias-label-tertiary,#8995aa);flex:none;font-size:11px}.z58OfW_menuTrigger{width:25px;height:25px;color:var(--dsw-alias-label-tertiary,#8995aa);cursor:pointer;opacity:0;background:0 0;border:0;border-radius:6px;place-items:center;margin-right:3px;display:grid}.z58OfW_row:hover .z58OfW_menuTrigger,.z58OfW_menuTrigger:focus-visible,.z58OfW_menuTrigger[aria-expanded=true]{opacity:1}.z58OfW_menuTrigger:hover{background:color-mix(in srgb,var(--dsw-alias-label-tertiary,#8995aa) 12%,transparent)}.z58OfW_open:focus-visible,.z58OfW_menuTrigger:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4e6bb3);outline-offset:-2px}.z58OfW_menu{z-index:10000;box-sizing:border-box;border:1px solid var(--dsw-alias-border-default,#d7deeb);background:var(--dsw-alias-bg-surface,#fff);border-radius:12px;min-width:214px;padding:6px;position:fixed;box-shadow:0 8px 24px #16243c24}.z58OfW_menu button{width:100%;color:var(--dsw-alias-label-primary,#202938);text-align:left;cursor:pointer;font:inherit;background:0 0;border:0;border-radius:7px;align-items:center;gap:12px;padding:9px 10px;font-size:13px;display:flex}.z58OfW_menu button svg{color:var(--dsw-alias-label-secondary,#65769a);flex:none}.z58OfW_menu button:hover,.z58OfW_menu button:focus-visible{background:var(--dsw-alias-interactive-bg-hover,#e9eff9);outline:none}@media (hover:none){.z58OfW_menuTrigger{opacity:1}}";
		const tagId$1 = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/LocalConversationRows.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var LocalConversationRows_module_css_default = {
			"active": "z58OfW_active",
			"fallbackHeading": "z58OfW_fallbackHeading",
			"icon": "z58OfW_icon",
			"menu": "z58OfW_menu",
			"menuTrigger": "z58OfW_menuTrigger",
			"open": "z58OfW_open",
			"row": "z58OfW_row",
			"rows": "z58OfW_rows",
			"title": "z58OfW_title"
		};
		//#endregion
		//#region src/client/LocalConversationRows.tsx
		/** Share the native Chat group when present; saved records also need a home in an empty tree. */
		function LocalConversationRows({ host, label, rows, activeId, onOpen, onRemove, onLoadMore, loading, error, fallbackLabel = "聊天记录" }) {
			const [target, setTarget] = (0, react.useState)(null);
			const [standalone, setStandalone] = (0, react.useState)(false);
			const [menu, setMenu] = (0, react.useState)(null);
			const trigger = (0, react.useRef)(null);
			const menuItem = (0, react.useRef)(null);
			const hasRows = rows.length > 0;
			(0, react.useEffect)(() => {
				if (!menu) return;
				menuItem.current?.focus({ preventScroll: true });
				const closeOutside = (event) => {
					if (event.target instanceof Node && (menuItem.current?.parentElement?.contains(event.target) || trigger.current?.contains(event.target))) return;
					setMenu(null);
				};
				const closeEscape = (event) => {
					if (event.key !== "Escape") return;
					event.preventDefault();
					setMenu(null);
					trigger.current?.focus();
				};
				const closeOnMove = () => setMenu(null);
				document.addEventListener("pointerdown", closeOutside);
				document.addEventListener("keydown", closeEscape);
				window.addEventListener("resize", closeOnMove);
				window.addEventListener("scroll", closeOnMove, true);
				return () => {
					document.removeEventListener("pointerdown", closeOutside);
					document.removeEventListener("keydown", closeEscape);
					window.removeEventListener("resize", closeOnMove);
					window.removeEventListener("scroll", closeOnMove, true);
				};
			}, [menu]);
			(0, react.useLayoutEffect)(() => {
				if (!host) return;
				let container = null;
				const placeholders = /* @__PURE__ */ new Map();
				const restorePlaceholders = () => {
					for (const [element, previous] of placeholders) {
						element.hidden = previous.hidden;
						element.style.display = previous.display;
					}
					placeholders.clear();
				};
				const place = () => {
					const header = Array.from(host.querySelectorAll("button[aria-label]")).find((button) => button.getAttribute("aria-label") === label)?.closest("[role=\"treeitem\"]");
					const group = header?.parentElement;
					if (!container) {
						container = document.createElement("div");
						container.dataset.localConversationHost = "true";
						setTarget(container);
					}
					if (header && group) {
						restorePlaceholders();
						container.hidden = header.getAttribute("aria-expanded") === "false";
						container.dataset.localConversationPlacement = "native";
						if (container.parentElement !== group || container.previousElementSibling !== header) group.insertBefore(container, header.nextSibling);
						setStandalone(false);
					} else {
						const tree = host.querySelector("[role=\"tree\"]");
						const parent = tree ?? host;
						container.hidden = false;
						container.dataset.localConversationPlacement = "standalone";
						if (container.parentElement !== parent || container !== parent.firstElementChild) parent.insertBefore(container, parent.firstChild);
						if (tree && hasRows) for (const element of Array.from(tree.children)) {
							if (!(element instanceof HTMLElement) || !Array.from(element.classList).some((name) => name.endsWith("_empty"))) continue;
							if (!placeholders.has(element)) placeholders.set(element, {
								hidden: element.hidden,
								display: element.style.display
							});
							element.hidden = true;
							element.style.display = "none";
						}
						else restorePlaceholders();
						setStandalone(true);
					}
				};
				place();
				const observer = new MutationObserver(place);
				observer.observe(host, {
					childList: true,
					subtree: true,
					attributes: true,
					attributeFilter: ["aria-expanded"]
				});
				return () => {
					observer.disconnect();
					restorePlaceholders();
					container?.remove();
				};
			}, [
				host,
				label,
				hasRows
			]);
			if (!target || !rows.length && !error && !loading) return null;
			const openMenu = (id, button) => {
				if (menu?.id === id) {
					setMenu(null);
					return;
				}
				trigger.current = button;
				const rect = button.getBoundingClientRect();
				const left = Math.max(8, Math.min(rect.left, window.innerWidth - 214 - 8));
				const top = rect.bottom + 6 + 54 > window.innerHeight ? Math.max(8, rect.top - 60) : rect.bottom + 6;
				setMenu({
					id,
					left,
					top
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: LocalConversationRows_module_css_default.rows,
				"data-local-conversations": "true",
				children: [
					standalone && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: LocalConversationRows_module_css_default.fallbackHeading,
						children: fallbackLabel
					}),
					rows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: `${LocalConversationRows_module_css_default.row} ${activeId === row.id ? LocalConversationRows_module_css_default.active : ""}`,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: LocalConversationRows_module_css_default.open,
							onClick: () => onOpen(row.id),
							"aria-label": `打开本地会话：${row.title}`,
							"aria-current": activeId === row.id ? "page" : void 0,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: LocalConversationRows_module_css_default.icon,
									"aria-hidden": "true",
									children: row.kind === "developer" ? "⌘" : row.kind === "requirements" ? "▧" : row.kind === "demo" ? "▤" : "◌"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: LocalConversationRows_module_css_default.title,
									children: row.title
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: row.kind === "developer" ? "开发" : row.kind === "requirements" ? "需求" : row.kind === "demo" ? "演示" : row.draft.trim() ? "草稿" : "临时" })
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: LocalConversationRows_module_css_default.menuTrigger,
							onClick: (event) => openMenu(row.id, event.currentTarget),
							"aria-label": `会话操作：${row.title}`,
							"aria-haspopup": "menu",
							"aria-expanded": menu?.id === row.id,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
								width: "16",
								height: "16",
								viewBox: "0 0 16 16",
								fill: "currentColor",
								"aria-hidden": "true",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
										cx: "3",
										cy: "8",
										r: "1.2"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
										cx: "8",
										cy: "8",
										r: "1.2"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
										cx: "13",
										cy: "8",
										r: "1.2"
									})
								]
							})
						})]
					}, row.id)),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						children: error
					}),
					loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						children: "正在读取需求记录…"
					}),
					onLoadMore && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: LocalConversationRows_module_css_default.open,
						disabled: loading,
						onClick: onLoadMore,
						children: error ? "重试读取需求记录" : "加载更多需求记录"
					})
				]
			}), target), menu && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: LocalConversationRows_module_css_default.menu,
				role: "menu",
				"aria-label": "会话操作",
				style: {
					left: menu.left,
					top: menu.top
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					ref: menuItem,
					type: "button",
					role: "menuitem",
					onClick: () => {
						const id = menu.id;
						setMenu(null);
						onRemove(id);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						width: "16",
						height: "16",
						viewBox: "0 0 16 16",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: "1.5",
						strokeLinecap: "round",
						strokeLinejoin: "round",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.6 8h5.8l.6-8M6.5 7v3.5M9.5 7v3.5" })
					}), "移除对话"]
				})
			}), document.body)] });
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-client-ui-plain-chat/src/client/NativeConversationRemoval.module.css.mjs
		const css = ".JXxDsG_overlay{z-index:20000;background:#101a2d80;place-items:center;padding:20px;display:grid;position:fixed;inset:0}.JXxDsG_dialog{box-sizing:border-box;border:1px solid var(--dsw-alias-border-default,#d7deeb);background:var(--dsw-alias-bg-surface,#fff);width:min(420px,100%);color:var(--dsw-alias-label-primary,#202938);border-radius:16px;padding:24px;box-shadow:0 16px 48px #11182733}.JXxDsG_dialog:focus{outline:none}.JXxDsG_dialog h2{margin:0 0 14px;font-size:18px;line-height:26px}.JXxDsG_dialog p{overflow-wrap:anywhere;margin:0 0 12px;font-size:14px;line-height:22px}.JXxDsG_muted{color:var(--dsw-alias-label-secondary,#65769a)}.JXxDsG_error{color:var(--dsw-alias-state-error-primary,#c43a4b)}.JXxDsG_actions{justify-content:flex-end;gap:8px;margin-top:22px;display:flex}.JXxDsG_actions button{border:1px solid var(--dsw-alias-border-default,#d7deeb);min-width:80px;color:inherit;cursor:pointer;font:inherit;background:0 0;border-radius:8px;padding:8px 14px}.JXxDsG_actions button:disabled{opacity:.55;cursor:default}.JXxDsG_actions .JXxDsG_danger{color:#fff;background:#c43a4b;border-color:#c43a4b}";
		const tagId = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/NativeConversationRemoval.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var NativeConversationRemoval_module_css_default = {
			"actions": "JXxDsG_actions",
			"danger": "JXxDsG_danger",
			"dialog": "JXxDsG_dialog",
			"error": "JXxDsG_error",
			"muted": "JXxDsG_muted",
			"overlay": "JXxDsG_overlay"
		};
		//#endregion
		//#region src/client/NativeConversationRemoval.tsx
		const REMOVE_SESSION_EVENT = "dsh-plain-chat:remove-session";
		function totalWithDescendants(rows, id) {
			const byId = new Map(rows.map((row) => [row.id, row]));
			if (!byId.has(id)) throw new Error("未找到这条会话，请刷新后重试。");
			const visited = /* @__PURE__ */ new Set();
			const pending = [id];
			while (pending.length) {
				const current = pending.pop();
				if (visited.has(current)) continue;
				visited.add(current);
				pending.push(...byId.get(current)?.childIds ?? []);
			}
			return visited.size;
		}
		function NativeConversationRemoval({ sessions }) {
			const [view, setView] = (0, react.useState)(null);
			const dialog = (0, react.useRef)(null);
			const returnFocus = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const handle = (event) => {
					const detail = event.detail;
					if (typeof detail?.id !== "string" || typeof detail.title !== "string") return;
					returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
					setView({
						target: {
							id: detail.id,
							title: detail.title
						},
						phase: "checking",
						total: 0,
						error: null
					});
				};
				window.addEventListener(REMOVE_SESSION_EVENT, handle);
				return () => window.removeEventListener(REMOVE_SESSION_EVENT, handle);
			}, []);
			(0, react.useEffect)(() => {
				if (view?.phase !== "checking") return;
				const { id } = view.target;
				const controller = new AbortController();
				fetch("/api/dsh-session-archive/inventory", {
					credentials: "same-origin",
					signal: controller.signal
				}).then(async (response) => {
					if (!response.ok) throw new Error(`无法读取会话信息（${response.status}）。`);
					return response.json();
				}).then((data) => {
					if (controller.signal.aborted) return;
					const rows = data.rows ?? [];
					if (rows.find((row) => row.id === id)?.running) throw new Error("这条会话仍在运行，请结束后再移除。");
					const total = totalWithDescendants(rows, id);
					setView((previous) => previous?.target.id === id ? {
						...previous,
						phase: "ready",
						total
					} : previous);
				}).catch((error) => {
					if (controller.signal.aborted) return;
					setView((previous) => previous?.target.id === id ? {
						...previous,
						phase: "error",
						error: error instanceof Error ? error.message : String(error)
					} : previous);
				});
				return () => controller.abort();
			}, [view?.phase === "checking" ? view.target.id : null]);
			(0, react.useEffect)(() => {
				if (!view) return;
				dialog.current?.focus({ preventScroll: true });
				const escape = (event) => {
					if (event.key !== "Escape" || view.phase === "deleting") return;
					event.preventDefault();
					event.stopPropagation();
					setView(null);
				};
				document.addEventListener("keydown", escape, true);
				return () => document.removeEventListener("keydown", escape, true);
			}, [view?.target.id, view?.phase]);
			const close = () => {
				if (view?.phase === "deleting") return;
				setView(null);
				queueMicrotask(() => returnFocus.current?.focus({ preventScroll: true }));
			};
			const remove = async () => {
				if (view?.phase !== "ready") return;
				const { id } = view.target;
				const expectedTotal = view.total;
				setView({
					...view,
					phase: "deleting",
					error: null
				});
				try {
					const response = await fetch("/api/dsh-session-archive/delete", {
						method: "POST",
						credentials: "same-origin",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							ids: [id],
							expectedTotal
						})
					});
					const body = await response.json().catch(() => ({}));
					if (!response.ok) throw new Error(body.error === "plan-mismatch" ? "关联会话数量发生变化，请关闭后重新操作。" : body.error ?? `移除失败（${response.status}）。`);
					const result = body.results?.find((item) => item.id === id);
					if (result?.status !== "ok") throw new Error(result?.reason === "attached" ? "会话仍被工作台占用，请关闭该会话并重新启动工作台后重试。" : result?.detail ?? `移除失败：${result?.reason ?? "未知原因"}`);
					const incomplete = body.results?.find((item) => item.status !== "ok");
					if (incomplete) throw new Error(`部分关联会话未能移除：${incomplete.detail ?? incomplete.reason ?? "未知原因"}`);
					if (sessions.list.getSnapshot().current === id) sessions.clear();
					try {
						await sessions.refresh?.();
					} catch {}
					setView(null);
				} catch (error) {
					setView((previous) => previous?.target.id === id ? {
						...previous,
						phase: "error",
						error: error instanceof Error ? error.message : String(error)
					} : previous);
				}
			};
			if (!view) return null;
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: NativeConversationRemoval_module_css_default.overlay,
				onMouseDown: (event) => {
					if (event.target === event.currentTarget) close();
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: dialog,
					className: NativeConversationRemoval_module_css_default.dialog,
					role: "dialog",
					"aria-modal": "true",
					"aria-label": "移除对话",
					tabIndex: -1,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: "移除对话" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", { children: [
							"将永久删除“",
							view.target.title,
							"”的对话记录，无法恢复。"
						] }),
						view.phase === "checking" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: NativeConversationRemoval_module_css_default.muted,
							children: "正在检查关联会话…"
						}),
						view.phase === "ready" && view.total > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							className: NativeConversationRemoval_module_css_default.muted,
							children: [
								"关联的 ",
								view.total - 1,
								" 条分支会话也会一并删除。"
							]
						}),
						view.error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: NativeConversationRemoval_module_css_default.error,
							role: "alert",
							children: view.error
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: NativeConversationRemoval_module_css_default.actions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: close,
								disabled: view.phase === "deleting",
								children: "取消"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: NativeConversationRemoval_module_css_default.danger,
								onClick: () => void remove(),
								disabled: view.phase !== "ready",
								children: view.phase === "deleting" ? "正在移除…" : "确认移除"
							})]
						})
					]
				})
			}), document.body);
		}
		//#endregion
		//#region src/client/local-conversations.ts
		const DRAFTS_KEY = "workbench-local-drafts-v1";
		const DEMOS_KEY = "workbench-meeting-demos-v1";
		const ACTIVE_KEY = "workbench-local-active-v1";
		const MAX_ROWS = 40;
		function readRows(storage, key, kind) {
			try {
				const value = JSON.parse(storage.getItem(key) ?? "[]");
				if (!Array.isArray(value)) return [];
				return value.filter((row) => row && typeof row === "object" && typeof row.id === "string" && typeof row.role === "string" && row.kind === kind && typeof row.title === "string" && typeof row.draft === "string" && typeof row.updatedAt === "number").slice(0, MAX_ROWS);
			} catch {
				return [];
			}
		}
		function createLocalConversations(mint = () => `local-${crypto.randomUUID()}`) {
			const saved = [...readRows(sessionStorage, DRAFTS_KEY, "draft"), ...readRows(localStorage, DEMOS_KEY, "demo")];
			let activeId = null;
			try {
				const id = sessionStorage.getItem(ACTIVE_KEY);
				if (id && saved.some((row) => row.id === id)) activeId = id;
			} catch {}
			let snapshot = {
				items: saved.sort((a, b) => b.updatedAt - a.updatedAt),
				activeId
			};
			const listeners = /* @__PURE__ */ new Set();
			const persist = () => {
				try {
					sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(snapshot.items.filter((row) => row.kind === "draft").slice(0, MAX_ROWS)));
					if (snapshot.activeId) sessionStorage.setItem(ACTIVE_KEY, snapshot.activeId);
					else sessionStorage.removeItem(ACTIVE_KEY);
				} catch {}
				try {
					localStorage.setItem(DEMOS_KEY, JSON.stringify(snapshot.items.filter((row) => row.kind === "demo").slice(0, MAX_ROWS)));
				} catch {}
			};
			const update = (items, nextActive = snapshot.activeId) => {
				snapshot = {
					items: items.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_ROWS),
					activeId: nextActive
				};
				persist();
				listeners.forEach((listener) => listener());
			};
			const active = () => snapshot.items.find((row) => row.id === snapshot.activeId);
			const leave = () => {
				const current = active();
				update(snapshot.items.filter((row) => row !== current || row.kind === "demo" || row.draft.trim()), null);
			};
			const start = (role = "chat") => {
				const current = active();
				const retained = snapshot.items.filter((row) => row !== current || row.kind === "demo" || row.draft.trim());
				const now = Date.now();
				const row = {
					id: mint(),
					role,
					kind: "draft",
					title: "新对话",
					draft: "",
					updatedAt: now
				};
				update([row, ...retained], row.id);
				return row;
			};
			const ensure = (role = "chat") => active() ?? start(role);
			const patch = (id, change) => {
				const current = snapshot.items.find((row) => row.id === id);
				if (!current) return;
				const next = {
					...current,
					...change,
					updatedAt: Date.now()
				};
				update(snapshot.items.map((row) => row.id === id ? next : row));
			};
			return {
				getSnapshot: () => snapshot,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				active,
				start,
				ensure,
				leave,
				open: (id) => {
					if (snapshot.items.some((row) => row.id === id)) update(snapshot.items, id);
				},
				remove: (id) => update(snapshot.items.filter((row) => row.id !== id), snapshot.activeId === id ? null : snapshot.activeId),
				setRole: (id, role) => patch(id, { role }),
				setDraft: (id, draft) => patch(id, {
					draft,
					title: draft.trim() ? draft.trim().slice(0, 28) : "新对话"
				}),
				setMeeting: (id, meeting, draft) => patch(id, {
					meeting,
					draft
				}),
				commitDemo: (id, title) => patch(id, {
					kind: "demo",
					title
				}),
				commitChat: (id) => update(snapshot.items.filter((row) => row.id !== id), snapshot.activeId === id ? null : snapshot.activeId)
			};
		}
		//#endregion
		//#region src/client/BrowserObservation.tsx
		/** The official observation service supplies events and images; display only this conversation. */
		function BrowserObservation({ sessionId }) {
			const [rows, setRows] = (0, react.useState)([]), [error, setError] = (0, react.useState)("");
			(0, react.useEffect)(() => {
				if (!sessionId) {
					setRows([]);
					return;
				}
				const stream = new EventSource("/bsk-observation/events");
				const update = (event) => {
					try {
						const data = JSON.parse(event.data);
						if (data.type === "snapshot") setRows(data.sessions ?? []);
						else if (data.type === "reset") setRows([]);
						else if (data.type === "remove") setRows((rows) => rows.filter((row) => row.sessionId !== data.session?.sessionId));
						else if (data.type === "upsert" && data.session) setRows((rows) => [...rows.filter((row) => row.sessionId !== data.session.sessionId), data.session]);
						setError("");
					} catch {
						setError("浏览器状态格式异常，请重新检测连接。");
					}
				};
				stream.onmessage = update;
				stream.onerror = () => {
					setError("浏览器观察连接中断，正在重连。");
				};
				return () => stream.close();
			}, [sessionId]);
			const current = rows.filter((row) => row.dshSessionIds?.[0] === sessionId);
			if (!current.length) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: `${ManagedCapabilities_module_css_default.page} ${ManagedCapabilities_module_css_default.tasks}`,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [
						"查看浏览器 · ",
						current.length,
						" 个窗口"
					] }),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						children: error
					}),
					current.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figure", {
						style: { margin: "12px 0" },
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figcaption", { children: [
								row.url || "新建页面",
								" · ",
								row.dead ? "连接丢失" : row.action
							] }),
							row.thumbnailAttachmentId && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
								src: `/bsk-observation/thumbnail/${encodeURIComponent(row.thumbnailAttachmentId)}`,
								alt: "当前浏览器页面截图",
								style: {
									maxWidth: "100%",
									maxHeight: 260,
									objectFit: "contain",
									borderRadius: 8
								}
							}),
							row.lastError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ManagedCapabilities_module_css_default.error,
								children: row.lastError
							})
						]
					}, row.sessionId))
				]
			});
		}
		//#endregion
		//#region src/client/role-ui-state.ts
		/** Shared UI state; never changes a host preset or existing session. */
		function createRoleSelection() {
			let selected = "chat";
			const listeners = /* @__PURE__ */ new Set();
			return {
				getSnapshot: () => selected,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				select: (role) => {
					selected = role;
					listeners.forEach((listener) => listener());
				}
			};
		}
		function createSettingsNavigation() {
			let revision = 0;
			let section = "agent-presets";
			const listeners = /* @__PURE__ */ new Set();
			return {
				getSnapshot: () => revision,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				getSection: () => section,
				openSection: (value) => {
					section = value;
					revision++;
					listeners.forEach((listener) => listener());
				},
				openPresets: () => {
					section = "agent-presets";
					revision++;
					listeners.forEach((listener) => listener());
				}
			};
		}
		//#endregion
		//#region src/client/center-copy.ts
		const centerZh = {
			centerTitle: "能力中心",
			centerSubtitle: "把能力整理好，再交给合适的岗位。",
			centerManage: "管理能力",
			centerOpen: "在能力中心编辑",
			centerBoundary: "UI 预览 · 目录与岗位关系为示例；编辑仅在本页暂存，刷新后重置。",
			centerSearch: "搜索能力、用途或来源",
			centerAll: "全部能力",
			centerPinned: "常用",
			centerPending: "待配置",
			centerUnused: "未被使用",
			centerPin: "设为常用",
			centerUnpin: "取消常用",
			centerConfigure: "配置能力",
			centerViewRoles: "查看使用岗位",
			centerExampleRoles: "个示例岗位",
			centerBack: "返回能力列表",
			centerBackRole: "返回岗位编辑",
			centerOverview: "概览与连接",
			centerInstructions: "使用说明",
			centerDefaults: "默认配置",
			centerRoles: "使用岗位",
			centerConnection: "尚未连接",
			centerConnectionHint: "接入后可在这里查看连接状态。当前可以先预览能力配置。",
			centerConnect: "连接功能待接入",
			centerGuide: "能力说明与操作规则",
			centerGuideHint: "描述能力如何工作、适合哪些任务，以及需要遵循的规则。",
			centerGuideExample: "先确认任务目标与可操作范围；完成后整理结果，涉及提交或修改的操作先请用户确认。",
			centerDefaultsHint: "这里编辑能力的默认值预览。岗位已有配置保持独立，实际继承与保存将在后续接入。",
			centerRoleSettings: "当前岗位设置",
			centerRoleSettingsHint: "仅用于本次岗位预览，不修改能力中心的默认值。",
			centerRoleHint: "以下来自内置岗位示例，用于预览引用关系；不是实际保存的岗位配置。",
			centerPreviewRole: "预览岗位",
			centerNoRoles: "暂未被示例岗位使用",
			centerNoRolesHint: "创建岗位助手时，可以从能力配件库添加这项能力。",
			centerTechnical: "技术信息",
			centerIdentity: "能力标识",
			centerVersion: "接入后显示",
			centerImplementation: "示例来源",
			centerEmpty: "这个筛选下还没有能力",
			centerEmptyHint: "试试其他筛选，或清空搜索词。",
			centerDraftHint: "编辑已暂存于当前页面 · 尚未写入配置",
			centerReturnCurrent: "返回当前岗位",
			centerCurrentRole: "当前编辑"
		};
		const centerEn = {
			centerTitle: "Capability center",
			centerSubtitle: "Organize capabilities and put them to work in the right roles.",
			centerManage: "Manage capabilities",
			centerOpen: "Edit in capability center",
			centerBoundary: "UI preview · Example catalog and role links. Edits stay on this page and reset on reload.",
			centerSearch: "Search capabilities, uses or providers",
			centerAll: "All capabilities",
			centerPinned: "Favorites",
			centerPending: "Needs setup",
			centerUnused: "Unused",
			centerPin: "Add to favorites",
			centerUnpin: "Remove from favorites",
			centerConfigure: "Configure",
			centerViewRoles: "View roles",
			centerExampleRoles: "example roles",
			centerBack: "Back to capabilities",
			centerBackRole: "Back to role editor",
			centerOverview: "Overview & connection",
			centerInstructions: "Instructions",
			centerDefaults: "Defaults",
			centerRoles: "Roles",
			centerConnection: "Not connected",
			centerConnectionHint: "Connection status will appear here after integration. You can preview the settings now.",
			centerConnect: "Connection coming later",
			centerGuide: "Capability instructions and rules",
			centerGuideHint: "Describe how this capability works, suitable tasks and the rules to follow.",
			centerGuideExample: "Confirm the task and permitted scope first. Summarize results when finished and ask before submitting or changing anything.",
			centerDefaultsHint: "Preview capability defaults here. Existing role settings stay independent; inheritance and saving will be added later.",
			centerRoleSettings: "Settings for this role",
			centerRoleSettingsHint: "Applies to this role preview only; capability defaults stay unchanged.",
			centerRoleHint: "These links come from built-in role examples, not saved role configurations.",
			centerPreviewRole: "Preview role",
			centerNoRoles: "No example roles use this yet",
			centerNoRolesHint: "Add this capability from the library when creating a role assistant.",
			centerTechnical: "Technical information",
			centerIdentity: "Capability ID",
			centerVersion: "Available after integration",
			centerImplementation: "Example provider",
			centerEmpty: "No capabilities in this view",
			centerEmptyHint: "Try a different filter or clear your search.",
			centerDraftHint: "Edits held on this page · Not saved to configuration",
			centerReturnCurrent: "Return to current role",
			centerCurrentRole: "Editing now"
		};
		//#endregion
		//#region src/client/roles-copy.ts
		const roleZh = {
			rolesTitle: "岗位助手",
			rolesDescription: "为每一类工作，准备一位熟悉职责的助手。",
			rolesPick: "选定助手",
			rolesChosen: "已选定",
			rolesCurrent: "当前助手",
			rolesManage: "打开 Agent 预设",
			rolesNoSelection: "已选定：自由聊天",
			rolesSelectionHint: "已选岗位 · 仅界面预览",
			rolesReset: "返回自由聊天",
			rolesSelectionDone: "已选定：",
			rolesPreview: "界面预览",
			rolesCreate: "创建岗位助手",
			rolesExample: "示例岗位",
			rolesAnalyst: "需求分析助手",
			rolesSummary: "梳理办公业务需求，厘清流程与功能，明确待确认事项。",
			rolesTagOne: "需求梳理",
			rolesTagTwo: "流程分析",
			rolesTagThree: "结构化输出",
			rolesMarketing: "市场部助手",
			rolesMarketingSummary: "整理市场与客户信息，策划推广内容，协助跟进商机。",
			rolesMarketingTagOne: "市场洞察",
			rolesMarketingTagTwo: "营销策划",
			rolesMarketingTagThree: "客户沟通",
			rolesMarketingDuties: "协助整理市场动态、客户需求与竞品信息，构思推广方案和宣传文案，梳理客户沟通要点与商机跟进事项。",
			rolesMarketingRequirements: "区分已知事实、分析判断与待核实信息，不编造市场数据或客户反馈。\n文案贴合目标客户与使用场景，对外承诺须由业务人员确认。",
			rolesMarketingFormat: "一、目标与受众\n二、市场与客户洞察\n三、推广建议与内容草案\n四、跟进事项",
			rolesManager: "项目经理助手",
			rolesManagerSummary: "拆解项目计划，跟踪里程碑与风险，让团队协作更清晰。",
			rolesManagerTagOne: "计划拆解",
			rolesManagerTagTwo: "进度跟踪",
			rolesManagerTagThree: "风险管理",
			rolesManagerDuties: "协助明确项目目标与交付范围，拆解任务、依赖和里程碑，整理进度周报、会议纪要及风险清单。",
			rolesManagerRequirements: "以已确认的范围、时间和资源为依据，不擅自承诺工期或分配责任人。\n明确任务依赖、阻塞事项和待决策问题，缺失信息标注待确认。",
			rolesManagerFormat: "一、项目目标与当前进展\n二、任务计划与里程碑\n三、风险及阻塞事项\n四、下一步行动与待确认事项",
			rolesDeveloper: "开发助手",
			rolesDeveloperSummary: "梳理技术实现，辅助代码分析与问题定位，完善测试思路。",
			rolesDeveloperTagOne: "技术设计",
			rolesDeveloperTagTwo: "代码分析",
			rolesDeveloperTagThree: "测试建议",
			rolesDeveloperDuties: "协助将明确需求转为技术方案，分析代码结构与问题原因，提供实现建议、代码示例和测试要点。",
			rolesDeveloperRequirements: "结合已提供的技术栈、接口和项目约束，不假设未确认的实现。\n区分建议、示例与实际执行结果；未经运行的代码和测试明确标注未验证。",
			rolesDeveloperFormat: "一、需求理解与技术方案\n二、实现步骤或代码示例\n三、测试要点\n四、风险与待确认事项",
			rolesConfigure: "查看配置",
			rolesExisting: "高级预设",
			rolesExistingHint: "继续管理已有预设及其配置。",
			rolesNotice: "当前为界面预览，岗位配置暂不保存，也不会用于实际对话。",
			rolesChoose: "选择对话助手",
			rolesChooseHint: "根据本次工作，选择合适的助手。",
			rolesChatSummary: "日常问答、写作与灵感交流",
			rolesSelected: "已选择",
			rolesSelect: "预览此岗位",
			rolesSwitchHint: "开始对话后如需切换助手，请新建对话。",
			rolesBack: "返回助手列表",
			rolesClose: "关闭",
			rolesEdit: "岗位配置",
			rolesEditHint: "用清晰的职责、要求和输出格式，定义助手如何协助工作。",
			rolesName: "助手名称",
			rolesNamePlaceholder: "例如：需求分析助手",
			rolesColor: "卡片颜色",
			rolesCustomColor: "自定义颜色",
			rolesColorHint: "选择常用颜色，或打开调色盘；右侧即时预览。",
			rolesDuties: "岗位职责",
			rolesDutiesPlaceholder: "说明助手负责什么工作、服务哪些业务场景",
			rolesRequirements: "工作要求",
			rolesRequirementsPlaceholder: "说明必须遵守的规则，以及需要注意的边界",
			rolesFormat: "输出格式",
			rolesFormatPlaceholder: "说明回答应包含哪些内容，以及如何组织",
			rolesDutiesValue: "协助梳理核电企业办公业务的软件需求，理解业务目标、使用角色与操作流程，整理功能清单和待确认事项。",
			rolesRequirementsValue: "区分明确需求与待确认事项，不自行补充业务规则。\n信息不足时先提出澄清问题，使用业务人员易懂的语言。",
			rolesFormatValue: "一、业务目标\n二、操作步骤\n三、功能清单\n四、待确认事项",
			rolesLivePreview: "配置预览",
			rolesLiveHint: "填写内容会即时显示在这里",
			rolesUnnamed: "未命名岗位助手",
			rolesEmpty: "填写左侧内容后在这里预览",
			rolesCancel: "取消",
			rolesDone: "完成预览",
			rolesSave: "保存并启用",
			rolesSaveHint: "保存功能将在后续版本接入；关闭后不保留本次编辑。",
			rolesNewSessionHint: "配置修改将在新对话中使用。",
			rolesChatOnly: "当前仅预览岗位界面。返回自由聊天后即可发送消息。",
			rolesReturnChat: "返回自由聊天",
			rolesComposer: "输入工作需求（岗位对话尚未接通）"
		};
		const roleEn = {
			rolesTitle: "Role assistants",
			rolesDescription: "An assistant that understands each kind of work.",
			rolesPick: "Select assistant",
			rolesChosen: "Selected",
			rolesCurrent: "Current assistant",
			rolesManage: "Open Agent presets",
			rolesNoSelection: "Selected: Chat",
			rolesSelectionHint: "Selected role · UI preview only",
			rolesReset: "Return to Chat",
			rolesSelectionDone: "Selected: ",
			rolesPreview: "UI preview",
			rolesCreate: "Create role assistant",
			rolesExample: "Example role",
			rolesAnalyst: "Requirements analyst",
			rolesSummary: "Clarify business needs, map workflows and list open questions.",
			rolesTagOne: "Requirements",
			rolesTagTwo: "Workflows",
			rolesTagThree: "Structured output",
			rolesMarketing: "Marketing assistant",
			rolesMarketingSummary: "Organize market insights, plan campaigns and support customer outreach.",
			rolesMarketingTagOne: "Market insights",
			rolesMarketingTagTwo: "Campaign planning",
			rolesMarketingTagThree: "Customer outreach",
			rolesMarketingDuties: "Organize market trends, customer needs and competitor information. Draft campaign ideas, copy and follow-up actions.",
			rolesMarketingRequirements: "Separate facts, interpretations and information to verify. Do not invent market data or customer feedback.\nAdapt copy to the audience and context. Business owners must confirm external commitments.",
			rolesMarketingFormat: "1. Goals and audience\n2. Market and customer insights\n3. Campaign suggestions and draft content\n4. Follow-up actions",
			rolesManager: "Project manager assistant",
			rolesManagerSummary: "Break down plans, track milestones and risks, and clarify team coordination.",
			rolesManagerTagOne: "Project planning",
			rolesManagerTagTwo: "Progress tracking",
			rolesManagerTagThree: "Risk management",
			rolesManagerDuties: "Clarify project goals and scope. Break down tasks, dependencies and milestones. Draft progress reports, meeting notes and risk lists.",
			rolesManagerRequirements: "Use confirmed scope, schedules and resources. Do not invent deadlines or assign owners without confirmation.\nIdentify dependencies, blockers and decisions. Mark missing information as unconfirmed.",
			rolesManagerFormat: "1. Goals and progress\n2. Tasks and milestones\n3. Risks and blockers\n4. Next actions and open questions",
			rolesDeveloper: "Development assistant",
			rolesDeveloperSummary: "Explore implementation plans, analyze code and issues, and suggest tests.",
			rolesDeveloperTagOne: "Technical design",
			rolesDeveloperTagTwo: "Code analysis",
			rolesDeveloperTagThree: "Test suggestions",
			rolesDeveloperDuties: "Turn confirmed requirements into technical proposals. Analyze code and issues, suggest implementation steps, code examples and test cases.",
			rolesDeveloperRequirements: "Use the supplied stack, interfaces and project constraints. Do not assume unconfirmed implementation details.\nDistinguish suggestions and examples from execution results. Clearly mark untested code and tests.",
			rolesDeveloperFormat: "1. Requirements and technical proposal\n2. Implementation steps or code examples\n3. Test considerations\n4. Risks and open questions",
			rolesConfigure: "View configuration",
			rolesExisting: "Advanced presets",
			rolesExistingHint: "Manage your existing presets and configurations.",
			rolesNotice: "UI preview only. Role settings are not saved or used in conversations yet.",
			rolesChoose: "Choose an assistant",
			rolesChooseHint: "Choose an assistant for the work at hand.",
			rolesChatSummary: "Everyday questions, writing and ideas",
			rolesSelected: "Selected",
			rolesSelect: "Preview this role",
			rolesSwitchHint: "Start a new conversation to switch assistants after chatting begins.",
			rolesBack: "Back to assistants",
			rolesClose: "Close",
			rolesEdit: "Role configuration",
			rolesEditHint: "Define responsibilities, working rules and the expected output.",
			rolesName: "Assistant name",
			rolesNamePlaceholder: "e.g. Requirements analyst",
			rolesColor: "Card color",
			rolesCustomColor: "Custom color",
			rolesColorHint: "Choose a swatch or open the color picker. Preview updates instantly.",
			rolesDuties: "Responsibilities",
			rolesDutiesPlaceholder: "Describe the work and business context",
			rolesRequirements: "Working requirements",
			rolesRequirementsPlaceholder: "Describe rules and boundaries",
			rolesFormat: "Output format",
			rolesFormatPlaceholder: "Describe the content and structure of responses",
			rolesDutiesValue: "Help clarify software requirements for office workflows in a nuclear power enterprise. Identify business goals, user roles, workflows, features and open questions.",
			rolesRequirementsValue: "Separate confirmed requirements from open questions. Do not invent business rules.\nAsk for clarification when information is missing. Use clear business language.",
			rolesFormatValue: "1. Business goals\n2. Workflow steps\n3. Feature list\n4. Open questions",
			rolesLivePreview: "Configuration preview",
			rolesLiveHint: "Updates as you type",
			rolesUnnamed: "Untitled role assistant",
			rolesEmpty: "Fill in the form to preview its content here",
			rolesCancel: "Cancel",
			rolesDone: "Finish preview",
			rolesSave: "Save and enable",
			rolesSaveHint: "Saving will be added later. Closing discards these edits.",
			rolesNewSessionHint: "Configuration changes will apply to new conversations.",
			rolesChatOnly: "This role is a UI preview. Switch back to Chat to send messages.",
			rolesReturnChat: "Switch back to Chat",
			rolesComposer: "Describe your task (role chat is not connected yet)"
		};
		//#endregion
		//#region src/client/capability-copy.ts
		const capabilityZh = {
			capHideLibrary: "收起能力库",
			capShowLibrary: "展开能力库",
			capHideSettings: "收起配件设置",
			capShowSettings: "展开配件设置",
			capResizeHint: "拖动调整宽度，向外拖到底可收起",
			capRestoreHint: "点击或向内拖动恢复",
			capAlreadyAdded: "此配件已添加：",
			capLibrary: "能力配件库",
			capLibraryHint: "拖入助手，组合它的工作能力",
			capSearch: "搜索配件",
			capAll: "全部",
			capWeb: "网页",
			capOffice: "办公",
			capData: "资料",
			capCount: "款示例配件",
			capBrowser: "浏览器操作",
			capBrowserDesc: "浏览网页、读取信息、填写表单",
			capDocuments: "文档处理",
			capDocumentsDesc: "整理内容，撰写报告与工作文档",
			capSheets: "表格处理",
			capSheetsDesc: "整理数据，分析与汇总表格",
			capKnowledge: "知识库",
			capKnowledgeDesc: "查阅资料，为回答补充依据",
			capFiles: "本地文件",
			capFilesDesc: "查找文件，整理工作目录",
			capMail: "邮件协作",
			capMailDesc: "整理来信，准备邮件草稿",
			capAdd: "添加",
			capAdded: "已添加",
			capRemove: "移除",
			capInspect: "查看配件设置",
			capNoResults: "没有找到相关配件",
			capClear: "清空筛选",
			capExample: "示例",
			capCanvas: "助手配置",
			capIdentity: "岗位信息",
			capAdvanced: "工作要求与输出格式",
			capAttached: "已添加的能力",
			capAttachedHint: "点击配件卡片，在右侧调整设置。",
			capDrop: "将配件拖到这里",
			capDropHint: "也可以点击左侧配件的“添加”按钮",
			capDropMore: "拖入更多配件",
			capEmpty: "还没有添加能力配件",
			capSettings: "配件设置",
			capOverview: "配置预览",
			capEnabled: "启用此能力",
			capEnableHint: "仅调整本次预览中的开关状态",
			capActive: "已启用",
			capPaused: "已停用",
			capNotAdded: "尚未添加到此助手",
			capProvider: "提供方",
			capStatus: "连接状态",
			capNotConnected: "未连接 · 界面演示",
			capBrowserChoice: "使用的浏览器",
			capAccess: "访问范围",
			capAnySite: "所有网站",
			capSpecificSite: "指定网站",
			capSites: "允许访问的网站",
			capSitesPlaceholder: "每行一个域名，例如 example.com",
			capActions: "允许的操作",
			capRead: "读取网页",
			capFill: "填写表单",
			capSubmit: "提交操作",
			capConfirm: "提交前由我确认",
			capConfirmHint: "权限设置仅作展示，尚未用于实际操作。",
			capOutput: "输出形式",
			capDocOutput: "工作报告",
			capSheetOutput: "汇总表格",
			capMailOutput: "邮件草稿",
			capSource: "资料来源",
			capSourcePlaceholder: "例如：项目资料、产品手册",
			capFolder: "工作目录",
			capFolderPlaceholder: "例如：项目资料 / 输出",
			capReview: "完成后由我检查",
			capReviewHint: "设置助手交付结果时的检查方式",
			capGuide: "先选择一个配件",
			capGuideHint: "从能力库添加配件，或点击已添加的能力卡片。",
			capBoundary: "仅预览 · 不安装插件、不连接浏览器，关闭后不保留配置",
			capFooter: "组合职责与能力，预览你的岗位助手。",
			capAbilitySummary: "能力组合",
			capAddAnnouncement: "已添加配件：",
			capRemoveAnnouncement: "已移除配件：",
			capDemoNote: "配件目录为示例，尚未读取已安装插件。",
			capColorDetails: "外观与配色"
		};
		const capabilityEn = {
			capHideLibrary: "Hide capability library",
			capShowLibrary: "Show capability library",
			capHideSettings: "Hide capability settings",
			capShowSettings: "Show capability settings",
			capResizeHint: "Drag to resize; drag outward to collapse",
			capRestoreHint: "Click or drag inward to restore",
			capAlreadyAdded: "Already added: ",
			capLibrary: "Capability library",
			capLibraryHint: "Drag capabilities into your assistant",
			capSearch: "Search capabilities",
			capAll: "All",
			capWeb: "Web",
			capOffice: "Office",
			capData: "Knowledge",
			capCount: "example capabilities",
			capBrowser: "Browser",
			capBrowserDesc: "Browse pages, read information and fill forms",
			capDocuments: "Documents",
			capDocumentsDesc: "Organize content and draft work reports",
			capSheets: "Spreadsheets",
			capSheetsDesc: "Organize, analyze and summarize data",
			capKnowledge: "Knowledge base",
			capKnowledgeDesc: "Find reference material for your answers",
			capFiles: "Local files",
			capFilesDesc: "Find files and organize working folders",
			capMail: "Email",
			capMailDesc: "Review incoming mail and prepare drafts",
			capAdd: "Add",
			capAdded: "Added",
			capRemove: "Remove",
			capInspect: "Inspect capability",
			capNoResults: "No matching capabilities",
			capClear: "Clear filters",
			capExample: "Example",
			capCanvas: "Assistant setup",
			capIdentity: "Role information",
			capAdvanced: "Requirements and output format",
			capAttached: "Attached capabilities",
			capAttachedHint: "Select a card to adjust its settings on the right.",
			capDrop: "Drop capabilities here",
			capDropHint: "Or use the Add button in the library",
			capDropMore: "Drop another capability",
			capEmpty: "No capabilities added yet",
			capSettings: "Capability settings",
			capOverview: "Configuration preview",
			capEnabled: "Enable capability",
			capEnableHint: "Changes this preview only",
			capActive: "Enabled",
			capPaused: "Disabled",
			capNotAdded: "Not attached to this assistant",
			capProvider: "Provider",
			capStatus: "Connection",
			capNotConnected: "Not connected · Demo",
			capBrowserChoice: "Browser",
			capAccess: "Website access",
			capAnySite: "All websites",
			capSpecificSite: "Specific websites",
			capSites: "Allowed websites",
			capSitesPlaceholder: "One domain per line, e.g. example.com",
			capActions: "Allowed actions",
			capRead: "Read pages",
			capFill: "Fill forms",
			capSubmit: "Submit actions",
			capConfirm: "Ask me before submitting",
			capConfirmHint: "Permission controls are a preview and are not enforced yet.",
			capOutput: "Output type",
			capDocOutput: "Work report",
			capSheetOutput: "Summary table",
			capMailOutput: "Email draft",
			capSource: "Reference sources",
			capSourcePlaceholder: "e.g. Project materials, product manuals",
			capFolder: "Working folder",
			capFolderPlaceholder: "e.g. Project materials / Output",
			capReview: "Let me review the result",
			capReviewHint: "Choose how the assistant hands over its work",
			capGuide: "Choose a capability",
			capGuideHint: "Add an item from the library or select an attached card.",
			capBoundary: "Preview only · No installation or browser connection. Closing discards changes.",
			capFooter: "Combine a role and capabilities to preview your assistant.",
			capAbilitySummary: "Capability mix",
			capAddAnnouncement: "Capability added: ",
			capRemoveAnnouncement: "Capability removed: ",
			capDemoNote: "Example catalog. Installed plugins are not queried.",
			capColorDetails: "Appearance and color"
		};
		//#endregion
		//#region src/client/locales.ts
		const zh = {
			...roleZh,
			...capabilityZh,
			...centerZh,
			appearanceTitle: "外观",
			placeholder: "输入消息，开始对话",
			send: "发送消息",
			sending: "正在准备会话…",
			mode: "自由聊天",
			workspace: "选择工作区（可选）",
			history: "聊天",
			hint: "直接提问或写作；处理项目文件时再选择工作区。",
			model: "使用设置中的默认模型，进入会话后可切换。",
			failed: "无法开始对话，内容已保留。请检查模型与连接后重试。",
			unavailable: "自由聊天未加载，请重启 DSH 后刷新页面。"
		};
		const en = {
			...roleEn,
			...capabilityEn,
			...centerEn,
			appearanceTitle: "Appearance",
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
					return ctx.locale.register(NS, "ru", {
						...en,
						...ru
					});
				} catch {
					return () => {};
				}
			}, "plain-chat: central Russian dictionary");
			const t = ctx.locale.bind(NS);
			const chatRoot = document.querySelector("meta[name=\"dsh-plain-chat-root\"]")?.content ?? "";
			const sessions = ctx.sessions;
			const loadMeetingModels = async () => {
				const result = await ctx.remote.session?.modelCatalog?.();
				if (!result?.ok) return [];
				return (result.value?.groups ?? []).flatMap((group) => (group.models ?? []).map((model) => ({
					id: `${group.id ?? group.provider}/${model.id}`,
					name: model.name ?? model.id
				}))).filter((model) => !model.id.startsWith("undefined/"));
			};
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
			const roleSelection = createRoleSelection();
			const localConversations = createLocalConversations();
			const requirementHistory = createRequirementHistory();
			const developerHistory = createDeveloperHistory();
			let developerNavigation = 0;
			let developerViewKey = `developer-${developerHistory.getSnapshot().activeId ?? "initial"}`;
			if (sessions.list.getSnapshot().current !== void 0 || localConversations.active()) developerHistory.leave();
			ctx.effect(() => {
				developerHistory.load();
				const refresh = () => {
					developerHistory.load();
				};
				window.addEventListener("focus", refresh);
				return () => window.removeEventListener("focus", refresh);
			}, "plain-chat: developer history");
			let requirementViewKey = `requirements-${requirementHistory.getSnapshot().activeId ?? "initial"}`;
			let requirementNavigation = 0;
			if (sessions.list.getSnapshot().current !== void 0 || localConversations.active()) requirementHistory.leave();
			ctx.effect(() => {
				requirementHistory.load();
				const refresh = () => {
					requirementHistory.load();
				};
				window.addEventListener("focus", refresh);
				return () => window.removeEventListener("focus", refresh);
			}, "plain-chat: requirement history");
			const resumedLocal = localConversations.active();
			if (resumedLocal && sessions.list.getSnapshot().current === void 0) roleSelection.select(resumedLocal.role);
			else if (resumedLocal) localConversations.leave();
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
					const local = localConversations.active();
					if (local?.kind === "draft") localConversations.commitChat(local.id);
					sessions.open(binding.sessionId);
					layout.selectPanel(null);
					input.submit();
				}
			}, chatRoot, () => `session-${crypto.randomUUID()}`, () => {
				const selected = roleSelection.getSnapshot();
				if (selected === "chat") return PRESET_ID;
				const role = capabilityClient.getSnapshot().data?.state.roles.find((r) => r.id === selected);
				const version = role && latest(role.versions);
				if (!role?.enabled || !version) throw new Error("此岗位尚未发布或已停用，请重新选择岗位。");
				return version.preset;
			});
			const selectRole = (id) => {
				if (id === roleSelection.getSnapshot()) return;
				start.reset();
				requirementHistory.leave();
				developerHistory.leave();
				developerViewKey = `developer-new-${++developerNavigation}`;
				requirementViewKey = `requirements-${id}-${++requirementNavigation}`;
				roleSelection.select(id);
				if (sessions.list.getSnapshot().current === void 0) {
					const active = localConversations.active();
					const local = active?.kind === "demo" ? localConversations.start(id) : active ?? localConversations.start(id);
					if (local.kind === "draft") localConversations.setRole(local.id, id);
				}
			};
			const startFreshChat = (role = "chat") => {
				requirementViewKey = `requirements-new-${role}-${++requirementNavigation}`;
				requirementHistory.leave();
				developerHistory.leave();
				developerViewKey = `developer-new-${++developerNavigation}`;
				start.reset();
				clearSavedDraft();
				localConversations.start(role);
				if (roleSelection.getSnapshot() !== role) roleSelection.select(role);
				revision++;
				listeners.forEach((fn) => fn());
				sessions.clear();
				layout.selectPanel(null);
			};
			const openLocalConversation = (id) => {
				const developer = developerHistory.getSnapshot().items.find((item) => item.id === id);
				if (developer) {
					developerViewKey = `developer-${id}-${++developerNavigation}`;
					start.reset();
					localConversations.leave();
					requirementHistory.leave();
					developerHistory.open(id);
					roleSelection.select(developer.roleId);
					clearSavedDraft();
					revision++;
					listeners.forEach((fn) => fn());
					sessions.clear();
					layout.selectPanel(null);
					return;
				}
				developerHistory.leave();
				developerViewKey = `developer-local-${id}-${++developerNavigation}`;
				const requirement = requirementHistory.getSnapshot().items.find((item) => item.id === id);
				if (requirement) {
					requirementViewKey = `requirements-${id}-${++requirementNavigation}`;
					start.reset();
					localConversations.leave();
					requirementHistory.open(id);
					roleSelection.select(requirement.roleId);
					clearSavedDraft();
					revision++;
					listeners.forEach((fn) => fn());
					sessions.clear();
					layout.selectPanel(null);
					return;
				}
				requirementHistory.leave();
				const row = localConversations.getSnapshot().items.find((item) => item.id === id);
				if (!row) return;
				requirementViewKey = `requirements-local-${id}-${++requirementNavigation}`;
				start.reset();
				localConversations.open(id);
				roleSelection.select(row.role);
				try {
					sessionStorage.setItem("workbench-chat-draft", row.draft);
				} catch {}
				revision++;
				listeners.forEach((fn) => fn());
				sessions.clear();
				layout.selectPanel(null);
			};
			const removeLocalConversation = (id) => {
				const developer = developerHistory.getSnapshot().items.find((item) => item.id === id);
				if (developer) {
					if (!window.confirm(`移除“${developer.title}”的开发记录？代码、提交和工作目录保留；此对话和运行记录将被删除。`)) return;
					const active = developerHistory.getSnapshot().activeId === id, navigation = developerViewKey;
					developerHistory.remove(id).then(() => {
						if (active && navigation === developerViewKey) startFreshChat();
					}).catch((error) => window.alert(error instanceof Error ? error.message : String(error)));
					return;
				}
				const requirement = requirementHistory.getSnapshot().items.find((item) => item.id === id);
				if (requirement) {
					if (!window.confirm(`移除“${requirement.title}”？这将删除此需求分析的资料、对话、需求条目和确认版本，无法撤销。`)) return;
					const active = requirementHistory.getSnapshot().activeId === id;
					const navigation = requirementViewKey;
					requirementHistory.remove(id).then(() => {
						if (active && navigation === requirementViewKey && sessions.list.getSnapshot().current === void 0) startFreshChat();
					}).catch((error) => window.alert(error instanceof Error ? error.message : String(error)));
					return;
				}
				const row = localConversations.getSnapshot().items.find((item) => item.id === id);
				const meetingId = row?.meeting && typeof row.meeting === "object" ? row.meeting.jobId : void 0;
				if (typeof meetingId === "string") fetch(`/api/capabilities/meeting/job/${encodeURIComponent(meetingId)}`, {
					method: "DELETE",
					credentials: "same-origin"
				}).catch(() => {});
				const active = localConversations.getSnapshot().activeId === id;
				localConversations.remove(id);
				if (!active) return;
				start.reset();
				clearSavedDraft();
				roleSelection.select("chat");
				revision++;
				listeners.forEach((fn) => fn());
			};
			ctx.effect(() => {
				return sessions.list.subscribe(() => {
					if (sessions.list.getSnapshot().current !== void 0) {
						if (localConversations.active()) localConversations.leave();
						if (requirementHistory.getSnapshot().activeId) requirementHistory.leave();
						if (developerHistory.getSnapshot().activeId) developerHistory.leave();
					}
				});
			}, "plain-chat: local draft lifecycle");
			const registry = ctx.slots;
			createCapabilityPreview();
			registerCapabilityCenter(ctx.slots, () => t("centerTitle"), () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagedCenter, {}));
			const settingsNavigation = createSettingsNavigation();
			ctx.effect(() => {
				const open = (event) => settingsNavigation.openSection(event.detail.section);
				window.addEventListener("workbench-capability-link", open);
				return () => window.removeEventListener("workbench-capability-link", open);
			}, "plain-chat: capability links");
			ctx.effect(() => decorateSlot(registry, "sidebar.settings", "SettingsRoot", (Original) => withAppearanceNavigation(Original, () => t("appearanceTitle"), settingsNavigation)), "plain-chat: appearance navigation group");
			ctx.effect(() => decorateSlot(registry, "settings.section", "AgentPresetSection", (Original) => function RolePresetSection(props) {
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagedRolesSection, {
					selected: (0, react.useSyncExternalStore)(roleSelection.subscribe, roleSelection.getSnapshot),
					onSelect: selectRole
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AgentPresetDisclosure, {
					t,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Original, { ...props })
				})] });
			}), "plain-chat: role assistant settings preview");
			ctx.effect(() => decorateSlot(registry, "main.conversation", "ConversationRoot", (Original) => {
				return function ChatConversation(props) {
					const draftKey = (0, react.useSyncExternalStore)(subscribe, snapshot);
					const selectedRole = (0, react.useSyncExternalStore)(roleSelection.subscribe, roleSelection.getSnapshot);
					const localSnapshot = (0, react.useSyncExternalStore)(localConversations.subscribe, localConversations.getSnapshot);
					const local = localSnapshot.items.find((row) => row.id === localSnapshot.activeId);
					const requirementSnapshot = (0, react.useSyncExternalStore)(requirementHistory.subscribe, requirementHistory.getSnapshot);
					const requirement = requirementSnapshot.items.find((row) => row.id === requirementSnapshot.activeId);
					const developerSnapshot = (0, react.useSyncExternalStore)(developerHistory.subscribe, developerHistory.getSnapshot);
					const developer = developerSnapshot.items.find((row) => row.id === developerSnapshot.activeId);
					const developerKey = developerViewKey;
					const effectiveRole = developer?.roleId ?? requirement?.roleId ?? local?.role ?? selectedRole;
					const capabilities = (0, react.useSyncExternalStore)(capabilityClient.subscribe, capabilityClient.getSnapshot);
					const analysisRole = capabilities.data?.state.roles.find((role) => role.id === effectiveRole);
					const analysisVersion = requirement ? analysisRole?.versions.find((version) => version.version === requirement.roleVersion) : analysisRole && latest(analysisRole.versions);
					const developerVersion = developer ? analysisRole?.versions.find((v) => v.version === developer.roleVersion) : analysisRole && latest(analysisRole.versions);
					const showDeveloper = Boolean(developer) || usesDeveloper(capabilities.data?.state, developerVersion);
					const analysisViewKey = requirementViewKey;
					const showRequirements = Boolean(requirement) || usesRequirements(capabilities.data?.state, analysisVersion);
					const meetingRole = capabilities.data?.state.roles.find((role) => role.id === MEETING_DEMO_ROLE_ID);
					const savedMeetingVersion = local?.meeting && typeof local.meeting === "object" ? local.meeting.roleVersion : void 0;
					const meetingVersion = meetingRole?.versions.find((version) => version.version === savedMeetingVersion) ?? (meetingRole && latest(meetingRole.versions));
					const summary = props.useSessions((s) => props.sessionId ? s.byId[props.sessionId] : void 0);
					const composerBlock = props.useComposerBlock((block) => block);
					const actualPreset = summary?.projectionValues?.agentPreset;
					const plain = actualPreset === "workbench-chat" || String(actualPreset ?? "").startsWith("workbench-role-") || created.has(props.sessionId);
					const noSession = props.sessionId === void 0;
					const sessionRole = actualPreset === "workbench-chat" ? "chat" : capabilities.data?.state.roles.find((role) => role.versions.some((version) => version.preset === actualPreset))?.id;
					const displayedRole = noSession ? effectiveRole : sessionRole ?? (actualPreset ? "chat" : selectedRole);
					const translate = (key, ...args) => key === "hero.chooseWorkspace" && (plain || noSession) ? t("workspace") : props.t(key, ...args);
					const renderSlot = (key, owner, ...rest) => {
						if (key === "conversation.hero.agentPreset" && noSession) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagedRolePicker, {
							t,
							selected: effectiveRole,
							onSelect: selectRole
						});
						if (key === "conversation.hero.agentPreset" && plain) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: Chat_module_css_default.badge,
							children: t("mode")
						});
						if (key === "conversation.composer.bar") {
							if (noSession) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DraftComposer, {
								start,
								t,
								available: chatRoot !== "",
								initialDraft: local?.kind === "draft" ? local.draft : void 0,
								onDraftChange: (value) => {
									let row = localConversations.active();
									if (!row && value.trim()) row = localConversations.start(effectiveRole);
									if (row?.kind === "draft") localConversations.setDraft(row.id, value);
								}
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
						if (binding && local?.kind === "draft") localConversations.commitChat(local.id);
					};
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: Chat_module_css_default.conversationShell,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: Chat_module_css_default.assistantToolbar,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagedCurrentAssistant, {
									selected: displayedRole,
									preset: noSession && showDeveloper ? developerVersion?.preset : noSession && showRequirements ? analysisVersion?.preset : noSession && effectiveRole === MEETING_DEMO_ROLE_ID ? meetingVersion?.preset : noSession ? void 0 : actualPreset,
									onOpen: settingsNavigation.openPresets
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrowserTaskStatus, { sessionId: props.sessionId }),
							String(actualPreset ?? "").startsWith("workbench-role-") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrowserObservation, { sessionId: props.sessionId }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: Chat_module_css_default.conversationContent,
								children: noSession && developerSnapshot.activeId && !developer ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									role: "status",
									children: [
										developerSnapshot.error || "正在恢复开发任务…",
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											onClick: () => {
												developerHistory.load();
											},
											children: "重新读取"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											onClick: () => startFreshChat(),
											children: "返回新对话"
										})
									]
								}) : noSession && showDeveloper ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DeveloperAssistant, {
									taskId: developer?.id,
									draftKey: local?.id ?? developerKey,
									initialDraft: local?.kind === "draft" ? local.draft : void 0,
									roleId: effectiveRole,
									roleVersion: developerVersion?.version,
									loadModels: loadMeetingModels,
									onDraftChange: (value) => {
										if (developerKey !== developerViewKey || sessions.list.getSnapshot().current !== void 0 || developerHistory.getSnapshot().activeId) return;
										const row = localConversations.active();
										if (row?.kind === "draft" && row.role === effectiveRole && row.draft !== value) localConversations.setDraft(row.id, value);
									},
									onCommit: (task) => {
										const current = developerKey === developerViewKey && sessions.list.getSnapshot().current === void 0 && roleSelection.getSnapshot() === effectiveRole;
										const origin = local && localConversations.getSnapshot().items.find((row) => row.id === local.id);
										if (current && origin?.kind === "draft") localConversations.commitChat(origin.id);
										developerHistory.upsert(task, current);
									}
								}, developerKey) : noSession && requirementSnapshot.activeId && !requirement ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									role: "status",
									children: [
										requirementSnapshot.error || "正在恢复需求分析…",
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											onClick: () => {
												requirementHistory.load();
											},
											children: "重新读取"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											onClick: () => startFreshChat(),
											children: "返回新对话"
										})
									]
								}) : noSession && showRequirements ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RequirementsAssistant, {
									taskId: requirement?.id,
									draftKey: local?.id ?? analysisViewKey,
									initialDraft: local?.kind === "draft" ? local.draft : void 0,
									roleId: effectiveRole,
									roleVersion: analysisVersion?.version,
									assistant: analysisVersion,
									loadModels: loadMeetingModels,
									onDraftChange: (value) => {
										if (analysisViewKey !== requirementViewKey || sessions.list.getSnapshot().current !== void 0 || requirementHistory.getSnapshot().activeId) return;
										const row = localConversations.active();
										if (row?.kind === "draft" && row.role === effectiveRole && row.draft !== value) localConversations.setDraft(row.id, value);
									},
									onCommit: (task) => {
										const activeId = requirementHistory.getSnapshot().activeId;
										const current = analysisViewKey === requirementViewKey && sessions.list.getSnapshot().current === void 0 && (requirement ? activeId === requirement.id : revision === draftKey && roleSelection.getSnapshot() === effectiveRole && (!activeId || activeId === task.id));
										const origin = localSnapshot.items.find((row) => row.id === local?.id);
										const retained = origin && localConversations.getSnapshot().items.find((row) => row.id === origin.id);
										if (retained?.kind === "draft" && retained.role === effectiveRole && (current || retained.draft === origin?.draft)) localConversations.commitChat(retained.id);
										requirementHistory.upsert(task, current);
									}
								}, analysisViewKey) : noSession && (local?.kind === "demo" || effectiveRole === MEETING_DEMO_ROLE_ID) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MeetingDemo, {
									initialState: local?.meeting,
									assistant: meetingVersion,
									roleVersion: meetingVersion?.version,
									loadModels: loadMeetingModels,
									onSnapshot: (state) => {
										const row = localConversations.active() ?? localConversations.start(MEETING_DEMO_ROLE_ID);
										localConversations.setMeeting(row.id, state, state.draft);
									},
									onCommit: (title) => {
										const row = localConversations.active() ?? localConversations.start(MEETING_DEMO_ROLE_ID);
										localConversations.commitDemo(row.id, title);
									},
									onReset: () => startFreshChat(MEETING_DEMO_ROLE_ID)
								}, draftKey) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Original, {
									...props,
									t: translate,
									renderSlot,
									selectWorkspace
								})
							})
						]
					});
				};
			}), "plain-chat: conversation adapter");
			ctx.effect(() => decorateSlot(registry, "sidebar", "SidebarRoot", (Original) => function ChatSidebar(props) {
				const startSession = (workspaceId) => {
					if (workspaceId !== void 0) return props.startSession(workspaceId);
					startFreshChat();
				};
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Original, {
					...props,
					startSession
				});
			}), "plain-chat: new conversation");
			ctx.effect(() => decorateSlot(registry, "sidebar.workspaces", "WorkspaceBrowser", (Original) => function ChatHistory(props) {
				const local = (0, react.useSyncExternalStore)(localConversations.subscribe, localConversations.getSnapshot);
				const requirements = (0, react.useSyncExternalStore)(requirementHistory.subscribe, requirementHistory.getSnapshot);
				const developers = (0, react.useSyncExternalStore)(developerHistory.subscribe, developerHistory.getSnapshot);
				const historyRows = [
					...local.items,
					...developers.items.map((item) => ({
						id: item.id,
						role: item.roleId,
						kind: "developer",
						title: item.title,
						draft: "",
						updatedAt: Date.parse(item.updatedAt)
					})),
					...requirements.items.map((item) => ({
						id: item.id,
						role: item.roleId,
						kind: "requirements",
						title: item.title,
						draft: "",
						updatedAt: Date.parse(item.updatedAt)
					}))
				].sort((a, b) => b.updatedAt - a.updatedAt);
				const [host, setHost] = (0, react.useState)(null);
				const translate = (key, ...args) => key === "group.ungrouped" ? t("history") : props.t(key, ...args);
				const ungroupedNewLabel = props.t("actions.newSession.aria", { name: t("history") });
				const onClickCapture = (event) => {
					const button = event.target.closest("button[aria-label]");
					if (button?.getAttribute("aria-label") !== ungroupedNewLabel) return;
					event.preventDefault();
					event.stopPropagation();
					startFreshChat();
					const header = button?.closest("[role=\"treeitem\"]");
					if (header?.getAttribute("aria-expanded") === "false") header.click();
				};
				const open = (id) => {
					start.reset();
					localConversations.leave();
					requirementHistory.leave();
					developerHistory.leave();
					clearSavedDraft();
					props.open(id);
				};
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: setHost,
					style: { display: "contents" },
					onClickCapture,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Original, {
							...props,
							t: translate,
							open
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(LocalConversationRows, {
							host,
							label: ungroupedNewLabel,
							rows: historyRows,
							activeId: developers.activeId ?? requirements.activeId ?? local.activeId,
							onLoadMore: requirements.hasMore || requirements.error ? () => {
								requirementHistory.load(!requirements.error);
							} : void 0,
							loading: requirements.loading,
							error: requirements.error,
							onOpen: openLocalConversation,
							onRemove: removeLocalConversation
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(NativeConversationRemoval, { sessions })
					]
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