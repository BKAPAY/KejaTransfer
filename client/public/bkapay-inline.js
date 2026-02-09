(function() {
  "use strict";

  var BKAPAY_MODAL_ID = "bkapay-checkout-modal";
  var BKAPAY_OVERLAY_ID = "bkapay-checkout-overlay";
  var BKAPAY_IFRAME_ID = "bkapay-checkout-iframe";
  var paymentFinalized = false;

  function getBaseUrl() {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || "";
      if (src.indexOf("bkapay-inline.js") !== -1) {
        var url = new URL(src);
        return url.origin;
      }
    }
    return window.location.origin;
  }

  function injectStyles() {
    if (document.getElementById("bkapay-inline-styles")) return;
    var style = document.createElement("style");
    style.id = "bkapay-inline-styles";
    style.textContent = [
      "#" + BKAPAY_OVERLAY_ID + " {",
      "  position: fixed; top: 0; left: 0; right: 0; bottom: 0;",
      "  background: rgba(0,0,0,0.6); z-index: 999998;",
      "  opacity: 0; transition: opacity 0.3s ease;",
      "}",
      "#" + BKAPAY_OVERLAY_ID + ".bkapay-visible { opacity: 1; }",
      "#" + BKAPAY_MODAL_ID + " {",
      "  position: fixed; top: 50%; left: 50%;",
      "  transform: translate(-50%, -50%) scale(0.95);",
      "  width: 95%; max-width: 480px; height: 90vh; max-height: 720px;",
      "  z-index: 999999; border-radius: 16px; overflow: hidden;",
      "  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);",
      "  opacity: 0; transition: opacity 0.3s ease, transform 0.3s ease;",
      "  background: #fff;",
      "}",
      "#" + BKAPAY_MODAL_ID + ".bkapay-visible {",
      "  opacity: 1; transform: translate(-50%, -50%) scale(1);",
      "}",
      "#" + BKAPAY_IFRAME_ID + " {",
      "  width: 100%; height: 100%; border: none;",
      "}",
      ".bkapay-close-btn {",
      "  position: absolute; top: 8px; right: 8px; z-index: 1000000;",
      "  width: 32px; height: 32px; border-radius: 50%;",
      "  background: rgba(0,0,0,0.5); color: #fff; border: none;",
      "  cursor: pointer; display: flex; align-items: center;",
      "  justify-content: center; font-size: 18px; line-height: 1;",
      "  transition: background 0.2s;",
      "}",
      ".bkapay-close-btn:hover { background: rgba(0,0,0,0.7); }",
      "@media (max-width: 480px) {",
      "  #" + BKAPAY_MODAL_ID + " {",
      "    width: 100%; height: 100%; max-width: 100%; max-height: 100%;",
      "    border-radius: 0; top: 0; left: 0;",
      "    transform: translateY(100%);",
      "  }",
      "  #" + BKAPAY_MODAL_ID + ".bkapay-visible {",
      "    transform: translateY(0);",
      "  }",
      "}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function closeModal(triggerOnClose) {
    var overlay = document.getElementById(BKAPAY_OVERLAY_ID);
    var modal = document.getElementById(BKAPAY_MODAL_ID);
    if (overlay) {
      overlay.classList.remove("bkapay-visible");
      setTimeout(function() { overlay.remove(); }, 300);
    }
    if (modal) {
      modal.classList.remove("bkapay-visible");
      setTimeout(function() { modal.remove(); }, 300);
    }
    document.body.style.overflow = "";
    if (triggerOnClose && typeof triggerOnClose === "function") {
      triggerOnClose();
    }
  }

  function openModal(options) {
    if (document.getElementById(BKAPAY_MODAL_ID)) return;

    paymentFinalized = false;
    injectStyles();
    document.body.style.overflow = "hidden";

    var baseUrl = getBaseUrl();
    var params = new URLSearchParams();
    params.set("amount", options.amount);
    params.set("mode", "inline");
    if (options.description) params.set("description", options.description);
    if (options.orderId) params.set("orderId", options.orderId);
    if (options.customer) {
      if (options.customer.name) params.set("customerName", options.customer.name);
      if (options.customer.email) params.set("customerEmail", options.customer.email);
      if (options.customer.phone) params.set("customerPhone", options.customer.phone);
    }

    var iframeUrl = baseUrl + "/api-pay/" + options.key + "?" + params.toString();

    var overlay = document.createElement("div");
    overlay.id = BKAPAY_OVERLAY_ID;
    overlay.addEventListener("click", function() {
      if (!paymentFinalized) {
        if (typeof options.onClose === "function") {
          options.onClose({ status: "cancelled" });
        }
      }
      closeModal();
    });

    var modal = document.createElement("div");
    modal.id = BKAPAY_MODAL_ID;

    var closeBtn = document.createElement("button");
    closeBtn.className = "bkapay-close-btn";
    closeBtn.innerHTML = "&#10005;";
    closeBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      if (!paymentFinalized) {
        if (typeof options.onClose === "function") {
          options.onClose({ status: "cancelled" });
        }
      }
      closeModal();
    });

    var iframe = document.createElement("iframe");
    iframe.id = BKAPAY_IFRAME_ID;
    iframe.src = iframeUrl;
    iframe.allow = "payment";
    iframe.setAttribute("allowfullscreen", "true");

    modal.appendChild(closeBtn);
    modal.appendChild(iframe);
    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        overlay.classList.add("bkapay-visible");
        modal.classList.add("bkapay-visible");
      });
    });

    window.addEventListener("message", function handler(event) {
      if (event.origin !== baseUrl) return;
      var data = event.data;
      if (!data || !data.type) return;

      if (data.type === "bkapay_payment_success") {
        paymentFinalized = true;
        if (typeof options.onSuccess === "function") {
          options.onSuccess({
            transactionId: data.transactionId,
            amount: data.amount,
            status: "completed"
          });
        }
        closeModal();
        window.removeEventListener("message", handler);
      } else if (data.type === "bkapay_payment_error") {
        paymentFinalized = true;
        if (typeof options.onError === "function") {
          options.onError({
            message: data.message || "Paiement echoue",
            transactionId: data.transactionId,
            status: data.status || "failed"
          });
        }
        closeModal();
        window.removeEventListener("message", handler);
      } else if (data.type === "bkapay_payment_close") {
        if (!paymentFinalized) {
          if (typeof options.onClose === "function") {
            options.onClose({ status: "cancelled" });
          }
        }
        closeModal();
        window.removeEventListener("message", handler);
      }
    });
  }

  window.BKApay = {
    checkout: function(options) {
      if (!options || !options.key || !options.amount) {
        console.error("BKApay: 'key' et 'amount' sont requis");
        return;
      }
      openModal(options);
    },
    close: function() {
      closeModal();
    }
  };
})();
