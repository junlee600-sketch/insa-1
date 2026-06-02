// server.ts
import express from "express";
import path from "path";
import admin from "firebase-admin";
import cors from "cors";

// node_modules/helmet/index.mjs
var dangerouslyDisableDefaultSrc = /* @__PURE__ */ Symbol("dangerouslyDisableDefaultSrc");
var SHOULD_BE_QUOTED = /* @__PURE__ */ new Set(["none", "self", "strict-dynamic", "report-sample", "inline-speculation-rules", "unsafe-inline", "unsafe-eval", "unsafe-hashes", "wasm-unsafe-eval"]);
var getDefaultDirectives = () => ({
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "font-src": ["'self'", "https:", "data:"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'self'"],
  "img-src": ["'self'", "data:"],
  "object-src": ["'none'"],
  "script-src": ["'self'"],
  "script-src-attr": ["'none'"],
  "style-src": ["'self'", "https:", "'unsafe-inline'"],
  "upgrade-insecure-requests": []
});
var dashify = (str) => str.replace(/[A-Z]/g, (capitalLetter) => "-" + capitalLetter.toLowerCase());
var assertDirectiveValueIsValid = (directiveName, directiveValue) => {
  if (/;|,/.test(directiveValue)) {
    throw new Error(`Content-Security-Policy received an invalid directive value for ${JSON.stringify(directiveName)}`);
  }
};
var assertDirectiveValueEntryIsValid = (directiveName, directiveValueEntry) => {
  if (SHOULD_BE_QUOTED.has(directiveValueEntry) || directiveValueEntry.startsWith("nonce-") || directiveValueEntry.startsWith("sha256-") || directiveValueEntry.startsWith("sha384-") || directiveValueEntry.startsWith("sha512-")) {
    throw new Error(`Content-Security-Policy received an invalid directive value for ${JSON.stringify(directiveName)}. ${JSON.stringify(directiveValueEntry)} should be quoted`);
  }
};
function normalizeDirectives(options) {
  const defaultDirectives = getDefaultDirectives();
  const { useDefaults = true, directives: rawDirectives = defaultDirectives } = options;
  const result = /* @__PURE__ */ new Map();
  const directiveNamesSeen = /* @__PURE__ */ new Set();
  const directivesExplicitlyDisabled = /* @__PURE__ */ new Set();
  for (const rawDirectiveName in rawDirectives) {
    if (!Object.hasOwn(rawDirectives, rawDirectiveName)) {
      continue;
    }
    if (rawDirectiveName.length === 0 || /[^a-zA-Z0-9-]/.test(rawDirectiveName)) {
      throw new Error(`Content-Security-Policy received an invalid directive name ${JSON.stringify(rawDirectiveName)}`);
    }
    const directiveName = dashify(rawDirectiveName);
    if (directiveNamesSeen.has(directiveName)) {
      throw new Error(`Content-Security-Policy received a duplicate directive ${JSON.stringify(directiveName)}`);
    }
    directiveNamesSeen.add(directiveName);
    const rawDirectiveValue = rawDirectives[rawDirectiveName];
    let directiveValue;
    if (rawDirectiveValue === null) {
      if (directiveName === "default-src") {
        throw new Error("Content-Security-Policy needs a default-src but it was set to `null`. If you really want to disable it, set it to `contentSecurityPolicy.dangerouslyDisableDefaultSrc`.");
      }
      directivesExplicitlyDisabled.add(directiveName);
      continue;
    } else if (typeof rawDirectiveValue === "string") {
      directiveValue = [rawDirectiveValue];
    } else if (!rawDirectiveValue) {
      throw new Error(`Content-Security-Policy received an invalid directive value for ${JSON.stringify(directiveName)}`);
    } else if (rawDirectiveValue === dangerouslyDisableDefaultSrc) {
      if (directiveName === "default-src") {
        directivesExplicitlyDisabled.add("default-src");
        continue;
      } else {
        throw new Error(`Content-Security-Policy: tried to disable ${JSON.stringify(directiveName)} as if it were default-src; simply omit the key`);
      }
    } else {
      directiveValue = rawDirectiveValue;
    }
    for (const element of directiveValue) {
      if (typeof element !== "string") continue;
      assertDirectiveValueIsValid(directiveName, element);
      assertDirectiveValueEntryIsValid(directiveName, element);
    }
    result.set(directiveName, directiveValue);
  }
  if (useDefaults) {
    Object.entries(defaultDirectives).forEach(([defaultDirectiveName, defaultDirectiveValue]) => {
      if (!result.has(defaultDirectiveName) && !directivesExplicitlyDisabled.has(defaultDirectiveName)) {
        result.set(defaultDirectiveName, defaultDirectiveValue);
      }
    });
  }
  if (!result.size) {
    throw new Error("Content-Security-Policy has no directives. Either set some or disable the header");
  }
  if (!result.has("default-src") && !directivesExplicitlyDisabled.has("default-src")) {
    throw new Error("Content-Security-Policy needs a default-src but none was provided. If you really want to disable it, set it to `contentSecurityPolicy.dangerouslyDisableDefaultSrc`.");
  }
  return result;
}
function getHeaderValue(req, res, normalizedDirectives) {
  const result = [];
  for (const [directiveName, rawDirectiveValue] of normalizedDirectives) {
    let directiveValue = "";
    for (const element of rawDirectiveValue) {
      if (typeof element === "function") {
        const newElement = element(req, res);
        assertDirectiveValueEntryIsValid(directiveName, newElement);
        directiveValue += " " + newElement;
      } else {
        directiveValue += " " + element;
      }
    }
    if (directiveValue) {
      assertDirectiveValueIsValid(directiveName, directiveValue);
      result.push(`${directiveName}${directiveValue}`);
    } else {
      result.push(directiveName);
    }
  }
  return result.join(";");
}
var contentSecurityPolicy = function contentSecurityPolicy2(options = {}) {
  const headerName = options.reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
  const normalizedDirectives = normalizeDirectives(options);
  return function contentSecurityPolicyMiddleware(req, res, next) {
    const result = getHeaderValue(req, res, normalizedDirectives);
    if (result instanceof Error) {
      next(result);
    } else {
      res.setHeader(headerName, result);
      next();
    }
  };
};
contentSecurityPolicy.getDefaultDirectives = getDefaultDirectives;
contentSecurityPolicy.dangerouslyDisableDefaultSrc = dangerouslyDisableDefaultSrc;
var ALLOWED_POLICIES$2 = /* @__PURE__ */ new Set(["require-corp", "credentialless", "unsafe-none"]);
function getHeaderValueFromOptions$6({ policy = "require-corp" }) {
  if (ALLOWED_POLICIES$2.has(policy)) {
    return policy;
  } else {
    throw new Error(`Cross-Origin-Embedder-Policy does not support the ${JSON.stringify(policy)} policy`);
  }
}
function crossOriginEmbedderPolicy(options = {}) {
  const headerValue = getHeaderValueFromOptions$6(options);
  return function crossOriginEmbedderPolicyMiddleware(_req, res, next) {
    res.setHeader("Cross-Origin-Embedder-Policy", headerValue);
    next();
  };
}
var ALLOWED_POLICIES$1 = /* @__PURE__ */ new Set(["same-origin", "same-origin-allow-popups", "noopener-allow-popups", "unsafe-none"]);
function getHeaderValueFromOptions$5({ policy = "same-origin" }) {
  if (ALLOWED_POLICIES$1.has(policy)) {
    return policy;
  } else {
    throw new Error(`Cross-Origin-Opener-Policy does not support the ${JSON.stringify(policy)} policy`);
  }
}
function crossOriginOpenerPolicy(options = {}) {
  const headerValue = getHeaderValueFromOptions$5(options);
  return function crossOriginOpenerPolicyMiddleware(_req, res, next) {
    res.setHeader("Cross-Origin-Opener-Policy", headerValue);
    next();
  };
}
var ALLOWED_POLICIES = /* @__PURE__ */ new Set(["same-origin", "same-site", "cross-origin"]);
function getHeaderValueFromOptions$4({ policy = "same-origin" }) {
  if (ALLOWED_POLICIES.has(policy)) {
    return policy;
  } else {
    throw new Error(`Cross-Origin-Resource-Policy does not support the ${JSON.stringify(policy)} policy`);
  }
}
function crossOriginResourcePolicy(options = {}) {
  const headerValue = getHeaderValueFromOptions$4(options);
  return function crossOriginResourcePolicyMiddleware(_req, res, next) {
    res.setHeader("Cross-Origin-Resource-Policy", headerValue);
    next();
  };
}
function originAgentCluster() {
  return function originAgentClusterMiddleware(_req, res, next) {
    res.setHeader("Origin-Agent-Cluster", "?1");
    next();
  };
}
var ALLOWED_TOKENS = /* @__PURE__ */ new Set(["no-referrer", "no-referrer-when-downgrade", "same-origin", "origin", "strict-origin", "origin-when-cross-origin", "strict-origin-when-cross-origin", "unsafe-url", ""]);
function getHeaderValueFromOptions$3({ policy = ["no-referrer"] }) {
  const tokens = typeof policy === "string" ? [policy] : policy;
  if (tokens.length === 0) {
    throw new Error("Referrer-Policy received no policy tokens");
  }
  const tokensSeen = /* @__PURE__ */ new Set();
  tokens.forEach((token) => {
    if (!ALLOWED_TOKENS.has(token)) {
      throw new Error(`Referrer-Policy received an unexpected policy token ${JSON.stringify(token)}`);
    } else if (tokensSeen.has(token)) {
      throw new Error(`Referrer-Policy received a duplicate policy token ${JSON.stringify(token)}`);
    }
    tokensSeen.add(token);
  });
  return tokens.join(",");
}
function referrerPolicy(options = {}) {
  const headerValue = getHeaderValueFromOptions$3(options);
  return function referrerPolicyMiddleware(_req, res, next) {
    res.setHeader("Referrer-Policy", headerValue);
    next();
  };
}
var DEFAULT_MAX_AGE = 365 * 24 * 60 * 60;
function parseMaxAge(value = DEFAULT_MAX_AGE) {
  if (value >= 0 && Number.isFinite(value)) {
    return Math.floor(value);
  } else {
    throw new Error(`Strict-Transport-Security: ${JSON.stringify(value)} is not a valid value for maxAge. Please choose a positive integer.`);
  }
}
function getHeaderValueFromOptions$2(options) {
  if ("maxage" in options) {
    throw new Error("Strict-Transport-Security received an unsupported property, `maxage`. Did you mean to pass `maxAge`?");
  }
  if ("includeSubdomains" in options) {
    throw new Error('Strict-Transport-Security middleware should use `includeSubDomains` instead of `includeSubdomains`. (The correct one has an uppercase "D".)');
  }
  const directives = [`max-age=${parseMaxAge(options.maxAge)}`];
  if (options.includeSubDomains === void 0 || options.includeSubDomains) {
    directives.push("includeSubDomains");
  }
  if (options.preload) {
    directives.push("preload");
  }
  return directives.join("; ");
}
function strictTransportSecurity(options = {}) {
  const headerValue = getHeaderValueFromOptions$2(options);
  return function strictTransportSecurityMiddleware(_req, res, next) {
    res.setHeader("Strict-Transport-Security", headerValue);
    next();
  };
}
function xContentTypeOptions() {
  return function xContentTypeOptionsMiddleware(_req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  };
}
function xDnsPrefetchControl(options = {}) {
  const headerValue = options.allow ? "on" : "off";
  return function xDnsPrefetchControlMiddleware(_req, res, next) {
    res.setHeader("X-DNS-Prefetch-Control", headerValue);
    next();
  };
}
function xDownloadOptions() {
  return function xDownloadOptionsMiddleware(_req, res, next) {
    res.setHeader("X-Download-Options", "noopen");
    next();
  };
}
function getHeaderValueFromOptions$1({ action = "sameorigin" }) {
  const normalizedAction = typeof action === "string" ? action.toUpperCase() : action;
  switch (normalizedAction) {
    case "SAME-ORIGIN":
      return "SAMEORIGIN";
    case "DENY":
    case "SAMEORIGIN":
      return normalizedAction;
    default:
      throw new Error(`X-Frame-Options received an invalid action ${JSON.stringify(action)}`);
  }
}
function xFrameOptions(options = {}) {
  const headerValue = getHeaderValueFromOptions$1(options);
  return function xFrameOptionsMiddleware(_req, res, next) {
    res.setHeader("X-Frame-Options", headerValue);
    next();
  };
}
var ALLOWED_PERMITTED_POLICIES = /* @__PURE__ */ new Set(["none", "master-only", "by-content-type", "all"]);
function getHeaderValueFromOptions({ permittedPolicies = "none" }) {
  if (ALLOWED_PERMITTED_POLICIES.has(permittedPolicies)) {
    return permittedPolicies;
  } else {
    throw new Error(`X-Permitted-Cross-Domain-Policies does not support ${JSON.stringify(permittedPolicies)}`);
  }
}
function xPermittedCrossDomainPolicies(options = {}) {
  const headerValue = getHeaderValueFromOptions(options);
  return function xPermittedCrossDomainPoliciesMiddleware(_req, res, next) {
    res.setHeader("X-Permitted-Cross-Domain-Policies", headerValue);
    next();
  };
}
function xPoweredBy() {
  return function xPoweredByMiddleware(_req, res, next) {
    res.removeHeader("X-Powered-By");
    next();
  };
}
function xXssProtection() {
  return function xXssProtectionMiddleware(_req, res, next) {
    res.setHeader("X-XSS-Protection", "0");
    next();
  };
}
function getMiddlewareFunctionsFromOptions(options) {
  const result = [];
  switch (options.contentSecurityPolicy) {
    case void 0:
    case true:
      result.push(contentSecurityPolicy());
      break;
    case false:
      break;
    default:
      result.push(contentSecurityPolicy(options.contentSecurityPolicy));
      break;
  }
  switch (options.crossOriginEmbedderPolicy) {
    case void 0:
    case false:
      break;
    case true:
      result.push(crossOriginEmbedderPolicy());
      break;
    default:
      result.push(crossOriginEmbedderPolicy(options.crossOriginEmbedderPolicy));
      break;
  }
  switch (options.crossOriginOpenerPolicy) {
    case void 0:
    case true:
      result.push(crossOriginOpenerPolicy());
      break;
    case false:
      break;
    default:
      result.push(crossOriginOpenerPolicy(options.crossOriginOpenerPolicy));
      break;
  }
  switch (options.crossOriginResourcePolicy) {
    case void 0:
    case true:
      result.push(crossOriginResourcePolicy());
      break;
    case false:
      break;
    default:
      result.push(crossOriginResourcePolicy(options.crossOriginResourcePolicy));
      break;
  }
  switch (options.originAgentCluster) {
    case void 0:
    case true:
      result.push(originAgentCluster());
      break;
    case false:
      break;
    default:
      console.warn("Origin-Agent-Cluster does not take options. Remove the property to silence this warning.");
      result.push(originAgentCluster());
      break;
  }
  switch (options.referrerPolicy) {
    case void 0:
    case true:
      result.push(referrerPolicy());
      break;
    case false:
      break;
    default:
      result.push(referrerPolicy(options.referrerPolicy));
      break;
  }
  if ("strictTransportSecurity" in options && "hsts" in options) {
    throw new Error("Strict-Transport-Security option was specified twice. Remove the `hsts` option to fix this error.");
  }
  const strictTransportSecurityOption = options.strictTransportSecurity ?? options.hsts;
  switch (strictTransportSecurityOption) {
    case void 0:
    case true:
      result.push(strictTransportSecurity());
      break;
    case false:
      break;
    default:
      result.push(strictTransportSecurity(strictTransportSecurityOption));
      break;
  }
  if ("xContentTypeOptions" in options && "noSniff" in options) {
    throw new Error("X-Content-Type-Options option was specified twice. Remove the `noSniff` option to fix this error.");
  }
  const xContentTypeOptionsOption = options.xContentTypeOptions ?? options.noSniff;
  switch (xContentTypeOptionsOption) {
    case void 0:
    case true:
      result.push(xContentTypeOptions());
      break;
    case false:
      break;
    default:
      console.warn("X-Content-Type-Options does not take options. Remove the property to silence this warning.");
      result.push(xContentTypeOptions());
      break;
  }
  if ("xDnsPrefetchControl" in options && "dnsPrefetchControl" in options) {
    throw new Error("X-DNS-Prefetch-Control option was specified twice. Remove the `dnsPrefetchControl` option to fix this error.");
  }
  const xDnsPrefetchControlOption = options.xDnsPrefetchControl ?? options.dnsPrefetchControl;
  switch (xDnsPrefetchControlOption) {
    case void 0:
    case true:
      result.push(xDnsPrefetchControl());
      break;
    case false:
      break;
    default:
      result.push(xDnsPrefetchControl(xDnsPrefetchControlOption));
      break;
  }
  if ("xDownloadOptions" in options && "ieNoOpen" in options) {
    throw new Error("X-Download-Options option was specified twice. Remove the `ieNoOpen` option to fix this error.");
  }
  const xDownloadOptionsOption = options.xDownloadOptions ?? options.ieNoOpen;
  switch (xDownloadOptionsOption) {
    case void 0:
    case true:
      result.push(xDownloadOptions());
      break;
    case false:
      break;
    default:
      console.warn("X-Download-Options does not take options. Remove the property to silence this warning.");
      result.push(xDownloadOptions());
      break;
  }
  if ("xFrameOptions" in options && "frameguard" in options) {
    throw new Error("X-Frame-Options option was specified twice. Remove the `frameguard` option to fix this error.");
  }
  const xFrameOptionsOption = options.xFrameOptions ?? options.frameguard;
  switch (xFrameOptionsOption) {
    case void 0:
    case true:
      result.push(xFrameOptions());
      break;
    case false:
      break;
    default:
      result.push(xFrameOptions(xFrameOptionsOption));
      break;
  }
  if ("xPermittedCrossDomainPolicies" in options && "permittedCrossDomainPolicies" in options) {
    throw new Error("X-Permitted-Cross-Domain-Policies option was specified twice. Remove the `permittedCrossDomainPolicies` option to fix this error.");
  }
  const xPermittedCrossDomainPoliciesOption = options.xPermittedCrossDomainPolicies ?? options.permittedCrossDomainPolicies;
  switch (xPermittedCrossDomainPoliciesOption) {
    case void 0:
    case true:
      result.push(xPermittedCrossDomainPolicies());
      break;
    case false:
      break;
    default:
      result.push(xPermittedCrossDomainPolicies(xPermittedCrossDomainPoliciesOption));
      break;
  }
  if ("xPoweredBy" in options && "hidePoweredBy" in options) {
    throw new Error("X-Powered-By option was specified twice. Remove the `hidePoweredBy` option to fix this error.");
  }
  const xPoweredByOption = options.xPoweredBy ?? options.hidePoweredBy;
  switch (xPoweredByOption) {
    case void 0:
    case true:
      result.push(xPoweredBy());
      break;
    case false:
      break;
    default:
      console.warn("X-Powered-By does not take options. Remove the property to silence this warning.");
      result.push(xPoweredBy());
      break;
  }
  if ("xXssProtection" in options && "xssFilter" in options) {
    throw new Error("X-XSS-Protection option was specified twice. Remove the `xssFilter` option to fix this error.");
  }
  const xXssProtectionOption = options.xXssProtection ?? options.xssFilter;
  switch (xXssProtectionOption) {
    case void 0:
    case true:
      result.push(xXssProtection());
      break;
    case false:
      break;
    default:
      console.warn("X-XSS-Protection does not take options. Remove the property to silence this warning.");
      result.push(xXssProtection());
      break;
  }
  return result;
}
var helmet = Object.assign(
  function helmet2(options = {}) {
    if (options.constructor?.name === "IncomingMessage") {
      throw new Error("It appears you have done something like `app.use(helmet)`, but it should be `app.use(helmet())`.");
    }
    const middlewareFunctions = getMiddlewareFunctionsFromOptions(options);
    return function helmetMiddleware(req, res, next) {
      let middlewareIndex = 0;
      (function internalNext(err) {
        if (err) {
          next(err);
          return;
        }
        const middlewareFunction = middlewareFunctions[middlewareIndex];
        if (middlewareFunction) {
          middlewareIndex++;
          middlewareFunction(req, res, internalNext);
        } else {
          next();
        }
      })();
    };
  },
  {
    contentSecurityPolicy,
    crossOriginEmbedderPolicy,
    crossOriginOpenerPolicy,
    crossOriginResourcePolicy,
    originAgentCluster,
    referrerPolicy,
    strictTransportSecurity,
    xContentTypeOptions,
    xDnsPrefetchControl,
    xDownloadOptions,
    xFrameOptions,
    xPermittedCrossDomainPolicies,
    xPoweredBy,
    xXssProtection,
    // Legacy aliases
    dnsPrefetchControl: xDnsPrefetchControl,
    xssFilter: xXssProtection,
    permittedCrossDomainPolicies: xPermittedCrossDomainPolicies,
    ieNoOpen: xDownloadOptions,
    noSniff: xContentTypeOptions,
    frameguard: xFrameOptions,
    hidePoweredBy: xPoweredBy,
    hsts: strictTransportSecurity
  }
);

// server.ts
async function startServer() {
  try {
    let getFirebaseAdmin = function() {
      if (adminInitialized) return admin;
      const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (!serviceAccountStr) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY \uC124\uC815\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
      }
      try {
        const serviceAccount = JSON.parse(serviceAccountStr);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        adminInitialized = true;
        return admin;
      } catch (err) {
        throw new Error("JSON \uD30C\uC2F1 \uC11C\uBC84 \uC624\uB958: " + err.message);
      }
    };
    console.log("Starting server process...");
    console.log("NODE_ENV=", process.env.NODE_ENV);
    console.log("PORT env var:", process.env.PORT);
    const app = express();
    const PORT = parseInt(process.env.PORT || "8080", 10);
    let adminInitialized = false;
    async function verifyAdminToken(req, res) {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ error: "\uC778\uC99D \uD1A0\uD070\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." });
        return null;
      }
      const idToken = authHeader.split("Bearer ")[1];
      try {
        const pbAdmin = getFirebaseAdmin();
        const decoded = await pbAdmin.auth().verifyIdToken(idToken);
        const callerEmail = decoded.email;
        if (!callerEmail) {
          res.status(403).json({ error: "\uC778\uC99D\uB41C \uC774\uBA54\uC77C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." });
          return null;
        }
        const callerDoc = await pbAdmin.firestore().collection("users").doc(callerEmail.toLowerCase()).get();
        if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
          res.status(403).json({ error: "\uAD00\uB9AC\uC790 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." });
          return null;
        }
        return callerEmail;
      } catch (err) {
        res.status(401).json({ error: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uD1A0\uD070: " + err.message });
        return null;
      }
    }
    const allowedOrigin = process.env.APP_URL || "http://localhost:8080";
    app.use(cors({ origin: allowedOrigin }));
    app.use(helmet());
    app.use(express.json());
    app.post("/api/admin/update-password", async (req, res) => {
      const caller = await verifyAdminToken(req, res);
      if (!caller) return;
      try {
        const { email, newPassword } = req.body;
        if (!email || !newPassword) {
          return res.status(400).json({ error: "Missing email or newPassword" });
        }
        if (typeof newPassword !== "string" || newPassword.length < 6) {
          return res.status(400).json({ error: "\uBE44\uBC00\uBC88\uD638\uB294 6\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4." });
        }
        const pbAdmin = getFirebaseAdmin();
        const userRecord = await pbAdmin.auth().getUserByEmail(email);
        await pbAdmin.auth().updateUser(userRecord.uid, {
          password: newPassword
        });
        res.json({ success: true, message: "\uBE44\uBC00\uBC88\uD638\uAC00 \uC131\uACF5\uC801\uC73C\uB85C \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
      } catch (error) {
        console.error("Error updating password:", error);
        if (error.message.includes("FIREBASE_SERVICE_ACCOUNT_KEY")) {
          return res.status(500).json({ error: "\uC571 \uC124\uC815 \uBA54\uB274\uC5D0 \uC811\uC18D\uD574 [FIREBASE_SERVICE_ACCOUNT_KEY] \uD658\uACBD \uBCC0\uC218(\uBE44\uACF5\uAC1C \uD0A4)\uB97C \uC218\uB3D9 \uB4F1\uB85D\uD574\uC57C \uC774 \uAE30\uB2A5\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." });
        }
        res.status(500).json({ error: error.message || "Failed to update password" });
      }
    });
    app.post("/api/admin/delete-user", async (req, res) => {
      const caller = await verifyAdminToken(req, res);
      if (!caller) return;
      try {
        const { email } = req.body;
        if (!email) {
          return res.status(400).json({ error: "Missing email" });
        }
        const pbAdmin = getFirebaseAdmin();
        const db = pbAdmin.firestore();
        try {
          const userRecord = await pbAdmin.auth().getUserByEmail(email);
          await pbAdmin.auth().deleteUser(userRecord.uid);
          console.log(`Deleted user from Auth: ${email}`);
        } catch (authErr) {
          console.log(`Auth user not found or error: ${authErr.message}`);
        }
        if (req.body.authOnly) {
          return res.json({ success: true, message: "User deleted from Auth" });
        }
        await db.collection("users").doc(email).delete();
        const deleteRelatedAsEvaluator = async (collectionName, resultsCollection) => {
          const snap = await db.collection(collectionName).where("evaluatorId", "==", email).get();
          for (const doc of snap.docs) {
            await db.collection(resultsCollection).doc(doc.id).delete();
            await doc.ref.delete();
          }
        };
        await deleteRelatedAsEvaluator("assignments", "results");
        await deleteRelatedAsEvaluator("exec_assignments", "exec_results");
        const deleteRelatedAsEvaluatee = async (collectionName, resultsCollection) => {
          const snap = await db.collection(collectionName).where("evaluateeId", "==", email).get();
          for (const doc of snap.docs) {
            await db.collection(resultsCollection).doc(doc.id).delete();
            await doc.ref.delete();
          }
        };
        await deleteRelatedAsEvaluatee("assignments", "results");
        await deleteRelatedAsEvaluatee("exec_assignments", "exec_results");
        const deleteFinalScores = async (collectionName) => {
          const snap = await db.collection(collectionName).where("evaluateeId", "==", email).get();
          for (const doc of snap.docs) {
            await doc.ref.delete();
          }
        };
        await deleteFinalScores("finalScores");
        await deleteFinalScores("exec_finalScores");
        res.json({ success: true, message: "\uC0AC\uC6A9\uC790 \uBC0F \uBAA8\uB4E0 \uAD00\uB828 \uB370\uC774\uD130\uAC00 \uC131\uACF5\uC801\uC73C\uB85C \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
      } catch (error) {
        console.error("Error deleting user:", error);
        if (error.message.includes("FIREBASE_SERVICE_ACCOUNT_KEY") || error.message.includes("\uC124\uC815\uC774 \uD544\uC694\uD569\uB2C8\uB2E4")) {
          return res.status(500).json({ error: "\uC571 \uC124\uC815 \uBA54\uB274\uC5D0 \uC811\uC18D\uD574 [FIREBASE_SERVICE_ACCOUNT_KEY] \uD658\uACBD \uBCC0\uC218(\uBE44\uACF5\uAC1C \uD0A4)\uB97C \uC218\uB3D9 \uB4F1\uB85D\uD574\uC57C \uC774 \uAE30\uB2A5\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." });
        }
        res.status(500).json({ error: error.message || "Failed to delete user" });
      }
    });
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("FATAL ERROR IN STARTUP:", err);
    process.exit(1);
  }
}
startServer();
