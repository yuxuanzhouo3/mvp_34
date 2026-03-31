// GoNative/Median JS Bridge Library for iOS
// This provides the JavaScript interface for native bridge communication

(function() {
    if (window.median) return;
    
    window.median = {
        onReady: function(callback) {
            if (document.readyState === 'complete') {
                callback();
            } else {
                window.addEventListener('load', callback);
            }
        },
        
        statusbar: {
            set: function(params) {
                window.webkit.messageHandlers.medianBridge.postMessage({
                    command: 'statusbar/set',
                    style: params.style || 'auto',
                    overlay: params.overlay || false
                });
            }
        },
        
        deviceInfo: function(callback) {
            var callbackName = '_median_cb_' + Date.now();
            window[callbackName] = function(data) {
                callback(data);
                delete window[callbackName];
            };
            window.webkit.messageHandlers.medianBridge.postMessage({
                command: 'deviceInfo',
                callback: callbackName
            });
        },
        
        clipboard: {
            set: function(params) {
                window.webkit.messageHandlers.medianBridge.postMessage({
                    command: 'clipboard/set',
                    text: params.text || ''
                });
            }
        },
        
        share: {
            sharePage: function(params) {
                window.webkit.messageHandlers.medianBridge.postMessage({
                    command: 'share/sharePage',
                    url: params.url || window.location.href,
                    text: params.text || document.title
                });
            }
        }
    };
    
    // Backward compatibility
    window.gonative = window.median;
})();
