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
		const css$5 = ".yzXCLW_card{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#d5dbe7);background:var(--dsw-alias-bg-layer-2,#fff);width:100%;color:var(--dsw-alias-label-primary,#202938);border-radius:20px;padding:18px;box-shadow:0 3px 14px #182c5010}.yzXCLW_input{resize:vertical;box-sizing:border-box;width:100%;min-height:108px;max-height:300px;color:inherit;font:inherit;background:0 0;border:0;outline:none;line-height:1.6;display:block}.yzXCLW_input::placeholder{color:var(--dsw-alias-label-secondary,#78869f)}.yzXCLW_input:focus-visible{outline-offset:5px;border-radius:4px;outline:2px solid #8b9dd5}.yzXCLW_row{justify-content:space-between;align-items:center;gap:12px;margin-top:10px;display:flex}.yzXCLW_hint{opacity:.72;font-size:12px;line-height:1.6}.yzXCLW_send{background:var(--dsw-alias-button-primary-fill,#405eae);min-width:44px;min-height:44px;color:var(--dsw-alias-label-primary-foreground,#fff);cursor:pointer;border:0;border-radius:999px;flex-shrink:0;padding:10px 16px}.yzXCLW_send:hover{background:var(--dsw-alias-button-primary-hover,#334c91)}.yzXCLW_send:disabled{opacity:.45;cursor:default}.yzXCLW_error{color:#b53232;margin-top:10px;font-size:13px}.yzXCLW_badge{opacity:.8;font-size:14px}.yzXCLW_previewNotice{border-bottom:1px solid var(--dsw-alias-border-l2,#d5dbe7);color:var(--dsw-alias-label-secondary,#78869f);flex-wrap:wrap;align-items:center;gap:8px 16px;margin-bottom:14px;padding:0 0 14px;font-size:12px;line-height:1.7;display:flex}.yzXCLW_previewNotice button{color:var(--dsw-alias-button-primary-fill,#405eae);cursor:pointer;font:inherit;background:0 0;border:0;padding:3px 0}@media (width<=600px){.yzXCLW_card{padding:14px}.yzXCLW_row{align-items:flex-end}.yzXCLW_hint{font-size:11px}}.yzXCLW_conversationShell{flex-direction:column;min-width:0;height:100%;min-height:0;display:flex}.yzXCLW_assistantToolbar{flex:none;align-items:center;min-width:0;padding:20px 28px 8px;display:flex}.yzXCLW_conversationContent{flex:1;min-width:0;min-height:0}@media (width<=600px){.yzXCLW_assistantToolbar{padding:12px 16px 6px}}";
		const tagId$5 = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/Chat.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$5) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId$5;
			tag.textContent = css$5;
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
		function DraftComposer({ start, t, available, previewOnly = false, onReturnChat }) {
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
		const css$4 = ".W_oMjq_group{width:100%;min-width:0}.W_oMjq_heading{box-sizing:border-box;cursor:pointer;align-items:center;gap:10px;width:100%;list-style:none;display:flex}.W_oMjq_heading::-webkit-details-marker{display:none}.W_oMjq_heading>svg{flex-shrink:0}.W_oMjq_heading:focus-visible{outline:2px solid var(--dsw-alias-button-primary-fill,#4263ba);outline-offset:-2px;border-radius:8px}.W_oMjq_chevron{opacity:.65;margin-left:auto}.W_oMjq_group[open]>.W_oMjq_heading .W_oMjq_chevron{transform:rotate(90deg)}.W_oMjq_children{border-left:1px solid var(--dsw-alias-border-l2,#dfe4ed);flex-direction:column;gap:4px;margin:4px 0 6px 17px;padding-left:10px;display:flex}.W_oMjq_children>button{box-sizing:border-box;width:100%;font-size:13px}";
		const tagId$4 = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/AppearanceNavigation.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
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
		const css$3 = ".fwzdhW_section,.fwzdhW_dialog,.fwzdhW_picker,.fwzdhW_presetDisclosure{--role-bg:var(--dsw-alias-bg-layer-2,#fff);--role-text:var(--dsw-alias-label-primary,#202938);--role-muted:var(--dsw-alias-label-secondary,#758095);--role-border:var(--dsw-alias-border-l2,#e0e5ec);--role-accent:var(--dsw-alias-button-primary-fill,#4263ba);color:var(--role-text);font:inherit}.fwzdhW_section{box-sizing:border-box;width:100%;padding:4px 0 0}.fwzdhW_sectionHeader{justify-content:space-between;align-items:center;gap:20px;margin-bottom:22px;display:flex}.fwzdhW_titleRow{align-items:center;gap:12px;display:flex}.fwzdhW_section h2,.fwzdhW_dialog h2{letter-spacing:-.4px;margin:0;font-size:20px;font-weight:650}.fwzdhW_sectionHeader p{color:var(--role-muted);margin:8px 0 0;font-size:13px;line-height:1.7}.fwzdhW_previewBadge,.fwzdhW_exampleBadge{border:1px solid var(--role-border);color:var(--role-muted);white-space:nowrap;border-radius:6px;flex-shrink:0;align-items:center;padding:3px 8px;font-size:11px;font-weight:500;line-height:1.4;display:inline-flex}.fwzdhW_exampleBadge{background:color-mix(in srgb,var(--role-accent) 8%,var(--role-bg));color:var(--role-accent);border-color:#0000}.fwzdhW_primary,.fwzdhW_secondary{border:1px solid var(--role-border);font:inherit;cursor:pointer;white-space:nowrap;border-radius:9px;padding:10px 16px;font-size:13px;font-weight:550}.fwzdhW_primary{background:var(--role-accent);color:var(--dsw-alias-label-primary-foreground,#fff);border-color:#0000}.fwzdhW_secondary{background:var(--role-bg);color:var(--role-text)}.fwzdhW_primary:hover:not(:disabled){filter:brightness(1.08)}.fwzdhW_primary:disabled{opacity:.42;cursor:not-allowed}.fwzdhW_cards{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;display:grid}.fwzdhW_selectionStatus{min-height:30px;color:var(--role-muted);justify-content:space-between;align-items:center;gap:12px;margin:-4px 0 18px;font-size:12px;line-height:1.7;display:flex}.fwzdhW_roleCard{transition:box-shadow .18s,border-color .18s;position:relative}.fwzdhW_cardSelect{z-index:1;cursor:pointer;background:0 0;border:0;border-radius:12px 12px 0 0;padding:0;position:absolute;inset:0 0 51px}.fwzdhW_cardSelect:hover{background:color-mix(in srgb,var(--role-color) 5%,transparent)}.fwzdhW_roleCard .fwzdhW_cardAction{z-index:2;position:relative}.fwzdhW_cardBody{border-radius:10px 10px 0 0;flex:1;margin:-22px -22px 0;padding:22px 22px 0;position:relative}.fwzdhW_cardBody .fwzdhW_cardSelect{border-radius:10px 10px 0 0;inset:0}.fwzdhW_cardSelect:disabled{cursor:default}.fwzdhW_cardSelect:disabled:hover{background:0 0}.fwzdhW_roleCard .fwzdhW_cardSummary{-webkit-line-clamp:3;overflow-wrap:anywhere;-webkit-box-orient:vertical;min-height:5.4em;display:-webkit-box;overflow:hidden}.fwzdhW_cardControls{z-index:2;border-top:1px solid color-mix(in srgb,var(--role-color) 25%,var(--role-border));align-items:center;gap:18px;display:flex;position:relative}.fwzdhW_cardControls .fwzdhW_cardAction{border-top:0;flex:1;width:auto;min-width:0}.fwzdhW_cardControls .fwzdhW_textButton{min-height:44px;color:var(--role-muted)}.fwzdhW_roleCard .fwzdhW_chatCardNote{padding:14px 0;font-size:12px}.fwzdhW_selectedCard{box-shadow:0 0 0 2px var(--role-color),0 7px 20px color-mix(in srgb,var(--role-color) 20%,transparent);animation:.3s ease-out fwzdhW_roleSelect}.fwzdhW_roleCard .fwzdhW_exampleBadge.fwzdhW_selectedBadge{background:var(--role-color);color:#fff}@keyframes fwzdhW_roleSelect{0%,to{transform:translate(0)}30%{transform:translate(-3px)}60%{transform:translate(3px)}}@media (prefers-reduced-motion:reduce){.fwzdhW_selectedCard{animation:none}}.fwzdhW_currentAssistant{--role-bg:var(--dsw-alias-bg-layer-2,#fff);--role-text:var(--dsw-alias-label-primary,#202938);--role-muted:var(--dsw-alias-label-secondary,#758095);--role-accent:var(--dsw-alias-button-primary-fill,#4263ba);box-sizing:border-box;border:1px solid color-mix(in srgb,var(--role-color) 22%,transparent);background:color-mix(in srgb,var(--role-bg) 88%,transparent);backdrop-filter:blur(12px);max-width:100%;min-height:38px;color:var(--role-text);text-align:left;font:inherit;cursor:pointer;border-radius:22px;align-items:center;gap:8px;padding:6px 12px 6px 7px;transition:background .16s,border-color .16s,box-shadow .16s;display:inline-flex;box-shadow:0 2px 8px #182c5008}.fwzdhW_currentAssistant:hover{background:color-mix(in srgb,var(--role-color) 8%,var(--role-bg));border-color:color-mix(in srgb,var(--role-color) 45%,transparent);box-shadow:0 3px 12px #182c5010}.fwzdhW_currentAssistant:focus-visible{outline:2px solid var(--role-accent);outline-offset:3px}.fwzdhW_currentAssistant .fwzdhW_icon{border-radius:50%;width:24px;height:24px}.fwzdhW_currentAssistant .fwzdhW_icon svg{width:15px;height:15px}.fwzdhW_currentText{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:13px;font-weight:550;line-height:20px;overflow:hidden}.fwzdhW_currentHint{color:var(--role-muted);border-left:1px solid color-mix(in srgb,var(--role-muted) 20%,transparent);flex-shrink:0;padding:0 6px;font-size:10px;line-height:16px}.fwzdhW_currentArrow{width:14px;height:14px;color:var(--role-muted);flex-shrink:0}@media (width<=400px){.fwzdhW_currentHint{display:none}}.fwzdhW_roleCard{border:1px solid var(--role-border);background:var(--role-bg);border-radius:14px;flex-direction:column;min-width:0;padding:22px 22px 0;display:flex}.fwzdhW_cardTop{justify-content:space-between;align-items:center;gap:12px;display:flex}.fwzdhW_icon{width:42px;height:42px;color:var(--role-accent);background:color-mix(in srgb,var(--role-accent) 8%,var(--role-bg));border-radius:11px;flex-shrink:0;justify-content:center;align-items:center;display:inline-flex}.fwzdhW_icon svg{width:23px;height:23px}.fwzdhW_icon{color:color-mix(in srgb,var(--role-color,var(--role-accent)) 65%,var(--role-text));background:color-mix(in srgb,var(--role-color,var(--role-accent)) 20%,var(--role-bg))}.fwzdhW_roleCard,.fwzdhW_livePreview{border-color:color-mix(in srgb,var(--role-color) 40%,var(--role-border));border-top:4px solid var(--role-color);background:linear-gradient(135deg,color-mix(in srgb,var(--role-color) 18%,var(--role-bg)),color-mix(in srgb,var(--role-color) 6%,var(--role-bg)))}.fwzdhW_roleCard .fwzdhW_exampleBadge,.fwzdhW_roleCard .fwzdhW_tags span{background:color-mix(in srgb,var(--role-color) 15%,var(--role-bg));color:color-mix(in srgb,var(--role-color) 45%,var(--role-text))}.fwzdhW_roleCard .fwzdhW_cardAction{color:color-mix(in srgb,var(--role-color) 55%,var(--role-text));border-top-color:color-mix(in srgb,var(--role-color) 25%,var(--role-border))}.fwzdhW_roleCard h3{margin:18px 0 8px;font-size:16px;font-weight:650}.fwzdhW_roleCard p{color:var(--role-muted);margin:0;font-size:13px;line-height:1.8}.fwzdhW_tags{flex-wrap:wrap;gap:7px;margin:18px 0 22px;display:flex}.fwzdhW_tags span{background:color-mix(in srgb,var(--role-muted) 8%,var(--role-bg));color:var(--role-muted);border-radius:5px;padding:4px 8px;font-size:11px}.fwzdhW_cardAction{border:0;border-top:1px solid var(--role-border);width:100%;color:var(--role-accent);font:inherit;cursor:pointer;background:0 0;justify-content:space-between;align-items:center;margin-top:auto;padding:14px 0;font-size:13px;display:flex}.fwzdhW_createCard{border:1px dashed var(--role-border);width:100%;color:var(--role-muted);font:inherit;cursor:pointer;background:0 0;border-radius:14px;justify-content:flex-start;align-items:center;gap:13px;margin-top:16px;padding:16px 20px;display:flex}.fwzdhW_createCard:hover{border-color:var(--role-accent);background:color-mix(in srgb,var(--role-accent) 3%,var(--role-bg))}.fwzdhW_createCard strong{color:var(--role-text);font-size:14px;font-weight:550}.fwzdhW_createCard>span:last-child{text-align:left;font-size:12px;line-height:1.8}.fwzdhW_plus{border:1px solid var(--role-border);border-radius:50%;place-items:center;width:38px;height:38px;font-size:24px;font-weight:300;display:grid}.fwzdhW_createCard .fwzdhW_plus{flex-shrink:0;width:30px;height:30px}.fwzdhW_createCard strong{flex-shrink:0}@media (width<=680px){.fwzdhW_createCard{flex-wrap:wrap}.fwzdhW_createCard>span:last-child{width:100%}}.fwzdhW_sectionNote{color:var(--role-muted);margin:14px 0 0;font-size:12px;line-height:1.8}.fwzdhW_presetDisclosure{border:1px solid var(--role-border);background:var(--role-bg);border-radius:10px;margin-top:24px}.fwzdhW_presetDisclosure>summary{cursor:pointer;justify-content:space-between;align-items:center;gap:16px;padding:14px 16px;font-size:14px;font-weight:550;list-style:none;display:flex}.fwzdhW_presetDisclosure>summary::-webkit-details-marker{display:none}.fwzdhW_presetDisclosure>summary:hover{background:color-mix(in srgb,var(--role-muted) 5%,transparent);border-radius:10px}.fwzdhW_presetDisclosure>summary:focus-visible{outline:2px solid var(--role-accent);outline-offset:3px;border-radius:10px}.fwzdhW_disclosureChevron{width:16px;height:16px;color:var(--role-muted);flex-shrink:0}.fwzdhW_presetDisclosure[open]>summary .fwzdhW_disclosureChevron{transform:rotate(90deg)}.fwzdhW_disclosureContent{border-top:1px solid var(--role-border);padding:18px 16px}.fwzdhW_dialog{background:var(--role-bg);border:1px solid var(--role-border);border-radius:18px;width:560px;max-width:calc(100vw - 32px);max-height:calc(100dvh - 40px);padding:0;overflow:auto;box-shadow:0 24px 90px #10223d30}.fwzdhW_dialog::backdrop{backdrop-filter:blur(3px);background:#0e18224d}.fwzdhW_dialog[open]{flex-direction:column;display:flex}.fwzdhW_wide{width:1240px;height:min(850px,100dvh - 40px);overflow:hidden}.fwzdhW_editorDetails{border:1px solid var(--role-border);border-radius:8px;padding:0 12px}.fwzdhW_editorDetails>summary{cursor:pointer;color:var(--role-muted);padding:10px 0;font-size:12px}.fwzdhW_editorDetails>fieldset,.fwzdhW_editorDetails>div{padding:8px 0 14px}.fwzdhW_colorSample{border-radius:50%;width:11px;height:11px;margin-left:10px;display:inline-block}.fwzdhW_dialogHeader{border-bottom:1px solid var(--role-border);flex-shrink:0;justify-content:space-between;align-items:center;gap:20px;padding:22px 26px;display:flex}.fwzdhW_dialogHeader h2{font-size:18px}.fwzdhW_close{color:var(--role-muted);cursor:pointer;background:0 0;border:0;border-radius:6px;width:32px;height:32px;font-size:25px;line-height:1}.fwzdhW_close:hover{background:color-mix(in srgb,var(--role-muted) 10%,var(--role-bg))}.fwzdhW_editorScroll{min-height:0;padding:20px 26px 24px;overflow:auto}.fwzdhW_intro{color:var(--role-muted);margin:0 0 16px;font-size:13px;line-height:1.8}.fwzdhW_notice{background:color-mix(in srgb,var(--role-accent) 4%,var(--role-bg));border:1px solid var(--role-border);color:var(--role-muted);border-radius:8px;align-items:center;gap:10px;margin-bottom:24px;padding:11px 13px;font-size:12px;line-height:1.7;display:flex}.fwzdhW_editorGrid{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);align-items:start;gap:28px;display:grid}.fwzdhW_fields{flex-direction:column;gap:18px;display:flex}.fwzdhW_field{flex-direction:column;gap:8px;font-size:13px;font-weight:550;display:flex}.fwzdhW_field input,.fwzdhW_field textarea{box-sizing:border-box;border:1px solid var(--role-border);width:100%;color:var(--role-text);background:var(--role-bg);font:inherit;border-radius:8px;padding:10px 12px;font-weight:400;line-height:1.7}.fwzdhW_field textarea{resize:vertical;min-height:85px}.fwzdhW_field input::placeholder,.fwzdhW_field textarea::placeholder{color:var(--role-muted);opacity:.75}.fwzdhW_field input:focus,.fwzdhW_field textarea:focus{outline:2px solid color-mix(in srgb,var(--role-accent) 22%,transparent);border-color:var(--role-accent)}.fwzdhW_colorField{border:0;min-width:0;margin:0;padding:0}.fwzdhW_colorField legend{margin-bottom:10px;padding:0;font-size:13px;font-weight:550}.fwzdhW_palette{flex-wrap:wrap;gap:10px;display:flex}.fwzdhW_swatch{cursor:pointer;color:#fff;text-shadow:0 1px 2px #0007;border:2px solid #0000;border-radius:50%;place-items:center;width:28px;height:28px;padding:0;font-size:16px;display:grid}.fwzdhW_swatch[aria-pressed=true]{outline:2px solid var(--role-text);outline-offset:3px}.fwzdhW_customColor{flex-wrap:wrap;align-items:center;gap:10px;margin-top:14px;font-size:12px;display:flex}.fwzdhW_customColor label,.fwzdhW_customColor input{cursor:pointer}.fwzdhW_customColor input{box-sizing:border-box;border:1px solid var(--role-border);background:var(--role-bg);border-radius:6px;width:34px;height:30px;padding:2px}.fwzdhW_customColor input:focus-visible{outline:2px solid var(--role-accent);outline-offset:3px}.fwzdhW_customColor code{color:var(--role-muted);font-size:12px}.fwzdhW_livePreview{overflow-wrap:anywhere;border-radius:12px;padding:20px}.fwzdhW_previewHeading{justify-content:space-between;align-items:center;font-size:12px;font-weight:600;display:flex}.fwzdhW_dot{background:var(--role-color,var(--role-accent));border-radius:50%;width:6px;height:6px}.fwzdhW_caption{color:var(--role-muted);margin:6px 0 0;font-size:12px;line-height:1.7}.fwzdhW_previewIdentity{align-items:center;gap:12px;margin:24px 0;display:flex}.fwzdhW_previewIdentity h3{margin:0;font-size:16px;font-weight:650}.fwzdhW_previewSection{margin-top:20px}.fwzdhW_previewSection h4{letter-spacing:.5px;color:var(--role-muted);margin:0 0 8px;font-size:11px;font-weight:500}.fwzdhW_previewSection p{white-space:pre-wrap;margin:0;font-size:12px;line-height:1.9}.fwzdhW_empty{color:var(--role-muted);opacity:.65}.fwzdhW_sessionHint{border-top:1px solid var(--role-border);color:var(--role-muted);margin:24px 0 0;padding-top:15px;font-size:11px;line-height:1.7}.fwzdhW_footer{border-top:1px solid var(--role-border);flex-shrink:0;justify-content:space-between;align-items:center;gap:16px;padding:16px 26px;display:flex}.fwzdhW_footer p{color:var(--role-muted);margin:0;font-size:11px;line-height:1.7}.fwzdhW_actions{gap:10px;display:flex}.fwzdhW_picker{border:1px solid var(--role-border);background:var(--role-bg);cursor:pointer;border-radius:10px;align-items:center;gap:9px;padding:6px 10px 6px 6px;font-size:13px;display:inline-flex}.fwzdhW_picker .fwzdhW_icon{border-radius:6px;width:27px;height:27px}.fwzdhW_picker .fwzdhW_icon svg{width:17px;height:17px}.fwzdhW_choices{padding:22px 26px 26px;overflow:auto}.fwzdhW_choice{border:1px solid var(--role-border);text-align:left;background:var(--role-bg);width:100%;color:var(--role-text);font:inherit;cursor:pointer;border-radius:12px;align-items:center;gap:14px;margin-bottom:12px;padding:17px;display:flex}.fwzdhW_choice:hover,.fwzdhW_chosen{border-color:var(--role-accent);background:color-mix(in srgb,var(--role-accent) 4%,var(--role-bg))}.fwzdhW_choiceText{flex-direction:column;flex:1;gap:8px;min-width:0;display:flex}.fwzdhW_choiceText strong{flex-wrap:wrap;align-items:center;gap:8px;font-size:14px;font-weight:600;display:flex}.fwzdhW_choiceText>span{color:var(--role-muted);font-size:12px;line-height:1.7}.fwzdhW_radio{border:1px solid var(--role-border);border-radius:50%;flex-shrink:0;place-items:center;width:19px;height:19px;font-size:12px;display:grid}.fwzdhW_chosen .fwzdhW_radio{color:#fff;border-color:var(--role-accent);background:var(--role-accent)}.fwzdhW_choiceTools{border-bottom:1px solid var(--role-border);justify-content:space-between;gap:16px;padding:2px 0 14px;display:flex}.fwzdhW_textButton,.fwzdhW_back{color:var(--role-accent);font:inherit;cursor:pointer;background:0 0;border:0;padding:6px 0;font-size:12px}.fwzdhW_back{align-self:flex-start;margin:14px 26px 0}.fwzdhW_section button:focus-visible,.fwzdhW_dialog button:focus-visible,.fwzdhW_picker:focus-visible{outline:2px solid var(--role-accent);outline-offset:3px}@media (width<=680px){.fwzdhW_cards,.fwzdhW_editorGrid{grid-template-columns:1fr}.fwzdhW_sectionHeader{flex-direction:column;align-items:flex-start;gap:14px}.fwzdhW_createCard{padding:22px}.fwzdhW_dialogHeader,.fwzdhW_editorScroll,.fwzdhW_choices{padding:16px}.fwzdhW_footer{flex-direction:column;align-items:flex-end;gap:10px;padding:14px 16px}.fwzdhW_notice{align-items:flex-start}.fwzdhW_dialog{max-height:calc(100dvh - 24px)}.fwzdhW_livePreview{padding:16px}}";
		const tagId$3 = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/Roles.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
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
		function Modal({ title, onClose, children, wide = false, closeLabel, className = "" }) {
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
		const css$2 = ".ChWdyq_banner{border-bottom:1px solid var(--role-border);color:var(--role-muted);background:color-mix(in srgb,var(--role-accent) 4%,var(--role-bg));flex-shrink:0;align-items:center;gap:8px;padding:11px 24px;font-size:12px;line-height:1.6;display:flex}.ChWdyq_bannerDot{background:#c09542;border-radius:50%;flex-shrink:0;width:6px;height:6px}.ChWdyq_workbench{grid-template-columns:var(--library-width) var(--left-rail) minmax(380px,1fr) var(--right-rail) var(--inspector-width);flex:1;grid-template-rows:minmax(0,1fr);min-height:0;font-size:13px;line-height:1.6;transition:grid-template-columns .22s;display:grid;position:relative;overflow:hidden}.ChWdyq_resizing{user-select:none;cursor:col-resize;transition:none}.ChWdyq_workbench *{box-sizing:border-box}.ChWdyq_workbench,.ChWdyq_library,.ChWdyq_canvas,.ChWdyq_inspector{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--role-muted) 30%,transparent) transparent}.ChWdyq_workbench button,.ChWdyq_workbench input,.ChWdyq_workbench select,.ChWdyq_workbench textarea{font:inherit}.ChWdyq_workbench button{cursor:pointer}.ChWdyq_library{background:color-mix(in srgb,var(--role-muted) 4%,var(--role-bg));flex-direction:column;grid-area:1/1;min-width:0;padding:20px 12px 12px;display:flex;overflow:hidden}.ChWdyq_canvas,.ChWdyq_inspector{overscroll-behavior:contain;overflow:auto}.ChWdyq_library[hidden],.ChWdyq_inspector[hidden]{display:none}.ChWdyq_columnHeading{justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px;display:flex}.ChWdyq_columnHeading h3{margin:0;font-size:14px;font-weight:650}.ChWdyq_columnHeading p{color:var(--role-muted);margin:5px 0 0;font-size:11px}.ChWdyq_collapseButton{border:1px solid var(--role-border);background:var(--role-bg);width:26px;height:26px;color:var(--role-muted);border-radius:7px;flex-shrink:0;place-items:center;padding:0;line-height:1;display:grid;font-size:22px!important}.ChWdyq_collapseButton:hover{color:var(--role-accent);border-color:var(--role-accent)}.ChWdyq_rail{z-index:2;border-inline:1px solid var(--role-border);background:color-mix(in srgb,var(--role-muted) 3%,var(--role-bg));color:var(--role-muted);cursor:col-resize;touch-action:none;user-select:none;grid-row:1;justify-content:center;align-items:center;min-width:0;display:flex;position:relative;outline-offset:-2px!important}.ChWdyq_leftRail{grid-column:2}.ChWdyq_rightRail{grid-column:4}.ChWdyq_rail:hover,.ChWdyq_rail:focus-visible,.ChWdyq_collapseReady{background:color-mix(in srgb,var(--role-accent) 10%,var(--role-bg));color:var(--role-accent)}.ChWdyq_collapseReady{box-shadow:inset 0 0 0 1px var(--role-accent)}.ChWdyq_railHandle{pointer-events:none;flex-direction:column;justify-content:center;align-items:center;gap:9px;width:100%;min-width:0;height:58px;display:flex}.ChWdyq_railHandle svg{width:18px;height:18px;display:none}.ChWdyq_railArrow{font-size:20px;line-height:14px}.ChWdyq_railGrip{opacity:.55;border-inline:1px solid;width:3px;height:16px}.ChWdyq_railCollapsed{cursor:ew-resize}.ChWdyq_railCollapsed .ChWdyq_railHandle{border-block:1px solid var(--role-border);background:var(--role-bg);border-radius:9px;height:92px;transition:background .15s,box-shadow .15s;box-shadow:0 2px 7px #172b4d08}.ChWdyq_railCollapsed .ChWdyq_railHandle svg{display:block}.ChWdyq_railCollapsed:hover .ChWdyq_railHandle{box-shadow:0 2px 10px color-mix(in srgb,var(--role-accent) 18%,transparent)}.ChWdyq_search{border:1px solid var(--role-border);background:var(--role-bg);border-radius:8px;align-items:center;gap:8px;padding:9px 11px;display:flex}.ChWdyq_search svg{width:17px;height:17px;color:var(--role-muted);flex-shrink:0}.ChWdyq_search input{width:100%;min-width:0;color:var(--role-text);background:0 0;border:0;outline:0;font-size:12px}.ChWdyq_search:focus-within{outline:2px solid color-mix(in srgb,var(--role-accent) 25%,transparent);border-color:var(--role-accent)}.ChWdyq_filters{flex-wrap:wrap;flex-shrink:0;gap:3px;margin:12px 0;display:flex}.ChWdyq_filters button{color:var(--role-muted);background:0 0;border:1px solid #0000;border-radius:6px;padding:5px 7px;font-size:11px}.ChWdyq_filters button[aria-pressed=true]{color:var(--role-text);background:var(--role-bg);border-color:var(--role-border);box-shadow:0 1px 3px #00000006}.ChWdyq_library .ChWdyq_columnHeading,.ChWdyq_library .ChWdyq_search{flex-shrink:0}.ChWdyq_library .ChWdyq_columnHeading{margin-bottom:14px}.ChWdyq_manageLink{color:var(--role-accent);text-align:left;cursor:pointer;background:0 0;border:0;margin-top:4px;margin-bottom:6px;padding:4px 0;font-size:11px!important}.ChWdyq_catalog{overscroll-behavior:contain;scrollbar-width:thin;flex-direction:column;flex:1;gap:8px;min-height:0;padding:2px;display:flex;overflow:auto}.ChWdyq_catalogCard{border:1px solid var(--role-border);background:var(--role-bg);border-radius:9px;flex-shrink:0;align-items:center;gap:2px;width:100%;min-width:0;min-height:68px;padding:9px 5px 9px 8px;transition:box-shadow .15s,border-color .15s;display:flex}.ChWdyq_catalogCard[draggable=true]{cursor:grab;user-select:none;touch-action:pan-y}.ChWdyq_grip{touch-action:none}.ChWdyq_dragGhost{pointer-events:none;z-index:10;border:1px solid var(--role-accent);background:var(--role-bg);color:var(--role-accent);border-radius:8px;padding:10px 16px;font-size:12px;position:fixed;box-shadow:0 5px 18px #172a4433}.ChWdyq_catalogCard[draggable=true]:active{cursor:grabbing}.ChWdyq_catalogCard:hover{border-color:color-mix(in srgb,var(--role-accent) 50%,var(--role-border))}.ChWdyq_catalogSelected{border-color:color-mix(in srgb,var(--role-accent) 65%,var(--role-border));background:color-mix(in srgb,var(--role-accent) 3%,var(--role-bg))}.ChWdyq_catalogInspect{text-align:left;min-width:0;color:var(--role-text);background:0 0;border:0;flex:1;align-items:center;gap:7px;padding:0;display:flex;cursor:grab!important}.ChWdyq_catalogInspect>span:nth-child(2){flex-direction:column;flex:1;min-width:0;display:flex}.ChWdyq_catalogInspect strong,.ChWdyq_catalogInspect small{white-space:nowrap;text-overflow:ellipsis;display:block;overflow:hidden}.ChWdyq_catalogInspect strong{font-size:12px;font-weight:600}.ChWdyq_catalogInspect small{color:var(--role-muted);margin-top:2px;font-size:10px}.ChWdyq_quickAdd{width:26px;height:30px;color:var(--role-accent);background:0 0;border:0;border-radius:6px;flex-shrink:0;padding:0;font-size:17px!important}.ChWdyq_quickAdd:hover:not(:disabled){background:color-mix(in srgb,var(--role-accent) 9%,transparent)}.ChWdyq_quickAdd:disabled{cursor:default;color:#39947c;font-size:13px!important}.ChWdyq_grip{width:9px;color:var(--role-muted);opacity:.55;flex-shrink:0;font-size:16px}.ChWdyq_icon{width:32px;height:32px;color:color-mix(in srgb,var(--cap-color) 75%,var(--role-text));background:color-mix(in srgb,var(--cap-color) 11%,var(--role-bg));border-radius:8px;flex-shrink:0;place-items:center;display:inline-grid}.ChWdyq_icon svg{width:20px;height:20px}.ChWdyq_libraryNote{color:var(--role-muted);flex-shrink:0;margin:10px 0 0;padding-inline:2px;font-size:10px}.ChWdyq_emptySearch{text-align:center;color:var(--role-muted);padding:24px 0;font-size:12px}.ChWdyq_emptySearch button{color:var(--role-accent);background:0 0;border:0}.ChWdyq_canvas{grid-area:1/3;min-width:0;padding:24px 26px}.ChWdyq_step{color:var(--role-muted);opacity:.65;font-variant-numeric:tabular-nums;font-size:12px}.ChWdyq_attachedHeading{margin-top:28px}.ChWdyq_count{background:color-mix(in srgb,var(--role-accent) 8%,var(--role-bg));color:var(--role-accent);border-radius:6px;place-items:center;width:20px;height:20px;margin-left:5px;font-size:11px;display:inline-grid}.ChWdyq_dropZone{border:1px dashed var(--role-border);border-radius:12px;padding:10px;transition:background .15s,border-color .15s}.ChWdyq_dragReady{border-color:var(--role-accent)}.ChWdyq_dragOver{background:color-mix(in srgb,var(--role-accent) 9%,var(--role-bg));outline:3px solid color-mix(in srgb,var(--role-accent) 12%,transparent);border-style:solid}.ChWdyq_dropHint{text-align:center;color:var(--role-muted);flex-direction:column;align-items:center;gap:8px;padding:30px 10px;display:flex}.ChWdyq_dropHint>span{border:1px solid var(--role-border);background:var(--role-bg);border-radius:10px;place-items:center;width:36px;height:36px;font-size:23px;display:grid}.ChWdyq_dropHint strong{font-size:12px;font-weight:500}.ChWdyq_dropHint p{margin:0;font-size:11px}.ChWdyq_dropCompact{flex-direction:row;justify-content:center;padding:10px}.ChWdyq_dropCompact>span{background:0 0;border:0;width:auto;height:auto;font-size:20px}.ChWdyq_attachedCard{border:1px solid var(--role-border);background:var(--role-bg);border-radius:9px;align-items:center;margin-bottom:8px;transition:opacity .15s;display:flex}.ChWdyq_attachedSelected{border-color:var(--role-accent);box-shadow:0 0 0 1px color-mix(in srgb,var(--role-accent) 10%,transparent);background:color-mix(in srgb,var(--role-accent) 3%,var(--role-bg))}.ChWdyq_attachedSelect{text-align:left;min-width:0;color:var(--role-text);background:0 0;border:0;flex:1;align-items:center;gap:10px;padding:12px;display:flex}.ChWdyq_attachedSelect>span:last-child{flex-direction:column;min-width:0;display:flex}.ChWdyq_attachedSelect strong{font-size:12px;font-weight:550}.ChWdyq_attachedSelect small{color:var(--role-muted);flex-wrap:wrap;align-items:center;gap:5px;font-size:10px;display:flex}.ChWdyq_enabledDot,.ChWdyq_disabledDot{background:#36a18b;border-radius:50%;width:5px;height:5px;display:inline-block}.ChWdyq_disabledDot{background:var(--role-muted)}.ChWdyq_disabledCard{opacity:.65}.ChWdyq_remove{width:27px;height:27px;color:var(--role-muted);background:0 0;border:0;border-radius:6px;flex-shrink:0;margin-right:9px;font-size:20px!important}.ChWdyq_remove:hover{background:color-mix(in srgb,var(--role-muted) 10%,var(--role-bg));color:var(--role-text)}.ChWdyq_inspector{background:color-mix(in srgb,var(--role-muted) 2%,var(--role-bg));grid-area:1/5;min-width:0;padding:0 20px 24px}.ChWdyq_inspectorHeader{align-items:center;gap:10px;display:flex}.ChWdyq_inspectorHeader .ChWdyq_inspectorTabs{flex:1;gap:14px;min-width:0}.ChWdyq_inspectorHeader .ChWdyq_collapseButton{margin-top:9px}.ChWdyq_inspectorTabs{border-bottom:1px solid var(--role-border);gap:20px;padding-top:9px;display:flex}.ChWdyq_inspectorTabs button{color:var(--role-muted);background:0 0;border:0;border-bottom:2px solid #0000;padding:15px 0 12px;font-size:12px}.ChWdyq_inspectorTabs button[aria-pressed=true]{color:var(--role-accent);border-bottom-color:var(--role-accent);font-weight:600}.ChWdyq_assistantName{color:var(--role-muted);overflow-wrap:anywhere;margin:18px 0;font-size:11px}.ChWdyq_detailIdentity{align-items:center;gap:10px;display:flex}.ChWdyq_detailIdentity .ChWdyq_icon{width:40px;height:40px}.ChWdyq_detailIdentity h3{margin:0;font-size:15px;font-weight:600}.ChWdyq_detailIdentity span:not(.ChWdyq_icon){color:var(--role-muted);font-size:11px}.ChWdyq_detailDescription{color:var(--role-muted);margin:14px 0;font-size:12px;line-height:1.7}.ChWdyq_connection{background:color-mix(in srgb,#b99449 8%,var(--role-bg));color:var(--role-muted);border-radius:7px;align-items:center;gap:7px;margin-top:12px;margin-bottom:20px;padding:9px 10px;font-size:11px;display:flex}.ChWdyq_statusDot{background:#bc974c;border-radius:50%;width:5px;height:5px}.ChWdyq_switchRow{cursor:pointer;justify-content:space-between;align-items:center;gap:12px;padding:0 0 18px;display:flex;position:relative}.ChWdyq_switchRow>span:first-child{flex:1;min-width:0}.ChWdyq_switchRow strong{font-size:12px;font-weight:500}.ChWdyq_switchRow small{color:var(--role-muted);margin-top:4px;font-size:10px;line-height:1.7;display:block}.ChWdyq_switchRow input{opacity:0;width:32px;height:20px;margin:0;position:absolute;right:0}.ChWdyq_switchTrack{background:color-mix(in srgb,var(--role-muted) 32%,var(--role-bg));pointer-events:none;border-radius:20px;flex-shrink:0;width:32px;height:18px;padding:3px}.ChWdyq_switchTrack:after{content:\"\";background:#fff;border-radius:50%;width:12px;height:12px;transition:transform .15s;display:block;box-shadow:0 1px 3px #0002}.ChWdyq_switchRow input:checked+.ChWdyq_switchTrack{background:var(--role-accent)}.ChWdyq_switchRow input:checked+.ChWdyq_switchTrack:after{transform:translate(14px)}.ChWdyq_switchRow input:focus-visible+.ChWdyq_switchTrack{outline:2px solid var(--role-accent);outline-offset:3px}.ChWdyq_settingsFields{border:0;border-top:1px solid var(--role-border);min-width:0;margin:0;padding:18px 0 0}.ChWdyq_settingsFields:disabled{opacity:.48}.ChWdyq_field{flex-direction:column;gap:8px;margin-bottom:18px;font-size:12px;display:flex}.ChWdyq_field input,.ChWdyq_field select,.ChWdyq_field textarea{border:1px solid var(--role-border);background:var(--role-bg);color:var(--role-text);border-radius:7px;width:100%;min-width:0;padding:9px 10px;font-size:12px}.ChWdyq_field textarea{resize:vertical;line-height:1.7}.ChWdyq_field input::placeholder,.ChWdyq_field textarea::placeholder,.ChWdyq_search input::placeholder{color:var(--role-muted);opacity:.8}.ChWdyq_field input:focus,.ChWdyq_field select:focus,.ChWdyq_field textarea:focus{outline:2px solid color-mix(in srgb,var(--role-accent) 25%,transparent);border-color:var(--role-accent)}.ChWdyq_actionsGroup{border:0;margin:0 0 22px;padding:0}.ChWdyq_actionsGroup legend{margin-bottom:10px;font-size:12px}.ChWdyq_actionsGroup label{cursor:pointer;align-items:center;gap:8px;margin:8px 0;font-size:12px;display:flex}.ChWdyq_actionsGroup input{accent-color:var(--role-accent);width:14px;height:14px;margin:0}.ChWdyq_notAdded{padding-bottom:18px}.ChWdyq_notAdded p{color:var(--role-muted);font-size:11px}.ChWdyq_notAdded button{color:var(--dsw-alias-label-primary-foreground,#fff);background:var(--role-accent);border:0;border-radius:7px;width:100%;padding:8px 12px;font-size:12px}.ChWdyq_output{flex-direction:column;gap:9px;margin:18px 0;font-size:12px;display:flex}.ChWdyq_output strong{color:var(--role-muted);border:1px solid var(--role-border);border-radius:7px;padding:10px;font-weight:400}.ChWdyq_inspectorEmpty{color:var(--role-muted);text-align:center;padding:65px 0}.ChWdyq_inspectorEmpty>span{font-size:32px}.ChWdyq_inspectorEmpty h3{font-size:13px;font-weight:500}.ChWdyq_inspectorEmpty p{font-size:12px;line-height:1.8}.ChWdyq_overview{overflow-wrap:anywhere}.ChWdyq_overview h4{margin:20px 0 10px;font-size:12px}.ChWdyq_summaryCaps{flex-wrap:wrap;gap:7px;display:flex}.ChWdyq_summaryCaps span{border:1px solid var(--role-border);color:var(--role-muted);border-radius:6px;padding:4px 7px;font-size:10px}.ChWdyq_muted{color:var(--role-muted);font-size:12px}.ChWdyq_srOnly{clip:rect(0,0,0,0);white-space:nowrap;border:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}.ChWdyq_compact{grid-template-columns:30px minmax(0,1fr) 30px;transition:none}.ChWdyq_compact .ChWdyq_canvas{grid-column:2;padding:20px 16px}.ChWdyq_compact .ChWdyq_library,.ChWdyq_compact .ChWdyq_inspector{z-index:4;grid-column:auto;position:absolute;top:0;bottom:0;box-shadow:0 0 22px #14244124}.ChWdyq_compact .ChWdyq_library{width:var(--library-width);padding:18px 10px 10px;left:0}.ChWdyq_compact .ChWdyq_inspector{width:var(--inspector-width);padding:0 14px 20px;right:0}.ChWdyq_compact .ChWdyq_rail{z-index:5;grid-column:auto;position:absolute;top:0;bottom:0}.ChWdyq_compact .ChWdyq_leftRail{left:var(--library-width);width:var(--left-rail)}.ChWdyq_compact .ChWdyq_rightRail{right:var(--inspector-width);width:var(--right-rail)}@media (width<=1100px){.ChWdyq_canvas{padding:22px 18px}.ChWdyq_library{padding:20px 10px 10px}.ChWdyq_inspector{padding-left:16px;padding-right:16px}}@media (width<=620px){.ChWdyq_banner{padding:10px 16px;font-size:11px}}@media (prefers-reduced-motion:reduce){.ChWdyq_workbench,.ChWdyq_workbench *,.ChWdyq_switchTrack:after{transition:none}}";
		const tagId$2 = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/Capabilities.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
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
		const css$1 = ".T4-_kG_center{--role-bg:var(--dsw-alias-bg-layer-2,#fff);--role-text:var(--dsw-alias-label-primary,#202938);--role-muted:var(--dsw-alias-label-secondary,#758095);--role-border:var(--dsw-alias-border-l2,#e0e5ec);--role-accent:var(--dsw-alias-button-primary-fill,#4263ba);color:var(--role-text);box-sizing:border-box;width:100%;min-width:0;font-family:inherit;font-size:13px;line-height:1.6;container-type:inline-size}.T4-_kG_center *{box-sizing:border-box}.T4-_kG_center button,.T4-_kG_center input,.T4-_kG_center textarea,.T4-_kG_center select{font:inherit}.T4-_kG_center button{cursor:pointer}.T4-_kG_center button:focus-visible{outline:2px solid var(--role-accent);outline-offset:3px}.T4-_kG_heading{justify-content:space-between;align-items:center;gap:16px;margin:4px 0 20px;display:flex}.T4-_kG_heading h2{align-items:center;gap:10px;margin:0;font-size:22px;font-weight:650;display:flex}.T4-_kG_heading h2 span{border:1px solid var(--role-border);color:var(--role-muted);border-radius:5px;padding:2px 6px;font-size:10px;font-weight:400}.T4-_kG_heading p{color:var(--role-muted);margin:7px 0 0;font-size:12px}.T4-_kG_mark{background:color-mix(in srgb,var(--role-accent) 8%,var(--role-bg));width:46px;height:46px;color:var(--role-accent);border-radius:14px;place-items:center;font-size:32px;display:grid}.T4-_kG_notice{color:var(--role-muted);background:color-mix(in srgb,var(--role-accent) 5%,var(--role-bg));border-radius:8px;margin:0 0 20px;padding:11px 13px;font-size:11px}.T4-_kG_search{border:1px solid var(--role-border);border-radius:9px;align-items:center;gap:9px;padding:11px 13px;display:flex}.T4-_kG_search svg{width:17px;height:17px;color:var(--role-muted);flex-shrink:0}.T4-_kG_search input{color:var(--role-text);background:0 0;border:0;outline:0;width:100%;min-width:0;font-size:12px}.T4-_kG_search:focus-within{outline:2px solid color-mix(in srgb,var(--role-accent) 25%,transparent)}.T4-_kG_filters{flex-wrap:wrap;gap:6px;margin:15px 0 20px;display:flex}.T4-_kG_filters button{color:var(--role-muted);background:0 0;border:1px solid #0000;border-radius:7px;align-items:center;gap:6px;padding:6px 9px;font-size:12px;display:flex}.T4-_kG_filters button[aria-pressed=true]{background:color-mix(in srgb,var(--role-accent) 8%,var(--role-bg));color:var(--role-accent);border-color:color-mix(in srgb,var(--role-accent) 22%,var(--role-border))}.T4-_kG_filters span{opacity:.75;font-size:10px}.T4-_kG_grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;display:grid}.T4-_kG_card{border:1px solid var(--role-border);background:var(--role-bg);border-radius:12px;min-width:0;padding:18px;transition:border-color .15s,box-shadow .15s}.T4-_kG_card:hover{border-color:color-mix(in srgb,var(--role-accent) 40%,var(--role-border));box-shadow:0 4px 14px #13223a08}.T4-_kG_cardHeading,.T4-_kG_detailHeader{align-items:center;gap:10px;display:flex}.T4-_kG_cardHeading>div,.T4-_kG_detailHeader>div{flex:1;min-width:0}.T4-_kG_cardHeading h3{overflow-wrap:anywhere;margin:0;font-size:14px}.T4-_kG_cardHeading small{color:var(--role-muted);font-size:11px}.T4-_kG_pin{width:28px;height:28px;color:var(--role-muted);background:0 0;border:0;border-radius:6px;flex-shrink:0;padding:0;font-size:22px!important}.T4-_kG_pin[aria-pressed=true]{color:var(--role-accent)}.T4-_kG_pin:hover{background:color-mix(in srgb,var(--role-accent) 8%,transparent)}.T4-_kG_description{color:var(--role-muted);margin:15px 0;font-size:12px;line-height:1.7}.T4-_kG_cardStatus{color:var(--role-muted);flex-wrap:wrap;justify-content:space-between;gap:7px;margin-bottom:16px;font-size:10px;display:flex}.T4-_kG_cardStatus>span{align-items:center;gap:5px;display:flex}.T4-_kG_cardStatus button{color:var(--role-muted);background:0 0;border:0;padding:0;font-size:10px}.T4-_kG_cardStatus button:hover{color:var(--role-accent)}.T4-_kG_statusDot{background:#bd9650;border-radius:50%;flex-shrink:0;width:5px;height:5px;display:inline-block}.T4-_kG_configure{border:0;border-top:1px solid var(--role-border);width:100%;color:var(--role-accent);background:0 0;justify-content:space-between;align-items:center;padding:10px 0 0;display:flex;font-size:12px!important}.T4-_kG_back{color:var(--role-accent);background:0 0;border:0;margin:0 0 22px;padding:0;font-size:12px!important}.T4-_kG_detailHeader h3{margin:0;font-size:20px}.T4-_kG_detailHeader p{color:var(--role-muted);margin:2px 0 0;font-size:12px}.T4-_kG_tabs{border-bottom:1px solid var(--role-border);flex-wrap:wrap;gap:18px;margin-top:20px;display:flex}.T4-_kG_tabs button{color:var(--role-muted);background:0 0;border:0;border-bottom:2px solid #0000;padding:9px 0 11px;font-size:12px}.T4-_kG_tabs button[aria-pressed=true]{color:var(--role-accent);border-color:var(--role-accent);font-weight:600}.T4-_kG_detailBody{padding:22px 0 8px}.T4-_kG_connection{border:1px solid var(--role-border);border-radius:10px;flex-wrap:wrap;align-items:baseline;gap:10px;padding:18px;display:flex}.T4-_kG_connection>div{flex:1;min-width:160px}.T4-_kG_connection strong{font-size:13px}.T4-_kG_connection p{color:var(--role-muted);margin:6px 0 0;font-size:12px}.T4-_kG_connection button{border:1px solid var(--role-border);color:var(--role-muted);cursor:default;background:0 0;border-radius:7px;padding:7px 10px;font-size:11px}.T4-_kG_overviewActions{grid-template-columns:1fr 1fr;gap:12px;margin:16px 0 24px;display:grid}.T4-_kG_overviewActions button{border:1px solid var(--role-border);color:var(--role-text);background:0 0;border-radius:9px;justify-content:space-between;align-items:center;gap:8px;padding:14px;font-size:12px;display:flex}.T4-_kG_overviewActions span{color:var(--role-muted)}.T4-_kG_technical{color:var(--role-muted);border-top:1px solid var(--role-border);padding-top:15px;font-size:12px}.T4-_kG_technical summary{cursor:pointer}.T4-_kG_technical dl{grid-template-columns:100px 1fr;gap:10px;display:grid}.T4-_kG_technical dd{overflow-wrap:anywhere;color:var(--role-text);margin:0}.T4-_kG_hint{color:var(--role-muted);margin:0 0 20px;font-size:12px;line-height:1.8}.T4-_kG_draftNote{color:var(--role-muted);border-top:1px solid var(--role-border);padding:12px 0 0;font-size:11px}.T4-_kG_roleRow{border:1px solid var(--role-border);border-radius:9px;justify-content:space-between;align-items:center;gap:16px;margin-bottom:10px;padding:14px;display:flex}.T4-_kG_roleRow>div{min-width:0}.T4-_kG_roleRow strong{font-size:13px}.T4-_kG_roleRow small{color:var(--role-muted);margin-top:3px;font-size:11px;display:block}.T4-_kG_roleRow button,.T4-_kG_empty button{color:var(--role-accent);background:0 0;border:0;flex-shrink:0;padding:5px 0;font-size:11px}.T4-_kG_currentRole{background:color-mix(in srgb,var(--role-accent) 5%,var(--role-bg));margin-bottom:20px}.T4-_kG_empty{text-align:center;color:var(--role-muted);padding:40px 16px;font-size:12px}.T4-_kG_empty strong{font-size:14px;font-weight:500}dialog.T4-_kG_overlayDialog{width:760px;overflow:hidden}.T4-_kG_overlayBody{overscroll-behavior:contain;min-height:0;padding:24px 28px;overflow:auto}.T4-_kG_overlayBack{color:var(--dsw-alias-button-primary-fill,#4263ba);font:inherit;cursor:pointer;background:0 0;border:0;margin:0 0 18px;padding:0;font-size:12px}@container (width<=480px){.T4-_kG_grid{grid-template-columns:1fr}.T4-_kG_mark{display:none}.T4-_kG_roleRow{flex-direction:column;align-items:flex-start;gap:6px}.T4-_kG_tabs{gap:13px}}@media (width<=620px){.T4-_kG_overlayBody{padding:18px 16px}}@media (prefers-reduced-motion:reduce){.T4-_kG_card{transition:none}}";
		const tagId$1 = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/CapabilityCenter.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
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
		const palette = [
			"#4F73E8",
			"#22A58B",
			"#E58A32",
			"#9A62D8",
			"#E35E8D",
			"#E06453",
			"#21A0C5",
			"#788647"
		];
		const colorStyle = (color) => ({ "--role-color": color });
		function RoleIcon({ role = "analyst", color }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: Roles_module_css_default.icon,
				style: colorStyle(color ?? (role === "chat" ? palette[0] : roleCatalog[role].color)),
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.6",
					strokeLinecap: "round",
					strokeLinejoin: "round",
					children: role === "chat" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M20 11.5a8 8 0 0 1-8 8H5l-3 2V11.5a9 9 0 0 1 18 0Z" }) : role === "marketing" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4 10h4l11-5v14L8 14H4zM8 14l2 6H6l-2-6M22 10v4" }) }) : role === "manager" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "3",
						y: "5",
						width: "18",
						height: "16",
						rx: "2"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M7 3v4M17 3v4M3 10h18M7 15l2 2 4-4M16 15h2" })] }) : role === "developer" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m7 7-5 5 5 5M17 7l5 5-5 5M14 4l-4 16" }) }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "5",
						y: "5",
						width: "14",
						height: "16",
						rx: "2"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M9 5V3h6v2M9 10h6M9 14h6M9 18h3" })] })
				})
			});
		}
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
		//#region ../dsh-capabilities/src/core/model.ts
		const browserPackage = "@wxg-prc-cpg/browser-skill-dsh-plugin";
		const components = [{
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
			]
		}];
		const actionNames = {
			navigate: "打开网页",
			read: "读取网页",
			screenshot: "截取页面"
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
			return [...new Set(definition?.components.flatMap((part) => part.actions) ?? [])];
		}
		/** 永久删除必须保护所有历史岗位版本，不能只检查当前列表或活动会话。 */
		function capabilityDeletionReferences(state, capabilityId) {
			return state.roles.filter((role) => role.draft.capabilities.some((binding) => binding.capabilityId === capabilityId) || role.versions.some((version) => version.capabilities.some((binding) => binding.capabilityId === capabilityId)));
		}
		function references(state, componentId, tasks = []) {
			const capabilities = state.capabilities.filter((c) => c.draft.components.some((p) => p.componentId === componentId) || c.versions.some((v) => v.components.some((p) => p.componentId === componentId)));
			const ids = new Set(capabilities.map((c) => c.id));
			return {
				capabilities,
				roles: state.roles.filter((r) => r.draft.capabilities.some((b) => ids.has(b.capabilityId)) || latest(r.versions)?.capabilities.some((b) => ids.has(b.capabilityId))),
				tasks: tasks.filter((t) => !["stopped"].includes(t.status) && state.roles.find((r) => r.id === t.roleId)?.versions.find((v) => v.version === t.roleVersion)?.capabilities.some((b) => ids.has(b.capabilityId)))
			};
		}
		//#endregion
		//#region ../dsh-capabilities/src/core/validation.ts
		function issues(definition) {
			return definition.components.length === 0 ? ["尚未添加组件"] : definition.components.flatMap((p) => p.actions.length ? [] : ["至少选择一个业务动作"]);
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
		async function request(path, body) {
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
				pending = request("state").then((data) => emit({
					data,
					error: ""
				})).catch((error) => emit({ error: String(error.message ?? error) })).finally(() => {
					pending = void 0;
				});
				return pending;
			},
			async command(command, revision = view.data?.state.revision) {
				if (revision === void 0) throw new Error("请先等待能力数据加载");
				const result = await request("command", {
					revision,
					command
				});
				await capabilityClient.refresh();
				return result.id;
			},
			async check(connect = false) {
				await request(connect ? "connect" : "check", {});
				await capabilityClient.refresh();
			},
			async stop(sessionId) {
				await request("stop", { sessionId });
				await capabilityClient.refresh();
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
		//#region src/client/ManagedWorkbench.tsx
		function CapabilityGlyph() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: Capabilities_module_css_default.icon,
				style: { "--cap-color": "#4F73E8" },
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.6",
					children: [
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
					]
				})
			});
		}
		/** Reuses the tested resize/drag hooks and the established compact row design. */
		function ManagedWorkbench({ library, attached, selected, onSelect, onAdd, onRemove, form, inspector, title, libraryTitle, onManage }) {
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
									children: library.filter((i) => `${i.name} ${i.subtitle}`.toLowerCase().includes(query.toLowerCase())).map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
										className: `${Capabilities_module_css_default.catalogCard} ${selected === item.id ? Capabilities_module_css_default.catalogSelected : ""}`,
										onPointerDown: (e) => !item.disabled && drag.start(item.id, e),
										onClickCapture: drag.click,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: Capabilities_module_css_default.catalogInspect,
												title: item.name,
												onClick: () => configure(item.id),
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityGlyph, {}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: item.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: item.subtitle })] })]
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
									}, item.id))
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
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", { children: ["已添加的配件 ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: Capabilities_module_css_default.count,
										children: attached.length
									})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: Capabilities_module_css_default.step,
										children: "02"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									ref: drag.zone,
									"aria-label": "拖入配件",
									className: `${Capabilities_module_css_default.dropZone} ${drag.drag ? Capabilities_module_css_default.dragReady : ""} ${drag.over ? Capabilities_module_css_default.dragOver : ""}`,
									children: [attached.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										ref: (node) => {
											if (node) cards.current.set(item.id, node);
											else cards.current.delete(item.id);
										},
										className: `${Capabilities_module_css_default.attachedCard} ${selected === item.id ? Capabilities_module_css_default.attachedSelected : ""}`,
										"data-attached-capability": item.id,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: Capabilities_module_css_default.attachedSelect,
											onClick: () => configure(item.id),
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityGlyph, {}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: item.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: item.subtitle })] })]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: Capabilities_module_css_default.remove,
											"aria-label": `移除 ${item.name}`,
											onClick: () => onRemove(item.id),
											children: "×"
										})]
									}, item.id)), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: `${Capabilities_module_css_default.dropHint} ${attached.length ? Capabilities_module_css_default.dropCompact : ""}`,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "＋" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "拖入配件，或点击左侧加号" })]
									})]
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
				})
			] });
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-client-ui-plain-chat/src/client/ManagedCapabilities.module.css.mjs
		const css = ".eqpZFq_page{--role-bg:var(--dsw-alias-bg-layer-2,#fff);--role-text:var(--dsw-alias-label-primary,#202938);--role-muted:var(--dsw-alias-label-secondary,#758095);--role-border:var(--dsw-alias-border-l2,#e0e5ec);--role-accent:var(--dsw-alias-button-primary-fill,#4263ba);color:var(--role-text);min-width:0;font:inherit}.eqpZFq_heading,.eqpZFq_actions,.eqpZFq_tabs,.eqpZFq_status{flex-wrap:wrap;align-items:center;gap:10px;display:flex}.eqpZFq_heading{justify-content:space-between;margin-bottom:20px}.eqpZFq_heading h2,.eqpZFq_heading h3{margin:0 0 6px}.eqpZFq_page p{line-height:1.7}.eqpZFq_muted,.eqpZFq_time{color:var(--role-muted);font-size:12px}.eqpZFq_button{color:inherit;border:1px solid var(--role-border);background:var(--role-bg);cursor:pointer;border-radius:8px;padding:8px 12px}.eqpZFq_button:hover{border-color:var(--role-accent)}.eqpZFq_primary{background:var(--role-accent);color:#fff;border-color:var(--role-accent)}.eqpZFq_button:disabled{opacity:.5;cursor:default}.eqpZFq_search{box-sizing:border-box;border:1px solid var(--role-border);background:var(--role-bg);width:100%;color:inherit;border-radius:9px;margin:12px 0;padding:11px 13px}.eqpZFq_tabs{border-bottom:1px solid var(--role-border);gap:3px;margin:16px 0}.eqpZFq_tabs button{color:var(--role-muted);cursor:pointer;background:0 0;border:0;border-bottom:2px solid #0000;padding:10px 13px}.eqpZFq_tabs button[aria-pressed=true]{color:var(--role-accent);border-bottom-color:var(--role-accent)}.eqpZFq_grid{grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr));gap:14px;display:grid}.eqpZFq_card,.eqpZFq_row{border:1px solid var(--role-border);background:var(--role-bg);border-radius:12px;padding:16px}.eqpZFq_card{flex-direction:column;gap:9px;display:flex}.eqpZFq_card h3{margin:0;font-size:15px}.eqpZFq_card p{margin:0;font-size:12px}.eqpZFq_card .eqpZFq_actions{margin-top:auto}.eqpZFq_row{flex-wrap:wrap;justify-content:space-between;align-items:center;gap:14px;margin:10px 0;display:flex}.eqpZFq_row small{color:var(--role-muted);word-break:break-all;margin-top:5px;display:block}.eqpZFq_badge{background:color-mix(in srgb,var(--role-accent) 9%,var(--role-bg));color:var(--role-text);border-radius:6px;padding:3px 7px;font-size:11px}.eqpZFq_notice{border:1px solid var(--role-border);background:color-mix(in srgb,var(--role-accent) 4%,var(--role-bg));border-radius:9px;padding:12px 14px}.eqpZFq_error{color:#b33c42;background:color-mix(in srgb,#b33c42 6%,var(--role-bg));border-radius:8px;padding:10px}.eqpZFq_fields{flex-direction:column;gap:16px;display:flex}.eqpZFq_field{flex-direction:column;gap:8px;font-size:13px;font-weight:550;display:flex}.eqpZFq_field input,.eqpZFq_field textarea,.eqpZFq_field select{box-sizing:border-box;border:1px solid var(--role-border);background:var(--role-bg);width:100%;color:inherit;font:inherit;border-radius:8px;padding:10px;font-weight:400}.eqpZFq_check{align-items:center;gap:8px;margin:12px 0;font-size:13px;display:flex}.eqpZFq_footer{border-top:1px solid var(--role-border);flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;padding:16px 22px;display:flex}.eqpZFq_footer p{margin:0;font-size:12px}.eqpZFq_empty{text-align:center;color:var(--role-muted);padding:40px 15px}.eqpZFq_list{margin:8px 0;padding-left:20px;font-size:12px;line-height:1.9}.eqpZFq_dialogBody{max-height:70vh;padding:20px 24px;overflow:auto}.eqpZFq_tasks{border-bottom:1px solid var(--role-border);padding:10px 16px;font-size:12px}.eqpZFq_tasks button{margin-left:12px}.eqpZFq_choice{text-align:left;border:1px solid var(--role-border);background:var(--role-bg);width:100%;color:inherit;border-radius:10px;align-items:center;gap:12px;margin:8px 0;padding:14px;display:flex}.eqpZFq_choice[aria-pressed=true]{border-color:var(--role-accent)}.eqpZFq_choice span{flex:1}.eqpZFq_choice small{color:var(--role-muted);margin-top:5px;display:block}.eqpZFq_cardTop{align-items:center;gap:9px;display:flex}.eqpZFq_cardSource{color:var(--role-muted);flex:1;font-size:11px}.eqpZFq_iconButton{width:34px;height:34px;color:var(--role-muted);cursor:pointer;background:0 0;border:1px solid #0000;border-radius:8px;flex-shrink:0;justify-content:center;align-items:center;transition:color .15s,background .15s,transform .15s;display:inline-flex}.eqpZFq_iconButton:hover{color:var(--role-accent);background:color-mix(in srgb,var(--role-accent) 8%,transparent)}.eqpZFq_iconButton.eqpZFq_pinned{color:#fff;background:#344575;border-color:#7585b1;box-shadow:0 2px 5px #0f1a3c26}.eqpZFq_iconButton.eqpZFq_pinned:hover{color:#fff;background:#29385f}.eqpZFq_pinned svg{fill:color-mix(in srgb,currentColor 18%,transparent)}.eqpZFq_iconButton:active{transform:scale(.92)}.eqpZFq_pinnedCard{border-color:color-mix(in srgb,var(--role-accent) 38%,var(--role-border))}.eqpZFq_cardDescription{color:var(--role-muted);overflow-wrap:anywhere}.eqpZFq_cardMeta{color:var(--role-muted);flex-wrap:wrap;align-items:center;gap:8px;margin:3px 0;font-size:11px;display:flex}.eqpZFq_pinLabel{color:color-mix(in srgb,var(--role-accent) 40%,var(--role-text))}.eqpZFq_card h3{overflow-wrap:anywhere}.eqpZFq_cardFooter{border-top:1px solid var(--role-border);flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-top:auto;padding-top:12px;display:flex}.eqpZFq_inlineAction{justify-content:center;align-items:center;gap:5px;display:inline-flex}.eqpZFq_removeAction{color:var(--role-muted);cursor:pointer;background:0 0;border:1px solid #0000;border-radius:8px;padding:8px}.eqpZFq_removeAction:hover{color:var(--dsw-alias-label-error,#b43f4c);background:#b43f4c14}.eqpZFq_iconButton:disabled,.eqpZFq_removeAction:disabled{opacity:.5;cursor:default}.eqpZFq_page button:focus-visible{outline:2px solid var(--role-accent);outline-offset:3px}.eqpZFq_dangerButton{color:#fff;background:#ac3444;border-color:#ac3444}.eqpZFq_removalImpact{border:1px solid var(--role-border);border-radius:10px;padding:14px;font-size:13px}.eqpZFq_confirmActions{justify-content:flex-end;gap:10px;margin-top:20px;display:flex}.eqpZFq_recycleToolbar{border:1px solid var(--role-border);background:color-mix(in srgb,var(--role-accent) 5%,var(--role-bg));border-radius:10px;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin:14px 0;padding:12px;display:flex}.eqpZFq_selectionSummary{flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;display:flex}.eqpZFq_recycleSelect{cursor:pointer;flex-shrink:0;justify-content:center;align-items:center;width:32px;height:32px;display:inline-flex;position:relative}.eqpZFq_recycleSelect input{opacity:0;cursor:pointer;z-index:1;width:100%;height:100%;margin:0;position:absolute;inset:0}.eqpZFq_selectionMark{box-sizing:border-box;border:1px solid var(--role-muted);background:var(--role-bg);border-radius:5px;justify-content:center;align-items:center;width:20px;height:20px;display:flex}.eqpZFq_selectionMark svg{fill:none;stroke:currentColor;stroke-width:2px;stroke-linecap:round;stroke-linejoin:round;width:18px;height:18px}.eqpZFq_recycleSelect input:checked+.eqpZFq_selectionMark,.eqpZFq_recycleSelect input:indeterminate+.eqpZFq_selectionMark{color:#fff;background:#344575;border-color:#7585b1}.eqpZFq_recycleSelect input:focus-visible+.eqpZFq_selectionMark{outline:2px solid var(--role-accent);outline-offset:3px}.eqpZFq_recycleSelect input:disabled{cursor:default}.eqpZFq_recycleSelect input:disabled+.eqpZFq_selectionMark{opacity:.45}.eqpZFq_selectedCard{background:color-mix(in srgb,#7585b1 10%,var(--role-bg));border-color:#7585b1;box-shadow:0 0 0 1px #7585b1}.eqpZFq_deleteList{overflow-wrap:anywhere;max-height:180px;overflow:auto}@media (prefers-reduced-motion:reduce){.eqpZFq_iconButton{transition:none}.eqpZFq_iconButton:active{transform:none}}";
		const tagId = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/ManagedCapabilities.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var ManagedCapabilities_module_css_default = {
			"actions": "eqpZFq_actions",
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
			"selectedCard": "eqpZFq_selectedCard",
			"selectionMark": "eqpZFq_selectionMark",
			"selectionSummary": "eqpZFq_selectionSummary",
			"status": "eqpZFq_status",
			"tabs": "eqpZFq_tabs",
			"tasks": "eqpZFq_tasks",
			"time": "eqpZFq_time"
		};
		//#endregion
		//#region src/client/ManagedRoles.tsx
		const freeChat = {
			name: "自由聊天",
			color: "#78869f",
			description: "日常问答、写作与想法讨论，无需选择工作区。"
		};
		function ManagedRoleEditor({ id, onClose }) {
			const { data } = useCapabilities();
			(0, react.useEffect)(() => {
				const navigate = (event) => {
					if (event.detail?.section === "plugins") onClose();
				};
				window.addEventListener("workbench-capability-link", navigate);
				return () => window.removeEventListener("workbench-capability-link", navigate);
			}, [onClose]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
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
			const [draft, setDraft] = (0, react.useState)(() => structuredClone(cached?.value ?? role?.draft ?? emptyRole()));
			const [revision, setRevision] = (0, react.useState)(cached?.revision ?? state.revision), [selected, setSelected] = (0, react.useState)(draft.capabilities[0]?.capabilityId ?? null);
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
					libraryTitle: "能力配件库",
					title: "岗位信息",
					selected,
					onSelect: setSelected,
					onManage: () => setCenter(true),
					library: state.capabilities.filter((c) => !c.removedAt && c.versions.length).map((c) => ({
						id: c.id,
						name: c.draft.name,
						subtitle: `v${latest(c.versions).version} · ${c.enabled ? "已发布" : "已停用"}`
					})),
					attached: draft.capabilities.map((b) => {
						const c = state.capabilities.find((c) => c.id === b.capabilityId);
						return {
							id: b.capabilityId,
							name: c?.draft.name ?? "能力缺失",
							subtitle: `v${b.version} · ${c?.removedAt ? "能力已移除" : !b.enabled ? "岗位中停用" : !c?.enabled ? "能力已停用" : data.health.state === "ready" ? "可使用" : "待连接"}`
						};
					}),
					onAdd: (capabilityId) => {
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
					onRemove: (capabilityId) => change({
						...draft,
						capabilities: draft.capabilities.filter((b) => b.capabilityId !== capabilityId)
					}),
					form: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: `${ManagedCapabilities_module_css_default.page} ${ManagedCapabilities_module_css_default.fields}`,
						children: [
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
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: "外观与配色" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: ManagedCapabilities_module_css_default.field,
								children: ["标识颜色", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "color",
									value: draft.color,
									onChange: (e) => change({
										...draft,
										color: e.target.value
									})
								})]
							})] }),
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
										if (v) change(structuredClone(v));
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
						children: cap ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
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
									children: data.health.message
								})
							] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "先添加此能力，再设置岗位覆盖。" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: ManagedCapabilities_module_css_default.button,
								onClick: () => setCenter(true),
								children: "查看能力及关联组件 ↗"
							})
						] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
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
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "保存并发布后，新对话将采用这个岗位版本。" }), revision !== state.revision && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: ManagedCapabilities_module_css_default.button,
						onClick: () => setRevision(state.revision),
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
							disabled: busy || !draft.name.trim(),
							onClick: () => setReview(true),
							children: "保存并发布"
						})]
					})]
				}),
				center && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
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
				review && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
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
								children: "新增能力和放宽动作只由新对话采用。移除能力或缩小权限会立即限制旧会话，并停止受影响的浏览器任务。"
							}),
							error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								role: "alert",
								className: ManagedCapabilities_module_css_default.error,
								children: error
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: `${ManagedCapabilities_module_css_default.button} ${ManagedCapabilities_module_css_default.primary}`,
								disabled: busy,
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
							style: colorStyle(freeChat.color),
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
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleIcon, {
											role: "chat",
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
						}), data?.state.roles.map((role) => {
							const published = latest(role.versions), selectable = role.enabled && !!published, chosen = selectable && selected === role.id;
							const icon = roleIds.find((id) => role.id === `builtin-${id}`) ?? "analyst";
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
								"data-role-id": role.id,
								"aria-label": role.draft.name,
								className: `${Roles_module_css_default.roleCard} ${chosen ? Roles_module_css_default.selectedCard : ""}`,
								style: colorStyle(role.draft.color),
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
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleIcon, {
												role: icon,
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
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: published ? `已发布 v${published.version}` : "未发布" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [role.draft.capabilities.length, " 个能力"] }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [data.tasks.filter((t) => t.roleId === role.id && t.status !== "stopped").length, " 个活动会话"] })
											]
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
			const role = data?.state.roles.find((r) => r.id === selected);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					className: Roles_module_css_default.picker,
					"aria-haspopup": "dialog",
					onClick: () => setOpen(true),
					children: [
						selected === "chat" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleIcon, {
							role: "chat",
							color: freeChat.color
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityGlyph, {}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: role?.draft.name ?? t("mode") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "⌄" })
					]
				}),
				open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
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
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleIcon, {
									role: "chat",
									color: freeChat.color
								}) }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: freeChat.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: freeChat.description })] })]
							}),
							data?.state.roles.filter((r) => r.enabled && r.versions.length).map((r) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								className: ManagedCapabilities_module_css_default.choice,
								"aria-pressed": selected === r.id,
								onClick: () => {
									onSelect(r.id);
									setOpen(false);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityGlyph, {}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: latest(r.versions).name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
									"v",
									latest(r.versions).version,
									" · ",
									latest(r.versions).capabilities.length,
									" 个能力"
								] })] })]
							}, r.id)),
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
		function ManagedCurrentAssistant({ selected, onOpen }) {
			const { data } = useCapabilities();
			const role = data?.state.roles.find((role) => role.id === selected);
			const name = role?.draft.name ?? freeChat.name, color = role?.draft.color ?? freeChat.color;
			const icon = role ? roleIds.find((id) => role.id === `builtin-${id}`) ?? "analyst" : "chat";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				"data-current-assistant": "true",
				"data-role-icon": icon,
				className: Roles_module_css_default.currentAssistant,
				style: colorStyle(color),
				"aria-label": `打开岗位助手：${name}`,
				title: `当前选定：${name} · 点击管理岗位`,
				onClick: onOpen,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleIcon, {
						role: icon,
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
		function ManagedCapabilityCard({ capability: c, data, busy, onManage, onPin, onRemove, onRestore, onPurge, selection }) {
			const status = c.removedAt ? "已移除" : !c.enabled ? "已停用" : !c.versions.length ? "草稿" : data.health.state === "ready" ? "可使用" : "待连接";
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
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityGlyph, {}),
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
			if (!cap) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
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
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
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
									children: [tasks.length ? "相关会话的后续调用将被阻止，并请求停止其浏览器任务。" : "没有相关的活动会话。", "共享插件及其他能力保持不变。"]
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
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
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
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: [
				"navigate",
				"read",
				"screenshot"
			].map((action) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: ManagedCapabilities_module_css_default.check,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					disabled: !available.includes(action),
					checked: value.includes(action),
					onChange: (e) => onChange(e.target.checked ? [...value, action] : value.filter((a) => a !== action))
				}), actionNames[action]]
			}, action)) });
		}
		function CapabilityEditor({ id, data, onClose, onSaved }) {
			const cap = data.state.capabilities.find((c) => c.id === id), key = `capability:${id ?? "new"}`;
			const cached = editorDrafts.get(key);
			const [draft, setDraft] = (0, react.useState)(() => structuredClone(cached?.value ?? cap?.draft ?? emptyDefinition()));
			const [revision, setRevision] = (0, react.useState)(cached?.revision ?? data.state.revision);
			const [selected, setSelected] = (0, react.useState)(draft.components[0]?.componentId ?? null);
			const [busy, setBusy] = (0, react.useState)(false), [message, setMessage] = (0, react.useState)(""), [review, setReview] = (0, react.useState)(false), [applyRoles, setApplyRoles] = (0, react.useState)([]);
			const change = (next) => {
				setDraft(next);
				editorDrafts.set(key, {
					value: structuredClone(next),
					revision
				});
			};
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
					editorDrafts.delete(key);
					onSaved(result);
					onClose();
				} catch (error) {
					setMessage(String(error instanceof Error ? error.message : error));
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
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
							title: "能力信息",
							library: components.map((c) => ({
								id: c.id,
								name: c.name,
								subtitle: `BrowserSkill · ${c.version}`
							})),
							selected,
							onSelect: setSelected,
							attached: draft.components.map((c) => ({
								id: c.componentId,
								name: components.find((i) => i.id === c.componentId)?.name ?? c.componentId,
								subtitle: c.actions.map((a) => actionNames[a]).join(" · ") || "未选择动作"
							})),
							onAdd: (componentId) => {
								if (!draft.components.some((p) => p.componentId === componentId)) change({
									...draft,
									components: [...draft.components, {
										componentId,
										actions: [
											"navigate",
											"read",
											"screenshot"
										]
									}]
								});
								setSelected(componentId);
							},
							onRemove: (componentId) => change({
								...draft,
								components: draft.components.filter((p) => p.componentId !== componentId)
							}),
							form: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
							}),
							inspector: descriptor ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: descriptor.name }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: ManagedCapabilities_module_css_default.muted,
									children: "选择此能力允许使用的业务动作。组件顺序不代表执行顺序。"
								}),
								part ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionFields, {
									value: part.actions,
									onChange: (actions) => change({
										...draft,
										components: draft.components.map((p) => p.componentId === selected ? {
											...p,
											actions
										} : p)
									})
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "请先将组件添加到中间区域。" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "自动关联的支持组件" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
									className: ManagedCapabilities_module_css_default.list,
									children: descriptor.dependencies.map((dep) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: dep.replace("@deepseek-ai/dsh-", "") }, dep))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: ManagedCapabilities_module_css_default.muted,
									children: "必需依赖由组件自动推导。移除业务组件后引用才会解除。"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: ManagedCapabilities_module_css_default.notice,
									children: data.health.message
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: ManagedCapabilities_module_css_default.muted,
									children: "缺少运行环境时仍可保存；执行时会检查连接。"
								})
							] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
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
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: issues(draft).join("；") || "已选择受支持的动作。发布前可检查影响范围。" }), revision !== data.state.revision && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: ManagedCapabilities_module_css_default.button,
								onClick: () => {
									setRevision(data.state.revision);
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
									disabled: busy || !draft.name.trim() || issues(draft).length > 0,
									onClick: () => setReview(true),
									children: "检查并发布"
								})]
							})]
						}),
						review && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
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
										children: "新增动作仅由新版本采用。移除动作会立即限制引用此能力的旧会话，并停止正在使用它的浏览器任务。"
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
		function ComponentRelations({ data, capabilityId }) {
			const cap = data.state.capabilities.find((c) => c.id === capabilityId);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [cap.draft.components.map((part) => {
				const descriptor = components.find((c) => c.id === part.componentId), refs = references(data.state, descriptor.id, data.tasks);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "业务插件" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ManagedCapabilities_module_css_default.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: descriptor.name }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
								browserPackage,
								" · 固定版本 ",
								descriptor.version
							] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
								data.health.installed ? "已安装" : "未安装",
								" · ",
								data.health.loaded ? "已由岗位适配层加载" : "未加载"
							] })
						] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: ManagedCapabilities_module_css_default.button,
							onClick: () => openCapabilityLink({
								section: "plugins",
								moduleName: "@linxin666/dsh-capabilities/browser",
								capabilityId
							}),
							children: "插件管理 ↗"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: ManagedCapabilities_module_css_default.muted,
						children: [
							"共关联 ",
							refs.capabilities.length,
							" 个能力、",
							refs.roles.length,
							" 个岗位；活动会话 ",
							refs.tasks.length,
							" 个。底层插件安装一份，由各能力复用。"
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "共享支持服务" }),
					descriptor.dependencies.filter((dep) => dep.startsWith("@")).map((dep) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ManagedCapabilities_module_css_default.row,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: dep.replace("@deepseek-ai/dsh-", "") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [dep, " · 必需依赖"] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: (() => {
								const status = data.dependencies?.find((d) => d.id === dep);
								return !status ? "尚未检测" : `${status.version ?? "版本未知"} · ${status.pendingRestart ? "待重启" : status.loaded ? "已加载" : status.installed ? "已安装，未加载" : "未安装"}`;
							})() })
						] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: ManagedCapabilities_module_css_default.button,
							onClick: () => openCapabilityLink({
								section: "plugins",
								moduleName: dep,
								capabilityId
							}),
							children: "查看组件 ↗"
						})]
					}, dep)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "浏览器环境" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ManagedCapabilities_module_css_default.row,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "本机 CLI 与浏览器扩展" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [data.health.cliVersion ?? "CLI 版本待检测", " · 扩展通过浏览器单独安装"] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: data.health.message })
						] })
					})
				] }, part.componentId);
			}), !cap.draft.components.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "当前草稿没有组件。" })] });
		}
		function ManagedCenter({ initialId, embedded = false }) {
			const { data, error } = useCapabilities();
			const [selected, setSelected] = (0, react.useState)(initialId ?? lastCapabilityLink()?.capabilityId ?? null), [tab, setTab] = (0, react.useState)("overview"), [query, setQuery] = (0, react.useState)(""), [filter, setFilter] = (0, react.useState)("all");
			const [editor, setEditor] = (0, react.useState)(null), [role, setRole] = (0, react.useState)(null), [message, setMessage] = (0, react.useState)(""), [busy, setBusy] = (0, react.useState)(false);
			const [removing, setRemoving] = (0, react.useState)(null), [notice, setNotice] = (0, react.useState)("");
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
			const linked = (id) => capabilityImpact(data, id).roles;
			const removedCount = data.state.capabilities.filter((c) => c.removedAt).length;
			const visible = data.state.capabilities.filter((c) => (filter === "removed" ? Boolean(c.removedAt) : !c.removedAt) && (filter !== "pinned" || c.pinned) && (filter !== "pending" || !c.enabled || !c.versions.length || data.health.state !== "ready") && (filter !== "unused" || !linked(c.id).length) && `${c.draft.name} ${c.draft.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a, b) => Number(b.pinned) - Number(a.pinned));
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
						tab === "overview" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
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
							capabilityId: item.id
						}),
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
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ManagedCapabilities_module_css_default.muted,
								children: "当前真实适配：BrowserSkill。文档、表格、知识库等组件将在适配完成后加入。"
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
						data,
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
				roleSelection.select(id);
			};
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
					const summary = props.useSessions((s) => props.sessionId ? s.byId[props.sessionId] : void 0);
					const composerBlock = props.useComposerBlock((block) => block);
					const actualPreset = summary?.projectionValues?.agentPreset;
					const plain = actualPreset === "workbench-chat" || String(actualPreset ?? "").startsWith("workbench-role-") || created.has(props.sessionId);
					const noSession = props.sessionId === void 0;
					const translate = (key, ...args) => key === "hero.chooseWorkspace" && (plain || noSession) ? t("workspace") : props.t(key, ...args);
					const renderSlot = (key, owner, ...rest) => {
						if (key === "conversation.hero.agentPreset" && noSession) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagedRolePicker, {
							t,
							selected: selectedRole,
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
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: Chat_module_css_default.conversationShell,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: Chat_module_css_default.assistantToolbar,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagedCurrentAssistant, {
									selected: selectedRole,
									onOpen: settingsNavigation.openPresets
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrowserTaskStatus, { sessionId: props.sessionId }),
							String(actualPreset ?? "").startsWith("workbench-role-") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrowserObservation, { sessionId: props.sessionId }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: Chat_module_css_default.conversationContent,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Original, {
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