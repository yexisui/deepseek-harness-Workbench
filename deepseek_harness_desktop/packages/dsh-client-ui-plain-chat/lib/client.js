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
		const css$3 = ".yzXCLW_card{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#d5dbe7);background:var(--dsw-alias-bg-layer-2,#fff);width:100%;color:var(--dsw-alias-label-primary,#202938);border-radius:20px;padding:18px;box-shadow:0 3px 14px #182c5010}.yzXCLW_input{resize:vertical;box-sizing:border-box;width:100%;min-height:108px;max-height:300px;color:inherit;font:inherit;background:0 0;border:0;outline:none;line-height:1.6;display:block}.yzXCLW_input::placeholder{color:var(--dsw-alias-label-secondary,#78869f)}.yzXCLW_input:focus-visible{outline-offset:5px;border-radius:4px;outline:2px solid #8b9dd5}.yzXCLW_row{justify-content:space-between;align-items:center;gap:12px;margin-top:10px;display:flex}.yzXCLW_hint{opacity:.72;font-size:12px;line-height:1.6}.yzXCLW_send{background:var(--dsw-alias-button-primary-fill,#405eae);min-width:44px;min-height:44px;color:var(--dsw-alias-label-primary-foreground,#fff);cursor:pointer;border:0;border-radius:999px;flex-shrink:0;padding:10px 16px}.yzXCLW_send:hover{background:var(--dsw-alias-button-primary-hover,#334c91)}.yzXCLW_send:disabled{opacity:.45;cursor:default}.yzXCLW_error{color:#b53232;margin-top:10px;font-size:13px}.yzXCLW_badge{opacity:.8;font-size:14px}.yzXCLW_previewNotice{border-bottom:1px solid var(--dsw-alias-border-l2,#d5dbe7);color:var(--dsw-alias-label-secondary,#78869f);flex-wrap:wrap;align-items:center;gap:8px 16px;margin-bottom:14px;padding:0 0 14px;font-size:12px;line-height:1.7;display:flex}.yzXCLW_previewNotice button{color:var(--dsw-alias-button-primary-fill,#405eae);cursor:pointer;font:inherit;background:0 0;border:0;padding:3px 0}@media (width<=600px){.yzXCLW_card{padding:14px}.yzXCLW_row{align-items:flex-end}.yzXCLW_hint{font-size:11px}}.yzXCLW_conversationShell{flex-direction:column;min-width:0;height:100%;min-height:0;display:flex}.yzXCLW_assistantToolbar{flex:none;align-items:center;min-width:0;padding:20px 28px 8px;display:flex}.yzXCLW_conversationContent{flex:1;min-width:0;min-height:0}@media (width<=600px){.yzXCLW_assistantToolbar{padding:12px 16px 6px}}";
		const tagId$3 = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/Chat.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
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
		const css$2 = ".W_oMjq_group{width:100%;min-width:0}.W_oMjq_heading{box-sizing:border-box;cursor:pointer;align-items:center;gap:10px;width:100%;list-style:none;display:flex}.W_oMjq_heading::-webkit-details-marker{display:none}.W_oMjq_heading>svg{flex-shrink:0}.W_oMjq_heading:focus-visible{outline:2px solid var(--dsw-alias-button-primary-fill,#4263ba);outline-offset:-2px;border-radius:8px}.W_oMjq_chevron{opacity:.65;margin-left:auto}.W_oMjq_group[open]>.W_oMjq_heading .W_oMjq_chevron{transform:rotate(90deg)}.W_oMjq_children{border-left:1px solid var(--dsw-alias-border-l2,#dfe4ed);flex-direction:column;gap:4px;margin:4px 0 6px 17px;padding-left:10px;display:flex}.W_oMjq_children>button{box-sizing:border-box;width:100%;font-size:13px}";
		const tagId$2 = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/AppearanceNavigation.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
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
						panel.props.onSelect("agent-presets");
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
		//#region \0dsh-css:packages/dsh-client-ui-plain-chat/src/client/Capabilities.module.css.mjs
		const css$1 = ".ChWdyq_banner{border-bottom:1px solid var(--role-border);color:var(--role-muted);background:color-mix(in srgb,var(--role-accent) 4%,var(--role-bg));flex-shrink:0;align-items:center;gap:8px;padding:11px 24px;font-size:12px;line-height:1.6;display:flex}.ChWdyq_bannerDot{background:#c09542;border-radius:50%;flex-shrink:0;width:6px;height:6px}.ChWdyq_workbench{grid-template-columns:var(--library-width) var(--left-rail) minmax(380px,1fr) var(--right-rail) var(--inspector-width);flex:1;grid-template-rows:minmax(0,1fr);min-height:0;font-size:13px;line-height:1.6;transition:grid-template-columns .22s;display:grid;position:relative;overflow:hidden}.ChWdyq_resizing{user-select:none;cursor:col-resize;transition:none}.ChWdyq_workbench *{box-sizing:border-box}.ChWdyq_workbench,.ChWdyq_library,.ChWdyq_canvas,.ChWdyq_inspector{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--role-muted) 30%,transparent) transparent}.ChWdyq_workbench button,.ChWdyq_workbench input,.ChWdyq_workbench select,.ChWdyq_workbench textarea{font:inherit}.ChWdyq_workbench button{cursor:pointer}.ChWdyq_library{background:color-mix(in srgb,var(--role-muted) 4%,var(--role-bg));grid-area:1/1;min-width:0;padding:24px 18px}.ChWdyq_library,.ChWdyq_canvas,.ChWdyq_inspector{overscroll-behavior:contain;overflow:auto}.ChWdyq_library[hidden],.ChWdyq_inspector[hidden]{display:none}.ChWdyq_columnHeading{justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px;display:flex}.ChWdyq_columnHeading h3{margin:0;font-size:14px;font-weight:650}.ChWdyq_columnHeading p{color:var(--role-muted);margin:5px 0 0;font-size:11px}.ChWdyq_collapseButton{border:1px solid var(--role-border);background:var(--role-bg);width:26px;height:26px;color:var(--role-muted);border-radius:7px;flex-shrink:0;place-items:center;padding:0;line-height:1;display:grid;font-size:22px!important}.ChWdyq_collapseButton:hover{color:var(--role-accent);border-color:var(--role-accent)}.ChWdyq_rail{z-index:2;border-inline:1px solid var(--role-border);background:color-mix(in srgb,var(--role-muted) 3%,var(--role-bg));color:var(--role-muted);cursor:col-resize;touch-action:none;user-select:none;grid-row:1;justify-content:center;align-items:center;min-width:0;display:flex;position:relative;outline-offset:-2px!important}.ChWdyq_leftRail{grid-column:2}.ChWdyq_rightRail{grid-column:4}.ChWdyq_rail:hover,.ChWdyq_rail:focus-visible,.ChWdyq_collapseReady{background:color-mix(in srgb,var(--role-accent) 10%,var(--role-bg));color:var(--role-accent)}.ChWdyq_collapseReady{box-shadow:inset 0 0 0 1px var(--role-accent)}.ChWdyq_railHandle{pointer-events:none;flex-direction:column;justify-content:center;align-items:center;gap:9px;width:100%;min-width:0;height:58px;display:flex}.ChWdyq_railHandle svg{width:18px;height:18px;display:none}.ChWdyq_railArrow{font-size:20px;line-height:14px}.ChWdyq_railGrip{opacity:.55;border-inline:1px solid;width:3px;height:16px}.ChWdyq_railCollapsed{cursor:ew-resize}.ChWdyq_railCollapsed .ChWdyq_railHandle{border-block:1px solid var(--role-border);background:var(--role-bg);border-radius:9px;height:92px;transition:background .15s,box-shadow .15s;box-shadow:0 2px 7px #172b4d08}.ChWdyq_railCollapsed .ChWdyq_railHandle svg{display:block}.ChWdyq_railCollapsed:hover .ChWdyq_railHandle{box-shadow:0 2px 10px color-mix(in srgb,var(--role-accent) 18%,transparent)}.ChWdyq_search{border:1px solid var(--role-border);background:var(--role-bg);border-radius:8px;align-items:center;gap:8px;padding:9px 11px;display:flex}.ChWdyq_search svg{width:17px;height:17px;color:var(--role-muted);flex-shrink:0}.ChWdyq_search input{width:100%;min-width:0;color:var(--role-text);background:0 0;border:0;outline:0;font-size:12px}.ChWdyq_search:focus-within{outline:2px solid color-mix(in srgb,var(--role-accent) 25%,transparent);border-color:var(--role-accent)}.ChWdyq_filters{gap:5px;margin:14px 0 17px;display:flex}.ChWdyq_filters button{color:var(--role-muted);background:0 0;border:1px solid #0000;border-radius:6px;padding:5px 10px;font-size:11px}.ChWdyq_filters button[aria-pressed=true]{color:var(--role-text);background:var(--role-bg);border-color:var(--role-border);box-shadow:0 1px 3px #00000006}.ChWdyq_catalog{flex-direction:column;gap:10px;display:flex}.ChWdyq_catalogCard{border:1px solid var(--role-border);background:var(--role-bg);border-radius:10px;min-width:0;padding:12px;transition:box-shadow .15s,border-color .15s}.ChWdyq_catalogCard[draggable=true]{cursor:grab}.ChWdyq_catalogCard[draggable=true]:active{cursor:grabbing}.ChWdyq_catalogCard:hover{border-color:color-mix(in srgb,var(--role-accent) 50%,var(--role-border));box-shadow:0 3px 10px #182c5008}.ChWdyq_catalogSelected{border-color:color-mix(in srgb,var(--role-accent) 65%,var(--role-border))}.ChWdyq_catalogInspect{text-align:left;width:100%;color:var(--role-text);background:0 0;border:0;align-items:center;gap:9px;padding:0;display:flex}.ChWdyq_catalogInspect>span:nth-child(2){flex-direction:column;flex:1;min-width:0;display:flex}.ChWdyq_catalogInspect strong{font-size:12px;font-weight:600}.ChWdyq_catalogInspect small{color:var(--role-muted);font-size:10px}.ChWdyq_grip{color:var(--role-muted);opacity:.55;font-size:20px}.ChWdyq_icon{width:34px;height:34px;color:color-mix(in srgb,var(--cap-color) 75%,var(--role-text));background:color-mix(in srgb,var(--cap-color) 11%,var(--role-bg));border-radius:9px;flex-shrink:0;place-items:center;display:inline-grid}.ChWdyq_icon svg{width:21px;height:21px}.ChWdyq_catalogCard p{color:var(--role-muted);margin:10px 0;font-size:11px}.ChWdyq_catalogBottom{justify-content:space-between;align-items:center;display:flex}.ChWdyq_catalogBottom>span{color:var(--role-muted);background:color-mix(in srgb,var(--role-muted) 7%,var(--role-bg));border-radius:4px;padding:1px 5px;font-size:10px}.ChWdyq_catalogBottom button{color:var(--role-accent);background:0 0;border:0;padding:3px 0 3px 8px;font-size:11px}.ChWdyq_catalogBottom button:disabled{cursor:default;color:var(--role-muted)}.ChWdyq_libraryNote{color:var(--role-muted);margin:20px 0 0;font-size:10px;line-height:1.8}.ChWdyq_emptySearch{text-align:center;color:var(--role-muted);padding:24px 0;font-size:12px}.ChWdyq_emptySearch button{color:var(--role-accent);background:0 0;border:0}.ChWdyq_canvas{grid-area:1/3;min-width:0;padding:24px 26px}.ChWdyq_step{color:var(--role-muted);opacity:.65;font-variant-numeric:tabular-nums;font-size:12px}.ChWdyq_attachedHeading{margin-top:28px}.ChWdyq_count{background:color-mix(in srgb,var(--role-accent) 8%,var(--role-bg));color:var(--role-accent);border-radius:6px;place-items:center;width:20px;height:20px;margin-left:5px;font-size:11px;display:inline-grid}.ChWdyq_dropZone{border:1px dashed var(--role-border);border-radius:12px;padding:10px;transition:background .15s,border-color .15s}.ChWdyq_dragReady{border-color:var(--role-accent)}.ChWdyq_dragOver{background:color-mix(in srgb,var(--role-accent) 9%,var(--role-bg));outline:3px solid color-mix(in srgb,var(--role-accent) 12%,transparent);border-style:solid}.ChWdyq_dropHint{text-align:center;color:var(--role-muted);flex-direction:column;align-items:center;gap:8px;padding:30px 10px;display:flex}.ChWdyq_dropHint>span{border:1px solid var(--role-border);background:var(--role-bg);border-radius:10px;place-items:center;width:36px;height:36px;font-size:23px;display:grid}.ChWdyq_dropHint strong{font-size:12px;font-weight:500}.ChWdyq_dropHint p{margin:0;font-size:11px}.ChWdyq_dropCompact{flex-direction:row;justify-content:center;padding:10px}.ChWdyq_dropCompact>span{background:0 0;border:0;width:auto;height:auto;font-size:20px}.ChWdyq_attachedCard{border:1px solid var(--role-border);background:var(--role-bg);border-radius:9px;align-items:center;margin-bottom:8px;transition:opacity .15s;display:flex}.ChWdyq_attachedSelected{border-color:var(--role-accent);box-shadow:0 0 0 1px color-mix(in srgb,var(--role-accent) 10%,transparent);background:color-mix(in srgb,var(--role-accent) 3%,var(--role-bg))}.ChWdyq_attachedSelect{text-align:left;min-width:0;color:var(--role-text);background:0 0;border:0;flex:1;align-items:center;gap:10px;padding:12px;display:flex}.ChWdyq_attachedSelect>span:last-child{flex-direction:column;min-width:0;display:flex}.ChWdyq_attachedSelect strong{font-size:12px;font-weight:550}.ChWdyq_attachedSelect small{color:var(--role-muted);flex-wrap:wrap;align-items:center;gap:5px;font-size:10px;display:flex}.ChWdyq_enabledDot,.ChWdyq_disabledDot{background:#36a18b;border-radius:50%;width:5px;height:5px;display:inline-block}.ChWdyq_disabledDot{background:var(--role-muted)}.ChWdyq_disabledCard{opacity:.65}.ChWdyq_remove{width:27px;height:27px;color:var(--role-muted);background:0 0;border:0;border-radius:6px;flex-shrink:0;margin-right:9px;font-size:20px!important}.ChWdyq_remove:hover{background:color-mix(in srgb,var(--role-muted) 10%,var(--role-bg));color:var(--role-text)}.ChWdyq_inspector{background:color-mix(in srgb,var(--role-muted) 2%,var(--role-bg));grid-area:1/5;min-width:0;padding:0 20px 24px}.ChWdyq_inspectorHeader{align-items:center;gap:10px;display:flex}.ChWdyq_inspectorHeader .ChWdyq_inspectorTabs{flex:1;gap:14px;min-width:0}.ChWdyq_inspectorHeader .ChWdyq_collapseButton{margin-top:9px}.ChWdyq_inspectorTabs{border-bottom:1px solid var(--role-border);gap:20px;padding-top:9px;display:flex}.ChWdyq_inspectorTabs button{color:var(--role-muted);background:0 0;border:0;border-bottom:2px solid #0000;padding:15px 0 12px;font-size:12px}.ChWdyq_inspectorTabs button[aria-pressed=true]{color:var(--role-accent);border-bottom-color:var(--role-accent);font-weight:600}.ChWdyq_assistantName{color:var(--role-muted);overflow-wrap:anywhere;margin:18px 0;font-size:11px}.ChWdyq_detailIdentity{align-items:center;gap:10px;display:flex}.ChWdyq_detailIdentity .ChWdyq_icon{width:40px;height:40px}.ChWdyq_detailIdentity h3{margin:0;font-size:15px;font-weight:600}.ChWdyq_detailIdentity span:not(.ChWdyq_icon){color:var(--role-muted);font-size:11px}.ChWdyq_detailDescription{color:var(--role-muted);margin:14px 0;font-size:12px;line-height:1.7}.ChWdyq_connection{background:color-mix(in srgb,#b99449 8%,var(--role-bg));color:var(--role-muted);border-radius:7px;align-items:center;gap:7px;margin-bottom:20px;padding:9px 10px;font-size:11px;display:flex}.ChWdyq_statusDot{background:#bc974c;border-radius:50%;width:5px;height:5px}.ChWdyq_switchRow{cursor:pointer;justify-content:space-between;align-items:center;gap:12px;padding:0 0 18px;display:flex;position:relative}.ChWdyq_switchRow>span:first-child{flex:1;min-width:0}.ChWdyq_switchRow strong{font-size:12px;font-weight:500}.ChWdyq_switchRow small{color:var(--role-muted);margin-top:4px;font-size:10px;line-height:1.7;display:block}.ChWdyq_switchRow input{opacity:0;width:32px;height:20px;margin:0;position:absolute;right:0}.ChWdyq_switchTrack{background:color-mix(in srgb,var(--role-muted) 32%,var(--role-bg));pointer-events:none;border-radius:20px;flex-shrink:0;width:32px;height:18px;padding:3px}.ChWdyq_switchTrack:after{content:\"\";background:#fff;border-radius:50%;width:12px;height:12px;transition:transform .15s;display:block;box-shadow:0 1px 3px #0002}.ChWdyq_switchRow input:checked+.ChWdyq_switchTrack{background:var(--role-accent)}.ChWdyq_switchRow input:checked+.ChWdyq_switchTrack:after{transform:translate(14px)}.ChWdyq_switchRow input:focus-visible+.ChWdyq_switchTrack{outline:2px solid var(--role-accent);outline-offset:3px}.ChWdyq_settingsFields{border:0;border-top:1px solid var(--role-border);min-width:0;margin:0;padding:18px 0 0}.ChWdyq_settingsFields:disabled{opacity:.48}.ChWdyq_field{flex-direction:column;gap:8px;margin-bottom:18px;font-size:12px;display:flex}.ChWdyq_field input,.ChWdyq_field select,.ChWdyq_field textarea{border:1px solid var(--role-border);background:var(--role-bg);color:var(--role-text);border-radius:7px;width:100%;min-width:0;padding:9px 10px;font-size:12px}.ChWdyq_field textarea{resize:vertical;line-height:1.7}.ChWdyq_field input::placeholder,.ChWdyq_field textarea::placeholder,.ChWdyq_search input::placeholder{color:var(--role-muted);opacity:.8}.ChWdyq_field input:focus,.ChWdyq_field select:focus,.ChWdyq_field textarea:focus{outline:2px solid color-mix(in srgb,var(--role-accent) 25%,transparent);border-color:var(--role-accent)}.ChWdyq_actionsGroup{border:0;margin:0 0 22px;padding:0}.ChWdyq_actionsGroup legend{margin-bottom:10px;font-size:12px}.ChWdyq_actionsGroup label{cursor:pointer;align-items:center;gap:8px;margin:8px 0;font-size:12px;display:flex}.ChWdyq_actionsGroup input{accent-color:var(--role-accent);width:14px;height:14px;margin:0}.ChWdyq_notAdded{padding-bottom:18px}.ChWdyq_notAdded p{color:var(--role-muted);font-size:11px}.ChWdyq_notAdded button{color:var(--dsw-alias-label-primary-foreground,#fff);background:var(--role-accent);border:0;border-radius:7px;width:100%;padding:8px 12px;font-size:12px}.ChWdyq_output{flex-direction:column;gap:9px;margin:18px 0;font-size:12px;display:flex}.ChWdyq_output strong{color:var(--role-muted);border:1px solid var(--role-border);border-radius:7px;padding:10px;font-weight:400}.ChWdyq_inspectorEmpty{color:var(--role-muted);text-align:center;padding:65px 0}.ChWdyq_inspectorEmpty>span{font-size:32px}.ChWdyq_inspectorEmpty h3{font-size:13px;font-weight:500}.ChWdyq_inspectorEmpty p{font-size:12px;line-height:1.8}.ChWdyq_overview{overflow-wrap:anywhere}.ChWdyq_overview h4{margin:20px 0 10px;font-size:12px}.ChWdyq_summaryCaps{flex-wrap:wrap;gap:7px;display:flex}.ChWdyq_summaryCaps span{border:1px solid var(--role-border);color:var(--role-muted);border-radius:6px;padding:4px 7px;font-size:10px}.ChWdyq_muted{color:var(--role-muted);font-size:12px}.ChWdyq_srOnly{clip:rect(0,0,0,0);white-space:nowrap;border:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}.ChWdyq_compact{grid-template-columns:30px minmax(0,1fr) 30px;transition:none}.ChWdyq_compact .ChWdyq_canvas{grid-column:2;padding:20px 16px}.ChWdyq_compact .ChWdyq_library,.ChWdyq_compact .ChWdyq_inspector{z-index:4;grid-column:auto;position:absolute;top:0;bottom:0;box-shadow:0 0 22px #14244124}.ChWdyq_compact .ChWdyq_library{width:var(--library-width);padding:20px 14px;left:0}.ChWdyq_compact .ChWdyq_inspector{width:var(--inspector-width);padding:0 14px 20px;right:0}.ChWdyq_compact .ChWdyq_rail{z-index:5;grid-column:auto;position:absolute;top:0;bottom:0}.ChWdyq_compact .ChWdyq_leftRail{left:var(--library-width);width:var(--left-rail)}.ChWdyq_compact .ChWdyq_rightRail{right:var(--inspector-width);width:var(--right-rail)}@media (width<=1100px){.ChWdyq_canvas{padding:22px 18px}.ChWdyq_library{padding:22px 14px}.ChWdyq_inspector{padding-left:16px;padding-right:16px}}@media (width<=620px){.ChWdyq_banner{padding:10px 16px;font-size:11px}}@media (prefers-reduced-motion:reduce){.ChWdyq_workbench,.ChWdyq_workbench *,.ChWdyq_switchTrack:after{transition:none}}";
		const tagId$1 = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/Capabilities.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
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
			"catalogBottom": "ChWdyq_catalogBottom",
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
			"muted": "ChWdyq_muted",
			"notAdded": "ChWdyq_notAdded",
			"output": "ChWdyq_output",
			"overview": "ChWdyq_overview",
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
		//#region src/client/CapabilityWorkbench.tsx
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
		const initial = {
			create: [],
			analyst: ["documents", "knowledge"],
			marketing: ["browser", "documents"],
			manager: ["documents", "sheets"],
			developer: ["browser", "files"]
		};
		const dragType = "application/x-dsh-capability-preview";
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
		function Icon({ item }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: Capabilities_module_css_default.icon,
				style: { "--cap-color": item.color },
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.6",
					strokeLinecap: "round",
					strokeLinejoin: "round",
					children: item.id === "browser" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
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
					] }) : item.id === "documents" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M14 3H6v18h12V7zM14 3v5h4M9 12h6M9 16h6" }) }) : item.id === "sheets" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "3",
						y: "4",
						width: "18",
						height: "16",
						rx: "2"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 10h18M9 10v10M15 10v10M3 15h18" })] }) : item.id === "knowledge" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12 6c-3-3-7-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-2-1-6-2-9 1ZM12 6v15" }) }) : item.id === "files" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 7V5h7l2 3h9v12H3z" }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "3",
						y: "5",
						width: "18",
						height: "14",
						rx: "2"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m3 6 9 7 9-7" })] })
				})
			});
		}
		function CapabilityWorkbench({ t, mode, name, form, preview }) {
			const [attached, setAttached] = (0, react.useState)(() => [...initial[mode]]);
			const [selected, setSelected] = (0, react.useState)(() => initial[mode][0] ?? null);
			const [settings, setSettings] = (0, react.useState)({});
			const [query, setQuery] = (0, react.useState)("");
			const [category, setCategory] = (0, react.useState)("all");
			const [view, setView] = (0, react.useState)("settings");
			const [dragging, setDragging] = (0, react.useState)(false);
			const [over, setOver] = (0, react.useState)(false);
			const [announcement, setAnnouncement] = (0, react.useState)("");
			const panels = useCapabilityPanels(mode !== "create");
			const cards = (0, react.useRef)(/* @__PURE__ */ new Map());
			const [feedback, setFeedback] = (0, react.useState)(null);
			const prefix = (0, react.useId)();
			const item = catalog.find((entry) => entry.id === selected);
			const options = selected ? settings[selected] ?? defaults() : defaults();
			const added = selected !== null && attached.includes(selected);
			const visible = catalog.filter((entry) => (category === "all" || entry.category === category) && `${t(entry.name)} ${t(entry.description)} ${entry.provider}`.toLowerCase().includes(query.trim().toLowerCase()));
			const configure = (id) => {
				setSelected(id);
				setView("settings");
				panels.open("right");
			};
			const collapse = (side) => {
				panels.root.current?.querySelector(`[aria-controls="${prefix}-${side}"]`)?.focus();
				panels.close(side);
			};
			const update = (patch) => {
				if (selected) setSettings((previous) => ({
					...previous,
					[selected]: {
						...previous[selected] ?? defaults(),
						...patch
					}
				}));
			};
			const add = (id) => {
				const duplicate = attached.includes(id);
				setAttached((previous) => previous.includes(id) ? previous : [...previous, id]);
				setSelected(id);
				setView("settings");
				setFeedback((previous) => ({
					id,
					duplicate,
					sequence: (previous?.sequence ?? 0) + 1
				}));
				setAnnouncement(t(duplicate ? "capAlreadyAdded" : "capAddAnnouncement") + t(catalog.find((entry) => entry.id === id).name));
			};
			(0, react.useLayoutEffect)(() => {
				if (!feedback) return;
				const element = cards.current.get(feedback.id);
				if (!element) return;
				element.scrollIntoView?.({
					block: "nearest",
					inline: "nearest"
				});
				const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
				if (!element.animate) return;
				const highlight = "0 0 0 3px color-mix(in srgb, var(--role-accent) 24%, transparent)";
				const animation = element.animate(reduced || feedback.duplicate ? [{ boxShadow: highlight }, { boxShadow: "0 0 0 0 transparent" }] : [
					{
						transform: "translateY(-4px) scale(.98)",
						boxShadow: highlight
					},
					{
						transform: "translateY(2px) scale(1.015)",
						offset: .38,
						boxShadow: highlight
					},
					{
						transform: "translateY(-1px) scale(.995)",
						offset: .7
					},
					{
						transform: "translateY(0) scale(1)",
						boxShadow: "0 0 0 0 transparent"
					}
				], {
					duration: reduced ? 180 : feedback.duplicate ? 260 : 340,
					easing: "ease-out"
				});
				return () => animation.cancel();
			}, [feedback]);
			const remove = (id) => {
				setAttached((previous) => previous.filter((entry) => entry !== id));
				setAnnouncement(t("capRemoveAnnouncement") + t(catalog.find((entry) => entry.id === id).name));
			};
			const switchControl = (label, hint, checked, onChange) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: Capabilities_module_css_default.switchRow,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t(label) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t(hint) })] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "checkbox",
						role: "switch",
						checked,
						onChange: (event) => onChange(event.target.checked)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: Capabilities_module_css_default.switchTrack,
						"aria-hidden": "true"
					})
				]
			});
			const rail = (side) => {
				const isOpen = side === "left" ? panels.leftOpen : panels.rightOpen;
				const label = t(side === "left" ? isOpen ? "capHideLibrary" : "capShowLibrary" : isOpen ? "capHideSettings" : "capShowSettings");
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: `${Capabilities_module_css_default.rail} ${side === "left" ? Capabilities_module_css_default.leftRail : Capabilities_module_css_default.rightRail} ${!isOpen ? Capabilities_module_css_default.railCollapsed : ""} ${panels.resizing === side && panels.willCollapse ? Capabilities_module_css_default.collapseReady : ""}`,
					role: "separator",
					tabIndex: 0,
					"aria-label": label,
					"aria-orientation": "vertical",
					"aria-controls": `${prefix}-${side}`,
					"aria-valuemin": 0,
					"aria-valuemax": side === "left" ? 360 : 420,
					"aria-valuenow": Math.round(isOpen ? side === "left" ? panels.leftWidth : panels.rightWidth : 0),
					"aria-valuetext": isOpen ? t("capResizeHint") : t("capRestoreHint"),
					title: `${label} · ${t(isOpen ? "capResizeHint" : "capRestoreHint")}`,
					...panels.railEvents(side),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: Capabilities_module_css_default.railHandle,
						"aria-hidden": "true",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
								viewBox: "0 0 20 20",
								fill: "none",
								stroke: "currentColor",
								strokeWidth: "1.4",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
									x: "3",
									y: "4",
									width: "14",
									height: "12",
									rx: "2"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: side === "left" ? "M8 4v12" : "M12 4v12" })]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: Capabilities_module_css_default.railArrow,
								children: side === "left" === isOpen ? "‹" : "›"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: Capabilities_module_css_default.railGrip })
						]
					})
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: Capabilities_module_css_default.banner,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: Capabilities_module_css_default.bannerDot }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("capBoundary") })]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: panels.root,
					style: panels.style,
					className: `${Capabilities_module_css_default.workbench} ${panels.compact ? Capabilities_module_css_default.compact : ""} ${panels.resizing ? Capabilities_module_css_default.resizing : ""}`,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							id: `${prefix}-left`,
							className: Capabilities_module_css_default.library,
							"aria-label": t("capLibrary"),
							hidden: !panels.leftOpen,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: Capabilities_module_css_default.columnHeading,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("capLibrary") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("capLibraryHint") })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: Capabilities_module_css_default.collapseButton,
										"aria-label": t("capHideLibrary"),
										title: t("capHideLibrary"),
										onClick: () => collapse("left"),
										children: "‹"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: Capabilities_module_css_default.search,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
										"aria-hidden": "true",
										viewBox: "0 0 20 20",
										fill: "none",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
											cx: "8.5",
											cy: "8.5",
											r: "5.5",
											stroke: "currentColor",
											strokeWidth: "1.5"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
											d: "m13 13 4 4",
											stroke: "currentColor",
											strokeWidth: "1.5"
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										"aria-label": t("capSearch"),
										placeholder: t("capSearch"),
										value: query,
										onChange: (event) => setQuery(event.target.value)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: Capabilities_module_css_default.filters,
									"aria-label": t("capLibrary"),
									children: [
										["all", "capAll"],
										["web", "capWeb"],
										["office", "capOffice"],
										["data", "capData"]
									].map(([value, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										"aria-pressed": category === value,
										onClick: () => setCategory(value),
										children: t(label)
									}, value))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: Capabilities_module_css_default.catalog,
									children: visible.map((entry) => {
										const included = attached.includes(entry.id);
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
											className: `${Capabilities_module_css_default.catalogCard} ${selected === entry.id ? Capabilities_module_css_default.catalogSelected : ""}`,
											draggable: !included,
											"data-capability": entry.id,
											onDragStart: (event) => {
												event.dataTransfer.setData(dragType, entry.id);
												event.dataTransfer.effectAllowed = "copy";
												setDragging(true);
											},
											onDragEnd: () => {
												setDragging(false);
												setOver(false);
											},
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
													type: "button",
													className: Capabilities_module_css_default.catalogInspect,
													onClick: () => configure(entry.id),
													"aria-label": `${t("capInspect")}：${t(entry.name)}`,
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { item: entry }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t(entry.name) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: entry.provider })] }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: Capabilities_module_css_default.grip,
															"aria-hidden": "true",
															children: "⠿"
														})
													]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t(entry.description) }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: Capabilities_module_css_default.catalogBottom,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("capExample") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														disabled: included,
														onClick: () => add(entry.id),
														"aria-label": `${included ? t("capAdded") : t("capAdd")}：${t(entry.name)}`,
														children: included ? "✓ " + t("capAdded") : "＋ " + t("capAdd")
													})]
												})
											]
										}, entry.id);
									})
								}),
								!visible.length && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: Capabilities_module_css_default.emptySearch,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("capNoResults") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => {
											setQuery("");
											setCategory("all");
										},
										children: t("capClear")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: Capabilities_module_css_default.libraryNote,
									children: [
										catalog.length,
										" ",
										t("capCount"),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("br", {}),
										t("capDemoNote")
									]
								})
							]
						}),
						rail("left"),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: Capabilities_module_css_default.canvas,
							"aria-label": t("capCanvas"),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: Capabilities_module_css_default.columnHeading,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("capIdentity") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("capFooter") })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: Capabilities_module_css_default.step,
										children: "01"
									})]
								}),
								form,
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: `${Capabilities_module_css_default.columnHeading} ${Capabilities_module_css_default.attachedHeading}`,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", { children: [
										t("capAttached"),
										" ",
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: Capabilities_module_css_default.count,
											children: attached.length
										})
									] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("capAttachedHint") })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: Capabilities_module_css_default.step,
										children: "02"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: `${Capabilities_module_css_default.dropZone} ${dragging ? Capabilities_module_css_default.dragReady : ""} ${over ? Capabilities_module_css_default.dragOver : ""}`,
									"aria-label": t("capDrop"),
									onDragOver: (event) => {
										if (Array.from(event.dataTransfer.types).includes(dragType)) {
											event.preventDefault();
											event.dataTransfer.dropEffect = "copy";
											setOver(true);
										}
									},
									onDragLeave: (event) => {
										if (!event.currentTarget.contains(event.relatedTarget)) setOver(false);
									},
									onDrop: (event) => {
										const id = event.dataTransfer.getData(dragType);
										if (catalog.some((entry) => entry.id === id)) {
											event.preventDefault();
											add(id);
										}
										setDragging(false);
										setOver(false);
									},
									children: [attached.map((id) => {
										const entry = catalog.find((candidate) => candidate.id === id);
										const enabled = settings[id]?.enabled ?? true;
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											ref: (element) => {
												if (element) cards.current.set(id, element);
												else cards.current.delete(id);
											},
											className: `${Capabilities_module_css_default.attachedCard} ${selected === id ? Capabilities_module_css_default.attachedSelected : ""} ${!enabled ? Capabilities_module_css_default.disabledCard : ""}`,
											"data-attached-capability": id,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: Capabilities_module_css_default.attachedSelect,
												"aria-pressed": selected === id,
												onClick: () => configure(id),
												"aria-label": `${t("capSettings")}：${t(entry.name)}`,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { item: entry }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t(entry.name) }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { className: enabled ? Capabilities_module_css_default.enabledDot : Capabilities_module_css_default.disabledDot }),
													t(enabled ? "capActive" : "capPaused"),
													" · ",
													entry.provider
												] })] })]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: Capabilities_module_css_default.remove,
												"aria-label": `${t("capRemove")}：${t(entry.name)}`,
												onClick: () => remove(id),
												children: "×"
											})]
										}, id);
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: `${Capabilities_module_css_default.dropHint} ${attached.length ? Capabilities_module_css_default.dropCompact : ""}`,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												"aria-hidden": "true",
												children: "＋"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t(attached.length ? "capDropMore" : "capDrop") }),
											!attached.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("capDropHint") })
										]
									})]
								})
							]
						}),
						rail("right"),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
							id: `${prefix}-right`,
							className: Capabilities_module_css_default.inspector,
							"aria-label": t("capSettings"),
							hidden: !panels.rightOpen,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: Capabilities_module_css_default.inspectorHeader,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: Capabilities_module_css_default.inspectorTabs,
										children: ["settings", "preview"].map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											"aria-pressed": view === value,
											onClick: () => setView(value),
											children: t(value === "settings" ? "capSettings" : "capOverview")
										}, value))
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: Capabilities_module_css_default.collapseButton,
										"aria-label": t("capHideSettings"),
										title: t("capHideSettings"),
										onClick: () => collapse("right"),
										children: "›"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: Capabilities_module_css_default.assistantName,
									children: name || t("rolesUnnamed")
								}),
								view === "preview" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: Capabilities_module_css_default.overview,
									children: [
										preview,
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: t("capAbilitySummary") }),
										attached.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: Capabilities_module_css_default.summaryCaps,
											children: attached.map((id) => {
												return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
													t(catalog.find((candidate) => candidate.id === id).name),
													" · ",
													t(settings[id]?.enabled ?? true ? "capActive" : "capPaused")
												] }, id);
											})
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: Capabilities_module_css_default.muted,
											children: t("capEmpty")
										})
									]
								}) : item ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: Capabilities_module_css_default.detailIdentity,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { item }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t(item.name) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: item.provider })] })]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: Capabilities_module_css_default.detailDescription,
										children: t(item.description)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: Capabilities_module_css_default.connection,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: Capabilities_module_css_default.statusDot }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("capNotConnected") })]
									}),
									!added ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: Capabilities_module_css_default.notAdded,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("capNotAdded") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => add(item.id),
											children: [
												t("capAdd"),
												" · ",
												t(item.name)
											]
										})]
									}) : switchControl("capEnabled", "capEnableHint", options.enabled, (value) => update({ enabled: value })),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("fieldset", {
										className: Capabilities_module_css_default.settingsFields,
										disabled: !added || !options.enabled,
										children: item.id === "browser" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: Capabilities_module_css_default.field,
												children: [t("capBrowserChoice"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
													value: options.browser,
													onChange: (event) => update({ browser: event.target.value }),
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: "Edge",
														children: "Microsoft Edge"
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: "Chrome",
														children: "Google Chrome"
													})]
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: Capabilities_module_css_default.field,
												children: [t("capAccess"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
													value: options.access,
													onChange: (event) => update({ access: event.target.value }),
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: "specific",
														children: t("capSpecificSite")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: "all",
														children: t("capAnySite")
													})]
												})]
											}),
											options.access === "specific" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: Capabilities_module_css_default.field,
												children: [t("capSites"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
													rows: 3,
													maxLength: 2e3,
													value: options.sites,
													placeholder: t("capSitesPlaceholder"),
													onChange: (event) => update({ sites: event.target.value })
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
												className: Capabilities_module_css_default.actionsGroup,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", { children: t("capActions") }), [
													["read", "capRead"],
													["fill", "capFill"],
													["submit", "capSubmit"]
												].map(([key, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "checkbox",
													checked: options[key],
													onChange: (event) => update({ [key]: event.target.checked })
												}), t(label)] }, key))]
											}),
											switchControl("capConfirm", "capConfirmHint", options.confirm, (value) => update({ confirm: value }))
										] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: Capabilities_module_css_default.field,
												htmlFor: `${prefix}-location`,
												children: [t(item.id === "knowledge" ? "capSource" : "capFolder"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													id: `${prefix}-location`,
													value: options.location,
													placeholder: t(item.id === "knowledge" ? "capSourcePlaceholder" : "capFolderPlaceholder"),
													onChange: (event) => update({ location: event.target.value }),
													maxLength: 300
												})]
											}),
											[
												"documents",
												"sheets",
												"mail"
											].includes(item.id) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: Capabilities_module_css_default.output,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("capOutput") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t(item.id === "documents" ? "capDocOutput" : item.id === "sheets" ? "capSheetOutput" : "capMailOutput") })]
											}),
											switchControl("capReview", "capReviewHint", options.confirm, (value) => update({ confirm: value }))
										] })
									})
								] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: Capabilities_module_css_default.inspectorEmpty,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											"aria-hidden": "true",
											children: "＋"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("capGuide") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("capGuideHint") })
									]
								})
							]
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: Capabilities_module_css_default.srOnly,
					role: "status",
					"aria-live": "polite",
					children: announcement
				})
			] });
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-client-ui-plain-chat/src/client/Roles.module.css.mjs
		const css = ".fwzdhW_section,.fwzdhW_dialog,.fwzdhW_picker,.fwzdhW_presetDisclosure{--role-bg:var(--dsw-alias-bg-layer-2,#fff);--role-text:var(--dsw-alias-label-primary,#202938);--role-muted:var(--dsw-alias-label-secondary,#758095);--role-border:var(--dsw-alias-border-l2,#e0e5ec);--role-accent:var(--dsw-alias-button-primary-fill,#4263ba);color:var(--role-text);font:inherit}.fwzdhW_section{box-sizing:border-box;width:100%;padding:4px 0 0}.fwzdhW_sectionHeader{justify-content:space-between;align-items:center;gap:20px;margin-bottom:22px;display:flex}.fwzdhW_titleRow{align-items:center;gap:12px;display:flex}.fwzdhW_section h2,.fwzdhW_dialog h2{letter-spacing:-.4px;margin:0;font-size:20px;font-weight:650}.fwzdhW_sectionHeader p{color:var(--role-muted);margin:8px 0 0;font-size:13px;line-height:1.7}.fwzdhW_previewBadge,.fwzdhW_exampleBadge{border:1px solid var(--role-border);color:var(--role-muted);white-space:nowrap;border-radius:6px;flex-shrink:0;align-items:center;padding:3px 8px;font-size:11px;font-weight:500;line-height:1.4;display:inline-flex}.fwzdhW_exampleBadge{background:color-mix(in srgb,var(--role-accent) 8%,var(--role-bg));color:var(--role-accent);border-color:#0000}.fwzdhW_primary,.fwzdhW_secondary{border:1px solid var(--role-border);font:inherit;cursor:pointer;white-space:nowrap;border-radius:9px;padding:10px 16px;font-size:13px;font-weight:550}.fwzdhW_primary{background:var(--role-accent);color:var(--dsw-alias-label-primary-foreground,#fff);border-color:#0000}.fwzdhW_secondary{background:var(--role-bg);color:var(--role-text)}.fwzdhW_primary:hover:not(:disabled){filter:brightness(1.08)}.fwzdhW_primary:disabled{opacity:.42;cursor:not-allowed}.fwzdhW_cards{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;display:grid}.fwzdhW_selectionStatus{min-height:30px;color:var(--role-muted);justify-content:space-between;align-items:center;gap:12px;margin:-4px 0 18px;font-size:12px;line-height:1.7;display:flex}.fwzdhW_roleCard{transition:box-shadow .18s,border-color .18s;position:relative}.fwzdhW_cardSelect{z-index:1;cursor:pointer;background:0 0;border:0;border-radius:12px 12px 0 0;padding:0;position:absolute;inset:0 0 51px}.fwzdhW_cardSelect:hover{background:color-mix(in srgb,var(--role-color) 5%,transparent)}.fwzdhW_roleCard .fwzdhW_cardAction{z-index:2;position:relative}.fwzdhW_selectedCard{box-shadow:0 0 0 2px var(--role-color),0 7px 20px color-mix(in srgb,var(--role-color) 20%,transparent);animation:.3s ease-out fwzdhW_roleSelect}.fwzdhW_roleCard .fwzdhW_exampleBadge.fwzdhW_selectedBadge{background:var(--role-color);color:#fff}@keyframes fwzdhW_roleSelect{0%,to{transform:translate(0)}30%{transform:translate(-3px)}60%{transform:translate(3px)}}@media (prefers-reduced-motion:reduce){.fwzdhW_selectedCard{animation:none}}.fwzdhW_currentAssistant{--role-bg:var(--dsw-alias-bg-layer-2,#fff);--role-text:var(--dsw-alias-label-primary,#202938);--role-muted:var(--dsw-alias-label-secondary,#758095);--role-accent:var(--dsw-alias-button-primary-fill,#4263ba);box-sizing:border-box;border:1px solid color-mix(in srgb,var(--role-color) 22%,transparent);background:color-mix(in srgb,var(--role-bg) 88%,transparent);backdrop-filter:blur(12px);max-width:100%;min-height:38px;color:var(--role-text);text-align:left;font:inherit;cursor:pointer;border-radius:22px;align-items:center;gap:8px;padding:6px 12px 6px 7px;transition:background .16s,border-color .16s,box-shadow .16s;display:inline-flex;box-shadow:0 2px 8px #182c5008}.fwzdhW_currentAssistant:hover{background:color-mix(in srgb,var(--role-color) 8%,var(--role-bg));border-color:color-mix(in srgb,var(--role-color) 45%,transparent);box-shadow:0 3px 12px #182c5010}.fwzdhW_currentAssistant:focus-visible{outline:2px solid var(--role-accent);outline-offset:3px}.fwzdhW_currentAssistant .fwzdhW_icon{border-radius:50%;width:24px;height:24px}.fwzdhW_currentAssistant .fwzdhW_icon svg{width:15px;height:15px}.fwzdhW_currentText{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:13px;font-weight:550;line-height:20px;overflow:hidden}.fwzdhW_currentHint{color:var(--role-muted);border-left:1px solid color-mix(in srgb,var(--role-muted) 20%,transparent);flex-shrink:0;padding:0 6px;font-size:10px;line-height:16px}.fwzdhW_currentArrow{width:14px;height:14px;color:var(--role-muted);flex-shrink:0}@media (width<=400px){.fwzdhW_currentHint{display:none}}.fwzdhW_roleCard{border:1px solid var(--role-border);background:var(--role-bg);border-radius:14px;flex-direction:column;min-width:0;padding:22px 22px 0;display:flex}.fwzdhW_cardTop{justify-content:space-between;align-items:center;gap:12px;display:flex}.fwzdhW_icon{width:42px;height:42px;color:var(--role-accent);background:color-mix(in srgb,var(--role-accent) 8%,var(--role-bg));border-radius:11px;flex-shrink:0;justify-content:center;align-items:center;display:inline-flex}.fwzdhW_icon svg{width:23px;height:23px}.fwzdhW_icon{color:color-mix(in srgb,var(--role-color,var(--role-accent)) 65%,var(--role-text));background:color-mix(in srgb,var(--role-color,var(--role-accent)) 20%,var(--role-bg))}.fwzdhW_roleCard,.fwzdhW_livePreview{border-color:color-mix(in srgb,var(--role-color) 40%,var(--role-border));border-top:4px solid var(--role-color);background:linear-gradient(135deg,color-mix(in srgb,var(--role-color) 18%,var(--role-bg)),color-mix(in srgb,var(--role-color) 6%,var(--role-bg)))}.fwzdhW_roleCard .fwzdhW_exampleBadge,.fwzdhW_roleCard .fwzdhW_tags span{background:color-mix(in srgb,var(--role-color) 15%,var(--role-bg));color:color-mix(in srgb,var(--role-color) 45%,var(--role-text))}.fwzdhW_roleCard .fwzdhW_cardAction{color:color-mix(in srgb,var(--role-color) 55%,var(--role-text));border-top-color:color-mix(in srgb,var(--role-color) 25%,var(--role-border))}.fwzdhW_roleCard h3{margin:18px 0 8px;font-size:16px;font-weight:650}.fwzdhW_roleCard p{color:var(--role-muted);margin:0;font-size:13px;line-height:1.8}.fwzdhW_tags{flex-wrap:wrap;gap:7px;margin:18px 0 22px;display:flex}.fwzdhW_tags span{background:color-mix(in srgb,var(--role-muted) 8%,var(--role-bg));color:var(--role-muted);border-radius:5px;padding:4px 8px;font-size:11px}.fwzdhW_cardAction{border:0;border-top:1px solid var(--role-border);width:100%;color:var(--role-accent);font:inherit;cursor:pointer;background:0 0;justify-content:space-between;align-items:center;margin-top:auto;padding:14px 0;font-size:13px;display:flex}.fwzdhW_createCard{border:1px dashed var(--role-border);width:100%;color:var(--role-muted);font:inherit;cursor:pointer;background:0 0;border-radius:14px;justify-content:flex-start;align-items:center;gap:13px;margin-top:16px;padding:16px 20px;display:flex}.fwzdhW_createCard:hover{border-color:var(--role-accent);background:color-mix(in srgb,var(--role-accent) 3%,var(--role-bg))}.fwzdhW_createCard strong{color:var(--role-text);font-size:14px;font-weight:550}.fwzdhW_createCard>span:last-child{text-align:left;font-size:12px;line-height:1.8}.fwzdhW_plus{border:1px solid var(--role-border);border-radius:50%;place-items:center;width:38px;height:38px;font-size:24px;font-weight:300;display:grid}.fwzdhW_createCard .fwzdhW_plus{flex-shrink:0;width:30px;height:30px}.fwzdhW_createCard strong{flex-shrink:0}@media (width<=680px){.fwzdhW_createCard{flex-wrap:wrap}.fwzdhW_createCard>span:last-child{width:100%}}.fwzdhW_sectionNote{color:var(--role-muted);margin:14px 0 0;font-size:12px;line-height:1.8}.fwzdhW_presetDisclosure{border:1px solid var(--role-border);background:var(--role-bg);border-radius:10px;margin-top:24px}.fwzdhW_presetDisclosure>summary{cursor:pointer;justify-content:space-between;align-items:center;gap:16px;padding:14px 16px;font-size:14px;font-weight:550;list-style:none;display:flex}.fwzdhW_presetDisclosure>summary::-webkit-details-marker{display:none}.fwzdhW_presetDisclosure>summary:hover{background:color-mix(in srgb,var(--role-muted) 5%,transparent);border-radius:10px}.fwzdhW_presetDisclosure>summary:focus-visible{outline:2px solid var(--role-accent);outline-offset:3px;border-radius:10px}.fwzdhW_disclosureChevron{width:16px;height:16px;color:var(--role-muted);flex-shrink:0}.fwzdhW_presetDisclosure[open]>summary .fwzdhW_disclosureChevron{transform:rotate(90deg)}.fwzdhW_disclosureContent{border-top:1px solid var(--role-border);padding:18px 16px}.fwzdhW_dialog{background:var(--role-bg);border:1px solid var(--role-border);border-radius:18px;width:560px;max-width:calc(100vw - 32px);max-height:calc(100dvh - 40px);padding:0;overflow:auto;box-shadow:0 24px 90px #10223d30}.fwzdhW_dialog::backdrop{backdrop-filter:blur(3px);background:#0e18224d}.fwzdhW_dialog[open]{flex-direction:column;display:flex}.fwzdhW_wide{width:1240px;height:min(850px,100dvh - 40px);overflow:hidden}.fwzdhW_editorDetails{border:1px solid var(--role-border);border-radius:8px;padding:0 12px}.fwzdhW_editorDetails>summary{cursor:pointer;color:var(--role-muted);padding:10px 0;font-size:12px}.fwzdhW_editorDetails>fieldset,.fwzdhW_editorDetails>div{padding:8px 0 14px}.fwzdhW_colorSample{border-radius:50%;width:11px;height:11px;margin-left:10px;display:inline-block}.fwzdhW_dialogHeader{border-bottom:1px solid var(--role-border);flex-shrink:0;justify-content:space-between;align-items:center;gap:20px;padding:22px 26px;display:flex}.fwzdhW_dialogHeader h2{font-size:18px}.fwzdhW_close{color:var(--role-muted);cursor:pointer;background:0 0;border:0;border-radius:6px;width:32px;height:32px;font-size:25px;line-height:1}.fwzdhW_close:hover{background:color-mix(in srgb,var(--role-muted) 10%,var(--role-bg))}.fwzdhW_editorScroll{min-height:0;padding:20px 26px 24px;overflow:auto}.fwzdhW_intro{color:var(--role-muted);margin:0 0 16px;font-size:13px;line-height:1.8}.fwzdhW_notice{background:color-mix(in srgb,var(--role-accent) 4%,var(--role-bg));border:1px solid var(--role-border);color:var(--role-muted);border-radius:8px;align-items:center;gap:10px;margin-bottom:24px;padding:11px 13px;font-size:12px;line-height:1.7;display:flex}.fwzdhW_editorGrid{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);align-items:start;gap:28px;display:grid}.fwzdhW_fields{flex-direction:column;gap:18px;display:flex}.fwzdhW_field{flex-direction:column;gap:8px;font-size:13px;font-weight:550;display:flex}.fwzdhW_field input,.fwzdhW_field textarea{box-sizing:border-box;border:1px solid var(--role-border);width:100%;color:var(--role-text);background:var(--role-bg);font:inherit;border-radius:8px;padding:10px 12px;font-weight:400;line-height:1.7}.fwzdhW_field textarea{resize:vertical;min-height:85px}.fwzdhW_field input::placeholder,.fwzdhW_field textarea::placeholder{color:var(--role-muted);opacity:.75}.fwzdhW_field input:focus,.fwzdhW_field textarea:focus{outline:2px solid color-mix(in srgb,var(--role-accent) 22%,transparent);border-color:var(--role-accent)}.fwzdhW_colorField{border:0;min-width:0;margin:0;padding:0}.fwzdhW_colorField legend{margin-bottom:10px;padding:0;font-size:13px;font-weight:550}.fwzdhW_palette{flex-wrap:wrap;gap:10px;display:flex}.fwzdhW_swatch{cursor:pointer;color:#fff;text-shadow:0 1px 2px #0007;border:2px solid #0000;border-radius:50%;place-items:center;width:28px;height:28px;padding:0;font-size:16px;display:grid}.fwzdhW_swatch[aria-pressed=true]{outline:2px solid var(--role-text);outline-offset:3px}.fwzdhW_customColor{flex-wrap:wrap;align-items:center;gap:10px;margin-top:14px;font-size:12px;display:flex}.fwzdhW_customColor label,.fwzdhW_customColor input{cursor:pointer}.fwzdhW_customColor input{box-sizing:border-box;border:1px solid var(--role-border);background:var(--role-bg);border-radius:6px;width:34px;height:30px;padding:2px}.fwzdhW_customColor input:focus-visible{outline:2px solid var(--role-accent);outline-offset:3px}.fwzdhW_customColor code{color:var(--role-muted);font-size:12px}.fwzdhW_livePreview{overflow-wrap:anywhere;border-radius:12px;padding:20px}.fwzdhW_previewHeading{justify-content:space-between;align-items:center;font-size:12px;font-weight:600;display:flex}.fwzdhW_dot{background:var(--role-color,var(--role-accent));border-radius:50%;width:6px;height:6px}.fwzdhW_caption{color:var(--role-muted);margin:6px 0 0;font-size:12px;line-height:1.7}.fwzdhW_previewIdentity{align-items:center;gap:12px;margin:24px 0;display:flex}.fwzdhW_previewIdentity h3{margin:0;font-size:16px;font-weight:650}.fwzdhW_previewSection{margin-top:20px}.fwzdhW_previewSection h4{letter-spacing:.5px;color:var(--role-muted);margin:0 0 8px;font-size:11px;font-weight:500}.fwzdhW_previewSection p{white-space:pre-wrap;margin:0;font-size:12px;line-height:1.9}.fwzdhW_empty{color:var(--role-muted);opacity:.65}.fwzdhW_sessionHint{border-top:1px solid var(--role-border);color:var(--role-muted);margin:24px 0 0;padding-top:15px;font-size:11px;line-height:1.7}.fwzdhW_footer{border-top:1px solid var(--role-border);flex-shrink:0;justify-content:space-between;align-items:center;gap:16px;padding:16px 26px;display:flex}.fwzdhW_footer p{color:var(--role-muted);margin:0;font-size:11px;line-height:1.7}.fwzdhW_actions{gap:10px;display:flex}.fwzdhW_picker{border:1px solid var(--role-border);background:var(--role-bg);cursor:pointer;border-radius:10px;align-items:center;gap:9px;padding:6px 10px 6px 6px;font-size:13px;display:inline-flex}.fwzdhW_picker .fwzdhW_icon{border-radius:6px;width:27px;height:27px}.fwzdhW_picker .fwzdhW_icon svg{width:17px;height:17px}.fwzdhW_choices{padding:22px 26px 26px;overflow:auto}.fwzdhW_choice{border:1px solid var(--role-border);text-align:left;background:var(--role-bg);width:100%;color:var(--role-text);font:inherit;cursor:pointer;border-radius:12px;align-items:center;gap:14px;margin-bottom:12px;padding:17px;display:flex}.fwzdhW_choice:hover,.fwzdhW_chosen{border-color:var(--role-accent);background:color-mix(in srgb,var(--role-accent) 4%,var(--role-bg))}.fwzdhW_choiceText{flex-direction:column;flex:1;gap:8px;min-width:0;display:flex}.fwzdhW_choiceText strong{flex-wrap:wrap;align-items:center;gap:8px;font-size:14px;font-weight:600;display:flex}.fwzdhW_choiceText>span{color:var(--role-muted);font-size:12px;line-height:1.7}.fwzdhW_radio{border:1px solid var(--role-border);border-radius:50%;flex-shrink:0;place-items:center;width:19px;height:19px;font-size:12px;display:grid}.fwzdhW_chosen .fwzdhW_radio{color:#fff;border-color:var(--role-accent);background:var(--role-accent)}.fwzdhW_choiceTools{border-bottom:1px solid var(--role-border);justify-content:space-between;gap:16px;padding:2px 0 14px;display:flex}.fwzdhW_textButton,.fwzdhW_back{color:var(--role-accent);font:inherit;cursor:pointer;background:0 0;border:0;padding:6px 0;font-size:12px}.fwzdhW_back{align-self:flex-start;margin:14px 26px 0}.fwzdhW_section button:focus-visible,.fwzdhW_dialog button:focus-visible,.fwzdhW_picker:focus-visible{outline:2px solid var(--role-accent);outline-offset:3px}@media (width<=680px){.fwzdhW_cards,.fwzdhW_editorGrid{grid-template-columns:1fr}.fwzdhW_sectionHeader{flex-direction:column;align-items:flex-start;gap:14px}.fwzdhW_createCard{padding:22px}.fwzdhW_dialogHeader,.fwzdhW_editorScroll,.fwzdhW_choices{padding:16px}.fwzdhW_footer{flex-direction:column;align-items:flex-end;gap:10px;padding:14px 16px}.fwzdhW_notice{align-items:flex-start}.fwzdhW_dialog{max-height:calc(100dvh - 24px)}.fwzdhW_livePreview{padding:16px}}";
		const tagId = "@linxin666/dsh-client-ui-plain-chat/packages/dsh-client-ui-plain-chat/src/client/Roles.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-plain-chat";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var Roles_module_css_default = {
			"actions": "fwzdhW_actions",
			"back": "fwzdhW_back",
			"caption": "fwzdhW_caption",
			"cardAction": "fwzdhW_cardAction",
			"cardSelect": "fwzdhW_cardSelect",
			"cardTop": "fwzdhW_cardTop",
			"cards": "fwzdhW_cards",
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
		function Modal({ title, onClose, children, wide = false, closeLabel }) {
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
				className: `${Roles_module_css_default.dialog} ${wide ? Roles_module_css_default.wide : ""}`,
				"aria-labelledby": titleId,
				onCancel: (event) => {
					event.preventDefault();
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
		function RoleEditor({ t, mode, onClose }) {
			const [color, setColor] = (0, react.useState)(mode === "create" ? palette[0] : roleCatalog[mode].color);
			const [fields, setFields] = (0, react.useState)(() => {
				if (mode === "create") return {
					name: "",
					duties: "",
					requirements: "",
					format: ""
				};
				const example = roleCatalog[mode];
				return {
					name: t(example.name),
					duties: t(example.duties),
					requirements: t(example.requirements),
					format: t(example.format)
				};
			});
			const id = (0, react.useId)();
			const definitions = [
				[
					"duties",
					"rolesDuties",
					"rolesDutiesPlaceholder"
				],
				[
					"requirements",
					"rolesRequirements",
					"rolesRequirementsPlaceholder"
				],
				[
					"format",
					"rolesFormat",
					"rolesFormatPlaceholder"
				]
			];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CapabilityWorkbench, {
				t,
				mode,
				name: fields.name,
				form: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: Roles_module_css_default.fields,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: Roles_module_css_default.field,
							htmlFor: `${id}-name`,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("rolesName") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								id: `${id}-name`,
								maxLength: 60,
								value: fields.name,
								placeholder: t("rolesNamePlaceholder"),
								onChange: (event) => setFields({
									...fields,
									name: event.target.value
								})
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
							className: Roles_module_css_default.editorDetails,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [t("capColorDetails"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: Roles_module_css_default.colorSample,
								style: { backgroundColor: color }
							})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
								className: Roles_module_css_default.colorField,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", { children: t("rolesColor") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: Roles_module_css_default.palette,
										children: palette.map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: Roles_module_css_default.swatch,
											style: { backgroundColor: value },
											"aria-label": `${t("rolesColor")} ${value}`,
											"aria-pressed": color.toLowerCase() === value.toLowerCase(),
											onClick: () => setColor(value),
											children: color.toLowerCase() === value.toLowerCase() && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												"aria-hidden": "true",
												children: "✓"
											})
										}, value))
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: Roles_module_css_default.customColor,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
												htmlFor: `${id}-color`,
												children: t("rolesCustomColor")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												id: `${id}-color`,
												type: "color",
												value: color,
												onInput: (event) => setColor(event.currentTarget.value),
												onChange: (event) => setColor(event.target.value)
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: color.toUpperCase() })
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: Roles_module_css_default.caption,
										children: t("rolesColorHint")
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: Roles_module_css_default.field,
							htmlFor: `${id}-duties`,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("rolesDuties") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								id: `${id}-duties`,
								rows: 4,
								maxLength: 4e3,
								value: fields.duties,
								placeholder: t("rolesDutiesPlaceholder"),
								onChange: (event) => setFields({
									...fields,
									duties: event.target.value
								})
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
							className: Roles_module_css_default.editorDetails,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("capAdvanced") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: Roles_module_css_default.fields,
								children: definitions.filter(([key]) => key !== "duties").map(([key, label, placeholder]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: Roles_module_css_default.field,
									htmlFor: `${id}-${key}`,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(label) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										id: `${id}-${key}`,
										rows: key === "format" ? 4 : 3,
										maxLength: 4e3,
										value: fields[key],
										placeholder: t(placeholder),
										onChange: (event) => setFields({
											...fields,
											[key]: event.target.value
										})
									})]
								}, key))
							})]
						})
					]
				}),
				preview: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: Roles_module_css_default.livePreview,
					style: colorStyle(color),
					"aria-label": t("rolesLivePreview"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: Roles_module_css_default.previewHeading,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("rolesLivePreview") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: Roles_module_css_default.dot })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: Roles_module_css_default.caption,
							children: t("rolesLiveHint")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: Roles_module_css_default.previewIdentity,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleIcon, {
								role: mode === "create" ? "analyst" : mode,
								color
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: fields.name.trim() || t("rolesUnnamed") })]
						}),
						definitions.map(([key, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: Roles_module_css_default.previewSection,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: t(label) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: !fields[key].trim() ? Roles_module_css_default.empty : void 0,
								children: fields[key].trim() || t("rolesEmpty")
							})]
						}, key))
					]
				})
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: Roles_module_css_default.footer,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					id: `${id}-save-hint`,
					children: t("rolesSaveHint")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: Roles_module_css_default.actions,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: Roles_module_css_default.secondary,
						onClick: onClose,
						children: t("rolesDone")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: Roles_module_css_default.primary,
						disabled: true,
						"aria-describedby": `${id}-save-hint`,
						children: t("rolesSave")
					})]
				})]
			})] });
		}
		function RoleAssistantsSection({ t, selected = "chat", onSelect }) {
			const [editor, setEditor] = (0, react.useState)(null);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: Roles_module_css_default.section,
				"data-dsh-plugin": "plain-chat",
				"data-dsh-part": "role-assistants",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: Roles_module_css_default.sectionHeader,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: Roles_module_css_default.titleRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("rolesTitle") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: Roles_module_css_default.previewBadge,
								children: t("rolesPreview")
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("rolesDescription") })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: Roles_module_css_default.primary,
							onClick: () => setEditor("create"),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									"aria-hidden": "true",
									children: "＋"
								}),
								" ",
								t("rolesCreate")
							]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: Roles_module_css_default.selectionStatus,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							role: "status",
							children: selected === "chat" ? t("rolesNoSelection") : `${t("rolesSelectionDone")}${t(roleCatalog[selected].name)} · ${t("rolesPreview")}`
						}), selected !== "chat" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: Roles_module_css_default.textButton,
							onClick: () => onSelect?.("chat"),
							children: t("rolesReset")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: Roles_module_css_default.cards,
						children: roleIds.map((role) => {
							const example = roleCatalog[role];
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
								className: `${Roles_module_css_default.roleCard} ${selected === role ? Roles_module_css_default.selectedCard : ""}`,
								style: colorStyle(example.color),
								"aria-label": t(example.name),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: Roles_module_css_default.cardSelect,
										"aria-label": `${t("rolesPick")}：${t(example.name)}`,
										"aria-pressed": selected === role,
										onClick: () => onSelect?.(role)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: Roles_module_css_default.cardTop,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleIcon, { role }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: `${Roles_module_css_default.exampleBadge} ${selected === role ? Roles_module_css_default.selectedBadge : ""}`,
											children: selected === role ? `✓ ${t("rolesChosen")}` : t("rolesExample")
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t(example.name) }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t(example.summary) }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: Roles_module_css_default.tags,
										children: example.tags.map((key) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(key) }, key))
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: Roles_module_css_default.cardAction,
										onClick: () => setEditor(role),
										children: [t("rolesConfigure"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											"aria-hidden": "true",
											children: "↗"
										})]
									})
								]
							}, role);
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: Roles_module_css_default.createCard,
						onClick: () => setEditor("create"),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: Roles_module_css_default.plus,
								"aria-hidden": "true",
								children: "＋"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("rolesCreate") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("rolesEditHint") })
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: Roles_module_css_default.sectionNote,
						children: t("rolesNotice")
					}),
					editor && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
						title: t(editor === "create" ? "rolesCreate" : "rolesEdit"),
						onClose: () => setEditor(null),
						closeLabel: t("rolesClose"),
						wide: true,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleEditor, {
							t,
							mode: editor,
							onClose: () => setEditor(null)
						})
					})
				]
			});
		}
		function CurrentAssistant({ t, selected, onOpen }) {
			const name = t(selected === "chat" ? "mode" : roleCatalog[selected].name);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: Roles_module_css_default.currentAssistant,
				style: colorStyle(selected === "chat" ? "#78869f" : roleCatalog[selected].color),
				"aria-label": `${t("rolesManage")}：${name}`,
				title: `${t(selected === "chat" ? "rolesNoSelection" : "rolesSelectionHint")} · ${t("rolesManage")}`,
				onClick: onOpen,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleIcon, { role: selected }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: Roles_module_css_default.currentText,
						children: name
					}),
					selected !== "chat" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: Roles_module_css_default.currentHint,
						children: t("rolesPreview")
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
		function RolePicker({ t, selected, onSelect }) {
			const [open, setOpen] = (0, react.useState)(false);
			const [editor, setEditor] = (0, react.useState)(null);
			const close = () => {
				setOpen(false);
				setEditor(null);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: Roles_module_css_default.picker,
				"aria-haspopup": "dialog",
				"aria-label": `${t("rolesChoose")}：${t(selected === "chat" ? "mode" : roleCatalog[selected].name)}`,
				onClick: () => setOpen(true),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleIcon, { role: selected }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(selected === "chat" ? "mode" : roleCatalog[selected].name) }),
					selected !== "chat" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: Roles_module_css_default.previewBadge,
						children: t("rolesPreview")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						"aria-hidden": "true",
						children: "⌄"
					})
				]
			}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Modal, {
				title: t(editor ? "rolesEdit" : "rolesChoose"),
				closeLabel: t("rolesClose"),
				onClose: close,
				wide: editor !== null,
				children: editor ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: Roles_module_css_default.back,
					onClick: () => setEditor(null),
					children: ["← ", t("rolesBack")]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleEditor, {
					t,
					mode: editor,
					onClose: close
				}, editor)] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: Roles_module_css_default.choices,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: Roles_module_css_default.intro,
							children: t("rolesChooseHint")
						}),
						["chat", ...roleIds].map((role) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: `${Roles_module_css_default.choice} ${selected === role ? Roles_module_css_default.chosen : ""}`,
							"aria-pressed": selected === role,
							onClick: () => {
								onSelect(role);
								close();
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleIcon, { role }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: Roles_module_css_default.choiceText,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: [t(role === "chat" ? "mode" : roleCatalog[role].name), role !== "chat" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: Roles_module_css_default.previewBadge,
										children: t("rolesPreview")
									})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(role === "chat" ? "rolesChatSummary" : roleCatalog[role].summary) })]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: Roles_module_css_default.radio,
									"aria-hidden": "true",
									children: selected === role ? "✓" : ""
								})
							]
						}, role)),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: Roles_module_css_default.choiceTools,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: Roles_module_css_default.textButton,
								onClick: () => setEditor(selected === "chat" ? "analyst" : selected),
								children: t("rolesConfigure")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: Roles_module_css_default.textButton,
								onClick: () => setEditor("create"),
								children: ["＋ ", t("rolesCreate")]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: Roles_module_css_default.sectionNote,
							children: t("rolesNotice")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: Roles_module_css_default.caption,
							children: t("rolesSwitchHint")
						})
					]
				})
			})] });
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
			const listeners = /* @__PURE__ */ new Set();
			return {
				getSnapshot: () => revision,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				openPresets: () => {
					revision++;
					listeners.forEach((listener) => listener());
				}
			};
		}
		//#endregion
		//#region src/client/roles-copy.ts
		const roleZh = {
			rolesTitle: "岗位助手",
			rolesDescription: "为每一类工作，准备一位熟悉职责的助手。",
			rolesPick: "选定助手",
			rolesChosen: "已选定",
			rolesCurrent: "当前助手",
			rolesManage: "打开 Agent 预设",
			rolesNoSelection: "未选择岗位 · 自由交流",
			rolesSelectionHint: "已选岗位 · 仅界面预览",
			rolesReset: "取消选定",
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
			rolesExisting: "Agent 预设",
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
			rolesChatOnly: "当前仅预览岗位界面。切回普通聊天后即可发送消息。",
			rolesReturnChat: "切回普通聊天",
			rolesComposer: "输入工作需求（岗位对话尚未接通）"
		};
		const roleEn = {
			rolesTitle: "Role assistants",
			rolesDescription: "An assistant that understands each kind of work.",
			rolesPick: "Select assistant",
			rolesChosen: "Selected",
			rolesCurrent: "Current assistant",
			rolesManage: "Open Agent presets",
			rolesNoSelection: "No role selected · Everyday chat",
			rolesSelectionHint: "Selected role · UI preview only",
			rolesReset: "Clear selection",
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
			rolesExisting: "Agent presets",
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
			appearanceTitle: "外观",
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
			...roleEn,
			...capabilityEn,
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
			const roleSelection = createRoleSelection();
			const settingsNavigation = createSettingsNavigation();
			ctx.effect(() => decorateSlot(registry, "sidebar.settings", "SettingsRoot", (Original) => withAppearanceNavigation(Original, () => t("appearanceTitle"), settingsNavigation)), "plain-chat: appearance navigation group");
			ctx.effect(() => decorateSlot(registry, "settings.section", "AgentPresetSection", (Original) => function RolePresetSection(props) {
				const selected = (0, react.useSyncExternalStore)(roleSelection.subscribe, roleSelection.getSnapshot);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RoleAssistantsSection, {
					t,
					selected,
					onSelect: roleSelection.select
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AgentPresetDisclosure, {
					t,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Original, { ...props })
				})] });
			}), "plain-chat: role assistant settings preview");
			ctx.effect(() => decorateSlot(registry, "main.conversation", "ConversationRoot", (Original) => {
				return function ChatConversation(props) {
					const draftKey = (0, react.useSyncExternalStore)(subscribe, snapshot);
					const selectedRole = (0, react.useSyncExternalStore)(roleSelection.subscribe, roleSelection.getSnapshot);
					const selectRole = roleSelection.select;
					const summary = props.useSessions((s) => props.sessionId ? s.byId[props.sessionId] : void 0);
					const composerBlock = props.useComposerBlock((block) => block);
					const plain = summary?.projectionValues?.agentPreset === "workbench-chat" || created.has(props.sessionId);
					const noSession = props.sessionId === void 0;
					const translate = (key, ...args) => key === "hero.chooseWorkspace" && (plain || noSession) ? t("workspace") : props.t(key, ...args);
					const renderSlot = (key, owner, ...rest) => {
						if (key === "conversation.hero.agentPreset" && noSession) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RolePicker, {
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
								available: chatRoot !== "",
								previewOnly: selectedRole !== "chat",
								onReturnChat: () => selectRole("chat")
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
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: Chat_module_css_default.assistantToolbar,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CurrentAssistant, {
								t,
								selected: selectedRole,
								onOpen: settingsNavigation.openPresets
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: Chat_module_css_default.conversationContent,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Original, {
								...props,
								t: translate,
								renderSlot,
								selectWorkspace
							})
						})]
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