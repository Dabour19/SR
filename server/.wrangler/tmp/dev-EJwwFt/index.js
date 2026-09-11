var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-KQBn67/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/room.ts
var DungeonRoom = class {
  state;
  constructor(state, _env) {
    this.state = state;
  }
  players = /* @__PURE__ */ new Map();
  boss = null;
  kills = 0;
  lastPosBroadcast = 0;
  killsTimer = null;
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/ws")
      return new Response("not found", { status: 404 });
    const pair = new WebSocketPair();
    const clientId = url.searchParams.get("id") || crypto.randomUUID();
    const name = url.searchParams.get("name") || "\u0628\u0637\u0644";
    let theme = {};
    try {
      theme = JSON.parse(url.searchParams.get("theme") || "{}");
    } catch {
    }
    this.state.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ clientId });
    this.players.set(clientId, { id: clientId, name, theme, x: 0, y: 0, hp: 1, maxHp: 1 });
    this.broadcast({ t: "join", id: clientId, name });
    pair[1].send(JSON.stringify({
      t: "s",
      you: clientId,
      players: [...this.players.values()],
      boss: this.boss,
      kills: this.kills
    }));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  async webSocketMessage(ws, message) {
    let msg;
    try {
      msg = typeof message === "string" ? JSON.parse(message) : JSON.parse(new TextDecoder().decode(message));
    } catch {
      return;
    }
    const id = ws.serializeAttachment()?.clientId;
    if (!id)
      return;
    const p = this.players.get(id);
    switch (msg.t) {
      case "p": {
        if (!p)
          break;
        if (typeof msg.x === "number")
          p.x = msg.x;
        if (typeof msg.y === "number")
          p.y = msg.y;
        if (typeof msg.hp === "number")
          p.hp = msg.hp;
        if (typeof msg.maxHp === "number")
          p.maxHp = msg.maxHp;
        const now = Date.now();
        if (now - this.lastPosBroadcast >= 80) {
          this.lastPosBroadcast = now;
          this.broadcastExcept(id, { t: "p", id, x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp });
        }
        break;
      }
      case "bs": {
        if (!this.boss && typeof msg.hp === "number") {
          this.boss = { hp: msg.hp, maxHp: msg.hp };
          this.broadcast({ t: "bs", hp: msg.hp });
        }
        break;
      }
      case "b": {
        if (this.boss) {
          this.boss.hp = Math.max(0, this.boss.hp - (msg.dmg || 0));
          this.broadcast({ t: "b", hp: this.boss.hp });
          if (this.boss.hp <= 0) {
            this.broadcast({ t: "k", boss: true });
            this.boss = null;
          }
        }
        break;
      }
      case "k": {
        this.kills += 1;
        if (!this.killsTimer) {
          this.killsTimer = setTimeout(() => {
            this.killsTimer = null;
            this.broadcast({ t: "kc", kills: this.kills });
          }, 400);
        }
        break;
      }
    }
  }
  async webSocketClose(ws) {
    const id = ws.serializeAttachment()?.clientId;
    if (id) {
      this.players.delete(id);
      this.broadcast({ t: "leave", id });
    }
  }
  broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
      }
    }
  }
  broadcastExcept(exceptId, msg) {
    const data = JSON.stringify(msg);
    for (const ws of this.state.getWebSockets()) {
      try {
        const att = ws.serializeAttachment()?.clientId;
        if (att !== exceptId)
          ws.send(data);
      } catch {
      }
    }
  }
};
__name(DungeonRoom, "DungeonRoom");

// src/index.ts
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response("ok", { headers: { "access-control-allow-origin": "*" } });
    }
    const roomCode = (url.searchParams.get("room") || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{4,10}$/.test(roomCode)) {
      return new Response("bad room", { status: 400 });
    }
    const upgradeHeader = request.headers.get("Upgrade") || "";
    if (upgradeHeader.toLowerCase() !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const id = env.DUNGEON_ROOMS.idFromName(roomCode);
    const stub = env.DUNGEON_ROOMS.get(id);
    return stub.fetch(request);
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-KQBn67/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-KQBn67/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  DungeonRoom,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
