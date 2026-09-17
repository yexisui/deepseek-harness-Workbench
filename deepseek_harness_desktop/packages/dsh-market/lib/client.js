window.__ModuleLoader__.load({
	id: "@linxin666/dsh-client-ui-market",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:packages/dsh-market/src/client/settings-card.module.css.mjs
		const css$1 = ".RcIGlq_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}.RcIGlq_card:hover{border-color:var(--dsw-alias-label-dimmed)}.RcIGlq_cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}.RcIGlq_header{appearance:none;box-sizing:border-box;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.RcIGlq_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.RcIGlq_headerStatic{box-sizing:border-box;border-radius:12px;align-items:center;gap:12px;width:100%;padding:14px 16px;display:flex}.RcIGlq_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.RcIGlq_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.RcIGlq_description{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.5}.RcIGlq_pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.RcIGlq_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.RcIGlq_chevronOpen{transform:rotate(180deg)}.RcIGlq_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.RcIGlq_readOnly{color:var(--dsw-alias-label-secondary);margin:12px 0 0;font-size:12px;line-height:1.5}.RcIGlq_notExposed{color:var(--dsw-alias-state-warn-primary);margin:12px 0 0;font-size:12px;line-height:1.5}.RcIGlq_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.RcIGlq_failed{min-width:0;color:var(--dsw-alias-state-error-primary,#b42318);text-overflow:ellipsis;white-space:nowrap;flex:1;margin:0;font-size:12px;line-height:1.5;overflow:hidden}.RcIGlq_discard,.RcIGlq_save{appearance:none;font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.RcIGlq_discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.RcIGlq_discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.RcIGlq_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.RcIGlq_discard:disabled,.RcIGlq_save:disabled{opacity:.4;cursor:default}.RcIGlq_discard:focus-visible,.RcIGlq_save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.RcIGlq_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.RcIGlq_field+.RcIGlq_field{border-top:1px solid var(--dsw-alias-border-l2)}.RcIGlq_head{align-items:center;gap:8px;display:flex}.RcIGlq_label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}.RcIGlq_badges{align-items:center;gap:8px;display:inline-flex}.RcIGlq_badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.RcIGlq_reset{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;padding:0;font-size:12px;line-height:1.5}.RcIGlq_reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.RcIGlq_reset:disabled{cursor:default}.RcIGlq_reset:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.RcIGlq_input,.RcIGlq_select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.RcIGlq_input:focus-visible,.RcIGlq_select:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.RcIGlq_input:disabled,.RcIGlq_select:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.RcIGlq_inputInvalid{border:1px solid var(--dsw-alias-state-error-primary,#b42318);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.RcIGlq_inputInvalid:focus-visible{outline:2px solid var(--dsw-alias-state-error-primary,#b42318);outline-offset:1px;border-color:var(--dsw-alias-state-error-primary,#b42318)}.RcIGlq_selectWrap{position:relative}.RcIGlq_selectButton{appearance:none;text-align:left;cursor:pointer;justify-content:space-between;align-items:center;gap:8px;width:100%;display:flex}.RcIGlq_selectLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.RcIGlq_selectChevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.RcIGlq_selectChevronOpen{transform:rotate(180deg)}.RcIGlq_selectPopup{z-index:40;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);max-height:240px;box-shadow:0 8px 24px var(--dsw-alias-bg-mask-2);opacity:0;border-radius:8px;flex-direction:column;padding:4px;transition:opacity .1s,transform .1s;display:flex;position:absolute;top:calc(100% + 4px);left:0;right:0;overflow-y:auto;transform:translateY(-4px)}.RcIGlq_selectPopupOpen{opacity:1;transform:none}.RcIGlq_selectPopupClose{opacity:0;pointer-events:none;transform:translateY(-4px)}.RcIGlq_selectOption{color:var(--dsw-alias-label-primary);cursor:pointer;white-space:nowrap;text-overflow:ellipsis;border-radius:6px;flex-shrink:0;padding:6px 10px;font-size:13px;line-height:1.5;overflow:hidden}.RcIGlq_selectOption:hover,.RcIGlq_selectOptionActive{background:var(--dsw-alias-interactive-bg-hover)}.RcIGlq_selectOptionSelected{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary-new-colorprimary-new-color) 10%, transparent);font-weight:500}.RcIGlq_invalid{color:var(--dsw-alias-state-error-primary,#b42318);margin:0;font-size:12px;line-height:1.5}.RcIGlq_hint{color:var(--dsw-alias-label-secondary);margin:0;font-size:12px;line-height:1.5}@media (prefers-reduced-motion:reduce){.RcIGlq_card,.RcIGlq_header,.RcIGlq_chevron,.RcIGlq_chevronOpen,.RcIGlq_discard,.RcIGlq_save,.RcIGlq_selectChevron,.RcIGlq_selectChevronOpen,.RcIGlq_selectPopup{transition:none}}";
		const tagId$1 = "@linxin666/dsh-client-ui-market/packages/dsh-market/src/client/settings-card.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-market";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var settings_card_module_css_default = {
			"badge": "RcIGlq_badge",
			"badges": "RcIGlq_badges",
			"body": "RcIGlq_body",
			"card": "RcIGlq_card",
			"cardOpen": "RcIGlq_cardOpen",
			"chevron": "RcIGlq_chevron",
			"chevronOpen": "RcIGlq_chevronOpen",
			"description": "RcIGlq_description",
			"discard": "RcIGlq_discard",
			"failed": "RcIGlq_failed",
			"field": "RcIGlq_field",
			"footer": "RcIGlq_footer",
			"head": "RcIGlq_head",
			"headText": "RcIGlq_headText",
			"header": "RcIGlq_header",
			"headerStatic": "RcIGlq_headerStatic",
			"hint": "RcIGlq_hint",
			"input": "RcIGlq_input",
			"inputInvalid": "RcIGlq_inputInvalid",
			"invalid": "RcIGlq_invalid",
			"label": "RcIGlq_label",
			"name": "RcIGlq_name",
			"notExposed": "RcIGlq_notExposed",
			"pending": "RcIGlq_pending",
			"readOnly": "RcIGlq_readOnly",
			"reset": "RcIGlq_reset",
			"save": "RcIGlq_save",
			"select": "RcIGlq_select",
			"selectButton": "RcIGlq_selectButton",
			"selectChevron": "RcIGlq_selectChevron",
			"selectChevronOpen": "RcIGlq_selectChevronOpen",
			"selectLabel": "RcIGlq_selectLabel",
			"selectOption": "RcIGlq_selectOption",
			"selectOptionActive": "RcIGlq_selectOptionActive",
			"selectOptionSelected": "RcIGlq_selectOptionSelected",
			"selectPopup": "RcIGlq_selectPopup",
			"selectPopupClose": "RcIGlq_selectPopupClose",
			"selectPopupOpen": "RcIGlq_selectPopupOpen",
			"selectWrap": "RcIGlq_selectWrap"
		};
		//#endregion
		//#region src/client/PluginSettingsCard.tsx
		/**
		* Family-shared chrome for plugin settings cards: a disclosure header naming
		* the plugin and what its settings govern, the controls inside, and the save
		* that writes them. Renders nothing while the namespace is unavailable — a
		* deployment that does not compose the owning plugin should show no trace of
		* it. Inlined into each consumer's client bundle; mirrors the official
		* ui-plugin-config PluginCard in a self-contained slice.
		*/
		/**
		* Render one plugin settings card.
		* @param props - the plugin's copy keys, its form state, and its controls.
		* @returns the card, or nothing while the namespace is still loading.
		*/
		function PluginSettingsCard(props) {
			const [open, setOpen] = (0, react.useState)(props.defaultOpen ?? true);
			const { state, alwaysOpen } = props;
			if (!state.available) return null;
			const title = props.t(props.titleKey);
			const description = props.t(props.descriptionKey);
			const blocked = !state.dirty || state.invalid || state.saving;
			const expanded = alwaysOpen === true || open;
			const cardClass = expanded ? `${settings_card_module_css_default.cardOpen} ${settings_card_module_css_default.card}` : settings_card_module_css_default.card;
			const header = alwaysOpen === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.headerStatic,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: settings_card_module_css_default.headText,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.name,
						title,
						children: title
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.description,
						title: description,
						children: props.descriptionNode ?? description
					})]
				}), state.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: settings_card_module_css_default.pending,
					title: props.t("settings.unsaved"),
					children: props.t("settings.unsaved")
				}) : null]
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: settings_card_module_css_default.header,
				"aria-expanded": open,
				"aria-label": `${props.t(open ? "settings.collapse" : "settings.expand")}: ${title}`,
				onClick: () => {
					setOpen(!open);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: settings_card_module_css_default.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.name,
							title,
							children: title
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: settings_card_module_css_default.description,
							title: description,
							children: props.descriptionNode ?? description
						})]
					}),
					state.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.pending,
						title: props.t("settings.unsaved"),
						children: props.t("settings.unsaved")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						width: "14",
						height: "14",
						viewBox: "0 0 14 14",
						fill: "none",
						xmlns: "http://www.w3.org/2000/svg",
						className: open ? `${settings_card_module_css_default.chevron} ${settings_card_module_css_default.chevronOpen}` : settings_card_module_css_default.chevron,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
							fill: "currentColor"
						})
					})
				]
			});
			if (!state.exposed) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: cardClass,
				children: [header, expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: settings_card_module_css_default.body,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.notExposed,
						role: "status",
						children: props.t("settings.notExposed")
					})
				}) : null]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: cardClass,
				children: [header, expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: settings_card_module_css_default.body,
					children: [
						!state.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: settings_card_module_css_default.readOnly,
							role: "status",
							children: props.t("settings.readOnly")
						}) : null,
						props.children,
						props.hideFooter === true ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: settings_card_module_css_default.footer,
							children: [
								state.failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: settings_card_module_css_default.failed,
									role: "status",
									children: [props.t("settings.saveFailed"), state.failedReason ? " - " + state.failedReason : ""]
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.discard,
									disabled: !state.dirty || state.saving,
									onClick: props.onDiscard,
									children: props.t("settings.discard")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: settings_card_module_css_default.save,
									disabled: blocked,
									onClick: props.onSave,
									children: props.t(!state.saving ? "settings.save" : "settings.saving")
								})
							]
						})
					]
				}) : null]
			});
		}
		const NON_SKIN_BODY_MARKERS = /* @__PURE__ */ new Set(["dshSkinCenter", "dshSidebarCollapsed"]);
		function isSkinActive() {
			return Object.keys(document.body.dataset).some((key) => key.startsWith("dsh") && !NON_SKIN_BODY_MARKERS.has(key));
		}
		const SELECT_CLOSE_MS = 100;
		/**
		* The shared dual-mode select control. While an appearance skin is active it
		* renders the legacy native `<select>` untouched, so element-level skin
		* selectors keep working; under the default appearance it renders a
		* self-drawn `role="listbox"` popup whose open/close is transition-animated.
		* Staged cards reach it through BooleanField/ChoiceField; immediate-apply
		* editors (the side-card prefs) bind it directly through onEdit.
		* 双模式下拉框：皮肤激活时用原生 select，默认外观用自绘动画弹层。
		*/
		function SelectField(props) {
			const { id, options, value } = props;
			const [open, setOpen] = (0, react.useState)(false);
			const [closing, setClosing] = (0, react.useState)(false);
			const [phase, setPhase] = (0, react.useState)("initial");
			const [activeIndex, setActiveIndex] = (0, react.useState)(0);
			const closeTimer = (0, react.useRef)(void 0);
			const wrapRef = (0, react.useRef)(null);
			const popupRef = (0, react.useRef)(null);
			const currentIndex = () => {
				const index = options.findIndex((option) => option.value === value);
				return index >= 0 ? index : 0;
			};
			const close = (0, react.useCallback)(() => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
				setClosing(true);
				closeTimer.current = setTimeout(() => {
					setClosing(false);
					setOpen(false);
				}, SELECT_CLOSE_MS);
			}, []);
			const openPopup = () => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
				setActiveIndex(currentIndex());
				setPhase("initial");
				setClosing(false);
				setOpen(true);
			};
			const commit = (index) => {
				const option = options[index];
				if (option) props.onEdit(option.value);
				close();
			};
			const onTriggerClick = () => {
				if (props.disabled) return;
				if (open && !closing) close();
				else openPopup();
			};
			const onKeyDown = (event) => {
				if (props.disabled) return;
				const count = options.length;
				switch (event.key) {
					case "ArrowDown":
					case "ArrowUp":
					case "Enter":
					case " ":
						event.preventDefault();
						if (!open) openPopup();
						else if (!closing) if (event.key === "ArrowDown") setActiveIndex((index) => (index + 1) % count);
						else if (event.key === "ArrowUp") setActiveIndex((index) => (index - 1 + count) % count);
						else commit(activeIndex);
						break;
					case "Escape":
						if (open) {
							event.preventDefault();
							event.stopPropagation();
							close();
						}
						break;
					case "Tab":
						if (open) close();
						break;
				}
			};
			(0, react.useEffect)(() => () => {
				if (closeTimer.current !== void 0) clearTimeout(closeTimer.current);
			}, []);
			(0, react.useLayoutEffect)(() => {
				if (open && !closing && phase === "initial") {
					popupRef.current?.offsetHeight;
					setPhase("open");
				}
			}, [
				open,
				closing,
				phase
			]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onPointerDown = (event) => {
					const target = event.target;
					if (target instanceof Node && !wrapRef.current?.contains(target)) close();
				};
				document.addEventListener("pointerdown", onPointerDown);
				return () => document.removeEventListener("pointerdown", onPointerDown);
			}, [open, close]);
			(0, react.useEffect)(() => {
				if (props.disabled && open) close();
			}, [
				props.disabled,
				open,
				close
			]);
			if (isSkinActive()) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
				id,
				className: settings_card_module_css_default.select,
				value,
				disabled: props.disabled,
				onChange: (event) => {
					props.onEdit(event.target.value);
				},
				children: options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
					value: option.value,
					children: option.label
				}, option.value))
			});
			const label = options.find((option) => option.value === value)?.label ?? "";
			const popupClass = closing ? `${settings_card_module_css_default.selectPopup} ${settings_card_module_css_default.selectPopupClose}` : phase === "open" ? `${settings_card_module_css_default.selectPopup} ${settings_card_module_css_default.selectPopupOpen}` : settings_card_module_css_default.selectPopup;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.selectWrap,
				ref: wrapRef,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					id,
					className: `${settings_card_module_css_default.select} ${settings_card_module_css_default.selectButton}`,
					disabled: props.disabled,
					"aria-haspopup": "listbox",
					"aria-expanded": open,
					"aria-activedescendant": open ? `${id}-o${activeIndex}` : void 0,
					"aria-invalid": props.invalid || void 0,
					onClick: onTriggerClick,
					onKeyDown,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: settings_card_module_css_default.selectLabel,
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						width: "14",
						height: "14",
						viewBox: "0 0 14 14",
						fill: "none",
						xmlns: "http://www.w3.org/2000/svg",
						className: open ? `${settings_card_module_css_default.selectChevron} ${settings_card_module_css_default.selectChevronOpen}` : settings_card_module_css_default.selectChevron,
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
							fill: "currentColor"
						})
					})]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: popupClass,
					role: "listbox",
					ref: popupRef,
					children: options.map((option, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						id: `${id}-o${index}`,
						role: "option",
						"aria-selected": option.value === value,
						className: `${settings_card_module_css_default.selectOption}${option.value === value ? ` ${settings_card_module_css_default.selectOptionSelected}` : ""}${index === activeIndex && !closing ? ` ${settings_card_module_css_default.selectOptionActive}` : ""}`,
						onClick: () => {
							commit(index);
						},
						children: option.label
					}, option.value))
				}) : null]
			});
		}
		/** A staged boolean field: 继承 / 开 / 关. */
		function BooleanField(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: settings_card_module_css_default.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: settings_card_module_css_default.head,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: settings_card_module_css_default.label,
							htmlFor: props.id,
							children: props.label
						}), props.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: settings_card_module_css_default.badges,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: settings_card_module_css_default.badge,
								children: props.overriddenLabel
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: settings_card_module_css_default.reset,
								disabled: props.disabled,
								onClick: props.onReset,
								children: props.resetLabel
							})]
						}) : null]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectField, {
						id: props.id,
						options: [
							{
								value: "",
								label: props.inheritLabel
							},
							{
								value: "true",
								label: props.onLabel
							},
							{
								value: "false",
								label: props.offLabel
							}
						],
						value: props.text,
						disabled: props.disabled,
						invalid: props.invalid,
						onEdit: props.onEdit
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: settings_card_module_css_default.hint,
						children: props.hint
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-store-engine
		const platform = ["@deepseek-ai/dsh-client", "-store"].join("");
		const legacy = ["@deepseek-ai/dsh-client-runtime", "/client"].join("");
		let engine;
		try {
			engine = require(platform);
		} catch {
			engine = require(legacy);
		}
		const createSnapshotStore = engine.createSnapshotStore;
		engine.defineStore;
		engine.shallowEqual;
		//#endregion
		//#region src/client/settings-form.ts
		/** A boolean field, edited through true/false draft text. */
		function booleanField(field) {
			return {
				field,
				format: (value) => typeof value === "boolean" ? String(value) : "",
				parse: (text) => {
					const trimmed = text.trim();
					if (trimmed === "") return { kind: "clear" };
					if (trimmed === "true") return {
						kind: "set",
						value: true
					};
					if (trimmed === "false") return {
						kind: "set",
						value: false
					};
				}
			};
		}
		/**
		* Stages one card's edits over one settings namespace and writes them on save.
		*
		* The Host is the only authority on whether a value was accepted — its
		* validators own the constraints no schema can express — so the outcome is
		* read back from the section rather than predicted here. A save that did not
		* land keeps its drafts, so the user can correct them instead of retyping.
		*/
		var CardForm = class {
			scope;
			specs;
			staged = /* @__PURE__ */ new Map();
			listeners = /* @__PURE__ */ new Set();
			/** The scope subscription installed in the constructor; released by dispose(). */
			disposeScope;
			disposed = false;
			saving = false;
			failed = false;
			failedReason;
			/** @param scope - the bound settings scope for this card's namespace. */
			constructor(scope, specs) {
				this.scope = scope;
				this.specs = new Map(specs.map((spec) => [spec.field, spec]));
				this.disposeScope = scope.subscribe(() => {
					this.publish();
				});
			}
			/**
			* Release the scope subscription and every bound store listener. The card
			* must call this on teardown; later calls are no-ops.
			*/
			dispose() {
				if (this.disposed) return;
				this.disposed = true;
				this.disposeScope();
				this.listeners.clear();
			}
			/** Publish a projection of this form, rebuilt whenever the scope or a draft changes. */
			bind(project) {
				const store = createSnapshotStore(project());
				this.listeners.add(() => {
					store.set(project());
				});
				return store;
			}
			/** Read the card-level state: what the Host serves, and what a save would do. */
			shell() {
				const snapshot = this.scope.getSnapshot();
				const plan = this.plan();
				return {
					available: snapshot.status !== "loading",
					exposed: snapshot.status === "ready",
					writable: snapshot.writable,
					dirty: plan.length > 0,
					invalid: plan.some((item) => item.judge === void 0),
					saving: this.saving,
					failed: this.failed,
					...this.failedReason === void 0 ? {} : { failedReason: this.failedReason }
				};
			}
			/** Read one field's state from the effective section and its staged draft. */
			field(field) {
				const spec = this.specOf(field);
				const staged = this.staged.get(field);
				if (staged === void 0) return {
					text: spec.format(this.sectionValue(field)),
					overridden: this.stored(field),
					invalid: false
				};
				const write = staged.clear ? { kind: "clear" } : spec.parse(staged.text);
				return {
					text: staged.text,
					overridden: write?.kind === "set",
					invalid: write === void 0
				};
			}
			/** The actions the card's slot registration injects. */
			actions() {
				return {
					edit: (field, text) => {
						this.stage(field, {
							text,
							clear: false
						});
					},
					resetField: (field) => {
						this.stage(field, {
							text: this.specOf(field).format(this.baseValue(field)),
							clear: true
						});
					},
					save: () => {
						this.save();
					},
					discard: () => {
						if (this.staged.size === 0 && !this.failed) return;
						this.staged.clear();
						this.failed = false;
						this.failedReason = void 0;
						this.publish();
					}
				};
			}
			/**
			* Write every staged edit in one atomic scope mutation, then re-seed from
			* what the Host accepted.
			*
			* The whole batch rides one mutate, so cross-field validate hooks
			* (baseURL+model) judge it as a unit: the Host either applies every write
			* or refuses the batch. The 0.1.2 scope contract never rejects a refused
			* mutation — the scope recovers with a fresh Host view and resolves — so
			* resolution alone proves nothing: the outcome is judged by reading the
			* settled snapshot back, one planned write at a time, and one missed write
			* fails the whole save. A scope that still rejects on refusal (the dsh-web
			* bridge scope) reports through the same failure path with its rejection
			* message. A save that did not land keeps its drafts, so the user can
			* correct them instead of retyping.
			* @returns settlement after the mutation and the read-back.
			*/
			async save() {
				const plan = this.plan();
				const valid = plan.filter((item) => item.judge !== void 0);
				if (plan.length === 0 || this.saving || valid.length !== plan.length) return;
				const pending = /* @__PURE__ */ new Map();
				for (const item of plan) pending.set(item.field, this.staged.get(item.field));
				this.saving = true;
				this.failed = false;
				this.failedReason = void 0;
				this.publish();
				const ops = valid.map((item) => item.op.op === "set" ? {
					op: "set",
					path: [item.field],
					value: item.op.value
				} : {
					op: "unset",
					path: [item.field]
				});
				let failedReason;
				try {
					await this.scope.mutate(ops);
				} catch (error) {
					failedReason = error instanceof Error ? error.message : String(error);
				}
				const landed = failedReason === void 0 && valid.every((item) => item.judge());
				for (const [field, before] of pending) if (landed && this.staged.get(field) === before) this.staged.delete(field);
				this.saving = false;
				this.failed = !landed;
				this.failedReason = failedReason;
				this.publish();
			}
			/**
			* Every staged edit a save would write. An entry whose draft is not a value
			* its field accepts carries no write: the form is still dirty, and the save
			* refuses rather than dropping the edit. A staged edit that matches the
			* effective section is not a write at all.
			* @returns the planned writes, in the order the fields were staged.
			*/
			plan() {
				const plan = [];
				for (const [field, staged] of this.staged) {
					const spec = this.specOf(field);
					if (staged.clear) {
						if (this.stored(field)) plan.push({
							field,
							op: {
								field,
								op: "unset"
							},
							judge: () => this.landedUnset(field)
						});
						continue;
					}
					if (staged.text === spec.format(this.sectionValue(field))) continue;
					const write = spec.parse(staged.text);
					if (write === void 0) plan.push({
						field,
						op: {
							field,
							op: "unset"
						},
						judge: void 0
					});
					else if (write.kind === "clear") plan.push({
						field,
						op: {
							field,
							op: "unset"
						},
						judge: () => this.landedUnset(field)
					});
					else plan.push({
						field,
						op: {
							field,
							op: "set",
							value: write.value
						},
						judge: () => this.landedSet(field, write.value)
					});
				}
				return plan;
			}
			/**
			* Read-back judgment for a planned set: the user layer must hold the
			* intended value once the mutation has settled.
			*/
			landedSet(field, value) {
				if (this.specOf(field).secret) return true;
				return this.userLayer()?.[field] === value;
			}
			/**
			* Read-back judgment for a planned unset: the field must be gone from the
			* user layer once the mutation has settled.
			*/
			landedUnset(field) {
				return !this.stored(field);
			}
			stage(field, edit) {
				this.staged.set(field, edit);
				this.failed = false;
				this.failedReason = void 0;
				this.publish();
			}
			specOf(field) {
				const spec = this.specs.get(field);
				if (spec === void 0) throw new Error(`settings card has no field ${field}`);
				return spec;
			}
			snapshotOf() {
				return this.scope.getSnapshot();
			}
			sectionValue(field) {
				return this.snapshotOf().value?.[field];
			}
			baseValue(field) {
				return this.snapshotOf().base?.[field];
			}
			userLayer() {
				return this.snapshotOf().user;
			}
			stored(field) {
				const user = this.userLayer();
				return user !== void 0 && Object.hasOwn(user, field);
			}
			publish() {
				for (const listener of this.listeners) listener();
			}
		};
		//#endregion
		//#region src/client/local-workshop.ts
		async function request(path, options = {}) {
			const response = await fetch(path, {
				credentials: "same-origin",
				...options
			});
			const body = await response.json();
			if (!response.ok || body.ok === false) throw new Error(body.message ?? body.error ?? `HTTP ${response.status}`);
			return body;
		}
		const json = (body) => ({
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body)
		});
		const localWorkshopApi = {
			async list(signal) {
				return (await request("/api/workshop/resources", { signal })).resources;
			},
			async start(kind, format, signal) {
				return (await request("/api/workshop/upload/start", {
					...json({
						kind,
						format
					}),
					signal
				})).uploadId;
			},
			async upload(uploadId, path, file, signal) {
				await request("/api/workshop/upload/file?" + new URLSearchParams({
					uploadId,
					path
				}).toString(), {
					method: "PUT",
					headers: { "content-type": "application/octet-stream" },
					body: file,
					signal
				});
			},
			async inspect(uploadId, signal) {
				return (await request("/api/workshop/upload/inspect", {
					...json({ uploadId }),
					signal
				})).preview;
			},
			async commit(uploadId, replace) {
				return (await request("/api/workshop/upload/commit", json({
					uploadId,
					replace
				}))).resource;
			},
			async discard(uploadId) {
				await request("/api/workshop/upload/discard", json({ uploadId }));
			},
			async action(kind, id, action, confirmCode) {
				return request("/api/workshop/action", json({
					kind,
					id,
					action,
					confirmCode
				}));
			},
			async job(jobId, signal) {
				return (await request("/api/plugin-manager/status?" + new URLSearchParams({ job: jobId }).toString(), { signal })).job;
			}
		};
		/** Render sizes without interpreting user-controlled resource metadata as HTML. */
		function resourceSize(bytes) {
			if (bytes < 1024) return `${bytes} B`;
			if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
			return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		}
		//#endregion
		//#region \0dsh-css:packages/dsh-market/src/client/market.module.css.mjs
		const css = ".bkhjFa_market{flex-direction:column;gap:14px;min-width:0;display:flex}.bkhjFa_tabs{flex-wrap:wrap;gap:6px;display:flex}.bkhjFa_market .bkhjFa_tabs>button.bkhjFa_tab{font:inherit;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);cursor:pointer;white-space:nowrap;border-radius:999px;padding:3px 12px;font-size:13px;line-height:1.6}.bkhjFa_market .bkhjFa_tabs>button.bkhjFa_tab:hover:enabled{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.bkhjFa_market .bkhjFa_tabs>button.bkhjFa_tab.bkhjFa_tabActive{color:var(--dsw-alias-label-primary-foreground);background:var(--dsw-alias-button-primary-fill);border-color:var(--dsw-alias-button-primary-fill);font-weight:600}.bkhjFa_market .bkhjFa_tabs>button.bkhjFa_tab.bkhjFa_tabActive:hover:enabled{background:var(--dsw-alias-button-primary-hover)}.bkhjFa_market .bkhjFa_tabs>button.bkhjFa_tab:disabled{opacity:.55;cursor:default}.bkhjFa_market .bkhjFa_tabs>button.bkhjFa_tab:focus-visible{outline:2px solid var(--dsw-alias-label-primary);outline-offset:2px}.bkhjFa_tabCount{opacity:.75;margin-left:6px;font-size:12px}.bkhjFa_panel{flex-direction:column;gap:12px;min-width:0;display:flex}.bkhjFa_toolbar{flex-wrap:wrap;justify-content:space-between;gap:10px;display:flex}.bkhjFa_market .bkhjFa_toolbar button.bkhjFa_toolbarButton{border:1px solid var(--dsw-alias-border-l2);height:auto;min-height:32px;font:inherit;border-radius:8px;padding:5px 12px;font-size:13px;font-weight:500;line-height:1.5}.bkhjFa_market .bkhjFa_toolbar button.bkhjFa_toolbarPrimary{color:var(--dsw-alias-label-primary-foreground);background:var(--dsw-alias-button-primary-fill);border-color:var(--dsw-alias-button-primary-fill)}.bkhjFa_market .bkhjFa_toolbar button.bkhjFa_toolbarPrimary:hover:enabled{background:var(--dsw-alias-button-primary-hover);border-color:var(--dsw-alias-button-primary-hover)}.bkhjFa_market .bkhjFa_toolbar button.bkhjFa_toolbarSecondary{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1)}.bkhjFa_market .bkhjFa_toolbar button.bkhjFa_toolbarSecondary:hover:enabled{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed);background:var(--dsw-alias-bg-layer-2)}.bkhjFa_market .bkhjFa_toolbar button.bkhjFa_toolbarButton:disabled{opacity:.4;cursor:default}.bkhjFa_market .bkhjFa_toolbar button.bkhjFa_toolbarButton:focus-visible{outline:2px solid var(--dsw-alias-label-primary);outline-offset:2px}.bkhjFa_actions{flex-wrap:wrap;align-items:center;gap:8px;display:flex}.bkhjFa_search{box-sizing:border-box;width:100%;font:inherit;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:8px 10px;font-size:13px;line-height:1.5}.bkhjFa_search::placeholder{color:var(--dsw-alias-label-tertiary)}.bkhjFa_search:focus{outline:2px solid var(--dsw-alias-label-primary);outline-offset:1px}.bkhjFa_hint{color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere;margin:0;font-size:12px;line-height:1.6}.bkhjFa_grid{grid-template-columns:repeat(auto-fill,minmax(min(100%,272px),1fr));gap:12px;margin:0;padding:0;list-style:none;display:grid}.bkhjFa_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:8px;flex-direction:column;gap:8px;min-width:0;padding:14px;display:flex}.bkhjFa_card>.bkhjFa_actions{margin-top:auto;padding-top:4px}.bkhjFa_card>.bkhjFa_actions:empty{display:none}.bkhjFa_cardHeading{flex-wrap:wrap;align-items:baseline;gap:6px;display:flex}.bkhjFa_cardName{color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;font-size:14px;line-height:1.5}.bkhjFa_version{color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere;font-size:11px}.bkhjFa_cardMeta{color:var(--dsw-alias-label-tertiary);flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;display:flex}.bkhjFa_badge{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-module-platform);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:1px 8px;font-size:11px;line-height:1.6}.bkhjFa_description{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;margin:0;font-size:13px;line-height:1.55}.bkhjFa_identifier{color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere;margin:0;font-size:11px;line-height:1.5}.bkhjFa_empty{border:1px dashed var(--dsw-alias-border-l2);text-align:center;color:var(--dsw-alias-label-secondary);border-radius:8px;padding:28px 16px;font-size:13px;line-height:1.6}.bkhjFa_empty p{color:var(--dsw-alias-label-tertiary);margin:6px 0 0}.bkhjFa_feedback{color:var(--dsw-alias-label-secondary);flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;font-size:13px;display:flex}.bkhjFa_error{color:var(--dsw-alias-state-error-primary,var(--dsw-alias-label-primary));overflow-wrap:anywhere;margin:0;font-size:13px;line-height:1.6}.bkhjFa_notice{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:6px;margin:0;padding:10px 12px;font-size:13px;line-height:1.6}.bkhjFa_confirmation{color:var(--dsw-alias-label-primary);flex-direction:column;gap:14px;font-size:13px;line-height:1.6;display:flex}.bkhjFa_confirmation>p{margin:0}.bkhjFa_details{grid-template-columns:max-content minmax(0,1fr);gap:8px 20px;margin:0;display:grid}.bkhjFa_details dt{color:var(--dsw-alias-label-tertiary)}.bkhjFa_details dd{overflow-wrap:anywhere;margin:0}.bkhjFa_warning{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:6px;padding:10px 12px}.bkhjFa_modalActions{flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:4px;display:flex}@media (width<=480px){.bkhjFa_toolbar{align-items:stretch}.bkhjFa_toolbar>.bkhjFa_actions{flex:100%}.bkhjFa_grid{grid-template-columns:minmax(0,1fr)}.bkhjFa_details{column-gap:12px}}";
		const tagId = "@linxin666/dsh-client-ui-market/packages/dsh-market/src/client/market.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@linxin666/dsh-client-ui-market";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var market_module_css_default = {
			"actions": "bkhjFa_actions",
			"badge": "bkhjFa_badge",
			"card": "bkhjFa_card",
			"cardHeading": "bkhjFa_cardHeading",
			"cardMeta": "bkhjFa_cardMeta",
			"cardName": "bkhjFa_cardName",
			"confirmation": "bkhjFa_confirmation",
			"description": "bkhjFa_description",
			"details": "bkhjFa_details",
			"empty": "bkhjFa_empty",
			"error": "bkhjFa_error",
			"feedback": "bkhjFa_feedback",
			"grid": "bkhjFa_grid",
			"hint": "bkhjFa_hint",
			"identifier": "bkhjFa_identifier",
			"market": "bkhjFa_market",
			"modalActions": "bkhjFa_modalActions",
			"notice": "bkhjFa_notice",
			"panel": "bkhjFa_panel",
			"search": "bkhjFa_search",
			"tab": "bkhjFa_tab",
			"tabActive": "bkhjFa_tabActive",
			"tabCount": "bkhjFa_tabCount",
			"tabs": "bkhjFa_tabs",
			"toolbar": "bkhjFa_toolbar",
			"toolbarButton": "bkhjFa_toolbarButton",
			"toolbarPrimary": "bkhjFa_toolbarPrimary",
			"toolbarSecondary": "bkhjFa_toolbarSecondary",
			"version": "bkhjFa_version",
			"warning": "bkhjFa_warning"
		};
		//#endregion
		//#region src/client/MarketCard.tsx
		/** Local resource Workshop, rendered with the shared settings card and SDK controls. */
		var MarketCardController = class {
			form;
			store;
			constructor(scope) {
				this.form = new CardForm(scope, [booleanField("enabled")]);
				this.store = this.form.bind(() => ({
					...this.form.shell(),
					enabled: this.form.field("enabled")
				}));
			}
			inject() {
				return {
					hooks: { marketCard: this.store },
					...this.form.actions()
				};
			}
			dispose() {
				this.form.dispose();
			}
		};
		const KINDS = [
			"skin",
			"pet",
			"plugin",
			"preset"
		];
		const KIND_LABEL = {
			skin: "tab.skin",
			pet: "tab.pet",
			plugin: "tab.plugin",
			preset: "tab.preset"
		};
		const STATUS_LABEL = {
			available: "local.status.available",
			imported: "local.status.available",
			active: "local.status.active",
			enabled: "local.status.active",
			installed: "local.status.installed",
			disabled: "local.status.disabled",
			"pending-restart": "local.status.pendingRestart",
			invalid: "local.status.invalid"
		};
		const ACTION_LABEL = {
			install: "local.install",
			enable: "local.enable",
			disable: "local.disable",
			remove: "local.remove",
			trust: "local.trust"
		};
		const messageOf = (reason) => reason instanceof Error ? reason.message : String(reason);
		const activeResource = (resource) => resource.status === "active" || String(resource.status) === "enabled";
		function MarketCard(props) {
			const { t } = props;
			const api = props.api ?? localWorkshopApi;
			const state = props.useMarketCard((snapshot) => snapshot);
			const cardVisible = state.enabled.text !== "false";
			const [tab, setTab] = (0, react.useState)("skin");
			const [query, setQuery] = (0, react.useState)("");
			const [resources, setResources] = (0, react.useState)([]);
			const [loading, setLoading] = (0, react.useState)(false);
			const [loadError, setLoadError] = (0, react.useState)("");
			const [error, setError] = (0, react.useState)("");
			const [notice, setNotice] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const [progress, setProgress] = (0, react.useState)("");
			const [preview, setPreview] = (0, react.useState)(null);
			const [committing, setCommitting] = (0, react.useState)(false);
			const [confirmation, setConfirmation] = (0, react.useState)(null);
			const [actionRunning, setActionRunning] = (0, react.useState)(false);
			const [lastSelection, setLastSelection] = (0, react.useState)(null);
			const zipInput = (0, react.useRef)(null);
			const folderInput = (0, react.useRef)(null);
			const upload = (0, react.useRef)(null);
			const abort = (0, react.useRef)(null);
			const mounted = (0, react.useRef)(true);
			const locked = (0, react.useRef)(false);
			const commitInFlight = (0, react.useRef)(false);
			const generation = (0, react.useRef)(0);
			const loadSequence = (0, react.useRef)(0);
			const disabled = !state.writable || busy || confirmation !== null;
			async function refresh() {
				const sequence = ++loadSequence.current;
				setLoading(true);
				setLoadError("");
				try {
					const next = await api.list();
					if (mounted.current && loadSequence.current === sequence) setResources(next);
				} catch (reason) {
					if (mounted.current && loadSequence.current === sequence) setLoadError(messageOf(reason));
				} finally {
					if (mounted.current && loadSequence.current === sequence) setLoading(false);
				}
			}
			async function discardUpload() {
				const current = upload.current;
				upload.current = null;
				if (current) try {
					await current.api.discard(current.id);
				} catch {}
			}
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
					generation.current++;
					abort.current?.abort();
					if (!commitInFlight.current) discardUpload();
				};
			}, []);
			(0, react.useEffect)(() => {
				if (cardVisible) refresh();
			}, [api, cardVisible]);
			function finish() {
				locked.current = false;
				if (!mounted.current) return;
				setBusy(false);
				setProgress("");
				setCommitting(false);
				setActionRunning(false);
			}
			async function importSelection(selection) {
				if (locked.current || selection.files.length === 0 || !state.writable) return;
				locked.current = true;
				setBusy(true);
				setError("");
				setNotice("");
				setLastSelection(selection);
				setProgress(t("local.preparing"));
				const controller = new AbortController();
				abort.current = controller;
				const sequence = ++generation.current;
				try {
					const id = await api.start(selection.kind, selection.format, controller.signal);
					if (sequence !== generation.current) {
						await api.discard(id);
						return;
					}
					upload.current = {
						id,
						api
					};
					for (let index = 0; index < selection.files.length; index++) {
						const file = selection.files[index];
						setProgress(t("local.uploading", {
							current: index + 1,
							total: selection.files.length
						}));
						await api.upload(id, selection.format === "zip" ? "archive.zip" : file.webkitRelativePath || file.name, file, controller.signal);
					}
					setProgress(t("local.inspecting"));
					const result = await api.inspect(id, controller.signal);
					if (sequence !== generation.current || !mounted.current) return;
					setPreview(result);
					setProgress("");
					setLastSelection(null);
				} catch (reason) {
					if (sequence !== generation.current || !mounted.current) return;
					setError(messageOf(reason));
					await discardUpload();
					finish();
				}
			}
			function pickFiles(files, format) {
				if (files?.length) importSelection({
					kind: tab,
					files: Array.from(files),
					format
				});
			}
			async function cancelImport() {
				if (commitInFlight.current) return;
				generation.current++;
				abort.current?.abort();
				setPreview(null);
				setError("");
				setLastSelection(null);
				await discardUpload();
				finish();
			}
			async function commitImport() {
				const pending = upload.current;
				if (!pending || !preview || commitInFlight.current) return;
				commitInFlight.current = true;
				setCommitting(true);
				setError("");
				try {
					const resource = await pending.api.commit(pending.id, preview.conflict);
					upload.current = null;
					commitInFlight.current = false;
					if (!mounted.current) return;
					setPreview(null);
					setTab(resource.kind);
					setQuery("");
					setNotice(t(resource.kind === "pet" ? "local.petImported" : "local.imported", { name: resource.name }));
					await refresh();
					finish();
				} catch (reason) {
					commitInFlight.current = false;
					if (mounted.current) {
						setError(messageOf(reason));
						setCommitting(false);
					} else await discardUpload();
				}
			}
			async function performAction(target) {
				if (locked.current || !state.writable) return;
				locked.current = true;
				setBusy(true);
				setActionRunning(true);
				setError("");
				setNotice("");
				setProgress(t("local.working"));
				try {
					const result = await api.action(target.resource.kind, target.resource.id, target.action, true);
					if (result.jobId) {
						const controller = new AbortController();
						abort.current = controller;
						let completed = false;
						for (let attempt = 0; attempt < 300; attempt++) {
							if (!mounted.current) return;
							const job = await api.job(result.jobId, controller.signal);
							if (job.phase === "error") throw new Error(job.error ?? t("local.actionFailed"));
							if (job.phase === "done") {
								completed = true;
								break;
							}
							await new Promise((resolve) => setTimeout(resolve, 1e3));
						}
						if (!completed) throw new Error(t("local.jobTimeout"));
					}
					if (!mounted.current) return;
					setConfirmation(null);
					setNotice(t(result.requiresRestart ? "local.restart" : target.action === "trust" ? "local.trustDone" : target.action === "remove" ? "local.removed" : "local.actionDone"));
					await refresh();
				} catch (reason) {
					if (mounted.current) setError(messageOf(reason));
				} finally {
					finish();
				}
			}
			const items = resources.filter((resource) => resource.kind === tab);
			const needle = query.trim().toLocaleLowerCase();
			const shown = items.filter((resource) => [
				resource.name,
				resource.id,
				resource.description ?? ""
			].join(" ").toLocaleLowerCase().includes(needle));
			const actionButton = (resource, action) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "outline",
				size: "sm",
				disabled,
				onClick: () => {
					setError("");
					setConfirmation({
						resource,
						action
					});
				},
				children: t(ACTION_LABEL[action])
			}, action);
			const actionNeedsCode = confirmation?.action === "install" || confirmation?.action === "trust" || confirmation?.action === "enable" && confirmation.resource.kind === "preset";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PluginSettingsCard, {
				t,
				titleKey: "settings.title",
				descriptionKey: "settings.description",
				state,
				alwaysOpen: true,
				onSave: props.save,
				onDiscard: props.discard,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BooleanField, {
						id: "settings-market-enabled",
						label: t("settings.enable"),
						hint: t("settings.enableHint"),
						inheritLabel: t("settings.inherit"),
						onLabel: t("settings.on"),
						offLabel: t("settings.off"),
						overriddenLabel: t("settings.overridden"),
						resetLabel: t("settings.reset"),
						invalidLabel: t("settings.invalidNumber"),
						disabled,
						...state.enabled,
						onEdit: (value) => {
							props.edit("enabled", value);
						},
						onReset: () => {
							props.resetField("enabled");
						}
					}),
					cardVisible ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: market_module_css_default.market,
						"data-dsh-plugin": "dsh-web-ui-market",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: market_module_css_default.tabs,
							role: "tablist",
							"aria-label": t("settings.title"),
							children: KINDS.map((kind, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "tab",
								id: `workshop-tab-${kind}`,
								"aria-selected": tab === kind,
								"aria-controls": "workshop-local-panel",
								tabIndex: tab === kind ? 0 : -1,
								disabled: busy || confirmation !== null,
								className: `${market_module_css_default.tab} ${tab === kind ? market_module_css_default.tabActive : ""}`,
								onClick: () => {
									setTab(kind);
									setQuery("");
								},
								onKeyDown: (event) => {
									const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
									const next = event.key === "Home" ? 0 : event.key === "End" ? KINDS.length - 1 : offset ? (index + offset + KINDS.length) % KINDS.length : -1;
									if (next >= 0) {
										event.preventDefault();
										setTab(KINDS[next]);
										setQuery("");
										document.getElementById(`workshop-tab-${KINDS[next]}`)?.focus();
									}
								},
								children: [t(KIND_LABEL[kind]), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: market_module_css_default.tabCount,
									children: resources.filter((resource) => resource.kind === kind).length
								})]
							}, kind))
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							role: "tabpanel",
							id: "workshop-local-panel",
							"aria-labelledby": `workshop-tab-${tab}`,
							className: market_module_css_default.panel,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: market_module_css_default.toolbar,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: market_module_css_default.actions,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "primary",
											size: "sm",
											className: `${market_module_css_default.toolbarButton} ${market_module_css_default.toolbarPrimary}`,
											disabled,
											onClick: () => zipInput.current?.click(),
											children: t("local.importZip")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "outline",
											size: "sm",
											className: `${market_module_css_default.toolbarButton} ${market_module_css_default.toolbarSecondary}`,
											disabled,
											onClick: () => folderInput.current?.click(),
											children: t("local.importFolder")
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "outline",
										size: "sm",
										className: `${market_module_css_default.toolbarButton} ${market_module_css_default.toolbarSecondary}`,
										disabled: disabled || loading,
										onClick: () => {
											refresh();
										},
										children: t("local.refresh")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									ref: zipInput,
									hidden: true,
									type: "file",
									accept: ".zip,application/zip",
									"aria-label": t("local.importZip"),
									onChange: (event) => {
										pickFiles(event.currentTarget.files, "zip");
										event.currentTarget.value = "";
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									ref: (element) => {
										folderInput.current = element;
										element?.setAttribute("webkitdirectory", "");
									},
									hidden: true,
									type: "file",
									multiple: true,
									"aria-label": t("local.importFolder"),
									onChange: (event) => {
										pickFiles(event.currentTarget.files, "folder");
										event.currentTarget.value = "";
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: market_module_css_default.hint,
									children: t("local.importHint", { kind: t(KIND_LABEL[tab]) })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "search",
									className: market_module_css_default.search,
									value: query,
									"aria-label": t("search.label"),
									placeholder: t("search.label"),
									onChange: (event) => {
										setQuery(event.target.value);
									}
								}),
								progress ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: market_module_css_default.feedback,
									role: "status",
									"aria-live": "polite",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: progress }), !confirmation && !committing ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										onClick: () => {
											cancelImport();
										},
										children: t("cancel")
									}) : null]
								}) : null,
								notice ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: market_module_css_default.notice,
									role: "status",
									children: notice
								}) : null,
								error && !preview && !confirmation ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: market_module_css_default.feedback,
									role: "alert",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: market_module_css_default.error,
										children: error
									}), lastSelection ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										disabled,
										onClick: () => {
											importSelection(lastSelection);
										},
										children: t("retry")
									}) : null]
								}) : null,
								loadError ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: market_module_css_default.feedback,
									role: "alert",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: market_module_css_default.error,
										children: t("local.loadFailed", { reason: loadError })
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										disabled: busy,
										onClick: () => {
											refresh();
										},
										children: t("retry")
									})]
								}) : null,
								loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: market_module_css_default.hint,
									role: "status",
									children: t("loading")
								}) : null,
								!loading && !loadError && shown.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: market_module_css_default.empty,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t(needle ? "noMatch" : "local.empty") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t(needle ? "local.searchHint" : "local.emptyHint") })]
								}) : null,
								shown.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
									className: market_module_css_default.grid,
									children: shown.map((resource) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
										className: market_module_css_default.card,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: market_module_css_default.cardHeading,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
													className: market_module_css_default.cardName,
													children: resource.name
												}), resource.version ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: market_module_css_default.version,
													children: ["v", resource.version]
												}) : null]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: market_module_css_default.cardMeta,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: market_module_css_default.badge,
													children: t(resource.kind === "plugin" && resource.installed ? resource.enabled === false ? "local.status.disabled" : "local.status.installed" : STATUS_LABEL[resource.status] ?? "local.status.available")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(resource.source === "local" ? "local.source.local" : "local.source.existing") })]
											}),
											resource.description ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: market_module_css_default.description,
												children: resource.description
											}) : null,
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: market_module_css_default.identifier,
												children: resource.id
											}),
											resource.kind === "skin" || resource.kind === "pet" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: market_module_css_default.hint,
												children: t(resource.kind === "skin" ? "local.applySkin" : "local.applyPet")
											}) : null,
											!resource.managed && (resource.kind === "plugin" || resource.kind === "preset") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: market_module_css_default.hint,
												children: t(resource.kind === "plugin" ? "local.managePlugins" : "local.managePresets")
											}) : null,
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: market_module_css_default.actions,
												children: [
													resource.managed && resource.status !== "invalid" && resource.kind === "plugin" ? actionButton(resource, resource.installed ? resource.enabled === false ? "enable" : "disable" : "install") : null,
													resource.managed && resource.status !== "invalid" && resource.kind === "preset" ? actionButton(resource, activeResource(resource) ? "disable" : "enable") : null,
													resource.managed && resource.status !== "invalid" && resource.kind === "skin" && resource.executable ? actionButton(resource, "trust") : null,
													resource.managed && !activeResource(resource) && !resource.installed ? actionButton(resource, "remove") : null
												]
											})
										]
									}, `${resource.kind}:${resource.id}`))
								}) : null
							]
						})]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: preview !== null,
						title: t("local.confirmImport"),
						closeLabel: t("cancel"),
						onClose: () => {
							if (!committing) cancelImport();
						},
						children: preview ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: market_module_css_default.confirmation,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", {
									className: market_module_css_default.details,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("local.name") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: preview.name }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("local.kind") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: t(KIND_LABEL[preview.kind]) }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("local.version") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: preview.version ?? t("local.noVersion") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("local.files") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: t("local.fileSummary", {
											count: preview.fileCount,
											size: resourceSize(preview.totalBytes)
										}) })
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: market_module_css_default.hint,
									children: t("local.importOnly")
								}),
								preview.conflict ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: market_module_css_default.warning,
									children: t("local.replaceHint")
								}) : null,
								error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: market_module_css_default.error,
									role: "alert",
									children: error
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: market_module_css_default.modalActions,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "outline",
										size: "sm",
										disabled: committing,
										onClick: () => {
											cancelImport();
										},
										children: t("cancel")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "primary",
										size: "sm",
										disabled: committing,
										onClick: () => {
											commitImport();
										},
										children: t(committing ? "local.importing" : preview.conflict ? "local.replaceImport" : "local.confirmImport")
									})]
								})
							]
						}) : null
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: confirmation !== null,
						title: confirmation ? t(ACTION_LABEL[confirmation.action]) : "",
						closeLabel: t("cancel"),
						onClose: () => {
							if (!actionRunning) {
								setConfirmation(null);
								setError("");
							}
						},
						children: confirmation ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: market_module_css_default.confirmation,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("local.confirmAction", {
									action: t(ACTION_LABEL[confirmation.action]),
									name: confirmation.resource.name
								}) }),
								actionNeedsCode ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: market_module_css_default.warning,
									children: t(confirmation.action === "install" ? "local.installCodeHint" : confirmation.action === "trust" ? "local.trustCodeHint" : "local.presetCodeHint")
								}) : null,
								confirmation.action === "remove" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: market_module_css_default.hint,
									children: t("local.removeHint")
								}) : null,
								error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: market_module_css_default.error,
									role: "alert",
									children: error
								}) : null,
								actionRunning ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: market_module_css_default.hint,
									role: "status",
									children: progress
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: market_module_css_default.modalActions,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "outline",
										size: "sm",
										disabled: actionRunning,
										onClick: () => {
											setConfirmation(null);
											setError("");
										},
										children: t("cancel")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "primary",
										size: "sm",
										disabled: actionRunning,
										onClick: () => {
											performAction(confirmation);
										},
										children: t(actionRunning ? "local.working" : actionNeedsCode ? "local.confirmCode" : ACTION_LABEL[confirmation.action])
									})]
								})
							]
						}) : null
					})
				]
			});
		}
		function MarketSection(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MarketCard, { ...props });
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* Market card dictionaries. zh is the key source; en mirrors every key.
		*/
		const zh = {
			"settings.collapse": "收起",
			"settings.expand": "展开",
			"settings.notExposed": "该设置段未暴露（宿主命名空间缺失）",
			"settings.unsaved": "有未保存的更改",
			"settings.readOnly": "只读",
			"settings.saveFailed": "保存失败",
			"settings.discard": "放弃更改",
			"settings.save": "保存",
			"settings.saving": "保存中…",
			"settings.overridden": "已覆盖默认值",
			"settings.reset": "恢复默认",
			"settings.invalidNumber": "无效值",
			"settings.inherit": "继承",
			"settings.on": "开",
			"settings.off": "关",
			"settings.title": "创意工坊",
			"settings.description": "导入并管理自己的皮肤、宠物、插件和预设。",
			"settings.descriptionPrefix": "浏览 ",
			"settings.descriptionSuffix": " 的皮肤、宠物与社区插件，一键安装到本机 dsh。",
			"settings.enable": "启用创意工坊卡片",
			"settings.enableHint": "关闭后隐藏创意工坊内容，仅保留开关本身。",
			"tab.skin": "皮肤",
			"tab.pet": "宠物",
			"tab.plugin": "插件",
			"tab.preset": "预设",
			"presetPanel.missing": "未安装预设中心插件（@linxin666/dsh-client-ui-preset-center），无法管理社区预设。",
			"search.label": "搜索本地资源名称或描述…",
			"local.importZip": "导入 ZIP",
			"local.importFolder": "选择文件夹",
			"local.refresh": "刷新",
			"local.importHint": "当前分类：{kind}。支持对应格式的 ZIP 资源包或文件夹，导入后无需保留原文件。",
			"local.empty": "暂无本地资源",
			"local.emptyHint": "选择 ZIP 资源包或文件夹，将自己的资源添加到这里。",
			"local.searchHint": "试试其他名称，或清空搜索查看全部资源。",
			"local.loadFailed": "读取本地资源失败：{reason}",
			"local.source.local": "本地导入",
			"local.source.existing": "已有资源",
			"local.status.available": "可使用",
			"local.status.active": "使用中",
			"local.status.installed": "已安装",
			"local.status.disabled": "已停用",
			"local.status.pendingRestart": "待重启",
			"local.status.invalid": "格式异常",
			"local.applySkin": "导入后可在左侧「皮肤」中选择并应用。",
			"local.applyPet": "导入后请重启工作台，再到左侧「宠物」中选择并启用。",
			"local.managePlugins": "已有插件可在左侧「插件」的插件管理中调整。",
			"local.managePresets": "已有预设可在左侧「Agent 预设」中管理。",
			"local.install": "安装",
			"local.enable": "启用",
			"local.disable": "停用",
			"local.remove": "移除",
			"local.trust": "信任皮肤脚本",
			"local.preparing": "准备导入…",
			"local.uploading": "正在传入文件 {current} / {total}…",
			"local.inspecting": "正在检查资源…",
			"local.confirmImport": "确认导入",
			"local.importing": "导入中…",
			"local.name": "名称",
			"local.kind": "分类",
			"local.version": "版本",
			"local.noVersion": "未声明",
			"local.files": "文件",
			"local.fileSummary": "{count} 个，共 {size}",
			"local.importOnly": "导入只保存资源，不会自动安装插件、执行脚本或切换当前配置。",
			"local.replaceHint": "已存在同名资源。继续将先备份旧版本，再替换为本次导入的文件。",
			"local.replaceImport": "备份并替换",
			"local.imported": "已导入「{name}」。",
			"local.petImported": "已导入「{name}」。请重启工作台，再到左侧「宠物」中选择并启用。",
			"local.confirmAction": "确认{action}「{name}」？",
			"local.installCodeHint": "安装插件可能运行安装脚本，启用后可执行本机代码；缺少依赖时可能联网下载。请确认资源来源可信。",
			"local.presetCodeHint": "启用预设后，创建会话时可能加载并执行其中的插件代码。请确认资源来源可信。",
			"local.trustCodeHint": "信任后，应用该皮肤时可运行其中的界面脚本。请确认资源来源可信。",
			"local.confirmCode": "确认信任并继续",
			"local.removeHint": "此操作会移除本地资源。正在使用的资源需先停用；已安装的插件需先在插件管理中卸载。",
			"local.working": "处理中…",
			"local.actionDone": "操作已完成。",
			"local.trustDone": "已信任此版本的皮肤脚本，请在「皮肤」中重新应用。",
			"local.removed": "资源已移除，备份保留在工作台数据目录。",
			"local.actionFailed": "操作失败，请重试。",
			"local.jobTimeout": "安装仍在处理中，请稍后刷新或在插件管理中查看进度。",
			"local.restart": "操作已完成，需要重新启动工作台后生效。",
			"filter.all": "全部",
			"filter.category": "分类筛选",
			"filter.subcategory": "二级分类",
			"category.ui": "界面",
			"category.agent": "Agent",
			"category.tools": "工具",
			"category.knowledge": "知识",
			"category.integration": "集成",
			"category.security": "安全",
			"category.utility": "实用",
			"category.roleplay": "角色扮演",
			"category.other": "其他",
			"subcategory.terminal": "终端界面",
			"subcategory.chat": "对话增强",
			"subcategory.render": "回复内容渲染",
			"subcategory.panel": "侧栏面板",
			"subcategory.preset": "Agent 预设",
			"subcategory.context": "上下文洞察",
			"subcategory.browser": "浏览器自动化",
			"subcategory.api": "接口与网络调试",
			"subcategory.model": "模型与多模态",
			"subcategory.dev": "开发工作流",
			"subcategory.memory": "记忆",
			"subcategory.reading": "深度阅读",
			"subcategory.qa": "知识库问答",
			"subcategory.remote": "远程访问",
			"subcategory.bridge": "跨系统桥",
			"subcategory.sync": "云同步",
			"subcategory.external-ai": "外部 AI 接入",
			"subcategory.access": "访问控制",
			"subcategory.policy": "审批策略",
			"subcategory.cleanup": "系统整理",
			"subcategory.stats": "统计",
			"subcategory.notify": "通知",
			"subcategory.net": "网络与传输",
			"result.count": "共 {shown} / {total} 个条目",
			"empty": "创意工坊清单为空（网络不可达？点击重试）",
			"noMatch": "没有匹配的条目",
			"retry": "重试",
			"online": "",
			"offline": "创意工坊数据不可用，请检查网络",
			"install": "安装",
			"installNow": "一键安装",
			"installing": "安装中…",
			"installed": "已安装",
			"installFailed": "安装失败：{reason}",
			"installSpecInvalid": "安装来源无效，仅支持 npm 包名或 https:// git 地址",
			"copied": "已复制",
			"copyCommand": "复制安装命令",
			"command.title": "复制下方命令到 dsh host 终端执行",
			"conflict.title": "已存在同名目录",
			"conflict.text": "{dest} 已存在。继续将覆盖该目录中的旧版本文件（不可撤销）。",
			"replace": "覆盖并安装",
			"cancel": "取消",
			"preview": "预览",
			"openSite": "打开创意工坊站",
			"repository": "源码仓库",
			"like": "赞",
			"liked": "已赞",
			"likeFailed": "点赞失败",
			"badge.market": "dsh-market.com",
			"install.path": "安装目录：{path}",
			"installedAt": "安装到 {path}",
			"loading": "加载中…",
			"votes": "{count} 票",
			"installs": "安装 {count}",
			"npmDownloads": "npm 近 30 天 {count}",
			"remote.note": "远程浏览器仅可浏览与复制命令；一键安装需在本机（回环）浏览器。"
		};
		const en = {
			"settings.collapse": "Collapse",
			"settings.expand": "Expand",
			"settings.notExposed": "Section not exposed (host namespace missing)",
			"settings.unsaved": "Unsaved changes",
			"settings.readOnly": "Read only",
			"settings.saveFailed": "Save failed",
			"settings.discard": "Discard changes",
			"settings.save": "Save",
			"settings.saving": "Saving…",
			"settings.overridden": "Overrides default",
			"settings.reset": "Reset",
			"settings.invalidNumber": "Invalid value",
			"settings.inherit": "Inherit",
			"settings.on": "On",
			"settings.off": "Off",
			"settings.title": "Workshop",
			"settings.description": "Import and manage your own skins, pets, plugins and presets.",
			"settings.descriptionPrefix": "Browse skins, pets and community plugins from ",
			"settings.descriptionSuffix": " and install them locally with one click.",
			"settings.enable": "Enable the Workshop card",
			"settings.enableHint": "Hides the Workshop content and keeps the switch only.",
			"tab.skin": "Skins",
			"tab.pet": "Pets",
			"tab.plugin": "Plugins",
			"tab.preset": "Presets",
			"presetPanel.missing": "The preset center plugin (@linxin666/dsh-client-ui-preset-center) is not installed, so community presets cannot be managed.",
			"search.label": "Search local resource names or descriptions…",
			"local.importZip": "Import ZIP",
			"local.importFolder": "Choose folder",
			"local.refresh": "Refresh",
			"local.importHint": "Category: {kind}. Choose a compatible ZIP resource pack or folder. The original files are no longer needed after import.",
			"local.empty": "No local resources yet",
			"local.emptyHint": "Choose a ZIP resource pack or folder to add your own resources here.",
			"local.searchHint": "Try another name or clear the search to view all resources.",
			"local.loadFailed": "Could not read local resources: {reason}",
			"local.source.local": "Local import",
			"local.source.existing": "Existing resource",
			"local.status.available": "Available",
			"local.status.active": "In use",
			"local.status.installed": "Installed",
			"local.status.disabled": "Disabled",
			"local.status.pendingRestart": "Restart required",
			"local.status.invalid": "Invalid format",
			"local.applySkin": "Choose and apply this resource under Skins in the left menu.",
			"local.applyPet": "After importing, restart the workbench, then choose and enable this resource under Pets in the left menu.",
			"local.managePlugins": "Manage existing plugins under Plugins in the left menu.",
			"local.managePresets": "Manage existing presets under Agent presets in the left menu.",
			"local.install": "Install",
			"local.enable": "Enable",
			"local.disable": "Disable",
			"local.remove": "Remove",
			"local.trust": "Trust skin scripts",
			"local.preparing": "Preparing import…",
			"local.uploading": "Transferring file {current} / {total}…",
			"local.inspecting": "Checking resource…",
			"local.confirmImport": "Confirm import",
			"local.importing": "Importing…",
			"local.name": "Name",
			"local.kind": "Category",
			"local.version": "Version",
			"local.noVersion": "Not declared",
			"local.files": "Files",
			"local.fileSummary": "{count} files, {size}",
			"local.importOnly": "Import only saves files. It does not install plugins, execute scripts or switch your current configuration.",
			"local.replaceHint": "A resource with this name already exists. Continuing backs up its current version and replaces it with the imported files.",
			"local.replaceImport": "Back up and replace",
			"local.imported": "Imported “{name}”.",
			"local.petImported": "Imported “{name}”. Restart the workbench, then choose and enable it under Pets in the left menu.",
			"local.confirmAction": "{action} “{name}”?",
			"local.installCodeHint": "Installing plugins may run installation scripts. Enabled plugins can execute local code and missing dependencies may be downloaded. Confirm that you trust this resource.",
			"local.presetCodeHint": "Enabling a preset can load and run its plugin code when a session starts. Confirm that you trust this resource.",
			"local.trustCodeHint": "After trusting this skin, applying it can run its UI scripts. Confirm that you trust this resource.",
			"local.confirmCode": "Trust and continue",
			"local.removeHint": "This removes the local resource. Disable active resources first. Uninstall installed plugins in Plugin management first.",
			"local.working": "Working…",
			"local.actionDone": "Operation completed.",
			"local.trustDone": "Scripts are trusted for this skin version. Reapply it under Skins.",
			"local.removed": "Resource removed. A backup is kept in the workbench data directory.",
			"local.actionFailed": "Operation failed. Please retry.",
			"local.jobTimeout": "Installation is still running. Refresh later or check progress in Plugin management.",
			"local.restart": "Operation completed. Restart the workbench to apply the changes.",
			"filter.all": "All",
			"filter.category": "Category filter",
			"filter.subcategory": "Subcategory",
			"category.ui": "UI",
			"category.agent": "Agent",
			"category.tools": "Tools",
			"category.knowledge": "Knowledge",
			"category.integration": "Integration",
			"category.security": "Security",
			"category.utility": "Utility",
			"category.roleplay": "Roleplay",
			"category.other": "Other",
			"subcategory.terminal": "Terminal UI",
			"subcategory.chat": "Chat enhancements",
			"subcategory.render": "Reply rendering",
			"subcategory.panel": "Sidebar panel",
			"subcategory.preset": "Agent presets",
			"subcategory.context": "Context insights",
			"subcategory.browser": "Browser automation",
			"subcategory.api": "API & network tools",
			"subcategory.model": "Models & multimodal",
			"subcategory.dev": "Dev workflow",
			"subcategory.memory": "Memory",
			"subcategory.reading": "Deep reading",
			"subcategory.qa": "Knowledge-base Q&A",
			"subcategory.remote": "Remote access",
			"subcategory.bridge": "Cross-system bridge",
			"subcategory.sync": "Cloud sync",
			"subcategory.external-ai": "External AI",
			"subcategory.access": "Access control",
			"subcategory.policy": "Approval policy",
			"subcategory.cleanup": "System cleanup",
			"subcategory.stats": "Statistics",
			"subcategory.notify": "Notifications",
			"subcategory.net": "Networking",
			"result.count": "{shown} / {total} entries",
			"empty": "Workshop list empty (network unreachable? click retry)",
			"noMatch": "No matching entries",
			"retry": "Retry",
			"online": "",
			"offline": "Workshop data unavailable",
			"install": "Install",
			"installNow": "Install now",
			"installing": "Installing…",
			"installed": "Installed",
			"installFailed": "Install failed: {reason}",
			"installSpecInvalid": "Invalid install source; only npm package names and https:// git URLs are supported",
			"copied": "Copied",
			"copyCommand": "Copy install command",
			"command.title": "Copy this command into a dsh host terminal",
			"conflict.title": "Same-named directory exists",
			"conflict.text": "{dest} already exists. Continuing will replace its files with the old version (not undoable).",
			"replace": "Replace and install",
			"cancel": "Cancel",
			"preview": "Preview",
			"openSite": "Open the Workshop site",
			"repository": "Source repository",
			"like": "Like",
			"liked": "Liked",
			"likeFailed": "Like failed",
			"badge.market": "dsh-market.com",
			"install.path": "Install directory: {path}",
			"installedAt": "Installed to {path}",
			"loading": "Loading…",
			"votes": "{count} votes",
			"installs": "{count} installs",
			"npmDownloads": "npm {count} last 30d",
			"remote.note": "Remote browsers can browse and copy commands only; one-click install needs the local (loopback) browser."
		};
		//#endregion
		//#region src/client/index.ts
		const MARKET_NS = "dsh-web-ui-market";
		const SECTION_ID = "dsh-workshop";
		const inject = [
			"slots",
			"locale",
			"connection",
			"settingsScope",
			"remote"
		];
		/** Register the local Workshop section without remote catalog or telemetry. */
		function apply(ctx) {
			ctx.effect(() => {
				try {
					return ctx.locale.register(MARKET_NS, {
						zh,
						en
					});
				} catch {
					return () => {};
				}
			}, "dsh-web-ui-market: dictionaries");
			const controller = new MarketCardController((ctx.get("webUiSettings") ?? ctx.settingsScope).bind({ namespace: MARKET_NS }));
			ctx.slots.inject("settings.section", () => {
				try {
					const unregister = ctx.slots.register({
						name: "settings.section",
						id: SECTION_ID,
						order: 150,
						label: () => ctx.locale.bind(MARKET_NS)("settings.title"),
						locale: MARKET_NS,
						children: { "dsh-workshop.panel": {
							kind: "keyed",
							scope: "root"
						} },
						inject: () => controller.inject()
					}, MarketSection);
					return () => {
						unregister();
						controller.dispose();
					};
				} catch {
					return () => {};
				}
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map