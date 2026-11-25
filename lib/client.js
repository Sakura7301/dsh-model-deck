window.__ModuleLoader__.load({
	id: "dsh-model-deck",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  ModelDirectory: () => ModelDirectory,
  ModelDirectoryResolver: () => ModelDirectoryResolver,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/service.ts
var import_cordis = require("@deepseek-ai/cordis");

// src/client/weak-map-with-values.ts
var WeakMapWithValues = class {
  keys = /* @__PURE__ */ new WeakMap();
  valueSet = /* @__PURE__ */ new Set();
  /** Live strongly retained values in insertion order. */
  values = this.valueSet;
  /** Read the value associated with a key. */
  get(key) {
    return this.keys.get(key);
  }
  /** Test whether a key has an association. */
  has(key) {
    return this.keys.has(key);
  }
  /** Associate one key with one caller-unique value. */
  set(key, value) {
    if (this.keys.has(key)) {
      const previous = this.keys.get(key);
      if (previous === value) return this;
      this.valueSet.delete(previous);
    }
    this.keys.set(key, value);
    this.valueSet.add(value);
    return this;
  }
  /** Remove one association and its strongly retained value. */
  delete(key) {
    if (!this.keys.has(key)) return false;
    const value = this.keys.get(key);
    const deleted = this.keys.delete(key);
    this.valueSet.delete(value);
    return deleted;
  }
  /** Remove every association and strongly retained value. */
  clear() {
    this.keys = /* @__PURE__ */ new WeakMap();
    this.valueSet.clear();
  }
};

// src/client/catalog.ts
var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");
var ModelCatalogDirectory = class {
  /**
   * @param ctx - the providing plugin's context, whose `remote.session`
   * namespace carries the Host-generation catalog.
   */
  constructor(ctx) {
    this.ctx = ctx;
  }
  ctx;
  /** Current shared catalog value and load lifecycle. */
  store = (0, import_dsh_client_store.createSnapshotStore)({
    value: null,
    status: "idle",
    error: null
  });
  reasoning = /* @__PURE__ */ new Map();
  /**
   * Read the last advertised reasoning metadata, including unavailable models.
   * @param selection - provider and model whose effort is displayed.
   * @returns reasoning metadata observed during this Host generation.
   */
  reasoningFor(selection) {
    return this.reasoning.get(JSON.stringify([selection.provider, selection.model]));
  }
  generation = 0;
  inflight;
  /**
   * Return the current generation's catalog, sharing its one in-flight load.
   * @returns the loaded global catalog.
   */
  load() {
    const state = this.store.getSnapshot();
    if (state.status === "ready" && state.value !== null) return Promise.resolve(state.value);
    if (this.inflight !== void 0) return this.inflight;
    const generation = this.generation;
    this.store.update((draft) => {
      draft.status = "loading";
      draft.error = null;
    });
    const operation = this.ctx.remote.session.modelCatalog().then((response) => {
      if (!response.ok) {
        throw new Error(`${response.error.code}: ${response.error.message}`);
      }
      if (generation === this.generation) {
        for (const group of response.value.groups) {
          for (const model of group.models) {
            this.reasoning.set(JSON.stringify([group.id, model.id]), model.reasoning);
          }
        }
        this.store.set({ value: response.value, status: "ready", error: null });
      }
      return response.value;
    }).catch((error) => {
      if (generation === this.generation) {
        this.store.update((draft) => {
          draft.status = "error";
          draft.error = error instanceof Error ? error.message : String(error);
        });
      }
      throw error;
    }).finally(() => {
      if (generation === this.generation && this.inflight === operation) this.inflight = void 0;
    });
    this.inflight = operation;
    return operation;
  }
  /**
   * Invalidate the loaded catalog; the next explicit menu read reloads it.
   * @param clear - whether values from the previous Host generation must be hidden.
   */
  invalidate(clear = false) {
    this.generation += 1;
    this.inflight = void 0;
    const value = clear ? null : this.store.getSnapshot().value;
    this.store.set({ value, status: "idle", error: null });
  }
  /** Invalidate and reload the catalog after a Host-side model input changes. */
  refresh() {
    this.invalidate();
    void this.load().catch(() => {
    });
  }
  /** Clear Host-specific values and load the replacement Host generation. */
  resetGeneration() {
    this.reasoning.clear();
    this.invalidate(true);
    void this.load().catch(() => {
    });
  }
};

// src/client/directory.ts
var import_dsh_client_store2 = require("@deepseek-ai/dsh-client-store");
var ModelDirectory = class {
  /**
   * @param sessions - the session wire face (captured from the plugin's root connection).
   * @param sessionId - the owning session.
   * @param available - whether this session may use Agent-bound model RPCs.
   * @param catalog - Host-generation catalog shared by every Session.
   * @param projected - durable model selection projected from Session history.
   * @param isBlank - whether this Session has no first message yet.
   * @param track - desktop-only callback after a successful user selection.
   */
  constructor(sessions, sessionId, available, catalog, projected, isBlank, track) {
    this.sessions = sessions;
    this.sessionId = sessionId;
    this.available = available;
    this.catalog = catalog;
    this.projected = projected;
    this.isBlank = isBlank;
    this.track = track;
    this.unsubscribeCatalog = catalog.store.subscribe(() => {
      this.syncInputs();
    });
    this.unsubscribeSelection = projected.subscribe(() => {
      this.syncInputs();
    });
    this.syncInputs();
  }
  sessions;
  sessionId;
  available;
  catalog;
  projected;
  isBlank;
  track;
  /** The shared snapshot both entries render from (uSES-safe store). */
  store = (0, import_dsh_client_store2.createSnapshotStore)({
    current: null,
    routable: null,
    groups: [],
    failures: [],
    status: "idle",
    pending: null,
    error: null
  });
  /** Latest selection operation wins; an older response never overwrites a newer one. */
  generation = 0;
  disposed = false;
  unsubscribeCatalog;
  unsubscribeSelection;
  /**
   * Ensure the Host generation's shared available catalog is loaded.
   * @returns the fresh directory value.
   */
  async load() {
    this.assertAvailable();
    await this.catalog.load();
    this.syncInputs();
    return this.store.getSnapshot();
  }
  /**
   * Select the complete provider/model/reasoning selection. The durable
   * projection frame updates the shared current; failures surface on the store
   * and return with the operation so each entry can present its own failure.
   * @param selection - provider, provider-owned model id, and optional adapter-owned effort.
   * @returns the selection outcome, including the original Remote failure.
   */
  async select(selection) {
    this.assertAvailable();
    const previous = this.store.getSnapshot().current;
    const previousEffort = previous?.reasoningEffort ?? (previous === null ? void 0 : this.catalog.reasoningFor(previous)?.defaultEffort);
    const nextEffort = selection.reasoningEffort ?? this.catalog.reasoningFor(selection)?.defaultEffort;
    const generation = ++this.generation;
    this.store.update((s) => {
      s.status = "selecting";
      s.pending = selection;
      s.error = null;
    });
    const result = await this.sessions.selectModel({
      sessionId: this.sessionId,
      provider: selection.provider,
      model: selection.model,
      ...selection.reasoningEffort === void 0 ? {} : { reasoningEffort: selection.reasoningEffort }
    });
    if (this.disposed || generation !== this.generation) {
      return result.ok ? { ok: true, value: void 0 } : result;
    }
    if (!result.ok) {
      this.store.update((s) => {
        s.status = "error";
        s.pending = null;
        s.error = `${result.error.code}: ${result.error.message}`;
      });
      return result;
    }
    if (previous !== null) {
      const from = `${previous.provider}/${previous.model}`;
      const to = `${selection.provider}/${selection.model}`;
      if (from !== to) this.track?.("model_switch", { ...this.isBlank() ? {} : { session_id: this.sessionId }, switch_from: from, switch_to: to });
      if (from === to && previousEffort !== nextEffort) this.track?.("thinking_level_switch", {
        ...this.isBlank() ? {} : { session_id: this.sessionId },
        model_name: to,
        switch_from: previousEffort ?? "default",
        switch_to: nextEffort ?? "default"
      });
    }
    this.store.update((s) => {
      s.status = "ready";
      s.pending = null;
      s.error = null;
    });
    this.syncInputs();
    return { ok: true, value: void 0 };
  }
  /**
   * Invalidate an in-flight selection response from the previous Host generation.
   */
  resetConnected() {
    if (this.disposed) return;
    ++this.generation;
    this.store.update((state) => {
      if (state.status === "selecting") state.status = "idle";
      state.pending = null;
      state.error = null;
    });
    this.syncInputs();
  }
  /** Scope teardown: late settlements lose write access to the store. */
  dispose() {
    this.disposed = true;
    this.unsubscribeSelection();
    this.unsubscribeCatalog();
  }
  assertAvailable() {
    if (!this.available()) {
      throw new Error("model selection is unavailable for addressed subagent sessions");
    }
  }
  syncInputs() {
    if (this.disposed) return;
    const catalog = this.catalog.store.getSnapshot();
    const projected = modelSelectionProjection(this.projected.getSnapshot());
    const intended = projected?.next ?? catalog.value?.default;
    const reasoning = intended === void 0 ? void 0 : this.catalog.reasoningFor(intended);
    const effort = intended?.reasoningEffort ?? reasoning?.defaultEffort;
    const retainedEffort = effort === void 0 ? void 0 : reasoning?.efforts.find((level) => level.id === effort)?.name ?? effort;
    if (catalog.status !== "ready" || catalog.value === null || projected === void 0) {
      this.store.set({
        current: catalog.value === null ? null : this.store.getSnapshot().current,
        ...retainedEffort === void 0 ? {} : { retainedEffort },
        routable: null,
        groups: catalog.value?.groups ?? [],
        failures: catalog.value?.failures ?? [],
        status: catalog.status === "error" ? "error" : "loading",
        pending: this.store.getSnapshot().pending,
        error: catalog.error
      });
      return;
    }
    const selection = projected.next ?? catalog.value.default;
    const routable = catalog.value.groups.some((group) => group.id === selection.provider && group.models.some((model) => model.id === selection.model));
    this.store.set({
      current: selection,
      ...retainedEffort === void 0 ? {} : { retainedEffort },
      routable,
      groups: catalog.value.groups,
      failures: catalog.value.failures,
      status: this.store.getSnapshot().status === "selecting" ? "selecting" : "ready",
      pending: this.store.getSnapshot().pending,
      error: null
    });
  }
};
function modelSelectionProjection(value) {
  return value === void 0 ? void 0 : value;
}

// src/client/service.ts
var ModelDirectoryResolver = class extends import_cordis.Service {
  static inject = ["sessions", "remote", "remote.session"];
  live = { directories: new WeakMapWithValues() };
  catalog;
  /**
   * @param ctx - owning root context (the service registers itself as `models`).
   */
  constructor(ctx) {
    super(ctx, "modelDirectories");
    this.catalog = new ModelCatalogDirectory(ctx);
    void this.catalog.load().catch(() => {
    });
    ctx.on("connection/reset", () => {
      this.catalog.resetGeneration();
      for (const directory of this.live.directories.values) directory.resetConnected();
    });
    ctx.remote.$on("llm/adapters-updated", () => {
      this.catalog.refresh();
    });
    ctx.remote.$on("llm/models-updated", () => {
      this.catalog.refresh();
    });
    ctx.remote.$on("settings/document-updated", () => {
      this.catalog.refresh();
    });
    ctx.remote.$on("credentials/record-updated", () => {
      this.catalog.refresh();
    });
    ctx.remote.$on("credentials/reference-updated", () => {
      this.catalog.refresh();
    });
  }
  /**
   * Resolve the per-session shared directory (lazy; the scope disposer
   * removes and disposes it). Unknown sessions fail loud.
   * @param sessionId - the owning session.
   * @returns the resident directory both entries share.
   */
  directoryFor(sessionId) {
    const { live } = this;
    const sessions = this.ctx.sessions;
    const actx = sessions.scope(sessionId);
    if (actx === void 0) throw new Error(`ui-model-selection: session "${String(sessionId)}" resolved no scope`);
    const binding = sessions.binding(sessionId);
    if (binding === void 0) throw new Error(`ui-model-selection: session "${String(sessionId)}" resolved no binding`);
    const existing = live.directories.get(binding);
    if (existing !== void 0) return existing;
    const directory = new ModelDirectory(
      this.ctx.remote.session,
      sessionId,
      () => sessions.subagentAddress(sessionId) === void 0,
      this.catalog,
      binding.session.projections.faceOf("modelSelection"),
      () => binding.session.getSnapshot().blank,
      (name, attributes) => this.ctx.get("productAnalytics")?.track(name, attributes)
    );
    live.directories.set(binding, directory);
    actx.effect(() => () => {
      directory.dispose();
      live.directories.delete(binding);
    }, "ui-model-selection: session directory");
    return directory;
  }
};

// src/client/ModelSelect.tsx
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var import_react = require("react");
var import_react_dom = require("react-dom");

// build/node_modules/clsx/dist/clsx.mjs
function r(e) {
  var t, f, n = "";
  if ("string" == typeof e || "number" == typeof e) n += e;
  else if ("object" == typeof e) if (Array.isArray(e)) {
    var o = e.length;
    for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
  } else for (f in e) e[f] && (n && (n += " "), n += f);
  return n;
}
function clsx() {
  for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
  return n;
}
var clsx_default = clsx;

// src/client/ModelSelect.tsx
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/styles.css
var styles_default = "/*\n * Model seat + model card (ZCode-style picker: provider top bar, fixed-height\n * scrolling model list, thinking-effort row at the bottom, side columns\n * opening to the left).\n *\n * Class names are static (bundled with the client), so the shell needs no\n * CSS-module hash step; every name is prefixed `msm_`.\n */\n\n.msm_root {\n  position: relative;\n  min-width: 0;\n}\n\n/* Figma 313:14108 ToggleButton: 13/20 regular secondary label, 4px gap,\n   12px caption chevron; 28px chip height matches the sibling Plan /\n   Read-only selects in the same tool row. */\n.msm_trigger {\n  anchor-name: var(--dsh-model-anchor);\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  min-width: 0;\n  /* Preferred width: the composer measures this expanded seat against the\n     space the other controls leave, so the cap must not shrink with the row. */\n  max-width: 360px;\n  flex: 0 0 auto;\n  height: 28px;\n  min-height: 28px;\n  max-height: 28px;\n  box-sizing: border-box;\n  padding: 0 4px 0 8px;\n  border: none;\n  border-radius: var(--dsw-radius-sm);\n  outline: none;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  line-height: 20px;\n  font-weight: 400;\n  cursor: pointer;\n}\n\n@media (hover: hover) {\n  .msm_trigger:hover:not(:disabled) {\n    background: var(--dsw-alias-interactive-bg-hover);\n  }\n}\n\n.msm_trigger:focus-visible:not([data-selection-focus]) {\n  box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));\n}\n\n.msm_trigger:disabled {\n  color: var(--dsw-alias-label-dimmed);\n  cursor: default;\n}\n\n.msm_triggerLabel {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n/* Effort value beside the model name (mock's 'High': same 13/20/400, caption\n   tone). Adaptive priority: the huge shrink factor makes the effort absorb\n   all deficit first — it ellipsizes away to nothing before the model name\n   loses a single pixel, and the chevron stays snug throughout. */\n.msm_triggerEffort {\n  flex-shrink: 1000;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  color: var(--dsw-alias-label-caption);\n}\n\n.msm_triggerIcon {\n  display: var(--dsh-composer-model-icon-display, none);\n  flex: 0 0 auto;\n}\n\n.msm_triggerLabel,\n.msm_triggerEffort {\n  display: var(--dsh-composer-model-text-display, block);\n}\n\n.msm_chevron {\n  flex: 0 0 auto;\n  color: var(--dsw-alias-label-caption);\n  transition: transform 120ms ease;\n}\n\n.msm_chevronOpen {\n  transform: rotate(180deg);\n}\n\n/* The body portal escapes overflow ancestors. CSS anchors keep the card above\n   its trigger; layout viewport bounds do not shrink during pinch zoom. */\n.msm_menu {\n  box-sizing: border-box;\n  position: fixed;\n  position-anchor: var(--dsh-model-anchor);\n  top: max(12px, var(--dsh-frame-overlay-top, 12px));\n  left: 12px;\n  right: anchor(right);\n  bottom: calc(anchor(top) + 8px);\n  align-self: safe end;\n  justify-self: safe end;\n  margin: 0;\n  z-index: 1100;\n  display: flex;\n  flex-direction: column;\n  width: 400px;\n  /* Fixed card height: switching models never resizes the picker. */\n  height: min(404px, calc(100dvh - 96px));\n  max-width: min(400px, calc(100vw - 24px));\n  overflow: hidden;\n  padding: 4px;\n  /* Surface tokens match the Menu primitive card (ui-primitives\n     Menu.module.css) so every dropdown reads as the same material. */\n  border: 0;\n  /* The shared menu material is 70% translucent; an opaque base on the card\n     keeps page content from bleeding through while staying theme-aware. */\n  background: var(--dsw-alias-bg-base);\n  /* A crisp edge so the floating card is clearly a surface of its own. */\n  outline: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent);\n  outline-offset: -1px;\n  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);\n  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);\n  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);\n}\n\n.msm_menuSingle {\n  width: 360px;\n}\n\n/* Top bar: the provider scoping the list. Hovering it opens the provider\n   column to the left; the card itself never moves or resizes. */\n.msm_header {\n  box-sizing: border-box;\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  width: 100%;\n  /* Fixed metrics: switching the UI language swaps CJK/Latin font metrics for\n     the provider name, and the bar must not grow or shrink with them. */\n  flex: 0 0 38px;\n  height: 38px;\n  min-height: 38px;\n  max-height: 38px;\n  box-sizing: border-box;\n  padding: 0 8px;\n  border: none;\n  border-bottom: 1px solid var(--dsw-alias-border-l1);\n  border-radius: var(--dsw-radius-md);\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  line-height: 20px;\n  font-weight: 600;\n  white-space: nowrap;\n  overflow: hidden;\n  text-align: left;\n  cursor: pointer;\n  outline: none;\n}\n\n.msm_header:focus-visible,\n.msm_headerOpen {\n  background: color-mix(in srgb, var(--dsw-alias-interactive-bg-hover) 70%, var(--dsw-alias-border-l1));\n}\n\n@media (hover: hover) {\n  .msm_header:hover {\n    background: color-mix(in srgb, var(--dsw-alias-interactive-bg-hover) 70%, var(--dsw-alias-border-l1));\n  }\n}\n\n.msm_headerLabel {\n  flex: 1 1 auto;\n  min-width: 0;\n  height: 20px;\n  font-size: 13px;\n  line-height: 20px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.msm_headerCount {\n  flex: 0 0 auto;\n  height: 20px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n  line-height: 20px;\n  font-weight: 400;\n  white-space: nowrap;\n}\n\n.msm_headerChevron {\n  flex: 0 0 auto;\n  width: 14px;\n  height: 14px;\n  color: var(--dsw-alias-menu-icon);\n  transition: transform 120ms ease;\n}\n\n.msm_status,\n.msm_empty {\n  padding: 8px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n  line-height: 18px;\n}\n\n.msm_error,\n.msm_warning {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 6px;\n  margin-bottom: 3px;\n  padding: 6px 7px;\n  border-radius: var(--dsw-radius-md);\n  background: var(--dsw-alias-interactive-bg-hover-danger);\n  color: var(--dsw-alias-state-error-primary);\n  font-size: 11px;\n  line-height: 16px;\n}\n\n.msm_warning {\n  background: var(--dsw-alias-bg-module-platform);\n  color: var(--dsw-alias-state-warn-label);\n}\n\n.msm_retry {\n  flex: 0 0 auto;\n  padding: 0;\n  border: none;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n  font-weight: 600;\n  cursor: pointer;\n}\n\n.msm_searchRow {\n  position: relative;\n  flex: 0 0 38px;\n  height: 38px;\n  margin: 6px 4px 4px;\n}\n\n.msm_searchRow .msm_search {\n  display: flex;\n  align-items: center;\n  box-sizing: border-box;\n  height: 34px;\n  padding: 0 8px;\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: var(--dsw-radius-md);\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.msm_searchRow .msm_search:focus-within {\n  border-color: var(--dsw-alias-state-business-primary);\n}\n\n.msm_searchRow .msm_searchWithQuery {\n  padding-right: 34px;\n}\n\n.msm_searchClear {\n  position: absolute;\n  top: 50%;\n  right: 4px;\n  transform: translateY(-50%);\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 24px;\n  height: 24px;\n  padding: 0;\n  border: none;\n  border-radius: 50%;\n  corner-shape: round;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  cursor: pointer;\n}\n\n.msm_searchClear:focus-visible {\n  outline: none;\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n@media (hover: hover) {\n  .msm_searchClear:hover {\n    outline: none;\n    background: var(--dsw-alias-interactive-bg-hover);\n  }\n}\n\n.msm_searchRow .msm_search:focus-within {\n  border-color: transparent;\n}\n\n.msm_searchRow .msm_search input {\n  height: 20px;\n  padding: 0;\n  font-size: 12px;\n  line-height: 20px;\n}\n\n@media (pointer: coarse) {\n  .msm_searchRow .msm_search input {\n    font-size: 16px;\n  }\n}\n\n.msm_searchRow .msm_search input::placeholder {\n  color: var(--dsw-alias-label-caption);\n}\n\n/* Fixed-height model list: switching models never changes the card's size. */\n/* The scrollable middle: takes the fixed card's remaining height. */\n.msm_list {\n  flex: 1 1 auto;\n  min-height: 0;\n  padding: 2px 0;\n  overflow-x: hidden;\n  overflow-y: auto;\n  overscroll-behavior: contain;\n}\n\n.msm_option {\n  box-sizing: border-box;\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  width: auto;\n  min-width: 100%;\n  min-height: 34px;\n  padding: 5px 7px;\n  border: none;\n  border-radius: var(--dsw-radius-md);\n  outline: none;\n  background: transparent;\n  color: inherit;\n  text-align: left;\n  cursor: pointer;\n}\n\n.msm_option:focus-visible,\n.msm_optionActive:not(:disabled) {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.msm_modelOption {\n  max-width: 100%;\n}\n\n@media (hover: hover) {\n  .msm_option:not(.msm_modelOption):hover:not(:disabled) {\n    background: var(--dsw-alias-interactive-bg-hover);\n  }\n}\n\n/* Selection marker is the trailing check, not a fill — matches the Menu\n * primitive's selected treatment. */\n.msm_selected {\n  background: transparent;\n}\n\n.msm_option:disabled {\n  color: var(--dsw-alias-label-dimmed);\n  cursor: default;\n}\n\n.msm_optionCopy {\n  display: flex;\n  flex: 1;\n  flex-direction: column;\n  min-width: 0;\n}\n\n.msm_modelName {\n  overflow: hidden;\n  color: inherit;\n  font-size: 13px;\n  line-height: 18px;\n  font-weight: 400;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n/* Declared input modalities, right-aligned before the selection check. */\n.msm_caps {\n  display: flex;\n  flex: 0 0 auto;\n  align-items: center;\n  gap: 4px;\n  max-width: 50%;\n  overflow: hidden;\n}\n\n.msm_cap {\n  flex: none;\n  padding: 0 6px;\n  border: 1px solid color-mix(in srgb, var(--dsw-alias-label-tertiary) 28%, transparent);\n  border-radius: 999px;\n  background: color-mix(in srgb, var(--dsw-alias-label-tertiary) 10%, transparent);\n  color: var(--dsw-alias-label-secondary);\n  font-size: 10px;\n  line-height: 16px;\n  font-weight: 600;\n  white-space: nowrap;\n}\n\n.msm_badgedName {\n  display: inline-flex;\n  align-items: center;\n  max-width: 100%;\n  gap: 4px;\n  vertical-align: baseline;\n  white-space: nowrap;\n}\n\n.msm_badgedNameText {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.msm_badge {\n  flex: none;\n}\n\n.msm_check {\n  display: grid;\n  place-items: center;\n  flex: 0 0 14px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.msm_check svg {\n  width: 14px;\n  height: 14px;\n}\n\n/* Bottom panel: the thinking-effort slider (ZCode's gradient track). The card\n   height is fixed, so the model list above absorbs the difference. */\n.msm_effortPanel {\n  flex: 0 0 auto;\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  margin-top: 6px;\n  padding: 8px 8px 6px;\n  border-top: 1px solid var(--dsw-alias-border-l1);\n}\n\n.msm_effortHead {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  height: 20px;\n  font-size: 13px;\n  line-height: 20px;\n}\n\n.msm_effortLabel {\n  color: var(--dsw-alias-label-secondary);\n}\n\n.msm_effortValue {\n  color: var(--dsw-alias-label-primary);\n}\n\n.msm_sliderWrap {\n  position: relative;\n  height: 26px;\n}\n\n/* The visible track is ours; the native track stays transparent so the thumb\n   still gets native dragging, keyboard and accessibility. */\n.msm_sliderTrack {\n  position: absolute;\n  top: 3px;\n  left: 0;\n  right: 0;\n  height: 20px;\n  box-sizing: border-box;\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: 999px;\n  overflow: hidden;\n}\n\n.msm_sliderBase {\n  position: absolute;\n  inset: 0;\n  background: linear-gradient(90deg, #22b573 0%, #14a3a3 52%, #2f6fd0 100%);\n}\n\n/* Everything to the right of the thumb reads as the empty side. */\n.msm_sliderRest {\n  position: absolute;\n  top: 0;\n  right: 0;\n  bottom: 0;\n  left: var(--msm-fill, 50%);\n  background: var(--dsw-alias-bg-overlay);\n  box-shadow: inset 1px 0 0 var(--dsw-alias-border-l1);\n}\n\n.msm_sliderTicks {\n  position: absolute;\n  inset: 0;\n  background-repeat: no-repeat;\n  background-size: 100% 100%;\n  pointer-events: none;\n}\n\n.msm_sliderTicksOn {\n  color: rgba(255, 255, 255, 0.75);\n}\n\n.msm_sliderTicksOff {\n  color: color-mix(in srgb, var(--dsw-alias-label-tertiary) 78%, transparent);\n}\n\n.msm_effortSlider {\n  -webkit-appearance: none;\n  appearance: none;\n  position: relative;\n  z-index: 2;\n  width: 100%;\n  height: 26px;\n  margin: 0;\n  background: transparent;\n  cursor: pointer;\n}\n\n.msm_effortSlider::-webkit-slider-runnable-track {\n  height: 20px;\n  background: transparent;\n  border-radius: 999px;\n}\n\n.msm_effortSlider::-moz-range-track {\n  height: 20px;\n  background: transparent;\n  border-radius: 999px;\n}\n\n.msm_effortSlider::-webkit-slider-thumb {\n  -webkit-appearance: none;\n  appearance: none;\n  width: 26px;\n  height: 26px;\n  margin-top: -3px;\n  border: 1px solid rgba(0, 0, 0, 0.06);\n  border-radius: 50%;\n  background: #fff;\n  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);\n}\n\n.msm_effortSlider::-moz-range-thumb {\n  width: 26px;\n  height: 26px;\n  border: 1px solid rgba(0, 0, 0, 0.06);\n  border-radius: 50%;\n  background: #fff;\n  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);\n}\n\n.msm_effortSlider:focus-visible {\n  outline: none;\n}\n\n.msm_effortSlider:focus-visible::-webkit-slider-thumb {\n  box-shadow: 0 0 0 3px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));\n}\n\n.msm_effortNote {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 11px;\n  line-height: 16px;\n}\n\n.msm_effortSlider:disabled {\n  opacity: 0.45;\n  cursor: default;\n}\n\n/* Side column: providers (hover-opened from the top bar) or effort levels\n   (from the bottom row). It floats beside the card, so the card is stable. */\n.msm_flyout {\n  box-sizing: border-box;\n  position: fixed;\n  z-index: 1100;\n  display: flex;\n  flex-direction: column;\n  width: 240px;\n  max-width: min(240px, calc(100vw - 24px));\n  /* Fixed column height (unzoomed page): the list scrolls inside it. */\n  height: min(320px, calc(100dvh - 48px));\n  overflow: hidden;\n  padding: 4px;\n  border: 0;\n  background: var(--dsw-alias-bg-base);\n  outline: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 14%, transparent);\n  outline-offset: -1px;\n  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);\n  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);\n  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);\n}\n\n.msm_flyoutScroll {\n  flex: 1 1 auto;\n  min-height: 0;\n  overflow-x: hidden;\n  overflow-y: auto;\n  overscroll-behavior: contain;\n}\n\n.msm_flyoutFooter {\n  flex: 0 0 auto;\n  margin-top: 4px;\n  padding-top: 4px;\n  border-top: 1px solid var(--dsw-alias-border-l1);\n}\n\n.msm_cell {\n  box-sizing: border-box;\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  width: auto;\n  min-width: 100%;\n  height: 34px;\n  padding: 0 8px;\n  border: none;\n  border-radius: var(--dsw-radius-md);\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  line-height: 20px;\n  cursor: pointer;\n  text-align: left;\n  outline: none;\n}\n\n.msm_cell:focus-visible {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n@media (hover: hover) {\n  .msm_cell:hover {\n    background: var(--dsw-alias-interactive-bg-hover);\n  }\n}\n\n.msm_cellLabel {\n  flex: 1 1 auto;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.msm_cellValue {\n  flex: 0 0 auto;\n  display: grid;\n  place-items: center;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.msm_manageIcon {\n  width: 14px;\n  height: 14px;\n  color: var(--dsw-alias-menu-icon);\n}\n\n/* Mobile: the card sits as a wide sheet; side columns stack above it. */\n@media (max-width: 560px) {\n  .msm_menu {\n    width: calc(100vw - 24px);\n    max-width: 420px;\n  }\n\n  .msm_flyout {\n    width: min(240px, calc(100vw - 24px));\n  }\n}\n";

// src/client/styles.ts
var tagId = "dsh-model-deck/ModelSelect.css";
if (typeof document !== "undefined") {
  const selector = `style[data-plugin-css=${JSON.stringify(tagId)}]`;
  const existing = document.querySelector(selector);
  if (existing !== null) {
    existing.textContent = styles_default;
  } else {
    const tag = document.createElement("style");
    tag.dataset.plugin = "dsh-model-deck";
    tag.dataset.pluginCss = tagId;
    tag.textContent = styles_default;
    document.head.appendChild(tag);
  }
}
var css = {
  root: "msm_root",
  trigger: "msm_trigger",
  triggerLabel: "msm_triggerLabel",
  triggerEffort: "msm_triggerEffort",
  triggerIcon: "msm_triggerIcon",
  chevron: "msm_chevron",
  chevronOpen: "msm_chevronOpen",
  menu: "msm_menu",
  menuSingle: "msm_menuSingle",
  header: "msm_header",
  headerOpen: "msm_headerOpen",
  headerLabel: "msm_headerLabel",
  headerCount: "msm_headerCount",
  headerChevron: "msm_headerChevron",
  status: "msm_status",
  empty: "msm_empty",
  error: "msm_error",
  warning: "msm_warning",
  retry: "msm_retry",
  searchRow: "msm_searchRow",
  search: "msm_search",
  searchWithQuery: "msm_searchWithQuery",
  searchClear: "msm_searchClear",
  list: "msm_list",
  option: "msm_option",
  optionActive: "msm_optionActive",
  modelOption: "msm_modelOption",
  selected: "msm_selected",
  optionCopy: "msm_optionCopy",
  modelName: "msm_modelName",
  caps: "msm_caps",
  cap: "msm_cap",
  badgedName: "msm_badgedName",
  badgedNameText: "msm_badgedNameText",
  badge: "msm_badge",
  check: "msm_check",
  effortPanel: "msm_effortPanel",
  effortHead: "msm_effortHead",
  effortLabel: "msm_effortLabel",
  effortValue: "msm_effortValue",
  effortSlider: "msm_effortSlider",
  effortNote: "msm_effortNote",
  sliderWrap: "msm_sliderWrap",
  sliderTrack: "msm_sliderTrack",
  sliderBase: "msm_sliderBase",
  sliderRest: "msm_sliderRest",
  sliderTicks: "msm_sliderTicks",
  sliderTicksOn: "msm_sliderTicksOn",
  sliderTicksOff: "msm_sliderTicksOff",
  flyout: "msm_flyout",
  flyoutScroll: "msm_flyoutScroll",
  flyoutFooter: "msm_flyoutFooter",
  cell: "msm_cell",
  cellLabel: "msm_cellLabel",
  cellValue: "msm_cellValue",
  manageIcon: "msm_manageIcon"
};

// src/client/provider-order.ts
function orderModelProviders(groups) {
  return groups.toSorted((left, right) => (left.id === "deepseek-account" ? 0 : left.id === "deepseek-official" ? 1 : 2) - (right.id === "deepseek-account" ? 0 : right.id === "deepseek-official" ? 1 : 2));
}

// src/client/ModelSelect.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var HOVER_OPEN_MS = 90;
var HOVER_CLOSE_MS = 200;
var FLYOUT_WIDTH = 240;
var SLIDER_THUMB = 26;
var capabilityCache = null;
var capabilityRequest;
function loadCapabilities() {
  if (capabilityCache !== null) return Promise.resolve(capabilityCache);
  capabilityRequest ??= fetch("/model-deck/capabilities", { credentials: "same-origin" }).then((response) => response.ok ? response.json() : null).then((table) => {
    if (table !== null) capabilityCache = table;
    return table;
  }).catch(() => null).finally(() => {
    capabilityRequest = void 0;
  });
  return capabilityRequest;
}
function ModelSelect({ locked, available, directory, load, select, resolveText, manageModels, t, renderSlot }) {
  const state = (0, import_react.useSyncExternalStore)(
    (fn) => directory.subscribe(fn),
    () => directory.getSnapshot()
  );
  const [open, setOpen] = (0, import_react.useState)(false);
  const [flyout, setFlyout] = (0, import_react.useState)(null);
  const [scopeProviderId, setScopeProviderId] = (0, import_react.useState)(null);
  const [query, setQuery] = (0, import_react.useState)("");
  const [highlightedIndex, setHighlightedIndex] = (0, import_react.useState)(null);
  const [selectionFocus, setSelectionFocus] = (0, import_react.useState)(false);
  const lastActionRef = (0, import_react.useRef)("load");
  const [toast, setToast] = (0, import_react.useState)(null);
  const toastSeq = (0, import_react.useRef)(0);
  const rootRef = (0, import_react.useRef)(null);
  const triggerRef = (0, import_react.useRef)(null);
  const searchRef = (0, import_react.useRef)(null);
  const menuRef = (0, import_react.useRef)(null);
  const flyoutRef = (0, import_react.useRef)(null);
  const listRef = (0, import_react.useRef)(null);
  const itemRefs = (0, import_react.useRef)([]);
  const flyoutItemRefs = (0, import_react.useRef)([]);
  const focusIntent = (0, import_react.useRef)(null);
  const openTimer = (0, import_react.useRef)(void 0);
  const closeTimer = (0, import_react.useRef)(void 0);
  const [flyoutPos, setFlyoutPos] = (0, import_react.useState)(null);
  const [capabilities, setCapabilities] = (0, import_react.useState)(null);
  const id = (0, import_react.useId)();
  const anchorStyle = {
    "--dsh-model-anchor": `--dsh-model-${id.replaceAll(":", "")}`
  };
  const accountProviderName = t("provider.account");
  const groups = (0, import_react.useMemo)(() => orderModelProviders(state.groups).map((group) => ({
    ...group,
    provider: {
      id: group.id,
      name: group.id === "deepseek-account" ? accountProviderName : group.name
    }
  })), [state.groups, accountProviderName]);
  const multiProvider = groups.length > 1;
  const scopedGroup = groups.find((group) => group.id === scopeProviderId) ?? groups.find((group) => group.id === state.current?.provider) ?? groups[0];
  const models = (0, import_react.useMemo)(() => (0, import_dsh_client_ui_primitives2.rankByName)(scopedGroup?.models ?? [], query.trim()), [scopedGroup, query]);
  const currentVisibleIndex = models.findIndex((model) => model.id === state.current?.model && scopedGroup?.id === state.current.provider);
  const activeModelIndex = models.length === 0 ? -1 : Math.min(highlightedIndex ?? Math.max(0, currentVisibleIndex), models.length - 1);
  const currentChoice = state.current === null ? void 0 : groups.flatMap((group) => group.models.map((model) => ({ group, model }))).find((choice) => choice.group.id === state.current?.provider && choice.model.id === state.current?.model);
  const reasoning = currentChoice?.model.reasoning;
  const effectiveEffort = state.current?.reasoningEffort ?? reasoning?.defaultEffort;
  const effortLabel = currentChoice === void 0 ? void 0 : reasoning === void 0 ? state.retainedEffort ?? state.current?.reasoningEffort : effectiveEffort === void 0 ? t("effort.providerDefault") : reasoning.efforts.find((level) => level.id === effectiveEffort)?.name ?? effectiveEffort;
  const effortChoices = (0, import_react.useMemo)(() => reasoning === void 0 ? [] : [
    ...reasoning.defaultEffort === void 0 ? [{ key: "provider-default", effort: void 0, label: t("effort.providerDefault") }] : [],
    ...reasoning.efforts.map((effort) => ({
      key: `effort:${effort.id}`,
      effort: effort.id,
      label: effort.name
    }))
  ], [reasoning, t]);
  const { pending } = state;
  const busy = pending !== null;
  const [draftEffortIndex, setDraftEffortIndex] = (0, import_react.useState)(null);
  const effortStops = effortChoices;
  const adjustableElsewhere = (0, import_react.useMemo)(() => {
    if (state.current === null || reasoning !== void 0) return void 0;
    return groups.find((group) => group.id !== state.current?.provider && group.models.some((model) => model.id === state.current?.model && model.reasoning !== void 0))?.provider.name;
  }, [groups, reasoning, state.current?.provider, state.current?.model]);
  const effortMode = reasoning === void 0 ? "unavailable" : effortChoices.length <= 1 ? "fixed" : "slider";
  const declaredEffortIndex = effortStops.findIndex((choice) => choice.effort === effectiveEffort);
  const defaultEffortIndex = effortStops.findIndex((choice) => choice.effort === reasoning?.defaultEffort);
  const effectiveEffortIndex = declaredEffortIndex >= 0 ? declaredEffortIndex : Math.max(0, defaultEffortIndex);
  const sliderIndex = Math.min(draftEffortIndex ?? effectiveEffortIndex, Math.max(0, effortStops.length - 1));
  const sliderRatio = effortStops.length > 1 ? sliderIndex / (effortStops.length - 1) : 0;
  const sliderPercent = sliderRatio * 100;
  const sliderDots = String(effortStops.length > 1 ? Array.from({ length: effortStops.length }, (_, index) => {
    const ratio = index / (effortStops.length - 1);
    const at = `calc(${SLIDER_THUMB / 2}px + (100% - ${SLIDER_THUMB}px) * ${ratio})`;
    return `radial-gradient(circle at ${at} 50%, currentColor 0 2.5px, transparent 2.7px)`;
  }).join(", ") : "none");
  const sliderFill = `calc(${SLIDER_THUMB / 2}px + (100% - ${SLIDER_THUMB}px) * ${sliderRatio})`;
  const commitEffort = (index) => {
    const stop = effortStops[index];
    if (busy || stop === void 0 || state.current === null) {
      setDraftEffortIndex(null);
      return;
    }
    if (stop.effort === effectiveEffort) {
      setDraftEffortIndex(null);
      return;
    }
    setDraftEffortIndex(index);
    lastActionRef.current = "select";
    void select({
      provider: state.current.provider,
      model: state.current.model,
      ...stop.effort === void 0 ? {} : { reasoningEffort: stop.effort }
    }).then((result) => {
      if (result === void 0 || result.ok) return;
      setDraftEffortIndex(null);
      toastSeq.current += 1;
      setToast({
        seq: toastSeq.current,
        text: result.error.code === "session/writer-held" ? t("error.sessionInUse") : t("error.action", { message: `${result.error.code}: ${result.error.message}` })
      });
    });
  };
  (0, import_react.useEffect)(() => {
    setDraftEffortIndex(null);
  }, [state.current?.provider, state.current?.model]);
  (0, import_react.useEffect)(() => {
    if (draftEffortIndex === null) return;
    const stop = effortStops[draftEffortIndex];
    if (stop !== void 0 && stop.effort === effectiveEffort) setDraftEffortIndex(null);
  }, [draftEffortIndex, effectiveEffort, effortStops]);
  const reload = () => {
    lastActionRef.current = "load";
    load();
  };
  const clearTimers = () => {
    if (openTimer.current !== void 0) {
      window.clearTimeout(openTimer.current);
      openTimer.current = void 0;
    }
    if (closeTimer.current !== void 0) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = void 0;
    }
  };
  const hoverOpen = (next) => {
    clearTimers();
    openTimer.current = window.setTimeout(() => {
      openTimer.current = void 0;
      setFlyout((current) => current === next ? current : next);
    }, HOVER_OPEN_MS);
  };
  const hoverClose = () => {
    clearTimers();
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = void 0;
      setFlyout(null);
    }, HOVER_CLOSE_MS);
  };
  (0, import_react.useEffect)(() => () => {
    clearTimers();
  }, []);
  (0, import_react.useEffect)(() => {
    if (!open || capabilities !== null) return;
    let cancelled = false;
    void loadCapabilities().then((table) => {
      if (!cancelled && table !== null) setCapabilities(table);
    });
    return () => {
      cancelled = true;
    };
  }, [open, capabilities]);
  (0, import_react.useEffect)(() => {
    if (!open) return;
    const closeOutside = (event) => {
      if (rootRef.current?.contains(event.target) === true) return;
      if (menuRef.current?.contains(event.target) === true) return;
      if (flyoutRef.current?.contains(event.target) === true) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
    };
  }, [open]);
  (0, import_react.useLayoutEffect)(() => {
    if (!open || flyout === null) {
      setFlyoutPos(null);
      return;
    }
    const place = () => {
      const menu = menuRef.current?.getBoundingClientRect();
      if (menu === void 0) return;
      const column = flyoutRef.current?.getBoundingClientRect();
      const anchorRow = menuRef.current?.querySelector("[data-model-panel-header]")?.getBoundingClientRect();
      const width = column?.width ?? FLYOUT_WIDTH;
      const height = column?.height ?? 0;
      const gap = 10;
      const margin = 8;
      const left = Math.max(margin, menu.left - width - gap);
      let top = anchorRow?.top ?? menu.top;
      if (height > 0) top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
      const next = { left: Math.round(left), top: Math.round(top) };
      setFlyoutPos((previous) => previous !== null && previous.left === next.left && previous.top === next.top ? previous : next);
    };
    place();
    const observer = typeof ResizeObserver === "undefined" ? void 0 : new ResizeObserver(place);
    if (flyoutRef.current !== null) observer?.observe(flyoutRef.current);
    if (menuRef.current !== null) observer?.observe(menuRef.current);
    window.addEventListener("resize", place);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [open, flyout, scopeProviderId, models]);
  (0, import_react.useEffect)(() => {
    if (!open) return;
    const intent = focusIntent.current;
    focusIntent.current = null;
    if (intent === null) return;
    if (intent === "search") {
      searchRef.current?.focus();
      return;
    }
    if (intent === "header") {
      menuRef.current?.querySelector("[data-model-panel-header]")?.focus();
      return;
    }
    if (intent === "list") {
      if (models.length > 0) itemRefs.current[0]?.focus();
      return;
    }
    const rows = Array.from(flyoutRef.current?.querySelectorAll(
      'button[role="menuitem"]:not([disabled]), button[role="menuitemradio"]:not([disabled])'
    ) ?? []);
    if (intent === "provider-current") {
      const checked = rows.find((row) => row.getAttribute("aria-checked") === "true");
      (checked ?? rows[0])?.focus();
      return;
    }
    rows[0]?.focus();
  }, [open, flyout, scopeProviderId, models]);
  (0, import_react.useEffect)(() => {
    const viewport = listRef.current;
    if (viewport === null) return;
    return (0, import_dsh_client_ui_primitives.observeStickyMenuGroups)(viewport);
  }, [available, open, models]);
  (0, import_react.useLayoutEffect)(() => {
    if (open && activeModelIndex >= 0) {
      itemRefs.current[activeModelIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeModelIndex, models]);
  if (!available) return null;
  const show = () => {
    setSelectionFocus(false);
    triggerRef.current?.focus();
    setQuery("");
    setHighlightedIndex(null);
    setFlyout(null);
    setDraftEffortIndex(null);
    clearTimers();
    const provider = state.current?.provider ?? groups[0]?.id ?? null;
    setScopeProviderId(provider);
    setOpen(true);
    reload();
  };
  const changeQuery = (next) => {
    setQuery(next);
    setHighlightedIndex(0);
  };
  const close = (restoreFocus = false) => {
    setOpen(false);
    setFlyout(null);
    setQuery("");
    clearTimers();
    if (restoreFocus) queueMicrotask(() => {
      triggerRef.current?.focus();
    });
  };
  const closeAfterSelection = () => {
    setSelectionFocus(true);
    close(true);
  };
  const toggleFlyout = (next, intent = null) => {
    clearTimers();
    if (flyout === next && intent === null) {
      setFlyout(null);
      return;
    }
    setFlyout(next);
    if (intent !== null) focusIntent.current = intent;
  };
  const closeFlyout = (returnTo) => {
    setFlyout(null);
    focusIntent.current = returnTo;
  };
  const scopeProvider = (providerId) => {
    setScopeProviderId(providerId);
    setQuery("");
    setHighlightedIndex(0);
    setFlyout(null);
    focusIntent.current = "header";
  };
  const moveFocus = (offset) => {
    const scope = document.activeElement instanceof Element && document.activeElement.closest("[data-model-panel-flyout]") !== null ? flyoutRef : menuRef;
    const items = Array.from(scope?.current?.querySelectorAll(
      'button[role="menuitem"]:not([disabled]), button[role="menuitemradio"]:not([disabled])'
    ) ?? []);
    if (items.length === 0) return;
    const active = items.findIndex((item) => item === document.activeElement);
    const next = active === -1 ? offset > 0 ? 0 : items.length - 1 : (active + offset + items.length) % items.length;
    items[next]?.focus();
  };
  const onRootKeyDown = (event) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape" && open) {
      event.preventDefault();
      if (flyout !== null) closeFlyout("header");
      else close(true);
      return;
    }
    if (!open) return;
    const target = event.target instanceof Element ? event.target : null;
    if (event.key === "ArrowLeft" && !(target instanceof HTMLInputElement)) {
      const header = target?.closest("[data-model-panel-header]");
      if (header !== null && header !== void 0) {
        event.preventDefault();
        toggleFlyout("providers", "provider-current");
        return;
      }
      if (flyout !== null) {
        event.preventDefault();
        closeFlyout("header");
        return;
      }
    }
    if (event.key === "ArrowRight" && flyout !== null && !(target instanceof HTMLInputElement)) {
      event.preventDefault();
      closeFlyout("header");
      return;
    }
    if (target instanceof HTMLInputElement && target.type === "range") return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (target instanceof HTMLInputElement && target === searchRef.current) {
        event.preventDefault();
        if (!busy && models.length > 0) {
          const direction = event.key === "ArrowDown" ? 1 : -1;
          setHighlightedIndex((activeModelIndex + direction + models.length) % models.length);
        }
        return;
      }
      event.preventDefault();
      moveFocus(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Enter" && target instanceof HTMLInputElement && target === searchRef.current) {
      event.preventDefault();
      const highlighted = models[activeModelIndex];
      if (!busy && highlighted !== void 0 && scopedGroup !== void 0) {
        choose({ provider: scopedGroup.id, model: highlighted.id });
      }
      return;
    }
    if (event.key === "Tab") {
      if (event.shiftKey) {
        event.preventDefault();
        if (flyout !== null) closeFlyout("header");
        else close(true);
        return;
      }
      const focused = document.activeElement;
      if (focused instanceof HTMLButtonElement) {
        event.preventDefault();
        focused.click();
        return;
      }
      if (focused !== triggerRef.current) return;
      event.preventDefault();
      if (models.length > 0 && !multiProvider) {
        itemRefs.current[activeModelIndex >= 0 ? activeModelIndex : 0]?.focus();
        return;
      }
      menuRef.current?.querySelector("[data-model-panel-header]")?.focus();
    }
  };
  const onBlur = (event) => {
    if (event.relatedTarget instanceof Node && (rootRef.current?.contains(event.relatedTarget) === true || menuRef.current?.contains(event.relatedTarget) === true || flyoutRef.current?.contains(event.relatedTarget) === true)) return;
    close();
  };
  const settleSelection = (result, closeOnSuccess) => {
    if (result === void 0) return;
    if (result.ok) {
      if (closeOnSuccess && rootRef.current !== null) closeAfterSelection();
      return;
    }
    const { error } = result;
    toastSeq.current += 1;
    setToast({
      seq: toastSeq.current,
      text: error.code === "session/writer-held" ? t("error.sessionInUse") : t("error.action", { message: `${error.code}: ${error.message}` })
    });
  };
  const submit = (selection, closeOnSuccess = false) => {
    lastActionRef.current = "select";
    if (closeOnSuccess) {
      setSelectionFocus(true);
      triggerRef.current?.focus();
    }
    void select(selection).then((result) => settleSelection(result, closeOnSuccess));
  };
  const choose = (selection) => {
    if (state.current?.provider === selection.provider && state.current.model === selection.model) return;
    submit(selection, false);
  };
  const chooseEffort = (effort) => {
    if (state.current === null) return;
    if (effectiveEffort === effort) {
      closeAfterSelection();
      return;
    }
    const selection = {
      provider: state.current.provider,
      model: state.current.model,
      ...effort === void 0 ? {} : { reasoningEffort: effort }
    };
    submit(selection);
  };
  const waiting = currentChoice === void 0 && state.status === "loading";
  const modelLabel = waiting ? t("trigger.loading") : currentChoice?.model.name ?? t("trigger.fallback");
  const triggerLabel = effortLabel === void 0 ? modelLabel : `${modelLabel} · ${effortLabel}`;
  const triggerAria = waiting ? t("trigger.loading") : currentChoice === void 0 ? t("trigger.selectAria") : effortLabel === void 0 ? t("trigger.aria", { model: modelLabel }) : t("trigger.ariaEffort", { model: modelLabel, effort: effortLabel });
  const renderModelLabel = (provider, model, placement, selected) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "data-provider-id": provider.id, "data-model-id": model.id, children: renderSlot("conversation.input.model.label", {
    provider,
    model,
    placement,
    selected
  }, {
    fallback: model.badge === void 0 ? model.name : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: css.badgedName, children: [
      placement === "trigger" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.Tag, { className: css.badge, tone: model.badge.tone, children: resolveText(model.badge.text) }),
        " "
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.badgedNameText, children: model.name }),
      placement === "trigger" ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.Tag, { className: css.badge, tone: model.badge.tone, children: resolveText(model.badge.text) })
      ] })
    ] })
  }) });
  let itemIndex = 0;
  itemRefs.current = [];
  let flyoutIndex = 0;
  flyoutItemRefs.current = [];
  const flyoutItemRef = () => {
    const at = flyoutIndex++;
    return (node) => {
      flyoutItemRefs.current[at] = node;
    };
  };
  const statusBlock = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    state.status === "loading" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.status, children: t("status.loading") }),
    state.error !== null && lastActionRef.current === "load" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.error, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("error.action", { message: state.error }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: css.retry, onClick: reload, children: t("retry") })
    ] }),
    state.failures.map((failure) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.warning, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("warning.groupLoad", { name: failure.id === "deepseek-account" ? t("provider.account") : failure.name, message: failure.message }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: css.retry, onClick: reload, children: t("retry") })
    ] }, failure.id))
  ] });
  const modelRows = models.map((model) => {
    const index = itemIndex++;
    const selected = scopedGroup?.id === state.current?.provider && model.id === state.current?.model;
    const modalities = capabilities?.[scopedGroup?.id ?? ""]?.[model.id] ?? [];
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "button",
      {
        ref: (node) => {
          itemRefs.current[index] = node;
        },
        type: "button",
        role: "menuitemradio",
        "aria-checked": selected,
        id: `${id}-model-${index}`,
        tabIndex: 0,
        onFocus: () => {
          setHighlightedIndex(index);
        },
        "data-highlighted": index === activeModelIndex ? "" : void 0,
        className: clsx_default(
          css.option,
          css.modelOption,
          selected && css.selected,
          index === activeModelIndex && css.optionActive
        ),
        onPointerEnter: () => {
          if (!busy && index !== activeModelIndex) setHighlightedIndex(index);
        },
        title: model.name,
        "aria-disabled": busy || void 0,
        onClick: () => {
          if (busy) return;
          if (scopedGroup !== void 0) choose({ provider: scopedGroup.id, model: model.id });
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.optionCopy, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.modelName, children: scopedGroup === void 0 ? model.name : renderModelLabel(scopedGroup.provider, model, "option", selected) }) }),
          modalities.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.caps, children: (modalities.includes("text") ? ["text"] : []).concat(modalities.includes("image") ? ["image"] : []).map((modality) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.cap, children: t(modality === "image" ? "capability.image" : "capability.text") }, modality)) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.check, children: pending?.provider === scopedGroup?.id && pending.model === model.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.StateDot, { state: "ongoing" }) : selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.IconCheckOutlineRegular, {}) : null })
        ]
      },
      model.id
    );
  });
  const providerRows = groups.map((group) => {
    const current = group.id === state.current?.provider;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "button",
      {
        ref: flyoutItemRef(),
        type: "button",
        role: "menuitemradio",
        "aria-checked": group.id === scopedGroup?.id,
        className: clsx_default(css.option, group.id === scopedGroup?.id && css.optionActive),
        "data-provider-id": group.id,
        "aria-disabled": busy || void 0,
        onClick: () => {
          if (busy) return;
          scopeProvider(group.id);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.optionCopy, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.modelName, children: group.provider.name }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.check, children: current ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.IconCheckOutlineRegular, {}) : null })
        ]
      },
      group.id
    );
  });
  const showHeader = multiProvider;
  const showManageInPanel = !multiProvider && manageModels !== void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      ref: rootRef,
      className: css.root,
      onKeyDown: onRootKeyDown,
      onBlur,
      onMouseDown: (event) => {
        if (event.target instanceof Element && event.target.closest("button") !== null) event.preventDefault();
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "button",
          {
            ref: triggerRef,
            type: "button",
            className: css.trigger,
            style: anchorStyle,
            "aria-label": triggerAria,
            "aria-haspopup": "menu",
            "aria-expanded": open,
            "aria-controls": open ? `${id}-menu` : void 0,
            title: triggerLabel,
            "aria-busy": busy,
            "data-selection-focus": selectionFocus ? "" : void 0,
            onBlur: () => {
              setSelectionFocus(false);
            },
            disabled: locked,
            onClick: () => {
              if (open) {
                close(true);
              } else {
                show();
              }
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.IconDataOutlineRegular, { className: css.triggerIcon, size: 16 }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.triggerLabel, children: currentChoice === void 0 ? modelLabel : renderModelLabel(currentChoice.group.provider, currentChoice.model, "trigger", true) }),
              effortLabel !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.triggerEffort, children: effortLabel }),
              busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.StateDot, { state: "ongoing" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.IconChevronDownOutlineRegular, { className: clsx_default(css.chevron, open && css.chevronOpen) })
            ]
          }
        ),
        open && (0, import_react_dom.createPortal)(
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            import_dsh_client_ui_primitives.MenuSurface,
            {
              ref: menuRef,
              id: `${id}-menu`,
              className: clsx_default(css.menu, !showHeader && css.menuSingle),
              style: anchorStyle,
              role: "group",
              "aria-label": t("menu.aria"),
              "aria-busy": state.status === "loading" || busy,
              children: [
                showHeader && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  "button",
                  {
                    type: "button",
                    role: "menuitem",
                    className: clsx_default(css.header, flyout === "providers" && css.headerOpen),
                    "data-model-panel-header": true,
                    "aria-haspopup": "menu",
                    "aria-expanded": flyout === "providers",
                    onPointerEnter: (event) => {
                      if (event.pointerType !== "mouse") return;
                      if (flyout === "providers") {
                        clearTimers();
                        return;
                      }
                      hoverOpen("providers");
                    },
                    onPointerLeave: (event) => {
                      if (event.pointerType !== "mouse") return;
                      hoverClose();
                    },
                    onClick: () => {
                      if (flyout === "providers") return;
                      toggleFlyout("providers", "provider-current");
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.headerLabel, children: scopedGroup === void 0 ? t("trigger.fallback") : scopedGroup.provider.name }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.headerCount, children: scopedGroup?.models.length ?? 0 }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.IconChevronDownOutlineRegular, { className: clsx_default(css.headerChevron, flyout === "providers" && css.chevronOpen) })
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.searchRow, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    import_dsh_client_ui_primitives2.Input,
                    {
                      ref: searchRef,
                      className: clsx_default(css.search, query !== "" && css.searchWithQuery),
                      type: "text",
                      role: "searchbox",
                      "aria-label": t("search.placeholder"),
                      "aria-controls": `${id}-models`,
                      "aria-activedescendant": activeModelIndex < 0 ? void 0 : `${id}-model-${activeModelIndex}`,
                      placeholder: t("search.placeholder"),
                      value: query,
                      readOnly: busy,
                      onChange: (event) => {
                        changeQuery(event.target.value);
                      }
                    }
                  ),
                  query !== "" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    "button",
                    {
                      type: "button",
                      className: css.searchClear,
                      "aria-label": t("search.clear"),
                      disabled: busy,
                      onClick: () => {
                        changeQuery("");
                        searchRef.current?.focus();
                      },
                      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.IconCloseFillRegular, {})
                    }
                  )
                ] }),
                statusBlock,
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "div",
                  {
                    ref: listRef,
                    id: `${id}-models`,
                    className: clsx_default(css.list, "scrollable"),
                    role: "menu",
                    "aria-label": scopedGroup?.provider.name ?? t("menu.model"),
                    hidden: models.length === 0,
                    children: modelRows
                  }
                ),
                state.status === "ready" && models.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.empty, role: "status", children: t(query.trim() === "" ? "empty.models" : "search.empty") }),
                state.current !== null && (currentChoice !== void 0 || state.status === "ready") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.effortPanel, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.effortHead, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.effortLabel, children: t("menu.effort") }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "span",
                      {
                        className: css.effortValue,
                        title: effortMode === "unavailable" ? t("effort.unsupportedHint") : void 0,
                        children: effortMode === "unavailable" ? effortLabel ?? t("effort.unsupported") : effortStops[sliderIndex]?.label ?? effortLabel
                      }
                    )
                  ] }),
                  effortMode !== "slider" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.effortNote, children: effortMode === "unavailable" ? `${t("effort.unsupportedHint")}${adjustableElsewhere === void 0 ? "" : ` ${t("effort.otherRouteHint", { provider: adjustableElsewhere })}`}` : t("effort.fixedHint") }),
                  effortMode === "slider" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: css.sliderWrap, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                      "div",
                      {
                        className: css.sliderTrack,
                        style: { "--msm-fill": sliderFill },
                        "aria-hidden": "true",
                        children: [
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.sliderBase }),
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.sliderRest }),
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                            "span",
                            {
                              className: clsx_default(css.sliderTicks, css.sliderTicksOn),
                              style: {
                                backgroundImage: sliderDots,
                                clipPath: "inset(0 calc(100% - var(--msm-fill)) 0 0)"
                              }
                            }
                          ),
                          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                            "span",
                            {
                              className: clsx_default(css.sliderTicks, css.sliderTicksOff),
                              style: {
                                backgroundImage: sliderDots,
                                clipPath: "inset(0 0 0 var(--msm-fill))"
                              }
                            }
                          )
                        ]
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "input",
                      {
                        type: "range",
                        className: css.effortSlider,
                        min: 0,
                        max: Math.max(0, effortStops.length - 1),
                        step: 1,
                        value: sliderIndex,
                        disabled: effortStops.length < 2,
                        "aria-label": t("menu.effort"),
                        "aria-valuetext": effortStops[sliderIndex]?.label,
                        onChange: (event) => {
                          if (!busy) setDraftEffortIndex(Number(event.target.value));
                        },
                        onPointerUp: (event) => {
                          commitEffort(Number(event.currentTarget.value));
                        },
                        onTouchEnd: (event) => {
                          commitEffort(Number(event.currentTarget.value));
                        },
                        onKeyUp: (event) => {
                          if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") {
                            commitEffort(Number(event.currentTarget.value));
                          }
                        }
                      }
                    )
                  ] })
                ] }),
                renderSlot("conversation.input.model.options", {
                  locked,
                  dismiss: () => {
                    close();
                    triggerRef.current?.focus();
                  },
                  reportFailure: (message) => {
                    setToast({ seq: ++toastSeq.current, text: message });
                  }
                }),
                showManageInPanel && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  "button",
                  {
                    type: "button",
                    role: "menuitem",
                    className: css.cell,
                    onClick: () => {
                      close();
                      manageModels?.();
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.cellLabel, children: t("menu.manageModels") }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.cellValue, "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.IconSettingsOutlineMedium, { className: css.manageIcon, size: 14 }) })
                    ]
                  }
                )
              ]
            }
          ),
          document.body
        ),
        open && flyout !== null && (0, import_react_dom.createPortal)(
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            import_dsh_client_ui_primitives.MenuSurface,
            {
              ref: flyoutRef,
              id: `${id}-${flyout}`,
              className: css.flyout,
              style: flyoutPos ?? { visibility: "hidden", left: 0, top: 0 },
              role: "menu",
              "aria-label": t("menu.providers"),
              "data-model-panel-flyout": "providers",
              onPointerEnter: (event) => {
                if (event.pointerType !== "mouse") return;
                clearTimers();
              },
              onPointerLeave: (event) => {
                if (event.pointerType !== "mouse") return;
                hoverClose();
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.flyoutScroll, children: providerRows }),
                manageModels !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: css.flyoutFooter, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  "button",
                  {
                    type: "button",
                    role: "menuitem",
                    className: css.cell,
                    onClick: () => {
                      close();
                      manageModels();
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.cellLabel, children: t("menu.manageModels") }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: css.cellValue, "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.IconSettingsOutlineMedium, { className: css.manageIcon, size: 14 }) })
                    ]
                  }
                ) })
              ]
            }
          ),
          document.body
        ),
        toast !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          import_dsh_client_ui_primitives2.Toast,
          {
            text: toast.text,
            icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives2.IconWarningOutlineRegular, {}),
            anchor: rootRef.current?.closest("[data-composer-card]") ?? null,
            onDone: () => {
              setToast(null);
            }
          },
          toast.seq
        )
      ]
    }
  );
}

// src/client/manage.ts
var SETTINGS_LABELS = /* @__PURE__ */ new Set([
  "Settings",
  "设置",
  "設定",
  "Configuración",
  "Paramètres",
  "Einstellungen",
  "Настройки",
  "Configurações"
]);
var MODELS_LABELS = /* @__PURE__ */ new Set([
  "模型",
  "Models",
  "モデル",
  "Modelos",
  "Modèles",
  "Modelle",
  "Модели"
]);
var ACCOUNT_MENU_LABEL = /account menu|账户菜单|アカウントメニュー|menú de cuenta|menu du compte|kontomenü|меню аккаунта|menu da conta/i;
var SETTINGS_DIALOG = '[role="dialog"][data-shortcut-modal="settings"]';
function selectModelsSection() {
  const dialog = document.querySelector(SETTINGS_DIALOG);
  if (dialog === null) return;
  const row = Array.from(dialog.querySelectorAll("nav button")).find((button) => MODELS_LABELS.has((button.textContent ?? "").trim()));
  row?.click();
}
function whenSettingsOpen(retries = 8) {
  if (typeof document === "undefined") return;
  if (document.querySelector(SETTINGS_DIALOG) !== null) {
    selectModelsSection();
    return;
  }
  if (retries <= 0) return;
  window.setTimeout(() => {
    whenSettingsOpen(retries - 1);
  }, 90);
}
function accountMenuTrigger() {
  return Array.from(document.querySelectorAll('button[aria-haspopup="menu"][aria-label]')).find((button) => ACCOUNT_MENU_LABEL.test(button.getAttribute("aria-label") ?? ""));
}
function openModelSettings() {
  if (typeof document === "undefined") return;
  if (document.querySelector(SETTINGS_DIALOG) !== null) {
    selectModelsSection();
    return;
  }
  const trigger = accountMenuTrigger();
  if (trigger === void 0) return;
  trigger.click();
  window.setTimeout(() => {
    const item = Array.from(document.querySelectorAll('[role="menuitem"]')).find((node) => SETTINGS_LABELS.has((node.textContent ?? "").trim()));
    if (item === void 0) {
      document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      return;
    }
    item.click();
    whenSettingsOpen();
  }, 80);
}

// src/client/locales.ts
var zh = {
  "provider.account": "DeepSeek 账号",
  "command.label": "模型",
  "command.description": "选择本会话使用的模型",
  "option.loadError": "目录加载失败：{message}",
  "trigger.fallback": "请选择模型",
  "trigger.loading": "正在加载模型…",
  "trigger.selectAria": "请选择模型",
  "trigger.aria": "选择模型，当前 {model}",
  "trigger.ariaEffort": "选择模型，当前 {model}，推理等级 {effort}",
  "menu.aria": "模型与推理等级",
  "menu.model": "模型",
  "menu.effort": "思考强度",
  "menu.manageModels": "管理模型",
  "menu.providers": "供应商",
  "capability.text": "文本",
  "capability.image": "视觉",
  "effort.providerDefault": "Default",
  "effort.unsupported": "供应商默认",
  "effort.unsupportedHint": "该供应商未声明思考强度档位，按供应商默认设置运行。",
  "effort.otherRouteHint": "同一模型在「{provider}」下可调。",
  "effort.fixedHint": "该模型只提供一个思考档位。",
  "status.loading": "正在刷新模型列表…",
  "error.action": "模型操作失败：{message}",
  "error.sessionInUse": "当前会话已被占用，可能是其他正在运行的 DSH 导致的（如其他 dsh web、桌面端），请退出其他正在运行的 DSH 后重试。",
  "action.reload": "重新加载",
  "warning.groupLoad": "{name} 加载失败：{message}",
  "search.placeholder": "搜索模型…",
  "search.clear": "清除搜索",
  "search.empty": "没有匹配的模型。",
  "empty.models": "暂无可用模型",
  "empty.efforts": "当前模型未提供推理等级。"
};
var en = {
  "provider.account": "DeepSeek Account",
  "command.label": "Model",
  "command.description": "Select the model for this conversation",
  "option.loadError": "Catalog failed to load: {message}",
  "trigger.fallback": "Select model",
  "trigger.loading": "Loading models…",
  "trigger.selectAria": "Select model",
  "trigger.aria": "Select model, current {model}",
  "trigger.ariaEffort": "Select model, current {model}, reasoning effort {effort}",
  "menu.aria": "Model and reasoning effort",
  "menu.model": "Model",
  "menu.effort": "Effort",
  "menu.manageModels": "Manage models",
  "menu.providers": "Providers",
  "capability.text": "Text",
  "capability.image": "Vision",
  "effort.providerDefault": "Default",
  "effort.unsupported": "Provider default",
  "effort.unsupportedHint": "This provider declares no reasoning levels; the model runs on the provider default.",
  "effort.otherRouteHint": "The same model is adjustable under “{provider}”.",
  "effort.fixedHint": "This model offers a single reasoning level.",
  "status.loading": "Refreshing model list…",
  "error.action": "Model operation failed: {message}",
  "error.sessionInUse": "This session is already in use, possibly by another running DSH instance (such as dsh web or the desktop app). Quit other running DSH instances and try again.",
  "action.reload": "Reload",
  "warning.groupLoad": "{name} failed to load: {message}",
  "search.placeholder": "Search models…",
  "search.clear": "Clear search",
  "search.empty": "No matching models.",
  "empty.models": "No models available.",
  "empty.efforts": "This model provides no reasoning effort levels."
};
var ja = {
  "provider.account": "DeepSeek アカウント",
  "command.label": "モデル",
  "command.description": "この会話で使用するモデルを選択",
  "option.loadError": "カタログの読み込みに失敗しました: {message}",
  "trigger.fallback": "モデルを選択",
  "trigger.loading": "モデルを読み込み中…",
  "trigger.selectAria": "モデルを選択",
  "trigger.aria": "モデルを選択、現在 {model}",
  "trigger.ariaEffort": "モデルを選択、現在 {model}、推論強度 {effort}",
  "menu.aria": "モデルと推論強度",
  "menu.model": "モデル",
  "menu.effort": "強度",
  "menu.manageModels": "モデルを管理",
  "menu.providers": "プロバイダー",
  "capability.text": "テキスト",
  "capability.image": "ビジョン",
  "effort.providerDefault": "デフォルト",
  "effort.unsupported": "プロバイダー既定",
  "effort.unsupportedHint": "このプロバイダーは推論強度の段階を宣言していません。プロバイダーの既定設定で動作します。",
  "effort.otherRouteHint": "同じモデルは「{provider}」では調整できます。",
  "effort.fixedHint": "このモデルは推論強度の段階を 1 つだけ提供します。",
  "status.loading": "モデル一覧を更新中…",
  "error.action": "モデル操作に失敗しました: {message}",
  "error.sessionInUse": "このセッションは既に使用中です。別の DSH インスタンス（dsh web やデスクトップアプリなど）が実行中の可能性があります。他の DSH インスタンスを終了してから再試行してください。",
  "action.reload": "再読み込み",
  "warning.groupLoad": "{name} の読み込みに失敗しました: {message}",
  "search.placeholder": "モデルを検索…",
  "search.clear": "検索をクリア",
  "search.empty": "一致するモデルがありません。",
  "empty.models": "利用可能なモデルがありません。",
  "empty.efforts": "このモデルには推論強度の設定がありません。"
};
var es = {
  "provider.account": "Cuenta DeepSeek",
  "command.label": "modelo",
  "command.description": "Selecciona el modelo para esta conversación",
  "option.loadError": "No se pudo cargar el catálogo: {message}",
  "trigger.fallback": "Seleccionar modelo",
  "trigger.loading": "Cargando modelos…",
  "trigger.selectAria": "Seleccionar modelo",
  "trigger.aria": "Seleccionar modelo, actual {model}",
  "trigger.ariaEffort": "Seleccionar modelo, {model} actual, esfuerzo de razonamiento {effort}",
  "menu.aria": "Esfuerzo de modelo y razonamiento.",
  "menu.model": "modelo",
  "menu.effort": "Esfuerzo",
  "menu.manageModels": "Gestionar modelos",
  "menu.providers": "Proveedores",
  "capability.text": "Texto",
  "capability.image": "Visión",
  "effort.providerDefault": "Predeterminado",
  "effort.unsupported": "Predeterminado del proveedor",
  "effort.unsupportedHint": "Este proveedor no declara niveles de razonamiento; el modelo usa el valor predeterminado del proveedor.",
  "effort.otherRouteHint": "El mismo modelo es ajustable en «{provider}».",
  "effort.fixedHint": "Este modelo ofrece un único nivel de razonamiento.",
  "status.loading": "Lista de modelos refrescante...",
  "error.action": "Error en la operación del modelo: {message}",
  "error.sessionInUse": "Esta sesión ya está en uso, posiblemente por otra instancia de DSH en ejecución (como la web dsh o la aplicación de escritorio). Salga de otras instancias de DSH en ejecución y vuelva a intentarlo.",
  "action.reload": "recargar",
  "warning.groupLoad": "{name} no pudo cargar: {message}",
  "search.placeholder": "Buscar modelos…",
  "search.clear": "Borrar búsqueda",
  "search.empty": "No hay modelos coincidentes.",
  "empty.models": "No hay modelos disponibles.",
  "empty.efforts": "Este modelo no proporciona niveles de esfuerzo de razonamiento."
};
var fr = {
  "provider.account": "Compte DeepSeek",
  "command.label": "Modèle",
  "command.description": "Sélectionnez le modèle pour cette conversation",
  "option.loadError": "Échec du chargement du catalogue : {message}",
  "trigger.fallback": "Sélectionnez le modèle",
  "trigger.loading": "Chargement des modèles…",
  "trigger.selectAria": "Sélectionnez le modèle",
  "trigger.aria": "Sélectionnez le modèle, {model} actuel",
  "trigger.ariaEffort": "Sélectionnez le modèle, {model} actuel, effort de raisonnement {effort}",
  "menu.aria": "Effort de modélisation et de raisonnement",
  "menu.model": "Modèle",
  "menu.effort": "Effort",
  "menu.manageModels": "Gérer les modèles",
  "menu.providers": "Fournisseurs",
  "capability.text": "Texte",
  "capability.image": "Vision",
  "effort.providerDefault": "Par défaut",
  "effort.unsupported": "Par défaut du fournisseur",
  "effort.unsupportedHint": "Ce fournisseur ne déclare aucun niveau d'effort de raisonnement ; le modèle utilise le réglage par défaut du fournisseur.",
  "effort.otherRouteHint": "Le même modèle est réglable sous « {provider} ».",
  "effort.fixedHint": "Ce modèle ne propose qu’un seul niveau de raisonnement.",
  "status.loading": "Liste des modèles actualisée…",
  "error.action": "Échec de l'opération du modèle : {message}",
  "error.sessionInUse": "Cette session est déjà utilisée, éventuellement par une autre instance DSH en cours d'exécution (telle que le Web dsh ou l'application de bureau). Quittez les autres instances DSH en cours d'exécution et réessayez.",
  "action.reload": "Recharger",
  "warning.groupLoad": "Échec du chargement de {name} : {message}",
  "search.placeholder": "Rechercher des modèles…",
  "search.clear": "Effacer la recherche",
  "search.empty": "Aucun modèle correspondant.",
  "empty.models": "Aucun modèle disponible.",
  "empty.efforts": "Ce modèle ne fournit aucun niveau d’effort de raisonnement."
};
var de = {
  "provider.account": "DeepSeek-Konto",
  "command.label": "Modell",
  "command.description": "Wählen Sie das Modell für dieses Gespräch aus",
  "option.loadError": "Katalog konnte nicht geladen werden: {message}",
  "trigger.fallback": "Modell auswählen",
  "trigger.loading": "Modelle werden geladen…",
  "trigger.selectAria": "Modell auswählen",
  "trigger.aria": "Modell auswählen, aktuell {model}",
  "trigger.ariaEffort": "Modell auswählen, aktuell {model}, Argumentationsaufwand {effort}",
  "menu.aria": "Modell- und Argumentationsaufwand",
  "menu.model": "Modell",
  "menu.effort": "Aufwand",
  "menu.manageModels": "Modelle verwalten",
  "menu.providers": "Anbieter",
  "capability.text": "Text",
  "capability.image": "Vision",
  "effort.providerDefault": "Standard",
  "effort.unsupported": "Anbieter-Standard",
  "effort.unsupportedHint": "Dieser Anbieter deklariert keine Argumentationsstufen; das Modell läuft mit der Anbieter-Standardeinstellung.",
  "effort.otherRouteHint": "Dasselbe Modell ist unter „{provider}“ einstellbar.",
  "effort.fixedHint": "Dieses Modell bietet nur eine Argumentationsstufe.",
  "status.loading": "Erfrischende Modellliste…",
  "error.action": "Modellvorgang fehlgeschlagen: {message}",
  "error.sessionInUse": "Diese Sitzung wird bereits verwendet, möglicherweise von einer anderen laufenden DSH-Instanz (z. B. dsh Web oder der Desktop-App). Beenden Sie andere laufende DSH-Instanzen und versuchen Sie es erneut.",
  "action.reload": "Neu laden",
  "warning.groupLoad": "{name} konnte nicht geladen werden: {message}",
  "search.placeholder": "Modelle suchen…",
  "search.clear": "Suche löschen",
  "search.empty": "Keine passenden Modelle.",
  "empty.models": "Keine Modelle verfügbar.",
  "empty.efforts": "Dieses Modell liefert keine Argumentationsaufwandsstufen."
};
var ru = {
  "provider.account": "DeepSeek Аккаунт",
  "command.label": "Модель",
  "command.description": "Выберите модель для этого разговора",
  "option.loadError": "Не удалось загрузить каталог: {message}.",
  "trigger.fallback": "Выберите модель",
  "trigger.loading": "Загрузка моделей…",
  "trigger.selectAria": "Выберите модель",
  "trigger.aria": "Выберите модель, текущую {model}",
  "trigger.ariaEffort": "Выберите модель, текущую версию {model}, аргументацию {effort}",
  "menu.aria": "Модель и рассуждения",
  "menu.model": "Модель",
  "menu.effort": "Усилие",
  "menu.manageModels": "Управление моделями",
  "menu.providers": "Провайдеры",
  "capability.text": "Текст",
  "capability.image": "Зрение",
  "effort.providerDefault": "По умолчанию",
  "effort.unsupported": "По умолчанию у провайдера",
  "effort.unsupportedHint": "Этот провайдер не объявляет уровни рассуждений; модель работает со значением провайдера по умолчанию.",
  "effort.otherRouteHint": "Та же модель настраивается у «{provider}».",
  "effort.fixedHint": "Эта модель предлагает только один уровень рассуждений.",
  "status.loading": "Обновление списка моделей…",
  "error.action": "Не удалось выполнить операцию модели: {message}.",
  "error.sessionInUse": "Этот сеанс уже используется, возможно, другим работающим экземпляром DSH (например, веб-сайтом dsh или настольным приложением). Закройте другие работающие экземпляры DSH и повторите попытку.",
  "action.reload": "Перезагрузить",
  "warning.groupLoad": "{name} не удалось загрузить: {message}",
  "search.placeholder": "Поиск моделей…",
  "search.clear": "Очистить поиск",
  "search.empty": "Нет подходящих моделей.",
  "empty.models": "Нет доступных моделей.",
  "empty.efforts": "Эта модель не обеспечивает обоснования уровней усилий."
};
var pt = {
  "provider.account": "DeepSeek Conta",
  "command.label": "Modelo",
  "command.description": "Selecione o modelo para esta conversa",
  "option.loadError": "Falha ao carregar o catálogo: {message}",
  "trigger.fallback": "Selecione o modelo",
  "trigger.loading": "Carregando modelos…",
  "trigger.selectAria": "Selecione o modelo",
  "trigger.aria": "Selecione o modelo, atual {model}",
  "trigger.ariaEffort": "Selecione modelo, atual {model}, esforço de raciocínio {effort}",
  "menu.aria": "Modelo e esforço de raciocínio",
  "menu.model": "Modelo",
  "menu.effort": "Esforço",
  "menu.manageModels": "Gerenciar modelos",
  "menu.providers": "Provedores",
  "capability.text": "Texto",
  "capability.image": "Visão",
  "effort.providerDefault": "Padrão",
  "effort.unsupported": "Padrão do provedor",
  "effort.unsupportedHint": "Este provedor não declara níveis de raciocínio; o modelo usa o padrão do provedor.",
  "effort.otherRouteHint": "O mesmo modelo é ajustável em “{provider}”.",
  "effort.fixedHint": "Este modelo oferece apenas um nível de raciocínio.",
  "status.loading": "Atualizando lista de modelos…",
  "error.action": "Falha na operação do modelo: {message}",
  "error.sessionInUse": "Esta sessão já está em uso, possivelmente por outra instância DSH em execução (como dsh web ou aplicativo de desktop). Saia de outras instâncias DSH em execução e tente novamente.",
  "action.reload": "Recarregar",
  "warning.groupLoad": "{name} falhou ao carregar: {message}",
  "search.placeholder": "Pesquisar modelos…",
  "search.clear": "Limpar pesquisa",
  "search.empty": "Não há modelos correspondentes.",
  "empty.models": "Nenhum modelo disponível.",
  "empty.efforts": "Este modelo não fornece níveis de esforço de raciocínio."
};

// src/client/index.ts
function rowId(providerId, modelId) {
  return `${providerId}/${modelId}`;
}
function optionsOf(directory, t) {
  const rows = [];
  for (const group of orderModelProviders(directory.groups)) {
    const name = group.id === "deepseek-account" ? t("provider.account") : group.name;
    for (const model of group.models) {
      rows.push({
        id: rowId(group.id, model.id),
        label: model.name,
        group: { name: group.id, label: name },
        ...directory.current !== null && directory.current.provider === group.id && directory.current.model === model.id ? { active: true } : {}
      });
    }
  }
  for (const failure of directory.failures) {
    rows.push({
      id: `failure/${failure.id}`,
      label: failure.id === "deepseek-account" ? t("provider.account") : failure.name,
      detail: t("option.loadError", { message: failure.message })
    });
  }
  return rows;
}
function selectionOf(state, id) {
  for (const group of state.groups) {
    for (const model of group.models) {
      if (rowId(group.id, model.id) !== id) continue;
      const sameRoute = state.current?.provider === group.id && state.current.model === model.id;
      const reasoningEffort = sameRoute ? state.current?.reasoningEffort ?? model.reasoning?.defaultEffort : model.reasoning?.defaultEffort;
      return {
        provider: group.id,
        model: model.id,
        ...reasoningEffort === void 0 ? {} : { reasoningEffort }
      };
    }
  }
  return void 0;
}
var NS = "model";
var inject = ["commandUi", "locale", "sessions", "slots", "remote", "remote.session"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), "ui-model-selection: dictionaries");
  const t = ctx.locale.bind(NS);
  ctx.plugin(ModelDirectoryResolver);
  ctx.inject(["commandUi", "modelDirectories"], (scope) => {
    const command = scope.get("commandUi");
    const models = scope.modelDirectories;
    const sessions = scope.sessions;
    scope.effect(() => command.register({
      name: "model",
      label: () => t("command.label"),
      description: () => t("command.description"),
      icon: import_dsh_client_ui_primitives3.IconDataOutlineRegular,
      available: (session) => sessions.subagentAddress(session.sessionId) === void 0,
      ui: {
        kind: "popupSelect",
        searchMode: "fuzzy-label",
        searchLabels: () => ({
          placeholder: t("search.placeholder"),
          empty: t("empty.models"),
          noResults: t("search.empty")
        }),
        options: async (session) => {
          if (sessions.subagentAddress(session.sessionId) !== void 0) {
            throw new Error("model selection is unavailable for addressed subagent sessions");
          }
          return optionsOf(await models.directoryFor(session.sessionId).load(), t);
        },
        onSelect: async (option, session) => {
          if (sessions.subagentAddress(session.sessionId) !== void 0) {
            throw new Error("model selection is unavailable for addressed subagent sessions");
          }
          const directory = models.directoryFor(session.sessionId);
          const selection = selectionOf(directory.store.getSnapshot(), option.id);
          if (selection === void 0) {
            throw new Error("this provider's catalog failed to load — pick a model from a loaded group");
          }
          const result = await directory.select(selection);
          if (!result.ok) {
            if (result.error.code === "session/writer-held") throw new Error(t("error.sessionInUse"));
            throw result.error;
          }
        }
      }
    }), "ui-model-selection: /model contribution");
  });
  ctx.inject(["slots", "modelDirectories"], (scope) => {
    const models = scope.modelDirectories;
    const sessions = scope.sessions;
    scope.slots.inject("conversation.input.model", () => scope.slots.register({
      name: "conversation.input.model",
      locale: NS,
      children: {
        "conversation.input.model.label": { kind: "single", scope: "session", inline: true },
        "conversation.input.model.options": { kind: "list", scope: "session" }
      },
      inject: (sessionId) => {
        const directory = models.directoryFor(sessionId);
        const available = sessions.subagentAddress(sessionId) === void 0;
        return {
          available,
          directory: directory.store,
          load: () => {
            if (available) directory.load().catch(() => {
            });
          },
          resolveText: (text) => ctx.locale.resolveText(text),
          select: (selection) => available ? directory.select(selection) : Promise.resolve(void 0),
          manageModels: openModelSettings
        };
      }
    }, ModelSelect));
  });
}

		return module.exports;
	}
});
