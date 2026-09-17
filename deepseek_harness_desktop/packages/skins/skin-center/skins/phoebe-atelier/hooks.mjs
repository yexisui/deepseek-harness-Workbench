/**
 * 辉弦圣堂 · 菲比 (phoebe-atelier) skin hooks — the trusted escape hatch of
 * the v2 skin contract (x-org.linxin666.skin-center/v1alpha1). apply() owns
 * every DOM write and registers retraction through ctx.onCleanup.
 *
 * Artwork ships as files under assets/ and binds at runtime through
 * ctx.assetBase (absolute URLs, so CSS-variable url() references survive the
 * injected-stylesheet base). The stylesheet scopes itself under the
 * loader-owned html[data-dsh-skin="phoebe-atelier"] (set by the skin-center
 * before apply); this module never injects the stylesheet itself.
 */
var __skin = (function () {
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

// scripts/v2-entry.ts
var v2_entry_exports = {};
__export(v2_entry_exports, {
  __setPhoebeAssetBase: () => __setPhoebeAssetBase,
  apply: () => apply2
});
module.exports = __toCommonJS(v2_entry_exports);

// phoebe-v2-art:phoebe-v2-art-virtual.mjs
var PHOEBE_ATELIER_PALACE_LIGHT = "";
var PHOEBE_ATELIER_PALACE_DARK = "";
var PHOEBE_ATELIER_MAIN_LEFT = "";
var PHOEBE_ATELIER_MAIN_RIGHT = "";
var PHOEBE_ATELIER_SCENE_ALTAR_HEART = "";
var PHOEBE_ATELIER_SCENE_NAVE = "";
var PHOEBE_ATELIER_SCENE_BRIGHT = "";
var PHOEBE_ATELIER_MAIN_RIGHT_VISION = "";
var PHOEBE_ATELIER_BOTTOM_CREST = "";
var PHOEBE_ATELIER_BOTTOM_TRIM_TILE = "";
var PHOEBE_ATELIER_COMPOSER_FRAME = "";
var PHOEBE_ATELIER_FRAME_GEM = "";
var PHOEBE_ATELIER_FRAME_GEM_V = "";
var PHOEBE_ATELIER_SETTINGS_FRAME = "";
var PHOEBE_ATELIER_SIDEBAR_CORNER = "";
var PHOEBE_ATELIER_WORKSPACE_RIBBON = "";
var PHOEBE_ATELIER_WORKSPACE_SHIELD = "";
var PHOEBE_ATELIER_CHIBI = "";
var PHOEBE_ATELIER_BOW_CLEAN = "";
var PHOEBE_ATELIER_NEW_SESSION = "";
var PHOEBE_ATELIER_SIDEBAR_SWAG = "";
var PHOEBE_ATELIER_TOP_TRIM_TILE = "";
var PHOEBE_ATELIER_ICON = "";
function __setPhoebeAssetBase(base) {
  var u = function(f) {
    return new URL(base.replace(/\/$/, "") + "/assets/" + f, location.href).href;
  };
  PHOEBE_ATELIER_PALACE_LIGHT = u("palace-light.webp");
  PHOEBE_ATELIER_PALACE_DARK = u("palace-dark.webp");
  PHOEBE_ATELIER_MAIN_LEFT = u("main-left.webp");
  PHOEBE_ATELIER_MAIN_RIGHT = u("main-right.webp");
  PHOEBE_ATELIER_SCENE_ALTAR_HEART = u("scene-altar-heart.webp");
  PHOEBE_ATELIER_SCENE_NAVE = u("scene-nave.webp");
  PHOEBE_ATELIER_SCENE_BRIGHT = u("scene-bright.webp");
  PHOEBE_ATELIER_MAIN_RIGHT_VISION = u("main-right-vision.webp");
  PHOEBE_ATELIER_BOTTOM_CREST = u("bottom-crest.webp");
  PHOEBE_ATELIER_BOTTOM_TRIM_TILE = u("bottom-trim-tile.webp");
  PHOEBE_ATELIER_COMPOSER_FRAME = u("composer-frame.webp");
  PHOEBE_ATELIER_FRAME_GEM = u("frame-gem.webp");
  PHOEBE_ATELIER_FRAME_GEM_V = u("frame-gem-v.webp");
  PHOEBE_ATELIER_SETTINGS_FRAME = u("settings-frame.webp");
  PHOEBE_ATELIER_SIDEBAR_CORNER = u("sidebar-corner.webp");
  PHOEBE_ATELIER_WORKSPACE_RIBBON = u("workspace-ribbon.webp");
  PHOEBE_ATELIER_WORKSPACE_SHIELD = u("workspace-shield.webp");
  PHOEBE_ATELIER_CHIBI = u("chibi.webp");
  PHOEBE_ATELIER_BOW_CLEAN = u("bow.webp");
  PHOEBE_ATELIER_NEW_SESSION = u("new-session.webp");
  PHOEBE_ATELIER_SIDEBAR_SWAG = u("sidebar-swag.webp");
  PHOEBE_ATELIER_TOP_TRIM_TILE = u("top-trim-tile.webp");
  PHOEBE_ATELIER_ICON = u("icon.webp");
}

// src/client/titlebar-brand.ts
var PHOEBE_ATELIER_TITLEBAR_BRAND = `<svg viewBox="26 4.2 155.6 17.6" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M68.416 18.2447H67.0501V16.1272H68.416C69.2619 16.1272 70.1166 15.9163 70.6671 15.3304C71.2181 14.7444 71.426 13.8455 71.426 12.9471C71.426 12.0487 71.2268 11.1498 70.6671 10.5643C70.1083 9.97831 69.2619 9.76744 68.416 9.76744C67.5701 9.76744 66.7154 9.97831 66.1639 10.5643C65.6129 11.1503 65.4049 12.0487 65.4049 12.9471V21.6435H63.009V7.6582H65.4049V8.54883H65.8442C65.8918 8.49393 65.9394 8.44728 65.9875 8.40064C66.5871 7.85353 67.5049 7.6582 68.4072 7.6582C69.8212 7.6582 71.2341 8.00998 72.1607 8.98662C73.0868 9.96325 73.4143 11.4632 73.4143 12.9558C73.4143 14.4485 73.0785 15.9406 72.1607 16.925C71.2424 17.9094 69.8212 18.2457 68.416 18.2457V18.2447Z" fill="currentColor"/> <path d="M31.9551 8.03497H33.3204V10.1525H31.9551C31.1087 10.1525 30.2545 10.3633 29.7035 10.9493C29.1525 11.5353 28.945 12.4342 28.945 13.3326C28.945 14.231 29.1447 15.1294 29.7035 15.7154C30.2623 16.3014 31.1087 16.5122 31.9551 16.5122C32.8015 16.5122 33.6562 16.3014 34.2072 15.7154C34.7582 15.1294 34.9657 14.231 34.9657 13.3326V4.62842H37.3611V18.6219H34.9657V17.7313H34.5264C34.4783 17.7857 34.4307 17.8329 34.3826 17.8795C33.7835 18.4261 32.8652 18.6219 31.9629 18.6219C30.5494 18.6219 29.136 18.2707 28.2099 17.294C27.2838 16.3174 26.9563 14.817 26.9563 13.3248C26.9563 11.8327 27.2916 10.34 28.2099 9.35561C29.136 8.37898 30.5494 8.03497 31.9551 8.03497Z" fill="currentColor"/> <path d="M49.3786 13.1431V13.9948H42.9984V12.2996H47.2305C47.1348 11.6825 46.9113 11.1043 46.5119 10.682C45.9371 10.0727 45.0503 9.85409 44.1723 9.85409C43.2943 9.85409 42.4076 10.0727 41.8328 10.682C41.258 11.2913 41.05 12.2213 41.05 13.1435C41.05 14.0658 41.2575 15.003 41.8328 15.6046C42.4076 16.2061 43.2939 16.433 44.1723 16.433C45.0508 16.433 45.9371 16.2143 46.5119 15.6046C46.5916 15.5186 46.6635 15.4248 46.7354 15.331H49.0992C48.8918 16.0657 48.5643 16.7299 48.0691 17.2454C47.111 18.2531 45.6339 18.6205 44.1723 18.6205C42.7108 18.6205 41.2337 18.2609 40.2755 17.2454C39.3174 16.2299 38.9661 14.6828 38.9661 13.1435C38.9661 11.6043 39.3096 10.0494 40.2755 9.04168C41.242 8.03396 42.7108 7.66663 44.1723 7.66663C45.6339 7.66663 47.111 8.02618 48.0691 9.04168C49.0351 10.0572 49.3786 11.6043 49.3786 13.1435V13.1431Z" fill="currentColor"/> <path d="M61.4045 13.1431V13.9948H55.0243V12.2996H59.2564C59.1602 11.6825 58.9372 11.1043 58.5378 10.682C57.963 10.0727 57.0762 9.85409 56.1982 9.85409C55.3202 9.85409 54.4335 10.0727 53.8587 10.682C53.2839 11.2913 53.0759 12.2213 53.0759 13.1435C53.0759 14.0658 53.2834 15.003 53.8587 15.6046C54.4335 16.2061 55.3202 16.433 56.1982 16.433C57.0762 16.433 57.963 16.2143 58.5378 15.6046C58.6179 15.5186 58.6894 15.4248 58.7608 15.331H61.1251C60.9171 16.0657 60.5897 16.7299 60.0945 17.2454C59.1364 18.2531 57.6593 18.6205 56.1982 18.6205C54.7372 18.6205 53.2596 18.2609 52.3014 17.2454C51.3432 16.2299 50.9919 14.6828 50.9919 13.1435C50.9919 11.6043 51.3355 10.0494 52.3014 9.04168C53.2678 8.03396 54.7367 7.66663 56.1982 7.66663C57.6598 7.66663 59.1364 8.02618 60.0945 9.04168C61.061 10.0572 61.4045 11.6043 61.4045 13.1435V13.1431Z" fill="currentColor"/> <path d="M80.242 18.6214C81.7035 18.6214 83.1801 18.4105 84.1383 17.809C85.0965 17.2075 85.4482 16.2931 85.4482 15.3869C85.4482 14.4807 85.1042 13.5585 84.1383 12.9647C83.1801 12.371 81.703 12.1518 80.242 12.1518C79.6186 12.1518 79.0438 12.0658 78.6366 11.8394C78.2294 11.6047 78.0778 11.2534 78.0778 10.9017C78.0778 10.5499 78.2216 10.1908 78.6366 9.9639C79.0438 9.72921 79.6749 9.65147 80.2973 9.65147C80.9198 9.65147 81.5509 9.73747 81.9591 9.9639C82.3663 10.1986 82.5179 10.5499 82.5179 10.9017H84.9531C84.9531 9.99499 84.6421 9.07327 83.7719 8.47951C82.9017 7.88576 81.5679 7.66663 80.2424 7.66663C78.9169 7.66663 77.5837 7.8775 76.713 8.47951C75.8427 9.08104 75.5308 9.99499 75.5308 10.9017C75.5308 11.8083 75.8423 12.73 76.713 13.3238C77.5832 13.9176 78.9165 14.1367 80.2424 14.1367C80.929 14.1367 81.688 14.2227 82.1428 14.4491C82.5985 14.676 82.7579 15.0351 82.7579 15.3869C82.7579 15.7387 82.5985 16.0977 82.1428 16.3246C81.688 16.5511 80.9931 16.6371 80.3066 16.6371C79.62 16.6371 78.9169 16.5511 78.4694 16.3246C78.0224 16.0982 77.8543 15.7387 77.8543 15.3869H75.0435C75.0435 16.2935 75.3865 17.2153 76.3534 17.809C77.3194 18.4028 78.7809 18.6214 80.2424 18.6214H80.242Z" fill="currentColor"/> <path d="M97.4733 13.1431V13.9948H91.0932V12.2996H95.3252C95.23 11.6825 95.006 11.1043 94.6071 10.682C94.0313 10.0727 93.1456 9.85409 92.2666 9.85409C91.3876 9.85409 90.5018 10.0727 89.927 10.682C89.3522 11.2913 89.1452 12.2213 89.1452 13.1435C89.1452 14.0658 89.3522 15.003 89.927 15.6046C90.5018 16.2061 91.3886 16.433 92.2666 16.433C93.1446 16.433 94.0313 16.2143 94.6071 15.6046C94.6863 15.5186 94.7587 15.4248 94.8301 15.331H97.1935C96.9855 16.0657 96.6585 16.7299 96.1639 17.2454C95.2057 18.2531 93.7281 18.6205 92.2666 18.6205C90.805 18.6205 89.3284 18.2609 88.3703 17.2454C87.4121 16.2299 87.0613 14.6828 87.0613 13.1435C87.0613 11.6043 87.4043 10.0494 88.3703 9.04168C89.3367 8.03396 90.806 7.66663 92.2666 7.66663C93.7272 7.66663 95.2057 8.02618 96.1639 9.04168C97.1298 10.0572 97.4729 11.6043 97.4729 13.1435L97.4733 13.1431Z" fill="currentColor"/> <path d="M109.499 13.1431V13.9948H103.119V12.2996H107.351C107.256 11.6825 107.032 11.1043 106.632 10.682C106.057 10.0727 105.172 9.85409 104.293 9.85409C103.414 9.85409 102.528 10.0727 101.953 10.682C101.378 11.2913 101.17 12.2213 101.17 13.1435C101.17 14.0658 101.378 15.003 101.953 15.6046C102.528 16.2061 103.415 16.433 104.293 16.433C105.171 16.433 106.057 16.2143 106.632 15.6046C106.712 15.5186 106.784 15.4248 106.856 15.331H109.22C109.012 16.0657 108.685 16.7299 108.19 17.2454C107.231 18.2531 105.754 18.6205 104.293 18.6205C102.831 18.6205 101.355 18.2609 100.396 17.2454C99.4382 16.2299 99.0864 14.6828 99.0864 13.1435C99.0864 11.6043 99.4295 10.0494 100.396 9.04168C101.362 8.03396 102.832 7.66663 104.293 7.66663C105.754 7.66663 107.231 8.02618 108.19 9.04168C109.156 10.0572 109.499 11.6043 109.499 13.1435V13.1431Z" fill="currentColor"/> <path d="M113.5 4.62817H111.104V18.6217H113.5V4.62817Z" fill="currentColor"/> <path d="M117.589 12.8154L121.517 18.6208H118.554L114.625 12.8154L118.554 8.15088H121.517L117.589 12.8154Z" fill="currentColor"/> <rect x="129.348" y="5.5" width="52" height="14" rx="2" fill="currentColor"/> <g clipPath="url(#phoebe-titlebar-brand-clip)"> <path d="M132.848 8.93205H134.08V16.137H132.848V8.93205ZM136.5 8.93205H137.732V16.137H136.5V8.93205ZM133.365 13.024V11.99H137.193V13.024H133.365Z" fill="var(--dsw-alias-label-primary-inverted)"/> <path d="M140.397 14.432L140.672 13.453H143.202L143.532 14.432H140.397ZM140.287 16.137H139.055L141.277 8.93205H142.201L142.146 9.74605L140.947 13.915H140.969L140.287 16.137ZM145.039 16.137H143.741L143.07 13.948L143.081 13.937L141.871 9.74605L141.926 8.93205H142.817L145.039 16.137Z" fill="var(--dsw-alias-label-primary-inverted)"/> <path d="M146.846 8.93205H149.068C149.852 8.93205 150.443 9.11538 150.839 9.48205C151.235 9.84138 151.433 10.3327 151.433 10.956C151.433 11.22 151.396 11.4657 151.323 11.693C151.249 11.9204 151.125 12.1257 150.949 12.309C150.773 12.4924 150.531 12.65 150.223 12.782C149.922 12.9067 149.541 13.0057 149.079 13.079V13.321H146.846V12.639L148.023 12.485C148.631 12.4044 149.09 12.298 149.398 12.166C149.706 12.034 149.915 11.8764 150.025 11.693C150.135 11.5024 150.19 11.2934 150.19 11.066C150.19 10.6994 150.083 10.417 149.871 10.219C149.658 10.021 149.324 9.92205 148.87 9.92205H146.846V8.93205ZM146.395 8.93205H147.627V16.137H146.395V8.93205ZM151.917 16.093V16.137H150.366L149.024 14.322C148.87 14.1094 148.73 13.9407 148.606 13.816C148.481 13.684 148.345 13.5887 148.199 13.53C148.052 13.464 147.872 13.42 147.66 13.398C147.447 13.3687 147.176 13.3504 146.846 13.343V13.145H149.079C149.233 13.211 149.368 13.2844 149.486 13.365C149.61 13.4457 149.735 13.5447 149.86 13.662C149.992 13.7794 150.138 13.937 150.3 14.135L151.917 16.093Z" fill="var(--dsw-alias-label-primary-inverted)"/> <path d="M153.58 9.57005L153.591 8.93205H154.46L157.584 15.51V16.137H156.704L153.58 9.57005ZM158.024 16.137H156.968L156.88 8.93205H158.024V16.137ZM154.24 16.137H153.096V8.93205H154.152L154.24 16.137Z" fill="var(--dsw-alias-label-primary-inverted)"/> <path d="M159.963 8.93205H161.206V16.137H159.963V8.93205ZM160.095 9.96605V8.93205H164.858V9.96605H160.095ZM160.095 16.137V15.103H164.902V16.137H160.095ZM160.095 13.013V11.99H164.374V13.013H160.095Z" fill="var(--dsw-alias-label-primary-inverted)"/> <path d="M169.052 15.257C169.543 15.257 169.895 15.1654 170.108 14.982C170.328 14.7987 170.438 14.5457 170.438 14.223C170.438 14.047 170.405 13.8967 170.339 13.772C170.273 13.6474 170.152 13.5337 169.976 13.431C169.807 13.321 169.558 13.2147 169.228 13.112L168.491 12.881C167.846 12.6757 167.38 12.4044 167.094 12.067C166.808 11.7297 166.665 11.3007 166.665 10.78C166.665 10.428 166.76 10.1017 166.951 9.80105C167.142 9.50038 167.428 9.25838 167.809 9.07505C168.19 8.89172 168.663 8.80005 169.228 8.80005C169.631 8.80005 169.998 8.82938 170.328 8.88805C170.665 8.93938 171.039 9.01638 171.45 9.11905L171.274 10.175C170.834 10.0504 170.442 9.96238 170.097 9.91105C169.76 9.85238 169.463 9.82305 169.206 9.82305C168.737 9.82305 168.403 9.90738 168.205 10.076C168.007 10.2374 167.908 10.439 167.908 10.681C167.908 10.857 167.941 11.0147 168.007 11.154C168.073 11.286 168.19 11.407 168.359 11.517C168.535 11.627 168.784 11.7334 169.107 11.836L169.866 12.078C170.526 12.276 170.995 12.5327 171.274 12.848C171.553 13.156 171.692 13.585 171.692 14.135C171.692 14.5604 171.589 14.9344 171.384 15.257C171.179 15.5797 170.878 15.8327 170.482 16.016C170.093 16.1994 169.609 16.291 169.03 16.291C168.627 16.291 168.212 16.247 167.787 16.159C167.362 16.071 166.9 15.9427 166.401 15.774L166.665 14.718C167.156 14.894 167.6 15.0297 167.996 15.125C168.399 15.213 168.751 15.257 169.052 15.257Z" fill="var(--dsw-alias-label-primary-inverted)"/> <path d="M175.809 15.257C176.3 15.257 176.652 15.1654 176.865 14.982C177.085 14.7987 177.195 14.5457 177.195 14.223C177.195 14.047 177.162 13.8967 177.096 13.772C177.03 13.6474 176.909 13.5337 176.733 13.431C176.564 13.321 176.315 13.2147 175.985 13.112L175.248 12.881C174.603 12.6757 174.137 12.4044 173.851 12.067C173.565 11.7297 173.422 11.3007 173.422 10.78C173.422 10.428 173.517 10.1017 173.708 9.80105C173.899 9.50038 174.185 9.25838 174.566 9.07505C174.947 8.89172 175.42 8.80005 175.985 8.80005C176.388 8.80005 176.755 8.82938 177.085 8.88805C177.422 8.93938 177.796 9.01638 178.207 9.11905L178.031 10.175C177.591 10.0504 177.199 9.96238 176.854 9.91105C176.517 9.85238 176.22 9.82305 175.963 9.82305C175.494 9.82305 175.16 9.90738 174.962 10.076C174.764 10.2374 174.665 10.439 174.665 10.681C174.665 10.857 174.698 11.0147 174.764 11.154C174.83 11.286 174.947 11.407 175.116 11.517C175.292 11.627 175.541 11.7334 175.864 11.836L176.623 12.078C177.283 12.276 177.752 12.5327 178.031 12.848C178.31 13.156 178.449 13.585 178.449 14.135C178.449 14.5604 178.346 14.9344 178.141 15.257C177.936 15.5797 177.635 15.8327 177.239 16.016C176.85 16.1994 176.366 16.291 175.787 16.291C175.384 16.291 174.969 16.247 174.544 16.159C174.119 16.071 173.657 15.9427 173.158 15.774L173.422 14.718C173.913 14.894 174.357 15.0297 174.753 15.125C175.156 15.213 175.508 15.257 175.809 15.257Z" fill="var(--dsw-alias-label-primary-inverted)"/> </g> <defs> <clipPath id="phoebe-titlebar-brand-clip"> <rect width="46" height="14" fill="white" transform="translate(132.348 5.5)"/> </clipPath> </defs></svg>`;

// src/client/composer-brand.ts
var PHOEBE_ATELIER_COMPOSER_BRAND = `<svg viewBox="0 0 212 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="phoebeBrandGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9D7AE"/><stop offset=".55" stop-color="#CFA968"/><stop offset="1" stop-color="#A97F3D"/></linearGradient></defs><circle cx="17" cy="18" r="10.5" stroke="url(#phoebeBrandGold)" stroke-width="2.2"/><ellipse cx="17" cy="18" rx="14.5" ry="4.4" stroke="url(#phoebeBrandGold)" stroke-opacity=".45" stroke-width="1" transform="rotate(-16 17 18)"/><path d="M25.4 5.4l1.15 2.85 2.85 1.15-2.85 1.15-1.15 2.85-1.15-2.85-2.85-1.15 2.85-1.15z" fill="#CFA968"/><text x="38" y="24.5" font-family="Georgia, 'Times New Roman', serif" font-size="20" font-weight="600" letter-spacing=".5"><tspan fill="url(#phoebeBrandGold)">Phoebe</tspan><tspan fill="currentColor">Seek</tspan></text></svg>`;

// src/client/composer-capsule.ts
var SEAT_SELECTOR = "[data-composer-seat]";
var SCROLLPORT_SELECTOR = "[data-conversation-scroll]";
var CHAT_FLOW_SELECTOR = "[data-chat-flow]";
var CARD_SELECTOR = "[data-composer-card]:not([class*='cardWorkspaceTrigger'])";
var MODE_ATTRIBUTE = "data-phoebe-composer-mode";
var CAPSULE_ATTRIBUTE = "data-phoebe-composer-capsule";
var EXPANDING_ATTRIBUTE = "data-phoebe-composer-expanding";
var MENU_OPEN_SELECTOR = "[aria-expanded='true']";
var POPOVER_SELECTOR = [
  '[role="menu"]',
  '[role="listbox"]',
  '[role="dialog"]',
  '[aria-modal="true"]',
  "[data-radix-popper-content-wrapper]",
  "[data-floating-ui-portal]"
].join(",");
var EXPAND_LIFETIME_MS = 280;
var HIGH_CHURN_SELECTOR = ".xterm, [data-input-backdrop]";
var ownershipByDocument = /* @__PURE__ */ new WeakMap();
function phaseRootOf(element) {
  let candidate = element;
  while (candidate !== null) {
    if (candidate instanceof HTMLElement && candidate.hasAttribute("data-phase") && candidate.querySelector(":scope > [data-conversation-scroll]") !== null) return candidate;
    candidate = candidate.parentElement;
  }
  return null;
}
function belongsToHighChurnSubtree(node) {
  if (node instanceof Element) {
    return node.matches(HIGH_CHURN_SELECTOR) || node.closest(HIGH_CHURN_SELECTOR) !== null;
  }
  return (node.parentElement?.closest(HIGH_CHURN_SELECTOR) ?? null) !== null;
}
function installPhoebeComposerCapsule(body) {
  const doc = body.ownerDocument;
  const token = /* @__PURE__ */ Symbol("phoebe-composer-capsule");
  const ownership = ownershipByDocument.get(doc) ?? { token, originals: /* @__PURE__ */ new Map() };
  ownership.token = token;
  ownershipByDocument.set(doc, ownership);
  const current = () => ownership.token === token;
  const remember = (seat) => {
    if (ownership.originals.has(seat)) return;
    ownership.originals.set(seat, {
      capsule: seat.getAttribute(CAPSULE_ATTRIBUTE),
      expanding: seat.getAttribute(EXPANDING_ATTRIBUTE)
    });
  };
  const write = (seat, attribute, value) => {
    if (!current()) return;
    remember(seat);
    if (value === null) seat.removeAttribute(attribute);
    else seat.setAttribute(attribute, value);
  };
  const restoreAttribute = (seat, attribute) => {
    if (!current()) return;
    const snapshot = ownership.originals.get(seat);
    if (snapshot === void 0) return;
    const value = attribute === CAPSULE_ATTRIBUTE ? snapshot.capsule : snapshot.expanding;
    if (value === null) seat.removeAttribute(attribute);
    else seat.setAttribute(attribute, value);
  };
  const restoreSeat = (seat, snapshot) => {
    if (snapshot.capsule === null) seat.removeAttribute(CAPSULE_ATTRIBUTE);
    else seat.setAttribute(CAPSULE_ATTRIBUTE, snapshot.capsule);
    if (snapshot.expanding === null) seat.removeAttribute(EXPANDING_ATTRIBUTE);
    else seat.setAttribute(EXPANDING_ATTRIBUTE, snapshot.expanding);
  };
  const timers = /* @__PURE__ */ new Set();
  const wasCapsule = /* @__PURE__ */ new WeakMap();
  const interacted = /* @__PURE__ */ new WeakMap();
  const schedule = (callback, delay) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  };
  const capsuleMode = () => doc.documentElement.getAttribute(MODE_ATTRIBUTE) === "capsule";
  const synchronize = () => {
    if (!current()) return;
    const active = capsuleMode();
    doc.querySelectorAll(SEAT_SELECTOR).forEach((seat) => {
      const root = phaseRootOf(seat);
      const scrollport = seat.closest(SCROLLPORT_SELECTOR);
      const pending = () => {
        remember(seat);
        restoreAttribute(seat, CAPSULE_ATTRIBUTE);
        restoreAttribute(seat, EXPANDING_ATTRIBUTE);
      };
      if (!active || root?.dataset.phase !== "active" || scrollport === null || scrollport.querySelector(CHAT_FLOW_SELECTOR) === null) {
        wasCapsule.set(seat, false);
        pending();
        return;
      }
      const card = seat.querySelector(CARD_SELECTOR);
      const textarea = card?.querySelector("textarea") ?? null;
      if (card === null || textarea === null) {
        wasCapsule.set(seat, false);
        pending();
        return;
      }
      const empty = textarea.value === "";
      const focused = card.contains(doc.activeElement);
      const menuOpen = card.querySelector(MENU_OPEN_SELECTOR) !== null;
      const next = empty && !focused && !menuOpen && interacted.get(seat) !== true;
      const previous = wasCapsule.get(seat) === true;
      wasCapsule.set(seat, next);
      if (next) {
        write(seat, CAPSULE_ATTRIBUTE, "");
        restoreAttribute(seat, EXPANDING_ATTRIBUTE);
        return;
      }
      restoreAttribute(seat, CAPSULE_ATTRIBUTE);
      if (previous) {
        write(seat, EXPANDING_ATTRIBUTE, "");
        schedule(() => {
          restoreAttribute(seat, EXPANDING_ATTRIBUTE);
        }, EXPAND_LIFETIME_MS);
      } else {
        restoreAttribute(seat, EXPANDING_ATTRIBUTE);
      }
    });
  };
  const onPointerDown = (event) => {
    if (!current()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const card = target.closest(CARD_SELECTOR);
    if (card !== null) {
      const seat = card.closest(SEAT_SELECTOR);
      if (seat !== null) interacted.set(seat, true);
      return;
    }
    if (target.closest(SEAT_SELECTOR) !== null || target.closest(POPOVER_SELECTOR) !== null) return;
    doc.querySelectorAll(SEAT_SELECTOR).forEach((seat) => {
      interacted.set(seat, false);
    });
    synchronize();
  };
  const onFocusIn = (event) => {
    if (!current()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const seat = target.closest(SEAT_SELECTOR);
    if (seat === null) return;
    interacted.set(seat, true);
    synchronize();
  };
  const onFocusOut = (event) => {
    if (!current()) return;
    const target = event.target;
    if (!(target instanceof Element) || target.closest(SEAT_SELECTOR) === null) return;
    queueMicrotask(synchronize);
  };
  const onInput = (event) => {
    if (!current()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const seat = target.closest(SEAT_SELECTOR);
    if (seat === null) return;
    interacted.set(seat, true);
    synchronize();
  };
  const onClick = (event) => {
    if (!current()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const card = target.closest(CARD_SELECTOR);
    if (card === null) return;
    const seat = card.closest(SEAT_SELECTOR);
    if (seat === null || !seat.hasAttribute(CAPSULE_ATTRIBUTE)) return;
    const textarea = card.querySelector("textarea");
    if (textarea === null || card.contains(doc.activeElement)) return;
    textarea.focus({ preventScroll: true });
  };
  const touchComposerMutation = (record) => {
    if (record.type === "attributes") {
      if (record.attributeName === "data-phase") return true;
      const element = record.target instanceof Element ? record.target : void 0;
      return element?.closest(SEAT_SELECTOR) !== null;
    }
    if (belongsToHighChurnSubtree(record.target)) return false;
    const changed = [...record.addedNodes, ...record.removedNodes];
    if (changed.length === 0) {
      return record.target instanceof Element && record.target.closest(SEAT_SELECTOR) !== null;
    }
    if (changed.every(belongsToHighChurnSubtree)) return false;
    const targetElement = record.target instanceof Element ? record.target : void 0;
    return (targetElement?.closest(SEAT_SELECTOR) ?? null) !== null || (targetElement?.closest(SCROLLPORT_SELECTOR) ?? null) !== null || changed.some((node) => node instanceof Element && (node.matches([SEAT_SELECTOR, CARD_SELECTOR, "textarea"].join(", ")) || node.querySelector([SEAT_SELECTOR, CARD_SELECTOR, "textarea"].join(", ")) !== null));
  };
  const observer = new MutationObserver((records) => {
    if (!records.some(touchComposerMutation)) return;
    synchronize();
  });
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-expanded", "data-phase"]
  });
  const modeObserver = new MutationObserver(() => {
    synchronize();
  });
  modeObserver.observe(doc.documentElement, {
    attributes: true,
    attributeFilter: [MODE_ATTRIBUTE]
  });
  doc.addEventListener("pointerdown", onPointerDown, true);
  doc.addEventListener("focusin", onFocusIn, true);
  doc.addEventListener("focusout", onFocusOut, true);
  doc.addEventListener("input", onInput, true);
  doc.addEventListener("click", onClick);
  synchronize();
  return () => {
    observer.disconnect();
    modeObserver.disconnect();
    doc.removeEventListener("pointerdown", onPointerDown, true);
    doc.removeEventListener("focusin", onFocusIn, true);
    doc.removeEventListener("focusout", onFocusOut, true);
    doc.removeEventListener("input", onInput, true);
    doc.removeEventListener("click", onClick);
    timers.forEach((timer) => {
      clearTimeout(timer);
    });
    timers.clear();
    if (current()) {
      ownership.originals.forEach((snapshot, seat) => {
        restoreSeat(seat, snapshot);
      });
      ownership.originals.clear();
      ownershipByDocument.delete(doc);
    }
  };
}

// src/client/composer-scroll.ts
var SCROLLPORT_SELECTOR2 = "[data-conversation-scroll]";
var COMPOSER_SEAT_SELECTOR = "[data-composer-seat]";
var CHAT_FLOW_SELECTOR2 = "[data-chat-flow]";
var MODE_ATTRIBUTE2 = "data-phoebe-composer-mode";
var HIDDEN_ATTRIBUTE = "data-phoebe-composer-hidden";
var INTERACTIVE_ATTRIBUTE = "data-phoebe-composer-interactive";
var NESTED_SCROLL_SURFACE_SELECTOR = [
  '[role="menu"]',
  '[role="listbox"]',
  '[role="dialog"]',
  '[aria-modal="true"]',
  "[data-radix-popper-content-wrapper]",
  "[data-floating-ui-portal]"
].join(",");
var SCROLL_THRESHOLD = 10;
var BOTTOM_THRESHOLD = 24;
var SEAT_GESTURE_WINDOW_MS = 200;
var ownershipByDocument2 = /* @__PURE__ */ new WeakMap();
function phaseRootOf2(element) {
  let candidate = element;
  while (candidate !== null) {
    if (candidate instanceof HTMLElement && candidate.hasAttribute("data-phase") && candidate.querySelector(":scope > [data-conversation-scroll]") !== null) return candidate;
    candidate = candidate.parentElement;
  }
  return null;
}
function scrollEnabled(doc) {
  return doc.documentElement.getAttribute(MODE_ATTRIBUTE2) === "scroll";
}
function activeSeatOf(scrollport) {
  const root = phaseRootOf2(scrollport);
  if (root?.dataset.phase !== "active") return null;
  if (scrollport.querySelector(CHAT_FLOW_SELECTOR2) === null) return null;
  return scrollport.querySelector(COMPOSER_SEAT_SELECTOR);
}
function wheelBelongsToNestedSurface(event, scrollport) {
  for (const candidate of event.composedPath()) {
    if (candidate === scrollport) break;
    if (!(candidate instanceof HTMLElement)) continue;
    if (candidate.matches(NESTED_SCROLL_SURFACE_SELECTOR)) return true;
    const style = getComputedStyle(candidate);
    if (!/(auto|scroll)/.test(style.overflowY) || candidate.scrollHeight <= candidate.clientHeight) continue;
    if (event.deltaY < 0 && candidate.scrollTop > 0) return true;
    if (event.deltaY > 0 && candidate.scrollTop + candidate.clientHeight < candidate.scrollHeight) return true;
  }
  return false;
}
function wheelTargetsSeatDraft(event) {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  const seat = target.closest(COMPOSER_SEAT_SELECTOR);
  if (seat === null) return false;
  for (const candidate of event.composedPath()) {
    if (candidate === seat) break;
    if (!(candidate instanceof HTMLElement)) continue;
    const style = getComputedStyle(candidate);
    if (!/(auto|scroll)/.test(style.overflowY)) continue;
    if (candidate.scrollHeight > candidate.clientHeight + 1) return true;
  }
  return false;
}
function installPhoebeComposerScroll(body) {
  const doc = body.ownerDocument;
  const token = /* @__PURE__ */ Symbol("phoebe-composer-scroll");
  const ownership = ownershipByDocument2.get(doc) ?? { token, originals: /* @__PURE__ */ new Map() };
  ownership.token = token;
  ownershipByDocument2.set(doc, ownership);
  const current = () => ownership.token === token;
  const remember = (seat) => {
    if (ownership.originals.has(seat)) return;
    ownership.originals.set(seat, {
      hidden: seat.getAttribute(HIDDEN_ATTRIBUTE),
      interactive: seat.getAttribute(INTERACTIVE_ATTRIBUTE)
    });
  };
  const write = (seat, attribute, value) => {
    if (!current()) return;
    remember(seat);
    if (value === null) seat.removeAttribute(attribute);
    else seat.setAttribute(attribute, value);
  };
  const restoreSeat = (seat, snapshot) => {
    if (snapshot.hidden === null) seat.removeAttribute(HIDDEN_ATTRIBUTE);
    else seat.setAttribute(HIDDEN_ATTRIBUTE, snapshot.hidden);
    if (snapshot.interactive === null) seat.removeAttribute(INTERACTIVE_ATTRIBUTE);
    else seat.setAttribute(INTERACTIVE_ATTRIBUTE, snapshot.interactive);
  };
  const clearSeatStates = () => {
    if (!current()) return;
    ownership.originals.forEach((snapshot, seat) => {
      restoreSeat(seat, snapshot);
    });
  };
  const lastTops = /* @__PURE__ */ new WeakMap();
  const blurSeat = (seat) => {
    const active = doc.activeElement;
    if (active instanceof HTMLElement && seat.contains(active)) active.blur();
  };
  const hideSeat = (seat) => {
    if (!current() || !scrollEnabled(doc)) return;
    write(seat, INTERACTIVE_ATTRIBUTE, null);
    blurSeat(seat);
    write(seat, HIDDEN_ATTRIBUTE, "");
  };
  const showSeat = (seat) => {
    write(seat, HIDDEN_ATTRIBUTE, null);
  };
  const activateSeat = (seat) => {
    showSeat(seat);
    write(seat, INTERACTIVE_ATTRIBUTE, "");
    if (!scrollEnabled(doc)) write(seat, INTERACTIVE_ATTRIBUTE, null);
  };
  let seatGestureUntil = 0;
  const onScroll = (event) => {
    if (!current() || !scrollEnabled(doc)) return;
    const scrollport = event.target;
    if (!(scrollport instanceof HTMLElement) || !scrollport.matches(SCROLLPORT_SELECTOR2)) return;
    const seat = activeSeatOf(scrollport);
    if (seat === null) return;
    const top = scrollport.scrollTop;
    const previousTop = lastTops.get(scrollport);
    lastTops.set(scrollport, top);
    if (Date.now() < seatGestureUntil) return;
    const distanceToBottom = scrollport.scrollHeight - top - scrollport.clientHeight;
    if (distanceToBottom <= BOTTOM_THRESHOLD) {
      showSeat(seat);
      return;
    }
    if (previousTop !== void 0 && top > previousTop + SCROLL_THRESHOLD) showSeat(seat);
    else if (previousTop !== void 0 && top < previousTop - SCROLL_THRESHOLD) hideSeat(seat);
  };
  const onWheel = (event) => {
    if (!current() || !scrollEnabled(doc)) return;
    if (wheelTargetsSeatDraft(event)) {
      seatGestureUntil = Date.now() + SEAT_GESTURE_WINDOW_MS;
      return;
    }
    if (Math.abs(event.deltaY) <= SCROLL_THRESHOLD) return;
    for (const candidate of event.composedPath()) {
      if (!(candidate instanceof HTMLElement) || !candidate.matches(SCROLLPORT_SELECTOR2)) continue;
      const scrollport = candidate;
      if (wheelBelongsToNestedSurface(event, scrollport)) return;
      const seat = activeSeatOf(scrollport);
      if (seat === null) return;
      if (!lastTops.has(scrollport)) lastTops.set(scrollport, scrollport.scrollTop);
      if (event.deltaY < 0) hideSeat(seat);
      else showSeat(seat);
      return;
    }
  };
  const onFocusIn = (event) => {
    if (!current()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const seat = target.closest(COMPOSER_SEAT_SELECTOR);
    if (seat !== null && phaseRootOf2(seat)?.dataset.phase === "active") activateSeat(seat);
  };
  const onFocusOut = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const seat = target.closest(COMPOSER_SEAT_SELECTOR);
    if (seat === null) return;
    queueMicrotask(() => {
      if (current() && !seat.contains(doc.activeElement)) write(seat, INTERACTIVE_ATTRIBUTE, null);
    });
  };
  const stateObserver = new MutationObserver((records) => {
    if (!current()) return;
    if (!records.some((record) => record.type === "attributes" && record.attributeName === MODE_ATTRIBUTE2)) return;
    if (!scrollEnabled(doc)) clearSeatStates();
  });
  stateObserver.observe(doc.documentElement, {
    attributes: true,
    attributeFilter: [MODE_ATTRIBUTE2]
  });
  doc.addEventListener("scroll", onScroll, true);
  doc.addEventListener("wheel", onWheel, true);
  doc.addEventListener("focusin", onFocusIn, true);
  doc.addEventListener("focusout", onFocusOut, true);
  return () => {
    stateObserver.disconnect();
    doc.removeEventListener("scroll", onScroll, true);
    doc.removeEventListener("wheel", onWheel, true);
    doc.removeEventListener("focusin", onFocusIn, true);
    doc.removeEventListener("focusout", onFocusOut, true);
    if (current()) {
      clearSeatStates();
      ownership.originals.clear();
      ownershipByDocument2.delete(doc);
    }
  };
}

// ../skin-manager/src/protocol.ts
var SKIN_CUSTOMIZATION_PROTOCOL = 1;
var SKIN_CUSTOMIZATION_REGISTER_EVENT = "dsh:skin-customization-register-v1";
var SKIN_CUSTOMIZATION_UNREGISTER_EVENT = "dsh:skin-customization-unregister-v1";
var SKIN_CUSTOMIZATION_READY_EVENT = "dsh:skin-customization-ready-v1";
function exposeSkinCustomization(definition, target = window) {
  const token = {};
  const register = () => target.dispatchEvent(new CustomEvent(
    SKIN_CUSTOMIZATION_REGISTER_EVENT,
    { detail: { token, definition } }
  ));
  target.addEventListener(SKIN_CUSTOMIZATION_READY_EVENT, register);
  register();
  return () => {
    target.removeEventListener(SKIN_CUSTOMIZATION_READY_EVENT, register);
    target.dispatchEvent(new CustomEvent(
      SKIN_CUSTOMIZATION_UNREGISTER_EVENT,
      { detail: { token, definition } }
    ));
    definition.apply(null);
  };
}
var SkinAttributeProjector = class {
  constructor(root = document.documentElement) {
    this.root = root;
  }
  root;
  originals = /* @__PURE__ */ new Map();
  owned = /* @__PURE__ */ new Map();
  set(attribute, value) {
    if (!this.originals.has(attribute)) this.originals.set(attribute, this.root.getAttribute(attribute));
    this.root.setAttribute(attribute, value);
    this.owned.set(attribute, value);
  }
  unset(attribute) {
    if (!this.originals.has(attribute)) this.originals.set(attribute, this.root.getAttribute(attribute));
    this.root.removeAttribute(attribute);
    this.owned.set(attribute, null);
  }
  release(attribute) {
    const attributes = attribute === void 0 ? [...this.originals.keys()] : [attribute];
    for (const name of attributes) {
      if (!this.originals.has(name)) continue;
      const original = this.originals.get(name) ?? null;
      if (this.root.getAttribute(name) === this.owned.get(name)) {
        if (original === null) this.root.removeAttribute(name);
        else this.root.setAttribute(name, original);
      }
      this.originals.delete(name);
      this.owned.delete(name);
    }
  }
};

// src/client/customization.ts
var ATTR_ART = "data-dsh-phoebe-art";
var ATTR_FONT = "data-dsh-phoebe-font";
var ATTR_MODEL_EXIT = "data-dsh-phoebe-model-exit";
var ATTR_MODEL = "data-dsh-phoebe-model";
var ATTR_COMPOSER_MODE = "data-phoebe-composer-mode";
var ATTR_SCENE = "data-phoebe-scene";
function modelFamily(name) {
  const compact = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (compact.includes("v4pro")) return "pro";
  const isV4Flash = compact.includes("v4flash") || compact.includes("v4f");
  if (isV4Flash && compact.includes("vision")) return "flash-vision";
  if (isV4Flash) return "flash";
  return null;
}
function installPhoebeCustomization(root = document.documentElement) {
  const projector = new SkinAttributeProjector(root);
  let observer;
  let frame;
  const synchronizeModel = () => {
    let family = null;
    for (const trigger of document.querySelectorAll("[data-composer-card] button[aria-haspopup='menu']")) {
      family = modelFamily(`${trigger.title} ${trigger.getAttribute("aria-label") ?? ""} ${trigger.textContent ?? ""}`);
      if (family !== null) break;
    }
    if (family === null) projector.unset(ATTR_MODEL);
    else projector.set(ATTR_MODEL, family);
  };
  const scheduleModelSync = () => {
    if (frame !== void 0) return;
    frame = requestAnimationFrame(() => {
      frame = void 0;
      synchronizeModel();
    });
  };
  const startModelObserver = () => {
    if (observer !== void 0) return;
    observer = new MutationObserver((records) => {
      if (records.some((record) => {
        const element = record.target instanceof Element ? record.target : void 0;
        if (element?.closest("[data-input-backdrop]")) return false;
        if (record.type === "attributes") return element?.matches("button[aria-haspopup='menu']") === true;
        if (element?.closest("[data-composer-card] button[aria-haspopup='menu']")) return true;
        return [...record.addedNodes, ...record.removedNodes].some((node) => node instanceof Element && (node.matches("[data-composer-card], button[aria-haspopup='menu']") || node.querySelector("[data-composer-card], button[aria-haspopup='menu']")));
      })) scheduleModelSync();
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["aria-label", "title"],
      childList: true,
      subtree: true
    });
    synchronizeModel();
  };
  const stopModelObserver = () => {
    observer?.disconnect();
    observer = void 0;
    if (frame !== void 0) cancelAnimationFrame(frame);
    frame = void 0;
    projector.release(ATTR_MODEL);
  };
  const apply3 = (state) => {
    if (state === null) {
      stopModelObserver();
      projector.release();
      return;
    }
    const artwork = state.values.artwork === true;
    const scheduleVisible = state.visibility.sfwMode !== false;
    projector.set(ATTR_ART, artwork && scheduleVisible ? "visible" : "hidden");
    projector.set(ATTR_FONT, state.values.font === "serif" ? "serif" : "system");
    const modelExit = state.values.modelExit === true;
    projector.set(ATTR_MODEL_EXIT, modelExit ? "enabled" : "disabled");
    if (modelExit) startModelObserver();
    else stopModelObserver();
    projector.set(ATTR_COMPOSER_MODE, typeof state.values.composerMode === "string" ? state.values.composerMode : "persistent");
    projector.set(ATTR_SCENE, typeof state.values.scene === "string" ? state.values.scene : "cathedral");
  };
  return exposeSkinCustomization({
    protocol: SKIN_CUSTOMIZATION_PROTOCOL,
    skinId: "phoebe-atelier",
    title: "\u8F89\u5F26\u5723\u5802 \xB7 \u83F2\u6BD4",
    titleEn: "Abyssal Phoebe Atelier",
    settings: [
      {
        key: "artwork",
        type: "boolean",
        label: "\u663E\u793A\u83F2\u6BD4\u7ACB\u7ED8",
        labelEn: "Show the Phoebe artwork",
        defaultValue: true
      },
      {
        key: "sfwMode",
        type: "visibility-schedule",
        label: "\u4E0D\u90A3\u4E48\u4E8C\u6B21\u5143\u6A21\u5F0F",
        labelEn: "Not-so-anime mode",
        description: "\u6309\u672C\u673A\u65F6\u95F4\u63A7\u5236\u5927\u5E45\u7ACB\u7ED8\uFF1B\u53EF\u8BBE\u7F6E\u5DE5\u4F5C\u65F6\u6BB5\u9690\u85CF\u3001\u5176\u4ED6\u65F6\u95F4\u663E\u793A\uFF0C\u4E5F\u53EF\u53CD\u5411\u8BBE\u7F6E\u3002",
        descriptionEn: "Control the large artwork by local time; hide it during work hours and show it otherwise, or the reverse.",
        defaultValue: { enabled: false, outside: "visible", ranges: [] }
      },
      {
        key: "font",
        type: "select",
        label: "\u5BF9\u8BDD\u533A\u5B57\u4F53",
        labelEn: "Conversation font",
        defaultValue: "system",
        options: [
          { value: "system", label: "\u7CFB\u7EDF\u9ED8\u8BA4\u65E0\u886C\u7EBF", labelEn: "System default sans" },
          { value: "serif", label: "Georgia \u886C\u7EBF\uFF08#22\uFF09", labelEn: "Georgia serif (#22)" }
        ]
      },
      {
        key: "scene",
        type: "select",
        label: "\u5BF9\u8BDD\u533A\u573A\u666F",
        labelEn: "Conversation scene",
        description: "\u4EAE\u8272\u4E3B\u9898\u4E0B\u7684\u5723\u5802\u573A\u666F\u53D8\u4F53\uFF1B\u6697\u8272\u4E3B\u9898\u59CB\u7EC8\u4F7F\u7528\u661F\u591C\u5723\u5802\u3002",
        descriptionEn: "Cathedral scene variants for the light theme; the dark theme always uses the starlit cathedral.",
        defaultValue: "cathedral",
        options: [
          { value: "cathedral", label: "\u8F89\u5F26\u5723\u5802\uFF08\u9ED8\u8BA4\uFF09", labelEn: "Radiant cathedral (default)" },
          { value: "altar", label: "\u5FC3\u8F89\u5723\u575B", labelEn: "Heart altar" },
          { value: "nave", label: "\u4E2D\u6BBF\u957F\u5ECA", labelEn: "Cathedral nave" },
          { value: "bright", label: "\u767D\u8F89\u5927\u5385", labelEn: "Bright hall" }
        ]
      },
      {
        key: "modelExit",
        type: "boolean",
        label: "\u6839\u636E\u6240\u9009\u6A21\u578B\u663E\u793A\u7ACB\u7ED8",
        labelEn: "Show artwork based on the selected model",
        defaultValue: false
      },
      {
        key: "composerMode",
        type: "select",
        label: "\u8F93\u5165\u6846\u663E\u793A\u65B9\u5F0F",
        labelEn: "Composer visibility mode",
        description: "\u59CB\u7EC8\u663E\u793A\uFF1B\u7A7A\u6001\u80F6\u56CA\u5728\u8F93\u5165\u6846\u4E3A\u7A7A\u4E14\u672A\u805A\u7126\u65F6\u6536\u8D77\u4E3A\u7B80\u7EA6\u80F6\u56CA\uFF1B\u6EDA\u52A8\u663E\u9690\u5728\u4E0A\u6EDA\u56DE\u987E\u65F6\u9690\u53BB\u3001\u4E0B\u6EDA\u6E10\u73B0\u3002",
        descriptionEn: "Always visible; the idle capsule collapses to a slim capsule while the composer is empty and unfocused; scroll mode hides it when scrolling up to review and reveals it when scrolling down.",
        defaultValue: "persistent",
        options: [
          { value: "persistent", label: "\u59CB\u7EC8\u663E\u793A", labelEn: "Always visible" },
          { value: "capsule", label: "\u7A7A\u6001\u80F6\u56CA\uFF08\u70B9\u51FB\u5C55\u5F00\uFF09", labelEn: "Idle capsule (click to expand)" },
          { value: "scroll", label: "\u4E0A\u6EDA\u9690\u53BB \xB7 \u4E0B\u6EDA\u6E10\u73B0", labelEn: "Hide on scroll up \xB7 show on scroll down" }
        ]
      }
    ],
    apply: apply3
  });
}

// src/client/table-card.ts
var PHOEBE_TABLE_SELECTOR = ".md-table-wide";
var SKIN_OWNER = "phoebe-atelier";
var EXPANDABLE_ATTRIBUTE = "data-phoebe-table-expandable";
var OPEN_ATTRIBUTE = "data-phoebe-table-open";
var FRAME_ATTRIBUTE = "data-phoebe-table-frame";
var CONTROL_ATTRIBUTE = "data-phoebe-table-expand";
var SCROLL_SUPPRESSED_ATTRIBUTE = "data-phoebe-table-scroll-suppressed";
var OVERLAY_ATTRIBUTE = "data-phoebe-table-lightbox";
var MODAL_DIALOG_SELECTOR = "[role='dialog'][aria-modal='true']";
var EXPANDED_HORIZONTAL_CHROME = 96;
var EXPANDED_MIN_WIDTH = 560;
var LIGHTBOX_EDGE_GAP = 56;
var attributeLeases = /* @__PURE__ */ new WeakMap();
var controlLeases = /* @__PURE__ */ new WeakMap();
function setLeasedAttribute(element, attribute, owner, active) {
  let attributes = attributeLeases.get(element);
  let lease = attributes?.get(attribute);
  if (active) {
    if (attributes === void 0) {
      attributes = /* @__PURE__ */ new Map();
      attributeLeases.set(element, attributes);
    }
    if (lease === void 0) {
      lease = { originalValue: element.getAttribute(attribute), owners: /* @__PURE__ */ new Set() };
      attributes.set(attribute, lease);
    }
    lease.owners.add(owner);
    element.setAttribute(attribute, "");
    return;
  }
  if (lease === void 0 || attributes === void 0) return;
  lease.owners.delete(owner);
  if (lease.owners.size > 0) {
    element.setAttribute(attribute, "");
    return;
  }
  if (element.getAttribute(attribute) === "") {
    if (lease.originalValue === null) element.removeAttribute(attribute);
    else element.setAttribute(attribute, lease.originalValue);
  }
  attributes.delete(attribute);
  if (attributes.size === 0) attributeLeases.delete(element);
}
function acquireControl(wrapper, owner, activate) {
  let lease = controlLeases.get(wrapper);
  if (lease === void 0) {
    const button = document.createElement("button");
    button.type = "button";
    button.hidden = true;
    button.setAttribute(CONTROL_ATTRIBUTE, "");
    button.dataset.skinOwner = SKIN_OWNER;
    button.setAttribute("aria-label", "\u5C55\u5F00\u8868\u683C\u9884\u89C8");
    button.title = "\u5C55\u5F00\u8868\u683C\u9884\u89C8";
    const owners = /* @__PURE__ */ new Map();
    const onClick = (event) => {
      if (!wrapper.hasAttribute(EXPANDABLE_ATTRIBUTE)) return;
      const current = Array.from(owners.values()).at(-1);
      if (current === void 0) return;
      event.stopPropagation();
      current();
    };
    button.addEventListener("click", onClick);
    lease = { button, owners, onClick };
    controlLeases.set(wrapper, lease);
  }
  lease.owners.set(owner, activate);
  try {
    if (lease.button.parentElement !== wrapper) wrapper.append(lease.button);
  } catch (error) {
    releaseControl(wrapper, owner);
    throw error;
  }
  return lease.button;
}
function releaseControl(wrapper, owner) {
  const lease = controlLeases.get(wrapper);
  if (lease === void 0) return;
  lease.owners.delete(owner);
  if (lease.owners.size > 0) return;
  lease.button.removeEventListener("click", lease.onClick);
  lease.button.remove();
  controlLeases.delete(wrapper);
}
function isForeignModalDialog(element) {
  return element.matches(MODAL_DIALOG_SELECTOR) && !element.hasAttribute(OVERLAY_ATTRIBUTE) && element.closest(`[${OVERLAY_ATTRIBUTE}]`) === null;
}
function installPhoebeTableCards(_ctx) {
  const owner = /* @__PURE__ */ Symbol("phoebe-table-card-activation");
  const bindings = /* @__PURE__ */ new Map();
  let observer;
  let resizeObserver;
  let overlay;
  const closingOverlays = /* @__PURE__ */ new Map();
  const release = (wrapper) => {
    const binding = bindings.get(wrapper);
    if (binding !== void 0) {
      wrapper.removeEventListener("pointerleave", binding.onPointerLeave);
      wrapper.removeEventListener("scroll", binding.onScroll);
      releaseControl(wrapper, owner);
      bindings.delete(wrapper);
    }
    resizeObserver?.unobserve(wrapper);
    setLeasedAttribute(wrapper, FRAME_ATTRIBUTE, owner, false);
    setLeasedAttribute(wrapper, EXPANDABLE_ATTRIBUTE, owner, false);
    setLeasedAttribute(wrapper, OPEN_ATTRIBUTE, owner, false);
    setLeasedAttribute(wrapper, SCROLL_SUPPRESSED_ATTRIBUTE, owner, false);
  };
  const closeOverlay = (immediate = false) => {
    if (overlay === void 0) return;
    const { root, source, onClick, onKeyDown } = overlay;
    overlay = void 0;
    setLeasedAttribute(source, OPEN_ATTRIBUTE, owner, false);
    root.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKeyDown);
    if (immediate) {
      root.remove();
      return;
    }
    root.dataset.phoebeTableClosing = "";
    const timer = window.setTimeout(() => {
      closingOverlays.delete(root);
      root.remove();
    }, 180);
    closingOverlays.set(root, timer);
  };
  const removeClosingOverlays = () => {
    for (const [root, timer] of closingOverlays) {
      clearTimeout(timer);
      root.remove();
    }
    closingOverlays.clear();
  };
  const hasForeignModalDialog = () => {
    return Array.from(document.querySelectorAll(MODAL_DIALOG_SELECTOR)).some(isForeignModalDialog);
  };
  const openOverlay = (wrapper) => {
    closeOverlay(true);
    removeClosingOverlays();
    if (hasForeignModalDialog()) return;
    const root = document.createElement("div");
    root.setAttribute(OVERLAY_ATTRIBUTE, "");
    root.dataset.skinOwner = SKIN_OWNER;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    const backdrop = document.createElement("div");
    backdrop.dataset.phoebeTableBackdrop = "";
    const panel = document.createElement("div");
    panel.dataset.phoebeTablePanel = "";
    const sourceTable = wrapper.querySelector("table");
    const naturalWidth = sourceTable?.scrollWidth ?? wrapper.scrollWidth;
    const availableWidth = Math.max(EXPANDED_MIN_WIDTH, window.innerWidth - LIGHTBOX_EDGE_GAP);
    const targetWidth = Math.min(
      availableWidth,
      Math.max(EXPANDED_MIN_WIDTH, Math.ceil(naturalWidth + EXPANDED_HORIZONTAL_CHROME))
    );
    panel.style.setProperty("--phoebe-table-expanded-width", `${targetWidth}px`);
    const close = document.createElement("button");
    close.type = "button";
    close.dataset.phoebeTableClose = "";
    close.setAttribute("aria-label", "\u5173\u95ED\u5C55\u5F00\u8868\u683C");
    const scroller = document.createElement("div");
    scroller.dataset.phoebeTableExpandedScroller = "";
    const clone = wrapper.cloneNode(true);
    clone.removeAttribute(FRAME_ATTRIBUTE);
    clone.removeAttribute(EXPANDABLE_ATTRIBUTE);
    clone.removeAttribute(OPEN_ATTRIBUTE);
    clone.removeAttribute(SCROLL_SUPPRESSED_ATTRIBUTE);
    clone.removeAttribute("tabindex");
    clone.removeAttribute("aria-label");
    clone.querySelector(`[${CONTROL_ATTRIBUTE}]`)?.remove();
    clone.dataset.phoebeTableExpanded = "";
    scroller.append(clone);
    panel.append(close, scroller);
    root.append(backdrop, panel);
    const onClick = (event) => {
      const target = event.target;
      if (target instanceof Element && (target.closest("[data-phoebe-table-close]") !== null || target.hasAttribute("data-phoebe-table-backdrop"))) {
        closeOverlay();
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeOverlay();
    };
    root.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    document.body.append(root);
    setLeasedAttribute(wrapper, OPEN_ATTRIBUTE, owner, true);
    overlay = { root, source: wrapper, onClick, onKeyDown };
    close.focus({ preventScroll: true });
  };
  const measure = (wrapper) => {
    if (!wrapper.isConnected) {
      release(wrapper);
      return;
    }
    const table = wrapper.querySelector("table");
    const viewport = wrapper.clientWidth;
    const natural = table?.scrollWidth ?? wrapper.scrollWidth;
    if (viewport > 0 && natural > viewport + 1) {
      setLeasedAttribute(wrapper, EXPANDABLE_ATTRIBUTE, owner, true);
    } else {
      setLeasedAttribute(wrapper, EXPANDABLE_ATTRIBUTE, owner, false);
    }
    const button = bindings.get(wrapper)?.button;
    if (button !== void 0) button.hidden = !wrapper.hasAttribute(EXPANDABLE_ATTRIBUTE);
  };
  const adopt = (wrapper) => {
    if (bindings.has(wrapper) || wrapper.closest(`[${OVERLAY_ATTRIBUTE}]`) !== null) return;
    const button = acquireControl(wrapper, owner, () => openOverlay(wrapper));
    const onScroll = () => {
      setLeasedAttribute(wrapper, SCROLL_SUPPRESSED_ATTRIBUTE, owner, true);
    };
    const onPointerLeave = () => {
      setLeasedAttribute(wrapper, SCROLL_SUPPRESSED_ATTRIBUTE, owner, false);
    };
    bindings.set(wrapper, {
      button,
      onPointerLeave,
      onScroll
    });
    try {
      setLeasedAttribute(wrapper, FRAME_ATTRIBUTE, owner, true);
      wrapper.addEventListener("pointerleave", onPointerLeave);
      wrapper.addEventListener("scroll", onScroll, { passive: true });
      resizeObserver?.observe(wrapper);
      measure(wrapper);
    } catch (error) {
      release(wrapper);
      throw error;
    }
  };
  const runtime = {
    dispose() {
      closeOverlay(true);
      removeClosingOverlays();
      observer?.disconnect();
      resizeObserver?.disconnect();
      resizeObserver = void 0;
      for (const wrapper of [...bindings.keys()]) release(wrapper);
      bindings.clear();
    }
  };
  try {
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          measure(entry.target);
        }
      });
    }
    observer = new MutationObserver((records) => {
      let sawForeignModal = false;
      for (const record of records) {
        if (record.target instanceof HTMLElement) {
          const binding = bindings.get(record.target);
          if (binding !== void 0 && binding.button.parentElement !== record.target) {
            record.target.append(binding.button);
          }
        }
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (isForeignModalDialog(node) || Array.from(node.querySelectorAll(MODAL_DIALOG_SELECTOR)).some(isForeignModalDialog)) {
            sawForeignModal = true;
          }
          if (node.matches(PHOEBE_TABLE_SELECTOR)) adopt(node);
          else if (node.querySelectorAll(PHOEBE_TABLE_SELECTOR).length > 0) {
            node.querySelectorAll(PHOEBE_TABLE_SELECTOR).forEach(adopt);
          }
        }
      }
      if (sawForeignModal && overlay !== void 0) closeOverlay(true);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll(PHOEBE_TABLE_SELECTOR).forEach(adopt);
    return runtime;
  } catch (error) {
    runtime.dispose();
    throw error;
  }
}

// src/client/index.ts
window.__BRAND_BUNDLE_VERSION = "v-final";
var SKIN_TITLE = "\u8F89\u5F26\u5723\u5802 \xB7 \u83F2\u6BD4 \xB7 DeepSeek Harness";
var SKIN_OWNER2 = "phoebe-atelier";
var SKIN_SYSTEM_CHROME_COLOR = "#10152c";
var VIEWPORT_RESIZE_SETTLE_MS = 120;
var SIDEBAR_COLUMN_SELECTOR = ":is([data-pane='sidebar'], [class*='sidebarCol'])";
var CONVERSATION_COLUMN_SELECTOR = ":is([data-pane='conversation'], [class*='centerCol'])";
var SETTINGS_MASK_SELECTOR = "[role='presentation'] > [class*='mask']";
var SETTINGS_DIALOG_SELECTOR = "[data-slot='sidebar.settings'] [role='dialog'][aria-modal='true']";
var ACTIVE_CONVERSATION_SELECTOR = "[data-phase='active']";
var ACTIVE_CHAT_SELECTOR = `${ACTIVE_CONVERSATION_SELECTOR} [data-chat-flow]`;
var WORKSPACE_SELECTOR = "header [role='tablist']";
var CORDIS_PANEL_SELECTOR = "[data-cordis-panel]";
var TERMINAL_SELECTOR = ".xterm";
var bodyAttributeLeases = /* @__PURE__ */ new WeakMap();
function createBodyAttributeLease(body, attribute, value = "") {
  const owner = Symbol(attribute);
  let active = false;
  return {
    acquire() {
      if (active) return;
      let attributes = bodyAttributeLeases.get(body);
      if (attributes === void 0) {
        attributes = /* @__PURE__ */ new Map();
        bodyAttributeLeases.set(body, attributes);
      }
      let state = attributes.get(attribute);
      if (state === void 0) {
        state = {
          originalValue: body.getAttribute(attribute),
          owners: /* @__PURE__ */ new Set(),
          value
        };
        attributes.set(attribute, state);
      }
      state.owners.add(owner);
      active = true;
      body.setAttribute(attribute, state.value);
    },
    release() {
      if (!active) return;
      active = false;
      const attributes = bodyAttributeLeases.get(body);
      const state = attributes?.get(attribute);
      if (state === void 0 || !state.owners.delete(owner)) return;
      if (state.owners.size > 0) {
        body.setAttribute(attribute, state.value);
        return;
      }
      attributes?.delete(attribute);
      if (attributes?.size === 0) bodyAttributeLeases.delete(body);
      if (body.getAttribute(attribute) !== state.value) return;
      if (state.originalValue === null) body.removeAttribute(attribute);
      else body.setAttribute(attribute, state.originalValue);
    }
  };
}
var PROJECTED_STATE_ATTRIBUTES = {
  activeChat: "data-phoebe-chat-active",
  activeConversation: "data-phoebe-conversation-active",
  cordisPanelOpen: "data-phoebe-cordis-panel-open",
  settingsOpen: "data-phoebe-settings-open",
  workspace: "data-phoebe-workspace"
};
var PROJECTED_STATE_SELECTOR = [
  ACTIVE_CONVERSATION_SELECTOR,
  "[data-chat-flow]",
  WORKSPACE_SELECTOR,
  CORDIS_PANEL_SELECTOR,
  "[data-slot='sidebar.settings']"
].join(", ");
var WORKSPACE_FLAGS = [
  "data-phoebe-workspace-group",
  "data-phoebe-workspace-row",
  "data-phoebe-workspace-active",
  "data-phoebe-session-row",
  "data-phoebe-session-flat",
  "data-phoebe-session-first",
  "data-phoebe-session-last"
];
var WORKSPACE_FLAG_SELECTOR = WORKSPACE_FLAGS.map((flag) => `[${flag}]`).join(", ");
var userClickedWorkspaceKey = null;
var SIDEBAR_FOOTER_FLAG = "data-phoebe-sidebar-footer";
var BACKDROP_PROPERTIES = [
  "--phoebe-palace-art",
  "--phoebe-sidebar-width",
  "--phoebe-top-trim-art",
  "--phoebe-bottom-trim-art",
  "--phoebe-bottom-crest-art",
  "--phoebe-bow-art",
  "--phoebe-new-session-art",
  "--phoebe-sidebar-swag-art",
  "--phoebe-sidebar-corner-art",
  "--phoebe-composer-frame-art",
  "--phoebe-frame-gem-art",
  "--phoebe-frame-gem-v-art",
  "--phoebe-scene-altar-art",
  "--phoebe-scene-nave-art",
  "--phoebe-scene-bright-art",
  "--phoebe-settings-frame-art",
  "--phoebe-workspace-crest-art",
  "--phoebe-workspace-ribbon-art"
];
function createCharacterStage() {
  const stage = document.createElement("div");
  stage.dataset.skinChrome = "character-stage";
  stage.dataset.skinOwner = SKIN_OWNER2;
  stage.setAttribute("aria-hidden", "true");
  const left = document.createElement("img");
  left.dataset.phoebeCharacter = "left";
  left.alt = "";
  left.src = PHOEBE_ATELIER_MAIN_LEFT;
  const right = document.createElement("img");
  right.dataset.phoebeCharacter = "right";
  right.alt = "";
  right.src = PHOEBE_ATELIER_MAIN_RIGHT;
  const vision = document.createElement("img");
  vision.dataset.phoebeCharacter = "vision";
  vision.alt = "";
  vision.src = PHOEBE_ATELIER_MAIN_RIGHT_VISION;
  stage.append(left, right, vision);
  return stage;
}
function ensureChatAreaStage(stage) {
  const chat = document.querySelector(CONVERSATION_COLUMN_SELECTOR);
  if (!chat) return false;
  if (stage.parentElement !== chat) chat.prepend(stage);
  return true;
}
function ensureChatAreaChrome(...chrome) {
  const chat = document.querySelector(CONVERSATION_COLUMN_SELECTOR);
  if (!chat) return false;
  for (const element of chrome) {
    if (element.parentElement !== chat) chat.append(element);
  }
  return true;
}
function hasAcceleratedWebGL() {
  if (typeof WebGLRenderingContext === "undefined") return false;
  const canvas = document.createElement("canvas");
  const options = { failIfMajorPerformanceCaveat: true };
  for (const kind of ["webgl2", "webgl"]) {
    try {
      const context = canvas.getContext(kind, options);
      if (context === null) continue;
      context.getExtension("WEBGL_lose_context")?.loseContext();
      return true;
    } catch {
    }
  }
  return false;
}
function createSidebarCorners() {
  const corners = document.createElement("div");
  corners.dataset.skinChrome = "sidebar-corners";
  corners.dataset.skinOwner = SKIN_OWNER2;
  corners.setAttribute("aria-hidden", "true");
  for (const position of ["top-left", "top-right", "bottom-right", "bottom-left"]) {
    const corner = document.createElement("span");
    corner.dataset.skinCorner = position;
    corners.append(corner);
  }
  return corners;
}
function decorateTitlebarBrand(ownedNodes) {
  const titlebar = document.querySelector("[class*='titlebar']");
  if (!titlebar) return;
  if (titlebar.querySelector("[data-skin-chrome='titlebar-brand']")) return;
  const brand = document.createElement("span");
  brand.dataset.skinChrome = "titlebar-brand";
  brand.dataset.skinOwner = SKIN_OWNER2;
  brand.setAttribute("aria-hidden", "true");
  brand.innerHTML = PHOEBE_ATELIER_TITLEBAR_BRAND;
  ownedNodes.add(brand);
  titlebar.prepend(brand);
}
function decorateSidebar(ownedNodes, decoratedElements) {
  const sidebar = document.querySelector(SIDEBAR_COLUMN_SELECTOR);
  const sidebarRoot = sidebar?.querySelector(":scope > div");
  if (!sidebar || !sidebarRoot) return;
  const settingsSlot = sidebar.querySelector("[data-slot='sidebar.settings']");
  let footer;
  if (settingsSlot) {
    let candidate = settingsSlot.parentElement;
    while (candidate && candidate !== sidebar) {
      if (candidate.querySelector("[data-slot='sidebar.footer.action']")) {
        footer = candidate;
        break;
      }
      candidate = candidate.parentElement;
    }
  }
  sidebar.querySelectorAll(`[${SIDEBAR_FOOTER_FLAG}]`).forEach((element) => {
    if (element === footer) return;
    delete element.dataset.phoebeSidebarFooter;
    decoratedElements.delete(element);
  });
  if (footer && !footer.hasAttribute(SIDEBAR_FOOTER_FLAG)) {
    footer.dataset.phoebeSidebarFooter = "";
    decoratedElements.add(footer);
  }
  if (!sidebarRoot.querySelector("[data-skin-chrome='sidebar-corners']")) {
    const corners = createSidebarCorners();
    ownedNodes.add(corners);
    sidebarRoot.prepend(corners);
  }
  if (!sidebarRoot.querySelector("[data-skin-chrome='sidebar-mascot']")) {
    const mascot = document.createElement("img");
    mascot.dataset.skinChrome = "sidebar-mascot";
    mascot.dataset.skinOwner = SKIN_OWNER2;
    mascot.setAttribute("aria-hidden", "true");
    mascot.alt = "";
    mascot.src = PHOEBE_ATELIER_CHIBI;
    ownedNodes.add(mascot);
    sidebarRoot.prepend(mascot);
  }
}
function decorateWorkspaceTree(decoratedElements) {
  const sidebar = document.querySelector(SIDEBAR_COLUMN_SELECTOR);
  if (!sidebar) return;
  const current = /* @__PURE__ */ new Map();
  sidebar.querySelectorAll(WORKSPACE_FLAG_SELECTOR).forEach((element) => {
    const flags = /* @__PURE__ */ new Set();
    for (const flag of WORKSPACE_FLAGS) {
      if (element.hasAttribute(flag)) flags.add(flag);
    }
    current.set(element, flags);
  });
  const desired = /* @__PURE__ */ new Map();
  const claim = (element, flag) => {
    let flags = desired.get(element);
    if (!flags) {
      flags = /* @__PURE__ */ new Set();
      desired.set(element, flags);
    }
    flags.add(flag);
  };
  sidebar.querySelectorAll("[role='tree']").forEach((tree) => {
    const rows = [...tree.querySelectorAll("[role='treeitem']")];
    if (tree.matches("[class*='flatList']") && !rows.some((row) => row.hasAttribute("aria-expanded"))) {
      rows.filter((row) => row.hasAttribute("aria-selected")).forEach((sessionRow) => {
        claim(sessionRow, "data-phoebe-session-row");
        claim(sessionRow, "data-phoebe-session-flat");
      });
      return;
    }
    let workspaceRow;
    let sessionRows = [];
    const groups = [];
    rows.forEach((row) => {
      if (row.hasAttribute("aria-expanded")) {
        if (workspaceRow) groups.push({ row: workspaceRow, sessions: sessionRows });
        workspaceRow = row;
        sessionRows = [];
      } else if (workspaceRow && row.hasAttribute("aria-selected")) {
        sessionRows.push(row);
      }
    });
    if (workspaceRow) groups.push({ row: workspaceRow, sessions: sessionRows });
    const selectedGroup = groups.find((group) => group.row.getAttribute("aria-expanded") === "true" && group.sessions.some((sessionRow) => sessionRow.getAttribute("aria-selected") === "true"));
    const pointedGroup = userClickedWorkspaceKey === null ? void 0 : groups.find((group) => group.row.textContent?.trim() === userClickedWorkspaceKey);
    const activeGroup = pointedGroup ?? selectedGroup;
    groups.forEach((group) => {
      claim(group.row, "data-phoebe-workspace-row");
      if (group.row.parentElement) {
        claim(group.row.parentElement, "data-phoebe-workspace-group");
      }
      group.sessions.forEach((sessionRow) => {
        claim(sessionRow, "data-phoebe-session-row");
      });
      if (group.sessions[0]) claim(group.sessions[0], "data-phoebe-session-first");
      if (group.sessions.at(-1)) claim(group.sessions.at(-1), "data-phoebe-session-last");
      if (group === activeGroup) claim(group.row, "data-phoebe-workspace-active");
    });
  });
  const touched = /* @__PURE__ */ new Set([...current.keys(), ...desired.keys()]);
  for (const element of touched) {
    const before = current.get(element);
    const after = desired.get(element);
    if (before !== void 0) {
      for (const flag of before) {
        if (!after?.has(flag)) element.removeAttribute(flag);
      }
    }
    if (after !== void 0) {
      for (const flag of after) {
        if (!before?.has(flag)) element.setAttribute(flag, "");
      }
      if (after.size > 0) decoratedElements.add(element);
    }
  }
}
function ensureComposerBrand(ownedNodes) {
  ;
  window.__EB_CALLED = (window.__EB_CALLED || 0) + 1;
  const phaseRoot = document.querySelector(
    "[data-phase='hero'], [data-phase='active'], [data-phase='settling']"
  );
  if (!phaseRoot) {
    return false;
  }
  const seat = phaseRoot.querySelector("[data-composer-seat]");
  if (!seat) {
    return false;
  }
  const existing = phaseRoot.querySelector("[data-skin-chrome='composer-brand']");
  if (existing && existing.parentElement === seat.parentElement) return true;
  existing?.remove();
  const brand = document.createElement("div");
  brand.dataset.skinChrome = "composer-brand";
  brand.dataset.skinOwner = SKIN_OWNER2;
  brand.setAttribute("aria-hidden", "true");
  brand.innerHTML = PHOEBE_ATELIER_COMPOSER_BRAND;
  seat.parentElement?.insertBefore(brand, seat);
  ownedNodes.add(brand);
  return true;
}
function apply(ctx) {
  const body = document.body;
  ctx.effect(() => installPhoebeCustomization(), "ui-skin-phoebe-atelier: customization declaration");
  const originalTitle = document.title;
  const layoutResizeLease = createBodyAttributeLease(body, "data-phoebe-layout-resizing");
  const lowPowerLease = createBodyAttributeLease(body, "data-phoebe-low-power");
  const previous = /* @__PURE__ */ new Map();
  for (const property of BACKDROP_PROPERTIES) {
    previous.set(property, body.style.getPropertyValue(property));
  }
  const previousProjectedStates = /* @__PURE__ */ new Map();
  for (const attribute of Object.values(PROJECTED_STATE_ATTRIBUTES)) {
    previousProjectedStates.set(attribute, body.getAttribute(attribute));
  }
  const ownedNodes = /* @__PURE__ */ new Set();
  const decoratedElements = /* @__PURE__ */ new Set();
  const characterStage = createCharacterStage();
  ownedNodes.add(characterStage);
  let themeColorMeta = null;
  let previousThemeColor;
  let themeColorObserver;
  let observedSidebar;
  let resizeObserver;
  let composerPhase;
  let composerMotionTimer;
  let viewportResizeTimer;
  let handleViewportResize;
  let railSearchFocusFrame;
  let recoverRailSearchFocus;
  let trackWorkspacePointer;
  let settingsBackdropFrame;
  let observer;
  let titlebarOverlay;
  let syncTitlebarHeight;
  let disposePhoebeTableCards = () => {
  };
  ctx.effect(() => () => {
    delete body.dataset.dshPhoebeAtelier;
    delete body.dataset.phoebeComposerMotion;
    delete body.dataset.phoebeSidebarCompact;
    delete body.dataset.phoebeSidebarSize;
    delete body.dataset.phoebeListOverflow;
    for (const [attribute, value] of previousProjectedStates) {
      if (value === null) body.removeAttribute(attribute);
      else body.setAttribute(attribute, value);
    }
    disposePhoebeComposerCapsule();
    disposePhoebeComposerScroll();
    disposePhoebeTableCards();
    if (composerMotionTimer !== void 0) clearTimeout(composerMotionTimer);
    if (viewportResizeTimer !== void 0) clearTimeout(viewportResizeTimer);
    if (handleViewportResize !== void 0) window.removeEventListener("resize", handleViewportResize);
    layoutResizeLease.release();
    lowPowerLease.release();
    if (railSearchFocusFrame !== void 0) cancelAnimationFrame(railSearchFocusFrame);
    if (recoverRailSearchFocus !== void 0) {
      document.removeEventListener("click", recoverRailSearchFocus);
    }
    if (trackWorkspacePointer !== void 0) {
      document.removeEventListener("click", trackWorkspacePointer);
    }
    userClickedWorkspaceKey = null;
    observer?.disconnect();
    themeColorObserver?.disconnect();
    if (titlebarOverlay !== void 0 && syncTitlebarHeight !== void 0) {
      titlebarOverlay.removeEventListener("geometrychange", syncTitlebarHeight);
    }
    resizeObserver?.disconnect();
    for (const [property, value] of previous) {
      if (value === "") body.style.removeProperty(property);
      else body.style.setProperty(property, value);
    }
    if (body.getAttribute("style") === "") body.removeAttribute("style");
    ownedNodes.forEach((element) => element.remove());
    decoratedElements.forEach((element) => {
      delete element.dataset.phoebeSidebarFooter;
      delete element.dataset.phoebeWorkspaceGroup;
      delete element.dataset.phoebeWorkspaceRow;
      delete element.dataset.phoebeWorkspaceActive;
      delete element.dataset.phoebeSessionRow;
      delete element.dataset.phoebeSessionFlat;
      delete element.dataset.phoebeSessionFirst;
      delete element.dataset.phoebeSessionLast;
    });
    if (themeColorMeta?.isConnected && themeColorMeta.content === SKIN_SYSTEM_CHROME_COLOR) {
      themeColorMeta.content = previousThemeColor ?? "";
    }
    if (document.title === SKIN_TITLE) document.title = originalTitle;
  }, "ui-skin-phoebe-atelier: layered background and ornament");
  handleViewportResize = () => {
    layoutResizeLease.acquire();
    if (viewportResizeTimer !== void 0) clearTimeout(viewportResizeTimer);
    viewportResizeTimer = setTimeout(() => {
      layoutResizeLease.release();
      viewportResizeTimer = void 0;
    }, VIEWPORT_RESIZE_SETTLE_MS);
  };
  window.addEventListener("resize", handleViewportResize);
  if (!hasAcceleratedWebGL()) lowPowerLease.acquire();
  const syncSystemChrome = () => {
    const meta = document.head.querySelector('meta[name="theme-color"]');
    if (meta === null) return;
    if (meta !== themeColorMeta) {
      themeColorMeta = meta;
      previousThemeColor = meta.content;
    }
    if (meta.content !== SKIN_SYSTEM_CHROME_COLOR) meta.content = SKIN_SYSTEM_CHROME_COLOR;
  };
  themeColorObserver = new MutationObserver(syncSystemChrome);
  themeColorObserver.observe(document.head, {
    attributes: true,
    attributeFilter: ["content"],
    childList: true,
    subtree: true
  });
  syncSystemChrome();
  body.dataset.dshPhoebeAtelier = "";
  const disposePhoebeComposerCapsule = installPhoebeComposerCapsule(body);
  const disposePhoebeComposerScroll = installPhoebeComposerScroll(body);
  disposePhoebeTableCards = installPhoebeTableCards(ctx).dispose;
  body.style.setProperty("--phoebe-top-trim-art", `url(${PHOEBE_ATELIER_TOP_TRIM_TILE})`);
  body.style.setProperty("--phoebe-bottom-trim-art", `url(${PHOEBE_ATELIER_BOTTOM_TRIM_TILE})`);
  body.style.setProperty("--phoebe-bottom-crest-art", `url(${PHOEBE_ATELIER_BOTTOM_CREST})`);
  body.style.setProperty("--phoebe-bow-art", `url(${PHOEBE_ATELIER_BOW_CLEAN})`);
  body.style.setProperty("--phoebe-new-session-art", `url(${PHOEBE_ATELIER_NEW_SESSION})`);
  body.style.setProperty("--phoebe-sidebar-swag-art", `url(${PHOEBE_ATELIER_SIDEBAR_SWAG})`);
  body.style.setProperty("--phoebe-sidebar-corner-art", `url(${PHOEBE_ATELIER_SIDEBAR_CORNER})`);
  body.style.setProperty("--phoebe-composer-frame-art", `url(${PHOEBE_ATELIER_COMPOSER_FRAME})`);
  body.style.setProperty("--phoebe-frame-gem-art", `url(${PHOEBE_ATELIER_FRAME_GEM})`);
  body.style.setProperty("--phoebe-frame-gem-v-art", `url(${PHOEBE_ATELIER_FRAME_GEM_V})`);
  body.style.setProperty("--phoebe-scene-altar-art", `url(${PHOEBE_ATELIER_SCENE_ALTAR_HEART})`);
  body.style.setProperty("--phoebe-scene-nave-art", `url(${PHOEBE_ATELIER_SCENE_NAVE})`);
  body.style.setProperty("--phoebe-scene-bright-art", `url(${PHOEBE_ATELIER_SCENE_BRIGHT})`);
  body.style.setProperty("--phoebe-settings-frame-art", `url(${PHOEBE_ATELIER_SETTINGS_FRAME})`);
  body.style.setProperty("--phoebe-workspace-crest-art", `url(${PHOEBE_ATELIER_WORKSPACE_SHIELD})`);
  body.style.setProperty("--phoebe-workspace-ribbon-art", `url(${PHOEBE_ATELIER_WORKSPACE_RIBBON})`);
  const syncBackdrop = () => {
    const source = body.hasAttribute("data-ds-dark-theme") ? PHOEBE_ATELIER_PALACE_DARK : PHOEBE_ATELIER_PALACE_LIGHT;
    const next = `url(${source})`;
    if (body.style.getPropertyValue("--phoebe-palace-art") !== next) {
      body.style.setProperty("--phoebe-palace-art", next);
    }
  };
  syncBackdrop();
  const widthSheet = document.createElement("style");
  widthSheet.dataset.skinChrome = "sidebar-width-rule";
  widthSheet.dataset.skinOwner = SKIN_OWNER2;
  ownedNodes.add(widthSheet);
  document.head.append(widthSheet);
  widthSheet.sheet.insertRule("body { --phoebe-sidebar-width: 280px; --phoebe-sidebar-swag-height: 72.1px; --phoebe-sidebar-mascot-width: 229.6px; --phoebe-sidebar-corner-size: 100px; --phoebe-titlebar-height: 0px; }");
  const appendRule = (rule) => {
    widthSheet.sheet.insertRule(rule, widthSheet.sheet.cssRules.length);
  };
  appendRule('body[data-dsh-phoebe-atelier] [class*="frame"][data-wco] { grid-template-rows: env(titlebar-area-height, 40px) 1fr; }');
  appendRule('body[data-dsh-phoebe-atelier] [class*="frame"][data-desktop] { grid-template-rows: 32px 1fr; }');
  appendRule('body[data-dsh-phoebe-atelier] [class*="frame"] [class*="handle"] { top: var(--phoebe-titlebar-height, 0px); }');
  const widthRule = widthSheet.sheet.cssRules[0];
  syncTitlebarHeight = () => {
    const columns = document.querySelector(SIDEBAR_COLUMN_SELECTOR);
    if (columns !== null) {
      const top = columns.getBoundingClientRect().top;
      if (top > 0) {
        if (widthRule.style.getPropertyValue("--phoebe-titlebar-height") !== `${top}px`) {
          widthRule.style.setProperty("--phoebe-titlebar-height", `${top}px`);
        }
        return;
      }
    }
    if (document.querySelector("[class*='frame'][data-desktop]") !== null) {
      widthRule.style.setProperty("--phoebe-titlebar-height", "32px");
      return;
    }
    widthRule.style.setProperty("--phoebe-titlebar-height", "0px");
  };
  titlebarOverlay = navigator.windowControlsOverlay;
  titlebarOverlay?.addEventListener("geometrychange", syncTitlebarHeight);
  syncTitlebarHeight();
  const applySidebarWidth = (width) => {
    if (width <= 0) return;
    const roundPx = (value) => `${Math.round(value * 100) / 100}px`;
    const nextSize = width <= 120 ? "rail" : width <= 220 ? "narrow" : "wide";
    const compact = width <= 104;
    if (roundPx(width) === widthRule.style.getPropertyValue("--phoebe-sidebar-width") && body.dataset.phoebeSidebarSize === nextSize && body.hasAttribute("data-phoebe-sidebar-compact") === compact) {
      return;
    }
    widthRule.style.setProperty("--phoebe-sidebar-width", roundPx(width));
    widthRule.style.setProperty("--phoebe-sidebar-swag-height", roundPx(Math.min(94, Math.max(54, width * 0.2575))));
    widthRule.style.setProperty("--phoebe-sidebar-mascot-width", roundPx(Math.min(320, width * 0.82)));
    widthRule.style.setProperty("--phoebe-sidebar-corner-size", roundPx(Math.min(110, Math.max(64, width * 0.36))));
    body.dataset.phoebeSidebarSize = nextSize;
    if (compact) body.dataset.phoebeSidebarCompact = "";
    else delete body.dataset.phoebeSidebarCompact;
  };
  const clearSidebarWidth = () => {
    widthRule.style.setProperty("--phoebe-sidebar-width", "0px");
    widthRule.style.setProperty("--phoebe-sidebar-swag-height", "54px");
    widthRule.style.setProperty("--phoebe-sidebar-mascot-width", "0px");
    widthRule.style.setProperty("--phoebe-sidebar-corner-size", "0px");
    body.dataset.phoebeSidebarSize = "rail";
    body.dataset.phoebeSidebarCompact = "";
  };
  const syncProjectedState = () => {
    const set = (attribute, active) => {
      body.toggleAttribute(attribute, active);
    };
    set(
      PROJECTED_STATE_ATTRIBUTES.activeChat,
      document.querySelector(ACTIVE_CHAT_SELECTOR) !== null
    );
    set(
      PROJECTED_STATE_ATTRIBUTES.activeConversation,
      document.querySelector(ACTIVE_CONVERSATION_SELECTOR) !== null
    );
    set(
      PROJECTED_STATE_ATTRIBUTES.workspace,
      document.querySelector(WORKSPACE_SELECTOR) !== null
    );
    set(
      PROJECTED_STATE_ATTRIBUTES.cordisPanelOpen,
      document.querySelector(CORDIS_PANEL_SELECTOR) !== null
    );
    set(
      PROJECTED_STATE_ATTRIBUTES.settingsOpen,
      document.querySelector(SETTINGS_DIALOG_SELECTOR) !== null
    );
  };
  let observedChatArea;
  const ensureResizeObserved = () => {
    if (!resizeObserver) return;
    const sidebar = document.querySelector(SIDEBAR_COLUMN_SELECTOR);
    if (sidebar !== observedSidebar) {
      if (observedSidebar) resizeObserver.unobserve(observedSidebar);
      observedSidebar = sidebar ?? void 0;
      if (sidebar) resizeObserver.observe(sidebar);
    }
    const chat = document.querySelector(CONVERSATION_COLUMN_SELECTOR);
    if (chat !== observedChatArea) {
      if (observedChatArea) resizeObserver.unobserve(observedChatArea);
      observedChatArea = chat ?? void 0;
      if (chat) resizeObserver.observe(chat);
    }
  };
  recoverRailSearchFocus = (event) => {
    const target = event.target instanceof Element ? event.target.closest("button[class*='searchButton']") : null;
    const railSearch = target?.closest("[class*='search']");
    if (target === null || railSearch === null || railSearch.querySelector("input[class*='searchInput']") !== null) return;
    if (railSearchFocusFrame !== void 0) cancelAnimationFrame(railSearchFocusFrame);
    const startedAt = performance.now();
    const recover = () => {
      railSearchFocusFrame = void 0;
      const input = document.querySelector(
        `${SIDEBAR_COLUMN_SELECTOR} input[class*='searchInput']`
      );
      const searchRoot = input?.closest("[class*='search']");
      if (input !== null && input !== void 0 && searchRoot !== null && searchRoot !== void 0) {
        searchRoot.click();
        input.focus({ preventScroll: true });
        return;
      }
      if (performance.now() - startedAt < 500) {
        railSearchFocusFrame = requestAnimationFrame(recover);
      }
    };
    railSearchFocusFrame = requestAnimationFrame(recover);
  };
  document.addEventListener("click", recoverRailSearchFocus);
  trackWorkspacePointer = (event) => {
    const target = event.target instanceof Element ? event.target.closest('[role="treeitem"]') : null;
    const sidebar = target?.closest(SIDEBAR_COLUMN_SELECTOR);
    if (target === null || sidebar === null) return;
    if (target.hasAttribute("aria-expanded")) {
      const key = target.textContent?.trim() ?? null;
      if (userClickedWorkspaceKey !== key) {
        userClickedWorkspaceKey = key;
        decorateWorkspaceTree(decoratedElements);
      }
    } else if (target.hasAttribute("aria-selected") && userClickedWorkspaceKey !== null) {
      userClickedWorkspaceKey = null;
      decorateWorkspaceTree(decoratedElements);
    }
  };
  document.addEventListener("click", trackWorkspacePointer);
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === observedSidebar) {
          applySidebarWidth(entry.contentRect.width);
          syncListOverflow();
        } else if (entry.target === observedChatArea) handleViewportResize?.();
      }
    });
  }
  const syncComposerMotion = () => {
    const phaseRoot = document.querySelector("[data-phase='hero'], [data-phase='active']");
    const next = phaseRoot?.dataset.phase;
    if (next !== "hero" && next !== "active") return;
    if (composerPhase !== void 0 && composerPhase !== next) {
      body.dataset.phoebeComposerMotion = next === "active" ? "dock" : "rise";
      if (composerMotionTimer !== void 0) clearTimeout(composerMotionTimer);
      composerMotionTimer = setTimeout(() => {
        delete body.dataset.phoebeComposerMotion;
        composerMotionTimer = void 0;
      }, 560);
    }
    composerPhase = next;
  };
  const syncSettingsBackdropFrame = () => {
    const dialog = document.querySelector(SETTINGS_DIALOG_SELECTOR);
    const mask = dialog === null ? null : document.querySelector(SETTINGS_MASK_SELECTOR);
    const overlay = mask?.parentElement;
    if (overlay === void 0 || overlay === null) {
      settingsBackdropFrame?.remove();
      return;
    }
    if (settingsBackdropFrame === void 0) {
      settingsBackdropFrame = createSidebarCorners();
      settingsBackdropFrame.dataset.phoebeSettingsBackdropFrame = "";
      ownedNodes.add(settingsBackdropFrame);
    }
    if (settingsBackdropFrame.parentElement !== overlay) {
      overlay.insertBefore(settingsBackdropFrame, mask);
    }
  };
  const topTrim = document.createElement("div");
  topTrim.dataset.skinChrome = "top-trim";
  topTrim.dataset.skinOwner = SKIN_OWNER2;
  topTrim.setAttribute("aria-hidden", "true");
  const landingTrimLayer = document.createElement("div");
  landingTrimLayer.dataset.skinTrimLayer = "landing";
  const workspaceTrimLayer = document.createElement("div");
  workspaceTrimLayer.dataset.skinTrimLayer = "workspace";
  topTrim.append(landingTrimLayer, workspaceTrimLayer);
  ownedNodes.add(topTrim);
  const bottomTrim = document.createElement("div");
  bottomTrim.dataset.skinChrome = "bottom-trim";
  bottomTrim.dataset.skinOwner = SKIN_OWNER2;
  bottomTrim.setAttribute("aria-hidden", "true");
  ownedNodes.add(bottomTrim);
  decorateTitlebarBrand(ownedNodes);
  decorateSidebar(ownedNodes, decoratedElements);
  decorateWorkspaceTree(decoratedElements);
  ensureChatAreaStage(characterStage);
  ensureChatAreaChrome(topTrim, bottomTrim);
  ensureComposerBrand(ownedNodes);
  ensureResizeObserved();
  const initialSidebar = document.querySelector(SIDEBAR_COLUMN_SELECTOR);
  if (initialSidebar) applySidebarWidth(initialSidebar.getBoundingClientRect().width);
  syncComposerMotion();
  syncSettingsBackdropFrame();
  syncProjectedState();
  const syncSidebarDecorations = () => {
    syncTitlebarHeight?.();
    decorateTitlebarBrand(ownedNodes);
    decorateSidebar(ownedNodes, decoratedElements);
    decorateWorkspaceTree(decoratedElements);
    ensureChatAreaStage(characterStage);
    ensureChatAreaChrome(topTrim, bottomTrim);
    ensureComposerBrand(ownedNodes);
    ensureResizeObserved();
    const sidebar = document.querySelector(SIDEBAR_COLUMN_SELECTOR);
    if (sidebar === null) clearSidebarWidth();
    else if (resizeObserver === void 0) applySidebarWidth(sidebar.getBoundingClientRect().width);
    syncListOverflow();
  };
  const syncListOverflow = () => {
    const sidebar = document.querySelector(SIDEBAR_COLUMN_SELECTOR);
    const mascot = document.querySelector("[data-skin-chrome='sidebar-mascot']");
    if (sidebar === null || mascot === null || !mascot.isConnected) return;
    const mascotRect = mascot.getBoundingClientRect();
    let overlap = false;
    for (const row of sidebar.querySelectorAll('[role="treeitem"]')) {
      const rect = row.getBoundingClientRect();
      if (rect.height === 0) continue;
      if (rect.bottom >= mascotRect.top && rect.top <= mascotRect.bottom) {
        overlap = true;
        break;
      }
    }
    const current = body.getAttribute("data-phoebe-list-overflow");
    if (overlap && current === null) body.dataset.phoebeListOverflow = "";
    else if (!overlap && current !== null) delete body.dataset.phoebeListOverflow;
  };
  const isSkinChrome = (node) => node instanceof Element && node.getAttribute("data-skin-owner") === SKIN_OWNER2;
  const nodeTouches = (node, selector) => node instanceof Element && (node.matches(selector) || node.querySelector(selector) !== null);
  const sidebarChromeSelector = `${SIDEBAR_COLUMN_SELECTOR}, [class*='titlebar']`;
  const composerSelector = "[data-phase='hero'], [data-phase='active']";
  observer = new MutationObserver((records) => {
    let sidebarStructureChanged = false;
    let workspaceStateChanged = false;
    let backdropChanged = false;
    let composerChanged = false;
    let chatStructureChanged = false;
    let settingsStateChanged = false;
    let projectedStateChanged = false;
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : void 0;
      if (target?.closest(TERMINAL_SELECTOR) !== null) continue;
      if (record.type === "attributes") {
        if (record.attributeName === "aria-expanded" && target !== void 0 && target.closest("[data-slot='sidebar.settings']") !== null) {
          settingsStateChanged = true;
          projectedStateChanged = true;
        } else if ((record.attributeName === "aria-expanded" || record.attributeName === "aria-selected") && target !== void 0 && target.closest(SIDEBAR_COLUMN_SELECTOR) !== null) {
          workspaceStateChanged = true;
        } else if (record.attributeName === "data-ds-dark-theme" && record.target === body) {
          backdropChanged = true;
        } else if (record.attributeName === "data-phase") {
          composerChanged = true;
        }
        if (record.attributeName === "data-phase" || record.attributeName === "data-chat-flow" || record.attributeName === "data-cordis-panel" || record.attributeName === "data-slot" || record.attributeName === "role") {
          projectedStateChanged = true;
        }
        continue;
      }
      const appNodes = [...record.addedNodes, ...record.removedNodes].filter((node) => node instanceof Element && !isSkinChrome(node));
      if (appNodes.length > 0 && (appNodes.some((node) => nodeTouches(node, sidebarChromeSelector)) || target !== void 0 && target.closest(SIDEBAR_COLUMN_SELECTOR) !== null)) {
        sidebarStructureChanged = true;
      }
      if (appNodes.length > 0 && (appNodes.some((node) => nodeTouches(node, composerSelector)) || target !== void 0 && target.closest(composerSelector) !== null)) {
        composerChanged = true;
      }
      if (appNodes.length > 0 && (appNodes.some((node) => nodeTouches(node, CONVERSATION_COLUMN_SELECTOR)) || target !== void 0 && target.closest(CONVERSATION_COLUMN_SELECTOR) !== null)) {
        chatStructureChanged = true;
      }
      if (appNodes.some((node) => nodeTouches(node, SETTINGS_MASK_SELECTOR))) {
        settingsStateChanged = true;
      }
      if (appNodes.length > 0 && (appNodes.some((node) => nodeTouches(node, PROJECTED_STATE_SELECTOR)) || target?.matches("header, [data-slot='sidebar.settings']") === true)) {
        projectedStateChanged = true;
      }
    }
    if (projectedStateChanged) syncProjectedState();
    if (sidebarStructureChanged) syncSidebarDecorations();
    else if (workspaceStateChanged) decorateWorkspaceTree(decoratedElements);
    if (!sidebarStructureChanged && chatStructureChanged) {
      ensureChatAreaStage(characterStage);
      ensureChatAreaChrome(topTrim, bottomTrim);
      ensureComposerBrand(ownedNodes);
      ensureComposerBrand(ownedNodes);
      ensureResizeObserved();
    }
    if (backdropChanged) syncBackdrop();
    if (composerChanged) {
      syncComposerMotion();
    }
    if (settingsStateChanged || projectedStateChanged) syncSettingsBackdropFrame();
  });
  observer.observe(body, {
    attributes: true,
    attributeFilter: [
      "aria-expanded",
      "aria-selected",
      "data-chat-flow",
      "data-cordis-panel",
      "data-ds-dark-theme",
      "data-phase",
      "data-slot",
      "role"
    ],
    childList: true,
    subtree: true
  });
  const favicon = document.createElement("link");
  favicon.rel = "icon";
  favicon.type = "image/png";
  favicon.href = PHOEBE_ATELIER_ICON;
  favicon.dataset.skinChrome = "favicon";
  favicon.dataset.skinOwner = SKIN_OWNER2;
  ownedNodes.add(favicon);
  document.head.append(favicon);
  document.title = SKIN_TITLE;
}

// scripts/v2-entry.ts
var MIRRORED_ATTRS = [
  "data-dsh-phoebe-art",
  "data-dsh-phoebe-font",
  "data-dsh-phoebe-model-exit",
  "data-dsh-phoebe-model",
  "data-phoebe-scene"
];
function apply2(hostCtx) {
  const mirror = () => {
    const html = document.documentElement;
    const body = document.body;
    for (const attr of MIRRORED_ATTRS) {
      const value = html.getAttribute(attr);
      if (value === null) body.removeAttribute(attr);
      else body.setAttribute(attr, value);
    }
  };
  const observer = new MutationObserver(mirror);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: MIRRORED_ATTRS
  });
  apply({
    effect(fn) {
      const cleanup = fn();
      hostCtx.effect(() => () => {
        observer.disconnect();
        for (const attr of MIRRORED_ATTRS) document.body.removeAttribute(attr);
        if (typeof cleanup === "function") cleanup();
      });
    }
  });
  mirror();
}

  return module.exports;
})();
export default function defineSkinHooks() {
  return {
    apply(ctx) {
      var effect = function (fn) {
        var dispose = typeof fn === 'function' ? fn() : undefined;
        if (typeof dispose === 'function') ctx.onCleanup(dispose);
      };
      if (typeof ctx.assetBase === 'string' && ctx.assetBase !== '') {
        __skin.__setPhoebeAssetBase(ctx.assetBase);
      }
      __skin.apply({ effect: effect });
    },
  };
}
